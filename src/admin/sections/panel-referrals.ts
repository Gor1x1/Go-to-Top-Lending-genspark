/**
 * Admin Panel — Referral codes, section order
 * Full rewrite: dropdown service selection (one at a time), per-service quantity,
 * global discount, complex discount rules, deduplication, editing like creation
 */
export const CODE: string = `
// ===== REFERRAL CODES =====

// In-memory state for services being added during creation (before the code is saved)
var _newRefServices = [];

function renderReferrals() {
  // Get all calculator packages for checkboxes
  var allCalcPackages = (data.calcPackages || []).map(function(p) { return { id: p.id, name_ru: p.name_ru || '', name_am: p.name_am || '' }; });
  // Get all calculator services for the dropdown
  var allCalcServices = [];
  var tabsById = {};
  (data.calcTabs || []).forEach(function(tab) { tabsById[tab.id] = tab; });
  (data.calcServices || []).forEach(function(svc) {
    var tab = tabsById[svc.tab_id] || {};
    allCalcServices.push({ id: svc.id, name_ru: svc.name_ru, name_am: svc.name_am, price: svc.price, tab: tab.name_ru || '' });
  });
  // Store globally for add-service functions
  window._allCalcServices = allCalcServices;
  
  let h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Реферальные коды</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Промокоды со скидками, бесплатными услугами и сложными правилами. Скидка — глобальная (%), услуги привязываются по одной.</p>';
  
  // ── Inline form for adding new referral code ──
  h += '<div class="card" style="margin-bottom:24px;border:2px dashed rgba(139,92,246,0.4);background:rgba(139,92,246,0.03);border-radius:16px;padding:24px">' +
    '<h3 style="font-weight:700;margin-bottom:16px;color:#a78bfa;font-size:1.05rem"><i class="fas fa-plus-circle" style="margin-right:8px"></i>Создать новый промокод</h3>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600;margin-bottom:4px;display:block">Кодовое слово</label><input class="input" id="new_ref_code" placeholder="PROMO2026" style="text-transform:uppercase"></div>' +
      '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600;margin-bottom:4px;display:block">Глобальная скидка (%)</label><input class="input" type="number" id="new_ref_disc" value="0" min="0" max="100"></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600;margin-bottom:4px;display:block">Лимит использований (0 = без лимита)</label><input class="input" type="number" id="new_ref_max" value="0" min="0" placeholder="0 = без лимита"></div>' +
      '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600;margin-bottom:4px;display:block">Описание</label><input class="input" id="new_ref_desc" placeholder="Блогер, партнёр, VIP..."></div>' +
    '</div>' +
    // Toggles
    '<div style="margin-bottom:12px;display:flex;gap:24px;flex-wrap:wrap">' +
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="new_ref_active" checked> <span style="font-size:0.82rem;color:#10B981"><i class="fas fa-toggle-on" style="margin-right:4px"></i>Активен</span></label>' +
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="new_ref_apply_pkg"> <span style="font-size:0.82rem;color:#f59e0b"><i class="fas fa-box-open" style="margin-right:4px"></i>Применить к пакетам</span></label>' +
    '</div>';
  // Package checkboxes
  if (allCalcPackages.length > 0) {
    h += '<div style="margin-bottom:12px;padding:10px;background:rgba(245,158,11,0.05);border-radius:8px;border:1px solid rgba(245,158,11,0.15)">' +
      '<div style="font-size:0.72rem;color:#f59e0b;font-weight:600;margin-bottom:6px"><i class="fas fa-box-open" style="margin-right:4px"></i>Привязка к пакетам (пусто = не привязан)</div><div style="display:flex;flex-wrap:wrap;gap:8px">';
    for (var npi = 0; npi < allCalcPackages.length; npi++) {
      var npk = allCalcPackages[npi];
      h += '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:0.8rem;padding:4px 8px;background:#1e293b;border-radius:6px;border:1px solid #334155"><input type="checkbox" class="new_ref_pkg_cb" value="' + npk.id + '"> ' + escHtml(npk.name_ru) + '</label>';
    }
    h += '</div></div>';
  }
  // Service single-select dropdown for linked_services (discount scope)
  if (allCalcServices.length > 0) {
    h += '<div style="margin-bottom:12px;padding:10px;background:rgba(139,92,246,0.05);border-radius:8px;border:1px solid rgba(139,92,246,0.15)">' +
      '<div style="font-size:0.72rem;color:#a78bfa;font-weight:600;margin-bottom:6px"><i class="fas fa-list-check" style="margin-right:4px"></i>Скидка ограничена услугами (пусто = ко всем)</div>' +
      '<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">' +
        '<div style="flex:2;min-width:180px"><select class="input" id="new_ref_linked_svc" style="font-size:0.8rem"><option value="">— Выберите услугу —</option>';
    for (var nsi = 0; nsi < allCalcServices.length; nsi++) {
      var ns = allCalcServices[nsi];
      h += '<option value="' + ns.id + '">' + escHtml(ns.name_ru) + ' (' + escHtml(ns.tab) + ')</option>';
    }
    h += '</select></div>' +
      '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.78rem;white-space:nowrap" onclick="addNewRefLinkedService()"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button>' +
      '</div>' +
      '<div id="new_ref_linked_svcs_list" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">';
    // Render already added linked services (in-memory)
    h += renderNewRefLinkedServicesTags();
    h += '</div>' +
      '<div style="font-size:0.62rem;color:#475569;margin-top:4px">Если список пуст — скидка применяется ко всем услугам.</div></div>';
  }

  // ── Services to include with the code (free/discounted, one at a time) ──
  h += '<div style="margin-bottom:16px;padding:12px;background:rgba(16,185,129,0.04);border-radius:8px;border:1px solid rgba(16,185,129,0.15)">' +
    '<div style="font-size:0.72rem;color:#10B981;font-weight:600;margin-bottom:8px"><i class="fas fa-gift" style="margin-right:4px"></i>Привязанные услуги (бесплатные / со скидкой)</div>';
  // Already-added services (in-memory before save)
  h += '<div id="new_ref_services_list">';
  h += renderNewRefServicesTags();
  h += '</div>';
  // Add-one-service form
  if (allCalcServices.length > 0) {
    h += '<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:8px">' +
      '<div style="flex:2;min-width:180px"><label style="font-size:0.68rem;color:#64748b;margin-bottom:3px;display:block">Услуга</label>' +
        '<select class="input" id="new_ref_add_svc" style="font-size:0.8rem"><option value="">— Выберите услугу —</option>';
    for (var nai = 0; nai < allCalcServices.length; nai++) {
      var na = allCalcServices[nai];
      h += '<option value="' + na.id + '">' + escHtml(na.name_ru) + ' (' + escHtml(na.tab) + ') — ' + Number(na.price).toLocaleString('ru-RU') + ' \\u058f</option>';
    }
    h += '</select></div>' +
      '<div style="flex:0.5;min-width:60px"><label style="font-size:0.68rem;color:#64748b;margin-bottom:3px;display:block">Скидка %</label><input class="input" type="number" id="new_ref_add_disc" value="100" min="0" max="100" style="font-size:0.8rem"></div>' +
      '<div style="flex:0.5;min-width:50px"><label style="font-size:0.68rem;color:#64748b;margin-bottom:3px;display:block">Кол-во</label><input class="input" type="number" id="new_ref_add_qty" value="1" min="1" max="999" style="font-size:0.8rem"></div>' +
      '<button class="btn btn-primary" style="padding:6px 12px;font-size:0.78rem;white-space:nowrap" onclick="addNewRefService()"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button>' +
    '</div>' +
    '<div style="font-size:0.62rem;color:#475569;margin-top:4px">100% = бесплатно. Добавляйте услуги по одной.</div>';
  }
  h += '</div>';

  // ── Complex discount rules explanation ──
  h += '<div style="margin-bottom:16px;padding:10px;background:rgba(59,130,246,0.05);border-radius:8px;border:1px solid rgba(59,130,246,0.15)">' +
    '<div style="font-size:0.72rem;color:#3B82F6;font-weight:600;margin-bottom:4px"><i class="fas fa-info-circle" style="margin-right:4px"></i>Как работают сложные правила</div>' +
    '<div style="font-size:0.72rem;color:#94a3b8;line-height:1.5">' +
      'Пример: лимит 10 использований, привязана услуга «Выкуп» × 5 шт со скидкой 100%.<br>' +
      'Итого: 10 активаций × 5 штук = <strong style="color:#10B981">50 бесплатных выкупов</strong>.<br>' +
      'Глобальная скидка (%) действует на все или выбранные услуги в калькуляторе.</div></div>';

  h += '<button class="btn btn-primary" style="width:100%;padding:12px;font-size:0.95rem" onclick="addReferral()"><i class="fas fa-plus" style="margin-right:8px"></i>Создать промокод</button>' +
  '</div>';
  
  // ── Overall promo analytics summary ──
  var totalRefUses = 0, totalRefPaid = 0, totalRefActive = 0, totalRefInactive = 0;
  data.referrals.forEach(function(r) {
    totalRefUses += Number(r.uses_count || 0);
    totalRefPaid += Number(r.paid_uses_count || 0);
    if (r.is_active) totalRefActive++; else totalRefInactive++;
  });
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">';
  h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #8B5CF6"><div style="font-size:0.72rem;color:#94a3b8">Всего кодов</div><div style="font-size:1.5rem;font-weight:800;color:#8B5CF6">' + data.referrals.length + '</div></div>';
  h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #10B981"><div style="font-size:0.72rem;color:#94a3b8">Активных</div><div style="font-size:1.5rem;font-weight:800;color:#10B981">' + totalRefActive + '</div></div>';
  h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #EF4444"><div style="font-size:0.72rem;color:#94a3b8">Выключенных</div><div style="font-size:1.5rem;font-weight:800;color:#EF4444">' + totalRefInactive + '</div></div>';
  h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #F59E0B"><div style="font-size:0.72rem;color:#94a3b8">Всего использ.</div><div style="font-size:1.5rem;font-weight:800;color:#F59E0B">' + totalRefUses + '</div></div>';
  h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #3B82F6"><div style="font-size:0.72rem;color:#94a3b8">Оплач. лидов</div><div style="font-size:1.5rem;font-weight:800;color:#3B82F6">' + totalRefPaid + '</div></div>';
  h += '</div>';

  // ── Existing codes as cards ──
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1rem;color:#e2e8f0"><i class="fas fa-list" style="margin-right:8px;color:#8B5CF6"></i>Существующие промокоды (' + data.referrals.length + ')</h3>';

  if (!data.referrals.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-gift" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8">Реферальных кодов пока нет. Создайте первый код выше.</p></div>';
  }

  for (const ref of data.referrals) {
    var refServices = ref._services || [];
    var paidCount = Number(ref.paid_uses_count || 0);
    var maxUses = Number(ref.max_uses || 0);
    var usagePct = maxUses > 0 ? Math.min(100, Math.round(paidCount / maxUses * 100)) : 0;
    var usageColor = maxUses > 0 && paidCount >= maxUses ? '#EF4444' : '#10B981';
    var refLinkedPkgs = [];
    try { refLinkedPkgs = JSON.parse(ref.linked_packages || '[]'); } catch(e) { refLinkedPkgs = []; }
    var refLinkedSvcs = [];
    try { refLinkedSvcs = JSON.parse(ref.linked_services || '[]'); } catch(e) { refLinkedSvcs = []; }
    // Deduplicate services by service_id
    var seenSvcIds = {};
    var uniqueRefServices = [];
    for (var rsi = 0; rsi < refServices.length; rsi++) {
      var rsKey = refServices[rsi].service_id;
      if (!seenSvcIds[rsKey]) { seenSvcIds[rsKey] = true; uniqueRefServices.push(refServices[rsi]); }
    }

    // Calculate total items provided by this code
    var totalItemsPerUse = 0;
    for (var ti = 0; ti < uniqueRefServices.length; ti++) { totalItemsPerUse += Number(uniqueRefServices[ti].quantity || 1); }
    var totalItemsLifetime = maxUses > 0 ? totalItemsPerUse * maxUses : 0;

    h += '<div class="card" style="margin-bottom:16px;border-radius:16px;border:1px solid ' + (ref.is_active ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)') + ';overflow:hidden">';
    
    // Card header
    h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;background:' + (ref.is_active ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.04)') + ';border-bottom:1px solid #334155">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<span style="font-size:1.1rem;font-weight:800;color:#e2e8f0;letter-spacing:1px;background:rgba(139,92,246,0.15);padding:6px 14px;border-radius:8px">' + escHtml(ref.code) + '</span>' +
        (ref.is_active ? '<span class="badge badge-green" style="font-size:0.72rem">Активен</span>' : '<span class="badge" style="background:rgba(239,68,68,0.2);color:#f87171;font-size:0.72rem">Выключен</span>') +
        (ref.discount_percent > 0 ? '<span class="badge badge-purple" style="font-size:0.72rem">-' + ref.discount_percent + '% скидка</span>' : '') +
      '</div>' +
      '<div style="display:flex;gap:6px">' +
        '<button class="btn btn-outline" style="padding:6px 10px;font-size:0.78rem" onclick="toggleRefEditForm(' + ref.id + ')" title="Редактировать"><i class="fas fa-pen"></i></button>' +
        '<button class="btn btn-outline" style="padding:6px 10px;font-size:0.78rem" onclick="toggleReferral(' + ref.id + ',' + (ref.is_active ? 0 : 1) + ')" title="' + (ref.is_active ? 'Деактивировать' : 'Активировать') + '">' + (ref.is_active ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>') + '</button>' +
        '<button class="btn btn-danger" style="padding:6px 10px;font-size:0.78rem" onclick="deleteReferral(' + ref.id + ')" title="Удалить"><i class="fas fa-trash"></i></button>' +
      '</div>' +
    '</div>';
    
    // Card stats row
    h += '<div style="padding:12px 20px;display:flex;gap:16px;flex-wrap:wrap;border-bottom:1px solid #1e293b">';
    h += '<div style="font-size:0.78rem;color:#94a3b8"><i class="fas fa-users" style="margin-right:4px;color:#8B5CF6"></i>Использований: <strong style="color:#e2e8f0">' + (ref.uses_count || 0) + '</strong></div>';
    h += '<div style="font-size:0.78rem;color:#94a3b8"><i class="fas fa-check-circle" style="margin-right:4px;color:#10B981"></i>Оплачено: <strong style="color:' + usageColor + '">' + paidCount + (maxUses > 0 ? '/' + maxUses : '') + '</strong></div>';
    if (maxUses > 0) h += '<div style="font-size:0.78rem;color:#94a3b8"><i class="fas fa-chart-bar" style="margin-right:4px;color:#F59E0B"></i>Лимит: <strong style="color:#F59E0B">' + usagePct + '%</strong></div>';
    if (ref.description) h += '<div style="font-size:0.78rem;color:#94a3b8"><i class="fas fa-comment" style="margin-right:4px;color:#64748b"></i>' + escHtml(ref.description) + '</div>';
    h += '</div>';
    
    // Usage progress bar
    if (maxUses > 0) {
      h += '<div style="padding:0 20px"><div style="margin:8px 0;background:#1e293b;border-radius:4px;overflow:hidden;height:5px"><div style="height:100%;background:' + usageColor + ';width:' + usagePct + '%;transition:width 0.3s"></div></div></div>';
    }

    // Complex rule summary
    if (totalItemsLifetime > 0) {
      h += '<div style="padding:8px 20px;background:rgba(59,130,246,0.04);border-top:1px solid #1e293b">' +
        '<div style="font-size:0.75rem;color:#3B82F6"><i class="fas fa-calculator" style="margin-right:4px"></i>' +
        maxUses + ' активаций × ' + totalItemsPerUse + ' шт/активацию = <strong>' + totalItemsLifetime + ' шт всего</strong></div></div>';
    }
    
    // Attached services (non-editable summary)
    if (uniqueRefServices.length > 0) {
      h += '<div style="padding:10px 20px;border-top:1px solid #1e293b">' +
        '<div style="font-size:0.72rem;color:#a78bfa;font-weight:600;margin-bottom:6px"><i class="fas fa-gift" style="margin-right:4px"></i>Привязанные услуги:</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      for (var rsi2 = 0; rsi2 < uniqueRefServices.length; rsi2++) {
        var rs = uniqueRefServices[rsi2];
        var rsLabel = rs.discount_percent >= 100 || rs.discount_percent === 0 ? 'бесплатно' : '-' + rs.discount_percent + '%';
        h += '<span style="font-size:0.75rem;padding:4px 10px;background:#1a2236;border-radius:6px;color:#94a3b8;border:1px solid #334155">' +
          '<i class="fas fa-check-circle" style="color:#10B981;margin-right:4px"></i>' + escHtml(rs.name_ru || 'ID#' + rs.service_id) + ' \\u00d7' + (rs.quantity || 1) + ' <span style="color:' + (rs.discount_percent >= 100 || rs.discount_percent === 0 ? '#10B981' : '#fbbf24') + '">' + rsLabel + '</span></span>';
      }
      h += '</div></div>';
    }

    // Linked packages summary
    if (refLinkedPkgs.length > 0) {
      h += '<div style="padding:10px 20px;border-top:1px solid #1e293b">' +
        '<div style="font-size:0.72rem;color:#f59e0b;font-weight:600;margin-bottom:6px"><i class="fas fa-box-open" style="margin-right:4px"></i>Привязан к пакетам:</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      for (var lpk = 0; lpk < allCalcPackages.length; lpk++) {
        if (refLinkedPkgs.indexOf(allCalcPackages[lpk].id) !== -1) {
          h += '<span style="font-size:0.75rem;padding:4px 10px;background:rgba(245,158,11,0.08);border-radius:6px;color:#f59e0b;border:1px solid rgba(245,158,11,0.2)">' + escHtml(allCalcPackages[lpk].name_ru) + '</span>';
        }
      }
      h += '</div></div>';
    }
    
    // Linked services summary (from linked_services JSON — scope of discount)
    if (refLinkedSvcs.length > 0) {
      h += '<div style="padding:10px 20px;border-top:1px solid #1e293b">' +
        '<div style="font-size:0.72rem;color:#a78bfa;font-weight:600;margin-bottom:6px"><i class="fas fa-list-check" style="margin-right:4px"></i>Скидка ограничена услугами:</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      for (var lsi = 0; lsi < allCalcServices.length; lsi++) {
        if (refLinkedSvcs.indexOf(allCalcServices[lsi].id) !== -1) {
          h += '<span style="font-size:0.75rem;padding:4px 10px;background:rgba(139,92,246,0.08);border-radius:6px;color:#a78bfa;border:1px solid rgba(139,92,246,0.2)">' + escHtml(allCalcServices[lsi].name_ru) + '</span>';
        }
      }
      h += '</div></div>';
    }

    // ── Collapsible EDIT form ──
    h += '<div id="ref-edit-' + ref.id + '" style="display:none;padding:16px 20px;border-top:2px solid rgba(139,92,246,0.3);background:rgba(139,92,246,0.02)">';
    h += '<h4 style="font-size:0.88rem;font-weight:700;color:#a78bfa;margin-bottom:12px"><i class="fas fa-pen" style="margin-right:6px"></i>Редактировать <<' + escHtml(ref.code) + '>></h4>';
    // Edit fields
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:0.72rem;color:#64748b;font-weight:600;display:block;margin-bottom:3px">Код</label><input class="input" value="' + escHtml(ref.code) + '" id="ref_code_' + ref.id + '"></div>' +
      '<div><label style="font-size:0.72rem;color:#64748b;font-weight:600;display:block;margin-bottom:3px">Глобальная скидка (%)</label><input class="input" type="number" value="' + (ref.discount_percent || 0) + '" id="ref_disc_' + ref.id + '" min="0" max="100"></div>' +
      '<div><label style="font-size:0.72rem;color:#64748b;font-weight:600;display:block;margin-bottom:3px">Лимит (0=без лимита)</label><input class="input" type="number" value="' + (ref.max_uses || 0) + '" id="ref_max_' + ref.id + '" min="0"></div>' +
    '</div>' +
    '<div style="margin-bottom:12px"><label style="font-size:0.72rem;color:#64748b;font-weight:600;display:block;margin-bottom:3px">Описание</label><input class="input" value="' + escHtml(ref.description || '') + '" id="ref_desc_' + ref.id + '" placeholder="Комментарий..."></div>' +
    '<div style="margin-bottom:12px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="ref_apply_pkg_' + ref.id + '" ' + (ref.apply_to_packages ? 'checked' : '') + '> <span style="font-size:0.82rem;color:#f59e0b"><i class="fas fa-box-open" style="margin-right:4px"></i>Применить к пакетам</span></label></div>';
    // Package checkboxes for edit
    if (allCalcPackages.length > 0) {
      h += '<div style="margin-bottom:12px;padding:8px;background:rgba(245,158,11,0.05);border-radius:6px;border:1px solid rgba(245,158,11,0.1)">' +
        '<div style="font-size:0.72rem;color:#f59e0b;font-weight:600;margin-bottom:6px"><i class="fas fa-box-open" style="margin-right:4px"></i>Привязка к пакетам</div><div style="display:flex;flex-wrap:wrap;gap:8px">';
      for (var epi = 0; epi < allCalcPackages.length; epi++) {
        var epk = allCalcPackages[epi];
        var epkChecked = refLinkedPkgs.indexOf(epk.id) !== -1 ? 'checked' : '';
        h += '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:0.8rem;padding:3px 6px;background:#1e293b;border-radius:5px"><input type="checkbox" class="ref_pkg_cb_' + ref.id + '" value="' + epk.id + '" ' + epkChecked + '> ' + escHtml(epk.name_ru) + '</label>';
      }
      h += '</div></div>';
    }
    // Linked services edit — single-select dropdown
    h += '<div style="margin-bottom:12px;padding:8px;background:rgba(139,92,246,0.05);border-radius:6px;border:1px solid rgba(139,92,246,0.1)">' +
      '<div style="font-size:0.72rem;color:#a78bfa;font-weight:600;margin-bottom:6px"><i class="fas fa-list-check" style="margin-right:4px"></i>Скидка ограничена услугами (пусто = все)</div>' +
      '<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">' +
        '<div style="flex:2;min-width:180px"><select class="input" id="ref_linked_svc_' + ref.id + '" style="font-size:0.8rem"><option value="">— Выберите услугу —</option>';
    for (var esi = 0; esi < allCalcServices.length; esi++) {
      var es = allCalcServices[esi];
      h += '<option value="' + es.id + '">' + escHtml(es.name_ru) + ' (' + escHtml(es.tab) + ')</option>';
    }
    h += '</select></div>' +
      '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.78rem;white-space:nowrap" onclick="addEditRefLinkedService(' + ref.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button>' +
      '</div>' +
      '<div id="ref_linked_svcs_list_' + ref.id + '" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">';
    for (var lse = 0; lse < refLinkedSvcs.length; lse++) {
      var lseId = refLinkedSvcs[lse];
      var lseName = '';
      for (var fse = 0; fse < allCalcServices.length; fse++) {
        if (allCalcServices[fse].id === lseId) { lseName = allCalcServices[fse].name_ru; break; }
      }
      h += '<span style="font-size:0.75rem;padding:3px 8px;background:rgba(139,92,246,0.1);border-radius:5px;color:#a78bfa;border:1px solid rgba(139,92,246,0.2);display:flex;align-items:center;gap:4px">' +
        escHtml(lseName || 'ID#' + lseId) +
        '<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:0 2px;font-size:0.7rem" onclick="removeEditRefLinkedService(' + ref.id + ',' + lseId + ')"><i class="fas fa-times"></i></button></span>';
    }
    h += '</div></div>';

    // === Attached services management (one-by-one dropdown) ===
    h += '<div style="margin-bottom:12px;border-top:1px solid #334155;padding-top:12px">' +
      '<div style="font-size:0.82rem;font-weight:700;color:#10B981;margin-bottom:8px"><i class="fas fa-gift" style="margin-right:6px"></i>Привязанные услуги (бесплатные / со скидкой)</div>';
    
    if (uniqueRefServices.length > 0) {
      h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px">';
      for (var rsi3 = 0; rsi3 < uniqueRefServices.length; rsi3++) {
        var rs3 = uniqueRefServices[rsi3];
        var rs3Label = rs3.discount_percent >= 100 || rs3.discount_percent === 0
          ? '<span style="color:#10B981">Бесплатно</span>'
          : '<span style="color:#fbbf24">-' + rs3.discount_percent + '%</span>';
        h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#1a2236;border-radius:6px;font-size:0.8rem">' +
          '<span><i class="fas fa-check-circle" style="color:#10B981;margin-right:6px"></i>' + escHtml(rs3.name_ru || 'ID#' + rs3.service_id) + ' <span style="color:#64748b">\\u00d7' + (rs3.quantity || 1) + '</span></span>' +
          '<div style="display:flex;align-items:center;gap:8px">' + rs3Label +
          '<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:2px 4px" onclick="removeRefService(' + ref.id + ',' + rs3.id + ')"><i class="fas fa-times"></i></button></div></div>';
      }
      h += '</div>';
    }
    
    // Add service form — single select dropdown
    h += '<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">' +
      '<div style="flex:2;min-width:180px"><label style="font-size:0.68rem;color:#64748b;margin-bottom:3px;display:block">Услуга</label>' +
        '<select class="input" id="ref_addsvc_' + ref.id + '" style="font-size:0.8rem"><option value="">— Выберите услугу —</option>';
    for (var asi = 0; asi < allCalcServices.length; asi++) {
      var as2 = allCalcServices[asi];
      h += '<option value="' + as2.id + '">' + escHtml(as2.name_ru) + ' (' + escHtml(as2.tab) + ') — ' + Number(as2.price).toLocaleString('ru-RU') + ' \\u058f</option>';
    }
    h += '</select></div>' +
      '<div style="flex:0.5;min-width:60px"><label style="font-size:0.68rem;color:#64748b;margin-bottom:3px;display:block">Скидка %</label><input class="input" type="number" id="ref_adddisc_' + ref.id + '" value="100" min="0" max="100" style="font-size:0.8rem"></div>' +
      '<div style="flex:0.5;min-width:50px"><label style="font-size:0.68rem;color:#64748b;margin-bottom:3px;display:block">Кол-во</label><input class="input" type="number" id="ref_addqty_' + ref.id + '" value="1" min="1" max="999" style="font-size:0.8rem"></div>' +
      '<button class="btn btn-primary" style="padding:6px 12px;font-size:0.78rem;white-space:nowrap" onclick="addRefService(' + ref.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button>' +
    '</div>' +
    '<div style="font-size:0.62rem;color:#475569;margin-top:4px">100% = бесплатно. Добавляйте по одной услуге.</div>';
    h += '</div>';

    // Save button
    h += '<div style="margin-top:12px;text-align:right"><button class="btn btn-success" style="padding:10px 28px;font-size:0.88rem" onclick="saveReferral(' + ref.id + ')"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить изменения</button></div>';
    h += '</div>'; // end edit form
    
    h += '</div>'; // end card
  }
  
  h += '</div>';
  return h;
}

// ===== NEW REF: In-memory linked services tags for creation form =====
var _newRefLinkedSvcs = [];

function renderNewRefLinkedServicesTags() {
  var h = '';
  var svcs = window._allCalcServices || [];
  for (var i = 0; i < _newRefLinkedSvcs.length; i++) {
    var svcId = _newRefLinkedSvcs[i];
    var svcName = '';
    for (var j = 0; j < svcs.length; j++) {
      if (svcs[j].id === svcId) { svcName = svcs[j].name_ru; break; }
    }
    h += '<span style="font-size:0.75rem;padding:3px 8px;background:rgba(139,92,246,0.1);border-radius:5px;color:#a78bfa;border:1px solid rgba(139,92,246,0.2);display:flex;align-items:center;gap:4px">' +
      escHtml(svcName || 'ID#' + svcId) +
      '<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:0 2px;font-size:0.7rem" onclick="removeNewRefLinkedService(' + svcId + ')"><i class="fas fa-times"></i></button></span>';
  }
  return h;
}

function addNewRefLinkedService() {
  var sel = document.getElementById('new_ref_linked_svc');
  var svcId = parseInt(sel.value);
  if (!svcId) { toast('Выберите услугу', 'error'); return; }
  if (_newRefLinkedSvcs.indexOf(svcId) !== -1) { toast('Услуга уже добавлена', 'error'); return; }
  _newRefLinkedSvcs.push(svcId);
  sel.value = '';
  var container = document.getElementById('new_ref_linked_svcs_list');
  if (container) container.innerHTML = renderNewRefLinkedServicesTags();
}

function removeNewRefLinkedService(svcId) {
  _newRefLinkedSvcs = _newRefLinkedSvcs.filter(function(id) { return id !== svcId; });
  var container = document.getElementById('new_ref_linked_svcs_list');
  if (container) container.innerHTML = renderNewRefLinkedServicesTags();
}

// ===== NEW REF: In-memory attached services (free/discounted) for creation =====
function renderNewRefServicesTags() {
  var h = '';
  var svcs = window._allCalcServices || [];
  if (_newRefServices.length === 0) {
    h += '<div style="font-size:0.72rem;color:#64748b;padding:4px 0">Пока нет привязанных услуг.</div>';
    return h;
  }
  h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:6px">';
  for (var i = 0; i < _newRefServices.length; i++) {
    var svc = _newRefServices[i];
    var svcName = '';
    for (var j = 0; j < svcs.length; j++) {
      if (svcs[j].id === svc.service_id) { svcName = svcs[j].name_ru; break; }
    }
    var label = svc.discount_percent >= 100 || svc.discount_percent === 0 ? '<span style="color:#10B981">Бесплатно</span>' : '<span style="color:#fbbf24">-' + svc.discount_percent + '%</span>';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#1a2236;border-radius:6px;font-size:0.8rem">' +
      '<span><i class="fas fa-check-circle" style="color:#10B981;margin-right:6px"></i>' + escHtml(svcName || 'ID#' + svc.service_id) + ' <span style="color:#64748b">\\u00d7' + svc.quantity + '</span></span>' +
      '<div style="display:flex;align-items:center;gap:8px">' + label +
      '<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:2px 4px" onclick="removeNewRefService(' + i + ')"><i class="fas fa-times"></i></button></div></div>';
  }
  h += '</div>';
  return h;
}

function addNewRefService() {
  var sel = document.getElementById('new_ref_add_svc');
  var svcId = parseInt(sel.value);
  if (!svcId) { toast('Выберите услугу', 'error'); return; }
  var disc = parseInt(document.getElementById('new_ref_add_disc').value) || 100;
  var qty = parseInt(document.getElementById('new_ref_add_qty').value) || 1;
  // Check for duplicate
  for (var i = 0; i < _newRefServices.length; i++) {
    if (_newRefServices[i].service_id === svcId) { toast('Эта услуга уже добавлена', 'error'); return; }
  }
  _newRefServices.push({ service_id: svcId, discount_percent: disc, quantity: qty });
  sel.value = '';
  var container = document.getElementById('new_ref_services_list');
  if (container) container.innerHTML = renderNewRefServicesTags();
  toast('Услуга добавлена в список');
}

function removeNewRefService(idx) {
  _newRefServices.splice(idx, 1);
  var container = document.getElementById('new_ref_services_list');
  if (container) container.innerHTML = renderNewRefServicesTags();
}

// ===== EDIT: Linked services management (discount scope) =====
function addEditRefLinkedService(refId) {
  var sel = document.getElementById('ref_linked_svc_' + refId);
  var svcId = parseInt(sel.value);
  if (!svcId) { toast('Выберите услугу', 'error'); return; }
  // Find current ref and its linked_services
  var ref = data.referrals.find(function(r) { return r.id === refId; });
  if (!ref) return;
  var linked = [];
  try { linked = JSON.parse(ref.linked_services || '[]'); } catch(e) { linked = []; }
  if (linked.indexOf(svcId) !== -1) { toast('Услуга уже добавлена', 'error'); return; }
  linked.push(svcId);
  ref.linked_services = JSON.stringify(linked);
  sel.value = '';
  // Re-render the tags
  var svcs = window._allCalcServices || [];
  var container = document.getElementById('ref_linked_svcs_list_' + refId);
  if (container) {
    var h = '';
    for (var i = 0; i < linked.length; i++) {
      var id = linked[i];
      var name = '';
      for (var j = 0; j < svcs.length; j++) { if (svcs[j].id === id) { name = svcs[j].name_ru; break; } }
      h += '<span style="font-size:0.75rem;padding:3px 8px;background:rgba(139,92,246,0.1);border-radius:5px;color:#a78bfa;border:1px solid rgba(139,92,246,0.2);display:flex;align-items:center;gap:4px">' +
        escHtml(name || 'ID#' + id) +
        '<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:0 2px;font-size:0.7rem" onclick="removeEditRefLinkedService(' + refId + ',' + id + ')"><i class="fas fa-times"></i></button></span>';
    }
    container.innerHTML = h;
  }
}

function removeEditRefLinkedService(refId, svcId) {
  var ref = data.referrals.find(function(r) { return r.id === refId; });
  if (!ref) return;
  var linked = [];
  try { linked = JSON.parse(ref.linked_services || '[]'); } catch(e) { linked = []; }
  linked = linked.filter(function(id) { return id !== svcId; });
  ref.linked_services = JSON.stringify(linked);
  // Re-render
  var svcs = window._allCalcServices || [];
  var container = document.getElementById('ref_linked_svcs_list_' + refId);
  if (container) {
    var h = '';
    for (var i = 0; i < linked.length; i++) {
      var id = linked[i];
      var name = '';
      for (var j = 0; j < svcs.length; j++) { if (svcs[j].id === id) { name = svcs[j].name_ru; break; } }
      h += '<span style="font-size:0.75rem;padding:3px 8px;background:rgba(139,92,246,0.1);border-radius:5px;color:#a78bfa;border:1px solid rgba(139,92,246,0.2);display:flex;align-items:center;gap:4px">' +
        escHtml(name || 'ID#' + id) +
        '<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:0 2px;font-size:0.7rem" onclick="removeEditRefLinkedService(' + refId + ',' + id + ')"><i class="fas fa-times"></i></button></span>';
    }
    container.innerHTML = h;
  }
}

function toggleRefEditForm(refId) {
  var el = document.getElementById('ref-edit-' + refId);
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

async function addReferral() {
  var codeEl = document.getElementById('new_ref_code');
  var descEl = document.getElementById('new_ref_desc');
  var discEl = document.getElementById('new_ref_disc');
  var maxEl = document.getElementById('new_ref_max');
  var code = (codeEl?.value || '').trim();
  if (!code) { toast('Введите кодовое слово', 'error'); codeEl?.focus(); return; }
  var desc = (descEl?.value || '').trim();
  var disc = parseInt(discEl?.value || '0') || 0;
  var maxUses = parseInt(maxEl?.value || '0') || 0;
  var applyPkgEl = document.getElementById('new_ref_apply_pkg');
  var applyPkg = applyPkgEl ? applyPkgEl.checked : false;
  // Collect linked packages from checkboxes
  var linkedPkgs = [];
  document.querySelectorAll('.new_ref_pkg_cb:checked').forEach(function(cb) { linkedPkgs.push(parseInt(cb.value)); });
  // Linked services from in-memory array
  var linkedSvcs = _newRefLinkedSvcs.slice();
  // Active toggle
  var activeEl = document.getElementById('new_ref_active');
  var isActive = activeEl ? (activeEl.checked ? 1 : 0) : 1;
  // Create the code first
  var result = await api('/referrals', { method: 'POST', body: JSON.stringify({ code, description: desc, discount_percent: disc, max_uses: maxUses, apply_to_packages: applyPkg ? 1 : 0, linked_packages: linkedPkgs, linked_services: linkedSvcs, is_active: isActive }) });
  toast('Код "' + code.toUpperCase() + '" создан');
  
  // Now attach services (from _newRefServices in-memory list)
  if (_newRefServices.length > 0) {
    // Reload to get the new ID
    await loadData();
    var newRef = data.referrals.find(function(r) { return (r.code || '').toUpperCase() === code.toUpperCase(); });
    if (newRef) {
      for (var si = 0; si < _newRefServices.length; si++) {
        var svc = _newRefServices[si];
        await api('/referrals/' + newRef.id + '/services', { method: 'POST', body: JSON.stringify({
          service_id: svc.service_id,
          discount_percent: svc.discount_percent,
          quantity: svc.quantity
        }) });
      }
      toast(_newRefServices.length + ' услуг привязано к коду');
    }
  }
  
  // Clear form
  _newRefServices = [];
  _newRefLinkedSvcs = [];
  if (codeEl) codeEl.value = '';
  if (descEl) descEl.value = '';
  if (discEl) discEl.value = '0';
  if (maxEl) maxEl.value = '0';
  await loadData(); await loadRefServices(); render();
}

async function loadRefServices() {
  // Load attached services for each referral code
  for (var ri = 0; ri < (data.referrals || []).length; ri++) {
    var ref = data.referrals[ri];
    try {
      var res = await api('/referrals/' + ref.id + '/services');
      ref._services = (res && res.services) || [];
    } catch(e) { ref._services = []; }
  }
}

async function addRefService(refId) {
  var svcSelect = document.getElementById('ref_addsvc_' + refId);
  var discInput = document.getElementById('ref_adddisc_' + refId);
  var qtyInput = document.getElementById('ref_addqty_' + refId);
  if (!svcSelect) { toast('Выберите услугу', 'error'); return; }
  var svcId = parseInt(svcSelect.value);
  if (!svcId) { toast('Выберите услугу из списка', 'error'); return; }
  var disc = parseInt(discInput.value) || 100;
  var qty = parseInt(qtyInput.value) || 1;
  await api('/referrals/' + refId + '/services', { method: 'POST', body: JSON.stringify({
    service_id: svcId,
    discount_percent: disc,
    quantity: qty
  }) });
  toast('Услуга привязана к коду');
  svcSelect.value = '';
  await loadRefServices(); render();
}

async function removeRefService(refId, svcLinkId) {
  await api('/referrals/' + refId + '/services/' + svcLinkId, { method: 'DELETE' });
  toast('Услуга удалена из кода');
  await loadRefServices(); render();
}

async function saveReferral(id) {
  var ref = data.referrals.find(function(r) { return r.id === id; });
  if (!ref) return;
  var applyPkgEl = document.getElementById('ref_apply_pkg_' + id);
  // Collect linked packages from checkboxes
  var linkedPkgs = [];
  document.querySelectorAll('.ref_pkg_cb_' + id + ':checked').forEach(function(cb) { linkedPkgs.push(parseInt(cb.value)); });
  // Linked services from in-memory (modified by add/remove buttons)
  var linkedSvcs = [];
  try { linkedSvcs = JSON.parse(ref.linked_services || '[]'); } catch(e) { linkedSvcs = []; }
  await api('/referrals/' + id, { method: 'PUT', body: JSON.stringify({
    code: document.getElementById('ref_code_' + id).value,
    description: document.getElementById('ref_desc_' + id).value,
    discount_percent: parseInt(document.getElementById('ref_disc_' + id).value) || 0,
    max_uses: parseInt(document.getElementById('ref_max_' + id)?.value) || 0,
    is_active: ref.is_active,
    apply_to_packages: applyPkgEl ? (applyPkgEl.checked ? 1 : 0) : (ref.apply_to_packages || 0),
    linked_packages: linkedPkgs,
    linked_services: linkedSvcs
  }) });
  toast('Код сохранён');
  await loadData(); await loadRefServices(); render();
}

async function toggleReferral(id, active) {
  var ref = data.referrals.find(function(r) { return r.id === id; });
  if (!ref) return;
  await api('/referrals/' + id, { method: 'PUT', body: JSON.stringify({ ...ref, is_active: active }) });
  toast(active ? 'Код активирован' : 'Код деактивирован');
  await loadData(); await loadRefServices(); render();
}

async function deleteReferral(id) {
  if (!confirm('Удалить этот код?')) return;
  await api('/referrals/' + id, { method: 'DELETE' });
  toast('Код удалён');
  await loadData(); await loadRefServices(); render();
}

// ===== SECTION ORDER (now handled by renderBlocks, keep move/toggle helpers) =====
// renderSections is replaced by renderBlocks

async function saveSectionOrder() {
  await saveAllBlocks();
}

async function seedSections() {
  toast('Загрузка блоков...', 'info');
  await api('/section-order/seed', { method: 'PUT' });
  toast('Блоки загружены!');
  await loadData(); render();
}


`;
