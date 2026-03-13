/**
 * Admin Panel — Referral codes management
 * v3: Separated promo types, proper stats, pro features, clean UI
 */
export const CODE: string = `
// ===== REFERRAL CODES =====
var _newRefServices = [];
var _newRefLinkedSvcs = [];
var _refSearchQuery = '';

function renderReferrals() {
  var allCalcPackages = (data.calcPackages || []).map(function(p) { return { id: p.id, name_ru: p.name_ru || '', name_am: p.name_am || '' }; });
  var allCalcServices = [];
  var tabsById = {};
  (data.calcTabs || []).forEach(function(tab) { tabsById[tab.id] = tab; });
  (data.calcServices || []).forEach(function(svc) {
    var tab = tabsById[svc.tab_id] || {};
    allCalcServices.push({ id: svc.id, name_ru: svc.name_ru, name_am: svc.name_am, price: svc.price, tab: tab.name_ru || '' });
  });
  window._allCalcServices = allCalcServices;
  
  // Stats
  var totalCodes = data.referrals.length;
  var totalActive = 0, totalInactive = 0, totalUses = 0, totalPaid = 0;
  data.referrals.forEach(function(r) {
    totalUses += Number(r.uses_count || 0);
    totalPaid += Number(r.paid_uses_count || 0);
    if (r.is_active) totalActive++; else totalInactive++;
  });

  // Filter
  var filtered = data.referrals;
  if (_refSearchQuery) {
    var q = _refSearchQuery.toLowerCase();
    filtered = data.referrals.filter(function(r) {
      return (r.code || '').toLowerCase().indexOf(q) !== -1 || (r.description || '').toLowerCase().indexOf(q) !== -1;
    });
  }

  var h = '<div style="padding:20px 24px;max-width:1100px;margin:0 auto">';
  
  // Header
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">' +
    '<div style="display:flex;align-items:center;gap:10px">' +
      '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#8B5CF6,#6D28D9);display:flex;align-items:center;justify-content:center"><i class="fas fa-ticket-alt" style="color:#fff;font-size:1rem"></i></div>' +
      '<div><h1 style="font-size:1.4rem;font-weight:800;color:#f1f5f9;margin:0;line-height:1.2">Промокоды</h1>' +
      '<div style="font-size:0.72rem;color:#64748b">Скидки и бесплатные услуги для клиентов</div></div>' +
    '</div>' +
    '<button class="btn btn-primary" style="padding:10px 20px;font-size:0.85rem;border-radius:10px;background:linear-gradient(135deg,#8B5CF6,#6D28D9);border:none;font-weight:600" onclick="document.getElementById(\\\'newRefForm\\\').style.display=document.getElementById(\\\'newRefForm\\\').style.display===\\\'none\\\'?\\\'block\\\':\\\'none\\\'"><i class="fas fa-plus" style="margin-right:6px"></i>Новый промокод</button>' +
  '</div>';

  // Stats row
  h += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px">';
  [[totalCodes,'Всего','#8B5CF6','fa-hashtag'],[totalActive,'Активных','#10B981','fa-check-circle'],[totalInactive,'Выкл.','#EF4444','fa-pause-circle'],[totalUses,'Использ.','#F59E0B','fa-mouse-pointer'],[totalPaid,'Оплачено','#3B82F6','fa-wallet']].forEach(function(s) {
    h += '<div style="background:' + s[2] + '0c;border:1px solid ' + s[2] + '25;border-radius:10px;padding:12px 10px;text-align:center">' +
      '<div style="font-size:1.4rem;font-weight:800;color:' + s[2] + ';line-height:1">' + s[0] + '</div>' +
      '<div style="font-size:0.65rem;color:#64748b;margin-top:3px">' + s[1] + '</div></div>';
  });
  h += '</div>';

  // ══════ CREATE FORM (collapsible) ══════
  h += '<div id="newRefForm" style="display:none;margin-bottom:24px;border:1px solid rgba(139,92,246,0.2);background:rgba(15,10,30,0.5);border-radius:14px;overflow:hidden">';
  
  // Form header
  h += '<div style="padding:16px 20px;background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(139,92,246,0.02));border-bottom:1px solid rgba(139,92,246,0.15)">' +
    '<div style="font-size:1rem;font-weight:700;color:#a78bfa;display:flex;align-items:center;gap:8px"><i class="fas fa-plus-circle"></i>Создать промокод</div></div>';
  
  h += '<div style="padding:20px">';

  // Row 1: Code + Description
  h += '<div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;margin-bottom:14px">' +
    '<div><label class="ref-label">Код</label><input class="input" id="new_ref_code" placeholder="PROMO2026" style="text-transform:uppercase;font-weight:700;font-size:1rem;letter-spacing:1px"></div>' +
    '<div><label class="ref-label">Описание</label><input class="input" id="new_ref_desc" placeholder="Для блогера / партнёра / акция..."></div>' +
  '</div>';

  // Row 2: Discount + Limit + Active
  h += '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:12px;margin-bottom:16px;align-items:end">' +
    '<div><label class="ref-label">Скидка на услуги (%)</label><input class="input" type="number" id="new_ref_disc" value="0" min="0" max="100" style="font-size:0.9rem"><div style="font-size:0.6rem;color:#475569;margin-top:2px">0 = без скидки. Скидка на выбранные или все услуги</div></div>' +
    '<div><label class="ref-label">Лимит использований</label><input class="input" type="number" id="new_ref_max" value="0" min="0" style="font-size:0.9rem"><div style="font-size:0.6rem;color:#475569;margin-top:2px">0 = безлимитный</div></div>' +
    '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:10px 14px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:8px;white-space:nowrap;height:fit-content"><input type="checkbox" id="new_ref_active" checked><span style="font-size:0.8rem;color:#10B981;font-weight:600">Активен</span></label>' +
  '</div>';

  // ── Section: Скидка ограничена услугами ──
  h += '<div style="margin-bottom:14px;padding:14px 16px;background:rgba(139,92,246,0.03);border-radius:10px;border:1px solid rgba(139,92,246,0.12)">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
      '<div style="font-size:0.75rem;font-weight:700;color:#a78bfa"><i class="fas fa-filter" style="margin-right:6px"></i>Скидка действует только на:</div>' +
      '<div style="font-size:0.6rem;color:#475569">пусто = на все услуги</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<select class="input" id="new_ref_linked_svc" style="font-size:0.82rem;flex:1;min-width:200px"><option value="">— Выберите услугу —</option>';
  for (var nsi = 0; nsi < allCalcServices.length; nsi++) {
    h += '<option value="' + allCalcServices[nsi].id + '">' + escHtml(allCalcServices[nsi].name_ru) + '</option>';
  }
  h += '</select><button class="btn btn-outline" style="padding:7px 12px;font-size:0.78rem;border-radius:6px" onclick="addNewRefLinkedService()"><i class="fas fa-plus"></i></button></div>' +
    '<div id="new_ref_linked_svcs_list" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">' + renderNewRefLinkedServicesTags() + '</div></div>';

  // ── Section: Бесплатные / со скидкой услуги ──
  h += '<div style="margin-bottom:14px;padding:14px 16px;background:rgba(16,185,129,0.03);border-radius:10px;border:1px solid rgba(16,185,129,0.12)">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
      '<div style="font-size:0.75rem;font-weight:700;color:#10B981"><i class="fas fa-gift" style="margin-right:6px"></i>Бесплатные / со скидкой услуги</div>' +
    '</div>' +
    '<div style="font-size:0.65rem;color:#64748b;margin-bottom:10px">Клиент выбрал 10 шт + промо 5 бесплатных = <strong style="color:#10B981">оплата за 10, получает 15</strong>. Скидка 100% = бесплатно.</div>' +
    '<div id="new_ref_services_list" style="margin-bottom:8px">' + renderNewRefServicesTags() + '</div>';
  if (allCalcServices.length > 0) {
    h += '<div style="display:grid;grid-template-columns:1fr 80px 70px auto;gap:8px;align-items:end">' +
      '<div><select class="input" id="new_ref_add_svc" style="font-size:0.8rem"><option value="">— Услуга —</option>';
    for (var nai = 0; nai < allCalcServices.length; nai++) {
      h += '<option value="' + allCalcServices[nai].id + '">' + escHtml(allCalcServices[nai].name_ru) + ' — ' + Number(allCalcServices[nai].price).toLocaleString('ru-RU') + ' \\u058f</option>';
    }
    h += '</select></div>' +
      '<div><label style="font-size:0.6rem;color:#64748b;display:block;margin-bottom:2px">Скидка%</label><input class="input" type="number" id="new_ref_add_disc" value="100" min="0" max="100" style="font-size:0.8rem"></div>' +
      '<div><label style="font-size:0.6rem;color:#64748b;display:block;margin-bottom:2px">Кол-во</label><input class="input" type="number" id="new_ref_add_qty" value="1" min="1" max="999" style="font-size:0.8rem"></div>' +
      '<button class="btn btn-primary" style="padding:7px 14px;font-size:0.78rem;border-radius:6px" onclick="addNewRefService()"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button></div>';
  }
  h += '</div>';

  // ── Section: Пакеты ──
  if (allCalcPackages.length > 0) {
    h += '<div style="margin-bottom:14px;padding:14px 16px;background:rgba(245,158,11,0.03);border-radius:10px;border:1px solid rgba(245,158,11,0.12)">' +
      '<div style="font-size:0.75rem;font-weight:700;color:#f59e0b;margin-bottom:8px"><i class="fas fa-box-open" style="margin-right:6px"></i>Привязка к пакетам <span style="font-size:0.6rem;color:#64748b;font-weight:400">(пусто = не привязан)</span></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">';
    for (var npi = 0; npi < allCalcPackages.length; npi++) {
      h += '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:0.8rem;padding:5px 10px;background:#1e293b;border-radius:6px;border:1px solid #334155"><input type="checkbox" class="new_ref_pkg_cb" value="' + allCalcPackages[npi].id + '"> ' + escHtml(allCalcPackages[npi].name_ru) + '</label>';
    }
    h += '</div></div>';
  }

  // Create button
  h += '<button class="btn btn-primary" style="width:100%;padding:12px;font-size:0.9rem;border-radius:10px;background:linear-gradient(135deg,#8B5CF6,#6D28D9);border:none;font-weight:700" onclick="addReferral()"><i class="fas fa-check" style="margin-right:8px"></i>Создать</button>';
  h += '</div></div>'; // end form

  // ══════ SEARCH ══════
  if (totalCodes > 2) {
    h += '<div style="margin-bottom:16px"><input class="input" placeholder="\\ud83d\\udd0d Поиск по коду или описанию..." value="' + escHtml(_refSearchQuery) + '" oninput="_refSearchQuery=this.value;render()" style="font-size:0.85rem;padding:10px 14px;border-radius:10px"></div>';
  }

  // ══════ PROMO CARDS ══════
  if (!filtered.length) {
    h += '<div style="text-align:center;padding:48px 20px;background:rgba(30,41,59,0.4);border-radius:14px;border:1px dashed #334155">' +
      '<i class="fas fa-gift" style="font-size:2.5rem;color:#334155;margin-bottom:12px;display:block"></i>' +
      '<p style="color:#64748b;font-size:0.85rem;margin:0">' + (_refSearchQuery ? 'Ничего не найдено' : 'Промокодов пока нет') + '</p></div>';
  }

  for (var ci = 0; ci < filtered.length; ci++) {
    var ref = filtered[ci];
    h += renderRefCard(ref, allCalcPackages, allCalcServices);
  }
  
  h += '</div>'; // end main
  
  // Inject micro CSS for labels
  h += '<style>.ref-label{font-size:0.68rem;color:#94a3b8;font-weight:600;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.3px}</style>';
  return h;
}

function renderRefCard(ref, allCalcPackages, allCalcServices) {
  var refServices = ref._services || [];
  var usesCount = Number(ref.uses_count || 0);
  var paidCount = Number(ref.paid_uses_count || 0);
  var maxUses = Number(ref.max_uses || 0);
  var pct = maxUses > 0 ? Math.min(100, Math.round(usesCount / maxUses * 100)) : 0;
  var pctColor = maxUses > 0 && usesCount >= maxUses ? '#EF4444' : '#10B981';
  var refLinkedPkgs = []; try { refLinkedPkgs = JSON.parse(ref.linked_packages || '[]'); } catch(e) {}
  var refLinkedSvcs = []; try { refLinkedSvcs = JSON.parse(ref.linked_services || '[]'); } catch(e) {}
  
  // Deduplicate
  var seen = {}; var uniSvcs = [];
  refServices.forEach(function(s) { if (!seen[s.service_id]) { seen[s.service_id] = true; uniSvcs.push(s); } });
  
  // Calc totals
  var totalPerUse = 0; var hasFree = false; var hasDisc = false;
  uniSvcs.forEach(function(s) {
    totalPerUse += Number(s.quantity || 1);
    var dp = Number(s.discount_percent || 0);
    if (dp >= 100 || dp === 0) hasFree = true; else hasDisc = true;
  });
  var totalLifetime = maxUses > 0 ? totalPerUse * maxUses : 0;
  var isActive = !!ref.is_active;
  
  var h = '<div class="card" style="margin-bottom:12px;border-radius:12px;border:1px solid ' + (isActive ? '#334155' : '#1e293b') + ';overflow:hidden;opacity:' + (isActive ? '1' : '0.7') + '">';
  
  // ── Header ──
  h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:' + (isActive ? 'rgba(139,92,246,0.04)' : 'rgba(30,41,59,0.5)') + '">';
  // Left: code + badges
  h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0">' +
    '<span style="font-family:monospace;font-size:1.05rem;font-weight:800;color:#f1f5f9;background:rgba(139,92,246,0.12);padding:4px 12px;border-radius:6px;letter-spacing:1px;cursor:pointer" onclick="navigator.clipboard.writeText(\\\'' + escHtml(ref.code) + '\\\');toast(\\\'Код скопирован\\\')" title="Нажмите чтобы скопировать">' + escHtml(ref.code) + ' <i class="fas fa-copy" style="font-size:0.6rem;color:#64748b;margin-left:2px"></i></span>';
  if (isActive) h += '<span style="width:6px;height:6px;border-radius:50%;background:#10B981;box-shadow:0 0 6px #10B98180"></span>';
  if (ref.discount_percent > 0) h += '<span style="font-size:0.7rem;padding:2px 8px;border-radius:5px;font-weight:700;background:rgba(139,92,246,0.12);color:#a78bfa">-' + ref.discount_percent + '%</span>';
  if (hasFree) h += '<span style="font-size:0.7rem;padding:2px 8px;border-radius:5px;font-weight:600;background:rgba(16,185,129,0.1);color:#10B981"><i class="fas fa-gift" style="font-size:0.6rem;margin-right:3px"></i>Бонус</span>';
  if (ref.description) h += '<span style="font-size:0.72rem;color:#64748b">' + escHtml(ref.description) + '</span>';
  h += '</div>';
  // Right: actions
  h += '<div style="display:flex;gap:3px;flex-shrink:0">' +
    '<button style="width:30px;height:30px;border-radius:6px;border:1px solid #334155;background:transparent;color:#a78bfa;cursor:pointer;display:flex;align-items:center;justify-content:center" onclick="toggleRefEditForm(' + ref.id + ')" title="Редактировать"><i class="fas fa-pen" style="font-size:0.68rem"></i></button>' +
    '<button style="width:30px;height:30px;border-radius:6px;border:1px solid #334155;background:transparent;color:' + (isActive ? '#f59e0b' : '#10B981') + ';cursor:pointer;display:flex;align-items:center;justify-content:center" onclick="toggleReferral(' + ref.id + ',' + (isActive ? 0 : 1) + ')" title="' + (isActive ? 'Выключить' : 'Включить') + '"><i class="fas fa-' + (isActive ? 'pause' : 'play') + '" style="font-size:0.68rem"></i></button>' +
    '<button style="width:30px;height:30px;border-radius:6px;border:1px solid rgba(239,68,68,0.2);background:transparent;color:#f87171;cursor:pointer;display:flex;align-items:center;justify-content:center" onclick="deleteReferral(' + ref.id + ')"><i class="fas fa-trash" style="font-size:0.68rem"></i></button></div>';
  h += '</div>';
  
  // ── Stats bar ──
  h += '<div style="display:flex;gap:0;border-bottom:1px solid #1e293b">';
  var stats = [
    ['Использований', usesCount, '#8B5CF6'],
    ['Оплачено', paidCount + (maxUses > 0 ? '/' + maxUses : ''), pctColor],
  ];
  if (maxUses > 0) stats.push(['Лимит', pct + '%', pct >= 80 ? '#EF4444' : '#F59E0B']);
  if (totalLifetime > 0) stats.push(['Всего шт', totalPerUse + '/исп \\u00d7 ' + maxUses + ' = ' + totalLifetime, '#3B82F6']);
  stats.forEach(function(s, i) {
    h += '<div style="flex:1;padding:8px 12px;' + (i > 0 ? 'border-left:1px solid #1e293b;' : '') + '">' +
      '<div style="font-size:0.58rem;color:#64748b;margin-bottom:1px">' + s[0] + '</div>' +
      '<div style="font-size:0.85rem;font-weight:700;color:' + s[2] + '">' + s[1] + '</div></div>';
  });
  h += '</div>';
  
  // Progress bar
  if (maxUses > 0) {
    h += '<div style="height:3px;background:#0f172a"><div style="height:100%;background:' + pctColor + ';width:' + pct + '%;transition:width 0.3s"></div></div>';
  }

  // ── Services summary ──
  if (uniSvcs.length > 0) {
    h += '<div style="padding:10px 16px;border-bottom:1px solid #1e293b">' +
      '<div style="display:flex;flex-wrap:wrap;gap:5px">';
    uniSvcs.forEach(function(s) {
      var isFree = s.discount_percent >= 100 || s.discount_percent === 0;
      var col = isFree ? '#10B981' : '#F59E0B';
      var lbl = isFree ? 'бесплатно' : '-' + s.discount_percent + '%';
      h += '<span style="font-size:0.72rem;padding:4px 10px;background:rgba(30,41,59,0.8);border-radius:6px;color:#cbd5e1;border:1px solid ' + col + '25;display:inline-flex;align-items:center;gap:4px">' +
        '<i class="fas fa-' + (isFree ? 'gift' : 'percent') + '" style="color:' + col + ';font-size:0.58rem"></i>' +
        escHtml(s.name_ru || 'ID#' + s.service_id) + ' \\u00d7' + (s.quantity || 1) +
        ' <span style="color:' + col + ';font-weight:700;font-size:0.65rem">' + lbl + '</span></span>';
    });
    h += '</div></div>';
  }

  // Linked packages + services scope
  if (refLinkedPkgs.length > 0 || refLinkedSvcs.length > 0) {
    h += '<div style="padding:8px 16px;border-bottom:1px solid #1e293b;display:flex;flex-wrap:wrap;gap:4px;align-items:center">';
    if (refLinkedSvcs.length > 0) {
      h += '<span style="font-size:0.62rem;color:#a78bfa;font-weight:600;margin-right:4px"><i class="fas fa-filter" style="margin-right:3px"></i>Скидка на:</span>';
      refLinkedSvcs.forEach(function(id) {
        var nm = ''; allCalcServices.forEach(function(s) { if (s.id === id) nm = s.name_ru; });
        h += '<span style="font-size:0.68rem;padding:2px 7px;background:rgba(139,92,246,0.06);border-radius:4px;color:#a78bfa;border:1px solid rgba(139,92,246,0.12)">' + escHtml(nm || '#' + id) + '</span>';
      });
    }
    if (refLinkedPkgs.length > 0) {
      h += '<span style="font-size:0.62rem;color:#f59e0b;font-weight:600;margin-right:4px;' + (refLinkedSvcs.length > 0 ? 'margin-left:8px;' : '') + '"><i class="fas fa-box-open" style="margin-right:3px"></i>Пакеты:</span>';
      refLinkedPkgs.forEach(function(id) {
        var nm = ''; allCalcPackages.forEach(function(p) { if (p.id === id) nm = p.name_ru; });
        h += '<span style="font-size:0.68rem;padding:2px 7px;background:rgba(245,158,11,0.06);border-radius:4px;color:#fbbf24;border:1px solid rgba(245,158,11,0.12)">' + escHtml(nm || '#' + id) + '</span>';
      });
    }
    h += '</div>';
  }

  // ══════ EDIT FORM (collapsible) ══════
  h += '<div id="ref-edit-' + ref.id + '" style="display:none;padding:16px;border-top:2px solid rgba(139,92,246,0.2);background:rgba(139,92,246,0.02)">';
  h += '<div style="font-size:0.85rem;font-weight:700;color:#a78bfa;margin-bottom:14px;display:flex;align-items:center;gap:6px"><i class="fas fa-pen"></i>Редактирование: ' + escHtml(ref.code) + '</div>';
  
  // Edit row 1
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">' +
    '<div><label class="ref-label">Код</label><input class="input" value="' + escHtml(ref.code) + '" id="ref_code_' + ref.id + '" style="font-weight:600;text-transform:uppercase"></div>' +
    '<div><label class="ref-label">Скидка (%)</label><input class="input" type="number" value="' + (ref.discount_percent || 0) + '" id="ref_disc_' + ref.id + '" min="0" max="100"></div>' +
    '<div><label class="ref-label">Лимит</label><input class="input" type="number" value="' + (ref.max_uses || 0) + '" id="ref_max_' + ref.id + '" min="0"></div>' +
  '</div>';
  h += '<div style="margin-bottom:10px"><label class="ref-label">Описание</label><input class="input" value="' + escHtml(ref.description || '') + '" id="ref_desc_' + ref.id + '" placeholder="Комментарий..."></div>';

  // Packages edit
  if (allCalcPackages.length > 0) {
    h += '<div style="margin-bottom:10px;padding:10px;background:rgba(245,158,11,0.03);border-radius:8px;border:1px solid rgba(245,158,11,0.1)">' +
      '<div style="font-size:0.68rem;color:#f59e0b;font-weight:600;margin-bottom:6px"><i class="fas fa-box-open" style="margin-right:4px"></i>Пакеты</div><div style="display:flex;flex-wrap:wrap;gap:6px">';
    allCalcPackages.forEach(function(p) {
      h += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.78rem;padding:4px 8px;background:#1e293b;border-radius:5px;border:1px solid #334155"><input type="checkbox" class="ref_pkg_cb_' + ref.id + '" value="' + p.id + '" ' + (refLinkedPkgs.indexOf(p.id) !== -1 ? 'checked' : '') + '> ' + escHtml(p.name_ru) + '</label>';
    });
    h += '</div></div>';
  }

  // Linked services edit
  h += '<div style="margin-bottom:10px;padding:10px;background:rgba(139,92,246,0.03);border-radius:8px;border:1px solid rgba(139,92,246,0.1)">' +
    '<div style="font-size:0.68rem;color:#a78bfa;font-weight:600;margin-bottom:6px"><i class="fas fa-filter" style="margin-right:4px"></i>Скидка только на (пусто = все)</div>' +
    '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
      '<select class="input" id="ref_linked_svc_' + ref.id + '" style="font-size:0.78rem;flex:1;min-width:160px"><option value="">— Услуга —</option>';
  allCalcServices.forEach(function(s) {
    h += '<option value="' + s.id + '">' + escHtml(s.name_ru) + '</option>';
  });
  h += '</select><button class="btn btn-outline" style="padding:5px 10px;font-size:0.75rem;border-radius:5px" onclick="addEditRefLinkedService(' + ref.id + ')"><i class="fas fa-plus"></i></button></div>' +
    '<div id="ref_linked_svcs_list_' + ref.id + '" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">';
  refLinkedSvcs.forEach(function(id) {
    var nm = ''; allCalcServices.forEach(function(s) { if (s.id === id) nm = s.name_ru; });
    h += '<span style="font-size:0.72rem;padding:2px 8px;background:rgba(139,92,246,0.08);border-radius:5px;color:#a78bfa;border:1px solid rgba(139,92,246,0.15);display:inline-flex;align-items:center;gap:3px">' + escHtml(nm || '#' + id) + '<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:0 2px" onclick="removeEditRefLinkedService(' + ref.id + ',' + id + ')"><i class="fas fa-times" style="font-size:0.6rem"></i></button></span>';
  });
  h += '</div></div>';

  // Attached services edit
  h += '<div style="margin-bottom:14px;padding:10px;background:rgba(16,185,129,0.03);border-radius:8px;border:1px solid rgba(16,185,129,0.1)">' +
    '<div style="font-size:0.68rem;font-weight:600;color:#10B981;margin-bottom:8px"><i class="fas fa-gift" style="margin-right:4px"></i>Привязанные услуги (бесплатные / со скидкой)</div>';
  if (uniSvcs.length > 0) {
    h += '<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px">';
    uniSvcs.forEach(function(s) {
      var lbl = s.discount_percent >= 100 || s.discount_percent === 0 ? '<span style="color:#10B981;font-weight:700;font-size:0.7rem">Бесплатно</span>' : '<span style="color:#fbbf24;font-weight:700;font-size:0.7rem">-' + s.discount_percent + '%</span>';
      h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#1a2236;border-radius:6px;font-size:0.78rem">' +
        '<span style="display:flex;align-items:center;gap:5px"><i class="fas fa-check" style="color:#10B981;font-size:0.6rem"></i>' + escHtml(s.name_ru || '#' + s.service_id) + ' <span style="color:#64748b">\\u00d7' + (s.quantity || 1) + '</span></span>' +
        '<div style="display:flex;align-items:center;gap:8px">' + lbl + '<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:2px" onclick="removeRefService(' + ref.id + ',' + s.id + ')"><i class="fas fa-times" style="font-size:0.65rem"></i></button></div></div>';
    });
    h += '</div>';
  }
  h += '<div style="display:grid;grid-template-columns:1fr 75px 65px auto;gap:6px;align-items:end">' +
    '<select class="input" id="ref_addsvc_' + ref.id + '" style="font-size:0.78rem"><option value="">— Услуга —</option>';
  allCalcServices.forEach(function(s) {
    h += '<option value="' + s.id + '">' + escHtml(s.name_ru) + ' — ' + Number(s.price).toLocaleString('ru-RU') + ' \\u058f</option>';
  });
  h += '</select><div><label style="font-size:0.58rem;color:#64748b;display:block;margin-bottom:1px">%</label><input class="input" type="number" id="ref_adddisc_' + ref.id + '" value="100" min="0" max="100" style="font-size:0.78rem"></div>' +
    '<div><label style="font-size:0.58rem;color:#64748b;display:block;margin-bottom:1px">Шт</label><input class="input" type="number" id="ref_addqty_' + ref.id + '" value="1" min="1" max="999" style="font-size:0.78rem"></div>' +
    '<button class="btn btn-primary" style="padding:7px 12px;font-size:0.75rem;border-radius:6px" onclick="addRefService(' + ref.id + ')"><i class="fas fa-plus"></i></button></div></div>';

  // Save
  h += '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">' +
    '<button class="btn btn-outline" style="padding:8px 16px;font-size:0.82rem;border-radius:8px" onclick="toggleRefEditForm(' + ref.id + ')">Отмена</button>' +
    '<button class="btn btn-success" style="padding:8px 24px;font-size:0.82rem;border-radius:8px;font-weight:700" onclick="saveReferral(' + ref.id + ')"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить</button></div>';
  h += '</div>'; // end edit
  
  h += '</div>'; // end card
  return h;
}

// ===== NEW: linked services tags =====
var _newRefLinkedSvcs = [];
function renderNewRefLinkedServicesTags() {
  var h = '';
  var svcs = window._allCalcServices || [];
  _newRefLinkedSvcs.forEach(function(svcId) {
    var nm = ''; svcs.forEach(function(s) { if (s.id === svcId) nm = s.name_ru; });
    h += '<span style="font-size:0.72rem;padding:3px 8px;background:rgba(139,92,246,0.08);border-radius:5px;color:#a78bfa;border:1px solid rgba(139,92,246,0.15);display:inline-flex;align-items:center;gap:3px">' + escHtml(nm || '#' + svcId) + '<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:0 2px" onclick="removeNewRefLinkedService(' + svcId + ')"><i class="fas fa-times" style="font-size:0.6rem"></i></button></span>';
  });
  return h;
}
function addNewRefLinkedService() {
  var sel = document.getElementById('new_ref_linked_svc');
  var svcId = parseInt(sel.value);
  if (!svcId) { toast('Выберите услугу', 'error'); return; }
  if (_newRefLinkedSvcs.indexOf(svcId) !== -1) { toast('Уже добавлена', 'error'); return; }
  _newRefLinkedSvcs.push(svcId); sel.value = '';
  document.getElementById('new_ref_linked_svcs_list').innerHTML = renderNewRefLinkedServicesTags();
}
function removeNewRefLinkedService(svcId) {
  _newRefLinkedSvcs = _newRefLinkedSvcs.filter(function(id) { return id !== svcId; });
  document.getElementById('new_ref_linked_svcs_list').innerHTML = renderNewRefLinkedServicesTags();
}

// ===== NEW: attached services tags =====
function renderNewRefServicesTags() {
  var svcs = window._allCalcServices || [];
  if (!_newRefServices.length) return '<div style="font-size:0.72rem;color:#475569;padding:4px 0"><i class="fas fa-info-circle" style="margin-right:4px;color:#334155"></i>Нет привязанных услуг</div>';
  var h = '<div style="display:flex;flex-direction:column;gap:4px">';
  _newRefServices.forEach(function(svc, i) {
    var nm = ''; svcs.forEach(function(s) { if (s.id === svc.service_id) nm = s.name_ru; });
    var lbl = svc.discount_percent >= 100 || svc.discount_percent === 0 ? '<span style="color:#10B981;font-weight:700;font-size:0.7rem">Бесплатно</span>' : '<span style="color:#fbbf24;font-weight:700;font-size:0.7rem">-' + svc.discount_percent + '%</span>';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#1a2236;border-radius:6px;font-size:0.78rem">' +
      '<span style="display:flex;align-items:center;gap:5px"><i class="fas fa-check" style="color:#10B981;font-size:0.6rem"></i>' + escHtml(nm || '#' + svc.service_id) + ' <span style="color:#64748b">\\u00d7' + svc.quantity + '</span></span>' +
      '<div style="display:flex;align-items:center;gap:8px">' + lbl + '<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:2px" onclick="removeNewRefService(' + i + ')"><i class="fas fa-times" style="font-size:0.65rem"></i></button></div></div>';
  });
  return h + '</div>';
}
function addNewRefService() {
  var sel = document.getElementById('new_ref_add_svc');
  var svcId = parseInt(sel.value);
  if (!svcId) { toast('Выберите услугу', 'error'); return; }
  var disc = parseInt(document.getElementById('new_ref_add_disc').value) || 100;
  var qty = parseInt(document.getElementById('new_ref_add_qty').value) || 1;
  for (var i = 0; i < _newRefServices.length; i++) { if (_newRefServices[i].service_id === svcId) { toast('Уже добавлена', 'error'); return; } }
  _newRefServices.push({ service_id: svcId, discount_percent: disc, quantity: qty }); sel.value = '';
  document.getElementById('new_ref_services_list').innerHTML = renderNewRefServicesTags();
  toast('Услуга добавлена');
}
function removeNewRefService(idx) {
  _newRefServices.splice(idx, 1);
  document.getElementById('new_ref_services_list').innerHTML = renderNewRefServicesTags();
}

// ===== EDIT: linked services =====
function addEditRefLinkedService(refId) {
  var sel = document.getElementById('ref_linked_svc_' + refId);
  var svcId = parseInt(sel.value);
  if (!svcId) { toast('Выберите услугу', 'error'); return; }
  var ref = data.referrals.find(function(r) { return r.id === refId; });
  if (!ref) return;
  var linked = []; try { linked = JSON.parse(ref.linked_services || '[]'); } catch(e) {}
  if (linked.indexOf(svcId) !== -1) { toast('Уже добавлена', 'error'); return; }
  linked.push(svcId); ref.linked_services = JSON.stringify(linked); sel.value = '';
  var svcs = window._allCalcServices || [];
  var c = document.getElementById('ref_linked_svcs_list_' + refId);
  if (c) { var h = ''; linked.forEach(function(id) { var nm='';svcs.forEach(function(s){if(s.id===id)nm=s.name_ru;}); h+='<span style="font-size:0.72rem;padding:2px 8px;background:rgba(139,92,246,0.08);border-radius:5px;color:#a78bfa;border:1px solid rgba(139,92,246,0.15);display:inline-flex;align-items:center;gap:3px">'+escHtml(nm||'#'+id)+'<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:0 2px" onclick="removeEditRefLinkedService('+refId+','+id+')"><i class="fas fa-times" style="font-size:0.6rem"></i></button></span>';}); c.innerHTML=h; }
}
function removeEditRefLinkedService(refId, svcId) {
  var ref = data.referrals.find(function(r) { return r.id === refId; });
  if (!ref) return;
  var linked = []; try { linked = JSON.parse(ref.linked_services || '[]'); } catch(e) {}
  linked = linked.filter(function(id) { return id !== svcId; }); ref.linked_services = JSON.stringify(linked);
  var svcs = window._allCalcServices || [];
  var c = document.getElementById('ref_linked_svcs_list_' + refId);
  if (c) { var h=''; linked.forEach(function(id){var nm='';svcs.forEach(function(s){if(s.id===id)nm=s.name_ru;});h+='<span style="font-size:0.72rem;padding:2px 8px;background:rgba(139,92,246,0.08);border-radius:5px;color:#a78bfa;border:1px solid rgba(139,92,246,0.15);display:inline-flex;align-items:center;gap:3px">'+escHtml(nm||'#'+id)+'<button style="background:none;border:none;color:#EF4444;cursor:pointer;padding:0 2px" onclick="removeEditRefLinkedService('+refId+','+id+')"><i class="fas fa-times" style="font-size:0.6rem"></i></button></span>';}); c.innerHTML=h; }
}
function toggleRefEditForm(refId) { var el=document.getElementById('ref-edit-'+refId); if(el) el.style.display=el.style.display==='none'?'block':'none'; }

// ===== CRUD =====
async function addReferral() {
  var code = (document.getElementById('new_ref_code')?.value||'').trim();
  if (!code) { toast('Введите код', 'error'); return; }
  var desc = (document.getElementById('new_ref_desc')?.value||'').trim();
  var disc = parseInt(document.getElementById('new_ref_disc')?.value||'0')||0;
  var maxUses = parseInt(document.getElementById('new_ref_max')?.value||'0')||0;
  var linkedPkgs = []; document.querySelectorAll('.new_ref_pkg_cb:checked').forEach(function(cb){linkedPkgs.push(parseInt(cb.value));});
  var linkedSvcs = _newRefLinkedSvcs.slice();
  var isActive = document.getElementById('new_ref_active')?.checked ? 1 : 0;
  await api('/referrals', { method:'POST', body:JSON.stringify({code,description:desc,discount_percent:disc,max_uses:maxUses,apply_to_packages:linkedPkgs.length>0?1:0,linked_packages:linkedPkgs,linked_services:linkedSvcs,is_active:isActive}) });
  toast('Промокод "'+code.toUpperCase()+'" создан');
  if (_newRefServices.length > 0) {
    await loadData();
    var newRef = data.referrals.find(function(r){return (r.code||'').toUpperCase()===code.toUpperCase();});
    if (newRef) { for (var i=0;i<_newRefServices.length;i++) { var s=_newRefServices[i]; await api('/referrals/'+newRef.id+'/services',{method:'POST',body:JSON.stringify({service_id:s.service_id,discount_percent:s.discount_percent,quantity:s.quantity})}); } toast(_newRefServices.length+' услуг привязано'); }
  }
  _newRefServices=[]; _newRefLinkedSvcs=[];
  document.getElementById('new_ref_code').value=''; document.getElementById('new_ref_desc').value='';
  document.getElementById('new_ref_disc').value='0'; document.getElementById('new_ref_max').value='0';
  document.getElementById('newRefForm').style.display='none';
  await loadData(); await loadRefServices(); render();
}
async function loadRefServices() {
  for (var i=0;i<(data.referrals||[]).length;i++) {
    var ref=data.referrals[i];
    try { var res=await api('/referrals/'+ref.id+'/services'); ref._services=(res&&res.services)||[]; } catch(e){ref._services=[];}
  }
}
async function addRefService(refId) {
  var sel=document.getElementById('ref_addsvc_'+refId); if(!sel) return;
  var svcId=parseInt(sel.value); if(!svcId){toast('Выберите услугу','error');return;}
  var disc=parseInt(document.getElementById('ref_adddisc_'+refId).value)||100;
  var qty=parseInt(document.getElementById('ref_addqty_'+refId).value)||1;
  await api('/referrals/'+refId+'/services',{method:'POST',body:JSON.stringify({service_id:svcId,discount_percent:disc,quantity:qty})});
  toast('Услуга привязана'); sel.value=''; await loadRefServices(); render();
}
async function removeRefService(refId, svcLinkId) {
  await api('/referrals/'+refId+'/services/'+svcLinkId,{method:'DELETE'});
  toast('Удалено'); await loadRefServices(); render();
}
async function saveReferral(id) {
  var ref=data.referrals.find(function(r){return r.id===id;}); if(!ref) return;
  var linkedPkgs=[]; document.querySelectorAll('.ref_pkg_cb_'+id+':checked').forEach(function(cb){linkedPkgs.push(parseInt(cb.value));});
  var linkedSvcs=[]; try{linkedSvcs=JSON.parse(ref.linked_services||'[]');}catch(e){}
  await api('/referrals/'+id,{method:'PUT',body:JSON.stringify({
    code:document.getElementById('ref_code_'+id).value,
    description:document.getElementById('ref_desc_'+id).value,
    discount_percent:parseInt(document.getElementById('ref_disc_'+id).value)||0,
    max_uses:parseInt(document.getElementById('ref_max_'+id)?.value)||0,
    is_active:ref.is_active,
    apply_to_packages:linkedPkgs.length>0?1:0,
    linked_packages:linkedPkgs,
    linked_services:linkedSvcs
  })});
  toast('Сохранено'); await loadData(); await loadRefServices(); render();
}
async function toggleReferral(id, active) {
  var ref=data.referrals.find(function(r){return r.id===id;}); if(!ref) return;
  await api('/referrals/'+id,{method:'PUT',body:JSON.stringify({...ref,is_active:active})});
  toast(active?'Активирован':'Деактивирован'); await loadData(); await loadRefServices(); render();
}
async function deleteReferral(id) {
  if(!confirm('Удалить этот промокод навсегда?')) return;
  await api('/referrals/'+id,{method:'DELETE'}); toast('Удалён');
  await loadData(); await loadRefServices(); render();
}

// ===== SECTION ORDER =====
async function saveSectionOrder() { await saveAllBlocks(); }
async function seedSections() { toast('Загрузка...','info'); await api('/section-order/seed',{method:'PUT'}); toast('Готово!'); await loadData(); render(); }
`;
