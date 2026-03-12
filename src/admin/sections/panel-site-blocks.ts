/**
 * Admin Panel — Site blocks constructor V3
 * 2334 lines of JS code for the admin SPA
 */
export const CODE = `
// ===== SITE BLOCKS CONSTRUCTOR — Professional Workspace V3 =====
var sbLangView = 'both'; // 'both', 'ru', 'am'
var sbExpandedBlocks = {}; // track which blocks are expanded
var sbSearchQuery = ''; // search/filter blocks
var sbSortableInstance = null; // SortableJS instance
var sbSaveTimers = {}; // per-block debounce timers
var sbSaveStatus = 'hidden'; // 'hidden', 'saving', 'saved'
var sbActiveTab = 'blocks'; // 'blocks', 'calculator', 'telegram', 'slots', 'footer', 'photos'

async function refreshSiteManagement() {
  toast('Обновление данных...', 'info');
  try {
    await loadData();
    render();
    toast('Данные обновлены!');
  } catch(e) {
    toast('Ошибка обновления: ' + (e.message || 'unknown'), 'error');
  }
}

function renderSiteBlocks() {
  var allBlocks = data.siteBlocks || [];
  var contentBlocks = allBlocks; // ALL blocks shown together (calculator included as card)
  var calcBlocks = allBlocks.filter(function(b) { return b.block_type === 'calculator'; });
  var blocks = sbActiveTab === 'blocks' ? contentBlocks : contentBlocks;
  
  // Define which block_keys have photos by design
  // All block types support photos EXCEPT calculator and ticker
  var noPhotoTypes = { calculator: true, ticker: true };
  var photoBlocks = {};
  for (var pbx = 0; pbx < blocks.length; pbx++) {
    if (!noPhotoTypes[blocks[pbx].block_type] && !noPhotoTypes[blocks[pbx].block_key]) {
      photoBlocks[blocks[pbx].block_key] = true;
    }
  }
  // Define which blocks can have social links
  var socialBlocks = { hero: true, about: true, services: true, contact: true, footer: true, wb_banner: true, wb_official: true };
  
  // Filter by search
  if (sbSearchQuery) {
    var q = sbSearchQuery.toLowerCase();
    blocks = blocks.filter(function(b) {
      return (b.title_ru || '').toLowerCase().includes(q) || (b.title_am || '').toLowerCase().includes(q) || (b.block_key || '').toLowerCase().includes(q) ||
        (b.texts_ru || []).some(function(t) { return (t || '').toLowerCase().includes(q); }) ||
        (b.texts_am || []).some(function(t) { return (t || '').toLowerCase().includes(q); });
    });
  }
  
  var showRu = sbLangView === 'both' || sbLangView === 'ru';
  var showAm = sbLangView === 'both' || sbLangView === 'am';
  var h = '<div style="padding:24px 28px;max-width:1400px;margin:0 auto">';

  // ── Header ──
  h += '<div style="margin-bottom:24px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">' +
      '<div><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:2px"><i class="fas fa-layer-group" style="color:#8B5CF6;margin-right:10px"></i>Управление сайтом</h1>' +
      '<p style="color:#64748b;font-size:0.82rem;margin:0">Блоки, счётчики, PDF-шаблон, реферальные коды — всё в одном месте.</p></div>' +
      '<button class="btn btn-outline" onclick="refreshSiteManagement()" title="Обновить данные" style="padding:8px 16px"><i class="fas fa-sync-alt" style="margin-right:6px"></i>Обновить</button>' +
    '</div>';

  // ── Tabs: Blocks / Calculator / Quick Messages (analytics-style) ──
  var totalBlockBtns = 0;
  for (var tbi = 0; tbi < allBlocks.length; tbi++) {
    var tbBtns = allBlocks[tbi].buttons || [];
    if (typeof tbBtns === 'string') { try { tbBtns = JSON.parse(tbBtns); } catch(e) { tbBtns = []; } }
    totalBlockBtns += tbBtns.length;
  }
  var sbTabs = [
    { id: 'blocks', icon: 'fa-cubes', label: 'Блоки сайта', count: contentBlocks.length },
    { id: 'pdf_inline', icon: 'fa-file-pdf', label: 'PDF шаблон', count: -1 },
    { id: 'referrals_inline', icon: 'fa-gift', label: 'Реферальные коды', count: data.referrals.length }
  ];
  h += '<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">';
  for (var sti = 0; sti < sbTabs.length; sti++) {
    var st = sbTabs[sti];
    h += '<button class="tab-btn' + (sbActiveTab === st.id ? ' active' : '') + '" onclick="collectPdfFields();sbActiveTab=&apos;' + st.id + '&apos;;render()" style="padding:10px 20px"><i class="fas ' + st.icon + '" style="margin-right:6px"></i>' + st.label + (st.count >= 0 ? ' <span style="opacity:0.6;font-size:0.75rem;margin-left:4px">(' + st.count + ')</span>' : '') + '</button>';
  }
  h += '</div>';

  // ── If slots tab selected, render slot counters inline ──
  if (sbActiveTab === 'slots') {
    h += '</div>'; // close header
    h += renderSlotCounter();
    return h;
  }

  // ── If PDF tab selected, render PDF template inline ──
  if (sbActiveTab === 'pdf_inline') {
    h += '</div>'; // close header
    h += renderPdfTemplate();
    return h;
  }

  // ── If referrals tab selected, render referral codes inline ──
  if (sbActiveTab === 'referrals_inline') {
    h += '</div>'; // close header
    h += renderReferrals();
    return h;
  }

  // ── Search + Toolbar (only for blocks/calculator tabs) ──
  h += '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px">' +
    '<div style="flex:1;min-width:200px;max-width:320px" class="sb-search-box"><i class="fas fa-search"></i><input class="input" placeholder="Поиск по блокам..." value="' + escHtml(sbSearchQuery) + '" oninput="sbSearchQuery=this.value;render()" style="font-size:0.85rem"></div>' +
    '<div style="display:flex;gap:8px;margin-left:auto">' +
      '<button class="btn btn-success" onclick="importSiteBlocks()" style="white-space:nowrap;font-size:0.82rem"><i class="fas fa-download" style="margin-right:5px"></i>Загрузить с сайта</button>' +
      '<button class="btn btn-primary" onclick="createSiteBlock()" style="white-space:nowrap;font-size:0.82rem"><i class="fas fa-plus" style="margin-right:5px"></i>Новый блок</button>' +
    '</div>' +
  '</div>';

  // ── Toolbar: Language + Stats + Expand ──
  h += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
    '<div style="display:flex;gap:4px;align-items:center">' +
      '<span style="font-size:0.78rem;color:#64748b;margin-right:4px"><i class="fas fa-language" style="margin-right:3px"></i>Язык:</span>' +
      '<button class="btn ' + (sbLangView==='both'?'btn-primary':'btn-outline') + '" style="padding:5px 14px;font-size:0.78rem" onclick="sbLangView=&apos;both&apos;;render()">RU + AM</button>' +
      '<button class="btn ' + (sbLangView==='ru'?'btn-primary':'btn-outline') + '" style="padding:5px 14px;font-size:0.78rem" onclick="sbLangView=&apos;ru&apos;;render()">RU</button>' +
      '<button class="btn ' + (sbLangView==='am'?'btn-primary':'btn-outline') + '" style="padding:5px 14px;font-size:0.78rem" onclick="sbLangView=&apos;am&apos;;render()">AM</button>' +
    '</div>' +
    '<div style="display:flex;gap:10px;align-items:center;font-size:0.78rem;color:#475569">' +
      '<span><i class="fas fa-eye" style="color:#10B981;margin-right:3px"></i>' + blocks.filter(function(b){return b.is_visible}).length + ' видимых</span>' +
      '<span>|</span>' +
      '<span style="cursor:pointer;color:#8B5CF6" onclick="sbExpandAll()"><i class="fas fa-expand-alt" style="margin-right:3px"></i>Раскрыть</span>' +
      '<span style="cursor:pointer;color:#94a3b8" onclick="sbCollapseAll()"><i class="fas fa-compress-alt" style="margin-right:3px"></i>Свернуть</span>' +
    '</div>' +
  '</div>';
  h += '</div>'; // end header

  if (blocks.length === 0 && !sbSearchQuery) {
    h += '<div class="card" style="text-align:center;padding:60px;color:#64748b">' +
      '<i class="fas fa-layer-group" style="font-size:3rem;margin-bottom:16px;display:block;opacity:0.3"></i>' +
      '<p style="font-size:1.1rem;margin-bottom:8px">Блоки ещё не загружены</p>' +
      '<p style="font-size:0.85rem;margin-bottom:20px">Нажмите «Загрузить с сайта» чтобы импортировать все секции.</p>' +
      '<button class="btn btn-success" onclick="importSiteBlocks()"><i class="fas fa-download" style="margin-right:6px"></i>Загрузить с сайта</button></div>';
  } else if (blocks.length === 0 && sbSearchQuery) {
    h += '<div class="card" style="text-align:center;padding:40px;color:#64748b"><i class="fas fa-search" style="font-size:2rem;margin-bottom:12px;display:block;opacity:0.3"></i><p>Ничего не найдено по запросу «' + escHtml(sbSearchQuery) + '»</p></div>';
  } else {
    // ── Block list (sortable) ──
    h += '<div id="sbBlockList">';
    for (var bi = 0; bi < blocks.length; bi++) {
      var b = blocks[bi];
      var isExpanded = !!sbExpandedBlocks[b.id];
      var textsRu = Array.isArray(b.texts_ru) ? b.texts_ru : [];
      var textsAm = Array.isArray(b.texts_am) ? b.texts_am : [];
      // Ensure all items are strings (protect against null/undefined entries)
      for (var _ti = 0; _ti < textsRu.length; _ti++) { if (textsRu[_ti] == null) textsRu[_ti] = ''; }
      for (var _ti2 = 0; _ti2 < textsAm.length; _ti2++) { if (textsAm[_ti2] == null) textsAm[_ti2] = ''; }
      var maxTexts = Math.max(textsRu.length, textsAm.length);
      var btnsCount = (b.buttons||[]).length;
      var isTicker = (b.block_key === 'ticker' || b.block_type === 'ticker');

      h += '<div class="card sb-block-item" data-block-id="' + b.id + '" style="margin-bottom:12px;padding:0;overflow:hidden;opacity:' + (b.is_visible ? '1' : '0.5') + ';border-left:4px solid ' + (b.is_visible ? '#8B5CF6' : '#475569') + '">';

      // ── Block header (always visible) ──
      h += '<div style="display:flex;align-items:center;gap:8px;padding:12px 16px;background:' + (isExpanded ? '#141c2e' : '#1e293b') + ';cursor:pointer;user-select:none" onclick="toggleSbExpand(' + b.id + ')">';

      // Drag handle (grab with mouse to reorder)
      h += '<div class="sb-drag-handle" onclick="event.stopPropagation()" title="Зажмите и перетащите для изменения порядка">' +
        '<i class="fas fa-grip-vertical" style="font-size:1.4rem"></i>' +
      '</div>';

      // Number badge
      h += '<span style="color:#475569;font-size:0.75rem;font-weight:800;min-width:28px;text-align:center;background:#0f172a;padding:3px 7px;border-radius:6px">' + (bi + 1) + '</span>';

      // Title + badges
      h += '<div style="flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap;overflow:hidden">';
      h += '<span style="font-weight:700;font-size:0.95rem;color:' + (b.is_visible ? '#e2e8f0' : '#94a3b8') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px">' + escHtml(b.title_ru || b.block_key) + '</span>';
      h += '<span class="badge badge-purple" style="font-size:0.68rem">' + escHtml(b.block_key) + '</span>';
      if (b.block_type && b.block_type !== 'section') h += '<span class="badge" style="background:rgba(251,191,36,0.12);color:#fbbf24;font-size:0.68rem">' + escHtml(b.block_type) + '</span>';
      if (maxTexts > 0) h += '<span class="badge" style="background:rgba(59,130,246,0.12);color:#60a5fa;font-size:0.68rem">' + maxTexts + ' текст.</span>';
      if (btnsCount > 0) h += '<span class="badge badge-amber" style="font-size:0.68rem">' + btnsCount + ' кноп.</span>';
      h += '</div>';

      // Quick actions
      h += '<div style="display:flex;gap:3px" onclick="event.stopPropagation()">';
      h += '<button class="btn ' + (b.is_visible ? 'btn-outline' : 'btn-danger') + '" style="padding:4px 8px;font-size:0.72rem" onclick="toggleSbVisible(' + b.id + ',' + (b.is_visible?0:1) + ')" title="' + (b.is_visible ? 'Скрыть блок' : 'Показать блок') + '">' + (b.is_visible ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>') + '</button>';
      h += '<button class="btn btn-outline" style="padding:4px 8px;font-size:0.72rem;color:#f87171;border-color:rgba(248,113,113,0.3)" onclick="delSiteBlock(' + b.id + ')" title="Удалить"><i class="fas fa-trash"></i></button>';
      h += '</div>';

      // Expand arrow
      h += '<i class="fas fa-chevron-' + (isExpanded ? 'up' : 'down') + '" style="color:#475569;font-size:0.8rem;min-width:16px;text-align:center"></i>';
      h += '</div>'; // end header

      // ── Expanded editor ──
      if (isExpanded) {
        h += '<div style="padding:20px;background:#0f172a;border-top:1px solid #1e293b">';

        // ── Block ID + Title row ──
        h += '<div style="display:grid;grid-template-columns:' + (showRu && showAm ? '200px 1fr 1fr' : '200px 1fr') + ';gap:12px;margin-bottom:18px">';
        h += '<div class="sb-field-group"><div class="sb-field-label" style="color:#64748b"><i class="fas fa-key"></i> ID блока</div><input class="input" value="' + escHtml(b.block_key) + '" disabled style="font-size:0.82rem;opacity:0.6;cursor:not-allowed"></div>';
        if (showRu) h += '<div class="sb-field-group"><div class="sb-field-label ru"><i class="fas fa-heading"></i> Название блока (RU)</div><input class="input" id="sb_title_ru_' + b.id + '" value="' + escHtml(b.title_ru) + '" style="font-weight:700;font-size:0.95rem" onchange="sbAutoSave(' + b.id + ')"></div>';
        if (showAm) h += '<div class="sb-field-group"><div class="sb-field-label am"><i class="fas fa-heading"></i> Վերնագիր (AM)</div><input class="input" id="sb_title_am_' + b.id + '" value="' + escHtml(b.title_am) + '" style="font-weight:700;font-size:0.95rem" onchange="sbAutoSave(' + b.id + ')"></div>';
        h += '</div>';

        // ── ELEMENT ORDER within section (drag-sort content blocks on site) ──
        var elOrderOpts = {};
        try { elOrderOpts = JSON.parse(b.custom_html || '{}'); } catch(e) { elOrderOpts = {}; }
        var defaultOrder = ['photo', 'title', 'stats', 'texts', 'buttons', 'socials'];
        var elOrder = (elOrderOpts.element_order && Array.isArray(elOrderOpts.element_order) && elOrderOpts.element_order.length > 0) ? elOrderOpts.element_order : defaultOrder;
        // Ensure all default elements are present
        for (var dei = 0; dei < defaultOrder.length; dei++) { if (elOrder.indexOf(defaultOrder[dei]) < 0) elOrder.push(defaultOrder[dei]); }
        var elLabels = { photo: '\\u{1F4F7} Фото', title: '\\u{1F4CB} Заголовок', stats: '\\u{1F4CA} Счётчик/Стат.', texts: '\\u{1F4DD} Тексты', buttons: '\\u{1F517} Кнопки', socials: '\\u{1F310} Соц. сети' };
        var elIcons = { photo: 'fas fa-camera', title: 'fas fa-heading', stats: 'fas fa-chart-bar', texts: 'fas fa-align-left', buttons: 'fas fa-hand-pointer', socials: 'fas fa-share-alt' };
        h += '<details style="margin-bottom:16px"><summary style="font-size:0.82rem;font-weight:700;color:#a78bfa;cursor:pointer"><i class="fas fa-sort" style="margin-right:6px"></i>Порядок элементов на сайте <span style="font-weight:400;color:#475569;font-size:0.72rem">(перетащи для перестановки)</span></summary>';
        h += '<div id="sb_elorder_' + b.id + '" style="margin-top:8px;padding:10px;background:#1a2236;border:1px solid #293548;border-radius:8px">';
        for (var eoi = 0; eoi < elOrder.length; eoi++) {
          var eKey = elOrder[eoi];
          var eLabel = elLabels[eKey] || eKey;
          var eIcon = elIcons[eKey] || 'fas fa-circle';
          h += '<div class="sb-elorder-item" data-elkey="' + eKey + '" style="display:flex;align-items:center;gap:8px;padding:6px 10px;margin-bottom:4px;background:#0f172a;border:1px solid #293548;border-radius:6px;cursor:grab;user-select:none">';
          h += '<i class="fas fa-grip-vertical" style="color:#475569;font-size:0.75rem"></i>';
          h += '<i class="' + eIcon + '" style="color:#8B5CF6;font-size:0.8rem;min-width:18px;text-align:center"></i>';
          h += '<span style="flex:1;font-size:0.78rem;color:#e2e8f0">' + eLabel + '</span>';
          // Up/down arrows
          h += '<div style="display:flex;gap:2px">';
          if (eoi > 0) h += '<button style="background:none;border:none;color:#8B5CF6;cursor:pointer;padding:2px 4px;font-size:0.72rem" onclick="sbMoveElement(' + b.id + ',&apos;' + eKey + '&apos;,-1)" title="Вверх"><i class="fas fa-chevron-up"></i></button>';
          if (eoi < elOrder.length - 1) h += '<button style="background:none;border:none;color:#8B5CF6;cursor:pointer;padding:2px 4px;font-size:0.72rem" onclick="sbMoveElement(' + b.id + ',&apos;' + eKey + '&apos;,1)" title="Вниз"><i class="fas fa-chevron-down"></i></button>';
          h += '</div>';
          h += '</div>';
        }
        h += '</div></details>';

        // ── SEO / OPEN GRAPH EDITOR ──
        var isSeoBlock = (b.block_key === 'seo_og' || b.block_type === 'seo');
        if (isSeoBlock) {
          h += '<div style="margin-bottom:16px;padding:16px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:10px">';
          h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">' +
            '<i class="fas fa-search" style="color:#10B981;font-size:1.2rem"></i>' +
            '<h4 style="font-size:0.95rem;font-weight:700;color:#6ee7b7">SEO / Open Graph</h4>' +
            '<span style="font-size:0.72rem;color:#475569;font-weight:400;margin-left:8px">Превью ссылки в Telegram, WhatsApp, Facebook</span>' +
          '</div>';
          
          // Info box
          h += '<div style="padding:8px 12px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.12);border-radius:6px;margin-bottom:14px;display:flex;align-items:flex-start;gap:8px">' +
            '<i class="fas fa-info-circle" style="color:#10B981;font-size:0.85rem;margin-top:2px"></i>' +
            '<span style="font-size:0.75rem;color:#6ee7b7;line-height:1.4">Эти данные отображаются когда кто-то отправляет ссылку на сайт в мессенджере. После сохранения отправьте ссылку <b>@WebpageBot</b> в Telegram для обновления кэша.</span>' +
          '</div>';
          
          var seoTitleRu = (textsRu[0] || '');
          var seoTitleAm = (textsAm[0] || '');
          var seoDescRu = (textsRu[1] || '');
          var seoDescAm = (textsAm[1] || '');
          var seoImage = (b.photo_url || '');
          
          // OG Title
          h += '<div style="margin-bottom:12px">';
          h += '<div style="font-size:0.72rem;color:#10B981;font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-heading" style="margin-right:4px"></i>Заголовок (og:title)</div>';
          if (showRu) h += '<div style="margin-bottom:6px"><span class="sb-field-label ru" style="font-size:0.68rem;margin-bottom:2px;display:block">RU</span><input class="input" id="sb_tru_' + b.id + '_0" value="' + escHtml(seoTitleRu) + '" placeholder="Go to Top — Продвижение на Wildberries" style="font-size:0.85rem" onchange="sbAutoSave(' + b.id + ')"></div>';
          if (showAm) h += '<div><span class="sb-field-label am" style="font-size:0.68rem;margin-bottom:2px;display:block">AM</span><input class="input" id="sb_tam_' + b.id + '_0" value="' + escHtml(seoTitleAm) + '" placeholder="Go to Top — Առdelays Wildberries-ում" style="font-size:0.85rem" onchange="sbAutoSave(' + b.id + ')"></div>';
          h += '</div>';
          
          // OG Description
          h += '<div style="margin-bottom:12px">';
          h += '<div style="font-size:0.72rem;color:#10B981;font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-align-left" style="margin-right:4px"></i>Описание (og:description)</div>';
          if (showRu) h += '<div style="margin-bottom:6px"><span class="sb-field-label ru" style="font-size:0.68rem;margin-bottom:2px;display:block">RU</span><textarea class="input" id="sb_tru_' + b.id + '_1" rows="2" placeholder="Выкупы живыми людьми, отзывы с реальными фото..." style="font-size:0.85rem;line-height:1.4" onchange="sbAutoSave(' + b.id + ')">' + escHtml(seoDescRu) + '</textarea></div>';
          if (showAm) h += '<div><span class="sb-field-label am" style="font-size:0.68rem;margin-bottom:2px;display:block">AM</span><textarea class="input" id="sb_tam_' + b.id + '_1" rows="2" placeholder="Անdelays մdelays..." style="font-size:0.85rem;line-height:1.4" onchange="sbAutoSave(' + b.id + ')">' + escHtml(seoDescAm) + '</textarea></div>';
          h += '</div>';
          
          // OG Image
          h += '<div style="margin-bottom:12px">';
          h += '<div style="font-size:0.72rem;color:#10B981;font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-image" style="margin-right:4px"></i>Картинка (og:image) <span style="font-weight:400;color:#475569;font-size:0.65rem">рекомендуемый размер: 1200×630px</span></div>';
          h += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
          if (seoImage) h += '<img src="' + escHtml(seoImage) + '" style="width:120px;height:63px;object-fit:cover;border-radius:6px;border:1px solid #334155" onerror="this.style.display=&apos;none&apos;">';
          h += '<input class="input" id="sb_mainphoto_' + b.id + '" value="' + escHtml(seoImage) + '" placeholder="https://gototop.win/static/img/og-image-dark.png" style="flex:1;font-size:0.82rem;color:#6ee7b7;min-width:200px" onchange="sbAutoSave(' + b.id + ')">';
          h += '<label class="btn btn-primary" style="padding:6px 14px;font-size:0.72rem;cursor:pointer;white-space:nowrap;background:#10B981;border-color:#10B981"><i class="fas fa-upload" style="margin-right:4px"></i>Загрузить<input type="file" accept="image/*" style="display:none" onchange="sbUploadPhoto(this,' + b.id + ',&apos;main&apos;)"></label>';
          h += '</div></div>';
          
          // Preview mockup
          h += '<div style="margin-top:14px;padding:12px;background:#1a2236;border-radius:10px;border:1px solid #293548">';
          h += '<div style="font-size:0.68rem;color:#475569;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px"><i class="fab fa-telegram" style="margin-right:4px;color:#26A5E4"></i>Превью в Telegram</div>';
          h += '<div style="background:#1e293b;border-radius:8px;overflow:hidden;max-width:360px">';
          if (seoImage) h += '<img src="' + escHtml(seoImage) + '" style="width:100%;height:auto;max-height:180px;object-fit:cover" onerror="this.style.display=&apos;none&apos;">';
          h += '<div style="padding:10px 12px">';
          h += '<div style="font-size:0.82rem;font-weight:700;color:#e2e8f0;margin-bottom:4px">' + escHtml(seoTitleRu || 'Go to Top') + '</div>';
          h += '<div style="font-size:0.72rem;color:#94a3b8;line-height:1.3">' + escHtml(seoDescRu || 'Описание сайта...') + '</div>';
          h += '</div></div></div>';
          
          h += '</div>'; // end SEO block
        }

        // ── CALCULATOR EDITOR (full — all texts + buttons + link) ──
        var isCalcBlock = (b.block_key === 'calculator' || b.block_type === 'calculator');
        if (isCalcBlock) {
          h += '<div style="margin-bottom:16px;padding:16px;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.15);border-radius:10px">';
          h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">' +
            '<i class="fas fa-calculator" style="color:#8B5CF6;font-size:1.2rem"></i>' +
            '<h4 style="font-size:0.95rem;font-weight:700;color:#a78bfa">Блок калькулятора</h4>' +
          '</div>';
          
          // Show ALL calculator texts (heading, subheading, description, promo label, total label, etc.)
          var calcTextLabels = ['Заголовок секции', 'Подзаголовок', 'Описание', 'Надпись «Итого»', 'Промокод (лейбл)', 'Кнопка «Применить»', 'PDF-форма: заголовок', 'PDF-форма: плейсхолдер «Имя»', 'PDF-форма: плейсхолдер «Телефон»', 'PDF-форма: кнопка «Скачать КП»'];
          var calcTextsCount = Math.max(maxTexts, calcTextLabels.length);
          for (var ti = 0; ti < calcTextsCount; ti++) {
            var ruText = (ti < textsRu.length ? textsRu[ti] : '') || '';
            var amText = (ti < textsAm.length ? textsAm[ti] : '') || '';
            var isLong = ruText.length > 100 || amText.length > 100;
            var fieldLabel = ti < calcTextLabels.length ? calcTextLabels[ti] : 'Текст ' + (ti + 1);
            h += '<div class="sb-text-pair" style="margin-bottom:10px">';
            h += '<div class="sb-text-pair-num">' + fieldLabel + '</div>';
            h += '<div style="display:grid;grid-template-columns:' + (showRu && showAm ? '1fr 1fr' : '1fr') + ';gap:10px;align-items:start">';
            if (showRu) {
              h += '<div class="sb-field-group" style="margin-bottom:0"><div class="sb-field-label ru" style="margin-bottom:3px">RU</div>';
              if (isLong) { h += '<textarea class="input" id="sb_tru_' + b.id + '_' + ti + '" style="min-height:50px;font-size:0.84rem;line-height:1.5" onchange="sbAutoSave(' + b.id + ')">' + escHtml(ruText) + '</textarea>'; }
              else { h += '<input class="input" id="sb_tru_' + b.id + '_' + ti + '" value="' + escHtml(ruText) + '" style="font-size:0.84rem" onchange="sbAutoSave(' + b.id + ')">'; }
              h += '</div>';
            }
            if (showAm) {
              h += '<div class="sb-field-group" style="margin-bottom:0"><div class="sb-field-label am" style="margin-bottom:3px">AM</div>';
              if (isLong) { h += '<textarea class="input" id="sb_tam_' + b.id + '_' + ti + '" style="min-height:50px;font-size:0.84rem;line-height:1.5" onchange="sbAutoSave(' + b.id + ')">' + escHtml(amText) + '</textarea>'; }
              else { h += '<input class="input" id="sb_tam_' + b.id + '_' + ti + '" value="' + escHtml(amText) + '" style="font-size:0.84rem" onchange="sbAutoSave(' + b.id + ')">'; }
              h += '</div>';
            }
            h += '</div></div>';
          }
          
          // ── Calculator buttons section ──
          h += '<div style="margin-top:14px;margin-bottom:14px">';
          h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
            '<h4 style="font-size:0.85rem;font-weight:700;color:#94a3b8"><i class="fas fa-hand-pointer" style="color:#a78bfa;margin-right:6px"></i>Кнопки калькулятора <span style="font-weight:400;color:#475569;font-size:0.78rem">(' + btnsCount + ')</span></h4>' +
            '<button class="btn btn-outline" style="padding:4px 12px;font-size:0.72rem" onclick="sbAddButton(' + b.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Кнопка</button>' +
          '</div>';
          for (var bti = 0; bti < (b.buttons || []).length; bti++) {
            var btn = b.buttons[bti];
            var displayIcon = sbResolveButtonIcon(btn.icon, btn.url);
            h += '<div style="margin-bottom:8px;padding:10px 14px;background:#1a2236;border-radius:10px;border:1px solid #293548;position:relative">';
            h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
            // Move arrows
            h += '<div style="display:flex;flex-direction:column;gap:0">';
            if (bti > 0) h += '<button style="background:none;border:none;color:#8B5CF6;cursor:pointer;padding:0 2px;font-size:0.65rem;line-height:1" onclick="sbMoveButton(' + b.id + ',' + bti + ',-1)" title="Вверх"><i class="fas fa-chevron-up"></i></button>';
            if (bti < (b.buttons || []).length - 1) h += '<button style="background:none;border:none;color:#8B5CF6;cursor:pointer;padding:0 2px;font-size:0.65rem;line-height:1" onclick="sbMoveButton(' + b.id + ',' + bti + ',1)" title="Вниз"><i class="fas fa-chevron-down"></i></button>';
            h += '</div>';
            h += '<div style="min-width:36px;text-align:center"><i class="' + escHtml(displayIcon) + '" style="color:#8B5CF6;font-size:0.9rem"></i></div>';
            if (showRu) h += '<input class="input" id="sb_btnru_' + b.id + '_' + bti + '" value="' + escHtml(btn.text_ru) + '" placeholder="Текст кнопки (RU)" style="font-size:0.82rem;flex:1;min-width:120px" onchange="sbUpdateBtnField(' + b.id + ',' + bti + ',&apos;text_ru&apos;,this.value);sbAutoSave(' + b.id + ')">';
            if (showAm) h += '<input class="input" id="sb_btnam_' + b.id + '_' + bti + '" value="' + escHtml(btn.text_am) + '" placeholder="AM" style="font-size:0.82rem;flex:1;min-width:120px" onchange="sbUpdateBtnField(' + b.id + ',' + bti + ',&apos;text_am&apos;,this.value);sbAutoSave(' + b.id + ')">';
            h += '<button class="tier-del-btn" style="position:static;flex-shrink:0" onclick="sbRemoveButton(' + b.id + ',' + bti + ')"><i class="fas fa-times"></i></button>';
            h += '</div>';
            // Collapsible settings
            h += '<details style="margin-top:6px"><summary style="font-size:0.70rem;color:#64748b;cursor:pointer;user-select:none"><i class="fas fa-cog" style="margin-right:4px"></i>URL и иконка</summary>';
            h += '<div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end">';
            h += '<div><div style="font-size:0.68rem;color:#475569;margin-bottom:3px">URL</div><input class="input" id="sb_btnurl_' + b.id + '_' + bti + '" value="' + escHtml(btn.url || '') + '" placeholder="https://t.me/..." style="font-size:0.78rem" onchange="sbUpdateBtnField(' + b.id + ',' + bti + ',&apos;url&apos;,this.value);sbAutoSave(' + b.id + ')"></div>';
            var iconOptions = [{v:'fab fa-telegram',l:'Telegram'},{v:'fab fa-whatsapp',l:'WhatsApp'},{v:'fas fa-calculator',l:'Калькулятор'},{v:'fas fa-rocket',l:'Ракета'},{v:'fas fa-arrow-right',l:'Стрелка'},{v:'fas fa-file-pdf',l:'PDF'},{v:'fas fa-gift',l:'Подарок'},{v:'fas fa-fire',l:'Огонь'},{v:'fas fa-check-circle',l:'Галочка'},{v:'fas fa-shopping-cart',l:'Корзина'}];
            var currentIcon = btn.icon || 'fas fa-arrow-right';
            h += '<div><div style="font-size:0.68rem;color:#475569;margin-bottom:3px">Иконка</div><select class="input" id="sb_btnicon_' + b.id + '_' + bti + '" style="font-size:0.78rem" onchange="sbUpdateBtnField(' + b.id + ',' + bti + ',&apos;icon&apos;,this.value);sbAutoSave(' + b.id + ')">';
            for (var ici = 0; ici < iconOptions.length; ici++) {
              h += '<option value="' + iconOptions[ici].v + '"' + (currentIcon === iconOptions[ici].v ? ' selected' : '') + '>' + iconOptions[ici].l + '</option>';
            }
            var iconInList = iconOptions.some(function(io) { return io.v === currentIcon; });
            if (!iconInList && currentIcon) h += '<option value="' + escHtml(currentIcon) + '" selected>' + escHtml(currentIcon) + '</option>';
            h += '</select></div>';
            h += '</div></details>';
            h += '</div>';
          }
          if ((b.buttons || []).length === 0) {
            h += '<div style="font-size:0.78rem;color:#475569;padding:8px;text-align:center;border:1px dashed #293548;border-radius:8px">Нет кнопок. Нажмите + чтобы добавить.</div>';
          }
          h += '</div>';
          
          // Link to calculator settings page
          h += '<div style="margin-top:12px;padding:12px;background:#1a2236;border:1px solid #293548;border-radius:8px;display:flex;align-items:center;justify-content:between;gap:12px;cursor:pointer" onclick="navigate(&apos;calculator&apos;)">';
          h += '<div style="flex:1"><div style="font-size:0.85rem;font-weight:700;color:#a78bfa"><i class="fas fa-cog" style="margin-right:6px"></i>Настройки калькулятора</div>';
          h += '<div style="font-size:0.72rem;color:#64748b;margin-top:2px">Вкладки, услуги, цены — редактируются в разделе «Калькулятор»</div></div>';
          h += '<i class="fas fa-arrow-right" style="color:#8B5CF6;font-size:1rem"></i>';
          h += '</div>';
          h += '</div>';
          
        } else if (b.block_type === 'slot_counter') {
          // ── SLOT COUNTER BLOCK EDITOR ──
          h += '<div style="margin-bottom:16px;padding:16px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:10px">';
          h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">' +
            '<i class="fas fa-hourglass-half" style="color:#fbbf24;font-size:1.2rem"></i>' +
            '<h4 style="font-size:0.95rem;font-weight:700;color:#fbbf24">Счётчик слотов</h4>' +
          '</div>';
          
          // Parse counter data from custom_html
          var scOpts = {};
          try { scOpts = JSON.parse(b.custom_html || '{}'); } catch(e) { scOpts = {}; }
          var scTotal = scOpts.total_slots || 10;
          var scBooked = scOpts.booked_slots || 0;
          var scFree = Math.max(0, scTotal - scBooked);
          var scPct = scTotal > 0 ? Math.round((scFree / scTotal) * 100) : 0;
          var scBarClr = scPct > 50 ? '#10B981' : scPct > 20 ? '#F59E0B' : '#EF4444';
          
          // Visual bar preview
          h += '<div style="margin-bottom:14px;padding:12px;background:#0f172a;border-radius:8px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
              '<span style="font-size:0.85rem;color:#94a3b8">' + escHtml(textsRu[0] || 'Свободных мест') + '</span>' +
              '<span style="font-size:1.6rem;font-weight:900;color:' + scBarClr + '">' + scFree + '<span style="color:#64748b;font-weight:400;font-size:0.85rem"> / ' + scTotal + '</span></span>' +
            '</div>' +
            '<div style="height:8px;background:#1e293b;border-radius:4px;overflow:hidden"><div style="height:100%;width:' + scPct + '%;background:' + scBarClr + ';border-radius:4px;transition:width 0.5s"></div></div>' +
          '</div>';
          
          // Inputs: total, booked
          h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">';
          h += '<div><div style="font-size:0.72rem;color:#64748b;margin-bottom:4px;font-weight:600">Всего мест</div><input class="input" type="number" id="sb_sc_total_' + b.id + '" value="' + scTotal + '" style="font-size:0.9rem;font-weight:700" onchange="sbAutoSave(' + b.id + ')"></div>';
          h += '<div><div style="font-size:0.72rem;color:#64748b;margin-bottom:4px;font-weight:600">Занято</div><input class="input" type="number" id="sb_sc_booked_' + b.id + '" value="' + scBooked + '" style="font-size:0.9rem;font-weight:700" onchange="sbAutoSave(' + b.id + ')"></div>';
          h += '<div><div style="font-size:0.72rem;color:#64748b;margin-bottom:4px;font-weight:600">Свободно</div><div style="font-size:2rem;font-weight:900;color:#10B981;padding:4px 0">' + scFree + '</div></div>';
          h += '</div>';
          
          // Labels RU/AM (uses texts_ru[0] and texts_am[0])
          h += '<div style="display:grid;grid-template-columns:' + (showRu && showAm ? '1fr 1fr' : '1fr') + ';gap:12px;margin-bottom:12px">';
          if (showRu) h += '<div><div style="font-size:0.72rem;color:#8B5CF6;margin-bottom:4px;font-weight:600"><i class="fas fa-flag" style="margin-right:4px"></i>Надпись (RU)</div><input class="input" id="sb_tru_' + b.id + '_0" value="' + escHtml(textsRu[0] || 'Свободных мест') + '" style="font-size:0.85rem" onchange="sbAutoSave(' + b.id + ')"></div>';
          if (showAm) h += '<div><div style="font-size:0.72rem;color:#F59E0B;margin-bottom:4px;font-weight:600"><i class="fas fa-flag" style="margin-right:4px"></i>\\u0544\\u0561\\u056f\\u0561\\u0563\\u0580\\u0578\\u0582\\u0569\\u0575\\u0578\\u0582\\u0576 (AM)</div><input class="input" id="sb_tam_' + b.id + '_0" value="' + escHtml(textsAm[0] || '') + '" placeholder="\\u0531\\u0566\\u0561\\u057f \\u057f\\u0565\\u0572\\u0565\\u0580" style="font-size:0.85rem" onchange="sbAutoSave(' + b.id + ')"></div>';
          h += '</div>';
          
          h += '<div style="font-size:0.72rem;color:#475569;margin-top:8px"><i class="fas fa-info-circle" style="margin-right:4px"></i>Этот блок отображается как полоса со счётчиком между секциями. Перетаскивайте его в нужное место.</div>';
          h += '</div>';
          
        } else if (isTicker) {
          h += '<div style="margin-bottom:16px;padding:14px;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.15);border-radius:10px">';
          h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
            '<h4 style="font-size:0.85rem;font-weight:700;color:#a78bfa"><i class="fas fa-stream" style="margin-right:6px"></i>Элементы бегущей строки <span style="font-weight:400;color:#475569;font-size:0.78rem">(' + maxTexts + ' элементов)</span></h4>' +
            '<button class="btn btn-outline" style="padding:4px 12px;font-size:0.72rem" onclick="sbAddTickerItem(' + b.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить элемент</button>' +
          '</div>';
          for (var ti = 0; ti < maxTexts; ti++) {
            var ruT = (ti < textsRu.length ? textsRu[ti] : '') || '';
            var amT = (ti < textsAm.length ? textsAm[ti] : '') || '';
            // Try to extract icon from images array
            var tickerIcons = [];
            try { tickerIcons = b.images || []; } catch(e) {}
            var tickerIcon = (tickerIcons[ti]) || 'fa-check-circle';
            h += '<div style="display:grid;grid-template-columns:120px ' + (showRu && showAm ? '1fr 1fr' : '1fr') + ' 28px;gap:8px;margin-bottom:6px;padding:8px 10px;background:#1a2236;border-radius:8px;border:1px solid #293548;align-items:center">';
            h += '<div><div style="font-size:0.68rem;color:#475569;margin-bottom:4px">Иконка (FA)</div><input class="input" id="sb_ticon_' + b.id + '_' + ti + '" value="' + escHtml(tickerIcon) + '" placeholder="fa-star" style="font-size:0.78rem" onchange="sbAutoSave(' + b.id + ')"></div>';
            if (showRu) h += '<div><div style="font-size:0.68rem;color:#3b82f6;margin-bottom:4px">Текст RU</div><input class="input" id="sb_tru_' + b.id + '_' + ti + '" value="' + escHtml(ruT) + '" style="font-size:0.82rem" onchange="sbAutoSave(' + b.id + ')"></div>';
            if (showAm) h += '<div><div style="font-size:0.68rem;color:#f59e0b;margin-bottom:4px">Текст AM</div><input class="input" id="sb_tam_' + b.id + '_' + ti + '" value="' + escHtml(amT) + '" style="font-size:0.82rem" onchange="sbAutoSave(' + b.id + ')"></div>';
            h += '<button class="tier-del-btn" onclick="sbRemoveTextPair(' + b.id + ',' + ti + ')"><i class="fas fa-times"></i></button>';
            h += '</div>';
          }
          h += '</div>';
        } else if (isSeoBlock) {
          // SEO block has its own dedicated editor above — skip generic texts
        } else {
          // ── Semantic text pairs (for non-ticker blocks) ──
          h += '<div style="margin-bottom:16px">';
          h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
            '<h4 style="font-size:0.85rem;font-weight:700;color:#94a3b8"><i class="fas fa-align-left" style="color:#8B5CF6;margin-right:6px"></i>Тексты блока <span style="font-weight:400;color:#475569;font-size:0.78rem">(' + maxTexts + ' элементов)</span></h4>' +
            '<button class="btn btn-outline" style="padding:4px 12px;font-size:0.72rem" onclick="sbAddTextPair(' + b.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить текст</button>' +
          '</div>';

          for (var ti = 0; ti < maxTexts; ti++) {
            var ruText = (ti < textsRu.length ? textsRu[ti] : '') || '';
            var amText = (ti < textsAm.length ? textsAm[ti] : '') || '';
            var isLong = ruText.length > 100 || amText.length > 100;
            var fieldLabel = sbGetFieldLabel(b.block_key, ti, maxTexts);

            h += '<div class="sb-text-pair" draggable="true" data-block-id="' + b.id + '" data-text-idx="' + ti + '" ondragstart="sbDragStart(event,&apos;text&apos;,' + b.id + ',' + ti + ')" ondragover="sbDragOver(event)" ondragleave="sbDragLeave(event)" ondrop="sbDrop(event,&apos;text&apos;,' + b.id + ',' + ti + ')">';
            h += '<div class="sb-text-pair-num" style="display:flex;align-items:center;justify-content:space-between;gap:8px">';
            h += '<div style="display:flex;align-items:center;gap:6px">';
            h += '<i class="fas fa-grip-vertical" style="color:#475569;cursor:grab;font-size:0.75rem" title="Перетащить"></i>';
            if (ti > 0) h += '<button style="background:none;border:none;color:#8B5CF6;cursor:pointer;padding:2px;font-size:0.7rem" onclick="sbMoveText(' + b.id + ',' + ti + ',-1)" title="Вверх"><i class="fas fa-chevron-up"></i></button>';
            if (ti < maxTexts - 1) h += '<button style="background:none;border:none;color:#8B5CF6;cursor:pointer;padding:2px;font-size:0.7rem" onclick="sbMoveText(' + b.id + ',' + ti + ',1)" title="Вниз"><i class="fas fa-chevron-down"></i></button>';
            h += '<span>' + fieldLabel + '</span>';
            h += '</div>';
            h += '<select class="input" style="width:auto;font-size:0.65rem;padding:2px 6px;background:#1a2236;border:1px solid #293548;color:#64748b;border-radius:4px" onchange="sbSetTextRole(' + b.id + ',' + ti + ',this.value)" title="Тип текста">';
            var roleOptions = ['title','subtitle','text','note'];
            var roleLabels = ['Заголовок','Подзаголовок','Текст','Примечание'];
            var defaultRole = ti === 0 ? 'title' : (ti === 1 ? 'subtitle' : 'text');
            for (var ri = 0; ri < roleOptions.length; ri++) {
              h += '<option value="' + roleOptions[ri] + '"' + (roleOptions[ri] === defaultRole ? ' selected' : '') + '>' + roleLabels[ri] + '</option>';
            }
            h += '</select>';
            h += '</div>';
            h += '<div style="display:grid;grid-template-columns:' + (showRu && showAm ? '1fr 1fr' : '1fr') + ';gap:10px;align-items:start">';
            if (showRu) {
              h += '<div class="sb-field-group" style="margin-bottom:0"><div class="sb-field-label ru" style="margin-bottom:3px">RU</div>';
              if (isLong) {
                h += '<textarea class="input" id="sb_tru_' + b.id + '_' + ti + '" style="min-height:60px;font-size:0.84rem;line-height:1.5" onchange="sbAutoSave(' + b.id + ')">' + escHtml(ruText) + '</textarea>';
              } else {
                h += '<input class="input" id="sb_tru_' + b.id + '_' + ti + '" value="' + escHtml(ruText) + '" style="font-size:0.84rem" onchange="sbAutoSave(' + b.id + ')">';
              }
              h += '</div>';
            }
            if (showAm) {
              h += '<div class="sb-field-group" style="margin-bottom:0"><div class="sb-field-label am" style="margin-bottom:3px">AM</div>';
              if (isLong) {
                h += '<textarea class="input" id="sb_tam_' + b.id + '_' + ti + '" style="min-height:60px;font-size:0.84rem;line-height:1.5" onchange="sbAutoSave(' + b.id + ')">' + escHtml(amText) + '</textarea>';
              } else {
                h += '<input class="input" id="sb_tam_' + b.id + '_' + ti + '" value="' + escHtml(amText) + '" style="font-size:0.84rem" onchange="sbAutoSave(' + b.id + ')">';
              }
              h += '</div>';
            }
            h += '</div>';
            // ── Nav link target selector (only for nav block) ──
            if (b.block_key === 'nav') {
              var navOpts = {}; try { navOpts = JSON.parse(b.custom_html || '{}'); } catch(e) { navOpts = {}; }
              var navLinks = (navOpts && navOpts.nav_links) || [];
              var curTarget = '';
              for (var nli = 0; nli < navLinks.length; nli++) { if (navLinks[nli].idx === ti) { curTarget = navLinks[nli].target || ''; break; } }
              // Dynamic section list built from all site blocks (auto-includes new sections)
              var navSkipTypes = { ticker: true, nav: true, seo_og: true, popup: true, floating_buttons: true };
              var navSectionsList = [];
              var _allNavBlocks = data.siteBlocks || [];
              for (var _nbi = 0; _nbi < _allNavBlocks.length; _nbi++) {
                var _nb = _allNavBlocks[_nbi];
                if (navSkipTypes[_nb.block_type] || navSkipTypes[_nb.block_key]) continue;
                navSectionsList.push({ id: _nb.block_key, label: (_nb.title_ru || _nb.block_key) });
              }
              h += '<div style="margin-top:6px;display:flex;align-items:center;gap:8px">';
              h += '<span style="font-size:0.72rem;color:#a78bfa;font-weight:600;white-space:nowrap"><i class="fas fa-link" style="margin-right:4px"></i>Ссылка на секцию:</span>';
              h += '<select class="input" id="sb_navlink_' + b.id + '_' + ti + '" style="flex:1;font-size:0.78rem;padding:4px 8px;background:#1a2236;border:1px solid #293548;color:#60a5fa;border-radius:6px" onchange="sbSetNavLink(' + b.id + ',' + ti + ',this.value)">';
              h += '<option value="">— выберите секцию —</option>';
              h += '<option value="_telegram"' + (curTarget === '_telegram' ? ' selected' : '') + '>\\u2708 Telegram (внешняя ссылка)</option>';
              for (var asi = 0; asi < navSectionsList.length; asi++) {
                var ns = navSectionsList[asi];
                h += '<option value="' + escHtml(ns.id) + '"' + (curTarget === ns.id || curTarget === ns.id.replace(/-/g, '_') ? ' selected' : '') + '>' + escHtml(ns.label) + '</option>';
              }
              h += '</select>';
              h += '</div>';
            }
            // ── Text style controls (color + size) ──
            var textStyles = b.text_styles || [];
            var curStyle = textStyles[ti] || {};
            var curColor = curStyle.color || '';
            var curSize = curStyle.size || '';
            h += '<div style="display:flex;gap:8px;margin-top:4px;align-items:center;flex-wrap:wrap">';
            h += '<div style="display:flex;align-items:center;gap:4px"><span style="font-size:0.65rem;color:#64748b"><i class="fas fa-palette"></i></span>';
            h += '<input type="color" id="sb_tcolor_' + b.id + '_' + ti + '" value="' + (curColor || '#e2e8f0') + '" style="width:24px;height:20px;border:none;background:none;cursor:pointer;padding:0" onchange="sbSetTextStyle(' + b.id + ',' + ti + ',&apos;color&apos;,this.value)" title="Цвет текста">';
            if (curColor) h += '<button style="background:none;border:none;color:#f87171;cursor:pointer;font-size:0.6rem;padding:0" onclick="sbSetTextStyle(' + b.id + ',' + ti + ',&apos;color&apos;,&apos;&apos;)" title="Сбросить цвет"><i class="fas fa-times"></i></button>';
            h += '</div>';
            h += '<div style="display:flex;align-items:center;gap:4px"><span style="font-size:0.65rem;color:#64748b"><i class="fas fa-text-height"></i></span>';
            h += '<select class="input" id="sb_tsize_' + b.id + '_' + ti + '" style="width:auto;font-size:0.65rem;padding:1px 4px;background:#1a2236;border:1px solid #293548;color:#94a3b8;border-radius:4px" onchange="sbSetTextStyle(' + b.id + ',' + ti + ',&apos;size&apos;,this.value)" title="Размер текста">';
            var sizeOptions = [['','Авто'],['0.75rem','XS'],['0.85rem','S'],['1rem','M'],['1.2rem','L'],['1.5rem','XL'],['2rem','2XL'],['2.5rem','3XL']];
            for (var si = 0; si < sizeOptions.length; si++) {
              h += '<option value="' + sizeOptions[si][0] + '"' + (sizeOptions[si][0] === curSize ? ' selected' : '') + '>' + sizeOptions[si][1] + '</option>';
            }
            h += '</select></div>';
            h += '</div>';
            h += '<button class="tier-del-btn" style="position:absolute;top:6px;right:6px" onclick="sbRemoveTextPair(' + b.id + ',' + ti + ')" title="Удалить текст"><i class="fas fa-times"></i></button>';
            h += '</div>'; // end sb-text-pair
          }
          h += '</div>';
        }

        // ── Skip detail sections for calculator/seo blocks (they have their own compact editor above) ──
        if (!isCalcBlock && !isSeoBlock) {

        // ── Buttons section: compact view with link to "Быстрые сообщения" tab ──
        h += '<div style="margin-bottom:16px">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
          '<h4 style="font-size:0.85rem;font-weight:700;color:#94a3b8"><i class="fas fa-hand-pointer" style="color:#a78bfa;margin-right:6px"></i>Кнопки блока <span style="font-weight:400;color:#475569;font-size:0.78rem">(' + btnsCount + ')</span></h4>' +
          '<div style="display:flex;gap:6px">' +
            '<button class="btn btn-outline" style="padding:4px 12px;font-size:0.72rem" onclick="sbAddButton(' + b.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Кнопка</button>' +
          '</div>' +
        '</div>';
        for (var bti = 0; bti < (b.buttons || []).length; bti++) {
          var btn = b.buttons[bti];
          // Find matching TG message for this button
          var matchedTgMsg = null;
          for (var tmi = 0; tmi < (data.telegram || []).length; tmi++) {
            if (data.telegram[tmi].button_label_ru && btn.text_ru && data.telegram[tmi].button_label_ru.trim() === btn.text_ru.trim()) {
              matchedTgMsg = data.telegram[tmi];
              break;
            }
          }
          var tgBadge = matchedTgMsg 
            ? '<span class="badge badge-green" style="font-size:0.65rem" title="Связан с TG-шаблоном"><i class="fas fa-link" style="margin-right:3px"></i>TG</span>'
            : '';
          
          h += '<div style="margin-bottom:8px;padding:10px 14px;background:#1a2236;border-radius:10px;border:1px solid #293548;position:relative" draggable="true" ondragstart="sbDragStart(event,&apos;btn&apos;,' + b.id + ',' + bti + ')" ondragover="sbDragOver(event)" ondragleave="sbDragLeave(event)" ondrop="sbDrop(event,&apos;btn&apos;,' + b.id + ',' + bti + ')">';
          // Compact row: icon + move buttons + text RU + text AM + action + TG badge + link
          h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
          // Move arrows
          h += '<div style="display:flex;flex-direction:column;gap:0">';
          if (bti > 0) h += '<button style="background:none;border:none;color:#8B5CF6;cursor:pointer;padding:0 2px;font-size:0.65rem;line-height:1" onclick="sbMoveButton(' + b.id + ',' + bti + ',-1)" title="Вверх"><i class="fas fa-chevron-up"></i></button>';
          if (bti < (b.buttons || []).length - 1) h += '<button style="background:none;border:none;color:#8B5CF6;cursor:pointer;padding:0 2px;font-size:0.65rem;line-height:1" onclick="sbMoveButton(' + b.id + ',' + bti + ',1)" title="Вниз"><i class="fas fa-chevron-down"></i></button>';
          h += '</div>';
          // Icon: priority — manual selection > auto-detect from URL > default
          var displayIcon = sbResolveButtonIcon(btn.icon, btn.url);
          h += '<div style="min-width:36px;text-align:center"><i class="' + escHtml(displayIcon) + '" style="color:#8B5CF6;font-size:0.9rem"></i></div>';
          // Button text RU
          if (showRu) h += '<input class="input" id="sb_btnru_' + b.id + '_' + bti + '" value="' + escHtml(btn.text_ru) + '" placeholder="Текст кнопки (RU)" style="font-size:0.82rem;flex:1;min-width:120px" onchange="sbUpdateBtnField(' + b.id + ',' + bti + ',&apos;text_ru&apos;,this.value);sbAutoSave(' + b.id + ')">';
          // Button text AM
          if (showAm) h += '<input class="input" id="sb_btnam_' + b.id + '_' + bti + '" value="' + escHtml(btn.text_am) + '" placeholder="AM" style="font-size:0.82rem;flex:1;min-width:120px" onchange="sbUpdateBtnField(' + b.id + ',' + bti + ',&apos;text_am&apos;,this.value);sbAutoSave(' + b.id + ')">';
          // TG badge
          h += tgBadge;
          // Delete
          h += '<button class="tier-del-btn" style="position:static;flex-shrink:0" onclick="sbRemoveButton(' + b.id + ',' + bti + ')"><i class="fas fa-times"></i></button>';
          h += '</div>';
          // Collapsible: full settings
          h += '<details style="margin-top:6px"><summary style="font-size:0.70rem;color:#64748b;cursor:pointer;user-select:none"><i class="fas fa-cog" style="margin-right:4px"></i>Настройки кнопки (URL, иконка, действие, шаблон)</summary>';
          h += '<div style="margin-top:8px;display:grid;grid-template-columns:160px 1fr 140px;gap:8px;align-items:end">';
          // Icon picker dropdown
          var iconOptions = [
            {v:'fab fa-telegram',l:'Telegram',c:'#26A5E4'},
            {v:'fab fa-whatsapp',l:'WhatsApp',c:'#25D366'},
            {v:'fab fa-instagram',l:'Instagram',c:'#E4405F'},
            {v:'fab fa-facebook',l:'Facebook',c:'#1877F2'},
            {v:'fab fa-tiktok',l:'TikTok',c:'#000'},
            {v:'fab fa-youtube',l:'YouTube',c:'#FF0000'},
            {v:'fab fa-viber',l:'Viber',c:'#7360F2'},
            {v:'fab fa-vk',l:'VK',c:'#4680C2'},
            {v:'fas fa-calculator',l:'Калькулятор',c:'#8B5CF6'},
            {v:'fas fa-rocket',l:'Ракета',c:'#F59E0B'},
            {v:'fas fa-arrow-right',l:'Стрелка',c:'#94a3b8'},
            {v:'fas fa-phone',l:'Телефон',c:'#10B981'},
            {v:'fas fa-envelope',l:'Email',c:'#F59E0B'},
            {v:'fas fa-link',l:'Ссылка',c:'#64748b'},
            {v:'fas fa-shopping-cart',l:'Корзина',c:'#8B5CF6'},
            {v:'fas fa-star',l:'Звезда',c:'#F59E0B'},
            {v:'fas fa-gift',l:'Подарок',c:'#EC4899'},
            {v:'fas fa-fire',l:'Огонь',c:'#EF4444'},
            {v:'fas fa-bolt',l:'Молния',c:'#F59E0B'},
            {v:'fas fa-heart',l:'Сердце',c:'#EC4899'}
          ];
          var currentIcon = btn.icon || 'fas fa-arrow-right';
          h += '<div><div style="font-size:0.68rem;color:#475569;margin-bottom:3px"><i class="' + escHtml(displayIcon) + '" style="margin-right:4px;color:#8B5CF6"></i>Иконка</div><select class="input" id="sb_btnicon_' + b.id + '_' + bti + '" style="font-size:0.78rem" onchange="sbUpdateBtnField(' + b.id + ',' + bti + ',&apos;icon&apos;,this.value);sbAutoSave(' + b.id + ')">';
          for (var ici = 0; ici < iconOptions.length; ici++) {
            h += '<option value="' + iconOptions[ici].v + '"' + (currentIcon === iconOptions[ici].v ? ' selected' : '') + '>' + iconOptions[ici].l + '</option>';
          }
          // If current icon is custom (not in list), add it
          var iconInList = iconOptions.some(function(io) { return io.v === currentIcon; });
          if (!iconInList && currentIcon) {
            h += '<option value="' + escHtml(currentIcon) + '" selected>' + escHtml(currentIcon) + '</option>';
          }
          h += '</select></div>';
          h += '<div><div style="font-size:0.68rem;color:#60a5fa;margin-bottom:3px"><i class="fas fa-link" style="margin-right:3px"></i>URL</div><input class="input" id="sb_btnurl_' + b.id + '_' + bti + '" value="' + escHtml(btn.url || '') + '" placeholder="https://t.me/..." style="font-size:0.78rem;color:#60a5fa" onchange="sbUpdateBtnField(' + b.id + ',' + bti + ',&apos;url&apos;,this.value);sbAutoSave(' + b.id + ')"></div>';
          h += '</div>';
          // Message templates
          h += '<div style="display:grid;grid-template-columns:' + (showRu && showAm ? '1fr 1fr' : '1fr') + ';gap:8px;margin-top:8px">';
          if (showRu) h += '<div><div style="font-size:0.68rem;color:#3b82f6;margin-bottom:3px">Шаблон сообщения RU</div><textarea class="input" id="sb_btnmsg_ru_' + b.id + '_' + bti + '" rows="2" style="font-size:0.78rem;line-height:1.4" onchange="sbAutoSave(' + b.id + ')">' + escHtml(btn.message_ru || '') + '</textarea></div>';
          if (showAm) h += '<div><div style="font-size:0.68rem;color:#f59e0b;margin-bottom:3px">Шаблон сообщения AM</div><textarea class="input" id="sb_btnmsg_am_' + b.id + '_' + bti + '" rows="2" style="font-size:0.78rem;line-height:1.4" onchange="sbAutoSave(' + b.id + ')">' + escHtml(btn.message_am || '') + '</textarea></div>';
          h += '</div>';
          if (matchedTgMsg) {
            // TG template info shown inline — no separate tab needed
          }
          h += '</details>';
          h += '</div>';
        }
        if ((b.buttons || []).length === 0) {
          h += '<div style="font-size:0.78rem;color:#475569;padding:8px;text-align:center;border:1px dashed #293548;border-radius:8px">Нет кнопок. Нажмите + чтобы добавить.</div>';
        }
        h += '</div>';

        // ── Optional features / opts (parsed early, needed by social + photo sections) ──
        var opts = {};
        try { opts = JSON.parse(b.custom_html || '{}'); } catch(e) { opts = {}; }

        // ── Contact Cards section (only for 'contact' block) ──
        if (b.block_key === 'contact') {
          var contactCards = opts.contact_cards || [
            { url: 'https://t.me/goo_to_top', icon: 'fab fa-telegram' },
            { url: 'https://t.me/suport_admin_2', icon: 'fab fa-telegram' }
          ];
          // Ensure contact_cards stored in opts
          if (!opts.contact_cards) { opts.contact_cards = contactCards; b.custom_html = JSON.stringify(opts); }
          
          h += '<div style="margin-top:14px">';
          h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
          h += '<div style="font-size:0.82rem;font-weight:700;color:#a78bfa"><i class="fas fa-address-card" style="margin-right:6px"></i>Карточки контактов <span style="color:#475569;font-weight:400;font-size:0.72rem">(Администратор / Менеджер)</span></div>';
          h += '<button class="btn btn-outline" style="padding:3px 10px;font-size:0.72rem" onclick="sbAddContactCard(' + b.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button>';
          h += '</div>';
          h += '<div style="font-size:0.70rem;color:#64748b;margin-bottom:10px;padding:6px 10px;background:#0f172a;border-radius:6px;border-left:3px solid #8B5CF6"><i class="fas fa-info-circle" style="margin-right:4px;color:#8B5CF6"></i>Ссылки карточек «Администратор» и «Менеджер» на странице контактов. Иконка мессенджера определяется автоматически по URL (Telegram, WhatsApp, Viber и т.д.)</div>';
          
          for (var cci = 0; cci < contactCards.length; cci++) {
            var cc = contactCards[cci];
            // Auto-detect icon from URL
            var ccDetectedIcon = 'fab fa-telegram';
            if (cc.url && cc.url.indexOf('wa.me') >= 0) ccDetectedIcon = 'fab fa-whatsapp';
            else if (cc.url && cc.url.indexOf('viber') >= 0) ccDetectedIcon = 'fab fa-viber';
            else if (cc.url && cc.url.indexOf('instagram') >= 0) ccDetectedIcon = 'fab fa-instagram';
            else if (cc.url && (cc.url.indexOf('t.me') >= 0 || cc.url.indexOf('telegram') >= 0)) ccDetectedIcon = 'fab fa-telegram';
            var ccIcon = cc.icon || ccDetectedIcon;
            
            h += '<div style="margin-bottom:10px;padding:12px 14px;background:#1a2236;border-radius:10px;border:1px solid #293548;position:relative">';
            h += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:8px"><i class="' + escHtml(ccIcon) + '" style="color:#8B5CF6;font-size:1.1rem"></i><span style="font-size:0.78rem;font-weight:600;color:#e2e8f0">Карточка #' + (cci + 1) + '</span></div>';
            // URL field
            h += '<div style="margin-bottom:8px"><div style="font-size:0.68rem;color:#60a5fa;margin-bottom:3px"><i class="fas fa-link" style="margin-right:3px"></i>URL мессенджера (иконка определяется автоматически)</div>';
            h += '<input class="input" id="sb_ccurl_' + b.id + '_' + cci + '" value="' + escHtml(cc.url || '') + '" placeholder="https://t.me/username или https://wa.me/374..." style="font-size:0.82rem;color:#60a5fa" onchange="sbUpdateContactCard(' + b.id + ',' + cci + ');sbAutoSave(' + b.id + ')"></div>';
            // Icon override (optional)
            var ccIconOptions = [
              {v:'auto',l:'Авто (по URL)',c:'#8B5CF6'},
              {v:'fab fa-telegram',l:'Telegram',c:'#26A5E4'},
              {v:'fab fa-whatsapp',l:'WhatsApp',c:'#25D366'},
              {v:'fab fa-viber',l:'Viber',c:'#7360F2'},
              {v:'fab fa-instagram',l:'Instagram',c:'#E4405F'},
              {v:'fab fa-facebook-messenger',l:'Messenger',c:'#006AFF'},
              {v:'fas fa-phone',l:'Телефон',c:'#10B981'},
              {v:'fas fa-envelope',l:'Email',c:'#F59E0B'}
            ];
            var ccCurrentIcon = cc.icon || 'auto';
            h += '<div style="display:grid;grid-template-columns:180px 1fr;gap:8px">';
            h += '<div><div style="font-size:0.68rem;color:#475569;margin-bottom:3px"><i class="' + escHtml(ccIcon) + '" style="margin-right:4px;color:#8B5CF6"></i>Иконка</div>';
            h += '<select class="input" id="sb_ccicon_' + b.id + '_' + cci + '" style="font-size:0.78rem" onchange="sbUpdateContactCard(' + b.id + ',' + cci + ');sbAutoSave(' + b.id + ')">';
            for (var ccii = 0; ccii < ccIconOptions.length; ccii++) {
              h += '<option value="' + ccIconOptions[ccii].v + '"' + (ccCurrentIcon === ccIconOptions[ccii].v ? ' selected' : '') + '>' + ccIconOptions[ccii].l + '</option>';
            }
            h += '</select></div>';
            h += '<div><div style="font-size:0.68rem;color:#475569;margin-bottom:3px">Предпросмотр иконки</div>';
            h += '<div style="padding:6px 12px;background:#0f172a;border-radius:8px;text-align:center"><i class="' + escHtml(ccIcon) + '" style="font-size:1.6rem;color:#8B5CF6"></i></div></div>';
            h += '</div>';
            // Delete button
            h += '<button class="tier-del-btn" style="position:absolute;top:8px;right:8px" onclick="sbRemoveContactCard(' + b.id + ',' + cci + ')" title="Удалить карточку"><i class="fas fa-times"></i></button>';
            h += '</div>';
          }
          h += '</div>';
        }

        // ── Social Links section (integrated in block as single unit) ──
        var socials = [];
        if (Array.isArray(b.social_links)) { socials = b.social_links; }
        else { try { socials = JSON.parse(b.social_links || '[]'); } catch(e) { socials = []; } }
        if (!Array.isArray(socials)) socials = [];
        var hasSocials = !!socialBlocks[b.block_key] || socials.length > 0;
        if (hasSocials) {
        var socialNetworks = [
          {v:'instagram',l:'Instagram',i:'fab fa-instagram',c:'#E4405F'},{v:'facebook',l:'Facebook',i:'fab fa-facebook',c:'#1877F2'},
          {v:'telegram',l:'Telegram',i:'fab fa-telegram',c:'#26A5E4'},{v:'whatsapp',l:'WhatsApp',i:'fab fa-whatsapp',c:'#25D366'},
          {v:'youtube',l:'YouTube',i:'fab fa-youtube',c:'#FF0000'},{v:'tiktok',l:'TikTok',i:'fab fa-tiktok',c:'#000'},
          {v:'twitter',l:'Twitter/X',i:'fab fa-x-twitter',c:'#1DA1F2'},{v:'linkedin',l:'LinkedIn',i:'fab fa-linkedin',c:'#0A66C2'},
          {v:'vk',l:'VK',i:'fab fa-vk',c:'#4680C2'},{v:'pinterest',l:'Pinterest',i:'fab fa-pinterest',c:'#E60023'},
          {v:'discord',l:'Discord',i:'fab fa-discord',c:'#5865F2'},{v:'github',l:'GitHub',i:'fab fa-github',c:'#333'},
          {v:'threads',l:'Threads',i:'fab fa-threads',c:'#000'},{v:'viber',l:'Viber',i:'fab fa-viber',c:'#7360F2'},
          {v:'snapchat',l:'Snapchat',i:'fab fa-snapchat',c:'#FFFC00'},{v:'website',l:'Сайт',i:'fas fa-globe',c:'#8B5CF6'},
          {v:'email',l:'Email',i:'fas fa-envelope',c:'#F59E0B'},{v:'phone',l:'Телефон',i:'fas fa-phone',c:'#10B981'}
        ];
        h += '<div style="margin-bottom:16px">';
        h += '<details' + (socials.length > 0 ? ' open' : '') + '><summary style="font-size:0.85rem;font-weight:700;color:#94a3b8;cursor:pointer;margin-bottom:8px"><i class="fas fa-share-alt" style="color:#10B981;margin-right:6px"></i>Соц. сети (встроенный блок) <span style="font-weight:400;color:#475569;font-size:0.78rem">(' + socials.length + ')</span></summary>';
        
        // ── Social Section Settings (header, subtitle, layout, icon size, offsets) ──
        var socOpts = opts.social_settings || {};
        h += '<div style="padding:10px;background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.12);border-radius:8px;margin-bottom:10px">';
        h += '<div style="font-size:0.72rem;font-weight:700;color:#10B981;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-heading" style="margin-right:4px"></i>Заголовок</div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">';
        if (showRu) h += '<div><div style="font-size:0.68rem;color:#8B5CF6;margin-bottom:2px">Заголовок (RU)</div><input class="input" id="sb_soctitle_ru_' + b.id + '" value="' + escHtml(socOpts.title_ru || '') + '" placeholder="Мы в соц. сетях" style="font-size:0.78rem" onchange="sbAutoSave(' + b.id + ')"></div>';
        if (showAm) h += '<div><div style="font-size:0.68rem;color:#F59E0B;margin-bottom:2px">Заголовок (AM)</div><input class="input" id="sb_soctitle_am_' + b.id + '" value="' + escHtml(socOpts.title_am || '') + '" placeholder="Հետdelays մեզ" style="font-size:0.78rem" onchange="sbAutoSave(' + b.id + ')"></div>';
        h += '</div>';
        // Subtitle fields removed — only title is shown for social section
        
        h += '<div style="font-size:0.72rem;font-weight:700;color:#10B981;margin-bottom:6px;margin-top:8px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-sliders-h" style="margin-right:4px"></i>Визуальные настройки</div>';
        h += '<div style="display:grid;grid-template-columns:80px 100px 100px;gap:6px;margin-bottom:6px">';
        h += '<div><div style="font-size:0.62rem;color:#64748b;margin-bottom:2px">Зазор (px)</div><input class="input" id="sb_socgap_' + b.id + '" type="number" value="' + (socOpts.gap || 8) + '" style="font-size:0.75rem" onchange="sbAutoSave(' + b.id + ')"></div>';
        h += '<div><div style="font-size:0.62rem;color:#64748b;margin-bottom:2px">Выравнивание</div><select class="input" id="sb_socalign_' + b.id + '" style="font-size:0.75rem" onchange="sbAutoSave(' + b.id + ')"><option value="center"' + (socOpts.align==='center'?' selected':'') + '>Центр</option><option value="left"' + (socOpts.align==='left'?' selected':'') + '>Лево</option><option value="right"' + (socOpts.align==='right'?' selected':'') + '>Право</option></select></div>';
        h += '<div><div style="font-size:0.62rem;color:#64748b;margin-bottom:2px">Позиция</div><select class="input" id="sb_socpos_' + b.id + '" style="font-size:0.75rem" onchange="sbAutoSave(' + b.id + ')"><option value="bottom"' + (socOpts.position==='bottom'||!socOpts.position?' selected':'') + '>Внизу блока</option><option value="top"' + (socOpts.position==='top'?' selected':'') + '>Вверху</option><option value="inline"' + (socOpts.position==='inline'?' selected':'') + '>В строку</option></select></div>';
        h += '</div></div>';

        // ── Social links list (each icon with URL + per-icon settings) ──
        h += '<div style="margin-bottom:6px">';
        for (var si = 0; si < socials.length; si++) {
          var soc = socials[si];
          var socNet = socialNetworks.find(function(n) { return n.v === soc.type; }) || {v:'website',l:'Сайт',i:'fas fa-globe',c:'#8B5CF6'};
          h += '<div style="margin-bottom:8px;padding:8px 10px;background:#1a2236;border-radius:8px;border:1px solid #293548">';
          // Row 1: icon + type + url + delete
          h += '<div style="display:grid;grid-template-columns:28px 110px 1fr 24px;gap:6px;align-items:center">';
          h += '<i class="' + socNet.i + '" style="color:' + socNet.c + ';font-size:1.1rem;text-align:center"></i>';
          h += '<select class="input" id="sb_soctype_' + b.id + '_' + si + '" style="font-size:0.75rem;padding:4px 6px" onchange="sbAutoSave(' + b.id + ')">';
          for (var sni = 0; sni < socialNetworks.length; sni++) {
            var sn = socialNetworks[sni];
            h += '<option value="' + sn.v + '"' + (soc.type === sn.v ? ' selected' : '') + '>' + sn.l + '</option>';
          }
          h += '</select>';
          h += '<input class="input" id="sb_socurl_' + b.id + '_' + si + '" value="' + escHtml(soc.url || '') + '" placeholder="https://..." style="font-size:0.75rem;color:#60a5fa;padding:4px 8px" onchange="sbAutoSave(' + b.id + ')">';
          h += '<button class="tier-del-btn" style="width:22px;height:22px;font-size:0.65rem" onclick="sbRemoveSocial(' + b.id + ',' + si + ')"><i class="fas fa-times"></i></button>';
          h += '</div>';
          // Row 2: per-icon label (larger) + text size + individual icon size + bg color
          h += '<div style="display:grid;grid-template-columns:1fr 70px 70px 70px;gap:6px;margin-top:5px;align-items:center">';
          h += '<input class="input" id="sb_soclabel_' + b.id + '_' + si + '" value="' + escHtml(soc.label || '') + '" placeholder="\\u041f\\u043e\\u0434\\u043f\\u0438\\u0441\\u044c \\u0438\\u043a\\u043e\\u043d\\u043a\\u0438" style="font-size:0.82rem;padding:6px 8px;color:#e2e8f0;font-weight:500" onchange="sbAutoSave(' + b.id + ')">';
          h += '<div><div style="font-size:0.58rem;color:#64748b;margin-bottom:1px">\\u0422\\u0435\\u043a\\u0441\\u0442 (px)</div><input class="input" id="sb_soctext_size_' + b.id + '_' + si + '" type="number" value="' + (soc.text_size || '') + '" placeholder="14" style="font-size:0.72rem;padding:3px 5px" onchange="sbAutoSave(' + b.id + ')"></div>';
          h += '<div><div style="font-size:0.58rem;color:#64748b;margin-bottom:1px">\\u0420\\u0430\\u0437\\u043c\\u0435\\u0440 (px)</div><input class="input" id="sb_socicon_size_' + b.id + '_' + si + '" type="number" value="' + (soc.icon_size || '') + '" placeholder="36" style="font-size:0.72rem;padding:3px 5px" onchange="sbAutoSave(' + b.id + ')"></div>';
          h += '<div><div style="font-size:0.58rem;color:#64748b;margin-bottom:1px">\\u0426\\u0432\\u0435\\u0442 BG</div><input class="input" id="sb_socicon_color_' + b.id + '_' + si + '" type="color" value="' + escHtml(soc.bg_color || socNet.c) + '" style="height:26px;padding:1px 3px;cursor:pointer" onchange="sbAutoSave(' + b.id + ')"></div>';
          h += '</div>';
          h += '</div>';
        }
        h += '</div>';
        h += '<button class="btn btn-outline" style="padding:3px 10px;font-size:0.72rem" onclick="sbAddSocial(' + b.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить соц. сеть</button>';
        h += '</details></div>';
        } // end hasSocials

        // ── Footer Contacts section (only for footer block) ──
        if (b.block_key === 'footer') {
          var ftContacts = [];
          try { ftContacts = JSON.parse((data.footer || {}).contacts_json || '[]'); } catch(e) { ftContacts = []; }
          if (!Array.isArray(ftContacts)) ftContacts = [];
          
          h += '<div style="margin-bottom:16px">';
          h += '<details' + (ftContacts.length > 0 ? ' open' : '') + '><summary style="font-size:0.85rem;font-weight:700;color:#94a3b8;cursor:pointer;margin-bottom:8px"><i class="fas fa-address-book" style="color:#F59E0B;margin-right:6px"></i>\\u041a\\u043e\\u043d\\u0442\\u0430\\u043a\\u0442\\u044b (\\u0444\\u0443\\u0442\\u0435\\u0440) <span style="font-weight:400;color:#475569;font-size:0.78rem">(' + ftContacts.length + ')</span></summary>';
          
          h += '<div style="padding:10px;background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.12);border-radius:8px;margin-bottom:10px">';
          h += '<div style="font-size:0.72rem;font-weight:700;color:#F59E0B;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-info-circle" style="margin-right:4px"></i>\\u042d\\u0442\\u0438 \\u043a\\u043e\\u043d\\u0442\\u0430\\u043a\\u0442\\u044b \\u043e\\u0442\\u043e\\u0431\\u0440\\u0430\\u0436\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432 \\u0444\\u0443\\u0442\\u0435\\u0440\\u0435 \\u043d\\u0430\\u0434 \\u0441\\u043e\\u0446\\u0441\\u0435\\u0442\\u044f\\u043c\\u0438</div>';
          
          var ctIcons = [
            {v:'fab fa-telegram',l:'Telegram'},{v:'fab fa-whatsapp',l:'WhatsApp'},{v:'fas fa-phone',l:'\\u0422\\u0435\\u043b\\u0435\\u0444\\u043e\\u043d'},
            {v:'fas fa-envelope',l:'Email'},{v:'fab fa-instagram',l:'Instagram'},{v:'fab fa-viber',l:'Viber'},
            {v:'fas fa-map-marker-alt',l:'\\u0410\\u0434\\u0440\\u0435\\u0441'},{v:'fas fa-globe',l:'\\u0421\\u0430\\u0439\\u0442'}
          ];
          
          h += '<div id="ftBlockContactsList">';
          for (var fci = 0; fci < ftContacts.length; fci++) {
            var fc = ftContacts[fci];
            h += '<div style="display:grid;grid-template-columns:28px 110px 1fr 1fr 1fr 24px;gap:6px;align-items:center;margin-bottom:6px;padding:8px;background:#1a2236;border-radius:8px;border:1px solid #293548">';
            // Icon preview
            h += '<i class="' + (fc.icon || 'fab fa-telegram') + '" style="color:#F59E0B;font-size:1.1rem;text-align:center"></i>';
            // Type select
            h += '<select class="input" id="ftbc_icon_' + fci + '" style="font-size:0.75rem;padding:4px 6px" onchange="ftBlockContactChanged()">';
            for (var cii = 0; cii < ctIcons.length; cii++) {
              h += '<option value="' + ctIcons[cii].v + '"' + (fc.icon === ctIcons[cii].v ? ' selected' : '') + '>' + ctIcons[cii].l + '</option>';
            }
            h += '</select>';
            // Name RU
            h += '<input class="input" id="ftbc_name_ru_' + fci + '" value="' + escHtml(fc.name_ru || '') + '" placeholder="\\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435 RU" style="font-size:0.75rem;padding:4px 8px" onchange="ftBlockContactChanged()">';
            // Name AM
            h += '<input class="input" id="ftbc_name_am_' + fci + '" value="' + escHtml(fc.name_am || '') + '" placeholder="\\u0531\\u0576\\u057e\\u0561\\u0576\\u0578\\u0582\\u0574 AM" style="font-size:0.75rem;padding:4px 8px;border-color:rgba(245,158,11,0.3)" onchange="ftBlockContactChanged()">';
            // URL
            h += '<input class="input" id="ftbc_url_' + fci + '" value="' + escHtml(fc.url || '') + '" placeholder="https://t.me/... \\u0438\\u043b\\u0438 +374..." style="font-size:0.75rem;padding:4px 8px;color:#60a5fa" onchange="ftBlockContactChanged()">';
            // Delete
            h += '<button class="tier-del-btn" style="width:22px;height:22px;font-size:0.65rem" onclick="ftBlockContactRemove(' + fci + ')"><i class="fas fa-times"></i></button>';
            h += '</div>';
          }
          h += '</div>';
          h += '<button class="btn btn-outline" style="padding:3px 10px;font-size:0.72rem;margin-top:4px" onclick="ftBlockContactAdd()"><i class="fas fa-plus" style="margin-right:4px"></i>\\u0414\\u043e\\u0431\\u0430\\u0432\\u0438\\u0442\\u044c \\u043a\\u043e\\u043d\\u0442\\u0430\\u043a\\u0442</button>';
          h += '</div>';
          h += '</details></div>';
        }

        // ── Block Photos section (only for blocks that have photos by design) ──
        var isTickerBlock = (b.block_key === 'ticker' || b.block_type === 'ticker');
        var isCalcBlock = (b.block_key === 'calculator' || b.block_type === 'calculator');
        var isPopupOrFloat = (b.block_type === 'popup' || b.block_type === 'floating' || b.block_key === 'nav');
        var isReviewsBlock = (b.block_type === 'reviews');
        // All block types support photos except calculator, ticker, popup, floating, nav, seo
        var hasPhotoSupport = !isTickerBlock && !isCalcBlock && !isPopupOrFloat && !isSeoBlock;
        if (hasPhotoSupport) {
          var blockPhotos = [];
          try { blockPhotos = opts.photos || []; } catch(e) { blockPhotos = []; }
          if (!Array.isArray(blockPhotos)) blockPhotos = [];
          
          // Recommended photo dimensions per block type
          var photoDims = { hero: '600×800px (портрет) или 1200×675px (16:9)', about: '800×600px (горизонт) или 600×600px (квадрат)', warehouse: '800×500px (горизонт, 16:10)', wb_official: '1200×675px (16:9)', services: '600×400px (горизонт)', wb_banner: '1200×400px (баннер, 3:1)' };
          var dimHint = photoDims[b.block_key] || '800×600px (рекомендуемый размер)';
          if (isReviewsBlock) dimHint = '280×360px (вертикальный скриншот отзыва)';
          
          h += '<div style="margin-bottom:16px">';
          h += '<details' + (blockPhotos.length > 0 || opts.photo_url || isReviewsBlock ? ' open' : '') + '><summary style="font-size:0.85rem;font-weight:700;color:#94a3b8;cursor:pointer;margin-bottom:8px"><i class="fas fa-camera" style="color:#60a5fa;margin-right:6px"></i>' + (isReviewsBlock ? 'Скриншоты отзывов (сетка)' : 'Фото блока') + ' <span style="font-weight:400;color:#475569;font-size:0.78rem">(' + (blockPhotos.length + (opts.photo_url ? 1 : 0)) + ')</span></summary>';
          
          // Photo size recommendation
          h += '<div style="padding:6px 10px;background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.15);border-radius:6px;margin-bottom:10px;display:flex;align-items:center;gap:6px">' +
            '<i class="fas fa-ruler-combined" style="color:#60a5fa;font-size:0.75rem"></i>' +
            '<span style="font-size:0.72rem;color:#60a5fa">Рекомендуемый размер: <b>' + dimHint + '</b> • Макс: 5 МБ • JPG/PNG/WebP</span>' +
          '</div>';
          if (isReviewsBlock) {
            h += '<div style="padding:8px 12px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:6px;margin-bottom:10px;display:flex;align-items:center;gap:8px">' +
              '<i class="fas fa-star" style="color:#F59E0B;font-size:0.85rem"></i>' +
              '<span style="font-size:0.75rem;color:#F59E0B">Блок отзывов: фото отображаются по одному в карусели со стрелками, точками и подсказкой листать. Добавьте подпись (описание) к каждому фото — например: «С момента старта прошло 12 дней — вот такие результаты».</span>' +
            '</div>';
          }
          
          // Main photo URL (replaces main section image, e.g. Hero photo)
          h += '<div style="margin-bottom:10px;padding:8px;background:#1a2236;border-radius:8px;border:1px solid #293548">';
          h += '<div style="font-size:0.72rem;color:#8B5CF6;font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-image" style="margin-right:4px"></i>Главное фото блока</div>';
          h += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
          if (opts.photo_url) h += '<img src="' + escHtml(opts.photo_url) + '" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #334155" onerror="this.style.display=&apos;none&apos;">';
          h += '<input class="input" id="sb_mainphoto_' + b.id + '" value="' + escHtml(opts.photo_url || '') + '" placeholder="URL фото или загрузите файл" style="flex:1;font-size:0.78rem;color:#60a5fa;min-width:200px" onchange="sbAutoSave(' + b.id + ')">';
          h += '<label class="btn btn-primary" style="padding:6px 14px;font-size:0.72rem;cursor:pointer;white-space:nowrap"><i class="fas fa-upload" style="margin-right:4px"></i>Загрузить<input type="file" accept="image/*" style="display:none" onchange="sbUploadPhoto(this,' + b.id + ',&apos;main&apos;)"></label>';
          if (opts.photo_url) h += '<button class="tier-del-btn" onclick="document.getElementById(&apos;sb_mainphoto_' + b.id + '&apos;).value=&apos;&apos;;sbAutoSave(' + b.id + ')"><i class="fas fa-times"></i></button>';
          h += '</div></div>';

          // Additional photos gallery
          if (blockPhotos.length > 0) {
            h += '<div style="font-size:0.72rem;color:#94a3b8;font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-th" style="margin-right:4px"></i>Галерея (' + blockPhotos.length + ') <span style="font-weight:400;color:#64748b;font-size:0.65rem;margin-left:8px"><i class="fas fa-grip-vertical"></i> перетащите для сортировки</span></div>';
          }
          h += '<div id="sb_photo_list_' + b.id + '" style="margin-bottom:6px">';
          for (var phi = 0; phi < blockPhotos.length; phi++) {
            var ph = blockPhotos[phi];
            h += '<div class="sb-photo-item" data-photo-idx="' + phi + '" style="display:flex;gap:8px;margin-bottom:6px;align-items:center;padding:6px 8px;background:#1a2236;border-radius:8px;border:1px solid #293548;flex-wrap:wrap;cursor:grab">';
            h += '<i class="fas fa-grip-vertical sb-photo-drag" style="color:#475569;cursor:grab;font-size:0.85rem;padding:4px"></i>';
            if (ph.url) h += '<img src="' + escHtml(ph.url) + '" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #334155" onerror="this.style.display=&apos;none&apos;">';
            h += '<input class="input" id="sb_photo_' + b.id + '_' + phi + '" value="' + escHtml(ph.url || '') + '" placeholder="URL фото" style="flex:1;font-size:0.78rem;color:#60a5fa;min-width:150px" onchange="sbAutoSave(' + b.id + ')">';
            h += '<label class="btn btn-outline" style="padding:4px 10px;font-size:0.68rem;cursor:pointer;white-space:nowrap"><i class="fas fa-upload" style="margin-right:3px"></i>Загр.<input type="file" accept="image/*" style="display:none" onchange="sbUploadPhoto(this,' + b.id + ',&apos;gallery&apos;,' + phi + ')"></label>';
            h += '<div style="display:flex;gap:4px;flex:1;min-width:200px"><input class="input" id="sb_photocap_' + b.id + '_' + phi + '" value="' + escHtml(ph.caption || ph.caption_ru || '') + '" placeholder="Подпись RU" style="flex:1;font-size:0.78rem" onchange="sbAutoSave(' + b.id + ')"><input class="input" id="sb_photocap_am_' + b.id + '_' + phi + '" value="' + escHtml(ph.caption_am || '') + '" placeholder="Подпись AM" style="flex:1;font-size:0.78rem" onchange="sbAutoSave(' + b.id + ')"></div>';
            h += '<button class="tier-del-btn" onclick="sbRemovePhoto(' + b.id + ',' + phi + ')"><i class="fas fa-times"></i></button>';
            h += '</div>';
          }
          h += '</div>';
          h += '<div style="display:flex;gap:8px">';
          h += '<button class="btn btn-outline" style="padding:4px 12px;font-size:0.72rem" onclick="sbAddPhoto(' + b.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить фото (URL)</button>';
          h += '<label class="btn btn-primary" style="padding:4px 12px;font-size:0.72rem;cursor:pointer"><i class="fas fa-upload" style="margin-right:4px"></i>Загрузить с устройства<input type="file" accept="image/*" multiple style="display:none" onchange="sbUploadPhotoBatch(this,' + b.id + ')"></label>';
          h += '</div>';
          
          // ── Photo display settings ──
          var ps = opts.photo_settings || {};
          h += '<div style="margin-top:12px;padding:10px;background:#0f172a;border-radius:8px;border:1px solid #1e293b">';
          h += '<div style="font-size:0.72rem;color:#8B5CF6;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-sliders-h" style="margin-right:4px"></i>Настройки отображения фото</div>';
          h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
          // Max height (mobile)
          h += '<div><label style="font-size:0.68rem;color:#64748b;display:block;margin-bottom:3px">Макс. высота, моб. (px)</label>';
          h += '<input class="input" id="sb_ps_maxh_' + b.id + '" type="number" min="0" max="1200" step="10" value="' + (ps.max_height_mobile || 0) + '" placeholder="0 = авто" style="font-size:0.78rem;width:100%" onchange="sbAutoSave(' + b.id + ')"></div>';
          // Max height (desktop)
          h += '<div><label style="font-size:0.68rem;color:#64748b;display:block;margin-bottom:3px">Макс. высота, ПК (px)</label>';
          h += '<input class="input" id="sb_ps_maxhd_' + b.id + '" type="number" min="0" max="1200" step="10" value="' + (ps.max_height_desktop || 0) + '" placeholder="0 = авто" style="font-size:0.78rem;width:100%" onchange="sbAutoSave(' + b.id + ')"></div>';
          // Object fit
          h += '<div><label style="font-size:0.68rem;color:#64748b;display:block;margin-bottom:3px">Режим вписки</label>';
          h += '<select class="input" id="sb_ps_fit_' + b.id + '" style="font-size:0.78rem;width:100%" onchange="sbAutoSave(' + b.id + ')">';
          h += '<option value="cover"' + (ps.object_fit === 'cover' || !ps.object_fit ? ' selected' : '') + '>Cover (заполнить)</option>';
          h += '<option value="contain"' + (ps.object_fit === 'contain' ? ' selected' : '') + '>Contain (вместить)</option>';
          h += '<option value="fill"' + (ps.object_fit === 'fill' ? ' selected' : '') + '>Fill (растянуть)</option>';
          h += '</select></div>';
          // Border radius
          h += '<div><label style="font-size:0.68rem;color:#64748b;display:block;margin-bottom:3px">Скругление (px)</label>';
          h += '<input class="input" id="sb_ps_radius_' + b.id + '" type="number" min="0" max="50" step="1" value="' + (ps.border_radius != null ? ps.border_radius : 12) + '" style="font-size:0.78rem;width:100%" onchange="sbAutoSave(' + b.id + ')"></div>';
          h += '</div>'; // end grid
          // Full width toggle (mobile)
          h += '<label style="display:flex;align-items:center;gap:8px;margin-top:8px;cursor:pointer;font-size:0.78rem;color:#94a3b8">';
          h += '<input type="checkbox" id="sb_ps_fw_' + b.id + '"' + (ps.full_width_mobile !== false ? ' checked' : '') + ' onchange="sbAutoSave(' + b.id + ')" style="accent-color:#8B5CF6">';
          h += 'На всю ширину экрана (моб.)</label>';
          h += '</div>';
          
          // ── Swipe hint text (reviews blocks only) ──
          if (isReviewsBlock) {
            var swipeOpts = opts || {};
            h += '<div style="margin-top:14px;padding:12px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:8px">';
            h += '<div style="font-size:0.72rem;color:#F59E0B;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-hand-pointer" style="margin-right:4px"></i>Кнопка «Листайте для просмотра»</div>';
            h += '<div style="display:grid;grid-template-columns:' + (showRu && showAm ? '1fr 1fr' : '1fr') + ';gap:10px">';
            if (showRu) {
              h += '<div><div style="font-size:0.68rem;color:#3b82f6;margin-bottom:3px;font-weight:600">Текст RU</div>';
              h += '<input class="input" id="sb_swipehint_ru_' + b.id + '" value="' + escHtml(swipeOpts.swipe_hint_ru || '') + '" placeholder="Листайте для просмотра" style="font-size:0.82rem" onchange="sbAutoSave(' + b.id + ')"></div>';
            }
            if (showAm) {
              h += '<div><div style="font-size:0.68rem;color:#f59e0b;margin-bottom:3px;font-weight:600">Текст AM</div>';
              h += '<input class="input" id="sb_swipehint_am_' + b.id + '" value="' + escHtml(swipeOpts.swipe_hint_am || '') + '" placeholder="\\u054d\\u0561\\u0570\\u0565\\u0581\\u0580\\u0565\\u0584 \\u0564\\u056b\\u057f\\u0565\\u056c\\u0578\\u0582" style="font-size:0.82rem" onchange="sbAutoSave(' + b.id + ')"></div>';
            }
            h += '</div>';
            h += '<div style="font-size:0.65rem;color:#64748b;margin-top:6px"><i class="fas fa-info-circle" style="margin-right:3px"></i>Оставьте пустым для текста по умолчанию</div>';
            h += '</div>';
          }

          h += '</details></div>';
        }
        h += '<div style="margin-bottom:16px">';
        // Slot counter section removed — now managed as separate block type 'slot_counter'
        
        h += '</div>';

        } // end if (!isCalcBlock && !isSeoBlock) — skip detail sections for calculator/seo

        // ── Footer: Save + Pro Tools ──
        // Character count stats
        var totalCharsRu = (b.texts_ru || []).reduce(function(sum, t) { return sum + (t||'').length; }, 0);
        var totalCharsAm = (b.texts_am || []).reduce(function(sum, t) { return sum + (t||'').length; }, 0);
        var footerSocials = [];
        try { footerSocials = Array.isArray(socials) ? socials : (typeof socials !== 'undefined' ? socials : []); } catch(e) { footerSocials = []; }
        if (!Array.isArray(footerSocials)) footerSocials = [];
        
        h += '<div style="padding-top:14px;border-top:1px solid #1e293b">';
        // Pro stats bar
        h += '<div style="display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap;font-size:0.68rem;color:#475569">';
        h += '<span title="Символов RU"><i class="fas fa-font" style="color:#8B5CF6;margin-right:2px"></i>RU: ' + totalCharsRu + ' симв.</span>';
        h += '<span title="Символов AM"><i class="fas fa-font" style="color:#F59E0B;margin-right:2px"></i>AM: ' + totalCharsAm + ' симв.</span>';
        h += '<span title="Кнопок"><i class="fas fa-hand-pointer" style="color:#a78bfa;margin-right:2px"></i>' + btnsCount + ' кноп.</span>';
        if (footerSocials.length > 0) h += '<span title="Соцсетей"><i class="fas fa-share-alt" style="color:#10B981;margin-right:2px"></i>' + footerSocials.length + ' соц.</span>';
        h += '<span title="Последнее обновление"><i class="fas fa-clock" style="margin-right:2px"></i>' + (b.updated_at ? new Date(b.updated_at).toLocaleString('ru') : 'не задано') + '</span>';
        h += '</div>';
        
        h += '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center">' +
          '<div style="display:flex;gap:6px">' +
            '<button class="btn btn-outline" style="padding:4px 10px;font-size:0.72rem" onclick="sbPreviewBlock(&apos;' + b.block_key + '&apos;)" title="Предпросмотр блока на сайте"><i class="fas fa-external-link-alt"></i></button>' +
            '<button class="btn btn-outline" style="padding:4px 10px;font-size:0.72rem" onclick="sbResetBlock(' + b.id + ')" title="Сбросить до оригинала"><i class="fas fa-undo"></i></button>' +
          '</div>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="btn btn-outline" onclick="toggleSbExpand(' + b.id + ')" style="font-size:0.82rem">Свернуть</button>' +
            '<button class="btn btn-success" onclick="sbSaveBlock(' + b.id + ')" style="min-width:160px;font-size:0.82rem"><i class="fas fa-save" style="margin-right:5px"></i>Сохранить и синхр.</button>' +
          '</div>' +
        '</div>';
        h += '</div>';

        h += '</div>'; // end expanded area
      }
      h += '</div>'; // end card
    }
    h += '</div>'; // end #sbBlockList
  }

  // ── Save status indicator ──
  h += '<div id="sbSaveIndicator" class="sb-save-indicator ' + sbSaveStatus + '">' +
    (sbSaveStatus === 'saving' ? '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Сохранение и синхронизация...' : '') +
    (sbSaveStatus === 'saved' ? '<i class="fas fa-check" style="margin-right:6px"></i>Сохранено и синхронизировано' : '') +
  '</div>';

  h += '</div>'; // end wrapper

  // ── Post-render: init SortableJS ──
  setTimeout(function() { sbInitSortable(); sbInitPhotoSortables(); }, 50);

  return h;
}

// ── Semantic field labels based on block key and position ──
function sbGetFieldLabel(blockKey, idx, total) {
  // Flexible labels based on block context and text index
  // Each text pair gets a clear semantic label
  var roleIcons = {
    0: '<i class="fas fa-heading" style="margin-right:4px;color:#a78bfa"></i>',
    1: '<i class="fas fa-font" style="margin-right:4px;color:#60a5fa"></i>',
    2: '<i class="fas fa-paragraph" style="margin-right:4px;color:#34d399"></i>',
    3: '<i class="fas fa-align-left" style="margin-right:4px;color:#f59e0b"></i>'
  };
  var icon = roleIcons[Math.min(idx, 3)] || '<i class="fas fa-align-left" style="margin-right:4px;color:#94a3b8"></i>';
  
  if (total <= 1) return icon + 'Текст';
  if (idx === 0) return icon + 'Заголовок <span style="color:#475569;font-size:0.7rem">(H2)</span>';
  if (idx === 1 && total >= 2) return icon + 'Подзаголовок <span style="color:#475569;font-size:0.7rem">(описание)</span>';
  if (idx === 2 && total >= 3) return icon + 'Основной текст';
  if (idx === total - 1 && total >= 4) return icon + 'Итог / Примечание';
  return icon + 'Текст #' + (idx + 1);
}

// Set text role for a text pair (currently visual-only indicator, saved for future use)
function sbSetTextRole(blockId, textIdx, role) {
  // For now this is a visual indicator to help the admin understand the text structure
  // The role info is cosmetic — the actual rendering uses position-based logic
  console.log('[Admin] Text role set:', blockId, textIdx, role);
  // Trigger auto-save to persist any changes
  sbAutoSave(blockId);
}

// ── Contact Cards functions (for contact block messenger links) ──
function sbAddContactCard(blockId) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  var opts = {};
  try { opts = JSON.parse(b.custom_html || '{}'); } catch(e) { opts = {}; }
  if (!opts.contact_cards) opts.contact_cards = [];
  opts.contact_cards.push({ url: 'https://t.me/', icon: 'auto' });
  b.custom_html = JSON.stringify(opts);
  render();
  sbAutoSave(blockId);
}

function sbRemoveContactCard(blockId, idx) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  var opts = {};
  try { opts = JSON.parse(b.custom_html || '{}'); } catch(e) { opts = {}; }
  if (!opts.contact_cards) return;
  opts.contact_cards.splice(idx, 1);
  b.custom_html = JSON.stringify(opts);
  render();
  sbAutoSave(blockId);
}

function sbUpdateContactCard(blockId, idx) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  var opts = {};
  try { opts = JSON.parse(b.custom_html || '{}'); } catch(e) { opts = {}; }
  if (!opts.contact_cards || !opts.contact_cards[idx]) return;
  var urlEl = document.getElementById('sb_ccurl_' + blockId + '_' + idx);
  var iconEl = document.getElementById('sb_ccicon_' + blockId + '_' + idx);
  if (urlEl) opts.contact_cards[idx].url = urlEl.value;
  if (iconEl) opts.contact_cards[idx].icon = iconEl.value;
  b.custom_html = JSON.stringify(opts);
  // Re-render to update icon preview
  render();
}

// ── Move element in section order (reorder block content on site) ──
function sbMoveElement(blockId, elKey, direction) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  var opts = {};
  try { opts = typeof b.custom_html === 'string' ? JSON.parse(b.custom_html || '{}') : (b.custom_html || {}); } catch(e) { opts = {}; }
  var defaultOrder = ['photo', 'title', 'stats', 'texts', 'buttons', 'socials'];
  var order = (opts.element_order && Array.isArray(opts.element_order)) ? opts.element_order.slice() : defaultOrder.slice();
  // Ensure all defaults
  for (var di = 0; di < defaultOrder.length; di++) { if (order.indexOf(defaultOrder[di]) < 0) order.push(defaultOrder[di]); }
  var idx = order.indexOf(elKey);
  if (idx < 0) return;
  var newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= order.length) return;
  // Swap
  var tmp = order[newIdx];
  order[newIdx] = order[idx];
  order[idx] = tmp;
  opts.element_order = order;
  b.custom_html = JSON.stringify(opts);
  console.log('[Admin] Element order changed:', order);
  render();
  sbAutoSave(blockId);
}

// ── Set nav link target for a menu item ──
function sbSetNavLink(blockId, textIdx, target) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  var opts = {};
  try { opts = typeof b.custom_html === 'string' ? JSON.parse(b.custom_html || '{}') : (b.custom_html || {}); } catch(e) { opts = {}; }
  if (!opts.nav_links) opts.nav_links = [];
  // Find existing entry for this index or create new
  var found = false;
  for (var i = 0; i < opts.nav_links.length; i++) {
    if (opts.nav_links[i].idx === textIdx) {
      opts.nav_links[i].target = target;
      found = true;
      break;
    }
  }
  if (!found) {
    opts.nav_links.push({ idx: textIdx, target: target });
  }
  b.custom_html = JSON.stringify(opts);
  console.log('[Admin] Nav link set:', textIdx, '->', target);
  sbAutoSave(blockId);
}

// ── Init SortableJS on block list ──
function sbInitSortable() {
  var el = document.getElementById('sbBlockList');
  if (!el) return;
  if (sbSortableInstance) { try { sbSortableInstance.destroy(); } catch(e) {} }
  sbSortableInstance = new Sortable(el, {
    handle: '.sb-drag-handle',
    animation: 200,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    onEnd: function(evt) {
      if (evt.oldIndex === evt.newIndex) return;
      sbReorderAfterDrag();
    }
  });
}

// ── Init SortableJS on ALL photo galleries in blocks ──
var _photoSortables = [];
function sbInitPhotoSortables() {
  // Destroy old instances
  _photoSortables.forEach(function(s) { try { s.destroy(); } catch(e) {} });
  _photoSortables = [];
  // Find all photo list containers
  document.querySelectorAll('[id^="sb_photo_list_"]').forEach(function(el) {
    var blockId = parseInt(el.id.replace('sb_photo_list_', ''));
    if (isNaN(blockId)) return;
    var inst = new Sortable(el, {
      handle: '.sb-photo-drag',
      animation: 200,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: function(evt) {
        if (evt.oldIndex === evt.newIndex) return;
        sbReorderPhotos(blockId, el);
      }
    });
    _photoSortables.push(inst);
  });
}

// ── Reorder photos after drag-and-drop ──
function sbReorderPhotos(blockId, container) {
  var items = container.querySelectorAll('.sb-photo-item');
  var block = null;
  for (var i = 0; i < (data.siteBlocks || []).length; i++) {
    if (data.siteBlocks[i].id === blockId) { block = data.siteBlocks[i]; break; }
  }
  if (!block) return;
  // Photos are stored in custom_html JSON as blockOpts.photos
  var blockOpts = {};
  try { blockOpts = JSON.parse(block.custom_html || '{}'); } catch(e) { blockOpts = {}; }
  var photos = blockOpts.photos || [];
  if (!photos.length) return;
  // Build new order from DOM
  var newPhotos = [];
  items.forEach(function(item) {
    var oldIdx = parseInt(item.getAttribute('data-photo-idx'));
    if (!isNaN(oldIdx) && photos[oldIdx]) {
      newPhotos.push(photos[oldIdx]);
    }
  });
  // Update block data in custom_html
  blockOpts.photos = newPhotos;
  block.custom_html = JSON.stringify(blockOpts);
  // Re-assign indices and input IDs
  items.forEach(function(item, newIdx) {
    item.setAttribute('data-photo-idx', newIdx);
    var urlInput = item.querySelector('input[id^="sb_photo_' + blockId + '_"]');
    if (urlInput) urlInput.id = 'sb_photo_' + blockId + '_' + newIdx;
    var capInput = item.querySelector('input[id^="sb_photocap_' + blockId + '_"]');
    if (capInput) capInput.id = 'sb_photocap_' + blockId + '_' + newIdx;
  });
  toast('Порядок фото обновлён');
  sbAutoSave(blockId);
}

// ── Reorder after drag-and-drop ──
async function sbReorderAfterDrag() {
  var el = document.getElementById('sbBlockList');
  if (!el) return;
  var items = el.querySelectorAll('.sb-block-item');
  var newIds = [];
  items.forEach(function(item) { newIds.push(parseInt(item.getAttribute('data-block-id'))); });

  var orders = newIds.map(function(id, i) { return { id: id, sort_order: i }; });

  var blockMap = {};
  (data.siteBlocks || []).forEach(function(b) { blockMap[b.id] = b; });
  var reordered = newIds.map(function(id) { return blockMap[id]; }).filter(Boolean);
  var calcBlocks = (data.siteBlocks || []).filter(function(b) { return b.block_type === 'calculator'; });
  var contentBlocks = (data.siteBlocks || []).filter(function(b) { return b.block_type !== 'calculator'; });
  
  if (sbActiveTab === 'calculator') {
    data.siteBlocks = contentBlocks.concat(reordered);
  } else {
    data.siteBlocks = reordered.concat(calcBlocks);
  }

  toast('Порядок обновлён');
  
  await api('/site-blocks/reorder', { method: 'POST', body: JSON.stringify({ orders: orders }) });
  // Send both underscore and hyphen variants to cover all section_order records
  var sectionOrders = [];
  reordered.forEach(function(b, i) {
    var key = b.block_key;
    var keyHyphen = key.replace(/_/g, '-');
    sectionOrders.push({ section_id: key, sort_order: i });
    if (keyHyphen !== key) sectionOrders.push({ section_id: keyHyphen, sort_order: i });
  });
  await api('/section-order', { method: 'PUT', body: JSON.stringify({ orders: sectionOrders }) });
}

// ── Auto-save with debounce ──
function sbAutoSave(blockId) {
  if (sbSaveTimers[blockId]) clearTimeout(sbSaveTimers[blockId]);
  sbSaveTimers[blockId] = setTimeout(function() {
    sbSaveBlock(blockId);
  }, 1200);
}

// ── Show save status ──
function sbShowSaveStatus(status) {
  sbSaveStatus = status;
  var ind = document.getElementById('sbSaveIndicator');
  if (ind) {
    ind.className = 'sb-save-indicator ' + status;
    if (status === 'saving') {
      ind.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Сохранение и синхронизация...';
    } else if (status === 'error') {
      ind.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right:6px;color:#ef4444"></i>Ошибка сохранения!';
    } else {
      ind.innerHTML = '<i class="fas fa-check" style="margin-right:6px"></i>Сохранено и синхронизировано';
    }
  }
  if (status === 'saved' || status === 'error') {
    setTimeout(function() {
      sbSaveStatus = 'hidden';
      var ind2 = document.getElementById('sbSaveIndicator');
      if (ind2) ind2.className = 'sb-save-indicator hidden';
    }, status === 'error' ? 5000 : 2000);
  }
}

// ── Toggle expand ──
function toggleSbExpand(id) {
  if (sbExpandedBlocks[id]) { delete sbExpandedBlocks[id]; } else { sbExpandedBlocks[id] = true; }
  render();
}
function sbExpandAll() {
  var blocks = (data.siteBlocks || []).filter(function(b) { return sbActiveTab === 'calculator' ? b.block_type === 'calculator' : b.block_type !== 'calculator'; });
  blocks.forEach(function(b) { sbExpandedBlocks[b.id] = true; });
  render();
}
function sbCollapseAll() {
  sbExpandedBlocks = {};
  render();
}

// ── Visibility toggle ──
async function toggleSbVisible(id, val) {
  await api('/site-blocks/' + id, { method: 'PUT', body: JSON.stringify({ is_visible: val }) });
  var b = (data.siteBlocks || []).find(function(x) { return x.id === id; });
  if (b) b.is_visible = val;
  render();
  if (b) await api('/site-blocks/' + id + '/sync-to-site', { method: 'POST' });
  toast(val ? 'Блок показан на сайте' : 'Блок скрыт с сайта');
}

// ── Delete block ──
async function delSiteBlock(id) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === id; });
  if (!confirm('Удалить блок «' + (b ? b.title_ru || b.block_key : '') + '»? Это действие необратимо.')) return;
  await api('/site-blocks/' + id, { method: 'DELETE' });
  delete sbExpandedBlocks[id];
  data.siteBlocks = (data.siteBlocks || []).filter(function(x) { return x.id !== id; });
  toast('Блок удалён');
  render();
}

// ── Duplicate block ──
async function dupSiteBlock(id) {
  await api('/site-blocks/duplicate/' + id, { method: 'POST' });
  var res = await api('/site-blocks');
  data.siteBlocks = (res && res.blocks) || [];
  toast('Блок дублирован');
  render();
}

// ── Add text pair ──
function sbAddTextPair(blockId) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  if (!b.texts_ru) b.texts_ru = [];
  if (!b.texts_am) b.texts_am = [];
  b.texts_ru.push('');
  b.texts_am.push('');
  render();
}

// ── Add ticker item ──
function sbAddTickerItem(blockId) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  if (!b.texts_ru) b.texts_ru = [];
  if (!b.texts_am) b.texts_am = [];
  if (!b.images) b.images = [];
  b.texts_ru.push('');
  b.texts_am.push('');
  b.images.push('fa-check-circle');
  render();
}

// ── Remove text pair ──
function sbRemoveTextPair(blockId, idx) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  if (b.texts_ru && idx < b.texts_ru.length) b.texts_ru.splice(idx, 1);
  if (b.texts_am && idx < b.texts_am.length) b.texts_am.splice(idx, 1);
  if (b.images && idx < b.images.length) b.images.splice(idx, 1);
  if (b.text_styles && idx < b.text_styles.length) b.text_styles.splice(idx, 1);
  // For nav block: also remove/reindex nav_links entries
  if (b.block_key === 'nav') {
    var opts = {};
    try { opts = typeof b.custom_html === 'string' ? JSON.parse(b.custom_html || '{}') : (b.custom_html || {}); } catch(e) { opts = {}; }
    if (opts.nav_links) {
      // Remove the entry for this index
      opts.nav_links = opts.nav_links.filter(function(nl) { return nl.idx !== idx; });
      // Reindex: entries with idx > removed idx need idx-1
      for (var ri = 0; ri < opts.nav_links.length; ri++) {
        if (opts.nav_links[ri].idx > idx) opts.nav_links[ri].idx--;
      }
      b.custom_html = JSON.stringify(opts);
    }
  }
  render();
  sbAutoSave(blockId);
}

// ── Set text style (color/size) ──
function sbSetTextStyle(blockId, idx, prop, value) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  if (!b.text_styles) b.text_styles = [];
  while (b.text_styles.length <= idx) b.text_styles.push({});
  if (!b.text_styles[idx]) b.text_styles[idx] = {};
  if (value) {
    b.text_styles[idx][prop] = value;
  } else {
    delete b.text_styles[idx][prop];
  }
  render();
  sbAutoSave(blockId);
}

// ── Move text pair up/down ──
function sbMoveText(blockId, idx, direction) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  var newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= (b.texts_ru || []).length) return;
  // Swap texts_ru
  if (b.texts_ru && b.texts_ru.length > newIdx) {
    var tmpRu = b.texts_ru[idx];
    b.texts_ru[idx] = b.texts_ru[newIdx];
    b.texts_ru[newIdx] = tmpRu;
  }
  // Swap texts_am
  if (b.texts_am && b.texts_am.length > newIdx) {
    var tmpAm = b.texts_am[idx];
    b.texts_am[idx] = b.texts_am[newIdx];
    b.texts_am[newIdx] = tmpAm;
  }
  // Swap images (icons for ticker)
  if (b.images && b.images.length > newIdx) {
    var tmpImg = b.images[idx];
    b.images[idx] = b.images[newIdx];
    b.images[newIdx] = tmpImg;
  }
  // Swap text_styles
  if (b.text_styles && b.text_styles.length > Math.max(idx, newIdx)) {
    var tmpStyle = b.text_styles[idx];
    b.text_styles[idx] = b.text_styles[newIdx];
    b.text_styles[newIdx] = tmpStyle;
  }
  // For nav block: swap nav_links indices so links follow their headings
  if (b.block_key === 'nav') {
    var navOpts = {};
    try { navOpts = typeof b.custom_html === 'string' ? JSON.parse(b.custom_html || '{}') : (b.custom_html || {}); } catch(e) { navOpts = {}; }
    if (navOpts.nav_links) {
      for (var nri = 0; nri < navOpts.nav_links.length; nri++) {
        if (navOpts.nav_links[nri].idx === idx) navOpts.nav_links[nri].idx = newIdx;
        else if (navOpts.nav_links[nri].idx === newIdx) navOpts.nav_links[nri].idx = idx;
      }
      b.custom_html = JSON.stringify(navOpts);
    }
  }
  render();
  sbAutoSave(blockId);
}

// ── Drag and drop for text pairs and buttons ──
var _sbDragType = '';
var _sbDragBlockId = 0;
var _sbDragIdx = 0;

function sbDragStart(e, type, blockId, idx) {
  _sbDragType = type;
  _sbDragBlockId = blockId;
  _sbDragIdx = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', type + ':' + blockId + ':' + idx);
  var dragEl = e.target.closest('.sb-text-pair') || e.target.closest('[draggable]') || e.target;
  if (dragEl && dragEl.style) dragEl.style.opacity = '0.5';
  // Reset opacity when drag ends (critical: prevents stuck dimming)
  dragEl.addEventListener('dragend', function() {
    dragEl.style.opacity = '1';
    dragEl.style.borderColor = '';
    // Also reset all highlighted siblings
    var parent = dragEl.parentElement;
    if (parent) {
      parent.querySelectorAll('[draggable]').forEach(function(el) {
        el.style.opacity = '1';
        el.style.borderColor = '';
      });
    }
  }, { once: true });
}

function sbDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  // Visual feedback: highlight drop target
  var pair = e.target.closest('.sb-text-pair') || e.target.closest('[draggable]');
  if (pair) pair.style.borderColor = '#8B5CF6';
}

function sbDragLeave(e) {
  var pair = e.target.closest('.sb-text-pair') || e.target.closest('[draggable]');
  if (pair) pair.style.borderColor = '';
}

function sbDrop(e, type, blockId, targetIdx) {
  e.preventDefault();
  // Reset visual
  var pair = e.target.closest('.sb-text-pair') || e.target.closest('[draggable]');
  if (pair) pair.style.borderColor = '';
  
  // Only handle drops of same type and block
  if (_sbDragType !== type || _sbDragBlockId !== blockId) return;
  var fromIdx = _sbDragIdx;
  if (fromIdx === targetIdx) return;
  
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  
  if (type === 'text') {
    // Reorder texts
    function moveItem(arr, from, to) {
      if (!arr || arr.length <= from) return;
      var item = arr.splice(from, 1)[0];
      arr.splice(to, 0, item);
    }
    moveItem(b.texts_ru, fromIdx, targetIdx);
    moveItem(b.texts_am, fromIdx, targetIdx);
    moveItem(b.images, fromIdx, targetIdx);
    // Also move text_styles
    if (b.text_styles) moveItem(b.text_styles, fromIdx, targetIdx);
    // For nav block: reindex nav_links so links follow their headings after drag
    if (b.block_key === 'nav') {
      var dNavOpts = {};
      try { dNavOpts = typeof b.custom_html === 'string' ? JSON.parse(b.custom_html || '{}') : (b.custom_html || {}); } catch(e) { dNavOpts = {}; }
      if (dNavOpts.nav_links) {
        for (var dnri = 0; dnri < dNavOpts.nav_links.length; dnri++) {
          var oldNIdx = dNavOpts.nav_links[dnri].idx;
          if (oldNIdx === fromIdx) {
            dNavOpts.nav_links[dnri].idx = targetIdx;
          } else if (fromIdx < targetIdx && oldNIdx > fromIdx && oldNIdx <= targetIdx) {
            dNavOpts.nav_links[dnri].idx = oldNIdx - 1;
          } else if (fromIdx > targetIdx && oldNIdx >= targetIdx && oldNIdx < fromIdx) {
            dNavOpts.nav_links[dnri].idx = oldNIdx + 1;
          }
        }
        b.custom_html = JSON.stringify(dNavOpts);
      }
    }
  } else if (type === 'btn') {
    // Reorder buttons
    if (b.buttons && b.buttons.length > fromIdx) {
      var btn = b.buttons.splice(fromIdx, 1)[0];
      b.buttons.splice(targetIdx, 0, btn);
    }
  }
  
  render();
  sbAutoSave(blockId);
}

// ── Section-level text move (for section editor, not block editor) ──
function moveTextItem(sectionId, idx, direction) {
  var content = (data.blockContents || []).find(function(x) { return x.block_key === sectionId; });
  if (!content) return;
  var texts = [];
  try { texts = JSON.parse(content.texts_json || '[]'); } catch(e) { return; }
  var newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= texts.length) return;
  var tmp = texts[idx];
  texts[idx] = texts[newIdx];
  texts[newIdx] = tmp;
  content.texts_json = JSON.stringify(texts);
  render();
  toast('Порядок текстов изменён — нажмите Сохранить');
}

// ── Add button ──
// ── Resolve button icon with priority: manual > auto-detect from URL > default ──
function sbResolveButtonIcon(icon, url) {
  var defaultIcons = ['fas fa-link', 'fas fa-arrow-right', ''];
  var isDefault = !icon || defaultIcons.indexOf(icon) >= 0;
  
  // If icon is manually set (not default), use it as priority
  if (!isDefault) return icon;
  
  // Auto-detect from URL
  if (url) {
    if (url.indexOf('t.me/') >= 0 || url.indexOf('telegram.') >= 0) return 'fab fa-telegram';
    if (url.indexOf('wa.me/') >= 0 || url.indexOf('whatsapp.') >= 0 || url.indexOf('api.whatsapp.') >= 0) return 'fab fa-whatsapp';
    if (url.indexOf('instagram.com') >= 0) return 'fab fa-instagram';
    if (url.indexOf('facebook.com') >= 0 || url.indexOf('fb.com') >= 0) return 'fab fa-facebook';
    if (url.indexOf('tiktok.com') >= 0) return 'fab fa-tiktok';
    if (url.indexOf('youtube.com') >= 0 || url.indexOf('youtu.be') >= 0) return 'fab fa-youtube';
    if (url.indexOf('vk.com') >= 0) return 'fab fa-vk';
    if (url.indexOf('viber.') >= 0) return 'fab fa-viber';
    if (url.indexOf('#calculator') >= 0 || url.indexOf('#calc') >= 0) return 'fas fa-calculator';
    if (url.indexOf('tel:') >= 0) return 'fas fa-phone';
    if (url.indexOf('mailto:') >= 0) return 'fas fa-envelope';
  }
  
  return icon || 'fas fa-link';
}

function sbAddButton(blockId) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  if (!b.buttons) b.buttons = [];
  b.buttons.push({ text_ru: '', text_am: '', url: '', icon: 'fas fa-link', action_type: 'link', message_ru: '', message_am: '' });
  render();
}

// ── Instantly update a button field in JS object (before sbAutoSave timer fires) ──
function sbUpdateBtnField(blockId, btnIdx, field, value) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b || !b.buttons || !b.buttons[btnIdx]) return;
  b.buttons[btnIdx][field] = value;
}

// ── Remove button ──
// ── Move button up/down ──
function sbMoveButton(blockId, idx, direction) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b || !b.buttons) return;
  var newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= b.buttons.length) return;
  var tmp = b.buttons[idx];
  b.buttons[idx] = b.buttons[newIdx];
  b.buttons[newIdx] = tmp;
  render();
  sbAutoSave(blockId);
}

function sbRemoveButton(blockId, idx) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b || !b.buttons) return;
  b.buttons.splice(idx, 1);
  render();
  sbAutoSave(blockId);
}

// ── Add social link ──
function sbAddSocial(blockId) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  var socials = [];
  try { socials = JSON.parse(b.social_links || '[]'); } catch(e) { socials = b.social_links || []; }
  if (!Array.isArray(socials)) socials = [];
  socials.push({ type: 'instagram', url: '' });
  b.social_links = socials;
  render();
}

// ── Remove social link ──
function sbRemoveSocial(blockId, idx) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  var socials = [];
  try { socials = JSON.parse(b.social_links || '[]'); } catch(e) { socials = b.social_links || []; }
  if (!Array.isArray(socials)) socials = [];
  socials.splice(idx, 1);
  b.social_links = socials;
  render();
  sbAutoSave(blockId);
}

// ── Footer block contacts (stored in footer_settings.contacts_json) ──
function _collectFtBlockContacts() {
  var contacts = [];
  var list = document.getElementById('ftBlockContactsList');
  if (!list) return contacts;
  var idx = 0;
  while (true) {
    var iconEl = document.getElementById('ftbc_icon_' + idx);
    if (!iconEl) break;
    contacts.push({
      icon: iconEl.value,
      name_ru: (document.getElementById('ftbc_name_ru_' + idx) || {}).value || '',
      name_am: (document.getElementById('ftbc_name_am_' + idx) || {}).value || '',
      url: (document.getElementById('ftbc_url_' + idx) || {}).value || ''
    });
    idx++;
  }
  return contacts;
}

function ftBlockContactChanged() {
  var contacts = _collectFtBlockContacts();
  if (!data.footer) data.footer = {};
  data.footer.contacts_json = JSON.stringify(contacts);
  // Auto-save footer contacts
  _saveFtBlockContacts(contacts);
}

function ftBlockContactAdd() {
  var contacts = _collectFtBlockContacts();
  contacts.push({ icon: 'fab fa-telegram', name_ru: '', name_am: '', url: '' });
  if (!data.footer) data.footer = {};
  data.footer.contacts_json = JSON.stringify(contacts);
  render();
}

function ftBlockContactRemove(idx) {
  var contacts = _collectFtBlockContacts();
  contacts.splice(idx, 1);
  if (!data.footer) data.footer = {};
  data.footer.contacts_json = JSON.stringify(contacts);
  render();
  _saveFtBlockContacts(contacts);
}

function _saveFtBlockContacts(contacts) {
  var f = data.footer || {};
  api('/footer', {
    method: 'PUT',
    body: JSON.stringify({
      brand_text_ru: f.brand_text_ru || '',
      brand_text_am: f.brand_text_am || '',
      contacts_json: JSON.stringify(contacts),
      socials_json: f.socials_json || '[]',
      nav_links_json: f.nav_links_json || '[]',
      custom_html: f.custom_html || '',
      copyright_ru: f.copyright_ru || '',
      copyright_am: f.copyright_am || '',
      location_ru: f.location_ru || '',
      location_am: f.location_am || ''
    })
  }).then(function() {
    toast('\\u041a\\u043e\\u043d\\u0442\\u0430\\u043a\\u0442\\u044b \\u0444\\u0443\\u0442\\u0435\\u0440\\u0430 \\u0441\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u044b', 'success');
  }).catch(function(e) {
    toast('\\u041e\\u0448\\u0438\\u0431\\u043a\\u0430 \\u0441\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u0438\\u044f \\u043a\\u043e\\u043d\\u0442\\u0430\\u043a\\u0442\\u043e\\u0432', 'error');
  });
}

// ── Add photo to block ──
function sbAddPhoto(blockId) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  var opts = {};
  try { opts = JSON.parse(b.custom_html || '{}'); } catch(e) { opts = {}; }
  if (!Array.isArray(opts.photos)) opts.photos = [];
  opts.photos.push({ url: '', caption: '', caption_ru: '', caption_am: '' });
  b.custom_html = JSON.stringify(opts);
  render();
}

// ── Pro Tools: Copy block data as JSON ──
function sbCopyBlockData(blockId) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  var exportData = {
    block_key: b.block_key, block_type: b.block_type,
    title_ru: b.title_ru, title_am: b.title_am,
    texts_ru: b.texts_ru, texts_am: b.texts_am,
    buttons: b.buttons, social_links: b.social_links,
    options: JSON.parse(b.custom_html || '{}')
  };
  navigator.clipboard.writeText(JSON.stringify(exportData, null, 2)).then(function() {
    toast('JSON скопирован в буфер обмена');
  }).catch(function() { toast('Не удалось скопировать', 'error'); });
}

// ── Pro Tools: Preview block on live site ──
function sbPreviewBlock(blockKey) {
  var sectionId = blockKey.replace(/_/g, '-');
  window.open('/#' + sectionId, '_blank');
}

// ── Pro Tools: Reset block to original (re-import from site) ──
async function sbResetBlock(blockId) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  if (!confirm('Сбросить блок «' + (b.title_ru || b.block_key) + '» до оригинальных текстов с сайта? Текущие изменения будут потеряны.')) return;
  toast('Сброс блока...');
  // Re-import will overwrite, but for a single block we just sync from site_content
  await api('/site-blocks/' + blockId + '/sync-to-site', { method: 'POST' });
  var res = await api('/site-blocks');
  data.siteBlocks = (res && res.blocks) || [];
  toast('Блок сброшен и синхронизирован');
  render();
}

// ── Remove photo from block ──
function sbRemovePhoto(blockId, idx) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  var opts = {};
  try { opts = JSON.parse(b.custom_html || '{}'); } catch(e) { opts = {}; }
  if (!Array.isArray(opts.photos)) opts.photos = [];
  opts.photos.splice(idx, 1);
  b.custom_html = JSON.stringify(opts);
  render();
  sbAutoSave(blockId);
}

// ── Upload photo from device ──
async function sbUploadPhoto(input, blockId, target, idx) {
  var file = input.files && input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Файл слишком большой (макс. 5 МБ)', 'error'); return; }
  toast('Загрузка фото...');
  var formData = new FormData();
  formData.append('file', file);
  formData.append('block_id', String(blockId));
  try {
    var resp = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData });
    var result = await resp.json();
    if (!result.success) { toast('Ошибка: ' + (result.error || 'unknown'), 'error'); return; }
    var url = result.url || result.data_url;
    var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
    if (!b) return;
    var opts = {};
    try { opts = JSON.parse(b.custom_html || '{}'); } catch(e) { opts = {}; }
    if (target === 'main') {
      opts.photo_url = url;
    } else {
      if (!Array.isArray(opts.photos)) opts.photos = [];
      if (typeof idx === 'number' && idx < opts.photos.length) {
        opts.photos[idx].url = url;
      } else {
        opts.photos.push({ url: url, caption: '', caption_ru: '', caption_am: '' });
      }
    }
    b.custom_html = JSON.stringify(opts);
    // For SEO blocks, also sync photo_url to top-level field (used by SSR for OG image)
    var isSeoUpload = (b.block_key === 'seo_og' || b.block_type === 'seo');
    if (isSeoUpload && target === 'main') {
      b.photo_url = url;
    }
    // Direct save to server (no debounce — immediate)
    var saveData = Object.assign({}, b);
    saveData.social_links = JSON.stringify(b.social_links || []);
    saveData.images = JSON.stringify(b.images || []);
    saveData.buttons = JSON.stringify(b.buttons || []);
    saveData.texts_ru = JSON.stringify(b.texts_ru || []);
    saveData.texts_am = JSON.stringify(b.texts_am || []);
    await api('/site-blocks/' + blockId, { method: 'PUT', body: JSON.stringify(saveData) }, true);
    await api('/site-blocks/' + blockId + '/sync-to-site', { method: 'POST' }, true);
    toast('Фото загружено и сохранено!');
    render();
  } catch(e) {
    toast('Ошибка загрузки: ' + (e.message || 'network error'), 'error');
  }
}

// ── Batch upload multiple photos ──
async function sbUploadPhotoBatch(input, blockId) {
  var files = input.files;
  if (!files || files.length === 0) return;
  toast('Загрузка ' + files.length + ' фото...');
  var b = (data.siteBlocks || []).find(function(x) { return x.id === blockId; });
  if (!b) return;
  var opts = {};
  try { opts = JSON.parse(b.custom_html || '{}'); } catch(e) { opts = {}; }
  if (!Array.isArray(opts.photos)) opts.photos = [];
  
  for (var fi = 0; fi < files.length; fi++) {
    var file = files[fi];
    if (file.size > 5 * 1024 * 1024) { toast('Пропущен: ' + file.name + ' (> 5 МБ)', 'error'); continue; }
    var formData = new FormData();
    formData.append('file', file);
    formData.append('block_id', String(blockId));
    try {
      var resp = await fetch('/api/admin/upload-image', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData });
      var result = await resp.json();
      if (result.success) {
        opts.photos.push({ url: result.url || result.data_url, caption: '', caption_ru: '', caption_am: '' });
      }
    } catch(e) {}
  }
  b.custom_html = JSON.stringify(opts);
  // Direct save to server (no debounce)
  var saveData = Object.assign({}, b);
  saveData.social_links = JSON.stringify(b.social_links || []);
  saveData.images = JSON.stringify(b.images || []);
  saveData.buttons = JSON.stringify(b.buttons || []);
  saveData.texts_ru = JSON.stringify(b.texts_ru || []);
  saveData.texts_am = JSON.stringify(b.texts_am || []);
  await api('/site-blocks/' + blockId, { method: 'PUT', body: JSON.stringify(saveData) }, true);
  await api('/site-blocks/' + blockId + '/sync-to-site', { method: 'POST' }, true);
  toast('Загружено ' + files.length + ' фото!');
  render();
}

// ── Toggle slot counter for block ──
// ── Old inline slot counter functions removed ──
// Slot counters are now managed as separate block_type='slot_counter' blocks
// No more per-block counter toggles — use "Новый блок" → "Счётчик слотов" instead

// ── Quick-create Reviews block ──
async function createReviewsBlock() {
  var title = prompt('Название блока отзывов:', 'Отзывы наших клиентов');
  if (!title) return;
  var key = 'reviews_' + Date.now().toString(36);
  var textsRu = [title, 'Результаты говорят сами за себя'];
  var textsAm = ['', ''];
  var customHtml = { bg_class: 'section', photos: [], show_photos: true };
  var blockData = {
    block_key: key, block_type: 'reviews', title_ru: title, title_am: '',
    texts_ru: textsRu, texts_am: textsAm,
    images: [], buttons: [], social_links: '[]',
    is_visible: 1, custom_css: '', custom_html: JSON.stringify(customHtml)
  };
  await api('/site-blocks', { method: 'POST', body: JSON.stringify(blockData) });
  var content = textsRu.map(function(ru) { return { ru: ru, am: '' }; });
  await api('/content', { method: 'POST', body: JSON.stringify({ section_key: key, section_name: title, content_json: content }) });
  var keyHyphen = key.replace(/_/g, '-');
  var maxOrder = 0;
  try { var soRes = await api('/section-order'); maxOrder = (soRes || []).reduce(function(m, s) { return Math.max(m, s.sort_order || 0); }, 0); } catch(e) {}
  await api('/section-order', { method: 'POST', body: JSON.stringify({ sections: [{ section_id: keyHyphen, sort_order: maxOrder + 1, is_visible: 1, label_ru: title, label_am: '' }] }) });
  toast('Блок отзывов «' + title + '» создан! Загрузите скриншоты отзывов в раздел "Фото блока".');
  await loadData(); render();
}

// ── Create new block (modal) ──
function createSiteBlock() {
  // Show template picker modal
  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
  
  var templates = [
    { key: 'section', icon: 'fa-align-left', color: '#8B5CF6', label: 'Секция с текстом', desc: 'Заголовок + текст + кнопка. Для акций, описаний, информации.', bg: 'section-dark' },
    { key: 'slot_counter', icon: 'fa-hourglass-half', color: '#fbbf24', label: 'Счётчик слотов', desc: 'Полоса со счётчиком свободных мест. Перетаскивайте между секциями.', bg: 'section-dark' },
    { key: 'promo', icon: 'fa-bullhorn', color: '#F59E0B', label: 'Промо-акция', desc: 'Баннер + яркий заголовок + CTA-кнопка. Для акций и спецпредложений.', bg: 'section' },
    { key: 'gallery', icon: 'fa-images', color: '#10B981', label: 'Фото-галерея', desc: 'Сетка фото с подписями. Для портфолио, примеров работ.', bg: 'section-dark' },
    { key: 'reviews', icon: 'fa-star', color: '#F97316', label: 'Отзывы клиентов', desc: 'Сетка скриншотов отзывов с увеличением. Для доверия и соцдоказательства.', bg: 'section' },
    { key: 'text_photo', icon: 'fa-columns', color: '#3B82F6', label: 'Текст + Фото', desc: 'Две колонки: текст слева, фото справа. Для рассказа о чём-то.', bg: 'section-dark' },
    { key: 'cta_banner', icon: 'fa-rocket', color: '#EF4444', label: 'CTA Баннер', desc: 'Полноширинный блок с призывом к действию и кнопкой.', bg: 'section' }
  ];
  
  var bgOptions = [
    { value: 'section-dark', label: 'Тёмный', color: '#0f172a' },
    { value: 'section', label: 'Светлый', color: '#1e293b' },
    { value: 'section-gradient', label: 'Градиент', color: 'linear-gradient(135deg,#1a1a2e,#16213e)' },
    { value: 'section-accent', label: 'Акцент', color: 'linear-gradient(135deg,#1e0533,#0f172a)' }
  ];
  
  var mh = '<div style="background:#0f172a;border:1px solid #334155;border-radius:16px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;padding:28px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><h2 style="font-size:1.3rem;font-weight:800;color:#e2e8f0"><i class="fas fa-magic" style="color:#8B5CF6;margin-right:8px"></i>Создать секцию для сайта</h2><button class="btn btn-outline" style="padding:6px 10px" onclick="this.closest(&apos;div[style*=fixed]&apos;).remove()"><i class="fas fa-times"></i></button></div>';
  
  // Template name input
  mh += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
    '<div>' +
    '<label style="font-size:0.82rem;color:#94a3b8;font-weight:600;display:block;margin-bottom:6px"><i class="fas fa-heading" style="color:#8B5CF6;margin-right:4px"></i>Название (RU)</label>' +
    '<input class="input" id="newblock_title" value="Новая секция" style="font-size:0.95rem;padding:10px">' +
    '</div>' +
    '<div>' +
    '<label style="font-size:0.82rem;color:#94a3b8;font-weight:600;display:block;margin-bottom:6px"><i class="fas fa-heading" style="color:#F59E0B;margin-right:4px"></i>Название (AM)</label>' +
    '<input class="input" id="newblock_title_am" value="" placeholder="Армянский заголовок" style="font-size:0.95rem;padding:10px">' +
    '</div>' +
    '</div>';
  
  // Background style
  mh += '<div style="margin-bottom:16px"><div style="font-size:0.82rem;color:#94a3b8;font-weight:600;margin-bottom:8px">Фон секции:</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  for (var bi = 0; bi < bgOptions.length; bi++) {
    var bg = bgOptions[bi];
    mh += '<label style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 12px;border:2px solid ' + (bi === 0 ? '#8B5CF6' : '#334155') + ';border-radius:8px;font-size:0.8rem;color:#e2e8f0">' +
      '<input type="radio" name="newblock_bg" value="' + bg.value + '"' + (bi === 0 ? ' checked' : '') + ' style="accent-color:#8B5CF6">' +
      '<div style="width:20px;height:20px;border-radius:4px;background:' + bg.color + ';border:1px solid #475569"></div>' + bg.label + '</label>';
  }
  mh += '</div></div>';
  
  // Template grid
  mh += '<div style="font-size:0.82rem;color:#94a3b8;font-weight:600;margin-bottom:8px">Выберите шаблон:</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">';
  for (var ti = 0; ti < templates.length; ti++) {
    var t = templates[ti];
    mh += '<div class="card" style="cursor:pointer;padding:14px;border:2px solid transparent;transition:border-color 0.2s" onclick="createBlockFromTemplate(&apos;' + t.key + '&apos;)" onmouseover="this.style.borderColor=&apos;' + t.color + '&apos;" onmouseout="this.style.borderColor=&apos;transparent&apos;">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">' +
      '<i class="fas ' + t.icon + '" style="font-size:1.5rem;color:' + t.color + '"></i>' +
      '<span style="font-size:0.92rem;font-weight:700;color:#e2e8f0">' + t.label + '</span></div>' +
      '<div style="font-size:0.75rem;color:#64748b;line-height:1.4">' + t.desc + '</div></div>';
  }
  mh += '</div></div>';
  
  modal.innerHTML = mh;
  document.body.appendChild(modal);
}

async function createBlockFromTemplate(template) {
  var titleInput = document.getElementById('newblock_title');
  var titleAmInput = document.getElementById('newblock_title_am');
  var title = titleInput ? titleInput.value.trim() : 'Новая секция';
  var titleAm = titleAmInput ? titleAmInput.value.trim() : '';
  if (!title) title = 'Новая секция';
  
  var bgRadio = document.querySelector('input[name="newblock_bg"]:checked');
  var bgClass = bgRadio ? bgRadio.value : 'section-dark';
  
  var key = template + '_' + Date.now().toString(36);
  var blockType = template === 'reviews' ? 'reviews' : (template === 'slot_counter' ? 'slot_counter' : 'section');
  
  var textsRu = [title];
  var textsAm = [''];
  var buttons = [];
  var customHtml = { bg_class: bgClass };
  
  // Configure based on template
  switch(template) {
    case 'slot_counter':
      textsRu = [title || '\\u0421\\u0432\\u043e\\u0431\\u043e\\u0434\\u043d\\u044b\\u0445 \\u043c\\u0435\\u0441\\u0442'];
      textsAm = ['\\u0531\\u0566\\u0561\\u057f \\u057f\\u0565\\u0572\\u0565\\u0580'];
      customHtml.total_slots = 10;
      customHtml.booked_slots = 0;
      break;
    case 'promo':
      textsRu = [title, 'Специальное предложение для вас!', 'Только до конца месяца'];
      buttons = [{ text_ru: 'Узнать подробнее', text_am: '', url: '#', icon: 'fas fa-arrow-right', action_type: 'link' }];
      customHtml.bg_class = 'section-accent';
      break;
    case 'gallery':
      textsRu = [title, 'Примеры наших работ'];
      customHtml.photos = []; customHtml.show_photos = true;
      break;
    case 'reviews':
      textsRu = [title, 'Что говорят наши клиенты'];
      customHtml.photos = []; customHtml.show_photos = true;
      break;
    case 'text_photo':
      textsRu = [title, 'Описание вашего предложения или услуги', 'Подробный текст, который убедит клиентов.'];
      customHtml.photo_url = '';
      break;
    case 'cta_banner':
      textsRu = [title, 'Готовы начать? Оставьте заявку прямо сейчас!'];
      buttons = [{ text_ru: 'Оставить заявку', text_am: '', url: '#calculator', icon: 'fas fa-rocket', action_type: 'link' }];
      customHtml.bg_class = 'section-accent';
      break;
    default:
      textsRu = [title, 'Текст вашей секции'];
  }
  
  // ── AUTO-COPY from similar existing block ──
  // Find existing blocks with the same block_type and copy useful data (buttons, settings)
  var existingBlocks = (data.siteBlocks || []);
  var similarBlock = null;
  for (var sbi = 0; sbi < existingBlocks.length; sbi++) {
    var eb = existingBlocks[sbi];
    if (eb.block_type === blockType && eb.block_key !== key) {
      similarBlock = eb;
      break;
    }
  }
  if (similarBlock) {
    // Copy buttons from similar block if we don't have custom ones
    if (buttons.length === 0 && similarBlock.buttons && similarBlock.buttons.length > 0) {
      buttons = JSON.parse(JSON.stringify(similarBlock.buttons));
    }
    // Copy social links
    if (similarBlock.social_links && typeof similarBlock.social_links === 'string') {
      try { var sl = JSON.parse(similarBlock.social_links); if (sl.length > 0) customHtml.social_links = sl; } catch(e) {}
    }
    console.log('[Admin] Auto-copied data from similar block:', similarBlock.block_key);
  }
  
  var blockData = {
    block_key: key, block_type: blockType, title_ru: title, title_am: titleAm,
    texts_ru: textsRu, texts_am: textsAm.length >= textsRu.length ? textsAm : textsRu.map(function() { return ''; }),
    images: [], buttons: buttons, social_links: '[]',
    is_visible: 1, custom_css: '', custom_html: JSON.stringify(customHtml)
  };
  
  await api('/site-blocks', { method: 'POST', body: JSON.stringify(blockData) });
  
  // Create content and section_order entries
  var content = textsRu.map(function(ru, i) { return { ru: ru, am: '' }; });
  await api('/content', { method: 'POST', body: JSON.stringify({ section_key: key, section_name: title, content_json: content }) });
  
  // Add to section_order with hyphenated key
  var keyHyphen = key.replace(/_/g, '-');
  var maxOrder = 0;
  try { var soRes = await api('/section-order'); maxOrder = (soRes || []).reduce(function(m, s) { return Math.max(m, s.sort_order || 0); }, 0); } catch(e) {}
  await api('/section-order', { method: 'POST', body: JSON.stringify({ sections: [{ section_id: keyHyphen, sort_order: maxOrder + 1, is_visible: 1, label_ru: title, label_am: titleAm }] }) });
  
  // Close modal
  var modal = document.querySelector('div[style*="fixed"][style*="z-index:999"]');
  if (modal) modal.remove();
  
  toast('Секция «' + title + '» создана! Теперь добавьте контент, фото и кнопки.');
  await loadData(); render();
}

// ── Save block (collect from DOM + send to API) ──
async function sbSaveBlock(id) {
  var b = (data.siteBlocks || []).find(function(x) { return x.id === id; });
  if (!b) return;
  
  sbShowSaveStatus('saving');

  // Collect title
  var titleRuEl = document.getElementById('sb_title_ru_' + id);
  var titleAmEl = document.getElementById('sb_title_am_' + id);
  if (titleRuEl) b.title_ru = titleRuEl.value;
  if (titleAmEl) b.title_am = titleAmEl.value;

  // Collect texts
  var newRu = [], newAm = [];
  var maxTexts = Math.max((b.texts_ru || []).length, (b.texts_am || []).length);
  // For calculator blocks, also check for additional text fields that may have been rendered
  var isCalc = (b.block_key === 'calculator' || b.block_type === 'calculator');
  if (isCalc) {
    for (var ci = maxTexts; ci < 20; ci++) {
      if (document.getElementById('sb_tru_' + id + '_' + ci) || document.getElementById('sb_tam_' + id + '_' + ci)) {
        maxTexts = ci + 1;
      } else { break; }
    }
  }
  for (var ti = 0; ti < maxTexts; ti++) {
    var ruEl = document.getElementById('sb_tru_' + id + '_' + ti);
    var amEl = document.getElementById('sb_tam_' + id + '_' + ti);
    newRu.push(ruEl ? ruEl.value : (b.texts_ru && b.texts_ru[ti] || ''));
    newAm.push(amEl ? amEl.value : (b.texts_am && b.texts_am[ti] || ''));
  }
  b.texts_ru = newRu;
  b.texts_am = newAm;

  // Collect ticker icons (stored in images array for ticker blocks)
  var isTicker = (b.block_key === 'ticker' || b.block_type === 'ticker');
  if (isTicker) {
    var newIcons = [];
    for (var ii = 0; ii < maxTexts; ii++) {
      var iconEl = document.getElementById('sb_ticon_' + id + '_' + ii);
      newIcons.push(iconEl ? iconEl.value : ((b.images && b.images[ii]) || 'fa-check-circle'));
    }
    b.images = newIcons;
  }

  // Collect buttons (full data)
  var newBtns = [];
  for (var bti = 0; bti < (b.buttons || []).length; bti++) {
    var btnRu = document.getElementById('sb_btnru_' + id + '_' + bti);
    var btnAm = document.getElementById('sb_btnam_' + id + '_' + bti);
    var btnUrl = document.getElementById('sb_btnurl_' + id + '_' + bti);
    var btnIcon = document.getElementById('sb_btnicon_' + id + '_' + bti);
    var btnMsgRu = document.getElementById('sb_btnmsg_ru_' + id + '_' + bti);
    var btnMsgAm = document.getElementById('sb_btnmsg_am_' + id + '_' + bti);
    var urlVal = btnUrl ? btnUrl.value : (b.buttons[bti].url || '');
    // Auto-detect action_type from URL
    var autoAction = 'link';
    if (urlVal.indexOf('t.me/') >= 0 || urlVal.indexOf('telegram.') >= 0) autoAction = 'telegram';
    else if (urlVal.indexOf('wa.me/') >= 0 || urlVal.indexOf('whatsapp.') >= 0 || urlVal.indexOf('api.whatsapp.') >= 0) autoAction = 'whatsapp';
    else if (urlVal.indexOf('#calculator') >= 0 || urlVal.indexOf('#calc') >= 0) autoAction = 'calculator';
    newBtns.push({
      text_ru: btnRu ? btnRu.value : (b.buttons[bti].text_ru || ''),
      text_am: btnAm ? btnAm.value : (b.buttons[bti].text_am || ''),
      url: urlVal,
      icon: btnIcon ? btnIcon.value : (b.buttons[bti].icon || 'fas fa-arrow-right'),
      action_type: autoAction,
      message_ru: btnMsgRu ? btnMsgRu.value : (b.buttons[bti].message_ru || ''),
      message_am: btnMsgAm ? btnMsgAm.value : (b.buttons[bti].message_am || '')
    });
  }
  b.buttons = newBtns;

  // Collect social links
  var socials = [];
  try { socials = JSON.parse(b.social_links || '[]'); } catch(e) { socials = b.social_links || []; }
  if (!Array.isArray(socials)) socials = [];
  var newSocials = [];
  for (var si = 0; si < socials.length; si++) {
    var socType = document.getElementById('sb_soctype_' + id + '_' + si);
    var socUrl = document.getElementById('sb_socurl_' + id + '_' + si);
    var socLabel = document.getElementById('sb_soclabel_' + id + '_' + si);
    var socIconSize = document.getElementById('sb_socicon_size_' + id + '_' + si);
    var socIconColor = document.getElementById('sb_socicon_color_' + id + '_' + si);
    var socTextSize = document.getElementById('sb_soctext_size_' + id + '_' + si);
    newSocials.push({
      type: socType ? socType.value : (socials[si].type || 'instagram'),
      url: socUrl ? socUrl.value : (socials[si].url || ''),
      label: socLabel ? socLabel.value : (socials[si].label || ''),
      icon_size: socIconSize && socIconSize.value ? parseInt(socIconSize.value) : (socials[si].icon_size || 0),
      bg_color: socIconColor ? socIconColor.value : (socials[si].bg_color || ''),
      text_size: socTextSize && socTextSize.value ? parseInt(socTextSize.value) : (socials[si].text_size || 0)
    });
  }
  b.social_links = newSocials;

  // Collect option toggles (stored in custom_html as JSON)
  var blockOpts = {};
  try { blockOpts = JSON.parse(b.custom_html || '{}'); } catch(e) { blockOpts = {}; }
  // Slot counter block: collect total/booked from dedicated fields
  if (b.block_type === 'slot_counter') {
    var scTotalEl = document.getElementById('sb_sc_total_' + id);
    var scBookedEl = document.getElementById('sb_sc_booked_' + id);
    if (scTotalEl) blockOpts.total_slots = parseInt(scTotalEl.value) || 10;
    if (scBookedEl) blockOpts.booked_slots = parseInt(scBookedEl.value) || 0;
  }
  // Collect social section settings
  var socTitleRu = document.getElementById('sb_soctitle_ru_' + id);
  var socTitleAm = document.getElementById('sb_soctitle_am_' + id);
  var socGap = document.getElementById('sb_socgap_' + id);
  var socAlign = document.getElementById('sb_socalign_' + id);
  var socPos = document.getElementById('sb_socpos_' + id);
  if (socTitleRu || socTitleAm || socGap) {
    if (!blockOpts.social_settings) blockOpts.social_settings = {};
    if (socTitleRu) blockOpts.social_settings.title_ru = socTitleRu.value;
    if (socTitleAm) blockOpts.social_settings.title_am = socTitleAm.value;
    // Subtitle removed from UI — clear any old values
    blockOpts.social_settings.subtitle_ru = '';
    blockOpts.social_settings.subtitle_am = '';
    if (socGap) blockOpts.social_settings.gap = parseInt(socGap.value) || 8;
    if (socAlign) blockOpts.social_settings.align = socAlign.value || 'center';
    if (socPos) blockOpts.social_settings.position = socPos.value || 'bottom';
  }
  // Social visibility based on links presence
  blockOpts.show_socials = newSocials.length > 0;
  // Keep existing values if checkbox element wasn't rendered
  // (e.g. for blocks where the option is not applicable)

  // Collect main photo URL
  var mainPhotoEl = document.getElementById('sb_mainphoto_' + id);
  if (mainPhotoEl) blockOpts.photo_url = mainPhotoEl.value || '';

  // Collect nav link targets (for nav block)
  if (b.block_key === 'nav') {
    var navLinksArr = blockOpts.nav_links || [];
    for (var nti = 0; nti < maxTexts; nti++) {
      var nlEl = document.getElementById('sb_navlink_' + id + '_' + nti);
      if (nlEl) {
        var found = false;
        for (var nli = 0; nli < navLinksArr.length; nli++) {
          if (navLinksArr[nli].idx === nti) { navLinksArr[nli].target = nlEl.value; found = true; break; }
        }
        if (!found) navLinksArr.push({ idx: nti, target: nlEl.value });
      }
    }
    blockOpts.nav_links = navLinksArr;
  }

  // Collect block photos from DOM
  var isTicker = (b.block_key === 'ticker' || b.block_type === 'ticker');
  if (!isTicker) {
    var existingPhotos = blockOpts.photos || [];
    if (!Array.isArray(existingPhotos)) existingPhotos = [];
    var newPhotos = [];
    for (var phi = 0; phi < existingPhotos.length; phi++) {
      var phUrlEl = document.getElementById('sb_photo_' + id + '_' + phi);
      var phCapEl = document.getElementById('sb_photocap_' + id + '_' + phi);
      var phCapAmEl = document.getElementById('sb_photocap_am_' + id + '_' + phi);
      newPhotos.push({
        url: phUrlEl ? phUrlEl.value : (existingPhotos[phi].url || ''),
        caption: phCapEl ? phCapEl.value : (existingPhotos[phi].caption || existingPhotos[phi].caption_ru || ''),
        caption_ru: phCapEl ? phCapEl.value : (existingPhotos[phi].caption_ru || existingPhotos[phi].caption || ''),
        caption_am: phCapAmEl ? phCapAmEl.value : (existingPhotos[phi].caption_am || '')
      });
    }
    blockOpts.photos = newPhotos;
  }
  
  // Collect photo display settings
  var psMaxH = document.getElementById('sb_ps_maxh_' + id);
  var psMaxHD = document.getElementById('sb_ps_maxhd_' + id);
  var psFit = document.getElementById('sb_ps_fit_' + id);
  var psRadius = document.getElementById('sb_ps_radius_' + id);
  var psFW = document.getElementById('sb_ps_fw_' + id);
  if (psMaxH || psFit || psRadius) {
    if (!blockOpts.photo_settings) blockOpts.photo_settings = {};
    if (psMaxH) blockOpts.photo_settings.max_height_mobile = parseInt(psMaxH.value) || 0;
    if (psMaxHD) blockOpts.photo_settings.max_height_desktop = parseInt(psMaxHD.value) || 0;
    if (psFit) blockOpts.photo_settings.object_fit = psFit.value || 'cover';
    if (psRadius) blockOpts.photo_settings.border_radius = parseInt(psRadius.value);
    if (psFW) blockOpts.photo_settings.full_width_mobile = psFW.checked;
  }

  // Collect swipe hint text (reviews blocks)
  var swipeHintRuEl = document.getElementById('sb_swipehint_ru_' + id);
  var swipeHintAmEl = document.getElementById('sb_swipehint_am_' + id);
  if (swipeHintRuEl) blockOpts.swipe_hint_ru = swipeHintRuEl.value || '';
  if (swipeHintAmEl) blockOpts.swipe_hint_am = swipeHintAmEl.value || '';

  // Collect contact cards (for contact block)
  if (b.block_key === 'contact' && blockOpts.contact_cards) {
    var newCC = [];
    for (var ccIdx = 0; ccIdx < blockOpts.contact_cards.length; ccIdx++) {
      var ccUrlEl = document.getElementById('sb_ccurl_' + id + '_' + ccIdx);
      var ccIconEl = document.getElementById('sb_ccicon_' + id + '_' + ccIdx);
      var ccUrl = ccUrlEl ? ccUrlEl.value : (blockOpts.contact_cards[ccIdx].url || '');
      var ccIcon = ccIconEl ? ccIconEl.value : (blockOpts.contact_cards[ccIdx].icon || 'auto');
      newCC.push({ url: ccUrl, icon: ccIcon });
    }
    blockOpts.contact_cards = newCC;
  }
  
  b.custom_html = JSON.stringify(blockOpts);

  // For SEO blocks, also save photo_url as a top-level field (used by SSR for OG image)
  var isSeo = (b.block_key === 'seo_og' || b.block_type === 'seo');
  if (isSeo && blockOpts.photo_url !== undefined) {
    b.photo_url = blockOpts.photo_url;
  }

  // Save to server
  var saveData = Object.assign({}, b);
  saveData.social_links = JSON.stringify(newSocials);
  saveData.images = JSON.stringify(b.images || []);
  saveData.buttons = JSON.stringify(b.buttons || []);
  saveData.texts_ru = JSON.stringify(b.texts_ru || []);
  saveData.texts_am = JSON.stringify(b.texts_am || []);
  saveData.text_styles = JSON.stringify(b.text_styles || []);
  
  var saveResult = await api('/site-blocks/' + id, { method: 'PUT', body: JSON.stringify(saveData) });
  if (!saveResult || saveResult.error) {
    console.error('[SB] Save failed for block', id, saveResult);
    sbShowSaveStatus('error');
    toast('Ошибка сохранения блока #' + id, 'error');
    return;
  }
  // Sync to site_content for instant site update
  await api('/site-blocks/' + id + '/sync-to-site', { method: 'POST' });
  
  sbShowSaveStatus('saved');
}

// ── Keyboard shortcut: Ctrl+S ──
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && currentPage === 'blocks') {
    e.preventDefault();
    var expandedIds = Object.keys(sbExpandedBlocks);
    expandedIds.forEach(function(id) { sbSaveBlock(parseInt(id)); });
    if (expandedIds.length === 0) toast('Раскройте блок для сохранения');
  }
});

// ── Modal editor for NEW blocks ──
var editingBlock = null;
function showBlockEditor() {
  if (!editingBlock) return;
  var b = editingBlock;
  var h = '<div id="siteBlockModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="closeBlockEditor()">' +
    '<div class="card" style="width:700px;max-width:95vw;max-height:90vh;overflow:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="font-size:1.1rem;font-weight:700"><i class="fas fa-plus-circle" style="color:#8B5CF6;margin-right:8px"></i>Новый блок</h3><button class="btn btn-outline" style="padding:6px 10px" onclick="closeBlockEditor()"><i class="fas fa-times"></i></button></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';
  h += '<div><label class="sb-field-label" style="color:#94a3b8"><i class="fas fa-key"></i> Ключ блока</label><input class="input" id="sbKey" value="' + escHtml(b.block_key) + '" placeholder="my_block"></div>';
  h += '<div><label class="sb-field-label" style="color:#94a3b8"><i class="fas fa-tag"></i> Тип</label><select class="input" id="sbType"><option value="section">Секция</option><option value="slot_counter">Счётчик слотов</option><option value="hero">Hero</option><option value="ticker">Бегущая строка</option><option value="banner">Баннер</option><option value="footer">Футер</option><option value="floating">Плавающая кнопка</option><option value="popup">Popup</option></select></div>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';
  h += '<div><label class="sb-field-label ru"><i class="fas fa-heading"></i> Название (RU)</label><input class="input" id="sbTitleRu" value="' + escHtml(b.title_ru) + '" placeholder="Название блока"></div>';
  h += '<div><label class="sb-field-label am"><i class="fas fa-heading"></i> Վերնագիր (AM)</label><input class="input" id="sbTitleAm" value="' + escHtml(b.title_am) + '" placeholder=""></div>';
  h += '</div>';
  h += '<div style="text-align:right;margin-top:16px"><button class="btn btn-success" onclick="saveSiteBlockModal()" style="min-width:180px"><i class="fas fa-save" style="margin-right:6px"></i>Создать блок</button></div>';
  h += '</div></div>';
  
  var existing = document.getElementById('siteBlockModal');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', h);
}

function closeBlockEditor() {
  editingBlock = null;
  var modal = document.getElementById('siteBlockModal');
  if (modal) modal.remove();
}

async function saveSiteBlockModal() {
  if (!editingBlock) return;
  editingBlock.block_key = document.getElementById('sbKey')?.value || editingBlock.block_key;
  editingBlock.block_type = document.getElementById('sbType')?.value || editingBlock.block_type;
  editingBlock.title_ru = document.getElementById('sbTitleRu')?.value || '';
  editingBlock.title_am = document.getElementById('sbTitleAm')?.value || '';

  if (editingBlock.id) {
    await api('/site-blocks/' + editingBlock.id, { method: 'PUT', body: JSON.stringify(editingBlock) });
    await api('/site-blocks/' + editingBlock.id + '/sync-to-site', { method: 'POST' });
  } else {
    await api('/site-blocks', { method: 'POST', body: JSON.stringify(editingBlock) });
    var freshRes = await api('/site-blocks');
    data.siteBlocks = (freshRes && freshRes.blocks) || [];
    var newBlock = data.siteBlocks.find(function(b) { return b.block_key === editingBlock.block_key; });
    if (newBlock) {
      await api('/site-blocks/' + newBlock.id + '/sync-to-site', { method: 'POST' });
    }
  }
  closeBlockEditor();
  var res = await api('/site-blocks');
  data.siteBlocks = (res && res.blocks) || [];
  toast('Блок создан и синхронизирован с сайтом');
  render();
}

// ── Import all blocks from site ──
async function importSiteBlocks() {
  if (data.siteBlocks && data.siteBlocks.length > 0) {
    if (!confirm('Все текущие блоки будут заменены данными с сайта. Продолжить?')) return;
  }
  toast('Загрузка блоков с сайта...');
  var result = await api('/site-blocks/import-from-site', { method: 'POST' });
  if (result && result.success) {
    toast('Загружено ' + (result.imported || 0) + ' блоков и ' + (result.tg_messages || 0) + ' кнопок-сообщений!');
  } else {
    toast('Ошибка загрузки: ' + (result?.error || 'unknown'), 'error');
  }
  // Full reload to get all updated data (blocks, photos, slot counters etc.)
  await loadData();
  render();
}

`;
