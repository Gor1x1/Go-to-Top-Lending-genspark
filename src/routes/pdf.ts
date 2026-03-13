/**
 * PDF generation and viewing routes
 */
import { Hono } from 'hono'
import { initDatabase } from '../lib/db'
import { notifyTelegram } from '../helpers/telegram'

type Bindings = { DB: D1Database }

export function register(app: Hono<{ Bindings: Bindings }>) {
app.post('/api/generate-pdf', async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json();
    const lang = body.lang || 'ru';
    const items = body.items || [];
    const total = body.total || 0;
    const clientName = body.clientName || '';
    const clientContact = body.clientContact || '';
    const referralCode = body.referralCode || '';
    const packageData = body.package || null; // { package_id, name, name_ru, name_am, package_price, original_price, items }

    // Calculate subtotal from items (before any discount)
    let subtotal = 0;
    for (const item of items) { subtotal += Number(item.subtotal || 0); }
    // If frontend sent total that matches subtotal, use subtotal; otherwise total might already include discount
    const frontendTotal = Number(total) || 0;
    // Package price is added on top (not subject to discount)
    const packagePrice = packageData ? (Number(packageData.package_price) || 0) : 0;
    
    // Load referral code details and compute discount
    let discountPercent = 0;
    let discountAmount = 0;
    let freeServices: any[] = [];
    let initLinkedPackages: number[] = [];
    let initLinkedServices: number[] = [];
    if (referralCode) {
      try {
        const refRow = await db.prepare('SELECT * FROM referral_codes WHERE code = ? AND is_active = 1').bind(referralCode.trim().toUpperCase()).first();
        if (refRow) {
          discountPercent = Number(refRow.discount_percent) || 0;
          try { initLinkedPackages = JSON.parse((refRow.linked_packages as string) || '[]'); } catch { initLinkedPackages = []; }
          try { initLinkedServices = JSON.parse((refRow.linked_services as string) || '[]'); } catch { initLinkedServices = []; }
          if (discountPercent > 0) {
            // If linked_services is specified, only discount those services
            if (initLinkedServices.length > 0) {
              let linkedSubtotal = 0;
              for (const item of items) {
                if (item.service_id && initLinkedServices.map(Number).indexOf(Number(item.service_id)) !== -1) {
                  linkedSubtotal += Number(item.subtotal || 0);
                }
              }
              discountAmount = Math.round(linkedSubtotal * discountPercent / 100);
            } else {
              discountAmount = Math.round(subtotal * discountPercent / 100);
            }
          }
          // Load free services
          const fsRes = await db.prepare('SELECT rfs.*, cs.name_ru, cs.name_am, cs.price FROM referral_free_services rfs LEFT JOIN calculator_services cs ON rfs.service_id = cs.id WHERE rfs.referral_code_id = ?').bind(refRow.id).all();
          freeServices = (fsRes.results || []).map((fs: any) => ({
            name: fs.name_ru || '',
            name_am: fs.name_am || '',
            qty: fs.quantity || 1,
            price: Number(fs.price) || 0,
            discount_percent: fs.discount_percent,
            subtotal: 0
          }));
        }
      } catch {}
    }
    
    // Package discount: 
    // - Global promo (no linked_packages, no linked_services) → always apply to package
    // - Linked promo → only if linked_packages contains the selected package
    let initPkgDiscount = 0;
    if (discountPercent > 0 && packageData && packagePrice > 0) {
      const isGlobalPromo = initLinkedPackages.length === 0 && initLinkedServices.length === 0;
      const pkgId = packageData.package_id || packageData.id;
      if (isGlobalPromo) {
        initPkgDiscount = Math.round(packagePrice * discountPercent / 100);
      } else if (pkgId && initLinkedPackages.length > 0 && initLinkedPackages.map(Number).indexOf(Number(pkgId)) !== -1) {
        initPkgDiscount = Math.round(packagePrice * discountPercent / 100);
      }
    }
    
    // Final total = servicesSubtotal - discount + packagePrice - packageDiscount
    const servicesAfterDiscount = discountAmount > 0 ? (subtotal - discountAmount) : subtotal;
    // Always compute finalTotal explicitly: services (after discount) + package price (after pkg discount)
    // Never trust frontendTotal alone because it may already include packagePrice
    const finalTotal = servicesAfterDiscount + packagePrice - initPkgDiscount;

    // Run template fetch and lead number in parallel for speed
    const [tplRow, lastLead] = await Promise.all([
      db.prepare("SELECT * FROM pdf_templates WHERE template_key = 'default'").first(),
      db.prepare('SELECT MAX(lead_number) as max_num FROM leads').first()
    ]);
    let tpl: any = tplRow;
    if (!tpl) tpl = { header_ru: '\u041a\u043e\u043c\u043c\u0435\u0440\u0447\u0435\u0441\u043a\u043e\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435', header_am: '\u0531\u057c\u0587\u057f\u0580\u0561\u0575\u056b\u0576 \u0561\u057c\u0561\u057b\u0561\u0580\u056f', intro_ru: '', intro_am: '', outro_ru: '', outro_am: '', footer_ru: '', footer_am: '', company_name: 'Go to Top', company_phone: '', company_email: '', company_address: '' };

    const isAm = lang === 'am';
    const header = isAm ? (tpl.header_am || '\u0531\u057c\u0587\u057f\u0580\u0561\u0575\u056b\u0576 \u0561\u057c\u0561\u057b\u0561\u0580\u056f') : (tpl.header_ru || '\u041a\u043e\u043c\u043c\u0435\u0440\u0447\u0435\u0441\u043a\u043e\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435');
    const intro = isAm ? tpl.intro_am : tpl.intro_ru;
    const outro = isAm ? tpl.outro_am : tpl.outro_ru;
    const footer = isAm ? tpl.footer_am : tpl.footer_ru;

    let rows = '';
    for (const item of items) {
      const iName = isAm ? (item.name_am || item.name || '') : (item.name_ru || item.name || '');
      rows += '<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">' + iName + '</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center">' + (item.qty || 1) + '</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap">' + Number(item.price || 0).toLocaleString('ru-RU') + '\u00a0\u058f</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;white-space:nowrap">' + Number(item.subtotal || 0).toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>';
    }

    // Save lead with unique ID (using pre-fetched lastLead)
    const ua = c.req.header('User-Agent') || '';
    const nextNum = ((lastLead?.max_num as number) || 0) + 1;
    const calcDataJson = JSON.stringify({ 
      items, 
      subtotal, 
      servicesSubtotal: subtotal, // At initial generation, all items are services (no articles yet)
      articlesSubtotal: 0,
      total: finalTotal, 
      referralCode, 
      discountPercent, 
      discountAmount,
      freeServices,
      package: packageData || undefined
    });
    const leadResult = await db.prepare('INSERT INTO leads (lead_number, source, name, contact, calc_data, lang, referral_code, user_agent, total_amount) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(nextNum, 'calculator_pdf', clientName, clientContact, calcDataJson, lang, referralCode, ua.substring(0,200), finalTotal).run();
    const leadId = leadResult.meta?.last_row_id || 0;
    // Increment referral code usage
    if (referralCode) {
      try { await db.prepare("UPDATE referral_codes SET uses_count = uses_count + 1 WHERE code = ? AND is_active = 1").bind(referralCode).run(); } catch {}
    }

    // Notify via Telegram with detailed info
    const tgLines = [
      '\ud83d\udccb ' + (isAm ? '\u0546\u0578\u0580 \u0570\u0561\u0575\u057f #' : '\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u044f\u0432\u043a\u0430 #') + leadId,
      '\ud83d\udc64 ' + (clientName || '-'),
      '\ud83d\udcde ' + (clientContact || '-'),
      '\ud83d\udcb0 ' + Number(finalTotal).toLocaleString('ru-RU') + ' \u058f'
    ];
    if (referralCode) tgLines.push('\ud83c\udff7 ' + (isAm ? '\u054a\u0580\u0578\u0574\u0578: ' : '\u041f\u0440\u043e\u043c\u043e: ') + referralCode + (discountPercent > 0 ? ' (-' + discountPercent + '%, -' + discountAmount.toLocaleString('ru-RU') + ' \u058f)' : ''));
    if (packageData) tgLines.push('\ud83d\udce6 ' + (isAm ? '\u0553\u0561\u0569\u0565\u0569: ' : '\u041f\u0430\u043a\u0435\u0442: ') + (packageData.name || packageData.name_ru || '') + ' = ' + Number(packagePrice).toLocaleString('ru-RU') + ' \u058f');
    tgLines.push((isAm ? '\ud83d\udcc4 \u0550\u0561\u0577\u057e\u0561\u0580\u056f:' : '\ud83d\udcc4 \u0420\u0430\u0441\u0447\u0451\u0442:'));
    for (const it of items) { tgLines.push('  \u2022 ' + it.name + ' \u00d7 ' + it.qty + ' = ' + Number(it.subtotal).toLocaleString('ru-RU') + ' \u058f'); }
    // Fire and forget — don't wait for TG notification
    notifyTelegram(db, { name: clientName, contact: clientContact, source: 'calculator_pdf', message: tgLines.join('\n'), lang }).catch(() => {});

    // Build labels ONLY in current language (no mixing)
    const L = isAm
      ? { svc: '\u053e\u0561\u057c\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576', qty: '\u0554\u0561\u0576\u0561\u056f', price: '\u0533\u056b\u0576', sum: '\u0533\u0578\u0582\u0574\u0561\u0580', total: '\u0538\u0546\u0534\u0531\u0544\u0535\u0546\u0538:', subtotal: '\u0535\u0576\u0569\u0561\u0570\u0561\u0577\u057e\u0561\u0580\u056f:', client: '\u0540\u0561\u0573\u0561\u056d\u0578\u0580\u0564:', date: '\u0531\u0574\u057d\u0561\u0569\u056b\u057e:', id: '\u0540\u0561\u0575\u057f \u2116', dl: '\ud83d\udce5 \u0546\u0565\u0580\u0562\u0565\u057c\u0576\u0565\u056c PDF' }
      : { svc: '\u0423\u0441\u043b\u0443\u0433\u0430', qty: '\u041a\u043e\u043b-\u0432\u043e', price: '\u0426\u0435\u043d\u0430', sum: '\u0421\u0443\u043c\u043c\u0430', total: '\u0418\u0422\u041e\u0413\u041e:', subtotal: '\u041f\u043e\u0434\u0438\u0442\u043e\u0433:', client: '\u041a\u043b\u0438\u0435\u043d\u0442:', date: '\u0414\u0430\u0442\u0430:', id: '\u0417\u0430\u044f\u0432\u043a\u0430 \u2116', dl: '\ud83d\udce5 \u0421\u043a\u0430\u0447\u0430\u0442\u044c PDF' };

    const pdfHtml = '<!DOCTYPE html><html lang="' + lang + '"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>' +
      '*{margin:0;padding:0;box-sizing:border-box}' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;padding:24px;max-width:800px;margin:0 auto;background:#fff}' +
      '.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #8B5CF6;flex-wrap:wrap;gap:12px}' +
      '.logo{font-size:24px;font-weight:800;color:#8B5CF6}.ci{text-align:right;font-size:11px;color:#6b7280}' +
      '.ttl{font-size:20px;font-weight:700;color:#1f2937;margin-bottom:12px}' +
      '.meta{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:14px;font-size:12px;color:#6b7280}' +
      '.cli{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:20px;font-size:14px}' +
      '.intro{margin-bottom:20px;line-height:1.6;color:#4b5563;font-size:14px;white-space:pre-line}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e5e7eb;font-size:13px}' +
      'th{background:#8B5CF6;color:white;padding:10px 12px;text-align:left;font-weight:600}' +
      'td{padding:10px 12px;border-bottom:1px solid #e5e7eb}' +
      '.tr{background:#f3f0ff;font-weight:700;font-size:16px}' +
      '.outro{margin-top:20px;line-height:1.6;color:#4b5563;font-size:14px;white-space:pre-line}' +
      '.ftr{margin-top:32px;padding-top:16px;border-top:2px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center;white-space:pre-line}' +
      '.dlbar{position:sticky;bottom:8px;background:#8B5CF6;color:white;text-align:center;padding:14px;border-radius:12px;margin-top:24px;cursor:pointer;font-weight:700;font-size:16px;box-shadow:0 4px 20px rgba(139,92,246,0.4);text-decoration:none;display:block}' +
      '.dlbar:hover{background:#7C3AED}' +
      '@media print{*{visibility:hidden!important}.dlbar{display:none!important}body{padding:16px;visibility:visible!important}body>*{visibility:visible!important}body>*>*{visibility:visible!important}body>*>*>*{visibility:visible!important}body>*>*>*>*{visibility:visible!important}div[style*="position:fixed"],div[style*="position: fixed"],iframe,aside,[class*="plugin"],[class*="extension"],[id*="1688"],[id*="plugin"],[id*="ext-"],.fixed{display:none!important;width:0!important;height:0!important;overflow:hidden!important}}' +
      '@media(max-width:600px){body{padding:16px}table{font-size:11px}th,td{padding:8px 6px}.hdr{flex-direction:column;align-items:flex-start}.ttl{font-size:18px}}' +
      '</style></head><body>' +
      '<div class="hdr"><div class="logo">' + (tpl.company_name || 'Go to Top') + '</div><div class="ci">' +
      (tpl.company_phone ? '<div>' + tpl.company_phone + '</div>' : '') +
      (tpl.company_email ? '<div>' + tpl.company_email + '</div>' : '') +
      (tpl.company_address ? '<div>' + tpl.company_address + '</div>' : '') +
      '</div></div>' +
      '<div class="ttl">' + (header || '') + '</div>' +
      '<div class="meta"><span>' + L.date + ' ' + new Date().toLocaleDateString(isAm ? 'hy-AM' : 'ru-RU') + '</span><span>' + L.id + leadId + '</span></div>' +
      (clientName || clientContact ? '<div class="cli"><strong>' + L.client + '</strong> ' + (clientName || '') + (clientContact ? ' | ' + clientContact : '') + '</div>' : '') +
      (intro ? '<div class="intro">' + intro + '</div>' : '') +
      '<table><thead><tr><th>' + L.svc + '</th><th style="text-align:center">' + L.qty + '</th><th style="text-align:right">' + L.price + '</th><th style="text-align:right">' + L.sum + '</th></tr></thead><tbody>' + rows +
      '<tr class="tr"><td colspan="3" style="padding:12px;text-align:right">' + L.total + '</td><td style="padding:12px;text-align:right;color:#8B5CF6;font-size:18px;white-space:nowrap">' + Number(finalTotal).toLocaleString('ru-RU') + '\u00a0\u058f</td></tr></tbody></table>' +
      (outro ? '<div class="outro">' + outro + '</div>' : '') +
      (footer ? '<div class="ftr">' + footer + '</div>' : '') +
      '<a class="dlbar" onclick="cleanAndPrint()">' + L.dl + '</a>' +
      '<scr' + 'ipt>function cleanAndPrint(){var b=document.body;var ch=b.children;for(var i=ch.length-1;i>=0;i--){var e=ch[i];if(e.tagName==="SCRIPT"||e.tagName==="STYLE"||e.className==="hdr"||e.className==="ttl"||e.className==="meta"||e.className==="cli"||e.className==="intro"||e.tagName==="TABLE"||e.className==="outro"||e.className==="ftr")continue;if(e.style&&(e.style.position==="fixed"||e.style.position==="absolute")){e.remove()}else if(e.tagName==="IFRAME"||e.tagName==="ASIDE"){e.remove()}}window.print()}</scr' + 'ipt>' +
      '</body></html>';

    // Return the lead ID so client can navigate to the PDF page
    return c.json({ leadId: leadId, url: '/pdf/' + leadId });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
})


// ===== PDF VIEW - GET /pdf/:id (works on ALL devices including iOS WebView) =====
app.get('/pdf/:id', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const id = c.req.param('id');
    const lead = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
    if (!lead) return c.text('PDF not found', 404);
    
    const lang = (lead.lang as string) || 'ru';
    const isAm = lang === 'am';
    const isEn = lang === 'en';
    let calcData: any = {};
    try { calcData = JSON.parse(lead.calc_data as string); } catch { calcData = { items: [], total: 0 }; }
    const items = calcData.items || [];
    const total = calcData.total || 0;
    // Compute services subtotal ONLY from items array — never fall back to total
    // because total may already include package price
    let computedSvcSubtotal = 0;
    for (const ci of items) { computedSvcSubtotal += Number(ci.subtotal || 0); }
    // Use computed subtotal from items, or servicesSubtotal from saved data, or plain subtotal
    // NEVER fall back to total — total includes package price and would cause double-counting
    const subtotal = computedSvcSubtotal > 0 ? computedSvcSubtotal : (calcData.servicesSubtotal || calcData.subtotal || 0);
    const clientName = (lead.name as string) || '';
    const clientContact = (lead.contact as string) || '';
    const refundAmount = Number(lead.refund_amount) || 0;
    const referralCode = (lead.referral_code as string) || calcData.referralCode || '';
    const pkgData = calcData.package || null;
    const pkgPrice = pkgData ? (Number(pkgData.package_price) || 0) : 0;
    const pkgOriginalPrice = pkgData ? (Number(pkgData.original_price) || 0) : 0;
    
    // Load referral code details if present (for showing discounts & free services in PDF)
    let refDiscount = 0;
    let refFreeServices: any[] = [];
    let refServiceDiscounts: any[] = [];
    let refLinkedPackages: number[] = [];
    let refLinkedServices: number[] = [];
    if (referralCode) {
      try {
        const refRow = await db.prepare('SELECT * FROM referral_codes WHERE code = ? AND is_active = 1').bind(referralCode.trim().toUpperCase()).first();
        if (refRow) {
          refDiscount = Number(refRow.discount_percent) || 0;
          try { refLinkedPackages = JSON.parse((refRow.linked_packages as string) || '[]'); } catch { refLinkedPackages = []; }
          try { refLinkedServices = JSON.parse((refRow.linked_services as string) || '[]'); } catch { refLinkedServices = []; }
          const fsRes = await db.prepare('SELECT rfs.*, cs.name_ru, cs.name_am, cs.price FROM referral_free_services rfs LEFT JOIN calculator_services cs ON rfs.service_id = cs.id WHERE rfs.referral_code_id = ?').bind(refRow.id).all();
          for (const fs of (fsRes.results || [])) {
            if ((fs.discount_percent as number) === 0 || (fs.discount_percent as number) >= 100) {
              refFreeServices.push(fs);
            } else {
              refServiceDiscounts.push(fs);
            }
          }
        }
      } catch {}
    }
    
    let tpl: any = await db.prepare("SELECT * FROM pdf_templates WHERE template_key = 'default'").first();
    if (!tpl) tpl = {};
    
    const lSuffix = '_' + lang;
    const header = tpl['header' + lSuffix] || (isEn ? 'Commercial Proposal' : isAm ? '\u0531\u057c\u0587\u057f\u0580\u0561\u0575\u056b\u0576 \u0561\u057c\u0561\u057b\u0561\u0580\u056f' : '\u041a\u043e\u043c\u043c\u0435\u0440\u0447\u0435\u0441\u043a\u043e\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435');
    const intro = tpl['intro' + lSuffix] || '';
    const outro = tpl['outro' + lSuffix] || '';
    const footer = tpl['footer' + lSuffix] || '';
    const terms = tpl['terms' + lSuffix] || '';
    const bankDetails = tpl['bank_details' + lSuffix] || '';
    const accentColor = tpl.accent_color || '#8B5CF6';
    const invoicePrefix = tpl.invoice_prefix || 'INV';
    const companyLogo = tpl.company_logo_url || '';
    const companyWebsite = tpl.company_website || '';
    const companyInn = tpl.company_inn || '';
    
    const L = {
      svc: tpl['label_service' + lSuffix] || (isEn ? 'Service' : isAm ? '\u053e\u0561\u057c\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576' : '\u0423\u0441\u043b\u0443\u0433\u0430'),
      qty: tpl['label_qty' + lSuffix] || (isEn ? 'Qty' : isAm ? '\u0554\u0561\u0576\u0561\u056f' : '\u041a\u043e\u043b-\u0432\u043e'),
      price: tpl['label_price' + lSuffix] || (isEn ? 'Price' : isAm ? '\u0533\u056b\u0576' : '\u0426\u0565\u043d\u0430'),
      sum: tpl['label_sum' + lSuffix] || (isEn ? 'Total' : isAm ? '\u0533\u0578\u0582\u0574\u0561\u0580' : '\u0421\u0443\u043c\u043c\u0430'),
      total: tpl['label_total' + lSuffix] || (isEn ? 'TOTAL:' : isAm ? '\u0538\u0546\u0534\u0531\u0544\u0535\u0546\u0538:' : '\u0418\u0422\u041e\u0413\u041e:'),
      subtotal: tpl['label_subtotal' + lSuffix] || (isEn ? 'Subtotal:' : isAm ? '\u0535\u0576\u0569\u0561\u0570\u0561\u0577\u057e\u0561\u0580\u056f:' : '\u041f\u043e\u0434\u0438\u0442\u043e\u0433:'),
      client: tpl['label_client' + lSuffix] || (isEn ? 'Client:' : isAm ? '\u0540\u0561\u0573\u0561\u056d\u0578\u0580\u0564:' : '\u041a\u043b\u0438\u0435\u043d\u0442:'),
      date: tpl['label_date' + lSuffix] || (isEn ? 'Date:' : isAm ? '\u0531\u0574\u057d\u0561\u0569\u056b\u057e:' : '\u0414\u0430\u0442\u0430:'),
      id: tpl['label_invoice' + lSuffix] || (isEn ? 'Invoice #' : isAm ? '\u0540\u0561\u0575\u057f \u2116' : '\u0417\u0430\u044f\u0432\u043a\u0430 \u2116'),
      back: tpl['label_back' + lSuffix] || (isEn ? 'Back' : isAm ? '\u0540\u0561\u0577\u057e\u056b\u0579' : '\u041a \u0440\u0430\u0441\u0447\u0451\u0442\u0443'),
      num: '\u2116',
      terms: tpl['terms' + lSuffix] ? (isEn ? 'Terms & Conditions' : isAm ? '\u054a\u0561\u0575\u0574\u0561\u0576\u0576\u0565\u0580' : '\u0423\u0441\u043b\u043e\u0432\u0438\u044f') : '',
      bank: isEn ? 'Bank Details' : isAm ? '\u0532\u0561\u0576\u056f\u0561\u0575\u056b\u0576 \u057f\u057e\u0575\u0561\u056c\u0576\u0565\u0580' : '\u0411\u0430\u043d\u043a\u043e\u0432\u0441\u043a\u0438\u0435 \u0440\u0435\u043a\u0432\u0438\u0437\u0438\u0442\u044b',
      inn: isEn ? 'Reg. No.' : isAm ? '\u0540\u054e\u0540\u0540' : '\u0418\u041d\u041d'
    };
    
    // Separate items into services and articles
    const serviceItems = items.filter((i: any) => !i.wb_article);
    const articleItems = items.filter((i: any) => !!i.wb_article);
    let svcSubtotal = 0;
    for (const si of serviceItems) { svcSubtotal += Number(si.subtotal || 0); }
    let artSubtotal = 0;
    for (const ai of articleItems) { artSubtotal += Number(ai.subtotal || 0); }
    
    const subtotalFormatted = Number(subtotal).toLocaleString('ru-RU');
    // Apply referral discount based on linked_services and linked_packages
    const calcDiscountPercent = calcData.discountPercent || refDiscount || 0;
    const isGlobalRef = refLinkedPackages.length === 0 && refLinkedServices.length === 0;
    // Calculate discount base: if linked_services specified, only those services; otherwise all services
    let discountBase = 0;
    if (calcDiscountPercent > 0) {
      if (refLinkedServices.length > 0) {
        // Only sum services that are in the linked list
        for (const si of serviceItems) {
          if (si.service_id && refLinkedServices.map(Number).indexOf(Number(si.service_id)) !== -1) {
            discountBase += Number(si.subtotal || 0);
          }
        }
      } else {
        // No filter — discount applies to all services
        discountBase = svcSubtotal > 0 ? svcSubtotal : (calcData.servicesSubtotal || subtotal);
      }
    }
    const calcDiscountAmount = calcDiscountPercent > 0 ? Math.round(Number(discountBase) * calcDiscountPercent / 100) : 0;
    // Package discount:
    // - Global promo (no linked_packages, no linked_services) → always apply to package
    // - Linked promo → only if linked_packages contains the selected package
    let pkgDiscountAmount = 0;
    if (calcDiscountPercent > 0 && pkgData && pkgPrice > 0) {
      const pkgId = pkgData.package_id || pkgData.id;
      if (isGlobalRef) {
        pkgDiscountAmount = Math.round(pkgPrice * calcDiscountPercent / 100);
      } else if (pkgId && refLinkedPackages.length > 0 && refLinkedPackages.map(Number).indexOf(Number(pkgId)) !== -1) {
        pkgDiscountAmount = Math.round(pkgPrice * calcDiscountPercent / 100);
      }
    }
    // afterDiscount = services subtotal (minus discount if any) + package price (minus pkg discount if any)
    const afterDiscount = (calcDiscountAmount > 0 ? Number(subtotal) - calcDiscountAmount : Number(subtotal)) + pkgPrice - pkgDiscountAmount;
    const beforeCommission = refundAmount > 0 ? (afterDiscount - refundAmount) : afterDiscount;
    
    // Load payment method commission
    let pmName = '';
    let pmNameAm = '';
    let pmNameEn = '';
    let pmCommissionPct = 0;
    let pmCommissionAmt = 0;
    if (lead.payment_method_id) {
      try {
        const pmRow = await db.prepare('SELECT * FROM payment_methods WHERE id = ? AND is_active = 1').bind(lead.payment_method_id).first();
        if (pmRow) {
          pmName = (pmRow.name_ru as string) || '';
          pmNameAm = (pmRow.name_am as string) || pmName;
          pmNameEn = pmName; // fallback
          pmCommissionPct = Number(pmRow.commission_pct) || 0;
          pmCommissionAmt = pmCommissionPct > 0 ? Math.round(beforeCommission * pmCommissionPct / 100) : 0;
        }
      } catch {}
    }
    const finalTotal = beforeCommission + pmCommissionAmt;
    const totalFormatted = finalTotal.toLocaleString('ru-RU');
    
    let rows = '';
    let rowNum = 0;
    
    // Section header for services (if articles also exist)
    // Load service name translations for fallback (when items were saved without name_am/name_ru)
    let svcNameMap: Record<string, { name_ru: string; name_am: string }> = {};
    try {
      const allSvcs = await db.prepare('SELECT name_ru, name_am FROM calculator_services').all();
      for (const s of (allSvcs.results || [])) {
        if (s.name_ru) svcNameMap[String(s.name_ru)] = { name_ru: String(s.name_ru), name_am: String(s.name_am || s.name_ru) };
        if (s.name_am) svcNameMap[String(s.name_am)] = { name_ru: String(s.name_ru || s.name_am), name_am: String(s.name_am) };
      }
    } catch {}
    // Also add hardcoded buyout name translations
    svcNameMap['\u0412\u044b\u043a\u0443\u043f + \u0437\u0430\u0431\u043e\u0440 \u0438\u0437 \u041f\u0412\u0417'] = { name_ru: '\u0412\u044b\u043a\u0443\u043f + \u0437\u0430\u0431\u043e\u0440 \u0438\u0437 \u041f\u0412\u0417', name_am: '\u0533\u0576\u0578\u0582\u0574 + \u057d\u057f\u0561\u0581\u0578\u0582\u0574 \u054a\u054e\u0536-\u056b\u0581' };
    
    if (articleItems.length > 0 && serviceItems.length > 0) {
      rows += '<tr><td colspan="5" style="padding:10px 12px;background:' + accentColor + '0d;font-weight:700;color:' + accentColor + ';font-size:0.9em"><i class="fas fa-calculator" style="margin-right:6px"></i>' + (isEn ? 'Services' : isAm ? '\u053e\u0561\u057c\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0576\u0565\u0580' : '\u0423\u0441\u043b\u0443\u0433\u0438') + '</td></tr>';
    }
    
    for (const item of serviceItems) {
      rowNum++;
      // Resolve name: use name_am/name_ru from item, or fallback to DB lookup by item.name
      let itemName = '';
      if (isAm) {
        itemName = item.name_am || (svcNameMap[item.name] && svcNameMap[item.name].name_am) || item.name || '';
      } else if (isEn) {
        itemName = item.name || '';
      } else {
        itemName = item.name_ru || (svcNameMap[item.name] && svcNameMap[item.name].name_ru) || item.name || '';
      }
      rows += '<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:0.85em;text-align:center">' + rowNum + '</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">' + itemName + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center">' + (item.qty || 1) + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap">' + Number(item.price || 0).toLocaleString('ru-RU') + '\u00a0\u058f</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;white-space:nowrap">' + Number(item.subtotal || 0).toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>';
    }
    // Add free / discounted services from referral code
    for (const fs of refFreeServices) {
      rowNum++;
      const fsName = (isAm ? (fs.name_am || fs.name_ru) : (isEn ? fs.name_ru : fs.name_ru)) || '';
      const freeLabel = isEn ? '(free)' : isAm ? '(\u0561\u0576\u057e\u0573\u0561\u0580)' : '(\u0431\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u043e)';
      rows += '<tr style="background:#f0fdf4"><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:0.85em;text-align:center">' + rowNum + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#16a34a"><i class="fas fa-gift" style="margin-right:4px"></i>' + fsName + ' <span style="font-size:0.8em;opacity:0.8">' + freeLabel + '</span></td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center">' + (fs.quantity || 1) + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;text-decoration:line-through;color:#94a3b8">' + Number(fs.price || 0).toLocaleString('ru-RU') + '\u00a0\u058f</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#16a34a">0\u00a0\u058f</td></tr>';
    }
    // Add services with partial discount from referral code (e.g. -30% on specific service)
    for (const sd of refServiceDiscounts) {
      rowNum++;
      const sdName = (isAm ? (sd.name_am || sd.name_ru) : (isEn ? sd.name_ru : sd.name_ru)) || '';
      const sdQty = Number(sd.quantity) || 1;
      const sdPrice = Number(sd.price) || 0;
      const sdDisc = Number(sd.discount_percent) || 0;
      const sdSubtotal = Math.round(sdPrice * sdQty * (100 - sdDisc) / 100);
      const discLabel = '-' + sdDisc + '%';
      rows += '<tr style="background:#fffbeb"><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:0.85em;text-align:center">' + rowNum + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#92400E"><i class="fas fa-percentage" style="margin-right:4px"></i>' + sdName + ' <span style="font-size:0.8em;background:#FBBF24;color:#78350F;padding:1px 6px;border-radius:8px;font-weight:600">' + discLabel + '</span></td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center">' + sdQty + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;text-decoration:line-through;color:#94a3b8">' + sdPrice.toLocaleString('ru-RU') + '\u00a0\u058f</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#92400E">' + sdSubtotal.toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>';
    }
    
    // Article items section
    if (articleItems.length > 0) {
      // Services subtotal and discount (before articles)
      if (serviceItems.length > 0) {
        rows += '<tr style="background:#f8fafc"><td colspan="4" style="padding:10px 12px;text-align:right;font-weight:600;color:#64748b">' + (isEn ? 'Services subtotal:' : isAm ? '\u053e\u0561\u057c\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0576\u0565\u0580 ' + L.subtotal : '\u041f\u043e\u0434\u0438\u0442\u043e\u0433 \u0443\u0441\u043b\u0443\u0433:') + '</td><td style="padding:10px 12px;text-align:right;font-weight:700;white-space:nowrap">' + svcSubtotal.toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>';
      }
      if (calcDiscountAmount > 0 && serviceItems.length > 0) {
        const svcAfterDisc = svcSubtotal - calcDiscountAmount;
        rows += '<tr style="background:' + accentColor + '08"><td colspan="4" style="padding:8px 12px;text-align:right;color:' + accentColor + ';font-weight:600;font-size:0.9em"><i class="fas fa-gift" style="margin-right:4px"></i>' + (isEn ? 'Promo discount' : isAm ? '\u0536\u0565\u0572\u0573' : '\u0421\u043a\u0438\u0434\u043a\u0430') + ' (' + referralCode + ' -' + calcDiscountPercent + '%):</td><td style="padding:8px 12px;text-align:right;color:' + accentColor + ';font-weight:700;font-size:0.9em;white-space:nowrap">-' + calcDiscountAmount.toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>';
        rows += '<tr style="background:#f0fdf4"><td colspan="4" style="padding:8px 12px;text-align:right;font-weight:700;color:#059669;font-size:0.9em">' + (isEn ? 'Services after discount:' : isAm ? '\u053e\u0561\u057c\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0576\u0565\u0580 \u0566\u0565\u0572\u0573\u0578\u057e:' : '\u0423\u0441\u043b\u0443\u0433\u0438 \u0441\u043e \u0441\u043a\u0438\u0434\u043a\u043e\u0439:') + '</td><td style="padding:8px 12px;text-align:right;font-weight:800;color:#059669;font-size:0.95em;white-space:nowrap">' + svcAfterDisc.toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>';
      }
      
      // Articles header
      rows += '<tr><td colspan="5" style="padding:10px 12px;background:#FEF3C7;font-weight:700;color:#92400E;font-size:0.9em"><i class="fas fa-box" style="margin-right:6px"></i>' + (isEn ? 'WB Articles' : isAm ? 'WB \u0561\u0580\u057f\u056b\u056f\u0578\u0582\u056c\u0576\u0565\u0580' : '\u0410\u0440\u0442\u0438\u043a\u0443\u043b\u044b WB') + '</td></tr>';
      for (const art of articleItems) {
        rowNum++;
        rows += '<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:0.85em;text-align:center">' + rowNum + '</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">' + (art.name || '') + '</td>' +
          '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center">' + (art.qty || 1) + '</td>' +
          '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap">' + Number(art.price || 0).toLocaleString('ru-RU') + '\u00a0\u058f</td>' +
          '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;white-space:nowrap">' + Number(art.subtotal || 0).toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>';
      }
      rows += '<tr style="background:#FEF3C7;opacity:0.8"><td colspan="4" style="padding:10px 12px;text-align:right;font-weight:600;color:#92400E">' + (isEn ? 'Articles subtotal:' : isAm ? '\u0531\u0580\u057f\u056b\u056f\u0578\u0582\u056c\u0576\u0565\u0580 ' + L.subtotal : '\u041f\u043e\u0434\u0438\u0442\u043e\u0433 \u0430\u0440\u0442\u0438\u043a\u0443\u043b\u044b:') + '</td><td style="padding:10px 12px;text-align:right;font-weight:700;color:#92400E;white-space:nowrap">' + artSubtotal.toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>';
    }
    
    const btnOrder = String(tpl['btn_order' + lSuffix] || (isEn ? 'Order Now' : isAm ? '\u054a\u0561\u057f\u057e\u056b\u0580\u0565\u056c \u0570\u056b\u0574\u0561' : '\u0417\u0430\u043a\u0430\u0437\u0430\u0442\u044c \u0441\u0435\u0439\u0447\u0430\u0441'));
    const btnDl = String(tpl['btn_download' + lSuffix] || (isEn ? 'Download' : isAm ? '\u0546\u0565\u0580\u0562\u0565\u057c\u0576\u0565\u056c' : '\u0421\u043a\u0430\u0447\u0430\u0442\u044c'));
    const messengerUrl = String(tpl.order_telegram_url || 'https://t.me/goo_to_top');
    
    const isWhatsApp = messengerUrl.includes('wa.me') || messengerUrl.includes('whatsapp');
    const messengerIcon = isWhatsApp ? 'fab fa-whatsapp' : 'fab fa-telegram';
    
    const orderMsg = String(tpl['order_message' + lSuffix] || (isEn ? 'Hello! I would like to place an order:' : isAm ? '\u0548\u0572\u057b\u0578\u0582\u0575\u0576! \u053f\u0581\u0561\u0576\u056f\u0561\u0576\u0561\u0575\u056b \u057a\u0561\u057f\u057e\u056b\u0580\u0565\u056c:' : '\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435! \u0425\u043e\u0447\u0443 \u043e\u0444\u043e\u0440\u043c\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437:'))
      + '\n' + invoicePrefix + '-' + id
      + '\n' + L.total + ' ' + Number(total).toLocaleString('ru-RU') + ' \u058f';
    const orderMsgFull = orderMsg
      + (clientName ? '\n' + (isEn ? 'Name' : isAm ? '\u0531\u0576\u0578\u0582\u0576' : '\u0418\u043c\u044f') + ': ' + clientName : '')
      + (clientContact ? '\n' + (isEn ? 'Contact' : isAm ? '\u053f\u0561\u057a' : '\u041a\u043e\u043d\u0442\u0430\u043a\u0442') + ': ' + clientContact : '');

    let messengerLink = '';
    if (isWhatsApp) {
      const waBase = messengerUrl.includes('?') ? messengerUrl + '&text=' : messengerUrl + '?text=';
      messengerLink = waBase + encodeURIComponent(orderMsgFull);
    } else {
      messengerLink = messengerUrl + '?text=' + encodeURIComponent(orderMsgFull);
    }

    const companyName = String(tpl.company_name || 'Go to Top');
    const companyPhone = String(tpl.company_phone || '');
    const companyEmail = String(tpl.company_email || '');
    const companyAddress = String(tpl.company_address || '');
    const localeCode = isEn ? 'en-US' : isAm ? 'hy-AM' : 'ru-RU';
    const dateStr = new Date().toLocaleDateString(localeCode);
    const invoiceNum = invoicePrefix + '-' + String(id).padStart(4, '0');

    const pdfHtml = '<!DOCTYPE html><html lang="' + lang + '"><head><meta charset="UTF-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
      + '<title>' + invoiceNum + ' | ' + companyName + '</title>'
      + '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css">'
      + '<style>'
      + '*{margin:0;padding:0;box-sizing:border-box}'
      + 'body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;background:#f9fafb}'
      + '#pc{padding:28px;max-width:800px;margin:0 auto;background:#fff;min-height:100vh}'
      + '.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid ' + accentColor + ';flex-wrap:wrap;gap:12px}'
      + '.logo-wrap{display:flex;align-items:center;gap:12px}'
      + '.logo-img{height:40px;max-width:160px;object-fit:contain}'
      + '.logo{font-size:24px;font-weight:800;color:' + accentColor + '}'
      + '.ci{text-align:right;font-size:11px;color:#6b7280;line-height:1.6}'
      + '.inv-num{font-size:13px;font-weight:700;color:' + accentColor + ';background:' + accentColor + '12;padding:4px 10px;border-radius:6px;display:inline-block;margin-bottom:6px}'
      + '.ttl{font-size:20px;font-weight:700;color:#1f2937;margin-bottom:12px}'
      + '.meta{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:14px;font-size:12px;color:#6b7280}'
      + '.cli{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:20px;font-size:14px}'
      + '.intro{margin-bottom:20px;line-height:1.6;color:#4b5563;font-size:14px;white-space:pre-line}'
      + 'table{width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e5e7eb;font-size:13px}'
      + 'th{background:' + accentColor + ';color:white;padding:10px 12px;text-align:left;font-weight:600}'
      + 'td{padding:10px 12px;border-bottom:1px solid #e5e7eb}'
      + '.tr{background:' + accentColor + '0d;font-weight:700;font-size:16px}'
      + '.outro{margin-top:20px;line-height:1.6;color:#4b5563;font-size:14px;white-space:pre-line}'
      + '.terms-box{margin-top:20px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#64748b;line-height:1.6;white-space:pre-line}'
      + '.terms-title{font-weight:700;color:#475569;margin-bottom:6px;font-size:13px}'
      + '.bank-box{margin-top:12px;padding:12px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e;line-height:1.5;white-space:pre-line}'
      + '.ftr{margin-top:32px;padding-top:16px;border-top:2px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center;white-space:pre-line}'
      + '.actions{display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb}'
      + '.abtn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;text-decoration:none;border:none;transition:all 0.2s}'
      + '.abtn-order{background:linear-gradient(135deg,#10B981,#059669);color:#fff}'
      + '.abtn-order:hover{box-shadow:0 4px 15px rgba(16,185,129,0.4)}'
      + '.abtn-dl{background:#f3f4f6;color:#374151;border:1px solid #d1d5db}'
      + '.abtn-dl:hover{background:#e5e7eb}'
      + '.abtn-dl i{color:' + accentColor + '}'
      + '.abtn-back{background:transparent;color:#6b7280;border:1px solid #d1d5db}'
      + '.abtn-back:hover{color:#1f2937;border-color:#9ca3af}'
      + '@media print{body,body *{visibility:hidden!important}#pc,#pc *{visibility:visible!important}.actions{display:none!important}body{background:#fff;margin:0;padding:0}#pc{padding:16px;box-shadow:none;position:absolute;left:0;top:0;width:100%}'
      + 'div[style*="position:fixed"],div[style*="position: fixed"],iframe,aside,[class*="plugin"],[class*="extension"],[id*="1688"],[id*="plugin"],[id*="ext-"],.fixed{display:none!important;width:0!important;height:0!important;overflow:hidden!important}'
      + '}'
      + '@media(max-width:600px){#pc{padding:16px 16px 100px}table{font-size:11px}th,td{padding:8px 6px}.hdr{flex-direction:column;align-items:flex-start}.ttl{font-size:18px}'
      + '.actions{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;padding:10px 12px;margin:0;box-shadow:0 -2px 12px rgba(0,0,0,0.08);z-index:100;justify-content:center}'
      + '.abtn{padding:10px 14px;font-size:12px}.abtn-back span{display:none}}'
      + '</style></head><body>'
      + '<div id="pc">'
      // Header with logo
      + '<div class="hdr"><div>'
      + '<div class="inv-num">' + invoiceNum + '</div>'
      + '<div class="logo-wrap">'
      + (companyLogo ? '<img class="logo-img" src="' + companyLogo + '" onerror="this.style.display=&apos;none&apos;">' : '')
      + '<span class="logo">' + companyName + '</span></div>'
      + '</div><div class="ci">'
      + (companyPhone ? '<div><i class="fas fa-phone" style="margin-right:4px"></i>' + companyPhone + '</div>' : '')
      + (companyEmail ? '<div><i class="fas fa-envelope" style="margin-right:4px"></i>' + companyEmail + '</div>' : '')
      + (companyAddress ? '<div><i class="fas fa-map-marker-alt" style="margin-right:4px"></i>' + companyAddress + '</div>' : '')
      + (companyWebsite ? '<div><i class="fas fa-globe" style="margin-right:4px"></i>' + companyWebsite + '</div>' : '')
      + (companyInn ? '<div>' + L.inn + ': ' + companyInn + '</div>' : '')
      + '</div></div>'
      + '<div class="ttl">' + header + '</div>'
      + '<div class="meta"><span><i class="fas fa-calendar-alt" style="margin-right:4px"></i>' + L.date + ' ' + dateStr + '</span><span><i class="fas fa-hashtag" style="margin-right:4px"></i>' + L.id + ' ' + invoiceNum + '</span></div>'
      + (clientName || clientContact ? '<div class="cli"><strong><i class="fas fa-user" style="margin-right:4px;color:' + accentColor + '"></i>' + L.client + '</strong> ' + (clientName || '') + (clientContact ? ' | <i class="fas fa-phone-alt" style="margin-right:4px;color:#10B981"></i>' + clientContact : '') + '</div>' : '')
      + (intro ? '<div class="intro">' + intro + '</div>' : '')
      + (referralCode ? '<div style="margin-bottom:16px;padding:10px 16px;background:' + accentColor + '0d;border:1px solid ' + accentColor + '30;border-radius:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><i class="fas fa-gift" style="color:' + accentColor + ';font-size:1.1rem"></i><span style="font-weight:700;color:' + accentColor + '">' + (isEn ? 'Promo code' : isAm ? '\u054a\u0580\u0578\u0574\u0578\u056f\u0578\u0564' : '\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434') + ': ' + referralCode + '</span>' + (refDiscount > 0 ? '<span style="background:' + accentColor + ';color:white;padding:2px 8px;border-radius:12px;font-size:0.8em;font-weight:600">-' + refDiscount + '%</span>' : '') + (refFreeServices.length > 0 ? '<span style="color:#16a34a;font-size:0.85em">' + (isEn ? 'Free services included' : isAm ? '\u0531\u0576\u057e\u0573\u0561\u0580 \u056e\u0561\u057c\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0576\u0565\u0580' : '\u0411\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u044b\u0435 \u0443\u0441\u043b\u0443\u0433\u0438 \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u044b') + '</span>' : '') + '</div>' : '')
      // Package block (if package was selected)
      + (pkgData ? '<div style="margin-bottom:16px;padding:14px 18px;background:linear-gradient(135deg,#FEF3C710,#F59E0B12);border:2px solid #F59E0B40;border-radius:10px">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><i class="fas fa-box-open" style="color:#F59E0B;font-size:1.1rem"></i><span style="font-weight:700;font-size:1rem;color:#B45309">' + (isEn ? 'Package' : isAm ? '\u0553\u0561\u0569\u0565\u0569' : '\u041f\u0430\u043a\u0435\u0442') + ': ' + (isAm ? (pkgData.name_am || pkgData.name_ru || pkgData.name || '') : (pkgData.name_ru || pkgData.name || '')) + '</span></div>'
        + (pkgData.items && pkgData.items.length > 0 ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' + pkgData.items.map((pi: any) => '<span style="background:#FEF3C7;padding:3px 10px;border-radius:6px;font-size:0.8rem;color:#92400E"><i class="fas fa-check" style="color:#16a34a;margin-right:4px;font-size:0.7rem"></i>' + (isAm ? (pi.service_name_am || pi.service_name_ru || '') : (pi.service_name_ru || '')) + ' \u00d7 ' + (pi.quantity || 1) + '</span>').join('') + '</div>' : '')
        + '<div style="display:flex;align-items:baseline;gap:10px">'
        + (pkgOriginalPrice > 0 && pkgOriginalPrice > pkgPrice ? '<span style="text-decoration:line-through;color:#94a3b8;font-size:0.85rem">' + pkgOriginalPrice.toLocaleString('ru-RU') + '\u00a0\u058f</span>' : '')
        + '<span style="font-weight:800;font-size:1.1rem;color:#F59E0B">' + pkgPrice.toLocaleString('ru-RU') + '\u00a0\u058f</span>'
        + (pkgOriginalPrice > 0 && pkgOriginalPrice > pkgPrice ? '<span style="background:#059669;color:white;padding:2px 8px;border-radius:10px;font-size:0.75rem;font-weight:700">-' + Math.round((1 - pkgPrice / pkgOriginalPrice) * 100) + '%</span>' : '')
        + '</div></div>' : '')
      + '<table><thead><tr><th style="text-align:center;width:35px">' + L.num + '</th><th>' + L.svc + '</th><th style="text-align:center">' + L.qty + '</th><th style="text-align:right">' + L.price + '</th><th style="text-align:right">' + L.sum + '</th></tr></thead><tbody>' + rows
      // Subtotal row: only show if there are actual service items (subtotal > 0)
      + (Number(subtotal) > 0 ? '<tr class="tr"><td colspan="4" style="padding:12px;text-align:right">' + L.subtotal + '</td><td style="padding:12px;text-align:right;color:' + accentColor + ';font-size:18px;white-space:nowrap">' + subtotalFormatted + '\u00a0\u058f</td></tr>' : '')
      // Package row: show package price as addition if services exist, or as standalone
      + (pkgData && Number(subtotal) > 0 ? '<tr style="background:#FFFBEB"><td colspan="4" style="padding:10px 12px;text-align:right;color:#B45309;font-weight:600"><i class="fas fa-box-open" style="margin-right:4px;color:#F59E0B"></i>' + (isEn ? 'Package' : isAm ? '\u0553\u0561\u0569\u0565\u0569' : '\u041f\u0430\u043a\u0435\u0442') + ': ' + (isAm ? (pkgData.name_am || pkgData.name_ru || pkgData.name || '') : (pkgData.name_ru || pkgData.name || '')) + '</td><td style="padding:10px 12px;text-align:right;color:#B45309;font-weight:700;font-size:15px;white-space:nowrap">+' + pkgPrice.toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>' : '')
      + (calcDiscountAmount > 0 && articleItems.length === 0 ? '<tr style="background:' + accentColor + '08"><td colspan="4" style="padding:10px 12px;text-align:right;color:' + accentColor + ';font-weight:600"><i class="fas fa-gift" style="margin-right:4px"></i>' + (isEn ? 'Promo discount (services)' : isAm ? '\u0536\u0565\u0572\u0573 (\u056e\u0561\u057c\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0576\u0565\u0580)' : '\u0421\u043a\u0438\u0434\u043a\u0430 \u043d\u0430 \u0443\u0441\u043b\u0443\u0433\u0438') + ' (' + referralCode + ' -' + calcDiscountPercent + '%):</td><td style="padding:10px 12px;text-align:right;color:' + accentColor + ';font-weight:700;font-size:15px;white-space:nowrap">-' + calcDiscountAmount.toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>' : '')
      + (pkgDiscountAmount > 0 ? '<tr style="background:#FEF3C720"><td colspan="4" style="padding:10px 12px;text-align:right;color:#B45309;font-weight:600"><i class="fas fa-gift" style="margin-right:4px;color:#F59E0B"></i>' + (isEn ? 'Package promo discount' : isAm ? '\u0553\u0561\u0569\u0565\u0569\u056b \u0566\u0565\u0572\u0573' : '\u0421\u043a\u0438\u0434\u043a\u0430 \u043d\u0430 \u043f\u0430\u043a\u0435\u0442') + ' (' + referralCode + ' -' + calcDiscountPercent + '%):</td><td style="padding:10px 12px;text-align:right;color:#B45309;font-weight:700;font-size:15px;white-space:nowrap">-' + pkgDiscountAmount.toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>' : '')
      + (refundAmount > 0 ? '<tr style="background:#fef2f2"><td colspan="4" style="padding:10px 12px;text-align:right;color:#DC2626;font-weight:600">' + (isEn ? 'Refund:' : isAm ? '\u054e\u0565\u0580\u0561\u0564\u0561\u0580\u0571:' : '\u0412\u043e\u0437\u0432\u0440\u0430\u0442:') + '</td><td style="padding:10px 12px;text-align:right;color:#DC2626;font-weight:700;font-size:15px;white-space:nowrap">-' + Number(refundAmount).toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>' : '')
      + (pmCommissionAmt > 0 ? '<tr style="background:#eff6ff"><td colspan="4" style="padding:10px 12px;text-align:right;color:#2563EB;font-weight:600"><i class="fas fa-credit-card" style="margin-right:4px"></i>' + (isEn ? 'Payment commission' : isAm ? '\u054e\u0573\u0561\u0580\u0574\u0561\u0576 \u0574\u056b\u057b\u0576\u0578\u0580\u0564\u0561\u057e\u0573\u0561\u0580' : '\u041a\u043e\u043c\u0438\u0441\u0441\u0438\u044f \u0437\u0430 \u043e\u043f\u043b\u0430\u0442\u0443') + ' (' + (isAm ? pmNameAm : pmName) + ' ' + pmCommissionPct + '%):</td><td style="padding:10px 12px;text-align:right;color:#2563EB;font-weight:700;font-size:15px;white-space:nowrap">+' + pmCommissionAmt.toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>' : '')
      // TOTAL row: always show when there are adjustments (discount, refund, commission, package+services); for package-only, just show the total
      + '<tr style="background:#f0fdf4"><td colspan="4" style="padding:12px;text-align:right;font-weight:800;font-size:15px">' + L.total + '</td><td style="padding:12px;text-align:right;color:#059669;font-weight:900;font-size:18px;white-space:nowrap">' + totalFormatted + '\u00a0\u058f</td></tr>'
      + '</tbody></table>'
      + (outro ? '<div class="outro">' + outro + '</div>' : '')
      + (terms ? '<div class="terms-box"><div class="terms-title"><i class="fas fa-gavel" style="margin-right:4px"></i>' + L.terms + '</div>' + terms + '</div>' : '')
      + (bankDetails ? '<div class="bank-box"><strong><i class="fas fa-university" style="margin-right:4px"></i>' + L.bank + ':</strong><br>' + bankDetails + '</div>' : '')
      + (footer ? '<div class="ftr">' + footer + '</div>' : '')
      + '<div class="actions">'
      + '<a class="abtn abtn-back" href="/#calculator"><i class="fas fa-arrow-left"></i> <span>' + L.back + '</span></a>'
      + '<button class="abtn abtn-dl" onclick="cleanAndPrint()"><i class="fas fa-download"></i> ' + btnDl + '</button>'
      + '<a class="abtn abtn-order" href="' + messengerLink + '" target="_blank"><i class="' + messengerIcon + '"></i> ' + btnOrder + '</a>'
      + '</div>'
      + '</div>'
      + '<scr' + 'ipt>function cleanAndPrint(){var pc=document.getElementById("pc");if(pc){var all=document.body.querySelectorAll("*");for(var i=all.length-1;i>=0;i--){var e=all[i];if(!pc.contains(e)&&e!==document.body&&e!==document.head&&e.tagName!=="HTML"&&e.tagName!=="SCRIPT"&&e.tagName!=="STYLE"&&e.tagName!=="LINK"&&e.tagName!=="META"){e.style.display="none"}}}window.print()}</scr' + 'ipt>'
      + '</body></html>';

    return c.html(pdfHtml);
  } catch (e: any) {
    return c.text('Error: ' + e.message, 500);
  }
})
}
