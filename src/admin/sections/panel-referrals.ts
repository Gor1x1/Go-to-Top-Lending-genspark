/**
 * Admin Panel — Referral codes, section order
 * Full rewrite: dropdown service selection (one at a time), per-service quantity,
 * global discount, complex discount rules, deduplication, editing like creation
 * v2: Professional UI/UX redesign — clean cards, better stats, proper alignment
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
  
  // ── Overall promo analytics summary (moved to top) ──
  var totalRefUses = 0, totalRefPaid = 0, totalRefActive = 0, totalRefInactive = 0, totalFreeItems = 0;
  data.referrals.forEach(function(r) {
    totalRefUses += Number(r.uses_count || 0);
    totalRefPaid += Number(r.paid_uses_count || 0);
    if (r.is_active) totalRefActive++; else totalRefInactive++;
    var rSvcs = r._services || [];
    for (var si = 0; si < rSvcs.length; si++) {
      if (Number(rSvcs[si].discount_percent || 0) >= 100 || Number(rSvcs[si].discount_percent || 0) === 0) {
        totalFreeItems += Number(rSvcs[si].quantity || 1) * Number(r.uses_count || 0);
      }
    }
  });

  let h = '<div style="padding:24px 28px;max-width:1200px;margin:0 auto">';
  
  // ── Page header ──
  h += '<div style="margin-bottom:28px">' +
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">' +
      '<div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#8B5CF6,#6D28D9);display:flex;align-items:center;justify-content:center"><i class="fas fa-ticket-alt" style="color:white;font-size:1.1rem"></i></div>' +
      '<h1 style="font-size:1.6rem;font-weight:800;color:#f1f5f9;margin:0">Промокоды</h1>' +
    '</div>' +
    '<p style="color:#64748b;font-size:0.85rem;margin:0;padding-left:52px">Управление скидками, бесплатными услугами и реферальными программами</p>' +
  '</div>';

  // ── Stats grid ──
  h += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:28px">';
  var statsData = [
    { label: 'Всего кодов', value: data.referrals.length, icon: 'fas fa-hashtag', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
    { label: 'Активных', value: totalRefActive, icon: 'fas fa-check-circle', color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
    { label: 'Неактивных', value: totalRefInactive, icon: 'fas fa-pause-circle', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
    { label: 'Использований', value: totalRefUses, icon: 'fas fa-chart-line', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
    { label: 'Оплач. лидов', value: totalRefPaid, icon: 'fas fa-wallet', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' }
  ];
  for (var si = 0; si < statsData.length; si++) {
    var s = statsData[si];
    h += '<div style="background:' + s.bg + ';border:1px solid ' + s.color + '20;border-radius:12px;padding:16px;text-align:center">' +
      '<i class="' + s.icon + '" style="color:' + s.color + ';font-size:1.2rem;margin-bottom:8px;display:block"></i>' +
      '<div style="font-size:1.6rem;font-weight:800;color:' + s.color + ';line-height:1">' + s.value + '</div>' +
      '<div style="font-size:0.7rem;color:#64748b;margin-top:4px;font-weight:500">' + s.label + '</div>' +
    '</div>';
  }
  h += '</div>';

  // ── Create new promo code (collapsible) ──
  h += '<div style="margin-bottom:28px">' +
    '<button class="btn btn-primary" style="display:flex;align-items:center;gap:8px;padding:12px 24px;font-size:0.9rem;border-radius:12px;width:100%;justify-content:center;background:linear-gradient(135deg,#8B5CF6,#6D28D9);border:none" onclick="document.getElementById(\\\'newRefForm\\\').style.display=document.getElementById(\\\'newRefForm\\\').style.display===\\\'none\\\'?\\\'block\\\':\\\'none\\\'">' +
      '<i class="fas fa-plus-circle"></i> Создать новый промокод' +
    '</button>' +
    '<div id="newRefForm" style="display:none;margin-top:12px;border:1px solid rgba(139,92,246,0.2);background:rgba(139,92,246,0.02);border-radius:14px;padding:24px">';
  
  // Form fields
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">' +
    '<div><label style="font-size:0.72rem;color:#94a3b8;font-weight:600;margin-bottom:5px;display:block;text-transform:uppercase;letter-spacing:0.5px">Кодовое слово</label><input class="input" id="new_ref_code" placeholder="PROMO2026" style="text-transform:uppercase;font-weight:600;font-size:0.9rem"></div>' +
    '<div><label style="font-size:0.72rem;color:#94a3b8;font-weight:600;margin-bottom:5px;display:block;text-transform:uppercase;letter-spacing:0.5px">Глобальная скидка (%)</label><input class="input" type="number" id="new_ref_disc" value="0" min="0" max="100" style="font-size:0.9rem"></div>' +
  '</div>' +
  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">' +
    '<div><label style="font-size:0.72rem;color:#94a3b8;font-weight:600;margin-bottom:5px;display:block;text-transform:uppercase;letter-spacing:0.5px">Лимит использований</label><input class="input" type="number" id="new_ref_max" value="0" min="0" placeholder="0 = без лимита" style="font-size:0.9rem"></div>' +
    '<div><label style="font-size:0.72rem;color:#94a3b8;font-weight:600;margin-bottom:5px;display:block;text-transform:uppercase;letter-spacing:0.5px">Описание</label><input class="input" id="new_ref_desc" placeholder="Блогер, партнёр, VIP..." style="font-size:0.9rem"></div>' +
  '</div>';
  
  // Toggles
  h += '<div style="margin-bottom:14px;display:flex;gap:20px;flex-wrap:wrap">' +
    '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 14px;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:8px"><input type="checkbox" id="new_ref_active" checked> <span style="font-size:0.82rem;color:#10B981;font-weight:600"><i class="fas fa-toggle-on" style="margin-right:4px"></i>Активен</span></label>' +
    '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 14px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:8px"><input type="checkbox" id="new_ref_apply_pkg"> <span style="font-size:0.82rem;color:#f59e0b;font-weight:600"><i class="fas fa-box-open" style="margin-right:4px"></i>Применить к пакетам</span></label>' +
  '</div>';

  // Package checkboxes
  if (allCalcPackages.length > 0) {
    h += '<div style="margin-bottom:14px;padding:14px;background:rgba(245,158,11,0.04);border-radius:10px;border:1px solid rgba(245,158,11,0.12)">' +
      '<div style="font-size:0.72rem;color:#f59e0b;font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-box-open" style="margin-right:6px"></i>Привязка к пакетам</div><div style="display:flex;flex-wrap:wrap;gap:8px">';
    for (var npi = 0; npi < allCalcPackages.length; npi++) {
      var npk = allCalcPackages[npi];
      h += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.82rem;padding:6px 12px;background:#1e293b;border-radius:8px;border:1px solid #334155;transition:all 0.15s"><input type="checkbox" class="new_ref_pkg_cb" value="' + npk.id + '"> ' + escHtml(npk.name_ru) + '</label>';
    }
    h += '</div></div>';
  }

  // Service single-select dropdown for linked_services (discount scope)
  if (allCalcServices.length > 0) {
    h += '<div style="margin-bottom:14px;padding:14px;background:rgba(139,92,246,0.04);border-radius:10px;border:1px solid rgba(139,92,246,0.12)">' +
      '<div style="font-size:0.72rem;color:#a78bfa;font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-list-check" style="margin-right:6px"></i>Скидка ограничена услугами</div>' +
      '<div style="font-size:0.68rem;color:#64748b;margin-bottom:8px">Если пусто — скидка ко всем услугам</div>' +
      '<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">' +
        '<div style="flex:2;min-width:200px"><select class="input" id="new_ref_linked_svc" style="font-size:0.82rem"><option value="">— Выберите услугу —</option>';
    for (var nsi = 0; nsi < allCalcServices.length; nsi++) {
      var ns = allCalcServices[nsi];
      h += '<option value="' + ns.id + '">' + escHtml(ns.name_ru) + ' (' + escHtml(ns.tab) + ')</option>';
    }
    h += '</select></div>' +
      '<button class="btn btn-outline" style="padding:8px 14px;font-size:0.8rem;white-space:nowrap;border-radius:8px" onclick="addNewRefLinkedService()"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button>' +
      '</div>' +
      '<div id="new_ref_linked_svcs_list" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">';
    h += renderNewRefLinkedServicesTags();
    h += '</div></div>';
  }

  // ── Services to include with the code (free/discounted) ──
  h += '<div style="margin-bottom:16px;padding:14px;background:rgba(16,185,129,0.04);border-radius:10px;border:1px solid rgba(16,185,129,0.12)">' +
    '<div style="font-size:0.72rem;color:#10B981;font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-gift" style="margin-right:6px"></i>Бесплатные / со скидкой услуги</div>' +
    '<div style="font-size:0.68rem;color:#64748b;margin-bottom:10px">При наличии бесплатных услуг глобальная % скидка <strong style="color:#EF4444">не применяется</strong></div>';
  h += '<div id="new_ref_services_list">';
  h += renderNewRefServicesTags();
  h += '</div>';
  if (allCalcServices.length > 0) {
    h += '<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:10px">' +
      '<div style="flex:2;min-width:200px"><label style="font-size:0.68rem;color:#94a3b8;margin-bottom:3px;display:block">Услуга</label>' +
        '<select class="input" id="new_ref_add_svc" style="font-size:0.82rem"><option value="">— Выберите —</option>';
    for (var nai = 0; nai < allCalcServices.length; nai++) {
      var na = allCalcServices[nai];
      h += '<option value="' + na.id + '">' + escHtml(na.name_ru) + ' — ' + Number(na.price).toLocaleString('ru-RU') + ' \\u058f</option>';
    }
    h += '</select></div>' +
      '<div style="flex:0 0 80px"><label style="font-size:0.68rem;color:#94a3b8;margin-bottom:3px;display:block">Скидка %</label><input class="input" type="number" id="new_ref_add_disc" value="100" min="0" max="100" style="font-size:0.82rem"></div>' +
      '<div style="flex:0 0 70px"><label style="font-size:0.68rem;color:#94a3b8;margin-bottom:3px;display:block">Кол-во</label><input class="input" type="number" id="new_ref_add_qty" value="1" min="1" max="999" style="font-size:0.82rem"></div>' +
      '<button class="btn btn-primary" style="padding:8px 14px;font-size:0.8rem;white-space:nowrap;border-radius:8px" onclick="addNewRefService()"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button>' +
    '</div>' +
    '<div style="font-size:0.65rem;color:#475569;margin-top:6px">100% = бесплатно. Клиент выбирает 10 + промо даёт 5 бесплатных = <strong style="color:#10B981">15 в итоге</strong></div>';
  }
  h += '</div>';

  // Info box
  h += '<div style="margin-bottom:18px;padding:12px 16px;background:rgba(59,130,246,0.04);border-radius:10px;border:1px solid rgba(59,130,246,0.12);display:flex;gap:12px;align-items:flex-start">' +
    '<i class="fas fa-info-circle" style="color:#3B82F6;font-size:1rem;margin-top:2px;flex-shrink:0"></i>' +
    '<div style="font-size:0.75rem;color:#94a3b8;line-height:1.6">' +
      '<strong style="color:#3B82F6">Как работают правила:</strong> Лимит 10 использований, привязана услуга «Выкуп» \\u00d7 5 шт = <strong style="color:#10B981">50 бесплатных выкупов</strong>. ' +
      'Бесплатные услуги добавляются к выбранным клиентом (10 + 5 = 15).' +
    '</div></div>';

  h += '<button class="btn btn-primary" style="width:100%;padding:14px;font-size:0.95rem;border-radius:12px;background:linear-gradient(135deg,#8B5CF6,#6D28D9);border:none;font-weight:700" onclick="addReferral()"><i class="fas fa-plus" style="margin-right:8px"></i>Создать промокод</button>';
  h += '</div></div>'; // end newRefForm + wrapper

  // ── Existing codes list ──
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
    '<h2 style="font-size:1.1rem;font-weight:700;color:#e2e8f0;margin:0;display:flex;align-items:center;gap:8px"><i class="fas fa-list" style="color:#8B5CF6;font-size:0.9rem"></i>Промокоды <span style="font-size:0.8rem;color:#64748b;font-weight:500">(' + data.referrals.length + ')</span></h2>' +
  '</div>';

  if (!data.referrals.length) {
    h += '<div style="text-align:center;padding:60px 20px;background:rgba(30,41,59,0.5);border-radius:16px;border:1px dashed #334155">' +
      '<i class="fas fa-gift" style="font-size:3rem;color:#334155;margin-bottom:16px;display:block"></i>' +
      '<p style="color:#64748b;font-size:0.9rem;margin:0">Промокодов пока нет. Создайте первый!</p></div>';
  }

  for (const ref of data.referrals) {
    var refServices = ref._services || [];
    var paidCount = Number(ref.paid_uses_count || 0);
    var usesCount = Number(ref.uses_count || 0);
    var maxUses = Number(ref.max_uses || 0);
    var usagePct = maxUses > 0 ? Math.min(100, Math.round(usesCount / maxUses * 100)) : 0;
    var usageColor = maxUses > 0 && usesCount >= maxUses ? '#EF4444' : '#10B981';
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
    var hasFreeServices = false;
    for (var ti = 0; ti < uniqueRefServices.length; ti++) {
      totalItemsPerUse += Number(uniqueRefServices[ti].quantity || 1);
      if (Number(uniqueRefServices[ti].discount_percent || 0) >= 100 || Number(uniqueRefServices[ti].discount_percent || 0) === 0) hasFreeServices = true;
    }
    var totalItemsLifetime = maxUses > 0 ? totalItemsPerUse * maxUses : 0;

    var cardBorder = ref.is_active ? 'rgba(139,92,246,0.2)' : 'rgba(100,116,139,0.2)';
    var statusDot = ref.is_active ? '#10B981' : '#64748b';

    h += '<div class="card" style="margin-bottom:14px;border-radius:14px;border:1px solid ' + cardBorder + ';overflow:hidden;transition:all 0.2s">';
    
    // ── Card header: code + status + actions ──
    h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:linear-gradient(135deg,' + (ref.is_active ? 'rgba(139,92,246,0.04),rgba(16,185,129,0.02)' : 'rgba(30,41,59,0.6),rgba(30,41,59,0.3)') + ')">' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0">' +
        // Status dot
        '<div style="width:8px;height:8px;border-radius:50%;background:' + statusDot + ';flex-shrink:0;box-shadow:0 0 6px ' + statusDot + '60"></div>' +
        // Code badge
        '<span style="font-size:1.05rem;font-weight:800;color:#f1f5f9;letter-spacing:1.5px;font-family:monospace;background:rgba(139,92,246,0.12);padding:5px 14px;border-radius:8px;border:1px solid rgba(139,92,246,0.2)">' + escHtml(ref.code) + '</span>' +
        // Badges
        (ref.discount_percent > 0 ? '<span style="font-size:0.72rem;padding:3px 10px;border-radius:6px;font-weight:700;background:rgba(139,92,246,0.12);color:#a78bfa;border:1px solid rgba(139,92,246,0.2)">-' + ref.discount_percent + '%</span>' : '') +
        (hasFreeServices ? '<span style="font-size:0.72rem;padding:3px 10px;border-radius:6px;font-weight:600;background:rgba(16,185,129,0.1);color:#10B981;border:1px solid rgba(16,185,129,0.2)"><i class="fas fa-gift" style="margin-right:3px;font-size:0.65rem"></i>Бесплатные услуги</span>' : '') +
        (ref.description ? '<span style="font-size:0.75rem;color:#64748b;font-style:italic">' + escHtml(ref.description) + '</span>' : '') +
      '</div>' +
      // Actions
      '<div style="display:flex;gap:4px;flex-shrink:0">' +
        '<button style="width:32px;height:32px;border-radius:8px;border:1px solid #334155;background:rgba(139,92,246,0.06);color:#a78bfa;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s" onclick="toggleRefEditForm(' + ref.id + ')" title="Редактировать"><i class="fas fa-pen" style="font-size:0.72rem"></i></button>' +
        '<button style="width:32px;height:32px;border-radius:8px;border:1px solid #334155;background:rgba(' + (ref.is_active ? '245,158,11' : '16,185,129') + ',0.06);color:' + (ref.is_active ? '#f59e0b' : '#10B981') + ';cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s" onclick="toggleReferral(' + ref.id + ',' + (ref.is_active ? 0 : 1) + ')" title="' + (ref.is_active ? 'Деактивировать' : 'Активировать') + '"><i class="fas fa-' + (ref.is_active ? 'pause' : 'play') + '" style="font-size:0.72rem"></i></button>' +
        '<button style="width:32px;height:32px;border-radius:8px;border:1px solid rgba(239,68,68,0.2);background:rgba(239,68,68,0.06);color:#f87171;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s" onclick="deleteReferral(' + ref.id + ')" title="Удалить"><i class="fas fa-trash" style="font-size:0.72rem"></i></button>' +
      '</div>' +
    '</div>';
    
    // ── Stats row ──
    h += '<div style="padding:12px 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;border-bottom:1px solid rgba(51,65,85,0.5)">';
    // Uses count
    h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(139,92,246,0.04);border-radius:8px">' +
      '<i class="fas fa-mouse-pointer" style="color:#8B5CF6;font-size:0.75rem;width:16px;text-align:center"></i>' +
      '<div><div style="font-size:0.65rem;color:#64748b">Использований</div><div style="font-size:0.95rem;font-weight:700;color:#e2e8f0">' + usesCount + '</div></div></div>';
    // Paid
    h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(16,185,129,0.04);border-radius:8px">' +
      '<i class="fas fa-wallet" style="color:#10B981;font-size:0.75rem;width:16px;text-align:center"></i>' +
      '<div><div style="font-size:0.65rem;color:#64748b">Оплачено</div><div style="font-size:0.95rem;font-weight:700;color:' + usageColor + '">' + paidCount + (maxUses > 0 ? '<span style="color:#64748b;font-weight:400;font-size:0.75rem">/' + maxUses + '</span>' : '') + '</div></div></div>';
    // Limit %
    if (maxUses > 0) {
      h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(245,158,11,0.04);border-radius:8px">' +
        '<i class="fas fa-tachometer-alt" style="color:#F59E0B;font-size:0.75rem;width:16px;text-align:center"></i>' +
        '<div><div style="font-size:0.65rem;color:#64748b">Лимит</div><div style="font-size:0.95rem;font-weight:700;color:#F59E0B">' + usagePct + '%</div></div></div>';
    }
    // Total items
    if (totalItemsLifetime > 0) {
      h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(59,130,246,0.04);border-radius:8px">' +
        '<i class="fas fa-cubes" style="color:#3B82F6;font-size:0.75rem;width:16px;text-align:center"></i>' +
        '<div><div style="font-size:0.65rem;color:#64748b">Итого шт</div><div style="font-size:0.95rem;font-weight:700;color:#3B82F6">' + totalItemsLifetime + '</div></div></div>';
    }
    h += '</div>';
    
    // Usage progress bar
    if (maxUses > 0) {
      h += '<div style="padding:0 18px;margin:8px 0"><div style="background:#1e293b;border-radius:6px;overflow:hidden;height:4px"><div style="height:100%;background:linear-gradient(90deg,' + usageColor + ',' + usageColor + 'cc);width:' + usagePct + '%;transition:width 0.5s ease;border-radius:6px"></div></div></div>';
    }

    // ── Attached services ──
    if (uniqueRefServices.length > 0) {
      h += '<div style="padding:12px 18px;border-bottom:1px solid rgba(51,65,85,0.3)">' +
        '<div style="font-size:0.7rem;color:#10B981;font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-gift" style="margin-right:6px"></i>Привязанные услуги</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      for (var rsi2 = 0; rsi2 < uniqueRefServices.length; rsi2++) {
        var rs = uniqueRefServices[rsi2];
        var isFree = rs.discount_percent >= 100 || rs.discount_percent === 0;
        var rsLabel = isFree ? 'бесплатно' : '-' + rs.discount_percent + '%';
        var rsColor = isFree ? '#10B981' : '#F59E0B';
        h += '<span style="font-size:0.75rem;padding:5px 12px;background:rgba(30,41,59,0.8);border-radius:8px;color:#cbd5e1;border:1px solid ' + rsColor + '30;display:inline-flex;align-items:center;gap:6px">' +
          '<i class="fas fa-' + (isFree ? 'gift' : 'percent') + '" style="color:' + rsColor + ';font-size:0.65rem"></i>' +
          escHtml(rs.name_ru || 'ID#' + rs.service_id) +
          ' <span style="color:#64748b">\\u00d7' + (rs.quantity || 1) + '</span>' +
          ' <span style="color:' + rsColor + ';font-weight:700;font-size:0.7rem">' + rsLabel + '</span>' +
        '</span>';
      }
      h += '</div></div>';
    }

    // Linked packages summary
    if (refLinkedPkgs.length > 0) {
      h += '<div style="padding:10px 18px;border-bottom:1px solid rgba(51,65,85,0.3)">' +
        '<div style="font-size:0.7rem;color:#f59e0b;font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-box-open" style="margin-right:6px"></i>Пакеты</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      for (var lpk = 0; lpk < allCalcPackages.length; lpk++) {
        if (refLinkedPkgs.indexOf(allCalcPackages[lpk].id) !== -1) {
          h += '<span style="font-size:0.75rem;padding:4px 10px;background:rgba(245,158,11,0.06);border-radius:6px;color:#fbbf24;border:1px solid rgba(245,158,11,0.15)">' + escHtml(allCalcPackages[lpk].name_ru) + '</span>';
        }
      }
      h += '</div></div>';
    }
    
    // Linked services (discount scope)
    if (refLinkedSvcs.length > 0) {
      h += '<div style="padding:10px 18px;border-bottom:1px solid rgba(51,65,85,0.3)">' +
        '<div style="font-size:0.7rem;color:#a78bfa;font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-filter" style="margin-right:6px"></i>Скидка только на</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">';
      for (var lsi = 0; lsi < allCalcServices.length; lsi++) {
        if (refLinkedSvcs.indexOf(allCalcServices[lsi].id) !== -1) {
          h += '<span style="font-size:0.75rem;padding:4px 10px;background:rgba(139,92,246,0.06);border-radius:6px;color:#a78bfa;border:1px solid rgba(139,92,246,0.15)">' + escHtml(allCalcServices[lsi].name_ru) + '</span>';
        }
      }
      h += '</div></div>';
    }

    // ── Collapsible EDIT form ──
    h += '<div id="ref-edit-' + ref.id + '" style="display:none;padding:18px;border-top:2px solid rgba(139,92,246,0.2);background:rgba(139,92,246,0.02)">';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><i class="fas fa-pen" style="color:#a78bfa;font-size:0.85rem"></i><h4 style="font-size:0.9rem;font-weight:700;color:#a78bfa;margin:0">Редактирование: ' + escHtml(ref.code) + '</h4></div>';
    
    // Edit fields
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:0.7rem;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px">Код</label><input class="input" value="' + escHtml(ref.code) + '" id="ref_code_' + ref.id + '" style="font-weight:600;text-transform:uppercase"></div>' +
      '<div><label style="font-size:0.7rem;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px">Скидка (%)</label><input class="input" type="number" value="' + (ref.discount_percent || 0) + '" id="ref_disc_' + ref.id + '" min="0" max="100"></div>' +
      '<div><label style="font-size:0.7rem;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px">Лимит</label><input class="input" type="number" value="' + (ref.max_uses || 0) + '" id="ref_max_' + ref.id + '" min="0"></div>' +
    '</div>' +
    '<div style="margin-bottom:12px"><label style="font-size:0.7rem;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px">Описание</label><input class="input" value="' + escHtml(ref.description || '') + '" id="ref_desc_' + ref.id + '" placeholder="Комментарий..."></div>' +
    '<div style="margin-bottom:12px"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 12px;background:rgba(245,158,11,0.04);border-radius:6px;width:fit-content;border:1px solid rgba(245,158,11,0.1)"><input type="checkbox" id="ref_apply_pkg_' + ref.id + '" ' + (ref.apply_to_packages ? 'checked' : '') + '> <span style="font-size:0.8rem;color:#f59e0b;font-weight:600"><i class="fas fa-box-open" style="margin-right:4px"></i>К пакетам</span></label></div>';

    // Package checkboxes for edit
    if (allCalcPackages.length > 0) {
      h += '<div style="margin-bottom:12px;padding:10px;background:rgba(245,158,11,0.03);border-radius:8px;border:1px solid rgba(245,158,11,0.1)">' +
        '<div style="font-size:0.68rem;color:#f59e0b;font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-box-open" style="margin-right:4px"></i>Пакеты</div><div style="display:flex;flex-wrap:wrap;gap:8px">';
      for (var epi = 0; epi < allCalcPackages.length; epi++) {
        var epk = allCalcPackages[epi];
        var epkChecked = refLinkedPkgs.indexOf(epk.id) !== -1 ? 'checked' : '';
        h += '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:0.8rem;padding:5px 10px;background:#1e293b;border-radius:6px;border:1px solid #334155"><input type="checkbox" class="ref_pkg_cb_' + ref.id + '" value="' + epk.id + '" ' + epkChecked + '> ' + escHtml(epk.name_ru) + '</label>';
      }
      h += '</div></div>';
    }

    // Linked services edit
    h += '<div style="margin-bottom:12px;padding:10px;background:rgba(139,92,246,0.03);border-radius:8px;border:1px solid rgba(139,92,246,0.1)">' +
      '<div style="font-size:0.68rem;color:#a78bfa;font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-filter" style="margin-right:4px"></i>Скидка только на</div>' +
      '<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">' +
        '<div style="flex:2;min-width:180px"><select class="input" id="ref_linked_svc_' + ref.id + '" style="font-size:0.8rem"><option value="">— Выберите —</option>';
    for (var esi = 0; esi < allCalcServices.length; esi++) {
      var es = allCalcServices[esi];
      h += '<option value="' + es.id + '">' + escHtml(es.name_ru) + '</option>';
    }
    h += '</select></div>' +
      '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.78rem;white-space:nowrap;border-radius:6px" onclick="addEditRefLinkedService(' + ref.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button>' +
      '</div>' +
      '<div id="ref_linked_svcs_list_' + ref.id + '" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">';
    for (var lse = 0; lse < refLinkedSvcs.length; lse++) {
      var lseId = refLinkedSvcs[lse];
      var lseName = '';
      for (var fse = 0; fse < allCalcServices.length; fse++) {
        if (allCalcServices[fse].id === lseId) { lseName = allCalcServices[fse].name_ru; break; }
      }
      h += '<span style="font-size:0.75rem;padding:3px 8px;background:rgba(139,92,246,0.08);border-radius:6px;color:#a78bfa;border:1px solid rgba(139,92,246,0.15);display:flex;align-items:center;gap:4px">' +
        escHtml(lseName || 'ID#' + lseId) +
        '<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:0 2px;font-size:0.7rem" onclick="removeEditRefLinkedService(' + ref.id + ',' + lseId + ')"><i class="fas fa-times"></i></button></span>';
    }
    h += '</div></div>';

    // === Attached services management ===
    h += '<div style="margin-bottom:14px;border-top:1px solid #334155;padding-top:14px">' +
      '<div style="font-size:0.72rem;font-weight:700;color:#10B981;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px"><i class="fas fa-gift" style="margin-right:6px"></i>Бесплатные / со скидкой</div>';
    
    if (uniqueRefServices.length > 0) {
      h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">';
      for (var rsi3 = 0; rsi3 < uniqueRefServices.length; rsi3++) {
        var rs3 = uniqueRefServices[rsi3];
        var rs3Label = rs3.discount_percent >= 100 || rs3.discount_percent === 0
          ? '<span style="color:#10B981;font-weight:700;font-size:0.72rem">Бесплатно</span>'
          : '<span style="color:#fbbf24;font-weight:700;font-size:0.72rem">-' + rs3.discount_percent + '%</span>';
        h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#1a2236;border-radius:8px;font-size:0.82rem">' +
          '<span style="display:flex;align-items:center;gap:6px"><i class="fas fa-check-circle" style="color:#10B981;font-size:0.7rem"></i>' + escHtml(rs3.name_ru || 'ID#' + rs3.service_id) + ' <span style="color:#64748b">\\u00d7' + (rs3.quantity || 1) + '</span></span>' +
          '<div style="display:flex;align-items:center;gap:10px">' + rs3Label +
          '<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:2px 6px;font-size:0.72rem;border-radius:4px;transition:background 0.15s" onmouseover="this.style.background=\\\'rgba(239,68,68,0.1)\\\'" onmouseout="this.style.background=\\\'none\\\'" onclick="removeRefService(' + ref.id + ',' + rs3.id + ')"><i class="fas fa-times"></i></button></div></div>';
      }
      h += '</div>';
    }
    
    // Add service form
    h += '<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">' +
      '<div style="flex:2;min-width:180px"><label style="font-size:0.65rem;color:#94a3b8;margin-bottom:3px;display:block">Услуга</label>' +
        '<select class="input" id="ref_addsvc_' + ref.id + '" style="font-size:0.8rem"><option value="">— Выберите —</option>';
    for (var asi = 0; asi < allCalcServices.length; asi++) {
      var as2 = allCalcServices[asi];
      h += '<option value="' + as2.id + '">' + escHtml(as2.name_ru) + ' — ' + Number(as2.price).toLocaleString('ru-RU') + ' \\u058f</option>';
    }
    h += '</select></div>' +
      '<div style="flex:0 0 75px"><label style="font-size:0.65rem;color:#94a3b8;margin-bottom:3px;display:block">Скидка %</label><input class="input" type="number" id="ref_adddisc_' + ref.id + '" value="100" min="0" max="100" style="font-size:0.8rem"></div>' +
      '<div style="flex:0 0 65px"><label style="font-size:0.65rem;color:#94a3b8;margin-bottom:3px;display:block">Кол-во</label><input class="input" type="number" id="ref_addqty_' + ref.id + '" value="1" min="1" max="999" style="font-size:0.8rem"></div>' +
      '<button class="btn btn-primary" style="padding:8px 14px;font-size:0.78rem;white-space:nowrap;border-radius:8px" onclick="addRefService(' + ref.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button>' +
    '</div>' +
    '<div style="font-size:0.62rem;color:#475569;margin-top:4px">100% = бесплатно</div>';
    h += '</div>';

    // Save button
    h += '<div style="margin-top:14px;display:flex;justify-content:flex-end"><button class="btn btn-success" style="padding:10px 28px;font-size:0.88rem;border-radius:10px;font-weight:700" onclick="saveReferral(' + ref.id + ')"><i class="fas fa-save" style="margin-right:8px"></i>Сохранить</button></div>';
    h += '</div>'; // end edit form
    
    h += '</div>'; // end card
  }
  
  h += '</div>'; // end main wrapper
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
    h += '<span style="font-size:0.75rem;padding:4px 10px;background:rgba(139,92,246,0.08);border-radius:6px;color:#a78bfa;border:1px solid rgba(139,92,246,0.15);display:inline-flex;align-items:center;gap:5px">' +
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
    h += '<div style="font-size:0.75rem;color:#475569;padding:8px 0;display:flex;align-items:center;gap:6px"><i class="fas fa-info-circle" style="color:#334155"></i>Нет привязанных услуг</div>';
    return h;
  }
  h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">';
  for (var i = 0; i < _newRefServices.length; i++) {
    var svc = _newRefServices[i];
    var svcName = '';
    for (var j = 0; j < svcs.length; j++) {
      if (svcs[j].id === svc.service_id) { svcName = svcs[j].name_ru; break; }
    }
    var label = svc.discount_percent >= 100 || svc.discount_percent === 0 ? '<span style="color:#10B981;font-weight:700;font-size:0.72rem">Бесплатно</span>' : '<span style="color:#fbbf24;font-weight:700;font-size:0.72rem">-' + svc.discount_percent + '%</span>';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#1a2236;border-radius:8px;font-size:0.82rem">' +
      '<span style="display:flex;align-items:center;gap:6px"><i class="fas fa-check-circle" style="color:#10B981;font-size:0.7rem"></i>' + escHtml(svcName || 'ID#' + svc.service_id) + ' <span style="color:#64748b">\\u00d7' + svc.quantity + '</span></span>' +
      '<div style="display:flex;align-items:center;gap:10px">' + label +
      '<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:2px 4px;font-size:0.72rem" onclick="removeNewRefService(' + i + ')"><i class="fas fa-times"></i></button></div></div>';
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
  toast('Услуга добавлена');
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
  var ref = data.referrals.find(function(r) { return r.id === refId; });
  if (!ref) return;
  var linked = [];
  try { linked = JSON.parse(ref.linked_services || '[]'); } catch(e) { linked = []; }
  if (linked.indexOf(svcId) !== -1) { toast('Услуга уже добавлена', 'error'); return; }
  linked.push(svcId);
  ref.linked_services = JSON.stringify(linked);
  sel.value = '';
  var svcs = window._allCalcServices || [];
  var container = document.getElementById('ref_linked_svcs_list_' + refId);
  if (container) {
    var h = '';
    for (var i = 0; i < linked.length; i++) {
      var id = linked[i];
      var name = '';
      for (var j = 0; j < svcs.length; j++) { if (svcs[j].id === id) { name = svcs[j].name_ru; break; } }
      h += '<span style="font-size:0.75rem;padding:3px 8px;background:rgba(139,92,246,0.08);border-radius:6px;color:#a78bfa;border:1px solid rgba(139,92,246,0.15);display:flex;align-items:center;gap:4px">' +
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
  var svcs = window._allCalcServices || [];
  var container = document.getElementById('ref_linked_svcs_list_' + refId);
  if (container) {
    var h = '';
    for (var i = 0; i < linked.length; i++) {
      var id = linked[i];
      var name = '';
      for (var j = 0; j < svcs.length; j++) { if (svcs[j].id === id) { name = svcs[j].name_ru; break; } }
      h += '<span style="font-size:0.75rem;padding:3px 8px;background:rgba(139,92,246,0.08);border-radius:6px;color:#a78bfa;border:1px solid rgba(139,92,246,0.15);display:flex;align-items:center;gap:4px">' +
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
  var linkedPkgs = [];
  document.querySelectorAll('.new_ref_pkg_cb:checked').forEach(function(cb) { linkedPkgs.push(parseInt(cb.value)); });
  var linkedSvcs = _newRefLinkedSvcs.slice();
  var activeEl = document.getElementById('new_ref_active');
  var isActive = activeEl ? (activeEl.checked ? 1 : 0) : 1;
  var result = await api('/referrals', { method: 'POST', body: JSON.stringify({ code, description: desc, discount_percent: disc, max_uses: maxUses, apply_to_packages: applyPkg ? 1 : 0, linked_packages: linkedPkgs, linked_services: linkedSvcs, is_active: isActive }) });
  toast('Код "' + code.toUpperCase() + '" создан');
  
  if (_newRefServices.length > 0) {
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
      toast(_newRefServices.length + ' услуг привязано');
    }
  }
  
  _newRefServices = [];
  _newRefLinkedSvcs = [];
  if (codeEl) codeEl.value = '';
  if (descEl) descEl.value = '';
  if (discEl) discEl.value = '0';
  if (maxEl) maxEl.value = '0';
  document.getElementById('newRefForm').style.display = 'none';
  await loadData(); await loadRefServices(); render();
}

async function loadRefServices() {
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
  toast('Услуга привязана');
  svcSelect.value = '';
  await loadRefServices(); render();
}

async function removeRefService(refId, svcLinkId) {
  await api('/referrals/' + refId + '/services/' + svcLinkId, { method: 'DELETE' });
  toast('Услуга удалена');
  await loadRefServices(); render();
}

async function saveReferral(id) {
  var ref = data.referrals.find(function(r) { return r.id === id; });
  if (!ref) return;
  var applyPkgEl = document.getElementById('ref_apply_pkg_' + id);
  var linkedPkgs = [];
  document.querySelectorAll('.ref_pkg_cb_' + id + ':checked').forEach(function(cb) { linkedPkgs.push(parseInt(cb.value)); });
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
  if (!confirm('Удалить этот промокод? Это действие нельзя отменить.')) return;
  await api('/referrals/' + id, { method: 'DELETE' });
  toast('Код удалён');
  await loadData(); await loadRefServices(); render();
}

// ===== SECTION ORDER =====
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
