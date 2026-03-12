/**
 * Admin Panel — Block constructor, create block modal
 * 566 lines of admin SPA JS code
 */
export const CODE: string = `
// ===== UNIFIED BLOCK CONSTRUCTOR =====
// Merges: Content editor + Section order + Photo blocks into one visual editor
function getBlockContent(sectionId) {
  return data.content.find(function(c) { return c.section_key === sectionId; });
}
function getBlockPhotos(sectionId) {
  return (data.photoBlocks || []).filter(function(p) { return p.position === sectionId || p.position === 'in-' + sectionId; });
}
function getBlockCounters(sectionId) {
  var sidNorm = (sectionId || '').replace(/_/g, '-');
  var sidAlt = (sectionId || '').replace(/-/g, '_');
  return (data.slotCounters || []).filter(function(c) {
    var p = c.position || '';
    var pNorm = p.replace(/_/g, '-');
    return p === sectionId || p === sidNorm || p === sidAlt ||
      pNorm === 'after-' + sidNorm || pNorm === 'before-' + sidNorm || pNorm === 'in-' + sidNorm ||
      p === 'after-' + sectionId || p === 'before-' + sectionId || p === 'in-' + sectionId ||
      p === 'after-' + sidAlt || p === 'before-' + sidAlt || p === 'in-' + sidAlt;
  });
}
// Which sections typically have photos
var photoSections = ['hero', 'about', 'services', 'warehouse', 'wb-banner', 'wb-official'];

function renderBlocks() {
  var sections = data.sectionOrder || [];
  var h = '<div style="padding:32px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">' +
    '<div><h1 style="font-size:1.8rem;font-weight:800"><i class="fas fa-cubes" style="color:#8B5CF6;margin-right:10px"></i>Конструктор блоков</h1>' +
    '<p style="color:#94a3b8;margin-top:4px">Порядок, тексты, фото и видимость — всё в одном месте</p></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-primary" onclick="showCreateBlockModal()"><i class="fas fa-plus" style="margin-right:6px"></i>Новый блок</button>' +
      '<button class="btn btn-outline" onclick="seedSections()"><i class="fas fa-download" style="margin-right:6px"></i>Загрузить стандартные</button>' +
      '<button class="btn btn-outline" onclick="seedContent()"><i class="fas fa-file-import" style="margin-right:6px"></i>Импорт текстов с сайта</button>' +
      '<button class="btn btn-success" onclick="saveAllBlocks()"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить порядок</button>' +
    '</div>' +
  '</div>';

  if (!sections.length && !data.content.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-inbox" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8;margin-bottom:16px">Блоки ещё не настроены. Нажмите «Загрузить стандартные» или «Импорт текстов с сайта» для начала.</p></div>';
    h += '</div>';
    return h;
  }

  // If sections are empty but content exists, build sections from content
  if (!sections.length && data.content.length) {
    sections = data.content.map(function(c, i) {
      return { section_id: c.section_key, sort_order: i, is_visible: 1, label_ru: c.section_name, label_am: '' };
    });
    data.sectionOrder = sections;
  }

  // Render each block
  for (var i = 0; i < sections.length; i++) {
    var sec = sections[i];
    var content = getBlockContent(sec.section_id);
    var photos = getBlockPhotos(sec.section_id);
    var counters = getBlockCounters(sec.section_id);
    var items = [];
    if (content) { try { items = JSON.parse(content.content_json); } catch(e) { items = []; } }
    var hasPhotos = photos.length > 0 || photoSections.indexOf(sec.section_id) >= 0;
    var isExpanded = sec._expanded || false;

    h += '<div class="card" style="margin-bottom:10px;padding:0;overflow:hidden;border:1px solid ' + (sec.is_visible ? '#334155' : 'rgba(239,68,68,0.3)') + ';' + (!sec.is_visible ? 'opacity:0.55;' : '') + '" data-block-idx="' + i + '">';

    // ===== BLOCK HEADER =====
    h += '<div style="display:flex;align-items:center;gap:12px;padding:14px 20px;background:' + (sec.is_visible ? '#1e293b' : 'rgba(239,68,68,0.05)') + ';cursor:pointer" onclick="toggleBlockExpand(' + i + ')">';

    // Move arrows
    h += '<div style="display:flex;flex-direction:column;gap:2px" onclick="event.stopPropagation()">' +
      '<button class="btn btn-outline" style="padding:2px 6px;font-size:0.65rem;line-height:1" onclick="moveSection(' + i + ',-1)" ' + (i === 0 ? 'disabled style="padding:2px 6px;font-size:0.65rem;line-height:1;opacity:0.3"' : '') + '><i class="fas fa-chevron-up"></i></button>' +
      '<button class="btn btn-outline" style="padding:2px 6px;font-size:0.65rem;line-height:1" onclick="moveSection(' + i + ',1)" ' + (i === sections.length-1 ? 'disabled style="padding:2px 6px;font-size:0.65rem;line-height:1;opacity:0.3"' : '') + '><i class="fas fa-chevron-down"></i></button>' +
    '</div>';

    // Block number
    h += '<span style="color:#475569;font-size:0.8rem;font-weight:700;min-width:28px">#' + (i+1) + '</span>';

    // Badges
    h += '<div style="flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
    h += '<span style="font-weight:700;font-size:0.95rem;color:' + (sec.is_visible ? '#e2e8f0' : '#f87171') + '">' + escHtml(sec.label_ru || sec.section_id) + '</span>';
    h += '<span class="badge badge-purple" style="font-size:0.7rem">' + sec.section_id + '</span>';
    if (items.length > 0) h += '<span class="badge badge-green" style="font-size:0.7rem">' + items.length + ' текст' + (items.length > 1 ? 'ов' : '') + '</span>';
    if (hasPhotos) h += '<span class="badge badge-amber" style="font-size:0.7rem"><i class="fas fa-image" style="margin-right:3px"></i>' + (photos.length > 0 ? photos.length + ' фото' : 'фото') + '</span>';
    if (counters.length > 0) h += '<span class="badge" style="font-size:0.7rem;background:rgba(59,130,246,0.2);color:#60a5fa"><i class="fas fa-clock" style="margin-right:3px"></i>' + counters.length + '</span>';
    h += '</div>';

    // Visibility toggle + actions
    h += '<div style="display:flex;align-items:center;gap:6px" onclick="event.stopPropagation()">';
    h += '<button class="btn ' + (sec.is_visible ? 'btn-success' : 'btn-danger') + '" style="padding:5px 10px;font-size:0.75rem" onclick="toggleSectionVis(' + i + ')" title="' + (sec.is_visible ? 'Скрыть' : 'Показать') + '">' +
      '<i class="fas ' + (sec.is_visible ? 'fa-eye' : 'fa-eye-slash') + '"></i></button>';
    h += '<button class="btn btn-danger" style="padding:5px 10px;font-size:0.75rem" onclick="deleteBlock(' + i + ')" title="Удалить блок"><i class="fas fa-trash"></i></button>';
    h += '</div>';

    // Expand/collapse arrow
    h += '<i class="fas fa-chevron-' + (isExpanded ? 'up' : 'down') + '" style="color:#64748b;font-size:0.8rem;transition:transform 0.2s"></i>';
    h += '</div>';

    // ===== BLOCK BODY (expanded) =====
    h += '<div style="display:' + (isExpanded ? 'block' : 'none') + ';padding:16px 20px;border-top:1px solid #334155;background:#0f172a">';

    // Block meta editing
    h += '<div style="display:grid;grid-template-columns:120px 1fr 1fr;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #1e293b">' +
      '<div><label style="font-size:0.7rem;color:#64748b">ID блока</label><input class="input" value="' + escHtml(sec.section_id) + '" style="padding:6px 10px;font-size:0.82rem;color:#64748b" disabled></div>' +
      '<div><label style="font-size:0.7rem;color:#8B5CF6">Название (RU)</label><input class="input" value="' + escHtml(sec.label_ru) + '" style="padding:6px 10px;font-size:0.85rem" data-block-label-ru="' + i + '"></div>' +
      '<div><label style="font-size:0.7rem;color:#F59E0B">Название (AM)</label><input class="input" value="' + escHtml(sec.label_am || '') + '" style="padding:6px 10px;font-size:0.85rem" data-block-label-am="' + i + '"></div>' +
    '</div>';

    // ===== TEXT ITEMS =====
    if (items.length > 0) {
      h += '<div style="margin-bottom:12px"><div style="font-size:0.8rem;font-weight:700;color:#a78bfa;margin-bottom:8px"><i class="fas fa-align-left" style="margin-right:6px"></i>Тексты блока (' + items.length + ')</div>';
      for (var ti = 0; ti < items.length; ti++) {
        var item = items[ti];
        h += '<div class="section-edit-row" style="margin-bottom:6px;padding:10px 12px">' +
          '<div style="display:grid;grid-template-columns:44px 1fr 1fr 28px;gap:8px;align-items:start">' +
            '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding-top:4px">' +
              (ti > 0 ? '<button style="background:none;border:none;color:#8B5CF6;cursor:pointer;padding:2px;font-size:0.7rem" onclick="moveTextItem(&apos;' + sec.section_id + '&apos;,' + ti + ',-1)" title="Вверх"><i class="fas fa-chevron-up"></i></button>' : '<span style="width:16px;height:16px"></span>') +
              '<span style="color:#475569;font-size:0.75rem;text-align:center">' + (ti+1) + '</span>' +
              (ti < items.length - 1 ? '<button style="background:none;border:none;color:#8B5CF6;cursor:pointer;padding:2px;font-size:0.7rem" onclick="moveTextItem(&apos;' + sec.section_id + '&apos;,' + ti + ',1)" title="Вниз"><i class="fas fa-chevron-down"></i></button>' : '<span style="width:16px;height:16px"></span>') +
            '</div>' +
            '<div><label style="font-size:0.65rem;color:#8B5CF6;font-weight:600">RU</label>' +
              '<textarea class="input" style="min-height:36px;margin-top:2px;font-size:0.85rem;padding:6px 10px" data-section="' + sec.section_id + '" data-idx="' + ti + '" data-lang="ru">' + escHtml(item.ru) + '</textarea></div>' +
            '<div><label style="font-size:0.65rem;color:#F59E0B;font-weight:600">AM</label>' +
              '<textarea class="input" style="min-height:36px;margin-top:2px;font-size:0.85rem;padding:6px 10px" data-section="' + sec.section_id + '" data-idx="' + ti + '" data-lang="am">' + escHtml(item.am) + '</textarea></div>' +
            '<button class="tier-del-btn" style="margin-top:16px" onclick="removeTextItem(&apos;' + sec.section_id + '&apos;,' + ti + ')" title="Удалить текст"><i class="fas fa-times"></i></button>' +
          '</div></div>';
      }
      h += '<div style="display:flex;gap:8px;margin-top:6px">' +
        '<button class="btn btn-outline" style="font-size:0.78rem;padding:6px 14px" onclick="addTextItem(&apos;' + sec.section_id + '&apos;)"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить текст</button>' +
        '<button class="btn btn-success" style="font-size:0.78rem;padding:6px 14px" onclick="saveBlockTexts(&apos;' + sec.section_id + '&apos;)"><i class="fas fa-save" style="margin-right:4px"></i>Сохранить тексты</button>' +
      '</div></div>';
    } else if (content) {
      h += '<div style="margin-bottom:12px;padding:12px;background:#1e293b;border-radius:8px;text-align:center"><span style="color:#64748b;font-size:0.85rem">Нет текстов в этом блоке</span> ' +
        '<button class="btn btn-outline" style="font-size:0.75rem;padding:4px 12px;margin-left:8px" onclick="addTextItem(&apos;' + sec.section_id + '&apos;)"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить текст</button></div>';
    } else {
      // No content record yet — offer to create
      h += '<div style="margin-bottom:12px;padding:12px;background:#1e293b;border-radius:8px;display:flex;justify-content:space-between;align-items:center">' +
        '<span style="color:#64748b;font-size:0.85rem"><i class="fas fa-info-circle" style="margin-right:6px;color:#8B5CF6"></i>Тексты не привязаны</span>' +
        '<button class="btn btn-primary" style="font-size:0.75rem;padding:4px 12px" onclick="createBlockContent(&apos;' + sec.section_id + '&apos;,&apos;' + escHtml(sec.label_ru) + '&apos;)"><i class="fas fa-plus" style="margin-right:4px"></i>Создать тексты</button></div>';
    }

    // ===== PHOTO BLOCKS attached to this section =====
    if (photos.length > 0) {
      h += '<div style="margin-bottom:12px"><div style="font-size:0.8rem;font-weight:700;color:#F59E0B;margin-bottom:8px"><i class="fas fa-images" style="margin-right:6px"></i>Фотографии (' + photos.length + ' блок' + (photos.length > 1 ? 'ов' : '') + ')</div>';
      for (var phi = 0; phi < photos.length; phi++) {
        var pb = photos[phi];
        var pbPhotos = [];
        try { pbPhotos = JSON.parse(pb.photos_json || '[]'); } catch(e) { pbPhotos = []; }
        h += '<div style="padding:10px;background:#1e293b;border-radius:8px;margin-bottom:6px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<span style="font-size:0.82rem;font-weight:600;color:#e2e8f0">' + escHtml(pb.block_name) + ' <span style="color:#64748b;font-size:0.75rem">(' + pbPhotos.length + ' фото)</span></span>' +
          '<div style="display:flex;gap:4px"><button class="btn btn-outline" style="font-size:0.7rem;padding:3px 8px" onclick="navigate(&apos;photos_edit&apos;);_editPhotoBlockId=' + pb.id + '">Редактировать</button></div></div>';
        // Show thumbnails
        if (pbPhotos.length > 0) {
          h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
          for (var thi = 0; thi < Math.min(pbPhotos.length, 4); thi++) {
            h += '<div style="width:60px;height:60px;border-radius:6px;background:#0f172a;border:1px solid #334155;overflow:hidden"><img src="' + escHtml(pbPhotos[thi].url) + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=&apos;none&apos;"></div>';
          }
          if (pbPhotos.length > 4) h += '<div style="width:60px;height:60px;border-radius:6px;background:#0f172a;border:1px solid #334155;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:0.8rem">+' + (pbPhotos.length - 4) + '</div>';
          h += '</div>';
        }
        h += '</div>';
      }
      h += '</div>';
    }

    // ===== SLOT COUNTERS attached to this section =====
    if (counters.length > 0) {
      h += '<div style="margin-bottom:8px"><div style="font-size:0.8rem;font-weight:700;color:#3B82F6;margin-bottom:6px"><i class="fas fa-clock" style="margin-right:6px"></i>Счётчики слотов</div>';
      for (var sci = 0; sci < counters.length; sci++) {
        var sc = counters[sci];
        var free = Math.max(0, (sc.total_slots || 10) - (sc.booked_slots || 0));
        h += '<div style="padding:8px 12px;background:#1e293b;border-radius:8px;margin-bottom:4px;display:flex;align-items:center;gap:12px">' +
          '<span style="color:#10B981;font-weight:800;font-size:1.1rem">' + free + '/' + sc.total_slots + '</span>' +
          '<span style="flex:1;color:#94a3b8;font-size:0.82rem">' + escHtml(sc.counter_name) + ' — ' + escHtml(sc.label_ru) + '</span>' +
          '<span style="font-size:0.7rem;color:#64748b">' + (sc.show_timer ? '👁 Видим' : '👁‍🗨 Скрыт') + '</span>' +
        '</div>';
      }
      h += '</div>';
    }

    h += '</div>'; // end body
    h += '</div>'; // end card
  }

  h += '</div>';
  return h;
}

// Toggle block expansion
function toggleBlockExpand(idx) {
  if (!data.sectionOrder[idx]) return;
  data.sectionOrder[idx]._expanded = !data.sectionOrder[idx]._expanded;
  render();
}

// Add text item to block
function addTextItem(sectionKey) {
  var content = data.content.find(function(c) { return c.section_key === sectionKey; });
  if (!content) return;
  var items = [];
  try { items = JSON.parse(content.content_json); } catch(e) { items = []; }
  items.push({ ru: '', am: '' });
  content.content_json = JSON.stringify(items);
  // Keep block expanded
  var sec = data.sectionOrder.find(function(s) { return s.section_id === sectionKey; });
  if (sec) sec._expanded = true;
  render();
}

// Remove text item
function removeTextItem(sectionKey, idx) {
  var content = data.content.find(function(c) { return c.section_key === sectionKey; });
  if (!content) return;
  var items = [];
  try { items = JSON.parse(content.content_json); } catch(e) { items = []; }
  items.splice(idx, 1);
  content.content_json = JSON.stringify(items);
  var sec = data.sectionOrder.find(function(s) { return s.section_id === sectionKey; });
  if (sec) sec._expanded = true;
  render();
}

// Save block texts (collect from DOM and save)
async function saveBlockTexts(sectionKey) {
  var content = data.content.find(function(c) { return c.section_key === sectionKey; });
  if (!content) return;
  var items = [];
  try { items = JSON.parse(content.content_json); } catch(e) { items = []; }
  document.querySelectorAll('[data-section="' + sectionKey + '"]').forEach(function(el) {
    var idx = parseInt(el.dataset.idx);
    var lang = el.dataset.lang;
    if (items[idx]) items[idx][lang] = el.value;
  });
  // Also save block labels
  var sec = data.sectionOrder.find(function(s) { return s.section_id === sectionKey; });
  if (sec) {
    var secIdx = data.sectionOrder.indexOf(sec);
    var lruEl = document.querySelector('[data-block-label-ru="' + secIdx + '"]');
    var lamEl = document.querySelector('[data-block-label-am="' + secIdx + '"]');
    if (lruEl) sec.label_ru = lruEl.value;
    if (lamEl) sec.label_am = lamEl.value;
  }
  await api('/content/' + sectionKey, { method: 'PUT', body: JSON.stringify({ content_json: items, section_name: sec ? sec.label_ru : null }) });
  content.content_json = JSON.stringify(items);
  toast('Тексты блока "' + sectionKey + '" сохранены');
}

// Create block content record
async function createBlockContent(sectionKey, sectionName) {
  await api('/content', { method: 'POST', body: JSON.stringify({ section_key: sectionKey, section_name: sectionName, content_json: [{ ru: '', am: '' }] }) });
  toast('Текстовый блок создан');
  await loadData();
  var sec = data.sectionOrder.find(function(s) { return s.section_id === sectionKey; });
  if (sec) sec._expanded = true;
  render();
}

// Save all block order + visibility
async function saveAllBlocks() {
  // Collect labels from DOM
  for (var i = 0; i < data.sectionOrder.length; i++) {
    var lruEl = document.querySelector('[data-block-label-ru="' + i + '"]');
    var lamEl = document.querySelector('[data-block-label-am="' + i + '"]');
    if (lruEl) data.sectionOrder[i].label_ru = lruEl.value;
    if (lamEl) data.sectionOrder[i].label_am = lamEl.value;
  }
  var sections = data.sectionOrder.map(function(s, i) {
    return { section_id: s.section_id, sort_order: i, is_visible: s.is_visible, label_ru: s.label_ru, label_am: s.label_am };
  });
  await api('/section-order', { method: 'POST', body: JSON.stringify({ sections: sections }) });
  toast('Порядок блоков сохранён! Изменения отразятся на сайте.');
}

// ===== CREATE NEW BLOCK (from template or blank) =====
function showCreateBlockModal() {
  var existingModal = document.getElementById('createBlockModal');
  if (existingModal) { existingModal.remove(); return; }

  var templates = data.sectionOrder.map(function(s) {
    return '<option value="' + s.section_id + '">' + escHtml(s.label_ru || s.section_id) + '</option>';
  }).join('');

  var modalHtml = '<div id="createBlockModal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9998;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)this.remove()">' +
    '<div class="card" style="width:550px;max-width:90vw;max-height:90vh;overflow-y:auto;animation:slideUp 0.3s ease;border:2px solid #8B5CF6">' +
      '<h3 style="font-size:1.2rem;font-weight:800;margin-bottom:16px;color:#a78bfa"><i class="fas fa-plus-circle" style="margin-right:8px"></i>Создать новый блок</h3>' +

      '<div style="display:flex;gap:8px;margin-bottom:16px">' +
        '<button class="tab-btn active" id="newBlockTabBlank" onclick="switchNewBlockTab(&apos;blank&apos;)">Пустой блок</button>' +
        '<button class="tab-btn" id="newBlockTabCopy" onclick="switchNewBlockTab(&apos;copy&apos;)">Копировать существующий</button>' +
      '</div>' +

      '<div id="newBlockBlank">' +
        '<div style="display:grid;grid-template-columns:120px 1fr 1fr;gap:10px;margin-bottom:12px">' +
          '<div><label style="font-size:0.75rem;color:#64748b">ID (англ)</label><input class="input" id="nb_id" placeholder="my_block"></div>' +
          '<div><label style="font-size:0.75rem;color:#8B5CF6">Название (RU)</label><input class="input" id="nb_name_ru" placeholder="Мой блок"></div>' +
          '<div><label style="font-size:0.75rem;color:#F59E0B">Название (AM)</label><input class="input" id="nb_name_am" placeholder=""></div>' +
        '</div>' +
        '<div style="margin-bottom:12px"><label style="font-size:0.75rem;color:#64748b">Вставить после блока</label><select class="input" id="nb_after"><option value="_top">В начало</option>' + templates + '</select></div>' +
        '<div style="margin-bottom:16px;display:flex;gap:8px;align-items:center">' +
          '<input type="checkbox" id="nb_with_photo"><label style="font-size:0.85rem;color:#94a3b8">Добавить фото-блок</label>' +
        '</div>' +
        '<div id="nb_photo_upload" style="display:none;margin-bottom:12px;padding:12px;background:#0f172a;border-radius:8px;border:1px dashed #8B5CF6">' +
          '<label style="font-size:0.75rem;color:#a78bfa;font-weight:600;display:block;margin-bottom:8px"><i class="fas fa-image" style="margin-right:4px"></i>URL фотографии</label>' +
          '<input class="input" id="nb_photo_url" placeholder="https://example.com/photo.jpg">' +
          '<p style="font-size:0.7rem;color:#475569;margin-top:4px">Вставьте URL изображения. Загрузка с компьютера через base64 ниже.</p>' +
          '<div style="margin-top:8px"><label class="btn btn-outline" style="font-size:0.78rem;padding:6px 14px;cursor:pointer"><i class="fas fa-upload" style="margin-right:4px"></i>Загрузить с компьютера<input type="file" accept="image/*" id="nb_photo_file" style="display:none" onchange="handlePhotoUpload(this)"></label></div>' +
          '<div id="nb_photo_preview" style="margin-top:8px"></div>' +
        '</div>' +
      '</div>' +

      '<div id="newBlockCopy" style="display:none">' +
        '<div style="margin-bottom:12px"><label style="font-size:0.75rem;color:#64748b">Копировать блок</label><select class="input" id="nb_copy_from">' + templates + '</select></div>' +
        '<div style="display:grid;grid-template-columns:120px 1fr;gap:10px;margin-bottom:12px">' +
          '<div><label style="font-size:0.75rem;color:#64748b">Новый ID</label><input class="input" id="nb_copy_id" placeholder="copy_block"></div>' +
          '<div><label style="font-size:0.75rem;color:#8B5CF6">Новое название</label><input class="input" id="nb_copy_name" placeholder="Копия блока"></div>' +
        '</div>' +
        '<div style="margin-bottom:12px"><label style="font-size:0.75rem;color:#64748b">Вставить после блока</label><select class="input" id="nb_copy_after"><option value="_top">В начало</option>' + templates + '</select></div>' +
        '<div style="margin-bottom:16px;display:flex;gap:8px;align-items:center">' +
          '<input type="checkbox" id="nb_copy_with_photo"><label style="font-size:0.85rem;color:#94a3b8">Добавить фото при копировании</label>' +
        '</div>' +
        '<div id="nb_copy_photo_upload" style="display:none;margin-bottom:12px;padding:12px;background:#0f172a;border-radius:8px;border:1px dashed #8B5CF6">' +
          '<label style="font-size:0.75rem;color:#a78bfa;font-weight:600;display:block;margin-bottom:8px"><i class="fas fa-image" style="margin-right:4px"></i>URL фотографии для копии</label>' +
          '<input class="input" id="nb_copy_photo_url" placeholder="https://example.com/photo.jpg">' +
          '<div style="margin-top:8px"><label class="btn btn-outline" style="font-size:0.78rem;padding:6px 14px;cursor:pointer"><i class="fas fa-upload" style="margin-right:4px"></i>Загрузить с компьютера<input type="file" accept="image/*" id="nb_copy_photo_file" style="display:none" onchange="handlePhotoUploadCopy(this)"></label></div>' +
          '<div id="nb_copy_photo_preview" style="margin-top:8px"></div>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;gap:10px;margin-top:16px">' +
        '<button class="btn btn-primary" onclick="submitCreateBlock()"><i class="fas fa-check" style="margin-right:4px"></i>Создать</button>' +
        '<button class="btn btn-outline" onclick="document.getElementById(&apos;createBlockModal&apos;).remove()">Отмена</button>' +
      '</div>' +
    '</div></div>';

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Wire up checkbox toggles
  document.getElementById('nb_with_photo').onchange = function() {
    document.getElementById('nb_photo_upload').style.display = this.checked ? 'block' : 'none';
  };
  document.getElementById('nb_copy_with_photo').onchange = function() {
    document.getElementById('nb_copy_photo_upload').style.display = this.checked ? 'block' : 'none';
  };

  var idField = document.getElementById('nb_id');
  if (idField) idField.focus();
}

function switchNewBlockTab(tab) {
  document.getElementById('newBlockBlank').style.display = tab === 'blank' ? 'block' : 'none';
  document.getElementById('newBlockCopy').style.display = tab === 'copy' ? 'block' : 'none';
  document.getElementById('newBlockTabBlank').className = 'tab-btn' + (tab === 'blank' ? ' active' : '');
  document.getElementById('newBlockTabCopy').className = 'tab-btn' + (tab === 'copy' ? ' active' : '');
}

// Handle photo file upload → base64 preview (for blocks with photos)
function handlePhotoUpload(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('nb_photo_url').value = e.target.result;
    document.getElementById('nb_photo_preview').innerHTML = '<img src="' + e.target.result + '" style="max-width:120px;max-height:80px;border-radius:6px;margin-top:6px">';
  };
  reader.readAsDataURL(input.files[0]);
}
function handlePhotoUploadCopy(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('nb_copy_photo_url').value = e.target.result;
    document.getElementById('nb_copy_photo_preview').innerHTML = '<img src="' + e.target.result + '" style="max-width:120px;max-height:80px;border-radius:6px;margin-top:6px">';
  };
  reader.readAsDataURL(input.files[0]);
}

// Submit new block creation
async function submitCreateBlock() {
  var isBlank = document.getElementById('newBlockBlank').style.display !== 'none';

  if (isBlank) {
    var id = document.getElementById('nb_id').value.trim();
    var nameRu = document.getElementById('nb_name_ru').value.trim();
    var nameAm = document.getElementById('nb_name_am').value.trim();
    var afterBlock = document.getElementById('nb_after').value;
    var withPhoto = document.getElementById('nb_with_photo').checked;
    var photoUrl = document.getElementById('nb_photo_url').value.trim();

    if (!id) { toast('Укажите ID блока (англ)', 'error'); return; }
    if (!nameRu) nameRu = id;
    // Transliterate if needed
    id = id.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');

    // Create content record
    await api('/content', { method: 'POST', body: JSON.stringify({ section_key: id, section_name: nameRu, content_json: [{ ru: '', am: '' }] }) });

    // Insert into section order at position
    var insertIdx = 0;
    if (afterBlock !== '_top') {
      for (var i = 0; i < data.sectionOrder.length; i++) {
        if (data.sectionOrder[i].section_id === afterBlock) { insertIdx = i + 1; break; }
      }
    }
    data.sectionOrder.splice(insertIdx, 0, { section_id: id, sort_order: insertIdx, is_visible: 1, label_ru: nameRu, label_am: nameAm, _expanded: true });
    // Re-index
    for (var j = 0; j < data.sectionOrder.length; j++) data.sectionOrder[j].sort_order = j;
    await saveAllBlocks();

    // Photo block
    if (withPhoto && photoUrl) {
      await api('/photo-blocks', { method: 'POST', body: JSON.stringify({ block_name: nameRu + ' фото', position: id, is_visible: 1, photos_json: JSON.stringify([{ url: photoUrl, caption: '' }]) }) });
    }
  } else {
    // Copy mode
    var copyFrom = document.getElementById('nb_copy_from').value;
    var newId = document.getElementById('nb_copy_id').value.trim();
    var newName = document.getElementById('nb_copy_name').value.trim();
    var afterBlock2 = document.getElementById('nb_copy_after').value;
    var withPhoto2 = document.getElementById('nb_copy_with_photo').checked;
    var photoUrl2 = document.getElementById('nb_copy_photo_url').value.trim();

    if (!newId) { toast('Укажите новый ID', 'error'); return; }
    newId = newId.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
    if (!newName) newName = 'Копия: ' + copyFrom;

    // Find source content
    var srcContent = data.content.find(function(c) { return c.section_key === copyFrom; });
    var srcItems = [];
    if (srcContent) { try { srcItems = JSON.parse(srcContent.content_json); } catch(e) { srcItems = []; } }

    // Create copy
    await api('/content', { method: 'POST', body: JSON.stringify({ section_key: newId, section_name: newName, content_json: srcItems }) });

    var insertIdx2 = 0;
    if (afterBlock2 !== '_top') {
      for (var k = 0; k < data.sectionOrder.length; k++) {
        if (data.sectionOrder[k].section_id === afterBlock2) { insertIdx2 = k + 1; break; }
      }
    }
    data.sectionOrder.splice(insertIdx2, 0, { section_id: newId, sort_order: insertIdx2, is_visible: 1, label_ru: newName, label_am: '', _expanded: true });
    for (var m = 0; m < data.sectionOrder.length; m++) data.sectionOrder[m].sort_order = m;
    await saveAllBlocks();

    // Copy photo blocks from source
    var srcPhotos = (data.photoBlocks || []).filter(function(p) { return p.position === copyFrom; });
    for (var pi = 0; pi < srcPhotos.length; pi++) {
      await api('/photo-blocks', { method: 'POST', body: JSON.stringify({ block_name: srcPhotos[pi].block_name + ' (копия)', position: newId, is_visible: 1, photos_json: srcPhotos[pi].photos_json, description_ru: srcPhotos[pi].description_ru, description_am: srcPhotos[pi].description_am }) });
    }
    // Additional photo
    if (withPhoto2 && photoUrl2) {
      await api('/photo-blocks', { method: 'POST', body: JSON.stringify({ block_name: newName + ' фото', position: newId, is_visible: 1, photos_json: JSON.stringify([{ url: photoUrl2, caption: '' }]) }) });
    }

    // Copy site_block entry from source for immediate editing
    var srcSiteBlock2 = (data.siteBlocks || []).find(function(sb) { return sb.block_key === copyFrom; });
    if (srcSiteBlock2) {
      await api('/site-blocks', { method: 'POST', body: JSON.stringify({
        block_key: newId, block_type: srcSiteBlock2.block_type || 'section',
        title_ru: newName, title_am: '',
        texts_ru: srcSiteBlock2.texts_ru || [], texts_am: srcSiteBlock2.texts_am || [],
        images: srcSiteBlock2.images || [], buttons: srcSiteBlock2.buttons || [],
        custom_css: srcSiteBlock2.custom_css || '', custom_html: srcSiteBlock2.custom_html || '{}',
        social_links: typeof srcSiteBlock2.social_links === 'string' ? srcSiteBlock2.social_links : JSON.stringify(srcSiteBlock2.social_links || []),
        is_visible: 1
      }) });
    }
  }

  document.getElementById('createBlockModal').remove();
  toast('Блок создан!');
  await loadData();
  render();
}

// Duplicate block (quick copy with auto-generated ID)
async function duplicateBlock(idx) {
  var sec = data.sectionOrder[idx];
  if (!sec) return;
  if (!confirm('Копировать блок "' + (sec.label_ru || sec.section_id) + '"?')) return;

  var newId = sec.section_id + '_copy_' + Date.now().toString(36);
  var newName = (sec.label_ru || sec.section_id) + ' (копия)';

  // Copy content
  var srcContent = data.content.find(function(c) { return c.section_key === sec.section_id; });
  var srcItems = [];
  if (srcContent) { try { srcItems = JSON.parse(srcContent.content_json); } catch(e) { srcItems = []; } }
  await api('/content', { method: 'POST', body: JSON.stringify({ section_key: newId, section_name: newName, content_json: srcItems }) });

  // Insert after source
  data.sectionOrder.splice(idx + 1, 0, { section_id: newId, sort_order: idx + 1, is_visible: 1, label_ru: newName, label_am: sec.label_am || '', _expanded: true });
  for (var j = 0; j < data.sectionOrder.length; j++) data.sectionOrder[j].sort_order = j;
  await saveAllBlocks();

  // Copy photo blocks
  var srcPhotos = (data.photoBlocks || []).filter(function(p) { return p.position === sec.section_id; });
  for (var pi = 0; pi < srcPhotos.length; pi++) {
    await api('/photo-blocks', { method: 'POST', body: JSON.stringify({ block_name: srcPhotos[pi].block_name + ' (копия)', position: newId, is_visible: 1, photos_json: srcPhotos[pi].photos_json }) });
  }

  // Copy site_block entry so the new block is immediately editable in Constructor
  var srcSiteBlock = (data.siteBlocks || []).find(function(sb) { return sb.block_key === sec.section_id; });
  if (srcSiteBlock) {
    var copiedBlock = {
      block_key: newId,
      block_type: srcSiteBlock.block_type || 'section',
      title_ru: newName,
      title_am: srcSiteBlock.title_am || '',
      texts_ru: srcSiteBlock.texts_ru || [],
      texts_am: srcSiteBlock.texts_am || [],
      images: srcSiteBlock.images || [],
      buttons: srcSiteBlock.buttons || [],
      custom_css: srcSiteBlock.custom_css || '',
      custom_html: srcSiteBlock.custom_html || '{}',
      social_links: typeof srcSiteBlock.social_links === 'string' ? srcSiteBlock.social_links : JSON.stringify(srcSiteBlock.social_links || []),
      is_visible: 1,
      sort_order: idx + 1
    };
    await api('/site-blocks', { method: 'POST', body: JSON.stringify(copiedBlock) });
    // Sync the new block to site immediately
    var updatedBlocks = await api('/site-blocks');
    data.siteBlocks = (updatedBlocks && updatedBlocks.blocks) || [];
    var newBlock = data.siteBlocks.find(function(sb) { return sb.block_key === newId; });
    if (newBlock) {
      await api('/site-blocks/' + newBlock.id + '/sync-to-site', { method: 'POST' });
    }
  }

  toast('Блок скопирован!');
  await loadData();
  render();
}

// Delete block completely
async function deleteBlock(idx) {
  var sec = data.sectionOrder[idx];
  if (!sec) return;
  if (!confirm('Удалить блок "' + (sec.label_ru || sec.section_id) + '"? Это удалит все тексты и фото блока.')) return;

  // Delete content
  await api('/content/' + sec.section_id, { method: 'DELETE' });
  // Delete photo blocks attached
  var photos = (data.photoBlocks || []).filter(function(p) { return p.position === sec.section_id; });
  for (var pi = 0; pi < photos.length; pi++) {
    await api('/photo-blocks/' + photos[pi].id, { method: 'DELETE' });
  }
  // Remove from section order
  data.sectionOrder.splice(idx, 1);
  for (var j = 0; j < data.sectionOrder.length; j++) data.sectionOrder[j].sort_order = j;
  await saveAllBlocks();

  toast('Блок удалён');
  await loadData();
  render();
}

// seedContent — load texts from live site
async function seedContent() {
  toast('Загрузка текстов с сайта...', 'info');
  var res = await fetch('/api/admin/seed-from-site', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } });
  if (res.ok) {
    toast('Тексты успешно загружены!');
    await loadData(); render();
  } else {
    toast('Ошибка загрузки', 'error');
  }
}


`;
