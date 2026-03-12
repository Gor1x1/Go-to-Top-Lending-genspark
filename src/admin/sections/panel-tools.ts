/**
 * Admin Panel — Telegram bot, PDF template, slot counter, footer, photo blocks
 * 890 lines of JS code for the admin SPA
 */
export const CODE = `
// ===== TELEGRAM BOT =====
function renderTelegramBot() {
  var bots = data.telegramBot || [];
  var h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Telegram Бот / Уведомления</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Настройка бота для автоматических уведомлений о новых заявках</p>' +
    '<button class="btn btn-primary" style="margin-bottom:20px" onclick="addTgBot()"><i class="fas fa-plus" style="margin-right:6px"></i>Добавить получателя</button>';

  for (var i = 0; i < bots.length; i++) {
    var b = bots[i];
    h += '<div class="card" style="margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
        '<div><strong>' + escHtml(b.chat_name || 'Chat ' + b.chat_id) + '</strong>' +
          (b.is_active ? ' <span class="badge badge-green">Активен</span>' : ' <span class="badge" style="background:rgba(239,68,68,0.2);color:#f87171">Выкл</span>') +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-success" style="padding:6px 12px;font-size:0.8rem" onclick="saveTgBot(' + b.id + ')"><i class="fas fa-save"></i></button>' +
          '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.8rem" onclick="testTgBot(' + b.id + ')"><i class="fas fa-paper-plane"></i> Тест</button>' +
          '<button class="btn btn-danger" style="padding:6px 12px;font-size:0.8rem" onclick="deleteTgBot(' + b.id + ')"><i class="fas fa-trash"></i></button>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Bot Token</label><input class="input" value="' + escHtml(b.bot_token) + '" id="tgb_token_' + b.id + '" type="password"></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Chat ID</label><input class="input" value="' + escHtml(b.chat_id) + '" id="tgb_chat_' + b.id + '"></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Название чата</label><input class="input" value="' + escHtml(b.chat_name) + '" id="tgb_name_' + b.id + '"></div>' +
        '<div style="display:flex;align-items:center;gap:8px;padding-top:18px"><input type="checkbox" id="tgb_leads_' + b.id + '"' + (b.notify_leads ? ' checked' : '') + '><label style="font-size:0.85rem;color:#94a3b8">Уведомлять о лидах</label></div>' +
        '<div style="display:flex;align-items:center;gap:8px;padding-top:18px"><input type="checkbox" id="tgb_calc_' + b.id + '"' + (b.notify_calc ? ' checked' : '') + '><label style="font-size:0.85rem;color:#94a3b8">Уведомлять о PDF</label></div>' +
      '</div>' +
    '</div>';
  }

  if (!bots.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-robot" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8">Получатели уведомлений не настроены. Добавьте бота и Chat ID для получения уведомлений о заявках.</p></div>';
  }
  h += '</div>';
  return h;
}

async function addTgBot() {
  await api('/telegram-bot', { method: 'POST', body: JSON.stringify({ bot_token: '8168691099:AAEdDYZ2RPCM99QWsgRKu_dcHsne2c4Sd_U', chat_id: '', chat_name: 'Новый получатель', notify_leads: 1, notify_calc: 0 }) });
  toast('Получатель добавлен');
  await loadData(); render();
}

async function saveTgBot(id) {
  await api('/telegram-bot/' + id, { method: 'PUT', body: JSON.stringify({
    bot_token: document.getElementById('tgb_token_' + id).value,
    chat_id: document.getElementById('tgb_chat_' + id).value,
    chat_name: document.getElementById('tgb_name_' + id).value,
    notify_leads: document.getElementById('tgb_leads_' + id).checked ? 1 : 0,
    notify_calc: document.getElementById('tgb_calc_' + id).checked ? 1 : 0,
    is_active: 1
  }) });
  toast('Сохранено');
  await loadData(); render();
}

async function testTgBot(id) {
  var token = document.getElementById('tgb_token_' + id).value;
  var chatId = document.getElementById('tgb_chat_' + id).value;
  if (!token || !chatId) { toast('Заполните Token и Chat ID', 'error'); return; }
  var res = await api('/telegram-bot/test', { method: 'POST', body: JSON.stringify({ bot_token: token, chat_id: chatId, message: '✅ Тестовое сообщение от Go to Top admin panel!' }) });
  if (res && res.success) toast('Сообщение отправлено!');
  else toast('Ошибка: ' + (res?.error || 'unknown'), 'error');
}

async function deleteTgBot(id) {
  if (!confirm('Удалить этого получателя?')) return;
  await api('/telegram-bot/' + id, { method: 'DELETE' });
  toast('Удалён');
  await loadData(); render();
}

// ===== PDF TEMPLATE =====
var pdfLangTab = 'ru'; // 'ru', 'am', 'en'

// Collect current PDF field values from DOM into data.pdfTemplate
// Must be called BEFORE render() to preserve unsaved edits when switching tabs
function collectPdfFields() {
  if (!data.pdfTemplate) data.pdfTemplate = {};
  var t = data.pdfTemplate;
  var lang = pdfLangTab;
  var sfx = '_' + lang;
  // Language-specific content fields
  var contentKeys = ['header', 'intro', 'outro', 'footer', 'terms', 'bank_details', 'btn_order', 'btn_download'];
  for (var ci = 0; ci < contentKeys.length; ci++) {
    var ck = contentKeys[ci];
    var elId = ck === 'bank_details' ? 'pdf_bank' + sfx : ck === 'btn_order' ? 'pdf_btn_order' + sfx : ck === 'btn_download' ? 'pdf_btn_dl' + sfx : 'pdf_' + ck + sfx;
    var el = document.getElementById(elId);
    if (el) t[ck + sfx] = el.value;
  }
  // Language-specific table label fields
  var labelKeys = ['label_service','label_qty','label_price','label_sum','label_total','label_subtotal','label_client','label_date','label_invoice','label_back','order_message'];
  for (var lki = 0; lki < labelKeys.length; lki++) {
    var lkKey = labelKeys[lki] + sfx;
    var lkEl = document.getElementById('pdf_' + lkKey);
    if (lkEl) t[lkKey] = lkEl.value;
  }
  // Shared (non-language) fields — always visible
  var sharedMap = { 'pdf_company': 'company_name', 'pdf_phone': 'company_phone', 'pdf_email': 'company_email', 'pdf_address': 'company_address', 'pdf_website': 'company_website', 'pdf_inn': 'company_inn', 'pdf_order_tg': 'order_telegram_url', 'pdf_prefix': 'invoice_prefix', 'pdf_accent': 'accent_color' };
  var sKeys = Object.keys(sharedMap);
  for (var si = 0; si < sKeys.length; si++) {
    var sEl = document.getElementById(sKeys[si]);
    if (sEl) t[sharedMap[sKeys[si]]] = sEl.value;
  }
  var qrEl = document.getElementById('pdf_qr');
  if (qrEl) t['show_qr'] = qrEl.checked ? 1 : 0;
}

function renderPdfTemplate() {
  var t = data.pdfTemplate || {};
  var h = '<div style="padding:24px 28px;max-width:1400px;margin:0 auto">';
  
  // Header
  h += '<div style="margin-bottom:24px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">' +
      '<div><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:2px"><i class="fas fa-file-invoice" style="color:#8B5CF6;margin-right:10px"></i>PDF \\u0428\\u0430\\u0431\\u043b\\u043e\\u043d (\\u041f\\u0440\\u043e\\u0444. \\u0418\\u043d\\u0432\\u043e\\u0439\\u0441)</h1>' +
      '<p style="color:#64748b;font-size:0.82rem;margin:0">\\u041f\\u0440\\u043e\\u0444\\u0435\\u0441\\u0441\\u0438\\u043e\\u043d\\u0430\\u043b\\u044c\\u043d\\u044b\\u0439 \\u0438\\u043d\\u0432\\u043e\\u0439\\u0441 \\u0434\\u043b\\u044f \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u043e\\u0432 \\u043d\\u0430 3 \\u044f\\u0437\\u044b\\u043a\\u0430\\u0445. PDF \\u0433\\u0435\\u043d\\u0435\\u0440\\u0438\\u0440\\u0443\\u0435\\u0442\\u0441\\u044f \\u0430\\u0432\\u0442\\u043e\\u043c\\u0430\\u0442\\u0438\\u0447\\u0435\\u0441\\u043a\\u0438 \\u0438\\u0437 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445 \\u043b\\u0438\\u0434\\u043e\\u0432.</p></div>' +
      '<div style="display:flex;gap:8px">' +
        '<a class="btn btn-outline" href="/#calculator" target="_blank" style="font-size:0.82rem"><i class="fas fa-external-link-alt" style="margin-right:4px"></i>\\u041f\\u0440\\u0435\\u0434\\u043f\\u0440\\u043e\\u0441\\u043c\\u043e\\u0442\\u0440</a>' +
      '</div>' +
    '</div>';
  
  // Language tabs (like Constructor blocks)
  var pdfLangs = [
    { id: 'ru', icon: '', label: '\\u0420\\u0443\\u0441\\u0441\\u043a\\u0438\\u0439 (RU)', color: '#8B5CF6' },
    { id: 'am', icon: '', label: '\\u0540\\u0561\\u0575\\u0565\\u0580\\u0565\\u0576 (AM)', color: '#F59E0B' },
    { id: 'en', icon: '', label: 'English (EN)', color: '#3B82F6' }
  ];
  h += '<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">';
  for (var li = 0; li < pdfLangs.length; li++) {
    var pl = pdfLangs[li];
    h += '<button class="tab-btn' + (pdfLangTab === pl.id ? ' active' : '') + '" onclick="collectPdfFields();pdfLangTab=&apos;' + pl.id + '&apos;;render()" style="padding:10px 20px;border-left:3px solid ' + pl.color + '"><i class="fas fa-globe" style="margin-right:6px;color:' + pl.color + '"></i>' + pl.label + '</button>';
  }
  h += '</div></div>';
  
  var lang = pdfLangTab;
  var lColor = lang === 'ru' ? '#8B5CF6' : lang === 'am' ? '#F59E0B' : '#3B82F6';
  var lSuffix = '_' + lang;
  
  // ── 1. Content section (language-specific) ──
  h += '<div class="card" style="margin-bottom:20px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;color:' + lColor + '"><i class="fas fa-file-alt" style="margin-right:8px"></i>\\u041a\\u043e\\u043d\\u0442\\u0435\\u043d\\u0442 \\u0438\\u043d\\u0432\\u043e\\u0439\\u0441\\u0430 (' + lang.toUpperCase() + ')</h3>';
  h += '<div style="display:grid;grid-template-columns:1fr;gap:16px">';
  h += '<div><label style="font-size:0.75rem;color:' + lColor + ';font-weight:600"><i class="fas fa-heading" style="margin-right:4px"></i>\\u0417\\u0430\\u0433\\u043e\\u043b\\u043e\\u0432\\u043e\\u043a \\u0434\\u043e\\u043a\\u0443\\u043c\\u0435\\u043d\\u0442\\u0430</label><input class="input" id="pdf_header' + lSuffix + '" value="' + escHtml(t['header' + lSuffix] || '') + '" placeholder="' + (lang==='ru' ? '\\u041a\\u043e\\u043c\\u043c\\u0435\\u0440\\u0447\\u0435\\u0441\\u043a\\u043e\\u0435 \\u043f\\u0440\\u0435\\u0434\\u043b\\u043e\\u0436\\u0435\\u043d\\u0438\\u0435' : lang==='en' ? 'Commercial Proposal' : '\\u0531\\u057c\\u0587\\u057f\\u0580\\u0561\\u0575\\u056b\\u0576 \\u0561\\u057c\\u0561\\u057b\\u0561\\u0580\\u056f') + '"></div>';
  h += '<div><label style="font-size:0.75rem;color:' + lColor + ';font-weight:600"><i class="fas fa-pen-fancy" style="margin-right:4px"></i>\\u0412\\u0441\\u0442\\u0443\\u043f\\u043b\\u0435\\u043d\\u0438\\u0435 (\\u043f\\u043e\\u0434 \\u0437\\u0430\\u0433\\u043e\\u043b\\u043e\\u0432\\u043a\\u043e\\u043c)</label><textarea class="input" id="pdf_intro' + lSuffix + '" rows="3" placeholder="' + (lang==='en' ? 'Thank you for your interest. Here is your calculation...' : '\\u0411\\u043b\\u0430\\u0433\\u043e\\u0434\\u0430\\u0440\\u0438\\u043c \\u0437\\u0430 \\u0438\\u043d\\u0442\\u0435\\u0440\\u0435\\u0441...') + '">' + escHtml(t['intro' + lSuffix] || '') + '</textarea></div>';
  h += '<div><label style="font-size:0.75rem;color:' + lColor + ';font-weight:600"><i class="fas fa-comment-dots" style="margin-right:4px"></i>\\u0417\\u0430\\u0432\\u0435\\u0440\\u0448\\u0435\\u043d\\u0438\\u0435 (\\u043f\\u043e\\u0441\\u043b\\u0435 \\u0442\\u0430\\u0431\\u043b\\u0438\\u0446\\u044b)</label><textarea class="input" id="pdf_outro' + lSuffix + '" rows="3" placeholder="' + (lang==='en' ? 'We look forward to working with you...' : '\\u0411\\u0443\\u0434\\u0435\\u043c \\u0440\\u0430\\u0434\\u044b \\u0441\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u0447\\u0435\\u0441\\u0442\\u0432\\u0443...') + '">' + escHtml(t['outro' + lSuffix] || '') + '</textarea></div>';
  h += '<div><label style="font-size:0.75rem;color:' + lColor + ';font-weight:600"><i class="fas fa-shoe-prints" style="margin-right:4px"></i>Footer (\\u043f\\u043e\\u0434\\u043f\\u0438\\u0441\\u044c \\u0432\\u043d\\u0438\\u0437\\u0443)</label><input class="input" id="pdf_footer' + lSuffix + '" value="' + escHtml(t['footer' + lSuffix] || '') + '" placeholder="' + (lang==='en' ? 'All rights reserved. Go to Top Agency.' : '\\u00a9 Go to Top') + '"></div>';
  h += '</div>';
  
  // Terms & Conditions
  h += '<div style="margin-top:16px"><label style="font-size:0.75rem;color:' + lColor + ';font-weight:600"><i class="fas fa-gavel" style="margin-right:4px"></i>\\u0423\\u0441\\u043b\\u043e\\u0432\\u0438\\u044f \\u0438 \\u043f\\u043e\\u043b\\u043e\\u0436\\u0435\\u043d\\u0438\\u044f (' + lang.toUpperCase() + ')</label><textarea class="input" id="pdf_terms' + lSuffix + '" rows="2" placeholder="' + (lang==='en' ? 'Payment terms: 50% prepayment, 50% upon completion...' : '\\u0423\\u0441\\u043b\\u043e\\u0432\\u0438\\u044f \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b...') + '">' + escHtml(t['terms' + lSuffix] || '') + '</textarea></div>';
  
  // Bank details
  h += '<div style="margin-top:12px"><label style="font-size:0.75rem;color:' + lColor + ';font-weight:600"><i class="fas fa-university" style="margin-right:4px"></i>\\u0411\\u0430\\u043d\\u043a\\u043e\\u0432\\u0441\\u043a\\u0438\\u0435 \\u0440\\u0435\\u043a\\u0432\\u0438\\u0437\\u0438\\u0442\\u044b (' + lang.toUpperCase() + ')</label><textarea class="input" id="pdf_bank' + lSuffix + '" rows="2" placeholder="' + (lang==='en' ? 'Bank: ..., Account: ..., SWIFT: ...' : '\\u0411\\u0430\\u043d\\u043a: ..., \\u0421\\u0447\\u0451\\u0442: ...') + '">' + escHtml(t['bank_details' + lSuffix] || '') + '</textarea></div>';
  h += '</div>';
  
  // ── 2. Button labels (language-specific) ──
  h += '<div class="card" style="margin-bottom:20px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;color:#a78bfa"><i class="fas fa-hand-pointer" style="margin-right:8px"></i>\\u041a\\u043d\\u043e\\u043f\\u043a\\u0438 \\u043d\\u0430 \\u0441\\u0442\\u0440\\u0430\\u043d\\u0438\\u0446\\u0435 PDF (' + lang.toUpperCase() + ')</h3>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  h += '<div><label style="font-size:0.75rem;color:#10B981;font-weight:600"><i class="fab fa-telegram" style="margin-right:4px"></i>\\u041a\\u043d\\u043e\\u043f\\u043a\\u0430 \\u00ab\\u0417\\u0430\\u043a\\u0430\\u0437\\u0430\\u0442\\u044c\\u00bb</label><input class="input" id="pdf_btn_order' + lSuffix + '" value="' + escHtml(t['btn_order' + lSuffix] || (lang==='en' ? 'Order Now' : lang==='am' ? '\\u054a\\u0561\\u057f\\u057e\\u056b\\u0580\\u0565\\u056c \\u0570\\u056b\\u0574\\u0561' : '\\u0417\\u0430\\u043a\\u0430\\u0437\\u0430\\u0442\\u044c \\u0441\\u0435\\u0439\\u0447\\u0430\\u0441')) + '"></div>';
  h += '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600"><i class="fas fa-download" style="margin-right:4px"></i>\\u041a\\u043d\\u043e\\u043f\\u043a\\u0430 \\u00ab\\u0421\\u043a\\u0430\\u0447\\u0430\\u0442\\u044c\\u00bb</label><input class="input" id="pdf_btn_dl' + lSuffix + '" value="' + escHtml(t['btn_download' + lSuffix] || (lang==='en' ? 'Download' : lang==='am' ? '\\u0546\\u0565\\u0580\\u0562\\u0565\\u057c\\u0576\\u0565\\u056c' : '\\u0421\\u043a\\u0430\\u0447\\u0430\\u0442\\u044c')) + '"></div>';
  h += '</div></div>';
  
  // ── 2b. Table labels (language-specific) ──
  h += '<div class="card" style="margin-bottom:20px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;color:#a78bfa"><i class="fas fa-table" style="margin-right:8px"></i>\\u041b\\u0435\\u0439\\u0431\\u043b\\u044b \\u0442\\u0430\\u0431\\u043b\\u0438\\u0446\\u044b PDF (' + lang.toUpperCase() + ')</h3>';
  h += '<p style="font-size:0.72rem;color:#64748b;margin-bottom:12px">\\u0422\\u0435\\u043a\\u0441\\u0442\\u044b \\u0437\\u0430\\u0433\\u043e\\u043b\\u043e\\u0432\\u043a\\u043e\\u0432 \\u0442\\u0430\\u0431\\u043b\\u0438\\u0446\\u044b, \\u043c\\u0435\\u0442\\u043a\\u0438 \\u0438\\u0442\\u043e\\u0433\\u043e\\u0432 \\u0438 \\u043d\\u0430\\u0432\\u0438\\u0433\\u0430\\u0446\\u0438\\u0438.</p>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:12px">';
  var labelFields = [
    { key: 'label_service', label: '\\u0423\\u0441\\u043b\\u0443\\u0433\\u0430', def_ru: '\\u0423\\u0441\\u043b\\u0443\\u0433\\u0430', def_am: '\\u053e\\u0561\\u057c\\u0561\\u0575\\u0578\\u0582\\u0569\\u0575\\u0578\\u0582\\u0576', def_en: 'Service' },
    { key: 'label_qty', label: '\\u041a\\u043e\\u043b-\\u0432\\u043e', def_ru: '\\u041a\\u043e\\u043b-\\u0432\\u043e', def_am: '\\u0554\\u0561\\u0576\\u0561\\u056f', def_en: 'Qty' },
    { key: 'label_price', label: '\\u0426\\u0435\\u043d\\u0430', def_ru: '\\u0426\\u0435\\u043d\\u0430', def_am: '\\u0533\\u056b\\u0576', def_en: 'Price' },
    { key: 'label_sum', label: '\\u0421\\u0443\\u043c\\u043c\\u0430', def_ru: '\\u0421\\u0443\\u043c\\u043c\\u0430', def_am: '\\u0533\\u0578\\u0582\\u0574\\u0561\\u0580', def_en: 'Total' },
    { key: 'label_total', label: '\\u0418\\u0422\\u041e\\u0413\\u041e', def_ru: '\\u0418\\u0422\\u041e\\u0413\\u041e:', def_am: '\\u0538\\u0546\\u0534\\u0531\\u0544\\u0535\\u0546\\u0538:', def_en: 'TOTAL:' },
    { key: 'label_subtotal', label: '\\u041f\\u043e\\u0434\\u0438\\u0442\\u043e\\u0433', def_ru: '\\u041f\\u043e\\u0434\\u0438\\u0442\\u043e\\u0433:', def_am: '\\u0535\\u0576\\u0569\\u0561\\u0570\\u0561\\u0577\\u057e\\u0561\\u0580\\u056f:', def_en: 'Subtotal:' },
    { key: 'label_client', label: '\\u041a\\u043b\\u0438\\u0435\\u043d\\u0442', def_ru: '\\u041a\\u043b\\u0438\\u0435\\u043d\\u0442:', def_am: '\\u0540\\u0561\\u0573\\u0561\\u056d\\u0578\\u0580\\u0564:', def_en: 'Client:' },
    { key: 'label_date', label: '\\u0414\\u0430\\u0442\\u0430', def_ru: '\\u0414\\u0430\\u0442\\u0430:', def_am: '\\u0531\\u0574\\u057d\\u0561\\u0569\\u056b\\u057e:', def_en: 'Date:' },
    { key: 'label_invoice', label: '\\u0417\\u0430\\u044f\\u0432\\u043a\\u0430', def_ru: '\\u0417\\u0430\\u044f\\u0432\\u043a\\u0430 \\u2116', def_am: '\\u0540\\u0561\\u0575\\u057f \\u2116', def_en: 'Invoice #' },
    { key: 'label_back', label: '\\u041d\\u0430\\u0437\\u0430\\u0434', def_ru: '\\u041a \\u0440\\u0430\\u0441\\u0447\\u0451\\u0442\\u0443', def_am: '\\u0540\\u0561\\u0577\\u057e\\u056b\\u0579', def_en: 'Back' }
  ];
  for (var lfi = 0; lfi < labelFields.length; lfi++) {
    var lf = labelFields[lfi];
    var lfKey = lf.key + lSuffix;
    var lfDef = lang === 'ru' ? lf.def_ru : lang === 'am' ? lf.def_am : lf.def_en;
    h += '<div><label style="font-size:0.7rem;color:' + lColor + ';font-weight:600">' + lf.label + '</label><input class="input" id="pdf_' + lfKey + '" value="' + escHtml(t[lfKey] || lfDef) + '" placeholder="' + escHtml(lfDef) + '" style="font-size:0.85rem"></div>';
  }
  h += '</div>';
  h += '<div style="margin-top:12px"><label style="font-size:0.75rem;color:' + lColor + ';font-weight:600"><i class="fab fa-telegram" style="margin-right:4px"></i>\\u0421\\u043e\\u043e\\u0431\\u0449\\u0435\\u043d\\u0438\\u0435 \\u0437\\u0430\\u043a\\u0430\\u0437\\u0430 \\u0432 \\u043c\\u0435\\u0441\\u0441\\u0435\\u043d\\u0434\\u0436\\u0435\\u0440 (' + lang.toUpperCase() + ')</label><input class="input" id="pdf_order_message' + lSuffix + '" value="' + escHtml(t['order_message' + lSuffix] || (lang==='en' ? 'Hello! I would like to place an order:' : lang==='am' ? '\\u0548\\u0572\\u057b\\u0578\\u0582\\u0575\\u0576! \\u053f\\u0581\\u0561\\u0576\\u056f\\u0561\\u0576\\u0561\\u0575\\u056b \\u057a\\u0561\\u057f\\u057e\\u056b\\u0580\\u0565\\u056c:' : '\\u0417\\u0434\\u0440\\u0430\\u0432\\u0441\\u0442\\u0432\\u0443\\u0439\\u0442\\u0435! \\u0425\\u043e\\u0447\\u0443 \\u043e\\u0444\\u043e\\u0440\\u043c\\u0438\\u0442\\u044c \\u0437\\u0430\\u043a\\u0430\\u0437:')) + '" placeholder="\\u0422\\u0435\\u043a\\u0441\\u0442 \\u043f\\u0440\\u0438 \\u043d\\u0430\\u0436\\u0430\\u0442\\u0438\\u0438 \\u043a\\u043d\\u043e\\u043f\\u043a\\u0438 \\u0417\\u0430\\u043a\\u0430\\u0437\\u0430\\u0442\\u044c">' +
    '<div style="margin-top:8px;display:flex;gap:8px;align-items:center"><label style="font-size:0.7rem;color:#FBBF24;font-weight:600;white-space:nowrap"><i class="fas fa-link" style="margin-right:4px"></i>\\u0421\\u0441\\u044b\\u043b\\u043a\\u0430 \\u043c\\u0435\\u0441\\u0441\\u0435\\u043d\\u0434\\u0436\\u0435\\u0440\\u0430</label><input class="input" id="pdf_order_tg" value="' + escHtml(t.order_telegram_url || 'https://t.me/goo_to_top') + '" placeholder="https://t.me/username \\u0438\\u043b\\u0438 https://wa.me/..." style="flex:1;font-size:0.85rem;border-color:rgba(251,191,36,0.3)"></div>' +
    '<div style="font-size:0.65rem;color:#475569;margin-top:4px"><i class="fas fa-info-circle" style="margin-right:3px"></i>\\u041f\\u043e\\u0434\\u0434\\u0435\\u0440\\u0436\\u0438\\u0432\\u0430\\u0435\\u0442 Telegram (t.me/...) \\u0438 WhatsApp (wa.me/...). \\u041a\\u043b\\u0438\\u0435\\u043d\\u0442 \\u043e\\u0442\\u043f\\u0440\\u0430\\u0432\\u0438\\u0442 \\u0441\\u043e\\u043e\\u0431\\u0449\\u0435\\u043d\\u0438\\u0435 \\u043f\\u043e \\u044d\\u0442\\u043e\\u0439 \\u0441\\u0441\\u044b\\u043b\\u043a\\u0435.</div></div>';
  h += '</div>';
  
  // ── 3. Company info (shared across languages) ──
  h += '<div class="card" style="margin-bottom:20px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;color:#a78bfa"><i class="fas fa-building" style="margin-right:8px"></i>\\u0414\\u0430\\u043d\\u043d\\u044b\\u0435 \\u043a\\u043e\\u043c\\u043f\\u0430\\u043d\\u0438\\u0438</h3>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">';
  h += '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">\\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435 \\u043a\\u043e\\u043c\\u043f\\u0430\\u043d\\u0438\\u0438</label><input class="input" id="pdf_company" value="' + escHtml(t.company_name || '') + '"></div>';
  h += '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">\\u0422\\u0435\\u043b\\u0435\\u0444\\u043e\\u043d</label><input class="input" id="pdf_phone" value="' + escHtml(t.company_phone || '') + '"></div>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">';
  h += '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Email</label><input class="input" id="pdf_email" value="' + escHtml(t.company_email || '') + '"></div>';
  h += '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">\\u0410\\u0434\\u0440\\u0435\\u0441</label><input class="input" id="pdf_address" value="' + escHtml(t.company_address || '') + '"></div>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">';
  h += '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">\\u0421\\u0430\\u0439\\u0442</label><input class="input" id="pdf_website" value="' + escHtml(t.company_website || '') + '" placeholder="https://gototop.agency"></div>';
  h += '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">\\u0418\\u041d\\u041d / \\u0420\\u0435\\u0433\\u0438\\u0441\\u0442\\u0440\\u0430\\u0446\\u0438\\u043e\\u043d\\u043d\\u044b\\u0439 \\u043d\\u043e\\u043c\\u0435\\u0440</label><input class="input" id="pdf_inn" value="' + escHtml(t.company_inn || '') + '" placeholder="00000000"></div>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  h += '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">\\u041b\\u043e\\u0433\\u043e\\u0442\\u0438\\u043f</label>';
  h += '<div style="display:flex;gap:8px;align-items:center">';
  var logoIsBase64 = t.company_logo_url && t.company_logo_url.indexOf('data:') === 0;
  if (t.company_logo_url) h += '<img id="pdf_logo_preview" src="' + t.company_logo_url + '" style="width:40px;height:40px;object-fit:contain;border-radius:6px;border:1px solid #334155" onerror="this.style.display=&apos;none&apos;">';
  // For base64 logos, show a friendly label instead of the huge string
  var logoDisplayVal = logoIsBase64 ? '\\u2705 \\u041b\\u043e\\u0433\\u043e\\u0442\\u0438\\u043f \\u0437\\u0430\\u0433\\u0440\\u0443\\u0436\\u0435\\u043d' : escHtml(t.company_logo_url || '');
  h += '<input class="input" id="pdf_logo_display" value="' + logoDisplayVal + '" placeholder="https://...logo.png" style="flex:1" readonly>';
  // Hidden input holds the actual value (base64 or URL)
  h += '<input type="hidden" id="pdf_logo" value="">';
  h += '<label class="btn btn-primary" style="padding:6px 14px;font-size:0.72rem;cursor:pointer;white-space:nowrap"><i class="fas fa-upload" style="margin-right:4px"></i>\\u0417\\u0430\\u0433\\u0440\\u0443\\u0437\\u0438\\u0442\\u044c<input type="file" accept="image/*" style="display:none" onchange="pdfUploadLogo(this)"></label>';
  if (t.company_logo_url) h += '<button class="btn btn-danger" style="padding:6px 10px;font-size:0.72rem" onclick="clearPdfLogo()" title="\\u0423\\u0434\\u0430\\u043b\\u0438\\u0442\\u044c \\u043b\\u043e\\u0433\\u043e\\u0442\\u0438\\u043f"><i class="fas fa-trash"></i></button>';
  h += '</div></div>';
  h += '</div></div>';
  
  // ── 4. Invoice Settings ──
  h += '<div class="card" style="margin-bottom:20px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;color:#a78bfa"><i class="fas fa-cog" style="margin-right:8px"></i>\\u041d\\u0430\\u0441\\u0442\\u0440\\u043e\\u0439\\u043a\\u0438 \\u0438\\u043d\\u0432\\u043e\\u0439\\u0441\\u0430</h3>';
  h += '<div style="display:grid;grid-template-columns:120px 120px 1fr;gap:16px">';
  h += '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">\\u041f\\u0440\\u0435\\u0444\\u0438\\u043a\\u0441 \\u2116</label><input class="input" id="pdf_prefix" value="' + escHtml(t.invoice_prefix || 'INV') + '" placeholder="INV"></div>';
  h += '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">\\u0410\\u043a\\u0446\\u0435\\u043d\\u0442\\u043d\\u044b\\u0439 \\u0446\\u0432\\u0435\\u0442</label><input class="input" type="color" id="pdf_accent" value="' + escHtml(t.accent_color || '#8B5CF6') + '" style="height:38px;padding:4px;cursor:pointer"></div>';
  h += '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">QR-\\u043a\\u043e\\u0434 \\u0441\\u0441\\u044b\\u043b\\u043a\\u0438 \\u043d\\u0430 \\u0441\\u0430\\u0439\\u0442</label><label style="display:flex;align-items:center;gap:8px;font-size:0.82rem;color:#94a3b8;margin-top:4px"><input type="checkbox" id="pdf_qr"' + (t.show_qr ? ' checked' : '') + ' style="accent-color:#8B5CF6;width:16px;height:16px">\\u041f\\u043e\\u043a\\u0430\\u0437\\u044b\\u0432\\u0430\\u0442\\u044c QR-\\u043a\\u043e\\u0434</label></div>';
  h += '</div></div>';
  
  // ── 5. Quick stats & Preview ──
  h += '<div class="card" style="margin-bottom:20px;background:rgba(139,92,246,0.04);border-color:rgba(139,92,246,0.2)">';
  h += '<h3 style="font-weight:700;margin-bottom:12px;color:#a78bfa"><i class="fas fa-chart-bar" style="margin-right:8px"></i>\\u0421\\u0442\\u0430\\u0442\\u0438\\u0441\\u0442\\u0438\\u043a\\u0430 \\u043b\\u0438\\u0434\\u043e\\u0432 PDF</h3>';
  var leads = (data.leads && data.leads.leads) ? data.leads.leads : (Array.isArray(data.leads) ? data.leads : []);
  var pdfLeads = leads.filter(function(l) { return l.source === 'calculator_pdf'; });
  var totalRevenue = pdfLeads.reduce(function(s, l) { return s + (parseFloat(l.total_amount) || 0); }, 0);
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">';
  h += '<div style="text-align:center;padding:12px;background:#0f172a;border-radius:8px"><div style="font-size:1.5rem;font-weight:800;color:#8B5CF6">' + pdfLeads.length + '</div><div style="font-size:0.72rem;color:#64748b">\\u0417\\u0430\\u044f\\u0432\\u043e\\u043a \\u0447\\u0435\\u0440\\u0435\\u0437 PDF</div></div>';
  h += '<div style="text-align:center;padding:12px;background:#0f172a;border-radius:8px"><div style="font-size:1.5rem;font-weight:800;color:#10B981">' + Math.round(totalRevenue).toLocaleString('ru-RU') + ' \\u058f</div><div style="font-size:0.72rem;color:#64748b">\\u041e\\u0431\\u0449\\u0430\\u044f \\u0441\\u0443\\u043c\\u043c\\u0430</div></div>';
  var avgAmount = pdfLeads.length > 0 ? Math.round(totalRevenue / pdfLeads.length) : 0;
  h += '<div style="text-align:center;padding:12px;background:#0f172a;border-radius:8px"><div style="font-size:1.5rem;font-weight:800;color:#F59E0B">' + avgAmount.toLocaleString('ru-RU') + ' \\u058f</div><div style="font-size:0.72rem;color:#64748b">\\u0421\\u0440\\u0435\\u0434\\u043d\\u0438\\u0439 \\u0447\\u0435\\u043a</div></div>';
  var todayLeads = pdfLeads.filter(function(l) { var d = new Date(l.created_at); var n = new Date(); return d.toDateString() === n.toDateString(); }).length;
  h += '<div style="text-align:center;padding:12px;background:#0f172a;border-radius:8px"><div style="font-size:1.5rem;font-weight:800;color:#60a5fa">' + todayLeads + '</div><div style="font-size:0.72rem;color:#64748b">\\u0421\\u0435\\u0433\\u043e\\u0434\\u043d\\u044f</div></div>';
  h += '</div>';
  
  // Recent PDF leads
  if (pdfLeads.length > 0) {
    h += '<div style="margin-top:16px"><div style="font-size:0.78rem;font-weight:700;color:#94a3b8;margin-bottom:8px"><i class="fas fa-history" style="margin-right:4px"></i>\\u041f\\u043e\\u0441\\u043b\\u0435\\u0434\\u043d\\u0438\\u0435 \\u0437\\u0430\\u044f\\u0432\\u043a\\u0438 PDF</div>';
    h += '<div style="overflow-x:auto"><table style="width:100%;font-size:0.75rem;border-collapse:collapse">';
    h += '<tr style="color:#64748b"><th style="text-align:left;padding:6px 8px">#</th><th style="text-align:left;padding:6px 8px">\\u0418\\u043c\\u044f</th><th style="text-align:left;padding:6px 8px">\\u041a\\u043e\\u043d\\u0442\\u0430\\u043a\\u0442</th><th style="text-align:right;padding:6px 8px">\\u0421\\u0443\\u043c\\u043c\\u0430</th><th style="text-align:left;padding:6px 8px">\\u0414\\u0430\\u0442\\u0430</th><th style="padding:6px 8px"></th></tr>';
    var recentPdf = pdfLeads.slice(0, 5);
    for (var rpi = 0; rpi < recentPdf.length; rpi++) {
      var rl = recentPdf[rpi];
      h += '<tr style="border-top:1px solid #1e293b">' +
        '<td style="padding:6px 8px;color:#8B5CF6;font-weight:600">#' + (rl.lead_number || rl.id) + '</td>' +
        '<td style="padding:6px 8px">' + escHtml(rl.name || '-') + '</td>' +
        '<td style="padding:6px 8px;color:#60a5fa">' + escHtml(rl.contact || '-') + '</td>' +
        '<td style="padding:6px 8px;text-align:right;font-weight:600;color:#10B981">' + Math.round(parseFloat(rl.total_amount) || 0).toLocaleString('ru-RU') + ' \\u058f</td>' +
        '<td style="padding:6px 8px;color:#64748b">' + (rl.created_at ? new Date(rl.created_at).toLocaleString('ru') : '-') + '</td>' +
        '<td style="padding:6px 8px;white-space:nowrap"><a href="/pdf/' + rl.id + '" target="_blank" class="btn btn-outline" style="padding:2px 8px;font-size:0.68rem;margin-right:4px"><i class="fas fa-eye"></i></a>' +
        '<button class="btn btn-danger" style="padding:2px 8px;font-size:0.68rem" onclick="deletePdfLead(' + rl.id + ')"><i class="fas fa-trash"></i></button></td>' +
      '</tr>';
    }
    h += '</table></div></div>';
  }
  h += '</div>';
  
  // Save button
  h += '<button class="btn btn-success" style="min-width:200px;font-size:1rem;padding:14px 24px" onclick="savePdfTemplate()"><i class="fas fa-save" style="margin-right:8px"></i>\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0438\\u0442\\u044c \\u0448\\u0430\\u0431\\u043b\\u043e\\u043d</button>';
  h += '</div>';
  return h;
}

async function deletePdfLead(id) {
  if (!confirm('Удалить эту PDF-заявку? Действие необратимо.')) return;
  await api('/leads/' + id, { method: 'DELETE' });
  toast('PDF-заявка удалена');
  await loadData(); render();
}

async function savePdfTemplate() {
  // First collect current visible fields into data.pdfTemplate
  collectPdfFields();
  var t = data.pdfTemplate || {};
  var payload = {};
  var langs = ['ru', 'am', 'en'];
  for (var li = 0; li < langs.length; li++) {
    var l = langs[li];
    var sfx = '_' + l;
    // For each field: use DOM value if present, otherwise use data.pdfTemplate value
    var hEl = document.getElementById('pdf_header' + sfx);
    var iEl = document.getElementById('pdf_intro' + sfx);
    var oEl = document.getElementById('pdf_outro' + sfx);
    var fEl = document.getElementById('pdf_footer' + sfx);
    var boEl = document.getElementById('pdf_btn_order' + sfx);
    var bdEl = document.getElementById('pdf_btn_dl' + sfx);
    var tEl = document.getElementById('pdf_terms' + sfx);
    var bkEl = document.getElementById('pdf_bank' + sfx);
    payload['header' + sfx] = hEl ? hEl.value : (t['header' + sfx] || '');
    payload['intro' + sfx] = iEl ? iEl.value : (t['intro' + sfx] || '');
    payload['outro' + sfx] = oEl ? oEl.value : (t['outro' + sfx] || '');
    payload['footer' + sfx] = fEl ? fEl.value : (t['footer' + sfx] || '');
    payload['btn_order' + sfx] = boEl ? boEl.value : (t['btn_order' + sfx] || '');
    payload['btn_download' + sfx] = bdEl ? bdEl.value : (t['btn_download' + sfx] || '');
    payload['terms' + sfx] = tEl ? tEl.value : (t['terms' + sfx] || '');
    payload['bank_details' + sfx] = bkEl ? bkEl.value : (t['bank_details' + sfx] || '');
    // Save table label fields
    var labelKeys = ['label_service','label_qty','label_price','label_sum','label_total','label_subtotal','label_client','label_date','label_invoice','label_back','order_message'];
    for (var lki = 0; lki < labelKeys.length; lki++) {
      var lkKey = labelKeys[lki] + sfx;
      var lkEl = document.getElementById('pdf_' + lkKey);
      payload[lkKey] = lkEl ? lkEl.value : (t[lkKey] || '');
    }
  }
  // Shared fields
  var fields = { 'pdf_company': 'company_name', 'pdf_phone': 'company_phone', 'pdf_email': 'company_email', 'pdf_address': 'company_address', 'pdf_website': 'company_website', 'pdf_inn': 'company_inn', 'pdf_order_tg': 'order_telegram_url', 'pdf_prefix': 'invoice_prefix', 'pdf_accent': 'accent_color' };
  var fkeys = Object.keys(fields);
  for (var fi = 0; fi < fkeys.length; fi++) {
    var el = document.getElementById(fkeys[fi]);
    if (el) payload[fields[fkeys[fi]]] = el.value;
  }
  // Logo: use the in-memory value (may be base64), don't read from DOM input
  if (data.pdfTemplate && data.pdfTemplate.company_logo_url) {
    payload.company_logo_url = data.pdfTemplate.company_logo_url;
  }
  var qrEl = document.getElementById('pdf_qr');
  if (qrEl) payload.show_qr = qrEl.checked ? 1 : 0;
  
  var result = await api('/pdf-template', { method: 'PUT', body: JSON.stringify(payload) });
  if (!result || !result.success) {
    toast('Ошибка сохранения шаблона: ' + (result && result.error ? result.error : 'Сервер не ответил'), 'error');
    return;
  }
  // Use server-returned data if available to ensure data consistency
  if (result.data) {
    data.pdfTemplate = result.data;
  } else {
    data.pdfTemplate = Object.assign(data.pdfTemplate || {}, payload);
  }
  toast('Шаблон PDF сохранён! Изменения отразятся в новых PDF.');
  render();
}

// ── Upload logo for PDF template ──
async function pdfUploadLogo(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Файл слишком большой (макс. 5 МБ)', 'error'); return; }
  toast('Загрузка логотипа...');
  var formData = new FormData();
  formData.append('file', file);
  formData.append('block_id', 'logo');
  try {
    var resp = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData });
    var result = await resp.json();
    if (!result.success) { toast('Ошибка: ' + (result.error || 'unknown'), 'error'); return; }
    // Prefer data_url (base64) for logo — it embeds directly in the DB
    // and renders in PDF without needing a separate upload endpoint.
    // Server-relative URLs like /api/admin/uploads/N break when DB resets.
    var url = result.data_url || result.url;
    var logoInput = document.getElementById('pdf_logo');
    if (logoInput) logoInput.value = url;
    if (!data.pdfTemplate) data.pdfTemplate = {};
    data.pdfTemplate.company_logo_url = url;
    // Immediately save logo URL to DB so it persists across page reloads
    await api('/pdf-template', { method: 'PUT', body: JSON.stringify({ company_logo_url: url }) });
    toast('Логотип загружен и сохранён!');
    render();
  } catch(e) {
    toast('Ошибка загрузки: ' + (e.message || 'network error'), 'error');
  }
}

async function clearPdfLogo() {
  if (!confirm('Удалить логотип из шаблона?')) return;
  if (!data.pdfTemplate) data.pdfTemplate = {};
  data.pdfTemplate.company_logo_url = '';
  await api('/pdf-template', { method: 'PUT', body: JSON.stringify({ company_logo_url: '' }) });
  toast('Логотип удалён');
  render();
}

// ===== SLOT COUNTER =====
function renderSlotCounter() {
  var counters = data.slotCounters || [];
  // Build positions from section order dynamically
  var positions = [];
  var sections = data.sectionOrder || [];
  for (var si = 0; si < sections.length; si++) {
    var sid = sections[si].section_id;
    var sLabel = sections[si].label_ru || sid;
    positions.push({ id: 'before-' + sid, label: '⬆ Перед: ' + sLabel });
    positions.push({ id: 'after-' + sid, label: '⬇ После: ' + sLabel });
    positions.push({ id: 'in-' + sid, label: '📍 Внутри: ' + sLabel });
  }
  // Fallback positions
  if (positions.length === 0) {
    positions = [
      { id: 'in-header', label: 'В шапке сайта' },
      { id: 'after-hero', label: 'После Hero' },
      { id: 'before-calc', label: 'Перед калькулятором' },
      { id: 'before-contact', label: 'Перед контактами' }
    ];
  }

  var h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px"><i class="fas fa-clock" style="color:#8B5CF6;margin-right:10px"></i>Счётчики свободных мест</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Создавайте неограниченное количество счётчиков и размещайте их в любом блоке сайта</p>';

  h += '<button class="btn btn-primary" style="margin-bottom:20px" onclick="addSlotCounter()"><i class="fas fa-plus" style="margin-right:6px"></i>Добавить счётчик</button>';

  for (var ci = 0; ci < counters.length; ci++) {
    var s = counters[ci];
    var cid = s.id;
    var pos = s.position || 'after-hero';
    var free = Math.max(0, (s.total_slots || 10) - (s.booked_slots || 0));
    var pct = s.total_slots > 0 ? Math.round((free / s.total_slots) * 100) : 0;
    var barColor = pct > 50 ? '#10B981' : pct > 20 ? '#F59E0B' : '#EF4444';

    h += '<div class="card" style="margin-bottom:20px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<h3 style="font-weight:700;display:flex;align-items:center;gap:10px"><i class="fas fa-hashtag" style="color:#8B5CF6"></i>Счётчик #' + (ci+1) + ' <span style="color:#a78bfa;font-size:0.9rem">' + escHtml(s.counter_name || 'main') + '</span>' +
      (s.show_timer ? ' <span class="badge badge-green">Видим</span>' : ' <span class="badge" style="background:rgba(239,68,68,0.2);color:#f87171">Скрыт</span>') +
      '</h3>' +
      '<button class="btn btn-danger" style="font-size:0.8rem;padding:6px 14px" onclick="deleteSlotCounter('+cid+')"><i class="fas fa-trash"></i></button>' +
      '</div>' +

      // Visual bar preview
      '<div style="margin-bottom:16px;padding:12px;background:#0f172a;border-radius:8px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<span style="font-size:0.82rem;color:#94a3b8">' + escHtml(s.label_ru || 'Свободных мест') + '</span>' +
          '<span style="font-size:1.4rem;font-weight:800;color:' + barColor + '">' + free + '<span style="color:#64748b;font-weight:400;font-size:0.85rem"> / ' + s.total_slots + '</span></span>' +
        '</div>' +
        '<div style="height:8px;background:#1e293b;border-radius:4px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:4px;transition:width 0.3s"></div></div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:16px">' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Имя</label><input class="input" id="sc_name_'+cid+'" value="' + escHtml(s.counter_name) + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Всего мест</label><input class="input" type="number" id="sc_total_'+cid+'" value="' + (s.total_slots || 10) + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Занято</label><input class="input" type="number" id="sc_booked_'+cid+'" value="' + (s.booked_slots || 0) + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Свободно</label><div style="font-size:1.8rem;font-weight:800;color:#10B981;padding:6px 0">' + free + '</div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Надпись (RU)</label><input class="input" id="sc_lru_'+cid+'" value="' + escHtml(s.label_ru) + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Надпись (AM)</label><input class="input" id="sc_lam_'+cid+'" value="' + escHtml(s.label_am) + '"></div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><input type="checkbox" id="sc_show_'+cid+'"' + (s.show_timer ? ' checked' : '') + '><label style="font-size:0.9rem;color:#94a3b8">Показывать на сайте</label></div>' +
      '<div style="margin-bottom:12px"><label style="font-size:0.75rem;color:#64748b;font-weight:600;margin-bottom:8px;display:block">Позиция на странице (привязка к блоку)</label><select class="input" id="sc_pos_'+cid+'" style="cursor:pointer">';
    for (var pi = 0; pi < positions.length; pi++) {
      h += '<option value="'+positions[pi].id+'"'+(pos===positions[pi].id?' selected':'')+'>'+escHtml(positions[pi].label)+'</option>';
    }
    h += '</select></div>' +
      '<button class="btn btn-success" onclick="saveSlotCounter('+cid+')"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить</button>' +
    '</div>';
  }

  if (counters.length === 0) {
    h += '<div class="card" style="text-align:center;padding:40px;color:#64748b"><i class="fas fa-clock" style="font-size:3rem;color:#334155;margin-bottom:12px;display:block"></i>Нет счётчиков. Нажмите «Добавить счётчик» чтобы создать.</div>';
  }

  h += '</div>';
  return h;
}

async function addSlotCounter() {
  await api('/slot-counter', { method: 'POST', body: JSON.stringify({ counter_name: 'Счётчик ' + ((data.slotCounters || []).length + 1), total_slots: 10, booked_slots: 0, show_timer: 1, position: 'after-hero' }) });
  toast('Счётчик создан');
  await loadData(); render();
}

async function saveSlotCounter(id) {
  await api('/slot-counter/' + id, { method: 'PUT', body: JSON.stringify({
    counter_name: document.getElementById('sc_name_'+id).value,
    total_slots: parseInt(document.getElementById('sc_total_'+id).value) || 10,
    booked_slots: parseInt(document.getElementById('sc_booked_'+id).value) || 0,
    label_ru: document.getElementById('sc_lru_'+id).value,
    label_am: document.getElementById('sc_lam_'+id).value,
    show_timer: document.getElementById('sc_show_'+id).checked ? 1 : 0,
    position: document.getElementById('sc_pos_'+id).value
  }) });
  toast('Счётчик обновлён');
  await loadData(); render();
}

async function deleteSlotCounter(id) {
  if (!confirm('Удалить счётчик?')) return;
  await api('/slot-counter/' + id, { method: 'DELETE' });
  toast('Счётчик удалён');
  await loadData(); render();
}

// ===== FOOTER =====
function renderFooter() {
  var f = data.footer || {};
  var contacts = [];
  try { contacts = JSON.parse(f.contacts_json || '[]'); } catch(e) { contacts = []; }
  var socials = [];
  try { socials = JSON.parse(f.socials_json || '[]'); } catch(e) { socials = []; }

  var h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Футер сайта</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Редактирование контактов, соцсетей и содержимого подвала</p>';

  // Brand text
  h += '<div class="card" style="margin-bottom:20px"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-building" style="color:#8B5CF6;margin-right:8px"></i>Описание компании</h3>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
    '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Текст (RU)</label><textarea class="input" id="ft_brand_ru" rows="3">' + escHtml(f.brand_text_ru) + '</textarea></div>' +
    '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Текст (AM)</label><textarea class="input" id="ft_brand_am" rows="3">' + escHtml(f.brand_text_am) + '</textarea></div>' +
    '</div></div>';

  // Contacts
  h += '<div class="card" style="margin-bottom:20px"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-address-book" style="color:#10B981;margin-right:8px"></i>Контакты <button class="btn btn-outline" style="font-size:0.75rem;padding:4px 12px;margin-left:12px" onclick="addFooterContact()"><i class="fas fa-plus"></i> Добавить</button></h3>';
  h += '<div id="footerContactsList">';
  for (var ci = 0; ci < contacts.length; ci++) {
    var ct = contacts[ci];
    h += '<div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr auto;gap:8px;align-items:center;margin-bottom:8px;padding:10px;background:#0f172a;border-radius:8px">' +
      '<select class="input" style="width:140px" id="fc_icon_'+ci+'"><option value="fab fa-telegram"'+(ct.icon==='fab fa-telegram'?' selected':'')+'>Telegram</option><option value="fab fa-whatsapp"'+(ct.icon==='fab fa-whatsapp'?' selected':'')+'>WhatsApp</option><option value="fas fa-phone"'+(ct.icon==='fas fa-phone'?' selected':'')+'>Телефон</option><option value="fas fa-envelope"'+(ct.icon==='fas fa-envelope'?' selected':'')+'>Email</option><option value="fab fa-instagram"'+(ct.icon==='fab fa-instagram'?' selected':'')+'>Instagram</option></select>' +
      '<input class="input" placeholder="\\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435 (RU)" id="fc_name_'+ci+'" value="'+escHtml(ct.name_ru)+'">' +
      '<input class="input" placeholder="\\u0531\\u0576\\u057e\\u0561\\u0576\\u0578\\u0582\\u0574 (AM)" id="fc_name_am_'+ci+'" value="'+escHtml(ct.name_am || '')+'">' +
      '<input class="input" placeholder="\\u0421\\u0441\\u044b\\u043b\\u043a\\u0430/URL" id="fc_url_'+ci+'" value="'+escHtml(ct.url)+'">' +
      '<button class="tier-del-btn" onclick="removeFooterContact('+ci+')"><i class="fas fa-times"></i></button>' +
    '</div>';
  }
  h += '</div></div>';

  // Social links
  h += '<div class="card" style="margin-bottom:20px"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-share-alt" style="color:#F59E0B;margin-right:8px"></i>Соцсети <button class="btn btn-outline" style="font-size:0.75rem;padding:4px 12px;margin-left:12px" onclick="addFooterSocial()"><i class="fas fa-plus"></i> Добавить</button></h3>';
  h += '<div id="footerSocialsList">';
  for (var si = 0; si < socials.length; si++) {
    var sc = socials[si];
    h += '<div style="display:grid;grid-template-columns:auto 1fr 1fr auto;gap:8px;align-items:center;margin-bottom:8px;padding:10px;background:#0f172a;border-radius:8px">' +
      '<select class="input" style="width:140px" id="fs_icon_'+si+'"><option value="fab fa-telegram"'+(sc.icon==='fab fa-telegram'?' selected':'')+'>Telegram</option><option value="fab fa-whatsapp"'+(sc.icon==='fab fa-whatsapp'?' selected':'')+'>WhatsApp</option><option value="fab fa-instagram"'+(sc.icon==='fab fa-instagram'?' selected':'')+'>Instagram</option><option value="fab fa-facebook"'+(sc.icon==='fab fa-facebook'?' selected':'')+'>Facebook</option><option value="fab fa-youtube"'+(sc.icon==='fab fa-youtube'?' selected':'')+'>YouTube</option><option value="fab fa-tiktok"'+(sc.icon==='fab fa-tiktok'?' selected':'')+'>TikTok</option></select>' +
      '<input class="input" placeholder="Название" id="fs_name_'+si+'" value="'+escHtml(sc.name)+'">' +
      '<input class="input" placeholder="URL" id="fs_url_'+si+'" value="'+escHtml(sc.url)+'">' +
      '<button class="tier-del-btn" onclick="removeFooterSocial('+si+')"><i class="fas fa-times"></i></button>' +
    '</div>';
  }
  h += '</div></div>';

  // Copyright + location
  h += '<div class="card" style="margin-bottom:20px"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-copyright" style="color:#94a3b8;margin-right:8px"></i>Копирайт</h3>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
    '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Копирайт (RU)</label><input class="input" id="ft_copy_ru" value="'+escHtml(f.copyright_ru)+'"></div>' +
    '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Копирайт (AM)</label><input class="input" id="ft_copy_am" value="'+escHtml(f.copyright_am)+'"></div>' +
    '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
    '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Локация (RU)</label><input class="input" id="ft_loc_ru" value="'+escHtml(f.location_ru)+'"></div>' +
    '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Локация (AM)</label><input class="input" id="ft_loc_am" value="'+escHtml(f.location_am)+'"></div>' +
    '</div></div>';

  // Custom HTML
  h += '<div class="card" style="margin-bottom:20px"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-code" style="color:#EF4444;margin-right:8px"></i>Произвольный HTML</h3>' +
    '<textarea class="input" id="ft_html" rows="4" placeholder="Дополнительный HTML для футера">' + escHtml(f.custom_html) + '</textarea></div>';

  h += '<button class="btn btn-success" onclick="saveFooter()"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить футер</button></div>';
  return h;
}

var _footerContacts = [];
var _footerSocials = [];
function initFooterData() {
  try { _footerContacts = JSON.parse(data.footer.contacts_json || '[]'); } catch(e) { _footerContacts = []; }
  try { _footerSocials = JSON.parse(data.footer.socials_json || '[]'); } catch(e) { _footerSocials = []; }
}

function addFooterContact() {
  initFooterData();
  _footerContacts.push({ icon: 'fab fa-telegram', name_ru: '', name_am: '', url: '' });
  data.footer.contacts_json = JSON.stringify(_footerContacts);
  render();
}
function removeFooterContact(idx) {
  initFooterData();
  _footerContacts.splice(idx, 1);
  data.footer.contacts_json = JSON.stringify(_footerContacts);
  render();
}
function addFooterSocial() {
  initFooterData();
  _footerSocials.push({ icon: 'fab fa-telegram', name: '', url: '' });
  data.footer.socials_json = JSON.stringify(_footerSocials);
  render();
}
function removeFooterSocial(idx) {
  initFooterData();
  _footerSocials.splice(idx, 1);
  data.footer.socials_json = JSON.stringify(_footerSocials);
  render();
}

function collectFooterContacts() {
  var arr = [];
  for (var i = 0; ; i++) {
    var iconEl = document.getElementById('fc_icon_'+i);
    if (!iconEl) break;
    var nameAmEl = document.getElementById('fc_name_am_'+i);
    arr.push({ icon: iconEl.value, name_ru: document.getElementById('fc_name_'+i).value, name_am: nameAmEl ? nameAmEl.value : '', url: document.getElementById('fc_url_'+i).value });
  }
  return arr;
}
function collectFooterSocials() {
  var arr = [];
  for (var i = 0; ; i++) {
    var iconEl = document.getElementById('fs_icon_'+i);
    if (!iconEl) break;
    arr.push({ icon: iconEl.value, name: document.getElementById('fs_name_'+i).value, url: document.getElementById('fs_url_'+i).value });
  }
  return arr;
}

async function saveFooter() {
  await api('/footer', { method: 'PUT', body: JSON.stringify({
    brand_text_ru: document.getElementById('ft_brand_ru').value,
    brand_text_am: document.getElementById('ft_brand_am').value,
    contacts_json: JSON.stringify(collectFooterContacts()),
    socials_json: JSON.stringify(collectFooterSocials()),
    copyright_ru: document.getElementById('ft_copy_ru').value,
    copyright_am: document.getElementById('ft_copy_am').value,
    location_ru: document.getElementById('ft_loc_ru').value,
    location_am: document.getElementById('ft_loc_am').value,
    custom_html: document.getElementById('ft_html').value
  }) });
  toast('Футер сохранён');
  await loadData(); render();
}

// ===== PHOTO BLOCKS =====
function renderPhotos() {
  var blocks = data.photoBlocks || [];
  // Dynamic positions from section order
  var positions = [];
  var sections = data.sectionOrder || [];
  for (var si = 0; si < sections.length; si++) {
    positions.push({ id: sections[si].section_id, label: escHtml(sections[si].label_ru || sections[si].section_id) });
  }
  if (positions.length === 0) {
    positions = [
      { id: 'after-hero', label: 'После Hero' },
      { id: 'after-services', label: 'После услуг' },
      { id: 'before-calc', label: 'Перед калькулятором' },
      { id: 'after-about', label: 'После «О нас»' },
      { id: 'before-contact', label: 'Перед контактами' },
      { id: 'after-guarantee', label: 'После гарантий' }
    ];
  }

  var h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px"><i class="fas fa-images" style="color:#8B5CF6;margin-right:10px"></i>Фото блоки</h1>' +
    '<p style="color:#94a3b8;margin-bottom:12px">Создавайте фото-блоки с описаниями и размещайте их на сайте. Загружайте фото с устройства или вставляйте URL.</p>' +
    '<div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:14px 18px;margin-bottom:20px;font-size:0.85rem;color:#c4b5fd">' +
    '<i class="fas fa-lightbulb" style="color:#F59E0B;margin-right:8px"></i><strong>Совет:</strong> Для блока «Отзывы клиентов» — загрузите фото, они отобразятся по одному в карусели с навигацией, описаниями и подсказкой листать. Добавьте подпись к каждому фото — это повышает доверие.</div>' +
    '<button class="btn btn-primary" style="margin-bottom:20px" onclick="addPhotoBlock()"><i class="fas fa-plus" style="margin-right:6px"></i>Добавить фото-блок</button>' +
    '<button class="btn btn-outline" style="margin-bottom:20px;margin-left:10px;border-color:rgba(245,158,11,0.4);color:#F59E0B" onclick="addReviewsBlock()"><i class="fas fa-star" style="margin-right:6px"></i>Создать блок «Отзывы»</button>';

  for (var bi = 0; bi < blocks.length; bi++) {
    var b = blocks[bi];
    var photos = [];
    try { photos = JSON.parse(b.photos_json || '[]'); } catch(e) { photos = []; }
    h += '<div class="card" style="margin-bottom:20px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<h3 style="font-weight:700"><i class="fas fa-images" style="color:#8B5CF6;margin-right:8px"></i>' + escHtml(b.block_name || 'Блок #'+(bi+1)) + ' <span style="font-size:0.75rem;color:#64748b;font-weight:400">(' + photos.length + ' фото)</span></h3>' +
      '<div style="display:flex;gap:8px"><label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;color:#94a3b8"><input type="checkbox" id="pb_vis_'+b.id+'"'+(b.is_visible?' checked':'')+'>Видимый</label>' +
      '<button class="btn btn-outline" style="font-size:0.8rem;padding:6px 14px;color:#8B5CF6;border-color:rgba(139,92,246,0.3)" onclick="duplicatePhotoBlock('+b.id+')"><i class="fas fa-copy" style="margin-right:4px"></i>Дублировать</button>' +
      '<button class="btn btn-danger" style="font-size:0.8rem;padding:6px 14px" onclick="deletePhotoBlock('+b.id+')"><i class="fas fa-trash"></i></button></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Имя блока</label><input class="input" id="pb_name_'+b.id+'" value="'+escHtml(b.block_name)+'"></div>' +
      '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Позиция</label><select class="input" id="pb_pos_'+b.id+'">';
    for (var pi = 0; pi < positions.length; pi++) {
      h += '<option value="'+positions[pi].id+'"'+(b.position===positions[pi].id?' selected':'')+'>'+positions[pi].label+'</option>';
    }
    h += '</select></div><div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Порядок</label><input class="input" type="number" id="pb_order_'+b.id+'" value="'+(b.sort_order||0)+'"></div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Описание (RU)</label><textarea class="input" id="pb_desc_ru_'+b.id+'" rows="2">'+escHtml(b.description_ru)+'</textarea></div>' +
      '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Описание (AM)</label><textarea class="input" id="pb_desc_am_'+b.id+'" rows="2">'+escHtml(b.description_am)+'</textarea></div>' +
      '</div>';

    // ── Photo gallery with previews ──
    h += '<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
      '<label style="font-size:0.8rem;color:#a78bfa;font-weight:700"><i class="fas fa-camera" style="margin-right:6px"></i>Фотографии (' + photos.length + ')</label>' +
      '<div style="display:flex;gap:6px">' +
      '<label class="btn btn-primary" style="padding:6px 14px;font-size:0.78rem;cursor:pointer"><i class="fas fa-upload" style="margin-right:5px"></i>Загрузить с устройства<input type="file" accept="image/*" multiple style="display:none" onchange="pbUploadPhotos(this,'+b.id+')"></label>' +
      '<button class="btn btn-outline" style="font-size:0.78rem;padding:6px 14px" onclick="addPhotoToBlock('+b.id+')"><i class="fas fa-link" style="margin-right:4px"></i>URL</button>' +
      '</div></div>';

    // Photo grid with previews
    if (photos.length > 0) {
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
      for (var phi = 0; phi < photos.length; phi++) {
        var photoUrl = photos[phi].url || '';
        var hasPreview = photoUrl && (photoUrl.startsWith('http') || photoUrl.startsWith('/'));
        h += '<div style="background:#1a2236;border:1px solid #293548;border-radius:10px;overflow:hidden">';
        // Preview
        if (hasPreview) {
          h += '<div style="height:140px;background:#0f172a;display:flex;align-items:center;justify-content:center;overflow:hidden">' +
            '<img src="' + escHtml(photoUrl) + '" style="max-width:100%;max-height:140px;object-fit:contain" onerror="this.style.display=&apos;none&apos;">' +
          '</div>';
        }
        h += '<div style="padding:10px">' +
          '<input class="input" id="pb_photo_'+b.id+'_'+phi+'" value="'+escHtml(photoUrl)+'" placeholder="URL фотографии" style="font-size:0.82rem;margin-bottom:6px">' +
          '<input class="input" id="pb_pcap_'+b.id+'_'+phi+'" value="'+escHtml(photos[phi].caption||'')+'" placeholder="Подпись к фото" style="font-size:0.82rem;margin-bottom:8px">' +
          '<div style="display:flex;gap:6px">' +
          '<label class="btn btn-outline" style="padding:4px 10px;font-size:0.72rem;cursor:pointer;flex:1;text-align:center"><i class="fas fa-upload" style="margin-right:3px"></i>Заменить<input type="file" accept="image/*" style="display:none" onchange="pbReplacePhoto(this,'+b.id+','+phi+')"></label>' +
          '<button class="btn btn-outline" style="padding:4px 10px;font-size:0.72rem;color:#f87171;border-color:rgba(248,113,113,0.3);flex:1" onclick="removePhotoFromBlock('+b.id+','+phi+')"><i class="fas fa-trash" style="margin-right:3px"></i>Удалить</button>' +
          '</div></div></div>';
      }
      h += '</div>';
    } else {
      h += '<div style="padding:24px;text-align:center;background:#1a2236;border:2px dashed #293548;border-radius:10px;color:#475569">' +
        '<i class="fas fa-cloud-upload-alt" style="font-size:1.5rem;margin-bottom:8px;display:block"></i>' +
        '<div style="font-size:0.85rem">Нет фотографий. Загрузите с устройства или добавьте URL</div>' +
        '<div style="font-size:0.72rem;margin-top:4px;color:#334155">Рекомендуемый размер: 800×600 px, JPG/PNG/WebP, макс. 5 МБ</div>' +
      '</div>';
    }
    h += '</div>';

    h += '<button class="btn btn-success" onclick="savePhotoBlock('+b.id+')" style="margin-right:8px"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить</button>' +
      '</div>';
  }

  if (blocks.length === 0) {
    h += '<div class="card" style="text-align:center;padding:40px;color:#64748b"><i class="fas fa-images" style="font-size:3rem;color:#334155;margin-bottom:12px;display:block"></i>Нет фото-блоков. Нажмите «Добавить» чтобы создать.</div>';
  }

  h += '</div>';
  return h;
}

// ── Upload photos to photo block from device ──
async function pbUploadPhotos(input, blockId) {
  var files = input.files;
  if (!files || files.length === 0) return;
  toast('Загрузка ' + files.length + ' фото...');
  var block = (data.photoBlocks||[]).find(function(b){return b.id===blockId});
  if (!block) return;
  var photos = [];
  try { photos = JSON.parse(block.photos_json || '[]'); } catch(e) { photos = []; }
  var uploaded = 0;

  for (var fi = 0; fi < files.length; fi++) {
    var file = files[fi];
    if (file.size > 5 * 1024 * 1024) { toast('Пропущен: ' + file.name + ' (> 5 МБ)', 'error'); continue; }
    var formData = new FormData();
    formData.append('file', file);
    formData.append('block_id', 'photoblock_' + blockId);
    try {
      var resp = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData });
      var result = await resp.json();
      if (result.success) {
        photos.push({ url: result.url || result.data_url, caption: '' });
        uploaded++;
      }
    } catch(e) {}
  }
  block.photos_json = JSON.stringify(photos);
  render();
  if (uploaded > 0) {
    toast(uploaded + ' фото загружено!');
    savePhotoBlock(blockId);
  }
}

// ── Replace single photo in photo block ──
async function pbReplacePhoto(input, blockId, photoIdx) {
  var file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Файл слишком большой (макс. 5 МБ)', 'error'); return; }
  toast('Загрузка фото...');
  var formData = new FormData();
  formData.append('file', file);
  formData.append('block_id', 'photoblock_' + blockId);
  try {
    var resp = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData });
    var result = await resp.json();
    if (result.success) {
      var block = (data.photoBlocks||[]).find(function(b){return b.id===blockId});
      if (!block) return;
      var photos = [];
      try { photos = JSON.parse(block.photos_json || '[]'); } catch(e) { photos = []; }
      if (photoIdx < photos.length) {
        photos[photoIdx].url = result.url || result.data_url;
        block.photos_json = JSON.stringify(photos);
        render();
        savePhotoBlock(blockId);
        toast('Фото заменено!');
      }
    }
  } catch(e) {
    toast('Ошибка загрузки: ' + (e.message || 'network error'), 'error');
  }
}

// ── Duplicate photo block ──
async function dupPhotoBlock(id) {
  var block = (data.photoBlocks||[]).find(function(b){return b.id===id});
  if (!block) return;
  await api('/photo-blocks', { method: 'POST', body: JSON.stringify({
    block_name: (block.block_name || 'Блок') + ' (копия)',
    position: block.position,
    is_visible: block.is_visible,
    photos_json: block.photos_json || '[]',
    description_ru: block.description_ru || '',
    description_am: block.description_am || '',
    sort_order: (block.sort_order || 0) + 1
  }) });
  toast('Блок дублирован');
  await loadData(); render();
}

async function addPhotoBlock() {
  await api('/photo-blocks', { method: 'POST', body: JSON.stringify({ block_name: 'Фото блок ' + ((data.photoBlocks||[]).length+1), position: 'after-services', is_visible: 1, photos_json: '[]' }) });
  toast('Блок создан');
  await loadData(); render();
}

async function duplicatePhotoBlock(blockId) {
  var block = (data.photoBlocks||[]).find(function(b){return b.id===blockId});
  if (!block) return;
  await api('/photo-blocks', { method: 'POST', body: JSON.stringify({
    block_name: (block.block_name || 'Блок') + ' (копия)',
    position: block.position || 'after-services',
    is_visible: 1,
    photos_json: block.photos_json || '[]',
    description_ru: block.description_ru || '',
    description_am: block.description_am || '',
    sort_order: (block.sort_order || 0) + 1
  }) });
  toast('Блок продублирован');
  await loadData(); render();
}

async function addReviewsBlock() {
  await api('/photo-blocks', { method: 'POST', body: JSON.stringify({ block_name: 'Отзывы наших клиентов', description_ru: 'Реальные отзывы от наших клиентов', description_am: '', position: 'before-contact', is_visible: 1, photos_json: '[]' }) });
  toast('Блок отзывов создан! Загрузите фотографии отзывов');
  await loadData(); render();
}

async function deletePhotoBlock(id) {
  if (!confirm('Удалить фото-блок?')) return;
  await api('/photo-blocks/' + id, { method: 'DELETE' });
  toast('Блок удалён');
  await loadData(); render();
}

function addPhotoToBlock(blockId) {
  var block = (data.photoBlocks||[]).find(function(b){return b.id===blockId});
  if (!block) return;
  var photos = [];
  try { photos = JSON.parse(block.photos_json || '[]'); } catch(e) { photos = []; }
  photos.push({ url: '', caption: '' });
  block.photos_json = JSON.stringify(photos);
  render();
}

function removePhotoFromBlock(blockId, photoIdx) {
  var block = (data.photoBlocks||[]).find(function(b){return b.id===blockId});
  if (!block) return;
  var photos = [];
  try { photos = JSON.parse(block.photos_json || '[]'); } catch(e) { photos = []; }
  photos.splice(photoIdx, 1);
  block.photos_json = JSON.stringify(photos);
  render();
}

function collectPhotos(blockId) {
  var arr = [];
  for (var i = 0; ; i++) {
    var urlEl = document.getElementById('pb_photo_'+blockId+'_'+i);
    if (!urlEl) break;
    var capEl = document.getElementById('pb_pcap_'+blockId+'_'+i);
    arr.push({ url: urlEl.value, caption: capEl ? capEl.value : '' });
  }
  return arr;
}

async function savePhotoBlock(id) {
  await api('/photo-blocks/' + id, { method: 'PUT', body: JSON.stringify({
    block_name: document.getElementById('pb_name_'+id).value,
    description_ru: document.getElementById('pb_desc_ru_'+id).value,
    description_am: document.getElementById('pb_desc_am_'+id).value,
    photos_json: JSON.stringify(collectPhotos(id)),
    position: document.getElementById('pb_pos_'+id).value,
    sort_order: parseInt(document.getElementById('pb_order_'+id).value) || 0,
    is_visible: document.getElementById('pb_vis_'+id).checked ? 1 : 0
  }) });
  toast('Фото-блок сохранён');
  await loadData(); render();
}

`;
