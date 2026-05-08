/**
 * GTT Inline Visual Editor — Phase 5
 * Activates only for logged-in admins (checks localStorage.gtt_token).
 * Provides: floating Admin Bar, click-to-edit texts, drag-and-drop blocks,
 * block management (add/hide/duplicate/delete), button/link editing.
 */
(function () {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────────────────
  var TOKEN_KEY = 'gtt_token';
  var API_BASE = '/api/admin';

  // ─── State ─────────────────────────────────────────────────────────────────
  var editMode = false;
  var editLang = localStorage.getItem('gtt_lang') || 'ru';
  var pendingChanges = {};   // { blockKey: { id, texts_ru, texts_am } }
  var blockMap = {};          // { blockKey: { id, sort_order, texts_ru, texts_am, is_visible } }
  var sortableInstance = null;
  var undoStack = [];         // [{ blockKey, idx, oldRu, oldAm }]

  // ─── Auth ──────────────────────────────────────────────────────────────────
  function getToken() { return localStorage.getItem(TOKEN_KEY); }

  // ─── API helper ────────────────────────────────────────────────────────────
  function adminAPI(path, opts) {
    var token = getToken();
    if (!token) return Promise.resolve(null);
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, opts.headers || {});
    return fetch(API_BASE + path, Object.assign({}, opts, { headers: headers }))
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  // ─── Toast ─────────────────────────────────────────────────────────────────
  function toast(msg, type, duration) {
    type = type || 'success';
    duration = duration || 3000;
    var div = document.createElement('div');
    div.className = 'gtt-toast gtt-toast-' + type;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(function () { if (div.parentNode) div.parentNode.removeChild(div); }, duration);
  }

  // ─── setTextPreserveIcons ──────────────────────────────────────────────────
  // Mirrors _setTextPreserveIcons in landing.js so text updates are consistent
  function setTextPreserveIcons(el, text) {
    var icons = el.querySelectorAll('i');
    if (icons.length > 0) {
      var cn = Array.prototype.slice.call(el.childNodes);
      for (var ci = 0; ci < cn.length; ci++) {
        if (cn[ci].nodeType === 3) el.removeChild(cn[ci]);
      }
      el.appendChild(document.createTextNode(' ' + text));
    } else {
      el.textContent = text;
    }
  }

  // ─── Change counter ────────────────────────────────────────────────────────
  function updateCounter() {
    var count = Object.keys(pendingChanges).length;
    var counter = document.getElementById('gtt-changes-counter');
    var undoBtn = document.getElementById('gtt-undo-btn');
    if (!counter) return;
    if (count > 0) {
      var label = count === 1 ? '1 блок изменён' : count + ' блока(ов) изменено';
      counter.textContent = label;
      counter.style.display = 'inline-flex';
      if (undoBtn) undoBtn.style.display = 'inline-flex';
    } else {
      counter.style.display = 'none';
      if (undoBtn) undoBtn.style.display = 'none';
    }
  }

  // ─── Admin Bar ─────────────────────────────────────────────────────────────
  function createAdminBar() {
    if (document.getElementById('gtt-admin-bar')) return;
    addEditorStyles();

    var bar = document.createElement('div');
    bar.id = 'gtt-admin-bar';
    bar.innerHTML =
      '<div class="gtt-bar-inner">' +
        '<div class="gtt-bar-left">' +
          '<span class="gtt-bar-logo">⚡ GTT Admin</span>' +
          '<button id="gtt-edit-toggle" class="gtt-bar-btn gtt-btn-edit">✏ Режим редактирования</button>' +
        '</div>' +
        '<div class="gtt-bar-actions" id="gtt-bar-actions" style="display:none">' +
          '<div class="gtt-lang-toggle">' +
            '<button class="gtt-lang-btn' + (editLang !== 'am' ? ' active' : '') + '" data-lang="ru" onclick="gttEditorSetLang(\'ru\')">RU</button>' +
            '<button class="gtt-lang-btn' + (editLang === 'am' ? ' active' : '') + '" data-lang="am" onclick="gttEditorSetLang(\'am\')">AM</button>' +
          '</div>' +
          '<span id="gtt-changes-counter" class="gtt-counter" style="display:none"></span>' +
          '<button id="gtt-undo-btn" class="gtt-bar-btn" style="display:none" onclick="gttEditorUndo()">↩ Отменить</button>' +
          '<button class="gtt-bar-btn gtt-btn-save" onclick="gttEditorSaveAll()">💾 Сохранить всё</button>' +
        '</div>' +
        '<a href="/admin" class="gtt-bar-btn gtt-btn-admin-link">⚙ Админка</a>' +
      '</div>';
    document.body.appendChild(bar);

    document.getElementById('gtt-edit-toggle').addEventListener('click', toggleEditMode);
  }

  // ─── Toggle edit mode ──────────────────────────────────────────────────────
  function toggleEditMode() {
    if (!editMode) {
      enableEditMode();
    } else {
      disableEditMode();
    }
  }

  function enableEditMode() {
    toast('Загрузка данных блоков...', 'info', 1500);
    adminAPI('/site-blocks').then(function (data) {
      if (!data || !data.blocks) {
        toast('Ошибка загрузки. Проверьте авторизацию.', 'error');
        return;
      }
      // Build block map
      blockMap = {};
      for (var i = 0; i < data.blocks.length; i++) {
        var b = data.blocks[i];
        blockMap[b.block_key] = {
          id: b.id,
          sort_order: b.sort_order || 0,
          texts_ru: Array.isArray(b.texts_ru) ? b.texts_ru : [],
          texts_am: Array.isArray(b.texts_am) ? b.texts_am : [],
          is_visible: b.is_visible,
          buttons: Array.isArray(b.buttons) ? b.buttons : []
        };
      }

      editMode = true;
      document.body.classList.add('gtt-edit-mode');
      var btn = document.getElementById('gtt-edit-toggle');
      if (btn) { btn.textContent = '✖ Выйти из редактирования'; btn.classList.add('active'); }
      var actions = document.getElementById('gtt-bar-actions');
      if (actions) actions.style.display = 'flex';

      activateTextEditing();
      activateBlockManagement();
      activateDragDrop();

      toast('Режим редактирования включён. Кликайте на тексты для редактирования.', 'success', 4000);
    });
  }

  function disableEditMode() {
    editMode = false;
    document.body.classList.remove('gtt-edit-mode');
    var btn = document.getElementById('gtt-edit-toggle');
    if (btn) { btn.textContent = '✏ Режим редактирования'; btn.classList.remove('active'); }
    var actions = document.getElementById('gtt-bar-actions');
    if (actions) actions.style.display = 'none';

    deactivateTextEditing();
    deactivateBlockManagement();
    if (sortableInstance) { try { sortableInstance.destroy(); } catch (e) {} sortableInstance = null; }

    toast('Режим редактирования выключен', 'info', 2000);
  }

  // ─── Text editing (Sprint 3) ───────────────────────────────────────────────
  function activateTextEditing() {
    var els = document.querySelectorAll('[data-edit-key]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-edit-key');
      var idx = parseInt(el.getAttribute('data-edit-idx') || '0', 10);
      var block = blockMap[key];
      if (!block) continue;

      // Show text in current edit language
      var text = editLang === 'am' ? block.texts_am[idx] : block.texts_ru[idx];
      if (typeof text === 'string' && text.trim()) {
        setTextPreserveIcons(el, text);
      }

      // Store originals for undo
      el.setAttribute('data-gtt-orig-ru', block.texts_ru[idx] || '');
      el.setAttribute('data-gtt-orig-am', block.texts_am[idx] || '');

      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
      el.addEventListener('input', onTextInput);
      el.addEventListener('keydown', onEditKeydown);
    }
  }

  function deactivateTextEditing() {
    var els = document.querySelectorAll('[data-edit-key]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      el.removeAttribute('contenteditable');
      el.removeEventListener('input', onTextInput);
      el.removeEventListener('keydown', onEditKeydown);
    }
  }

  function onTextInput(e) {
    var el = e.target;
    var key = el.getAttribute('data-edit-key');
    var idx = parseInt(el.getAttribute('data-edit-idx') || '0', 10);
    if (!key) return;

    var block = blockMap[key];
    if (!block) return;

    // First time editing this block: copy arrays for mutation
    if (!pendingChanges[key]) {
      pendingChanges[key] = {
        id: block.id,
        texts_ru: block.texts_ru.slice(),
        texts_am: block.texts_am.slice()
      };
    }

    var newText = el.textContent || '';
    if (editLang === 'am') {
      pendingChanges[key].texts_am[idx] = newText;
    } else {
      pendingChanges[key].texts_ru[idx] = newText;
    }

    updateCounter();
  }

  function onEditKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.target.blur();
    }
    if (e.key === 'Escape') {
      var el = e.target;
      var key = el.getAttribute('data-edit-key');
      var idx = parseInt(el.getAttribute('data-edit-idx') || '0', 10);
      // Revert to original
      var origText = editLang === 'am'
        ? (el.getAttribute('data-gtt-orig-am') || '')
        : (el.getAttribute('data-gtt-orig-ru') || '');
      setTextPreserveIcons(el, origText);
      // Remove from pendingChanges if reverted
      if (pendingChanges[key]) {
        if (editLang === 'am') pendingChanges[key].texts_am[idx] = origText;
        else pendingChanges[key].texts_ru[idx] = origText;
      }
      updateCounter();
      el.blur();
    }
  }

  // ─── Language switch for editor ────────────────────────────────────────────
  window.gttEditorSetLang = function (l) {
    editLang = l;
    document.querySelectorAll('.gtt-lang-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === l);
    });
    // Re-render all editable elements in the chosen language
    var els = document.querySelectorAll('[data-edit-key]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute('data-edit-key');
      var idx = parseInt(el.getAttribute('data-edit-idx') || '0', 10);
      var source = pendingChanges[key] || blockMap[key];
      if (!source) continue;
      var text = l === 'am' ? source.texts_am[idx] : source.texts_ru[idx];
      if (typeof text === 'string') setTextPreserveIcons(el, text);
    }
    toast('Язык редактирования: ' + (l === 'am' ? 'Армянский' : 'Русский'), 'info', 1500);
  };

  // ─── Save all (Sprint 3) ───────────────────────────────────────────────────
  window.gttEditorSaveAll = function () {
    var keys = Object.keys(pendingChanges);
    if (keys.length === 0) { toast('Нет изменений для сохранения', 'info'); return; }
    toast('Сохранение ' + keys.length + ' блока(ов)...', 'info', 1500);

    var promises = keys.map(function (key) {
      var c = pendingChanges[key];
      return adminAPI('/site-blocks/' + c.id, {
        method: 'PUT',
        body: JSON.stringify({ texts_ru: c.texts_ru, texts_am: c.texts_am })
      }).then(function (r) { return { key: key, ok: r && r.success }; });
    });

    Promise.all(promises).then(function (results) {
      var saved = 0, errors = 0;
      results.forEach(function (r) {
        if (r.ok) {
          saved++;
          if (blockMap[r.key]) {
            blockMap[r.key].texts_ru = pendingChanges[r.key].texts_ru;
            blockMap[r.key].texts_am = pendingChanges[r.key].texts_am;
          }
          delete pendingChanges[r.key];
        } else { errors++; }
      });
      updateCounter();
      if (errors === 0) {
        toast('✓ Сохранено ' + saved + ' блока(ов)! Кеш сброшен.', 'success', 4000);
      } else {
        toast(saved + ' сохранено, ' + errors + ' ошибок', 'error', 4000);
      }
    });
  };

  // ─── Undo last change ──────────────────────────────────────────────────────
  window.gttEditorUndo = function () {
    if (undoStack.length === 0) { toast('Нечего отменять', 'info'); return; }
    var last = undoStack.pop();
    var el = document.querySelector('[data-edit-key="' + last.key + '"][data-edit-idx="' + last.idx + '"]');
    if (el) {
      var origText = editLang === 'am' ? last.oldAm : last.oldRu;
      setTextPreserveIcons(el, origText);
      if (pendingChanges[last.key]) {
        if (editLang === 'am') pendingChanges[last.key].texts_am[last.idx] = last.oldAm;
        else pendingChanges[last.key].texts_ru[last.idx] = last.oldRu;
      }
    }
    updateCounter();
    toast('Отменено', 'info', 1500);
  };

  // ─── Block management (Sprint 5) ──────────────────────────────────────────
  function activateBlockManagement() {
    var blocks = document.querySelectorAll('[data-block-key]');
    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      var key = el.getAttribute('data-block-key');
      var block = blockMap[key];
      if (!block) continue;

      // Set data-block-id for drag & drop
      el.setAttribute('data-block-id', block.id);

      // Ensure relative positioning for toolbar
      var pos = window.getComputedStyle(el).position;
      if (pos === 'static') el.style.position = 'relative';

      // Create block toolbar
      var toolbar = document.createElement('div');
      toolbar.className = 'gtt-block-toolbar';
      toolbar.setAttribute('data-toolbar-for', key);
      toolbar.innerHTML =
        '<span class="gtt-drag-handle" title="Перетащить блок">⠿</span>' +
        '<span class="gtt-block-label">' + key + '</span>' +
        '<button class="gtt-block-btn" title="Скрыть/Показать блок" onclick="gttEditorToggleVisible(\'' + key + '\',' + block.id + ',' + block.is_visible + ')">👁</button>' +
        '<button class="gtt-block-btn" title="Дублировать блок" onclick="gttEditorDuplicate(' + block.id + ')">⧉</button>' +
        '<button class="gtt-block-btn gtt-btn-danger" title="Удалить блок" onclick="gttEditorDelete(\'' + key + '\',' + block.id + ')">🗑</button>';
      el.insertBefore(toolbar, el.firstChild);
    }

    // Add "+ Добавить блок" insert buttons between sections
    addInsertButtons();
  }

  function deactivateBlockManagement() {
    document.querySelectorAll('.gtt-block-toolbar').forEach(function (t) { t.parentNode && t.parentNode.removeChild(t); });
    document.querySelectorAll('.gtt-insert-btn-wrap').forEach(function (t) { t.parentNode && t.parentNode.removeChild(t); });
    // Remove inline position style if we added it
    document.querySelectorAll('[data-block-key]').forEach(function (el) {
      if (el.style.position === 'relative') el.style.position = '';
    });
  }

  function addInsertButtons() {
    var blocks = document.querySelectorAll('[data-block-key]');
    blocks.forEach(function (block, idx) {
      var wrap = document.createElement('div');
      wrap.className = 'gtt-insert-btn-wrap';
      wrap.innerHTML = '<button class="gtt-insert-btn" onclick="gttEditorShowAddMenu(' + idx + ')">+ Добавить блок здесь</button>';
      if (block.parentNode) block.parentNode.insertBefore(wrap, block.nextSibling);
    });
  }

  // ─── Block actions ─────────────────────────────────────────────────────────
  window.gttEditorToggleVisible = function (key, id, currentVisible) {
    var newVisible = currentVisible ? 0 : 1;
    adminAPI('/site-blocks/bulk-visibility', {
      method: 'POST',
      body: JSON.stringify({ ids: [id], is_visible: newVisible })
    }).then(function (r) {
      if (r && r.success) {
        if (blockMap[key]) blockMap[key].is_visible = newVisible;
        toast(newVisible ? '✓ Блок показан' : '✓ Блок скрыт', 'success');
        // Update toolbar button
        var tb = document.querySelector('[data-toolbar-for="' + key + '"]');
        if (tb) {
          var btn = tb.querySelector('.gtt-block-btn');
          if (btn) btn.setAttribute('onclick', 'gttEditorToggleVisible(\'' + key + '\',' + id + ',' + newVisible + ')');
        }
      } else {
        toast('Ошибка изменения видимости', 'error');
      }
    });
  };

  window.gttEditorDuplicate = function (id) {
    adminAPI('/site-blocks/duplicate/' + id, { method: 'POST' }).then(function (r) {
      if (r && (r.success || r.id)) {
        toast('✓ Блок дублирован. Обновите страницу.', 'success', 4000);
      } else {
        toast('Ошибка дублирования блока', 'error');
      }
    });
  };

  window.gttEditorDelete = function (key, id) {
    if (!confirm('Удалить блок "' + key + '"?\nЕго можно восстановить через историю в Админке.')) return;
    adminAPI('/site-blocks/' + id, { method: 'DELETE' }).then(function (r) {
      if (r && r.success) {
        var el = document.querySelector('[data-block-key="' + key + '"]');
        if (el && el.parentNode) el.parentNode.removeChild(el);
        delete blockMap[key];
        delete pendingChanges[key];
        updateCounter();
        toast('✓ Блок удалён. Кеш сброшен.', 'success');
      } else {
        toast('Ошибка удаления блока', 'error');
      }
    });
  };

  // ─── Add block menu (Sprint 5) ─────────────────────────────────────────────
  window.gttEditorShowAddMenu = function (afterIdx) {
    // Remove any existing menu
    var existing = document.getElementById('gtt-add-menu');
    if (existing) existing.parentNode && existing.parentNode.removeChild(existing);

    var templates = [
      { label: '📣 Баннер с текстом и кнопкой', type: 'hero_banner' },
      { label: '👥 Секция "Для кого"', type: 'for_whom' },
      { label: '⭐ Блок преимуществ', type: 'benefits' },
      { label: '📢 CTA-полоска', type: 'cta_strip' },
      { label: '📦 Пустой блок', type: 'empty' }
    ];

    var menu = document.createElement('div');
    menu.id = 'gtt-add-menu';
    menu.className = 'gtt-add-menu';
    menu.innerHTML =
      '<div class="gtt-add-menu-header">' +
        '<span>Выберите шаблон блока</span>' +
        '<button onclick="document.getElementById(\'gtt-add-menu\').remove()">&times;</button>' +
      '</div>' +
      '<div class="gtt-add-menu-list">' +
        templates.map(function (t) {
          return '<button class="gtt-add-menu-item" onclick="gttEditorAddBlock(\'' + t.type + '\',' + afterIdx + ')">' + t.label + '</button>';
        }).join('') +
      '</div>';
    document.body.appendChild(menu);
  };

  window.gttEditorAddBlock = function (blockType, afterIdx) {
    var existing = document.getElementById('gtt-add-menu');
    if (existing) existing.parentNode && existing.parentNode.removeChild(existing);

    var blocks = document.querySelectorAll('[data-block-key]');
    var afterBlock = blocks[afterIdx];
    var page = 'home';
    if (afterBlock) {
      var key = afterBlock.getAttribute('data-block-key') || '';
      page = key.split('__')[0] || 'home';
    }

    var newKey = page + '__new_' + blockType + '_' + Date.now();
    var payload = {
      block_key: newKey,
      block_type: blockType,
      title_ru: 'Новый блок — ' + blockType,
      title_am: 'Նոր բլոկ',
      texts_ru: JSON.stringify(['Заголовок нового блока', 'Описание. Отредактируйте текст в режиме редактирования.']),
      texts_am: JSON.stringify(['Նոր բլոկի վերնագիր', 'Նկարագրություն։']),
      buttons: JSON.stringify([{ text_ru: 'Узнать подробнее', text_am: 'Ավելին', url: 'https://t.me/goo_to_top', icon: 'fas fa-arrow-right' }]),
      is_visible: 1,
      sort_order: afterIdx * 10 + 5
    };

    adminAPI('/site-blocks', { method: 'POST', body: JSON.stringify(payload) }).then(function (r) {
      if (r && r.success) {
        toast('✓ Блок создан! Обновите страницу чтобы увидеть его.', 'success', 5000);
      } else {
        toast('Ошибка создания блока', 'error');
      }
    });
  };

  // ─── Drag & Drop (Sprint 4) ────────────────────────────────────────────────
  function activateDragDrop() {
    if (typeof Sortable !== 'undefined') {
      initSortable();
    } else {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js';
      script.onload = initSortable;
      document.head.appendChild(script);
    }
  }

  function initSortable() {
    var container = document.querySelector('main') || document.body;
    try {
      sortableInstance = new Sortable(container, {
        handle: '.gtt-drag-handle',
        animation: 200,
        ghostClass: 'gtt-drag-ghost',
        chosenClass: 'gtt-drag-chosen',
        filter: '[contenteditable="true"]',
        onEnd: function (evt) {
          var items = container.querySelectorAll('[data-block-id]');
          var orders = [];
          for (var i = 0; i < items.length; i++) {
            var bid = parseInt(items[i].getAttribute('data-block-id') || '0', 10);
            if (bid) orders.push({ id: bid, sort_order: (i + 1) * 10 });
          }
          adminAPI('/site-blocks/reorder', {
            method: 'POST',
            body: JSON.stringify({ orders: orders })
          }).then(function (r) {
            if (r && r.success) toast('✓ Порядок блоков сохранён', 'success');
            else toast('Ошибка сохранения порядка', 'error');
          });
        }
      });
    } catch (e) {
      console.warn('GTT Editor: Could not init SortableJS', e);
    }
  }

  // ─── Button/Link editing (Sprint 6) ────────────────────────────────────────
  // Activated on elements with data-edit-type="button"
  function activateButtonEditing() {
    var btns = document.querySelectorAll('[data-edit-type="button"]');
    btns.forEach(function (el) {
      el.addEventListener('click', onButtonClick);
    });
  }

  function deactivateButtonEditing() {
    document.querySelectorAll('[data-edit-type="button"]').forEach(function (el) {
      el.removeEventListener('click', onButtonClick);
    });
    var popup = document.getElementById('gtt-btn-popup');
    if (popup) popup.parentNode && popup.parentNode.removeChild(popup);
  }

  function onButtonClick(e) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    var el = e.currentTarget;
    showButtonPopup(el);
  }

  function showButtonPopup(el) {
    var existing = document.getElementById('gtt-btn-popup');
    if (existing) existing.parentNode && existing.parentNode.removeChild(existing);

    var key = el.getAttribute('data-edit-key') || '';
    var idx = parseInt(el.getAttribute('data-edit-idx') || '0', 10);
    var href = el.getAttribute('href') || el.getAttribute('data-edit-href') || '';
    var text = el.textContent.trim();

    var popup = document.createElement('div');
    popup.id = 'gtt-btn-popup';
    popup.className = 'gtt-btn-popup';
    var rect = el.getBoundingClientRect();
    popup.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    popup.style.left = Math.max(8, rect.left + window.scrollX) + 'px';

    popup.innerHTML =
      '<div class="gtt-btn-popup-header">' +
        '<span>Редактировать кнопку</span>' +
        '<button onclick="document.getElementById(\'gtt-btn-popup\').remove()">&times;</button>' +
      '</div>' +
      '<div class="gtt-btn-popup-body">' +
        '<label>Текст кнопки</label>' +
        '<input id="gtt-btn-text" type="text" value="' + escAttr(text) + '">' +
        '<label>Ссылка (URL)</label>' +
        '<input id="gtt-btn-href" type="text" value="' + escAttr(href) + '" placeholder="https://...">' +
        '<div class="gtt-btn-popup-actions">' +
          '<button class="gtt-bar-btn gtt-btn-save" onclick="gttEditorSaveButton(\'' + escAttr(key) + '\',' + idx + ')">Сохранить</button>' +
          '<button class="gtt-bar-btn" onclick="document.getElementById(\'gtt-btn-popup\').remove()">Отмена</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(popup);
    document.getElementById('gtt-btn-text').focus();
  }

  window.gttEditorSaveButton = function (key, idx) {
    var textEl = document.getElementById('gtt-btn-text');
    var hrefEl = document.getElementById('gtt-btn-href');
    if (!textEl || !hrefEl) return;

    var newText = textEl.value.trim();
    var newHref = hrefEl.value.trim();

    // Update all matching elements on page
    var btns = document.querySelectorAll('[data-edit-key="' + key + '"][data-edit-idx="' + idx + '"]');
    btns.forEach(function (el) {
      if (el.tagName === 'A') el.href = newHref;
      setTextPreserveIcons(el, newText);
    });

    // Save to pending changes (treat button text as idx in texts_ru/am)
    if (key && blockMap[key]) {
      if (!pendingChanges[key]) {
        pendingChanges[key] = {
          id: blockMap[key].id,
          texts_ru: blockMap[key].texts_ru.slice(),
          texts_am: blockMap[key].texts_am.slice()
        };
      }
      pendingChanges[key].texts_ru[idx] = newText;
      updateCounter();
    }

    var popup = document.getElementById('gtt-btn-popup');
    if (popup) popup.parentNode && popup.parentNode.removeChild(popup);
    toast('✓ Кнопка обновлена. Нажмите «Сохранить всё».', 'success');
  };

  function escAttr(s) {
    return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ─── Styles ────────────────────────────────────────────────────────────────
  function addEditorStyles() {
    if (document.getElementById('gtt-editor-styles')) return;
    var style = document.createElement('style');
    style.id = 'gtt-editor-styles';
    style.textContent = [
      /* Admin Bar */
      '#gtt-admin-bar{position:fixed;bottom:0;left:0;right:0;z-index:999999;background:linear-gradient(135deg,#1a1128,#2d1f50);border-top:2px solid #8b5cf6;padding:8px 16px;padding-bottom:max(8px,env(safe-area-inset-bottom));box-shadow:0 -4px 20px rgba(139,92,246,0.3)}',
      '.gtt-bar-inner{max-width:1440px;margin:0 auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.gtt-bar-left{display:flex;align-items:center;gap:8px;flex:1}',
      '.gtt-bar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.gtt-bar-logo{font-weight:800;color:#a78bfa;font-size:0.82rem;letter-spacing:0.5px;white-space:nowrap}',
      '.gtt-bar-btn{padding:5px 12px;border-radius:6px;border:1px solid rgba(139,92,246,0.4);background:rgba(139,92,246,0.15);color:#f5f3ff;font-size:0.75rem;font-weight:600;cursor:pointer;transition:all 0.2s;text-decoration:none;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}',
      '.gtt-bar-btn:hover{background:rgba(139,92,246,0.3);transform:translateY(-1px)}',
      '.gtt-bar-btn.active{background:rgba(239,68,68,0.2);border-color:rgba(239,68,68,0.5);color:#fca5a5}',
      '.gtt-btn-save{background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-color:transparent!important}',
      '.gtt-btn-save:hover{box-shadow:0 4px 12px rgba(139,92,246,0.5)}',
      '.gtt-btn-admin-link{background:rgba(255,255,255,0.06)}',
      /* Lang toggle */
      '.gtt-lang-toggle{display:flex;border:1px solid rgba(139,92,246,0.3);border-radius:6px;overflow:hidden}',
      '.gtt-lang-btn{padding:4px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;background:transparent;border:none;color:#a5a0b8;transition:all 0.15s}',
      '.gtt-lang-btn.active{background:#8b5cf6;color:white}',
      /* Counter */
      '.gtt-counter{font-size:0.72rem;color:#fbbf24;font-weight:700;padding:4px 8px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:5px}',
      /* Toast */
      '.gtt-toast{position:fixed;bottom:72px;right:16px;z-index:1000001;padding:10px 16px;border-radius:8px;font-size:0.82rem;font-weight:600;color:white;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,0.4);animation:gttSlideIn 0.3s ease;max-width:320px}',
      '.gtt-toast-success{background:#059669}',
      '.gtt-toast-error{background:#dc2626}',
      '.gtt-toast-info{background:#4b5563}',
      '@keyframes gttSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}',
      /* Edit mode indicators */
      'body.gtt-edit-mode [data-edit-key]{outline:2px dashed rgba(139,92,246,0.4);outline-offset:2px;border-radius:2px;cursor:text;transition:outline 0.15s,background 0.15s}',
      'body.gtt-edit-mode [data-edit-key]:hover{outline:2px solid #8b5cf6;background:rgba(139,92,246,0.08)}',
      'body.gtt-edit-mode [data-edit-key]:focus{outline:2px solid #a78bfa;background:rgba(139,92,246,0.12);caret-color:#a78bfa}',
      /* Prevent link navigation in edit mode */
      'body.gtt-edit-mode a[data-edit-key]{pointer-events:none;cursor:text}',
      /* Block toolbars */
      '.gtt-block-toolbar{position:absolute;top:0;left:0;right:0;z-index:500;display:flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(15,10,26,0.92);border-bottom:1px solid rgba(139,92,246,0.35);backdrop-filter:blur(12px);opacity:0;transition:opacity 0.2s;pointer-events:none}',
      'body.gtt-edit-mode [data-block-key]:hover>.gtt-block-toolbar{opacity:1;pointer-events:auto}',
      '.gtt-drag-handle{cursor:grab;font-size:1rem;color:#8b5cf6;user-select:none;padding:0 4px}',
      '.gtt-drag-handle:active{cursor:grabbing}',
      '.gtt-block-label{font-size:0.65rem;color:#6b7280;flex:1;font-family:monospace}',
      '.gtt-block-btn{padding:3px 8px;border-radius:4px;border:1px solid rgba(139,92,246,0.3);background:rgba(139,92,246,0.1);color:#f5f3ff;font-size:0.7rem;cursor:pointer;transition:background 0.15s}',
      '.gtt-block-btn:hover{background:rgba(139,92,246,0.25)}',
      '.gtt-btn-danger{border-color:rgba(239,68,68,0.35)!important;background:rgba(239,68,68,0.1)!important}',
      '.gtt-btn-danger:hover{background:rgba(239,68,68,0.25)!important}',
      /* Insert block buttons */
      '.gtt-insert-btn-wrap{display:none;text-align:center;padding:6px 0;position:relative;z-index:1}',
      'body.gtt-edit-mode .gtt-insert-btn-wrap{display:block}',
      '.gtt-insert-btn{padding:5px 18px;border-radius:20px;border:1px dashed rgba(139,92,246,0.45);background:rgba(139,92,246,0.06);color:#a78bfa;font-size:0.75rem;cursor:pointer;transition:all 0.2s}',
      '.gtt-insert-btn:hover{background:rgba(139,92,246,0.15);border-style:solid}',
      /* Drag ghost */
      '.gtt-drag-ghost{opacity:0.5;background:rgba(139,92,246,0.15)!important}',
      '.gtt-drag-chosen{outline:2px solid #8b5cf6!important}',
      /* Add block menu */
      '.gtt-add-menu{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000010;background:linear-gradient(145deg,#1a1128,#2d1f50);border:1px solid rgba(139,92,246,0.5);border-radius:14px;padding:0;min-width:280px;box-shadow:0 20px 60px rgba(0,0,0,0.5)}',
      '.gtt-add-menu-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(139,92,246,0.2);font-size:0.88rem;font-weight:700;color:#f5f3ff}',
      '.gtt-add-menu-header button{background:none;border:none;color:#a5a0b8;font-size:1.2rem;cursor:pointer;line-height:1}',
      '.gtt-add-menu-list{padding:10px}',
      '.gtt-add-menu-item{display:block;width:100%;padding:10px 14px;border-radius:8px;border:none;background:transparent;color:#f5f3ff;font-size:0.85rem;cursor:pointer;text-align:left;transition:background 0.15s}',
      '.gtt-add-menu-item:hover{background:rgba(139,92,246,0.2)}',
      /* Button edit popup */
      '.gtt-btn-popup{position:absolute;z-index:1000011;background:linear-gradient(145deg,#1a1128,#2d1f50);border:1px solid rgba(139,92,246,0.5);border-radius:12px;min-width:280px;box-shadow:0 12px 40px rgba(0,0,0,0.5)}',
      '.gtt-btn-popup-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(139,92,246,0.2);font-size:0.82rem;font-weight:700;color:#f5f3ff}',
      '.gtt-btn-popup-header button{background:none;border:none;color:#a5a0b8;font-size:1.1rem;cursor:pointer;line-height:1}',
      '.gtt-btn-popup-body{padding:12px 14px}',
      '.gtt-btn-popup-body label{display:block;font-size:0.72rem;font-weight:600;color:#a78bfa;margin-bottom:4px;margin-top:10px}',
      '.gtt-btn-popup-body label:first-child{margin-top:0}',
      '.gtt-btn-popup-body input{width:100%;padding:8px 10px;background:rgba(15,10,26,0.6);border:1px solid rgba(139,92,246,0.3);border-radius:7px;color:#f5f3ff;font-size:0.82rem}',
      '.gtt-btn-popup-body input:focus{outline:none;border-color:#8b5cf6}',
      '.gtt-btn-popup-actions{display:flex;gap:8px;margin-top:12px}',
      /* Extra bottom padding for admin bar */
      'body.gtt-has-admin-bar{padding-bottom:max(56px,calc(56px + env(safe-area-inset-bottom)))!important}',
      '@media(max-width:900px){body.gtt-has-admin-bar{padding-bottom:max(128px,calc(128px + env(safe-area-inset-bottom)))!important}.gtt-bar-logo{display:none}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init() {
    var token = getToken();
    if (!token) return; // Not logged in — stay completely invisible

    createAdminBar();
    document.body.classList.add('gtt-has-admin-bar');

    // Also activate button-level editing (Sprint 6)
    // For now, button editing is triggered from block toolbar → buttons popup
    // Future: auto-detect a[data-edit-type="button"] for direct click editing
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
