/**
 * Admin Panel — Dashboard rendering
 * 313 lines of admin SPA JS code
 */
export const CODE: string = `
// ===== DASHBOARD =====
function renderDashboard() {
  var s = data.stats || {};
  // If dashboard data not loaded yet (bulk-data doesn't include it), load /stats async
  if (!s.dashboard && !s._dashLoading) {
    s._dashLoading = true;
    api('/stats').then(function(fullStats) {
      if (fullStats && !fullStats.error) {
        // Merge full stats into data.stats
        data.stats = fullStats;
        data.stats._dashLoaded = true;
      }
      s._dashLoading = false;
      render();
    });
    return '<div style="padding:32px;text-align:center"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:16px;color:#a78bfa"><i class="fas fa-tachometer-alt" style="margin-right:8px"></i>Дашборд</h1><div style="margin-top:40px"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#8B5CF6"></i><div style="color:#94a3b8;margin-top:12px">Загрузка данных дашборда...</div></div></div>';
  }
  var a = s.analytics || {};
  var daily = a.daily || [];
  var refs = a.referrers || [];
  var langs = a.languages || [];
  var ld = s.leads || {};
  var db = s.dashboard || {};
  var stb = db.status_breakdown || {};
  
  // Helper: format amount
  function fa(v) { return Number(v || 0).toLocaleString('ru-RU') + ' ֏'; }
  function fn(v) { return Number(v || 0).toLocaleString('ru-RU'); }
  // Trend arrow
  function trend(curr, prev) {
    if (!prev || prev == 0) return '';
    var pct = Math.round(((curr - prev) / prev) * 100);
    if (pct > 0) return '<span style="color:#22C55E;font-size:0.72rem;margin-left:6px"><i class="fas fa-arrow-up"></i> +' + pct + '%</span>';
    if (pct < 0) return '<span style="color:#EF4444;font-size:0.72rem;margin-left:6px"><i class="fas fa-arrow-down"></i> ' + pct + '%</span>';
    return '<span style="color:#64748b;font-size:0.72rem;margin-left:6px">0%</span>';
  }
  
  // Status labels
  var statusLabels = { new: '🟢 Новые', contacted: '💬 На связи', in_progress: '🔄 В работе', checking: '🔍 Проверка', done: '✅ Завершён', rejected: '❌ Отклонён' };
  var statusColors = { new: '#22C55E', contacted: '#0EA5E9', in_progress: '#F59E0B', checking: '#8B5CF6', done: '#10B981', rejected: '#EF4444' };
  
  var h = '<div style="padding:32px;max-width:1400px">';
  
  // ===== HEADER =====
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">';
  h += '<div><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:4px"><i class="fas fa-tachometer-alt" style="color:#8B5CF6;margin-right:8px"></i>Дашборд</h1>';
  h += '<p style="color:#94a3b8;font-size:0.88rem">Главные метрики бизнеса в реальном времени</p></div>';
  var now = new Date(); var dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  h += '<div style="text-align:right;color:#64748b;font-size:0.82rem"><div style="font-weight:600;color:#e2e8f0">' + dayNames[now.getDay()] + ', ' + now.toLocaleDateString('ru-RU') + '</div><div>' + now.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'}) + '</div></div>';
  h += '</div>';
  
  // ===== ALERTS =====
  if (ld.new > 0) {
    h += '<div style="background:linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.05));border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px 24px;margin-bottom:20px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all 0.2s" onclick="navigate(&apos;leads&apos;)" onmouseover="this.style.transform=&apos;translateY(-1px)&apos;" onmouseout="this.style.transform=&apos;&apos;">' +
      '<div style="width:42px;height:42px;border-radius:50%;background:rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:center"><i class="fas fa-bell" style="color:#EF4444;font-size:1.1rem"></i></div>' +
      '<div style="flex:1"><strong style="color:#f87171;font-size:1rem">' + ld.new + ' новых заявок ожидают обработки!</strong><div style="color:#94a3b8;font-size:0.82rem;margin-top:2px">Нажмите, чтобы перейти к лидам</div></div>' +
      '<i class="fas fa-chevron-right" style="color:#f87171"></i></div>';
  }
  
  // ===== KPI ROW 1: ФИНАНСЫ =====
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px">';
  
  // Оборот
  h += '<div class="card" style="padding:20px;background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(139,92,246,0.04));border:1px solid rgba(139,92,246,0.25)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:0.78rem;color:#a78bfa;font-weight:600"><i class="fas fa-chart-line" style="margin-right:4px"></i>Оборот</span></div>' +
    '<div style="font-size:1.6rem;font-weight:900;color:#e2e8f0">' + fa(db.turnover) + '</div>' +
    '<div style="font-size:0.72rem;color:#64748b;margin-top:4px">В работе + Проверка + Завершён</div></div>';
  
  // Чистая прибыль
  var profitColor = (db.net_profit || 0) >= 0 ? '#22C55E' : '#EF4444';
  h += '<div class="card" style="padding:20px;background:linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.04));border:1px solid rgba(34,197,94,0.25)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:0.78rem;color:#4ADE80;font-weight:600"><i class="fas fa-wallet" style="margin-right:4px"></i>Чистая прибыль</span></div>' +
    '<div style="font-size:1.6rem;font-weight:900;color:' + profitColor + '">' + fa(db.net_profit) + '</div>' +
    '<div style="font-size:0.72rem;color:#64748b;margin-top:4px">Оборот − Расходы − Возвраты</div></div>';
  
  // Средний чек
  h += '<div class="card" style="padding:20px;background:linear-gradient(135deg,rgba(59,130,246,0.12),rgba(59,130,246,0.04));border:1px solid rgba(59,130,246,0.25)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:0.78rem;color:#60A5FA;font-weight:600"><i class="fas fa-receipt" style="margin-right:4px"></i>Средний чек</span></div>' +
    '<div style="font-size:1.6rem;font-weight:900;color:#e2e8f0">' + fa(db.avg_check) + '</div>' +
    '<div style="font-size:0.72rem;color:#64748b;margin-top:4px">Из ' + fn(db.done_count) + ' завершённых</div></div>';
  
  // Конверсия
  h += '<div class="card" style="padding:20px;background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.04));border:1px solid rgba(245,158,11,0.25)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:0.78rem;color:#FBBF24;font-weight:600"><i class="fas fa-funnel-dollar" style="margin-right:4px"></i>Конверсия</span></div>' +
    '<div style="font-size:1.6rem;font-weight:900;color:#e2e8f0">' + (db.conversion || 0) + '%</div>' +
    '<div style="font-size:0.72rem;color:#64748b;margin-top:4px">' + fn(db.done_count) + ' из ' + fn(ld.total) + ' лидов</div></div>';
  
  h += '</div>';
  
  // ===== KPI ROW 2: ЛИДЫ + РАСХОДЫ =====
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">';
  
  // Расходы
  h += '<div class="card" style="padding:16px">' +
    '<div style="font-size:0.75rem;color:#f87171;font-weight:600;margin-bottom:6px"><i class="fas fa-minus-circle" style="margin-right:4px"></i>Расходы</div>' +
    '<div style="font-size:1.2rem;font-weight:800;color:#f87171">' + fa(db.total_expenses) + '</div></div>';
  
  // Маркетинг
  h += '<div class="card" style="padding:16px">' +
    '<div style="font-size:0.75rem;color:#F59E0B;font-weight:600;margin-bottom:6px"><i class="fas fa-bullhorn" style="margin-right:4px"></i>Маркетинг</div>' +
    '<div style="font-size:1.2rem;font-weight:800;color:#F59E0B">' + fa(db.marketing_expenses) + '</div></div>';
  
  // Возвраты
  h += '<div class="card" style="padding:16px">' +
    '<div style="font-size:0.75rem;color:#EF4444;font-weight:600;margin-bottom:6px"><i class="fas fa-undo-alt" style="margin-right:4px"></i>Возвраты</div>' +
    '<div style="font-size:1.2rem;font-weight:800;color:#EF4444">' + fa(db.refunds) + '</div></div>';
  
  // Комиссии
  h += '<div class="card" style="padding:16px">' +
    '<div style="font-size:0.75rem;color:#3B82F6;font-weight:600;margin-bottom:6px"><i class="fas fa-credit-card" style="margin-right:4px"></i>Комиссии</div>' +
    '<div style="font-size:1.2rem;font-weight:800;color:#3B82F6">' + fa(db.commissions) + '</div></div>';
  
  // Лиды за неделю
  h += '<div class="card" style="padding:16px">' +
    '<div style="font-size:0.75rem;color:#a78bfa;font-weight:600;margin-bottom:6px"><i class="fas fa-users" style="margin-right:4px"></i>Лиды за неделю</div>' +
    '<div style="font-size:1.2rem;font-weight:800;color:#e2e8f0">' + fn(db.leads_this_week) + trend(db.leads_this_week, db.leads_last_week) + '</div></div>';
  
  // Лиды сегодня
  h += '<div class="card" style="padding:16px">' +
    '<div style="font-size:0.75rem;color:#10B981;font-weight:600;margin-bottom:6px"><i class="fas fa-calendar-day" style="margin-right:4px"></i>Сегодня лидов</div>' +
    '<div style="font-size:1.2rem;font-weight:800;color:#10B981">' + fn(ld.today) + '</div></div>';
  
  h += '</div>';
  
  // ===== TWO COLUMNS: STATUS FUNNEL + RECENT LEADS =====
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">';
  
  // --- LEFT: STATUS FUNNEL ---
  h += '<div class="card" style="padding:20px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:0.95rem"><i class="fas fa-filter" style="color:#8B5CF6;margin-right:8px"></i>Воронка статусов</h3>';
  var statusOrder = ['new','contacted','in_progress','checking','done','rejected'];
  var maxCount = 0;
  for (var si = 0; si < statusOrder.length; si++) { var sc = (stb[statusOrder[si]] || {}).count || 0; if (sc > maxCount) maxCount = sc; }
  for (var si = 0; si < statusOrder.length; si++) {
    var sk = statusOrder[si];
    var sv = stb[sk] || { count: 0, amount: 0 };
    var barW = maxCount > 0 ? Math.max(8, Math.round((sv.count / maxCount) * 100)) : 8;
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;cursor:pointer" onclick="navigate(&apos;leads&apos;)">' +
      '<div style="width:120px;font-size:0.78rem;color:#94a3b8;white-space:nowrap">' + (statusLabels[sk] || sk) + '</div>' +
      '<div style="flex:1;background:#1e293b;border-radius:6px;height:28px;position:relative;overflow:hidden">' +
        '<div style="width:' + barW + '%;height:100%;background:' + (statusColors[sk] || '#8B5CF6') + '30;border-radius:6px;transition:width 0.5s"></div>' +
        '<div style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:0.78rem;font-weight:700;color:' + (statusColors[sk] || '#e2e8f0') + '">' + sv.count + '</div>' +
      '</div>' +
      '<div style="width:110px;text-align:right;font-size:0.75rem;color:#64748b;white-space:nowrap">' + (sv.amount > 0 ? fa(sv.amount) : '—') + '</div>' +
    '</div>';
  }
  h += '</div>';
  
  // --- RIGHT: RECENT LEADS ---
  h += '<div class="card" style="padding:20px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="font-weight:700;font-size:0.95rem"><i class="fas fa-clock" style="color:#F59E0B;margin-right:8px"></i>Последние заявки</h3>';
  h += '<button class="btn btn-outline" style="padding:4px 12px;font-size:0.72rem" onclick="navigate(&apos;leads&apos;)">Все лиды →</button></div>';
  var recent = db.recent_leads || [];
  if (recent.length === 0) {
    h += '<div style="text-align:center;color:#64748b;padding:20px;font-size:0.85rem">Нет заявок</div>';
  } else {
    for (var ri = 0; ri < recent.length; ri++) {
      var rl = recent[ri];
      var rlStatus = statusLabels[rl.status] || rl.status;
      var rlColor = statusColors[rl.status] || '#64748b';
      var rlTime = rl.created_at ? new Date(rl.created_at + (rl.created_at.includes('Z') ? '' : 'Z')).toLocaleString('ru-RU', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
      h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1e293b">' +
        '<div style="width:6px;height:6px;border-radius:50%;background:' + rlColor + ';flex-shrink:0"></div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:0.82rem;font-weight:600;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(rl.name || 'Без имени') + '</div>' +
          '<div style="font-size:0.7rem;color:#64748b">' + rlTime + (rl.source ? ' · ' + escHtml(rl.source) : '') + '</div>' +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0">' +
          (rl.total_amount > 0 ? '<div style="font-size:0.82rem;font-weight:700;color:#e2e8f0">' + fa(rl.total_amount) + '</div>' : '') +
          '<div style="font-size:0.68rem;color:' + rlColor + '">' + rlStatus + '</div>' +
        '</div>' +
      '</div>';
    }
  }
  h += '</div>';
  h += '</div>';
  
  // ===== TWO COLUMNS: SOURCES + ASSIGNEES =====
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">';
  
  // --- LEFT: SOURCES ---
  h += '<div class="card" style="padding:20px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:0.95rem"><i class="fas fa-satellite-dish" style="color:#0EA5E9;margin-right:8px"></i>Источники лидов</h3>';
  var sources = db.leads_by_source || [];
  if (sources.length === 0) {
    h += '<div style="text-align:center;color:#64748b;padding:16px;font-size:0.85rem">Нет данных</div>';
  } else {
    var srcTotal = 0; for (var xi = 0; xi < sources.length; xi++) srcTotal += Number(sources[xi].count || 0);
    var srcColors = ['#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#6366F1','#14B8A6'];
    var srcNames = { calculator_pdf: '🧮 Калькулятор', contact_form: '📋 Форма', telegram: '📱 Telegram', unknown: '❓ Прочее', manual: '✍️ Ручной' };
    for (var xi = 0; xi < sources.length; xi++) {
      var src = sources[xi];
      var srcPct = srcTotal > 0 ? Math.round((src.count / srcTotal) * 100) : 0;
      var srcClr = srcColors[xi % srcColors.length];
      h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
        '<div style="flex:1;font-size:0.82rem;color:#e2e8f0">' + (srcNames[src.source] || escHtml(src.source)) + '</div>' +
        '<div style="width:120px;background:#1e293b;border-radius:4px;height:18px;position:relative">' +
          '<div style="width:' + srcPct + '%;height:100%;background:' + srcClr + '60;border-radius:4px"></div>' +
        '</div>' +
        '<div style="width:60px;text-align:right;font-size:0.78rem;font-weight:700;color:#e2e8f0">' + src.count + ' <span style="color:#64748b;font-weight:400">(' + srcPct + '%)</span></div>' +
      '</div>';
    }
  }
  h += '</div>';
  
  // --- RIGHT: ASSIGNEES ---
  h += '<div class="card" style="padding:20px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:0.95rem"><i class="fas fa-user-tie" style="color:#10B981;margin-right:8px"></i>Нагрузка на сотрудников</h3>';
  var assignees = db.leads_by_assignee || [];
  if (assignees.length === 0) {
    h += '<div style="text-align:center;color:#64748b;padding:16px;font-size:0.85rem">Лиды не распределены</div>';
  } else {
    h += '<table style="width:100%;border-collapse:collapse;font-size:0.82rem"><thead><tr style="border-bottom:2px solid #334155">' +
      '<th style="padding:6px 8px;text-align:left;color:#94a3b8;font-weight:600">Сотрудник</th>' +
      '<th style="padding:6px 8px;text-align:center;color:#94a3b8;font-weight:600">Лидов</th>' +
      '<th style="padding:6px 8px;text-align:right;color:#94a3b8;font-weight:600">Сумма</th></tr></thead><tbody>';
    for (var ai = 0; ai < assignees.length; ai++) {
      var ass = assignees[ai];
      h += '<tr style="border-bottom:1px solid #1e293b">' +
        '<td style="padding:8px;color:#e2e8f0;font-weight:600"><i class="fas fa-user" style="margin-right:6px;color:#10B981;font-size:0.7rem"></i>' + escHtml(ass.display_name || 'Не назначен') + '</td>' +
        '<td style="padding:8px;text-align:center;color:#e2e8f0;font-weight:700">' + fn(ass.count) + '</td>' +
        '<td style="padding:8px;text-align:right;color:#a78bfa;font-weight:700;white-space:nowrap">' + fa(ass.amount) + '</td></tr>';
    }
    h += '</tbody></table>';
  }
  h += '</div>';
  h += '</div>';
  
  // ===== PAYMENT METHODS BLOCK =====
  var pmUsage = db.payment_methods || [];
  h += '<div class="card" style="padding:20px;margin-bottom:20px;border:1px solid rgba(59,130,246,0.2)">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:0.95rem"><i class="fas fa-credit-card" style="color:#3B82F6;margin-right:8px"></i>Способы оплаты и комиссии</h3>';
  if (pmUsage.length === 0) {
    h += '<div style="text-align:center;color:#64748b;padding:16px;font-size:0.85rem"><i class="fas fa-info-circle" style="margin-right:6px"></i>Ни один лид пока не имеет выбранного способа оплаты</div>';
  } else {
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">';
    var totalPmComm = 0; for (var pmi = 0; pmi < pmUsage.length; pmi++) totalPmComm += Number(pmUsage[pmi].total_commission || 0);
    h += '<div style="padding:14px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px"><div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px">Итого комиссий</div><div style="font-size:1.3rem;font-weight:800;color:#3B82F6">' + fa(totalPmComm) + '</div></div>';
    var totalPmLeads = 0; for (var pmi = 0; pmi < pmUsage.length; pmi++) totalPmLeads += Number(pmUsage[pmi].count || 0);
    h += '<div style="padding:14px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:8px"><div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px">Лидов с оплатой</div><div style="font-size:1.3rem;font-weight:800;color:#22C55E">' + fn(totalPmLeads) + '</div></div>';
    h += '</div>';
    h += '<table style="width:100%;border-collapse:collapse;font-size:0.82rem"><thead><tr style="border-bottom:2px solid #334155">' +
      '<th style="padding:8px;text-align:left;color:#94a3b8">Способ</th>' +
      '<th style="padding:8px;text-align:center;color:#94a3b8">%</th>' +
      '<th style="padding:8px;text-align:center;color:#94a3b8">Лидов</th>' +
      '<th style="padding:8px;text-align:right;color:#94a3b8">Комиссия</th></tr></thead><tbody>';
    for (var pmi = 0; pmi < pmUsage.length; pmi++) {
      var pm = pmUsage[pmi];
      h += '<tr style="border-bottom:1px solid #1e293b">' +
        '<td style="padding:8px;color:#e2e8f0;font-weight:600"><i class="fas fa-credit-card" style="margin-right:6px;color:#3B82F6;font-size:0.7rem"></i>' + escHtml(pm.name_ru) + '</td>' +
        '<td style="padding:8px;text-align:center;color:#94a3b8">' + (pm.commission_pct || 0) + '%</td>' +
        '<td style="padding:8px;text-align:center;color:#e2e8f0;font-weight:700">' + fn(pm.count) + '</td>' +
        '<td style="padding:8px;text-align:right;color:#3B82F6;font-weight:700;white-space:nowrap">' + fa(pm.total_commission) + '</td></tr>';
    }
    h += '</tbody></table>';
  }
  h += '</div>';
  
  // ===== SITE TRAFFIC (compact) =====
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">';
  
  // Traffic stats
  h += '<div class="card" style="padding:20px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:0.95rem"><i class="fas fa-chart-area" style="color:#a78bfa;margin-right:8px"></i>Трафик сайта</h3>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';
  h += '<div style="padding:10px;background:rgba(16,185,129,0.08);border-radius:8px;text-align:center"><div style="font-size:0.7rem;color:#94a3b8">Сегодня</div><div style="font-size:1.2rem;font-weight:800;color:#10B981">' + fn(a.today) + '</div></div>';
  h += '<div style="padding:10px;background:rgba(59,130,246,0.08);border-radius:8px;text-align:center"><div style="font-size:0.7rem;color:#94a3b8">7 дней</div><div style="font-size:1.2rem;font-weight:800;color:#3B82F6">' + fn(a.week) + '</div></div>';
  h += '<div style="padding:10px;background:rgba(245,158,11,0.08);border-radius:8px;text-align:center"><div style="font-size:0.7rem;color:#94a3b8">30 дней</div><div style="font-size:1.2rem;font-weight:800;color:#F59E0B">' + fn(a.month) + '</div></div>';
  h += '<div style="padding:10px;background:rgba(139,92,246,0.08);border-radius:8px;text-align:center"><div style="font-size:0.7rem;color:#94a3b8">Всего</div><div style="font-size:1.2rem;font-weight:800;color:#a78bfa">' + fn(a.total) + '</div></div>';
  h += '</div>';
  // Mini chart
  if (daily.length > 0) {
    h += '<div style="display:flex;gap:4px;align-items:flex-end;height:60px">';
    var days7 = daily.slice(0, 7).reverse();
    var maxV = Math.max.apply(null, days7.map(function(x) { return x.count || 1; }));
    for (var di = 0; di < days7.length; di++) {
      var dv = days7[di];
      var bh = Math.max(6, Math.round((dv.count / maxV) * 50));
      h += '<div style="flex:1;text-align:center"><div style="background:linear-gradient(to top,#8B5CF6,#a78bfa);height:' + bh + 'px;border-radius:4px 4px 0 0;margin-bottom:2px"></div><div style="font-size:0.6rem;color:#64748b">' + (dv.day || '').slice(5) + '</div></div>';
    }
    h += '</div>';
  }
  h += '</div>';
  
  // Top referrers + languages
  h += '<div class="card" style="padding:20px">';
  h += '<h3 style="font-weight:700;margin-bottom:12px;font-size:0.95rem"><i class="fas fa-globe" style="color:#0EA5E9;margin-right:8px"></i>Источники трафика</h3>';
  if (refs.length > 0) {
    for (var rfi = 0; rfi < Math.min(refs.length, 5); rfi++) {
      var rf = refs[rfi];
      h += '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #1e293b;font-size:0.8rem">' +
        '<span style="color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:75%">' + escHtml(rf.referrer) + '</span>' +
        '<span style="font-weight:700;color:#e2e8f0">' + rf.count + '</span></div>';
    }
  } else {
    h += '<div style="color:#64748b;font-size:0.82rem;padding:8px 0">Нет данных о рефереррах</div>';
  }
  if (langs.length > 0) {
    h += '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">';
    for (var li = 0; li < langs.length; li++) {
      var ln = langs[li];
      var flag = ln.lang === 'am' ? '🇦🇲' : ln.lang === 'ru' ? '🇷🇺' : ln.lang === 'en' ? '🇬🇧' : '🌐';
      h += '<span style="font-size:0.75rem;padding:4px 10px;background:#1e293b;border-radius:12px;color:#94a3b8">' + flag + ' ' + ln.count + '</span>';
    }
    h += '</div>';
  }
  h += '</div>';
  h += '</div>';
  
  h += '</div>';
  return h;
}


`;
