/**
 * GTT Inline Visual Editor — Phase 5.1
 *
 * Activates only for logged-in admins (checks localStorage.gtt_token).
 *
 * Two storage paths for edits:
 *   1) CMS blocks   — elements with [data-edit-key] go to PUT /site-blocks/:id
 *   2) Text overrides — every other [data-ru]/[data-am] element gets a stable
 *      auto-generated id ("<page>__txt_N") and is saved via the new
 *      PUT /text-overrides API. SSR-side text overrides are applied via the
 *      same id mechanism on every page load (also for non-admin visitors).
 *
 * Features:
 *   - Floating Admin Bar (bottom)
 *   - Edit-mode toggle highlights every editable text
 *   - Click-to-edit (contenteditable) — fix: no pointer-events:none on links
 *   - RU / AM toggle — switches displayed text without page reload
 *   - Undo (push original to stack on first edit, persists across saves)
 *   - Save all — batches CMS + override saves, refreshes blockMap
 *   - Drag-and-drop blocks (SortableJS, draggable: '[data-block-key]')
 *   - Block toolbar: hide/show, duplicate, delete
 *   - "+ Add block" between blocks → creates a custom block via API
 *   - Button/link popup — clicking <a>/<button> in edit mode lets you
 *     edit BOTH text AND href in one popup
 *   - Toast notifications for every action
 */
(function () {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────────────────
  var TOKEN_KEY = 'gtt_token';
  var API_BASE = '/api/admin';

  // Detect current page slug from pathname (used for txt_id namespace)
  function detectPage() {
    var p = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (!p || p === 'am' || p === 'ru') return 'home_legacy';
    if (p === 'home') return 'home';
    if (p.indexOf('package/') === 0) return 'package';
    if (p === 'blog' || p.indexOf('blog/') === 0) return 'blog';
    var first = p.split('/')[0];
    return first || 'home';
  }
  var PAGE = detectPage();

  // ─── State ─────────────────────────────────────────────────────────────────
  var editMode = false;
  // editLang follows the page lang at startup, then user can toggle it.
  function detectPageLang() {
    var path = window.location.pathname;
    if (path === '/am' || path.indexOf('/am/') === 0) return 'am';
    var qp = (new URLSearchParams(window.location.search)).get('lang');
    if (qp === 'am' || qp === 'hy') return 'am';
    var ls = localStorage.getItem('gtt_lang');
    if (ls === 'am') return 'am';
    return 'ru';
  }
  var editLang = detectPageLang();
  var pendingChanges = {};      // CMS:    { blockKey: { id, texts_ru, texts_am } }
  var pendingOverrides = {};    // Static: { txtId: { text_ru, text_am, href } }
  var blockMap = {};            // { blockKey: { id, sort_order, texts_ru, texts_am, is_visible, buttons } }
  var sortableInstance = null;
  var undoStack = [];           // [{ kind, txtId|key, idx, oldRu, oldAm, oldHref }]

  // ─── Auth ──────────────────────────────────────────────────────────────────
  function getToken() { return localStorage.getItem(TOKEN_KEY); }

  // ─── API helper ────────────────────────────────────────────────────────────
  function adminAPI(path, opts) {
    var token = getToken();
    if (!token) return Promise.resolve(null);
    opts = opts || {};
    var headers = Object.assign(
      { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      opts.headers || {}
    );
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

  // ─── Text helpers ──────────────────────────────────────────────────────────
  // Mirrors _setTextPreserveIcons in landing.js so SVG/icons inside a label
  // don't get wiped when we update text.
  function setTextPreserveIcons(el, text) {
    var icons = el.querySelectorAll('i');
    if (icons.length > 0) {
      var cn = Array.prototype.slice.call(el.childNodes);
      for (var ci = 0; ci < cn.length; ci++) {
        if (cn[ci].nodeType === 3) el.removeChild(cn[ci]);
      }
      el.appendChild(document.createTextNode(text));
    } else {
      el.textContent = text;
    }
  }

  // Read current text from element, ignoring icons.
  function getTextOnly(el) {
    var clone = el.cloneNode(true);
    var icons = clone.querySelectorAll('i, svg');
    for (var i = 0; i < icons.length; i++) {
      if (icons[i].parentNode) icons[i].parentNode.removeChild(icons[i]);
    }
    return (clone.textContent || '').trim();
  }

  // ─── Element classification ────────────────────────────────────────────────
  // Returns true if an element should be skipped entirely:
  // form inputs/textareas, scripts, styles, hidden elements, lang switcher
  // buttons (we want clicks on them to keep changing language).
  function shouldSkip(el) {
    if (!el) return true;
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SCRIPT' || tag === 'STYLE') return true;
    if (el.classList && (el.classList.contains('lang-btn') || el.classList.contains('hamburger'))) return true;
    if (el.closest && el.closest('.lang-switch')) return true;
    if (el.closest && el.closest('#gtt-admin-bar')) return true;
    return false;
  }

  // ─── Stable txt_id assignment ─────────────────────────────────────────────
  // Walks the DOM in order and assigns each [data-ru]/[data-am] element a
  // deterministic data-edit-text="<PAGE>__txt_<N>" id (skipping CMS blocks
  // which already have data-edit-key). This must happen BEFORE we apply
  // overrides or activate edit mode, so the same elements get the same ids
  // across reloads.
  function assignTextIds() {
    // Assign a stable txt_id to EVERY editable text element. Two SSR conventions
    // exist on this site:
    //   1. [data-ru]/[data-am] — bilingual text (most blocks)
    //   2. [data-edit-key] — Phase 5 script-injected attribute on plain <span>/<h*>
    //      WITHOUT data-ru/am. These also need a stable txt_id so the override
    //      path can save them.
    // We deliberately union both selectors and skip elements already addressed.
    var nodes = document.querySelectorAll('[data-ru], [data-am], [data-edit-key]');
    var n = 0;
    var withDataRu = 0, withoutDataRu = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (shouldSkip(el)) continue;
      if (el.getAttribute('data-edit-text')) continue;       // already assigned
      // Build stable id. If element has data-edit-key + data-edit-idx, prefer
      // that as a deterministic id (so it's reproducible across reloads).
      var key = el.getAttribute('data-edit-key');
      var idx = el.getAttribute('data-edit-idx');
      var txtId;
      if (key && idx !== null) {
        txtId = PAGE + '__' + key + '__' + idx;
        withoutDataRu++;
      } else {
        txtId = PAGE + '__txt_' + (n++);
        withDataRu++;
      }
      el.setAttribute('data-edit-text', txtId);
    }
  }

  /** Hash path portion of img src — stable ids survive DOM reorder across reloads. */
  function _imgSrcKey(src) {
    var s = (src || '').trim();
    s = s.replace(/^https?:\/\/[^/?#]+/i, '').split('#')[0].replace(/\?.*/, '');
    if (!s) return '_empty';
    var h = 0;
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    var hex = ('00000000' + ((h >>> 0).toString(16))).slice(-8);
    var slug = s.replace(/[\s]+/g, '_').replace(/[^a-zA-Z0-9._~-]/g, '_').replace(/^_+/, '').slice(-80);
    return slug ? hex + '_' + slug : hex;
  }

  // Phase 5.1.2: Assign stable IDs to <img> elements so we can persist src
  // overrides via site_text_overrides (re-using `href` column for image src).
  function assignImageIds() {
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var el = imgs[i];
      if (shouldSkip(el)) continue;
      if (el.closest && el.closest('#gtt-admin-bar')) continue;
      if (el.getAttribute('data-edit-img')) continue;
      var key = _imgSrcKey(el.getAttribute('src') || '');
      el.setAttribute('data-edit-img', PAGE + '__img_h_' + key);
    }
  }

  // ─── Apply overrides on init (for everyone, not just admins) ──────────────
  // Public endpoint, no auth required. Lets the editor.js script also serve
  // as the runtime patch for static texts.
  function applyOverridesFromServer() {
    // Phase 5.1.2: Prefer SSR-inlined overrides (window.__GTT_OVERRIDES) so the
    // first paint already shows latest text — eliminates the FOUC where the
    // old version flashes before the JS-fetched override applies.
    var inlinePromise;
    if (window.__GTT_OVERRIDES) {
      inlinePromise = Promise.resolve({ overrides: window.__GTT_OVERRIDES });
    } else {
      inlinePromise = fetch('/api/text-overrides/' + encodeURIComponent(PAGE), { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : { overrides: {} }; })
        .catch(function () { return { overrides: {} }; });
    }
    return inlinePromise
      .then(function (data) {
        var ov = (data && data.overrides) || {};
        // Phase 5.1.4: Block-order application disabled — see comment above
        // activateDragDrop. Any pre-existing __order__ rows in DB are ignored
        // so the page renders in natural SSR sequence.
        var lang = detectPageLang();
        Object.keys(ov).forEach(function (txtId) {
          if (txtId.indexOf('__order__') === 0) return;     // internal — skip render
          var els = document.querySelectorAll('[data-edit-text="' + cssEsc(txtId) + '"], [data-edit-img="' + cssEsc(txtId) + '"]');
          var rec = ov[txtId];
          els.forEach(function (el) {
            // <img> override path: rec.href stores the new src.
            if (el.tagName === 'IMG') {
              if (rec.href) el.setAttribute('src', rec.href);
              return;
            }
            // Update data-ru/data-am attributes so landing.js's switchLang
            // reads the latest text on subsequent language switches.
            if (rec.ru) el.setAttribute('data-ru', rec.ru);
            if (rec.am) el.setAttribute('data-am', rec.am);
            // Apply visible text in current page lang.
            var text = lang === 'am' ? (rec.am || rec.ru) : (rec.ru || rec.am);
            if (text) setTextPreserveIcons(el, text);
            // Update href if element is a link and href override exists.
            if (rec.href && el.tagName === 'A') el.setAttribute('href', rec.href);
            else if (rec.href && el.closest('a')) el.closest('a').setAttribute('href', rec.href);
          });
        });
      });
  }
  function cssEsc(s) { return String(s).replace(/"/g, '\\"'); }

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
          '<button id="gtt-undo-btn" class="gtt-bar-btn" onclick="gttEditorUndo()">↩ Отменить</button>' +
          '<button class="gtt-bar-btn gtt-btn-save" onclick="gttEditorSaveAll()">💾 Сохранить всё</button>' +
        '</div>' +
        '<a href="/admin" class="gtt-bar-btn gtt-btn-admin-link">⚙ Админка</a>' +
      '</div>';
    document.body.appendChild(bar);
    document.body.classList.add('gtt-has-admin-bar');

    document.getElementById('gtt-edit-toggle').addEventListener('click', toggleEditMode);
  }

  // ─── Toggle edit mode ──────────────────────────────────────────────────────
  function toggleEditMode() {
    if (!editMode) enableEditMode();
    else disableEditMode();
  }

  function enableEditMode() {
    toast('Загрузка данных...', 'info', 1500);
    adminAPI('/site-blocks').then(function (data) {
      if (!data || !data.blocks) {
        toast('Ошибка загрузки. Проверьте авторизацию.', 'error');
        return;
      }
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
      activateButtonEditing();
      activateImageEditing();
      activateBlockManagement();
      // Phase 5.1.4: Section drag-drop disabled per user request — DOM layout
      // breaks because [data-block-key] elements aren't always direct siblings
      // (legacy landing nests them under different containers). Re-enable only
      // after we have a reliable cross-container reordering strategy.
      // activateDragDrop();

      toast('Режим редактирования включён. Кликайте на любой текст или кнопку.', 'success', 3500);
    });
  }

  function disableEditMode() {
    if (Object.keys(pendingChanges).length || Object.keys(pendingOverrides).length) {
      if (!confirm('Есть несохранённые изменения. Выйти всё равно?')) return;
    }
    editMode = false;
    document.body.classList.remove('gtt-edit-mode');
    var btn = document.getElementById('gtt-edit-toggle');
    if (btn) { btn.textContent = '✏ Режим редактирования'; btn.classList.remove('active'); }
    var actions = document.getElementById('gtt-bar-actions');
    if (actions) actions.style.display = 'none';

    deactivateTextEditing();
    deactivateButtonEditing();
    deactivateImageEditing();
    deactivateBlockManagement();
    if (sortableInstance) { try { sortableInstance.destroy(); } catch (e) {} sortableInstance = null; }
    closeAllPopups();

    toast('Режим редактирования выключен', 'info', 2000);
  }

  // ─── Text editing (Sprint 3) ───────────────────────────────────────────────
  function activateTextEditing() {
    // Every CMS-backed AND every plain data-ru/data-am element is editable.
    var els = document.querySelectorAll('[data-edit-key], [data-edit-text]');
    var activated = 0, skipped = 0, inPopup = 0;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (shouldSkip(el)) { skipped++; continue; }
      if (isInlineButton(el)) { skipped++; continue; }
      if (el.closest && el.closest('#callbackModal')) inPopup++;

      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
      el.addEventListener('focus', onTextFocus);
      el.addEventListener('input', onTextInput);
      el.addEventListener('keydown', onEditKeydown);
      el.addEventListener('click', onEditableClick);
      activated++;
    }
  }

  function deactivateTextEditing() {
    var els = document.querySelectorAll('[contenteditable="true"]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest && el.closest('#gtt-admin-bar')) continue;
      el.removeAttribute('contenteditable');
      el.removeEventListener('focus', onTextFocus);
      el.removeEventListener('input', onTextInput);
      el.removeEventListener('keydown', onEditKeydown);
      el.removeEventListener('click', onEditableClick);
    }
  }

  // Prevent <a> elements with editable content from navigating on click.
  function onEditableClick(e) {
    var a = e.target.closest && e.target.closest('a');
    if (a && (a.hasAttribute('contenteditable') || a.querySelector('[contenteditable="true"]'))) {
      e.preventDefault();
    }
  }

  function onTextFocus(e) {
    var el = e.target;
    // Push original to undo stack ONLY on first edit of this element
    var key = el.getAttribute('data-edit-key');
    var idx = parseInt(el.getAttribute('data-edit-idx') || '0', 10);
    var txtId = el.getAttribute('data-edit-text');

    if (key && blockMap[key]) {
      if (!pendingChanges[key]) {
        pendingChanges[key] = {
          id: blockMap[key].id,
          texts_ru: blockMap[key].texts_ru.slice(),
          texts_am: blockMap[key].texts_am.slice(),
          _origRu: blockMap[key].texts_ru.slice(),
          _origAm: blockMap[key].texts_am.slice()
        };
        undoStack.push({
          kind: 'cms', key: key, idx: idx,
          oldRu: blockMap[key].texts_ru[idx] || '',
          oldAm: blockMap[key].texts_am[idx] || ''
        });
      }
    } else if (txtId) {
      if (!pendingOverrides[txtId]) {
        pendingOverrides[txtId] = {
          text_ru: el.getAttribute('data-ru') || '',
          text_am: el.getAttribute('data-am') || '',
          href: '',
          _origRu: el.getAttribute('data-ru') || '',
          _origAm: el.getAttribute('data-am') || ''
        };
        undoStack.push({
          kind: 'override', txtId: txtId,
          oldRu: el.getAttribute('data-ru') || '',
          oldAm: el.getAttribute('data-am') || ''
        });
      }
    }
  }

  function onTextInput(e) {
    var el = e.target;
    var newText = (el.textContent || '').trim();
    var key = el.getAttribute('data-edit-key');
    var idx = parseInt(el.getAttribute('data-edit-idx') || '0', 10);
    var txtId = el.getAttribute('data-edit-text');

    if (key && pendingChanges[key]) {
      if (editLang === 'am') pendingChanges[key].texts_am[idx] = newText;
      else pendingChanges[key].texts_ru[idx] = newText;
    } else if (txtId && pendingOverrides[txtId]) {
      if (editLang === 'am') pendingOverrides[txtId].text_am = newText;
      else pendingOverrides[txtId].text_ru = newText;
      // Also update data-ru/am attribute live so language switch keeps the new text
      el.setAttribute(editLang === 'am' ? 'data-am' : 'data-ru', newText);
    }
    updateCounter();
  }

  function onEditKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.target.blur();
    }
  }

  // ─── Language switch (editor only — does NOT reload page) ─────────────────
  window.gttEditorSetLang = function (l) {
    if (Object.keys(pendingChanges).length || Object.keys(pendingOverrides).length) {
      if (!confirm('Есть несохранённые изменения. Сохранить перед сменой языка?')) {
        // continue without saving
      } else {
        gttEditorSaveAll();
      }
    }
    editLang = l;
    document.querySelectorAll('.gtt-lang-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === l);
    });
    // Re-render every editable element in the chosen language using
    // the latest data (pending → blockMap → DOM data-ru/am).
    var attr = l === 'am' ? 'data-am' : 'data-ru';
    document.querySelectorAll('[data-edit-key]').forEach(function (el) {
      var key = el.getAttribute('data-edit-key');
      var idx = parseInt(el.getAttribute('data-edit-idx') || '0', 10);
      var src = pendingChanges[key] || blockMap[key];
      if (!src) {
        var fallback = el.getAttribute(attr);
        if (fallback) setTextPreserveIcons(el, fallback);
        return;
      }
      var arr = l === 'am' ? src.texts_am : src.texts_ru;
      if (Array.isArray(arr) && typeof arr[idx] === 'string' && arr[idx].trim()) {
        setTextPreserveIcons(el, arr[idx]);
      } else {
        var fb = el.getAttribute(attr);
        if (fb) setTextPreserveIcons(el, fb);
      }
    });
    document.querySelectorAll('[data-edit-text]').forEach(function (el) {
      var t = el.getAttribute(attr);
      if (t) setTextPreserveIcons(el, t);
    });
    // Also call landing.js's switchLang to update non-editable elements
    // (currency/calculator/etc.) — but only DOM-level update, no reload.
    try {
      if (typeof window.switchLang === 'function') {
        // landing.js's overridden switchLang reloads on subpages — skip that.
        // Instead, replicate its DOM update part inline.
        document.querySelectorAll('[data-' + l + ']').forEach(function (el) {
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return;
          if (el.hasAttribute('data-edit-key') || el.hasAttribute('data-edit-text')) return; // already done
          var t = el.getAttribute('data-' + l);
          if (t) setTextPreserveIcons(el, t);
        });
        document.querySelectorAll('[data-placeholder-' + l + ']').forEach(function (el) {
          el.placeholder = el.getAttribute('data-placeholder-' + l) || '';
        });
        document.documentElement.lang = l === 'am' ? 'hy' : 'ru';
      }
    } catch (e) {}
    toast('Язык редактирования: ' + (l === 'am' ? 'Армянский' : 'Русский'), 'info', 1500);
  };

  // ─── Save all ──────────────────────────────────────────────────────────────
  window.gttEditorSaveAll = function () {
    var cmsKeys = Object.keys(pendingChanges);
    var ovKeys = Object.keys(pendingOverrides);
    if (cmsKeys.length === 0 && ovKeys.length === 0) {
      toast('Нет изменений для сохранения', 'info');
      return;
    }
    toast('Сохранение ' + (cmsKeys.length + ovKeys.length) + ' изменений...', 'info', 1500);

    var promises = [];

    // CMS blocks → PUT /site-blocks/:id
    cmsKeys.forEach(function (key) {
      var c = pendingChanges[key];
      promises.push(adminAPI('/site-blocks/' + c.id, {
        method: 'PUT',
        body: JSON.stringify({ texts_ru: c.texts_ru, texts_am: c.texts_am })
      }).then(function (r) { return { kind: 'cms', key: key, ok: r && r.success }; }));
    });

    // Static text overrides → POST /text-overrides/bulk
    if (ovKeys.length) {
      var items = ovKeys.map(function (txtId) {
        return {
          page: PAGE,
          txt_id: txtId,
          text_ru: pendingOverrides[txtId].text_ru || '',
          text_am: pendingOverrides[txtId].text_am || '',
          href: pendingOverrides[txtId].href || ''
        };
      });
      promises.push(adminAPI('/text-overrides/bulk', {
        method: 'POST', body: JSON.stringify({ items: items })
      }).then(function (r) { return { kind: 'overrides', ok: r && r.success, saved: r && r.saved }; }));
    }

    Promise.all(promises).then(function (results) {
      var savedCms = 0, savedOv = 0, errors = 0;
      results.forEach(function (r) {
        if (r.kind === 'cms') {
          if (r.ok) {
            savedCms++;
            if (blockMap[r.key]) {
              blockMap[r.key].texts_ru = pendingChanges[r.key].texts_ru;
              blockMap[r.key].texts_am = pendingChanges[r.key].texts_am;
            }
            delete pendingChanges[r.key];
          } else { errors++; }
        } else if (r.kind === 'overrides') {
          if (r.ok) {
            savedOv = r.saved || ovKeys.length;
            pendingOverrides = {};
          } else { errors++; }
        }
      });
      updateCounter();
      var totalSaved = savedCms + savedOv;
      // Purge edge cache so the next page reload paints the *new* text in SSR
      // (otherwise the cached HTML keeps showing the old version for up to 10
      // min before JS overlays the fresh override — exactly the "show old then
      // new after refresh" bug the editor is meant to avoid).
      if (errors === 0 && totalSaved > 0) {
        try {
          adminAPI('/purge-cache', { method: 'POST', body: '{}' })
            .then(function () { toast('✓ Сохранено ' + totalSaved + ' изменений! Кеш сброшен.', 'success', 4000); })
            .catch(function () { toast('✓ Сохранено ' + totalSaved + ' изменений (кеш не сброшен).', 'success', 4000); });
        } catch (_e) {
          toast('✓ Сохранено ' + totalSaved + ' изменений!', 'success', 4000);
        }
      } else if (errors === 0) {
        toast('✓ Сохранено ' + totalSaved + ' изменений! Кеш сброшен.', 'success', 4000);
      } else {
        toast(totalSaved + ' сохранено, ' + errors + ' ошибок', 'error', 4000);
      }
    });
  };

  // ─── Undo ──────────────────────────────────────────────────────────────────
  window.gttEditorUndo = function () {
    if (undoStack.length === 0) {
      toast('Нечего отменять', 'info');
      return;
    }
    var last = undoStack.pop();
    if (last.kind === 'cms') {
      var el = document.querySelector('[data-edit-key="' + cssEsc(last.key) + '"][data-edit-idx="' + last.idx + '"]');
      if (el) {
        var t = editLang === 'am' ? last.oldAm : last.oldRu;
        setTextPreserveIcons(el, t);
      }
      // Update pendingChanges to reflect the revert (will save the original on next save)
      if (pendingChanges[last.key]) {
        pendingChanges[last.key].texts_ru[last.idx] = last.oldRu;
        pendingChanges[last.key].texts_am[last.idx] = last.oldAm;
      } else {
        // Need to add an entry so the revert actually saves
        if (blockMap[last.key]) {
          pendingChanges[last.key] = {
            id: blockMap[last.key].id,
            texts_ru: blockMap[last.key].texts_ru.slice(),
            texts_am: blockMap[last.key].texts_am.slice()
          };
          pendingChanges[last.key].texts_ru[last.idx] = last.oldRu;
          pendingChanges[last.key].texts_am[last.idx] = last.oldAm;
        }
      }
    } else if (last.kind === 'override') {
      var el2 = document.querySelector('[data-edit-text="' + cssEsc(last.txtId) + '"]');
      if (el2) {
        if (last.oldRu) el2.setAttribute('data-ru', last.oldRu);
        if (last.oldAm) el2.setAttribute('data-am', last.oldAm);
        var t2 = editLang === 'am' ? last.oldAm : last.oldRu;
        if (t2) setTextPreserveIcons(el2, t2);
      }
      if (!pendingOverrides[last.txtId]) {
        pendingOverrides[last.txtId] = { text_ru: '', text_am: '', href: '' };
      }
      pendingOverrides[last.txtId].text_ru = last.oldRu;
      pendingOverrides[last.txtId].text_am = last.oldAm;
    } else if (last.kind === 'href') {
      var el3 = document.querySelector('[data-edit-text="' + cssEsc(last.txtId) + '"]');
      if (el3 && last.oldHref !== undefined) {
        var aEl = el3.tagName === 'A' ? el3 : el3.closest('a');
        if (aEl) aEl.setAttribute('href', last.oldHref);
      }
      if (pendingOverrides[last.txtId]) {
        pendingOverrides[last.txtId].href = last.oldHref;
      }
    }
    updateCounter();
    toast('Отменено (' + undoStack.length + ' осталось)', 'info', 1500);
  };

  // ─── Block management (Sprint 5) ──────────────────────────────────────────
  function activateBlockManagement() {
    var blocks = document.querySelectorAll('[data-block-key]');
    for (var i = 0; i < blocks.length; i++) {
      var el = blocks[i];
      var key = el.getAttribute('data-block-key');
      var block = blockMap[key];
      // Phase 5.1.4: Only render a toolbar when the block has a DB-backed id
      // (visibility/duplicate/delete actions). For SSR-only sections the
      // toolbar would be visual noise without any usable controls, since
      // drag-drop is disabled until cross-container reordering is reliable.
      if (!block || !block.id) continue;

      var pos = window.getComputedStyle(el).position;
      if (pos === 'static') el.style.position = 'relative';

      var toolbar = document.createElement('div');
      toolbar.className = 'gtt-block-toolbar';
      toolbar.setAttribute('data-toolbar-for', key);
      toolbar.setAttribute('contenteditable', 'false');

      el.setAttribute('data-block-id', block.id);
      toolbar.innerHTML =
        '<span class="gtt-block-label">' + key + '</span>' +
        '<button class="gtt-block-btn" title="Скрыть/Показать блок" onclick="gttEditorToggleVisible(\'' + key + '\',' + block.id + ',' + block.is_visible + ')">👁</button>' +
        '<button class="gtt-block-btn" title="Дублировать блок" onclick="gttEditorDuplicate(' + block.id + ')">⧉</button>' +
        '<button class="gtt-block-btn gtt-btn-danger" title="Удалить блок" onclick="gttEditorDelete(\'' + key + '\',' + block.id + ')">🗑</button>';
      el.insertBefore(toolbar, el.firstChild);
    }
    addInsertButtons();
  }

  function deactivateBlockManagement() {
    document.querySelectorAll('.gtt-block-toolbar').forEach(function (t) {
      t.parentNode && t.parentNode.removeChild(t);
    });
    document.querySelectorAll('.gtt-insert-btn-wrap').forEach(function (t) {
      t.parentNode && t.parentNode.removeChild(t);
    });
    document.querySelectorAll('[data-block-key]').forEach(function (el) {
      if (el.style.position === 'relative') el.style.position = '';
    });
  }

  function addInsertButtons() {
    var blocks = document.querySelectorAll('[data-block-key]');
    blocks.forEach(function (block) {
      var key = block.getAttribute('data-block-key');
      var wrap = document.createElement('div');
      wrap.className = 'gtt-insert-btn-wrap';
      wrap.setAttribute('contenteditable', 'false');
      wrap.innerHTML = '<button class="gtt-insert-btn" onclick="gttEditorShowAddMenu(\'' + key + '\')">+ Добавить блок здесь</button>';
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
        toast(newVisible ? '✓ Блок показан' : '✓ Блок скрыт. Обновите страницу.', 'success', 4000);
        var el = document.querySelector('[data-block-key="' + cssEsc(key) + '"]');
        if (el) el.style.opacity = newVisible ? '' : '0.4';
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
        var el = document.querySelector('[data-block-key="' + cssEsc(key) + '"]');
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
  window.gttEditorShowAddMenu = function (afterBlockKey) {
    closeAllPopups();
    var templates = [
      {
        label: '📣 Баннер с заголовком и текстом',
        title_ru: 'Заголовок баннера', title_am: 'Բաններ վերնագիր',
        text_ru: 'Текст баннера. Расскажите о вашем предложении.',
        text_am: 'Բանների տեքստ։',
        button_text_ru: 'Узнать подробнее', button_text_am: 'Իմանալ ավելին',
        button_url: 'https://t.me/goo_to_top'
      },
      {
        label: '⭐ Блок с преимуществами',
        title_ru: 'Наши преимущества', title_am: 'Մեր առավելությունները',
        text_ru: 'Опишите ключевые преимущества вашего сервиса.',
        text_am: 'Նկարագրեք ձեր ծառայության հիմնական առավելությունները։',
        button_text_ru: 'Заказать', button_text_am: 'Պատվիրել',
        button_url: 'https://t.me/goo_to_top'
      },
      {
        label: '📢 CTA-полоска (призыв к действию)',
        title_ru: 'Готовы начать?', title_am: 'Պատրա՞ստ եք սկսել',
        text_ru: 'Свяжитесь с нами и получите консультацию бесплатно.',
        text_am: 'Կապ հաստատեք մեզ հետ և ստացեք անվճար խորհրդատվություն։',
        button_text_ru: 'Связаться', button_text_am: 'Կապ հաստատել',
        button_url: 'https://t.me/goo_to_top'
      },
      {
        label: '📦 Пустой блок (заполните сами)',
        title_ru: 'Заголовок', title_am: 'Վերնագիր',
        text_ru: 'Текст блока...', text_am: 'Բլոկի տեքստ...',
        button_text_ru: '', button_text_am: '', button_url: ''
      }
    ];

    var menu = document.createElement('div');
    menu.id = 'gtt-add-menu';
    menu.className = 'gtt-add-menu';
    menu.innerHTML =
      '<div class="gtt-add-menu-header">' +
        '<span>Добавить блок после "' + afterBlockKey + '"</span>' +
        '<button onclick="gttEditorClosePopups()">&times;</button>' +
      '</div>' +
      '<div class="gtt-add-menu-list" id="gtt-add-menu-list"></div>';
    document.body.appendChild(menu);

    var list = document.getElementById('gtt-add-menu-list');
    templates.forEach(function (tpl, idx) {
      var btn = document.createElement('button');
      btn.className = 'gtt-add-menu-item';
      btn.textContent = tpl.label;
      btn.addEventListener('click', function () {
        gttEditorAddBlock(afterBlockKey, tpl);
      });
      list.appendChild(btn);
    });
  };

  function gttEditorAddBlock(afterBlockKey, tpl) {
    closeAllPopups();
    var payload = {
      page: PAGE,
      position_after: afterBlockKey,
      title_ru: tpl.title_ru,
      title_am: tpl.title_am,
      text_ru: tpl.text_ru,
      text_am: tpl.text_am,
      button_text_ru: tpl.button_text_ru,
      button_text_am: tpl.button_text_am,
      button_url: tpl.button_url,
      is_visible: 1,
      sort_order: Date.now() % 100000
    };
    var token = getToken();
    fetch(API_BASE + '/custom-blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(payload)
    }).then(function (resp) {
      return resp.json().catch(function() { return null; });
    }).then(function (r) {
      if (r && r.success) {
        toast('✓ Блок создан! Перезагружаем страницу...', 'success', 2000);
        setTimeout(function () { window.location.reload(); }, 1500);
      } else {
        toast('Ошибка создания блока: ' + JSON.stringify(r || 'no response'), 'error', 5000);
      }
    }).catch(function (err) {
      toast('Сетевая ошибка: ' + String(err), 'error', 5000);
    });
  }

  // ─── Drag & Drop (Sprint 4) ────────────────────────────────────────────────
  function activateDragDrop() {
    if (typeof Sortable !== 'undefined') {
      initSortable();
    } else {
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js';
      script.onload = initSortable;
      script.onerror = function () { toast('Не удалось загрузить SortableJS', 'error'); };
      document.head.appendChild(script);
    }
  }

  // Special txt_id for storing the block order map for the current page.
  // Uses the existing site_text_overrides infrastructure (no new schema)
  // so the legacy landing AND new pages can persist drag-drop order with
  // the same code path.
  function ORDER_TXT_ID() { return '__order__' + PAGE; }

  function initSortable() {
    // Sort blocks where they actually live in the DOM. For new home page
    // the blocks are direct children of `<main>`. Find the parent of any
    // [data-block-key] element and use it as the Sortable container.
    var firstBlock = document.querySelector('[data-block-key]');
    if (!firstBlock || !firstBlock.parentNode) return;
    var container = firstBlock.parentNode;

    try {
      sortableInstance = new Sortable(container, {
        draggable: '[data-block-key]',
        handle: '.gtt-drag-handle',
        animation: 200,
        ghostClass: 'gtt-drag-ghost',
        chosenClass: 'gtt-drag-chosen',
        forceFallback: true,                  // helps on touch devices
        fallbackOnBody: true,
        onEnd: function (evt) {
          // 1) For DB-backed blocks, save sort_order via /site-blocks/reorder
          var items = container.querySelectorAll('[data-block-id]');
          var orders = [];
          for (var i = 0; i < items.length; i++) {
            var bid = parseInt(items[i].getAttribute('data-block-id') || '0', 10);
            if (bid) orders.push({ id: bid, sort_order: (i + 1) * 10 });
          }
          // 2) ALWAYS save the visible block-key sequence as an override —
          //    works for both DB blocks and SSR-only sections (the common case).
          var keyOrder = [];
          var allBlocks = container.querySelectorAll('[data-block-key]');
          for (var j = 0; j < allBlocks.length; j++) {
            var k = allBlocks[j].getAttribute('data-block-key');
            if (k) keyOrder.push(k);
          }
          var orderTxtId = ORDER_TXT_ID();
          var promises = [];
          if (orders.length) {
            promises.push(adminAPI('/site-blocks/reorder', {
              method: 'POST', body: JSON.stringify({ orders: orders })
            }));
          }
          promises.push(adminAPI('/text-overrides', {
            method: 'PUT',
            body: JSON.stringify({
              page: PAGE,
              txt_id: orderTxtId,
              text_ru: JSON.stringify(keyOrder),
              text_am: '',
              href: ''
            })
          }));
          Promise.all(promises).then(function (results) {
            var anyOk = results.some(function (r) { return r && r.success; });
            if (anyOk) toast('✓ Порядок блоков сохранён', 'success');
            else toast('Ошибка сохранения порядка', 'error');
          });
        }
      });
    } catch (e) {
      console.warn('GTT Editor: Could not init SortableJS', e);
    }
  }

  // Apply previously-saved block order to DOM on page load. Runs for ALL
  // visitors (not just admins) so the order persists for everyone.
  function applyBlockOrderFromOverrides(overrides) {
    if (!overrides) return;
    var rec = overrides[ORDER_TXT_ID()];
    if (!rec || !rec.ru) return;
    var keyOrder;
    try { keyOrder = JSON.parse(rec.ru); } catch (e) { return; }
    if (!Array.isArray(keyOrder) || keyOrder.length === 0) return;

    var firstBlock = document.querySelector('[data-block-key]');
    if (!firstBlock || !firstBlock.parentNode) return;
    var container = firstBlock.parentNode;

    // Move each block to the requested order. Skip keys that don't exist
    // in DOM (e.g. visibility-hidden blocks). Append in given sequence.
    keyOrder.forEach(function (key) {
      var el = container.querySelector('[data-block-key="' + cssEsc(key) + '"]');
      if (el) container.appendChild(el);
    });
  }

  // ─── Image editing (Phase 5.1.2) ───────────────────────────────────────────
  function activateImageEditing() {
    var imgs = document.querySelectorAll('img[data-edit-img]');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (shouldSkip(img)) continue;
      if (img.closest && img.closest('#gtt-admin-bar')) continue;
      var parent = img.parentElement;
      if (!parent || parent.querySelector('.gtt-img-edit-overlay[data-for="' + img.getAttribute('data-edit-img') + '"]')) continue;

      var pos = window.getComputedStyle(parent).position;
      if (pos === 'static') parent.style.position = 'relative';
      var overlay = document.createElement('button');
      overlay.type = 'button';
      overlay.className = 'gtt-img-edit-overlay';
      overlay.setAttribute('contenteditable', 'false');
      overlay.setAttribute('data-for', img.getAttribute('data-edit-img'));
      overlay.title = 'Заменить изображение';
      overlay.innerHTML = '📷 Заменить';
      overlay.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var btn = e.currentTarget;
        var imgId = btn.getAttribute('data-for');
        var targetImg = document.querySelector('img[data-edit-img="' + cssEsc(imgId) + '"]');
        if (!targetImg) return;
        openImageReplaceDialog(targetImg);
      });
      parent.appendChild(overlay);
    }
  }

  function deactivateImageEditing() {
    document.querySelectorAll('.gtt-img-edit-overlay').forEach(function (o) {
      o.parentNode && o.parentNode.removeChild(o);
    });
  }

  function openImageReplaceDialog(targetImg) {
    var imgId = targetImg.getAttribute('data-edit-img');
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) { document.body.removeChild(input); return; }
      var fd = new FormData();
      fd.append('file', file);
      var token = getToken();
      toast('Загружаю изображение…', 'info', 2000);
      fetch(API_BASE + '/upload-image', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: fd
      }).then(function (r) { return r.json().catch(function() { return null; }); })
        .then(function (resp) {
          if (!resp || !resp.success) {
            toast('Ошибка загрузки изображения', 'error', 4000);
            return;
          }
          var newSrc = resp.url || resp.data_url;
          if (!newSrc) { toast('Не удалось получить URL', 'error', 4000); return; }
          // Apply immediately
          targetImg.setAttribute('src', newSrc);
          // Save as override (using href column for image src)
          pendingOverrides[imgId] = pendingOverrides[imgId] || { text_ru: '', text_am: '', href: '' };
          pendingOverrides[imgId].href = newSrc;
          undoStack.push({ kind: 'override', txtId: imgId, oldRu: '', oldAm: '' });
          updateCounter();
          toast('✓ Изображение заменено. Нажмите «Сохранить всё».', 'success', 3500);
        })
        .catch(function (err) {
          toast('Сетевая ошибка: ' + String(err), 'error', 4000);
        })
        .finally(function () {
          if (input.parentNode) input.parentNode.removeChild(input);
        });
    });
    input.click();
  }

  // ─── Button/Link editing (Sprint 6) ────────────────────────────────────────
  function isInlineButton(el) {
    if (!el) return false;
    // Treat ANY <a href> or <button> as an inline button so the contenteditable
    // text-edit handler skips it and the button-pen handler picks it up instead.
    if (el.tagName === 'A' && el.hasAttribute('href')) return true;
    if (el.tagName === 'BUTTON') return true;
    return false;
  }

  // Heuristic: skip language switchers and links that are pure icon containers
  // (no visible text). Edits to those don't make sense.
  function buttonShouldHaveEditPen(el) {
    if (!el) return false;
    if (el.id === 'lang-toggle' || (el.classList && el.classList.contains('lang-toggle'))) return false;
    if (el.closest && el.closest('#gtt-admin-bar')) return false;
    var txt = (el.textContent || '').trim();
    // Allow even icon-only buttons IF they have data-ru or aria-label, otherwise skip
    if (!txt && !el.hasAttribute('data-ru') && !el.hasAttribute('aria-label')) return false;
    return true;
  }

  function activateButtonEditing() {
    // Edit pen-icon overlays for EVERY link/button (universal coverage),
    // excluding only the language switcher and admin-bar internals.
    var btns = document.querySelectorAll('a[href], button');
    for (var i = 0; i < btns.length; i++) {
      var el = btns[i];
      if (shouldSkip(el)) continue;
      if (!buttonShouldHaveEditPen(el)) continue;
      if (el.querySelector('.gtt-btn-edit-pen')) continue;
      var pen = document.createElement('span');
      pen.className = 'gtt-btn-edit-pen';
      pen.setAttribute('contenteditable', 'false');
      pen.title = 'Изменить кнопку и ссылку';
      pen.textContent = '✎';
      pen.addEventListener('click', onButtonPenClick);
      var pos = window.getComputedStyle(el).position;
      if (pos === 'static') el.style.position = 'relative';
      el.appendChild(pen);
      // Suppress nav on click in edit mode
      el.addEventListener('click', onButtonClickInEditMode, true);
    }
  }

  function deactivateButtonEditing() {
    document.querySelectorAll('.gtt-btn-edit-pen').forEach(function (p) {
      var parent = p.parentNode;
      if (parent) parent.removeChild(p);
    });
    document.querySelectorAll('a.btn, a.nav-cta, a.btn-primary, a.btn-outline, a.btn-tg, a.tg-float, a.calc-float, button.btn, button.nav-cta').forEach(function (el) {
      el.removeEventListener('click', onButtonClickInEditMode, true);
    });
  }

  function onButtonClickInEditMode(e) {
    if (!editMode) return;
    // Don't suppress clicks on pen icon
    if (e.target.classList && e.target.classList.contains('gtt-btn-edit-pen')) return;
    // Don't suppress clicks on edit popup itself
    if (e.target.closest && e.target.closest('.gtt-btn-popup')) return;
    e.preventDefault();
    e.stopPropagation();
    // Auto-open the button popup so user gets the editor immediately
    showButtonPopup(e.currentTarget);
  }

  function onButtonPenClick(e) {
    e.preventDefault();
    e.stopPropagation();
    var el = e.currentTarget.parentElement;
    if (el) showButtonPopup(el);
  }

  function showButtonPopup(el) {
    closeAllPopups();
    var href = el.getAttribute('href') || '';
    var text = getTextOnly(el);

    // Find the inner span that holds bilingual data, if any
    var inner = el.querySelector('[data-ru], [data-am]') || el;
    var dataRu = inner.getAttribute('data-ru') || text;
    var dataAm = inner.getAttribute('data-am') || text;
    var txtId = inner.getAttribute('data-edit-text') || el.getAttribute('data-edit-text') || '';
    var editKey = inner.getAttribute('data-edit-key') || el.getAttribute('data-edit-key') || '';
    var editIdx = inner.getAttribute('data-edit-idx') || el.getAttribute('data-edit-idx') || '0';

    // Phase 5.1.3: If the link wraps an <img> (e.g. QR codes, photo cards),
    // expose a "Заменить фото" button so user can replace the image without
    // hunting for a hover-overlay (which the popup intercepts on click).
    var innerImg = el.querySelector('img');
    var imgEditId = innerImg ? innerImg.getAttribute('data-edit-img') : '';
    var imgBtnHtml = '';
    if (innerImg) {
      imgBtnHtml = '<button class="gtt-bar-btn gtt-btn-img-replace" onclick="gttEditorReplaceLinkedImage(\'' +
                   escAttr(imgEditId || '') + '\')">📷 Заменить фото</button>';
    }

    var popup = document.createElement('div');
    popup.id = 'gtt-btn-popup';
    popup.className = 'gtt-btn-popup';
    popup.setAttribute('contenteditable', 'false');
    var rect = el.getBoundingClientRect();
    popup.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    popup.style.left = Math.max(8, Math.min(window.innerWidth - 320, rect.left + window.scrollX)) + 'px';

    popup.innerHTML =
      '<div class="gtt-btn-popup-header">' +
        '<span>Кнопка / Ссылка' + (innerImg ? ' / Фото' : '') + '</span>' +
        '<button onclick="gttEditorClosePopups()">&times;</button>' +
      '</div>' +
      '<div class="gtt-btn-popup-body">' +
        '<label>Текст RU</label>' +
        '<input id="gtt-btn-text-ru" type="text" value="' + escAttr(dataRu) + '">' +
        '<label>Текст AM</label>' +
        '<input id="gtt-btn-text-am" type="text" value="' + escAttr(dataAm) + '">' +
        '<label>Ссылка (URL)</label>' +
        '<input id="gtt-btn-href" type="text" value="' + escAttr(href) + '" placeholder="https://...">' +
        '<input id="gtt-btn-meta-key" type="hidden" value="' + escAttr(editKey) + '">' +
        '<input id="gtt-btn-meta-idx" type="hidden" value="' + escAttr(editIdx) + '">' +
        '<input id="gtt-btn-meta-txt" type="hidden" value="' + escAttr(txtId) + '">' +
        (imgBtnHtml ? '<div style="margin-top:8px">' + imgBtnHtml + '</div>' : '') +
        '<div class="gtt-btn-popup-actions">' +
          '<button class="gtt-bar-btn gtt-btn-save" onclick="gttEditorSaveButton()">💾 Сохранить кнопку</button>' +
          '<button class="gtt-bar-btn" onclick="gttEditorClosePopups()">Отмена</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(popup);
    document.getElementById('gtt-btn-text-ru').focus();
  }

  // Public: invoked from the popup "Заменить фото" button. Looks up the <img>
  // by its data-edit-img id and triggers the same upload flow as the corner overlay.
  window.gttEditorReplaceLinkedImage = function (imgId) {
    if (!imgId) {
      // Fallback: find the img inside the currently open link (popup target)
      var popup = document.getElementById('gtt-btn-popup');
      if (!popup) return;
      var anchor = document.querySelector('.gtt-btn-edit-pen');
      if (!anchor) return;
      var link = anchor.parentElement;
      var img = link && link.querySelector('img');
      if (!img) { toast('Картинка не найдена', 'error'); return; }
      imgId = img.getAttribute('data-edit-img');
    }
    var targetImg = document.querySelector('img[data-edit-img="' + cssEsc(imgId) + '"]');
    if (!targetImg) { toast('Картинка не найдена', 'error'); return; }
    openImageReplaceDialog(targetImg);
  };

  window.gttEditorSaveButton = function () {
    var ru = (document.getElementById('gtt-btn-text-ru') || {}).value || '';
    var am = (document.getElementById('gtt-btn-text-am') || {}).value || '';
    var href = (document.getElementById('gtt-btn-href') || {}).value || '';
    var editKey = (document.getElementById('gtt-btn-meta-key') || {}).value || '';
    var editIdx = parseInt((document.getElementById('gtt-btn-meta-idx') || {}).value || '0', 10);
    var txtId = (document.getElementById('gtt-btn-meta-txt') || {}).value || '';

    // Find target element on page (where text lives)
    var target = null;
    if (editKey) target = document.querySelector('[data-edit-key="' + cssEsc(editKey) + '"][data-edit-idx="' + editIdx + '"]');
    else if (txtId) target = document.querySelector('[data-edit-text="' + cssEsc(txtId) + '"]');

    // Fallback: nothing to save against — but we still want to update href on the link.
    // Find the link by walking up.
    var link = null;
    if (target) link = target.tagName === 'A' ? target : target.closest('a');

    // Apply text in DOM & update data attributes
    if (target) {
      target.setAttribute('data-ru', ru);
      target.setAttribute('data-am', am);
      var displayText = editLang === 'am' ? (am || ru) : (ru || am);
      setTextPreserveIcons(target, displayText);
    }
    if (link) link.setAttribute('href', href);

    // Save: CMS path or override path
    if (editKey && blockMap[editKey]) {
      if (!pendingChanges[editKey]) {
        pendingChanges[editKey] = {
          id: blockMap[editKey].id,
          texts_ru: blockMap[editKey].texts_ru.slice(),
          texts_am: blockMap[editKey].texts_am.slice()
        };
      }
      pendingChanges[editKey].texts_ru[editIdx] = ru;
      pendingChanges[editKey].texts_am[editIdx] = am;
      undoStack.push({ kind: 'cms', key: editKey, idx: editIdx,
        oldRu: blockMap[editKey].texts_ru[editIdx] || '',
        oldAm: blockMap[editKey].texts_am[editIdx] || '' });
    }
    if (txtId || (link && !editKey)) {
      // Need a stable txtId for this button — if missing, generate one for the link itself.
      if (!txtId && link) {
        if (!link.getAttribute('data-edit-text')) {
          var maxN = document.querySelectorAll('[data-edit-text]').length;
          link.setAttribute('data-edit-text', PAGE + '__btn_' + maxN);
        }
        txtId = link.getAttribute('data-edit-text');
      }
      if (txtId) {
        pendingOverrides[txtId] = pendingOverrides[txtId] || { text_ru: '', text_am: '', href: '' };
        pendingOverrides[txtId].text_ru = ru;
        pendingOverrides[txtId].text_am = am;
        pendingOverrides[txtId].href = href;
        undoStack.push({ kind: 'override', txtId: txtId,
          oldRu: pendingOverrides[txtId]._origRu || ru,
          oldAm: pendingOverrides[txtId]._origAm || am });
      }
    }
    updateCounter();
    closeAllPopups();
    toast('✓ Кнопка обновлена. Нажмите «Сохранить всё».', 'success', 3500);
  };

  // ─── Misc ──────────────────────────────────────────────────────────────────
  window.gttEditorClosePopups = closeAllPopups;
  function closeAllPopups() {
    ['gtt-add-menu', 'gtt-btn-popup'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function updateCounter() {
    var count = Object.keys(pendingChanges).length + Object.keys(pendingOverrides).length;
    var counter = document.getElementById('gtt-changes-counter');
    if (!counter) return;
    if (count > 0) {
      var label = count === 1 ? '1 изменение' : count + ' изменений';
      counter.textContent = label;
      counter.style.display = 'inline-flex';
    } else {
      counter.style.display = 'none';
    }
  }

  function escAttr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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
      '.gtt-bar-left{display:flex;align-items:center;gap:8px;flex:1;min-width:0}',
      '.gtt-bar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.gtt-bar-logo{font-weight:800;color:#a78bfa;font-size:0.82rem;letter-spacing:0.5px;white-space:nowrap}',
      '.gtt-bar-btn{padding:5px 12px;border-radius:6px;border:1px solid rgba(139,92,246,0.4);background:rgba(139,92,246,0.15);color:#f5f3ff;font-size:0.75rem;font-weight:600;cursor:pointer;transition:all 0.2s;text-decoration:none;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-family:inherit}',
      '.gtt-bar-btn:hover{background:rgba(139,92,246,0.3);transform:translateY(-1px)}',
      '.gtt-bar-btn.active{background:rgba(239,68,68,0.2);border-color:rgba(239,68,68,0.5);color:#fca5a5}',
      '.gtt-btn-save{background:linear-gradient(135deg,#8b5cf6,#6d28d9);border-color:transparent!important}',
      '.gtt-btn-save:hover{box-shadow:0 4px 12px rgba(139,92,246,0.5)}',
      '.gtt-btn-admin-link{background:rgba(255,255,255,0.06)}',
      /* Lang toggle (editor) */
      '.gtt-lang-toggle{display:flex;border:1px solid rgba(139,92,246,0.3);border-radius:6px;overflow:hidden}',
      '.gtt-lang-btn{padding:4px 10px;font-size:0.72rem;font-weight:700;cursor:pointer;background:transparent;border:none;color:#a5a0b8;transition:all 0.15s;font-family:inherit}',
      '.gtt-lang-btn.active{background:#8b5cf6;color:white}',
      /* Counter */
      '.gtt-counter{font-size:0.72rem;color:#fbbf24;font-weight:700;padding:4px 8px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:5px}',
      /* Toast */
      '.gtt-toast{position:fixed;bottom:72px;right:16px;z-index:1000001;padding:10px 16px;border-radius:8px;font-size:0.82rem;font-weight:600;color:white;pointer-events:none;box-shadow:0 4px 20px rgba(0,0,0,0.4);animation:gttSlideIn 0.3s ease;max-width:340px}',
      '.gtt-toast-success{background:#059669}',
      '.gtt-toast-error{background:#dc2626}',
      '.gtt-toast-info{background:#4b5563}',
      '@keyframes gttSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}',
      /* Edit-mode highlights */
      'body.gtt-edit-mode [data-edit-key],body.gtt-edit-mode [data-edit-text]{outline:1px dashed rgba(139,92,246,0.45);outline-offset:2px;cursor:text;transition:outline 0.15s,background 0.15s;border-radius:2px}',
      'body.gtt-edit-mode [data-edit-key]:hover,body.gtt-edit-mode [data-edit-text]:hover{outline:2px solid #8b5cf6;background:rgba(139,92,246,0.08)}',
      'body.gtt-edit-mode [contenteditable="true"]:focus{outline:2px solid #a78bfa!important;background:rgba(139,92,246,0.12);caret-color:#a78bfa}',
      /* Block toolbars */
      '.gtt-block-toolbar{position:absolute;top:0;left:0;right:0;z-index:500;display:flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(15,10,26,0.92);border-bottom:1px solid rgba(139,92,246,0.35);backdrop-filter:blur(12px);opacity:0;transition:opacity 0.2s;pointer-events:none}',
      'body.gtt-edit-mode [data-block-key]>.gtt-block-toolbar{opacity:0.55;pointer-events:auto}',
      'body.gtt-edit-mode [data-block-key]:hover>.gtt-block-toolbar,body.gtt-edit-mode [data-block-key]>.gtt-block-toolbar:hover{opacity:1}',
      '.gtt-drag-handle{cursor:grab;font-size:1rem;color:#8b5cf6;user-select:none;padding:0 4px}',
      '.gtt-drag-handle:active{cursor:grabbing}',
      '.gtt-block-label{font-size:0.65rem;color:#9ca3af;flex:1;font-family:monospace}',
      '.gtt-block-btn{padding:3px 8px;border-radius:4px;border:1px solid rgba(139,92,246,0.3);background:rgba(139,92,246,0.12);color:#f5f3ff;font-size:0.7rem;cursor:pointer;transition:background 0.15s;font-family:inherit}',
      '.gtt-block-btn:hover{background:rgba(139,92,246,0.25)}',
      '.gtt-btn-danger{border-color:rgba(239,68,68,0.35)!important;background:rgba(239,68,68,0.1)!important}',
      '.gtt-btn-danger:hover{background:rgba(239,68,68,0.25)!important}',
      /* Insert block buttons */
      '.gtt-insert-btn-wrap{display:none;text-align:center;padding:6px 0;position:relative;z-index:1}',
      'body.gtt-edit-mode .gtt-insert-btn-wrap{display:block}',
      '.gtt-insert-btn{padding:5px 18px;border-radius:20px;border:1px dashed rgba(139,92,246,0.45);background:rgba(139,92,246,0.06);color:#a78bfa;font-size:0.75rem;cursor:pointer;transition:all 0.2s;font-family:inherit}',
      '.gtt-insert-btn:hover{background:rgba(139,92,246,0.15);border-style:solid}',
      /* Drag */
      '.gtt-drag-ghost{opacity:0.5;background:rgba(139,92,246,0.15)!important}',
      '.gtt-drag-chosen{outline:2px solid #8b5cf6!important}',
      /* Add block menu */
      '.gtt-add-menu{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000010;background:linear-gradient(145deg,#1a1128,#2d1f50);border:1px solid rgba(139,92,246,0.5);border-radius:14px;padding:0;min-width:300px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.5)}',
      '.gtt-add-menu-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(139,92,246,0.2);font-size:0.88rem;font-weight:700;color:#f5f3ff}',
      '.gtt-add-menu-header button{background:none;border:none;color:#a5a0b8;font-size:1.2rem;cursor:pointer;line-height:1;font-family:inherit}',
      '.gtt-add-menu-list{padding:10px}',
      '.gtt-add-menu-item{display:block;width:100%;padding:10px 14px;border-radius:8px;border:none;background:transparent;color:#f5f3ff;font-size:0.85rem;cursor:pointer;text-align:left;transition:background 0.15s;font-family:inherit;margin-bottom:4px}',
      '.gtt-add-menu-item:hover{background:rgba(139,92,246,0.2)}',
      /* Button popup */
      '.gtt-btn-popup{position:absolute;z-index:1000011;background:linear-gradient(145deg,#1a1128,#2d1f50);border:1px solid rgba(139,92,246,0.5);border-radius:12px;min-width:300px;max-width:90vw;box-shadow:0 12px 40px rgba(0,0,0,0.5)}',
      '.gtt-btn-popup-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(139,92,246,0.2);font-size:0.82rem;font-weight:700;color:#f5f3ff}',
      '.gtt-btn-popup-header button{background:none;border:none;color:#a5a0b8;font-size:1.1rem;cursor:pointer;line-height:1;font-family:inherit}',
      '.gtt-btn-popup-body{padding:12px 14px}',
      '.gtt-btn-popup-body label{display:block;font-size:0.72rem;font-weight:600;color:#a78bfa;margin-bottom:4px;margin-top:10px}',
      '.gtt-btn-popup-body label:first-child{margin-top:0}',
      '.gtt-btn-popup-body input{width:100%;padding:8px 10px;background:rgba(15,10,26,0.6);border:1px solid rgba(139,92,246,0.3);border-radius:7px;color:#f5f3ff;font-size:0.82rem;font-family:inherit;box-sizing:border-box}',
      '.gtt-btn-popup-body input:focus{outline:none;border-color:#8b5cf6}',
      '.gtt-btn-popup-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}',
      /* Pen overlay on buttons */
      '.gtt-btn-edit-pen{display:none;position:absolute;top:-8px;right:-8px;z-index:30;width:24px;height:24px;border-radius:50%;background:#8b5cf6;color:white;font-size:0.7rem;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(139,92,246,0.5);user-select:none;pointer-events:auto;font-style:normal;line-height:1}',
      'body.gtt-edit-mode .gtt-btn-edit-pen{display:flex}',
      '.gtt-btn-edit-pen:hover{background:#a78bfa;transform:scale(1.1)}',
      '.gtt-img-edit-overlay{position:absolute;top:8px;right:8px;z-index:40;padding:6px 10px;border:none;border-radius:8px;background:rgba(15,10,26,0.85);color:#fff;font-size:0.78rem;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.4);backdrop-filter:blur(8px);user-select:none}',
      '.gtt-img-edit-overlay:hover{background:#8b5cf6}',
      /* Body padding to account for fixed admin bar */
      'body.gtt-has-admin-bar{padding-bottom:max(56px,calc(56px + env(safe-area-inset-bottom)))!important}',
      '@media(max-width:900px){body.gtt-has-admin-bar{padding-bottom:max(128px,calc(128px + env(safe-area-inset-bottom)))!important}.gtt-bar-logo{display:none}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init() {
    // 1. Always assign stable ids to all data-ru/data-am elements + <img> tags
    //    (even for guests, so override application is consistent across reloads).
    assignTextIds();
    assignImageIds();

    // 2. Always apply server-side text overrides (for guests AND admins)
    applyOverridesFromServer();

    // 3. Show admin bar only if logged in
    if (getToken()) {
      createAdminBar();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
