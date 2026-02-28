import { Hono } from 'hono'
import { html } from 'hono/html'
import adminApi from './api/admin'
import { getAdminHTML } from './admin/panel'
import { initDatabase } from './lib/db'
import { verifyToken } from './lib/auth'
import { SEED_CONTENT_SECTIONS, SEED_CALC_TABS, SEED_CALC_SERVICES, SEED_TG_MESSAGES } from './seed-data'

type Bindings = { DB: D1Database }
const app = new Hono<{ Bindings: Bindings }>()

// ===== PUBLIC API: Site data from D1 (for dynamic rendering) =====
app.get('/api/site-data', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    
    // Load all content sections from DB
    const contentRes = await db.prepare('SELECT section_key, content_json FROM site_content ORDER BY sort_order').all();
    const dbContent: Record<string, any[]> = {};
    for (const row of contentRes.results) {
      try { dbContent[row.section_key as string] = JSON.parse(row.content_json as string); } catch { dbContent[row.section_key as string] = []; }
    }
    
    // Build text_map: original_ru -> {ru, am} using seed data as the source of original keys
    // The HTML has data-ru="original text" hardcoded. We match by seed items (which mirror the HTML).
    // If user edited text in admin, db content[section][i].ru != seed[section][i].ru
    // So we map: seed_item.ru (= HTML data-ru) -> db_item (edited values)
    const textMap: Record<string, {ru: string, am: string}> = {};
    for (const seedSection of SEED_CONTENT_SECTIONS) {
      const dbItems = dbContent[seedSection.key] || [];
      for (let i = 0; i < seedSection.items.length; i++) {
        const origRu = seedSection.items[i].ru; // this matches data-ru in HTML
        const dbItem = dbItems[i]; // edited version (if any)
        if (dbItem && (dbItem.ru !== origRu || dbItem.am !== seedSection.items[i].am)) {
          textMap[origRu] = { ru: dbItem.ru, am: dbItem.am };
        }
      }
    }
    
    // Load calculator tabs
    const tabsRes = await db.prepare('SELECT * FROM calculator_tabs WHERE is_active = 1 ORDER BY sort_order').all();
    
    // Load calculator services with tiers
    const svcsRes = await db.prepare(`
      SELECT cs.*, ct.tab_key 
      FROM calculator_services cs 
      JOIN calculator_tabs ct ON cs.tab_id = ct.id 
      WHERE cs.is_active = 1 
      ORDER BY cs.tab_id, cs.sort_order
    `).all();
    
    // Load telegram messages
    const tgRes = await db.prepare('SELECT * FROM telegram_messages WHERE is_active = 1 ORDER BY sort_order').all();
    const telegram: Record<string, any> = {};
    for (const row of tgRes.results) { telegram[row.button_key as string] = row; }
    
    // Load custom scripts
    const scriptsRes = await db.prepare('SELECT * FROM custom_scripts WHERE is_active = 1 ORDER BY sort_order').all();
    const scripts = { head: [] as string[], body_start: [] as string[], body_end: [] as string[] };
    for (const row of scriptsRes.results) {
      const p = row.placement as string;
      const code = row.code as string;
      if (p === 'head') scripts.head.push(code);
      else if (p === 'body_start') scripts.body_start.push(code);
      else if (p === 'body_end') scripts.body_end.push(code);
    }
    
    // Load section order
    const sectionOrderRes = await db.prepare('SELECT * FROM section_order ORDER BY sort_order').all();
    
    // Load slot counters (for frontend rendering)
    const slotCountersRes = await db.prepare('SELECT * FROM slot_counter WHERE show_timer = 1 ORDER BY id').all();
    
    // Load photo blocks (for frontend rendering)
    const photoBlocksRes = await db.prepare('SELECT * FROM photo_blocks WHERE is_visible = 1 ORDER BY sort_order').all();
    
    // Load ticker items from site_blocks (editable in admin)
    let tickerItems: any[] = [];
    try {
      const tickerBlock = await db.prepare("SELECT texts_ru, texts_am, images FROM site_blocks WHERE block_key = 'ticker' LIMIT 1").first();
      if (tickerBlock) {
        const tRu = JSON.parse(tickerBlock.texts_ru as string || '[]');
        const tAm = JSON.parse(tickerBlock.texts_am as string || '[]');
        const tIcons = JSON.parse(tickerBlock.images as string || '[]');
        for (let i = 0; i < Math.max(tRu.length, tAm.length); i++) {
          tickerItems.push({ icon: tIcons[i] || 'fa-check-circle', ru: tRu[i] || '', am: tAm[i] || '' });
        }
      }
    } catch(te) { /* ticker not yet imported */ }

    // Load footer social links from site_blocks
    let footerSocials: any[] = [];
    try {
      const footerBlock = await db.prepare("SELECT social_links FROM site_blocks WHERE block_key = 'footer' LIMIT 1").first();
      if (footerBlock && footerBlock.social_links) {
        footerSocials = JSON.parse(footerBlock.social_links as string || '[]');
      }
    } catch(fe) { /* footer not yet imported */ }

    // Load all site_blocks for per-block features (social links, photos, slots, custom_html)
    let siteBlockFeatures: any[] = [];
    try {
      const blocksRes = await db.prepare("SELECT block_key, block_type, social_links, images, buttons, custom_html, is_visible FROM site_blocks WHERE is_visible = 1 ORDER BY sort_order").all();
      for (const blk of (blocksRes.results || [])) {
        let socials: any[] = [];
        try { socials = JSON.parse(blk.social_links as string || '[]'); } catch { socials = []; }
        let blockOpts: any = {};
        try { blockOpts = JSON.parse(blk.custom_html as string || '{}'); } catch { blockOpts = {}; }
        let blockPhotos: any[] = [];
        try { blockPhotos = Array.isArray(blockOpts.photos) ? blockOpts.photos : []; } catch { blockPhotos = []; }
        let blockBtns: any[] = [];
        try { blockBtns = JSON.parse(blk.buttons as string || '[]'); } catch { blockBtns = []; }
        siteBlockFeatures.push({
            key: blk.block_key,
            social_links: socials,
            social_settings: blockOpts.social_settings || {},
            photos: blockPhotos,
            photo_url: blockOpts.photo_url || '',
            show_socials: socials.length > 0 || blockOpts.show_socials || false,
            show_photos: blockPhotos.length > 0 || blockOpts.show_photos || false,
            show_slots: blockOpts.show_slots || false,
            block_type: blk.block_type || 'section',
            buttons: blockBtns,
          });
      }
    } catch(bf) { /* blocks not yet imported */ }

    // Set Cache-Control to no-cache so edits appear instantly
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
    return c.json({
      content: dbContent,
      textMap, // original_ru -> {ru, am} for changed texts only
      tabs: tabsRes.results,
      services: svcsRes.results,
      telegram,
      scripts,
      sectionOrder: sectionOrderRes.results,
      slotCounters: slotCountersRes.results,
      photoBlocks: photoBlocksRes.results,
      tickerItems: tickerItems.length > 0 ? tickerItems : null,
      footerSocials: footerSocials.length > 0 ? footerSocials : null,
      blockFeatures: siteBlockFeatures.length > 0 ? siteBlockFeatures : null,
      _ts: Date.now()
    });
  } catch (e: any) {
    // If DB not initialized yet, return empty — frontend will use hardcoded fallback
    return c.json({ content: {}, textMap: {}, tabs: [], services: [], telegram: {}, scripts: { head: [], body_start: [], body_end: [] }, sectionOrder: [], slotCounters: [], photoBlocks: [], tickerItems: null, footerSocials: null, _ts: Date.now() });
  }
});

// API endpoint for lead form submission
// ===== Helper: send Telegram notification =====
async function notifyTelegram(db: D1Database, leadData: any) {
  try {
    const configs = await db.prepare('SELECT * FROM telegram_bot_config WHERE is_active = 1 AND notify_leads = 1').all();
    for (const cfg of configs.results) {
      const token = cfg.bot_token as string;
      const chatId = cfg.chat_id as string;
      if (!token || !chatId) continue;
      const text = `🔔 <b>Новая заявка!</b>\n\n` +
        `👤 <b>Имя:</b> ${leadData.name || '—'}\n` +
        `📱 <b>Контакт:</b> ${leadData.contact || '—'}\n` +
        `📦 <b>Продукт:</b> ${leadData.product || '—'}\n` +
        `🛠 <b>Услуга:</b> ${leadData.service || '—'}\n` +
        `💬 <b>Сообщение:</b> ${leadData.message || '—'}\n` +
        `🌐 <b>Язык:</b> ${leadData.lang || '—'}\n` +
        `📋 <b>Источник:</b> ${leadData.source || 'form'}\n` +
        (leadData.referral_code ? `🎁 <b>Реф. код:</b> ${leadData.referral_code}\n` : '') +
        `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Yerevan' })}`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
      }).catch(() => {});
    }
  } catch {}
}

app.post('/api/lead', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const body = await c.req.json();
    const ua = c.req.header('User-Agent') || '';
    // Get next lead number
    const lastLead = await db.prepare('SELECT MAX(lead_number) as max_num FROM leads').first();
    const nextNum = ((lastLead?.max_num as number) || 0) + 1;
    await db.prepare('INSERT INTO leads (lead_number, source, name, contact, product, service, message, lang, referral_code, user_agent) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(nextNum, 'form', body.name||'', body.contact||'', body.product||'', body.service||'', body.message||'', body.lang||'ru', body.referral_code||'', ua.substring(0,200)).run();
    notifyTelegram(db, { ...body, source: 'form' });
    return c.json({ success: true, message: 'Lead received' });
  } catch (e) {
    console.error('Lead error:', e);
    return c.json({ error: 'Failed to save lead' }, 500);
  }
})

// API endpoint for popup form -> save + notify
app.post('/api/popup-lead', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const body = await c.req.json();
    const ua = c.req.header('User-Agent') || '';
    // Get next lead number
    const lastLead = await db.prepare('SELECT MAX(lead_number) as max_num FROM leads').first();
    const nextNum = ((lastLead?.max_num as number) || 0) + 1;
    await db.prepare('INSERT INTO leads (lead_number, source, name, contact, product, service, message, lang, user_agent) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(nextNum, 'popup', body.name||'', body.contact||'', body.product||'', body.service||'', body.message||'', body.lang||'ru', ua.substring(0,200)).run();
    notifyTelegram(db, { ...body, source: 'popup' });
    return c.json({ success: true, message: 'Lead received' });
  } catch (e) {
    console.error('Popup lead error:', e);
    return c.json({ error: 'Failed to save lead' }, 500);
  }
})

// API endpoint for button-click auto-lead (creates lead when CTA button clicked)
app.post('/api/button-lead', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const body = await c.req.json();
    const ua = c.req.header('User-Agent') || '';
    const lastLead = await db.prepare('SELECT MAX(lead_number) as max_num FROM leads').first();
    const nextNum = ((lastLead?.max_num as number) || 0) + 1;
    await db.prepare('INSERT INTO leads (lead_number, source, name, contact, product, service, message, lang, user_agent) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(nextNum, 'button_click', body.name||'', body.contact||'', body.button_text||'', body.section||'', body.message||'', body.lang||'ru', ua.substring(0,200)).run();
    notifyTelegram(db, { name: body.name||'(кнопка)', contact: body.contact||'', source: 'button_click', message: `Кнопка: ${body.button_text||''}. Секция: ${body.section||''}` });
    return c.json({ success: true, lead_number: nextNum });
  } catch (e) {
    console.error('Button lead error:', e);
    return c.json({ error: 'Failed' }, 500);
  }
})

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ===== PUBLIC SLOT COUNTERS (multiple) =====
app.get('/api/slots', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const rows = await db.prepare('SELECT * FROM slot_counter ORDER BY id').all();
    if (!rows.results || rows.results.length === 0) return c.json({ counters: [] });
    const counters = rows.results.map((row: any) => ({
      id: row.id,
      counter_name: row.counter_name || 'main',
      total: row.total_slots, booked: row.booked_slots,
      free: Math.max(0, (row.total_slots as number) - (row.booked_slots as number)),
      label_ru: row.label_ru, label_am: row.label_am, show_timer: row.show_timer,
      position: row.position || 'after-hero'
    }));
    return c.json({ counters });
  } catch { return c.json({ counters: [] }); }
})

// ===== PDF GENERATION (HTML-based, returns HTML for print/save) =====
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
      rows += '<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">' + (item.name || '') + '</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center">' + (item.qty || 1) + '</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap">' + Number(item.price || 0).toLocaleString('ru-RU') + '\u00a0\u058f</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;white-space:nowrap">' + Number(item.subtotal || 0).toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>';
    }

    // Save lead with unique ID (using pre-fetched lastLead)
    const ua = c.req.header('User-Agent') || '';
    const nextNum = ((lastLead?.max_num as number) || 0) + 1;
    const leadResult = await db.prepare('INSERT INTO leads (lead_number, source, name, contact, calc_data, lang, referral_code, user_agent, total_amount) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(nextNum, 'calculator_pdf', clientName, clientContact, JSON.stringify({ items, total, referralCode }), lang, referralCode, ua.substring(0,200), total).run();
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
      '\ud83d\udcb0 ' + Number(total).toLocaleString('ru-RU') + ' \u058f'
    ];
    if (referralCode) tgLines.push('\ud83c\udff7 ' + (isAm ? '\u054a\u0580\u0578\u0574\u0578: ' : '\u041f\u0440\u043e\u043c\u043e: ') + referralCode);
    tgLines.push((isAm ? '\ud83d\udcc4 \u0550\u0561\u0577\u057e\u0561\u0580\u056f:' : '\ud83d\udcc4 \u0420\u0430\u0441\u0447\u0451\u0442:'));
    for (const it of items) { tgLines.push('  \u2022 ' + it.name + ' \u00d7 ' + it.qty + ' = ' + Number(it.subtotal).toLocaleString('ru-RU') + ' \u058f'); }
    // Fire and forget — don't wait for TG notification
    notifyTelegram(db, { name: clientName, contact: clientContact, source: 'calculator_pdf', message: tgLines.join('\n'), lang }).catch(() => {});

    // Build labels ONLY in current language (no mixing)
    const L = isAm
      ? { svc: '\u053e\u0561\u057c\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576', qty: '\u0554\u0561\u0576\u0561\u056f', price: '\u0533\u056b\u0576', sum: '\u0533\u0578\u0582\u0574\u0561\u0580', total: '\u0538\u0546\u0534\u0531\u0544\u0535\u0546\u0538:', client: '\u0540\u0561\u0573\u0561\u056d\u0578\u0580\u0564:', date: '\u0531\u0574\u057d\u0561\u0569\u056b\u057e:', id: '\u0540\u0561\u0575\u057f \u2116', dl: '\ud83d\udce5 \u0546\u0565\u0580\u0562\u0565\u057c\u0576\u0565\u056c PDF' }
      : { svc: '\u0423\u0441\u043b\u0443\u0433\u0430', qty: '\u041a\u043e\u043b-\u0432\u043e', price: '\u0426\u0435\u043d\u0430', sum: '\u0421\u0443\u043c\u043c\u0430', total: '\u0418\u0422\u041e\u0413\u041e:', client: '\u041a\u043b\u0438\u0435\u043d\u0442:', date: '\u0414\u0430\u0442\u0430:', id: '\u0417\u0430\u044f\u0432\u043a\u0430 \u2116', dl: '\ud83d\udce5 \u0421\u043a\u0430\u0447\u0430\u0442\u044c PDF' };

    const pdfHtml = '<!DOCTYPE html><html lang="' + lang + '"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>' +
      '*{margin:0;padding:0;box-sizing:border-box}' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;padding:24px;max-width:800px;margin:0 auto;background:#fff}' +
      '.hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #8B5CF6;flex-wrap:wrap;gap:12px}' +
      '.logo{font-size:24px;font-weight:800;color:#8B5CF6}.ci{text-align:right;font-size:11px;color:#6b7280}' +
      '.ttl{font-size:20px;font-weight:700;color:#1f2937;margin-bottom:12px}' +
      '.meta{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:14px;font-size:12px;color:#6b7280}' +
      '.cli{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:20px;font-size:14px}' +
      '.intro{margin-bottom:20px;line-height:1.6;color:#4b5563;font-size:14px}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e5e7eb;font-size:13px}' +
      'th{background:#8B5CF6;color:white;padding:10px 12px;text-align:left;font-weight:600}' +
      'td{padding:10px 12px;border-bottom:1px solid #e5e7eb}' +
      '.tr{background:#f3f0ff;font-weight:700;font-size:16px}' +
      '.outro{margin-top:20px;line-height:1.6;color:#4b5563;font-size:14px}' +
      '.ftr{margin-top:32px;padding-top:16px;border-top:2px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}' +
      '.dlbar{position:sticky;bottom:8px;background:#8B5CF6;color:white;text-align:center;padding:14px;border-radius:12px;margin-top:24px;cursor:pointer;font-weight:700;font-size:16px;box-shadow:0 4px 20px rgba(139,92,246,0.4);text-decoration:none;display:block}' +
      '.dlbar:hover{background:#7C3AED}' +
      '@media print{.dlbar{display:none!important}body{padding:16px}}' +
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
      '<tr class="tr"><td colspan="3" style="padding:12px;text-align:right">' + L.total + '</td><td style="padding:12px;text-align:right;color:#8B5CF6;font-size:18px;white-space:nowrap">' + Number(total).toLocaleString('ru-RU') + '\u00a0\u058f</td></tr></tbody></table>' +
      (outro ? '<div class="outro">' + outro + '</div>' : '') +
      (footer ? '<div class="ftr">' + footer + '</div>' : '') +
      '<a class="dlbar" onclick="window.print()">' + L.dl + '</a>' +
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
    const lead = await db.prepare('SELECT * FROM leads WHERE id = ? AND source = ?').bind(id, 'calculator_pdf').first();
    if (!lead) return c.text('PDF not found', 404);
    
    const lang = (lead.lang as string) || 'ru';
    const isAm = lang === 'am';
    const isEn = lang === 'en';
    let calcData: any = {};
    try { calcData = JSON.parse(lead.calc_data as string); } catch { calcData = { items: [], total: 0 }; }
    const items = calcData.items || [];
    const total = calcData.total || 0;
    const subtotal = calcData.subtotal || total;
    const clientName = (lead.name as string) || '';
    const clientContact = (lead.contact as string) || '';
    const refundAmount = Number(lead.refund_amount) || 0;
    
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
    
    let rows = '';
    let rowNum = 0;
    for (const item of items) {
      rowNum++;
      rows += '<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:0.85em;text-align:center">' + rowNum + '</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">' + (item.name || '') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center">' + (item.qty || 1) + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap">' + Number(item.price || 0).toLocaleString('ru-RU') + '\u00a0\u058f</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;white-space:nowrap">' + Number(item.subtotal || 0).toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>';
    }
    
    const L = isEn
      ? { svc: 'Service', qty: 'Qty', price: 'Price', sum: 'Total', total: 'TOTAL:', client: 'Client:', date: 'Date:', id: 'Invoice #', back: 'Back', num: '#', terms: 'Terms & Conditions', bank: 'Bank Details', inn: 'Reg. No.' }
      : isAm
      ? { svc: '\u053e\u0561\u057c\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576', qty: '\u0554\u0561\u0576\u0561\u056f', price: '\u0533\u056b\u0576', sum: '\u0533\u0578\u0582\u0574\u0561\u0580', total: '\u0538\u0546\u0534\u0531\u0544\u0535\u0546\u0538:', client: '\u0540\u0561\u0573\u0561\u056d\u0578\u0580\u0564:', date: '\u0531\u0574\u057d\u0561\u0569\u056b\u057e:', id: '\u0540\u0561\u0575\u057f \u2116', back: '\u0540\u0561\u0577\u057e\u056b\u0579', num: '\u2116', terms: '\u054a\u0561\u0575\u0574\u0561\u0576\u0576\u0565\u0580', bank: '\u0532\u0561\u0576\u056f\u0561\u0575\u056b\u0576 \u057f\u057e\u0575\u0561\u043b\u043d\u0565\u0440', inn: '\u0540\u0544' }
      : { svc: '\u0423\u0441\u043b\u0443\u0433\u0430', qty: '\u041a\u043e\u043b-\u0432\u043e', price: '\u0426\u0435\u043d\u0430', sum: '\u0421\u0443\u043c\u043c\u0430', total: '\u0418\u0422\u041e\u0413\u041e:', client: '\u041a\u043b\u0438\u0435\u043d\u0442:', date: '\u0414\u0430\u0442\u0430:', id: '\u0417\u0430\u044f\u0432\u043a\u0430 \u2116', back: '\u041a \u0440\u0430\u0441\u0447\u0451\u0442\u0443', num: '\u2116', terms: '\u0423\u0441\u043b\u043e\u0432\u0438\u044f', bank: '\u0411\u0430\u043d\u043a\u043e\u0432\u0441\u043a\u0438\u0435 \u0440\u0435\u043a\u0432\u0438\u0437\u0438\u0442\u044b', inn: '\u0418\u041d\u041d' };

    const btnOrder = String(tpl['btn_order' + lSuffix] || (isEn ? 'Order Now' : isAm ? '\u054a\u0561\u057f\u057e\u056b\u0580\u0565\u056c \u0570\u056b\u0574\u0561' : '\u0417\u0430\u043a\u0430\u0437\u0430\u0442\u044c \u0441\u0435\u0439\u0447\u0430\u0441'));
    const btnDl = String(tpl['btn_download' + lSuffix] || (isEn ? 'Download' : isAm ? '\u0546\u0565\u0580\u0562\u0565\u057c\u0576\u0565\u056c' : '\u0421\u043a\u0430\u0447\u0430\u0442\u044c'));
    const messengerUrl = String(tpl.order_telegram_url || 'https://t.me/goo_to_top');
    
    const isWhatsApp = messengerUrl.includes('wa.me') || messengerUrl.includes('whatsapp');
    const messengerIcon = isWhatsApp ? 'fab fa-whatsapp' : 'fab fa-telegram';
    
    const orderMsg = (isEn ? 'Hello! I would like to place an order:' : isAm ? '\u0548\u0572\u057b\u0578\u0582\u0575\u0576! \u053f\u0581\u0561\u0576\u056f\u0561\u0576\u0561\u0575\u056b \u057a\u0561\u057f\u057e\u056b\u0580\u0565\u056c:' : '\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435! \u0425\u043e\u0447\u0443 \u043e\u0444\u043e\u0440\u043c\u0438\u0442\u044c \u0437\u0430\u043a\u0430\u0437:')
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
    const subtotalFormatted = Number(subtotal).toLocaleString('ru-RU');
    const finalTotal = refundAmount > 0 ? (Number(subtotal) - refundAmount) : Number(total);
    const totalFormatted = finalTotal.toLocaleString('ru-RU');
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
      + '.intro{margin-bottom:20px;line-height:1.6;color:#4b5563;font-size:14px}'
      + 'table{width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #e5e7eb;font-size:13px}'
      + 'th{background:' + accentColor + ';color:white;padding:10px 12px;text-align:left;font-weight:600}'
      + 'td{padding:10px 12px;border-bottom:1px solid #e5e7eb}'
      + '.tr{background:' + accentColor + '0d;font-weight:700;font-size:16px}'
      + '.outro{margin-top:20px;line-height:1.6;color:#4b5563;font-size:14px}'
      + '.terms-box{margin-top:20px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#64748b;line-height:1.6}'
      + '.terms-title{font-weight:700;color:#475569;margin-bottom:6px;font-size:13px}'
      + '.bank-box{margin-top:12px;padding:12px;background:#fefce8;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e;line-height:1.5}'
      + '.ftr{margin-top:32px;padding-top:16px;border-top:2px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}'
      + '.actions{display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap;margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb}'
      + '.abtn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;text-decoration:none;border:none;transition:all 0.2s}'
      + '.abtn-order{background:linear-gradient(135deg,#10B981,#059669);color:#fff}'
      + '.abtn-order:hover{box-shadow:0 4px 15px rgba(16,185,129,0.4)}'
      + '.abtn-dl{background:#f3f4f6;color:#374151;border:1px solid #d1d5db}'
      + '.abtn-dl:hover{background:#e5e7eb}'
      + '.abtn-dl i{color:' + accentColor + '}'
      + '.abtn-back{background:transparent;color:#6b7280;border:1px solid #d1d5db}'
      + '.abtn-back:hover{color:#1f2937;border-color:#9ca3af}'
      + '@media print{.actions{display:none!important}body{background:#fff}#pc{padding:16px;box-shadow:none}}'
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
      + '<table><thead><tr><th style="text-align:center;width:35px">' + L.num + '</th><th>' + L.svc + '</th><th style="text-align:center">' + L.qty + '</th><th style="text-align:right">' + L.price + '</th><th style="text-align:right">' + L.sum + '</th></tr></thead><tbody>' + rows
      + '<tr class="tr"><td colspan="4" style="padding:12px;text-align:right">' + L.total + '</td><td style="padding:12px;text-align:right;color:' + accentColor + ';font-size:18px;white-space:nowrap">' + subtotalFormatted + '\u00a0\u058f</td></tr>'
      + (refundAmount > 0 ? '<tr style="background:#fef2f2"><td colspan="4" style="padding:10px 12px;text-align:right;color:#DC2626;font-weight:600">' + (isEn ? 'Refund:' : isAm ? '\u054e\u0565\u0580\u0561\u0564\u0561\u0580\u0571:' : '\u0412\u043e\u0437\u0432\u0440\u0430\u0442:') + '</td><td style="padding:10px 12px;text-align:right;color:#DC2626;font-weight:700;font-size:15px;white-space:nowrap">-' + Number(refundAmount).toLocaleString('ru-RU') + '\u00a0\u058f</td></tr>'
        + '<tr style="background:#f0fdf4"><td colspan="4" style="padding:12px;text-align:right;font-weight:800;font-size:15px">' + (isEn ? 'Final Total:' : isAm ? '\u054e\u0565\u0580\u057b\u0576\u0561\u056f\u0561\u0576:' : '\u0418\u0442\u043e\u0433\u043e:') + '</td><td style="padding:12px;text-align:right;color:#059669;font-weight:900;font-size:18px;white-space:nowrap">' + totalFormatted + '\u00a0\u058f</td></tr>' : '')
      + '</tbody></table>'
      + (outro ? '<div class="outro">' + outro + '</div>' : '')
      + (terms ? '<div class="terms-box"><div class="terms-title"><i class="fas fa-gavel" style="margin-right:4px"></i>' + L.terms + '</div>' + terms + '</div>' : '')
      + (bankDetails ? '<div class="bank-box"><strong><i class="fas fa-university" style="margin-right:4px"></i>' + L.bank + ':</strong><br>' + bankDetails + '</div>' : '')
      + (footer ? '<div class="ftr">' + footer + '</div>' : '')
      + '<div class="actions">'
      + '<a class="abtn abtn-back" href="/#calculator"><i class="fas fa-arrow-left"></i> <span>' + L.back + '</span></a>'
      + '<button class="abtn abtn-dl" onclick="window.print()"><i class="fas fa-download"></i> ' + btnDl + '</button>'
      + '<a class="abtn abtn-order" href="' + messengerLink + '" target="_blank"><i class="' + messengerIcon + '"></i> ' + btnOrder + '</a>'
      + '</div>'
      + '</div>'
      + '</body></html>';

    return c.html(pdfHtml);
  } catch (e: any) {
    return c.text('Error: ' + e.message, 500);
  }
})

// ===== PAGE VIEW TRACKING =====
app.post('/api/track', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const body = await c.req.json();
    await db.prepare('INSERT INTO page_views (page, referrer, user_agent, lang, country) VALUES (?,?,?,?,?)')
      .bind(body.page || '/', body.referrer || '', body.ua || '', body.lang || 'ru', body.country || '').run();
    return c.json({ ok: true });
  } catch { return c.json({ ok: true }); }
})

// ===== REFERRAL CODE VALIDATION =====
app.post('/api/referral/check', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const { code } = await c.req.json();
    if (!code) return c.json({ valid: false });
    const row = await db.prepare('SELECT * FROM referral_codes WHERE code = ? AND is_active = 1').bind(code.trim().toUpperCase()).first();
    if (!row) return c.json({ valid: false });
    // Increment uses count
    await db.prepare('UPDATE referral_codes SET uses_count = uses_count + 1 WHERE id = ?').bind(row.id).run();
    return c.json({
      valid: true,
      discount_percent: row.discount_percent,
      free_reviews: row.free_reviews,
      description: row.description
    });
  } catch { return c.json({ valid: false }); }
})

// ===== PUBLIC FOOTER SETTINGS =====
app.get('/api/footer', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    let row = await db.prepare('SELECT * FROM footer_settings LIMIT 1').first();
    if (!row) return c.json({});
    return c.json(row);
  } catch { return c.json({}); }
})

// ===== PUBLIC PHOTO BLOCKS =====
app.get('/api/photo-blocks', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const rows = await db.prepare('SELECT * FROM photo_blocks WHERE is_visible = 1 ORDER BY sort_order').all();
    return c.json({ blocks: rows.results || [] });
  } catch { return c.json({ blocks: [] }); }
})

// ===== ADMIN API =====
app.route('/api/admin', adminApi)

// ===== ADMIN PANEL UI =====
app.get('/admin', (c) => {
  return c.html(getAdminHTML())
})

// ===== SEED FROM SITE (extracts all current texts into D1) =====
app.post('/api/admin/seed-from-site', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);
  const tokenVal = authHeader.replace('Bearer ', '');
  const payload = await verifyToken(tokenVal);
  if (!payload) return c.json({ error: 'Unauthorized' }, 401);
  
  const db = c.env.DB;
  await initDatabase(db);
  
  // Seed content sections - extracted from HTML
  const sections = SEED_CONTENT_SECTIONS;
  for (const s of sections) {
    await db.prepare('INSERT OR REPLACE INTO site_content (section_key, section_name, content_json, sort_order) VALUES (?,?,?,?)')
      .bind(s.key, s.name, JSON.stringify(s.items), s.sort).run();
  }
  
  // Seed calculator tabs
  const calcTabs = SEED_CALC_TABS;
  for (const t of calcTabs) {
    const existing = await db.prepare('SELECT id FROM calculator_tabs WHERE tab_key = ?').bind(t.key).first();
    if (!existing) {
      await db.prepare('INSERT INTO calculator_tabs (tab_key, name_ru, name_am, sort_order) VALUES (?,?,?,?)')
        .bind(t.key, t.ru, t.am, t.sort).run();
    }
  }
  
  // Seed calculator services
  const calcServices = SEED_CALC_SERVICES;
  for (const s of calcServices) {
    const tab = await db.prepare('SELECT id FROM calculator_tabs WHERE tab_key = ?').bind(s.tab).first();
    if (!tab) continue;
    const existing = await db.prepare('SELECT id FROM calculator_services WHERE tab_id = ? AND name_ru = ?').bind(tab.id, s.ru).first();
    if (!existing) {
      await db.prepare('INSERT INTO calculator_services (tab_id, name_ru, name_am, price, price_type, price_tiers_json, tier_desc_ru, tier_desc_am, sort_order) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(tab.id, s.ru, s.am, s.price, s.type, s.tiers || null, s.tierRu || null, s.tierAm || null, s.sort).run();
    }
  }
  
  // Seed telegram messages
  const tgMsgs = SEED_TG_MESSAGES;
  for (const m of tgMsgs) {
    const existing = await db.prepare('SELECT id FROM telegram_messages WHERE button_key = ?').bind(m.key).first();
    if (!existing) {
      await db.prepare('INSERT INTO telegram_messages (button_key, button_label_ru, button_label_am, telegram_url, message_template_ru, message_template_am, description) VALUES (?,?,?,?,?,?,?)')
        .bind(m.key, m.labelRu, m.labelAm, m.url, m.msgRu, m.msgAm, m.desc).run();
    }
  }
  
  return c.json({ success: true, message: 'Seeded successfully' });
})

app.get('/', (c) => {
  return c.html(html`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>Go to Top — Продвижение на Wildberries | Առաջխաղացում Wildberries-ում</title>
<meta name="description" content="Go to Top — продвижение карточек на Wildberries под ключ: выкупы живыми людьми и продающий контент. Собственный склад в Ереване.">
<meta property="og:title" content="Go to Top — Продвижение на Wildberries">
<meta property="og:description" content="Выкупы живыми людьми, отзывы с реальными фото, профессиональные фотосессии. Собственный склад в Ереване. Более 1000 аккаунтов.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://gototop.win">
<meta property="og:image" content="https://gototop.win/static/img/logo-gototop.png">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta property="og:image:alt" content="Go to Top - логотип">
<meta property="og:site_name" content="Go to Top">
<meta property="og:locale" content="ru_RU">
<meta property="og:locale:alternate" content="hy_AM">
<link rel="alternate" hreflang="ru" href="https://gototop.win">
<link rel="alternate" hreflang="hy" href="https://gototop.win">
<link rel="alternate" hreflang="x-default" href="https://gototop.win">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Go to Top — Առաջխաղացում Wildberries-ում">
<meta name="twitter:description" content="Выкупы живыми людьми, отзывы с реальными фото, собственный склад в Ереване. Более 1000 аккаунтов.">
<meta name="twitter:image" content="https://gototop.win/static/img/logo-gototop.png">
<link rel="icon" type="image/png" href="/static/img/logo-gototop.png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --purple:#8B5CF6;--purple-dark:#7C3AED;--purple-deep:#6D28D9;--violet:#5B21B6;
  --accent:#A78BFA;--accent-light:#C4B5FD;
  --bg:#0F0A1A;--bg-card:#1A1128;--bg-hover:#221638;--bg-surface:#130D20;
  --text:#F5F3FF;--text-sec:#A5A0B8;--text-muted:#6B6580;
  --success:#10B981;--warning:#F59E0B;--danger:#EF4444;
  --border:rgba(139,92,246,0.15);--glow:0 0 30px rgba(139,92,246,0.15);
  --r:16px;--r-sm:10px;--r-lg:24px;
  --t:all 0.3s cubic-bezier(0.4,0,0.2,1);
}
html{scroll-behavior:smooth;font-size:16px;overflow-x:hidden;width:100%;max-width:100vw;-webkit-text-size-adjust:100%}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);line-height:1.7;overflow-x:hidden;width:100%;max-width:100vw;min-height:100vh;min-height:100dvh;-webkit-overflow-scrolling:touch}
*,*::before,*::after{box-sizing:border-box}
.container{max-width:1200px;margin:0 auto;padding:0 24px;overflow-x:hidden;width:100%;box-sizing:border-box}
a{text-decoration:none;color:inherit}
img{max-width:100%;height:auto}
.header{position:fixed;top:0;left:0;right:0;z-index:1000;padding:12px 0;transition:var(--t);background:rgba(15,10,26,0.8);backdrop-filter:blur(20px);border-bottom:1px solid transparent;width:100%}
.header.scrolled{border-bottom:1px solid var(--border);background:rgba(15,10,26,0.95)}
.nav{display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{display:flex;align-items:center;gap:12px}
.logo img{height:44px;width:auto;border-radius:8px}
.logo-text{font-size:1.3rem;font-weight:800;background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-links{display:flex;align-items:center;gap:24px;list-style:none}
.nav-links a{font-size:0.88rem;font-weight:500;color:var(--text-sec);transition:var(--t)}
.nav-links a:hover{color:var(--text)}
.nav-right{display:flex;align-items:center;gap:12px}
.lang-switch{display:flex;background:var(--bg-card);border-radius:8px;overflow:hidden;border:1px solid var(--border)}
.lang-btn{padding:6px 14px;font-size:0.78rem;font-weight:600;cursor:pointer;transition:var(--t);background:transparent;border:none;color:var(--text-muted)}
.lang-btn.active{background:var(--purple);color:white}
.nav-cta{padding:10px 22px;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white!important;border-radius:var(--r-sm);font-weight:600;font-size:0.88rem;transition:var(--t);display:flex;align-items:center;gap:8px}
.nav-cta:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(139,92,246,0.4)}
.hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;padding:8px}
.hamburger span{width:24px;height:2px;background:var(--text);transition:var(--t);border-radius:2px}
.hamburger.active span:nth-child(1){transform:rotate(45deg) translate(5px,5px)}
.hamburger.active span:nth-child(2){opacity:0}
.hamburger.active span:nth-child(3){transform:rotate(-45deg) translate(5px,-5px)}
.nav-mobile-cta{display:none}
.hero{padding:140px 0 80px;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-50%;right:-30%;width:80%;height:150%;background:radial-gradient(ellipse,rgba(139,92,246,0.08) 0%,transparent 70%);pointer-events:none}
.hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center}
.hero-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 18px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.85rem;font-weight:500;color:var(--accent);margin-bottom:24px}
.hero h1{font-size:3rem;font-weight:800;line-height:1.15;margin-bottom:20px;letter-spacing:-0.02em}
.hero h1 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero-desc{font-size:1.05rem;color:var(--text-sec);margin-bottom:32px;max-width:520px;line-height:1.8}
.hero-stats{display:flex;gap:32px;margin-bottom:36px}
.stat{text-align:left}
.stat-num{font-size:2rem;font-weight:800;color:var(--purple)}
.stat-label{font-size:0.78rem;color:var(--text-muted);margin-top:2px}
.hero-buttons{display:flex;gap:16px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:10px;padding:14px 28px;border-radius:var(--r-sm);font-weight:600;font-size:0.95rem;transition:var(--t);cursor:pointer;border:none}
.btn-primary{background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white;box-shadow:0 4px 15px rgba(139,92,246,0.3)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(139,92,246,0.5)}
.btn-outline{background:transparent;color:var(--text);border:1px solid var(--border)}
.btn-outline:hover{border-color:var(--purple);background:rgba(139,92,246,0.05)}
.btn-lg{padding:16px 32px;font-size:1.05rem}
.hero-image{position:relative}
.hero-image img{border-radius:var(--r-lg);width:100%;height:480px;object-fit:cover;object-position:center;border:1px solid var(--border)}
.hero-badge-img{position:absolute;bottom:20px;left:20px;background:rgba(15,10,26,0.9);backdrop-filter:blur(10px);padding:12px 18px;border-radius:var(--r-sm);display:flex;align-items:center;gap:10px;border:1px solid var(--border)}
.hero-badge-img i{color:var(--success);font-size:1.1rem}
.hero-badge-img span{font-size:0.85rem;font-weight:500}
.ticker{padding:20px 0;background:var(--bg-surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border);overflow:hidden}
.ticker-track{display:flex;animation:ticker 40s linear infinite;white-space:nowrap}
.ticker-item{display:flex;align-items:center;gap:10px;padding:0 40px;font-size:0.88rem;color:var(--text-sec);flex-shrink:0}
.ticker-item i{color:var(--purple)}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.section{padding:56px 0}
.section-dark{background:var(--bg-surface)}
.section-header{text-align:center;margin-bottom:56px}
.section-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px}
.section-title{font-size:2.2rem;font-weight:800;line-height:1.2;margin-bottom:16px;letter-spacing:-0.02em}
.section-sub{font-size:1rem;color:var(--text-sec);max-width:640px;margin:0 auto;line-height:1.7}
.services-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;margin-bottom:16px}
.svc-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:32px;transition:var(--t);position:relative;overflow:hidden}
.svc-card:hover{border-color:rgba(139,92,246,0.3);transform:translateY(-4px);box-shadow:var(--glow)}
.svc-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--purple),var(--accent));opacity:0;transition:var(--t)}
.svc-card:hover::before{opacity:1}
.svc-icon{width:56px;height:56px;border-radius:14px;background:rgba(139,92,246,0.1);display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:var(--purple);margin-bottom:20px}
.svc-card h3{font-size:1.2rem;font-weight:700;margin-bottom:10px}
.svc-card p{color:var(--text-sec);font-size:0.92rem;line-height:1.7;margin-bottom:16px}
.svc-features{list-style:none}
.svc-features li{display:flex;align-items:flex-start;gap:10px;padding:5px 0;font-size:0.88rem;color:var(--text-sec)}
.svc-features li i{color:var(--success);margin-top:4px;font-size:0.78rem}
.calc-wrap{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:40px;max-width:860px;margin:0 auto}
.calc-tabs{display:flex;gap:8px;margin-bottom:28px;flex-wrap:wrap}
.calc-tab{padding:8px 20px;border-radius:50px;font-size:0.82rem;font-weight:600;cursor:pointer;transition:var(--t);background:var(--bg-surface);border:1px solid var(--border);color:var(--text-muted)}
.calc-tab.active{background:var(--purple);color:white;border-color:var(--purple)}
.calc-tab:hover:not(.active){border-color:var(--purple);color:var(--text)}
.calc-group{display:none}
.calc-group.active{display:block}
.calc-row{display:grid;grid-template-columns:1fr auto auto;gap:16px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)}
.calc-row:last-of-type{border-bottom:none}
.calc-label{font-size:0.92rem;font-weight:500}
.calc-price{font-size:0.82rem;color:var(--text-muted);white-space:nowrap}
.calc-input{display:flex;align-items:center;gap:8px}
.calc-input button{width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:0.95rem;cursor:pointer;transition:var(--t);display:flex;align-items:center;justify-content:center}
.calc-input button:hover{border-color:var(--purple);background:rgba(139,92,246,0.1)}
.calc-input input[type="number"]{width:48px;text-align:center;font-weight:600;font-size:1rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 3px;-moz-appearance:textfield;outline:none;transition:var(--t)}
.calc-input input[type="number"]:focus{border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.15)}
.calc-input input[type="number"]::-webkit-outer-spin-button,.calc-input input[type="number"]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.calc-total{display:flex;justify-content:space-between;align-items:center;padding:24px 0;margin-top:16px;border-top:2px solid var(--purple)}
.calc-total-label{font-size:1.1rem;font-weight:600}
.calc-total-value{font-size:1.8rem;font-weight:800;color:var(--purple);white-space:nowrap}
.calc-cta{margin-top:24px;text-align:center}
.buyout-tier-info{margin-top:8px;padding:12px 16px;background:rgba(139,92,246,0.05);border:1px solid var(--border);border-radius:var(--r-sm);font-size:0.82rem;color:var(--text-sec);line-height:1.6}
.buyout-tier-info strong{color:var(--accent)}

/* ===== WHY BUYOUTS + WB OFFICIAL BLOCKS ===== */
.why-block{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:40px;margin-bottom:24px}
.why-block h3{font-size:1.3rem;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:10px}
.why-block h3 i{color:var(--purple);font-size:1.1rem}
.why-block p{color:var(--text-sec);font-size:0.92rem;line-height:1.8;margin-bottom:16px}
.why-block p:last-child{margin-bottom:0}
.why-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin:24px 0}
.why-step{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r);padding:20px;display:flex;gap:14px;align-items:flex-start;transition:var(--t)}
.why-step:hover{border-color:rgba(139,92,246,0.3);transform:translateY(-2px)}
.why-step-num{width:36px;height:36px;min-width:36px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--accent));color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem}
.why-step h4{font-size:0.95rem;font-weight:600;margin-bottom:4px}
.why-step p{font-size:0.85rem;color:var(--text-sec);line-height:1.6;margin:0}
.compare-box{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:24px 0}
.compare-side{padding:24px;border-radius:var(--r);border:1px solid var(--border)}
.compare-side.bad{background:rgba(239,68,68,0.05);border-color:rgba(239,68,68,0.2)}
.compare-side.good{background:rgba(139,92,246,0.05);border-color:rgba(139,92,246,0.3)}
.compare-side h4{font-size:1rem;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.compare-side.bad h4{color:#ef4444}
.compare-side.good h4{color:var(--purple)}
.compare-side p{font-size:0.88rem;color:var(--text-sec);line-height:1.7;margin:0}
.compare-side .price-tag{font-size:1.3rem;font-weight:800;margin:8px 0}
.compare-side.bad .price-tag{color:#ef4444}
.compare-side.good .price-tag{color:var(--purple)}
.wb-official-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:20px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:#10B981;font-weight:600;font-size:0.88rem;margin-bottom:16px}
.highlight-result{background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(168,85,247,0.08));border:1px solid rgba(139,92,246,0.2);border-radius:var(--r);padding:20px 24px;margin:20px 0;font-size:0.95rem;line-height:1.7}
.highlight-result i{color:var(--purple);margin-right:8px}
.highlight-result strong{color:var(--text)}
@media(max-width:768px){.compare-box{grid-template-columns:1fr}.why-steps{grid-template-columns:1fr}}
.process-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;position:relative}
.step{text-align:center;position:relative}
.step-num{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.1rem;margin:0 auto 16px;position:relative;z-index:2}
.step-line{position:absolute;top:24px;left:50%;right:-50%;height:2px;background:var(--border);z-index:1}
.step:last-child .step-line{display:none}
.step h4{font-size:0.92rem;font-weight:600;margin-bottom:8px}
.step p{font-size:0.78rem;color:var(--text-muted);line-height:1.5}
.wh-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.wh-item{position:relative;border-radius:var(--r);overflow:hidden;border:1px solid var(--border);cursor:pointer;transition:var(--t)}
.wh-item:hover{transform:scale(1.02);border-color:rgba(139,92,246,0.3)}
.wh-item img{width:100%;height:250px;object-fit:cover;transition:var(--t)}
.wh-item:hover img{transform:scale(1.05)}
.wh-caption{position:absolute;bottom:0;left:0;right:0;padding:12px 16px;background:linear-gradient(transparent,rgba(0,0,0,0.8));font-size:0.85rem;font-weight:500}
.guarantee-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.guarantee-card img{border-radius:var(--r);width:100%;height:auto;object-fit:contain;border:1px solid var(--border)}


.guarantee-card h2{font-size:1.9rem;font-weight:800;margin-bottom:16px}
.guarantee-card>div p{color:var(--text-sec);margin-bottom:16px;line-height:1.8}
.g-list{list-style:none;margin:20px 0}
.g-list li{display:flex;align-items:flex-start;gap:12px;padding:8px 0;font-size:0.92rem}
.g-list li i{color:var(--success);margin-top:4px}
.g-badge{display:inline-flex;align-items:center;gap:10px;padding:12px 20px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:var(--r-sm);color:var(--success);font-weight:600;margin-top:16px}
.cmp-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:var(--r);margin:0;padding:0;max-width:100%;display:block}
.cmp-table{width:100%;min-width:500px;border-collapse:collapse;background:var(--bg-card);border-radius:var(--r);overflow:hidden;border:1px solid var(--border)}
.cmp-table th{padding:16px 20px;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.5px;font-weight:600}
.cmp-table th:first-child{text-align:left;color:var(--text-muted)}
.cmp-table th:nth-child(2){background:rgba(139,92,246,0.1);color:var(--purple)}
.cmp-table th:nth-child(3){color:var(--text-muted)}
.cmp-table td{padding:14px 20px;border-top:1px solid var(--border);font-size:0.88rem;color:var(--text-sec)}
.cmp-table td:nth-child(2){background:rgba(139,92,246,0.03);font-weight:500;color:var(--text)}
.chk{color:var(--success)}.crs{color:var(--danger)}
.faq-list{max-width:800px;margin:0 auto}
.faq-item{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);margin-bottom:12px;overflow:hidden;transition:var(--t)}
.faq-item.active{border-color:rgba(139,92,246,0.3)}
.faq-q{padding:20px 24px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;font-weight:600;font-size:0.92rem}
.faq-q i{color:var(--purple);transition:var(--t);font-size:0.78rem}
.faq-item.active .faq-q i{transform:rotate(180deg)}
.faq-a{padding:0 24px;max-height:0;overflow:hidden;transition:max-height 0.4s ease,padding 0.4s ease}
.faq-item.active .faq-a{max-height:500px;padding:0 24px 20px}
.faq-a p{color:var(--text-sec);font-size:0.88rem;line-height:1.8}
.form-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px;max-width:600px;margin:0 auto}
.form-group{margin-bottom:20px}
.form-group label{display:block;font-size:0.82rem;font-weight:600;margin-bottom:8px;color:var(--text-sec)}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:12px 16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:1rem;font-family:inherit;transition:var(--t)}
.form-group input:focus,.form-group textarea:focus,.form-group select:focus{outline:none;border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.15)}
.form-group textarea{resize:vertical;min-height:100px}
.form-group select option{background:var(--bg-card)}
.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:600px;margin:0 auto 32px}
.contact-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:24px;text-align:center;transition:var(--t)}
.contact-card:hover{border-color:rgba(139,92,246,0.3);transform:translateY(-2px)}
.contact-card i.fab{font-size:2rem;color:var(--purple);margin-bottom:12px}
.contact-card h4{font-size:1rem;font-weight:600;margin-bottom:4px}
.contact-card p{font-size:0.82rem;color:var(--text-muted);line-height:1.5}
.footer{padding:48px 0 24px;border-top:1px solid var(--border)}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px;margin-bottom:40px}
.footer-brand p{color:var(--text-muted);font-size:0.88rem;margin-top:12px;line-height:1.7}
.footer-col h4{font-size:0.82rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:16px}
.footer-col ul{list-style:none}
.footer-col li{margin-bottom:10px}
.footer-col a{color:var(--text-sec);font-size:0.88rem;transition:var(--t)}
.footer-col a:hover{color:var(--purple)}
.footer-social-btn:hover{transform:scale(1.15)}
.footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:24px;border-top:1px solid var(--border);font-size:0.78rem;color:var(--text-muted)}
.tg-float{position:fixed;bottom:86px;right:24px;z-index:999;display:flex;align-items:center;gap:12px;padding:14px 24px;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white;border-radius:50px;box-shadow:0 8px 30px rgba(139,92,246,0.4);transition:var(--t);font-weight:600;font-size:0.88rem}
.tg-float:hover{transform:translateY(-3px) scale(1.03);box-shadow:0 12px 40px rgba(139,92,246,0.5)}
.tg-float i{font-size:1.2rem}
.calc-float{position:fixed;bottom:24px;right:24px;z-index:999;display:flex;align-items:center;gap:10px;padding:14px 22px;background:linear-gradient(135deg,#10B981,#059669);color:white;border-radius:50px;box-shadow:0 8px 30px rgba(16,185,129,0.4);transition:var(--t);font-weight:600;font-size:0.88rem;cursor:pointer}
.calc-float:hover{transform:translateY(-3px) scale(1.03);box-shadow:0 12px 40px rgba(16,185,129,0.5)}
.calc-float i{font-size:1.1rem}
.lightbox{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:9999;align-items:center;justify-content:center;padding:40px;cursor:pointer}
.lightbox.show{display:flex}
.lightbox img{max-width:90%;max-height:90vh;border-radius:var(--r);object-fit:contain}

/* ===== CTA BUTTONS AFTER SECTIONS ===== */
.section-cta{display:flex;gap:14px;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:28px;padding-top:24px;border-top:1px solid var(--border)}
.section-cta .btn{font-size:0.9rem;padding:12px 24px}
.section-cta .btn i{margin-right:6px}
.btn-success{background:linear-gradient(135deg,#10B981,#059669);color:white;box-shadow:0 4px 15px rgba(16,185,129,0.3)}
.btn-success:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(16,185,129,0.5)}
.btn-warning{background:linear-gradient(135deg,#F59E0B,#D97706);color:white;box-shadow:0 4px 15px rgba(245,158,11,0.3)}
.btn-warning:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(245,158,11,0.5)}
.btn-tg{background:linear-gradient(135deg,#0088cc,#0077b5);color:white;box-shadow:0 4px 15px rgba(0,136,204,0.3)}
.btn-tg:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,136,204,0.5)}

/* ===== POPUP - Mobile-friendly slide-up ===== */
.popup-overlay{
  display:none;
  position:fixed;top:0;left:0;right:0;bottom:0;
  width:100%;height:100%;
  background:rgba(0,0,0,0.85);
  z-index:100000;
  justify-content:center;align-items:center;
  padding:20px;
  overflow-y:auto;
}
.popup-overlay.show{
  display:flex !important;
  visibility:visible !important;
  opacity:1 !important;
}
.popup-card{
  background:linear-gradient(145deg,#2a1a4e,#3d2470);
  border:2px solid rgba(167,139,250,0.6);
  border-radius:20px;
  padding:36px;
  text-align:center;
  max-width:460px;width:100%;
  position:relative;
  z-index:100001;
  box-shadow:0 0 80px rgba(139,92,246,0.4),0 25px 60px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.1);
  animation:popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;
  opacity:1;
  transform:scale(1);
}
@keyframes popIn{0%{transform:scale(0.7) translateY(30px);opacity:0}100%{transform:scale(1) translateY(0);opacity:1}}
@keyframes slideUpMobile{0%{transform:translateY(100%)}100%{transform:translateY(0)}}
@media(max-width:640px){
  .popup-overlay{align-items:flex-end;padding:0}
  .popup-card{
    border-radius:20px 20px 0 0;
    max-width:100%;width:100%;
    animation:slideUpMobile 0.4s ease forwards;
    padding:28px 16px;
    max-height:85vh;
    overflow-y:auto;
    margin:0;
  }
  .popup-card h3{font-size:1.2rem}
  .popup-card .pf-row{grid-template-columns:1fr}
  .slot-counter-bar .container > div{flex-direction:column;gap:12px;text-align:center}
  .slot-counter-bar #slotProgress{width:100%;max-width:280px}
}
.popup-card .popup-close{
  position:absolute;top:14px;right:14px;
  width:34px;height:34px;border-radius:50%;
  background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);
  color:#fff;font-size:1.2rem;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:var(--t);line-height:1;
}
.popup-card .popup-close:hover{background:rgba(239,68,68,0.5);border-color:rgba(239,68,68,0.6)}
.popup-card .popup-icon{
  width:64px;height:64px;border-radius:50%;
  background:linear-gradient(135deg,var(--purple),var(--accent));
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 16px;font-size:1.6rem;color:white;
}
.popup-card h3{font-size:1.4rem;font-weight:800;margin-bottom:8px;color:#fff}
.popup-card .popup-sub{color:#c4b5fd;margin-bottom:20px;font-size:0.9rem;line-height:1.5}
.popup-card .pf-group{margin-bottom:14px;text-align:left}
.popup-card .pf-label{display:block;font-size:0.8rem;font-weight:600;color:#c4b5fd;margin-bottom:6px}
.popup-card .pf-input{
  width:100%;padding:12px 14px;
  background:rgba(15,10,26,0.6);
  border:1px solid rgba(139,92,246,0.35);
  border-radius:10px;color:#fff;font-size:1rem;
  font-family:inherit;transition:var(--t);
}
.popup-card .pf-input:focus{outline:none;border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.25)}
.popup-card .pf-input::placeholder{color:rgba(165,160,184,0.6)}
.popup-card .pf-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.popup-card .popup-success{display:none;text-align:center;padding:20px 0}
.popup-card .popup-success i{font-size:3rem;color:var(--success);margin-bottom:12px}
.popup-card .popup-success h4{font-size:1.1rem;margin-bottom:6px;color:#fff}
.popup-card .popup-success p{color:#c4b5fd;font-size:0.88rem}

.fade-up{opacity:0;transform:translateY(30px);transition:opacity 0.7s ease,transform 0.7s ease}
.fade-up.visible{opacity:1;transform:translateY(0)}

/* ===== WB BANNER ===== */
.wb-banner{padding:20px 0;background:var(--bg-surface);border-bottom:1px solid var(--border)}
.wb-banner-inner{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:center}
.wb-banner-left{display:flex;align-items:center;gap:16px;padding:20px 28px;background:linear-gradient(135deg,#ff3366,#8B5CF6);border-radius:var(--r);position:relative;overflow:hidden}
.wb-banner-left .wb-logo{font-weight:900;font-size:1.3rem;color:#fff}
.wb-banner-left .wb-text{font-weight:800;font-size:1.1rem;color:#fff;text-transform:uppercase;line-height:1.3}
.wb-banner-left .wb-excl{position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:3rem;font-weight:900;color:rgba(255,255,255,0.3)}
.wb-banner-right{display:flex;align-items:center;gap:16px;padding:16px 28px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r)}
.wb-banner-right .wb-r-icon{font-size:1.4rem}
.wb-banner-right .wb-r-text{font-weight:700;font-size:0.92rem;text-transform:uppercase;line-height:1.4}
.wb-banner-right .btn{margin-left:auto;white-space:nowrap;font-size:0.82rem;padding:10px 20px}

/* ===== ABOUT SECTION ===== */
.about-grid{display:grid;grid-template-columns:1fr 1.5fr;gap:48px;align-items:center}
.about-img{position:relative;border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--border)}
.about-img img{width:100%;height:auto;display:block}
.about-text h2{font-size:2rem;font-weight:800;margin-bottom:20px;line-height:1.3}
.about-text h2 .gr{background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.about-text p{color:var(--text-sec);font-size:1rem;line-height:1.8;margin-bottom:16px}

/* ===== BUYOUT SERVICE DETAIL ===== */
.buyout-detail{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px}
.buyout-detail-header{margin-bottom:32px}
.buyout-detail-header h2{font-size:2rem;font-weight:800;margin-bottom:12px}
.buyout-detail-header h2 .gr{background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.buyout-detail-header .subtitle{font-weight:700;font-size:1.1rem;margin-bottom:8px}
.buyout-detail-header p{color:var(--text-sec);font-size:0.92rem;line-height:1.7}
.buyout-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:20px}
.buyout-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r);padding:28px;transition:var(--t)}
.buyout-card:hover{border-color:rgba(139,92,246,0.3)}
.buyout-card h4{font-size:1rem;font-weight:700;margin-bottom:12px;text-transform:uppercase;color:var(--accent)}
.buyout-card p{color:var(--text-sec);font-size:0.88rem;line-height:1.7}
.buyout-card ul{list-style:none;margin-top:12px;counter-reset:buyout-step}
.buyout-card ul li{padding:4px 0;font-size:0.88rem;color:var(--text-sec);counter-increment:buyout-step}
.buyout-card ul li::before{content:counter(buyout-step);color:var(--purple);margin-right:8px;font-weight:700}
.buyout-cta{text-align:right;margin-top:24px}

/* ===== STATS BAR ===== */
.stats-bar{padding:60px 0;background:var(--bg-surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:32px;text-align:center}
.stat-card .stat-big{font-size:2.8rem;font-weight:900;color:var(--purple);line-height:1}
.stat-card .stat-desc{font-size:0.88rem;color:var(--text-sec);margin-top:6px;font-weight:500}
.slot-counter-bar{padding:0;background:linear-gradient(135deg,rgba(16,185,129,0.05),rgba(139,92,246,0.05));border-bottom:1px solid var(--border);width:100%;overflow:hidden}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}


/* ===== WB BANNER ===== */
.wb-banner{padding:20px 0;background:var(--bg-surface);border-bottom:1px solid var(--border)}
.wb-banner-inner{display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap}
.wb-banner-card{display:flex;align-items:center;gap:16px;padding:16px 28px;background:linear-gradient(135deg,#ff3366,var(--purple));border-radius:var(--r);flex:1;min-width:280px;position:relative;overflow:hidden}
.wb-banner-card::after{content:"!";position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:3.5rem;font-weight:900;color:rgba(255,255,255,0.15)}
.wb-banner-card .wb-icon{font-size:1.6rem;color:#fff}
.wb-banner-card .wb-text{font-weight:800;font-size:1rem;color:#fff;line-height:1.3;text-transform:uppercase}
.wb-banner-right{display:flex;align-items:center;gap:16px;padding:16px 28px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);flex:1;min-width:280px}
.wb-banner-right .wb-r-icon{font-size:1.4rem}
.wb-banner-right .wb-r-text{font-weight:700;font-size:0.92rem;line-height:1.4}
.wb-banner-right .btn{margin-left:auto;white-space:nowrap;font-size:0.82rem;padding:10px 20px}

/* ===== ABOUT SECTION ===== */
.about-grid{display:grid;grid-template-columns:1fr 1.5fr;gap:48px;align-items:center}
.about-img{position:relative;border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--border)}
.about-img img{width:100%;height:auto;display:block}
.about-text h2{font-size:2rem;font-weight:800;margin-bottom:20px;line-height:1.3}
.about-text h2 .gr{background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.about-text p{color:var(--text-sec);font-size:1rem;line-height:1.8;margin-bottom:16px}
.about-highlight{background:rgba(139,92,246,0.08);border:1px solid var(--border);border-radius:var(--r);padding:20px 24px;margin-top:16px}
.about-highlight p{font-weight:600;color:var(--accent);margin:0!important}

/* ===== BUYOUT SERVICE DETAIL ===== */
.buyout-detail{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px}
.buyout-detail-header{margin-bottom:32px}
.buyout-detail-header h2{font-size:2rem;font-weight:800;margin-bottom:12px}
.buyout-detail-header h2 .gr{background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.buyout-detail-header .subtitle{font-weight:700;font-size:1.1rem;margin-bottom:8px}
.buyout-detail-header p{color:var(--text-sec);font-size:0.92rem;line-height:1.7}
.buyout-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:20px}
.buyout-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r);padding:28px;transition:var(--t)}
.buyout-card:hover{border-color:rgba(139,92,246,0.3)}
.buyout-card h4{font-size:1rem;font-weight:700;margin-bottom:12px;text-transform:uppercase;color:var(--accent)}
.buyout-card p{color:var(--text-sec);font-size:0.88rem;line-height:1.7}
.buyout-card ul{list-style:none;margin-top:12px;counter-reset:buyout-step}
.buyout-card ul li{padding:4px 0;font-size:0.88rem;color:var(--text-sec);counter-increment:buyout-step}
.buyout-card ul li::before{content:counter(buyout-step);color:var(--purple);margin-right:8px;font-weight:700}
.buyout-cta{text-align:right;margin-top:24px}

/* ===== REVIEWS DETAIL ===== */
.reviews-detail{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px;margin-top:32px}
.reviews-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin-top:32px}
.reviews-carousel-wrap div[id^="reviewsCar"]::-webkit-scrollbar{display:none}
.reviews-carousel-wrap div[id^="reviewsCar"]{-ms-overflow-style:none;scrollbar-width:none}
.review-point{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r);padding:24px;text-align:center;transition:var(--t)}
.review-point:hover{border-color:rgba(139,92,246,0.3);transform:translateY(-3px)}
.review-point i{font-size:2rem;color:var(--purple);margin-bottom:14px}
.review-point h4{font-size:1rem;font-weight:700;margin-bottom:8px}
.review-point p{color:var(--text-sec);font-size:0.85rem;line-height:1.6}

/* ===== STATS BAR ===== */
.stats-bar{padding:60px 0;background:var(--bg-surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:32px;text-align:center}
.stat-card .stat-big{font-size:2.8rem;font-weight:900;color:var(--purple);line-height:1}
.stat-card .stat-desc{font-size:0.88rem;color:var(--text-sec);margin-top:6px;font-weight:500}

@media(max-width:1024px){
  .hero h1{font-size:2.4rem}
  .hero-grid{grid-template-columns:1fr;gap:40px}
  .hero-image{max-width:500px}
  .process-grid{grid-template-columns:repeat(3,1fr)}
  .step:nth-child(n+4){margin-top:16px}
  .guarantee-card{grid-template-columns:1fr;gap:32px}
  .footer-grid{grid-template-columns:1fr 1fr}
  .wb-banner-inner{flex-direction:column}
  .about-grid{grid-template-columns:1fr}
  .buyout-grid{grid-template-columns:1fr 1fr}
  .stats-grid{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:768px){
  .nav-links{display:none;position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100vh;background:rgba(15,10,26,0.98);flex-direction:column;justify-content:center;align-items:center;gap:28px;padding:80px 20px 20px;z-index:10000;overflow-y:auto}
  .nav-links.active{display:flex !important}
  .nav-links li{list-style:none;width:100%;text-align:center}
  .nav-links a{font-size:1.3rem;display:block;padding:14px 20px;color:#fff;border-radius:12px;transition:background 0.2s;font-weight:600}
  .nav-links a:hover,.nav-links a:active{background:rgba(139,92,246,0.2)}
  .nav-mobile-cta{display:list-item;list-style:none;margin-top:16px;width:100%;text-align:center}
  .nav-mobile-cta .btn{display:inline-flex;align-items:center;gap:8px;padding:14px 32px;font-size:1.1rem;border-radius:12px;font-weight:700}
  .hamburger{display:flex;z-index:10001;position:relative}
  .nav-right .nav-cta{display:none}
  .hero{padding:110px 0 60px}
  .hero h1{font-size:1.9rem}
  .hero-stats{flex-wrap:wrap;gap:20px}
  .hero-buttons{flex-direction:column}
  .hero-image img{height:300px}
  .section-title{font-size:1.7rem}
  .services-grid{grid-template-columns:1fr}
  .wh-grid{grid-template-columns:1fr}
  .buyout-grid{grid-template-columns:1fr}
  .stats-grid{grid-template-columns:repeat(2,1fr);gap:20px}
  .process-grid{grid-template-columns:1fr 1fr}
  .cmp-table{font-size:0.78rem;min-width:420px}
  .cmp-table td,.cmp-table th{padding:10px 8px}
  .calc-row{grid-template-columns:1fr;gap:8px}
  .calc-wrap{padding:24px}
  .calc-tabs{gap:6px}
  .contact-grid{grid-template-columns:1fr}
  .form-card{padding:28px}
  .footer-grid{grid-template-columns:1fr}
  .footer-bottom{flex-direction:column;gap:8px;text-align:center}
  .tg-float span{display:none}
  .tg-float{padding:16px;border-radius:50%;bottom:76px}
  .calc-float span{display:none}
  .calc-float{padding:16px;border-radius:50%}
  .popup-card .pf-row{grid-template-columns:1fr}
  .slot-counter-bar .container > div{flex-direction:column;gap:12px;text-align:center}
  .slot-counter-bar #slotProgress{width:100%;max-width:280px}
}
@media(max-width:480px){
  .hero h1{font-size:1.6rem}
  .section{padding:44px 0}
  .section-title{font-size:1.4rem}
  .container{padding:0 16px}
  .calc-wrap{padding:16px}
  .svc-card{padding:20px}
  .buyout-detail{padding:24px}
  .reviews-detail{padding:24px}
  .guarantee-card{padding:24px}
  .form-card{padding:20px}
  .wb-banner-card{min-width:0;padding:12px 16px}
  .wb-banner-right{min-width:0;padding:12px 16px;flex-wrap:wrap}
  .wb-banner-right .btn{margin-left:0;margin-top:8px;width:100%}
  .cmp-table{min-width:380px}
}

/* ===== MOBILE FULL-WIDTH FIXES ===== */
@media(max-width:768px){
  .slot-counter-bar,.ticker,.stats-bar,.wb-banner,.footer,.section-dark{width:100vw;margin-left:calc(-50vw + 50%);margin-left:0;box-sizing:border-box}
  .popup-overlay{-webkit-tap-highlight-color:transparent}
  input,textarea,select,button{font-size:16px!important;-webkit-appearance:none;border-radius:0;border-radius:10px}
}
@media(max-width:360px){
  .container{padding:0 12px}
  .hero{padding:100px 0 50px}
  .hero h1{font-size:1.4rem}
  .calc-tab{padding:6px 12px;font-size:0.75rem}
}
</style>
</head>
<body>

<!-- ===== HEADER ===== -->
<header class="header" id="header">
<div class="container">
<nav class="nav">
  <a href="#" class="logo">
    <img src="/static/img/logo-gototop.png" alt="Go to Top">
    <span class="logo-text">Go to Top</span>
  </a>
  <ul class="nav-links" id="navLinks">
    <li><a href="#about" data-ru="О нас" data-am="Մեր մասին">О нас</a></li>
    <li><a href="#services" data-ru="Услуги" data-am="Ծառայություններ">Услуги</a></li>
    <li><a href="#calculator" data-ru="Калькулятор" data-am="Հաշվիչ">Калькулятор</a></li>
    <li><a href="#warehouse" data-ru="Склад" data-am="Պահեստ">Склад</a></li>
    <li><a href="#guarantee" data-ru="Гарантии" data-am="Երաշխիքներ">Гарантии</a></li>
    <li><a href="#faq" data-ru="FAQ" data-am="ՀՏՀ">FAQ</a></li>
    <li><a href="#contact" data-ru="Контакты" data-am="Կոնտակտներ">Контакты</a></li>
    <li class="nav-mobile-cta"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><i class="fab fa-telegram"></i> Написать нам</a></li>
  </ul>
  <div class="nav-right">
    <div class="lang-switch">
      <button class="lang-btn" data-lang="ru" onclick="switchLang('ru')">RU</button>
      <button class="lang-btn active" data-lang="am" onclick="switchLang('am')">AM</button>
    </div>
    <a href="https://t.me/goo_to_top" target="_blank" class="nav-cta">
      <i class="fab fa-telegram"></i>
      <span data-ru="Написать нам" data-am="Գրել մեզ">Написать нам</span>
    </a>
  </div>
  <button class="hamburger" id="hamburger" onclick="toggleMenu()">
    <span></span><span></span><span></span>
  </button>
</nav>
</div>
</header>

<!-- ===== HERO ===== -->
<section class="hero" id="hero" data-section-id="hero">
<div class="container">
<div class="hero-grid">
  <div>
    <div class="hero-badge">
      <i class="fas fa-circle" style="color:var(--success);font-size:0.5rem"></i>
      <span data-ru="Успешный опыт с 2021 года" data-am="Հաջողված փորձ 2021 թվականից">Успешный опыт с 2021 года</span>
    </div>
    <h1>
      <span data-ru="Выведем ваш товар" data-am="Մենք կբարձրացնենք ձեր ապրանքը">Выведем ваш товар</span><br>
      <span class="gr" data-ru="в ТОП Wildberries" data-am="Wildberries-ի TOP">в ТОП Wildberries</span>
    </h1>
    <p class="hero-desc" data-ru="Самовыкупы с аккаунтов реальных пользователей по вашим ключевым словам. С нами ваши товары становятся ТОПами продаж на Wildberries. Собственный склад и более 1000 реальных аккаунтов в Ереване." data-am="Իրական մարդկանց հաշիվներից ինքնագնումներ ձեր ցանկալի բանալի բառով: Մեզ հետ ձեր ապրանքները դառնում են Wildberries-ի TOP-ում վաճառվողներ: Սեփական պահեստ և ավելի քան 1000 իրական հաշիվ Երևանում:">
      Самовыкупы с аккаунтов реальных пользователей по вашим ключевым словам. С нами ваши товары становятся ТОПами продаж на Wildberries. Собственный склад и более 1000 реальных аккаунтов в Ереване.
    </p>
    <div class="hero-stats">
      <div class="stat"><div class="stat-num" data-count="847">0</div><div class="stat-label" data-ru="товаров в ТОП" data-am="ապրանքներ TOP-ում">товаров в ТОП</div></div>
      <div class="stat"><div class="stat-num" data-count="0">0</div><div class="stat-label" data-ru="блокировок" data-am="արգելափակում">блокировок</div></div>
      <div class="stat"><div class="stat-num" data-count="1000">0</div><div class="stat-label" data-ru="аккаунтов" data-am="հաշիվներ">аккаунтов</div></div>
    </div>
    <div class="hero-buttons">
      <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary btn-lg">
        <i class="fab fa-telegram"></i>
        <span data-ru="Написать в Telegram" data-am="Գրել Telegram-ով">Написать в Telegram</span>
      </a>
      <a href="#calculator" class="btn btn-outline btn-lg">
        <i class="fas fa-calculator"></i>
        <span data-ru="Рассчитать стоимость" data-am="Հաշվել արժեքը">Рассчитать стоимость</span>
      </a>
    </div>
  </div>
  <div class="hero-image">
    <img src="/static/img/founder.jpg" alt="Go to Top">
    <div class="hero-badge-img">
      <i class="fas fa-shield-alt"></i>
      <span data-ru="Надежный метод продвижения" data-am="Ապահով առաջխաղացման մեթոդ">Надежный метод продвижения</span>
    </div>
  </div>
</div>
</div>
</section>

<!-- ===== TICKER ===== -->
<div class="ticker" data-section-id="ticker">
<div class="ticker-track" id="tickerTrack"></div>
</div>


<!-- ===== WB BANNER ===== -->
<div class="wb-banner fade-up" data-section-id="wb-banner">
<div class="container">
<div class="wb-banner-inner">
  <div class="wb-banner-card">
    <i class="fas fa-gavel wb-icon"></i>
    <div class="wb-text" data-ru="WB официально отменил штрафы за выкупы!" data-am="WB-ն պաշտոնապես վերացրել է տուգանքները ինքնագնումների համար!">WB официально отменил штрафы за выкупы!</div>
  </div>
  <div class="wb-banner-right">
    <span class="wb-r-icon">🚀</span>
    <div class="wb-r-text" data-ru="Повысь рейтинг магазина прямо сейчас" data-am="Բարձրացրեք խանութի վարկանիշը հիմա">Повысь рейтинг магазина прямо сейчас</div>
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><span data-ru="Узнать" data-am="Իմանալ">Узнать</span></a>
  </div>
</div>
</div>
</div>

<!-- ===== STATS BAR ===== -->
<div class="stats-bar fade-up" data-section-id="stats-bar">
<div class="container">
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-big" data-count-s="500">0</div>
      <div class="stat-desc" data-ru="поставщиков сотрудничают с нами" data-am="մատակարար համագործակցում է մեզ հետ">поставщиков сотрудничают с нами</div>
    </div>
    <div class="stat-card">
      <div class="stat-big" data-count-s="1000">0+</div>
      <div class="stat-desc" data-ru="аккаунтов с индивидуальной картой" data-am="հաշիվներ անհատական քարտով">аккаунтов с индивидуальной картой</div>
    </div>
    <div class="stat-card">
      <div class="stat-big" data-count-s="21">0</div>
      <div class="stat-desc" data-ru="день до выхода в ТОП" data-am="ապրանք TOP-ում օրական">день до выхода в ТОП</div>
    </div>
    <div class="stat-card">
      <div class="stat-big" data-count-s="200">0+</div>
      <div class="stat-desc" data-ru="выкупов каждый день" data-am="գնում ամեն օր">выкупов каждый день</div>
    </div>
  </div>
</div>
</div>

<!-- ===== SLOT COUNTER ===== -->
<div class="slot-counter-bar fade-up" data-section-id="slot-counter" id="slotCounterSection" style="display:none">
<div class="container">
  <div style="display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap;padding:24px 0">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="width:14px;height:14px;border-radius:50%;background:#10B981;animation:pulse 2s infinite"></div>
      <span id="slotLabel" data-ru="Свободных мест на этой неделе" data-am="Այս շաբաթի ազատ տեղեր" style="font-size:1rem;font-weight:600;color:var(--text-secondary)">Свободных мест на этой неделе</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <span id="slotFreeCount" style="font-size:2.2rem;font-weight:900;color:var(--purple)">—</span>
      <span style="font-size:0.85rem;color:var(--text-muted)">/ <span id="slotTotalCount">—</span></span>
    </div>
    <div id="slotProgress" style="width:200px;height:8px;background:var(--bg-card);border-radius:4px;overflow:hidden">
      <div id="slotProgressBar" style="height:100%;background:linear-gradient(90deg,#10B981,#8B5CF6);border-radius:4px;transition:width 1s ease;width:0%"></div>
    </div>
  </div>
</div>
</div>

<!-- ===== ABOUT ===== -->
<section class="section" id="about" data-section-id="about">
<div class="container">
  <div class="about-grid fade-up">
    <div class="about-img">
      <img src="/static/img/about-hero2.jpg" alt="Go to Top — Business Growth">
    </div>
    <div class="about-text">
      <div class="section-badge"><i class="fas fa-info-circle"></i> <span data-ru="О компании" data-am="Ընկերության մասին">О компании</span></div>
      <h2 data-ru="Что такое" data-am="Ի՞նչ է Go to Top-ը">Что такое <span class="gr">Go to Top</span>?</h2>
      <p data-ru="«Go to Top» — сервис развития Вашего бизнеса на маркетплейсах с помощью комплексного продвижения и услуги выкупов по ключевым словам. Для долгосрочного закрепления товара в TOPе." data-am="«Go to Top» — ձեր բիզնեսի զարգացման ծառայություն մարկետփլեյսներում՝ ինքնագնումների միջոցով առաջխաղացման մեթոդ է TOP-ում երկարաժամկետ դիրքավորվելու համար:">«Go to Top» — сервис развития Вашего бизнеса на маркетплейсах с помощью комплексного продвижения и услуги выкупов по ключевым словам. Для долгосрочного закрепления товара в TOPе.</p>
      <p data-ru="Наша команда профессионалов с 2021 года работает на результат. У нас собственные склады и офисы в Ереване. Используем для выкупов Вашего товара только реальные аккаунты людей и производим всё вручную." data-am="Մեր մասնագետների թիմը 2021 թվականից աշխատում է արդյունքի համար: Մենք ունենք սեփական պահեստներ և գրասենյակներ Երևանում: Գնումների համար օգտագործում ենք միայն իրական մարդկանց հաշիվներ և ամեն ինչ անում ենք ձեռքով:">Наша команда профессионалов с 2021 года работает на результат. У нас собственные склады и офисы в Ереване. Используем для выкупов Вашего товара только реальные аккаунты людей и производим всё вручную.</p>
      <div class="about-highlight">
        <p data-ru="Наилучший результат Вы получите, воспользовавшись комплексом наших услуг!" data-am="Լավագույն արդյունքը կստանաք օգտվելով մեր ծառայությունների փաթեթը!"><i class="fas fa-bolt" style="margin-right:8px"></i>Наилучший результат Вы получите, воспользовавшись комплексом наших услуг!</p>
      </div>
      <div class="section-cta">
        <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><i class="fas fa-shopping-cart"></i> <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">Заказать сейчас</span></a>
      </div>
    </div>
  </div>
</div>
</section>

<!-- ===== SERVICES ===== -->
<section class="section" id="services" data-section-id="services">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-rocket"></i> <span data-ru="Наши услуги" data-am="Մեր ծառայությունները">Наши услуги</span></div>
    <h2 class="section-title" data-ru="Полный спектр продвижения на WB" data-am="WB-ում առաջխաղացման լիարժեք սպեկտր">Полный спектр продвижения на WB</h2>
    <p class="section-sub" data-ru="Выкупы живыми людьми, отзывы с реальными фото, профессиональные фотосессии — всё для вашего товара" data-am="Գնումներ իրական մարդկանցով, կարծիքներ իրական լուսանկարներով, մասնագիտական լուսանկարահանումներ — ամենը ձեր ապրանքի համար">Выкупы живыми людьми, отзывы с реальными фото, профессиональные фотосессии — всё для вашего товара</p>
  </div>
  <div class="services-grid">
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-shopping-cart"></i></div>
      <h3 data-ru="Выкупы по ключевым запросам" data-am="Գնումներ բանալի հարցումներով">Выкупы по ключевым запросам</h3>
      <p data-ru="Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану." data-am="Ձեր ապրանքը գնվում է իրական մարդկանցով։ Իրական հաշիվներից տարբեր ՊՎԶ-ներով ամբողջ Երևանում:">Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану.</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Реальные аккаунты с историей покупок" data-am="Իրական հաշիվներ գնումների պատմությամբ">Реальные аккаунты с историей покупок</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Географическое распределение" data-am="Աշխարհագրական բաշխում">Географическое распределение</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Естественное поведение покупателей" data-am="Գնորդների բնական վարքագիծ">Естественное поведение покупателей</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Забор товара из ПВЗ" data-am="Ապրանքի ստացում ՊՎԶ-ից">Забор товара из ПВЗ</span></li>
      </ul>
    </div>
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-star"></i></div>
      <h3 data-ru="Отзывы и оценки" data-am="Կարծիքներ և գնահատականներ">Отзывы и оценки</h3>
      <p data-ru="Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга." data-am="Մանրամասն կարծիքներ լուսանկարներով և տեսանյութով իրական հաշիվներից վարկանիշի բարձրացման համար:">Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга.</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Текст отзыва + фото/видео" data-am="Կարծիքի տեքստ + լուսանկար/տեսանյութ">Текст отзыва + фото/видео</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Профессиональная фотосессия" data-am="Մասնագիտական լուսանկարահանում">Профессиональная фотосессия</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Разные локации и модели" data-am="Տարբեր վայրեր և մոդելներ">Разные локации и модели</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="До 50% отзывов от выкупов" data-am="Մինչև 50% կարծիքներ գնումներից">До 50% отзывов от выкупов</span></li>
      </ul>
      <div style="margin-top:20px;text-align:center"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-rocket"></i> <span data-ru="Начать продвижение" data-am="Սկսել առաջխաղացումը">Начать продвижение</span></a></div>
    </div>
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-camera"></i></div>
      <h3 data-ru="Фото и видеосъёмка" data-am="Լուսանկարահանում և տեսանկարահանում">Фото и видеосъёмка</h3>
      <p data-ru="Профессиональная съёмка товаров с моделями для карточек WB и отзывов." data-am="Մասնագիտական ապրանքների լուսանկարահանում մոդելներով WB քարտերի և կարծիքների համար:">Профессиональная съёмка товаров с моделями для карточек WB и отзывов.</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Женские и мужские модели" data-am="Կանացի և տղամարդկանցի մոդելներ">Женские и мужские модели</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Предметная съёмка" data-am="Առարկայական լուսանկարահանում">Предметная съёмка</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Видеообзоры товаров" data-am="Ապրանքների տեսանյութներ">Видеообзоры товаров</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Ребёнок модель (до 14 лет)" data-am="Երեխա մոդել (մինչև 14 տարեկան)">Ребёнок модель (до 14 лет)</span></li>
      </ul>
      <div style="margin-top:20px;text-align:center"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-camera"></i> <span data-ru="Заказать съёмку" data-am="Պատվիրել լուսանկար">Заказать съёмку</span></a></div>
    </div>
  </div>
</div>
</section>


<!-- ===== BUYOUT DETAIL ===== -->
<section class="section" data-section-id="buyout-detail">
<div class="container">
  <div class="buyout-detail fade-up">
    <div class="buyout-detail-header">
      <div class="section-badge"><i class="fas fa-shopping-bag"></i> <span data-ru="Услуга выкупа" data-am="Գնումի ծառայություն">Услуга выкупа</span></div>
      <h2 data-ru="Что включает в себя услуга выкупа" data-am="Ինչ է ներառում գնումի ծառայությունը">Что включает в себя <span class="gr">услуга выкупа</span></h2>
      <p data-ru="Индивидуальный подход к каждому клиенту. Выкупы только по ключевым запросам, каждый заказ оформляет реальный человек вручную." data-am="Անհատական մոտեցում յուրաքանչյուր հաճախորդի համար: Գնումներ միայն բանալի հարցումներով, յուրաքանչյուր պատվերը կատարում է իրական մարդ ձեռքով:">Индивидуальный подход к каждому клиенту. Выкупы только по ключевым запросам, каждый заказ оформляет реальный человек вручную.</p>
    </div>
    <div class="buyout-grid">
      <div class="buyout-card">
        <h4 data-ru="Полное сопровождение" data-am="Լիարժեք ուղեկցում">Полное сопровождение</h4>
        <ul>
          <li data-ru="Консультация" data-am="Խորհրդատվություն">Консультация</li>
          <li data-ru="Создание чата с менеджером" data-am="Մենեջերի հետ չատի ստեղծում">Создание чата с менеджером</li>
          <li data-ru="Согласование плана выкупов" data-am="Գնումների պլանի համաձայնեցում">Согласование плана выкупов</li>
          <li data-ru="Выкупы по ключевым запросам" data-am="Գնումներ բանալի հարցումներով">Выкупы по ключевым запросам</li>
          <li data-ru="Забор товара из ПВЗ курьерами" data-am="Ապրանքի ստացում ՊՎԶ-ից մեր առաքիչների օգնությամբ">Забор товара из ПВЗ курьерами</li>
          <li data-ru="Возврат на склады маркетплейсов" data-am="Վերադարձ մարկետփլեյսների պահեստներ">Возврат на склады маркетплейсов</li>
          <li data-ru="Публикация отзывов" data-am="Կարծիքների հրապարակում">Публикация отзывов</li>
        </ul>
      </div>
      <div class="buyout-card">
        <h4 data-ru="Отчётность" data-am="Հաշվետվություն">Отчётность</h4>
        <p data-ru="Формирование итоговой отчётности по каждому выкупу. Полная прозрачность на каждом этапе." data-am="Վերջնական հաշվետվության ձևավորում յուրաքանչյուր գնումի համար: Լիարժեք թափանցիկություն յուրաքանչյուր փուլում:">Формирование итоговой отчётности по каждому выкупу. Полная прозрачность на каждом этапе.</p>
        <div style="margin-top:16px;text-align:center"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-warning" style="font-size:0.82rem;padding:9px 18px"><i class="fas fa-fire"></i> <span data-ru="Начать выкупы сейчас" data-am="Սկսել գնումները">Начать выкупы сейчас</span></a></div>
      </div>
      <div class="buyout-card">
        <h4 data-ru="Контроль" data-am="Վերահսկողություն">Контроль</h4>
        <p data-ru="Сопровождение и контроль на всех этапах. Точное следование алгоритму для безопасности вашего кабинета." data-am="Ուղեկցում և վերահսկողություն բոլոր փուլերում: Ալգորիթմի ճիշտ հետևողականություն ձեր հաշվի անվտանգության համար:">Сопровождение и контроль на всех этапах. Точное следование алгоритму для безопасности вашего кабинета.</p>
        <div style="margin-top:16px;text-align:center"><a href="https://t.me/suport_admin_2" target="_blank" class="btn btn-tg" style="font-size:0.82rem;padding:9px 18px"><i class="fab fa-telegram"></i> <span data-ru="Получить индивидуальный расчёт" data-am="Ստանալ ինդիվիդուալ հաշվարկ">Получить индивидуальный расчёт</span></a></div>
      </div>
    </div>
  </div>
</div>
</section>


<!-- ===== WHY BUYOUTS BY KEYWORDS ===== -->
<section class="section" id="why-buyouts" data-section-id="why-buyouts">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-chart-line"></i> <span data-ru="Почему это работает" data-am="Ինչու է սա աշխատում.">Почему это работает</span></div>
    <h2 class="section-title" data-ru="Почему выкупы по ключевым запросам — самый эффективный способ продвижения" data-am="Ինչու է գնումները բանալի բառերով — ամենա արդյունավետը">Почему выкупы по ключевым запросам — <span class="gr">самый эффективный способ</span> продвижения</h2>
  </div>

  <div class="why-block fade-up">
    <h3><i class="fas fa-funnel-dollar"></i> <span data-ru="Мы не просто покупаем ваш товар — мы прокачиваем всю воронку" data-am="Մենք ոչ միայն գնում ենք — մենք բարձրացնում ենք բոլոր քայլերի կոնվերսիաները">Мы не просто покупаем ваш товар — мы прокачиваем всю воронку</span></h3>
    <p data-ru="Каждый выкуп по ключевому запросу — это полноценное продвижение вашей карточки. Наши люди делают всё так, как это делает реальный покупатель. Вот что происходит при каждом выкупе:" data-am="Յուրաքանչյուր գնում բանալի բառով — լիարժեք առաջխաղացման մեթոդ.">Каждый выкуп по ключевому запросу — это полноценное продвижение вашей карточки. Наши люди делают всё так, как это делает реальный покупатель. Вот что происходит при каждом выкупе:</p>
    
    <div class="why-steps">
      <div class="why-step"><div class="why-step-num">1</div><div><h4 data-ru="Поиск по ключевому запросу" data-am="Վորոնում բանալի բառով">Поиск по ключевому запросу</h4><p data-ru="Находим ваш товар именно так, как ищет реальный покупатель — через поисковую строку WB" data-am="Գտնում ենք ձեր ապրանքը։">Находим ваш товар именно так, как ищет реальный покупатель — через поисковую строку WB</p></div></div>
      <div class="why-step"><div class="why-step-num">2</div><div><h4 data-ru="Просмотр карточки" data-am="Քարտի դիտարկում">Просмотр карточки</h4><p data-ru="Полностью просматриваем фото и видео, листаем описание — повышаем конверсию из просмотра в переход" data-am="Դիտարկվում ենք բոլոր լուսանկարները և հոլովակը։">Полностью просматриваем фото и видео, листаем описание — повышаем конверсию из просмотра в переход</p></div></div>
      <div class="why-step"><div class="why-step-num">3</div><div><h4 data-ru="Работа с отзывами" data-am="Աշխատանք կարծիքների հետ">Работа с отзывами</h4><p data-ru="Пролистываем отзывы, лайкаем положительные — это улучшает ранжирование лучших отзывов" data-am="Թերթում ենք կարծիքների բաժինը, լայքում ենք լավ կարծիքները">Пролистываем отзывы, лайкаем положительные — это улучшает ранжирование лучших отзывов</p></div></div>
      <div class="why-step"><div class="why-step-num">4</div><div><h4 data-ru="Добавление конкурентов" data-am="Մրցակիցների ավելացում">Добавление конкурентов</h4><p data-ru="Добавляем в корзину товары конкурентов вместе с вашим — имитируем реальное поведение покупателя" data-am="Ավելացնում ենք մրցակիցներին զամբյուղ, մարդկային վարքագծի համար">Добавляем в корзину товары конкурентов вместе с вашим — имитируем реальное поведение покупателя</p></div></div>
      <div class="why-step"><div class="why-step-num">5</div><div><h4 data-ru="Удаление конкурентов из корзины" data-am="Մրցակիցների հեռացում զամբյուղից">Удаление конкурентов из корзины</h4><p data-ru="В момент заказа удаляем конкурентов и оставляем только ваш товар — WB видит, что выбирают именно вас" data-am="Պատվիրելու պահին, մենք հեռացնում ենք մրցակիցներին և թողնում միայն ձեր ապրանքը։ WB-ն տեսնում է, որ մարդիկ ընտրում են ձեզ։">В момент заказа удаляем конкурентов и оставляем только ваш товар — WB видит, что выбирают именно вас</p></div></div>
      <div class="why-step"><div class="why-step-num">6</div><div><h4 data-ru="Заказ и получение" data-am="Պատվեր և ստացում">Заказ и получение</h4><p data-ru="Оформляем заказ, забираем из ПВЗ, оставляем отзыв — полный цикл реального покупателя" data-am="Պատվիրում ենք ապրանքը, վերցնում ենք այն ստացման կետից և թողնում ենք կարծիք՝ իրական հաճախորդի ամբողջական ճանապարհ">Оформляем заказ, забираем из ПВЗ, оставляем отзыв — полный цикл реального покупателя</p></div></div>
    </div>

    <div class="highlight-result" data-ru="В результате повышаются ВСЕ конверсии вашей карточки: CTR, переходы, добавления в корзину, заказы. Карточка закрепляется в ТОПе и начинает получать органический трафик. Чем выше позиция — тем больше органических продаж без дополнительных вложений." data-am="Արդյունքում, ձեր քարտի ԲՈԼՈՐ փոխակերպումները մեծանում են՝ CTR, զամբյուղում ավելացումներ և պատվերներ: Ձեր քարտը դառնում է որոնման ամենաբարձր վարկանիշ ունեցող արդյունք և սկսում է ստանալ օրգանական տրաֆիկ: Որքան բարձր է վարկանիշը, այնքան շատ օրգանական վաճառքներ դուք կապահովեք առանց որևէ լրացուցիչ ներդրման:"><i class="fas fa-bolt"></i> <strong>Результат:</strong> повышаются <strong>ВСЕ конверсии</strong> вашей карточки: CTR, переходы, добавления в корзину, заказы. Карточка закрепляется в ТОПе и начинает получать <strong>органический трафик</strong>. Чем выше позиция — тем больше органических продаж без дополнительных вложений.</div>
  </div>

  <div class="why-block fade-up">
    <h3><i class="fas fa-balance-scale-right"></i> <span data-ru="50 000 ֏ на блогера vs 50 000 ֏ на выкупы — что эффективнее?" data-am="50 000 ֏ բլոգեր vs 50 000 ֏ ինքնագնումներ — որն է ավելի արդյունավետ?">50 000 ֏ на блогера vs 50 000 ֏ на выкупы — что эффективнее?</span></h3>
    <div class="compare-box">
      <div class="compare-side bad">
        <h4><i class="fas fa-dice"></i> <span data-ru="Reels у блогера" data-am="Reels բլոգերի մոտ">Reels у блогера</span></h4>
        <div class="price-tag">50 000 ֏</div>
        <p data-ru="1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это всегда риск без гарантий результата. Нету просмотров на Reels соответственно нету продаж на товары. Блогер не ключ к продажам. Инвестируйте в рекламу с умом!" data-am="Բլոգերի 1 տեսանյութը ռիսկ է։ Անկախ նրանից՝ այն կհավագի դիտումներ, թե ոչ՝ ոչ ոք չգիտի։ Եթե ոչ, գումարը կորած է։ Դա միշտ ռիսկ է՝ առանց երաշխավորված արդյունքի։ Չկան դիտումներ չկան նաև վաճառքներ։ Բլոգերը դա վաճառքի բանալի չէ։ Ներդրեք գումարը գովազդի մեջ մտածված։">1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это <strong>всегда риск</strong> без гарантий результата. Нету просмотров на Reels — соответственно нету продаж на товары. Блогер не ключ к продажам. <strong>Инвестируйте в рекламу с умом!</strong></p>
      </div>
      <div class="compare-side good">
        <h4><i class="fas fa-chart-line"></i> <span data-ru="25 выкупов по ключевым" data-am="25 ինքնագնում բանալի բառով">25 выкупов по ключевым</span></h4>
        <div class="price-tag">50 000 ֏</div>
        <p data-ru="25 выкупов по целевому запросу — это 100% проверенный способ продвижения. Ваш товар быстро поднимается в ТОП выдачи зависимо от изначальных позиций, закрепляется там и начинает привлекать органический трафик. Больше продаж. Больше гарантированной выручки." data-am="25 ինքնագնում բանալի բառով 100% ապացուցված առաջխաղացման մեթոդ է: Ձեր ապրանքը արագորեն բարձրանում է որոնման արդյունքների առաջատար դիրքեր, հաստատվում է և սկսում է գրացել օրգանիգ դիտումներ: Շատ դիտում ավելի շատ վաճառք: Երաշխավորված ավելի շատ եկամուտ: ">25 выкупов по целевому запросу — это <strong>100% проверенный способ</strong> продвижения. Ваш товар быстро поднимается в ТОП выдачи зависимо от изначальных позиций, закрепляется там и начинает привлекать <strong>органический трафик</strong>. Больше продаж. Больше гарантированной выручки.</p>
      </div>
    </div>
    <div class="highlight-result" data-ru="Факт: при выкупах по 1 ключевому запросу уже от 25 штук товар быстро продвигается в ТОП и закрепляется там надолго — за счёт улучшения всех поведенческих метрик. А органический трафик WB становится вашим основным источником продаж." data-am="25 հատ ինքնագնման դեպքոմ կախված ապրանքի սկզբնական դիրքից ապրանքն արագ առաջ է շարժվում դեպի վերև և այնտեղ դիրքավորվում է երկար ժամանակով՝ բոլոր վարքագծային չափորոշիչների բարելավման հաշվին։ Իսկ WB-ի օրգանիկ անվճար տրաֆիկը դառնում է ձեր վաճառքի հիմնական աղբյուրը:"><i class="fas fa-lightbulb"></i> <strong>Факт:</strong> при выкупах по 1 ключевому запросу уже от <strong>25 штук</strong> товар быстро продвигается в ТОП и закрепляется там надолго — за счёт улучшения всех поведенческих метрик. А органический трафик WB становится вашим основным источником продаж.</div>
  </div>

  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-warning"><i class="fas fa-fire"></i> <span data-ru="Начать выкупы по ключевикам" data-am="Սկսել գնումները բանալի բառերով">Начать выкупы по ключевикам</span></a>
  </div>
</div>
</section>

<!-- ===== WB OFFICIAL ===== -->
<section class="section section-dark" id="wb-official" data-section-id="wb-official">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-gavel"></i> <span data-ru="Официально" data-am="Պաշտոնապես">Официально</span></div>
    <h2 class="section-title" data-ru="Wildberries официально разрешил самовыкупы" data-am="Wildberries-ը պաշտոնապես թույլատրել է ինքնագնումները">Wildberries <span class="gr">официально разрешил</span> самовыкупы</h2>
  </div>

  <div class="why-block fade-up">
    <div class="wb-official-badge"><i class="fas fa-check-circle"></i> Подтверждено в оферте WB</div>
    
    <h3><i class="fas fa-shield-alt"></i> <span data-ru="Никаких штрафов. Никаких рисков." data-am="Ոչ մի տուգանք: Ոչ մի ռիսկ:">Никаких штрафов. Никаких рисков.</span></h3>
    <p data-ru="Wildberries официально подтвердил в своей оферте, что самовыкупы не являются нарушением. За это не предусмотрены штрафы или блокировки кабинета. Тысячи успешных продавцов используют этот инструмент каждый день." data-am="Wildberries-ը պաշտոնապես հաստատել է իր օֆերտայում، որ ինքնագնումները խախտում չեն: Տուգանքներ կամ արգելափակումներ նախատեսված չեն: Հազարավոր հաջողակ վաճառողներ օգտագործում են այս գործիքը ամեն օր:">Wildberries официально подтвердил в своей оферте, что самовыкупы <strong>не являются нарушением</strong>. За это не предусмотрены штрафы или блокировки кабинета. Тысячи успешных продавцов используют этот инструмент каждый день.</p>
    
    <h3><i class="fas fa-arrow-up"></i> <span data-ru="WB вернул приоритет органической выдачи" data-am="WB-ն վերադարձրել է օրգանիկի առաջնահերթությունը:">WB вернул приоритет органической выдачи</span></h3>
    <p data-ru="Wildberries подтвердил в обновлённой оферте: приоритет в поисковой выдаче получают товары с лучшими поведенческими метриками — конверсия, время на карточке, добавления в корзину, заказы. Именно это мы и прокачиваем при каждом выкупе." data-am="Wildberries-ը հաստատել է թարմացված օֆերտայում։ որոնման արդյունքներում առաջնահերթություն են ստանում լավագույն վարքագծային ցուցանիշներով ապրանքները։ Հենց դա է, ինչ մենք ապահովում ենք յուրաքանչյուր գնումի ընթացքում: Հիմա գլխավոր էջի թոփ 100-ի մեծ մասը օրգանիկ դիրքեր են, նախկին գովազդի փոխարեն։ Թարմացված օֆերտայում նշված է، որ որոնման արդյունքներում առաջնահերթություն ստանում են լավագույն վարքագծական ցուցանիշներով ապրանքները:">Wildberries подтвердил в обновлённой оферте: приоритет в поисковой выдаче получают товары с лучшими <strong>поведенческими метриками</strong> — конверсия, время на карточке, добавления в корзину, заказы. <strong>Именно это мы и прокачиваем при каждом выкупе.</strong> Сейчас на главной странице в топ-100 выдаче больше органической выдачи. Ранее всё было заполнено рекламными местами. В оферте WB подтверждает, что приоритет сейчас — в конверсиях карточки.</p>

    <div class="highlight-result" data-ru="Сейчас — лучшее время для продвижения вашего товара. Пока конкуренты сомневаются — вы уже можете занять ТОП выдачи, привлечь органический трафик и зарабатывать больше. Не ждите, пока конкуренты сделают это первыми." data-am="Այժմ լավագույն ժամանակն է ձեր ապրանքների առաջխաղացման համար: Մինչ մրցակիցները կասկածում են, դուք արդեն կարող եք վերցնել լավագույն դիրքերը TOP-ում, ներգրավել օրգանական թրաֆիկը և վաստակել ավել գումար։ Մի սպասեք, որ մրցակիցները դա անեն առաջինը:"><i class="fas fa-rocket"></i> <strong>Сейчас — лучшее время</strong> для продвижения вашего товара. Пока конкуренты сомневаются — вы уже можете занять ТОП выдачи, привлечь органический трафик и <strong>зарабатывать больше</strong>. Не ждите, пока конкуренты сделают это первыми.</div>

  </div>

  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success"><i class="fas fa-rocket"></i> <span data-ru="Занять ТОП прямо сейчас" data-am="Զբաղեցնել ՏՏՏ-ը հիմա">Занять ТОП прямо сейчас</span></a>
  </div>
</div>
</section>

<!-- ===== CALCULATOR ===== -->
<section class="section section-dark" id="calculator" data-section-id="calculator">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-calculator"></i> <span data-ru="Калькулятор" data-am="Հաշվիչ">Калькулятор</span></div>
    <h2 class="section-title" data-ru="Рассчитайте стоимость услуг" data-am="Հաշվեք ծառայությունների արժեքը">Рассчитайте стоимость услуг</h2>
    <p class="section-sub" data-ru="Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram." data-am="Ընտրեք անհրաժեշտ ծառայությունները, նշեք քանակը և իմացեք գումարը: Պատվերը ձևակերպվում է Telegram-ով:">Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram.</p>
  </div>
  <div class="calc-wrap fade-up">
    <div class="calc-tabs">
      <div class="calc-tab active" onclick="showCalcTab('buyouts',this)" data-ru="Выкупы" data-am="Գնումներ">Выкупы</div>
      <div class="calc-tab" onclick="showCalcTab('reviews',this)" data-ru="Отзывы" data-am="Կարծիքներ">Отзывы</div>
      <div class="calc-tab" onclick="showCalcTab('photo',this)" data-ru="Фотосъёмка" data-am="Լուսանկարահանում">Фотосъёмка</div>
      <div class="calc-tab" onclick="showCalcTab('ff',this)" data-ru="ФФ" data-am="Ֆուլֆիլմենթ">ФФ</div>
      <div class="calc-tab" onclick="showCalcTab('logistics',this)" data-ru="Логистика" data-am="Լոգիստիկա">Логистика</div>
      <div class="calc-tab" onclick="showCalcTab('other',this)" data-ru="Прочие услуги" data-am="Այլ ծառայություններ">Прочие услуги</div>
    </div>

    <!-- ===== ВЫКУПЫ ===== -->
    <div class="calc-group active" id="cg-buyouts">
      <div class="calc-row" data-price="buyout" id="buyoutRow">
        <div class="calc-label" data-ru="Выкуп + забор из ПВЗ" data-am="Գնում + ստացում ՊՎԶ-ից">Выкуп + забор из ПВЗ</div>
        <div class="calc-price" id="buyoutPriceLabel">2 000 ֏</div>
        <div class="calc-input"><button onclick="ccBuyout(-1)">−</button><input type="number" id="buyoutQty" value="0" min="0" max="999" onchange="onBuyoutInput()" oninput="onBuyoutInput()"><button onclick="ccBuyout(1)">+</button></div>
      </div>
      <div class="buyout-tier-info">
        <strong data-ru="Чем больше выкупов — тем дешевле:" data-am="Որքան շատ գնումներ — այնքան էժան:">Чем больше выкупов — тем дешевле:</strong><br>
        <span data-ru="1-20 шт → 2 000 ֏ | 21-40 шт → 1 700 ֏ | 41-60 шт → 1 500 ֏ | 60+ шт → 1 250 ֏" data-am="1-20 հատ → 2 000 ֏ | 21-40 հատ → 1 700 ֏ | 41-60 հատ → 1 500 ֏ | 60+ հատ → 1 250 ֏">1-20 шт → ֏2 000 &nbsp;|&nbsp; 21-40 шт → ֏1 700 &nbsp;|&nbsp; 41-60 шт → ֏1 500 &nbsp;|&nbsp; 60+ шт → ֏1 250</span>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Выкуп КГТ + забор из ПВЗ" data-am="Ծանրաքաշ ապրանքի գնում + ստացում ՊՎԶ-ից">Выкуп КГТ + забор из ПВЗ</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ОТЗЫВЫ ===== -->
    <div class="calc-group" id="cg-reviews">
      <div class="calc-row" data-price="300">
        <div class="calc-label" data-ru="Оценка" data-am="Գնահատական">Оценка</div>
        <div class="calc-price">300 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="500">
        <div class="calc-label" data-ru="Оценка + отзыв" data-am="Գնահատական + կարծիք">Оценка + отзыв</div>
        <div class="calc-price">500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="500">
        <div class="calc-label" data-ru="Вопрос к товару" data-am="Հարց ապրանքի վերաբերյալ">Вопрос к товару</div>
        <div class="calc-price">500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="250">
        <div class="calc-label" data-ru="Написание текста отзыва" data-am="Կարծիքի տեքստի գրում">Написание текста отзыва</div>
        <div class="calc-price">250 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="100">
        <div class="calc-label" data-ru="Подписка на бренд / страницу" data-am="Բրենդի / էջի բաժանորդագրություն">Подписка на бренд / страницу</div>
        <div class="calc-price">100 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ФОТОСЪЁМКА ===== -->
    <div class="calc-group" id="cg-photo">
      <div class="calc-row" data-price="3500">
        <div class="calc-label" data-ru="Фотосессия в гардеробной WB (жен. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (կին մոդել)">Фотосессия в гардеробной WB (жен. модель)</div>
        <div class="calc-price">3 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="4500">
        <div class="calc-label" data-ru="Фотосессия в гардеробной WB (муж. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (տղամարդ մոդել)">Фотосессия в гардеробной WB (муж. модель)</div>
        <div class="calc-price">4 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Предметная фотосъёмка (3 фото)" data-am="Առարկայական լուսանկարահանում (3 լուսանկար)">Предметная фотосъёмка (3 фото)</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="5000">
        <div class="calc-label" data-ru="Предметная съёмка (крупное / техника, 3 фото)" data-am="Առարկայական լուսանկարահանում (խոշոր / տեխնիկա, 3 լուս.)">Предметная съёмка (крупное / техника, 3 фото)</div>
        <div class="calc-price">5 000 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Ребёнок модель (до 14 лет)" data-am="Երեխա մոդել (մինչև 14 տարեկան)">Ребёнок модель (до 14 лет)</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="7000">
        <div class="calc-label" data-ru="Видеообзор товара" data-am="Ապրանքի վիդեոհոլովակ">Видеообзор товара</div>
        <div class="calc-price">7 000 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ФФ (Фулфилмент) ===== -->
    <div class="calc-group" id="cg-ff">
      <div class="calc-row" data-price="100">
        <div class="calc-label" data-ru="Замена штрихкода" data-am="Շտրիխկոդի փոխարինում">Замена штрихкода</div>
        <div class="calc-price">100 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="200">
        <div class="calc-label" data-ru="Переупаковка (наша)" data-am="Վերափաթեթավորում (մեր փաթեթ)">Переупаковка (наша)</div>
        <div class="calc-price">200 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="150">
        <div class="calc-label" data-ru="Переупаковка (клиента)" data-am="Վերափաթեթավորում (հաճախորդի փաթեթ)">Переупаковка (клиента)</div>
        <div class="calc-price">150 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ЛОГИСТИКА ===== -->
    <div class="calc-group" id="cg-logistics">
      <div class="calc-row" data-price="2000">
        <div class="calc-label" data-ru="Доставка на склад WB (1 коробка 60х40х40)" data-am="Առաքում WB պահեստ (1 տուփ 60x40x40)">Доставка на склад WB (1 коробка 60х40х40)</div>
        <div class="calc-price">2 000 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Доставка до вашего склада (1 коробка 60х40х40)" data-am="Առաքում ձեր պահեստ (1 տուփ 60x40x40)">Доставка до вашего склада (1 коробка 60х40х40)</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ПРОЧИЕ УСЛУГИ ===== -->
    <div class="calc-group" id="cg-other">
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Глажка одежды (одиночная вещь)" data-am="Հագուստի արդուկում (մեկ իր)">Глажка одежды (одиночная вещь)</div>
        <div class="calc-price">1 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Глажка одежды (верхняя одежда)" data-am="Հագուստի արդուկում (վերնահագուստ)">Глажка одежды (верхняя одежда)</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Забор из ПВЗ для съёмки" data-am="Վերցնում ՊՎԶ-ից">Забор из ПВЗ для съёмки</div>
        <div class="calc-price">1 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Возврат в ПВЗ после съёмки" data-am="Վերցնում ՊՎԶ-ից">Возврат в ПВЗ после съёмки</div>
        <div class="calc-price">1 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>
    <div class="calc-total">
      <div class="calc-total-label" data-ru="Итого:" data-am="Ընդամենը:">Итого:</div>
      <div class="calc-total-value" id="calcTotal">0 ֏</div>
    </div>
    <!-- Referral code field -->
    <div id="calcRefWrap" style="margin-top:16px;padding:16px;background:rgba(139,92,246,0.05);border:1px solid var(--border);border-radius:var(--r-sm)">
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <label style="display:block;font-size:0.82rem;font-weight:600;color:var(--accent);margin-bottom:6px"><i class="fas fa-gift" style="margin-right:6px"></i><span data-ru="Есть промокод?" data-am="Պրոմоկոդ ունեք?">Есть промокод?</span></label>
          <input type="text" id="refCodeInput" placeholder="PROMO2026" style="width:100%;padding:10px 14px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.92rem;font-family:inherit;text-transform:uppercase;outline:none;transition:var(--t)" onfocus="this.style.borderColor='var(--purple)'" onblur="this.style.borderColor='var(--border)'">
        </div>
        <button onclick="checkRefCode()" class="btn btn-outline" style="padding:10px 20px;font-size:0.88rem;white-space:nowrap"><i class="fas fa-check-circle" style="margin-right:6px"></i><span data-ru="Применить" data-am="Կիրառեл">Применить</span></button>
      </div>
      <div id="refResult" style="display:none;margin-top:10px;padding:10px 14px;border-radius:8px;font-size:0.88rem;font-weight:500"></div>
    </div>
    <div class="calc-cta">
      <a href="https://t.me/goo_to_top" id="calcTgBtn" class="btn btn-primary btn-lg" target="_blank">
        <i class="fab fa-telegram"></i>
        <span data-ru="Заказать в Telegram" data-am="Պատվիրել հիմա">Заказать сейчас</span>
      </a>
    </div>
  </div>
</div>
</section>

<!-- ===== PROCESS ===== -->
<section class="section" id="process" data-section-id="process">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-route"></i> <span data-ru="Как мы работаем" data-am="Ինչպես ենք աշխատում">Как мы работаем</span></div>
    <h2 class="section-title" data-ru="5 шагов от заявки до ТОПа" data-am="5 քայլ մինչև TOP">5 шагов от заявки до ТОПа</h2>
  </div>
  <div class="process-grid fade-up">
    <div class="step"><div class="step-line"></div><div class="step-num">1</div><h4 data-ru="Заявка" data-am="Հայտ">Заявка</h4><p data-ru="Пишете в Telegram и описываете товар" data-am="Գրում եք Telegram-ով և նկարագրում ապրանքը">Пишете в Telegram и описываете товар</p></div>
    <div class="step"><div class="step-line"></div><div class="step-num">2</div><h4 data-ru="Анализ" data-am="Վերլուծություն">Анализ</h4><p data-ru="Анализируем нишу и создаём стратегию" data-am="Վերլուծում ենք ապրանքը և ստեղծում ստրատեգիա">Анализируем нишу и создаём стратегию</p></div>
    <div class="step"><div class="step-line"></div><div class="step-num">3</div><h4 data-ru="Запуск" data-am="Մեկնարկ">Запуск</h4><p data-ru="Начинаем выкупы в течение 24 часов" data-am="Սկսում ենք գնումները 24 ժամվա ընթացքում">Начинаем выкупы в течение 24 часов</p></div>
    <div class="step"><div class="step-line"></div><div class="step-num">4</div><h4 data-ru="Контроль" data-am="Վերահսկողություն">Контроль</h4><p data-ru="Ежедневные отчёты о прогрессе" data-am="Ամենօրյա հաշվետվություններ ընթացքի մասին">Ежедневные отчёты о прогрессе</p></div>
    <div class="step"><div class="step-num">5</div><h4 data-ru="Результат" data-am="Արդյունք">Результат</h4><p data-ru="Ваш товар в ТОПе выдачи WB" data-am="Ձեր ապրանքը WB-ի TOP-ում է">Ваш товар в ТОПе выдачи WB</p></div>
  </div>
  <div class="section-cta">
    <a href="https://t.me/suport_admin_2" target="_blank" class="btn btn-tg"><i class="fab fa-telegram"></i> <span data-ru="Написать менеджеру" data-am="Գրել մենեջերին">Написать менеджеру</span></a>
  </div>
</div>
</section>

<!-- ===== WAREHOUSE ===== -->
<section class="section section-dark" id="warehouse" data-section-id="warehouse">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-warehouse"></i> <span data-ru="Наш склад" data-am="Մեր պահեստը">Наш склад</span></div>
    <h2 class="section-title" data-ru="Всё организовано и по полочкам" data-am="Ամեն ինչ կազմակերպված է և կարգավորված">Всё организовано и по полочкам</h2>
  </div>
  <div class="wh-grid fade-up">
    <div class="wh-item" onclick="openLightbox(this)">
      <img src="/static/img/warehouse1.jpg" alt="Организованное хранение товаров">
      <div class="wh-caption" data-ru="Организованное хранение" data-am="Կազմակերպված պահպանում">Организованное хранение</div>
    </div>
    <div class="wh-item" onclick="openLightbox(this)">
      <img src="/static/img/warehouse2.jpg" alt="Склад с товарами">
      <div class="wh-caption" data-ru="Система учёта" data-am="Հաշվառման համակարգ">Система учёта</div>
    </div>

  </div>
  <p class="section-sub fade-up" style="text-align:center;max-width:700px;margin:32px auto 0" data-ru="Собственный склад в Ереване. Забор ваших товаров с ПВЗ. Надежное хранение товара. Отгрузка Ваших товаров на склад WB СЦ Ереван" data-am="Սեփական պահեստ Երևանում: Ձեր ապրանքների ստացում ՊՎԶ-ից: Հուսալի պահպանում: Ձեր ապրանքների առաքում WB Երևան պահեստ">Собственный склад в Ереване. Забор ваших товаров с ПВЗ. Надежное хранение товара. Отгрузка Ваших товаров на склад WB СЦ Ереван</p>
  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><i class="fas fa-shopping-cart"></i> <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">Заказать сейчас</span></a>
  </div>
</div>
</section>

<!-- ===== GUARANTEE ===== -->
<section class="section" id="guarantee" data-section-id="guarantee">
<div class="container">
    <div class="guarantee-card fade-up">
    <img src="/static/img/team-new.jpg" alt="Команда Go to Top">
    <div>
      <div class="section-badge"><i class="fas fa-shield-alt"></i> <span data-ru="Гарантия безопасности" data-am="Անվտանգության երաշխիք">Гарантия безопасности</span></div>
      <h2 data-ru="Всё организовано и по полочкам. Наша команда" data-am="Ամեն ինչ կազմակերպված է և կարգավորված։ Մեր թիմը">Всё организовано и по полочкам. Наша команда</h2>
      <p data-ru="За всё время работы ни один кабинет клиента не получил блокировку. Каждый проект ведётся опытной командой с полным контролем на каждом этапе." data-am="Աշխատանքի ողջ ընթացքում ոչ մի հաճախորդի հաշիվ չի արգելափակվել: Երբ նախագիծը վարվում է փորձառու թիմի կողմից լիարժեք վերահսկողությամբ յուրաքանչյուր փուլում:">За всё время работы ни один кабинет клиента не получил блокировку. Каждый проект ведётся опытной командой с полным контролем на каждом этапе.</p>
      <ul class="g-list">
        <li><i class="fas fa-check-circle"></i> <span data-ru="Реальное поведение человека во время выкупа" data-am="Իրական մարդկային վարքագիծ գնում կատարելիս">Реальное поведение человека во время выкупа</span></li>
        <li><i class="fas fa-check-circle"></i> <span data-ru="Реальные аккаунты с историей покупок" data-am="Իրական հաշիվներ գնումների պատմությամբ">Реальные аккаунты с историей покупок</span></li>
        <li><i class="fas fa-check-circle"></i> <span data-ru="Естественное распределение по географии" data-am="Բնական աշխարհագրական բաշխում">Естественное распределение по географии</span></li>
      </ul>
      <div class="g-badge">
        <i class="fas fa-award"></i>
        <span data-ru="0 блокировок за всё время работы" data-am="0 արգելափակում աշխատանքի ողջ ընթացքում">0 блокировок за всё время работы</span>
      </div>
      <div class="section-cta" style="margin-top:24px">
        <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success"><i class="fas fa-rocket"></i> <span data-ru="Начать продвижение" data-am="Սկսել առաջխաղացումը">Начать продвижение</span></a>
      </div>
    </div>
  </div>
</div>
</section>

<!-- ===== COMPARISON ===== -->
<section class="section section-dark" data-section-id="comparison">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-balance-scale"></i> <span data-ru="Сравнение" data-am="Համեմատություն">Сравнение</span></div>
    <h2 class="section-title" data-ru="Go to Top vs Другие агентства" data-am="Go to Top vs Այլ գործակալություններ">Go to Top vs Другие агентства</h2>
  </div>
  <div class="fade-up"><div class="cmp-table-wrap">
  <table class="cmp-table">
    <thead><tr>
      <th data-ru="Критерий" data-am="Չափանիշ">Критерий</th>
      <th>Go to Top</th>
      <th data-ru="Другие" data-am="Այլեր">Другие</th>
    </tr></thead>
    <tbody>
      <tr><td data-ru="Реальные люди" data-am="Իրական մարդիկ">Реальные люди</td><td><i class="fas fa-check-circle chk"></i> <span data-ru="Да" data-am="Այո">Да</span></td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Часто боты" data-am="Հաճախ բոտեր">Часто боты</span></td></tr>
      <tr><td data-ru="Собственный склад" data-am="Սեփական պահեստ">Собственный склад</td><td><i class="fas fa-check-circle chk"></i> <span data-ru="Ереван" data-am="Երևան">Ереван</span></td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Нет" data-am="Ոչ">Нет</span></td></tr>
      <tr><td data-ru="Блокировки" data-am="Արգելափակումներ">Блокировки</td><td><i class="fas fa-check-circle chk"></i> 0</td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Бывают" data-am="Լինում են">Бывают</span></td></tr>
      <tr><td data-ru="Фотосессия товаров" data-am="Ապրանքների լուսանկարահանում">Фотосессия товаров</td><td><i class="fas fa-check-circle chk"></i> <span data-ru="Свои модели" data-am="Սեփական մոդելներ">Свои модели</span></td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Нет" data-am="Ոչ">Нет</span></td></tr>
      <tr><td data-ru="Прозрачная отчётность" data-am="Թափանցիկ հաշվետվություն">Прозрачная отчётность</td><td><i class="fas fa-check-circle chk"></i> <span data-ru="Ежедневно" data-am="Ամենօր">Ежедневно</span></td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Раз в неделю" data-am="Շաբաթը մեկ անգամ">Раз в неделю</span></td></tr>
    </tbody>
  </table>
  </div></div>
  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success"><i class="fas fa-rocket"></i> <span data-ru="Убедитесь сами — начните сейчас" data-am="Սկսել գնումները հիմա">Начать выкупы сейчас</span></a>
  </div>
</div>
</section>

<!-- ===== IMPORTANT NOTES ===== -->
<section class="section" data-section-id="important">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-info-circle"></i> <span data-ru="Важно знать" data-am="Կարևոր է իմանալ">Важно знать</span></div>
    <h2 class="section-title" data-ru="Условия работы" data-am="Աշխատանքի պայմաններ">Условия работы</h2>
  </div>
  <div class="services-grid fade-up">
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-percent"></i></div>
      <h3 data-ru="Лимит отзывов" data-am="Կարծիքների սահմանափակում">Лимит отзывов</h3>
      <p data-ru="Публикуем отзывы не более чем на 50% выкупленных товаров — для безопасности вашего кабинета." data-am="Կարծիքներ հրապարակում ենք գնված ապրանքների ոչ ավելի քան 50%-ի վրա — ձեր հաշվի անվտանգության համար:">Публикуем отзывы не более чем на 50% выкупленных товаров — для безопасности вашего кабинета.</p>
    </div>
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-box-open"></i></div>
      <h3 data-ru="Крупногабаритный товар" data-am="Խոշոր չափսի ապրանք">Крупногабаритный товар</h3>
      <p data-ru="Товар свыше 3 кг или одна сторона длиннее 55 см. Свыше 10 кг — стоимость рассчитывается индивидуально." data-am="3 կգ-ից ավելի կամ մի կողմ 55 սմ-ից ավելի: 10 կգ-ից ավելի ապրանքների համար — արժեքը հաշվարկվում է անհատական:">Товар свыше 3 кг или одна сторона длиннее 55 см. Свыше 10 кг — стоимость рассчитывается индивидуально.</p>
    </div>
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-box"></i></div>
      <h3 data-ru="Защитные пломбы" data-am="Պաշտպանիչ կապարաններ">Защитные пломбы</h3>
      <p data-ru="Товары с защитными пломбами или заводской упаковкой после фотосессии не восстанавливаются." data-am="Պաշտպանիչ կապարաններով կամ գործարանային փաթեթավորմամբ ապրանքները լուսանկարահանումից հետո չեն վերականգնվում:">Товары с защитными пломбами или заводской упаковкой после фотосессии не восстанавливаются.</p>
    </div>
  </div>
  <div class="section-cta">
    <a href="https://t.me/suport_admin_2" target="_blank" class="btn btn-tg"><i class="fab fa-telegram"></i> <span data-ru="Уточнить условия" data-am="Գրել մենեջերին">Написать менеджеру</span></a>
  </div>
</div>
</section>

<!-- ===== CLIENT REVIEWS / REAL CASES ===== -->
<section class="section" id="client-reviews" data-section-id="client-reviews">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-star"></i> <span data-ru="Реальные кейсы" data-am="Իրական դեdelays">Реальные кейсы</span></div>
    <h2 class="section-title" data-ru="Отзывы наших клиентов" data-am="Մեர հաdelays կարdelays">Отзывы наших клиентов</h2>
    <p class="section-sub" data-ru="Результаты говорят сами за себя — вот что получают наши клиенты" data-am="Արdelays խdelays delays — delays delays">Результаты говорят сами за себя — вот что получают наши клиенты</p>
  </div>
  <div class="reviews-carousel-placeholder fade-up" id="reviewsCarouselArea" style="min-height:100px">
    <!-- Photos injected dynamically from admin panel via blockFeatures -->
    <div style="text-align:center;padding:40px 0;color:var(--text-muted,#666)">
      <i class="fas fa-images" style="font-size:2.5rem;opacity:0.3;margin-bottom:12px;display:block"></i>
      <span data-ru="Фото отзывов загружаются..." data-am="Կարdelays delaysload...">Фото отзывов загружаются...</span>
    </div>
  </div>
</div>
</section>

<!-- ===== FAQ ===== -->
<section class="section section-dark" id="faq" data-section-id="faq">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-question-circle"></i> <span data-ru="FAQ" data-am="ՀՏՀ">FAQ</span></div>
    <h2 class="section-title" data-ru="Частые вопросы" data-am="Հաճախ տրվող հարցեր">Частые вопросы</h2>
  </div>
  <div class="faq-list fade-up">
    <div class="faq-item active">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Могут ли заблокировать мой кабинет?" data-am="Կարող են արգելափակել իմ կաբինետը։">Могут ли заблокировать мой кабинет?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="За всё время нашей работы ни один кабинет клиента не получил блокировку. Мы используем реальные аккаунты с историей покупок, собственный склад и естественное распределение по географии." data-am="Մեր աշխատանքի ողջ ընթացքում ոց մի հաճախորդի կաբինետ չի արգելափակվել: Մենք օգտագործում ենք իրական հաշիվներ գնումների պատմությամբ, սեփական պահեստ և բնական աշխարհագրական բաշխում:">За всё время нашей работы ни один кабинет клиента не получил блокировку. Мы используем реальные аккаунты с историей покупок, собственный склад и естественное распределение по географии.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Как быстро начнётся продвижение?" data-am="Ինչքան արագ կսկսվի առաջխաղացումը։">Как быстро начнётся продвижение?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="В течение 24 часов после согласования стратегии и оплаты." data-am="24 ժամվա ընթացքում ստրատեգիայի համաձայնեցումից և վճարման հետո:">В течение 24 часов после согласования стратегии и оплаты.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Выкупы делают реальные люди или боты?" data-am="Գնումները կատարում են իրական մարդիկ թե։ բոտեր։">Выкупы делают реальные люди или боты?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Только реальные люди. У нас собственный склад с устройствами и реальными аккаунтами. Каждый выкуп делается вручную, никаких ботов." data-am="Միայն իրական մարդիկ: Մենք ունենք սեփական պահեստ սարքերով և իրական հաշիվներով: Եվ գնումները կատարվում են ձեռքով, ոչ մի բոտ:">Только реальные люди.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Почему не все выкупы получают отзывы?" data-am="Ինչու ոչ բոլոր գնումներն են ստանում կարծիքներ։">Почему не все выкупы получают отзывы?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Для безопасности вашего кабинета мы публикуем отзывы не более чем на 50% выкупленных товаров. Это имитирует естественное поведение покупателей." data-am="Ձեր կաբինետի անվտանգության համար կարծիքները հրապարակում ենք գնված ապրանքների ոչ ավելի քան 50%-ի համար: Սա նմանակում է գնորդների բնական վարքագիցը:">Для безопасности вашего кабинета мы публикуем отзывы не более чем на 50% выкупленных товаров.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Можно ли заказать только отзывы без выкупов?" data-am="Հնարավոր է պատվիրել միայն կարծիքներ առանց գնումների։">Можно ли заказать только отзывы без выкупов?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Да, мы можем выкупить товар для фото/видео отзыва и затем сделать возврат на ПВЗ. Стоимость уточняйте у менеджера." data-am="Այո, մենք կարող ենք գնել ապրանքը լուսանկար/տեսանյութ կարծիքի համար և հետո վերադարձնել ՊՎԶ: Արժեքը ճշտեք մենեջերի մոտ:">Да, мы можем выкупить товар для фото/видео отзыва и затем сделать возврат на ПВЗ.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Какие отчёты мы получаем?" data-am="Ինչ հաշվետվություններ ենք ստանում։">Какие отчёты мы получаем?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Ежедневные отчёты: статус каждого выкупа, даты забора, статус отзывов. Полная прозрачность на каждом этапе." data-am="Ամենօրյա հաշվետվություններ՝ յուրաքանչյուր գնումի կարգավիճակ, վերցնման ամսաթվեր, կարծիքների կարգավիճակ: Լիարժեք թափանցիկություն յուրաքանչյուր փուլում:">Ежедневные отчёты: статус каждого выкупа, даты забора, статус отзывов. Полная прозрачность на каждом этапе.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="В какой валюте идут цены?" data-am="Ինչ արժույթով են գները։">В какой валюте идут цены?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Все цены указаны в армянских драмах (֏ AMD). Оплата в драмах." data-am="Բոլոր գները նշված են հայկական դրամով (֏ AMD): Վճարումը դրամով:">Все цены указаны в армянских драмах (֏ AMD). Оплата в драмах.</p></div>
    </div>
  </div>
  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><i class="fas fa-shopping-cart"></i> <span data-ru="Остались вопросы? Напишите нам" data-am="Հարցեր ունեք։ Գրեք մեզ">Заказать сейчас</span></a>
  </div>
</div>
</section>

<!-- ===== CONTACT FORM ===== -->
<section class="section" id="contact" data-section-id="contact">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-paper-plane"></i> <span data-ru="Связаться с нами" data-am="Կապվել մեզ">Связаться с нами</span></div>
    <h2 class="section-title" data-ru="Готовы начать продвижение?" data-am="Պատրաստ եք սկսել առաջխաղացումը։">Готовы начать продвижение?</h2>
    <p class="section-sub" data-ru="Напишите нам в Telegram или оставьте заявку" data-am="Գրեք մեզ Telegram-ով կամ թողեք հայտ">Напишите нам в Telegram или оставьте заявку</p>
  </div>
  <div class="contact-grid fade-up">
    <a href="https://t.me/goo_to_top" target="_blank" class="contact-card">
      <i class="fab fa-telegram"></i>
      <h4 data-ru="Администратор" data-am="Ադմինիստրատոր">Администратор</h4>
      <p data-ru="Готов оплатить и приступить к продвижению? Пишите сюда." data-am="Պատրաստ եք վճարել և սկսել առաջխաղացումը։ Գրեք:">Готов оплатить и приступить к продвижению? Пишите сюда.</p>
    </a>
    <a href="https://t.me/suport_admin_2" target="_blank" class="contact-card">
      <i class="fab fa-telegram"></i>
      <h4 data-ru="Менеджер" data-am="Մենեջեր">Менеджер</h4>
      <p data-ru="Остались вопросы? Нужен детальный расчёт? Пишите сюда." data-am="Հարցեր ունեք։ Մանրամասն հաշվարկ է պետք։ Գրեք:">Остались вопросы? Нужен детальный расчёт? Пишите сюда.</p>
    </a>
  </div>
  <div class="form-card fade-up">
    <form id="leadForm" onsubmit="submitForm(event)">
      <div class="form-group"><label data-ru="Ваше имя" data-am="Ձեր անունը">Ваше имя</label><input type="text" id="formName" required placeholder="Имя / Անուն"></div>
      <div class="form-group"><label data-ru="Telegram / Телефон" data-am="Telegram / Հեռախոս">Telegram / Телефон</label><input type="text" id="formContact" required placeholder="@username / +374..."></div>
      <div class="form-group"><label data-ru="Что продаёте на WB?" data-am="Ինչ եք վաճառում WB-ում։">Что продаёте на WB?</label><input type="text" id="formProduct" placeholder="Одежда, электроника..."></div>
      <div class="form-group"><label data-ru="Какие услуги интересуют?" data-am="Ինչ ծառայություններ են հետաքրքրում։">Какие услуги интересуют?</label>
        <select id="formService">
          <option value="buyouts" data-ru="Выкупы" data-am="Գնումներ">Выкупы</option>
          <option value="reviews" data-ru="Отзывы" data-am="Կարծիքներ">Отзывы</option>
          <option value="photos" data-ru="Фотосессия" data-am="Լուսանկարահանում">Фотосессия</option>
          <option value="complex" data-ru="Комплекс услуг" data-am="Ծառայությունների փաթեթ" selected>Комплекс услуг</option>
        </select>
      </div>
      <div class="form-group"><label data-ru="Комментарий (необязательно)" data-am="Մեկնաբանություն (ոչ պարտադիր)">Комментарий (необязательно)</label><textarea id="formMessage" placeholder="Опишите ваш товар..."></textarea></div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center">
        <i class="fab fa-telegram"></i>
        <span data-ru="Отправить заявку" data-am="Ուղարկել հայտը">Отправить заявку</span>
      </button>
    </form>
  </div>
</div>
</section>

<!-- ===== FOOTER ===== -->
<footer class="footer">
<div class="container">
  <div class="footer-grid">
    <div class="footer-brand">
      <div class="logo"><img src="/static/img/logo-gototop.png" alt="Go to Top" style="height:44px"><span class="logo-text">Go to Top</span></div>
      <p data-ru="Безопасное продвижение товаров на Wildberries в Армении. Реальные выкупы живыми людьми с собственного склада в Ереване." data-am="Ապահով ապրանքների առաջխաղացում Wildberries-ում Հայաստանում: Իրական գնումներ իրական մարդկանցով սեփական պահեստից Երևանում:">Безопасное продвижение товаров на Wildberries в Армении. Реальные выкупы живыми людьми с собственного склада в Ереване.</p>
    </div>
    <div class="footer-col">
      <h4 data-ru="Навигация" data-am="Նավիգացիա">Навигация</h4>
      <ul>
        <li><a href="#services" data-ru="Услуги и цены" data-am="Ծառայություններ և գներ">Услуги и цены</a></li>
        <li><a href="#calculator" data-ru="Калькулятор" data-am="Հաշվիչ">Калькулятор</a></li>
        <li><a href="#warehouse" data-ru="Наш склад" data-am="Մեր պահեստը">Наш склад</a></li>
        <li><a href="#guarantee" data-ru="Гарантии" data-am="Երաշխիքներ">Гарантии</a></li>
        <li><a href="#faq" data-ru="FAQ" data-am="ՀՏՀ">FAQ</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4 data-ru="Контакты" data-am="Կոնտակտներ">Контакты</h4>
      <ul>
        <li><a href="https://t.me/goo_to_top" target="_blank"><i class="fab fa-telegram"></i> <span data-ru="Администратор" data-am="Ադմինիստրատոր">Администратор</span></a></li>
        <li><a href="https://t.me/suport_admin_2" target="_blank"><i class="fab fa-telegram"></i> <span data-ru="Менеджер" data-am="Մենեջեր">Менеджер</span></a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Go to Top. <span data-ru="Все права защищены" data-am="Բոլոր իրավունքները պաշտպանված են">Все права защищены</span></span>
    <span data-ru="Ереван, Армения" data-am="Երևան, Հայաստան">Ереван, Армения</span>
  </div>
</div>
</footer>

<!-- FLOATING TG BUTTON -->
<a href="https://t.me/goo_to_top" target="_blank" class="tg-float">
  <i class="fab fa-telegram"></i>
  <span data-ru="Написать нам" data-am="Գրել մեզ">Написать нам</span>
</a>

<!-- FLOATING CALC BUTTON -->
<a href="#calculator" class="calc-float" id="calcFloatBtn">
  <i class="fas fa-calculator"></i>
  <span data-ru="Калькулятор" data-am="Հաշվիչ">Հաշվիչ</span>
</a>

<!-- LIGHTBOX -->
<div class="lightbox" id="lightbox" onclick="closeLightbox()">
  <img id="lightboxImg" src="" alt="">
</div>

<!-- ===== POPUP (5 sec) ===== -->
<div class="popup-overlay" id="popupOverlay">
  <div class="popup-card">
    <button class="popup-close" id="popupCloseBtn">✕</button>
    <div id="popupFormWrap">
      <div class="popup-icon"><i class="fas fa-chart-line"></i></div>
      <h3 data-ru="Повысь рейтинг магазина прямо сейчас!" data-am="Բարձրացրեք խանութի վարկանիշը հիմա!">Повысь рейтинг магазина прямо сейчас!</h3>
      <p class="popup-sub" data-ru="Выкупы живыми людьми, отзывы с фото, профессиональные фотосессии. Узнайте сколько это стоит!" data-am="Անձնական մենեջերը կկապվի ձեզ և կպատրաստի անհատական հաշվարկ">Персональный менеджер свяжется с вами и подготовит индивидуальный расчёт</p>
      <form id="popupForm">
        <div class="pf-row">
          <div class="pf-group">
            <label class="pf-label" data-ru="Сколько выкупов нужно?" data-am="Քանի գնում է պետք։">Сколько выкупов нужно?</label>
            <input class="pf-input" type="number" id="popupBuyouts" min="0" placeholder="Напр: 20" required>
          </div>
          <div class="pf-group">
            <label class="pf-label" data-ru="Сколько отзывов нужно?" data-am="Քանի կարծիք է պետք։">Сколько отзывов нужно?</label>
            <input class="pf-input" type="number" id="popupReviews" min="0" placeholder="Напр: 10" required>
          </div>
        </div>
        <div class="pf-group">
          <label class="pf-label" data-ru="Ваш Telegram или телефон" data-am="Ձեր Telegram-ը կամ հեռախոսը">Ваш Telegram или телефон</label>
          <input class="pf-input" type="text" id="popupContact" required placeholder="@username или +374...">
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:12px">
          <i class="fab fa-telegram"></i>
          <span data-ru="Получить расчёт в Telegram" data-am="Ստանալ հաշվարկ Telegram-ով">Получить расчёт в Telegram</span>
        </button>
      </form>
    </div>
    <div class="popup-success" id="popupSuccess">
      <i class="fas fa-check-circle"></i>
      <h4 data-ru="Заявка отправлена!" data-am="Հայտը ուղարկված է!">Заявка отправлена!</h4>
      <p data-ru="Менеджер свяжется с вами в ближайшее время" data-am="Մենեջերը կկապվի ձեզ մոտակա ժամանակից">Менеджер свяжется с вами в ближайшее время</p>
    </div>
  </div>
</div>

<script>
/* ===== LANGUAGE ===== */
let lang = localStorage.getItem('gtt_lang') || 'am';
const AM = {
  "Услуги":"Ծառայություններ",
  "Калькулятор":"Հաշվիչ",
  "Склад":"Պահեստ",
  "Гарантии":"Երաշխիքներ",
  "FAQ":"ՀՏՀ",
  "Контакты":"Կոնտակտներ",
  "Написать нам":"Գրել մեզ",
  "Работаем в Армении":"Աշխատում ենք Հայաստանում",
  "Выведем ваш товар":"Մենք կբարձրացնենք ձեր ապրանքը",
  "в ТОП Wildberries":"Wildberries-ի TOP",
  "Рассчитать стоимость":"Հաշվել արժեքը"
};
function switchLang(l) {
  lang = l;
  localStorage.setItem('gtt_lang', l);
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === l));
  document.querySelectorAll('[data-' + l + ']').forEach(el => {
    const t = el.getAttribute('data-' + l);
    if (t && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') el.textContent = t;
  });
  document.documentElement.lang = l === 'am' ? 'hy' : 'ru';
}

/* ===== INIT: apply default language on load ===== */
(function initLang() {
  switchLang(lang);
})();

/* ===== HEADER SCROLL ===== */
window.addEventListener('scroll', () => {
  document.getElementById('header').classList.toggle('scrolled', window.scrollY > 50);
});

/* ===== MOBILE MENU ===== */
function toggleMenu() {
  var nav = document.getElementById('navLinks');
  var ham = document.getElementById('hamburger');
  var isOpen = nav.classList.contains('active');
  if (isOpen) {
    nav.classList.remove('active');
    ham.classList.remove('active');
    document.body.style.overflow = '';
  } else {
    nav.classList.add('active');
    ham.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeMenu() {
  document.getElementById('navLinks').classList.remove('active');
  document.getElementById('hamburger').classList.remove('active');
  document.body.style.overflow = '';
}

document.querySelectorAll('.nav-links a').forEach(function(a) {
  a.addEventListener('click', function(e) {
    e.preventDefault();
    closeMenu();
    var href = this.getAttribute('href');
    if (href && href.startsWith('#')) {
      var target = document.querySelector(href);
      if (target) {
        setTimeout(function() {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  });
});

/* Close menu when tapping outside nav links (on overlay area) */
document.getElementById('navLinks').addEventListener('click', function(e) {
  if (e.target === this) closeMenu();
});

/* ===== TICKER ===== */
(function() {
  const items = [
    {icon:"fa-check-circle", ru:"Реальные люди, не боты", am:"Իրական մարդիկ, ոչ բոտեր"},
    {icon:"fa-shield-alt", ru:"0 блокировок за всё время", am:"0 արգելափակում ողջ ընթացքում"},
    {icon:"fa-warehouse", ru:"Собственный склад в Ереване", am:"Սեփական պահեստ Երևանում"},
    {icon:"fa-mobile-alt", ru:"1000+ аккаунтов", am:"1000+ հաշիվներ"},
    {icon:"fa-map-marker-alt", ru:"Ереван, Армения", am:"Երևան, Հայաստան"},
    {icon:"fa-star", ru:"Профессиональные фото для отзывов", am:"Մասնագիտական լուսանկարներ կարծիքների համար"},
    {icon:"fa-camera", ru:"Фотосессии с моделями", am:"Լուսանկարահանումներ մոդելներով"},
    {icon:"fa-truck", ru:"Доставка на склады WB", am:"Առաքում WB պահեստներ"}
  ];
  const track = document.getElementById("tickerTrack");
  let h = "";
  for (let i = 0; i < 2; i++) {
    items.forEach(it => {
      h += '<div class="ticker-item"><i class="fas ' + it.icon + '"></i><span data-ru="' + it.ru + '" data-am="' + it.am + '">' + it.ru + '</span></div>';
    });
  }
  track.innerHTML = h;
})();

/* ===== CALCULATOR ===== */
function showCalcTab(id, el) {
  document.querySelectorAll('.calc-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.calc-group').forEach(g => g.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('cg-' + id).classList.add('active');
}
function getBuyoutPrice(qty) {
  if (qty <= 0) return 0;
  if (qty <= 20) return 2000;
  if (qty <= 40) return 1700;
  if (qty <= 60) return 1500;
  return 1250;
}
function getBuyoutTotal(qty) {
  if (qty <= 0) return 0;
  if (qty <= 20) return qty * 2000;
  if (qty <= 40) return 20 * 2000 + (qty - 20) * 1700;
  if (qty <= 60) return 20 * 2000 + 20 * 1700 + (qty - 40) * 1500;
  return 20 * 2000 + 20 * 1700 + 20 * 1500 + (qty - 60) * 1250;
}
function ccBuyout(delta) {
  const inp = document.getElementById('buyoutQty');
  let v = parseInt(inp.value || 0) + delta;
  if (v < 0) v = 0; if (v > 999) v = 999;
  inp.value = v;
  const price = getBuyoutPrice(v);
  document.getElementById('buyoutPriceLabel').textContent = v > 0 ? formatNum(price) + ' ֏/шт' : '2 000 ֏';
  recalc();
}
function onBuyoutInput() {
  const inp = document.getElementById('buyoutQty');
  let v = parseInt(inp.value || 0);
  if (isNaN(v) || v < 0) v = 0; if (v > 999) v = 999;
  inp.value = v;
  const price = getBuyoutPrice(v);
  document.getElementById('buyoutPriceLabel').textContent = v > 0 ? formatNum(price) + ' ֏/шт' : '2 000 ֏';
  recalc();
}
function cc(btn, delta) {
  const row = btn.closest('.calc-row');
  const inp = row.querySelector('.calc-input input');
  let v = parseInt(inp.value || 0) + delta;
  if (v < 0) v = 0; if (v > 999) v = 999;
  inp.value = v;
  recalc();
}
function recalc() {
  let total = 0; const items = [];
  const buyoutQty = parseInt(document.getElementById('buyoutQty').value || 0);
  if (buyoutQty > 0) { total += getBuyoutTotal(buyoutQty); items.push('Выкуп + забор: ' + buyoutQty + ' шт (' + getBuyoutPrice(buyoutQty) + ' ֏/шт)'); }
  document.querySelectorAll('.calc-row:not(#buyoutRow)').forEach(row => {
    const price = parseInt(row.dataset.price);
    const inp = row.querySelector('.calc-input input');
    const qty = parseInt(inp ? inp.value : 0);
    if (!isNaN(price) && qty > 0) { total += price * qty; items.push(row.querySelector('.calc-label').textContent + ': ' + qty); }
  });
  document.getElementById('calcTotal').textContent = total.toLocaleString('ru-RU') + ' ֏';
  const msg = 'Здравствуйте! Хочу заказать:\\n' + items.join('\\n') + '\\n\\nИтого: ' + total.toLocaleString('ru-RU') + ' ֏';
  document.getElementById('calcTgBtn').href = 'https://t.me/goo_to_top?text=' + encodeURIComponent(msg);
}

/* ===== FAQ ===== */
function toggleFaq(el) {
  const item = el.closest('.faq-item');
  const was = item.classList.contains('active');
  document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
  if (!was) item.classList.add('active');
}

/* ===== LIGHTBOX ===== */
function openLightbox(el) { document.getElementById('lightboxImg').src = el.querySelector('img').src; document.getElementById('lightbox').classList.add('show'); }
function closeLightbox() { document.getElementById('lightbox').classList.remove('show'); }

/* ===== TIMED POPUP (5 sec) — BULLETPROOF ===== */
var popupDismissed = false;

function showPopup() {
  if (popupDismissed) return;
  if (sessionStorage.getItem('popupDone')) return;
  var ov = document.getElementById('popupOverlay');
  if (!ov) return;
  var isMobile = window.innerWidth <= 640;
  /* Force visibility — mobile: slide-up from bottom; desktop: centered */
  ov.setAttribute('style',
    'display:flex!important;visibility:visible!important;opacity:1!important;' +
    'position:fixed;top:0;left:0;width:100vw;height:100vh;height:100dvh;' +
    'background:rgba(0,0,0,0.85);z-index:100000;overflow-y:auto;' +
    (isMobile
      ? 'justify-content:center;align-items:flex-end;padding:0;'
      : 'justify-content:center;align-items:center;padding:20px;')
  );
  ov.classList.add('show');
  var card = ov.querySelector('.popup-card');
  if (card) {
    card.style.opacity = '1';
    card.style.visibility = 'visible';
    card.style.display = 'block';
    if (isMobile) {
      card.style.cssText += 'max-width:100%;width:100%;margin:0;border-radius:20px 20px 0 0;max-height:90vh;max-height:90dvh;overflow-y:auto;padding:28px 16px;animation:slideUpMobile 0.4s ease forwards;';
    } else {
      card.style.transform = 'scale(1) translateY(0)';
    }
  }
  document.body.style.overflow = 'hidden';
  console.log('[Popup] Shown on ' + (isMobile ? 'mobile' : 'desktop') + ', w=' + window.innerWidth);
}

function hidePopup() {
  popupDismissed = true;
  var ov = document.getElementById('popupOverlay');
  if (ov) {
    ov.classList.remove('show');
    ov.setAttribute('style','display:none!important;visibility:hidden!important;opacity:0!important;');
  }
  document.body.style.overflow = '';
  sessionStorage.setItem('popupDone', '1');
}

/* Close button */
var _closeBtn = document.getElementById('popupCloseBtn');
if (_closeBtn) {
  _closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    hidePopup();
  });
}

/* Click overlay to close */
var _popupOv = document.getElementById('popupOverlay');
if (_popupOv) {
  _popupOv.addEventListener('click', function(e) {
    if (e.target === _popupOv) hidePopup();
  });
}

/* Show after 5 seconds — guaranteed */
setTimeout(showPopup, 5000);
console.log('[Popup] Timer set, will fire in 5s');

/* Form submit */
document.getElementById('popupForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var buyouts = document.getElementById('popupBuyouts').value;
  var reviews = document.getElementById('popupReviews').value;
  var contact = document.getElementById('popupContact').value;
  fetch('/api/popup-lead', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({buyouts:buyouts, reviews:reviews, contact:contact, lang:lang, ts: new Date().toISOString()})
  }).catch(function(){});
  var msg = lang === 'am' 
    ? 'Հայտ Go to Top կայքից:\\n\\nԳնումներ: ' + buyouts + '\\nԿարծիքներ: ' + reviews + '\\nԿապ: ' + contact
    : 'Заявка с сайта Go to Top:\\n\\nВыкупов: ' + buyouts + '\\nОтзывов: ' + reviews + '\\nКонтакт: ' + contact;
  var popupTgUrl = window._tgPopupUrl || 'https://t.me/suport_admin_2';
  window.open(popupTgUrl + '?text=' + encodeURIComponent(msg), '_blank');
  document.getElementById('popupFormWrap').style.display = 'none';
  document.getElementById('popupSuccess').style.display = 'block';
  setTimeout(hidePopup, 3000);
});

/* ===== FORM SUBMIT ===== */
function submitForm(e) {
  e.preventDefault();
  var name = document.getElementById('formName').value;
  var contact = document.getElementById('formContact').value;
  var product = document.getElementById('formProduct').value;
  var service = document.getElementById('formService');
  var serviceText = service.options[service.selectedIndex].textContent;
  var message = document.getElementById('formMessage').value;
  var msg = '';
  if (lang === 'am') {
    msg = 'Ողջույն! Հայտ Go to Top կայքից:\\n\\n';
    msg += 'Անուն: ' + name + '\\nԿապ: ' + contact + '\\n';
    if (product) msg += 'Ապրանք: ' + product + '\\n';
    msg += 'Ծառայություն: ' + serviceText + '\\n';
    if (message) msg += 'Մեկնաբանություն: ' + message;
  } else {
    msg = 'Здравствуйте! Заявка с сайта Go to Top:\\n\\n';
    msg += 'Имя: ' + name + '\\nКонтакт: ' + contact + '\\n';
    if (product) msg += 'Товар: ' + product + '\\n';
    msg += 'Услуга: ' + serviceText + '\\n';
    if (message) msg += 'Комментарий: ' + message;
  }
  fetch('/api/lead', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name:name, contact:contact, product:product, service: service.value, message:message, lang:lang, ts: new Date().toISOString()}) }).catch(function(){});
  var tgUrl = window._tgContactUrl || 'https://t.me/suport_admin_2';
  window.open(tgUrl + '?text=' + encodeURIComponent(msg), '_blank');
  var btn = e.target.querySelector('button[type=submit]');
  var orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-check"></i> Отправлено!';
  btn.style.background = 'var(--success)';
  setTimeout(function() { btn.innerHTML = orig; btn.style.background = ''; }, 3000);
  e.target.reset();
}

/* ===== SCROLL ANIMATIONS ===== */
var obs = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) { if (entry.isIntersecting) { entry.target.classList.add('visible'); obs.unobserve(entry.target); } });
}, {threshold:0.1, rootMargin:'0px 0px -50px 0px'});
document.querySelectorAll('.fade-up').forEach(function(el) { obs.observe(el); });

/* ===== COUNTER ANIMATION ===== */
var cObs = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      var el = entry.target;
      var target = parseInt(el.dataset.count);
      var dur = 2000; var start = performance.now();
      function anim(now) {
        var p = Math.min((now - start) / dur, 1);
        el.textContent = Math.floor(target * (1 - Math.pow(1 - p, 3))).toLocaleString('ru-RU');
        if (p < 1) requestAnimationFrame(anim);
        else el.textContent = target === 0 ? '0' : target.toLocaleString('ru-RU');
      }
      requestAnimationFrame(anim); cObs.unobserve(el);
    }
  });
}, {threshold:0.5});
document.querySelectorAll('.stat-num[data-count]').forEach(function(el) { cObs.observe(el); });

/* Stats bar counter animation */
var sObs = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      var el = entry.target;
      var target = parseInt(el.dataset.countS) || 0;
      if (isNaN(target) || target === 0) { sObs.unobserve(el); return; }
      var dur = 2000; var start = performance.now();
      function animS(now) {
        var p = Math.min((now - start) / dur, 1);
        var val = Math.floor(target * (1 - Math.pow(1 - p, 3)));
        el.textContent = val.toLocaleString('ru-RU') + (el.textContent.includes('+') ? '+' : '');
        if (p < 1) requestAnimationFrame(animS);
        else el.textContent = target.toLocaleString('ru-RU') + (target > 100 ? '+' : '');
      }
      requestAnimationFrame(animS); sObs.unobserve(el);
    }
  });
}, {threshold:0.5});
document.querySelectorAll('.stat-big[data-count-s]').forEach(function(el) { sObs.observe(el); });

/* ===== SMOOTH SCROLL ===== */
document.querySelectorAll('a[href^="#"]').forEach(function(a) {
  a.addEventListener('click', function(e) {
    var href = a.getAttribute('href');
    if (href === '#') return;
    var t = document.querySelector(href);
    if (t) { e.preventDefault(); window.scrollTo({top: t.offsetTop - 80, behavior:'smooth'}); }
  });
});

console.log('Go to Top — site loaded v6 - CTA buttons + team photo moved');

/* ===== DYNAMIC DATA FROM D1 DATABASE v2 ===== */
// Helper functions
function escCalc(s) { return s ? String(s).replace(/'/g, "&#39;").replace(/"/g, '&quot;') : ''; }
function formatNum(n) { return Number(n).toLocaleString('ru-RU'); }

function getTierPrice(tiers, qty) {
  if (qty <= 0) return 0;
  for (var i = 0; i < tiers.length; i++) {
    if (qty >= tiers[i].min && qty <= tiers[i].max) return tiers[i].price;
  }
  return tiers[tiers.length - 1].price;
}

function getTierTotal(tiers, qty) {
  if (qty <= 0) return 0;
  var total = 0, remaining = qty;
  for (var i = 0; i < tiers.length && remaining > 0; i++) {
    var tierRange = tiers[i].max >= 999 ? remaining : (tiers[i].max - tiers[i].min + 1);
    var inTier = Math.min(remaining, tierRange);
    total += inTier * tiers[i].price;
    remaining -= inTier;
  }
  return total;
}

function ccTiered(svcId, delta) {
  var inp = document.getElementById('qty_' + svcId);
  var v = parseInt(inp.value || 0) + delta;
  if (v < 0) v = 0; if (v > 999) v = 999;
  inp.value = v;
  var row = document.getElementById('row_' + svcId);
  try {
    var tiers = JSON.parse(row.getAttribute('data-tiers'));
    var price = getTierPrice(tiers, v);
    document.getElementById('price_' + svcId).textContent = v > 0 ? formatNum(price) + ' ֏/шт' : formatNum(tiers[0].price) + ' ֏';
  } catch(e) {}
  recalcDynamic();
}

function onTieredInput(svcId) {
  var inp = document.getElementById('qty_' + svcId);
  var v = parseInt(inp.value || 0);
  if (isNaN(v) || v < 0) v = 0; if (v > 999) v = 999;
  inp.value = v;
  ccTiered(svcId, 0);
}

function recalcDynamic() {
  var total = 0, items = [];
  // ALL calc groups (not just active) — collect from all
  document.querySelectorAll('.calc-row[data-price="tiered"]').forEach(function(row) {
    var inp = row.querySelector('.calc-input input');
    var qty = parseInt(inp ? inp.value : 0);
    if (qty > 0) {
      try {
        var tiers = JSON.parse(row.getAttribute('data-tiers'));
        total += getTierTotal(tiers, qty);
        var label = row.querySelector('.calc-label');
        var labelText = label ? label.textContent : '';
        var pcsWord = lang === 'am' ? 'հատ' : 'шт';
        items.push(labelText + ': ' + qty + ' ' + pcsWord + ' (' + formatNum(getTierPrice(tiers, qty)) + ' ֏/' + pcsWord + ')');
      } catch(e) {}
    }
  });
  document.querySelectorAll('.calc-row:not([data-price="tiered"])').forEach(function(row) {
    var price = parseInt(row.getAttribute('data-price'));
    var inp = row.querySelector('.calc-input input');
    var qty = parseInt(inp ? inp.value : 0);
    if (!isNaN(price) && qty > 0) {
      total += price * qty;
      var label = row.querySelector('.calc-label');
      var labelText = label ? label.textContent : '';
      items.push(labelText + ': ' + qty);
    }
  });
  // Apply referral discount
  var discountAmount = 0;
  if (typeof _refDiscount !== 'undefined' && _refDiscount > 0 && total > 0) {
    discountAmount = Math.round(total * _refDiscount / 100);
    total = total - discountAmount;
  }
  document.getElementById('calcTotal').textContent = formatNum(total) + ' ֏';
  var tgUrl = (window._tgData && window._tgData.calc_order_msg && window._tgData.calc_order_msg.telegram_url) || 'https://t.me/goo_to_top';
  var greeting = lang === 'am' ? 'Ողջույն! Ուզում եմ պատվիրել:' : 'Здравствуйте! Хочу заказать:';
  var totalLabel = lang === 'am' ? 'Ընդամենը:' : 'Итого:';
  var msg = greeting + '\\n' + items.join('\\n');
  if (discountAmount > 0) {
    var refCode = document.getElementById('refCodeInput') ? document.getElementById('refCodeInput').value : '';
    msg += '\\n\\n' + (lang === 'am' ? 'Պրոմոկոդ: ' : 'Промокод: ') + refCode + ' (-' + _refDiscount + '%, -' + formatNum(discountAmount) + ' ֏)';
  }
  if (typeof _refFreeReviews !== 'undefined' && _refFreeReviews > 0) {
    msg += '\\n' + (lang === 'am' ? 'Անվճար կարծիքներ: ' : 'Бесплатных отзывов: ') + _refFreeReviews;
  }
  msg += '\\n\\n' + totalLabel + ' ' + formatNum(total) + ' ֏';
  var isWaCalc = tgUrl.includes('wa.me') || tgUrl.includes('whatsapp');
  var calcBtn = document.getElementById('calcTgBtn');
  if (isWaCalc) {
    calcBtn.href = tgUrl + (tgUrl.includes('?') ? '&text=' : '?text=') + encodeURIComponent(msg);
  } else {
    calcBtn.href = tgUrl + '?text=' + encodeURIComponent(msg);
  }
  var calcIcon = calcBtn.querySelector('i.fab');
  if (calcIcon) calcIcon.className = isWaCalc ? 'fab fa-whatsapp' : 'fab fa-telegram';
}

// Override recalc
var _origRecalc = recalc;
recalc = function() { if (window._calcServices) recalcDynamic(); else _origRecalc(); };

// Update all messenger links (Telegram/WhatsApp) to match current language
function updateMessengerIcon(a, url) {
  // Update icon to match messenger type
  var icon = a.querySelector('i.fab');
  if (icon) {
    var isWa = url && (url.includes('wa.me') || url.includes('whatsapp'));
    icon.className = isWa ? 'fab fa-whatsapp' : 'fab fa-telegram';
  }
}
function updateTelegramLinks() {
  if (!window._tgData) return;
  var tgByLabel = {};
  for (var tgKey in window._tgData) {
    var tgMsg = window._tgData[tgKey];
    if (tgMsg && tgMsg.button_label_ru) {
      tgByLabel[tgMsg.button_label_ru.trim()] = tgMsg;
      if (tgMsg.button_label_am) tgByLabel[tgMsg.button_label_am.trim()] = tgMsg;
    }
  }
  // Match all links with t.me/ or wa.me/ or whatsapp
  document.querySelectorAll('a[href*="t.me/"], a[href*="wa.me/"], a[href*="whatsapp"]').forEach(function(a) {
    if (a.id === 'calcTgBtn') return;
    var spanWithDataRu = a.querySelector('span[data-ru]');
    var buttonText = null;
    if (spanWithDataRu) { buttonText = spanWithDataRu.getAttribute('data-ru'); }
    if (!buttonText && a.hasAttribute('data-ru')) { buttonText = a.getAttribute('data-ru'); }
    if (!buttonText) { var h4 = a.querySelector('h4[data-ru]'); if (h4) buttonText = h4.getAttribute('data-ru'); }
    if (!buttonText) return;
    buttonText = buttonText.trim();
    var tgMsg = tgByLabel[buttonText];
    if (!tgMsg) return;
    var msgTemplate = (lang === 'am' && tgMsg.message_template_am) ? tgMsg.message_template_am : tgMsg.message_template_ru;
    var mUrl = tgMsg.telegram_url || 'https://t.me/goo_to_top';
    var isWa = mUrl.includes('wa.me') || mUrl.includes('whatsapp');
    if (msgTemplate) {
      if (isWa) {
        a.href = mUrl + (mUrl.includes('?') ? '&text=' : '?text=') + encodeURIComponent(msgTemplate);
      } else {
        a.href = mUrl + '?text=' + encodeURIComponent(msgTemplate);
      }
    } else {
      a.href = mUrl;
    }
    updateMessengerIcon(a, mUrl);
  });
  // Update calc button
  if (typeof recalcDynamic === 'function') recalcDynamic();
}

// Override switchLang to always use latest data-ru/data-am and update Telegram links
switchLang = function(l) {
  lang = l;
  document.querySelectorAll('.lang-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.lang === l); });
  document.querySelectorAll('[data-' + l + ']').forEach(function(el) {
    var t = el.getAttribute('data-' + l);
    if (t && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') el.textContent = t;
  });
  document.documentElement.lang = l === 'am' ? 'hy' : 'ru';
  // Re-apply Telegram links with correct language message templates
  updateTelegramLinks();
};

(async function loadSiteData() {
  try {
    var res = await fetch('/api/site-data?_=' + Date.now());
    if (!res.ok) { console.log('[DB] API unavailable'); return; }
    var db = await res.json();
    
    var hasContent = db.textMap && Object.keys(db.textMap).length > 0;
    var hasCalc = db.tabs && db.tabs.length && db.services && db.services.length;
    var hasTg = db.telegram && Object.keys(db.telegram).length > 0;
    
    console.log('[DB] Loaded data. Changed texts:', Object.keys(db.textMap || {}).length, ', services:', (db.services || []).length);
    
    // ===== 1. APPLY CHANGED TEXTS =====
    // textMap: { original_ru: {ru, am} } — only for CHANGED texts
    if (hasContent) {
      document.querySelectorAll('[data-ru]').forEach(function(el) {
        var origRu = el.getAttribute('data-ru');
        if (!origRu) return;
        var changed = db.textMap[origRu.trim()];
        if (changed) {
          // Update data attributes with new values
          el.setAttribute('data-ru', changed.ru);
          el.setAttribute('data-am', changed.am);
          // Update visible text
          var t = el.getAttribute('data-' + lang);
          if (t && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') el.textContent = t;
        }
      });
      console.log('[DB] Texts applied');
    }
    
    // ===== 2. REBUILD CALCULATOR FROM DB =====
    if (hasCalc) {
      var calcWrap = document.querySelector('.calc-wrap');
      if (calcWrap) {
        window._calcServices = db.services;
        window._calcTabs = db.tabs;
        
        var tabsDiv = calcWrap.querySelector('.calc-tabs');
        if (tabsDiv) {
          var th = '';
          db.tabs.forEach(function(tab, idx) {
            th += '<div class="calc-tab' + (idx === 0 ? ' active' : '') + '" onclick="showCalcTab(&apos;'+tab.tab_key+'&apos;,this)" data-ru="'+escCalc(tab.name_ru)+'" data-am="'+escCalc(tab.name_am)+'">' + (lang === 'am' ? tab.name_am : tab.name_ru) + '</div>';
          });
          tabsDiv.innerHTML = th;
        }
        
        calcWrap.querySelectorAll('.calc-group').forEach(function(g) { g.remove(); });
        calcWrap.querySelectorAll('.buyout-tier-info').forEach(function(g) { g.remove(); });
        
        var calcTotal = calcWrap.querySelector('.calc-total');
        var byTab = {};
        db.services.forEach(function(svc) {
          if (!byTab[svc.tab_key]) byTab[svc.tab_key] = [];
          byTab[svc.tab_key].push(svc);
        });
        
        db.tabs.forEach(function(tab, tabIdx) {
          var group = document.createElement('div');
          group.className = 'calc-group' + (tabIdx === 0 ? ' active' : '');
          group.id = 'cg-' + tab.tab_key;
          var svcs = byTab[tab.tab_key] || [];
          var gh = '';
          
          svcs.forEach(function(svc) {
            var hasTiers = svc.price_type === 'tiered' && svc.price_tiers_json;
            var tiers = null;
            if (hasTiers) { try { tiers = JSON.parse(svc.price_tiers_json); } catch(e) { tiers = null; hasTiers = false; } }
            
            if (hasTiers && tiers && tiers.length > 0) {
              var svcId = 'tiered_' + svc.id;
              var tiersAttr = svc.price_tiers_json.replace(/'/g, '&#39;');
              gh += '<div class="calc-row" data-price="tiered" data-tiers="'+tiersAttr+'" id="row_'+svcId+'">';
              gh += '<div class="calc-label" data-ru="'+escCalc(svc.name_ru)+'" data-am="'+escCalc(svc.name_am)+'">' + (lang==='am' ? svc.name_am : svc.name_ru) + '</div>';
              gh += '<div class="calc-price" id="price_'+svcId+'">'+formatNum(tiers[0].price)+' ֏</div>';
              gh += '<div class="calc-input"><button onclick="ccTiered(&apos;'+svcId+'&apos;,-1)">−</button><input type="number" id="qty_'+svcId+'" value="0" min="0" max="999" onchange="onTieredInput(&apos;'+svcId+'&apos;)"><button onclick="ccTiered(&apos;'+svcId+'&apos;,1)">+</button></div>';
              gh += '</div>';
              gh += '<div class="buyout-tier-info"><strong>'+( lang==='am' ? 'Որքան շատ — այնքան էժան:' : 'Чем больше — тем дешевле:')+'</strong><br>';
              gh += '<span>' + tiers.map(function(t) { 
                var range = t.max >= 999 ? t.min+'+' : t.min+'-'+t.max;
                return range + ' → ' + formatNum(t.price) + ' ֏'; 
              }).join(' &nbsp;|&nbsp; ') + '</span></div>';
            } else {
              gh += '<div class="calc-row" data-price="'+svc.price+'">';
              gh += '<div class="calc-label" data-ru="'+escCalc(svc.name_ru)+'" data-am="'+escCalc(svc.name_am)+'">'+(lang==='am' ? svc.name_am : svc.name_ru)+'</div>';
              gh += '<div class="calc-price">'+formatNum(svc.price)+' ֏</div>';
              gh += '<div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalcDynamic()" oninput="recalcDynamic()"><button onclick="cc(this,1)">+</button></div>';
              gh += '</div>';
            }
          });
          group.innerHTML = gh;
          calcTotal.parentNode.insertBefore(group, calcTotal);
        });
        console.log('[DB] Calculator rebuilt:', db.services.length, 'services,', db.tabs.length, 'tabs');
      }
    }
    
    // ===== 3. APPLY TELEGRAM LINKS DYNAMICALLY =====
    if (hasTg) {
      window._tgData = db.telegram;
      
      // Build a lookup: button_label_ru -> telegram message data
      var tgByLabel = {};
      for (var tgKey in db.telegram) {
        var tgMsg = db.telegram[tgKey];
        if (tgMsg && tgMsg.button_label_ru) {
          tgByLabel[tgMsg.button_label_ru.trim()] = tgMsg;
        }
      }
      
      // Find all <a> tags pointing to t.me/ or wa.me/ and update their href with message template
      document.querySelectorAll('a[href*="t.me/"], a[href*="wa.me/"], a[href*="whatsapp"]').forEach(function(a) {
        if (a.id === 'calcTgBtn') return;
        var spanWithDataRu = a.querySelector('span[data-ru]');
        var buttonText = spanWithDataRu ? spanWithDataRu.getAttribute('data-ru') : null;
        if (!buttonText && a.hasAttribute('data-ru')) { buttonText = a.getAttribute('data-ru'); }
        if (!buttonText) { var h4 = a.querySelector('h4[data-ru]'); if (h4) buttonText = h4.getAttribute('data-ru'); }
        if (!buttonText) return;
        buttonText = buttonText.trim();
        var tgMsg = tgByLabel[buttonText];
        if (!tgMsg) return;
        var msgTemplate = (lang === 'am' && tgMsg.message_template_am) ? tgMsg.message_template_am : tgMsg.message_template_ru;
        var mUrl = tgMsg.telegram_url || 'https://t.me/goo_to_top';
        var isWa = mUrl.includes('wa.me') || mUrl.includes('whatsapp');
        if (msgTemplate) {
          a.href = isWa ? (mUrl + (mUrl.includes('?') ? '&text=' : '?text=') + encodeURIComponent(msgTemplate)) : (mUrl + '?text=' + encodeURIComponent(msgTemplate));
        } else {
          a.href = mUrl;
        }
        updateMessengerIcon(a, mUrl);
        if (spanWithDataRu) {
          var newLabelRu = tgMsg.button_label_ru;
          var newLabelAm = tgMsg.button_label_am;
          if (newLabelRu) spanWithDataRu.setAttribute('data-ru', newLabelRu);
          if (newLabelAm) spanWithDataRu.setAttribute('data-am', newLabelAm);
          var currentLangText = spanWithDataRu.getAttribute('data-' + lang);
          if (currentLangText && spanWithDataRu.tagName !== 'INPUT') spanWithDataRu.textContent = currentLangText;
        }
      });
      
      // Also update the contact form submit handler & popup form to use DB telegram URLs
      if (db.telegram.contact_form_msg) {
        window._tgContactUrl = db.telegram.contact_form_msg.telegram_url || 'https://t.me/suport_admin_2';
        window._tgContactTemplate = db.telegram.contact_form_msg.message_template_ru || '';
      }
      if (db.telegram.popup_form_msg) {
        window._tgPopupUrl = db.telegram.popup_form_msg.telegram_url || 'https://t.me/suport_admin_2';
        window._tgPopupTemplate = db.telegram.popup_form_msg.message_template_ru || '';
      }
      
      console.log('[DB] Telegram data loaded and applied:', Object.keys(db.telegram).length, 'messages');
    }
    
    // ===== 3b. TRACK BUTTON CLICKS -> AUTO-CREATE LEAD =====
    document.querySelectorAll('a[href*="t.me/"], a[href*="wa.me/"], a.btn-primary, a.cta-btn').forEach(function(a) {
      if (a.dataset._trackAttached) return;
      a.dataset._trackAttached = '1';
      a.addEventListener('click', function() {
        try {
          var section = '';
          var parent = a.closest('[data-section-id]');
          if (parent) section = parent.getAttribute('data-section-id') || '';
          var btnText = '';
          var span = a.querySelector('span[data-ru]');
          if (span) btnText = span.getAttribute('data-ru') || span.textContent || '';
          else btnText = a.textContent || '';
          btnText = btnText.trim().substring(0, 100);
          if (!btnText || btnText.length < 2) return;
          fetch('/api/button-lead', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ button_text: btnText, section: section, lang: lang, name: '(button click)', contact: '' })
          }).catch(function(){});
        } catch(e) {}
      });
    });
    console.log('[DB] Button click tracking attached');
    
    // ===== 3c. DYNAMIC TICKER FROM DB =====
    if (db.tickerItems && db.tickerItems.length > 0) {
      var tickerTrack = document.getElementById('tickerTrack');
      if (tickerTrack) {
        var th = '';
        for (var ti = 0; ti < 2; ti++) {
          db.tickerItems.forEach(function(it) {
            th += '<div class="ticker-item"><i class="fas ' + (it.icon || 'fa-check-circle') + '"></i><span data-ru="' + (it.ru||'').replace(/"/g,'&quot;') + '" data-am="' + (it.am||'').replace(/"/g,'&quot;') + '">' + (lang === 'am' ? (it.am||it.ru) : it.ru) + '</span></div>';
          });
        }
        tickerTrack.innerHTML = th;
        console.log('[DB] Ticker updated from admin:', db.tickerItems.length, 'items');
      }
    }
    
    // ===== 3d. FOOTER SOCIAL LINKS FROM DB =====
    if (db.footerSocials && db.footerSocials.length > 0) {
      var footerSocialEl = document.querySelector('.footer-social, .social-links, footer .socials');
      if (!footerSocialEl) {
        // Create social links container in footer
        var footerEl = document.querySelector('footer');
        if (footerEl) {
          footerSocialEl = document.createElement('div');
          footerSocialEl.className = 'footer-socials';
          footerSocialEl.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1)';
          footerEl.appendChild(footerSocialEl);
        }
      }
      if (footerSocialEl) {
        var socialIcons = { instagram:'fab fa-instagram', facebook:'fab fa-facebook', telegram:'fab fa-telegram', whatsapp:'fab fa-whatsapp', youtube:'fab fa-youtube', tiktok:'fab fa-tiktok', twitter:'fab fa-twitter', linkedin:'fab fa-linkedin', vk:'fab fa-vk' };
        var socialColors = { instagram:'#E4405F', facebook:'#1877F2', telegram:'#26A5E4', whatsapp:'#25D366', youtube:'#FF0000', tiktok:'#000', twitter:'#1DA1F2', linkedin:'#0A66C2', vk:'#4680C2' };
        var sh = '';
        db.footerSocials.forEach(function(s) {
          var icon = socialIcons[s.type] || 'fas fa-link';
          var color = socialColors[s.type] || '#8B5CF6';
          sh += '<a href="' + (s.url||'#') + '" target="_blank" rel="noopener" class="footer-social-btn" style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:' + color + ';color:white;font-size:1.1rem;transition:transform 0.2s">' +
            '<i class="' + icon + '"></i></a>';
        });
        footerSocialEl.innerHTML = sh;
        console.log('[DB] Footer social links applied:', db.footerSocials.length);
      }
    }
    
    // ===== 4. INJECT CUSTOM SCRIPTS =====
    if (db.scripts) {
      if (db.scripts.head && db.scripts.head.length) {
        db.scripts.head.forEach(function(code) {
          var div = document.createElement('div');
          div.innerHTML = code;
          div.querySelectorAll('script').forEach(function(s) {
            var ns = document.createElement('script');
            if (s.src) ns.src = s.src; else ns.textContent = s.textContent;
            document.head.appendChild(ns);
          });
          div.querySelectorAll(':not(script)').forEach(function(el) { document.head.appendChild(el.cloneNode(true)); });
        });
      }
      if (db.scripts.body_end && db.scripts.body_end.length) {
        db.scripts.body_end.forEach(function(code) {
          var div = document.createElement('div');
          div.innerHTML = code;
          document.body.appendChild(div);
        });
      }
    }
    
    // ===== 5. REORDER SECTIONS =====
    if (db.sectionOrder && db.sectionOrder.length > 0) {
      var orderMap = {};
      db.sectionOrder.forEach(function(s) { orderMap[s.section_id] = s; });
      var allSections = document.querySelectorAll('[data-section-id]');
      var parent = allSections.length > 0 ? allSections[0].parentNode : null;
      if (parent) {
        var sectionArr = Array.from(allSections);
        sectionArr.sort(function(a, b) {
          var oa = orderMap[a.getAttribute('data-section-id')];
          var ob = orderMap[b.getAttribute('data-section-id')];
          var sa = oa ? oa.sort_order : 999;
          var sb = ob ? ob.sort_order : 999;
          return sa - sb;
        });
        // Get footer and floating elements as anchor
        var footer = document.querySelector('footer');
        sectionArr.forEach(function(section) {
          var sid = section.getAttribute('data-section-id');
          var info = orderMap[sid];
          if (info && !info.is_visible) {
            section.style.display = 'none';
          }
          if (footer) {
            parent.insertBefore(section, footer);
          }
        });
        console.log('[DB] Sections reordered:', db.sectionOrder.length);
      }
    }
    
    // ===== 6. INJECT BLOCK FEATURES (Social links, photos, slot counters per block) =====
    // First, create missing sections for blocks that exist in DB but not in HTML (e.g. copied blocks)
    if (db.blockFeatures && db.blockFeatures.length > 0 && db.sectionOrder) {
      var footer = document.querySelector('footer');
      var mainParent = footer ? footer.parentElement : document.querySelector('main') || document.body;
      db.blockFeatures.forEach(function(bf) {
        if (bf.key === 'floating_tg' || bf.block_type === 'floating' || bf.block_type === 'calculator') return;
        var sectionId = bf.key.replace(/_/g, '-');
        var existing = document.querySelector('[data-section-id="' + sectionId + '"]');
        if (existing) return; // already exists in HTML
        // Check if it should be visible
        var orderInfo = null;
        for (var oi = 0; oi < db.sectionOrder.length; oi++) {
          if (db.sectionOrder[oi].section_id === bf.key || db.sectionOrder[oi].section_id === sectionId) {
            orderInfo = db.sectionOrder[oi]; break;
          }
        }
        if (orderInfo && !orderInfo.is_visible) return;
        // Find texts from content
        var blockTexts = [];
        if (db.content) {
          for (var ck in db.content) {
            if (ck === bf.key || ck === sectionId) { blockTexts = db.content[ck] || []; break; }
          }
        }
        // Create new section element
        var newSec = document.createElement('section');
        newSec.className = 'section fade-up';
        newSec.setAttribute('data-section-id', sectionId);
        newSec.id = sectionId;
        var secH = '<div class="container">';
        // Title
        if (blockTexts.length > 0 && blockTexts[0]) {
          var titleText = lang === 'am' && blockTexts[0].am ? blockTexts[0].am : (blockTexts[0].ru || blockTexts[0] || '');
          secH += '<h2 class="section-title" style="text-align:center;margin-bottom:32px"><span data-ru="' + (blockTexts[0].ru||'') + '" data-am="' + (blockTexts[0].am||'') + '">' + titleText + '</span></h2>';
        }
        // Subtitle and other texts
        for (var ti = 1; ti < blockTexts.length; ti++) {
          var t = blockTexts[ti];
          if (t) {
            var tText = lang === 'am' && t.am ? t.am : (t.ru || t || '');
            secH += '<p style="text-align:center;color:var(--text-secondary);margin-bottom:16px;max-width:700px;margin-left:auto;margin-right:auto"><span data-ru="' + (t.ru||'') + '" data-am="' + (t.am||'') + '">' + tText + '</span></p>';
          }
        }
        secH += '</div>';
        newSec.innerHTML = secH;
        // Insert before footer
        if (footer && mainParent) { mainParent.insertBefore(newSec, footer); }
        else if (mainParent) { mainParent.appendChild(newSec); }
      });
    }
    
    if (db.blockFeatures && db.blockFeatures.length > 0) {
      var socialIcons = { instagram:'fab fa-instagram', facebook:'fab fa-facebook', telegram:'fab fa-telegram', whatsapp:'fab fa-whatsapp', youtube:'fab fa-youtube', tiktok:'fab fa-tiktok', twitter:'fab fa-x-twitter', linkedin:'fab fa-linkedin', vk:'fab fa-vk', website:'fas fa-globe', email:'fas fa-envelope', phone:'fas fa-phone', pinterest:'fab fa-pinterest', snapchat:'fab fa-snapchat', discord:'fab fa-discord', github:'fab fa-github', threads:'fab fa-threads', viber:'fab fa-viber' };
      var socialColors = { instagram:'#E4405F', facebook:'#1877F2', telegram:'#26A5E4', whatsapp:'#25D366', youtube:'#FF0000', tiktok:'#000', twitter:'#1DA1F2', linkedin:'#0A66C2', vk:'#4680C2', website:'#8B5CF6', email:'#F59E0B', phone:'#10B981', pinterest:'#E60023', snapchat:'#FFFC00', discord:'#5865F2', github:'#333', threads:'#000', viber:'#7360F2' };
      
      db.blockFeatures.forEach(function(bf) {
        // Map block_key (underscores) to data-section-id (hyphens)
        var sectionId = bf.key.replace(/_/g, '-');
        var section = document.querySelector('[data-section-id="' + sectionId + '"]');
        if (!section) return;
        
        // Replace main photo if photo_url is set
        if (bf.photo_url) {
          var heroImg = section.querySelector('.hero-image img, img[alt]');
          if (heroImg) {
            heroImg.setAttribute('src', bf.photo_url);
            console.log('[DB] Photo replaced in', sectionId);
          }
        }

        // Inject photos if photos array has items (no toggle required)
        if (bf.photos && bf.photos.length > 0) {
          var existingPhotoGal = section.querySelector('.block-photo-gallery');
          if (existingPhotoGal) existingPhotoGal.remove();
          var existingReviewCarousel = section.querySelector('.reviews-carousel-wrap');
          if (existingReviewCarousel) existingReviewCarousel.remove();
          
          var validPhotos = bf.photos.filter(function(p) { return p && p.url; });
          if (validPhotos.length > 0) {
            // Reviews carousel mode for block_type = 'reviews'
            if (bf.block_type === 'reviews') {
              var carouselWrap = document.createElement('div');
              carouselWrap.className = 'reviews-carousel-wrap';
              var carId = 'reviewsCar_' + bf.key;
              carouselWrap.style.cssText = 'position:relative;padding:20px 0;margin-top:12px;overflow:hidden';
              var cH = '<div id="' + carId + '" style="display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;padding:8px 4px">';
              validPhotos.forEach(function(p,pi) {
                cH += '<div style="flex:0 0 280px;scroll-snap-align:start;border-radius:16px;overflow:hidden;border:1px solid var(--border,rgba(255,255,255,0.1));background:var(--bg-card,#1a1a2e);box-shadow:0 4px 20px rgba(0,0,0,0.2);cursor:pointer" onclick="openLightbox(&apos;' + (p.url||'').replace(/'/g,'') + '&apos;)">' +
                  '<img src="' + p.url + '" alt="' + (p.caption||'Отзыв') + '" style="width:100%;height:360px;object-fit:cover;transition:transform 0.3s" loading="lazy">' +
                  (p.caption ? '<div style="padding:10px 14px;font-size:0.85rem;color:var(--text-sec,#aaa)">' + p.caption + '</div>' : '') +
                '</div>';
              });
              cH += '</div>';
              // Navigation arrows
              if (validPhotos.length > 1) {
                cH += '<button onclick="document.getElementById(&apos;' + carId + '&apos;).scrollBy({left:-296,behavior:&apos;smooth&apos;})" style="position:absolute;left:4px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(139,92,246,0.85);color:#fff;border:none;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);z-index:2"><i class="fas fa-chevron-left"></i></button>';
                cH += '<button onclick="document.getElementById(&apos;' + carId + '&apos;).scrollBy({left:296,behavior:&apos;smooth&apos;})" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(139,92,246,0.85);color:#fff;border:none;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);z-index:2"><i class="fas fa-chevron-right"></i></button>';
                // Dot indicators
                cH += '<div style="display:flex;justify-content:center;gap:6px;margin-top:12px">';
                validPhotos.forEach(function(_,di) { cH += '<div style="width:8px;height:8px;border-radius:50%;background:' + (di===0?'#8B5CF6':'rgba(139,92,246,0.3)') + '"></div>'; });
                cH += '</div>';
              }
              carouselWrap.innerHTML = cH;
              var container = section.querySelector('.container');
              if (container) container.appendChild(carouselWrap);
              else section.appendChild(carouselWrap);
            } else {
              // Default grid view for regular blocks
              var photoDiv = document.createElement('div');
              photoDiv.className = 'block-photo-gallery';
              photoDiv.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;padding:16px 0;margin-top:12px';
              var phH = '';
              validPhotos.forEach(function(p) {
                phH += '<div style="border-radius:12px;overflow:hidden;border:1px solid var(--border,rgba(255,255,255,0.1));cursor:pointer" onclick="openLightbox(&apos;' + (p.url||'').replace(/'/g,'') + '&apos;)">' +
                  '<img src="' + p.url + '" alt="' + (p.caption||'') + '" style="width:100%;height:180px;object-fit:cover;transition:transform 0.3s" onmouseover="this.style.transform=&apos;scale(1.05)&apos;" onmouseout="this.style.transform=&apos;scale(1)&apos;">' +
                  (p.caption ? '<div style="padding:8px 12px;font-size:0.82rem;color:var(--text-sec,#aaa)">' + p.caption + '</div>' : '') +
                '</div>';
              });
              photoDiv.innerHTML = phH;
              var container = section.querySelector('.container');
              if (container) container.appendChild(photoDiv);
              else section.appendChild(photoDiv);
            }
          }
        }
        
        // Inject social links if socials have URLs (no toggle required)
        if (bf.social_links && bf.social_links.length > 0 && bf.social_links.some(function(s) { return !!s.url; })) {
          // Remove existing social container if any
          var existing = section.querySelector('.block-socials');
          if (existing) existing.remove();
          
          var ss = bf.social_settings || {};
          var socGap = ss.gap || 12;
          var socAlign = ss.align || 'center';
          var socPosition = ss.position || 'bottom';
          var justifyMap = { center: 'center', left: 'flex-start', right: 'flex-end' };
          
          var socDiv = document.createElement('div');
          socDiv.className = 'block-socials';
          socDiv.style.cssText = 'display:flex;flex-direction:column;align-items:' + (socAlign === 'center' ? 'center' : socAlign === 'right' ? 'flex-end' : 'flex-start') + ';padding:16px 0;margin-top:12px';
          
          var socH = '';
          // Title
          var socTitle = lang === 'am' ? (ss.title_am || ss.title_ru || '') : (ss.title_ru || '');
          var socSubtitle = lang === 'am' ? (ss.subtitle_am || ss.subtitle_ru || '') : (ss.subtitle_ru || '');
          if (socTitle) socH += '<div style="font-size:1.1rem;font-weight:700;color:var(--text-primary,#fff);margin-bottom:4px">' + socTitle + '</div>';
          if (socSubtitle) socH += '<div style="font-size:0.85rem;color:var(--text-secondary,#999);margin-bottom:10px">' + socSubtitle + '</div>';
          
          // Icons row
          socH += '<div style="display:flex;gap:' + socGap + 'px;justify-content:' + (justifyMap[socAlign] || 'center') + ';align-items:flex-start;flex-wrap:wrap">';
          bf.social_links.forEach(function(s) {
            if (!s.url) return;
            var icon = socialIcons[s.type] || 'fas fa-link';
            var color = s.bg_color || socialColors[s.type] || '#8B5CF6';
            var sz = s.icon_size || 44;
            var fontSize = Math.round(sz * 0.45);
            var textSz = s.text_size || 14;
            socH += '<a href="' + s.url + '" target="_blank" rel="noopener" style="display:inline-flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none" onmouseover="this.querySelector(&apos;.soc-icon&apos;).style.transform=&apos;scale(1.15)&apos;;this.querySelector(&apos;.soc-icon&apos;).style.boxShadow=&apos;0 4px 15px ' + color + '66&apos;" onmouseout="this.querySelector(&apos;.soc-icon&apos;).style.transform=&apos;scale(1)&apos;;this.querySelector(&apos;.soc-icon&apos;).style.boxShadow=&apos;none&apos;">' +
              '<div class="soc-icon" style="display:inline-flex;align-items:center;justify-content:center;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + color + ';color:white;font-size:' + fontSize + 'px;transition:transform 0.2s,box-shadow 0.2s">' +
              '<i class="' + icon + '"></i></div>' +
              (s.label ? '<span style="font-size:' + textSz + 'px;color:var(--text-secondary,#999);max-width:' + (sz + 40) + 'px;text-align:center;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + s.label + '</span>' : '') +
            '</a>';
          });
          socH += '</div>';
          
          socDiv.innerHTML = socH;
          var container = section.querySelector('.container');
          if (socPosition === 'top') {
            if (container) { container.insertBefore(socDiv, container.firstChild); }
            else { section.insertBefore(socDiv, section.firstChild); }
          } else {
            if (container) { container.appendChild(socDiv); }
            else { section.appendChild(socDiv); }
          }
        }
        
        // Inject slot counters if show_slots is on — filter by position matching this block
        if (bf.show_slots && db.slotCounters && db.slotCounters.length > 0) {
          var bfKey = bf.key;
          var bfKeyHyphen = bfKey.replace(/_/g, '-');
          db.slotCounters.forEach(function(sc) {
            if (!sc.show_timer) return;
            // Only show counters linked to THIS block (position matches)
            var cpos = sc.position || '';
            if (cpos !== 'in-' + bfKey && cpos !== 'after-' + bfKey && cpos !== 'before-' + bfKey &&
                cpos !== 'in-' + bfKeyHyphen && cpos !== 'after-' + bfKeyHyphen && cpos !== 'before-' + bfKeyHyphen) return;
            var free = Math.max(0, (sc.total_slots || 10) - (sc.booked_slots || 0));
            var pct = sc.total_slots > 0 ? Math.round(((sc.total_slots - free) / sc.total_slots) * 100) : 0;
            var existingSlot = section.querySelector('.block-slot-counter');
            if (existingSlot) return; // only one per block
            var slotDiv = document.createElement('div');
            slotDiv.className = 'block-slot-counter';
            slotDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:16px;padding:14px 0;margin-top:8px;flex-wrap:wrap';
            slotDiv.innerHTML = '<div style="display:flex;align-items:center;gap:8px">' +
              '<div style="width:10px;height:10px;border-radius:50%;background:#10B981;animation:pulse 2s infinite"></div>' +
              '<span style="font-size:0.9rem;font-weight:600;color:var(--text-secondary,#999)">' + (lang === 'am' && sc.label_am ? sc.label_am : (sc.label_ru || sc.counter_name || '')) + '</span></div>' +
              '<span style="font-size:1.6rem;font-weight:900;color:var(--purple,#8B5CF6)">' + free + '<span style="color:var(--text-muted,#666);font-weight:400;font-size:0.8rem"> / ' + sc.total_slots + '</span></span>' +
              '<div style="width:140px;height:6px;background:var(--bg-card,#1a1a2e);border-radius:4px;overflow:hidden"><div style="height:100%;background:linear-gradient(90deg,#10B981,#8B5CF6);border-radius:4px;width:' + pct + '%"></div></div>';
            var container = section.querySelector('.container');
            if (container) container.appendChild(slotDiv);
            else section.appendChild(slotDiv);
          });
        }

        // Dynamic buttons: update CTA buttons in section from DB
        if (bf.buttons && bf.buttons.length > 0) {
          var sectionIdH = bf.key.replace(/_/g, '-');
          
          // Special handling for floating_tg block
          if (bf.key === 'floating_tg') {
            var floatEl = document.querySelector('.tg-float');
            if (floatEl && bf.buttons[0]) {
              var fb = bf.buttons[0];
              if (fb.url) floatEl.setAttribute('href', fb.url);
              var fIcon = floatEl.querySelector('i');
              if (fIcon && fb.icon) fIcon.className = fb.icon;
              var fSpan = floatEl.querySelector('span');
              if (fSpan) {
                var fText = lang === 'am' && fb.text_am ? fb.text_am : (fb.text_ru || '');
                if (fText) { fSpan.textContent = fText; fSpan.setAttribute('data-ru', fb.text_ru || ''); fSpan.setAttribute('data-am', fb.text_am || ''); }
              }
            }
            // Handle second floating button (calc)
            if (bf.buttons[1]) {
              var calcFloat = document.querySelector('.calc-float');
              if (calcFloat) {
                var cb = bf.buttons[1];
                if (cb.url) calcFloat.setAttribute('href', cb.url);
                var cIcon = calcFloat.querySelector('i');
                if (cIcon && cb.icon) cIcon.className = cb.icon;
                var cSpan = calcFloat.querySelector('span');
                if (cSpan) {
                  var cText = lang === 'am' && cb.text_am ? cb.text_am : (cb.text_ru || '');
                  if (cText) { cSpan.textContent = cText; cSpan.setAttribute('data-ru', cb.text_ru || ''); cSpan.setAttribute('data-am', cb.text_am || ''); }
                }
              }
            }
          } else {
            // For regular sections, update existing CTA buttons
            var ctaBtns = section.querySelectorAll('a.btn-primary, a.cta-btn, a[data-btn-idx]');
            if (ctaBtns.length > 0) {
              for (var bIdx = 0; bIdx < Math.min(ctaBtns.length, bf.buttons.length); bIdx++) {
                var dbBtn = bf.buttons[bIdx];
                var domBtn = ctaBtns[bIdx];
                if (dbBtn.url) domBtn.setAttribute('href', dbBtn.url);
                // Update icon
                var btnIcon = domBtn.querySelector('i');
                if (btnIcon && dbBtn.icon) btnIcon.className = dbBtn.icon;
                // Update text - find span or text node
                var btnSpan = domBtn.querySelector('span[data-ru]');
                if (btnSpan) {
                  var bText = lang === 'am' && dbBtn.text_am ? dbBtn.text_am : (dbBtn.text_ru || '');
                  if (bText) { btnSpan.textContent = bText; btnSpan.setAttribute('data-ru', dbBtn.text_ru || ''); btnSpan.setAttribute('data-am', dbBtn.text_am || ''); }
                }
              }
            }
          }
        }
      });
      console.log('[DB] Block features applied:', db.blockFeatures.length, 'blocks');
    }
    
    console.log('[DB] All dynamic data applied v3');
  } catch(e) {
    console.log('[DB] Error:', e.message || e);
  }
})();

/* ===== REFERRAL CODE CHECK ===== */
var _refDiscount = 0;
var _refFreeReviews = 0;
async function checkRefCode() {
  var code = document.getElementById('refCodeInput').value.trim();
  var result = document.getElementById('refResult');
  if (!code) { result.style.display = 'none'; return; }
  try {
    var res = await fetch('/api/referral/check', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({code:code}) });
    var data = await res.json();
    if (data.valid) {
      _refDiscount = data.discount_percent || 0;
      _refFreeReviews = data.free_reviews || 0;
      var msg = lang === 'am' 
        ? '<i class="fas fa-check-circle" style="margin-right:6px;color:var(--success)"></i>Պրոմոկոդը ակտիվացված է!'
        : '<i class="fas fa-check-circle" style="margin-right:6px;color:var(--success)"></i>Промокод активирован!';
      if (_refDiscount > 0) msg += (lang === 'am' ? ' Զեղճ: ' : ' Скидка: ') + _refDiscount + '%';
      if (_refFreeReviews > 0) msg += (lang === 'am' ? ' + ' + _refFreeReviews + ' անվճար կարծիքներ' : ' + ' + _refFreeReviews + ' бесплатных отзывов');
      if (data.description) msg += '<br><span style="font-size:0.8rem;color:var(--text-sec)">' + data.description + '</span>';
      result.style.display = 'block';
      result.style.background = 'rgba(16,185,129,0.1)';
      result.style.border = '1px solid rgba(16,185,129,0.3)';
      result.style.color = 'var(--success)';
      result.innerHTML = msg;
      recalcDynamic();
    } else {
      _refDiscount = 0;
      _refFreeReviews = 0;
      result.style.display = 'block';
      result.style.background = 'rgba(239,68,68,0.1)';
      result.style.border = '1px solid rgba(239,68,68,0.3)';
      result.style.color = 'var(--danger)';
      result.innerHTML = lang === 'am' 
        ? '<i class="fas fa-times-circle" style="margin-right:6px"></i>Պրոմոկոդը չի գտնվել'
        : '<i class="fas fa-times-circle" style="margin-right:6px"></i>Промокод не найден';
      recalcDynamic();
    }
  } catch(e) {
    console.log('Ref check error:', e);
  }
}

/* ===== SLOT COUNTERS (multiple) ===== */
(function() {
  fetch('/api/slots').then(function(r){return r.json()}).then(function(data) {
    var counters = data.counters || [];
    if (!counters.length) return;
    // Remove old static slot counter section
    var oldSection = document.getElementById('slotCounterSection');
    if (oldSection) oldSection.style.display = 'none';

    counters.forEach(function(d, idx) {
      if (!d.show_timer) return;
      var sid = 'slotCounter_' + (d.id || idx);
      // Create new counter element
      var el = document.createElement('div');
      el.id = sid;
      el.className = 'slot-counter-bar fade-up';
      el.setAttribute('data-section-id', 'slot-counter-' + (d.id || idx));
      el.innerHTML = '<div class="container">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap;padding:24px 0">' +
          '<div style="display:flex;align-items:center;gap:12px">' +
            '<div style="width:14px;height:14px;border-radius:50%;background:#10B981;animation:pulse 2s infinite"></div>' +
            '<span style="font-size:1rem;font-weight:600;color:var(--text-secondary)">' + (lang==='am' && d.label_am ? d.label_am : (d.label_ru || d.counter_name || '')) + '</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-size:2.2rem;font-weight:900;color:var(--purple)">' + d.free + '</span>' +
            '<span style="font-size:0.85rem;color:var(--text-muted)">/ ' + d.total + '</span>' +
          '</div>' +
          '<div style="width:200px;height:8px;background:var(--bg-card);border-radius:4px;overflow:hidden">' +
            '<div style="height:100%;background:linear-gradient(90deg,#10B981,#8B5CF6);border-radius:4px;transition:width 1s ease;width:' + Math.round(((d.total - d.free) / d.total) * 100) + '%"></div>' +
          '</div>' +
        '</div></div>';

      // Position counter
      var pos = d.position || 'after-hero';
      var target = null;
      if (pos === 'in-header') { target = document.querySelector('header, nav'); if (target) target.parentNode.insertBefore(el, target.nextSibling); }
      else if (pos === 'after-hero') { target = document.getElementById('hero') || document.querySelector('.hero'); if (target) target.parentNode.insertBefore(el, target.nextSibling); }
      else if (pos === 'before-calc') { target = document.getElementById('calculator'); if (target) target.parentNode.insertBefore(el, target); }
      else if (pos === 'before-contact') { target = document.getElementById('contact') || document.querySelector('.contact'); if (target) target.parentNode.insertBefore(el, target); }
      else if (pos === 'after-ticker') { target = document.querySelector('.ticker'); if (target) target.parentNode.insertBefore(el, target.nextSibling); }
      else { /* default: append before footer */ var ft = document.querySelector('footer'); if (ft) ft.parentNode.insertBefore(el, ft); }
    });
  }).catch(function(){});
})();

/* ===== DYNAMIC FOOTER FROM DB ===== */
(function() {
  fetch('/api/footer').then(function(r){return r.json()}).then(function(f) {
    if (!f || (!f.contacts_json && !f.brand_text_ru && !f.copyright_ru)) return;
    var footer = document.querySelector('footer.footer');
    if (!footer) return;

    // Update brand text
    if (f.brand_text_ru) {
      var brandP = footer.querySelector('.footer-brand p');
      if (brandP) {
        brandP.setAttribute('data-ru', f.brand_text_ru);
        if (f.brand_text_am) brandP.setAttribute('data-am', f.brand_text_am);
        brandP.textContent = lang === 'am' && f.brand_text_am ? f.brand_text_am : f.brand_text_ru;
      }
    }

    // Rebuild contacts column
    var contacts = [];
    try { contacts = JSON.parse(f.contacts_json || '[]'); } catch {}
    if (contacts.length > 0) {
      var cols = footer.querySelectorAll('.footer-col');
      var contactCol = cols.length >= 2 ? cols[cols.length - 1] : null;
      if (contactCol) {
        var chtml = '<h4 data-ru="Контакты" data-am="Կontakner">' + (lang==='am' ? 'Կontakner' : 'Контакты') + '</h4><ul>';
        for (var i = 0; i < contacts.length; i++) {
          var c = contacts[i];
          chtml += '<li><a href="' + (c.url || '#') + '" target="_blank"><i class="' + (c.icon || 'fab fa-telegram') + '"></i> ' + (c.name_ru || '') + '</a></li>';
        }
        chtml += '</ul>';
        contactCol.innerHTML = chtml;
      }
    }

    // Rebuild socials
    var socials = [];
    try { socials = JSON.parse(f.socials_json || '[]'); } catch {}
    if (socials.length > 0) {
      var bottom = footer.querySelector('.footer-bottom');
      if (bottom) {
        var socHtml = '<div style="display:flex;gap:16px;align-items:center">';
        for (var si = 0; si < socials.length; si++) {
          var s = socials[si];
          socHtml += '<a href="'+(s.url||'#')+'" target="_blank" style="color:var(--text-sec);font-size:1.2rem;transition:all 0.2s" title="'+(s.name||'')+'"><i class="'+(s.icon||'fab fa-link')+'"></i></a>';
        }
        socHtml += '</div>';
        // Insert socials after copyright span
        var existingSocials = bottom.querySelector('.footer-socials');
        if (existingSocials) existingSocials.remove();
        var socDiv = document.createElement('div');
        socDiv.className = 'footer-socials';
        socDiv.innerHTML = socHtml;
        bottom.appendChild(socDiv);
      }
    }

    // Update copyright
    if (f.copyright_ru) {
      var copySp = footer.querySelector('.footer-bottom > span:first-child');
      if (copySp) {
        copySp.innerHTML = f.copyright_ru;
        if (f.copyright_am && lang === 'am') copySp.innerHTML = f.copyright_am;
      }
    }
    // Update location
    if (f.location_ru) {
      var locSp = footer.querySelector('.footer-bottom > span:last-of-type');
      if (locSp) {
        locSp.textContent = lang === 'am' && f.location_am ? f.location_am : f.location_ru;
        locSp.setAttribute('data-ru', f.location_ru);
        if (f.location_am) locSp.setAttribute('data-am', f.location_am);
      }
    }
    // Custom HTML
    if (f.custom_html) {
      var customDiv = footer.querySelector('.footer-custom');
      if (!customDiv) { customDiv = document.createElement('div'); customDiv.className = 'footer-custom'; footer.querySelector('.container').appendChild(customDiv); }
      customDiv.innerHTML = f.custom_html;
    }
  }).catch(function(){});
})();

/* ===== DYNAMIC PHOTO BLOCKS FROM DB ===== */
(function() {
  fetch('/api/photo-blocks').then(function(r){return r.json()}).then(function(data) {
    var blocks = data.blocks || [];
    if (!blocks.length) return;
    blocks.forEach(function(b) {
      var photos = [];
      try { photos = JSON.parse(b.photos_json || '[]'); } catch { photos = []; }
      if (!photos.length) return;
      var el = document.createElement('section');
      el.className = 'section fade-up';
      el.setAttribute('data-section-id', 'photo-block-' + b.id);
      var desc = lang === 'am' && b.description_am ? b.description_am : (b.description_ru || '');
      var html = '<div class="container">';
      if (desc) html += '<p style="text-align:center;color:var(--text-sec);margin-bottom:24px;font-size:1rem">' + desc + '</p>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">';
      for (var i = 0; i < photos.length; i++) {
        var p = photos[i];
        if (!p.url) continue;
        html += '<div style="border-radius:var(--r);overflow:hidden;border:1px solid var(--border);background:var(--bg-card)">' +
          '<img src="' + p.url + '" alt="' + (p.caption||'') + '" style="width:100%;height:220px;object-fit:cover;cursor:pointer" onclick="openLightbox(this.src)">' +
          (p.caption ? '<div style="padding:10px 14px;font-size:0.85rem;color:var(--text-sec)">' + p.caption + '</div>' : '') +
        '</div>';
      }
      html += '</div></div>';
      el.innerHTML = html;
      // Position
      var pos = b.position || 'after-services';
      var target = null;
      if (pos === 'after-hero') { target = document.getElementById('hero') || document.querySelector('.hero'); if (target) target.parentNode.insertBefore(el, target.nextSibling); }
      else if (pos === 'after-services') { target = document.getElementById('services'); if (target) target.parentNode.insertBefore(el, target.nextSibling); }
      else if (pos === 'before-calc') { target = document.getElementById('calculator'); if (target) target.parentNode.insertBefore(el, target); }
      else if (pos === 'after-about') { target = document.getElementById('about'); if (target) target.parentNode.insertBefore(el, target.nextSibling); }
      else if (pos === 'before-contact') { target = document.getElementById('contact'); if (target) target.parentNode.insertBefore(el, target); }
      else if (pos === 'after-guarantee') { target = document.getElementById('guarantee'); if (target) target.parentNode.insertBefore(el, target.nextSibling); }
      else { var ft = document.querySelector('footer'); if (ft) ft.parentNode.insertBefore(el, ft); }
    });
  }).catch(function(){});
})();

/* ===== PDF DOWNLOAD — FORM + BUTTON ===== */
(function() {
  var calcSection = document.getElementById('calculator');
  if (!calcSection) return;
  var totalEl = document.getElementById('calcTotal');
  if (!totalEl) return;
  var totalWrap = totalEl.closest('.calc-total') || totalEl.parentElement;
  if (!totalWrap || !totalWrap.parentElement) return;

  // Create contact form + PDF button container
  var formDiv = document.createElement('div');
  formDiv.id = 'pdfFormWrap';
  formDiv.style.cssText = 'margin-top:20px;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.2);border-radius:16px;padding:20px;';
  formDiv.innerHTML =
    '<div style="font-size:0.95rem;font-weight:700;margin-bottom:14px;color:var(--text)">' +
      '<i class="fas fa-file-pdf" style="color:#F59E0B;margin-right:8px"></i>' +
      '<span data-ru="Скачать расчёт (PDF)" data-am="Ներբեռնել հաշվարկ (PDF)">Скачать расчёт (PDF)</span>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px" class="pdf-form-row">' +
      '<input type="text" id="pdfClientName" placeholder="' + (lang==='am' ? 'Անուն *' : 'Имя *') + '" style="padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:0.9rem;outline:none;width:100%">' +
      '<input type="tel" id="pdfClientPhone" placeholder="' + (lang==='am' ? 'Հեռախոս *' : 'Телефон *') + '" style="padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:0.9rem;outline:none;width:100%">' +
    '</div>' +
    '<div id="pdfFormError" style="display:none;color:#EF4444;font-size:0.82rem;margin-bottom:8px;padding:6px 10px;background:rgba(239,68,68,0.1);border-radius:8px"></div>' +
    '<button type="button" id="pdfDownloadBtn" style="margin-top:4px;background:linear-gradient(135deg,#F59E0B,#D97706);color:white;border:none;padding:14px 28px;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;width:100%;justify-content:center;transition:all 0.3s">' +
      '<i class="fas fa-file-pdf"></i> <span data-ru="Скачать КП (PDF)" data-am="Ներբեռնել ԿԱ (PDF)">Скачать КП (PDF)</span>' +
    '</button>';

  totalWrap.parentElement.insertBefore(formDiv, totalWrap.nextSibling);
  var pdfBtn = document.getElementById('pdfDownloadBtn');

  pdfBtn.addEventListener('click', function() {
    var nameInput = document.getElementById('pdfClientName');
    var phoneInput = document.getElementById('pdfClientPhone');
    var errDiv = document.getElementById('pdfFormError');
    var clientName = (nameInput.value || '').trim();
    var clientPhone = (phoneInput.value || '').trim();

    if (!clientName || !clientPhone) {
      errDiv.style.display = 'block';
      errDiv.textContent = lang === 'am' ? 'Լրացրեք անունը և հեռախոսը' : 'Укажите имя и телефон';
      if (!clientName) nameInput.style.borderColor = '#EF4444';
      if (!clientPhone) phoneInput.style.borderColor = '#EF4444';
      return;
    }
    errDiv.style.display = 'none';
    nameInput.style.borderColor = '';
    phoneInput.style.borderColor = '';

    var items = [];
    calcSection.querySelectorAll('.calc-row').forEach(function(row) {
      var qtyInput = row.querySelector('input[type="number"]');
      if (!qtyInput) return;
      var qty = parseInt(qtyInput.value) || 0;
      if (qty <= 0) return;
      var nameEl = row.querySelector('.calc-label');
      var name = nameEl ? nameEl.textContent.trim() : '';
      var dp = row.getAttribute('data-price');
      if (dp === 'buyout') {
        items.push({ name: name, price: getBuyoutPrice(qty), qty: qty, subtotal: getBuyoutTotal(qty) });
      } else if (dp === 'tiered') {
        try { var t = JSON.parse(row.getAttribute('data-tiers')); items.push({ name: name, price: getTierPrice(t,qty), qty: qty, subtotal: getTierTotal(t,qty) }); }
        catch(e) { var pe=row.querySelector('.calc-price'); var pp=pe?parseInt(pe.textContent.replace(/[^0-9]/g,''))||0:0; items.push({name:name,price:pp,qty:qty,subtotal:pp*qty}); }
      } else {
        var p = parseInt(dp) || 0;
        items.push({ name: name, price: p, qty: qty, subtotal: p * qty });
      }
    });

    if (!items.length) {
      errDiv.style.display = 'block';
      errDiv.textContent = lang === 'am' ? 'Ընտրեք ծառայություններ (քանակ > 0)' : 'Выберите услуги (количество > 0)';
      return;
    }

    var totalVal = totalEl.textContent.replace(/[^0-9]/g, '');
    var refCode = '';
    var refInput = document.getElementById('refCodeInput');
    if (refInput) refCode = refInput.value || '';

    pdfBtn.disabled = true;
    pdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (lang === 'am' ? 'Սպասեք...' : 'Загрузка...');

    fetch('/api/generate-pdf', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ items: items, total: parseInt(totalVal)||0, lang: lang, clientName: clientName, clientContact: clientPhone, referralCode: refCode })
    }).then(function(r){ return r.json(); }).then(function(data) {
      pdfBtn.disabled = false;
      pdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> ' + (lang==='am' ? '\u0546\u0565\u0580\u0562\u0565\u057c\u0576\u0565\u056c \u053f\u0531 (PDF)' : '\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u041a\u041f (PDF)');
      /* Navigate to PDF page — works on ALL devices: Android WebView, iOS Safari, Desktop */
      /* CRITICAL: Use window.location.href instead of window.open() — popup blockers on iOS Safari
         and Android browsers (Chrome, Samsung Internet, WebView) block window.open() called
         inside async callbacks (fetch .then). location.href is never blocked. */
      var pdfUrl = (data && data.url) ? data.url : ((data && data.leadId) ? '/pdf/' + data.leadId : null);
      if (pdfUrl) {
        window.location.href = pdfUrl;
      }
    }).catch(function(e){
      console.error('PDF error:', e);
      pdfBtn.disabled = false;
      pdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> ' + (lang==='am' ? '\u0546\u0565\u0580\u0562\u0565\u057c\u0576\u0565\u056c \u053f\u0531 (PDF)' : '\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u041a\u041f (PDF)');
    });
  });

  if (lang === 'am') {
    formDiv.querySelectorAll('[data-am]').forEach(function(el) { el.textContent = el.getAttribute('data-am'); });
  }
  var _s = document.createElement('style');
  _s.textContent = '@media(max-width:640px){.pdf-form-row{grid-template-columns:1fr!important}}';
  document.head.appendChild(_s);
})();

/* ===== PAGE VIEW TRACKING ===== */
(function() {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        page: window.location.pathname,
        referrer: document.referrer || '',
        ua: navigator.userAgent ? navigator.userAgent.substring(0, 200) : '',
        lang: lang || 'ru'
      })
    }).catch(function(){});
  } catch(e) {}
})();
</script>
</body>
</html>`)
})

export default app
