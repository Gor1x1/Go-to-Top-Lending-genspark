/**
 * Admin Panel — Telegram messages
 * 331 lines of admin SPA JS code
 */
export const CODE: string = `
// ===== TELEGRAM MESSAGES =====
// ===== TG MESSAGES INLINE (inside block constructor, grouped by block) =====
function renderTelegramInline() {
  var msgs = data.telegram || [];
  var allBlocks = data.siteBlocks || [];
  var h = '';
  
  // Count total buttons across blocks
  var totalBtns = 0;
  for (var bi2 = 0; bi2 < allBlocks.length; bi2++) {
    var bBtns = allBlocks[bi2].buttons || [];
    if (typeof bBtns === 'string') { try { bBtns = JSON.parse(bBtns); } catch(e) { bBtns = []; } }
    totalBtns += bBtns.length;
  }
  
  h += '<div style="margin-bottom:20px;padding:16px 20px;background:rgba(38,165,228,0.08);border:1px solid rgba(38,165,228,0.2);border-radius:12px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">' +
    '<div style="display:flex;align-items:center;gap:12px">' +
    '<i class="fab fa-telegram" style="color:#26A5E4;font-size:1.5rem"></i>' +
    '<div><span style="font-size:0.95rem;color:#e2e8f0;font-weight:700">Быстрые сообщения</span>' +
    '<p style="font-size:0.78rem;color:#94a3b8;margin:4px 0 0">Каждая кнопка на сайте отправляет шаблон в Telegram. Здесь видно какая кнопка к какому блоку привязана.</p></div></div>' +
    '<div style="display:flex;gap:8px;align-items:center">' +
    '<span class="badge" style="background:rgba(38,165,228,0.15);color:#26A5E4;font-size:0.78rem;padding:6px 12px">' + totalBtns + ' кнопок в блоках</span>' +
    '<span class="badge" style="background:rgba(139,92,246,0.15);color:#a78bfa;font-size:0.78rem;padding:6px 12px">' + msgs.length + ' TG шаблонов</span>' +
    '<button class="btn btn-primary" style="white-space:nowrap;font-size:0.82rem" onclick="addTelegramMsg()"><i class="fas fa-plus" style="margin-right:5px"></i>Новый шаблон</button>' +
    '</div></div></div>';
  
  if (msgs.length === 0 && totalBtns === 0) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fab fa-telegram" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8;font-size:0.95rem">Кнопки и шаблоны ещё не загружены.</p>' +
      '<p style="color:#64748b;font-size:0.82rem;margin-bottom:16px">Нажмите «Загрузить с сайта» чтобы импортировать блоки с кнопками.</p>' +
      '<button class="btn btn-success" onclick="importSiteBlocks()"><i class="fas fa-download" style="margin-right:6px"></i>Загрузить с сайта</button></div>';
    return h;
  }
  
  // Build map: block_key -> block + its buttons + matched TG messages
  for (var bbi = 0; bbi < allBlocks.length; bbi++) {
    var blk = allBlocks[bbi];
    var btns = blk.buttons || [];
    if (typeof btns === 'string') { try { btns = JSON.parse(btns); } catch(e) { btns = []; } }
    if (btns.length === 0) continue;
    
    h += '<div class="card" style="margin-bottom:14px;padding:0;overflow:hidden;border-left:4px solid #8B5CF6">';
    // Block header
    h += '<div style="padding:12px 18px;background:#141c2e;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="sbActiveTab=&apos;blocks&apos;;sbExpandedBlocks[' + blk.id + ']=true;render()">';
    h += '<i class="fas fa-cubes" style="color:#8B5CF6;font-size:0.9rem"></i>';
    h += '<span style="font-weight:700;color:#e2e8f0;font-size:0.9rem">' + escHtml(blk.title_ru || blk.block_key) + '</span>';
    h += '<span class="badge badge-purple" style="font-size:0.68rem">' + escHtml(blk.block_key) + '</span>';
    h += '<span class="badge" style="background:rgba(38,165,228,0.12);color:#26A5E4;font-size:0.68rem">' + btns.length + ' кноп.</span>';
    h += '<i class="fas fa-external-link-alt" style="color:#475569;font-size:0.65rem;margin-left:auto" title="Перейти к блоку"></i>';
    h += '</div>';
    
    // Buttons in this block
    for (var bti2 = 0; bti2 < btns.length; bti2++) {
      var btn = btns[bti2];
      // Find matching TG message
      var matchedMsg = null;
      for (var mi2 = 0; mi2 < msgs.length; mi2++) {
        if (msgs[mi2].button_label_ru && btn.text_ru && msgs[mi2].button_label_ru.trim() === btn.text_ru.trim()) {
          matchedMsg = msgs[mi2];
          break;
        }
      }
      
      h += '<div style="padding:14px 18px;border-top:1px solid #1e293b">';
      // Button header row
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">';
      h += '<div style="display:flex;align-items:center;gap:8px">';
      h += '<i class="' + escHtml(btn.icon || 'fas fa-arrow-right') + '" style="color:#a78bfa;font-size:0.85rem"></i>';
      h += '<span style="font-weight:600;color:#e2e8f0;font-size:0.88rem">' + escHtml(btn.text_ru || '') + '</span>';
      if (btn.text_am) h += '<span style="color:#fbbf24;font-size:0.78rem;opacity:0.7">/ ' + escHtml(btn.text_am) + '</span>';
      h += '</div>';
      h += '<div style="display:flex;gap:6px;align-items:center">';
      if (matchedMsg) {
        h += '<span class="badge badge-green" style="font-size:0.68rem"><i class="fab fa-telegram" style="margin-right:3px"></i>Шаблон настроен</span>';
        h += '<button class="btn btn-success" style="padding:5px 12px;font-size:0.78rem" onclick="saveTgMsg(' + matchedMsg.id + ')"><i class="fas fa-save" style="margin-right:4px"></i>Сохранить</button>';
        h += '<button class="btn btn-danger" style="padding:5px 8px;font-size:0.78rem" onclick="deleteTgMsg(' + matchedMsg.id + ')"><i class="fas fa-trash"></i></button>';
      } else {
        h += '<span class="badge badge-amber" style="font-size:0.68rem"><i class="fas fa-unlink" style="margin-right:3px"></i>Без TG-шаблона</span>';
      }
      h += '</div></div>';
      
      if (matchedMsg) {
        // Editable fields
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">';
        h += '<div><label style="font-size:0.72rem;color:#8B5CF6;font-weight:600;margin-bottom:3px;display:block"><i class="fas fa-tag" style="margin-right:3px"></i>Кнопка RU</label><input class="input" value="' + escHtml(matchedMsg.button_label_ru) + '" id="tg_lru_' + matchedMsg.id + '" style="font-size:0.82rem"></div>';
        h += '<div><label style="font-size:0.72rem;color:#F59E0B;font-weight:600;margin-bottom:3px;display:block"><i class="fas fa-tag" style="margin-right:3px"></i>Кнопка AM</label><input class="input" value="' + escHtml(matchedMsg.button_label_am) + '" id="tg_lam_' + matchedMsg.id + '" style="font-size:0.82rem"></div>';
        h += '</div>';
        h += '<div style="margin-bottom:10px"><label style="font-size:0.72rem;color:#60a5fa;font-weight:600;margin-bottom:3px;display:block"><i class="fas fa-link" style="margin-right:3px"></i>Telegram URL</label><input class="input" value="' + escHtml(matchedMsg.telegram_url) + '" id="tg_url_' + matchedMsg.id + '" style="font-size:0.82rem;color:#60a5fa"></div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
        h += '<div><label style="font-size:0.72rem;color:#8B5CF6;font-weight:600;margin-bottom:3px;display:block"><i class="fas fa-envelope" style="margin-right:3px"></i>Шаблон RU</label><textarea class="input" id="tg_mru_' + matchedMsg.id + '" rows="3" style="font-size:0.78rem;line-height:1.5">' + escHtml(matchedMsg.message_template_ru) + '</textarea></div>';
        h += '<div><label style="font-size:0.72rem;color:#F59E0B;font-weight:600;margin-bottom:3px;display:block"><i class="fas fa-envelope" style="margin-right:3px"></i>Шаблон AM</label><textarea class="input" id="tg_mam_' + matchedMsg.id + '" rows="3" style="font-size:0.78rem;line-height:1.5">' + escHtml(matchedMsg.message_template_am) + '</textarea></div>';
        h += '</div>';
      } else {
        h += '<div style="font-size:0.78rem;color:#64748b;padding:8px 12px;background:#1a2236;border-radius:8px;border:1px dashed #293548">' +
          '<i class="fas fa-info-circle" style="margin-right:6px;color:#475569"></i>URL: <span style="color:#60a5fa">' + escHtml(btn.url || 'не задан') + '</span>' +
          (btn.message_ru ? ' | Шаблон: <span style="color:#94a3b8">' + escHtml(btn.message_ru.substring(0, 50)) + '...</span>' : '') +
        '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
  }
  
  // Unmatched TG messages (not linked to any block button)
  var unmatchedMsgs = [];
  for (var umi = 0; umi < msgs.length; umi++) {
    var tgm = msgs[umi];
    var found = false;
    for (var ubi = 0; ubi < allBlocks.length; ubi++) {
      var uBtns = allBlocks[ubi].buttons || [];
      if (typeof uBtns === 'string') { try { uBtns = JSON.parse(uBtns); } catch(e) { uBtns = []; } }
      for (var ubti = 0; ubti < uBtns.length; ubti++) {
        if (uBtns[ubti].text_ru && tgm.button_label_ru && uBtns[ubti].text_ru.trim() === tgm.button_label_ru.trim()) {
          found = true; break;
        }
      }
      if (found) break;
    }
    if (!found) unmatchedMsgs.push(tgm);
  }
  
  if (unmatchedMsgs.length > 0) {
    h += '<div class="card" style="margin-bottom:14px;padding:0;overflow:hidden;border-left:4px solid #F59E0B">';
    h += '<div style="padding:12px 18px;background:#141c2e;display:flex;align-items:center;gap:10px">' +
      '<i class="fas fa-unlink" style="color:#F59E0B;font-size:0.9rem"></i>' +
      '<span style="font-weight:700;color:#e2e8f0;font-size:0.9rem">Общие шаблоны</span>' +
      '<span style="color:#64748b;font-size:0.78rem">(не привязаны к блоку)</span>' +
      '<span class="badge badge-amber" style="font-size:0.68rem">' + unmatchedMsgs.length + '</span>' +
    '</div>';
    for (var umj = 0; umj < unmatchedMsgs.length; umj++) {
      h += renderTgMsgCard(unmatchedMsgs[umj]);
    }
    h += '</div>';
  }
  
  // Variables hint
  h += '<div style="padding:14px 18px;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.15);border-radius:10px;margin-top:8px">' +
    '<div style="font-size:0.78rem;color:#a78bfa;font-weight:600;margin-bottom:6px"><i class="fas fa-code" style="margin-right:5px"></i>Доступные переменные:</div>' +
    '<div style="font-size:0.75rem;color:#64748b;line-height:1.6">' +
      '<code style="color:#8B5CF6;background:#1e293b;padding:1px 5px;border-radius:3px;margin-right:6px">{items}</code> количество |' +
      '<code style="color:#8B5CF6;background:#1e293b;padding:1px 5px;border-radius:3px;margin:0 6px">{total}</code> сумма |' +
      '<code style="color:#8B5CF6;background:#1e293b;padding:1px 5px;border-radius:3px;margin:0 6px">{buyouts}</code> выкупы |' +
      '<code style="color:#8B5CF6;background:#1e293b;padding:1px 5px;border-radius:3px;margin:0 6px">{reviews}</code> отзывы |' +
      '<code style="color:#8B5CF6;background:#1e293b;padding:1px 5px;border-radius:3px;margin:0 6px">{contact}</code> контакт |' +
      '<code style="color:#8B5CF6;background:#1e293b;padding:1px 5px;border-radius:3px;margin:0 6px">{name}</code> имя |' +
      '<code style="color:#8B5CF6;background:#1e293b;padding:1px 5px;border-radius:3px;margin:0 6px">{product}</code> товар |' +
      '<code style="color:#8B5CF6;background:#1e293b;padding:1px 5px;border-radius:3px;margin:0 6px">{service}</code> услуга |' +
      '<code style="color:#8B5CF6;background:#1e293b;padding:1px 5px;border-radius:3px;margin:0 6px">{message}</code> сообщение' +
    '</div></div>';
  
  return h;
}

function renderTgMsgCard(msg) {
  var h = '<div style="padding:14px 18px;border-top:1px solid #1e293b">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
    '<div style="display:flex;align-items:center;gap:8px">' +
      '<span class="badge badge-green" style="font-size:0.72rem">' + escHtml(msg.button_key || '') + '</span>' +
      '<span style="color:#64748b;font-size:0.78rem">' + escHtml(msg.description || '') + '</span>' +
    '</div>' +
    '<div style="display:flex;gap:6px">' +
      '<button class="btn btn-success" style="padding:5px 12px;font-size:0.78rem" onclick="saveTgMsg(' + msg.id + ')"><i class="fas fa-save" style="margin-right:4px"></i>Сохранить</button>' +
      '<button class="btn btn-danger" style="padding:5px 8px;font-size:0.78rem" onclick="deleteTgMsg(' + msg.id + ')"><i class="fas fa-trash"></i></button>' +
    '</div>' +
  '</div>';
  // Row 1: Button labels RU/AM
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
    '<div><label style="font-size:0.72rem;color:#8B5CF6;font-weight:600;margin-bottom:3px;display:block"><i class="fas fa-tag" style="margin-right:3px"></i>Текст кнопки (RU)</label><input class="input" value="' + escHtml(msg.button_label_ru) + '" id="tg_lru_' + msg.id + '" style="font-size:0.82rem"></div>' +
    '<div><label style="font-size:0.72rem;color:#F59E0B;font-weight:600;margin-bottom:3px;display:block"><i class="fas fa-tag" style="margin-right:3px"></i>Текст кнопки (AM)</label><input class="input" value="' + escHtml(msg.button_label_am) + '" id="tg_lam_' + msg.id + '" style="font-size:0.82rem"></div>' +
  '</div>';
  // Row 2: URL
  h += '<div style="margin-bottom:10px"><label style="font-size:0.72rem;color:#60a5fa;font-weight:600;margin-bottom:3px;display:block"><i class="fas fa-link" style="margin-right:3px"></i>Telegram URL</label><input class="input" value="' + escHtml(msg.telegram_url) + '" id="tg_url_' + msg.id + '" style="font-size:0.82rem;color:#60a5fa"></div>';
  // Row 3: Message templates
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
    '<div><label style="font-size:0.72rem;color:#8B5CF6;font-weight:600;margin-bottom:3px;display:block"><i class="fas fa-envelope" style="margin-right:3px"></i>Шаблон (RU)</label><textarea class="input" id="tg_mru_' + msg.id + '" rows="3" style="font-size:0.78rem;line-height:1.5">' + escHtml(msg.message_template_ru) + '</textarea></div>' +
    '<div><label style="font-size:0.72rem;color:#F59E0B;font-weight:600;margin-bottom:3px;display:block"><i class="fas fa-envelope" style="margin-right:3px"></i>Шаблон (AM)</label><textarea class="input" id="tg_mam_' + msg.id + '" rows="3" style="font-size:0.78rem;line-height:1.5">' + escHtml(msg.message_template_am) + '</textarea></div>' +
  '</div>';
  h += '</div>';
  return h;
}

function renderTelegram() {
  let h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Telegram сообщения</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Настройка текстов сообщений для каждой кнопки на сайте (на 2 языках)</p>' +
    '<button class="btn btn-primary" style="margin-bottom:20px" onclick="addTelegramMsg()"><i class="fas fa-plus" style="margin-right:6px"></i>Добавить кнопку</button>';
  
  for (const msg of data.telegram) {
    h += '<div class="card" style="margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
        '<div><span class="badge badge-green">' + msg.button_key + '</span> <span style="color:#64748b;font-size:0.8rem;margin-left:8px">' + (msg.description || '') + '</span></div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-success" style="padding:6px 12px;font-size:0.8rem" onclick="saveTgMsg(' + msg.id + ')"><i class="fas fa-save"></i> Сохранить</button>' +
          '<button class="btn btn-danger" style="padding:6px 12px;font-size:0.8rem" onclick="deleteTgMsg(' + msg.id + ')"><i class="fas fa-trash"></i></button>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Текст кнопки (RU)</label><input class="input" value="' + escHtml(msg.button_label_ru) + '" id="tg_lru_' + msg.id + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Текст кнопки (AM)</label><input class="input" value="' + escHtml(msg.button_label_am) + '" id="tg_lam_' + msg.id + '"></div>' +
      '</div>' +
      '<div style="margin-bottom:12px"><label style="font-size:0.75rem;color:#64748b;font-weight:600">Telegram URL</label><input class="input" value="' + escHtml(msg.telegram_url) + '" id="tg_url_' + msg.id + '"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Шаблон сообщения (RU)</label><textarea class="input" id="tg_mru_' + msg.id + '">' + escHtml(msg.message_template_ru) + '</textarea><p style="font-size:0.7rem;color:#475569;margin-top:4px">Переменные: {items}, {total}, {buyouts}, {reviews}, {contact}, {name}, {product}, {service}, {message}</p></div>' +
        '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Шаблон сообщения (AM)</label><textarea class="input" id="tg_mam_' + msg.id + '">' + escHtml(msg.message_template_am) + '</textarea></div>' +
      '</div>' +
    '</div>';
  }
  
  if (!data.telegram.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fab fa-telegram" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8">Telegram-сообщения ещё не настроены. Нажмите "Загрузить тексты с сайта" на вкладке Тексты.</p></div>';
  }
  
  h += '</div>';
  return h;
}

async function saveTgMsg(id) {
  const msg = data.telegram.find(m => m.id === id);
  await api('/telegram/' + id, { method: 'PUT', body: JSON.stringify({
    button_label_ru: document.getElementById('tg_lru_' + id).value,
    button_label_am: document.getElementById('tg_lam_' + id).value,
    telegram_url: document.getElementById('tg_url_' + id).value,
    message_template_ru: document.getElementById('tg_mru_' + id).value,
    message_template_am: document.getElementById('tg_mam_' + id).value,
    description: msg.description,
    is_active: 1
  }) });
  toast('Сообщение сохранено');
  await loadData(); render();
}

async function deleteTgMsg(id) {
  if (!confirm('Удалить это сообщение?')) return;
  await api('/telegram/' + id, { method: 'DELETE' });
  toast('Удалено');
  await loadData(); render();
}

async function addTelegramMsg() {
  const key = prompt('Ключ кнопки (англ, напр: hero_cta):');
  if (!key) return;
  const desc = prompt('Описание (где эта кнопка):') || '';
  await api('/telegram', { method: 'POST', body: JSON.stringify({
    button_key: key, button_label_ru: 'Новая кнопка', button_label_am: 'Նor կoption',
    telegram_url: 'https://t.me/goo_to_top', message_template_ru: 'Здравствуйте!',
    message_template_am: 'Ողdelays!', description: desc
  }) });
  toast('Кнопка добавлена');
  await loadData(); render();
}

// ===== SCRIPTS =====
function renderScripts() {
  let h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Пользовательские скрипты</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Аналитика, пиксели, Meta теги и другие скрипты</p>' +
    '<button class="btn btn-primary" style="margin-bottom:20px" onclick="addScript()"><i class="fas fa-plus" style="margin-right:6px"></i>Добавить скрипт</button>';
  
  for (const s of data.scripts) {
    h += '<div class="card" style="margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
        '<div><strong>' + escHtml(s.name) + '</strong> <span class="badge badge-amber">' + s.script_type + '</span> <span class="badge badge-purple">' + s.placement + '</span>' +
          (s.is_active ? ' <span class="badge badge-green">Активен</span>' : ' <span class="badge" style="background:rgba(239,68,68,0.2);color:#f87171">Выкл</span>') +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-success" style="padding:6px 12px;font-size:0.8rem" onclick="saveScript(' + s.id + ')"><i class="fas fa-save"></i></button>' +
          '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.8rem" onclick="toggleScript(' + s.id + ',' + (s.is_active ? 0 : 1) + ')">' + (s.is_active ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>') + '</button>' +
          '<button class="btn btn-danger" style="padding:6px 12px;font-size:0.8rem" onclick="deleteScript(' + s.id + ')"><i class="fas fa-trash"></i></button>' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:8px"><label style="font-size:0.75rem;color:#64748b">Название</label><input class="input" value="' + escHtml(s.name) + '" id="scr_name_' + s.id + '"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px">' +
        '<div><label style="font-size:0.75rem;color:#64748b">Тип</label><select class="input" id="scr_type_' + s.id + '">' +
          '<option value="js"' + (s.script_type === 'js' ? ' selected' : '') + '>JavaScript</option>' +
          '<option value="css"' + (s.script_type === 'css' ? ' selected' : '') + '>CSS</option>' +
          '<option value="meta"' + (s.script_type === 'meta' ? ' selected' : '') + '>Meta тег</option>' +
          '<option value="html"' + (s.script_type === 'html' ? ' selected' : '') + '>HTML</option></select></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b">Размещение</label><select class="input" id="scr_place_' + s.id + '">' +
          '<option value="head"' + (s.placement === 'head' ? ' selected' : '') + '>В head</option>' +
          '<option value="body_start"' + (s.placement === 'body_start' ? ' selected' : '') + '>Начало body</option>' +
          '<option value="body_end"' + (s.placement === 'body_end' ? ' selected' : '') + '>Конец body</option></select></div>' +
      '</div>' +
      '<div><label style="font-size:0.75rem;color:#64748b">Код</label><textarea class="input" style="font-family:monospace;min-height:100px" id="scr_code_' + s.id + '">' + escHtml(s.code) + '</textarea></div>' +
    '</div>';
  }
  
  if (!data.scripts.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-code" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8">Скриптов пока нет. Добавьте аналитику, пиксели или кастомные стили.</p></div>';
  }
  
  h += '</div>';
  return h;
}

async function saveScript(id) {
  const s = data.scripts.find(x => x.id === id);
  await api('/scripts/' + id, { method: 'PUT', body: JSON.stringify({
    name: document.getElementById('scr_name_' + id).value,
    description: s.description,
    script_type: document.getElementById('scr_type_' + id).value,
    placement: document.getElementById('scr_place_' + id).value,
    code: document.getElementById('scr_code_' + id).value,
    is_active: s.is_active
  }) });
  toast('Скрипт сохранён');
  await loadData(); render();
}

async function addScript() {
  const name = prompt('Название скрипта (напр: Google Analytics):');
  if (!name) return;
  await api('/scripts', { method: 'POST', body: JSON.stringify({ name, description: '', script_type: 'js', placement: 'head', code: '<!-- Ваш код -->' }) });
  toast('Скрипт добавлен');
  await loadData(); render();
}

async function deleteScript(id) {
  if (!confirm('Удалить скрипт?')) return;
  await api('/scripts/' + id, { method: 'DELETE' });
  toast('Удалён');
  await loadData(); render();
}

async function toggleScript(id, active) {
  const s = data.scripts.find(x => x.id === id);
  await api('/scripts/' + id, { method: 'PUT', body: JSON.stringify({ ...s, is_active: active }) });
  toast(active ? 'Скрипт включён' : 'Скрипт выключен');
  await loadData(); render();
}


`;
