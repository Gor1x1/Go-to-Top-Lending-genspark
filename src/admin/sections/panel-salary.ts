/**
 * Admin Panel — Salary summary, period actions
 * 301 lines of admin SPA JS code
 */
export const CODE: string = `
// ===== SALARY SUMMARY LOADER (auto-fetch from DB for month editing) =====
var salSummaryCache = {};
var salSummaryLoading = {};
async function loadSalarySummary(monthKey) {
  var hintEl = document.getElementById('sal-hint-' + monthKey);
  var salInput = document.getElementById('edit-expsal-' + monthKey);
  var commInput = document.getElementById('edit-expcomm-' + monthKey);
  var mktInput = document.getElementById('edit-expmkt-' + monthKey);
  if (!hintEl) return;
  try {
    var res = await api('/salary-summary/' + monthKey);
    if (res && res.salaries !== undefined) {
      salSummaryCache[monthKey] = res;
      var sal = Number(res.salaries) || 0;
      var bon = Number(res.bonuses) || 0;
      var fin = Number(res.fines) || 0;
      var total = Number(res.expense_salaries) || 0;
      // Update input with calculated total
      if (salInput) {
        salInput.value = total;
        salInput.style.color = '#a78bfa';
        salInput.style.fontWeight = '600';
      }
      // Update commercial and marketing if they were 0
      if (commInput && Number(commInput.value) === 0 && Number(res.commercial_expenses) > 0) {
        commInput.value = Math.round(Number(res.commercial_expenses));
      }
      if (mktInput && Number(mktInput.value) === 0 && Number(res.marketing_expenses) > 0) {
        mktInput.value = Math.round(Number(res.marketing_expenses));
      }
      // Build readable breakdown hint
      var parts = [];
      parts.push('<span style="color:#3B82F6">ФОТ: ' + fmtAmt(sal) + '</span>');
      if (bon > 0) parts.push('<span style="color:#22C55E">Бонусы: +' + fmtAmt(bon) + '</span>');
      if (fin < 0) parts.push('<span style="color:#EF4444">Штрафы: ' + fmtAmt(fin) + '</span>');
      if (bon === 0 && fin === 0) parts.push('<span style="color:#475569">Бонусы/штрафы: нет</span>');
      parts.push('<span style="color:#a78bfa;font-weight:700">= ' + fmtAmt(total) + '</span>');
      hintEl.innerHTML = '<i class="fas fa-database" style="margin-right:3px;color:#3B82F6"></i>' + parts.join(' <span style="color:#334155">|</span> ');
      hintEl.style.color = '#64748b';
    } else {
      hintEl.innerHTML = '<span style="color:#F59E0B"><i class="fas fa-exclamation-triangle" style="margin-right:3px"></i>Нет данных о ЗП. Добавьте сотрудников в "Сотрудники"</span>';
    }
  } catch(e) {
    hintEl.innerHTML = '<span style="color:#EF4444"><i class="fas fa-times-circle" style="margin-right:3px"></i>Ошибка загрузки</span>';
  }
}

// ===== PERIOD ACTIONS =====
async function saveEditedMonth(monthKey, snapshotId) {
  // Ensure salary data is loaded before saving (if not cached yet)
  if (!salSummaryCache[monthKey]) {
    try {
      var salRes = await api('/salary-summary/' + monthKey);
      if (salRes && salRes.salaries !== undefined) salSummaryCache[monthKey] = salRes;
    } catch(e) {}
  }
  var svc = Number(document.getElementById('edit-svc-' + monthKey)?.value) || 0;
  var art = Number(document.getElementById('edit-art-' + monthKey)?.value) || 0;
  var ref = Number(document.getElementById('edit-ref-' + monthKey)?.value) || 0;
  var expSal = Math.abs(Number(document.getElementById('edit-expsal-' + monthKey)?.value) || 0);
  var expComm = Math.abs(Number(document.getElementById('edit-expcomm-' + monthKey)?.value) || 0);
  var expMkt = Math.abs(Number(document.getElementById('edit-expmkt-' + monthKey)?.value) || 0);
  var exp = expSal + expComm + expMkt;
  var done = Number(document.getElementById('edit-done-' + monthKey)?.value) || 0;
  var inprog = Number(document.getElementById('edit-inprog-' + monthKey)?.value) || 0;
  var rejected = Number(document.getElementById('edit-rejected-' + monthKey)?.value) || 0;
  var checking = Number(document.getElementById('edit-checking-' + monthKey)?.value) || 0;
  var status = document.getElementById('edit-status-' + monthKey)?.value || '';
  var statusLabel = document.getElementById('edit-status-custom-' + monthKey)?.value || '';
  var adjAmount = Number(document.getElementById('edit-adj-amount-' + monthKey)?.value) || 0;
  var adjType = document.getElementById('edit-adj-type-' + monthKey)?.value || 'inflow';
  var adjComment = document.getElementById('edit-adj-comment-' + monthKey)?.value || '';
  // Load existing adjustments from snapshot
  var existingAdjs = [];
  var snapshots = data.periodSnapshots || [];
  var mSnap2 = snapshots.find(function(s){return s.period_type==='month' && s.period_key===monthKey;});
  if (mSnap2) { try { var cd6 = JSON.parse(mSnap2.custom_data || '{}'); existingAdjs = cd6.adjustments || []; if (!existingAdjs.length && cd6.adjustment) { existingAdjs = [{amount: Math.abs(cd6.adjustment), type: cd6.adjustment_type || 'inflow', comment: cd6.adjustment_comment || ''}]; } } catch(e) {} }
  // Add new adjustment if amount > 0
  if (adjAmount > 0) {
    existingAdjs.push({amount: Math.abs(adjAmount), type: adjType, comment: adjComment});
  }
  // Calculate total adjustment
  var totalAdj = 0;
  for (var i = 0; i < existingAdjs.length; i++) {
    totalAdj += existingAdjs[i].type === 'outflow' ? -Math.abs(existingAdjs[i].amount) : Math.abs(existingAdjs[i].amount);
  }
  var profit = svc - exp + totalAdj;
  var turnover = svc + art;
  var isLocked2 = status === 'locked';
  var totalLeadsEdit = done + inprog + rejected + checking;
  var convEdit = totalLeadsEdit > 0 ? Math.round((done / totalLeadsEdit) * 1000) / 10 : 0;
  var marginEdit = svc > 0 ? Math.round((profit / svc) * 1000) / 10 : 0;
  var roiEdit = exp > 0 ? Math.round((profit / exp) * 1000) / 10 : 0;
  var romiEdit = expMkt > 0 ? Math.round(((svc - expMkt) / expMkt) * 1000) / 10 : 0;
  // Get salary/bonus/fine breakdown from salSummaryCache (loaded via loadSalarySummary API call)
  var liveBonNet = 0;
  var liveSalBase = expSal;
  var cached = salSummaryCache[monthKey];
  if (cached) {
    liveSalBase = Number(cached.salaries) || expSal;
    liveBonNet = (Number(cached.bonuses) || 0) + (Number(cached.fines) || 0);
  } else if (analyticsData && analyticsData.financial) {
    // Fallback to live analytics if cache miss (only works for current month)
    var aFin = analyticsData.financial;
    var currentMonth = analyticsData.month;
    if (currentMonth === monthKey) {
      liveSalBase = Number(aFin.salaries) || expSal;
      liveBonNet = (Number(aFin.bonuses) || 0) + (Number(aFin.fines) || 0);
    }
  }
  var customData = { adjustments: existingAdjs, status: status, status_label: statusLabel, in_progress_count: inprog, rejected_count: rejected, checking_count: checking, conversion_rate: convEdit, marginality: marginEdit, roi: roiEdit, romi: romiEdit, salary_base: liveSalBase, bonuses_net: liveBonNet };
  if (snapshotId > 0) {
    // Update existing snapshot (including lock status)
    var res = await api('/period-snapshots/' + snapshotId, 'PUT', {
      revenue_services: svc, revenue_articles: art, refunds: ref,
      expense_salaries: expSal, expense_commercial: expComm, expense_marketing: expMkt,
      net_profit: profit, total_turnover: turnover,
      leads_done: done, leads_count: done + inprog + rejected + checking,
      avg_check: done > 0 ? Math.round(svc/done) : 0,
      custom_data: customData,
      is_locked: isLocked2
    });
    if (res && res.success) {
      toast('Данные за ' + monthKey + (isLocked2 ? ' закрыты и сохранены' : ' обновлены'));
      editingMonthKey = '';
      try { var snRes = await api('/period-snapshots'); data.periodSnapshots = (snRes && snRes.snapshots) || []; } catch(e) {}
      analyticsData = null; loadAnalyticsData();
    } else { toast(res?.error || 'Ошибка сохранения', 'error'); }
  } else {
    // Create new snapshot for this month
    var res2 = await api('/period-snapshots', 'POST', {
      period_type: 'month', period_key: monthKey,
      revenue_services: svc, revenue_articles: art, total_turnover: turnover, refunds: ref,
      expense_salaries: expSal, expense_commercial: expComm, expense_marketing: expMkt,
      net_profit: profit, leads_count: done+inprog+rejected+checking, leads_done: done, avg_check: done > 0 ? Math.round(svc/done) : 0,
      is_locked: isLocked2,
      custom_data: customData
    });
    if (res2 && res2.success) {
      toast('Данные за ' + monthKey + ' сохранены');
      editingMonthKey = '';
      try { var snRes2 = await api('/period-snapshots'); data.periodSnapshots = (snRes2 && snRes2.snapshots) || []; } catch(e) {}
      analyticsData = null; loadAnalyticsData();
    } else { toast(res2?.error || 'Ошибка сохранения', 'error'); }
  }
}

async function deleteAdjustment(monthKey, snapshotId, adjIndex) {
  if (!confirm('Удалить эту корректировку?')) return;
  var snapshots = data.periodSnapshots || [];
  var mSnap3 = snapshots.find(function(s){return s.period_type==='month' && s.period_key===monthKey;});
  if (!mSnap3) return;
  var adjs = [];
  try { var cd7 = JSON.parse(mSnap3.custom_data || '{}'); adjs = cd7.adjustments || []; if (!adjs.length && cd7.adjustment) { adjs = [{amount: Math.abs(cd7.adjustment), type: cd7.adjustment_type || 'inflow', comment: cd7.adjustment_comment || ''}]; } } catch(e) {}
  adjs.splice(adjIndex, 1);
  // Recalculate totals
  var totalAdj2 = 0;
  for (var i = 0; i < adjs.length; i++) {
    totalAdj2 += adjs[i].type === 'outflow' ? -Math.abs(adjs[i].amount) : Math.abs(adjs[i].amount);
  }
  var svc2 = Number(mSnap3.revenue_services)||0;
  var exp2 = (Number(mSnap3.expense_salaries)||0)+(Number(mSnap3.expense_commercial)||0)+(Number(mSnap3.expense_marketing)||0);
  var art2 = Number(mSnap3.revenue_articles)||0;
  var profit2 = svc2 - exp2 + totalAdj2;
  var res = await api('/period-snapshots/' + snapshotId, 'PUT', {
    net_profit: profit2, total_turnover: svc2 + art2,
    custom_data: { adjustments: adjs }
  });
  if (res && res.success) {
    toast('Корректировка удалена');
    try { var snRes3 = await api('/period-snapshots'); data.periodSnapshots = (snRes3 && snRes3.snapshots) || []; } catch(e) {}
    render();
  } else { toast(res?.error || 'Ошибка', 'error'); }
}

var _refreshLock = false;
async function refreshAnalytics() {
  if (_refreshLock) return; // prevent double-trigger absolutely
  _refreshLock = true;
  analyticsRefreshing = true;
  render(); // immediately show spinning icon + disabled button
  expandedMonth = '';
  analyticsData = null;
  try {
    // Re-fetch ALL data (bulk-data includes taxPayments, periodSnapshots, etc.)
    var bulk = await api('/bulk-data', { _silent: true });
    if (bulk && !bulk.error) {
      data.taxPayments = bulk.taxPayments || [];
      data.periodSnapshots = bulk.periodSnapshots || [];
      data.expenses = bulk.expenses || [];
      data.assets = bulk.assets || [];
      data.loans = bulk.loans || [];
      data.loanPayments = bulk.loanPayments || [];
      data.dividends = bulk.dividends || [];
      data.otherIncomeExpenses = bulk.otherIncomeExpenses || [];
      data.users = bulk.users || [];
      data.taxRules = bulk.taxRules || [];
    }
    await loadAnalyticsData();
  } catch(e) { console.error('Refresh error:', e); }
  analyticsRefreshing = false;
  _refreshLock = false;
  render(); // stop spinning
}

async function closePeriodAction(periodType, periodKey, lock) {
  if (lock && !confirm('Закрыть период ' + periodKey + '?')) return;
  var d = analyticsData;
  if (!d || !d.financial) { toast('Нет данных для сохранения. Обновите аналитику.', 'error'); return; }
  var fin = d.financial;

  // Fetch salary summary for this period to ensure accurate bonus data
  var salBase = Number(fin.salaries) || 0;
  var bonNet = (Number(fin.bonuses) || 0) + (Number(fin.fines) || 0);
  if (periodType === 'month') {
    try {
      if (!salSummaryCache[periodKey]) {
        var salRes = await api('/salary-summary/' + periodKey);
        if (salRes && salRes.salaries !== undefined) salSummaryCache[periodKey] = salRes;
      }
      var cached = salSummaryCache[periodKey];
      if (cached) {
        salBase = Number(cached.salaries) || salBase;
        bonNet = (Number(cached.bonuses) || 0) + (Number(cached.fines) || 0);
      }
    } catch(e) {}
  }

  var body = {
    period_type: periodType,
    period_key: periodKey,
    revenue_services: fin.services || 0,
    revenue_articles: fin.articles || 0,
    total_turnover: fin.turnover || 0,
    refunds: fin.refunds || 0,
    expense_salaries: Math.abs((fin.salaries || 0) + (fin.bonuses || 0) + (fin.fines || 0)),
    expense_commercial: Math.abs(fin.commercial_expenses || 0),
    expense_marketing: Math.abs(fin.marketing_expenses || 0),
    net_profit: (fin.services || 0) - (fin.total_expenses || 0), // Прибыль = Услуги - Расходы
    leads_count: d.total_leads || 0,
    leads_done: (d.status_data && d.status_data.done) ? d.status_data.done.count || 0 : 0,
    avg_check: ((d.status_data && d.status_data.done && d.status_data.done.count > 0) ? fin.avg_check || 0 : 0),
    is_locked: lock,
    custom_data: {
      conversion_rate: Number(fin.conversion_rate) || 0,
      marginality: Number(fin.marginality) || 0,
      roi: Number(fin.roi) || 0,
      romi: Number(fin.romi) || 0,
      date_from: d.date_from,
      date_to: d.date_to,
      salary_base: salBase,
      bonuses_net: bonNet,
      in_progress_count: ((d.status_data && d.status_data.in_progress) ? d.status_data.in_progress.count || 0 : 0) + ((d.status_data && d.status_data.contacted) ? d.status_data.contacted.count || 0 : 0),
      rejected_count: (d.status_data && d.status_data.rejected) ? d.status_data.rejected.count || 0 : 0,
      checking_count: (d.status_data && d.status_data.checking) ? d.status_data.checking.count || 0 : 0,
      ltv: (d.ltv_data || {}).ltv || 0,
      ltv_purchase_frequency: (d.ltv_data || {}).purchase_frequency || 0,
      ltv_lifespan_months: (d.ltv_data || {}).customer_lifespan_months || 0,
      ltv_unique_customers: (d.ltv_data || {}).unique_customers || 0,
      ltv_repeat_customers: (d.ltv_data || {}).repeat_customers || 0,
      employees_snapshot: (d.employees || []).map(function(emp) { return { id: emp.id, name: emp.display_name, salary: emp.salary, hire_date: emp.hire_date || '', end_date: emp.end_date || '' }; })
    }
  };

  var res = await api('/period-snapshots', 'POST', body);
  if (res && res.success) {
    toast(lock ? 'Период заблокирован!' : 'Итоги сохранены!', 'success');
    try { var snRes = await api('/period-snapshots'); data.periodSnapshots = (snRes && snRes.snapshots) || []; } catch(e) {}
    render();
  } else {
    toast(res?.error || 'Ошибка сохранения', 'error');
  }
}

async function unlockPeriod(snapshotId) {
  if (!confirm('Разблокировать период? Данные можно будет перезаписать.')) return;
  var res = await api('/period-snapshots/' + snapshotId + '/unlock', 'PUT', {});
  if (res && res.success) {
    toast('Период разблокирован');
    try { var snRes = await api('/period-snapshots'); data.periodSnapshots = (snRes && snRes.snapshots) || []; } catch(e) {}
    render();
  } else {
    toast(res?.error || 'Ошибка', 'error');
  }
}

function setAnalyticsPeriod(period) {
  expandedMonth = ''; // reset month drill-down
  var now = new Date();
  var fmt = function(d) { return d.toISOString().slice(0,10); };
  if (period === 'today') { analyticsDateFrom = fmt(now); analyticsDateTo = fmt(now); }
  else if (period === 'week') { var d7 = new Date(now); d7.setDate(d7.getDate()-7); analyticsDateFrom = fmt(d7); analyticsDateTo = fmt(now); }
  else if (period === '14d') { var d14 = new Date(now); d14.setDate(d14.getDate()-14); analyticsDateFrom = fmt(d14); analyticsDateTo = fmt(now); }
  else if (period === 'month') { var d30 = new Date(now); d30.setDate(d30.getDate()-30); analyticsDateFrom = fmt(d30); analyticsDateTo = fmt(now); }
  else if (period === '90d') { var d90 = new Date(now); d90.setDate(d90.getDate()-90); analyticsDateFrom = fmt(d90); analyticsDateTo = fmt(now); }
  else { analyticsDateFrom = ''; analyticsDateTo = ''; }
  analyticsData = null;
  loadAnalyticsData();
}



`;
