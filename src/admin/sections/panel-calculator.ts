/**
 * Admin Panel — Calculator tabs, services, packages
 * 796 lines of admin SPA JS code
 */
export const CODE: string = `
// ===== CALCULATOR =====
// Fast reload: only fetch calc tabs, services, packages (skip leads, users, expenses etc.)
async function reloadCalcData() {
  var [tabs, services, pkgs] = await Promise.all([
    api('/calc-tabs'), api('/calc-services'), api('/calc-packages')
  ]);
  data.calcTabs = tabs || [];
  data.calcServices = services || [];
  data.calcPackages = pkgs || [];
}
function renderCalculator() {
  let h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px"><i class="fas fa-calculator" style="color:#8B5CF6;margin-right:10px"></i>Калькулятор услуг</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Управление разделами и услугами. Каждый раздел = вкладка на сайте.</p>';
  
  h += '<div style="display:flex;gap:10px;margin-bottom:24px">' +
    '<button class="btn btn-primary" onclick="addNewSection()"><i class="fas fa-folder-plus" style="margin-right:6px"></i>Создать новый раздел</button>' +
    '<a href="/?_nocache=' + Date.now() + '" target="_blank" class="btn btn-outline" style="text-decoration:none"><i class="fas fa-external-link-alt" style="margin-right:6px"></i>Открыть сайт</a>' +
  '</div>';
  
  // Group services by tab
  var byTab = {};
  for (var si = 0; si < data.calcServices.length; si++) {
    var svc = data.calcServices[si];
    var tabId = svc.tab_id || 0;
    if (!byTab[tabId]) byTab[tabId] = [];
    byTab[tabId].push(svc);
  }
  
  // Render each tab as a folder section
  for (var ti = 0; ti < data.calcTabs.length; ti++) {
    var tab = data.calcTabs[ti];
    var svcs = byTab[tab.id] || [];
    
    h += '<div class="card" style="margin-bottom:20px">';
    
    // Folder header — editable inline
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #334155">' +
      '<i class="fas fa-grip-vertical" style="color:#475569;cursor:grab;font-size:1rem" title="Перетащите для перемещения"></i>' +
      '<i class="fas fa-folder-open" style="color:#a78bfa;font-size:1.1rem"></i>' +
      '<div style="flex:1;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<input class="input" value="' + escHtml(tab.name_ru) + '" style="flex:1;min-width:120px;padding:6px 10px;font-size:0.9rem;font-weight:700" id="tab_ru_' + tab.id + '" placeholder="Название RU">' +
        '<input class="input" value="' + escHtml(tab.name_am || '') + '" style="flex:1;min-width:120px;padding:6px 10px;font-size:0.9rem" id="tab_am_' + tab.id + '" placeholder="Название AM">' +
        '<input class="input" value="' + escHtml(tab.tab_key) + '" style="width:90px;padding:6px 10px;font-size:0.8rem;color:#64748b" id="tab_key_' + tab.id + '" placeholder="key" title="Ключ вкладки (англ)">' +
      '</div>' +
      '<span class="badge badge-purple">' + svcs.length + '</span>' +
      '<button class="btn btn-success" style="padding:6px 10px;font-size:0.8rem" onclick="saveCalcTab(' + tab.id + ')" title="Сохранить раздел"><i class="fas fa-save"></i></button>' +
      '<button class="btn btn-danger" style="padding:6px 10px;font-size:0.8rem" onclick="deleteCalcTab(' + tab.id + ')" title="Удалить раздел"><i class="fas fa-trash"></i></button>' +
    '</div>';
    
    // Services inside this folder (sortable container)
    h += '<div id="calc_svc_list_' + tab.id + '" class="calc-sortable-list">';
    for (var si2 = 0; si2 < svcs.length; si2++) {
      var svc2 = svcs[si2];
      var isTiered = svc2.price_type === 'tiered' && svc2.price_tiers_json;
      var tiers = [];
      if (isTiered) { try { tiers = JSON.parse(svc2.price_tiers_json); } catch(e) { tiers = []; } }
      
      h += '<div class="section-edit-row" style="margin-bottom:8px" data-svc-id="' + svc2.id + '">' +
        '<div style="display:grid;grid-template-columns:28px 1fr 1fr 100px auto auto;gap:8px;align-items:center">' +
          '<i class="fas fa-grip-vertical calc-drag-handle" style="color:#475569;cursor:grab;font-size:0.9rem"></i>' +
          '<div><div style="font-size:0.65rem;color:#64748b;margin-bottom:2px">Название RU</div><input class="input" value="' + escHtml(svc2.name_ru) + '" id="svc_ru_' + svc2.id + '" style="padding:6px 10px;font-size:0.85rem"></div>' +
          '<div><div style="font-size:0.65rem;color:#64748b;margin-bottom:2px">Название AM</div><input class="input" value="' + escHtml(svc2.name_am || '') + '" id="svc_am_' + svc2.id + '" style="padding:6px 10px;font-size:0.85rem"></div>' +
          '<div><div style="font-size:0.65rem;color:#64748b;margin-bottom:2px">\\u0426\\u0435\\u043d\\u0430 \\u058f</div><input class="input" type="number" value="' + svc2.price + '" id="svc_price_' + svc2.id + '" style="padding:6px 10px;font-size:0.85rem"></div>' +
          '<button class="btn btn-success" style="padding:6px 10px;margin-top:14px" onclick="saveCalcService(' + svc2.id + ',' + tab.id + ')" title="Сохранить"><i class="fas fa-save"></i></button>' +
          '<button class="btn btn-danger" style="padding:6px 10px;margin-top:14px" onclick="deleteCalcService(' + svc2.id + ')" title="Удалить"><i class="fas fa-trash"></i></button>' +
        '</div>';
      
      // Toggle tiered pricing button
      if (!isTiered) {
        h += '<div style="margin-top:6px"><button class="btn btn-outline" style="padding:4px 10px;font-size:0.72rem;border-color:rgba(139,92,246,0.3);color:#a78bfa" onclick="enableTieredPricing(' + svc2.id + ')" title="Добавить тарифную шкалу"><i class="fas fa-layer-group" style="margin-right:4px"></i>+ Тарифная шкала</button></div>';
      } else {
        h += '<div style="margin-top:6px"><button class="btn btn-outline" style="padding:4px 10px;font-size:0.72rem;border-color:rgba(239,68,68,0.3);color:#f87171" onclick="disableTieredPricing(' + svc2.id + ')" title="Убрать тарифную шкалу"><i class="fas fa-times" style="margin-right:4px"></i>Убрать шкалу</button></div>';
      }
      
      // Tier editor
      if (isTiered && tiers.length > 0) {
        h += '<div style="margin-top:8px;padding:10px;background:#0f172a;border:1px solid rgba(139,92,246,0.3);border-radius:8px">' +
          '<div style="font-size:0.78rem;font-weight:600;color:#a78bfa;margin-bottom:6px"><i class="fas fa-layer-group" style="margin-right:4px"></i>\\u0422\\u0430\\u0440\\u0438\\u0444\\u043d\\u0430\\u044f \\u0448\\u043a\\u0430\\u043b\\u0430</div>';
        for (var tii = 0; tii < tiers.length; tii++) {
          h += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap">' +
            '<span style="font-size:0.75rem;color:#94a3b8;min-width:16px">\\u043e\\u0442</span>' +
            '<input class="input" type="number" value="' + tiers[tii].min + '" style="width:60px;padding:4px 6px;font-size:0.8rem" id="tier_min_' + svc2.id + '_' + tii + '">' +
            '<span style="font-size:0.75rem;color:#94a3b8;min-width:16px">\\u0434\\u043e</span>' +
            '<input class="input" type="number" value="' + tiers[tii].max + '" style="width:60px;padding:4px 6px;font-size:0.8rem" id="tier_max_' + svc2.id + '_' + tii + '">' +
            '<span style="font-size:0.75rem;color:#94a3b8">=</span>' +
            '<input class="input" type="number" value="' + tiers[tii].price + '" style="width:80px;padding:4px 6px;font-size:0.8rem" id="tier_price_' + svc2.id + '_' + tii + '"><span style="font-size:0.8rem;color:#94a3b8">\\u058f</span>' +
            '<button class="tier-del-btn" onclick="deleteTier(' + svc2.id + ',' + tii + ',' + tiers.length + ')"><i class="fas fa-times"></i></button>' +
          '</div>';
        }
        h += '<div style="margin-top:6px;display:flex;gap:6px">' +
          '<button class="btn btn-success" style="padding:4px 10px;font-size:0.75rem" onclick="saveTiers(' + svc2.id + ',' + tiers.length + ')"><i class="fas fa-save" style="margin-right:4px"></i>\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0438\\u0442\\u044c</button>' +
          '<button class="btn btn-outline" style="padding:4px 10px;font-size:0.75rem" onclick="addTier(' + svc2.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>\\u0421\\u0442\\u0440\\u043e\\u043a\\u0430</button>' +
        '</div></div>';
      }
      h += '</div>';
    }
    h += '</div>'; // close calc-sortable-list
    
    // Add service button inside folder
    h += '<button class="btn btn-outline" style="width:100%;margin-top:8px;padding:10px;font-size:0.85rem;border-style:dashed" onclick="addServiceToTab(' + tab.id + ')" data-tab-name="' + escHtml(tab.name_ru) + '">' +
      '<i class="fas fa-plus" style="margin-right:6px;color:#a78bfa"></i>\\u0414\\u043e\\u0431\\u0430\\u0432\\u0438\\u0442\\u044c \\u0443\\u0441\\u043b\\u0443\\u0433\\u0443 \\u0432 \\u00ab' + escHtml(tab.name_ru) + '\\u00bb</button>';
    
    h += '</div>';
  }
  
  if (!data.calcTabs.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-folder-open" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8;margin-bottom:16px">\\u0420\\u0430\\u0437\\u0434\\u0435\\u043b\\u043e\\u0432 \\u043f\\u043e\\u043a\\u0430 \\u043d\\u0435\\u0442. \\u0421\\u043e\\u0437\\u0434\\u0430\\u0439\\u0442\\u0435 \\u043f\\u0435\\u0440\\u0432\\u044b\\u0439 \\u0440\\u0430\\u0437\\u0434\\u0435\\u043b.</p>' +
      '<button class="btn btn-primary" onclick="addNewSection()"><i class="fas fa-folder-plus" style="margin-right:6px"></i>\\u0421\\u043e\\u0437\\u0434\\u0430\\u0442\\u044c \\u0440\\u0430\\u0437\\u0434\\u0435\\u043b</button></div>';
  }
  
  // ===== PACKAGES SECTION =====
  var pkgTitleRu = (data.settings && data.settings.packages_title_ru) || '\\u0413\\u043e\\u0442\\u043e\\u0432\\u044b\\u0435 \\u043f\\u0430\\u043a\\u0435\\u0442\\u044b';
  var pkgTitleAm = (data.settings && data.settings.packages_title_am) || '\\u054a\\u0561\\u057f\\u0580\\u0561\\u057d\\u057f \\u0583\\u0561\\u0569\\u0565\\u0569\\u0576\\u0565\\u0580';
  var pkgSubRu = (data.settings && data.settings.packages_subtitle_ru) || '';
  var pkgSubAm = (data.settings && data.settings.packages_subtitle_am) || '';
  h += '<div style="margin-top:32px;padding-top:24px;border-top:2px solid #334155">' +
    '<h2 style="font-size:1.4rem;font-weight:700;margin-bottom:8px"><i class="fas fa-box-open" style="color:#f59e0b;margin-right:10px"></i>\\u041f\\u0430\\u043a\\u0435\\u0442\\u044b \\u0443\\u0441\\u043b\\u0443\\u0433</h2>' +
    '<p style="color:#94a3b8;margin-bottom:16px">\\u0413\\u043e\\u0442\\u043e\\u0432\\u044b\\u0435 \\u043a\\u043e\\u043c\\u043f\\u043b\\u0435\\u043a\\u0442\\u044b \\u0443\\u0441\\u043b\\u0443\\u0433 \\u0441\\u043e \\u0441\\u043a\\u0438\\u0434\\u043a\\u043e\\u0439. \\u041a\\u043b\\u0438\\u0435\\u043d\\u0442 \\u043c\\u043e\\u0436\\u0435\\u0442 \\u0432\\u044b\\u0431\\u0440\\u0430\\u0442\\u044c \\u043f\\u0430\\u043a\\u0435\\u0442 + \\u0434\\u043e\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435\\u043b\\u044c\\u043d\\u044b\\u0435 \\u0443\\u0441\\u043b\\u0443\\u0433\\u0438.</p>';
  // Editable title & subtitle for the packages section on the frontend
  h += '<div class="card" style="margin-bottom:16px;padding:16px;border:1px dashed #f59e0b40">' +
    '<div style="font-size:0.78rem;color:#f59e0b;font-weight:600;margin-bottom:10px"><i class="fas fa-heading" style="margin-right:6px"></i>\\u0417\\u0430\\u0433\\u043e\\u043b\\u043e\\u0432\\u043e\\u043a \\u0438 \\u043f\\u043e\\u0434\\u0437\\u0430\\u0433\\u043e\\u043b\\u043e\\u0432\\u043e\\u043a \\u043d\\u0430 \\u0441\\u0430\\u0439\\u0442\\u0435</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
      '<div><label style="font-size:0.7rem;color:#64748b;display:block;margin-bottom:3px">\\u0417\\u0430\\u0433\\u043e\\u043b\\u043e\\u0432\\u043e\\u043a (RU)</label><input class="input" id="pkgSectionTitleRu" value="' + escHtml(pkgTitleRu) + '" placeholder="\\u0413\\u043e\\u0442\\u043e\\u0432\\u044b\\u0435 \\u043f\\u0430\\u043a\\u0435\\u0442\\u044b"></div>' +
      '<div><label style="font-size:0.7rem;color:#64748b;display:block;margin-bottom:3px">\\u0417\\u0430\\u0433\\u043e\\u043b\\u043e\\u0432\\u043e\\u043a (AM)</label><input class="input" id="pkgSectionTitleAm" value="' + escHtml(pkgTitleAm) + '" placeholder="\\u054a\\u0561\\u057f\\u0580\\u0561\\u057d\\u057f \\u0583\\u0561\\u0569\\u0565\\u0569\\u0576\\u0565\\u0580"></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
      '<div><label style="font-size:0.7rem;color:#64748b;display:block;margin-bottom:3px">\\u041f\\u043e\\u0434\\u0437\\u0430\\u0433\\u043e\\u043b\\u043e\\u0432\\u043e\\u043a (RU)</label><input class="input" id="pkgSectionSubRu" value="' + escHtml(pkgSubRu) + '" placeholder="\\u041e\\u043f\\u0438\\u0448\\u0438\\u0442\\u0435 \\u043f\\u0440\\u0435\\u0438\\u043c\\u0443\\u0449\\u0435\\u0441\\u0442\\u0432\\u0430 \\u043f\\u0430\\u043a\\u0435\\u0442\\u043e\\u0432..."></div>' +
      '<div><label style="font-size:0.7rem;color:#64748b;display:block;margin-bottom:3px">\\u041f\\u043e\\u0434\\u0437\\u0430\\u0433\\u043e\\u043b\\u043e\\u0432\\u043e\\u043a (AM)</label><input class="input" id="pkgSectionSubAm" value="' + escHtml(pkgSubAm) + '" placeholder="\\u0553\\u0561\\u0569\\u0565\\u0569\\u0576\\u0565\\u0580\\u056b \\u0576\\u056f\\u0561\\u0580\\u0561\\u0563\\u0580\\u0578\\u0582\\u0569\\u0575\\u0578\\u0582\\u0576..."></div>' +
    '</div>' +
    '<button class="btn btn-success" style="padding:6px 14px;font-size:0.8rem" onclick="savePkgSectionTitles()"><i class="fas fa-save" style="margin-right:4px"></i>\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0438\\u0442\\u044c \\u0437\\u0430\\u0433\\u043e\\u043b\\u043e\\u0432\\u043a\\u0438</button>' +
  '</div>';
  h += '<button class="btn btn-primary" onclick="addNewPackage()" style="margin-bottom:16px"><i class="fas fa-plus" style="margin-right:6px"></i>\\u0421\\u043e\\u0437\\u0434\\u0430\\u0442\\u044c \\u043f\\u0430\\u043a\\u0435\\u0442</button>';
  
  var pkgs = data.calcPackages || [];
  if (pkgs.length === 0) {
    h += '<div class="card" style="text-align:center;padding:32px"><i class="fas fa-box-open" style="font-size:2.5rem;color:#475569;margin-bottom:12px"></i>' +
      '<p style="color:#94a3b8">\\u041f\\u0430\\u043a\\u0435\\u0442\\u043e\\u0432 \\u043f\\u043e\\u043a\\u0430 \\u043d\\u0435\\u0442. \\u0421\\u043e\\u0437\\u0434\\u0430\\u0439\\u0442\\u0435 \\u043f\\u0435\\u0440\\u0432\\u044b\\u0439!</p></div>';
  } else {
    h += '<div id="pkg_sortable_list">';
    for (var pi = 0; pi < pkgs.length; pi++) {
      var pkg = pkgs[pi];
      var discount = pkg.original_price > 0 ? Math.round((1 - pkg.package_price / pkg.original_price) * 100) : 0;
      h += '<div class="card pkg-sortable-item" data-pkg-id="' + pkg.id + '" style="margin-bottom:16px;border-left:3px solid ' + (pkg.is_active ? '#f59e0b' : '#475569') + '">';
      
      // Header with drag handle
      var crownIcon = pkg.crown_tier === 'gold' ? '<span style="font-size:1.2rem" title="\\u0417\\u043e\\u043b\\u043e\\u0442\\u0430\\u044f \\u043a\\u043e\\u0440\\u043e\\u043d\\u0430">\\ud83e\\udd47</span>' : pkg.crown_tier === 'silver' ? '<span style="font-size:1.2rem" title="\\u0421\\u0435\\u0440\\u0435\\u0431\\u0440\\u044f\\u043d\\u0430\\u044f \\u043a\\u043e\\u0440\\u043e\\u043d\\u0430">\\ud83e\\udd48</span>' : pkg.crown_tier === 'bronze' ? '<span style="font-size:1.2rem" title="\\u0411\\u0440\\u043e\\u043d\\u0437\\u043e\\u0432\\u0430\\u044f \\u043a\\u043e\\u0440\\u043e\\u043d\\u0430">\\ud83e\\udd49</span>' : '';
      h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">' +
        '<i class="fas fa-grip-vertical pkg-drag-handle" style="color:#64748b;cursor:grab;font-size:1.3rem;padding:6px 8px;border-radius:6px;background:rgba(100,116,139,0.1);transition:all 0.2s" title="\\u041f\\u0435\\u0440\\u0435\\u0442\\u0430\\u0449\\u0438\\u0442\\u0435 \\u0434\\u043b\\u044f \\u0438\\u0437\\u043c\\u0435\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430"></i>' +
        '<i class="fas fa-box-open" style="color:#f59e0b;font-size:1.1rem"></i>' +
        '<span style="font-weight:700;font-size:1rem">' + escHtml(pkg.name_ru || '\\u0411\\u0435\\u0437 \\u043d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u044f') + '</span>' +
        crownIcon +
        '<span style="margin-left:auto;font-size:0.85rem;color:#94a3b8">' + (pkg.is_active ? '\\u2705 \\u0410\\u043a\\u0442\\u0438\\u0432\\u0435\\u043d' : '\\u274c \\u041d\\u0435\\u0430\\u043a\\u0442\\u0438\\u0432\\u0435\\u043d') + '</span>' +
        '<button class="btn btn-primary" style="padding:6px 12px;font-size:0.8rem" onclick="editPackage(' + pkg.id + ')"><i class="fas fa-edit"></i></button>' +
        '<button class="btn btn-danger" style="padding:6px 12px;font-size:0.8rem" onclick="deletePackage(' + pkg.id + ')"><i class="fas fa-trash"></i></button>' +
      '</div>';
      
      // Price info
      h += '<div style="display:flex;gap:16px;margin-bottom:10px;font-size:0.9rem;flex-wrap:wrap">';
      if (pkg.original_price > 0) {
        h += '<div style="color:#94a3b8;text-decoration:line-through">\\u0411\\u0435\\u0437 \\u043f\\u0430\\u043a\\u0435\\u0442\\u0430: ' + Number(pkg.original_price).toLocaleString('ru-RU') + ' \\u058f</div>';
      }
      h += '<div style="font-weight:700;color:#f59e0b;font-size:1rem">\\u0426\\u0435\\u043d\\u0430 \\u043f\\u0430\\u043a\\u0435\\u0442\\u0430: ' + Number(pkg.package_price).toLocaleString('ru-RU') + ' \\u058f</div>';
      if (discount > 0) {
        h += '<span class="badge" style="background:#059669;font-size:0.8rem">-' + discount + '% \\u0441\\u043a\\u0438\\u0434\\u043a\\u0430</span>';
      }
      h += '</div>';
      
      // Items list
      if (pkg.items && pkg.items.length > 0) {
        h += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">';
        for (var ii = 0; ii < pkg.items.length; ii++) {
          var pi2 = pkg.items[ii];
          var tieredMark = pi2.use_tiered ? ' \\ud83d\\udcca' : '';
          h += '<span style="background:#1e293b;padding:4px 10px;border-radius:6px;font-size:0.8rem;color:#e2e8f0">' +
            '<i class="fas fa-check" style="color:#22c55e;margin-right:4px;font-size:0.7rem"></i>' +
            escHtml(pi2.service_name_ru || '\\u0423\\u0441\\u043b\\u0443\\u0433\\u0430 #' + pi2.service_id) + ' \\u00d7 ' + (pi2.quantity || 1) + tieredMark +
          '</span>';
        }
        h += '</div>';
      }
      
      h += '</div>';
    }
    h += '</div>'; // close pkg_sortable_list
  }
  
  h += '</div>';
  // end packages section
  
  h += '</div>';
  return h;
}

// ===== SORTABLE: drag-and-drop reorder services inside each calculator tab =====
function initCalcSortables() {
  document.querySelectorAll('.calc-sortable-list').forEach(function(el) {
    // Always re-init since DOM is recreated on each render
    try { if (el._sortableCalc) el._sortableCalc.destroy(); } catch(e) {}
    el._sortableCalc = new Sortable(el, {
      handle: '.calc-drag-handle',
      animation: 200,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: function(evt) {
        var listEl = evt.to;
        var tabId = listEl.id.replace('calc_svc_list_', '');
        var items = listEl.querySelectorAll('[data-svc-id]');
        var orders = [];
        for (var i = 0; i < items.length; i++) {
          orders.push({ id: parseInt(items[i].getAttribute('data-svc-id')), sort_order: i, tab_id: parseInt(tabId) });
        }
        for (var oi = 0; oi < orders.length; oi++) {
          var svc = data.calcServices.find(function(s) { return s.id === orders[oi].id; });
          if (svc) svc.sort_order = orders[oi].sort_order;
        }
        api('/calc-services-reorder', { method: 'PUT', body: JSON.stringify({ orders: orders }) })
          .then(function() { toast('\\u041f\\u043e\\u0440\\u044f\\u0434\\u043e\\u043a \\u0443\\u0441\\u043b\\u0443\\u0433 \\u0441\\u043e\\u0445\\u0440\\u0430\\u043d\\u0451\\u043d \\u0438 \\u043e\\u0431\\u043d\\u043e\\u0432\\u043b\\u0451\\u043d \\u043d\\u0430 \\u0441\\u0430\\u0439\\u0442\\u0435'); })
          .catch(function() { toast('\\u041e\\u0448\\u0438\\u0431\\u043a\\u0430 \\u0441\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430', 'error'); });
      }
    });
  });
  // Initialize sortable for packages list
  initPkgSortable();
}

function initPkgSortable() {
  var pkgList = document.getElementById('pkg_sortable_list');
  if (!pkgList) return;
  try { if (pkgList._sortablePkg) pkgList._sortablePkg.destroy(); } catch(e) {}
  pkgList._sortablePkg = new Sortable(pkgList, {
    handle: '.pkg-drag-handle',
    animation: 250,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd: function() {
      var items = pkgList.querySelectorAll('.pkg-sortable-item');
      var order = [];
      for (var i = 0; i < items.length; i++) {
        var pkgId = parseInt(items[i].getAttribute('data-pkg-id'));
        order.push({ id: pkgId, sort_order: i });
        // Update local data
        var localPkg = (data.calcPackages || []).find(function(p) { return p.id === pkgId; });
        if (localPkg) localPkg.sort_order = i;
      }
      // Sort local data array
      if (data.calcPackages) data.calcPackages.sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });
      api('/calc-packages-reorder', { method: 'PUT', body: JSON.stringify({ order: order }) })
        .then(function() { toast('\\u041f\\u043e\\u0440\\u044f\\u0434\\u043e\\u043a \\u043f\\u0430\\u043a\\u0435\\u0442\\u043e\\u0432 \\u0441\\u043e\\u0445\\u0440\\u0430\\u043d\\u0451\\u043d'); })
        .catch(function() { toast('\\u041e\\u0448\\u0438\\u0431\\u043a\\u0430 \\u0441\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u0438\\u044f \\u043f\\u043e\\u0440\\u044f\\u0434\\u043a\\u0430', 'error'); });
    }
  });
}

// ===== CREATE NEW SECTION (tab + folder in one action) =====
async function addNewSection() {
  // Insert inline form at top of page
  var existing = document.getElementById('newSectionForm');
  if (existing) { existing.remove(); return; }
  
  var formHtml = '<div id="newSectionForm" class="card" style="margin-bottom:20px;border:2px solid #8B5CF6;animation:slideUp 0.3s ease">' +
    '<h4 style="font-weight:700;margin-bottom:12px;color:#a78bfa"><i class="fas fa-folder-plus" style="margin-right:6px"></i>\\u041d\\u043e\\u0432\\u044b\\u0439 \\u0440\\u0430\\u0437\\u0434\\u0435\\u043b (\\u0432\\u043a\\u043b\\u0430\\u0434\\u043a\\u0430 \\u043d\\u0430 \\u0441\\u0430\\u0439\\u0442\\u0435)</h4>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 150px;gap:10px;margin-bottom:12px">' +
      '<div><label style="font-size:0.75rem;color:#64748b">\\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435 (RU) *</label><input class="input" id="newSec_ru" placeholder="\\u043d\\u0430\\u043f\\u0440: \\u0414\\u043e\\u0441\\u0442\\u0430\\u0432\\u043a\\u0430"></div>' +
      '<div><label style="font-size:0.75rem;color:#64748b">\\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435 (AM)</label><input class="input" id="newSec_am" placeholder="\\u043e\\u043f\\u0446\\u0438\\u043e\\u043d\\u0430\\u043b\\u044c\\u043d\\u043e"></div>' +
      '<div><label style="font-size:0.75rem;color:#64748b">\\u041a\\u043b\\u044e\\u0447 (\\u0430\\u043d\\u0433\\u043b)</label><input class="input" id="newSec_key" placeholder="delivery"></div>' +
    '</div>' +
    '<div style="display:flex;gap:10px">' +
      '<button class="btn btn-primary" onclick="submitNewSection()"><i class="fas fa-check" style="margin-right:4px"></i>\\u0421\\u043e\\u0437\\u0434\\u0430\\u0442\\u044c</button>' +
      '<button class="btn btn-outline" onclick="cancelNewSection()">\\u041e\\u0442\\u043c\\u0435\\u043d\\u0430</button>' +
    '</div></div>';
  
  // Insert after the heading
  var mainEl = document.querySelector('.main');
  var firstCard = mainEl ? mainEl.querySelector('.card') : null;
  if (firstCard) { firstCard.insertAdjacentHTML('beforebegin', formHtml); }
  else if (mainEl) { mainEl.insertAdjacentHTML('beforeend', formHtml); }
  
  var ruInput = document.getElementById('newSec_ru');
  if (ruInput) ruInput.focus();
}

async function submitNewSection() {
  var ru = document.getElementById('newSec_ru').value.trim();
  if (!ru) { toast('\\u0412\\u0432\\u0435\\u0434\\u0438\\u0442\\u0435 \\u043d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435 \\u0440\\u0430\\u0437\\u0434\\u0435\\u043b\\u0430', 'error'); return; }
  var am = document.getElementById('newSec_am').value.trim() || ru;
  var key = document.getElementById('newSec_key').value.trim();
  // Auto-generate key from RU name if not provided
  if (!key) {
    key = ru.toLowerCase().replace(/[^a-z0-9\\u0430-\\u044f]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    // Transliterate simple RU chars
    var tbl = {'\\u0430':'a','\\u0431':'b','\\u0432':'v','\\u0433':'g','\\u0434':'d','\\u0435':'e','\\u0436':'zh','\\u0437':'z','\\u0438':'i','\\u0439':'y','\\u043a':'k','\\u043b':'l','\\u043c':'m','\\u043d':'n','\\u043e':'o','\\u043f':'p','\\u0440':'r','\\u0441':'s','\\u0442':'t','\\u0443':'u','\\u0444':'f','\\u0445':'h','\\u0446':'ts','\\u0447':'ch','\\u0448':'sh','\\u0449':'shch','\\u044b':'y','\\u044d':'e','\\u044e':'yu','\\u044f':'ya'};
    key = ru.toLowerCase().split('').map(function(c) { return tbl[c] || c; }).join('').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }
  
  await api('/calc-tabs', { method: 'POST', body: JSON.stringify({ tab_key: key, name_ru: ru, name_am: am, sort_order: data.calcTabs.length + 1 }) });
  toast('\\u0420\\u0430\\u0437\\u0434\\u0435\\u043b \\u00ab' + ru + '\\u00bb \\u0441\\u043e\\u0437\\u0434\\u0430\\u043d! \\u0422\\u0435\\u043f\\u0435\\u0440\\u044c \\u0434\\u043e\\u0431\\u0430\\u0432\\u044c\\u0442\\u0435 \\u0443\\u0441\\u043b\\u0443\\u0433\\u0438.');
  await reloadCalcData(); render();
}

function cancelNewSection() {
  var el = document.getElementById('newSectionForm');
  if (el) el.remove();
}

function cancelAddSvc(tabId) {
  var el = document.getElementById('addSvcForm_' + tabId);
  if (el) el.remove();
}

// ===== ADD SERVICE TO SPECIFIC TAB =====
async function addServiceToTab(tabId) {
  var tab = data.calcTabs.find(function(t){ return t.id === tabId; });
  var tabName = tab ? tab.name_ru : '';
  var formId = 'addSvcForm_' + tabId;
  var existing = document.getElementById(formId);
  if (existing) { existing.remove(); return; }
  
  var formHtml = '<div id="' + formId + '" style="margin-top:8px;padding:14px;background:#0f172a;border:2px dashed #8B5CF6;border-radius:8px;animation:slideUp 0.3s ease">' +
    '<div style="font-size:0.85rem;font-weight:700;color:#a78bfa;margin-bottom:10px"><i class="fas fa-plus-circle" style="margin-right:4px"></i>\\u041d\\u043e\\u0432\\u0430\\u044f \\u0443\\u0441\\u043b\\u0443\\u0433\\u0430 \\u0432 \\u00ab' + escHtml(tabName) + '\\u00bb</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 100px 130px;gap:8px;margin-bottom:10px">' +
      '<input class="input" id="nsvc_ru_' + tabId + '" placeholder="\\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435 RU" style="padding:6px 10px;font-size:0.85rem">' +
      '<input class="input" id="nsvc_am_' + tabId + '" placeholder="\\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435 AM" style="padding:6px 10px;font-size:0.85rem">' +
      '<input class="input" type="number" id="nsvc_price_' + tabId + '" placeholder="\\u0426\\u0435\\u043d\\u0430 \\u058f" value="0" style="padding:6px 10px;font-size:0.85rem">' +
      '<select class="input" id="nsvc_type_' + tabId + '" style="padding:6px 8px;font-size:0.82rem">' +
        '<option value="fixed">\\u0424\\u0438\\u043a\\u0441. \\u0446\\u0435\\u043d\\u0430</option>' +
        '<option value="tiered">\\u0422\\u0430\\u0440\\u0438\\u0444\\u043d\\u0430\\u044f \\u0448\\u043a\\u0430\\u043b\\u0430</option>' +
      '</select>' +
    '</div>' +
    '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-primary" style="font-size:0.85rem" onclick="submitSvcToTab(' + tabId + ')"><i class="fas fa-check" style="margin-right:4px"></i>\\u0414\\u043e\\u0431\\u0430\\u0432\\u0438\\u0442\\u044c</button>' +
      '<button class="btn btn-outline" style="font-size:0.85rem" onclick="cancelAddSvc(' + tabId + ')">\\u041e\\u0442\\u043c\\u0435\\u043d\\u0430</button>' +
    '</div></div>';
  
  // Find the "add service" button for this tab and insert form before it
  var addBtn = document.querySelector('button[onclick="addServiceToTab(' + tabId + ')"]');
  if (addBtn) addBtn.insertAdjacentHTML('beforebegin', formHtml);
  var ruInput = document.getElementById('nsvc_ru_' + tabId);
  if (ruInput) ruInput.focus();
}

async function submitSvcToTab(tabId) {
  var ru = document.getElementById('nsvc_ru_' + tabId).value.trim();
  if (!ru) { toast('\\u0412\\u0432\\u0435\\u0434\\u0438\\u0442\\u0435 \\u043d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435', 'error'); return; }
  var am = document.getElementById('nsvc_am_' + tabId).value.trim() || ru;
  var price = parseInt(document.getElementById('nsvc_price_' + tabId).value) || 0;
  var pType = document.getElementById('nsvc_type_' + tabId).value;
  var tiersJson = null;
  if (pType === 'tiered') { tiersJson = JSON.stringify([{min:1,max:20,price:price},{min:21,max:40,price:Math.round(price*0.85)},{min:41,max:999,price:Math.round(price*0.75)}]); }
  await api('/calc-services', { method: 'POST', body: JSON.stringify({ tab_id: tabId, name_ru: ru, name_am: am, price: price, price_type: pType, price_tiers_json: tiersJson, sort_order: data.calcServices.length + 1 }) });
  toast('\\u0423\\u0441\\u043b\\u0443\\u0433\\u0430 \\u00ab' + ru + '\\u00bb \\u0434\\u043e\\u0431\\u0430\\u0432\\u043b\\u0435\\u043d\\u0430!');
  await reloadCalcData(); render();
}

async function saveCalcTab(id) {
  var ru = document.getElementById('tab_ru_' + id).value;
  var am = document.getElementById('tab_am_' + id).value;
  var key = document.getElementById('tab_key_' + id).value;
  var tab = data.calcTabs.find(function(t){ return t.id === id; });
  if (!tab) return;
  await api('/calc-tabs/' + id, { method: 'PUT', body: JSON.stringify({ name_ru: ru, name_am: am, sort_order: tab.sort_order, is_active: tab.is_active ?? 1 }) });
  toast('\\u0420\\u0430\\u0437\\u0434\\u0435\\u043b \\u0441\\u043e\\u0445\\u0440\\u0430\\u043d\\u0451\\u043d');
  await reloadCalcData(); render();
}

async function saveCalcService(id, tabId) {
  var svc = data.calcServices.find(function(s){ return s.id === id; });
  if (!svc) return;
  var ru = document.getElementById('svc_ru_' + id).value;
  var am = document.getElementById('svc_am_' + id).value;
  var price = parseInt(document.getElementById('svc_price_' + id).value) || 0;
  await api('/calc-services/' + id, { method: 'PUT', body: JSON.stringify({ ...svc, name_ru: ru, name_am: am, price: price, tab_id: tabId || svc.tab_id }) });
  toast('\\u0423\\u0441\\u043b\\u0443\\u0433\\u0430 \\u0441\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u0430');
  await reloadCalcData(); render();
}

async function saveTiers(svcId, count) {
  var tiers = [];
  for (var i = 0; i < count; i++) {
    var min = parseInt(document.getElementById('tier_min_' + svcId + '_' + i).value);
    var max = parseInt(document.getElementById('tier_max_' + svcId + '_' + i).value);
    var price = parseInt(document.getElementById('tier_price_' + svcId + '_' + i).value);
    if (!isNaN(min) && !isNaN(max) && !isNaN(price)) {
      tiers.push({ min: min, max: max, price: price });
    }
  }
  if (!tiers.length) { toast('\\u0417\\u0430\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435 \\u0445\\u043e\\u0442\\u044f \\u0431\\u044b \\u043e\\u0434\\u0438\\u043d \\u0442\\u0430\\u0440\\u0438\\u0444', 'error'); return; }
  var svc = data.calcServices.find(s => s.id === svcId);
  if (!svc) return;
  await api('/calc-services/' + svcId, { method: 'PUT', body: JSON.stringify({ ...svc, price_tiers_json: JSON.stringify(tiers), price: tiers[0].price }) });
  toast('\\u0422\\u0430\\u0440\\u0438\\u0444\\u044b \\u0441\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u044b! \\u041e\\u0431\\u043d\\u043e\\u0432\\u0438\\u0442\\u0435 \\u0441\\u0430\\u0439\\u0442 \\u0434\\u043b\\u044f \\u043f\\u0440\\u043e\\u0432\\u0435\\u0440\\u043a\\u0438.');
  await reloadCalcData(); render();
}

async function addTier(svcId) {
  var svc = data.calcServices.find(s => s.id === svcId);
  if (!svc) return;
  var tiers = [];
  try { tiers = JSON.parse(svc.price_tiers_json); } catch(e) { tiers = []; }
  var lastMax = tiers.length ? tiers[tiers.length-1].max : 0;
  tiers.push({ min: lastMax + 1, max: lastMax + 20, price: 1000 });
  await api('/calc-services/' + svcId, { method: 'PUT', body: JSON.stringify({ ...svc, price_tiers_json: JSON.stringify(tiers) }) });
  toast('\\u0421\\u0442\\u0440\\u043e\\u043a\\u0430 \\u0434\\u043e\\u0431\\u0430\\u0432\\u043b\\u0435\\u043d\\u0430');
  await reloadCalcData(); render();
}

async function deleteTier(svcId, tierIndex, totalTiers) {
  if (totalTiers <= 1) { toast('\\u041d\\u0435\\u043b\\u044c\\u0437\\u044f \\u0443\\u0434\\u0430\\u043b\\u0438\\u0442\\u044c \\u043f\\u043e\\u0441\\u043b\\u0435\\u0434\\u043d\\u0438\\u0439 \\u0442\\u0430\\u0440\\u0438\\u0444.', 'error'); return; }
  if (!confirm('\\u0423\\u0434\\u0430\\u043b\\u0438\\u0442\\u044c \\u044d\\u0442\\u0443 \\u0441\\u0442\\u0440\\u043e\\u043a\\u0443 \\u0442\\u0430\\u0440\\u0438\\u0444\\u0430?')) return;
  var svc = data.calcServices.find(s => s.id === svcId);
  if (!svc) return;
  var tiers = [];
  try { tiers = JSON.parse(svc.price_tiers_json); } catch(e) { tiers = []; }
  if (tierIndex < 0 || tierIndex >= tiers.length) return;
  tiers.splice(tierIndex, 1);
  await api('/calc-services/' + svcId, { method: 'PUT', body: JSON.stringify({ ...svc, price_tiers_json: JSON.stringify(tiers), price: tiers[0].price }) });
  toast('\\u0421\\u0442\\u0440\\u043e\\u043a\\u0430 \\u0442\\u0430\\u0440\\u0438\\u0444\\u0430 \\u0443\\u0434\\u0430\\u043b\\u0435\\u043d\\u0430');
  await reloadCalcData(); render();
}

async function deleteCalcService(id) {
  if (!confirm('\\u0423\\u0434\\u0430\\u043b\\u0438\\u0442\\u044c \\u044d\\u0442\\u0443 \\u0443\\u0441\\u043b\\u0443\\u0433\\u0443?')) return;
  await api('/calc-services/' + id, { method: 'DELETE' });
  toast('\\u0423\\u0441\\u043b\\u0443\\u0433\\u0430 \\u0443\\u0434\\u0430\\u043b\\u0435\\u043d\\u0430');
  await reloadCalcData(); render();
}

async function enableTieredPricing(svcId) {
  var svc = data.calcServices.find(function(s) { return s.id === svcId; });
  if (!svc) return;
  var price = svc.price || 1000;
  var defaultTiers = [
    { min: 1, max: 20, price: price },
    { min: 21, max: 40, price: Math.round(price * 0.85) },
    { min: 41, max: 999, price: Math.round(price * 0.75) }
  ];
  await api('/calc-services/' + svcId, { method: 'PUT', body: JSON.stringify({ ...svc, price_type: 'tiered', price_tiers_json: JSON.stringify(defaultTiers) }) });
  toast('\\u0422\\u0430\\u0440\\u0438\\u0444\\u043d\\u0430\\u044f \\u0448\\u043a\\u0430\\u043b\\u0430 \\u0434\\u043e\\u0431\\u0430\\u0432\\u043b\\u0435\\u043d\\u0430! \\u041d\\u0430\\u0441\\u0442\\u0440\\u043e\\u0439\\u0442\\u0435 \\u0446\\u0435\\u043d\\u044b.');
  await reloadCalcData(); render();
}

async function disableTieredPricing(svcId) {
  var svc = data.calcServices.find(function(s) { return s.id === svcId; });
  if (!svc) return;
  if (!confirm('\\u0423\\u0431\\u0440\\u0430\\u0442\\u044c \\u0442\\u0430\\u0440\\u0438\\u0444\\u043d\\u0443\\u044e \\u0448\\u043a\\u0430\\u043b\\u0443? \\u0423\\u0441\\u043b\\u0443\\u0433\\u0430 \\u0441\\u0442\\u0430\\u043d\\u0435\\u0442 \\u0441 \\u0444\\u0438\\u043a\\u0441. \\u0446\\u0435\\u043d\\u043e\\u0439.')) return;
  await api('/calc-services/' + svcId, { method: 'PUT', body: JSON.stringify({ ...svc, price_type: 'fixed', price_tiers_json: null }) });
  toast('\\u0422\\u0430\\u0440\\u0438\\u0444\\u043d\\u0430\\u044f \\u0448\\u043a\\u0430\\u043b\\u0430 \\u0443\\u0434\\u0430\\u043b\\u0435\\u043d\\u0430');
  await reloadCalcData(); render();
}

async function deleteCalcTab(id) {
  if (!confirm('\\u0423\\u0434\\u0430\\u043b\\u0438\\u0442\\u044c \\u0440\\u0430\\u0437\\u0434\\u0435\\u043b \\u0438 \\u0432\\u0441\\u0435 \\u0435\\u0433\\u043e \\u0443\\u0441\\u043b\\u0443\\u0433\\u0438?')) return;
  await api('/calc-tabs/' + id, { method: 'DELETE' });
  toast('\\u0420\\u0430\\u0437\\u0434\\u0435\\u043b \\u0443\\u0434\\u0430\\u043b\\u0451\\u043d');
  await reloadCalcData(); render();
}

// ===== CALCULATOR PACKAGES =====
function addNewPackage() {
  openPackageModal(null);
}

function editPackage(pkgId) {
  var pkg = (data.calcPackages || []).find(function(p) { return p.id === pkgId; });
  if (!pkg) { toast('Пакет не найден', 'error'); return; }
  openPackageModal(pkg);
}

// ===== PACKAGE MODAL: professional, auto-calculating =====
function openPackageModal(pkg) {
  var isEdit = !!pkg;
  var svcs = data.calcServices || [];
  var items = isEdit ? (pkg.items || []) : [];
  
  var html = '<div style="max-height:82vh;overflow-y:auto;padding:4px">' +
    '<h2 style="margin-bottom:20px;font-size:1.3rem;font-weight:700"><i class="fas fa-box-open" style="color:#f59e0b;margin-right:8px"></i>' + (isEdit ? 'Редактировать пакет' : 'Новый пакет') + '</h2>' +
    
    // === Name fields ===
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
      '<div><label style="font-size:0.75rem;color:#94a3b8;display:block;margin-bottom:4px">📝 Название RU <span style="color:#EF4444">*</span></label>' +
        '<input class="input" id="pkg_name_ru" value="' + escHtml(isEdit ? pkg.name_ru : '') + '" placeholder="Пакет Старт"></div>' +
      '<div><label style="font-size:0.75rem;color:#94a3b8;display:block;margin-bottom:4px">📝 Название AM</label>' +
        '<input class="input" id="pkg_name_am" value="' + escHtml(isEdit ? pkg.name_am : '') + '" placeholder="\\u054d\\u057f\\u0561\\u0580\\u057f \\u0583\\u0561\\u0569\\u0565\\u0569"></div>' +
    '</div>' +
    
    // === Description fields ===
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
      '<div><label style="font-size:0.75rem;color:#94a3b8;display:block;margin-bottom:4px">📋 Описание RU</label>' +
        '<textarea class="input" id="pkg_desc_ru" rows="2" placeholder="Лучший старт для новых продавцов">' + escHtml(isEdit ? pkg.description_ru || '' : '') + '</textarea></div>' +
      '<div><label style="font-size:0.75rem;color:#94a3b8;display:block;margin-bottom:4px">📋 Описание AM</label>' +
        '<textarea class="input" id="pkg_desc_am" rows="2" placeholder="\\u053c\\u0561\\u057e\\u0561\\u0563\\u0578\\u0582\\u0575\\u0576 \\u0574\\u0565\\u056f\\u0576\\u0561\\u0580\\u056f\\u0568 \\u0576\\u0578\\u0580 \\u057e\\u0561\\u0573\\u0561\\u057c\\u0578\\u0572\\u0576\\u0565\\u0580\\u056b \\u0570\\u0561\\u0574\\u0561\\u0580">' + escHtml(isEdit ? pkg.description_am || '' : '') + '</textarea></div>' +
    '</div>' +
    
    // === Services section ===
    '<h3 style="font-size:1rem;font-weight:700;margin-bottom:10px"><i class="fas fa-list-check" style="color:#22c55e;margin-right:6px"></i>Услуги в пакете <span style="color:#EF4444">*</span></h3>' +
    '<div id="pkg_items_list" style="margin-bottom:12px">';
  
  for (var ii = 0; ii < items.length; ii++) {
    var it = items[ii];
    html += renderPkgItemRow(ii, svcs, it.service_id, it.quantity, it.use_tiered);
  }
  
  html += '</div>' +
    '<button class="btn btn-outline" data-no-spin="1" style="width:100%;padding:8px;font-size:0.85rem;border-style:dashed;margin-bottom:20px" onclick="addPkgItem()">' +
      '<i class="fas fa-plus" style="margin-right:6px;color:#22c55e"></i>Добавить услугу</button>' +
    
    // === AUTO-CALCULATED PRICE BLOCK ===
    '<div id="pkg_price_block" style="background:#1a2236;border:1px solid #334155;border-radius:10px;padding:16px;margin-bottom:16px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><i class="fas fa-calculator" style="color:#8B5CF6"></i><span style="font-weight:700;font-size:0.95rem">Цены и скидка</span></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div>' +
          '<label style="font-size:0.72rem;color:#64748b;display:block;margin-bottom:4px">Сумма услуг (авто) ֏</label>' +
          '<div id="pkg_original_display" style="font-size:1.3rem;font-weight:800;color:#94a3b8;padding:8px 0">0</div>' +
          '<input type="hidden" id="pkg_original_price" value="' + (isEdit ? pkg.original_price || 0 : 0) + '">' +
        '</div>' +
        '<div>' +
          '<label style="font-size:0.72rem;color:#64748b;display:block;margin-bottom:4px">Цена пакета ֏ <span style="color:#EF4444">*</span></label>' +
          '<input class="input" type="number" id="pkg_package_price" value="' + (isEdit ? pkg.package_price || 0 : 0) + '" min="0" placeholder="15000" style="border-color:#f59e0b;font-size:1.05rem;font-weight:700" oninput="recalcPkgDiscount()">' +
        '</div>' +
        '<div>' +
          '<label style="font-size:0.72rem;color:#64748b;display:block;margin-bottom:4px">Скидка</label>' +
          '<div id="pkg_discount_display" style="font-size:1.3rem;font-weight:800;color:#10B981;padding:8px 0">0%</div>' +
        '</div>' +
      '</div>' +
      '<div id="pkg_savings_line" style="font-size:0.8rem;color:#64748b;display:none">Экономия клиента: <span id="pkg_savings_amount" style="color:#10B981;font-weight:700">0 ֏</span></div>' +
    '</div>' +
    
    // === Crown tier, badge text, and options ===
    '<div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;align-items:flex-start">' +
      '<div><label style="font-size:0.75rem;color:#94a3b8;display:block;margin-bottom:4px">\\u{1F451} \\u0423\\u0440\\u043E\\u0432\\u0435\\u043D\\u044C \\u043F\\u0430\\u043A\\u0435\\u0442\\u0430</label>' +
        '<select class="input" id="pkg_crown_tier" style="width:auto;min-width:180px;padding:8px 12px">' +
          '<option value=""' + (isEdit && !pkg.crown_tier ? ' selected' : '') + '>\\u2014 \\u0411\\u0435\\u0437 \\u0443\\u0440\\u043E\\u0432\\u043D\\u044F \\u2014</option>' +
          '<option value="gold"' + (isEdit && pkg.crown_tier === 'gold' ? ' selected' : '') + ' style="color:#F59E0B">\\u{1F947} \\u0417\\u043E\\u043B\\u043E\\u0442\\u043E\\u0439 (\\u043B\\u0443\\u0447\\u0448\\u0435\\u0435 \\u043F\\u0440\\u0435\\u0434\\u043B\\u043E\\u0436\\u0435\\u043D\\u0438\\u0435)</option>' +
          '<option value="silver"' + (isEdit && pkg.crown_tier === 'silver' ? ' selected' : '') + ' style="color:#94a3b8">\\u{1F948} \\u0421\\u0435\\u0440\\u0435\\u0431\\u0440\\u044F\\u043D\\u044B\\u0439</option>' +
          '<option value="bronze"' + (isEdit && pkg.crown_tier === 'bronze' ? ' selected' : '') + ' style="color:#CD7F32">\\u{1F949} \\u0411\\u0440\\u043E\\u043D\\u0437\\u043E\\u0432\\u044B\\u0439</option>' +
        '</select></div>' +
      '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:18px"><input type="checkbox" id="pkg_is_active" ' + (isEdit ? (pkg.is_active ? 'checked' : '') : 'checked') + '> <span style="font-size:0.85rem">\\u2705 \\u0410\\u043A\\u0442\\u0438\\u0432\\u0435\\u043D</span></label>' +
    '</div>' +
    
    // === Badge text (bilingual) ===
    '<div style="background:#1a2236;border:1px solid #334155;border-radius:10px;padding:14px;margin-bottom:16px">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><i class="fas fa-tag" style="color:#f59e0b"></i><span style="font-weight:700;font-size:0.9rem">\\u0422\\u0435\\u043A\\u0441\\u0442 \\u0431\\u0435\\u0439\\u0434\\u0436\\u0438\\u043A\\u0430 (\\u043E\\u043F\\u0446\\u0438\\u043E\\u043D\\u0430\\u043B\\u044C\\u043D\\u043E)</span></div>' +
      '<div style="font-size:0.75rem;color:#64748b;margin-bottom:8px">\\u0422\\u0435\\u043A\\u0441\\u0442 \\u043A\\u043E\\u0442\\u043E\\u0440\\u044B\\u0439 \\u043E\\u0442\\u043E\\u0431\\u0440\\u0430\\u0436\\u0430\\u0435\\u0442\\u0441\\u044F \\u043D\\u0430 \\u0431\\u0435\\u0439\\u0434\\u0436\\u0438\\u043A\\u0435 \\u0432\\u043C\\u0435\\u0441\\u0442\\u043E \\u043A\\u043E\\u0440\\u043E\\u043D\\u044B. \\u041F\\u0440\\u0438\\u043C\\u0435\\u0440: "\\u041B\\u0443\\u0447\\u0448\\u0435\\u0435 \\u043F\\u0440\\u0435\\u0434\\u043B\\u043E\\u0436\\u0435\\u043D\\u0438\\u0435", "TOP", "SALE"</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
        '<div><label style="font-size:0.72rem;color:#64748b;display:block;margin-bottom:4px">\\u{1F1F7}\\u{1F1FA} \\u0411\\u0435\\u0439\\u0434\\u0436\\u0438\\u043A RU</label>' +
        '<input class="input" type="text" id="pkg_badge_ru" value="' + (isEdit ? (pkg.badge_ru || '').replace(/"/g, '&quot;') : '') + '" placeholder="\\u041B\\u0443\\u0447\\u0448\\u0435\\u0435 \\u043F\\u0440\\u0435\\u0434\\u043B\\u043E\\u0436\\u0435\\u043D\\u0438\\u0435"></div>' +
        '<div><label style="font-size:0.72rem;color:#64748b;display:block;margin-bottom:4px">\\u{1F1E6}\\u{1F1F2} \\u0411\\u0435\\u0439\\u0434\\u0436\\u0438\\u043A AM</label>' +
        '<input class="input" type="text" id="pkg_badge_am" value="' + (isEdit ? (pkg.badge_am || '').replace(/"/g, '&quot;') : '') + '" placeholder="\\u0531\\u0574\\u0565\\u0576\\u0561\\u0577\\u0561\\u0570\\u0561\\u057E\\u0565\\u057F"></div>' +
      '</div>' +
    '</div>' +
    
    // === Footer buttons ===
    '<div style="display:flex;gap:10px;justify-content:flex-end;padding-top:16px;border-top:1px solid #334155">' +
      '<button class="btn btn-outline" onclick="closeModal()">Отмена</button>' +
      '<button class="btn btn-primary" id="pkg_save_btn" onclick="savePackage(' + (isEdit ? pkg.id : 'null') + ')"><i class="fas fa-save" style="margin-right:6px"></i>' + (isEdit ? 'Сохранить' : 'Создать') + '</button>' +
    '</div></div>';
  
  showModal(html);
  // Run initial calculation after modal is rendered
  setTimeout(function() { recalcPkgTotals(); }, 50);
}

// Recalculate original price from selected services
function recalcPkgTotals() {
  var svcs = data.calcServices || [];
  var svcMap = {};
  for (var si = 0; si < svcs.length; si++) {
    var s = svcs[si];
    svcMap[s.id] = s;
    svcMap[String(s.id)] = s;
    svcMap[Number(s.id)] = s;
  }
  
  var total = 0;
  var rows = document.querySelectorAll('#pkg_items_list > [id^="pkgItem_"]');
  for (var i = 0; i < rows.length; i++) {
    var sel = rows[i].querySelector('.pkg-svc-select');
    var qtyIn = rows[i].querySelector('.pkg-qty-input');
    var tieredCb = rows[i].querySelector('.pkg-use-tiered');
    var tierToggle = rows[i].querySelector('.pkg-tier-toggle');
    var svcId = sel ? sel.value : '0';
    var qty = parseInt(qtyIn ? qtyIn.value : '1') || 1;
    var svc = svcMap[svcId] || svcMap[Number(svcId)];
    if (svc) {
      var tiersJson = svc.price_tiers_json;
      var hasTiers = (svc.price_type === 'tiered') && tiersJson && tiersJson !== '[]' && tiersJson !== 'null';
      var useTiered = !!(tieredCb && tieredCb.checked);
      if (tierToggle) {
        tierToggle.style.display = hasTiers ? 'inline-flex' : 'none';
        tierToggle.style.visibility = hasTiers ? 'visible' : 'hidden';
      }
      var itemPrice = 0;
      if (useTiered && hasTiers) {
        try {
          var tiers = typeof tiersJson === 'string' ? JSON.parse(tiersJson) : tiersJson;
          if (Array.isArray(tiers) && tiers.length > 0) {
            itemPrice = _getPkgTierPrice(tiers, qty) * qty;
          } else { itemPrice = (Number(svc.price) || 0) * qty; }
        } catch(e) { itemPrice = (Number(svc.price) || 0) * qty; }
      } else {
        itemPrice = (Number(svc.price) || 0) * qty;
      }
      total += itemPrice;
      var priceEl = rows[i].querySelector('.pkg-item-price');
      if (priceEl) priceEl.textContent = itemPrice.toLocaleString('ru-RU') + ' \\u058f' + (useTiered && hasTiers ? ' \\ud83d\\udcca' : '');
    } else {
      if (tierToggle) { tierToggle.style.display = 'none'; tierToggle.style.visibility = 'hidden'; }
      var priceEl2 = rows[i].querySelector('.pkg-item-price');
      if (priceEl2) priceEl2.textContent = '\\u2014';
    }
  }
  
  // Update original price
  var origEl = document.getElementById('pkg_original_price');
  var origDisplay = document.getElementById('pkg_original_display');
  if (origEl) origEl.value = total;
  if (origDisplay) origDisplay.textContent = total.toLocaleString('ru-RU') + ' \\u058f';
  
  recalcPkgDiscount();
}

// Recalculate discount display
function recalcPkgDiscount() {
  var origEl = document.getElementById('pkg_original_price');
  var priceEl = document.getElementById('pkg_package_price');
  var discDisplay = document.getElementById('pkg_discount_display');
  var savingsLine = document.getElementById('pkg_savings_line');
  var savingsAmt = document.getElementById('pkg_savings_amount');
  
  var orig = parseInt(origEl ? origEl.value : '0') || 0;
  var price = parseInt(priceEl ? priceEl.value : '0') || 0;
  
  if (orig > 0 && price > 0 && price < orig) {
    var discPct = Math.round((1 - price / orig) * 100);
    var savings = orig - price;
    if (discDisplay) { discDisplay.textContent = '-' + discPct + '%'; discDisplay.style.color = '#10B981'; }
    if (savingsLine) savingsLine.style.display = 'block';
    if (savingsAmt) savingsAmt.textContent = savings.toLocaleString('ru-RU') + ' ֏';
    
  } else if (orig > 0 && price >= orig) {
    if (discDisplay) { discDisplay.textContent = 'нет скидки'; discDisplay.style.color = '#EF4444'; }
    if (savingsLine) savingsLine.style.display = 'none';
  } else {
    if (discDisplay) { discDisplay.textContent = '—'; discDisplay.style.color = '#64748b'; }
    if (savingsLine) savingsLine.style.display = 'none';
  }
}

var _pkgItemCounter = 100;
function _getPkgTierPrice(tiers, qty) {
  if (!tiers || qty <= 0) return 0;
  for (var i = 0; i < tiers.length; i++) {
    if (qty >= tiers[i].min && qty <= tiers[i].max) return tiers[i].price;
  }
  return tiers[tiers.length - 1].price;
}

function renderPkgItemRow(idx, svcs, selectedId, qty, useTiered) {
  _pkgItemCounter++;
  var rowId = 'pkgItem_' + _pkgItemCounter;
  var itemTotal = '\\u2014';
  var hasTiers = false;
  for (var si = 0; si < svcs.length; si++) {
    if (String(svcs[si].id) === String(selectedId)) {
      var tj = svcs[si].price_tiers_json;
      hasTiers = (svcs[si].price_type === 'tiered') && tj && tj !== '[]' && tj !== 'null';
      var tiersData = null;
      if (hasTiers) { try { tiersData = typeof tj === 'string' ? JSON.parse(tj) : tj; if (!Array.isArray(tiersData) || tiersData.length === 0) hasTiers = false; } catch(e) { hasTiers = false; } }
      if (useTiered && hasTiers && tiersData) {
        var tp = _getPkgTierPrice(tiersData, qty || 1);
        itemTotal = (tp * (qty || 1)).toLocaleString('ru-RU') + ' \\u058f';
      } else {
        itemTotal = ((Number(svcs[si].price) || 0) * (qty || 1)).toLocaleString('ru-RU') + ' \\u058f';
      }
      break;
    }
  }
  var h = '<div id="' + rowId + '" style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">';
  h += '<select class="input pkg-svc-select" style="flex:1;min-width:200px;padding:6px 10px;font-size:0.85rem" onchange="recalcPkgTotals()">';
  h += '<option value="">-- \\u0412\\u044b\\u0431\\u0435\\u0440\\u0438\\u0442\\u0435 \\u0443\\u0441\\u043b\\u0443\\u0433\\u0443 --</option>';
  for (var si2 = 0; si2 < svcs.length; si2++) {
    var s = svcs[si2];
    var sTj = s.price_tiers_json;
    var sTiered = (s.price_type === 'tiered') && sTj && sTj !== '[]' && sTj !== 'null';
    var tierMark = sTiered ? ' \\ud83d\\udcc8[\\u0448\\u043a\\u0430\\u043b\\u0430]' : '';
    h += '<option value="' + s.id + '" ' + (String(selectedId) === String(s.id) ? 'selected' : '') + '>' + escHtml(s.name_ru) + ' (' + Number(s.price).toLocaleString('ru-RU') + ' \\u058f)' + tierMark + '</option>';
  }
  h += '</select>';
  h += '<input class="input pkg-qty-input" type="number" value="' + (qty || 1) + '" min="1" max="999" style="width:70px;padding:6px 10px;font-size:0.85rem;text-align:center" title="\\u041a\\u043e\\u043b-\\u0432\\u043e" oninput="recalcPkgTotals()">';
  h += '<div class="pkg-tier-toggle" style="display:' + (hasTiers ? 'inline-flex' : 'none') + ';align-items:center;gap:6px;cursor:pointer;font-size:0.82rem;color:#c4b5fd;white-space:nowrap;background:rgba(139,92,246,0.18);padding:5px 12px;border-radius:8px;border:1px solid rgba(139,92,246,0.45)" onclick="var cb=this.querySelector(&apos;input&apos;);if(cb){cb.checked=!cb.checked;recalcPkgTotals()}">' +
    '<input type="checkbox" class="pkg-use-tiered" style="margin:0;cursor:pointer;width:16px;height:16px;accent-color:#8B5CF6" ' + (useTiered ? 'checked' : '') + ' onclick="event.stopPropagation();recalcPkgTotals()"> <span style="pointer-events:none">\\ud83d\\udcc8 \\u041f\\u043e \\u0448\\u043a\\u0430\\u043b\\u0435</span></div>';
  h += '<span class="pkg-item-price" style="min-width:90px;text-align:right;font-size:0.85rem;color:#a78bfa;font-weight:600;white-space:nowrap">' + itemTotal + '</span>';
  h += '<button class="btn btn-danger" style="padding:6px 10px;font-size:0.8rem" onclick="document.getElementById(&apos;' + rowId + '&apos;).remove();recalcPkgTotals()" title="\\u0423\\u0434\\u0430\\u043b\\u0438\\u0442\\u044c"><i class="fas fa-times"></i></button>';
  h += '</div>';
  return h;
}

async function savePkgSectionTitles() {
  var titleRu = (document.getElementById('pkgSectionTitleRu') || {}).value || '';
  var titleAm = (document.getElementById('pkgSectionTitleAm') || {}).value || '';
  var subRu = (document.getElementById('pkgSectionSubRu') || {}).value || '';
  var subAm = (document.getElementById('pkgSectionSubAm') || {}).value || '';
  try {
    await api('/settings', { method: 'PUT', body: JSON.stringify({
      packages_title_ru: titleRu,
      packages_title_am: titleAm,
      packages_subtitle_ru: subRu,
      packages_subtitle_am: subAm
    })});
    if (!data.settings) data.settings = {};
    data.settings.packages_title_ru = titleRu;
    data.settings.packages_title_am = titleAm;
    data.settings.packages_subtitle_ru = subRu;
    data.settings.packages_subtitle_am = subAm;
    toast('\\u0417\\u0430\\u0433\\u043e\\u043b\\u043e\\u0432\\u043a\\u0438 \\u043f\\u0430\\u043a\\u0435\\u0442\\u043e\\u0432 \\u0441\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u044b');
  } catch(e) {
    toast('\\u041e\\u0448\\u0438\\u0431\\u043a\\u0430 \\u0441\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u0438\\u044f', 'error');
  }
}

function addPkgItem() {
  var list = document.getElementById('pkg_items_list');
  if (!list) return;
  list.insertAdjacentHTML('beforeend', renderPkgItemRow(list.children.length, data.calcServices || [], '', 1, false));
}

async function savePackage(pkgId) {
  var nameRu = (document.getElementById('pkg_name_ru'))?.value?.trim() || '';
  var nameAm = (document.getElementById('pkg_name_am'))?.value?.trim() || '';
  if (!nameRu) { toast('Введите название RU', 'error'); return; }
  
  var items = [];
  var rows = document.querySelectorAll('#pkg_items_list > div');
  for (var i = 0; i < rows.length; i++) {
    var sel = rows[i].querySelector('.pkg-svc-select');
    var qtyIn = rows[i].querySelector('.pkg-qty-input');
    var tieredCb = rows[i].querySelector('.pkg-use-tiered');
    var svcId = parseInt(sel ? sel.value : '0') || 0;
    var qty = parseInt(qtyIn ? qtyIn.value : '1') || 1;
    var useTiered = tieredCb && tieredCb.checked ? 1 : 0;
    if (svcId > 0) items.push({ service_id: svcId, quantity: qty, use_tiered: useTiered });
  }
  
  if (items.length === 0) { toast('Добавьте хотя бы 1 услугу', 'error'); return; }
  
  var pkgPrice = parseInt((document.getElementById('pkg_package_price'))?.value || '0') || 0;
  if (pkgPrice <= 0) { toast('Укажите цену пакета', 'error'); return; }
  
  var payload = {
    name_ru: nameRu,
    name_am: nameAm,
    description_ru: (document.getElementById('pkg_desc_ru'))?.value || '',
    description_am: (document.getElementById('pkg_desc_am'))?.value || '',
    original_price: parseInt((document.getElementById('pkg_original_price'))?.value || '0') || 0,
    package_price: pkgPrice,
    badge_ru: (document.getElementById('pkg_badge_ru'))?.value || '',
    badge_am: (document.getElementById('pkg_badge_am'))?.value || '',
    crown_tier: (document.getElementById('pkg_crown_tier'))?.value || '',
    is_active: (document.getElementById('pkg_is_active'))?.checked ? 1 : 0,
    sort_order: pkgId ? ((data.calcPackages || []).find(function(p) { return p.id === pkgId; })?.sort_order || 0) : (data.calcPackages || []).length,
    items: items
  };
  
  // Show loading state
  var saveBtn = document.getElementById('pkg_save_btn');
  var restoreBtn = null;
  if (saveBtn) restoreBtn = btnLoading(saveBtn, 'Сохранение...');
  
  try {
    if (pkgId) {
      await api('/calc-packages/' + pkgId, { method: 'PUT', body: JSON.stringify(payload) });
      toast('Пакет обновлён');
    } else {
      await api('/calc-packages', { method: 'POST', body: JSON.stringify(payload) });
      toast('Пакет создан');
    }
    closeModal();
    // Reload packages data from server to ensure fresh state
    var freshPkgs = await api('/calc-packages');
    if (freshPkgs && Array.isArray(freshPkgs)) {
      data.calcPackages = freshPkgs;
    } else {
      await loadData();
    }
    render();
  } catch(e) {
    toast('Ошибка сохранения пакета', 'error');
    if (restoreBtn) restoreBtn();
  }
}

async function deletePackage(pkgId) {
  if (!confirm('Удалить этот пакет?')) return;
  await api('/calc-packages/' + pkgId, { method: 'DELETE' });
  toast('Пакет удалён');
  // Reload packages data from server
  var freshPkgs = await api('/calc-packages');
  if (freshPkgs && Array.isArray(freshPkgs)) {
    data.calcPackages = freshPkgs;
  } else {
    await loadData();
  }
  render();
}


`;
