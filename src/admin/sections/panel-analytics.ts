/**
 * Admin Panel — Business analytics, P&L, tax rules, all tabs
 * 4613 lines of admin SPA JS code
 */
export const CODE: string = `
// ===== BUSINESS ANALYTICS =====
let analyticsDateFrom = '';
let analyticsDateTo = '';
let analyticsData = null;
let bizAnalyticsTab = 'overview';
let pnlPeriod = new Date().toISOString().slice(0, 7); // e.g. 2026-02
let pnlData = null; // cached P&L data for current period
let pnlLoading = false;
let pnlSubTab = 'cascade'; // cascade | taxes | assets | loans | dividends | other | scenario | summary
let loanModeDetailsOpen = false; // track repayment mode card open/close
let pnlEditId = 0; // for edit modal
let pnlEditType = ''; // tax | asset | loan | dividend | other
let showPnlAddForm = false;
let pnlFiscalMonth = 1; // loaded from settings
let editingLoanPaymentId = 0; // for editing existing payments
let showTaxRuleForm = false;
let editTaxRuleId = 0;
let showAddExpenseForm = false;
let showAddBonusUserId = 0;
let addBonusType = 'bonus';
let showBonusListUserId = 0;
let bonusListData = [];
let editingMonthKey = '';
let editingBonusId = 0;
let showAddCategoryForm = false;
let showAddFreqTypeForm = false;
let editingExpenseId = 0; // for inline expense editing
let expandedMonth = ''; // for month drill-down
var analyticsRefreshing = false; // spinner flag for refresh button
let yearChartMetric = 'amount'; // amount | count | done_amount
let yearChartMode = 'month'; // month | week | day
let excludedStatuses = {}; // statuses excluded from calculations
let comparePeriod1 = ''; // manual period comparison
let comparePeriod2 = '';

async function loadAnalyticsData() {
  var params = '';
  if (expandedMonth) { params += '&month=' + expandedMonth; }
  else {
    if (analyticsDateFrom) params += '&from=' + analyticsDateFrom;
    if (analyticsDateTo) params += '&to=' + analyticsDateTo;
  }
  analyticsData = await api('/business-analytics?' + params.replace(/^&/,''));
  render();
}

function fmtAmt(n) {
  if (n === null || n === undefined || isNaN(Number(n))) return '0 \\u058f';
  var num = Number(n);
  if (Math.abs(num) >= 1e12) return '0 \\u058f'; // prevent absurd numbers
  return num.toLocaleString('ru-RU', {maximumFractionDigits: 0}) + '\\u00a0\\u058f';
}
function fmtPct(n) { return (Number(n) || 0).toFixed(1) + '%'; }
function fmtNum(n) { if (!n && n !== 0) return '0'; return Number(n).toLocaleString('ru-RU'); }

function getActiveStatusData(sd) {
  // Returns status data excluding user-excluded statuses
  var result = {};
  var allSt = ['new','contacted','in_progress','rejected','checking','done'];
  for (var i = 0; i < allSt.length; i++) {
    var k = allSt[i];
    if (excludedStatuses[k]) {
      result[k] = { count: 0, amount: 0, services: 0, articles: 0, excluded: true };
    } else {
      result[k] = sd[k] || { count: 0, amount: 0, services: 0, articles: 0 };
    }
  }
  return result;
}

function recalcFinancials(sd, fin) {
  // Recalculate financials based on active (non-excluded) statuses
  var turnoverStatuses = ['in_progress','checking','done'];
  var turnover = 0, svcTotal = 0, artTotal = 0;
  for (var i = 0; i < turnoverStatuses.length; i++) {
    var st = turnoverStatuses[i];
    var v = sd[st] || {};
    if (v.excluded) continue;
    turnover += Number(v.amount) || 0;
    svcTotal += Number(v.services) || 0;
    artTotal += Number(v.articles) || 0;
  }
  var done = sd.done || {};
  var doneCount = done.excluded ? 0 : (Number(done.count) || 0);
  var doneSvc = done.excluded ? 0 : (Number(done.services) || 0);
  // avg_check = services of completed leads only (no articles)
  var avgCheck = doneCount > 0 ? Math.round(doneSvc / doneCount) : 0;
  // If no leads at all, reset avg_check and conversion to 0
  var totalLeads = 0;
  var allSt = ['new','contacted','in_progress','rejected','checking','done'];
  for (var j = 0; j < allSt.length; j++) {
    var v2 = sd[allSt[j]] || {};
    if (!v2.excluded) totalLeads += Number(v2.count) || 0;
  }
  if (totalLeads === 0) avgCheck = 0;
  var convRate = totalLeads > 0 ? Math.round((doneCount / totalLeads) * 1000) / 10 : 0;
  return {
    turnover: Math.max(0, Math.round(turnover * 100) / 100),
    services: Math.max(0, Math.round(svcTotal * 100) / 100),
    articles: Math.max(0, Math.round(artTotal * 100) / 100),
    articles_net: Number(fin.articles_net) || 0,
    refunds: Number(fin.refunds) || 0,
    avg_check: avgCheck,
    conversion_rate: convRate,
    done_amount: done.excluded ? 0 : (Number(fin.done_amount) || 0),
    done_services: doneSvc,
    done_articles: done.excluded ? 0 : (Number(fin.done_articles) || 0),
    net_profit: Number(fin.net_profit) || 0,
    salaries: Number(fin.salaries) || 0,
    bonuses: Number(fin.bonuses) || 0,
    fines: Number(fin.fines) || 0,
    commercial_expenses: Number(fin.commercial_expenses) || 0,
    marketing_expenses: Number(fin.marketing_expenses) || 0,
    total_expenses: Number(fin.total_expenses) || 0,
    marginality: Number(fin.marginality) || 0,
    roi: Number(fin.roi) || 0,
    romi: Number(fin.romi) || 0,
    break_even: Number(fin.break_even) || 0,
    avg_fulfillment_days: Number(fin.avg_fulfillment_days) || 0,
    totalLeads: totalLeads
  };
}

function renderLeadsAnalytics() {
  var d = analyticsData;
  if (!d) {
    loadAnalyticsData();
    return '<div style="padding:32px;text-align:center"><div class="spinner" style="width:40px;height:40px;margin:60px auto"></div><p style="color:#94a3b8;margin-top:16px">Загрузка бизнес-аналитики...</p></div>';
  }
  var sd = getActiveStatusData(d.status_data || {});
  var fin = recalcFinancials(sd, d.financial || {});
  // Attach ltv_data from analytics response
  fin.ltv_data = d.ltv_data || null;
  var tabs = [
    { id: 'overview', icon: 'fa-chart-pie', label: 'Обзор и Финансы' },
    { id: 'costs', icon: 'fa-wallet', label: 'Затраты и ЗП' },
    { id: 'funnel', icon: 'fa-funnel-dollar', label: 'Воронка и Детали' },
    { id: 'pnl', icon: 'fa-file-invoice-dollar', label: 'P&L / Финотчёт' },
    { id: 'periods', icon: 'fa-list-ol', label: 'Результативность' },
  ];
  var h = '<div style="padding:24px 32px">';
  // Header
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">';
  h += '<div><h1 style="font-size:1.8rem;font-weight:800"><i class="fas fa-chart-line" style="color:#8B5CF6;margin-right:10px"></i>Бизнес-аналитика</h1>';
  h += '<p style="color:#94a3b8;margin-top:4px">Финансы, лиды, расходы, эффективность</p></div>';
  h += '<button class="btn btn-outline" id="refresh-analytics-btn" onclick="refreshAnalytics()" style="display:flex;align-items:center;gap:6px"' + (analyticsRefreshing ? ' disabled' : '') + '><i class="fas fa-sync-alt' + (analyticsRefreshing ? ' fa-spin' : '') + '" id="refresh-icon"></i>' + (analyticsRefreshing ? 'Загрузка...' : 'Обновить') + '</button>';
  h += '</div>';
  // Expanded month banner
  if (expandedMonth) {
    var mNames2 = ['','Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    var mNum = parseInt(expandedMonth.split('-')[1]);
    h += '<div class="card" style="padding:12px 20px;margin-bottom:16px;background:rgba(139,92,246,0.1);border-color:#8B5CF6;display:flex;align-items:center;justify-content:space-between">';
    h += '<div><i class="fas fa-calendar-day" style="color:#8B5CF6;margin-right:8px"></i><strong style="color:#a78bfa">' + mNames2[mNum] + ' ' + expandedMonth.split('-')[0] + '</strong> — детализация по месяцу</div>';
    h += '<button class="btn btn-outline" style="padding:6px 14px;font-size:0.8rem" onclick="expandedMonth=&apos;&apos;;analyticsData=null;loadAnalyticsData()"><i class="fas fa-times" style="margin-right:4px"></i>Закрыть</button>';
    h += '</div>';
  }
  // Date filter (hidden when month is expanded)
  if (!expandedMonth) {
    h += '<div class="card" style="padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">';
    h += '<i class="fas fa-calendar" style="color:#8B5CF6"></i><span style="font-weight:600;color:#94a3b8">Период:</span>';
    h += '<input type="date" class="input" style="width:150px;padding:6px 10px" value="' + analyticsDateFrom + '" onchange="analyticsDateFrom=this.value;analyticsData=null;loadAnalyticsData()">';
    h += '<span style="color:#475569">\\u2014</span>';
    h += '<input type="date" class="input" style="width:150px;padding:6px 10px" value="' + analyticsDateTo + '" onchange="analyticsDateTo=this.value;analyticsData=null;loadAnalyticsData()">';
    var periods = [{l:'Сегодня',v:'today'},{l:'7 дн',v:'week'},{l:'14 дн',v:'14d'},{l:'30 дн',v:'month'},{l:'90 дн',v:'90d'},{l:'Все',v:'all'}];
    for (var pi = 0; pi < periods.length; pi++) {
      h += '<button class="tab-btn" style="padding:6px 14px;font-size:0.8rem" onclick="setAnalyticsPeriod(&apos;' + periods[pi].v + '&apos;)">' + periods[pi].l + '</button>';
    }
    h += '</div>';
  }
  // Quick KPI strip at top
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px">';
  var quickKpis = [
    {label:'Оборот',val:fmtAmt(fin.turnover),icon:'fa-coins',color:'#8B5CF6',bg:'rgba(139,92,246,0.12)',desc:'Услуги: '+fmtAmt(fin.services)+' | Выкупы: '+fmtAmt(fin.articles)},
    {label:'Чистая прибыль',val:fmtAmt(fin.net_profit),icon:fin.net_profit>=0?'fa-arrow-up':'fa-arrow-down',color:fin.net_profit>=0?'#22C55E':'#EF4444',bg:fin.net_profit>=0?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)',desc:'Усл: '+fmtAmt(fin.services)+' \\\\u2212 Расх: '+fmtAmt(fin.total_expenses)},
    {label:'Конверсия',val:fmtPct(fin.conversion_rate),icon:'fa-percentage',color:fin.conversion_rate>15?'#22C55E':fin.conversion_rate>5?'#F59E0B':'#EF4444',bg:'rgba(245,158,11,0.08)',desc:fmtNum((sd.done||{}).count||0)+' из '+fmtNum(fin.totalLeads)+' лидов'},
    {label:'Ср. чек (услуги)',val:fmtAmt(fin.avg_check),icon:'fa-shopping-cart',color:'#3B82F6',bg:'rgba(59,130,246,0.08)',desc:'Услуги / кол-во завершённых'},
    {label:'Всего лидов',val:fmtNum(fin.totalLeads),icon:'fa-users',color:'#10B981',bg:'rgba(16,185,129,0.08)',desc:'Нов: '+fmtNum((sd.new||{}).count||0)+' | Связь: '+fmtNum((sd.contacted||{}).count||0)+' | Раб: '+fmtNum((sd.in_progress||{}).count||0)+' | Пров: '+fmtNum((sd.checking||{}).count||0)+' | Откл: '+fmtNum((sd.rejected||{}).count||0)+' | Гот: '+fmtNum((sd.done||{}).count||0)},
    {label:'Завершено',val:fmtNum((sd.done||{}).count)+' / '+fmtAmt(fin.done_amount||((sd.done||{}).amount||0)),icon:'fa-check-circle',color:'#22C55E',bg:'rgba(34,197,94,0.08)',desc:'Усл: '+fmtAmt(Number((sd.done||{}).services)||0)+' | Вык: '+fmtAmt(Number((sd.done||{}).articles)||0)},
  ];
  for (var qi = 0; qi < quickKpis.length; qi++) {
    var qk = quickKpis[qi];
    h += '<div class="card" style="padding:20px;background:' + qk.bg + ';border:1px solid ' + qk.color + '33">';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><i class="fas ' + qk.icon + '" style="color:' + qk.color + ';font-size:1.2rem"></i><span style="font-size:0.9rem;color:#94a3b8;font-weight:600">' + qk.label + '</span></div>';
    h += '<div style="font-size:1.8rem;font-weight:800;color:' + qk.color + ';line-height:1.2">' + qk.val + '</div>';
    if (qk.desc) h += '<div style="font-size:0.72rem;color:#64748b;margin-top:6px;line-height:1.4">' + qk.desc + '</div>';
    h += '</div>';
  }
  h += '</div>';
  // Tabs
  h += '<div style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap">';
  for (var ti = 0; ti < tabs.length; ti++) {
    var t = tabs[ti];
    h += '<button class="tab-btn' + (bizAnalyticsTab === t.id ? ' active' : '') + '" onclick="bizAnalyticsTab=&apos;' + t.id + '&apos;;render()" style="padding:10px 20px"><i class="fas ' + t.icon + '" style="margin-right:6px"></i>' + t.label + '</button>';
  }
  h += '</div>';
  // Tab content
  if (bizAnalyticsTab === 'overview') h += renderBizOverviewV2(d, sd, fin);
  else if (bizAnalyticsTab === 'costs') h += renderBizCostsV2(d, sd, fin);
  else if (bizAnalyticsTab === 'funnel') h += renderBizFunnelV2(d, sd, fin);
  else if (bizAnalyticsTab === 'periods') h += renderBizPeriodsV2(d, sd, fin);
  else if (bizAnalyticsTab === 'pnl') h += renderPnLTab();
  h += '</div>';
  return h;
}

// ============ P&L / ФИНОТЧЁТ TAB ============
async function loadPnlData() {
  pnlLoading = true; render();
  var result = await api('/pnl/' + pnlPeriod);
  // If API returned error (e.g. missing tax_rules table), show fallback instead of zeros
  if (result && result.error) {
    console.warn('P&L API error:', result.error);
    // Try loading without tax data by using fallback empty structure
    pnlData = {
      period_key: pnlPeriod, revenue: 0, refunds: 0, net_revenue: 0, cogs: 0,
      gross_profit: 0, salary_total: 0, salaries: 0, bonuses: 0, penalties: 0,
      marketing: 0, depreciation: 0, total_opex: 0, ebit: 0, ebitda: 0,
      other_income: 0, other_expenses: 0, interest_expense: 0, ebt: 0,
      total_taxes: 0, net_profit: 0, total_dividends: 0, retained_earnings: 0,
      gross_margin: 0, ebit_margin: 0, net_margin: 0, ebitda_margin: 0,
      effective_tax_rate: 0, tax_burden: 0, monthly_burn_rate: 0,
      ytd_taxes: 0, ytd_dividends_amount: 0,
      taxes: [], tax_rules: [], _bases: {},
      mom: {}, mom_pct: {}, ytd: {},
      _pnl_error: result.error
    };
    toast('⚠️ P&L: ' + result.error, 'warn');
  } else {
    pnlData = result;
  }
  if (pnlData && pnlData.fiscal_year_start_month) pnlFiscalMonth = pnlData.fiscal_year_start_month;
  // Sync loan settings from P&L response (always up-to-date from DB)
  if (pnlData && pnlData.loan_repayment_mode !== undefined) {
    data.loanSettings = {
      repayment_mode: pnlData.loan_repayment_mode || 'standard',
      aggressive_pct: pnlData.loan_aggressive_pct || 10,
      standard_extra_pct: pnlData.loan_standard_extra_pct || 0
    };
  }
  pnlLoading = false;
  // After P&L computed, re-fetch tax payments (auto-calc amounts are now written to DB)
  try { var tpRes = await api('/tax-payments', { _silent: true }); if (tpRes && tpRes.payments) data.taxPayments = tpRes.payments; } catch(e) {}
  render();
}
async function saveFiscalYearStart(val) {
  var m = parseInt(val) || 1;
  pnlFiscalMonth = m;
  await api('/settings', { method: 'PUT', body: JSON.stringify({ fiscal_year_start_month: String(m) }), _silent: true });
  pnlData = null; loadPnlData();
  toast('\\u0424\\u0438\\u0441\\u043a\\u0430\\u043b\\u044c\\u043d\\u044b\\u0439 \\u0433\\u043e\\u0434: \\u0441 ' + val + '-\\u0433\\u043e \\u043c\\u0435\\u0441\\u044f\\u0446\\u0430');
}
function setPnlPeriod(dir) {
  var parts = pnlPeriod.split('-'); var y = parseInt(parts[0]); var m = parseInt(parts[1]);
  if (dir === 'prev') { m--; if (m < 1) { m = 12; y--; } }
  else if (dir === 'next') { m++; if (m > 12) { m = 1; y++; } }
  pnlPeriod = y + '-' + String(m).padStart(2, '0'); pnlData = null; loadPnlData();
}
async function savePnlItem(type) {
  console.log('[PnL] savePnlItem called, type:', type);
  var prefix = 'pnl_' + type + '_';
  var d = {};
  var foundFields = 0;
  document.querySelectorAll('[id^="' + prefix + '"]').forEach(function(el) {
    var key = el.id.replace(prefix, '');
    if (el.type === 'checkbox') { d[key] = el.checked ? 1 : 0; }
    else if (el.type === 'number') { d[key] = parseFloat(el.value) || 0; }
    else { d[key] = el.value; }
    foundFields++;
  });
  console.log('[PnL] collected fields:', foundFields, 'data:', JSON.stringify(d));
  if (foundFields === 0) { toast('\\u041e\\u0448\\u0438\\u0431\\u043a\\u0430: \\u0444\\u043e\\u0440\\u043c\\u0430 \\u043d\\u0435 \\u043d\\u0430\\u0439\\u0434\\u0435\\u043d\\u0430. \\u041f\\u043e\\u043f\\u0440\\u043e\\u0431\\u0443\\u0439\\u0442\\u0435 \\u0435\\u0449\\u0451 \\u0440\\u0430\\u0437.', 'error'); return; }

  var saveBtn = document.querySelector('[onclick*="savePnlItem"]');
  var restoreBtn = null;
  if (saveBtn) { restoreBtn = btnLoading(saveBtn, '\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u0438\\u0435...'); }

  try {
    // ===== UNIFIED TAX LOGIC =====
    if (type === 'tax') {
      var isAutoTax = !!d.is_auto;
      // Auto-generate tax_name from type + rate (no manual name field)
      var taxTypeLabelsMap = {income_tax:'Налог на прибыль',vat:'НДС',usn_income:'УСН Доходы',usn_income_expense:'УСН Доходы−Расходы',turnover_tax:'Налог на оборот',payroll_tax:'Налоги на ЗП',patent:'Патент',property:'Налог на имущество',other:'Прочее'};
      var taxTypeSel = d.tax_type || 'income_tax';
      var taxRateSel = d.tax_rate || 0;
      var taxName = (taxTypeLabelsMap[taxTypeSel] || taxTypeSel) + (taxRateSel ? ' ' + taxRateSel + '%' : '');
      
      if (isAutoTax) {
        // AUTO MODE: Create/update RULE, then generate payment for current period
        var ruleData = {
          rule_name: taxName,
          tax_type: d.tax_type || 'income_tax',
          tax_rate: d.tax_rate || 0,
          tax_base: d.tax_base || 'turnover_excl_transit',
          frequency: d.frequency || 'monthly',
          apply_from: d.apply_from || pnlPeriod,
          notes: d.notes || '',
          is_active: 1
        };
        // Check if editing existing rule-based payment
        var editItem = pnlEditId ? (data.taxPayments || []).find(function(t) { return t.id === pnlEditId; }) : null;
        var existingRuleId = editItem && editItem.rule_id;
        
        if (existingRuleId) {
          // Update existing rule
          await api('/tax-rules/' + existingRuleId, { method: 'PUT', body: JSON.stringify(ruleData), _silent: true });
          // Update the payment too (tax_type, name, rate, base)
          await api('/tax-payments/' + pnlEditId, { method: 'PUT', body: JSON.stringify({
            tax_type: ruleData.tax_type, tax_name: ruleData.rule_name, tax_rate: ruleData.tax_rate,
            tax_base: ruleData.tax_base, is_auto: 1, notes: ruleData.notes
          }), _silent: true });
        } else if (pnlEditId && !existingRuleId) {
          // Converting manual payment to auto: create new rule + update payment to link it
          var ruleRes = await api('/tax-rules', { method: 'POST', body: JSON.stringify(ruleData), _silent: true });
          // Delete old manual payment, generate from rule
          await api('/tax-payments/' + pnlEditId, { method: 'DELETE', _silent: true });
          await api('/tax-rules/generate/' + pnlPeriod, { method: 'POST', _silent: true });
        } else {
          // New: create rule + generate payment
          var createRes = await api('/tax-rules', { method: 'POST', body: JSON.stringify(ruleData), _silent: true });
          console.log('[PnL] Rule created:', JSON.stringify(createRes));
          var newRuleId = createRes && createRes.rule_id;
          // Generate payment from newly created rule
          var genRes = await api('/tax-rules/generate/' + pnlPeriod, { method: 'POST', _silent: true });
          console.log('[PnL] Generate result:', JSON.stringify(genRes));
          // Fallback: if generate created 0 payments, create payment manually linked to rule
          if (!genRes || genRes.generated === 0) {
            console.warn('[PnL] Generate returned 0, creating payment as fallback');
            await api('/tax-payments', { method: 'POST', body: JSON.stringify({
              tax_type: ruleData.tax_type, tax_name: ruleData.rule_name, amount: 0,
              period_key: pnlPeriod, status: 'pending', tax_rate: ruleData.tax_rate,
              tax_base: ruleData.tax_base, is_auto: 1, rule_id: newRuleId || null
            }), _silent: true });
          }
        }
      } else {
        // MANUAL MODE: Create/update tax_payment directly (no rule)
        d.tax_name = taxName;
        d.amount = d.amount || 0;
        d.is_auto = 0;
        d.period_key = pnlPeriod;
        if (pnlEditId) {
          // If editing a rule-based payment and switching to manual: delete rule link
          var editItemM = (data.taxPayments || []).find(function(t) { return t.id === pnlEditId; });
          if (editItemM && editItemM.rule_id) {
            d.rule_id = null;
            d.is_suppressed = 0;
          }
          await api('/tax-payments/' + pnlEditId, { method: 'PUT', body: JSON.stringify(d), _silent: true });
        } else {
          await api('/tax-payments', { method: 'POST', body: JSON.stringify(d), _silent: true });
        }
      }
      // Done — skip generic save below
    } else {
      // ===== NON-TAX ITEMS (asset, loan, dividend, other) =====
      d.period_key = pnlPeriod;
      // Handle overdraft form fields (they have _od suffix)
      if (type === 'loan' && d.loan_type === 'overdraft') {
        if (d.start_date_od !== undefined) { d.start_date = d.start_date_od; delete d.start_date_od; }
        if (d.end_date_od !== undefined) { d.end_date = d.end_date_od; delete d.end_date_od; }
        if (d.term_months_od !== undefined) { d.term_months = d.term_months_od; delete d.term_months_od; }
        if (d.bank_monthly_payment_od !== undefined) { d.bank_monthly_payment = d.bank_monthly_payment_od; delete d.bank_monthly_payment_od; }
        // payment_day and min_payment pass through as-is (no suffix mapping needed)
        // Clean up main-form fields
        delete d.payment_day_main; delete d.min_payment_main;
      } else if (type === 'loan') {
        // Map main-form payment info fields
        if (d.payment_day_main !== undefined) { d.payment_day = d.payment_day_main; delete d.payment_day_main; }
        if (d.min_payment_main !== undefined) { d.min_payment = d.min_payment_main; delete d.min_payment_main; }
        // Clean up overdraft-only fields for non-overdraft types
        delete d.start_date_od; delete d.end_date_od; delete d.term_months_od; delete d.bank_monthly_payment_od;
      } else if (type === 'dividend') {
        // Force: if dividend amount is 0 or negative, tax must be 0
        if (!d.amount || d.amount <= 0) { d.amount = 0; d.tax_amount = 0; }
        // If no tax_pct provided or 0, tax_amount must be 0
        if (!d.tax_pct || d.tax_pct <= 0) { d.tax_amount = 0; d.tax_pct = 0; }
      }
      var endpoint = type === 'asset' ? '/assets' : type === 'loan' ? '/loans' : type === 'dividend' ? '/dividends' : '/other-income-expenses';
      var result;
      if (pnlEditId) { result = await api(endpoint + '/' + pnlEditId, { method: 'PUT', body: JSON.stringify(d), _silent: true }); }
      else { result = await api(endpoint, { method: 'POST', body: JSON.stringify(d), _silent: true }); }
      if (!result || result.error) {
        if (restoreBtn) restoreBtn();
        toast('\\u041e\\u0448\\u0438\\u0431\\u043a\\u0430: ' + ((result && result.error) || '\\u043d\\u0435\\u0442 \\u043e\\u0442\\u0432\\u0435\\u0442\\u0430'), 'error');
        return;
      }
    }
    if (restoreBtn) restoreBtn();
  } catch(e) {
    if (restoreBtn) restoreBtn();
    toast('Ошибка сохранения: ' + (e.message || e), 'error');
    console.error('[PnL] savePnlItem exception:', e);
    return;
  }
  pnlEditId = 0; showPnlAddForm = false;
  // Refresh P&L data via individual endpoints (more reliable than bulk-data)
  try {
    var bulk = await api('/bulk-data', { _silent: true });
    if (bulk && !bulk.error) { data.taxPayments = bulk.taxPayments || []; data.assets = bulk.assets || []; data.loans = bulk.loans || []; data.loanPayments = bulk.loanPayments || []; data.dividends = bulk.dividends || []; data.otherIncomeExpenses = bulk.otherIncomeExpenses || []; if (bulk.loanSettings) data.loanSettings = bulk.loanSettings; }
    else {
      console.warn('[PnL] bulk-data failed, loading P&L data directly...');
      var [tp,as,lo,dv,oi] = await Promise.all([api('/tax-payments',{_silent:true}),api('/assets',{_silent:true}),api('/loans',{_silent:true}),api('/dividends',{_silent:true}),api('/other-income-expenses',{_silent:true})]);
      if (tp) data.taxPayments = tp.payments || [];
      if (as) data.assets = as.assets || [];
      if (lo) { data.loans = lo.loans || []; data.loanPayments = lo.payments || []; }
      if (dv) data.dividends = dv.dividends || [];
      if (oi) data.otherIncomeExpenses = oi.items || [];
    }
  } catch(bulkErr) {
    console.error('[PnL] data refresh error:', bulkErr);
    try {
      var [tp2,as2,lo2] = await Promise.all([api('/tax-payments',{_silent:true}),api('/assets',{_silent:true}),api('/loans',{_silent:true})]);
      if (tp2) data.taxPayments = tp2.payments || [];
      if (as2) data.assets = as2.assets || [];
      if (lo2) { data.loans = lo2.loans || []; data.loanPayments = lo2.payments || []; }
    } catch(e2) { console.error('[PnL] fallback load failed:', e2); }
  }
  pnlData = null; loadPnlData();
  toast(type === 'tax' ? '✓ Налог сохранён' : type === 'asset' ? '✓ Актив сохранён' : type === 'loan' ? '✓ Кредит сохранён' : type === 'dividend' ? '✓ Дивиденд сохранён' : '✓ Запись сохранена');
}
async function deletePnlItem(type, id) {
  if (!confirm('Удалить запись?')) return;
  var endpoint = type === 'tax' ? '/tax-payments' : type === 'asset' ? '/assets' : type === 'loan' ? '/loans' : type === 'dividend' ? '/dividends' : '/other-income-expenses';
  await api(endpoint + '/' + id, { method: 'DELETE', _silent: true });
  try {
    var bulk = await api('/bulk-data', { _silent: true });
    if (bulk && !bulk.error) { data.taxPayments = bulk.taxPayments || []; data.assets = bulk.assets || []; data.loans = bulk.loans || []; data.loanPayments = bulk.loanPayments || []; data.dividends = bulk.dividends || []; data.otherIncomeExpenses = bulk.otherIncomeExpenses || []; if (bulk.loanSettings) data.loanSettings = bulk.loanSettings; }
    else {
      var [tp,as,lo,dv,oi] = await Promise.all([api('/tax-payments',{_silent:true}),api('/assets',{_silent:true}),api('/loans',{_silent:true}),api('/dividends',{_silent:true}),api('/other-income-expenses',{_silent:true})]);
      if (tp) data.taxPayments = tp.payments || [];
      if (as) data.assets = as.assets || [];
      if (lo) { data.loans = lo.loans || []; data.loanPayments = lo.payments || []; }
      if (dv) data.dividends = dv.dividends || [];
      if (oi) data.otherIncomeExpenses = oi.items || [];
    }
  } catch(e) { console.error('[PnL] delete refresh error:', e); }
  pnlData = null; loadPnlData();
  toast('Удалено');
}
function editPnlItem(type, id) { pnlEditId = id; pnlEditType = type; showPnlAddForm = true; pnlSubTab = type === 'tax' ? 'taxes' : type === 'asset' ? 'assets' : type === 'loan' ? 'loans' : type === 'dividend' ? 'dividends' : 'other'; render(); }
function showPnlForm(type) { pnlEditId = 0; pnlEditType = type; showPnlAddForm = true; pnlSubTab = type === 'tax' ? 'taxes' : type === 'asset' ? 'assets' : type === 'loan' ? 'loans' : type === 'dividend' ? 'dividends' : 'other'; render(); }
async function saveLoanPayment(loanId) {
  var d = { amount: parseFloat(document.getElementById('lp_amount')?.value) || 0, principal_part: parseFloat(document.getElementById('lp_principal')?.value) || 0, interest_part: parseFloat(document.getElementById('lp_interest')?.value) || 0, payment_date: document.getElementById('lp_date')?.value || '' };
  await api('/loans/' + loanId + '/payments', { method: 'POST', body: JSON.stringify(d) });
  var bulk = await api('/bulk-data');
  if (bulk && !bulk.error) { data.loans = bulk.loans || []; data.loanPayments = bulk.loanPayments || []; }
  pnlData = null; loadPnlData(); toast('Платёж добавлен');
}

// ===== TAX RULES CRUD =====
async function saveTaxRule() {
  var d = {
    rule_name: document.getElementById('tax_rule_name')?.value || '',
    tax_type: document.getElementById('tax_rule_type')?.value || 'income_tax',
    tax_rate: parseFloat(document.getElementById('tax_rule_rate')?.value) || 0,
    tax_base: document.getElementById('tax_rule_base')?.value || 'revenue',
    frequency: document.getElementById('tax_rule_freq')?.value || 'monthly',
    apply_from: document.getElementById('tax_rule_from')?.value || '',
    notes: document.getElementById('tax_rule_notes')?.value || '',
    is_active: 1
  };
  if (!d.rule_name) { toast('Укажите название правила', 'error'); return; }
  if (editTaxRuleId) {
    await api('/tax-rules/' + editTaxRuleId, { method: 'PUT', body: JSON.stringify(d), _silent: true });
  } else {
    await api('/tax-rules', { method: 'POST', body: JSON.stringify(d), _silent: true });
  }
  var bulk = await api('/bulk-data', { _silent: true });
  if (bulk && !bulk.error) { data.taxRules = bulk.taxRules || []; data.taxPayments = bulk.taxPayments || []; }
  showTaxRuleForm = false; editTaxRuleId = 0;
  pnlData = null; loadPnlData();
  toast('✓ Правило сохранено');
}

async function deleteTaxRule(id) {
  if (!confirm('Удалить правило?')) return;
  await api('/tax-rules/' + id, { method: 'DELETE', _silent: true });
  var bulk = await api('/bulk-data', { _silent: true });
  if (bulk && !bulk.error) { data.taxRules = bulk.taxRules || []; }
  pnlData = null; loadPnlData();
  toast('Правило удалено');
}

async function generateTaxFromRules() {
  var res = await api('/tax-rules/generate/' + pnlPeriod, { method: 'POST', _silent: true });
  if (res && res.success && res.generated > 0) {
    var bulk = await api('/bulk-data', { _silent: true });
    if (bulk && !bulk.error) { data.taxPayments = bulk.taxPayments || []; }
    pnlData = null; loadPnlData();
    toast('✓ Создано платежей: ' + res.generated);
  } else if (res && res.generated === 0 && !res.error) {
    toast('Платежи уже существуют или нет применимых правил', 'info');
  } else if (res && res.error) {
    toast(res.error, 'error');
  } else {
    toast('Ошибка генерации', 'error');
  }
}

function renderPnLTab() {
  if (!pnlData && !pnlLoading) { loadPnlData(); return '<div style="text-align:center;padding:40px"><div class="spinner" style="width:32px;height:32px;margin:0 auto"></div><p style="color:#94a3b8;margin-top:12px">Загрузка P&L...</p></div>'; }
  if (pnlLoading) return '<div style="text-align:center;padding:40px"><div class="spinner" style="width:32px;height:32px;margin:0 auto"></div></div>';
  var p = pnlData || {};
  var mNames = ['','Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  var mFull = ['','Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  var mNum = parseInt(pnlPeriod.split('-')[1]) || 1;
  var h = '';
  // Show P&L error banner if API failed
  if (p._pnl_error) {
    h += '<div class="card" style="padding:14px 20px;margin-bottom:16px;background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.3)">';
    h += '<div style="display:flex;align-items:center;gap:10px"><i class="fas fa-exclamation-triangle" style="color:#EF4444;font-size:1.2rem"></i>';
    h += '<div><div style="font-weight:700;color:#EF4444;font-size:0.9rem">Ошибка загрузки P&L</div>';
    h += '<div style="font-size:0.78rem;color:#94a3b8;margin-top:2px">' + escHtml(p._pnl_error) + '</div>';
    h += '<div style="font-size:0.75rem;color:#64748b;margin-top:4px">Попробуйте перезагрузить страницу. Если ошибка повторяется — нужен редеплой для обновления базы данных.</div>';
    h += '</div><button class="btn btn-outline" style="padding:6px 12px;font-size:0.8rem;flex-shrink:0" onclick="pnlData=null;loadPnlData()"><i class="fas fa-redo" style="margin-right:4px"></i>Повторить</button></div></div>';
  }
  // Period selector
  h += '<div class="card" style="padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">';
  h += '<button class="btn btn-outline" style="padding:6px 12px;font-size:1rem" onclick="setPnlPeriod(&apos;prev&apos;)"><i class="fas fa-chevron-left"></i></button>';
  h += '<div style="font-size:1.2rem;font-weight:800;color:#a78bfa;min-width:160px;text-align:center"><i class="fas fa-calendar-alt" style="margin-right:8px"></i>' + mFull[mNum] + ' ' + pnlPeriod.split('-')[0] + '</div>';
  h += '<button class="btn btn-outline" style="padding:6px 12px;font-size:1rem" onclick="setPnlPeriod(&apos;next&apos;)"><i class="fas fa-chevron-right"></i></button>';
  h += '<span style="color:#475569;margin-left:8px">|</span>';
  h += '<input type="month" class="input" style="padding:4px 10px;width:160px;font-size:0.85rem" value="' + pnlPeriod + '" onchange="pnlPeriod=this.value;pnlData=null;loadPnlData()">';
  h += '<span style="color:#64748b;font-size:0.78rem;margin-left:6px">\\u0432\\u0430\\u043b\\u044e\\u0442\\u0430: AMD</span>';
  if (p.prev_period) h += '<span style="color:#475569;font-size:0.72rem;margin-left:8px">vs ' + p.prev_period + '</span>';
  // Fiscal year start selector
  h += '<span style="color:#475569;margin-left:8px">|</span>';
  h += '<span style="color:#64748b;font-size:0.78rem;margin-left:6px">\\u0424\\u0438\\u0441\\u043a. \\u0433\\u043e\\u0434 \\u0441:</span>';
  h += '<select class="input" style="width:100px;padding:3px 8px;font-size:0.78rem;margin-left:4px" onchange="saveFiscalYearStart(this.value)">';
  var fmNames = ["\\u042f\\u043d\\u0432","\\u0424\\u0435\\u0432","\\u041c\\u0430\\u0440","\\u0410\\u043f\\u0440","\\u041c\\u0430\\u0439","\\u0418\\u044e\\u043d","\\u0418\\u044e\\u043b","\\u0410\\u0432\\u0433","\\u0421\\u0435\\u043d","\\u041e\\u043a\\u0442","\\u041d\\u043e\\u044f","\\u0414\\u0435\\u043a"];
  for (var fi = 1; fi <= 12; fi++) h += '<option value="' + fi + '"' + ((p.fiscal_year_start_month || pnlFiscalMonth || 1) === fi ? ' selected' : '') + '>' + fmNames[fi-1] + ' (' + fi + ')</option>';
  h += '</select>';
  h += '</div>';
  // Sub-tabs
  var subTabs = [{id:'cascade',icon:'fa-stream',label:'P&L \\u041a\\u0430\\u0441\\u043a\\u0430\\u0434'},{id:'taxes',icon:'fa-landmark',label:'\\u041d\\u0430\\u043b\\u043e\\u0433\\u0438'},{id:'assets',icon:'fa-building',label:'\\u0410\\u043c\\u043e\\u0440\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f'},{id:'loans',icon:'fa-hand-holding-usd',label:'\\u041a\\u0440\\u0435\\u0434\\u0438\\u0442\\u044b'},{id:'dividends',icon:'fa-money-check-alt',label:'\\u0414\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u044b'},{id:'other',icon:'fa-exchange-alt',label:'\\u041f\\u0440\\u043e\\u0447\\u0435\\u0435'},{id:'scenario',icon:'fa-flask',label:'\\u0421\\u0446\\u0435\\u043d\\u0430\\u0440\\u0438\\u0438'},{id:'summary',icon:'fa-clipboard-list',label:'\\u0421\\u0432\\u043e\\u0434\\u043a\\u0430'}];
  h += '<div style="display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap">';
  for (var si = 0; si < subTabs.length; si++) {
    var st = subTabs[si];
    h += '<button class="tab-btn' + (pnlSubTab === st.id ? ' active' : '') + '" onclick="pnlSubTab=&apos;' + st.id + '&apos;;render()" style="padding:8px 14px;font-size:0.82rem"><i class="fas ' + st.icon + '" style="margin-right:5px"></i>' + st.label + '</button>';
  }
  h += '</div>';
  if (pnlSubTab === 'cascade') h += renderPnlCascade(p);
  else if (pnlSubTab === 'taxes') h += renderPnlTaxes(p);
  else if (pnlSubTab === 'assets') h += renderPnlAssets(p);
  else if (pnlSubTab === 'loans') h += renderPnlLoans(p);
  else if (pnlSubTab === 'dividends') h += renderPnlDividends(p);
  else if (pnlSubTab === 'other') h += renderPnlOther(p);
  else if (pnlSubTab === 'summary') h += renderPnlSummary(p);
  else if (pnlSubTab === 'scenario') h += renderPnlScenario(p);
  return h;
}

let pnlShowYtd = false; // toggle YTD column
let pnlShowMom = true;  // toggle MoM delta column

function pnlRow(label, value, opts) {
  opts = opts || {};
  var color = opts.color || '#e2e8f0'; var bold = opts.bold; var indent = opts.indent || 0; var pct = opts.pct; var sub = opts.sub; var icon = opts.icon || '';
  var bg = bold ? 'background:rgba(139,92,246,0.06);' : sub ? 'background:rgba(71,85,105,0.08);' : '';
  var pad = 12 + indent * 20;
  var mom = opts.mom; var momPct = opts.momPct; var ytdVal = opts.ytd;
  // How many columns: label + value + optional MoM + optional YTD
  var cols = 2 + (pnlShowMom ? 1 : 0) + (pnlShowYtd ? 1 : 0);
  var gridCols = 'minmax(180px,2fr)' + ' minmax(100px,1fr)'.repeat(cols - 1);
  var h = '<div style="display:grid;grid-template-columns:' + gridCols + ';align-items:center;padding:10px ' + pad + 'px;border-bottom:1px solid #1e293b;' + bg + ';gap:8px">';
  h += '<span style="color:' + (sub ? '#64748b' : '#94a3b8') + ';font-size:' + (bold ? '0.95rem' : '0.85rem') + ';font-weight:' + (bold ? '700' : '400') + '">' + (icon ? '<i class="fas ' + icon + '" style="width:16px;margin-right:8px;color:#8B5CF6;font-size:0.75rem"></i>' : '') + label + '</span>';
  h += '<span style="text-align:right;color:' + color + ';font-weight:' + (bold ? '800' : '600') + ';font-size:' + (bold ? '1.02rem' : '0.88rem') + '">' + fmtAmt(value) + (pct !== undefined ? ' <span style="color:#64748b;font-size:0.72rem">(' + pct + '%)</span>' : '') + '</span>';
  if (pnlShowMom && mom !== undefined) {
    var mColor = mom > 0 ? '#22C55E' : mom < 0 ? '#EF4444' : '#475569';
    var arrow = mom > 0 ? '\\u25B2' : mom < 0 ? '\\u25BC' : '';
    var pctStr = momPct !== undefined && momPct !== 0 ? ' <span style="font-size:0.68rem">(' + (momPct > 0 ? '+' : '') + momPct + '%)</span>' : '';
    h += '<span style="text-align:right;color:' + mColor + ';font-size:0.78rem;font-weight:500">' + arrow + ' ' + (mom > 0 ? '+' : '') + fmtAmt(mom) + pctStr + '</span>';
  } else if (pnlShowMom) {
    h += '<span></span>';
  }
  if (pnlShowYtd && ytdVal !== undefined) {
    h += '<span style="text-align:right;color:#8B5CF6;font-size:0.82rem;font-weight:600">' + fmtAmt(ytdVal) + '</span>';
  } else if (pnlShowYtd) {
    h += '<span></span>';
  }
  h += '</div>';
  return h;
}

function renderPnlCascade(p) {
  var mom = p.mom || {}; var mp = p.mom_pct || {}; var ytd = p.ytd || {};
  var h = '';
  // Tax type labels for cascade display
  var taxTypeLabels = {income_tax:'\\u041d\\u0430\\u043b\\u043e\\u0433 \\u043d\\u0430 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c',vat:'\\u041d\\u0414\\u0421',usn_income:'\\u0423\\u0421\\u041d \\u0414\\u043e\\u0445\\u043e\\u0434\\u044b',usn_income_expense:'\\u0423\\u0421\\u041d \\u0414\\u043e\\u0445\\u043e\\u0434\\u044b\\u2212\\u0420\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b',turnover_tax:'\\u041d\\u0430\\u043b\\u043e\\u0433 \\u043d\\u0430 \\u043e\\u0431\\u043e\\u0440\\u043e\\u0442',payroll_tax:'\\u041d\\u0430\\u043b\\u043e\\u0433\\u0438 \\u043d\\u0430 \\u0417\\u041f',patent:'\\u041f\\u0430\\u0442\\u0435\\u043d\\u0442',property:'\\u0418\\u043c\\u0443\\u0449\\u0435\\u0441\\u0442\\u0432\\u043e',other:'\\u041f\\u0440\\u043e\\u0447\\u0435\\u0435'};
  // Tooltip helper
  function tip(text) { return ' <i class="fas fa-question-circle" style="color:#8B5CF6;font-size:0.65rem;cursor:help;vertical-align:super" title="' + text.replace(/"/g, '&quot;') + '"></i>'; }
  // Toggle buttons
  h += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">';
  h += '<button class="tab-btn' + (pnlShowMom ? ' active' : '') + '" onclick="pnlShowMom=!pnlShowMom;render()" style="padding:6px 12px;font-size:0.78rem"><i class="fas fa-exchange-alt" style="margin-right:4px"></i>MoM \\u0414\\u0435\\u043b\\u044c\\u0442\\u0430</button>';
  h += '<button class="tab-btn' + (pnlShowYtd ? ' active' : '') + '" onclick="pnlShowYtd=!pnlShowYtd;render()" style="padding:6px 12px;font-size:0.78rem"><i class="fas fa-calendar-check" style="margin-right:4px"></i>YTD' + (p.fiscal_year_start ? ' (\\u0441 ' + p.fiscal_year_start + ')' : '') + '</button>';
  h += '</div>';
  
  
  h += '<div class="card" style="padding:0;overflow:hidden">';
  // Header row
  var cols = 2 + (pnlShowMom ? 1 : 0) + (pnlShowYtd ? 1 : 0);
  var gridCols = 'minmax(180px,2fr)' + ' minmax(100px,1fr)'.repeat(cols - 1);
  h += '<div style="display:grid;grid-template-columns:' + gridCols + ';padding:12px 12px;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(59,130,246,0.08));border-bottom:2px solid #8B5CF6;gap:8px">';
  h += '<span style="font-weight:800;font-size:1rem;color:#a78bfa"><i class="fas fa-file-invoice-dollar" style="margin-right:8px"></i>P&L \\u041a\\u0430\\u0441\\u043a\\u0430\\u0434</span>';
  h += '<span style="text-align:right;font-weight:700;color:#94a3b8;font-size:0.8rem">\\u0422\\u0435\\u043a\\u0443\\u0449\\u0438\\u0439</span>';
  if (pnlShowMom) h += '<span style="text-align:right;font-weight:700;color:#F59E0B;font-size:0.8rem">\\u0394 MoM</span>';
  if (pnlShowYtd) h += '<span style="text-align:right;font-weight:700;color:#8B5CF6;font-size:0.8rem">YTD' + (p.fiscal_year_start_month && p.fiscal_year_start_month !== 1 ? ' (\\u0444\\u0438\\u0441\\u043a.)' : '') + '</span>';
  h += '</div>';
  
  // Revenue
  h += pnlRow('\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 (Revenue)' + tip('\\u0421\\u0443\\u043c\\u043c\\u0430 \\u0443\\u0441\\u043b\\u0443\\u0433 \\u0438\\u0437 \\u0437\\u0430\\u043a\\u0440\\u044b\\u0442\\u044b\\u0445 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434\\u043e\\u0432'), p.revenue, {bold:true, color:'#22C55E', icon:'fa-coins', mom:mom.revenue, momPct:mp.revenue, ytd:ytd.revenue});
  // Package revenue breakdown in cascade
  var pnlPkgRev = Number((analyticsData && analyticsData.packages_total_revenue) || 0);
  var pnlPkgCnt = Number((analyticsData && analyticsData.packages_total_count) || 0);
  if (pnlPkgRev > 0) {
    h += pnlRow('  \\u0438\\u0437 \\u043d\\u0438\\u0445 \\u043f\\u0430\\u043a\\u0435\\u0442\\u044b (' + pnlPkgCnt + ' \\u0448\\u0442)' + tip('\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 \\u043e\\u0442 \\u043f\\u0440\\u043e\\u0434\\u0430\\u0436\\u0438 \\u043f\\u0430\\u043a\\u0435\\u0442\\u043e\\u0432 \\u0443\\u0441\\u043b\\u0443\\u0433. \\u0412\\u0445\\u043e\\u0434\\u0438\\u0442 \\u0432 \\u043e\\u0431\\u0449\\u0443\\u044e \\u0432\\u044b\\u0440\\u0443\\u0447\\u043a\\u0443.'), pnlPkgRev, {indent:2, color:'#F59E0B', sub:true, icon:'fa-box-open'});
  }
  // Discount impact (from promo codes)
  var pnlDiscCost = Number((analyticsData && analyticsData.total_discount_cost) || 0);
  var pnlDiscLeads = Number((analyticsData && analyticsData.total_discount_leads) || 0);
  if (pnlDiscCost > 0) {
    h += pnlRow('  \\u0421\\u043a\\u0438\\u0434\\u043a\\u0438 \\u043f\\u043e \\u043f\\u0440\\u043e\\u043c\\u043e\\u043a\\u043e\\u0434\\u0430\\u043c (' + pnlDiscLeads + ' \\u043b\\u0438\\u0434\\u043e\\u0432)' + tip('\\u0421\\u0443\\u043c\\u043c\\u0430 \\u0441\\u043a\\u0438\\u0434\\u043e\\u043a \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u0430\\u043c \\u043f\\u043e \\u0440\\u0435\\u0444\\u0435\\u0440\\u0430\\u043b\\u044c\\u043d\\u044b\\u043c \\u043a\\u043e\\u0434\\u0430\\u043c. \\u0423\\u043c\\u0435\\u043d\\u044c\\u0448\\u0430\\u0435\\u0442 \\u0432\\u044b\\u0440\\u0443\\u0447\\u043a\\u0443.'), -pnlDiscCost, {indent:2, color:'#FBBF24', sub:true, icon:'fa-gift'});
  }
  h += pnlRow('\\u0412\\u043e\\u0437\\u0432\\u0440\\u0430\\u0442\\u044b', -(p.refunds||0), {indent:1, color:'#EF4444', sub:true});
  h += pnlRow('\\u0427\\u0438\\u0441\\u0442\\u0430\\u044f \\u0432\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430', p.net_revenue, {indent:1, color:'#22C55E', sub:true, ytd:ytd.net_revenue});
  // Commissions (informational — paid by client, not company expense)
  if (p.commissions_total > 0) {
    h += pnlRow('+ \\u041a\\u043e\\u043c\\u0438\\u0441\\u0441\\u0438\\u0438 \\u0437\\u0430 \\u043e\\u043f\\u043b\\u0430\\u0442\\u0443 (\\u043a\\u043b\\u0438\\u0435\\u043d\\u0442)' + tip('\\u041a\\u043e\\u043c\\u0438\\u0441\\u0441\\u0438\\u044f \\u0431\\u0430\\u043d\\u043a\\u0430/\\u043f\\u043b\\u0430\\u0442\\u0451\\u0436\\u043d\\u043e\\u0439 \\u0441\\u0438\\u0441\\u0442\\u0435\\u043c\\u044b, \\u043e\\u043f\\u043b\\u0430\\u0447\\u0435\\u043d\\u043d\\u0430\\u044f \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u043e\\u043c \\u0441\\u0432\\u0435\\u0440\\u0445 \\u0441\\u0443\\u043c\\u043c\\u044b \\u0437\\u0430\\u043a\\u0430\\u0437\\u0430. \\u041d\\u0435 \\u0432\\u043b\\u0438\\u044f\\u0435\\u0442 \\u043d\\u0430 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u043a\\u043e\\u043c\\u043f\\u0430\\u043d\\u0438\\u0438.'), p.commissions_total, {indent:1, color:'#3B82F6', sub:true, icon:'fa-credit-card'});
    h += pnlRow('= \\u0418\\u0442\\u043e\\u0433\\u043e \\u043a \\u043e\\u043f\\u043b\\u0430\\u0442\\u0435 \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u043e\\u043c' + tip('\\u0421\\u0443\\u043c\\u043c\\u0430 \\u0437\\u0430\\u043a\\u0430\\u0437\\u0430 + \\u043a\\u043e\\u043c\\u0438\\u0441\\u0441\\u0438\\u044f. \\u042d\\u0442\\u043e \\u0442\\u043e, \\u0447\\u0442\\u043e \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442 \\u0440\\u0435\\u0430\\u043b\\u044c\\u043d\\u043e \\u043f\\u043b\\u0430\\u0442\\u0438\\u0442.'), (p.revenue||0) + (p.commissions_total||0), {indent:1, color:'#a78bfa', sub:true, icon:'fa-calculator'});
  }
  // COGS
  h += pnlRow('\\u2212 \\u0421\\u0435\\u0431\\u0435\\u0441\\u0442\\u043e\\u0438\\u043c\\u043e\\u0441\\u0442\\u044c / \\u041a\\u043e\\u043c\\u043c\\u0435\\u0440\\u0447. (COGS)' + tip('\\u041a\\u043e\\u043c\\u043c\\u0435\\u0440\\u0447\\u0435\\u0441\\u043a\\u0438\\u0435 \\u0437\\u0430\\u0442\\u0440\\u0430\\u0442\\u044b \\u0438\\u0437 \\u0431\\u043b\\u043e\\u043a\\u0430 \\u0417\\u0430\\u0442\\u0440\\u0430\\u0442\\u044b (is_marketing=0)'), p.cogs, {indent:1, color:'#F59E0B', icon:'fa-truck', mom:mom.cogs, momPct:mp.cogs, ytd:ytd.cogs});
  // Gross
  h += '<div style="height:2px;background:linear-gradient(90deg,#8B5CF6,transparent)"></div>';
  h += pnlRow('\\u0412\\u0410\\u041b\\u041e\\u0412\\u0410\\u042f \\u041f\\u0420\\u0418\\u0411\\u042b\\u041b\\u042c (Gross)' + tip('\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 \\u2212 COGS'), p.gross_profit, {bold:true, color: p.gross_profit >= 0 ? '#22C55E' : '#EF4444', pct: p.gross_margin, mom:mom.gross_profit, momPct:mp.gross_profit, ytd:ytd.gross_profit});
  // Opex
  h += pnlRow('\\u2212 \\u0417\\u041f + \\u0411\\u043e\\u043d\\u0443\\u0441\\u044b \\u2212 \\u0428\\u0442\\u0440\\u0430\\u0444\\u044b' + tip('\\u0421\\u0443\\u043c\\u043c\\u0430 \\u0437\\u0430\\u0440\\u043f\\u043b\\u0430\\u0442 \\u0438 \\u0431\\u043e\\u043d\\u0443\\u0441\\u043e\\u0432 \\u0437\\u0430 \\u0432\\u044b\\u0447\\u0435\\u0442\\u043e\\u043c \\u0448\\u0442\\u0440\\u0430\\u0444\\u043e\\u0432 \\u0438\\u0437 \\u0431\\u043b\\u043e\\u043a\\u0430 \\u0421\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u043a\\u0438'), p.salary_total, {indent:1, color:'#F59E0B', icon:'fa-users', mom:mom.salary_total, ytd:ytd.salary_total});
  h += pnlRow('  \\u0417\\u041f \\u0431\\u0430\\u0437\\u043e\\u0432\\u0430\\u044f', p.salaries, {indent:2, sub:true});
  h += pnlRow('  \\u0411\\u043e\\u043d\\u0443\\u0441\\u044b', p.bonuses, {indent:2, sub:true, color:'#22C55E'});
  h += pnlRow('  \\u0428\\u0442\\u0440\\u0430\\u0444\\u044b', p.penalties, {indent:2, sub:true, color:'#EF4444'});
  h += pnlRow('\\u2212 \\u041c\\u0430\\u0440\\u043a\\u0435\\u0442\\u0438\\u043d\\u0433' + tip('\\u041c\\u0430\\u0440\\u043a\\u0435\\u0442\\u0438\\u043d\\u0433\\u043e\\u0432\\u044b\\u0435 \\u0437\\u0430\\u0442\\u0440\\u0430\\u0442\\u044b \\u0438\\u0437 \\u0431\\u043b\\u043e\\u043a\\u0430 \\u0417\\u0430\\u0442\\u0440\\u0430\\u0442\\u044b (is_marketing=1)'), p.marketing, {indent:1, color:'#F59E0B', icon:'fa-bullhorn', mom:mom.marketing, ytd:ytd.marketing});
  h += pnlRow('\\u2212 \\u0410\\u043c\\u043e\\u0440\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f' + tip('\\u0415\\u0436\\u0435\\u043c\\u0435\\u0441\\u044f\\u0447\\u043d\\u043e\\u0435 \\u0441\\u043f\\u0438\\u0441\\u0430\\u043d\\u0438\\u0435 \\u0441\\u0442\\u043e\\u0438\\u043c\\u043e\\u0441\\u0442\\u0438 \\u043e\\u0441\\u043d\\u043e\\u0432\\u043d\\u044b\\u0445 \\u0441\\u0440\\u0435\\u0434\\u0441\\u0442\\u0432. \\u0421\\u043c. \\u0432\\u043a\\u043b\\u0430\\u0434\\u043a\\u0443 \\u0410\\u043c\\u043e\\u0440\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f'), p.depreciation, {indent:1, color:'#F59E0B', icon:'fa-building', ytd:ytd.depreciation});
  h += pnlRow('\\u0418\\u0442\\u043e\\u0433\\u043e \\u043e\\u043f\\u0435\\u0440. \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b (OPEX)' + tip('\\u0417\\u041f + \\u041c\\u0430\\u0440\\u043a\\u0435\\u0442\\u0438\\u043d\\u0433 + \\u0410\\u043c\\u043e\\u0440\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f'), p.total_opex, {indent:1, color:'#F59E0B', mom:mom.total_opex, ytd:ytd.total_opex});
  // EBIT
  h += '<div style="height:2px;background:linear-gradient(90deg,#3B82F6,transparent)"></div>';
  h += pnlRow('\\u041e\\u041f\\u0415\\u0420\\u0410\\u0426. \\u041f\\u0420\\u0418\\u0411\\u042b\\u041b\\u042c (EBIT)' + tip('\\u0412\\u0430\\u043b\\u043e\\u0432\\u0430\\u044f \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u2212 OPEX. \\u041f\\u043e\\u043a\\u0430\\u0437\\u044b\\u0432\\u0430\\u0435\\u0442 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u044c \\u043e\\u0441\\u043d\\u043e\\u0432\\u043d\\u043e\\u0439 \\u0434\\u0435\\u044f\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0431\\u0435\\u0437 \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432 \\u0438 \\u043f\\u0440\\u043e\\u0446\\u0435\\u043d\\u0442\\u043e\\u0432'), p.ebit, {bold:true, color: p.ebit >= 0 ? '#22C55E' : '#EF4444', pct: p.ebit_margin, mom:mom.ebit, momPct:mp.ebit, ytd:ytd.ebit});
  h += pnlRow('EBITDA' + tip('EBIT + \\u0410\\u043c\\u043e\\u0440\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f. \\u041f\\u043e\\u043a\\u0430\\u0437\\u044b\\u0432\\u0430\\u0435\\u0442 \\u0434\\u0435\\u043d\\u0435\\u0436\\u043d\\u044b\\u0439 \\u043f\\u043e\\u0442\\u043e\\u043a \\u043e\\u0442 \\u043e\\u043f\\u0435\\u0440\\u0430\\u0446\\u0438\\u0439 \\u0431\\u0435\\u0437 \\u0443\\u0447\\u0451\\u0442\\u0430 \\u043d\\u0435\\u0434\\u0435\\u043d\\u0435\\u0436\\u043d\\u044b\\u0445 \\u0441\\u043f\\u0438\\u0441\\u0430\\u043d\\u0438\\u0439'), p.ebitda, {indent:1, color:'#8B5CF6', pct: p.ebitda_margin, mom:mom.ebitda, ytd:ytd.ebitda});
  // Other
  h += pnlRow('+ \\u041f\\u0440\\u043e\\u0447\\u0438\\u0435 \\u0434\\u043e\\u0445\\u043e\\u0434\\u044b' + tip('\\u041d\\u0435\\u043e\\u043f\\u0435\\u0440\\u0430\\u0446\\u0438\\u043e\\u043d\\u043d\\u044b\\u0435 \\u0434\\u043e\\u0445\\u043e\\u0434\\u044b: \\u043f\\u0440\\u043e\\u0434\\u0430\\u0436\\u0430 \\u0430\\u043a\\u0442\\u0438\\u0432\\u043e\\u0432, \\u043a\\u0443\\u0440\\u0441\\u043e\\u0432\\u044b\\u0435 \\u0440\\u0430\\u0437\\u043d\\u0438\\u0446\\u044b, \\u0441\\u0443\\u0431\\u0441\\u0438\\u0434\\u0438\\u0438 \\u0438 \\u0442.\\u0434.'), p.other_income, {indent:1, color:'#22C55E', icon:'fa-plus-circle', ytd:ytd.other_income});
  h += pnlRow('\\u2212 \\u041f\\u0440\\u043e\\u0447\\u0438\\u0435 \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b' + tip('\\u041d\\u0435\\u043e\\u043f\\u0435\\u0440\\u0430\\u0446\\u0438\\u043e\\u043d\\u043d\\u044b\\u0435 \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b: \\u0448\\u0442\\u0440\\u0430\\u0444\\u044b, \\u0441\\u0442\\u0440\\u0430\\u0445\\u043e\\u0432\\u043a\\u0438, \\u0440\\u0430\\u0437\\u043e\\u0432\\u044b\\u0435 \\u0442\\u0440\\u0430\\u0442\\u044b'), p.other_expenses, {indent:1, color:'#EF4444', icon:'fa-minus-circle', ytd:ytd.other_expenses});
  h += pnlRow('\\u2212 \\u041f\\u0440\\u043e\\u0446\\u0435\\u043d\\u0442\\u044b \\u043f\\u043e \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u0430\\u043c' + tip('\\u041f\\u0440\\u043e\\u0446\\u0435\\u043d\\u0442\\u043d\\u0430\\u044f \\u0447\\u0430\\u0441\\u0442\\u044c \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0435\\u0439 \\u043f\\u043e \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u0430\\u043c \\u0437\\u0430 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434'), p.interest_expense, {indent:1, color:'#EF4444', icon:'fa-percentage', ytd:ytd.interest_expense});
  // EBT
  h += '<div style="height:2px;background:linear-gradient(90deg,#F59E0B,transparent)"></div>';
  h += pnlRow('\\u041f\\u0420\\u0418\\u0411\\u042b\\u041b\\u042c \\u0414\\u041e \\u041d\\u0410\\u041b\\u041e\\u0413\\u041e\\u0412 (EBT)' + tip('EBIT + \\u041f\\u0440\\u043e\\u0447\\u0438\\u0435 \\u0434\\u043e\\u0445\\u043e\\u0434\\u044b \\u2212 \\u041f\\u0440\\u043e\\u0447\\u0438\\u0435 \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b \\u2212 \\u041f\\u0440\\u043e\\u0446\\u0435\\u043d\\u0442\\u044b. \\u0411\\u0430\\u0437\\u0430 \\u0434\\u043b\\u044f \\u0440\\u0430\\u0441\\u0447\\u0451\\u0442\\u0430 \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432'), p.ebt, {bold:true, color: p.ebt >= 0 ? '#22C55E' : '#EF4444', mom:mom.ebt, momPct:mp.ebt, ytd:ytd.ebt});
  // Taxes
  h += pnlRow('\\u2212 \\u041d\\u0430\\u043b\\u043e\\u0433\\u0438' + tip('\\u0421\\u0443\\u043c\\u043c\\u0430 \\u0432\\u0441\\u0435\\u0445 \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432\\u044b\\u0445 \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0435\\u0439 \\u0437\\u0430 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434. \\u0410\\u0432\\u0442\\u043e\\u0440\\u0430\\u0441\\u0447\\u0451\\u0442 = \\u0441\\u0442\\u0430\\u0432\\u043a\\u0430% \\u00d7 \\u0431\\u0430\\u0437\\u0430'), p.total_taxes, {indent:1, color:'#EF4444', icon:'fa-landmark', mom:mom.total_taxes, ytd:ytd.total_taxes});
  if (p.taxes && p.taxes.length) { for (var ti = 0; ti < p.taxes.length; ti++) { var tx = p.taxes[ti]; var txLabel = '  ' + (tx.tax_name || taxTypeLabels[tx.tax_type] || tx.tax_type); if (tx.is_auto && tx.tax_rate) txLabel += ' [' + tx.tax_rate + '%]'; h += pnlRow(txLabel, tx.amount, {indent:2, sub:true}); } }
  // ETR and Tax Burden
  h += '<div style="display:grid;grid-template-columns:minmax(180px,2fr) minmax(100px,1fr);align-items:center;padding:8px 52px;border-bottom:1px solid #1e293b;background:rgba(71,85,105,0.08);gap:8px">';
  h += '<span style="color:#64748b;font-size:0.82rem">ETR (\\u044d\\u0444\\u0444. \\u043d\\u0430\\u043b\\u043e\\u0433. \\u0441\\u0442\\u0430\\u0432\\u043a\\u0430)' + tip('\\u041d\\u0430\\u043b\\u043e\\u0433\\u0438 / EBT \\u00d7 100%. \\u041f\\u043e\\u043a\\u0430\\u0437\\u044b\\u0432\\u0430\\u0435\\u0442 \\u0440\\u0435\\u0430\\u043b\\u044c\\u043d\\u0443\\u044e \\u0434\\u043e\\u043b\\u044e \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432 \\u0432 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438') + '</span><span style="text-align:right;color:#F59E0B;font-weight:600;font-size:0.88rem">' + fmtPct(p.effective_tax_rate) + '</span></div>';
  h += '<div style="display:grid;grid-template-columns:minmax(180px,2fr) minmax(100px,1fr);align-items:center;padding:8px 52px;border-bottom:1px solid #1e293b;background:rgba(71,85,105,0.08);gap:8px">';
  h += '<span style="color:#64748b;font-size:0.82rem">\\u041d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432\\u0430\\u044f \\u043d\\u0430\\u0433\\u0440\\u0443\\u0437\\u043a\\u0430 \\u043d\\u0430 \\u0432\\u044b\\u0440\\u0443\\u0447\\u043a\\u0443' + tip('\\u041d\\u0430\\u043b\\u043e\\u0433\\u0438 / \\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 \\u00d7 100%. \\u041f\\u043e\\u043a\\u0430\\u0437\\u044b\\u0432\\u0430\\u0435\\u0442 \\u043a\\u0430\\u043a\\u0443\\u044e \\u0434\\u043e\\u043b\\u044e \\u0432\\u044b\\u0440\\u0443\\u0447\\u043a\\u0438 \\u0437\\u0430\\u0431\\u0438\\u0440\\u0430\\u044e\\u0442 \\u043d\\u0430\\u043b\\u043e\\u0433\\u0438') + '</span><span style="text-align:right;color:#F59E0B;font-weight:600;font-size:0.88rem">' + fmtPct(p.tax_burden) + '</span></div>';
  // Net profit
  h += '<div style="height:3px;background:linear-gradient(90deg,#22C55E,#8B5CF6,transparent)"></div>';
  h += pnlRow('\\u0427\\u0418\\u0421\\u0422\\u0410\\u042f \\u041f\\u0420\\u0418\\u0411\\u042b\\u041b\\u042c (Net Profit)' + tip('EBT \\u2212 \\u041d\\u0430\\u043b\\u043e\\u0433\\u0438. \\u0418\\u0442\\u043e\\u0433\\u043e\\u0432\\u044b\\u0439 \\u0444\\u0438\\u043d\\u0430\\u043d\\u0441\\u043e\\u0432\\u044b\\u0439 \\u0440\\u0435\\u0437\\u0443\\u043b\\u044c\\u0442\\u0430\\u0442'), p.net_profit, {bold:true, color: p.net_profit >= 0 ? '#22C55E' : '#EF4444', pct: p.net_margin, mom:mom.net_profit, momPct:mp.net_profit, ytd:ytd.net_profit});
  // Loan load info
  if (p.loan_total_monthly > 0) {
    h += '<div style="display:grid;grid-template-columns:minmax(180px,2fr) minmax(100px,1fr);align-items:center;padding:8px 52px;border-bottom:1px solid #1e293b;background:rgba(239,68,68,0.06);gap:8px">';
    h += '<span style="color:#EF4444;font-size:0.82rem"><i class="fas fa-hand-holding-usd" style="margin-right:6px"></i>Кредитная нагрузка на выручку' + tip('Факт. платежи по кредитам за период / Выручка × 100%') + '</span>';
    h += '<span style="text-align:right;color:#EF4444;font-weight:600;font-size:0.88rem">' + fmtPct(p.loan_load_on_revenue) + ' <span style="font-size:0.7rem;color:#94a3b8">(факт. ' + fmtAmt(p.loan_total_payments_period || 0) + ', план ' + fmtAmt(p.loan_total_monthly) + '/мес)</span></span></div>';
    h += '<div style="display:grid;grid-template-columns:minmax(180px,2fr) minmax(100px,1fr);align-items:center;padding:8px 52px;border-bottom:1px solid #1e293b;background:rgba(239,68,68,0.06);gap:8px">';
    h += '<span style="color:#F59E0B;font-size:0.82rem"><i class="fas fa-balance-scale" style="margin-right:6px"></i>Кредитная нагрузка на прибыль' + tip('Ежемесячные платежи / Чистая прибыль × 100%') + '</span>';
    h += '<span style="text-align:right;color:#F59E0B;font-weight:600;font-size:0.88rem">' + fmtPct(p.loan_load_on_profit) + '</span></div>';
    if (p.loan_repayment_mode === 'aggressive') {
      var aggrAmt = Math.round((p.net_profit||0) * (p.loan_aggressive_pct||10) / 100);
      h += '<div style="display:grid;grid-template-columns:minmax(180px,2fr) minmax(100px,1fr);align-items:center;padding:8px 52px;border-bottom:1px solid #1e293b;background:rgba(245,158,11,0.08);gap:8px">';
      h += '<span style="color:#F59E0B;font-size:0.82rem"><i class="fas fa-bolt" style="margin-right:6px"></i>Агрессивное погашение (' + (p.loan_aggressive_pct||10) + '% от прибыли)</span>';
      h += '<span style="text-align:right;color:#F59E0B;font-weight:700;font-size:0.88rem">' + fmtAmt(aggrAmt) + '</span></div>';
    } else if (p.loan_standard_extra_pct > 0) {
      var extraTotal = Math.round((p.net_profit || 0) * p.loan_standard_extra_pct / 100);
      h += '<div style="display:grid;grid-template-columns:minmax(180px,2fr) minmax(100px,1fr);align-items:center;padding:8px 52px;border-bottom:1px solid #1e293b;background:rgba(34,197,94,0.08);gap:8px">';
      h += '<span style="color:#22C55E;font-size:0.82rem"><i class="fas fa-plus-circle" style="margin-right:6px"></i>Доп. нагрузка на кредиты (' + p.loan_standard_extra_pct + '% от чистой прибыли)' + tip('Дополнительная сумма = чистая прибыль × ' + p.loan_standard_extra_pct + '%, равномерно распределённая между кредитами для досрочного погашения') + '</span>';
      h += '<span style="text-align:right;color:#22C55E;font-weight:700;font-size:0.88rem">+' + fmtAmt(extraTotal) + '</span></div>';
    }
    // Total credit load line
    var totalCreditLoad = p.loan_total_monthly;
    if (p.loan_repayment_mode === 'aggressive') { totalCreditLoad = Math.max(Math.round((p.net_profit||0) * (p.loan_aggressive_pct||10) / 100), p.loan_total_monthly); }
    else if (p.loan_standard_extra_pct > 0) { totalCreditLoad += Math.round((p.net_profit||0) * p.loan_standard_extra_pct / 100); }
    h += '<div style="display:grid;grid-template-columns:minmax(180px,2fr) minmax(100px,1fr);align-items:center;padding:8px 52px;border-bottom:1px solid #1e293b;background:rgba(239,68,68,0.1);gap:8px">';
    h += '<span style="color:#EF4444;font-size:0.82rem;font-weight:700"><i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>ИТОГО нагрузка на кредиты' + tip('Полная сумма ежемесячных платежей включая доп. нагрузку') + '</span>';
    h += '<span style="text-align:right;color:#EF4444;font-weight:800;font-size:0.92rem">' + fmtAmt(totalCreditLoad) + '</span></div>';
  }
  // Profit after loan payments (cascaded) — ALWAYS SHOW if there are active loans
  var effLoanPay = p.effective_loan_payments || Math.max(p.loan_total_payments_period || 0, p.loan_total_monthly || 0);
  if (effLoanPay > 0 || (p.loan_count || 0) > 0) {
    var profitAfterLoansVal = (p.net_profit_after_loans !== undefined) ? p.net_profit_after_loans : ((p.net_profit || 0) - effLoanPay);
    var palColor = profitAfterLoansVal >= 0 ? '#10B981' : '#EF4444';
    h += '<div style="display:grid;grid-template-columns:minmax(180px,2fr) minmax(100px,1fr);align-items:center;padding:8px 16px;border-bottom:2px solid ' + palColor + ';background:rgba(' + (profitAfterLoansVal >= 0 ? '16,185,129' : '239,68,68') + ',0.08);gap:8px">';
    h += '<span style="color:' + palColor + ';font-size:0.88rem;font-weight:700"><i class="fas fa-wallet" style="margin-right:6px"></i>\\u041f\\u0420\\u0418\\u0411\\u042b\\u041b\\u042c \\u041f\\u041e\\u0421\\u041b\\u0415 \\u041a\\u0420\\u0415\\u0414\\u0418\\u0422\\u041e\\u0412' + tip('\\u0427\\u0438\\u0441\\u0442\\u0430\\u044f \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c (' + fmtAmt(p.net_profit||0) + ') \\u2212 \\u041a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043d\\u044b\\u0435 \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0438 (' + fmtAmt(effLoanPay) + ').\\u041d\\u0430 \\u043e\\u0441\\u043d\\u043e\\u0432\\u0435 max(\\u0444\\u0430\\u043a\\u0442, \\u043f\\u043b\\u0430\\u043d). \\u0411\\u0430\\u0437\\u0430 \\u0434\\u043b\\u044f \\u0434\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u043e\\u0432 \\u0438 \\u043d\\u0435\\u0440\\u0430\\u0441\\u043f\\u0440\\u0435\\u0434\\u0435\\u043b\\u0451\\u043d\\u043d\\u043e\\u0439 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438') + '</span>';
    h += '<span style="text-align:right;color:' + palColor + ';font-weight:800;font-size:0.92rem">' + fmtAmt(profitAfterLoansVal) + '</span></div>';
  }
  // Dividends
  h += pnlRow('\\u2212 \\u0414\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u044b' + tip('\\u0412\\u044b\\u043f\\u043b\\u0430\\u0442\\u044b \\u0441\\u043e\\u0431\\u0441\\u0442\\u0432\\u0435\\u043d\\u043d\\u0438\\u043a\\u0430\\u043c \\u0438\\u0437 \\u0447\\u0438\\u0441\\u0442\\u043e\\u0439 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438'), p.total_dividends, {indent:1, color:'#8B5CF6', icon:'fa-money-check-alt', mom:mom.total_dividends, ytd:ytd.total_dividends});
  h += '<div style="height:2px;background:linear-gradient(90deg,#10B981,transparent)"></div>';
  h += pnlRow('\\u041d\\u0415\\u0420\\u0410\\u0421\\u041f\\u0420\\u0415\\u0414\\u0415\\u041b\\u0401\\u041d\\u041d\\u0410\\u042f \\u041f\\u0420\\u0418\\u0411\\u042b\\u041b\\u042c' + tip('\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u043f\\u043e\\u0441\\u043b\\u0435 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432 \\u2212 \\u0414\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u044b. \\u041e\\u0441\\u0442\\u0430\\u0451\\u0442\\u0441\\u044f \\u0432 \\u0431\\u0438\\u0437\\u043d\\u0435\\u0441\\u0435 \\u0434\\u043b\\u044f \\u0440\\u043e\\u0441\\u0442\\u0430'), p.retained_earnings, {bold:true, color: p.retained_earnings >= 0 ? '#10B981' : '#EF4444', mom:mom.retained_earnings, ytd:ytd.retained_earnings});
  h += '</div>';
  
  // Pro metrics cards
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-top:20px">';
  var proMetrics = [
    {label:'Burn Rate / \\u043c\\u0435\\u0441',val:fmtAmt(p.monthly_burn_rate),icon:'fa-fire',color:'#EF4444',desc:'\\u0415\\u0436\\u0435\\u043c\\u0435\\u0441. \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b + \\u043d\\u0430\\u043b\\u043e\\u0433\\u0438 + %'},
    {label:'YTD \\u041d\\u0430\\u043b\\u043e\\u0433\\u0438',val:fmtAmt(p.ytd_taxes),icon:'fa-landmark',color:'#F59E0B',desc:'\\u0421 \\u043d\\u0430\\u0447\\u0430\\u043b\\u0430 \\u0433\\u043e\\u0434\\u0430'},
    {label:'YTD \\u0414\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u044b',val:fmtAmt(p.ytd_dividends_amount||0),icon:'fa-money-check-alt',color:'#8B5CF6',desc:'\\u0421 \\u043d\\u0430\\u0447\\u0430\\u043b\\u0430 \\u0433\\u043e\\u0434\\u0430'},
    {label:'\\u0412\\u0430\\u043b\\u043e\\u0432\\u0430\\u044f \\u043c\\u0430\\u0440\\u0436\\u0430',val:fmtPct(p.gross_margin),icon:'fa-percentage',color:'#22C55E',desc:'\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 \\u2212 COGS'},
    {label:'\\u041e\\u043f\\u0435\\u0440. \\u043c\\u0430\\u0440\\u0436\\u0430',val:fmtPct(p.ebit_margin),icon:'fa-chart-bar',color:'#3B82F6',desc:'EBIT / \\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430'},
    {label:'\\u0427\\u0438\\u0441\\u0442\\u0430\\u044f \\u043c\\u0430\\u0440\\u0436\\u0430',val:fmtPct(p.net_margin),icon:'fa-trophy',color: p.net_margin >= 0 ? '#22C55E' : '#EF4444',desc:'Net / \\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430'},
    {label:'Кредит. нагрузка',val:fmtPct(p.loan_load_on_revenue||0),icon:'fa-hand-holding-usd',color: (p.loan_load_on_revenue||0) > 20 ? '#EF4444' : '#F59E0B',desc:'Платежи / Выручка'}
  ];
  for (var mi = 0; mi < proMetrics.length; mi++) {
    var pm = proMetrics[mi];
    h += '<div class="card" style="padding:16px;background:rgba(' + (pm.color === '#EF4444' ? '239,68,68' : pm.color === '#F59E0B' ? '245,158,11' : pm.color === '#8B5CF6' ? '139,92,246' : pm.color === '#22C55E' ? '34,197,94' : '59,130,246') + ',0.06);border-color:' + pm.color + '33">';
    h += '<div style="font-size:0.78rem;color:#64748b;margin-bottom:4px"><i class="fas ' + pm.icon + '" style="color:' + pm.color + ';margin-right:6px"></i>' + pm.label + '</div>';
    h += '<div style="font-size:1.4rem;font-weight:800;color:' + pm.color + '">' + pm.val + '</div>';
    h += '<div style="font-size:0.7rem;color:#475569;margin-top:2px">' + pm.desc + '</div></div>';
  }
  h += '</div>';
  
  // Formula reference block
  h += '<details style="margin-top:20px"><summary style="cursor:pointer;color:#64748b;font-size:0.85rem;font-weight:600"><i class="fas fa-info-circle" style="margin-right:6px;color:#8B5CF6"></i>\\u0424\\u043e\\u0440\\u043c\\u0443\\u043b\\u044b \\u0440\\u0430\\u0441\\u0447\\u0451\\u0442\\u043e\\u0432</summary>';
  h += '<div class="card" style="margin-top:8px;font-size:0.8rem;color:#94a3b8;line-height:1.8">';
  h += '<div><b style="color:#22C55E">\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430</b> = \\u0441\\u0443\\u043c\\u043c\\u0430 \\u0443\\u0441\\u043b\\u0443\\u0433 \\u0438\\u0437 \\u0437\\u0430\\u043a\\u0440\\u044b\\u0442\\u044b\\u0445 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434\\u043e\\u0432 (period_snapshots.revenue_services)</div>';
  h += '<div><b style="color:#F59E0B">COGS</b> = \\u041a\\u043e\\u043c\\u043c\\u0435\\u0440\\u0447\\u0435\\u0441\\u043a\\u0438\\u0435 \\u0437\\u0430\\u0442\\u0440\\u0430\\u0442\\u044b (\\u0431\\u043b\\u043e\\u043a \\u0417\\u0430\\u0442\\u0440\\u0430\\u0442\\u044b, is_marketing=0)</div>';
  h += '<div><b style="color:#22C55E">\\u0412\\u0430\\u043b\\u043e\\u0432\\u0430\\u044f</b> = \\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 \\u2212 COGS</div>';
  h += '<div><b style="color:#3B82F6">EBIT</b> = \\u0412\\u0430\\u043b\\u043e\\u0432\\u0430\\u044f \\u2212 \\u0417\\u041f \\u2212 \\u041c\\u0430\\u0440\\u043a\\u0435\\u0442\\u0438\\u043d\\u0433 \\u2212 \\u0410\\u043c\\u043e\\u0440\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f</div>';
  h += '<div><b style="color:#8B5CF6">EBITDA</b> = EBIT + \\u0410\\u043c\\u043e\\u0440\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f</div>';
  h += '<div><b style="color:#F59E0B">EBT</b> = EBIT + \\u041f\\u0440\\u043e\\u0447\\u0438\\u0435 \\u0434\\u043e\\u0445\\u043e\\u0434\\u044b \\u2212 \\u041f\\u0440\\u043e\\u0447\\u0438\\u0435 \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b \\u2212 % \\u043f\\u043e \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u0430\\u043c</div>';
  h += '<div><b style="color:#22C55E">\\u0427\\u0438\\u0441\\u0442\\u0430\\u044f</b> = EBT \\u2212 \\u041d\\u0430\\u043b\\u043e\\u0433\\u0438</div>';
  h += '<div><b style="color:#10B981">\\u041f\\u043e\\u0441\\u043b\\u0435 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432</b> = \\u0427\\u0438\\u0441\\u0442\\u0430\\u044f \\u2212 \\u0424\\u0430\\u043a\\u0442. \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0438 \\u043f\\u043e \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u0430\\u043c (\\u0431\\u0430\\u0437\\u0430 \\u0434\\u043b\\u044f \\u0434\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u043e\\u0432)</div>';
  h += '<div><b style="color:#10B981">\\u041d\\u0435\\u0440\\u0430\\u0441\\u043f\\u0440\\u0435\\u0434.</b> = \\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u043f\\u043e\\u0441\\u043b\\u0435 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432 \\u2212 \\u0414\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u044b</div>';
  h += '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #334155"><b style="color:#F59E0B">ETR</b> = \\u041d\\u0430\\u043b\\u043e\\u0433\\u0438 / EBT \\u00d7 100% &nbsp;|&nbsp; <b style="color:#F59E0B">\\u041d\\u0430\\u043b. \\u043d\\u0430\\u0433\\u0440\\u0443\\u0437\\u043a\\u0430</b> = \\u041d\\u0430\\u043b\\u043e\\u0433\\u0438 / \\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 \\u00d7 100%</div>';
  h += '<div><b style="color:#EF4444">Кредит. нагрузка</b> = Ежемес. платежи / Выручка × 100% &nbsp;|&nbsp; <b style="color:#F59E0B">На прибыль</b> = Платежи / Чистая прибыль × 100%</div>';
  h += '</div></details>';
  
  // Data sources — collapsible
  h += '<details style="margin-top:12px"><summary style="cursor:pointer;color:#64748b;font-size:0.85rem;font-weight:600"><i class="fas fa-link" style="margin-right:6px;color:#22C55E"></i>Откуда данные в P&L</summary>';
  h += '<div class="card" style="margin-top:8px;font-size:0.78rem;color:#94a3b8;line-height:1.8">';
  h += '<div><span style="color:#22C55E">✓</span> <b>Выручка</b> ← Периоды (закрытые периоды)</div>';
  h += '<div><span style="color:#22C55E">✓</span> <b>COGS</b> ← Затраты (коммерческие, is_marketing=0)</div>';
  h += '<div><span style="color:#22C55E">✓</span> <b>ЗП + Бонусы − Штрафы</b> ← Сотрудники</div>';
  h += '<div><span style="color:#22C55E">✓</span> <b>Маркетинг</b> ← Затраты (is_marketing=1)</div>';
  h += '<div><span style="color:#22C55E">✓</span> <b>Амортизация</b> ← Основные средства (вкладка Амортизация)</div>';
  h += '<div><span style="color:#22C55E">✓</span> <b>Налоги</b> ← Авторасчёт (ставка % × база)</div>';
  h += '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #334155"><span style="color:#F59E0B">✎</span> <b>Вручную:</b> Дивиденды, Прочие доходы/расходы</div>';
  h += '<div style="margin-top:4px"><span style="color:#EF4444">✓</span> <b>Кредиты</b> ← Вкладка Кредиты (автосчёт процентов, нагрузка на выручку/прибыль)</div>';
  h += '</div></details>';
  
  return h;
}

function renderPnlCrudForm(type, item) {
  var h = '<div class="card" style="margin-bottom:16px;border-color:#8B5CF6">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h += '<h4 style="font-weight:700;color:#a78bfa">' + (pnlEditId ? '\\u0420\\u0435\\u0434\\u0430\\u043a\\u0442\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u0438\\u0435' : '\\u0414\\u043e\\u0431\\u0430\\u0432\\u043b\\u0435\\u043d\\u0438\\u0435') + '</h4>';
  h += '<button class="btn btn-outline" style="padding:4px 10px;font-size:0.8rem" onclick="showPnlAddForm=false;pnlEditId=0;render()"><i class="fas fa-times"></i></button></div>';
  if (type === 'tax') {
    var taxTypes = [{v:'income_tax',l:'\\u041d\\u0430\\u043b\\u043e\\u0433 \\u043d\\u0430 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c'},{v:'vat',l:'\\u041d\\u0414\\u0421'},{v:'usn_income',l:'\\u0423\\u0421\\u041d \\u0414\\u043e\\u0445\\u043e\\u0434\\u044b'},{v:'usn_income_expense',l:'\\u0423\\u0421\\u041d \\u0414\\u043e\\u0445\\u043e\\u0434\\u044b \\u2212 \\u0420\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b'},{v:'turnover_tax',l:'\\u041d\\u0430\\u043b\\u043e\\u0433 \\u043d\\u0430 \\u043e\\u0431\\u043e\\u0440\\u043e\\u0442'},{v:'payroll_tax',l:'\\u041d\\u0430\\u043b\\u043e\\u0433\\u0438 \\u043d\\u0430 \\u0417\\u041f'},{v:'patent',l:'\\u041f\\u0430\\u0442\\u0435\\u043d\\u0442'},{v:'property',l:'\\u041d\\u0430\\u043b\\u043e\\u0433 \\u043d\\u0430 \\u0438\\u043c\\u0443\\u0449\\u0435\\u0441\\u0442\\u0432\\u043e'},{v:'other',l:'\\u041f\\u0440\\u043e\\u0447\\u0435\\u0435'}];
    var taxBases = [{v:'turnover_excl_transit',l:'\\u041e\\u0431\\u043e\\u0440\\u043e\\u0442 \\u0431\\u0435\\u0437 \\u0442\\u0440\\u0430\\u043d\\u0437\\u0438\\u0442\\u0430 (\\u0442\\u043e\\u043b\\u044c\\u043a\\u043e \\u0443\\u0441\\u043b\\u0443\\u0433\\u0438)'},{v:'total_turnover',l:'\\u041e\\u0431\\u0449\\u0438\\u0439 \\u043e\\u0431\\u043e\\u0440\\u043e\\u0442 (\\u0443\\u0441\\u043b\\u0443\\u0433\\u0438 + \\u0432\\u044b\\u043a\\u0443\\u043f\\u044b)'},{v:'ebt',l:'EBT (\\u0414\\u043e\\u0445\\u043e\\u0434\\u044b \\u2212 \\u0420\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b)'},{v:'payroll',l:'\\u0424\\u041e\\u0422 (\\u0444\\u043e\\u043d\\u0434 \\u043e\\u043f\\u043b. \\u0442\\u0440\\u0443\\u0434\\u0430)'},{v:'vat_inclusive',l:'\\u041d\\u0414\\u0421 \\u0432\\u043a\\u043b\\u044e\\u0447\\u0451\\u043d (\\u0443\\u0441\\u043b\\u0443\\u0433\\u0438)'},{v:'vat_turnover',l:'\\u041d\\u0414\\u0421 \\u0432\\u043a\\u043b\\u044e\\u0447\\u0451\\u043d (\\u043e\\u0431\\u043e\\u0440\\u043e\\u0442)'},{v:'fixed',l:'\\u0424\\u0438\\u043a\\u0441. \\u0441\\u0443\\u043c\\u043c\\u0430 (\\u0432\\u0440\\u0443\\u0447\\u043d\\u0443\\u044e)'}];
    // Determine if editing a rule-based tax — load rule data
    var linkedRule = null;
    if (item && item.rule_id) {
      linkedRule = (data.taxRules || []).find(function(r) { return r.id === item.rule_id; });
    }
    var isAuto = item ? (!!item.rule_id || !!item.is_auto) : true;
    if (linkedRule) isAuto = true;
    var curBase = (linkedRule && linkedRule.tax_base) || (item && item.tax_base) || 'turnover_excl_transit';
    if (curBase === 'revenue') curBase = 'turnover_excl_transit';
    if (curBase === 'income_minus_expenses') curBase = 'ebt';
    var curRate = (linkedRule && linkedRule.tax_rate) || (item && item.tax_rate) || '';
    var curType = (linkedRule && linkedRule.tax_type) || (item && item.tax_type) || 'income_tax';
    var curName = (linkedRule && linkedRule.rule_name) || (item && item.tax_name) || '';
    var curFreq = (linkedRule && linkedRule.frequency) || 'monthly';
    var curFrom = (linkedRule && linkedRule.apply_from) || '';
    // Toggle: auto (repeating) vs manual (one-time)
    h += '<div style="margin-bottom:12px;padding:10px 14px;background:rgba(139,92,246,0.08);border-radius:8px;border:1px solid rgba(139,92,246,0.2)">';
    h += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.85rem;color:#a78bfa;font-weight:600"><input type="checkbox" id="pnl_tax_is_auto"' + (isAuto ? ' checked' : '') + ' onchange="document.getElementById(&apos;taxManualRow&apos;).style.display=this.checked?&apos;none&apos;:&apos;&apos;;document.getElementById(&apos;taxAutoRow&apos;).style.display=this.checked?&apos;grid&apos;:&apos;none&apos;;document.getElementById(&apos;taxRecurRow&apos;).style.display=this.checked?&apos;grid&apos;:&apos;none&apos;"> <i class="fas fa-magic" style="margin-right:2px"></i>\\u0410\\u0432\\u0442\\u043e\\u0440\\u0430\\u0441\\u0447\\u0451\\u0442 (\\u043f\\u043e\\u0432\\u0442\\u043e\\u0440\\u044f\\u0435\\u0442\\u0441\\u044f \\u043a\\u0430\\u0436\\u0434\\u044b\\u0439 \\u043c\\u0435\\u0441\\u044f\\u0446/\\u043a\\u0432\\u0430\\u0440\\u0442\\u0430\\u043b)</label>';
    h += '<div style="font-size:0.72rem;color:#64748b;margin-top:4px;padding-left:28px">\\u0412\\u041a\\u041b = \\u0441\\u043e\\u0437\\u0434\\u0430\\u0451\\u0442\\u0441\\u044f \\u043f\\u0440\\u0430\\u0432\\u0438\\u043b\\u043e + \\u043f\\u043b\\u0430\\u0442\\u0451\\u0436 \\u0430\\u0432\\u0442\\u043e\\u043c\\u0430\\u0442\\u0438\\u0447\\u0435\\u0441\\u043a\\u0438 \\u043a\\u0430\\u0436\\u0434\\u044b\\u0439 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434. \\u0412\\u042b\\u041a\\u041b = \\u0440\\u0430\\u0437\\u043e\\u0432\\u044b\\u0439 \\u043f\\u043b\\u0430\\u0442\\u0451\\u0436 \\u0437\\u0430 \\u0442\\u0435\\u043a\\u0443\\u0449\\u0438\\u0439 \\u043c\\u0435\\u0441\\u044f\\u0446.</div>';
    h += '</div>';
    // Common fields: type (full width, no separate name — name auto-generated from type+rate)
    h += '<div style="display:grid;grid-template-columns:1fr;gap:10px">';
    h += '<div><label style="font-size:0.78rem;color:#64748b">Тип налога <i class="fas fa-question-circle" style="color:#8B5CF6;font-size:0.6rem;cursor:help" title="Категория для отчётности. Название формируется автоматически из типа + ставки"></i></label><select class="input" id="pnl_tax_tax_type">';
    for (var tt = 0; tt < taxTypes.length; tt++) h += '<option value="' + taxTypes[tt].v + '"' + (curType === taxTypes[tt].v ? ' selected' : '') + '>' + taxTypes[tt].l + '</option>';
    h += '</select></div>';
    h += '</div>';
    // Auto fields: rate + base (always shown for auto, also for manual auto-calc)
    h += '<div id="taxAutoRow" style="' + (isAuto ? 'display:grid;' : 'display:none;') + 'grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">';
    h += '<div><label style="font-size:0.78rem;color:#64748b"><i class="fas fa-percent" style="color:#8B5CF6;margin-right:4px"></i>\\u0421\\u0442\\u0430\\u0432\\u043a\\u0430 %</label><input type="number" class="input" id="pnl_tax_tax_rate" value="' + curRate + '" step="0.1" placeholder="\\u041d\\u0430\\u043f\\u0440. 20"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b"><i class="fas fa-calculator" style="color:#8B5CF6;margin-right:4px"></i>База расчёта <i class="fas fa-question-circle" style="color:#8B5CF6;font-size:0.6rem;cursor:help" title="Формула: от какой суммы считается налог. ВЛИЯЕТ на итоговую сумму = Ставка% × эта база"></i></label><select class="input" id="pnl_tax_tax_base">';
    for (var tb = 0; tb < taxBases.length; tb++) h += '<option value="' + taxBases[tb].v + '"' + (curBase === taxBases[tb].v ? ' selected' : '') + '>' + taxBases[tb].l + '</option>';
    h += '</select></div>';
    h += '</div>';
    // Recurring fields: frequency + start (only for auto)
    h += '<div id="taxRecurRow" style="' + (isAuto ? 'display:grid;' : 'display:none;') + 'grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">';
    h += '<div><label style="font-size:0.78rem;color:#64748b"><i class="fas fa-sync" style="color:#22C55E;margin-right:4px"></i>\\u041f\\u0435\\u0440\\u0438\\u043e\\u0434\\u0438\\u0447\\u043d\\u043e\\u0441\\u0442\\u044c</label><select class="input" id="pnl_tax_frequency"><option value="monthly"' + (curFreq === 'monthly' ? ' selected' : '') + '>\\u0415\\u0436\\u0435\\u043c\\u0435\\u0441\\u044f\\u0447\\u043d\\u043e</option><option value="quarterly"' + (curFreq === 'quarterly' ? ' selected' : '') + '>\\u0415\\u0436\\u0435\\u043a\\u0432\\u0430\\u0440\\u0442\\u0430\\u043b\\u044c\\u043d\\u043e</option></select></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b"><i class="fas fa-calendar" style="color:#22C55E;margin-right:4px"></i>\\u041d\\u0430\\u0447\\u0430\\u043b\\u043e \\u0434\\u0435\\u0439\\u0441\\u0442\\u0432\\u0438\\u044f</label><input type="month" class="input" id="pnl_tax_apply_from" value="' + (curFrom || pnlPeriod || '') + '"></div>';
    h += '</div>';
    // Manual fields: amount, due_date, payment_date, status
    h += '<div id="taxManualRow" style="display:' + (isAuto ? 'none' : '') + '">';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u0421\\u0443\\u043c\\u043c\\u0430 (AMD)</label><input type="number" class="input" id="pnl_tax_amount" value="' + ((item && !item.rule_id && item.amount) || '') + '" placeholder="0"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u0421\\u0442\\u0430\\u0442\\u0443\\u0441</label><select class="input" id="pnl_tax_status"><option value="pending"' + (item && item.status === 'pending' ? ' selected' : '') + '>\\u041e\\u0436\\u0438\\u0434\\u0430\\u0435\\u0442</option><option value="paid"' + (item && item.status === 'paid' ? ' selected' : '') + '>\\u041e\\u043f\\u043b\\u0430\\u0447\\u0435\\u043d</option><option value="overdue"' + (item && item.status === 'overdue' ? ' selected' : '') + '>\\u041f\\u0440\\u043e\\u0441\\u0440\\u043e\\u0447\\u0435\\u043d</option></select></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u0421\\u0440\\u043e\\u043a \\u0443\\u043f\\u043b\\u0430\\u0442\\u044b</label><input type="date" class="input" id="pnl_tax_due_date" value="' + ((item && item.due_date) || '') + '"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u0414\\u0430\\u0442\\u0430 \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b</label><input type="date" class="input" id="pnl_tax_payment_date" value="' + ((item && item.payment_date) || '') + '"></div>';
    h += '</div></div>';
    h += '<div style="margin-top:10px"><label style="font-size:0.78rem;color:#64748b">\\u0417\\u0430\\u043c\\u0435\\u0442\\u043a\\u0438</label><input class="input" id="pnl_tax_notes" value="' + escHtml((item && item.notes) || (linkedRule && linkedRule.notes) || '') + '"></div>';
  } else if (type === 'asset') {
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435</label><input class="input" id="pnl_asset_name" value="' + escHtml((item && item.name) || '') + '" placeholder="\\u041d\\u043e\\u0443\\u0442\\u0431\\u0443\\u043a, \\u0410\\u0432\\u0442\\u043e..."></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u0414\\u0430\\u0442\\u0430 \\u043f\\u043e\\u043a\\u0443\\u043f\\u043a\\u0438</label><input type="date" class="input" id="pnl_asset_purchase_date" value="' + ((item && item.purchase_date) || '') + '"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u0421\\u0442\\u043e\\u0438\\u043c\\u043e\\u0441\\u0442\\u044c (AMD)</label><input type="number" class="input" id="pnl_asset_purchase_cost" value="' + ((item && item.purchase_cost) || '') + '"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u0421\\u0440\\u043e\\u043a \\u0441\\u043b\\u0443\\u0436\\u0431\\u044b (\\u043c\\u0435\\u0441.)</label><input type="number" class="input" id="pnl_asset_useful_life_months" value="' + ((item && item.useful_life_months) || 60) + '"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u041e\\u0441\\u0442\\u0430\\u0442. \\u0441\\u0442-\\u0441\\u0442\\u044c <i class=\\"fas fa-question-circle\\" style=\\"color:#8B5CF6;cursor:help\\" title=\\"\\u041b\\u0438\\u043a\\u0432\\u0438\\u0434\\u0430\\u0446. \\u0441\\u0442\\u043e\\u0438\\u043c\\u043e\\u0441\\u0442\\u044c: \\u0437\\u0430 \\u0441\\u043a\\u043e\\u043b\\u044c\\u043a\\u043e \\u043c\\u043e\\u0436\\u043d\\u043e \\u043f\\u0440\\u043e\\u0434\\u0430\\u0442\\u044c \\u0430\\u043a\\u0442\\u0438\\u0432 \\u043f\\u043e\\u0441\\u043b\\u0435 \\u0441\\u0440\\u043e\\u043a\\u0430. \\u0415\\u0441\\u043b\\u0438 \\u043d\\u0435 \\u0437\\u043d\\u0430\\u0435\\u0442\\u0435, \\u043e\\u0441\\u0442\\u0430\\u0432\\u044c\\u0442\\u0435 0.\\"></i></label><input type="number" class="input" id="pnl_asset_residual_value" value="' + ((item && item.residual_value) || 0) + '"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u041a\\u0430\\u0442\\u0435\\u0433\\u043e\\u0440\\u0438\\u044f</label><input class="input" id="pnl_asset_category" value="' + escHtml((item && item.category) || '') + '" placeholder="\\u041e\\u0431\\u043e\\u0440\\u0443\\u0434., \\u0422\\u0440\\u0430\\u043d\\u0441\\u043f\\u043e\\u0440\\u0442..."></div>';
    h += '</div>';
    // Residual value info block removed — tooltip ? on the field is sufficient
    h += '<div style="margin-top:10px"><label style="font-size:0.78rem;color:#64748b">\\u0417\\u0430\\u043c\\u0435\\u0442\\u043a\\u0438</label><input class="input" id="pnl_asset_notes" value="' + escHtml((item && item.notes) || '') + '"></div>';
  } else if (type === 'loan') {
    // Loan type selector
    var curLoanType = (item && item.loan_type) || 'annuity';
    var curCollateral = (item && item.collateral_type) || 'none';
    h += '<div style="margin-bottom:10px;padding:10px 14px;background:rgba(239,68,68,0.08);border-radius:8px;border:1px solid rgba(239,68,68,0.2)">';
    h += '<label style="font-size:0.82rem;color:#EF4444;font-weight:600"><i class="fas fa-tag" style="margin-right:6px"></i>Тип кредита</label>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px">';
    h += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:6px 10px;border-radius:6px;font-size:0.78rem;background:' + (curLoanType==='annuity'?'rgba(139,92,246,0.15)':'#0f172a') + ';border:1px solid ' + (curLoanType==='annuity'?'#8B5CF6':'#334155') + ';color:#e2e8f0"><input type="radio" name="pnl_loan_type_radio" value="annuity"' + (curLoanType==='annuity'?' checked':'') + ' onchange="switchLoanType(\\&apos;annuity\\&apos;)""><i class="fas fa-university"></i> Потребительский</label>';
    h += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:6px 10px;border-radius:6px;font-size:0.78rem;background:' + (curLoanType==='manual'?'rgba(139,92,246,0.15)':'#0f172a') + ';border:1px solid ' + (curLoanType==='manual'?'#8B5CF6':'#334155') + ';color:#e2e8f0"><input type="radio" name="pnl_loan_type_radio" value="manual"' + (curLoanType==='manual'?' checked':'') + ' onchange="switchLoanType(\\&apos;manual\\&apos;)""><i class="fas fa-handshake"></i> Займ с руки</label>';
    h += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:6px 10px;border-radius:6px;font-size:0.78rem;background:' + (curLoanType==='overdraft'?'rgba(139,92,246,0.15)':'#0f172a') + ';border:1px solid ' + (curLoanType==='overdraft'?'#8B5CF6':'#334155') + ';color:#e2e8f0"><input type="radio" name="pnl_loan_type_radio" value="overdraft"' + (curLoanType==='overdraft'?' checked':'') + ' onchange="switchLoanType(\\&apos;overdraft\\&apos;)""><i class="fas fa-credit-card"></i> Овердрафт</label>';
    h += '</div><input type="hidden" id="pnl_loan_loan_type" value="' + curLoanType + '">';
    h += '</div>';
    // Common fields: name, lender
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435</label><input class="input" id="pnl_loan_name" value="' + escHtml((item && item.name) || '') + '" placeholder="Кредит Банк..."></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u041a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0440</label><input class="input" id="pnl_loan_lender" value="' + escHtml((item && item.lender) || '') + '" placeholder="Банк / Имя"></div>';
    h += '</div>';
    // Annuity + Manual shared fields
    h += '<div id="loanAnnuityFields" style="' + (curLoanType !== 'overdraft' ? 'display:grid;' : 'display:none;') + 'grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u0421\\u0443\\u043c\\u043c\\u0430 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u0430</label><input type="number" class="input" id="pnl_loan_principal" value="' + ((item && item.principal) || '') + '"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">Ставка % год.</label><input type="number" class="input" id="pnl_loan_interest_rate" value="' + ((item && item.interest_rate) || '') + '" step="0.01"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u041d\\u0430\\u0447\\u0430\\u043b\\u043e</label><input type="date" class="input" id="pnl_loan_start_date" value="' + ((item && item.start_date) || '') + '" onchange="calcLoanTermFromDates()"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u041e\\u043a\\u043e\\u043d\\u0447\\u0430\\u043d\\u0438\\u0435 (\\u043f\\u043e \\u0434\\u043e\\u0433\\u043e\\u0432\\u043e\\u0440\\u0443)</label><input type="date" class="input" id="pnl_loan_end_date" value="' + ((item && item.end_date) || '') + '" onchange="calcLoanTermFromDates()"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">Срок (мес.) <span style="font-size:0.65rem;color:#8B5CF6">авто из дат</span></label><input type="number" class="input" id="pnl_loan_term_months" value="' + ((item && item.term_months) || '') + '" placeholder="120" onchange="calcLoanEndFromTerm()"></div>';
    h += '<div><label style="font-size:0.78rem;color:#F59E0B">Желаемый срок (мес.)</label><input type="number" class="input" id="pnl_loan_desired_term_months" value="' + ((item && item.desired_term_months) || '') + '" placeholder="Необязательно" style="border-color:rgba(245,158,11,0.3)"></div>';
    h += '<div><label style="font-size:0.78rem;color:#22C55E"><i class="fas fa-check-circle" style="margin-right:4px"></i>Фактическое погашение</label><input type="date" class="input" id="pnl_loan_actual_end_date" value="' + ((item && item.actual_end_date) || '') + '" style="border-color:rgba(34,197,94,0.3)"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u041e\\u0441\\u0442\\u0430\\u0442\\u043e\\u043a \\u0434\\u043e\\u043b\\u0433\\u0430</label><input type="number" class="input" id="pnl_loan_remaining_balance" value="' + ((item && item.remaining_balance) || '') + '" placeholder="= Сумма кредита"></div>';
    h += '</div>';
    // Bank monthly payment (for annuity — PMT per bank contract)
    h += '<div id="loanBankPMT" style="' + (curLoanType === 'annuity' ? 'display:grid;' : 'display:none;') + 'grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">';
    h += '<div><label style="font-size:0.78rem;color:#3B82F6;font-weight:600"><i class="fas fa-file-contract" style="margin-right:4px"></i>Платёж по договору с банком <span style="color:#F59E0B">*</span></label><input type="number" class="input" id="pnl_loan_bank_monthly_payment" value="' + ((item && item.bank_monthly_payment) || '') + '" placeholder="Ежемес. сумма по договору" style="border-color:rgba(59,130,246,0.3)"></div>';
    h += '<div style="display:flex;align-items:end;padding-bottom:4px"><div style="font-size:0.72rem;color:#64748b;padding:6px 10px;background:rgba(59,130,246,0.06);border-radius:6px"><i class="fas fa-info-circle" style="margin-right:4px;color:#3B82F6"></i>Система рассчитает PMT из суммы/ставки/срока. Если фактический платёж по договору отличается — укажите его здесь.</div></div>';
    h += '</div>';
    // Manual loan PMT row (for manual/займ с руки)
    h += '<div id="loanManualPMT" style="' + (curLoanType === 'manual' ? 'display:grid;' : 'display:none;') + 'grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">';
    h += '<div><label style="font-size:0.78rem;color:#EF4444;font-weight:600">Ежемес. платёж <span style="color:#F59E0B">*</span></label><input type="number" class="input" id="pnl_loan_monthly_payment" value="' + ((item && item.monthly_payment) || '') + '" placeholder="Обязательно" style="border-color:rgba(239,68,68,0.3)"></div>';
    h += '</div>';
    // Payment date + min payment for annuity/manual loans (shown for non-overdraft types)
    h += '<div id="loanPaymentInfo" style="' + (curLoanType !== 'overdraft' ? 'display:grid;' : 'display:none;') + 'grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">';
    h += '<div><label style="font-size:0.78rem;color:#3B82F6;font-weight:600"><i class="fas fa-calendar-check" style="margin-right:4px"></i>Дата оплаты</label><input type="date" class="input" id="pnl_loan_payment_day_main" value="' + ((item && item.payment_day) || '') + '" style="border-color:rgba(59,130,246,0.3)"></div>';
    h += '<div><label style="font-size:0.78rem;color:#22C55E;font-weight:600"><i class="fas fa-coins" style="margin-right:4px"></i>Мин. платёж</label><input type="number" class="input" id="pnl_loan_min_payment_main" value="' + ((item && item.min_payment) || '') + '" placeholder="Мин. сумма по договору" style="border-color:rgba(34,197,94,0.3)"></div>';
    h += '</div>';
    // Overdraft fields (extended with dates and term)
    h += '<div id="loanOverdraftFields" style="' + (curLoanType === 'overdraft' ? 'display:grid;' : 'display:none;') + 'grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px">';
    h += '<div><label style="font-size:0.78rem;color:#64748b">Лимит</label><input type="number" class="input" id="pnl_loan_overdraft_limit" value="' + ((item && item.overdraft_limit) || '') + '"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">Использовано</label><input type="number" class="input" id="pnl_loan_overdraft_used" value="' + ((item && item.overdraft_used) || '') + '"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">Ставка % год.</label><input type="number" class="input" id="pnl_loan_overdraft_rate" value="' + ((item && item.overdraft_rate) || '') + '" step="0.01"></div>';
    // Additional overdraft fields: dates, term — with auto-calc
    h += '<div><label style="font-size:0.78rem;color:#64748b">Начало</label><input type="date" class="input" id="pnl_loan_start_date_od" value="' + ((item && item.start_date) || '') + '" onchange="calcLoanTermFromDatesOD()"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">Окончание</label><input type="date" class="input" id="pnl_loan_end_date_od" value="' + ((item && item.end_date) || '') + '" onchange="calcLoanTermFromDatesOD()"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">Срок (мес.) <span style="font-size:0.65rem;color:#8B5CF6">авто из дат</span></label><input type="number" class="input" id="pnl_loan_term_months_od" value="' + ((item && item.term_months) || '') + '"></div>';
    // Payment date + min payment + bank monthly payment for overdraft
    h += '<div><label style="font-size:0.78rem;color:#3B82F6;font-weight:600"><i class="fas fa-calendar-check" style="margin-right:4px"></i>Дата оплаты</label><input type="date" class="input" id="pnl_loan_payment_day" value="' + ((item && item.payment_day) || '') + '" style="border-color:rgba(59,130,246,0.3)"></div>';
    h += '<div><label style="font-size:0.78rem;color:#22C55E;font-weight:600"><i class="fas fa-coins" style="margin-right:4px"></i>Мин. платёж</label><input type="number" class="input" id="pnl_loan_min_payment" value="' + ((item && item.min_payment) || '') + '" placeholder="Мин. сумма по договору" style="border-color:rgba(34,197,94,0.3)"></div>';
    h += '<div><label style="font-size:0.78rem;color:#EF4444;font-weight:600"><i class="fas fa-file-invoice-dollar" style="margin-right:4px"></i>Платёж по договору</label><input type="number" class="input" id="pnl_loan_bank_monthly_payment_od" value="' + ((item && item.bank_monthly_payment) || '') + '" placeholder="Полная сумма платежа" style="border-color:rgba(239,68,68,0.3)"></div>';
    h += '</div>';
    // Collateral
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">';
    h += '<div><label style="font-size:0.78rem;color:#64748b"><i class="fas fa-shield-alt" style="color:#F59E0B;margin-right:4px"></i>Залог</label><select class="input" id="pnl_loan_collateral_type"><option value="none"' + (curCollateral==='none'?' selected':'') + '>Без залога</option><option value="real_estate"' + (curCollateral==='real_estate'?' selected':'') + '>Недвижимость</option><option value="car"' + (curCollateral==='car'?' selected':'') + '>Автомобиль</option><option value="equipment"' + (curCollateral==='equipment'?' selected':'') + '>Оборудование</option><option value="deposit"' + (curCollateral==='deposit'?' selected':'') + '>Депозит</option><option value="other"' + (curCollateral==='other'?' selected':'') + '>Другое</option></select></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">Описание залога</label><input class="input" id="pnl_loan_collateral_desc" value="' + escHtml((item && item.collateral_desc) || '') + '" placeholder="Адрес/марка/описание"></div>';
    h += '</div>';
    // Notes
    h += '<div style="margin-top:10px"><label style="font-size:0.78rem;color:#64748b">\\u0417\\u0430\\u043c\\u0435\\u0442\\u043a\\u0438</label><input class="input" id="pnl_loan_notes" value="' + escHtml((item && item.notes) || '') + '"></div>';
  } else if (type === 'dividend') {
    var curSchedule = (item && item.schedule) || 'monthly';
    h += '<div style="margin-bottom:10px;padding:10px 14px;background:rgba(139,92,246,0.08);border-radius:8px;border:1px solid rgba(139,92,246,0.2)">';
    h += '<label style="font-size:0.82rem;color:#8B5CF6;font-weight:600"><i class="fas fa-clock" style="margin-right:6px"></i>Режим выплат</label>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:6px">';
    h += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:6px 10px;border-radius:6px;font-size:0.78rem;background:' + (curSchedule==='monthly'?'rgba(139,92,246,0.15)':'#0f172a') + ';border:1px solid ' + (curSchedule==='monthly'?'#8B5CF6':'#334155') + ';color:#e2e8f0"><input type="radio" name="pnl_div_schedule_radio" value="monthly"' + (curSchedule==='monthly'?' checked':'') + ' onchange="document.getElementById(&apos;pnl_dividend_schedule&apos;).value=&apos;monthly&apos;"> <span><b>Ежемесячно</b></span></label>';
    h += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:6px 10px;border-radius:6px;font-size:0.78rem;background:' + (curSchedule==='quarterly'?'rgba(139,92,246,0.15)':'#0f172a') + ';border:1px solid ' + (curSchedule==='quarterly'?'#8B5CF6':'#334155') + ';color:#e2e8f0"><input type="radio" name="pnl_div_schedule_radio" value="quarterly"' + (curSchedule==='quarterly'?' checked':'') + ' onchange="document.getElementById(&apos;pnl_dividend_schedule&apos;).value=&apos;quarterly&apos;"> <span><b>Ежеквартально</b></span></label>';
    h += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:6px 10px;border-radius:6px;font-size:0.78rem;background:' + (curSchedule==='yearly'?'rgba(139,92,246,0.15)':'#0f172a') + ';border:1px solid ' + (curSchedule==='yearly'?'#8B5CF6':'#334155') + ';color:#e2e8f0"><input type="radio" name="pnl_div_schedule_radio" value="yearly"' + (curSchedule==='yearly'?' checked':'') + ' onchange="document.getElementById(&apos;pnl_dividend_schedule&apos;).value=&apos;yearly&apos;"> <span><b>Ежегодно</b></span></label>';
    h += '</div><input type="hidden" id="pnl_dividend_schedule" value="' + curSchedule + '">';
    h += '</div>';
    // Net profit hint + auto-calc from %
    var divNetProfit = (pnlData && pnlData.net_profit) || 0;
    // Force compute effective loan payments: always use max(actual, plan) even if backend field is 0
    var divActualPay = Number((pnlData && pnlData.loan_total_payments_period) || 0);
    var divPlanPay = Number((pnlData && pnlData.loan_total_monthly) || 0);
    var divEffLoanPayments = Number((pnlData && pnlData.effective_loan_payments) || 0);
    if (divEffLoanPayments === 0 && (divActualPay > 0 || divPlanPay > 0)) divEffLoanPayments = Math.max(divActualPay, divPlanPay);
    // Always compute profit after loans locally to guarantee correctness
    var divProfitAfterLoans = divNetProfit - divEffLoanPayments;
    var curDivPct = (item && item.dividend_pct) || 0;
    var curCalcBase = (item && item.calc_base) || 'after_loans';
    h += '<div style="margin-bottom:10px;padding:10px 14px;background:rgba(34,197,94,0.06);border-radius:8px;border:1px solid rgba(34,197,94,0.15)">';
    h += '<div style="font-size:0.82rem;color:#22C55E;font-weight:600;margin-bottom:8px"><i class="fas fa-calculator" style="margin-right:6px"></i>Расчёт от прибыли</div>';
    // Base selector: before or after loans
    h += '<div style="margin-bottom:8px"><label style="font-size:0.78rem;color:#94a3b8;margin-bottom:4px;display:block">База расчёта дивидендов</label>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
    h += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:6px 10px;border-radius:6px;font-size:0.78rem;background:' + (curCalcBase==='after_loans'?'rgba(34,197,94,0.15)':'#0f172a') + ';border:1px solid ' + (curCalcBase==='after_loans'?'#22C55E':'#334155') + ';color:#e2e8f0"><input type="radio" name="pnl_div_calc_base_radio" value="after_loans"' + (curCalcBase==='after_loans'?' checked':'') + ' onchange="document.getElementById(&apos;pnl_dividend_calc_base&apos;).value=&apos;after_loans&apos;;calcDividendFromPct()"> <span><b>\\u041f\\u043e\\u0441\\u043b\\u0435 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432</b></span></label>';
    h += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:6px 10px;border-radius:6px;font-size:0.78rem;background:' + (curCalcBase==='before_loans'?'rgba(245,158,11,0.15)':'#0f172a') + ';border:1px solid ' + (curCalcBase==='before_loans'?'#F59E0B':'#334155') + ';color:#e2e8f0"><input type="radio" name="pnl_div_calc_base_radio" value="before_loans"' + (curCalcBase==='before_loans'?' checked':'') + ' onchange="document.getElementById(&apos;pnl_dividend_calc_base&apos;).value=&apos;before_loans&apos;;calcDividendFromPct()"> <span><b>\\u0414\\u043e \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432</b></span></label>';
    h += '</div><input type="hidden" id="pnl_dividend_calc_base" value="' + curCalcBase + '"></div>';
    // Dynamic info block — updated by calcDividendFromPct
    h += '<div id="div_calc_info">';
    h += '<div style="font-size:0.78rem;color:#94a3b8;margin-bottom:4px">\\u0427\\u0438\\u0441\\u0442\\u0430\\u044f \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c (\\u043f\\u043e\\u0441\\u043b\\u0435 \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432): <b style="color:' + (divNetProfit >= 0 ? '#22C55E' : '#EF4444') + '">' + fmtAmt(divNetProfit) + '</b></div>';
    if (divEffLoanPayments > 0) {
      h += '<div style="font-size:0.78rem;color:#94a3b8;margin-bottom:4px">\\u2212 \\u041a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043d\\u044b\\u0435 \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0438: <b style="color:#EF4444">' + fmtAmt(divEffLoanPayments) + '</b></div>';
      h += '<div style="font-size:0.78rem;color:' + (divProfitAfterLoans >= 0 ? '#10B981' : '#EF4444') + ';font-weight:600;margin-bottom:6px">=\\u00a0\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u043f\\u043e\\u0441\\u043b\\u0435 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432: <b>' + fmtAmt(divProfitAfterLoans) + '</b>' + (divProfitAfterLoans < 0 ? ' <span style="color:#EF4444;font-size:0.7rem"><i class="fas fa-exclamation-triangle"></i> \\u0432 \\u043c\\u0438\\u043d\\u0443\\u0441\\u0435!</span>' : '') + '</div>';
    }
    h += '</div>';
    // Negative profit warning for after_loans mode
    if (curCalcBase === 'after_loans' && divProfitAfterLoans < 0) {
      h += '<div style="margin-bottom:8px;padding:8px 12px;background:rgba(239,68,68,0.1);border-radius:6px;border:1px solid rgba(239,68,68,0.25)">';
      h += '<div style="font-size:0.78rem;color:#EF4444;font-weight:600"><i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>\\u0414\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u044b \\u0432 \\u044d\\u0442\\u043e\\u043c \\u043c\\u0435\\u0441\\u044f\\u0446\\u0435 \\u043d\\u0435\\u0432\\u043e\\u0437\\u043c\\u043e\\u0436\\u043d\\u044b</div>';
      h += '<div style="font-size:0.72rem;color:#94a3b8;margin-top:4px">\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u043f\\u043e\\u0441\\u043b\\u0435 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432: <b style="color:#EF4444">' + fmtAmt(divProfitAfterLoans) + '</b>. ';
      h += '\\u041a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043d\\u0430\\u044f \\u043d\\u0430\\u0433\\u0440\\u0443\\u0437\\u043a\\u0430 (' + fmtAmt(divEffLoanPayments) + ') \\u043f\\u0440\\u0435\\u0432\\u044b\\u0448\\u0430\\u0435\\u0442 \\u0447\\u0438\\u0441\\u0442\\u0443\\u044e \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c (' + fmtAmt(divNetProfit) + '). ';
      h += '\\u041f\\u0435\\u0440\\u0435\\u043a\\u043b\\u044e\\u0447\\u0438\\u0442\\u0435\\u0441\\u044c \\u043d\\u0430 \\u00ab\\u0414\\u043e \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432\\u00bb \\u0438\\u043b\\u0438 \\u0432\\u0432\\u0435\\u0434\\u0438\\u0442\\u0435 \\u0441\\u0443\\u043c\\u043c\\u0443 \\u0432\\u0440\\u0443\\u0447\\u043d\\u0443\\u044e.</div>';
      h += '</div>';
    }
    h += '<div style="display:flex;align-items:center;gap:10px">';
    h += '<label style="font-size:0.78rem;color:#94a3b8;white-space:nowrap">% \\u043e\\u0442 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438</label>';
    h += '<input type="number" class="input" id="pnl_dividend_dividend_pct" value="' + curDivPct + '" step="1" min="0" max="100" style="max-width:80px;border-color:rgba(34,197,94,0.3)" oninput="calcDividendFromPct()">';
    h += '</div>';
    h += '<div id="div_calc_preview" style="margin-top:6px;font-size:0.75rem;display:none"></div>';
    h += '</div>';
    // Schedule preview block
    var schedNames = {monthly:'\\u0415\\u0436\\u0435\\u043c\\u0435\\u0441\\u044f\\u0447\\u043d\\u043e',quarterly:'\\u0415\\u0436\\u0435\\u043a\\u0432\\u0430\\u0440\\u0442\\u0430\\u043b\\u044c\\u043d\\u043e',yearly:'\\u0415\\u0436\\u0435\\u0433\\u043e\\u0434\\u043d\\u043e'};
    var curSchedule2 = (item && item.schedule) || 'monthly';
    var divActiveBase = curCalcBase === 'after_loans' ? divProfitAfterLoans : divNetProfit;
    var autoCalcAmt = curDivPct > 0 && divActiveBase > 0 ? Math.round(divActiveBase * curDivPct / 100) : 0;
    var initAmt = (item && item.amount) ? item.amount : autoCalcAmt;
    h += '<div id="div_schedule_preview" class="card" style="margin-bottom:10px;padding:10px 14px;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.15)">';
    if (initAmt > 0) {
      var perQtr = Math.round(initAmt / 3), perYear = Math.round(initAmt * 12);
      h += '<div style="font-size:0.78rem;color:#8B5CF6;font-weight:600;margin-bottom:6px"><i class="fas fa-calendar-check" style="margin-right:6px"></i>\\u0413\\u0440\\u0430\\u0444\\u0438\\u043a \\u0432\\u044b\\u043f\\u043b\\u0430\\u0442 (' + schedNames[curSchedule2] + ')</div>';
      if (curSchedule2 === 'monthly') h += '<div style="font-size:0.82rem;color:#e2e8f0">\\u041a\\u0430\\u0436\\u0434\\u044b\\u0439 \\u043c\\u0435\\u0441\\u044f\\u0446: <b style="color:#8B5CF6">' + fmtAmt(initAmt) + '</b> &nbsp;|&nbsp; \\u0417\\u0430 \\u0433\\u043e\\u0434: <b>' + fmtAmt(initAmt * 12) + '</b></div>';
      else if (curSchedule2 === 'quarterly') h += '<div style="font-size:0.82rem;color:#e2e8f0">\\u041a\\u0430\\u0436\\u0434\\u044b\\u0439 \\u043a\\u0432\\u0430\\u0440\\u0442\\u0430\\u043b: <b style="color:#8B5CF6">' + fmtAmt(initAmt) + '</b> &nbsp;|&nbsp; \\u0412 \\u043c\\u0435\\u0441\\u044f\\u0446: ~<b>' + fmtAmt(perQtr) + '</b> &nbsp;|&nbsp; \\u0417\\u0430 \\u0433\\u043e\\u0434: <b>' + fmtAmt(initAmt * 4) + '</b></div>';
      else h += '<div style="font-size:0.82rem;color:#e2e8f0">\\u0420\\u0430\\u0437 \\u0432 \\u0433\\u043e\\u0434: <b style="color:#8B5CF6">' + fmtAmt(initAmt) + '</b> &nbsp;|&nbsp; \\u0412 \\u043c\\u0435\\u0441\\u044f\\u0446: ~<b>' + fmtAmt(Math.round(initAmt / 12)) + '</b></div>';
    } else {
      h += '<div style="font-size:0.78rem;color:#94a3b8"><i class="fas fa-info-circle" style="margin-right:6px;color:#64748b"></i>\\u0423\\u043a\\u0430\\u0436\\u0438\\u0442\\u0435 % \\u043e\\u0442 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438 \\u0434\\u043b\\u044f \\u0440\\u0430\\u0441\\u0447\\u0451\\u0442\\u0430</div>';
    }
    h += '</div>';
    // Amount + recipient + tax
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u0421\\u0443\\u043c\\u043c\\u0430 \\u0434\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u0430</label><input type="number" class="input" id="pnl_dividend_amount" value="' + (initAmt || 0) + '" style="' + (curDivPct > 0 ? 'background:rgba(139,92,246,0.1);border-color:#8B5CF6;color:#8B5CF6;font-weight:700' : '') + '" readonly></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u041f\\u043e\\u043b\\u0443\\u0447\\u0430\\u0442\\u0435\\u043b\\u044c</label><input class="input" id="pnl_dividend_recipient" value="' + escHtml((item && item.recipient) || '') + '" oninput="updateDivPayoutSummary()"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u0414\\u0430\\u0442\\u0430 \\u0432\\u044b\\u043f\\u043b\\u0430\\u0442\\u044b</label><input type="date" class="input" id="pnl_dividend_payment_date" value="' + ((item && item.payment_date) || '') + '" onchange="updateDivPayoutSummary()"></div>';
    var initTaxPct = (item && typeof item.tax_pct === 'number') ? item.tax_pct : 0;
    var initTaxAmt = initAmt > 0 ? Math.round(initAmt * initTaxPct / 100) : 0;
    if (item && typeof item.tax_amount === 'number' && initAmt > 0) initTaxAmt = item.tax_amount;
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u041d\\u0430\\u043b\\u043e\\u0433 \\u043d\\u0430 \\u0434\\u0438\\u0432. (%)</label>';
    h += '<div style="display:flex;gap:6px;align-items:center">';
    h += '<input type="number" class="input" id="pnl_dividend_tax_pct" value="' + initTaxPct + '" step="0.1" min="0" max="100" style="max-width:70px" oninput="calcDivTax()">';
    h += '<span style="color:#64748b;font-size:0.75rem">=</span>';
    h += '<input type="number" class="input" id="pnl_dividend_tax_amount" value="' + initTaxAmt + '" style="flex:1;background:rgba(239,68,68,0.06);border-color:rgba(239,68,68,0.2);color:#EF4444;font-weight:600" readonly>';
    h += '</div></div>';
    h += '</div>';
    h += '<div style="margin-top:10px"><label style="font-size:0.78rem;color:#64748b">\\u0417\\u0430\\u043c\\u0435\\u0442\\u043a\\u0438</label><input class="input" id="pnl_dividend_notes" value="' + escHtml((item && item.notes) || '') + '"></div>';
    // Summary block: shows final dividend amount, tax, net payout, and date
    h += '<div id="div_payout_summary" class="card" style="margin-top:10px;padding:12px 14px;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.15);display:none"></div>';
  } else { // other
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u0422\\u0438\\u043f</label><select class="input" id="pnl_other_type"><option value="income"' + (item && item.type === 'income' ? ' selected' : '') + '>\\u0414\\u043e\\u0445\\u043e\\u0434</option><option value="expense"' + (item && item.type === 'expense' ? ' selected' : '') + '>\\u0420\\u0430\\u0441\\u0445\\u043e\\u0434</option></select></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u041d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435</label><input class="input" id="pnl_other_name" value="' + escHtml((item && item.name) || '') + '"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u0421\\u0443\\u043c\\u043c\\u0430</label><input type="number" class="input" id="pnl_other_amount" value="' + ((item && item.amount) || '') + '"></div>';
    h += '<div><label style="font-size:0.78rem;color:#64748b">\\u0414\\u0430\\u0442\\u0430</label><input type="date" class="input" id="pnl_other_date" value="' + ((item && item.date) || '') + '"></div>';
    h += '</div>';
    h += '<div style="margin-top:10px"><label style="font-size:0.78rem;color:#64748b">\\u0417\\u0430\\u043c\\u0435\\u0442\\u043a\\u0438</label><input class="input" id="pnl_other_notes" value="' + escHtml((item && item.notes) || '') + '"></div>';
  }
  h += '<div style="margin-top:12px;display:flex;gap:8px"><button class="btn btn-primary" onclick="savePnlItem(&apos;' + type + '&apos;)"><i class="fas fa-save" style="margin-right:6px"></i>\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0438\\u0442\\u044c</button>';
  h += '<button class="btn btn-outline" onclick="showPnlAddForm=false;pnlEditId=0;render()">\\u041e\\u0442\\u043c\\u0435\\u043d\\u0430</button></div>';
  h += '</div>';
  return h;
}

function renderPnlTaxes(p) {
  var typeLabels = {income_tax:'\\u041d\\u0430\\u043b\\u043e\\u0433 \\u043d\\u0430 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c',vat:'\\u041d\\u0414\\u0421',usn_income:'\\u0423\\u0421\\u041d \\u0414\\u043e\\u0445\\u043e\\u0434\\u044b',usn_income_expense:'\\u0423\\u0421\\u041d \\u0414\\u043e\\u0445\\u043e\\u0434\\u044b\\u2212\\u0420\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b',turnover_tax:'\\u041d\\u0430\\u043b\\u043e\\u0433 \\u043d\\u0430 \\u043e\\u0431\\u043e\\u0440\\u043e\\u0442',payroll_tax:'\\u041d\\u0430\\u043b\\u043e\\u0433\\u0438 \\u043d\\u0430 \\u0417\\u041f',patent:'\\u041f\\u0430\\u0442\\u0435\\u043d\\u0442',property:'\\u0418\\u043c\\u0443\\u0449\\u0435\\u0441\\u0442\\u0432\\u043e',other:'\\u041f\\u0440\\u043e\\u0447\\u0435\\u0435'};
  var baseLabels = {ebt:'EBT (\\u0414\\u043e\\u0445\\u2212\\u0420\\u0430\\u0441\\u0445)',revenue:'\\u041e\\u0431\\u043e\\u0440\\u043e\\u0442 \\u0431\\u0435\\u0437 \\u0442\\u0440.',total_turnover:'\\u041e\\u0431\\u0449. \\u043e\\u0431\\u043e\\u0440\\u043e\\u0442',turnover_excl_transit:'\\u041e\\u0431\\u043e\\u0440\\u043e\\u0442 \\u0431\\u0435\\u0437 \\u0442\\u0440.',income_minus_expenses:'EBT (\\u0414\\u043e\\u0445\\u2212\\u0420\\u0430\\u0441\\u0445)',payroll:'\\u0424\\u041e\\u0422',vat_inclusive:'\\u041d\\u0414\\u0421 \\u0432\\u043a\\u043b.',vat_turnover:'\\u041d\\u0414\\u0421 \\u043e\\u0431\\u043e\\u0440\\u043e\\u0442',fixed:'\\u0424\\u0438\\u043a\\u0441.'};
  var statusColors = {paid:'#22C55E',pending:'#F59E0B',overdue:'#EF4444'};
  var statusLabels = {paid:'\\u041e\\u043f\\u043b\\u0430\\u0447\\u0435\\u043d',pending:'\\u041e\\u0436\\u0438\\u0434\\u0430\\u0435\\u0442',overdue:'\\u041f\\u0440\\u043e\\u0441\\u0440\\u043e\\u0447\\u0435\\u043d'};
  // Use P&L data for showing calculated amounts from taxes with is_auto
  var pnlTaxes = (p && p.taxes) || [];
  // Bases from P&L for display
  var bases = (p && p._bases) || {};
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
  h += '<h3 style="font-weight:700;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-landmark" style="color:#F59E0B;margin-right:8px"></i>\\u041d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432\\u044b\\u0435 \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0438</h3>';
  h += '<button class="btn btn-primary" style="padding:8px 14px;font-size:0.85rem" onclick="showPnlForm(&apos;tax&apos;)"><i class="fas fa-plus" style="margin-right:6px"></i>\\u0414\\u043e\\u0431\\u0430\\u0432\\u0438\\u0442\\u044c \\u043d\\u0430\\u043b\\u043e\\u0433</button></div>';
  // Current bases info
  h += '<div class="card" style="padding:12px 16px;margin-bottom:14px;background:rgba(139,92,246,0.05);border-color:rgba(139,92,246,0.2)">';
  h += '<div style="font-weight:600;color:#a78bfa;font-size:0.82rem;margin-bottom:8px"><i class="fas fa-database" style="margin-right:6px"></i>\\u0411\\u0430\\u0437\\u044b \\u0434\\u043b\\u044f \\u0430\\u0432\\u0442\\u043e\\u0440\\u0430\\u0441\\u0447\\u0451\\u0442\\u0430 (\\u0442\\u0435\\u043a\\u0443\\u0449\\u0438\\u0439 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434):</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;font-size:0.78rem">';
  h += '<div style="padding:6px 10px;background:rgba(34,197,94,0.06);border-radius:6px;border:1px solid rgba(34,197,94,0.15)"><span style="color:#64748b">\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430:</span> <b style="color:#22C55E">' + fmtAmt(bases.revenue || 0) + '</b></div>';
  h += '<div style="padding:6px 10px;background:rgba(167,139,250,0.06);border-radius:6px;border:1px solid rgba(167,139,250,0.15)"><span style="color:#64748b">\\u041e\\u0431\\u0449. \\u043e\\u0431\\u043e\\u0440\\u043e\\u0442:</span> <b style="color:#a78bfa">' + fmtAmt(bases.total_turnover || 0) + '</b></div>';
  h += '<div style="padding:6px 10px;background:rgba(245,158,11,0.06);border-radius:6px;border:1px solid rgba(245,158,11,0.15)"><span style="color:#64748b">EBT (\\u0414\\u043e\\u0445\\u2212\\u0420\\u0430\\u0441\\u0445):</span> <b style="color:#F59E0B">' + fmtAmt(bases.ebt || 0) + '</b></div>';
  h += '<div style="padding:6px 10px;background:rgba(59,130,246,0.06);border-radius:6px;border:1px solid rgba(59,130,246,0.15)"><span style="color:#64748b">\\u0424\\u041e\\u0422:</span> <b style="color:#3B82F6">' + fmtAmt(bases.payroll || 0) + '</b></div>';
  h += '</div></div>';
  if (showPnlAddForm && pnlEditType === 'tax') {
    var editItem = pnlEditId ? (data.taxPayments || []).find(function(t) { return t.id === pnlEditId; }) : null;
    h += renderPnlCrudForm('tax', editItem);
  }
  var items = (data.taxPayments || []).filter(function(t) { return t.period_key === pnlPeriod; });
  if (!items.length) { h += '<div class="card" style="text-align:center;color:#64748b;padding:32px"><i class="fas fa-info-circle" style="margin-right:8px;color:#8B5CF6"></i>\\u041d\\u0435\\u0442 \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432\\u044b\\u0445 \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0435\\u0439 \\u0437\\u0430 \\u044d\\u0442\\u043e\\u0442 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434.<br><span style="font-size:0.78rem;color:#475569">\\u0414\\u043e\\u0431\\u0430\\u0432\\u044c\\u0442\\u0435 \\u043d\\u0430\\u043b\\u043e\\u0433 \\u0441 \\u0430\\u0432\\u0442\\u043e\\u0440\\u0430\\u0441\\u0447\\u0451\\u0442\\u043e\\u043c \\u0438\\u043b\\u0438 \\u0441\\u043e\\u0437\\u0434\\u0430\\u0439\\u0442\\u0435 \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432\\u043e\\u0435 \\u043f\\u0440\\u0430\\u0432\\u0438\\u043b\\u043e \\u0432\\u043d\\u0438\\u0437\\u0443.</span></div>'; }
  if (items.length) {
  var total = 0;
  h += '<div class="card" style="padding:0;overflow:hidden">';
  for (var i = 0; i < items.length; i++) {
    var t = items[i];
    // Find the calculated version from P&L data (which has computed amounts for is_auto taxes)
    var pnlT = pnlTaxes.find(function(pt) { return pt.id === t.id; });
    var displayAmount = pnlT ? (pnlT.amount || 0) : (t.amount || 0);
    total += displayAmount;
    h += '<div style="padding:14px 16px;border-bottom:1px solid #1e293b">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
    h += '<div style="flex:1">';
    h += '<div style="font-weight:600;color:#e2e8f0;font-size:0.95rem">' + escHtml(t.tax_name || typeLabels[t.tax_type] || t.tax_type) + '</div>';
    h += '<div style="font-size:0.75rem;color:#64748b;margin-top:2px">' + (typeLabels[t.tax_type] || t.tax_type);
    if (t.is_auto && t.tax_rate) {
      h += ' <span style="color:#a78bfa;font-weight:600"><i class="fas fa-magic" style="font-size:0.65rem;margin:0 3px"></i>' + t.tax_rate + '% \\u00d7 ' + (baseLabels[t.tax_base] || t.tax_base) + '</span>';
    }
    h += '</div>';
    // Show formula and calculation
    if (t.is_auto && t.tax_rate && pnlT) {
      var calcBase = pnlT.calculated_base || 0;
      var bName = baseLabels[pnlT.calculated_base_name || t.tax_base] || t.tax_base;
      if (t.tax_base === 'vat_inclusive') {
        h += '<div style="font-size:0.72rem;color:#8B5CF6;margin-top:4px;padding:3px 8px;background:rgba(139,92,246,0.06);border-radius:4px;display:inline-block"><i class="fas fa-calculator" style="margin-right:4px"></i>' + fmtAmt(calcBase) + ' \\u00d7 ' + t.tax_rate + '% / (100+' + t.tax_rate + ') = <b>' + fmtAmt(displayAmount) + '</b></div>';
      } else {
        h += '<div style="font-size:0.72rem;color:#8B5CF6;margin-top:4px;padding:3px 8px;background:rgba(139,92,246,0.06);border-radius:4px;display:inline-block"><i class="fas fa-calculator" style="margin-right:4px"></i>' + bName + ': ' + fmtAmt(calcBase) + ' \\u00d7 ' + t.tax_rate + '% = <b>' + fmtAmt(displayAmount) + '</b></div>';
      }
    }
    if (t.due_date) { h += '<div style="font-size:0.7rem;color:#475569;margin-top:3px"><i class="fas fa-clock" style="margin-right:4px"></i>\\u0421\\u0440\\u043e\\u043a: ' + t.due_date + (t.payment_date ? ' | \\u041e\\u043f\\u043b\\u0430\\u0442\\u0430: ' + t.payment_date : '') + '</div>'; }
    if (t.notes) h += '<div style="font-size:0.72rem;color:#8B5CF6;margin-top:2px"><i class="fas fa-comment" style="margin-right:4px;font-size:0.6rem"></i>' + escHtml(t.notes) + '</div>';
    h += '</div>';
    h += '<div style="display:flex;align-items:center;gap:10px;flex-shrink:0">';
    h += '<span style="font-weight:700;color:#F59E0B;font-size:1.05rem">' + fmtAmt(displayAmount) + '</span>';
    h += '<span class="badge" style="background:' + (statusColors[t.status] || '#64748b') + '22;color:' + (statusColors[t.status] || '#64748b') + '">' + (statusLabels[t.status] || t.status) + '</span>';
    h += '<button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem" onclick="editPnlItem(&apos;tax&apos;,' + t.id + ')"><i class="fas fa-edit"></i></button>';
    h += '<button class="tier-del-btn" onclick="deletePnlItem(&apos;tax&apos;,' + t.id + ')"><i class="fas fa-trash" style="font-size:0.6rem"></i></button>';
    h += '</div></div></div>';
  }
  h += '<div style="padding:14px 16px;background:rgba(245,158,11,0.08);display:flex;justify-content:space-between;align-items:center"><span style="font-weight:700;color:#94a3b8"><i class="fas fa-sigma" style="margin-right:6px"></i>\\u0418\\u0442\\u043e\\u0433\\u043e \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432:</span><span style="font-weight:800;color:#F59E0B;font-size:1.1rem">' + fmtAmt(total) + '</span></div>';
  h += '</div>';
  } // end if (items.length)
  // All taxes (history)
  var allTaxes = data.taxPayments || [];
  if (allTaxes.length > items.length) {
    h += '<details style="margin-top:16px"><summary style="cursor:pointer;color:#64748b;font-size:0.85rem"><i class="fas fa-history" style="margin-right:6px"></i>\\u0412\\u0441\\u044f \\u0438\\u0441\\u0442\\u043e\\u0440\\u0438\\u044f \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432 (' + allTaxes.length + ')</summary>';
    h += '<div class="card" style="padding:8px;margin-top:8px;max-height:300px;overflow-y:auto">';
    for (var j = 0; j < allTaxes.length; j++) {
      var at = allTaxes[j];
      h += '<div style="display:flex;justify-content:space-between;padding:6px 8px;font-size:0.82rem;border-bottom:1px solid #1e293b22">';
      h += '<span style="color:#94a3b8">' + (at.period_key || '') + ' | ' + escHtml(at.tax_name || typeLabels[at.tax_type] || at.tax_type);
      if (at.is_auto && at.tax_rate) h += ' <span style="color:#a78bfa">[' + at.tax_rate + '% \\u00d7 ' + (baseLabels[at.tax_base] || '') + ']</span>';
      h += '</span>';
      h += '<span style="font-weight:600;color:#F59E0B">' + fmtAmt(at.amount) + '</span></div>';
    }
    h += '</div></details>';
  }
  // Tax workflow explanation — comprehensive single block
  h += '<details style="margin-top:16px"><summary style="cursor:pointer;color:#64748b;font-size:0.85rem;font-weight:600"><i class="fas fa-question-circle" style="margin-right:6px;color:#F59E0B"></i>\\u041a\\u0430\\u043a \\u0440\\u0430\\u0431\\u043e\\u0442\\u0430\\u044e\\u0442 \\u043d\\u0430\\u043b\\u043e\\u0433\\u0438 \\u0432 P&L</summary>';
  h += '<div class="card" style="margin-top:8px;font-size:0.8rem;color:#94a3b8;line-height:1.9">';
  // Section 1 - Overview (unified form)
  h += '<div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #334155">';
  h += '<div style="font-weight:700;color:#e2e8f0;font-size:0.88rem;margin-bottom:6px"><i class="fas fa-info-circle" style="color:#3B82F6;margin-right:6px"></i>Как добавить налог (единая форма)</div>';
  h += '<div>Нажмите <b style="color:#F59E0B">«Добавить налог»</b> — откроется <b>единая форма</b>. Галочка <b style="color:#22C55E">☑ Авторасчёт</b> определяет режим:</div>';
  h += '<div style="display:grid;gap:8px;margin-top:8px">';
  h += '<div style="padding:8px 12px;background:rgba(34,197,94,0.06);border-radius:6px;border:1px solid rgba(34,197,94,0.15)">';
  h += '<b style="color:#22C55E">☑ Галочка ВКЛ = Автоматический налог</b>';
  h += '<div style="margin-top:4px;color:#94a3b8">Создаётся <b>правило</b> (шаблон) + <b>платёж</b> за текущий период. Правило повторяется каждый месяц/квартал — платежи генерируются автоматически при открытии P&L.</div>';
  h += '<div style="margin-top:4px;color:#64748b;font-size:0.78rem">Поля: тип налога, ставка %, база расчёта, периодичность, начало действия. Название формируется автоматически (например, «НДС 20%»).</div></div>';
  h += '<div style="padding:8px 12px;background:rgba(245,158,11,0.06);border-radius:6px;border:1px solid rgba(245,158,11,0.15)">';
  h += '<b style="color:#F59E0B">☐ Галочка ВЫКЛ = Ручной налог</b>';
  h += '<div style="margin-top:4px;color:#94a3b8">Создаётся <b>один платёж</b> за текущий месяц. Без правила — не повторяется. Подходит для разовых начислений (штраф, доплата, корректировка).</div>';
  h += '<div style="margin-top:4px;color:#64748b;font-size:0.78rem">Поля: тип налога, сумма (AMD), срок уплаты, дата оплаты, статус. Название формируется автоматически.</div></div>';
  h += '</div></div>';
  // Section 2 - How auto-calc works
  h += '<div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #334155">';
  h += '<div style="font-weight:700;color:#e2e8f0;font-size:0.88rem;margin-bottom:6px"><i class="fas fa-magic" style="color:#22C55E;margin-right:6px"></i>Как работает авторасчёт</div>';
  h += '<div>Формула: <b style="color:#22C55E">Сумма налога = Ставка% × База расчёта</b></div>';
  h += '<div style="margin-top:6px">При открытии P&L система: 1) собирает все финансовые данные за период; 2) вычисляет базу (оборот, прибыль, ФОТ...); 3) умножает на ставку и показывает результат.</div>';
  h += '<div style="margin-top:8px;padding:8px 12px;background:rgba(139,92,246,0.08);border-radius:6px;border:1px solid rgba(139,92,246,0.2)"><b style="color:#8B5CF6"><i class="fas fa-bolt" style="margin-right:4px"></i>Автоматически:</b> Платежи создаются автоматически при открытии P&L за любой период. Кнопка «Генерировать» — для ручного запуска, если нужно пересоздать или если платёж был удалён.</div>';
  h += '<div style="margin-top:6px;padding:8px 12px;background:rgba(245,158,11,0.08);border-radius:6px;border:1px solid rgba(245,158,11,0.2)"><b style="color:#F59E0B"><i class="fas fa-cog" style="margin-right:4px"></i>Правила — это шаблоны.</b> Нажмите «Генерировать» и система создаст налоговые платежи за период, которые автоматически рассчитаются от базы. Вам не нужно добавлять платежи вручную каждый месяц.</div>';
  h += '</div>';
  // Section 3 - Bases explanation
  h += '<div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #334155">';
  h += '<div style="font-weight:700;color:#e2e8f0;font-size:0.88rem;margin-bottom:6px"><i class="fas fa-calculator" style="color:#8B5CF6;margin-right:6px"></i>\\u0411\\u0430\\u0437\\u044b \\u0440\\u0430\\u0441\\u0447\\u0451\\u0442\\u0430 (\\u043e\\u0442 \\u0447\\u0435\\u0433\\u043e \\u0441\\u0447\\u0438\\u0442\\u0430\\u0435\\u0442\\u0441\\u044f \\u043d\\u0430\\u043b\\u043e\\u0433)</div>';
  h += '<div style="padding-left:16px;margin-bottom:6px">\\u2022 <b style="color:#22C55E">\\u041e\\u0431\\u043e\\u0440\\u043e\\u0442 \\u0431\\u0435\\u0437 \\u0442\\u0440\\u0430\\u043d\\u0437\\u0438\\u0442\\u0430</b> \\u2014 \\u0434\\u0435\\u043d\\u044c\\u0433\\u0438 \\u0442\\u043e\\u043b\\u044c\\u043a\\u043e \\u0437\\u0430 \\u0432\\u0430\\u0448\\u0438 \\u0443\\u0441\\u043b\\u0443\\u0433\\u0438. \\u0414\\u0435\\u043d\\u044c\\u0433\\u0438 \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u043e\\u0432 \\u043d\\u0430 \\u0432\\u044b\\u043a\\u0443\\u043f\\u044b \\u043d\\u0435 \\u0432\\u0430\\u0448 \\u0434\\u043e\\u0445\\u043e\\u0434 \\u2014 \\u043e\\u043d\\u0438 \\u0438\\u0441\\u043a\\u043b\\u044e\\u0447\\u0435\\u043d\\u044b. <b>\\u042d\\u0442\\u043e \\u043e\\u0441\\u043d\\u043e\\u0432\\u043d\\u0430\\u044f \\u0431\\u0430\\u0437\\u0430 \\u0434\\u043b\\u044f \\u0431\\u043e\\u043b\\u044c\\u0448\\u0438\\u043d\\u0441\\u0442\\u0432\\u0430 \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432.</b></div>';
  h += '<div style="padding-left:16px;margin-bottom:6px">\\u2022 <b style="color:#a78bfa">\\u041e\\u0431\\u0449\\u0438\\u0439 \\u043e\\u0431\\u043e\\u0440\\u043e\\u0442</b> \\u2014 \\u0432\\u0441\\u0435 \\u0432\\u0445\\u043e\\u0434\\u044f\\u0449\\u0438\\u0435 \\u0434\\u0435\\u043d\\u044c\\u0433\\u0438: \\u0443\\u0441\\u043b\\u0443\\u0433\\u0438 + \\u0432\\u044b\\u043a\\u0443\\u043f\\u044b (\\u0441\\u0442\\u0430\\u0442\\u044c\\u0438). \\u0412\\u0441\\u0451 \\u0447\\u0442\\u043e \\u043f\\u043e\\u0441\\u0442\\u0443\\u043f\\u0438\\u043b\\u043e \\u043d\\u0430 \\u0441\\u0447\\u0451\\u0442, \\u0432\\u043a\\u043b\\u044e\\u0447\\u0430\\u044f \\u0442\\u0440\\u0430\\u043d\\u0437\\u0438\\u0442\\u043d\\u044b\\u0435 \\u0441\\u0440\\u0435\\u0434\\u0441\\u0442\\u0432\\u0430</div>';
  h += '<div style="padding-left:16px;margin-bottom:6px">\\u2022 <b style="color:#F59E0B">EBT (\\u0414\\u043e\\u0445\\u043e\\u0434\\u044b \\u2212 \\u0420\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b)</b> \\u2014 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u0434\\u043e \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432. \\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 \\u043c\\u0438\\u043d\\u0443\\u0441 \\u0432\\u0441\\u0435 \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b (\\u0417\\u041f, \\u043c\\u0430\\u0440\\u043a\\u0435\\u0442\\u0438\\u043d\\u0433, \\u0430\\u043c\\u043e\\u0440\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f, \\u043f\\u0440\\u043e\\u0446\\u0435\\u043d\\u0442\\u044b). \\u041f\\u043e\\u0434\\u0445\\u043e\\u0434\\u0438\\u0442 \\u0434\\u043b\\u044f \\u043d\\u0430\\u043b\\u043e\\u0433\\u0430 \\u043d\\u0430 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u0438 \\u0423\\u0421\\u041d \\u00ab\\u0434\\u043e\\u0445\\u043e\\u0434\\u044b \\u043c\\u0438\\u043d\\u0443\\u0441 \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b\\u00bb. <span style="color:#64748b">(\\u0420\\u0430\\u043d\\u0435\\u0435 \\u0431\\u044b\\u043b\\u043e 2 \\u043e\\u0442\\u0434\\u0435\\u043b\\u044c\\u043d\\u044b\\u0445 \\u0431\\u0430\\u0437\\u044b \\u2014 \\u043e\\u0431\\u044a\\u0435\\u0434\\u0438\\u043d\\u0435\\u043d\\u044b \\u0432 \\u043e\\u0434\\u043d\\u0443.)</span></div>';
  h += '<div style="padding-left:16px;margin-bottom:6px">\\u2022 <b style="color:#3B82F6">\\u0424\\u041e\\u0422</b> \\u2014 \\u0444\\u043e\\u043d\\u0434 \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b \\u0442\\u0440\\u0443\\u0434\\u0430. \\u0421\\u0443\\u043c\\u043c\\u0430 \\u0437\\u0430\\u0440\\u043f\\u043b\\u0430\\u0442 + \\u0431\\u043e\\u043d\\u0443\\u0441\\u043e\\u0432 \\u0441\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u043a\\u043e\\u0432. \\u0418\\u0441\\u043f\\u043e\\u043b\\u044c\\u0437\\u0443\\u0435\\u0442\\u0441\\u044f \\u0434\\u043b\\u044f \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432 \\u043d\\u0430 \\u0417\\u041f (\\u0441\\u043e\\u0446. \\u043e\\u0442\\u0447\\u0438\\u0441\\u043b\\u0435\\u043d\\u0438\\u044f, \\u043f\\u043e\\u0434\\u043e\\u0445\\u043e\\u0434\\u043d\\u044b\\u0439)</div>';
  h += '<div style="padding-left:16px;margin-bottom:6px">\\u2022 <b style="color:#F59E0B">\\u041d\\u0414\\u0421 \\u0432\\u043a\\u043b\\u044e\\u0447\\u0451\\u043d (\\u0443\\u0441\\u043b\\u0443\\u0433\\u0438)</b> \\u2014 \\u041d\\u0414\\u0421 \\u0443\\u0436\\u0435 \\u0432 \\u0446\\u0435\\u043d\\u0435. \\u0421\\u0438\\u0441\\u0442\\u0435\\u043c\\u0430 \\u0432\\u044b\\u0434\\u0435\\u043b\\u044f\\u0435\\u0442 \\u0435\\u0433\\u043e \\u043e\\u0431\\u0440\\u0430\\u0442\\u043d\\u043e: \\u0421\\u0443\\u043c\\u043c\\u0430 \\u00d7 \\u0421\\u0442\\u0430\\u0432\\u043a\\u0430 / (100 + \\u0421\\u0442\\u0430\\u0432\\u043a\\u0430). \\u041d\\u0430\\u043f\\u0440\\u0438\\u043c\\u0435\\u0440: 120\\u2009000 \\u00d7 20 / 120 = 20\\u2009000 \\u041d\\u0414\\u0421</div>';
  h += '<div style="padding-left:16px;margin-bottom:6px">\\u2022 <b style="color:#F59E0B">\\u041d\\u0414\\u0421 \\u0432\\u043a\\u043b\\u044e\\u0447\\u0451\\u043d (\\u043e\\u0431\\u043e\\u0440\\u043e\\u0442)</b> \\u2014 \\u0442\\u043e \\u0436\\u0435, \\u043d\\u043e \\u043e\\u0442 \\u043e\\u0431\\u0449\\u0435\\u0433\\u043e \\u043e\\u0431\\u043e\\u0440\\u043e\\u0442\\u0430 (\\u0443\\u0441\\u043b\\u0443\\u0433\\u0438 + \\u0432\\u044b\\u043a\\u0443\\u043f\\u044b)</div>';
  h += '<div style="padding-left:16px;margin-bottom:6px">\\u2022 <b style="color:#64748b">\\u0424\\u0438\\u043a\\u0441. \\u0441\\u0443\\u043c\\u043c\\u0430</b> \\u2014 \\u0432\\u044b \\u0432\\u0432\\u043e\\u0434\\u0438\\u0442\\u0435 \\u0441\\u0443\\u043c\\u043c\\u0443 \\u0441\\u0430\\u043c\\u0438. \\u041d\\u0430\\u043f\\u0440\\u0438\\u043c\\u0435\\u0440, \\u043f\\u0430\\u0442\\u0435\\u043d\\u0442 60\\u2009000 \\u0432 \\u043c\\u0435\\u0441\\u044f\\u0446 \\u2014 \\u0444\\u0438\\u043a\\u0441\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u043d\\u0430\\u044f \\u0441\\u0443\\u043c\\u043c\\u0430, \\u043d\\u0435 \\u0437\\u0430\\u0432\\u0438\\u0441\\u0438\\u0442 \\u043e\\u0442 \\u043e\\u0431\\u043e\\u0440\\u043e\\u0442\\u0430</div>';
  h += '</div>';
  // Section 4 - Unified form explanation
  h += '<div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #334155">';
  h += '<div style="font-weight:700;color:#e2e8f0;font-size:0.88rem;margin-bottom:6px"><i class="fas fa-cog" style="color:#F59E0B;margin-right:6px"></i>Что такое «Правило» и «Платёж»</div>';
  h += '<div><b style="color:#F59E0B">Правило</b> = шаблон. Создаётся автоматически, когда вы сохраняете налог с галочкой ☑ Авторасчёт. Содержит: тип, ставку, базу, периодичность. Система каждый месяц/квартал создаёт из него платёж.</div>';
  h += '<div style="margin-top:4px"><b style="color:#F59E0B">Платёж</b> = конкретная запись за конкретный месяц. Создаётся автоматически из правила или вручную (если галочка выкл). Содержит сумму, статус оплаты, срок.</div>';
  h += '<div style="margin-top:8px;padding:8px 12px;background:rgba(34,197,94,0.08);border-radius:6px;border:1px solid rgba(34,197,94,0.2)"><b style="color:#22C55E">Рекомендация:</b> Для постоянных налогов (оборот, НДС, ЗП) — сохраняйте с галочкой ☑. Для разовых (штраф, доплата) — без галочки ☐.</div>';
  h += '</div>';
  // Section 5 - Type vs Base explanation
  h += '<div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #334155">';
  h += '<div style="font-weight:700;color:#e2e8f0;font-size:0.88rem;margin-bottom:6px"><i class="fas fa-tags" style="color:#a78bfa;margin-right:6px"></i>\\u0422\\u0438\\u043f \\u043d\\u0430\\u043b\\u043e\\u0433\\u0430 vs \\u0411\\u0430\\u0437\\u0430 \\u0440\\u0430\\u0441\\u0447\\u0451\\u0442\\u0430 \\u2014 \\u0432 \\u0447\\u0451\\u043c \\u0440\\u0430\\u0437\\u043d\\u0438\\u0446\\u0430?</div>';
  h += '<div><b style="color:#a78bfa">\\u0422\\u0438\\u043f \\u043d\\u0430\\u043b\\u043e\\u0433\\u0430</b> \\u2014 \\u044d\\u0442\\u043e <b>\\u043a\\u0430\\u0442\\u0435\\u0433\\u043e\\u0440\\u0438\\u044f</b> \\u0434\\u043b\\u044f \\u0433\\u0440\\u0443\\u043f\\u043f\\u0438\\u0440\\u043e\\u0432\\u043a\\u0438 \\u0438 \\u043e\\u0442\\u0447\\u0451\\u0442\\u043d\\u043e\\u0441\\u0442\\u0438. \\u041e\\u043d\\u0430 \\u043d\\u0435 \\u0432\\u043b\\u0438\\u044f\\u0435\\u0442 \\u043d\\u0430 \\u0440\\u0430\\u0441\\u0447\\u0451\\u0442 \\u2014 \\u043f\\u043e\\u043c\\u043e\\u0433\\u0430\\u0435\\u0442 \\u043f\\u043e\\u043d\\u044f\\u0442\\u044c, \\u043a\\u0430\\u043a\\u043e\\u0439 \\u044d\\u0442\\u043e \\u043d\\u0430\\u043b\\u043e\\u0433 (\\u041d\\u0414\\u0421, \\u0423\\u0421\\u041d, \\u043d\\u0430 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c...).</div>';
  h += '<div style="margin-top:4px"><b style="color:#a78bfa">\\u0411\\u0430\\u0437\\u0430 \\u0440\\u0430\\u0441\\u0447\\u0451\\u0442\\u0430</b> \\u2014 \\u044d\\u0442\\u043e <b>\\u0444\\u043e\\u0440\\u043c\\u0443\\u043b\\u0430</b>, \\u043a\\u043e\\u0442\\u043e\\u0440\\u0430\\u044f \\u043e\\u043f\\u0440\\u0435\\u0434\\u0435\\u043b\\u044f\\u0435\\u0442, \\u043e\\u0442 \\u043a\\u0430\\u043a\\u043e\\u0439 \\u0441\\u0443\\u043c\\u043c\\u044b \\u0441\\u0447\\u0438\\u0442\\u0430\\u0435\\u0442\\u0441\\u044f \\u043d\\u0430\\u043b\\u043e\\u0433. \\u0418\\u043c\\u0435\\u043d\\u043d\\u043e \\u043e\\u043d\\u0430 \\u0432\\u043b\\u0438\\u044f\\u0435\\u0442 \\u043d\\u0430 \\u0438\\u0442\\u043e\\u0433\\u043e\\u0432\\u0443\\u044e \\u0441\\u0443\\u043c\\u043c\\u0443.</div>';
  h += '<div style="margin-top:4px;color:#64748b">\\u041f\\u0440\\u0438\\u043c\\u0435\\u0440: \\u0422\\u0438\\u043f = \\u00ab\\u041d\\u0430\\u043b\\u043e\\u0433 \\u043d\\u0430 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c\\u00bb, \\u0411\\u0430\\u0437\\u0430 = \\u00abEBT\\u00bb, \\u0421\\u0442\\u0430\\u0432\\u043a\\u0430 = 18%. \\u0421\\u0438\\u0441\\u0442\\u0435\\u043c\\u0430 \\u0432\\u043e\\u0437\\u044c\\u043c\\u0451\\u0442 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u0434\\u043e \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432 \\u0438 \\u0443\\u043c\\u043d\\u043e\\u0436\\u0438\\u0442 \\u043d\\u0430 18%.</div>';
  h += '</div>';
  // Section 5b - Срок уплаты vs Дата оплаты
  h += '<div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #334155">';
  h += '<div style="font-weight:700;color:#e2e8f0;font-size:0.88rem;margin-bottom:6px"><i class="fas fa-calendar-alt" style="color:#3B82F6;margin-right:6px"></i>\\u0421\\u0440\\u043e\\u043a \\u0443\\u043f\\u043b\\u0430\\u0442\\u044b vs \\u0414\\u0430\\u0442\\u0430 \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b \\u2014 \\u0432 \\u0447\\u0451\\u043c \\u0440\\u0430\\u0437\\u043d\\u0438\\u0446\\u0430?</div>';
  h += '<div><b style="color:#EF4444">\\u0421\\u0440\\u043e\\u043a \\u0443\\u043f\\u043b\\u0430\\u0442\\u044b (due date)</b> \\u2014 \\u044d\\u0442\\u043e <b>\\u043a\\u0440\\u0430\\u0439\\u043d\\u0438\\u0439 \\u0441\\u0440\\u043e\\u043a</b>, \\u0434\\u043e \\u043a\\u043e\\u0442\\u043e\\u0440\\u043e\\u0433\\u043e \\u043d\\u0430\\u043b\\u043e\\u0433 \\u043d\\u0443\\u0436\\u043d\\u043e \\u043e\\u043f\\u043b\\u0430\\u0442\\u0438\\u0442\\u044c \\u043f\\u043e \\u0437\\u0430\\u043a\\u043e\\u043d\\u0443. \\u041d\\u0430\\u043f\\u0440\\u0438\\u043c\\u0435\\u0440, \\u041d\\u0414\\u0421 \\u0437\\u0430 1-\\u0439 \\u043a\\u0432\\u0430\\u0440\\u0442\\u0430\\u043b \\u2014 \\u0434\\u043e 20 \\u0430\\u043f\\u0440\\u0435\\u043b\\u044f. \\u0415\\u0441\\u043b\\u0438 \\u043f\\u0440\\u043e\\u043f\\u0443\\u0441\\u0442\\u0438\\u0442\\u044c \\u2014 \\u0431\\u0443\\u0434\\u0435\\u0442 \\u043f\\u0435\\u043d\\u044f.</div>';
  h += '<div style="margin-top:6px"><b style="color:#22C55E">\\u0414\\u0430\\u0442\\u0430 \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b (payment date)</b> \\u2014 \\u044d\\u0442\\u043e <b>\\u0444\\u0430\\u043a\\u0442\\u0438\\u0447\\u0435\\u0441\\u043a\\u0430\\u044f \\u0434\\u0430\\u0442\\u0430</b>, \\u043a\\u043e\\u0433\\u0434\\u0430 \\u0432\\u044b \\u0440\\u0435\\u0430\\u043b\\u044c\\u043d\\u043e \\u043e\\u043f\\u043b\\u0430\\u0442\\u0438\\u043b\\u0438 \\u043d\\u0430\\u043b\\u043e\\u0433. \\u041c\\u043e\\u0436\\u0435\\u0442 \\u0431\\u044b\\u0442\\u044c \\u0434\\u043e \\u0438\\u043b\\u0438 \\u043f\\u043e\\u0441\\u043b\\u0435 \\u0441\\u0440\\u043e\\u043a\\u0430.</div>';
  h += '<div style="margin-top:8px;padding:8px 12px;background:rgba(59,130,246,0.08);border-radius:6px;border:1px solid rgba(59,130,246,0.2)"><b style="color:#3B82F6">\\u041f\\u0440\\u0438\\u043c\\u0435\\u0440:</b> \\u0421\\u0440\\u043e\\u043a \\u0443\\u043f\\u043b\\u0430\\u0442\\u044b = 20.04.2026 (\\u043a\\u0440\\u0430\\u0439\\u043d\\u0438\\u0439 \\u0441\\u0440\\u043e\\u043a). \\u0414\\u0430\\u0442\\u0430 \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b = 15.04.2026 (\\u0432\\u044b \\u043e\\u043f\\u043b\\u0430\\u0442\\u0438\\u043b\\u0438 \\u0437\\u0430\\u0440\\u0430\\u043d\\u0435\\u0435). \\u0421\\u0442\\u0430\\u0442\\u0443\\u0441 \\u2192 \\u00ab\\u041e\\u043f\\u043b\\u0430\\u0447\\u0435\\u043d\\u00bb.</div>';
  h += '<div style="margin-top:6px;padding:8px 12px;background:rgba(239,68,68,0.08);border-radius:6px;border:1px solid rgba(239,68,68,0.2)"><b style="color:#EF4444">\\u041e\\u0431\\u0440\\u0430\\u0442\\u043d\\u044b\\u0439 \\u043f\\u0440\\u0438\\u043c\\u0435\\u0440:</b> \\u0421\\u0440\\u043e\\u043a = 20.04, \\u0434\\u0430\\u0442\\u0430 \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b \\u043f\\u0443\\u0441\\u0442\\u0430 \\u2192 \\u0441\\u0442\\u0430\\u0442\\u0443\\u0441 \\u00ab\\u041f\\u0440\\u043e\\u0441\\u0440\\u043e\\u0447\\u0435\\u043d\\u00bb (\\u0435\\u0441\\u043b\\u0438 \\u0441\\u0435\\u0433\\u043e\\u0434\\u043d\\u044f > 20.04).</div>';
  h += '</div>';
  // Section 6 - Examples (unified form)
  h += '<div>';
  h += '<div style="font-weight:700;color:#e2e8f0;font-size:0.88rem;margin-bottom:8px"><i class="fas fa-lightbulb" style="color:#F59E0B;margin-right:6px"></i>Примеры настроек (через «Добавить налог»)</div>';
  h += '<div style="display:grid;gap:8px">';
  h += '<div style="padding:8px 12px;background:rgba(139,92,246,0.06);border-radius:6px;border-left:3px solid #8B5CF6"><b>Налог на оборот 5%</b> <span style="color:#22C55E;font-size:0.78rem">☑ Авторасчёт</span><br>Тип: Налог на оборот | База: Оборот без транзита | Ставка: 5% | Ежемесячно</div>';
  h += '<div style="padding:8px 12px;background:rgba(245,158,11,0.06);border-radius:6px;border-left:3px solid #F59E0B"><b>НДС 20% включён</b> <span style="color:#22C55E;font-size:0.78rem">☑ Авторасчёт</span><br>Тип: НДС | База: НДС вкл. (услуги) | Ставка: 20% | Ежеквартально</div>';
  h += '<div style="padding:8px 12px;background:rgba(59,130,246,0.06);border-radius:6px;border-left:3px solid #3B82F6"><b>Налоги на ЗП 20%</b> <span style="color:#22C55E;font-size:0.78rem">☑ Авторасчёт</span><br>Тип: Налоги на ЗП | База: ФОТ | Ставка: 20% | Ежемесячно</div>';
  h += '<div style="padding:8px 12px;background:rgba(100,116,139,0.06);border-radius:6px;border-left:3px solid #64748b"><b>Штраф налоговой 25 000</b> <span style="color:#F59E0B;font-size:0.78rem">☐ Ручной</span><br>Тип: Прочее | Сумма: 25 000 AMD | Разовый платёж</div>';
  h += '</div>';
  h += '</div>';
  // Section 7 - Deletion behavior (unified form)
  h += '<div style="margin-top:14px;padding-top:10px;border-top:1px solid #334155">';
  h += '<div style="font-weight:700;color:#e2e8f0;font-size:0.88rem;margin-bottom:6px"><i class="fas fa-trash-alt" style="color:#EF4444;margin-right:6px"></i>Удаление налогов</div>';
  h += '<div>• <b style="color:#EF4444">Ручной налог (☐)</b> — удаляется полностью. Можно создать заново через «Добавить налог».</div>';
  h += '<div style="margin-top:4px">• <b style="color:#F59E0B">Авто-налог (☑, из правила)</b> — при удалении скрывается, чтобы система не создала его заново. Правило остаётся активным для будущих периодов.</div>';
  h += '<div style="margin-top:4px">• <b style="color:#8B5CF6">Удалить правило</b> — удалите через список «Активные правила» внизу. После этого авто-платежи для этого налога перестанут создаваться.</div>';
  h += '<div style="margin-top:6px;padding:6px 10px;background:rgba(59,130,246,0.06);border-radius:6px;font-size:0.78rem;color:#64748b"><i class="fas fa-redo" style="color:#3B82F6;margin-right:4px"></i>Чтобы восстановить удалённый авто-налог: удалите старое правило → создайте налог заново через «Добавить налог» с галочкой ☑.</div>';
  h += '</div>';
  h += '</div></details>';
  // ===== TAX RULES ENGINE (simplified — creation now happens via "Добавить налог" form) =====
  var taxRules = (data.taxRules || (p && p.tax_rules) || []);
  if (taxRules.length > 0) {
  h += '<div style="margin-top:20px;border-top:2px solid #334155;padding-top:16px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h += '<h4 style="font-weight:700;color:#F59E0B;font-size:0.95rem"><i class="fas fa-cog" style="margin-right:6px"></i>Активные правила <span style="font-size:0.7rem;color:#64748b;font-weight:400">(созданы автоматически из формы «Добавить налог» с ☑ Авторасчёт)</span></h4>';
  h += '<button class="btn btn-success" style="padding:6px 12px;font-size:0.78rem" onclick="generateTaxFromRules()" title="\\u0420\\u0443\\u0447\\u043d\\u0430\\u044f \\u0433\\u0435\\u043d\\u0435\\u0440\\u0430\\u0446\\u0438\\u044f"><i class="fas fa-bolt" style="margin-right:4px"></i>\\u0413\\u0435\\u043d\\u0435\\u0440\\u0438\\u0440\\u043e\\u0432\\u0430\\u0442\\u044c \\u0437\\u0430 ' + pnlPeriod + '</button>';
  h += '</div>';
  h += '<div style="font-size:0.72rem;color:#64748b;margin-bottom:10px;line-height:1.5"><i class="fas fa-magic" style="color:#22C55E;margin-right:4px"></i>Платежи создаются автоматически при открытии P&L за любой период. Кнопка «Генерировать» — для ручного запуска, если нужно. Правила — это шаблоны. Нажмите «Генерировать» и система создаст налоговые платежи за период, которые автоматически рассчитаются от базы.</div>';
  // Existing rules list
  h += '<div class="card" style="padding:0;overflow:hidden">';
  for (var ri = 0; ri < taxRules.length; ri++) {
    var rule = taxRules[ri];
    var freqLabel = rule.frequency === 'quarterly' ? '\\u041a\\u0432\\u0430\\u0440\\u0442\\u0430\\u043b' : '\\u041c\\u0435\\u0441\\u044f\\u0446';
    h += '<div style="padding:10px 14px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center">';
    h += '<div><span style="font-weight:600;color:#e2e8f0">' + escHtml(rule.rule_name) + '</span>';
    h += ' <span style="color:#a78bfa;font-size:0.78rem">' + rule.tax_rate + '% \\u00d7 ' + (baseLabels[rule.tax_base] || rule.tax_base) + '</span>';
    h += ' <span style="padding:2px 6px;background:#334155;border-radius:4px;font-size:0.68rem;color:#94a3b8">' + freqLabel + '</span>';
    if (!rule.is_active) h += ' <span style="color:#EF4444;font-size:0.68rem">\\u041e\\u0442\\u043a\\u043b\\u044e\\u0447\\u0435\\u043d\\u043e</span>';
    h += '</div>';
    h += '<div style="display:flex;gap:6px">';
    h += '<button class="tier-del-btn" onclick="deleteTaxRule(' + rule.id + ')"><i class="fas fa-trash" style="font-size:0.55rem"></i></button>';
    h += '</div></div>';
  }
  h += '</div>';
  h += '</div>';
  } // end if taxRules.length
  return h;
}

function renderPnlAssets(p) {
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
  h += '<h3 style="font-weight:700;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-building" style="color:#3B82F6;margin-right:8px"></i>\\u041e\\u0441\\u043d\\u043e\\u0432\\u043d\\u044b\\u0435 \\u0441\\u0440\\u0435\\u0434\\u0441\\u0442\\u0432\\u0430 \\u0438 \\u0430\\u043c\\u043e\\u0440\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f</h3>';
  h += '<button class="btn btn-primary" style="padding:8px 14px;font-size:0.85rem" onclick="showPnlForm(&apos;asset&apos;)"><i class="fas fa-plus" style="margin-right:6px"></i>\\u0414\\u043e\\u0431\\u0430\\u0432\\u0438\\u0442\\u044c \\u0430\\u043a\\u0442\\u0438\\u0432</button></div>';
  if (showPnlAddForm && pnlEditType === 'asset') {
    var editItem = pnlEditId ? (data.assets || []).find(function(a) { return a.id === pnlEditId; }) : null;
    h += renderPnlCrudForm('asset', editItem);
  }
  var assets = data.assets || [];
  if (!assets.length) { h += '<div class="card" style="text-align:center;color:#64748b;padding:32px">\\u041d\\u0435\\u0442 \\u043e\\u0441\\u043d\\u043e\\u0432\\u043d\\u044b\\u0445 \\u0441\\u0440\\u0435\\u0434\\u0441\\u0442\\u0432</div>'; return h; }
  var totalDepr = 0;
  h += '<div class="card" style="padding:0;overflow:hidden">';
  for (var i = 0; i < assets.length; i++) {
    var a = assets[i]; var monthlyDepr = Math.round((a.purchase_cost - (a.residual_value || 0)) / (a.useful_life_months || 60) * 100) / 100;
    var monthsUsed = 0;
    if (a.purchase_date) { var pd = new Date(a.purchase_date); var now = new Date(); monthsUsed = (now.getFullYear() - pd.getFullYear()) * 12 + (now.getMonth() - pd.getMonth()); }
    var accumulated = Math.min(monthlyDepr * monthsUsed, a.purchase_cost - (a.residual_value || 0));
    var bookValue = a.purchase_cost - accumulated;
    totalDepr += monthlyDepr;
    h += '<div style="padding:14px 16px;border-bottom:1px solid #1e293b">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center">';
    h += '<div><div style="font-weight:600;color:#e2e8f0">' + escHtml(a.name) + ' <span style="color:#64748b;font-size:0.75rem">' + (a.category || '') + '</span></div>';
    h += '<div style="font-size:0.75rem;color:#64748b">\\u041a\\u0443\\u043f\\u043b\\u0435\\u043d: ' + (a.purchase_date || '?') + ' | \\u0421\\u0440\\u043e\\u043a: ' + (a.useful_life_months || 60) + ' \\u043c\\u0435\\u0441.</div></div>';
    h += '<div style="display:flex;align-items:center;gap:8px">';
    h += '<button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem" onclick="editPnlItem(&apos;asset&apos;,' + a.id + ')"><i class="fas fa-edit"></i></button>';
    h += '<button class="tier-del-btn" onclick="deletePnlItem(&apos;asset&apos;,' + a.id + ')"><i class="fas fa-trash" style="font-size:0.6rem"></i></button>';
    h += '</div></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px">';
    h += '<div style="text-align:center"><div style="font-size:0.7rem;color:#64748b">\\u0421\\u0442\\u043e\\u0438\\u043c\\u043e\\u0441\\u0442\\u044c</div><div style="font-weight:700;color:#3B82F6">' + fmtAmt(a.purchase_cost) + '</div></div>';
    h += '<div style="text-align:center"><div style="font-size:0.7rem;color:#64748b">\\u0410\\u043c\\u043e\\u0440\\u0442./\\u043c\\u0435\\u0441 <i class="fas fa-question-circle" style="color:#8B5CF6;font-size:0.55rem;cursor:help" title="(\\u0421\\u0442\\u043e\\u0438\\u043c\\u043e\\u0441\\u0442\\u044c \\u2212 \\u041e\\u0441\\u0442\\u0430\\u0442\\u043e\\u0447\\u043d\\u0430\\u044f) / \\u0421\\u0440\\u043e\\u043a \\u0441\\u043b\\u0443\\u0436\\u0431\\u044b \\u0432 \\u043c\\u0435\\u0441\\u044f\\u0446\\u0430\\u0445"></i></div><div style="font-weight:700;color:#F59E0B">' + fmtAmt(monthlyDepr) + '</div></div>';
    h += '<div style="text-align:center"><div style="font-size:0.7rem;color:#64748b">\\u041d\\u0430\\u043a\\u043e\\u043f\\u043b\\u0435\\u043d\\u043e <i class="fas fa-question-circle" style="color:#8B5CF6;font-size:0.55rem;cursor:help" title="\\u0421\\u0443\\u043c\\u043c\\u0430 \\u0432\\u0441\\u0435\\u0445 \\u0435\\u0436\\u0435\\u043c\\u0435\\u0441\\u044f\\u0447\\u043d\\u044b\\u0445 \\u0441\\u043f\\u0438\\u0441\\u0430\\u043d\\u0438\\u0439 \\u0441 \\u043c\\u043e\\u043c\\u0435\\u043d\\u0442\\u0430 \\u043f\\u043e\\u043a\\u0443\\u043f\\u043a\\u0438. \\u041e\\u0431\\u0449\\u0438\\u0439 \\u0438\\u0437\\u043d\\u043e\\u0441 \\u0430\\u043a\\u0442\\u0438\\u0432\\u0430."></i></div><div style="font-weight:700;color:#EF4444">' + fmtAmt(accumulated) + '</div></div>';
    h += '<div style="text-align:center"><div style="font-size:0.7rem;color:#64748b">\\u0411\\u0430\\u043b. \\u0441\\u0442\\u043e\\u0438\\u043c. <i class="fas fa-question-circle" style="color:#8B5CF6;font-size:0.55rem;cursor:help" title="\\u0411\\u0430\\u043b\\u0430\\u043d\\u0441\\u043e\\u0432\\u0430\\u044f \\u0441\\u0442\\u043e\\u0438\\u043c\\u043e\\u0441\\u0442\\u044c = \\u0421\\u0442\\u043e\\u0438\\u043c\\u043e\\u0441\\u0442\\u044c \\u2212 \\u041d\\u0430\\u043a\\u043e\\u043f\\u043b\\u0435\\u043d\\u043d\\u0430\\u044f \\u0430\\u043c\\u043e\\u0440\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f. \\u0421\\u043a\\u043e\\u043b\\u044c\\u043a\\u043e \\u0441\\u0442\\u043e\\u0438\\u0442 \\u0430\\u043a\\u0442\\u0438\\u0432 \\u043d\\u0430 \\u0431\\u0430\\u043b\\u0430\\u043d\\u0441\\u0435 \\u0441\\u0435\\u0439\\u0447\\u0430\\u0441."></i></div><div style="font-weight:700;color:#22C55E">' + fmtAmt(bookValue) + '</div></div>';
    h += '</div></div>';
  }
  h += '<div style="padding:12px 16px;background:rgba(59,130,246,0.08);display:flex;justify-content:space-between"><span style="font-weight:700;color:#94a3b8">\\u0418\\u0442\\u043e\\u0433\\u043e \\u0430\\u043c\\u043e\\u0440\\u0442\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f/\\u043c\\u0435\\u0441:</span><span style="font-weight:800;color:#3B82F6">' + fmtAmt(totalDepr) + '</span></div>';
  h += '</div>';
  // Amortization explanation
  h += '<details style="margin-top:12px"><summary style="cursor:pointer;color:#64748b;font-size:0.82rem;font-weight:600"><i class="fas fa-question-circle" style="margin-right:6px;color:#3B82F6"></i>Как считается амортизация и «Накоплено»</summary>';
  h += '<div class="card" style="margin-top:8px;font-size:0.78rem;color:#94a3b8;line-height:1.8">';
  h += '<div><b style="color:#F59E0B">Ежемесячная амортизация</b> = (Стоимость − Остаточная стоимость) / Срок службы (мес.)</div>';
  h += '<div><b style="color:#EF4444">Накоплено</b> = Ежемесячная амортизация × Количество месяцев с даты покупки до текущего момента</div>';
  h += '<div>Это общая сумма износа актива за всё время использования. Она начисляется каждый месяц автоматически с момента покупки.</div>';
  h += '<div><b style="color:#22C55E">Балансовая стоимость</b> = Стоимость покупки − Накопленная амортизация</div>';
  h += '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #334155"><b style="color:#3B82F6">Пример:</b> Ноутбук 600 000 ֏, остаточная 0, срок 36 мес. → Ежемесячно: 16 667 ֏. Через 12 мес.: Накоплено = 200 000 ֏, Балансовая = 400 000 ֏</div>';
  h += '</div></details>';
  return h;
}

function renderPnlLoans(p) {
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
  var mNamesFull = ['','\\u042f\\u043d\\u0432\\u0430\\u0440\\u044c','\\u0424\\u0435\\u0432\\u0440\\u0430\\u043b\\u044c','\\u041c\\u0430\\u0440\\u0442','\\u0410\\u043f\\u0440\\u0435\\u043b\\u044c','\\u041c\\u0430\\u0439','\\u0418\\u044e\\u043d\\u044c','\\u0418\\u044e\\u043b\\u044c','\\u0410\\u0432\\u0433\\u0443\\u0441\\u0442','\\u0421\\u0435\\u043d\\u0442\\u044f\\u0431\\u0440\\u044c','\\u041e\\u043a\\u0442\\u044f\\u0431\\u0440\\u044c','\\u041d\\u043e\\u044f\\u0431\\u0440\\u044c','\\u0414\\u0435\\u043a\\u0430\\u0431\\u0440\\u044c'];
  var loanPeriodMonth = parseInt((pnlPeriod || '').split('-')[1]) || 1;
  var loanPeriodYear = (pnlPeriod || '').split('-')[0] || '';
  var loanPeriodLabel = mNamesFull[loanPeriodMonth] + ' ' + loanPeriodYear;
  h += '<h3 style="font-weight:700;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-hand-holding-usd" style="color:#EF4444;margin-right:8px"></i>\\u041a\\u0440\\u0435\\u0434\\u0438\\u0442\\u044b \\u0438 \\u0437\\u0430\\u0439\\u043c\\u044b <span style="font-size:0.75rem;font-weight:600;padding:3px 8px;background:rgba(139,92,246,0.15);border-radius:6px;color:#a78bfa;margin-left:8px"><i class="fas fa-calendar-alt" style="margin-right:4px"></i>' + loanPeriodLabel + '</span></h3>';
  h += '<button class="btn btn-primary" style="padding:8px 14px;font-size:0.85rem" onclick="showPnlForm(&apos;loan&apos;)"><i class="fas fa-plus" style="margin-right:6px"></i>\\u0414\\u043e\\u0431\\u0430\\u0432\\u0438\\u0442\\u044c \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442</button></div>';
  // === SYSTEM-WIDE REPAYMENT MODE — COLLAPSIBLE CARD ===
  var ls = data.loanSettings || { repayment_mode: 'standard', aggressive_pct: 10, standard_extra_pct: 0 };
  var isAggr = ls.repayment_mode === 'aggressive';
  var modeIcon = isAggr ? 'fa-bolt' : 'fa-shield-alt';
  var modeColor = isAggr ? '#F59E0B' : '#22C55E';
  var modeLabel = isAggr ? 'Агрессивный' : 'Стандартный';
  var netProfit = (p && p.net_profit) || 0;
  var stdExtraPct = ls.standard_extra_pct || 0;
  // Helper: get actual payment for any loan type (prefers bank_monthly_payment)
  function getActPmt(loan) { return (loan.bank_monthly_payment && loan.bank_monthly_payment > 0) ? loan.bank_monthly_payment : (loan.monthly_payment || 0); }
  // Active loans = all with balance (including overdraft with overdraft_used)
  var activeLoans = (data.loans || []).filter(function(l) { return l.is_active !== 0 && ((l.remaining_balance || 0) > 0 || (l.loan_type === 'overdraft' && (l.overdraft_used || 0) > 0)); });
  var activeLoanCount = activeLoans.length;

  h += '<details id="loanModeDetails" class="card" style="margin-bottom:16px;border-left:3px solid ' + modeColor + ';background:linear-gradient(135deg,rgba(' + (isAggr ? '245,158,11' : '34,197,94') + ',0.06),transparent)" ontoggle="loanModeDetailsOpen=this.open"' + (loanModeDetailsOpen ? ' open' : '') + '>';
  h += '<summary style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:4px 0;user-select:none">';
  h += '<div style="display:flex;align-items:center;gap:10px"><i class="fas ' + modeIcon + '" style="font-size:1.4rem;color:' + modeColor + '"></i><div><div style="font-weight:800;color:#e2e8f0;font-size:1rem">\\u0420\\u0435\\u0436\\u0438\\u043c \\u043f\\u043e\\u0433\\u0430\\u0448\\u0435\\u043d\\u0438\\u044f <span style="font-size:0.72rem;padding:2px 6px;border-radius:4px;background:rgba(' + (isAggr ? '245,158,11' : '34,197,94') + ',0.15);color:' + modeColor + ';font-weight:700;margin-left:6px">' + modeLabel + '</span></div><div style="font-size:0.72rem;color:#64748b">\\u0421\\u0438\\u0441\\u0442\\u0435\\u043c\\u043d\\u0430\\u044f \\u043d\\u0430\\u0441\\u0442\\u0440\\u043e\\u0439\\u043a\\u0430 \\u0434\\u043b\\u044f \\u0432\\u0441\\u0435\\u0445 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432</div></div></div>';
  h += '<select id="loan_global_mode_select" class="input" style="max-width:180px;padding:6px 10px;font-weight:700;font-size:0.82rem;background:' + (isAggr ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)') + ';border-color:' + modeColor + ';color:' + modeColor + ';cursor:pointer" onclick="event.stopPropagation()" onchange="onLoanModeChange(this.value)">';
  h += '<option value="standard"' + (!isAggr ? ' selected' : '') + '>\\uD83D\\uDEE1\\uFE0F \\u0421\\u0442\\u0430\\u043d\\u0434\\u0430\\u0440\\u0442\\u043d\\u044b\\u0439</option>';
  h += '<option value="aggressive"' + (isAggr ? ' selected' : '') + '>\\u26A1 \\u0410\\u0433\\u0440\\u0435\\u0441\\u0441\\u0438\\u0432\\u043d\\u044b\\u0439</option>';
  h += '</select></summary>';

  // Standard mode fields
  h += '<div id="standardModeFields" style="' + (isAggr ? 'display:none;' : '') + 'padding:12px;background:rgba(34,197,94,0.04);border-radius:8px;border:1px solid rgba(34,197,94,0.15);margin-top:12px;margin-bottom:8px">';
  h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
  h += '<label style="font-size:0.78rem;color:#94a3b8;white-space:nowrap">\\u0414\\u043e\\u043f. \\u043d\\u0430\\u0433\\u0440\\u0443\\u0437\\u043a\\u0430 \\u043e\\u0442 \\u0447\\u0438\\u0441\\u0442\\u043e\\u0439 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438 (%)</label>';
  h += '<input type="number" class="input" id="loan_global_std_extra_pct" value="' + (ls.standard_extra_pct || 0) + '" step="1" min="0" max="100" style="max-width:80px;border-color:rgba(34,197,94,0.3)">';
  h += '</div>';
  if (stdExtraPct > 0 && activeLoanCount > 0) {
    var extraTotal = Math.round(netProfit * stdExtraPct / 100);
    var extraPerLoan = Math.round(extraTotal / activeLoanCount);
    h += '<div style="font-size:0.78rem;color:#94a3b8"><i class="fas fa-calculator" style="margin-right:4px;color:#22C55E"></i>';
    h += fmtAmt(netProfit) + ' \\u00d7 ' + stdExtraPct + '% = <b style="color:#22C55E">+' + fmtAmt(extraTotal) + '</b> \\u2192 <b style="color:#F59E0B">+' + fmtAmt(extraPerLoan) + '</b> \\u043d\\u0430 \\u043a\\u0430\\u0436\\u0434\\u044b\\u0439 \\u0438\\u0437 ' + activeLoanCount + ' \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432</div>';
  } else if (stdExtraPct > 0) {
    h += '<div style="font-size:0.75rem;color:#64748b">\\u041d\\u0435\\u0442 \\u0430\\u043a\\u0442\\u0438\\u0432\\u043d\\u044b\\u0445 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432 \\u0441 \\u043e\\u0441\\u0442\\u0430\\u0442\\u043a\\u043e\\u043c</div>';
  }
  h += '</div>';

  // Aggressive mode fields
  h += '<div id="aggressiveModeFields" style="' + (isAggr ? '' : 'display:none;') + 'padding:12px;background:rgba(245,158,11,0.04);border-radius:8px;border:1px solid rgba(245,158,11,0.15);margin-top:12px;margin-bottom:8px">';
  h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
  h += '<label style="font-size:0.78rem;color:#F59E0B;white-space:nowrap">\\u0414\\u043e\\u043b\\u044f \\u043e\\u0442 \\u0447\\u0438\\u0441\\u0442\\u043e\\u0439 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438 (%)</label>';
  h += '<input type="number" class="input" id="loan_global_aggr_pct" value="' + (ls.aggressive_pct || 10) + '" step="1" min="1" max="100" style="max-width:80px;border-color:rgba(245,158,11,0.3)">';
  h += '</div>';
  if (isAggr) {
    var aggrPctVal = ls.aggressive_pct || 10;
    var aggrAmount = Math.round(netProfit * aggrPctVal / 100);
    var sortedLoansPreview = (data.loans || []).slice().sort(function(a,b) { return (a.priority||10) - (b.priority||10); }).filter(function(l) { return l.is_active !== 0 && ((l.remaining_balance || 0) > 0 || (l.loan_type === 'overdraft' && (l.overdraft_used || 0) > 0)); });
    var totalMinPMT = sortedLoansPreview.reduce(function(s,l) { return s + getActPmt(l); }, 0);
    var extraBudget = Math.max(aggrAmount - totalMinPMT, 0);
    var budgetInsufficient = aggrAmount > 0 && aggrAmount < totalMinPMT;
    var coveragePct = totalMinPMT > 0 ? (Math.round(aggrAmount / totalMinPMT * 1000) / 10) : 0;

    // Compact summary line
    h += '<div style="margin-top:4px;font-size:0.78rem;color:#94a3b8"><i class="fas fa-calculator" style="margin-right:4px;color:#F59E0B"></i>';
    h += fmtAmt(netProfit) + ' \\u00d7 ' + aggrPctVal + '% = <b style="color:#F59E0B">' + fmtAmt(aggrAmount) + '</b> \\u0431\\u044e\\u0434\\u0436\\u0435\\u0442 | PMT \\u0432\\u0441\\u0435\\u0445 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432: <b>' + fmtAmt(totalMinPMT) + '</b></div>';

    // Status indicator
    if (budgetInsufficient) {
      h += '<div style="margin-top:6px;padding:6px 10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:6px;font-size:0.78rem;color:#EF4444;font-weight:600"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>\\u0411\\u044e\\u0434\\u0436\\u0435\\u0442 \\u043f\\u043e\\u043a\\u0440\\u044b\\u0432\\u0430\\u0435\\u0442 ' + coveragePct + '% \\u043e\\u0442 PMT \\u2014 \\u043e\\u0441\\u0442\\u0430\\u043b\\u044c\\u043d\\u043e\\u0435 \\u043f\\u043e \\u0433\\u0440\\u0430\\u0444\\u0438\\u043a\\u0443</div>';
    } else if (extraBudget > 0) {
      h += '<div style="margin-top:6px;padding:6px 10px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:6px;font-size:0.78rem;color:#22C55E;font-weight:600"><i class="fas fa-check-circle" style="margin-right:4px"></i>\\u0411\\u044e\\u0434\\u0436\\u0435\\u0442 > PMT \\u2192 <b>+' + fmtAmt(extraBudget) + '</b> \\u043d\\u0430 \\u0434\\u043e\\u0441\\u0440\\u043e\\u0447\\u043d\\u043e\\u0435 (70% \\u043f\\u0440\\u0438\\u043e\\u0440\\u0438\\u0442\\u0435\\u0442 / 30% \\u043e\\u0441\\u0442\\u0430\\u043b\\u044c\\u043d\\u044b\\u0435)</div>';
    } else if (netProfit <= 0) {
      h += '<div style="margin-top:6px;padding:6px 10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:6px;font-size:0.78rem;color:#EF4444;font-weight:600"><i class="fas fa-times-circle" style="margin-right:4px"></i>\\u041d\\u0435\\u0442 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438 \\u2014 \\u0431\\u044e\\u0434\\u0436\\u0435\\u0442 = 0</div>';
    }

    // Distribution table
    if (sortedLoansPreview.length > 0) {
      h += '<div style="margin-top:8px;font-size:0.75rem">';
      if (extraBudget > 0) {
        var priLoans = sortedLoansPreview.filter(function(l) { return (l.collateral_type && l.collateral_type !== 'none') || (l.priority||10) <= 5; });
        var othLoans = sortedLoansPreview.filter(function(l) { return !(l.collateral_type && l.collateral_type !== 'none') && (l.priority||10) > 5; });
        var priShare = priLoans.length > 0 ? Math.round(extraBudget * 0.7) : 0;
        var othShare = extraBudget - priShare;
        h += '<table style="width:100%;border-collapse:collapse;font-size:0.75rem">';
        h += '<tr style="border-bottom:1px solid rgba(255,255,255,0.06)"><th style="text-align:left;color:#64748b;padding:4px 0;font-weight:600">\\u041a\\u0440\\u0435\\u0434\\u0438\\u0442</th><th style="text-align:right;color:#64748b;padding:4px 0;font-weight:600">PMT</th><th style="text-align:right;color:#64748b;padding:4px 0;font-weight:600">\\u0414\\u043e\\u043f.</th><th style="text-align:right;color:#64748b;padding:4px 0;font-weight:600">\\u0418\\u0442\\u043e\\u0433\\u043e</th></tr>';
        for (var pi = 0; pi < sortedLoansPreview.length; pi++) {
          var spl = sortedLoansPreview[pi];
          var isPri = (spl.collateral_type && spl.collateral_type !== 'none') || (spl.priority||10) <= 5;
          var splExtra = 0;
          if (isPri && priLoans.length > 0) splExtra = Math.round(priShare / priLoans.length);
          else if (!isPri && othLoans.length > 0) splExtra = Math.round(othShare / othLoans.length);
          var splTotal = getActPmt(spl) + splExtra;
          var groupTag = isPri ? '<span style="color:#EF4444;font-size:0.6rem"> 70%</span>' : '<span style="color:#3B82F6;font-size:0.6rem"> 30%</span>';
          h += '<tr style="border-bottom:1px solid rgba(255,255,255,0.03)">';
          h += '<td style="padding:3px 0;color:#e2e8f0">' + escHtml(spl.name) + (spl.collateral_type && spl.collateral_type !== 'none' ? ' \\ud83d\\udee1\\ufe0f' : '') + groupTag + '</td>';
          h += '<td style="text-align:right;color:#94a3b8">' + fmtAmt(getActPmt(spl)) + '</td>';
          h += '<td style="text-align:right;color:#F59E0B;font-weight:700">+' + fmtAmt(splExtra) + '</td>';
          h += '<td style="text-align:right;color:#22C55E;font-weight:700">' + fmtAmt(splTotal) + '</td>';
          h += '</tr>';
        }
        h += '<tr style="border-top:2px solid rgba(245,158,11,0.3)"><td style="padding:4px 0;font-weight:700;color:#e2e8f0">\\u0412\\u0441\\u0435\\u0433\\u043e</td><td style="text-align:right;font-weight:700;color:#94a3b8">' + fmtAmt(totalMinPMT) + '</td><td style="text-align:right;font-weight:700;color:#F59E0B">+' + fmtAmt(extraBudget) + '</td><td style="text-align:right;font-weight:700;color:#22C55E">' + fmtAmt(totalMinPMT + extraBudget) + '</td></tr>';
        h += '</table>';
      } else if (budgetInsufficient) {
        h += '<table style="width:100%;border-collapse:collapse;font-size:0.75rem">';
        h += '<tr style="border-bottom:1px solid rgba(255,255,255,0.06)"><th style="text-align:left;color:#64748b;padding:4px 0;font-weight:600">\\u041a\\u0440\\u0435\\u0434\\u0438\\u0442</th><th style="text-align:right;color:#64748b;padding:4px 0;font-weight:600">PMT</th><th style="text-align:right;color:#64748b;padding:4px 0;font-weight:600">\\u0414\\u043e\\u043b\\u044f</th><th style="text-align:right;color:#64748b;padding:4px 0;font-weight:600">\\u041f\\u043e\\u043b\\u0443\\u0447\\u0438\\u0442</th></tr>';
        for (var di = 0; di < sortedLoansPreview.length; di++) {
          var sdl = sortedLoansPreview[di];
          var proportion = totalMinPMT > 0 ? getActPmt(sdl) / totalMinPMT : 0;
          var allocated = Math.round(aggrAmount * proportion);
          var pctOfBudget = Math.round(proportion * 100);
          h += '<tr style="border-bottom:1px solid rgba(255,255,255,0.03)">';
          h += '<td style="padding:3px 0;color:#e2e8f0">' + escHtml(sdl.name) + (sdl.collateral_type && sdl.collateral_type !== 'none' ? ' \\ud83d\\udee1\\ufe0f' : '') + '</td>';
          h += '<td style="text-align:right;color:#94a3b8">' + fmtAmt(getActPmt(sdl)) + '</td>';
          h += '<td style="text-align:right;color:#64748b">' + pctOfBudget + '%</td>';
          h += '<td style="text-align:right;color:#F59E0B;font-weight:700">' + fmtAmt(allocated) + '</td>';
          h += '</tr>';
        }
        h += '<tr style="border-top:2px solid rgba(239,68,68,0.3)"><td style="padding:4px 0;font-weight:700;color:#e2e8f0">\\u0418\\u0442\\u043e\\u0433\\u043e</td><td style="text-align:right;font-weight:700;color:#94a3b8">' + fmtAmt(totalMinPMT) + '</td><td></td><td style="text-align:right;font-weight:700;color:#F59E0B">' + fmtAmt(aggrAmount) + ' <span style="font-weight:400;font-size:0.65rem;color:#EF4444">(' + coveragePct + '% \\u043e\\u0442 PMT)</span></td></tr>';
        h += '</table>';
      } else {
        h += '<div style="color:#64748b;font-size:0.75rem">\\u041c\\u0438\\u043d\\u0438\\u043c\\u0430\\u043b\\u044c\\u043d\\u044b\\u0435 \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0438 \\u043f\\u043e \\u0433\\u0440\\u0430\\u0444\\u0438\\u043a\\u0443:</div>';
        for (var ni = 0; ni < sortedLoansPreview.length; ni++) {
          h += '<div style="color:#94a3b8;padding:2px 0;font-size:0.75rem">\\u2192 ' + escHtml(sortedLoansPreview[ni].name) + ': <b>' + fmtAmt(getActPmt(sortedLoansPreview[ni])) + '</b></div>';
        }
      }
      h += '</div>';
    }
  }
  h += '</div>';

  // Save button
  h += '<div style="display:flex;align-items:center;gap:10px;margin-top:8px">';
  h += '<button id="loanSettingsSaveBtn" class="btn btn-primary" style="padding:6px 14px;font-size:0.82rem" onclick="saveLoanSettings()"><i class="fas fa-save" style="margin-right:4px"></i>\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0438\\u0442\\u044c \\u0440\\u0435\\u0436\\u0438\\u043c</button>';
  h += '<span id="loanSettingsSavedMsg" style="display:none;font-size:0.78rem;color:#22C55E;font-weight:600"><i class="fas fa-check-circle" style="margin-right:4px"></i>\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u043e</span>';
  h += '</div>';

  // Explanation block
  h += '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:0.75rem;color:#64748b;font-weight:600"><i class="fas fa-question-circle" style="margin-right:4px;color:#8B5CF6"></i>\\u041a\\u0430\\u043a \\u0440\\u0430\\u0431\\u043e\\u0442\\u0430\\u0435\\u0442 \\u0440\\u0435\\u0436\\u0438\\u043c \\u043f\\u043e\\u0433\\u0430\\u0448\\u0435\\u043d\\u0438\\u044f?</summary>';
  h += '<div style="margin-top:6px;padding:10px;background:rgba(139,92,246,0.04);border-radius:6px;border:1px solid rgba(139,92,246,0.15);font-size:0.75rem;color:#94a3b8;line-height:1.7">';
  h += '<div style="font-weight:700;color:#a78bfa;margin-bottom:6px"><i class="fas fa-shield-alt" style="margin-right:4px;color:#22C55E"></i>\\u0421\\u0442\\u0430\\u043d\\u0434\\u0430\\u0440\\u0442\\u043d\\u044b\\u0439 \\u0440\\u0435\\u0436\\u0438\\u043c</div>';
  h += '<div>\\u041a\\u0430\\u0436\\u0434\\u044b\\u0439 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442 \\u043f\\u043b\\u0430\\u0442\\u0438\\u0442\\u0441\\u044f \\u043f\\u043e \\u0433\\u0440\\u0430\\u0444\\u0438\\u043a\\u0443 (PMT). \\u0414\\u043e\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u0435\\u043b\\u044c\\u043d\\u043e \\u0432\\u044b \\u0432\\u044b\\u0434\\u0435\\u043b\\u044f\\u0435\\u0442\\u0435 X% \\u043e\\u0442 \\u0447\\u0438\\u0441\\u0442\\u043e\\u0439 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438 \\u043d\\u0430 \\u0434\\u043e\\u0441\\u0440\\u043e\\u0447\\u043d\\u043e\\u0435 \\u043f\\u043e\\u0433\\u0430\\u0448\\u0435\\u043d\\u0438\\u0435 \\u0442\\u0435\\u043b\\u0430 \\u0434\\u043e\\u043b\\u0433\\u0430. \\u042d\\u0442\\u0430 \\u0441\\u0443\\u043c\\u043c\\u0430 <b>\\u0440\\u0430\\u0432\\u043d\\u043e\\u043c\\u0435\\u0440\\u043d\\u043e</b> \\u0440\\u0430\\u0441\\u043f\\u0440\\u0435\\u0434\\u0435\\u043b\\u044f\\u0435\\u0442\\u0441\\u044f \\u043c\\u0435\\u0436\\u0434\\u0443 \\u0432\\u0441\\u0435\\u043c\\u0438 \\u0430\\u043a\\u0442\\u0438\\u0432\\u043d\\u044b\\u043c\\u0438 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u0430\\u043c\\u0438.</div>';
  h += '<div style="font-weight:700;color:#a78bfa;margin-top:8px;margin-bottom:6px"><i class="fas fa-bolt" style="margin-right:4px;color:#F59E0B"></i>\\u0410\\u0433\\u0440\\u0435\\u0441\\u0441\\u0438\\u0432\\u043d\\u044b\\u0439 \\u0440\\u0435\\u0436\\u0438\\u043c</div>';
  h += '<div>\\u0412\\u044b \\u0432\\u044b\\u0434\\u0435\\u043b\\u044f\\u0435\\u0442\\u0435 X% \\u043e\\u0442 \\u0447\\u0438\\u0441\\u0442\\u043e\\u0439 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438 \\u043a\\u0430\\u043a \\u0435\\u0434\\u0438\\u043d\\u044b\\u0439 \\u0431\\u044e\\u0434\\u0436\\u0435\\u0442 \\u043d\\u0430 \\u0432\\u0441\\u0435 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u044b. \\u0414\\u0430\\u043b\\u0435\\u0435 3 \\u0441\\u0446\\u0435\\u043d\\u0430\\u0440\\u0438\\u044f:</div>';
  h += '<div style="padding-left:12px;margin-top:4px">';
  h += '<div><b style="color:#22C55E">\\u0411\\u044e\\u0434\\u0436\\u0435\\u0442 > PMT:</b> \\u0421\\u043d\\u0430\\u0447\\u0430\\u043b\\u0430 \\u043f\\u043e\\u043a\\u0440\\u044b\\u0432\\u0430\\u044e\\u0442\\u0441\\u044f \\u0432\\u0441\\u0435 \\u043c\\u0438\\u043d\\u0438\\u043c\\u0430\\u043b\\u044c\\u043d\\u044b\\u0435 \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0438. \\u041e\\u0441\\u0442\\u0430\\u0442\\u043e\\u043a \\u0438\\u0434\\u0451\\u0442 \\u043d\\u0430 \\u0434\\u043e\\u0441\\u0440\\u043e\\u0447\\u043d\\u043e\\u0435: <b>70%</b> \\u2014 \\u043f\\u0440\\u0438\\u043e\\u0440\\u0438\\u0442\\u0435\\u0442\\u043d\\u044b\\u043c, <b>30%</b> \\u2014 \\u043e\\u0441\\u0442\\u0430\\u043b\\u044c\\u043d\\u044b\\u043c.</div>';
  h += '<div style="margin-top:3px"><b style="color:#F59E0B">\\u0411\\u044e\\u0434\\u0436\\u0435\\u0442 < PMT:</b> \\u0414\\u0435\\u043d\\u0435\\u0433 \\u043d\\u0435 \\u0445\\u0432\\u0430\\u0442\\u0430\\u0435\\u0442 \\u0434\\u0430\\u0436\\u0435 \\u043d\\u0430 \\u043c\\u0438\\u043d\\u0438\\u043c\\u0430\\u043b\\u044c\\u043d\\u044b\\u0435 \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0438. \\u0411\\u044e\\u0434\\u0436\\u0435\\u0442 \\u0440\\u0430\\u0441\\u043f\\u0440\\u0435\\u0434\\u0435\\u043b\\u044f\\u0435\\u0442\\u0441\\u044f <b>\\u043f\\u0440\\u043e\\u043f\\u043e\\u0440\\u0446\\u0438\\u043e\\u043d\\u0430\\u043b\\u044c\\u043d\\u043e</b> \\u0440\\u0430\\u0437\\u043c\\u0435\\u0440\\u0443 PMT \\u043a\\u0430\\u0436\\u0434\\u043e\\u0433\\u043e \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u0430.</div>';
  h += '<div style="margin-top:3px"><b style="color:#EF4444">\\u041d\\u0435\\u0442 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438:</b> \\u0411\\u044e\\u0434\\u0436\\u0435\\u0442 = 0. \\u041f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0438 \\u0438\\u0434\\u0443\\u0442 \\u043f\\u043e \\u0433\\u0440\\u0430\\u0444\\u0438\\u043a\\u0443.</div>';
  h += '</div>';
  h += '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(139,92,246,0.15);color:#8B5CF6"><i class="fas fa-link" style="margin-right:4px"></i><b>\\u0421\\u0432\\u044f\\u0437\\u044c \\u0441 P&L:</b> \\u0427\\u0438\\u0441\\u0442\\u0430\\u044f \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u0431\\u0435\\u0440\\u0451\\u0442\\u0441\\u044f \\u0438\\u0437 \\u043a\\u0430\\u0441\\u043a\\u0430\\u0434\\u0430 P&L (\\u0432\\u043a\\u043b\\u0430\\u0434\\u043a\\u0430 \\u00ab\\u041a\\u0430\\u0441\\u043a\\u0430\\u0434\\u00bb). \\u0420\\u0430\\u0441\\u043f\\u0440\\u0435\\u0434\\u0435\\u043b\\u0435\\u043d\\u0438\\u0435 \\u0432\\u043b\\u0438\\u044f\\u0435\\u0442 \\u043d\\u0430 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043d\\u0443\\u044e \\u043d\\u0430\\u0433\\u0440\\u0443\\u0437\\u043a\\u0443 \\u0432 \\u043a\\u0430\\u0441\\u043a\\u0430\\u0434\\u0435, \\u0430 \\u0434\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u044b \\u0440\\u0430\\u0441\\u0441\\u0447\\u0438\\u0442\\u044b\\u0432\\u0430\\u044e\\u0442\\u0441\\u044f \\u043e\\u0442 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438 \\u043f\\u043e\\u0441\\u043b\\u0435 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432.</div>';
  h += '</div></details>';

  h += '</details>';
  // Show add form if open
  if (showPnlAddForm && pnlEditType === 'loan') {
    var editItem = pnlEditId ? (data.loans || []).find(function(l) { return l.id === pnlEditId; }) : null;
    h += renderPnlCrudForm('loan', editItem);
  }
  var loans = (data.loans || []).slice().sort(function(a,b) { return (a.priority||10) - (b.priority||10); });
  var allPayments = data.loanPayments || [];
  if (!loans.length) { h += '<div class="card" style="text-align:center;color:#64748b;padding:32px">\\u041d\\u0435\\u0442 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432</div>'; return h; }
  // Summary cards
  var totalDebt = 0; var totalMonthly = 0; var totalPrincipalAll = 0;
  for (var si = 0; si < loans.length; si++) {
    var sl = loans[si];
    if (sl.loan_type === 'overdraft') { totalDebt += (sl.overdraft_used || 0); totalMonthly += getActPmt(sl); }
    else { totalDebt += (sl.remaining_balance || 0); totalMonthly += getActPmt(sl); }
    totalPrincipalAll += (sl.principal || 0);
  }
  var netProfitV = (p && p.net_profit) || 0;
  var debtLoad = netProfitV > 0 ? Math.round(totalMonthly / netProfitV * 100) : 0;
  var revenueLoad = (p && p.revenue > 0) ? Math.round(totalMonthly / p.revenue * 100) : 0;
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:16px">';
  h += '<div class="card" style="padding:10px 14px;text-align:center"><div style="font-size:0.68rem;color:#64748b">Общий долг</div><div style="font-weight:800;color:#EF4444;font-size:1rem">' + fmtAmt(totalDebt) + '</div></div>';
  h += '<div class="card" style="padding:10px 14px;text-align:center"><div style="font-size:0.68rem;color:#64748b">Ежемес. платежи</div><div style="font-weight:800;color:#F59E0B;font-size:1rem">' + fmtAmt(totalMonthly) + '</div></div>';
  h += '<div class="card" style="padding:10px 14px;text-align:center"><div style="font-size:0.68rem;color:#64748b">Нагрузка на прибыль</div><div style="font-weight:800;color:' + (debtLoad > 50 ? '#EF4444' : debtLoad > 30 ? '#F59E0B' : '#22C55E') + ';font-size:1rem">' + debtLoad + '%</div></div>';
  h += '<div class="card" style="padding:10px 14px;text-align:center"><div style="font-size:0.68rem;color:#64748b">На выручку</div><div style="font-weight:800;color:' + (revenueLoad > 20 ? '#EF4444' : revenueLoad > 10 ? '#F59E0B' : '#22C55E') + ';font-size:1rem">' + revenueLoad + '%</div></div>';
  h += '<div class="card" style="padding:10px 14px;text-align:center"><div style="font-size:0.68rem;color:#64748b">Кредитов</div><div style="font-weight:800;color:#a78bfa;font-size:1rem">' + loans.length + '</div></div>';
  h += '</div>';
  // Pre-calculate extra load distribution — Standard: base = NET PROFIT
  var loanExtraMap = {};
  var loanExtraPctMap = {};
  var loanAggrPmtMap = {}; // aggressive mode: total target PMT per loan
  if (!isAggr && stdExtraPct > 0) {
    var activeLns = loans.filter(function(l) { return l.is_active !== 0 && ((l.remaining_balance || 0) > 0 || (l.loan_type === 'overdraft' && (l.overdraft_used || 0) > 0)); });
    var extraTotalCalc = Math.round(netProfitV * stdExtraPct / 100);
    var perLn = activeLns.length > 0 ? Math.round(extraTotalCalc / activeLns.length) : 0;
    var perLnPct = activeLns.length > 0 ? Math.round(stdExtraPct / activeLns.length * 100) / 100 : 0;
    for (var ei = 0; ei < activeLns.length; ei++) { loanExtraMap[activeLns[ei].id] = perLn; loanExtraPctMap[activeLns[ei].id] = perLnPct; }
  } else if (isAggr) {
    var aggrAmt2 = Math.round((netProfitV) * (ls.aggressive_pct||10) / 100);
    // ALL active loans including overdraft
    var allActiveLns = loans.filter(function(l) { return l.is_active !== 0 && ((l.remaining_balance||0) > 0 || (l.loan_type === 'overdraft' && (l.overdraft_used||0) > 0)); }).sort(function(a,b) { return (a.priority||10)-(b.priority||10); });
    // Compute total minimum payments for ALL loans (including overdraft)
    var totalMinPmts = allActiveLns.reduce(function(s,l) { return s + getActPmt(l); }, 0);
    var eBudget = Math.max(aggrAmt2 - totalMinPmts, 0);

    // First, set base PMT for ALL loans (including overdraft)
    for (var bi=0;bi<allActiveLns.length;bi++) { loanAggrPmtMap[allActiveLns[bi].id] = getActPmt(allActiveLns[bi]); }

    // Case 1: budget > total PMT => distribute extra on top of base PMT for ALL loans
    if (eBudget > 0) {
      var priLns = allActiveLns.filter(function(l) { return (l.collateral_type && l.collateral_type !== 'none') || (l.priority||10) <= 5; });
      var othLns = allActiveLns.filter(function(l) { return !(l.collateral_type && l.collateral_type !== 'none') && (l.priority||10) > 5; });
      var priSh = priLns.length > 0 ? Math.round(eBudget * 0.7) : 0;
      var othSh = eBudget - priSh;
      if (priLns.length > 0) {
        var pp = Math.round(priSh / priLns.length);
        var ppPct = netProfitV > 0 ? Math.round(pp / netProfitV * 10000)/100 : 0;
        for (var xi=0;xi<priLns.length;xi++) { loanExtraMap[priLns[xi].id]=pp; loanExtraPctMap[priLns[xi].id]=ppPct; loanAggrPmtMap[priLns[xi].id]=getActPmt(priLns[xi])+pp; }
      } else if (allActiveLns.length > 0) {
        // No priority loans — give 70% to first loan
        var firstExtra = Math.round(eBudget * 0.7);
        loanExtraMap[allActiveLns[0].id] = firstExtra;
        loanExtraPctMap[allActiveLns[0].id] = netProfitV > 0 ? Math.round(firstExtra / netProfitV * 10000)/100 : 0;
        loanAggrPmtMap[allActiveLns[0].id] = getActPmt(allActiveLns[0]) + firstExtra;
      }
      if (othLns.length > 0) {
        var op = Math.round(othSh / othLns.length);
        var opPct = netProfitV > 0 ? Math.round(op / netProfitV * 10000)/100 : 0;
        for (var yi=0;yi<othLns.length;yi++) { loanExtraMap[othLns[yi].id]=(loanExtraMap[othLns[yi].id]||0)+op; loanExtraPctMap[othLns[yi].id]=(loanExtraPctMap[othLns[yi].id]||0)+opPct; loanAggrPmtMap[othLns[yi].id]=getActPmt(othLns[yi])+(loanExtraMap[othLns[yi].id]||0); }
      }
    }
    // Case 2: budget < total PMT => distribute aggrAmt2 proportionally as extra ON TOP of base PMT
    // Each loan pays base PMT + proportional share of aggressive budget
    else if (aggrAmt2 > 0 && totalMinPmts > 0) {
      for (var qi=0;qi<allActiveLns.length;qi++) {
        var qBase = getActPmt(allActiveLns[qi]);
        var qProportion = qBase / totalMinPmts;
        var qExtra = Math.round(aggrAmt2 * qProportion);
        loanExtraMap[allActiveLns[qi].id] = qExtra;
        loanExtraPctMap[allActiveLns[qi].id] = netProfitV > 0 ? Math.round(qExtra / netProfitV * 10000)/100 : 0;
        loanAggrPmtMap[allActiveLns[qi].id] = qBase + qExtra;
      }
    }
    // Case 3: no profit => base PMT only, no extra.
  }
  // Type labels
  var loanTypeLabels = {annuity:'Потребительский (аннуитет)',manual:'Займ с руки',overdraft:'Овердрафт',bank:'Банковский'};
  var collateralLabels = {none:'—',real_estate:'Недвижимость',car:'Автомобиль',equipment:'Оборудование',deposit:'Депозит',other:'Другое'};
  for (var i = 0; i < loans.length; i++) {
    var l = loans[i];
    var loanPayments = allPayments.filter(function(lp) { return lp.loan_id === l.id; });
    // Filter payments for current period
    var periodStart = pnlPeriod + '-01';
    var periodEnd = pnlPeriod + '-31';
    var periodPayments = loanPayments.filter(function(lp) { return lp.payment_date >= periodStart && lp.payment_date <= periodEnd; });
    var totalPaid = loanPayments.reduce(function(s, lp) { return s + (lp.amount || 0); }, 0);
    var totalInterestPaid = loanPayments.reduce(function(s, lp) { return s + (lp.interest_part || 0); }, 0);
    var totalPrincipalPaid = loanPayments.reduce(function(s, lp) { return s + (lp.principal_part || 0); }, 0);
    var periodPaid = periodPayments.reduce(function(s, lp) { return s + (lp.amount || 0); }, 0);
    var isOD = l.loan_type === 'overdraft';
    var paidPct = isOD ? (l.overdraft_limit > 0 ? Math.round((l.overdraft_used||0) / l.overdraft_limit * 100) : 0) : (l.principal > 0 ? Math.round(totalPrincipalPaid / l.principal * 100) : 0);
    var borderColor = (l.collateral_type && l.collateral_type !== 'none') ? '#F59E0B' : '#334155';
    var extraAmt = loanExtraMap[l.id] || 0;
    var aggrTargetPmt = loanAggrPmtMap[l.id] || 0;
    h += '<div class="card" style="margin-bottom:12px;border-left:3px solid ' + borderColor + '">';
    // Header
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    h += '<div><span style="font-weight:700;color:#e2e8f0">' + escHtml(l.name) + '</span>';
    if (l.lender) h += ' <span style="color:#64748b;font-size:0.8rem">(' + escHtml(l.lender) + ')</span>';
    h += '<div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap">';
    h += '<span style="padding:2px 6px;background:#1e293b;border-radius:4px;font-size:0.65rem;color:#a78bfa">' + (loanTypeLabels[l.loan_type] || l.loan_type) + '</span>';
    if (l.collateral_type && l.collateral_type !== 'none') h += '<span style="padding:2px 6px;background:rgba(245,158,11,0.15);border-radius:4px;font-size:0.65rem;color:#F59E0B"><i class="fas fa-shield-alt" style="margin-right:2px"></i>' + (collateralLabels[l.collateral_type]||l.collateral_type) + '</span>';
    if ((l.priority||10) < 10) h += '<span style="padding:2px 6px;background:rgba(34,197,94,0.15);border-radius:4px;font-size:0.65rem;color:#22C55E">\\u041f\\u0440\\u0438\\u043e\\u0440\\u0438\\u0442\\u0435\\u0442 ' + l.priority + '</span>';
    var extraPctVal = loanExtraPctMap[l.id] || 0;
    if (!isAggr && extraAmt > 0) {
      h += '<span style="padding:2px 6px;background:rgba(245,158,11,0.2);border-radius:4px;font-size:0.65rem;color:#F59E0B;font-weight:700"><i class="fas fa-plus" style="margin-right:2px"></i>+' + fmtAmt(extraAmt) + ' (' + extraPctVal + '% \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438)</span>';
    }
    if (isAggr && aggrTargetPmt > 0) {
      var aggrColor = extraAmt > 0 ? '#F59E0B' : '#3B82F6';
      h += '<span style="padding:2px 6px;background:rgba(' + (extraAmt > 0 ? '245,158,11' : '59,130,246') + ',0.2);border-radius:4px;font-size:0.65rem;color:' + aggrColor + ';font-weight:700"><i class="fas fa-bolt" style="margin-right:2px"></i>\\u2261 ' + fmtAmt(aggrTargetPmt) + (extraAmt > 0 ? ' (+' + fmtAmt(extraAmt) + ' \\u0434\\u043e\\u043f.)' : '') + '</span>';
    }
    h += '</div></div>';
    h += '<div style="display:flex;gap:6px"><button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem" onclick="editPnlItem(&apos;loan&apos;,' + l.id + ')"><i class="fas fa-edit"></i></button><button class="tier-del-btn" onclick="deletePnlItem(&apos;loan&apos;,' + l.id + ')"><i class="fas fa-trash" style="font-size:0.6rem"></i></button></div></div>';
    if (l.notes) h += '<div style="font-size:0.72rem;color:#8B5CF6;margin-bottom:8px"><i class="fas fa-comment" style="margin-right:4px;font-size:0.6rem"></i>' + escHtml(l.notes) + '</div>';
    // === OVERDRAFT CARD ===
    if (isOD) {
      var odUsed = l.overdraft_used || 0;
      var odLimit = l.overdraft_limit || 0;
      var odAvail = odLimit - odUsed;
      var odRate = l.overdraft_rate || 0;
      var odMonthlyInt = Math.round(odUsed * odRate / 100 / 12);
      var odBankPmt = (l.bank_monthly_payment && l.bank_monthly_payment > 0) ? l.bank_monthly_payment : 0;
      var odMinPay = l.min_payment || 0;
      var odPayDay = l.payment_day || '';
      h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:10px">';
      h += '<div><div style="font-size:0.7rem;color:#64748b">Лимит</div><div style="font-weight:700;color:#e2e8f0">' + fmtAmt(odLimit) + '</div></div>';
      h += '<div><div style="font-size:0.7rem;color:#64748b">Использовано</div><div style="font-weight:700;color:#EF4444">' + fmtAmt(odUsed) + '</div></div>';
      h += '<div><div style="font-size:0.7rem;color:#64748b">Доступно</div><div style="font-weight:700;color:#22C55E">' + fmtAmt(odAvail) + '</div></div>';
      h += '<div><div style="font-size:0.7rem;color:#64748b">Ставка</div><div style="font-weight:700;color:#F59E0B">' + odRate + '%</div></div>';
      h += '<div><div style="font-size:0.7rem;color:#64748b">% в мес.</div><div style="font-weight:700;color:#F59E0B">' + fmtAmt(odMonthlyInt) + '</div></div>';
      if (odBankPmt > 0) h += '<div><div style="font-size:0.7rem;color:#64748b">Платёж по договору</div><div style="font-weight:700;color:#3B82F6">' + fmtAmt(odBankPmt) + '</div></div>';
      if (odMinPay > 0) h += '<div><div style="font-size:0.7rem;color:#64748b">Мин. платёж</div><div style="font-weight:700;color:#22C55E">' + fmtAmt(odMinPay) + '</div></div>';
      if (odPayDay) h += '<div><div style="font-size:0.7rem;color:#64748b">Дата оплаты</div><div style="font-weight:700;color:#8B5CF6">' + odPayDay + '</div></div>';
      h += '</div>';
      // Overdraft current month breakdown
      var odActualPmt = odBankPmt > 0 ? odBankPmt : odMonthlyInt;
      var odTotal = isAggr && aggrTargetPmt > 0 ? aggrTargetPmt : (odActualPmt + extraAmt);
      if (odActualPmt > 0) {
        h += '<div style="padding:8px 12px;background:rgba(59,130,246,0.06);border-radius:6px;border:1px solid rgba(59,130,246,0.15);margin-bottom:8px;font-size:0.82rem">';
        h += '<div style="font-weight:600;color:#3B82F6;margin-bottom:4px"><i class="fas fa-calendar-day" style="margin-right:4px"></i>' + loanPeriodLabel + ' — \\u043e\\u0432\\u0435\\u0440\\u0434\\u0440\\u0430\\u0444\\u0442</div>';
        h += '<div style="display:flex;gap:16px;flex-wrap:wrap">';
        if (odBankPmt > 0) {
          h += '<span style="color:#94a3b8">По договору: <b style="color:#3B82F6">' + fmtAmt(odBankPmt) + '</b></span>';
          h += '<span style="color:#94a3b8;font-size:0.75rem">(в т.ч. %: ~' + fmtAmt(odMonthlyInt) + ')</span>';
        } else {
          h += '<span style="color:#94a3b8">Проценты: <b style="color:#EF4444">' + fmtAmt(odMonthlyInt) + '</b></span>';
        }
        if (extraAmt > 0) h += '<span style="color:#F59E0B">Доп. нагрузка: <b>+' + fmtAmt(extraAmt) + '</b></span>';
        if (isAggr && aggrTargetPmt > 0) {
          h += '</div><div style="margin-top:6px;padding-top:6px;border-top:1px dashed rgba(245,158,11,0.2);display:flex;gap:16px;flex-wrap:wrap;align-items:center">';
          h += '<span style="color:#F59E0B;font-weight:700"><i class="fas fa-bolt" style="margin-right:4px"></i>\\u0426\\u0435\\u043b\\u0435\\u0432\\u043e\\u0439: <b style="font-size:1rem">' + fmtAmt(aggrTargetPmt) + '</b></span>';
          if (extraAmt > 0) h += '<span style="color:#94a3b8">(\\u041f\\u043e \\u0434\\u043e\\u0433\\u043e\\u0432\\u043e\\u0440\\u0443 ' + fmtAmt(odActualPmt) + ' + \\u0434\\u043e\\u043f. <b style="color:#F59E0B">' + fmtAmt(extraAmt) + '</b>)</span>';
        }
        h += '</div>';
        if (odPayDay) h += '<div style="margin-top:4px;font-size:0.75rem;color:#8B5CF6"><i class="fas fa-bell" style="margin-right:4px"></i>Оплатить до: ' + odPayDay + '</div>';
        h += '<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(59,130,246,0.15);display:flex;justify-content:space-between;align-items:center">';
        h += '<span style="font-weight:700;font-size:0.92rem;color:#e2e8f0"><i class="fas fa-wallet" style="margin-right:6px;color:#3B82F6"></i>\\u0418\\u0422\\u041e\\u0413\\u041e \\u043a \\u043e\\u043f\\u043b\\u0430\\u0442\\u0435:</span>';
        h += '<span style="font-weight:800;font-size:1.05rem;color:#3B82F6">' + fmtAmt(odTotal) + '</span>';
        h += '</div></div>';
      }
      if (l.start_date || l.end_date) {
        h += '<div style="font-size:0.72rem;color:#64748b;margin-bottom:6px"><i class="fas fa-calendar" style="margin-right:4px"></i>' + (l.start_date || '?') + ' \\u2192 ' + (l.end_date || '?');
        if (l.term_months) h += ' (' + l.term_months + ' мес.)';
        h += '</div>';
      }
      var odPct = odLimit > 0 ? Math.round(odUsed / odLimit * 100) : 0;
      h += '<div style="height:6px;background:#1e293b;border-radius:3px;overflow:hidden;margin-bottom:10px"><div style="width:' + Math.min(odPct, 100) + '%;height:100%;background:' + (odPct > 80 ? '#EF4444' : odPct > 50 ? '#F59E0B' : '#22C55E') + ';border-radius:3px"></div></div>';
      // Overdraft payments (expandable)
      h += '<details style="margin-top:4px"><summary style="cursor:pointer;color:#8B5CF6;font-size:0.82rem;font-weight:600"><i class="fas fa-list" style="margin-right:4px"></i>\\u041f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0438 (' + loanPayments.length + ')' + (periodPaid > 0 ? ' <span style="color:#a78bfa">' + loanPeriodLabel + ': ' + fmtAmt(periodPaid) + '</span>' : '') + (totalPaid > 0 ? ' \\u2014 ' + fmtAmt(totalPaid) + ' \\u0432\\u0441\\u0435\\u0433\\u043e' : '') + '</summary>';
      h += renderLoanPaymentsBlock(l, loanPayments, totalPrincipalPaid, totalInterestPaid, totalPaid);
      h += '</details>';
      h += '</div>';
      continue;
    }
    // === ANNUITY / MANUAL CARD ===
    // Determine actual payment: bank_monthly_payment (contract) takes priority over calculated PMT
    var actualPmt = (l.bank_monthly_payment && l.bank_monthly_payment > 0) ? l.bank_monthly_payment : (l.monthly_payment || 0);
    var monthlyInterest = Math.round((l.remaining_balance || 0) * ((l.interest_rate || 0) / 100 / 12));
    var monthlyPrincipal = Math.max(actualPmt - monthlyInterest, 0);
    if (monthlyInterest >= actualPmt) { monthlyPrincipal = 0; monthlyInterest = actualPmt; }
    // Correct months remaining calculation — based on actual payment
    var monthsRemaining = 0;
    if (actualPmt > 0 && l.remaining_balance > 0 && l.interest_rate > 0) {
      // Use logarithmic formula for accurate remaining months
      var mr = l.interest_rate / 100 / 12;
      var pmt = actualPmt;
      var bal = l.remaining_balance;
      if (pmt > bal * mr) {
        monthsRemaining = Math.ceil(-Math.log(1 - bal * mr / pmt) / Math.log(1 + mr));
      } else {
        monthsRemaining = 999; // Interest exceeds payment
      }
    } else if (actualPmt > 0 && l.remaining_balance > 0) {
      monthsRemaining = Math.ceil(l.remaining_balance / actualPmt);
    }
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:10px">';
    h += '<div><div style="font-size:0.7rem;color:#64748b">\\u0421\\u0443\\u043c\\u043c\\u0430</div><div style="font-weight:700;color:#e2e8f0">' + fmtAmt(l.principal) + '</div></div>';
    h += '<div><div style="font-size:0.7rem;color:#64748b">\\u0421\\u0442\\u0430\\u0432\\u043a\\u0430</div><div style="font-weight:700;color:#F59E0B">' + (l.interest_rate||0) + '%</div></div>';
    h += '<div><div style="font-size:0.7rem;color:#64748b">\\u041e\\u0441\\u0442\\u0430\\u0442\\u043e\\u043a</div><div style="font-weight:700;color:#EF4444">' + fmtAmt(l.remaining_balance) + '</div></div>';
    h += '<div><div style="font-size:0.7rem;color:#64748b">\\u041f\\u043e\\u0433\\u0430\\u0448\\u0435\\u043d\\u043e</div><div style="font-weight:700;color:#22C55E">' + paidPct + '%</div></div>';
    if (l.monthly_payment) h += '<div><div style="font-size:0.7rem;color:#64748b">\\u0415\\u0436\\u0435\\u043c\\u0435\\u0441.</div><div style="font-weight:700;color:#3B82F6">' + fmtAmt(l.monthly_payment) + '</div></div>';
    if (l.bank_monthly_payment && l.bank_monthly_payment !== l.monthly_payment) h += '<div><div style="font-size:0.7rem;color:#64748b">По договору</div><div style="font-weight:700;color:#64748b">' + fmtAmt(l.bank_monthly_payment) + '</div></div>';
    if (l.original_monthly_payment && l.original_monthly_payment !== l.monthly_payment) h += '<div><div style="font-size:0.7rem;color:#64748b">Оригин. PMT</div><div style="font-weight:700;color:#64748b">' + fmtAmt(l.original_monthly_payment) + '</div></div>';
    if (monthsRemaining > 0 && monthsRemaining < 999) h += '<div><div style="font-size:0.7rem;color:#64748b">Ост. мес.</div><div style="font-weight:700;color:#a78bfa">' + monthsRemaining + '</div></div>';
    if (l.payment_day) h += '<div><div style="font-size:0.7rem;color:#64748b">Дата оплаты</div><div style="font-weight:700;color:#8B5CF6">' + l.payment_day + '</div></div>';
    if (l.min_payment && l.min_payment > 0) h += '<div><div style="font-size:0.7rem;color:#64748b">Мин. платёж</div><div style="font-weight:700;color:#22C55E">' + fmtAmt(l.min_payment) + '</div></div>';
    h += '</div>';
    // Current month breakdown (highlighted)
    if (actualPmt > 0 || aggrTargetPmt > 0) {
      var breakdownBorder = isAggr ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)';
      var breakdownBg = isAggr ? 'rgba(245,158,11,0.06)' : 'rgba(59,130,246,0.06)';
      var breakdownColor = isAggr ? '#F59E0B' : '#3B82F6';
      h += '<div style="padding:8px 12px;background:' + breakdownBg + ';border-radius:6px;border:1px solid ' + breakdownBorder + ';margin-bottom:8px;font-size:0.82rem">';
      h += '<div style="font-weight:600;color:' + breakdownColor + ';margin-bottom:4px"><i class="fas fa-calendar-day" style="margin-right:4px"></i>' + loanPeriodLabel + ' — ' + (isAggr ? '\\u0430\\u0433\\u0440\\u0435\\u0441\\u0441\\u0438\\u0432\\u043d\\u044b\\u0439 \\u043f\\u043b\\u0430\\u043d' : '\\u0440\\u0430\\u0437\\u0431\\u0438\\u0432\\u043a\\u0430 \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0430') + '</div>';
      h += '<div style="display:flex;gap:16px;flex-wrap:wrap">';
      // Show PMT label: if bank_monthly_payment differs, clarify which is shown
      var pmtLabel = (l.bank_monthly_payment && l.bank_monthly_payment > 0 && l.bank_monthly_payment !== l.monthly_payment) ? '\\u041f\\u043b\\u0430\\u0442\\u0451\\u0436' : 'PMT';
      h += '<span style="color:#94a3b8">' + pmtLabel + ': <b style="color:#e2e8f0">' + fmtAmt(actualPmt) + '</b></span>';
      h += '<span style="color:#94a3b8">\\u0422\\u0435\\u043b\\u043e: <b style="color:#22C55E">' + fmtAmt(monthlyPrincipal) + '</b></span>';
      h += '<span style="color:#94a3b8">\\u041f\\u0440\\u043e\\u0446\\u0435\\u043d\\u0442: <b style="color:#EF4444">' + fmtAmt(monthlyInterest) + '</b></span>';
      if (isAggr && aggrTargetPmt > 0) {
        h += '</div><div style="margin-top:6px;padding-top:6px;border-top:1px dashed rgba(245,158,11,0.2);display:flex;gap:16px;flex-wrap:wrap;align-items:center">';
        h += '<span style="color:#F59E0B;font-weight:700"><i class="fas fa-bolt" style="margin-right:4px"></i>\\u0426\\u0435\\u043b\\u0435\\u0432\\u043e\\u0439: <b style="font-size:1rem">' + fmtAmt(aggrTargetPmt) + '</b></span>';
        if (extraAmt > 0) h += '<span style="color:#94a3b8">(' + pmtLabel + ' ' + fmtAmt(actualPmt) + ' + \\u0434\\u043e\\u043f. <b style="color:#F59E0B">' + fmtAmt(extraAmt) + '</b>)</span>';
        else if (aggrTargetPmt < actualPmt) h += '<span style="color:#EF4444;font-size:0.72rem">(\\u0431\\u044e\\u0434\\u0436\\u0435\\u0442 < ' + pmtLabel + ', \\u043f\\u0440\\u043e\\u043f\\u043e\\u0440\\u0446. ' + fmtAmt(aggrTargetPmt) + ')</span>';
      } else if (!isAggr && extraAmt > 0) {
        h += '<span style="color:#F59E0B;font-weight:700">\\u0414\\u043e\\u043f. \\u043d\\u0430\\u0433\\u0440\\u0443\\u0437\\u043a\\u0430: <b>+' + fmtAmt(extraAmt) + '</b></span>';
      }
      // === ИТОГО К ОПЛАТЕ — total monthly obligation ===
      var totalMonthlyDue = 0;
      if (isAggr && aggrTargetPmt > 0) {
        totalMonthlyDue = aggrTargetPmt;
      } else {
        totalMonthlyDue = actualPmt + extraAmt;
      }
      h += '</div>';
      h += '<div style="margin-top:6px;padding-top:6px;border-top:1px solid ' + breakdownBorder + ';display:flex;justify-content:space-between;align-items:center">';
      h += '<span style="font-weight:700;font-size:0.92rem;color:#e2e8f0"><i class="fas fa-wallet" style="margin-right:6px;color:' + breakdownColor + '"></i>\\u0418\\u0422\\u041e\\u0413\\u041e \\u043a \\u043e\\u043f\\u043b\\u0430\\u0442\\u0435:</span>';
      h += '<span style="font-weight:800;font-size:1.05rem;color:' + breakdownColor + '">' + fmtAmt(totalMonthlyDue) + '</span>';
      h += '</div>';
      // === Desired term: monthly payment needed ===
      if (l.desired_term_months && l.desired_term_months > 0 && l.remaining_balance > 0) {
        var desiredPmt = 0;
        if (l.interest_rate > 0) {
          var dMonthRate = l.interest_rate / 100 / 12;
          var dN = l.desired_term_months;
          var dBal = l.remaining_balance;
          desiredPmt = Math.ceil(dBal * dMonthRate * Math.pow(1 + dMonthRate, dN) / (Math.pow(1 + dMonthRate, dN) - 1));
        } else {
          desiredPmt = Math.ceil(l.remaining_balance / l.desired_term_months);
        }
        var desiredDiff = desiredPmt - totalMonthlyDue;
        var desiredColor = desiredDiff > 0 ? '#EF4444' : '#22C55E';
        h += '<div style="margin-top:6px;padding:6px 10px;background:rgba(168,85,247,0.08);border-radius:5px;border:1px solid rgba(168,85,247,0.2);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">';
        h += '<span style="font-size:0.78rem;color:#a78bfa"><i class="fas fa-crosshairs" style="margin-right:4px"></i>\\u0414\\u043e\\u0441\\u0440\\u043e\\u0447\\u043d\\u043e \\u0437\\u0430 ' + l.desired_term_months + ' \\u043c\\u0435\\u0441.:</span>';
        h += '<span style="font-weight:700;color:#a78bfa;font-size:0.92rem">' + fmtAmt(desiredPmt) + '/\\u043c\\u0435\\u0441</span>';
        if (desiredDiff > 0) {
          h += '<span style="font-size:0.72rem;color:' + desiredColor + '">(\\u043d\\u0443\\u0436\\u043d\\u043e \\u0435\\u0449\\u0451 +' + fmtAmt(desiredDiff) + ' \\u043a \\u0442\\u0435\\u043a\\u0443\\u0449\\u0435\\u043c\\u0443)</span>';
        } else {
          h += '<span style="font-size:0.72rem;color:' + desiredColor + '">(\\u0442\\u0435\\u043a\\u0443\\u0449\\u0438\\u0439 \\u043f\\u043b\\u0430\\u0442\\u0451\\u0436 \\u0434\\u043e\\u0441\\u0442\\u0430\\u0442\\u043e\\u0447\\u0435\\u043d \\u2714)</span>';
        }
        h += '</div>';
      }
      h += '</div>';
    }
    if (l.start_date || l.end_date) {
      h += '<div style="font-size:0.72rem;color:#64748b;margin-bottom:6px"><i class="fas fa-calendar" style="margin-right:4px"></i>' + (l.start_date || '?') + ' \\u2192 ' + (l.end_date || '?');
      if (l.term_months) h += ' (' + l.term_months + ' мес.)';
      if (l.desired_term_months && l.desired_term_months < l.term_months) h += ' <span style="color:#F59E0B">→ досрочно за ' + l.desired_term_months + ' мес.</span>';
      if (l.actual_end_date) h += ' <span style="color:#22C55E;font-weight:600"><i class="fas fa-check-circle" style="margin-right:2px"></i>Погашен: ' + l.actual_end_date + '</span>';
      h += '</div>';
    }
    if (l.collateral_desc) h += '<div style="font-size:0.72rem;color:#F59E0B;margin-bottom:6px"><i class="fas fa-shield-alt" style="margin-right:4px"></i>Залог: ' + escHtml(l.collateral_desc) + '</div>';
    // Progress bar
    h += '<div style="height:6px;background:#1e293b;border-radius:3px;overflow:hidden;margin-bottom:10px"><div style="width:' + Math.min(paidPct, 100) + '%;height:100%;background:linear-gradient(90deg,#22C55E,#10B981);border-radius:3px"></div></div>';
    // Payments linked to this loan (expandable)
    h += '<details style="margin-top:4px"><summary style="cursor:pointer;color:#8B5CF6;font-size:0.82rem;font-weight:600"><i class="fas fa-list" style="margin-right:4px"></i>\\u041f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0438 (' + loanPayments.length + ')' + (periodPaid > 0 ? ' <span style="color:#a78bfa">' + loanPeriodLabel + ': ' + fmtAmt(periodPaid) + '</span>' : '') + (totalPaid > 0 ? ' \\u2014 ' + fmtAmt(totalPaid) + ' \\u0432\\u0441\\u0435\\u0433\\u043e' : '') + '</summary>';
    h += renderLoanPaymentsBlock(l, loanPayments, totalPrincipalPaid, totalInterestPaid, totalPaid);
    h += '</details>';
    h += '</div>';
  }
  // Payment recording guide
  h += '<details style="margin-top:16px"><summary style="cursor:pointer;color:#64748b;font-size:0.85rem;font-weight:600"><i class="fas fa-question-circle" style="margin-right:6px;color:#EF4444"></i>Как записывать платежи</summary>';
  h += '<div class="card" style="margin-top:8px;font-size:0.8rem;color:#94a3b8;line-height:1.8">';
  h += '<div style="margin-bottom:12px"><b style="color:#e2e8f0">3 типа кредитов:</b></div>';
  h += '<div style="padding:6px 12px;background:rgba(139,92,246,0.06);border-radius:6px;margin-bottom:6px"><b style="color:#a78bfa">Потребительский (аннуитет)</b> — фиксированный ежемесячный платёж. Система рассчитывает PMT из суммы, ставки и срока.</div>';
  h += '<div style="padding:6px 12px;background:rgba(245,158,11,0.06);border-radius:6px;margin-bottom:6px"><b style="color:#F59E0B">Займ с руки</b> — вы сами указываете сумму, ставку, срок и ежемесячный платёж.</div>';
  h += '<div style="padding:6px 12px;background:rgba(59,130,246,0.06);border-radius:6px;margin-bottom:6px"><b style="color:#3B82F6">Овердрафт</b> — кредитная линия с лимитом, используемой суммой и ставкой.</div>';
  h += '<div style="margin-top:12px;padding:12px;background:rgba(34,197,94,0.06);border-radius:8px;border:1px solid rgba(34,197,94,0.15)">';
  h += '<b style="color:#22C55E;font-size:0.9rem">Пример записи платежа:</b><br>';
  h += 'Допустим, ваш ежемесячный платёж 50 000 ֏, из них тело 35 000, проценты 15 000.<br>';
  h += 'Если режим «Стандартный» с доп. нагрузкой 10%, то система добавляет +5 000 на тело.<br>';
  h += '<b>Записываете так:</b> Сумма = <b>55 000</b>, Осн. долг = <b>40 000</b>, Проценты = <b>15 000</b><br>';
  h += 'Где 40 000 = 35 000 (обычное тело) + 5 000 (доп. нагрузка).<br>';
  h += 'Кнопка «Автозаполнить» рассчитает базовый платёж, а доп. нагрузку добавьте вручную к телу.';
  h += '</div>';
  h += '<div style="margin-top:8px"><b style="color:#e2e8f0">Досрочное погашение:</b> при оплате сверх PMT, лишняя сумма идёт на тело долга → остаток уменьшается → срок кредита сокращается.</div>';
  h += '</div></details>';
  return h;
}
// Helper: render loan payments list + inline form (reused for overdraft + regular)
function renderLoanPaymentsBlock(l, loanPayments, totalPrincipalPaid, totalInterestPaid, totalPaid) {
  var h = '';
  if (loanPayments.length > 0) {
    h += '<div style="margin-top:8px;padding:8px;background:#0f172a;border-radius:8px;border:1px solid #334155">';
    for (var lpi = 0; lpi < loanPayments.length; lpi++) {
      var lp = loanPayments[lpi];
      h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid #1e293b22;font-size:0.82rem">';
      h += '<div><span style="color:#e2e8f0">' + (lp.payment_date || '\\u0431\\u0435\\u0437 \\u0434\\u0430\\u0442\\u044b') + '</span>';
      h += ' <span style="color:#64748b;font-size:0.72rem">(\\u043e\\u0441\\u043d: ' + fmtAmt(lp.principal_part) + ', %: ' + fmtAmt(lp.interest_part) + ')</span>';
      if (lp.is_extra) h += ' <span style="padding:1px 4px;background:rgba(245,158,11,0.15);border-radius:3px;font-size:0.6rem;color:#F59E0B">Досрочный</span>';
      if (lp.notes) h += ' <span style="color:#8B5CF6;font-size:0.68rem">' + escHtml(lp.notes) + '</span>';
      h += '</div>';
      h += '<div style="display:flex;align-items:center;gap:6px"><span style="font-weight:600;color:#F59E0B">' + fmtAmt(lp.amount) + '</span>';
      h += '<button class="btn btn-outline" style="padding:2px 6px;font-size:0.68rem" onclick="editLoanPayment(' + l.id + ',' + lp.id + ')"><i class="fas fa-edit" style="font-size:0.55rem"></i></button>';
      h += '<button class="tier-del-btn" onclick="deleteLoanPayment(' + lp.id + ')"><i class="fas fa-trash" style="font-size:0.55rem"></i></button>';
      h += '</div></div>';
    }
    h += '<div style="display:flex;justify-content:space-between;padding:6px 8px;font-size:0.78rem;font-weight:600"><span style="color:#94a3b8">\\u0418\\u0442\\u043e\\u0433\\u043e: \\u043e\\u0441\\u043d. ' + fmtAmt(totalPrincipalPaid) + ' + %: ' + fmtAmt(totalInterestPaid) + '</span><span style="color:#22C55E">' + fmtAmt(totalPaid) + '</span></div>';
    h += '</div>';
  }
  // Inline payment form
  h += '<div style="margin-top:8px;padding:10px;background:#0f172a;border-radius:8px;border:1px solid ' + (editingLoanPaymentId > 0 ? '#F59E0B' : '#334155') + '">';
  if (editingLoanPaymentId > 0) h += '<div style="font-size:0.78rem;color:#F59E0B;font-weight:600;margin-bottom:6px"><i class="fas fa-edit" style="margin-right:4px"></i>\\u0420\\u0435\\u0434\\u0430\\u043a\\u0442\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u0438\\u0435 \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0430</div>';
  h += '<div style="display:grid;grid-template-columns:120px 1fr 1fr 1fr 1fr;gap:8px;align-items:end">';
  h += '<div><label style="font-size:0.7rem;color:#64748b">\\u0422\\u0438\\u043f \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0430</label><select class="input" id="lp_paytype_' + l.id + '" style="font-size:0.78rem" onchange="toggleLoanPayFields(' + l.id + ',this.value)"><option value="both">\\u041e\\u0441\\u043d.+%</option><option value="interest_only">\\u0422\\u043e\\u043b\\u044c\\u043a\\u043e %</option><option value="principal_only">\\u0422\\u043e\\u043b\\u044c\\u043a\\u043e \\u043e\\u0441\\u043d.</option><option value="extra">Досрочный</option></select></div>';
  h += '<div><label style="font-size:0.7rem;color:#64748b">\\u0421\\u0443\\u043c\\u043c\\u0430</label><input type="number" class="input" id="lp_amount_' + l.id + '" placeholder="0"></div>';
  h += '<div id="lp_princ_wrap_' + l.id + '"><label style="font-size:0.7rem;color:#64748b">\\u041e\\u0441\\u043d. \\u0434\\u043e\\u043b\\u0433</label><input type="number" class="input" id="lp_principal_' + l.id + '" placeholder="0"></div>';
  h += '<div id="lp_int_wrap_' + l.id + '"><label style="font-size:0.7rem;color:#64748b">\\u041f\\u0440\\u043e\\u0446\\u0435\\u043d\\u0442\\u044b</label><input type="number" class="input" id="lp_interest_' + l.id + '" placeholder="0"></div>';
  h += '<div><label style="font-size:0.7rem;color:#64748b">\\u0414\\u0430\\u0442\\u0430</label><input type="date" class="input" id="lp_date_' + l.id + '" value="' + new Date().toISOString().slice(0,10) + '"></div>';
  h += '</div>';
  h += '<div style="margin-top:6px"><label style="font-size:0.7rem;color:#64748b">\\u0417\\u0430\\u043c\\u0435\\u0442\\u043a\\u0438</label><input class="input" id="lp_notes_' + l.id + '" placeholder="\\u041a\\u043e\\u043c\\u043c\\u0435\\u043d\\u0442\\u0430\\u0440\\u0438\\u0439 \\u043a \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0443" style="font-size:0.82rem"></div>';
  h += '<div style="margin-top:6px;display:flex;gap:6px">';
  h += '<button class="btn btn-primary" style="padding:6px 14px;font-size:0.82rem" onclick="saveLoanPaymentInline(' + l.id + ')"><i class="fas fa-save" style="margin-right:4px"></i>' + (editingLoanPaymentId > 0 ? '\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0438\\u0442\\u044c' : '\\u0414\\u043e\\u0431\\u0430\\u0432\\u0438\\u0442\\u044c \\u043f\\u043b\\u0430\\u0442\\u0451\\u0436') + '</button>';
  if (editingLoanPaymentId > 0) {
    h += '<button class="btn btn-outline" style="padding:6px 14px;font-size:0.82rem" onclick="cancelEditLoanPayment()"><i class="fas fa-times" style="margin-right:4px"></i>\\u041e\\u0442\\u043c\\u0435\\u043d\\u0430</button>';
  }
  if (l.monthly_payment) {
    h += '<button class="btn btn-outline" style="padding:6px 14px;font-size:0.82rem" onclick="prefillLoanPayment(' + l.id + ',' + l.monthly_payment + ',' + (l.interest_rate||0) + ',' + (l.remaining_balance||0) + ')"><i class="fas fa-magic" style="margin-right:4px"></i>\\u0410\\u0432\\u0442\\u043e\\u0437\\u0430\\u043f\\u043e\\u043b\\u043d\\u0438\\u0442\\u044c</button>';
  }
  h += '</div></div>';
  return h;
}
function prefillLoanPayment(loanId, monthlyPayment, interestRate, remainingBalance) {
  // Correct annuity schedule: early payments have more interest, less principal
  // Monthly interest = remaining_balance × (annual_rate / 12 / 100)
  var monthlyInterest = Math.round(remainingBalance * (interestRate / 100 / 12) * 100) / 100;
  var principalPart = Math.max(Math.round((monthlyPayment - monthlyInterest) * 100) / 100, 0);
  // If interest exceeds monthly payment, set principal to 0
  if (monthlyInterest >= monthlyPayment) { principalPart = 0; monthlyInterest = monthlyPayment; }
  var el1 = document.getElementById('lp_amount_' + loanId); if (el1) el1.value = Math.round(monthlyPayment * 100) / 100;
  var el2 = document.getElementById('lp_principal_' + loanId); if (el2) el2.value = principalPart;
  var el3 = document.getElementById('lp_interest_' + loanId); if (el3) el3.value = monthlyInterest;
}
async function deleteLoanPayment(paymentId) {
  if (!confirm('\\u0423\\u0434\\u0430\\u043b\\u0438\\u0442\\u044c \\u043f\\u043b\\u0430\\u0442\\u0451\\u0436?')) return;
  await api('/loan-payments/' + paymentId, { method: 'DELETE', _silent: true });
  var bulk = await api('/bulk-data', { _silent: true });
  if (bulk && !bulk.error) { data.loans = bulk.loans || []; data.loanPayments = bulk.loanPayments || []; }
  pnlData = null; loadPnlData(); toast('\\u041f\\u043b\\u0430\\u0442\\u0451\\u0436 \\u0443\\u0434\\u0430\\u043b\\u0451\\u043d');
}
async function saveLoanPaymentInline(loanId) {
  var payType = document.getElementById('lp_paytype_' + loanId)?.value || 'both';
  var amt = parseFloat(document.getElementById('lp_amount_' + loanId)?.value) || 0;
  var princ = parseFloat(document.getElementById('lp_principal_' + loanId)?.value) || 0;
  var inter = parseFloat(document.getElementById('lp_interest_' + loanId)?.value) || 0;
  var payDate = document.getElementById('lp_date_' + loanId)?.value || '';
  var notes = document.getElementById('lp_notes_' + loanId)?.value || '';
  // Payment type logic
  var isExtra = payType === 'extra';
  if (payType === 'interest_only') { princ = 0; inter = amt; }
  else if (payType === 'principal_only' || payType === 'extra') { princ = amt; inter = 0; }
  else { /* both — use entered values or auto-split */ if (princ === 0 && inter === 0 && amt > 0) { princ = amt; } }
  var d = { amount: amt, principal_part: princ, interest_part: inter, payment_date: payDate, notes: notes, is_extra: isExtra ? 1 : 0, period_key: pnlPeriod || '' };
  if (d.amount <= 0) { toast('\\u0423\\u043a\\u0430\\u0436\\u0438\\u0442\\u0435 \\u0441\\u0443\\u043c\\u043c\\u0443 \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0430', 'error'); return; }
  var isEdit = editingLoanPaymentId > 0;
  if (isEdit) {
    await api('/loan-payments/' + editingLoanPaymentId, { method: 'PUT', body: JSON.stringify(d), _silent: true });
    editingLoanPaymentId = 0;
  } else {
    await api('/loans/' + loanId + '/payments', { method: 'POST', body: JSON.stringify(d), _silent: true });
  }
  var bulk = await api('/bulk-data', { _silent: true });
  if (bulk && !bulk.error) { data.loans = bulk.loans || []; data.loanPayments = bulk.loanPayments || []; }
  pnlData = null; loadPnlData(); toast(isEdit ? '\\u041f\\u043b\\u0430\\u0442\\u0451\\u0436 \\u043e\\u0431\\u043d\\u043e\\u0432\\u043b\\u0451\\u043d' : '\\u041f\\u043b\\u0430\\u0442\\u0451\\u0436 \\u0434\\u043e\\u0431\\u0430\\u0432\\u043b\\u0435\\u043d');
}
function editLoanPayment(loanId, paymentId) {
  var pmts = data.loanPayments || [];
  var p = pmts.find(function(lp) { return lp.id === paymentId; });
  if (!p) return;
  editingLoanPaymentId = paymentId;
  setTimeout(function() {
    var el1 = document.getElementById('lp_amount_' + loanId); if (el1) el1.value = p.amount || 0;
    var el2 = document.getElementById('lp_principal_' + loanId); if (el2) el2.value = p.principal_part || 0;
    var el3 = document.getElementById('lp_interest_' + loanId); if (el3) el3.value = p.interest_part || 0;
    var el4 = document.getElementById('lp_date_' + loanId); if (el4) el4.value = p.payment_date || '';
    var el5 = document.getElementById('lp_notes_' + loanId); if (el5) el5.value = p.notes || '';
    var el6 = document.getElementById('lp_paytype_' + loanId); if (el6) { if (p.principal_part > 0 && p.interest_part > 0) el6.value = 'both'; else if (p.interest_part > 0) el6.value = 'interest_only'; else el6.value = 'principal_only'; }
  }, 50);
  render();
}
function cancelEditLoanPayment() { editingLoanPaymentId = 0; render(); }
// Switch loan type visibility
function switchLoanType(lt) {
  document.getElementById('pnl_loan_loan_type').value = lt;
  document.getElementById('loanAnnuityFields').style.display = lt !== 'overdraft' ? 'grid' : 'none';
  document.getElementById('loanOverdraftFields').style.display = lt === 'overdraft' ? 'grid' : 'none';
  document.getElementById('loanBankPMT').style.display = lt === 'annuity' ? 'grid' : 'none';
  document.getElementById('loanManualPMT').style.display = lt === 'manual' ? 'grid' : 'none';
  var payInfoEl = document.getElementById('loanPaymentInfo');
  if (payInfoEl) payInfoEl.style.display = lt !== 'overdraft' ? 'grid' : 'none';
}
// Auto-calc term from dates
function calcLoanTermFromDates() {
  var s = document.getElementById('pnl_loan_start_date')?.value;
  var e = document.getElementById('pnl_loan_end_date')?.value;
  if (s && e) {
    var sd = new Date(s); var ed = new Date(e);
    var months = (ed.getFullYear() - sd.getFullYear()) * 12 + (ed.getMonth() - sd.getMonth());
    if (months > 0) {
      var el = document.getElementById('pnl_loan_term_months');
      if (el) el.value = months;
    }
  }
}
// Auto-calc end date from start + term
function calcLoanEndFromTerm() {
  var s = document.getElementById('pnl_loan_start_date')?.value;
  var t = parseInt(document.getElementById('pnl_loan_term_months')?.value) || 0;
  if (s && t > 0) {
    var sd = new Date(s);
    sd.setMonth(sd.getMonth() + t);
    var el = document.getElementById('pnl_loan_end_date');
    if (el) el.value = sd.toISOString().slice(0, 10);
  }
}
// Auto-calc term from dates for OVERDRAFT
function calcLoanTermFromDatesOD() {
  var s = document.getElementById('pnl_loan_start_date_od')?.value;
  var e = document.getElementById('pnl_loan_end_date_od')?.value;
  if (s && e) {
    var sd = new Date(s); var ed = new Date(e);
    var months = (ed.getFullYear() - sd.getFullYear()) * 12 + (ed.getMonth() - sd.getMonth());
    if (months > 0) {
      var el = document.getElementById('pnl_loan_term_months_od');
      if (el) el.value = months;
    }
  }
}
// Save loan settings (system-wide repayment mode)
async function saveLoanSettings() {
  var btn = document.getElementById('loanSettingsSaveBtn');
  var restore = btnLoading(btn, 'Сохранение...');
  try {
    var modeEl = document.getElementById('loan_global_mode_select');
    var pctEl = document.getElementById('loan_global_aggr_pct');
    var stdEl = document.getElementById('loan_global_std_extra_pct');
    var mode = modeEl ? modeEl.value : 'standard';
    var pct = pctEl ? (parseFloat(pctEl.value) || 10) : 10;
    var stdExtraPct = stdEl ? (parseFloat(stdEl.value) || 0) : 0;
    console.log('[saveLoanSettings]', mode, pct, stdExtraPct);
    var res = await api('/loan-settings', 'PUT', { repayment_mode: mode, aggressive_pct: pct, standard_extra_pct: stdExtraPct });
    console.log('[saveLoanSettings] result:', res);
    if (!res || res.error) {
      if (restore) restore();
      toast('Ошибка сохранения: ' + (res && res.error ? res.error : 'нет ответа'), 'error');
      return;
    }
    // Immediately update local settings so UI re-renders correctly
    data.loanSettings = { repayment_mode: mode, aggressive_pct: pct, standard_extra_pct: stdExtraPct };
    // Refresh bulk data to sync loanSettings + loans list
    var bulk = await api('/bulk-data', { _silent: true });
    if (bulk && !bulk.error) {
      data.loans = bulk.loans || data.loans;
      data.loanPayments = bulk.loanPayments || data.loanPayments;
      if (bulk.loanSettings) data.loanSettings = bulk.loanSettings;
    }
    // Await loadPnlData so render happens with fresh data
    pnlData = null;
    await loadPnlData();
    // After render, show saved indicator (element re-created by render)
    toast('✅ Режим погашения сохранён');
    setTimeout(function() {
      var savedMsg = document.getElementById('loanSettingsSavedMsg');
      if (savedMsg) { savedMsg.style.display = 'inline'; setTimeout(function() { savedMsg.style.display = 'none'; }, 3000); }
    }, 100);
  } catch(e) {
    console.error('[saveLoanSettings] exception:', e);
    if (restore) restore();
    toast('Ошибка: ' + (e && e.message ? e.message : 'unknown'), 'error');
  }
}
function onLoanModeChange(mode) {
  var stdEl = document.getElementById('standardModeFields');
  var aggrEl = document.getElementById('aggressiveModeFields');
  if (stdEl) stdEl.style.display = mode === 'standard' ? '' : 'none';
  if (aggrEl) aggrEl.style.display = mode === 'aggressive' ? '' : 'none';
}
function toggleLoanPayFields(loanId, payType) {
  var pw = document.getElementById('lp_princ_wrap_' + loanId);
  var iw = document.getElementById('lp_int_wrap_' + loanId);
  if (pw) pw.style.display = payType === 'interest_only' ? 'none' : '';
  if (iw) iw.style.display = payType === 'principal_only' ? 'none' : '';
}
function calcDividendFromPct() {
  var pctEl = document.getElementById('pnl_dividend_dividend_pct');
  var amtEl = document.getElementById('pnl_dividend_amount');
  var baseEl = document.getElementById('pnl_dividend_calc_base');
  if (!pctEl || !amtEl) return;
  var pct = parseFloat(pctEl.value) || 0;
  var base = baseEl ? baseEl.value : 'after_loans';
  var netProfit = (pnlData && pnlData.net_profit) || 0;
  // Force compute: always use max(actual, plan) for loan payments
  var actualPay = Number((pnlData && pnlData.loan_total_payments_period) || 0);
  var planPay = Number((pnlData && pnlData.loan_total_monthly) || 0);
  var effPay = Number((pnlData && pnlData.effective_loan_payments) || 0);
  if (effPay === 0 && (actualPay > 0 || planPay > 0)) effPay = Math.max(actualPay, planPay);
  var profitAfterLoans = netProfit - effPay;
  var profitBase = base === 'after_loans' ? profitAfterLoans : netProfit;
  // Update info labels
  var infoEl = document.getElementById('div_calc_info');
  if (infoEl) {
    var ih = '<div style="font-size:0.78rem;color:#94a3b8;margin-bottom:4px">\\u0427\\u0438\\u0441\\u0442\\u0430\\u044f \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c (\\u043f\\u043e\\u0441\\u043b\\u0435 \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432): <b style="color:' + (netProfit >= 0 ? '#22C55E' : '#EF4444') + '">' + fmtAmt(netProfit) + '</b></div>';
    if (effPay > 0) {
      ih += '<div style="font-size:0.78rem;color:#94a3b8;margin-bottom:4px">\\u2212 \\u041a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043d\\u044b\\u0435 \\u043f\\u043b\\u0430\\u0442\\u0435\\u0436\\u0438: <b style="color:#EF4444">' + fmtAmt(effPay) + '</b></div>';
      ih += '<div style="font-size:0.78rem;color:' + (profitAfterLoans >= 0 ? '#10B981' : '#EF4444') + ';font-weight:600;margin-bottom:2px">=\\u00a0\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u043f\\u043e\\u0441\\u043b\\u0435 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432: <b>' + fmtAmt(profitAfterLoans) + '</b>' + (profitAfterLoans < 0 ? ' <span style="color:#EF4444;font-size:0.7rem"><i class="fas fa-exclamation-triangle"></i> \\u0432 \\u043c\\u0438\\u043d\\u0443\\u0441\\u0435!</span>' : '') + '</div>';
    }
    infoEl.innerHTML = ih;
  }
  // Update preview text
  var prevEl = document.getElementById('div_calc_preview');
  if (pct > 0 && profitBase > 0) {
    var calcAmt = Math.round(profitBase * pct / 100);
    amtEl.value = calcAmt;
    if (prevEl) {
      var baseLabel = base === 'after_loans' ? '\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u043f\\u043e\\u0441\\u043b\\u0435 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432' : '\\u0427\\u0438\\u0441\\u0442\\u0430\\u044f \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c';
      prevEl.innerHTML = '<i class="fas fa-check" style="margin-right:4px"></i>' + baseLabel + ': <b>' + fmtAmt(profitBase) + '</b> \\u00d7 ' + pct + '% = <b style="color:#8B5CF6">' + fmtAmt(calcAmt) + '</b>';
      prevEl.style.color = '#22C55E';
      prevEl.style.display = '';
    }
    calcDivTax();
    updateDivSchedulePreview(calcAmt);
    updateDivPayoutSummary();
  } else if (pct > 0 && profitBase <= 0) {
    amtEl.value = 0;
    if (prevEl) {
      var baseLabel2 = base === 'after_loans' ? '\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u043f\\u043e\\u0441\\u043b\\u0435 \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043e\\u0432' : '\\u0427\\u0438\\u0441\\u0442\\u0430\\u044f \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c';
      var reasonText = '';
      if (base === 'after_loans' && effPay > 0) reasonText = '. \\u041f\\u0440\\u0438\\u0447\\u0438\\u043d\\u0430: \\u043a\\u0440\\u0435\\u0434\\u0438\\u0442\\u043d\\u0430\\u044f \\u043d\\u0430\\u0433\\u0440\\u0443\\u0437\\u043a\\u0430 (' + fmtAmt(effPay) + ') \\u043f\\u0440\\u0435\\u0432\\u044b\\u0448\\u0430\\u0435\\u0442 \\u0447\\u0438\\u0441\\u0442\\u0443\\u044e \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c (' + fmtAmt(netProfit) + ')';
      else if (netProfit <= 0) reasonText = '. \\u041f\\u0440\\u0438\\u0447\\u0438\\u043d\\u0430: \\u043e\\u0442\\u0440\\u0438\\u0446\\u0430\\u0442\\u0435\\u043b\\u044c\\u043d\\u0430\\u044f \\u0447\\u0438\\u0441\\u0442\\u0430\\u044f \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c';
      prevEl.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right:4px"></i><b>\\u0414\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434 = 0</b>. ' + baseLabel2 + ': <b>' + fmtAmt(profitBase) + '</b> \\u2014 \\u0432\\u044b\\u043f\\u043b\\u0430\\u0442\\u0430 \\u043d\\u0435\\u0432\\u043e\\u0437\\u043c\\u043e\\u0436\\u043d\\u0430' + reasonText;
      prevEl.style.color = '#EF4444';
      prevEl.style.display = '';
    }
    calcDivTax();
    updateDivSchedulePreview(0);
    updateDivPayoutSummary();
  } else {
    amtEl.value = 0;
    if (prevEl) { prevEl.style.display = 'none'; }
    calcDivTax();
    updateDivSchedulePreview(0);
    updateDivPayoutSummary();
  }
}
function calcDivTax() {
  var amtEl = document.getElementById('pnl_dividend_amount');
  var taxPctEl = document.getElementById('pnl_dividend_tax_pct');
  var taxAmtEl = document.getElementById('pnl_dividend_tax_amount');
  if (!amtEl || !taxPctEl || !taxAmtEl) return;
  var amt = parseFloat(amtEl.value) || 0;
  var taxPct = parseFloat(taxPctEl.value) || 0;
  // If dividend amount is 0 or negative, tax is always 0
  if (amt <= 0) { taxAmtEl.value = 0; taxPct = 0; }
  else { taxAmtEl.value = Math.round(amt * taxPct / 100); }
  // Update payout summary
  updateDivPayoutSummary();
}
function updateDivPayoutSummary() {
  var el = document.getElementById('div_payout_summary');
  if (!el) return;
  var amtEl = document.getElementById('pnl_dividend_amount');
  var taxAmtEl = document.getElementById('pnl_dividend_tax_amount');
  var dateEl = document.getElementById('pnl_dividend_payment_date');
  var recipientEl = document.getElementById('pnl_dividend_recipient');
  var amt = amtEl ? (parseFloat(amtEl.value) || 0) : 0;
  var taxAmt = taxAmtEl ? (parseFloat(taxAmtEl.value) || 0) : 0;
  var netPayout = amt - taxAmt;
  var payDate = dateEl ? dateEl.value : '';
  var recipient = recipientEl ? recipientEl.value : '';
  if (amt <= 0) {
    el.style.display = 'block';
    el.innerHTML = '<div style="font-size:0.82rem;color:#EF4444;font-weight:600"><i class="fas fa-times-circle" style="margin-right:6px"></i>\\u0414\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434 \\u043d\\u0435 \\u043d\\u0430\\u0447\\u0438\\u0441\\u043b\\u0435\\u043d</div>' +
      '<div style="font-size:0.75rem;color:#94a3b8;margin-top:4px">\\u0421\\u0443\\u043c\\u043c\\u0430 \\u0434\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u0430 = 0. \\u041d\\u0430\\u043b\\u043e\\u0433 \\u043d\\u0430 \\u0434\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u044b: <b>0</b>. \\u0412\\u044b\\u043f\\u043b\\u0430\\u0442\\u0430 \\u043d\\u0435 \\u043f\\u0440\\u043e\\u0438\\u0437\\u0432\\u043e\\u0434\\u0438\\u0442\\u0441\\u044f.</div>';
    return;
  }
  el.style.display = 'block';
  var h3 = '<div style="font-size:0.82rem;color:#8B5CF6;font-weight:600;margin-bottom:6px"><i class="fas fa-receipt" style="margin-right:6px"></i>\\u0418\\u0442\\u043e\\u0433 \\u0432\\u044b\\u043f\\u043b\\u0430\\u0442\\u044b</div>';
  h3 += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:0.82rem">';
  h3 += '<div style="color:#94a3b8">\\u0414\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434: <b style="color:#e2e8f0">' + fmtAmt(amt) + '</b></div>';
  h3 += '<div style="color:#94a3b8">\\u041d\\u0430\\u043b\\u043e\\u0433: <b style="color:#EF4444">' + fmtAmt(taxAmt) + '</b></div>';
  h3 += '<div style="color:#94a3b8">\\u041d\\u0430 \\u0440\\u0443\\u043a\\u0438: <b style="color:#22C55E">' + fmtAmt(netPayout) + '</b></div>';
  h3 += '</div>';
  if (payDate || recipient) {
    h3 += '<div style="margin-top:6px;font-size:0.75rem;color:#64748b">';
    if (recipient) h3 += '<i class="fas fa-user" style="margin-right:4px"></i>' + escHtml(recipient) + ' ';
    if (payDate) h3 += '<i class="fas fa-calendar" style="margin-right:4px"></i>' + payDate;
    h3 += '</div>';
  }
  el.innerHTML = h3;
}
function updateDivSchedulePreview(amt) {
  var el = document.getElementById('div_schedule_preview');
  if (!el) return;
  var schedEl = document.getElementById('pnl_dividend_schedule');
  var sched = schedEl ? schedEl.value : 'monthly';
  var schedNames = {monthly:'\\u0415\\u0436\\u0435\\u043c\\u0435\\u0441\\u044f\\u0447\\u043d\\u043e',quarterly:'\\u0415\\u0436\\u0435\\u043a\\u0432\\u0430\\u0440\\u0442\\u0430\\u043b\\u044c\\u043d\\u043e',yearly:'\\u0415\\u0436\\u0435\\u0433\\u043e\\u0434\\u043d\\u043e'};
  if (amt > 0) {
    var h2 = '<div style="font-size:0.78rem;color:#8B5CF6;font-weight:600;margin-bottom:6px"><i class="fas fa-calendar-check" style="margin-right:6px"></i>\\u0413\\u0440\\u0430\\u0444\\u0438\\u043a \\u0432\\u044b\\u043f\\u043b\\u0430\\u0442 (' + schedNames[sched] + ')</div>';
    if (sched === 'monthly') h2 += '<div style="font-size:0.82rem;color:#e2e8f0">\\u041a\\u0430\\u0436\\u0434\\u044b\\u0439 \\u043c\\u0435\\u0441\\u044f\\u0446: <b style="color:#8B5CF6">' + fmtAmt(amt) + '</b> &nbsp;|&nbsp; \\u0417\\u0430 \\u0433\\u043e\\u0434: <b>' + fmtAmt(amt * 12) + '</b></div>';
    else if (sched === 'quarterly') h2 += '<div style="font-size:0.82rem;color:#e2e8f0">\\u041a\\u0430\\u0436\\u0434\\u044b\\u0439 \\u043a\\u0432\\u0430\\u0440\\u0442\\u0430\\u043b: <b style="color:#8B5CF6">' + fmtAmt(amt) + '</b> &nbsp;|&nbsp; \\u0412 \\u043c\\u0435\\u0441\\u044f\\u0446: ~<b>' + fmtAmt(Math.round(amt/3)) + '</b> &nbsp;|&nbsp; \\u0417\\u0430 \\u0433\\u043e\\u0434: <b>' + fmtAmt(amt * 4) + '</b></div>';
    else h2 += '<div style="font-size:0.82rem;color:#e2e8f0">\\u0420\\u0430\\u0437 \\u0432 \\u0433\\u043e\\u0434: <b style="color:#8B5CF6">' + fmtAmt(amt) + '</b> &nbsp;|&nbsp; \\u0412 \\u043c\\u0435\\u0441\\u044f\\u0446: ~<b>' + fmtAmt(Math.round(amt/12)) + '</b></div>';
    el.innerHTML = h2;
  } else {
    el.innerHTML = '<div style="font-size:0.78rem;color:#EF4444"><i class="fas fa-times-circle" style="margin-right:6px"></i>\\u0414\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434: <b>0</b> \\u2014 \\u043d\\u0435\\u0434\\u043e\\u0441\\u0442\\u0430\\u0442\\u043e\\u0447\\u043d\\u043e \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438 \\u0438\\u043b\\u0438 % \\u043d\\u0435 \\u0443\\u043a\\u0430\\u0437\\u0430\\u043d</div>';
  }
}

function renderPnlDividends(p) {
  var scheduleLabels = {monthly:'Ежемесячно',quarterly:'Ежеквартально',yearly:'Ежегодно'};
  var scheduleColors = {monthly:'#22C55E',quarterly:'#3B82F6',yearly:'#F59E0B'};
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
  h += '<h3 style="font-weight:700;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-money-check-alt" style="color:#8B5CF6;margin-right:8px"></i>\\u0414\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u044b</h3>';
  h += '<button class="btn btn-primary" style="padding:8px 14px;font-size:0.85rem" onclick="showPnlForm(&apos;dividend&apos;)"><i class="fas fa-plus" style="margin-right:6px"></i>\\u0414\\u043e\\u0431\\u0430\\u0432\\u0438\\u0442\\u044c</button></div>';
  if (showPnlAddForm && pnlEditType === 'dividend') {
    var editItem = pnlEditId ? (data.dividends || []).find(function(d) { return d.id === pnlEditId; }) : null;
    h += renderPnlCrudForm('dividend', editItem);
  }
  var items = (data.dividends || []).filter(function(d) { return d.period_key === pnlPeriod; });
  if (!items.length) { h += '<div class="card" style="text-align:center;color:#64748b;padding:32px">\\u041d\\u0435\\u0442 \\u0434\\u0438\\u0432\\u0438\\u0434\\u0435\\u043d\\u0434\\u043e\\u0432 \\u0437\\u0430 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434</div>'; return h; }
  h += '<div class="card" style="padding:0;overflow:hidden">';
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    var d = items[i]; var dAmt = d.amount || 0; total += dAmt + (dAmt > 0 ? (d.tax_amount || 0) : 0);
    var sch = d.schedule || 'monthly';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #1e293b">';
    h += '<div><span style="font-weight:600;color:#e2e8f0">' + escHtml(d.recipient || '\\u0412\\u043b\\u0430\\u0434\\u0435\\u043b\\u0435\\u0446') + '</span>';
    h += ' <span style="padding:2px 6px;background:rgba(' + (sch==='monthly'?'34,197,94':sch==='quarterly'?'59,130,246':'245,158,11') + ',0.15);border-radius:4px;font-size:0.65rem;color:' + (scheduleColors[sch]||'#64748b') + '">' + (scheduleLabels[sch]||sch) + '</span>';
    if (d.dividend_pct > 0) {
    var calcBaseLabel = d.calc_base === 'before_loans' ? ' \\u0434\\u043e \\u043a\\u0440\\u0435\\u0434.' : ' \\u043f\\u043e\\u0441\\u043b\\u0435 \\u043a\\u0440\\u0435\\u0434.';
    h += ' <span style="padding:2px 6px;background:rgba(34,197,94,0.15);border-radius:4px;font-size:0.65rem;color:#22C55E;font-weight:600">' + d.dividend_pct + '% \\u043e\\u0442 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438' + calcBaseLabel + '</span>';
  }
    h += '<div style="font-size:0.75rem;color:#64748b">' + (d.payment_date || '') + (d.tax_amount ? ' | \\u043d\\u0430\\u043b\\u043e\\u0433: ' + fmtAmt(d.tax_amount) : '') + '</div>';
    if (d.notes) h += '<div style="font-size:0.72rem;color:#8B5CF6;margin-top:2px"><i class="fas fa-comment" style="margin-right:4px;font-size:0.6rem"></i>' + escHtml(d.notes) + '</div>';
    h += '</div>';
    h += '<div style="display:flex;align-items:center;gap:8px"><span style="font-weight:700;color:#8B5CF6">' + fmtAmt(d.amount) + '</span>';
    h += '<button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem" onclick="editPnlItem(&apos;dividend&apos;,' + d.id + ')"><i class="fas fa-edit"></i></button>';
    h += '<button class="tier-del-btn" onclick="deletePnlItem(&apos;dividend&apos;,' + d.id + ')"><i class="fas fa-trash" style="font-size:0.6rem"></i></button></div></div>';
  }
  h += '<div style="padding:12px 16px;background:rgba(139,92,246,0.08);display:flex;justify-content:space-between"><span style="font-weight:700;color:#94a3b8">\\u0418\\u0442\\u043e\\u0433\\u043e:</span><span style="font-weight:800;color:#8B5CF6">' + fmtAmt(total) + '</span></div>';
  h += '</div>';
  return h;
}

function renderPnlOther(p) {
  var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">';
  h += '<h3 style="font-weight:700;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-exchange-alt" style="color:#10B981;margin-right:8px"></i>\\u041f\\u0440\\u043e\\u0447\\u0438\\u0435 \\u0434\\u043e\\u0445\\u043e\\u0434\\u044b / \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b</h3>';
  h += '<button class="btn btn-primary" style="padding:8px 14px;font-size:0.85rem" onclick="showPnlForm(&apos;other&apos;)"><i class="fas fa-plus" style="margin-right:6px"></i>\\u0414\\u043e\\u0431\\u0430\\u0432\\u0438\\u0442\\u044c</button></div>';
  if (showPnlAddForm && pnlEditType === 'other') {
    var editItem = pnlEditId ? (data.otherIncomeExpenses || []).find(function(o) { return o.id === pnlEditId; }) : null;
    h += renderPnlCrudForm('other', editItem);
  }
  var items = (data.otherIncomeExpenses || []).filter(function(o) { return o.period_key === pnlPeriod; });
  if (!items.length) { h += '<div class="card" style="text-align:center;color:#64748b;padding:32px">\\u041d\\u0435\\u0442 \\u0437\\u0430\\u043f\\u0438\\u0441\\u0435\\u0439</div>'; return h; }
  h += '<div class="card" style="padding:0;overflow:hidden">';
  for (var i = 0; i < items.length; i++) {
    var o = items[i]; var isIncome = o.type === 'income';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #1e293b">';
    h += '<div><span style="font-weight:600;color:#e2e8f0">' + escHtml(o.name) + '</span>';
    h += '<div style="font-size:0.75rem;color:#64748b">' + (o.date || '') + ' | ' + (isIncome ? '\\u0414\\u043e\\u0445\\u043e\\u0434' : '\\u0420\\u0430\\u0441\\u0445\\u043e\\u0434') + '</div>';
    if (o.notes) h += '<div style="font-size:0.72rem;color:#8B5CF6;margin-top:2px"><i class="fas fa-comment" style="margin-right:4px;font-size:0.6rem"></i>' + escHtml(o.notes) + '</div>';
    h += '</div>';
    h += '<div style="display:flex;align-items:center;gap:8px"><span style="font-weight:700;color:' + (isIncome ? '#22C55E' : '#EF4444') + '">' + (isIncome ? '+' : '-') + fmtAmt(o.amount) + '</span>';
    h += '<button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem" onclick="editPnlItem(&apos;other&apos;,' + o.id + ')"><i class="fas fa-edit"></i></button>';
    h += '<button class="tier-del-btn" onclick="deletePnlItem(&apos;other&apos;,' + o.id + ')"><i class="fas fa-trash" style="font-size:0.6rem"></i></button></div></div>';
  }
  h += '</div>';
  return h;
}

function renderPnlSummary(p) {
  var h = '';
  var netProfit = p.net_profit || 0;
  var effLoanPay = p.effective_loan_payments || Math.max(p.loan_total_payments_period || 0, p.loan_total_monthly || 0);
  var profitAfterLoans = (p.net_profit_after_loans !== undefined) ? p.net_profit_after_loans : (netProfit - effLoanPay);
  var totalDivs = p.total_dividends || 0;
  var retainedEarnings = (p.retained_earnings !== undefined) ? p.retained_earnings : (profitAfterLoans - totalDivs);
  var totalTaxes = p.total_taxes || 0;
  var loanMonthly = p.loan_total_monthly || 0;
  var burnRate = p.monthly_burn_rate || 0;
  var totalOpex = p.total_opex || 0;
  var salaryTotal = p.salary_total || 0;
  var marketing = p.marketing || 0;
  var depreciation = p.depreciation || 0;
  var cogs = p.cogs || 0;
  var revenue = p.revenue || 0;
  var interestExpense = p.interest_expense || 0;

  // Total outflows for the month
  var totalOutflows = cogs + totalOpex + totalTaxes + effLoanPay + totalDivs;
  var deficit = revenue - totalOutflows;

  h += '<div class="card" style="margin-bottom:16px;border-left:3px solid #8B5CF6">';
  h += '<h3 style="font-weight:800;font-size:1.1rem;color:#e2e8f0;margin-bottom:4px"><i class="fas fa-clipboard-list" style="color:#8B5CF6;margin-right:8px"></i>\\\\u0421\\\\u0432\\\\u043e\\\\u0434\\\\u043a\\\\u0430 \\\\u0437\\\\u0430 \\\\u043c\\\\u0435\\\\u0441\\\\u044f\\\\u0446</h3>';
  h += '<div style="font-size:0.78rem;color:#64748b;margin-bottom:16px">\\\\u0412\\\\u0441\\\\u0435 \\\\u043e\\\\u0431\\\\u044f\\\\u0437\\\\u0430\\\\u0442\\\\u0435\\\\u043b\\\\u044c\\\\u043d\\\\u044b\\\\u0435 \\\\u043f\\\\u043b\\\\u0430\\\\u0442\\\\u0435\\\\u0436\\\\u0438 \\\\u0438 \\\\u0440\\\\u0430\\\\u0441\\\\u0445\\\\u043e\\\\u0434\\\\u044b \\\\u0432 \\\\u043e\\\\u0434\\\\u043d\\\\u043e\\\\u043c \\\\u043c\\\\u0435\\\\u0441\\\\u0442\\\\u0435</div>';

  // === INCOME ===
  h += '<div style="margin-bottom:12px;padding:10px 14px;background:rgba(34,197,94,0.06);border-radius:8px;border:1px solid rgba(34,197,94,0.15)">';
  h += '<div style="font-size:0.82rem;color:#22C55E;font-weight:700;margin-bottom:8px"><i class="fas fa-arrow-down" style="margin-right:6px"></i>\\\\u041f\\\\u041e\\\\u0421\\\\u0422\\\\u0423\\\\u041f\\\\u041b\\\\u0415\\\\u041d\\\\u0418\\\\u042f</div>';
  h += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.85rem"><span style="color:#94a3b8">\\\\u0412\\\\u044b\\\\u0440\\\\u0443\\\\u0447\\\\u043a\\\\u0430</span><span style="color:#22C55E;font-weight:700">' + fmtAmt(revenue) + '</span></div>';
  if ((p.commissions_total || 0) > 0) {
    h += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.85rem"><span style="color:#94a3b8"><i class="fas fa-credit-card" style="margin-right:6px;color:#3B82F6;font-size:0.7rem"></i>\\\\u041a\\\\u043e\\\\u043c\\\\u0438\\\\u0441\\\\u0441\\\\u0438\\\\u0438 (\\\\u043e\\\\u043f\\\\u043b. \\\\u043a\\\\u043b\\\\u0438\\\\u0435\\\\u043d\\\\u0442\\\\u043e\\\\u043c)</span><span style="color:#3B82F6;font-weight:700">+' + fmtAmt(p.commissions_total) + '</span></div>';
  }
  if (p.other_income > 0) {
    h += '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.85rem"><span style="color:#94a3b8">\\\\u041f\\\\u0440\\\\u043e\\\\u0447\\\\u0438\\\\u0435 \\\\u0434\\\\u043e\\\\u0445\\\\u043e\\\\u0434\\\\u044b</span><span style="color:#22C55E;font-weight:700">' + fmtAmt(p.other_income) + '</span></div>';
  }
  h += '</div>';

  // === OUTFLOWS TABLE ===
  h += '<div style="margin-bottom:12px">';
  h += '<div style="font-size:0.82rem;color:#EF4444;font-weight:700;margin-bottom:8px;padding:0 14px"><i class="fas fa-arrow-up" style="margin-right:6px"></i>\\\\u041e\\\\u0411\\\\u042f\\\\u0417\\\\u0410\\\\u0422\\\\u0415\\\\u041b\\\\u042c\\\\u041d\\\\u042b\\\\u0415 \\\\u041f\\\\u041b\\\\u0410\\\\u0422\\\\u0415\\\\u0416\\\\u0418</div>';

  // Table header
  h += '<div style="display:grid;grid-template-columns:2fr 1fr 80px;padding:6px 14px;font-size:0.72rem;color:#475569;border-bottom:1px solid #1e293b;font-weight:600">';
  h += '<span>\\\\u041a\\\\u0430\\\\u0442\\\\u0435\\\\u0433\\\\u043e\\\\u0440\\\\u0438\\\\u044f</span><span style="text-align:right">\\\\u0421\\\\u0443\\\\u043c\\\\u043c\\\\u0430</span><span style="text-align:right">% \\\\u043e\\\\u0442 \\\\u0432\\\\u044b\\\\u0440.</span></div>';

  // Helper for rows
  var summaryRows = [];
  if (cogs > 0) summaryRows.push({icon:'fa-truck',color:'#F59E0B',label:'\\\\u0421\\\\u0435\\\\u0431\\\\u0435\\\\u0441\\\\u0442\\\\u043e\\\\u0438\\\\u043c\\\\u043e\\\\u0441\\\\u0442\\\\u044c (COGS)',amount:cogs});
  if (salaryTotal > 0) summaryRows.push({icon:'fa-users',color:'#3B82F6',label:'\\\\u0417\\\\u0430\\\\u0440\\\\u043f\\\\u043b\\\\u0430\\\\u0442\\\\u044b',amount:salaryTotal});
  if (marketing > 0) summaryRows.push({icon:'fa-bullhorn',color:'#F59E0B',label:'\\\\u041c\\\\u0430\\\\u0440\\\\u043a\\\\u0435\\\\u0442\\\\u0438\\\\u043d\\\\u0433',amount:marketing});
  if (depreciation > 0) summaryRows.push({icon:'fa-building',color:'#8B5CF6',label:'\\\\u0410\\\\u043c\\\\u043e\\\\u0440\\\\u0442\\\\u0438\\\\u0437\\\\u0430\\\\u0446\\\\u0438\\\\u044f',amount:depreciation});
  if (totalTaxes > 0) summaryRows.push({icon:'fa-landmark',color:'#EF4444',label:'\\\\u041d\\\\u0430\\\\u043b\\\\u043e\\\\u0433\\\\u0438',amount:totalTaxes});
  if (interestExpense > 0) summaryRows.push({icon:'fa-percent',color:'#F59E0B',label:'\\\\u041f\\\\u0440\\\\u043e\\\\u0446\\\\u0435\\\\u043d\\\\u0442\\\\u044b \\\\u043f\\\\u043e \\\\u043a\\\\u0440\\\\u0435\\\\u0434\\\\u0438\\\\u0442\\\\u0430\\\\u043c',amount:interestExpense});
  if (loanMonthly > 0) summaryRows.push({icon:'fa-hand-holding-usd',color:'#EF4444',label:'\\\\u041a\\\\u0440\\\\u0435\\\\u0434\\\\u0438\\\\u0442\\\\u044b (\\\\u043f\\\\u043b\\\\u0430\\\\u043d. \\\\u043f\\\\u043b\\\\u0430\\\\u0442\\\\u0435\\\\u0436\\\\u0438)',amount:loanMonthly});
  if (totalDivs > 0) summaryRows.push({icon:'fa-money-check-alt',color:'#8B5CF6',label:'\\\\u0414\\\\u0438\\\\u0432\\\\u0438\\\\u0434\\\\u0435\\\\u043d\\\\u0434\\\\u044b',amount:totalDivs});
  if ((p.other_expenses||0) > 0) summaryRows.push({icon:'fa-exchange-alt',color:'#94a3b8',label:'\\\\u041f\\\\u0440\\\\u043e\\\\u0447\\\\u0438\\\\u0435 \\\\u0440\\\\u0430\\\\u0441\\\\u0445\\\\u043e\\\\u0434\\\\u044b',amount:p.other_expenses});

  for (var si = 0; si < summaryRows.length; si++) {
    var sr = summaryRows[si];
    var revPct = revenue > 0 ? (Math.round(sr.amount / revenue * 1000) / 10) : 0;
    h += '<div style="display:grid;grid-template-columns:2fr 1fr 80px;padding:8px 14px;border-bottom:1px solid #0f172a;font-size:0.85rem;align-items:center">';
    h += '<span style="color:#e2e8f0"><i class="fas ' + sr.icon + '" style="color:' + sr.color + ';margin-right:8px;width:14px;text-align:center"></i>' + sr.label + '</span>';
    h += '<span style="text-align:right;color:#EF4444;font-weight:600">' + fmtAmt(sr.amount) + '</span>';
    h += '<span style="text-align:right;color:#64748b;font-size:0.78rem">' + revPct + '%</span>';
    h += '</div>';
  }

  // Total row
  h += '<div style="display:grid;grid-template-columns:2fr 1fr 80px;padding:10px 14px;background:rgba(239,68,68,0.08);font-size:0.9rem;font-weight:700;align-items:center;border-top:2px solid #EF4444">';
  h += '<span style="color:#EF4444"><i class="fas fa-calculator" style="margin-right:8px"></i>\\\\u0418\\\\u0422\\\\u041e\\\\u0413\\\\u041e \\\\u0420\\\\u0410\\\\u0421\\\\u0425\\\\u041e\\\\u0414\\\\u042b</span>';
  h += '<span style="text-align:right;color:#EF4444">' + fmtAmt(totalOutflows) + '</span>';
  h += '<span style="text-align:right;color:#64748b;font-size:0.78rem">' + (revenue > 0 ? (Math.round(totalOutflows / revenue * 1000) / 10) : 0) + '%</span>';
  h += '</div></div>';

  // === BALANCE / DEFICIT ===
  h += '<div style="padding:14px;border-radius:8px;background:' + (deficit >= 0 ? 'rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2)') + ';margin-bottom:16px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center">';
  h += '<div><div style="font-size:0.82rem;color:' + (deficit >= 0 ? '#22C55E' : '#EF4444') + ';font-weight:700"><i class="fas ' + (deficit >= 0 ? 'fa-check-circle' : 'fa-exclamation-triangle') + '" style="margin-right:6px"></i>' + (deficit >= 0 ? '\\\\u0412\\\\u044b\\\\u0440\\\\u0443\\\\u0447\\\\u043a\\\\u0438 \\\\u0445\\\\u0432\\\\u0430\\\\u0442\\\\u0430\\\\u0435\\\\u0442' : '\\\\u0414\\\\u0415\\\\u0424\\\\u0418\\\\u0426\\\\u0418\\\\u0422 \\\\u0421\\\\u0420\\\\u0415\\\\u0414\\\\u0421\\\\u0422\\\\u0412') + '</div>';
  h += '<div style="font-size:0.72rem;color:#64748b;margin-top:2px">' + fmtAmt(revenue) + ' \\\\u2212 ' + fmtAmt(totalOutflows) + '</div></div>';
  h += '<div style="font-size:1.4rem;font-weight:800;color:' + (deficit >= 0 ? '#22C55E' : '#EF4444') + '">' + (deficit >= 0 ? '+' : '') + fmtAmt(deficit) + '</div>';
  h += '</div></div>';

  // === KEY METRICS GRID ===
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px">';

  var summaryMetrics = [
    {label:'\\\\u0427\\\\u0438\\\\u0441\\\\u0442\\\\u0430\\\\u044f \\\\u043f\\\\u0440\\\\u0438\\\\u0431\\\\u044b\\\\u043b\\\\u044c',val:fmtAmt(netProfit),color:netProfit>=0?'#22C55E':'#EF4444',icon:'fa-trophy',desc:'\\\\u041f\\\\u043e\\\\u0441\\\\u043b\\\\u0435 \\\\u043d\\\\u0430\\\\u043b\\\\u043e\\\\u0433\\\\u043e\\\\u0432'},
    {label:'\\\\u041f\\\\u043e\\\\u0441\\\\u043b\\\\u0435 \\\\u043a\\\\u0440\\\\u0435\\\\u0434\\\\u0438\\\\u0442\\\\u043e\\\\u0432',val:fmtAmt(profitAfterLoans),color:profitAfterLoans>=0?'#10B981':'#EF4444',icon:'fa-wallet',desc:'\\\\u0427\\\\u0438\\\\u0441\\\\u0442\\\\u0430\\\\u044f \\\\u2212 \\\\u043a\\\\u0440\\\\u0435\\\\u0434\\\\u0438\\\\u0442\\\\u044b'},
    {label:'\\\\u041d\\\\u0435\\\\u0440\\\\u0430\\\\u0441\\\\u043f\\\\u0440\\\\u0435\\\\u0434.',val:fmtAmt(retainedEarnings),color:retainedEarnings>=0?'#10B981':'#EF4444',icon:'fa-piggy-bank',desc:'\\\\u041f\\\\u043e\\\\u0441\\\\u043b\\\\u0435 \\\\u0434\\\\u0438\\\\u0432\\\\u0438\\\\u0434\\\\u0435\\\\u043d\\\\u0434\\\\u043e\\\\u0432'},
    {label:'Burn Rate',val:fmtAmt(burnRate),color:'#EF4444',icon:'fa-fire',desc:'OPEX + \\\\u041d\\\\u0430\\\\u043b\\\\u043e\\\\u0433\\\\u0438 + %'}
  ];

  for (var mi = 0; mi < summaryMetrics.length; mi++) {
    var sm = summaryMetrics[mi];
    h += '<div class="card" style="padding:12px;background:rgba(' + (sm.color === '#EF4444' ? '239,68,68' : sm.color === '#22C55E' ? '34,197,94' : sm.color === '#10B981' ? '16,185,129' : '139,92,246') + ',0.06);border-color:' + sm.color + '33">';
    h += '<div style="font-size:0.72rem;color:#64748b;margin-bottom:2px"><i class="fas ' + sm.icon + '" style="color:' + sm.color + ';margin-right:4px"></i>' + sm.label + '</div>';
    h += '<div style="font-size:1.1rem;font-weight:800;color:' + sm.color + '">' + sm.val + '</div>';
    h += '<div style="font-size:0.68rem;color:#475569">' + sm.desc + '</div></div>';
  }
  h += '</div>';

  // === LOAN BREAKDOWN (if loans exist) ===
  // Include ALL loans: standard + overdraft (if overdraft has used amount)
  var activeLoans = (data.loans || []).filter(function(l) {
    if (!l.is_active || l.is_active === 0) return false;
    if (l.loan_type === 'overdraft') return (l.overdraft_used || 0) > 0;
    return (l.remaining_balance || 0) > 0;
  });
  if (activeLoans.length > 0) {
    h += '<div style="margin-bottom:12px;padding:10px 14px;background:rgba(239,68,68,0.04);border-radius:8px;border:1px solid rgba(239,68,68,0.1)">';
    h += '<div style="font-size:0.82rem;color:#EF4444;font-weight:700;margin-bottom:8px"><i class="fas fa-hand-holding-usd" style="margin-right:6px"></i>\\\\u0414\\\\u0435\\\\u0442\\\\u0430\\\\u043b\\\\u0438\\\\u0437\\\\u0430\\\\u0446\\\\u0438\\\\u044f \\\\u043a\\\\u0440\\\\u0435\\\\u0434\\\\u0438\\\\u0442\\\\u043e\\\\u0432 (' + activeLoans.length + ')</div>';
    for (var li = 0; li < activeLoans.length; li++) {
      var loan = activeLoans[li];
      // Use bank_monthly_payment when available (consistent with getActPmt in loans tab)
      var pmt = (loan.bank_monthly_payment && loan.bank_monthly_payment > 0) ? loan.bank_monthly_payment : (loan.monthly_payment || 0);
      var remaining = loan.loan_type === 'overdraft' ? (loan.overdraft_used || 0) : (loan.remaining_balance || 0);
      var loanTypeTag = loan.loan_type === 'overdraft' ? ' <span style="color:#F59E0B;font-size:0.68rem;font-weight:600">[\\\\u041e\\\\u0414]</span>' : '';
      h += '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.82rem;border-bottom:1px solid #0f172a">';
      h += '<span style="color:#e2e8f0">' + escHtml(loan.name) + loanTypeTag + ' <span style="color:#475569;font-size:0.7rem">(' + fmtAmt(remaining) + ' \\\\u043e\\\\u0441\\\\u0442.)</span></span>';
      h += '<span style="color:#EF4444;font-weight:600">' + fmtAmt(pmt) + '/\\\\u043c\\\\u0435\\\\u0441</span></div>';
    }
    h += '</div>';
  }

  // === TAX BREAKDOWN (if taxes exist) ===
  // Use human-readable tax type labels (consistent with P&L cascade)
  var summaryTaxLabels = {income_tax:'\\\\u041d\\\\u0430\\\\u043b\\\\u043e\\\\u0433 \\\\u043d\\\\u0430 \\\\u043f\\\\u0440\\\\u0438\\\\u0431\\\\u044b\\\\u043b\\\\u044c',vat:'\\\\u041d\\\\u0414\\\\u0421',usn_income:'\\\\u0423\\\\u0421\\\\u041d \\\\u0414\\\\u043e\\\\u0445\\\\u043e\\\\u0434\\\\u044b',usn_income_expense:'\\\\u0423\\\\u0421\\\\u041d \\\\u0414\\\\u043e\\\\u0445.\\\\u2212\\\\u0420\\\\u0430\\\\u0441\\\\u0445.',turnover_tax:'\\\\u041d\\\\u0430\\\\u043b\\\\u043e\\\\u0433 \\\\u043d\\\\u0430 \\\\u043e\\\\u0431\\\\u043e\\\\u0440\\\\u043e\\\\u0442',payroll_tax:'\\\\u041d\\\\u0430\\\\u043b\\\\u043e\\\\u0433\\\\u0438 \\\\u043d\\\\u0430 \\\\u0417\\\\u041f',patent:'\\\\u041f\\\\u0430\\\\u0442\\\\u0435\\\\u043d\\\\u0442',property:'\\\\u041d\\\\u0430\\\\u043b\\\\u043e\\\\u0433 \\\\u043d\\\\u0430 \\\\u0438\\\\u043c\\\\u0443\\\\u0449\\\\u0435\\\\u0441\\\\u0442\\\\u0432\\\\u043e',other:'\\\\u041f\\\\u0440\\\\u043e\\\\u0447\\\\u0435\\\\u0435'};
  var taxItems = (p.taxes || []).filter(function(t) { return (t.amount || 0) > 0; });
  if (taxItems.length > 0) {
    h += '<div style="margin-bottom:12px;padding:10px 14px;background:rgba(245,158,11,0.04);border-radius:8px;border:1px solid rgba(245,158,11,0.1)">';
    h += '<div style="font-size:0.82rem;color:#F59E0B;font-weight:700;margin-bottom:8px"><i class="fas fa-landmark" style="margin-right:6px"></i>\\\\u0414\\\\u0435\\\\u0442\\\\u0430\\\\u043b\\\\u0438\\\\u0437\\\\u0430\\\\u0446\\\\u0438\\\\u044f \\\\u043d\\\\u0430\\\\u043b\\\\u043e\\\\u0433\\\\u043e\\\\u0432 (' + taxItems.length + ')</div>';
    for (var ti = 0; ti < taxItems.length; ti++) {
      var tx = taxItems[ti];
      // Show human-readable name: prefer tax_name from DB, then mapped label, then raw type
      var txDisplayName = tx.tax_name || tx.name || summaryTaxLabels[tx.tax_type] || tx.tax_type || '\\\\u041d\\\\u0430\\\\u043b\\\\u043e\\\\u0433';
      if (tx.is_auto && tx.tax_rate) txDisplayName += ' [' + tx.tax_rate + '%]';
      h += '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.82rem;border-bottom:1px solid #0f172a">';
      h += '<span style="color:#e2e8f0">' + escHtml(txDisplayName) + '</span>';
      h += '<span style="color:#F59E0B;font-weight:600">' + fmtAmt(tx.amount) + '</span></div>';
    }
    h += '</div>';
  }

  // === EXPLANATION ===
  h += '<details style="margin-top:12px"><summary style="cursor:pointer;color:#64748b;font-size:0.82rem;font-weight:600"><i class="fas fa-info-circle" style="margin-right:6px;color:#8B5CF6"></i>\\\\u041a\\\\u0430\\\\u043a \\\\u0447\\\\u0438\\\\u0442\\\\u0430\\\\u0442\\\\u044c \\\\u0441\\\\u0432\\\\u043e\\\\u0434\\\\u043a\\\\u0443</summary>';
  h += '<div class="card" style="margin-top:8px;font-size:0.78rem;color:#94a3b8;line-height:1.8">';
  h += '<div><b style="color:#22C55E">\\\\u041f\\\\u043e\\\\u0441\\\\u0442\\\\u0443\\\\u043f\\\\u043b\\\\u0435\\\\u043d\\\\u0438\\\\u044f</b> \\\\u2014 \\\\u0432\\\\u0441\\\\u0435 \\\\u0434\\\\u0435\\\\u043d\\\\u044c\\\\u0433\\\\u0438, \\\\u043a\\\\u043e\\\\u0442\\\\u043e\\\\u0440\\\\u044b\\\\u0435 \\\\u043f\\\\u0440\\\\u0438\\\\u0445\\\\u043e\\\\u0434\\\\u044f\\\\u0442 \\\\u0432 \\\\u0431\\\\u0438\\\\u0437\\\\u043d\\\\u0435\\\\u0441 (\\\\u0432\\\\u044b\\\\u0440\\\\u0443\\\\u0447\\\\u043a\\\\u0430 + \\\\u043f\\\\u0440\\\\u043e\\\\u0447\\\\u0438\\\\u0435 \\\\u0434\\\\u043e\\\\u0445\\\\u043e\\\\u0434\\\\u044b)</div>';
  h += '<div><b style="color:#EF4444">\\\\u041e\\\\u0431\\\\u044f\\\\u0437\\\\u0430\\\\u0442\\\\u0435\\\\u043b\\\\u044c\\\\u043d\\\\u044b\\\\u0435 \\\\u043f\\\\u043b\\\\u0430\\\\u0442\\\\u0435\\\\u0436\\\\u0438</b> \\\\u2014 \\\\u0432\\\\u0441\\\\u0435 \\\\u0440\\\\u0430\\\\u0441\\\\u0445\\\\u043e\\\\u0434\\\\u044b, \\\\u043a\\\\u043e\\\\u0442\\\\u043e\\\\u0440\\\\u044b\\\\u0435 \\\\u043d\\\\u0443\\\\u0436\\\\u043d\\\\u043e \\\\u043e\\\\u043f\\\\u043b\\\\u0430\\\\u0442\\\\u0438\\\\u0442\\\\u044c \\\\u0432 \\\\u044d\\\\u0442\\\\u043e\\\\u043c \\\\u043c\\\\u0435\\\\u0441\\\\u044f\\\\u0446\\\\u0435: \\\\u0441\\\\u0435\\\\u0431\\\\u0435\\\\u0441\\\\u0442\\\\u043e\\\\u0438\\\\u043c\\\\u043e\\\\u0441\\\\u0442\\\\u044c, \\\\u0437\\\\u0430\\\\u0440\\\\u043f\\\\u043b\\\\u0430\\\\u0442\\\\u044b, \\\\u043c\\\\u0430\\\\u0440\\\\u043a\\\\u0435\\\\u0442\\\\u0438\\\\u043d\\\\u0433, \\\\u043d\\\\u0430\\\\u043b\\\\u043e\\\\u0433\\\\u0438, \\\\u043a\\\\u0440\\\\u0435\\\\u0434\\\\u0438\\\\u0442\\\\u044b, \\\\u0434\\\\u0438\\\\u0432\\\\u0438\\\\u0434\\\\u0435\\\\u043d\\\\u0434\\\\u044b</div>';
  h += '<div><b style="color:#8B5CF6">\\\\u0411\\\\u0430\\\\u043b\\\\u0430\\\\u043d\\\\u0441</b> \\\\u2014 \\\\u0440\\\\u0430\\\\u0437\\\\u043d\\\\u0438\\\\u0446\\\\u0430 \\\\u043c\\\\u0435\\\\u0436\\\\u0434\\\\u0443 \\\\u043f\\\\u043e\\\\u0441\\\\u0442\\\\u0443\\\\u043f\\\\u043b\\\\u0435\\\\u043d\\\\u0438\\\\u044f\\\\u043c\\\\u0438 \\\\u0438 \\\\u0440\\\\u0430\\\\u0441\\\\u0445\\\\u043e\\\\u0434\\\\u0430\\\\u043c\\\\u0438. \\\\u0415\\\\u0441\\\\u043b\\\\u0438 \\\\u043e\\\\u0442\\\\u0440\\\\u0438\\\\u0446\\\\u0430\\\\u0442\\\\u0435\\\\u043b\\\\u044c\\\\u043d\\\\u044b\\\\u0439 \\\\u2014 \\\\u0432\\\\u044b\\\\u0440\\\\u0443\\\\u0447\\\\u043a\\\\u0438 \\\\u043d\\\\u0435 \\\\u0445\\\\u0432\\\\u0430\\\\u0442\\\\u0430\\\\u0435\\\\u0442 \\\\u043d\\\\u0430 \\\\u043f\\\\u043e\\\\u043a\\\\u0440\\\\u044b\\\\u0442\\\\u0438\\\\u0435 \\\\u0432\\\\u0441\\\\u0435\\\\u0445 \\\\u043e\\\\u0431\\\\u044f\\\\u0437\\\\u0430\\\\u0442\\\\u0435\\\\u043b\\\\u044c\\\\u0441\\\\u0442\\\\u0432</div>';
  h += '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #334155"><b style="color:#F59E0B">\\\\u0412\\\\u0430\\\\u0436\\\\u043d\\\\u043e:</b> \\\\u041a\\\\u0440\\\\u0435\\\\u0434\\\\u0438\\\\u0442\\\\u044b \\\\u0432 \\\\u0442\\\\u0430\\\\u0431\\\\u043b\\\\u0438\\\\u0446\\\\u0435 \\\\u2014 \\\\u044d\\\\u0442\\\\u043e \\\\u043f\\\\u043b\\\\u0430\\\\u043d\\\\u043e\\\\u0432\\\\u044b\\\\u0435 \\\\u043f\\\\u043b\\\\u0430\\\\u0442\\\\u0435\\\\u0436\\\\u0438 (\\\\u0438\\\\u0437 \\\\u0434\\\\u043e\\\\u0433\\\\u043e\\\\u0432\\\\u043e\\\\u0440\\\\u0430). \\\\u0424\\\\u0430\\\\u043a\\\\u0442\\\\u0438\\\\u0447\\\\u0435\\\\u0441\\\\u043a\\\\u0438\\\\u0435 \\\\u043c\\\\u043e\\\\u0433\\\\u0443\\\\u0442 \\\\u043e\\\\u0442\\\\u043b\\\\u0438\\\\u0447\\\\u0430\\\\u0442\\\\u044c\\\\u0441\\\\u044f. \\\\u0414\\\\u0430\\\\u043d\\\\u043d\\\\u044b\\\\u0435 \\\\u0442\\\\u044f\\\\u043d\\\\u0443\\\\u0442\\\\u0441\\\\u044f \\\\u0438\\\\u0437 \\\\u0432\\\\u043a\\\\u043b\\\\u0430\\\\u0434\\\\u043e\\\\u043a: \\\\u041a\\\\u0430\\\\u0441\\\\u043a\\\\u0430\\\\u0434, \\\\u041d\\\\u0430\\\\u043b\\\\u043e\\\\u0433\\\\u0438, \\\\u041a\\\\u0440\\\\u0435\\\\u0434\\\\u0438\\\\u0442\\\\u044b, \\\\u0414\\\\u0438\\\\u0432\\\\u0438\\\\u0434\\\\u0435\\\\u043d\\\\u0434\\\\u044b.</div>';
  h += '</div></details>';

  h += '</div>';
  return h;
}

function renderPnlScenario(p) {
  var h = '<div class="card" style="margin-bottom:16px">';
  h += '<h3 style="font-weight:700;font-size:1.1rem;color:#e2e8f0;margin-bottom:16px"><i class="fas fa-flask" style="color:#8B5CF6;margin-right:8px"></i>\\u0421\\u0446\\u0435\\u043d\\u0430\\u0440\\u043d\\u043e\\u0435 \\u043c\\u043e\\u0434\\u0435\\u043b\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u0438\\u0435</h3>';
  h += '<p style="color:#64748b;font-size:0.85rem;margin-bottom:12px">\\u041a\\u0430\\u043a \\u0438\\u0437\\u043c\\u0435\\u043d\\u0438\\u0442\\u0441\\u044f \\u0447\\u0438\\u0441\\u0442\\u0430\\u044f \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u043f\\u0440\\u0438 \\u0438\\u0437\\u043c\\u0435\\u043d\\u0435\\u043d\\u0438\\u0438 \\u043f\\u0430\\u0440\\u0430\\u043c\\u0435\\u0442\\u0440\\u043e\\u0432?</p>';
  // Quick presets
  h += '<div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">';
  h += '<button class="btn btn-outline" style="padding:5px 10px;font-size:0.75rem" onclick="setScenarioPreset(20,0,0,0,0,0)"><i class="fas fa-chart-line" style="margin-right:3px;color:#22C55E"></i>\\u0420\\u043e\\u0441\\u0442 +20%</button>';
  h += '<button class="btn btn-outline" style="padding:5px 10px;font-size:0.75rem" onclick="setScenarioPreset(-15,0,0,0,0,0)"><i class="fas fa-chart-line-down" style="margin-right:3px;color:#EF4444"></i>\\u0421\\u043f\\u0430\\u0434 -15%</button>';
  h += '<button class="btn btn-outline" style="padding:5px 10px;font-size:0.75rem" onclick="setScenarioPreset(0,0,0,30,0,0)"><i class="fas fa-bullhorn" style="margin-right:3px;color:#F59E0B"></i>\\u041c\\u0430\\u0440\\u043a. +30%</button>';
  h += '<button class="btn btn-outline" style="padding:5px 10px;font-size:0.75rem" onclick="setScenarioPreset(0,0,0,0,20,0)"><i class="fas fa-users" style="margin-right:3px;color:#3B82F6"></i>\\u0417\\u041f +20%</button>';
  h += '<button class="btn btn-outline" style="padding:5px 10px;font-size:0.75rem" onclick="setScenarioPreset(30,-10,0,-5,0,0)"><i class="fas fa-rocket" style="margin-right:3px;color:#8B5CF6"></i>\\u041e\\u043f\\u0442\\u0438\\u043c\\u0438\\u0441\\u0442.</button>';
  h += '<button class="btn btn-outline" style="padding:5px 10px;font-size:0.75rem" onclick="setScenarioPreset(-20,15,0,0,10,0)"><i class="fas fa-exclamation-triangle" style="margin-right:3px;color:#EF4444"></i>\\u041f\\u0435\\u0441\\u0441\\u0438\\u043c\\u0438\\u0441\\u0442.</button>';
  h += '<button class="btn btn-outline" style="padding:5px 10px;font-size:0.75rem" onclick="setScenarioPreset(0,0,0,0,0,0)"><i class="fas fa-redo" style="margin-right:3px"></i>\\u0421\\u0431\\u0440\\u043e\\u0441</button>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">';
  h += '<div><label style="font-size:0.78rem;color:#64748b"><i class="fas fa-chart-line" style="color:#22C55E;margin-right:4px"></i>\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 \\u0438\\u0437\\u043c. %</label><input type="number" class="input" id="sc_revenue" value="0" onchange="calcScenario()" oninput="calcScenario()"></div>';
  h += '<div><label style="font-size:0.78rem;color:#64748b"><i class="fas fa-truck" style="color:#F59E0B;margin-right:4px"></i>COGS \\u0438\\u0437\\u043c. %</label><input type="number" class="input" id="sc_expenses" value="0" onchange="calcScenario()" oninput="calcScenario()"></div>';
  h += '<div><label style="font-size:0.78rem;color:#64748b"><i class="fas fa-landmark" style="color:#EF4444;margin-right:4px"></i>\\u041d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432\\u0430\\u044f \\u0441\\u0442\\u0430\\u0432\\u043a\\u0430 %</label><input type="number" class="input" id="sc_tax_rate" value="' + (p.effective_tax_rate || 0) + '" onchange="calcScenario()" oninput="calcScenario()"></div>';
  h += '<div><label style="font-size:0.78rem;color:#64748b"><i class="fas fa-bullhorn" style="color:#F59E0B;margin-right:4px"></i>\\u041c\\u0430\\u0440\\u043a\\u0435\\u0442\\u0438\\u043d\\u0433 \\u0438\\u0437\\u043c. %</label><input type="number" class="input" id="sc_marketing" value="0" onchange="calcScenario()" oninput="calcScenario()"></div>';
  h += '<div><label style="font-size:0.78rem;color:#64748b"><i class="fas fa-users" style="color:#3B82F6;margin-right:4px"></i>\\u0417\\u041f \\u0438\\u0437\\u043c. %</label><input type="number" class="input" id="sc_salary" value="0" onchange="calcScenario()" oninput="calcScenario()"></div>';
  h += '<div><label style="font-size:0.78rem;color:#64748b"><i class="fas fa-building" style="color:#8B5CF6;margin-right:4px"></i>\\u0410\\u043c\\u043e\\u0440\\u0442. \\u0438\\u0437\\u043c. %</label><input type="number" class="input" id="sc_depreciation" value="0" onchange="calcScenario()" oninput="calcScenario()"></div>';
  h += '</div>';
  // Current values reference
  h += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;font-size:0.72rem;color:#64748b;padding:8px 12px;background:rgba(139,92,246,0.04);border-radius:6px">';
  h += '<span>\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430: <b style="color:#22C55E">' + fmtAmt(p.revenue) + '</b></span>';
  h += '<span>COGS: <b style="color:#F59E0B">' + fmtAmt(p.cogs) + '</b></span>';
  h += '<span>\\u0417\\u041f: <b style="color:#3B82F6">' + fmtAmt(p.salary_total) + '</b></span>';
  h += '<span>\\u041c\\u0430\\u0440\\u043a.: <b style="color:#F59E0B">' + fmtAmt(p.marketing) + '</b></span>';
  h += '<span>\\u0410\\u043c\\u043e\\u0440\\u0442.: <b style="color:#8B5CF6">' + fmtAmt(p.depreciation) + '</b></span>';
  h += '<span>\\u0427\\u0438\\u0441\\u0442\\u0430\\u044f: <b style="color:' + (p.net_profit >= 0 ? '#22C55E' : '#EF4444') + '">' + fmtAmt(p.net_profit) + '</b></span>';
  h += '</div>';
  h += '<div id="scenarioResult" style="padding:16px;background:#0f172a;border-radius:8px;border:1px solid #334155"><span style="color:#64748b">\\u0418\\u0437\\u043c\\u0435\\u043d\\u0438\\u0442\\u0435 \\u043f\\u0430\\u0440\\u0430\\u043c\\u0435\\u0442\\u0440\\u044b \\u0432\\u044b\\u0448\\u0435...</span></div>';
  h += '</div>';
  return h;
}
function setScenarioPreset(rev, cogs, tax, mkt, sal, depr) {
  var ids = ['sc_revenue','sc_expenses','sc_tax_rate','sc_marketing','sc_salary','sc_depreciation'];
  var vals = [rev, cogs, tax || (pnlData ? pnlData.effective_tax_rate || 0 : 0), mkt, sal, depr];
  for (var i = 0; i < ids.length; i++) { var el = document.getElementById(ids[i]); if (el) el.value = vals[i]; }
  calcScenario();
}
function calcScenario() {
  var p = pnlData || {};
  var revChg = parseFloat(document.getElementById('sc_revenue')?.value) || 0;
  var expChg = parseFloat(document.getElementById('sc_expenses')?.value) || 0;
  var taxRate = parseFloat(document.getElementById('sc_tax_rate')?.value) || 0;
  var mktChg = parseFloat(document.getElementById('sc_marketing')?.value) || 0;
  var salChg = parseFloat(document.getElementById('sc_salary')?.value) || 0;
  var deprChg = parseFloat(document.getElementById('sc_depreciation')?.value) || 0;
  var newRev = (p.revenue || 0) * (1 + revChg / 100);
  var newCogs = (p.cogs || 0) * (1 + expChg / 100);
  var newMkt = (p.marketing || 0) * (1 + mktChg / 100);
  var newSalary = (p.salary_total || 0) * (1 + salChg / 100);
  var newDepr = (p.depreciation || 0) * (1 + deprChg / 100);
  var newGross = newRev - newCogs;
  var newOpex = newSalary + newMkt + newDepr;
  var newEbit = newGross - newOpex;
  var newEbt = newEbit + (p.other_net || ((p.other_income||0) - (p.other_expenses||0))) - (p.interest_expense || 0);
  var newTaxes = newEbt > 0 ? newEbt * taxRate / 100 : 0;
  var newNet = newEbt - newTaxes;
  var diff = newNet - (p.net_profit || 0);
  var diffPct = (p.net_profit || 0) !== 0 ? Math.round(diff / Math.abs(p.net_profit) * 100) : 0;
  var el = document.getElementById('scenarioResult');
  if (el) {
    el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px">' +
      '<div><div style="font-size:0.75rem;color:#64748b">\\u041d\\u043e\\u0432\\u0430\\u044f \\u0432\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430</div><div style="font-weight:700;color:#22C55E">' + fmtAmt(newRev) + '</div></div>' +
      '<div><div style="font-size:0.75rem;color:#64748b">\\u041d\\u043e\\u0432\\u044b\\u0439 EBIT</div><div style="font-weight:700;color:' + (newEbit >= 0 ? '#3B82F6' : '#EF4444') + '">' + fmtAmt(newEbit) + '</div></div>' +
      '<div><div style="font-size:0.75rem;color:#64748b">\\u041d\\u0430\\u043b\\u043e\\u0433\\u0438</div><div style="font-weight:700;color:#EF4444">' + fmtAmt(newTaxes) + '</div></div>' +
      '<div><div style="font-size:0.75rem;color:#64748b">\\u041d\\u043e\\u0432\\u0430\\u044f \\u0447\\u0438\\u0441\\u0442\\u0430\\u044f</div><div style="font-weight:700;color:' + (newNet >= 0 ? '#22C55E' : '#EF4444') + '">' + fmtAmt(newNet) + '</div></div>' +
      '</div><div style="margin-top:10px;padding:8px 12px;background:' + (diff >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') + ';border-radius:6px;display:flex;justify-content:space-between"><span style="color:#94a3b8">\\u0418\\u0437\\u043c\\u0435\\u043d\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438:</span><span style="font-weight:800;color:' + (diff >= 0 ? '#22C55E' : '#EF4444') + '">' + (diff >= 0 ? '+' : '') + fmtAmt(diff) + (diffPct ? ' (' + (diffPct > 0 ? '+' : '') + diffPct + '%)' : '') + '</span></div>';
  }
}

// ============ TAB 1: ОБЗОР И ФИНАНСЫ ============
function renderBizOverviewV2(d, sd, fin) {
  var h = '';
  // ---- SECTION: Status cards ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-layer-group" style="color:#8B5CF6;margin-right:8px"></i>Статусы заявок</h3>';
  var statuses = [
    {key:'new',label:'Новые',color:'#10B981',icon:'fa-star'},
    {key:'contacted',label:'На связи',color:'#3B82F6',icon:'fa-phone'},
    {key:'in_progress',label:'В работе',color:'#F59E0B',icon:'fa-cog'},
    {key:'rejected',label:'Отклонено',color:'#EF4444',icon:'fa-times'},
    {key:'checking',label:'Проверка',color:'#8B5CF6',icon:'fa-search'},
    {key:'done',label:'Завершено',color:'#22C55E',icon:'fa-check-circle'}
  ];
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px">';
  for (var si = 0; si < statuses.length; si++) {
    var st = statuses[si];
    var rawV = (d.status_data || {})[st.key] || {};
    var isExcl = !!excludedStatuses[st.key];
    var cnt = Number(rawV.count) || 0; var amt = Number(rawV.amount) || 0;
    var svcAmt = Number(rawV.services) || 0; var artAmt = Number(rawV.articles) || 0;
    var opacity = isExcl ? '0.35' : '1';
    h += '<div class="card" style="padding:16px;text-align:center;border-left:3px solid ' + st.color + ';cursor:pointer;opacity:' + opacity + '" onclick="navigate(&apos;leads&apos;);setLeadsFilter(&apos;status&apos;,&apos;' + st.key + '&apos;)">';
    h += '<div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px"><i class="fas ' + st.icon + '" style="color:' + st.color + ';margin-right:4px"></i>' + st.label + '</div>';
    h += '<div style="font-size:1.8rem;font-weight:800;color:' + st.color + '">' + cnt + '</div>';
    h += '<div style="font-size:0.82rem;color:#e2e8f0;margin-top:4px;font-weight:600">' + fmtAmt(amt) + '</div>';
    h += '<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.68rem;color:#475569"><span>\\u0423\\u0441\\u043b: ' + fmtAmt(svcAmt) + '</span><span>\\u0417\\u0430\\u043a: ' + fmtAmt(artAmt) + '</span></div>';
    h += '</div>';
  }
  h += '</div></div>';

  // ---- SECTION: Key financials (3 big cards) ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-coins" style="color:#F59E0B;margin-right:8px"></i>Финансовые показатели</h3>';
  var turnover = Number(fin.turnover) || 0;
  var serviceRev = Number(fin.services) || 0;
  var articlesRev = Number(fin.articles) || 0;
  var articlesNet = Number(fin.articles_net) || 0;
  var refunds = Number(fin.refunds) || 0;
  var netProfit = Number(fin.net_profit) || 0;
  var totalExpenses = Number(fin.total_expenses) || 0;
  var salaryExp = Number(fin.salaries) || 0;
  var bonusesExp = Number(fin.bonuses) || 0;
  var commExp = Number(fin.commercial_expenses) || 0;
  var mktExp = Number(fin.marketing_expenses) || 0;
  var profitColor = netProfit >= 0 ? '#22C55E' : '#EF4444';

  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px">';
  // Turnover card (in_progress + checking + done)
  h += '<div class="card" style="padding:20px;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(139,92,246,0.05));border:1px solid rgba(139,92,246,0.3)">';
  h += '<div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-chart-bar" style="margin-right:4px"></i>\\u041e\\u0431\\u043e\\u0440\\u043e\\u0442 <span style="font-size:0.65rem;color:#64748b">(\\u0432 \\u0440\\u0430\\u0431\\u043e\\u0442\\u0435 + \\u043f\\u0440\\u043e\\u0432\\u0435\\u0440\\u043a\\u0430 + \\u0434\\u043e\\u043d\\u0435)</span></div>';
  h += '<div style="font-size:2rem;font-weight:800;color:#a78bfa">' + fmtAmt(turnover) + '</div>';
  if (turnover > 0) {
    var svcPct = Math.round(serviceRev / turnover * 100) || 0;
    h += '<div style="display:flex;height:6px;border-radius:3px;overflow:hidden;margin-top:10px;background:#1e293b">';
    h += '<div style="width:' + svcPct + '%;background:#8B5CF6" title="\\u0423\\u0441\\u043b\\u0443\\u0433\\u0438"></div>';
    h += '<div style="width:' + (100 - svcPct) + '%;background:#F59E0B" title="\\u0410\\u0440\\u0442\\u0438\\u043a\\u0443\\u043b\\u044b"></div></div>';
    h += '<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.72rem;color:#64748b">';
    h += '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#8B5CF6;margin-right:4px"></span>\\u0423\\u0441\\u043b\\u0443\\u0433\\u0438 ' + fmtAmt(serviceRev) + ' (' + svcPct + '%)</span>';
    h += '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#F59E0B;margin-right:4px"></span>\\u0410\\u0440\\u0442\\u0438\\u043a\\u0443\\u043b\\u044b ' + fmtAmt(articlesRev) + ' (' + (100-svcPct) + '%)</span></div>';
  }
  h += '</div>';
  // Net profit
  h += '<div class="card" style="padding:20px;background:linear-gradient(135deg,rgba(' + (netProfit >= 0 ? '34,197,94' : '239,68,68') + ',0.12),transparent);border:1px solid rgba(' + (netProfit >= 0 ? '34,197,94' : '239,68,68') + ',0.3)">';
  h += '<div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-' + (netProfit >= 0 ? 'arrow-up' : 'arrow-down') + '" style="margin-right:4px"></i>\\u0427\\u0438\\u0441\\u0442\\u0430\\u044f \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c</div>';
  h += '<div style="font-size:2rem;font-weight:800;color:' + profitColor + '">' + fmtAmt(netProfit) + '</div>';
  h += '<div style="font-size:0.72rem;color:#64748b;margin-top:6px">\\u0423\\u0441\\u043b\\u0443\\u0433\\u0438 (' + fmtAmt(serviceRev) + ') \\u2212 \\u0412\\u0441\\u0435 \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b (' + fmtAmt(totalExpenses) + ')</div>';
  h += '</div>';
  // Total expenses
  h += '<div class="card" style="padding:20px;border-left:3px solid #EF4444">';
  h += '<div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-receipt" style="margin-right:4px"></i>\\u0412\\u0441\\u0435 \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b</div>';
  h += '<div style="font-size:2rem;font-weight:800;color:#f87171">' + fmtAmt(totalExpenses) + '</div>';
  h += '<div style="margin-top:8px;font-size:0.72rem;color:#64748b">';
  h += '\\u0417\\u041f: ' + fmtAmt(salaryExp + bonusesExp) + ' \\u2022 \\u041a\\u043e\\u043c\\u043c: ' + fmtAmt(commExp) + ' \\u2022 \\u041c\\u0430\\u0440\\u043a: ' + fmtAmt(mktExp);
  h += '</div>';
  if (totalExpenses > 0) {
    var sp = Math.round((salaryExp + bonusesExp) / totalExpenses * 100); var cp = Math.round(commExp / totalExpenses * 100);
    h += '<div style="display:flex;height:6px;border-radius:3px;overflow:hidden;margin-top:8px;background:#1e293b">';
    h += '<div style="width:' + sp + '%;background:#3B82F6" title="\\u0417\\u041f"></div>';
    h += '<div style="width:' + cp + '%;background:#F59E0B" title="\\u041a\\u043e\\u043c\\u043c"></div>';
    h += '<div style="flex:1;background:#EF4444" title="\\u041c\\u0430\\u0440\\u043a\\u0435\\u0442"></div></div>';
  }
  h += '</div></div>';

  // Revenue detail row (services vs articles + refunds)
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px">';
  h += '<div class="card" style="padding:16px"><div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-concierge-bell" style="margin-right:4px"></i>\\u0414\\u043e\\u0445\\u043e\\u0434 (\\u0443\\u0441\\u043b\\u0443\\u0433\\u0438)</div><div style="font-size:1.5rem;font-weight:700;color:#8B5CF6">' + fmtAmt(serviceRev) + '</div><div style="font-size:0.65rem;color:#475569;margin-top:4px">\\u041c\\u043e\\u044f \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c</div></div>';
  h += '<div class="card" style="padding:16px"><div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-shopping-bag" style="margin-right:4px"></i>\\u0412\\u044b\\u043a\\u0443\\u043f\\u044b (\\u0430\\u0440\\u0442\\u0438\\u043a\\u0443\\u043b\\u044b)</div>';
  h += '<div style="font-size:1.5rem;font-weight:700;color:#F59E0B">' + fmtAmt(articlesRev) + '</div>';
  h += '<div style="font-size:0.65rem;color:#475569;margin-top:4px">\\u0414\\u0435\\u043d\\u044c\\u0433\\u0438 \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u043e\\u0432</div></div>';
  h += '<div class="card" style="padding:16px;border-left:3px solid #EF4444"><div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-undo" style="margin-right:4px"></i>\\u0412\\u043e\\u0437\\u0432\\u0440\\u0430\\u0442\\u044b</div>';
  h += '<div style="font-size:1.5rem;font-weight:700;color:#EF4444">' + (refunds > 0 ? '-' + fmtAmt(refunds) : '0 \\u058f') + '</div>';
  h += '<div style="font-size:0.65rem;color:#475569;margin-top:4px">\\u0412\\u044b\\u0447\\u0442\\u0435\\u043d\\u043e \\u0438\\u0437 \\u0432\\u044b\\u043a\\u0443\\u043f\\u043e\\u0432</div></div>';
  h += '</div>';
  h += '</div>';

  // ---- SECTION: Package Sales Summary ----
  var pkgTotal = Number(d.packages_total_revenue || 0);
  var pkgCount = Number(d.packages_total_count || 0);
  var pkgList = d.packages || [];
  if (pkgCount > 0 || pkgList.length > 0) {
    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-box-open" style="color:#F59E0B;margin-right:8px"></i>\\u041f\\u0430\\u043a\\u0435\\u0442\\u044b \\u2014 \\u043f\\u0440\\u043e\\u0434\\u0430\\u0436\\u0438</h3>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:16px">';
    h += '<div class="card" style="padding:16px;border-left:3px solid #F59E0B"><div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-shopping-cart" style="margin-right:4px;color:#F59E0B"></i>\\u041f\\u0440\\u043e\\u0434\\u0430\\u043d\\u043e \\u043f\\u0430\\u043a\\u0435\\u0442\\u043e\\u0432</div><div style="font-size:1.6rem;font-weight:800;color:#F59E0B">' + pkgCount + '</div></div>';
    h += '<div class="card" style="padding:16px;border-left:3px solid #8B5CF6"><div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-coins" style="margin-right:4px;color:#8B5CF6"></i>\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 \\u043e\\u0442 \\u043f\\u0430\\u043a\\u0435\\u0442\\u043e\\u0432</div><div style="font-size:1.6rem;font-weight:800;color:#a78bfa">' + fmtAmt(pkgTotal) + '</div></div>';
    var avgPkgChk = pkgCount > 0 ? Math.round(pkgTotal / pkgCount) : 0;
    h += '<div class="card" style="padding:16px;border-left:3px solid #22C55E"><div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-receipt" style="margin-right:4px;color:#22C55E"></i>\\u0421\\u0440. \\u0447\\u0435\\u043a \\u043f\\u0430\\u043a\\u0435\\u0442\\u0430</div><div style="font-size:1.6rem;font-weight:800;color:#22C55E">' + fmtAmt(avgPkgChk) + '</div></div>';
    var pkgPctOfRev = turnover > 0 ? ((pkgTotal / turnover) * 100).toFixed(1) : '0';
    h += '<div class="card" style="padding:16px;border-left:3px solid #3B82F6"><div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-percentage" style="margin-right:4px;color:#3B82F6"></i>\\u0414\\u043e\\u043b\\u044f \\u0432 \\u043e\\u0431\\u043e\\u0440\\u043e\\u0442\\u0435</div><div style="font-size:1.6rem;font-weight:800;color:#3B82F6">' + pkgPctOfRev + '%</div></div>';
    h += '</div>';
    // Package table
    if (pkgList.length > 0) {
      h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.85rem">';
      h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:10px 16px;text-align:left;color:#94a3b8">\\u041f\\u0430\\u043a\\u0435\\u0442</th><th style="padding:10px;text-align:center;color:#94a3b8">\\u041f\\u0440\\u043e\\u0434\\u0430\\u043d\\u043e</th><th style="padding:10px;text-align:right;color:#94a3b8">\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430</th><th style="padding:10px;text-align:right;color:#94a3b8">\\u0414\\u043e\\u043b\\u044f</th></tr></thead><tbody>';
      for (var pki2 = 0; pki2 < pkgList.length; pki2++) {
        var pkS = pkgList[pki2];
        var pkPct = pkgTotal > 0 ? ((Number(pkS.revenue) / pkgTotal) * 100).toFixed(1) : '0';
        var pkBarW = pkgTotal > 0 ? Math.round((Number(pkS.revenue) / pkgTotal) * 100) : 0;
        h += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:10px 16px;font-weight:600"><i class="fas fa-box-open" style="color:#F59E0B;margin-right:6px"></i>' + escHtml(pkS.package_name || '') + '</td>';
        h += '<td style="padding:10px;text-align:center;font-weight:700;color:#F59E0B">' + (pkS.count||0) + '</td>';
        h += '<td style="padding:10px;text-align:right;font-weight:700;color:#a78bfa">' + fmtAmt(Number(pkS.revenue)||0) + '</td>';
        h += '<td style="padding:10px;text-align:right"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><div style="width:60px;height:5px;background:#1e293b;border-radius:3px;overflow:hidden"><div style="width:' + pkBarW + '%;height:100%;background:#F59E0B;border-radius:3px"></div></div><span style="font-size:0.75rem;font-weight:600">' + pkPct + '%</span></div></td></tr>';
      }
      h += '</tbody></table></div>';
    }
    h += '</div>';
  }

  // ---- SECTION: Referral & Discount Impact ----
  var promoD = d.promo_costs || {};
  var promoKeys2 = Object.keys(promoD);
  var totalDiscCostOV = Number(d.total_discount_cost || 0);
  var totalDiscLeadsOV = Number(d.total_discount_leads || 0);
  var svcBeforeDisc = Number(d.services_before_discount || 0);
  {
    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-gift" style="color:#FBBF24;margin-right:8px"></i>Влияние реферальных кодов и скидок</h3>';
    if (promoKeys2.length === 0 && totalDiscCostOV === 0) {
      h += '<div class="card" style="padding:24px;text-align:center;color:#64748b"><i class="fas fa-tag" style="font-size:1.5rem;margin-bottom:8px;display:block;color:#475569"></i>За выбранный период нет лидов с промокодами. Примените промокод к лиду, чтобы видеть аналитику здесь.</div>';
    }
    // KPI cards
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px">';
    // 1. Codes used
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #8B5CF6"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-tags" style="color:#8B5CF6;margin-right:4px"></i>Промокодов</div><div style="font-size:1.5rem;font-weight:800;color:#8B5CF6">' + promoKeys2.length + '</div></div>';
    // 2. Leads with discounts
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #10B981"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-users" style="color:#10B981;margin-right:4px"></i>Лидов со скидкой</div><div style="font-size:1.5rem;font-weight:800;color:#10B981">' + totalDiscLeadsOV + '</div></div>';
    // 3. Total discount cost
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #EF4444"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-hand-holding-usd" style="color:#EF4444;margin-right:4px"></i>Сумма скидок</div><div style="font-size:1.5rem;font-weight:800;color:#EF4444">' + (totalDiscCostOV > 0 ? '-' : '') + fmtAmt(totalDiscCostOV) + '</div></div>';
    // 4. Revenue with promos
    var promoRevTotalOV = 0; promoKeys2.forEach(function(k) { promoRevTotalOV += promoD[k].revenue; });
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #3B82F6"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-coins" style="color:#3B82F6;margin-right:4px"></i>Выручка по промо</div><div style="font-size:1.5rem;font-weight:800;color:#3B82F6">' + fmtAmt(promoRevTotalOV) + '</div></div>';
    // 5. Avg discount per lead
    var avgDiscPerLead = totalDiscLeadsOV > 0 ? Math.round(totalDiscCostOV / totalDiscLeadsOV) : 0;
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #F59E0B"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-calculator" style="color:#F59E0B;margin-right:4px"></i>Ср. скидка / лид</div><div style="font-size:1.5rem;font-weight:800;color:#F59E0B">' + fmtAmt(avgDiscPerLead) + '</div></div>';
    // 6. Discount rate (% of services given as discount)
    var discRatePct = svcBeforeDisc > 0 ? (totalDiscCostOV / svcBeforeDisc * 100).toFixed(1) : '0';
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #a78bfa"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-percent" style="color:#a78bfa;margin-right:4px"></i>Доля скидок</div><div style="font-size:1.5rem;font-weight:800;color:#a78bfa">' + discRatePct + '%</div><div style="font-size:0.58rem;color:#475569;margin-top:2px">от стоимости услуг</div></div>';
    h += '</div>';
    // Quick table of top promo codes
    if (promoKeys2.length > 0) {
      var sortedPromoOV = promoKeys2.sort(function(a,b) { return promoD[b].count - promoD[a].count; }).slice(0, 5);
      h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.82rem">';
      h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:8px 14px;text-align:left;color:#94a3b8">Код</th><th style="padding:8px;text-align:center;color:#94a3b8">Скидка</th><th style="padding:8px;text-align:center;color:#94a3b8">Лидов</th><th style="padding:8px;text-align:right;color:#94a3b8">Стоимость скидки</th><th style="padding:8px;text-align:right;color:#94a3b8">Подитог услуг</th><th style="padding:8px;text-align:right;color:#94a3b8">Выручка</th></tr></thead><tbody>';
      for (var pvi = 0; pvi < sortedPromoOV.length; pvi++) {
        var pvk = sortedPromoOV[pvi]; var pvc = promoD[pvk]; var pvcd = pvc.code_details || {};
        h += '<tr style="border-bottom:1px solid #1e293b">';
        h += '<td style="padding:8px 14px;font-weight:700;color:#a78bfa"><i class="fas fa-tag" style="margin-right:4px;color:#8B5CF6"></i>' + escHtml(pvk) + '</td>';
        h += '<td style="padding:8px;text-align:center;color:#fbbf24;font-weight:600">' + (pvcd.discount_percent || 0) + '%</td>';
        h += '<td style="padding:8px;text-align:center;font-weight:600">' + pvc.count + '</td>';
        h += '<td style="padding:8px;text-align:right;color:#EF4444;font-weight:700">' + (pvc.discount_total > 0 ? '-' + fmtAmt(pvc.discount_total) : '0 ֏') + '</td>';
        h += '<td style="padding:8px;text-align:right;color:#94a3b8">' + fmtAmt(pvc.services_total || 0) + '</td>';
        h += '<td style="padding:8px;text-align:right;color:#10B981;font-weight:600">' + fmtAmt(pvc.revenue) + '</td>';
        h += '</tr>';
      }
      h += '</tbody></table></div>';
    }
    h += '</div>';
  }

  // ---- SECTION: Loan Summary (if any loans exist) ----
  var oLoans = (data.loans || []).filter(function(l) { return l.is_active !== 0; });
  if (oLoans.length > 0) {
    var oTotalDebt = 0, oTotalMonthly = 0, oTotalPrincipal = 0, oTotalInterestCost = 0;
    var oBankLoans = 0, oOverdrafts = 0, oOtherLoans = 0;
    var oOverdraftTotal = 0, oOverdraftLimit = 0;
    var oNearestEnd = '', oNearestName = '';
    var oWeightedRate = 0, oRateWeightSum = 0;
    var oTotalPaid = 0;
    for (var oli = 0; oli < oLoans.length; oli++) {
      var ol = oLoans[oli];
      if (ol.loan_type === 'overdraft') {
        oOverdrafts++;
        oOverdraftTotal += (ol.overdraft_used || 0);
        oOverdraftLimit += (ol.overdraft_limit || 0);
        oTotalDebt += (ol.overdraft_used || 0);
      } else {
        var olBal = ol.remaining_balance || 0;
        var olPrincipal = ol.principal || 0;
        oTotalDebt += olBal;
        oTotalMonthly += (ol.monthly_payment || 0);
        oTotalPrincipal += olPrincipal;
        oTotalPaid += (olPrincipal - olBal);
        if (ol.interest_rate > 0) {
          oWeightedRate += ol.interest_rate * olBal;
          oRateWeightSum += olBal;
        }
        if (ol.loan_type === 'bank') oBankLoans++;
        else oOtherLoans++;
        // Nearest end date
        if (ol.end_date && (!oNearestEnd || ol.end_date < oNearestEnd)) {
          oNearestEnd = ol.end_date;
          oNearestName = ol.name || ol.lender || '';
        }
      }
    }
    var oAvgRate = oRateWeightSum > 0 ? (oWeightedRate / oRateWeightSum) : 0;
    var oLoadRev = serviceRev > 0 ? Math.round(oTotalMonthly / serviceRev * 100) : 0;
    var oLoadProfit = netProfit > 0 ? Math.round(oTotalMonthly / netProfit * 100) : 0;
    var oPayoffMonths = oTotalMonthly > 0 ? Math.ceil(oTotalDebt / oTotalMonthly) : 0;
    var oDebtToRevRatio = serviceRev > 0 ? (oTotalDebt / (serviceRev * 12) * 100).toFixed(1) : '0';
    var oYearlyInterest = oTotalMonthly > 0 ? Math.round(oTotalMonthly * 12 - (oTotalPrincipal > 0 ? oTotalDebt : 0)) : 0;
    if (oYearlyInterest < 0) oYearlyInterest = 0;

    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:8px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-university" style="color:#EF4444;margin-right:8px"></i>Общий долг компании</h3>';
    h += '<div style="font-size:0.72rem;color:#64748b;margin-bottom:16px;line-height:1.5">Совокупная долговая нагрузка: сумма остатков по активным кредитам и овердрафтам. PMT — обязательные ежемесячные платежи. Нагрузка показывает, какую долю дохода или прибыли занимают платежи по долгам. <span style="color:#94a3b8">Рекомендуемый порог: до 30% от выручки, до 50% от прибыли.</span></div>';
    // Top KPI row: core metrics
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;margin-bottom:12px">';
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #EF4444"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-hand-holding-usd" style="color:#EF4444;margin-right:4px"></i>Общий долг</div><div style="font-size:1.3rem;font-weight:800;color:#EF4444">' + fmtAmt(oTotalDebt) + '</div><div style="font-size:0.58rem;color:#475569;margin-top:3px">Остаток по всем кредитам</div></div>';
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #F59E0B"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-calendar-alt" style="color:#F59E0B;margin-right:4px"></i>PMT / мес</div><div style="font-size:1.3rem;font-weight:800;color:#F59E0B">' + fmtAmt(oTotalMonthly) + '</div><div style="font-size:0.58rem;color:#475569;margin-top:3px">Обязательные платежи</div></div>';
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid ' + (oLoadRev > 30 ? '#EF4444' : oLoadRev > 20 ? '#F59E0B' : '#22C55E') + '"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-chart-pie" style="color:' + (oLoadRev > 30 ? '#EF4444' : oLoadRev > 20 ? '#F59E0B' : '#22C55E') + ';margin-right:4px"></i>PMT / выручка</div><div style="font-size:1.3rem;font-weight:800;color:' + (oLoadRev > 30 ? '#EF4444' : oLoadRev > 20 ? '#F59E0B' : '#22C55E') + '">' + oLoadRev + '%</div><div style="font-size:0.58rem;color:#475569;margin-top:3px">' + (oLoadRev > 30 ? '⚠️ Высокая нагрузка' : oLoadRev > 20 ? '⚡ Умеренная' : '✅ Безопасно') + '</div></div>';
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid ' + (oLoadProfit > 50 ? '#EF4444' : oLoadProfit > 30 ? '#F59E0B' : '#22C55E') + '"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-chart-pie" style="color:' + (oLoadProfit > 50 ? '#EF4444' : oLoadProfit > 30 ? '#F59E0B' : '#22C55E') + ';margin-right:4px"></i>PMT / прибыль</div><div style="font-size:1.3rem;font-weight:800;color:' + (oLoadProfit > 50 ? '#EF4444' : oLoadProfit > 30 ? '#F59E0B' : '#22C55E') + '">' + oLoadProfit + '%</div><div style="font-size:0.58rem;color:#475569;margin-top:3px">' + (oLoadProfit > 50 ? '⚠️ Критично' : oLoadProfit > 30 ? '⚡ Следите' : '✅ Норма') + '</div></div>';
    h += '</div>';
    // Second row: analytical metrics
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:12px">';
    h += '<div class="card" style="padding:12px;text-align:center"><div style="font-size:0.68rem;color:#94a3b8;margin-bottom:3px"><i class="fas fa-percentage" style="color:#a78bfa;margin-right:3px"></i>Ср. ставка</div><div style="font-size:1.1rem;font-weight:800;color:#a78bfa">' + oAvgRate.toFixed(1) + '%</div><div style="font-size:0.55rem;color:#475569;margin-top:2px">Взвешенная по остатку</div></div>';
    h += '<div class="card" style="padding:12px;text-align:center"><div style="font-size:0.68rem;color:#94a3b8;margin-bottom:3px"><i class="fas fa-hourglass-half" style="color:#3B82F6;margin-right:3px"></i>До погашения</div><div style="font-size:1.1rem;font-weight:800;color:#3B82F6">' + oPayoffMonths + ' мес</div><div style="font-size:0.55rem;color:#475569;margin-top:2px">При текущих платежах</div></div>';
    h += '<div class="card" style="padding:12px;text-align:center"><div style="font-size:0.68rem;color:#94a3b8;margin-bottom:3px"><i class="fas fa-balance-scale-right" style="color:#F97316;margin-right:3px"></i>Долг / год. выручка</div><div style="font-size:1.1rem;font-weight:800;color:#F97316">' + oDebtToRevRatio + '%</div><div style="font-size:0.55rem;color:#475569;margin-top:2px">' + (parseFloat(oDebtToRevRatio) > 50 ? '⚠️ Высокий' : '✅ Приемлемый') + '</div></div>';
    if (oTotalPrincipal > 0) {
      var paidPct = Math.round(oTotalPaid / oTotalPrincipal * 100);
      h += '<div class="card" style="padding:12px;text-align:center"><div style="font-size:0.68rem;color:#94a3b8;margin-bottom:3px"><i class="fas fa-tasks" style="color:#22C55E;margin-right:3px"></i>Выплачено</div><div style="font-size:1.1rem;font-weight:800;color:#22C55E">' + fmtAmt(oTotalPaid) + '</div><div style="font-size:0.55rem;color:#475569;margin-top:2px">' + paidPct + '% от начального долга</div></div>';
    }
    h += '<div class="card" style="padding:12px;text-align:center"><div style="font-size:0.68rem;color:#94a3b8;margin-bottom:3px"><i class="fas fa-file-invoice-dollar" style="color:#8B5CF6;margin-right:3px"></i>Активных</div><div style="font-size:1.1rem;font-weight:800;color:#8B5CF6">' + oLoans.length + '</div><div style="font-size:0.55rem;color:#475569;margin-top:2px">' + (oBankLoans > 0 ? 'Банк: ' + oBankLoans : '') + (oOverdrafts > 0 ? (oBankLoans > 0 ? ', ' : '') + 'Овердрафт: ' + oOverdrafts : '') + (oOtherLoans > 0 ? ((oBankLoans + oOverdrafts) > 0 ? ', ' : '') + 'Другие: ' + oOtherLoans : '') + '</div></div>';
    if (oOverdraftTotal > 0) {
      var odUsedPct = oOverdraftLimit > 0 ? Math.round(oOverdraftTotal / oOverdraftLimit * 100) : 0;
      h += '<div class="card" style="padding:12px;text-align:center"><div style="font-size:0.68rem;color:#94a3b8;margin-bottom:3px"><i class="fas fa-credit-card" style="color:#EF4444;margin-right:3px"></i>Овердрафт</div><div style="font-size:1.1rem;font-weight:800;color:#EF4444">' + fmtAmt(oOverdraftTotal) + '</div><div style="font-size:0.55rem;color:#475569;margin-top:2px">Использовано ' + odUsedPct + '% лимита (' + fmtAmt(oOverdraftLimit) + ')</div></div>';
    }
    h += '</div>';
    // Loan-by-loan table
    if (oLoans.length > 1) {
      h += '<div class="card" style="padding:0;overflow-x:auto;margin-bottom:12px"><table style="width:100%;border-collapse:collapse;font-size:0.78rem">';
      h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:8px 12px;text-align:left;color:#94a3b8">Кредит</th><th style="padding:8px;text-align:left;color:#94a3b8">Кредитор</th><th style="padding:8px;text-align:right;color:#94a3b8">Остаток</th><th style="padding:8px;text-align:right;color:#94a3b8">PMT/мес</th><th style="padding:8px;text-align:center;color:#94a3b8">Ставка</th><th style="padding:8px;text-align:center;color:#94a3b8">Дата окончания</th></tr></thead><tbody>';
      for (var olti = 0; olti < oLoans.length; olti++) {
        var olt = oLoans[olti];
        var oltBal = olt.loan_type === 'overdraft' ? (olt.overdraft_used || 0) : (olt.remaining_balance || 0);
        var oltPmt = olt.loan_type === 'overdraft' ? '-' : fmtAmt(olt.monthly_payment || 0);
        var oltType = olt.loan_type === 'overdraft' ? '<span style="color:#F59E0B;font-size:0.7rem">овердрафт</span>' : (olt.loan_type === 'bank' ? '<span style="color:#3B82F6;font-size:0.7rem">банк</span>' : '<span style="color:#94a3b8;font-size:0.7rem">' + (olt.loan_type || 'другой') + '</span>');
        h += '<tr style="border-bottom:1px solid #1e293b">';
        h += '<td style="padding:8px 12px"><span style="font-weight:600;color:#e2e8f0">' + escHtml(olt.name || 'Кредит #' + olt.id) + '</span> ' + oltType + '</td>';
        h += '<td style="padding:8px;color:#94a3b8">' + escHtml(olt.lender || '-') + '</td>';
        h += '<td style="padding:8px;text-align:right;font-weight:700;color:#EF4444">' + fmtAmt(oltBal) + '</td>';
        h += '<td style="padding:8px;text-align:right;color:#F59E0B;font-weight:600">' + oltPmt + '</td>';
        h += '<td style="padding:8px;text-align:center;color:#a78bfa">' + (olt.interest_rate ? olt.interest_rate + '%' : '-') + '</td>';
        h += '<td style="padding:8px;text-align:center;color:#94a3b8">' + (olt.end_date || '-') + '</td>';
        h += '</tr>';
      }
      h += '</tbody></table></div>';
    }
    // Nearest maturity note
    if (oNearestEnd) {
      var daysToEnd = Math.ceil((new Date(oNearestEnd).getTime() - new Date().getTime()) / 86400000);
      if (daysToEnd > 0 && daysToEnd < 180) {
        h += '<div style="padding:10px 14px;background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);border-radius:8px;font-size:0.78rem;color:#F97316;margin-bottom:12px"><i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>Ближайшее погашение: <strong>' + escHtml(oNearestName) + '</strong> — ' + oNearestEnd + ' (через ' + daysToEnd + ' дн.)</div>';
      }
    }
    h += '</div>'; // close debt section wrapper
  }
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-tachometer-alt" style="color:#10B981;margin-right:8px"></i>\\u041f\\u043e\\u043a\\u0430\\u0437\\u0430\\u0442\\u0435\\u043b\\u0438 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u0438 \\u0431\\u0438\\u0437\\u043d\\u0435\\u0441\\u0430</h3>';
  var kpis = [
    {label:'\\u041a\\u043e\\u043d\\u0432\\u0435\\u0440\\u0441\\u0438\\u044f',val:fmtPct(fin.conversion_rate),color:Number(fin.conversion_rate)>20?'#22C55E':Number(fin.conversion_rate)>10?'#F59E0B':'#EF4444',icon:'fa-percentage',desc:'Завершённые / Все лиды за период'},
    {label:'\\u0421\\u0440. \\u0447\\u0435\\u043a (\\u0443\\u0441\\u043b\\u0443\\u0433\\u0438)',val:fmtAmt(fin.avg_check),color:'#8B5CF6',icon:'fa-shopping-cart',desc:'Сумма услуг завершённых / кол-во завершённых (без выкупов)'},
    {label:'\\u041c\\u0430\\u0440\\u0436\\u0438\\u043d\\u0430\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u044c',val:fmtPct(fin.marginality),color:Number(fin.marginality)>0?'#22C55E':'#EF4444',icon:'fa-percentage',desc:'Прибыль / Доход услуг'},
    {label:'ROI',val:fmtPct(fin.roi),color:Number(fin.roi)>0?'#22C55E':'#EF4444',icon:'fa-chart-line',desc:'Прибыль / Все расходы'},
    {label:'ROMI',val:fmtPct(fin.romi),color:Number(fin.romi)>0?'#22C55E':'#EF4444',icon:'fa-bullhorn',desc:'(Доход услуг \\u2212 маркетинг) / маркетинг'},
    {label:'\\u0412\\u044b\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u0435',val:(Number(fin.avg_fulfillment_days)||0)+' \\u0434\\u043d',color:'#3B82F6',icon:'fa-clock',desc:'Среднее время выполнения заказа'},
    {label:'Break-even',val:fmtAmt(fin.break_even),color:'#F59E0B',icon:'fa-balance-scale',desc:'Точка безубыточности (= все расходы)'},
    {label:'\\u041e\\u0442\\u043a\\u0430\\u0437\\u044b',val:(fin.totalLeads > 0 ? (((Number((sd.rejected||{}).count)||0) / fin.totalLeads) * 100).toFixed(1) : '0') + '%',color:'#EF4444',icon:'fa-ban',desc:'Отклонённые / Все лиды'},
    {label:'LTV',val:fmtAmt((fin.ltv_data||{}).ltv||0),color:'#a78bfa',icon:'fa-gem',desc:'Ср.чек × Частота покупок × Срок жизни клиента'},
    {label:'CAC',val:fmtAmt(Number((sd.done||{}).count||0) > 0 ? Math.round(fin.total_expenses / Number((sd.done||{}).count||1)) : 0),color:'#F97316',icon:'fa-user-plus',desc:'Все расходы / Кол-во клиентов (done)'}
  ];
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">';
  for (var ki = 0; ki < kpis.length; ki++) {
    var kp = kpis[ki];
    h += '<div class="card" style="padding:14px;text-align:center"><i class="fas ' + kp.icon + '" style="color:' + kp.color + ';font-size:0.9rem;margin-bottom:6px;display:block"></i>';
    h += '<div style="font-size:1.3rem;font-weight:800;color:' + kp.color + '">' + kp.val + '</div>';
    h += '<div style="font-size:0.7rem;color:#64748b;margin-top:2px">' + kp.label + '</div>';
    if (kp.desc) h += '<div style="font-size:0.58rem;color:#475569;margin-top:3px;line-height:1.2">' + kp.desc + '</div>';
    h += '</div>';
  }
  h += '</div></div>';

  // ---- SECTION: LTV Details ----
  var ltvD = fin.ltv_data || {};
  if (ltvD.unique_customers > 0) {
    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-gem" style="color:#a78bfa;margin-right:8px"></i>LTV \\u0430\\u043d\\u0430\\u043b\\u0438\\u0442\\u0438\\u043a\\u0430 <span style="font-size:0.72rem;font-weight:400;color:#64748b">(\\u043f\\u043e \\u043d\\u043e\\u043c\\u0435\\u0440\\u0443 \\u0442\\u0435\\u043b\\u0435\\u0444\\u043e\\u043d\\u0430)</span></h3>';
    h += '<div class="card" style="padding:0;overflow:hidden">';
    // LTV formula visualization
    h += '<div style="padding:20px;background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(167,139,250,0.05));border-bottom:1px solid #334155">';
    h += '<div style="text-align:center;margin-bottom:12px">';
    h += '<span style="font-size:2.2rem;font-weight:900;color:#a78bfa">' + fmtAmt(ltvD.ltv || 0) + '</span>';
    h += '<div style="font-size:0.78rem;color:#94a3b8;margin-top:4px">LTV = \\u0421\\u0440.\\u0447\\u0435\\u043a \\u00d7 \\u0427\\u0430\\u0441\\u0442\\u043e\\u0442\\u0430 \\u043f\\u043e\\u043a\\u0443\\u043f\\u043e\\u043a \\u00d7 \\u0421\\u0440\\u043e\\u043a \\u0436\\u0438\\u0437\\u043d\\u0438</div></div>';
    h += '<div style="display:flex;justify-content:center;align-items:center;gap:16px;flex-wrap:wrap">';
    h += '<div style="text-align:center;padding:12px 20px;background:#0f172a;border-radius:10px;border:1px solid #334155"><div style="font-size:1.4rem;font-weight:800;color:#8B5CF6">' + fmtAmt(ltvD.avg_check_ltv || 0) + '</div><div style="font-size:0.68rem;color:#94a3b8;margin-top:2px">\\u0421\\u0440. \\u0447\\u0435\\u043a</div></div>';
    h += '<span style="font-size:1.4rem;font-weight:800;color:#475569">\\u00d7</span>';
    h += '<div style="text-align:center;padding:12px 20px;background:#0f172a;border-radius:10px;border:1px solid #334155"><div style="font-size:1.4rem;font-weight:800;color:#F59E0B">' + (ltvD.purchase_frequency || 0) + '</div><div style="font-size:0.68rem;color:#94a3b8;margin-top:2px">\\u0427\\u0430\\u0441\\u0442\\u043e\\u0442\\u0430</div></div>';
    h += '<span style="font-size:1.4rem;font-weight:800;color:#475569">\\u00d7</span>';
    h += '<div style="text-align:center;padding:12px 20px;background:#0f172a;border-radius:10px;border:1px solid #334155"><div style="font-size:1.4rem;font-weight:800;color:#22C55E">' + (ltvD.customer_lifespan_months || 1) + ' \\u043c\\u0435\\u0441</div><div style="font-size:0.68rem;color:#94a3b8;margin-top:2px">\\u0421\\u0440\\u043e\\u043a \\u0436\\u0438\\u0437\\u043d\\u0438</div></div>';
    h += '</div></div>';
    // Details
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0">';
    h += '<div style="padding:16px;text-align:center;border-right:1px solid #334155"><div style="font-size:1.6rem;font-weight:800;color:#3B82F6">' + (ltvD.unique_customers || 0) + '</div><div style="font-size:0.7rem;color:#94a3b8">\\u0423\\u043d\\u0438\\u043a. \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u043e\\u0432</div></div>';
    h += '<div style="padding:16px;text-align:center;border-right:1px solid #334155"><div style="font-size:1.6rem;font-weight:800;color:#22C55E">' + (ltvD.repeat_customers || 0) + '</div><div style="font-size:0.7rem;color:#94a3b8">\\u041f\\u043e\\u0432\\u0442\\u043e\\u0440\\u043d\\u044b\\u0435</div></div>';
    h += '<div style="padding:16px;text-align:center;border-right:1px solid #334155"><div style="font-size:1.6rem;font-weight:800;color:#F59E0B">' + (ltvD.total_orders || 0) + '</div><div style="font-size:0.7rem;color:#94a3b8">\\u0412\\u0441\\u0435\\u0433\\u043e \\u0437\\u0430\\u043a\\u0430\\u0437\\u043e\\u0432</div></div>';
    h += '<div style="padding:16px;text-align:center"><div style="font-size:1.6rem;font-weight:800;color:' + (ltvD.repeat_rate > 0 ? '#a78bfa' : '#64748b') + '">' + (ltvD.repeat_rate || 0) + '%</div><div style="font-size:0.7rem;color:#94a3b8">\\u0414\\u043e\\u043b\\u044f \\u043f\\u043e\\u0432\\u0442\\u043e\\u0440\\u043d\\u044b\\u0445</div></div>';
    h += '</div></div></div>';
  }

  // ---- SECTION: Status P&L table with exclude checkboxes ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:8px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-table" style="color:#3B82F6;margin-right:8px"></i>\\u041e\\u0442\\u0447\\u0451\\u0442 \\u043f\\u043e \\u0441\\u0442\\u0430\\u0442\\u0443\\u0441\\u0430\\u043c</h3>';
  h += '<div style="font-size:0.72rem;color:#64748b;margin-bottom:12px">Снимите галочку, чтобы исключить статус из расчётов. Исключённые статусы будут затемнены.</div>';
  h += '<div class="card" style="overflow-x:auto;padding:0"><table style="width:100%;border-collapse:collapse;font-size:0.85rem">';
  h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155">';
  h += '<th style="padding:12px 8px;text-align:center;color:#94a3b8;width:40px"><input type="checkbox" ' + (Object.keys(excludedStatuses).length === 0 ? 'checked' : '') + ' onchange="toggleAllStatuses(this.checked)" style="cursor:pointer;accent-color:#8B5CF6" title="Выбрать все / Убрать все"></th>';
  h += '<th style="padding:12px 16px;text-align:left;color:#94a3b8">\\u0421\\u0442\\u0430\\u0442\\u0443\\u0441</th><th style="padding:12px;text-align:right;color:#94a3b8">\\u041a\\u043e\\u043b-\\u0432\\u043e</th><th style="padding:12px;text-align:right;color:#94a3b8">\\u0421\\u0443\\u043c\\u043c\\u0430</th><th style="padding:12px;text-align:right;color:#94a3b8">\\u0423\\u0441\\u043b\\u0443\\u0433\\u0438</th><th style="padding:12px;text-align:right;color:#94a3b8">\\u0412\\u044b\\u043a\\u0443\\u043f\\u044b</th></tr></thead><tbody>';
  var totalLeads2 = 0; var totalAmt2 = 0; var totalSvc = 0; var totalArt = 0;
  for (var si2 = 0; si2 < statuses.length; si2++) {
    var s2 = statuses[si2]; var rawV2 = (d.status_data || {})[s2.key] || {};
    var isExcl2 = !!excludedStatuses[s2.key];
    var cnt2 = Number(rawV2.count) || 0; var amt2 = Number(rawV2.amount) || 0;
    var svc2 = Number(rawV2.services) || 0; var art2 = Number(rawV2.articles) || 0;
    if (!isExcl2) { totalLeads2 += cnt2; totalAmt2 += amt2; totalSvc += svc2; totalArt += art2; }
    var rowOpacity = isExcl2 ? 'opacity:0.35;' : '';
    h += '<tr style="border-bottom:1px solid #1e293b;' + rowOpacity + '">';
    h += '<td style="padding:10px 8px;text-align:center"><input type="checkbox" ' + (isExcl2 ? '' : 'checked') + ' onchange="toggleExcludeStatus(&apos;' + s2.key + '&apos;,this.checked)" style="cursor:pointer;accent-color:#8B5CF6"></td>';
    h += '<td style="padding:10px 16px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + s2.color + ';margin-right:8px"></span>' + s2.label + '</td>';
    h += '<td style="padding:10px;text-align:right;font-weight:600">' + cnt2 + '</td>';
    h += '<td style="padding:10px;text-align:right;font-weight:600">' + fmtAmt(amt2) + '</td>';
    h += '<td style="padding:10px;text-align:right;color:#8B5CF6">' + fmtAmt(svc2) + '</td>';
    h += '<td style="padding:10px;text-align:right;color:#F59E0B">' + fmtAmt(art2) + '</td></tr>';
  }
  h += '<tr style="border-top:2px solid #8B5CF6;font-weight:700"><td></td><td style="padding:10px 16px">\\u0418\\u0422\\u041e\\u0413\\u041e (активные)</td><td style="padding:10px;text-align:right">' + totalLeads2 + '</td><td style="padding:10px;text-align:right">' + fmtAmt(totalAmt2) + '</td><td style="padding:10px;text-align:right;color:#8B5CF6">' + fmtAmt(totalSvc) + '</td><td style="padding:10px;text-align:right;color:#F59E0B">' + fmtAmt(totalArt) + '</td></tr>';
  h += '</tbody></table></div>';

  // P&L table — mini overview (services-only profit = services - expenses)
  var miniNetProfit = serviceRev - totalExpenses;
  var miniProfitColor = miniNetProfit >= 0 ? '#22C55E' : '#EF4444';
  h += '<div class="card" style="overflow-x:auto;padding:0;margin-top:16px"><table style="width:100%;border-collapse:collapse;font-size:0.85rem">';
  h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:12px 16px;text-align:left;color:#94a3b8" colspan="2">\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438 \\u0438 \\u0443\\u0431\\u044b\\u0442\\u043a\\u0438 (P&L)</th></tr></thead><tbody>';
  var plRows = [
    { label: '\\u0414\\u043e\\u0445\\u043e\\u0434 (\\u0443\\u0441\\u043b\\u0443\\u0433\\u0438)', value: serviceRev, color: '#10B981', bold: true },
    { label: '\\u00a0\\u00a0\\u0417\\u0430\\u0440\\u043f\\u043b\\u0430\\u0442\\u044b + \\u0431\\u043e\\u043d\\u0443\\u0441\\u044b', value: -(salaryExp + bonusesExp), color: '#EF4444' },
    { label: '\\u00a0\\u00a0\\u041a\\u043e\\u043c\\u043c\\u0435\\u0440\\u0447\\u0435\\u0441\\u043a\\u0438\\u0435 \\u0437\\u0430\\u0442\\u0440\\u0430\\u0442\\u044b', value: -commExp, color: '#EF4444' },
    { label: '\\u00a0\\u00a0\\u041c\\u0430\\u0440\\u043a\\u0435\\u0442\\u0438\\u043d\\u0433 / \\u0420\\u0435\\u043a\\u043b\\u0430\\u043c\\u0430', value: -mktExp, color: '#EF4444' },
    { label: '\\u0418\\u0422\\u041e\\u0413\\u041e \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u043e\\u0432', value: -totalExpenses, color: '#F97316', bold: true },
    { label: '\\u0427\\u0418\\u0421\\u0422\\u0410\\u042f \\u041f\\u0420\\u0418\\u0411\\u042b\\u041b\\u042c', value: miniNetProfit, color: miniProfitColor, bold: true, big: true },
  ];
  for (var pli = 0; pli < plRows.length; pli++) {
    var pr = plRows[pli]; var prVal = Number(pr.value) || 0;
    var prSign = prVal < 0 ? '\\u2212 ' : '';
    h += '<tr style="border-bottom:1px solid #1e293b' + (pr.big ? ';border-top:2px solid #8B5CF6' : '') + '">';
    h += '<td style="padding:10px 16px;' + (pr.bold ? 'font-weight:800;' : 'color:#94a3b8;') + (pr.big ? 'font-size:1.1rem;' : '') + '">' + pr.label + '</td>';
    h += '<td style="padding:10px 16px;text-align:right;font-weight:' + (pr.bold ? '800' : '600') + ';color:' + pr.color + ';' + (pr.big ? 'font-size:1.2rem;' : '') + '">' + prSign + fmtAmt(Math.abs(prVal)) + '</td></tr>';
  }
  h += '</tbody></table></div></div>';

  // ---- SECTION: Daily chart ----
  var rawDaily = d.daily || [];
  // Fill in missing days so every day in the range shows (including today / day 21 etc.)
  var daily = [];
  { // Always fill days - even if no data, show empty bars
    var dayMap = {};
    for (var rdi = 0; rdi < rawDaily.length; rdi++) { dayMap[rawDaily[rdi].day] = rawDaily[rdi]; }
    var dEnd = new Date(); // today
    var dStart = new Date();
    if (expandedMonth) {
      var eParts = expandedMonth.split('-');
      var eY = Number(eParts[0]), eM = Number(eParts[1]);
      dStart = new Date(eY, eM-1, 1);
      var eLastDay = new Date(eY, eM, 0).getDate();
      // For current month, show up to today; for past months, show entire month
      var isCurrentMonth = (eY === dEnd.getFullYear() && eM-1 === dEnd.getMonth());
      dEnd = isCurrentMonth ? new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate()) : new Date(eY, eM-1, eLastDay);
    } else if (analyticsDateFrom && analyticsDateTo) {
      // Use the selected analytics date range
      var fromParts = analyticsDateFrom.split('-');
      var toParts = analyticsDateTo.split('-');
      dStart = new Date(Number(fromParts[0]), Number(fromParts[1])-1, Number(fromParts[2]));
      dEnd = new Date(Number(toParts[0]), Number(toParts[1])-1, Number(toParts[2]));
    } else if (analyticsDateFrom) {
      var fromParts2 = analyticsDateFrom.split('-');
      dStart = new Date(Number(fromParts2[0]), Number(fromParts2[1])-1, Number(fromParts2[2]));
    } else {
      dStart.setDate(dStart.getDate() - 29);
    }
    for (var dc = new Date(dStart); dc <= dEnd; dc.setDate(dc.getDate()+1)) {
      var dKey = dc.getFullYear() + '-' + String(dc.getMonth()+1).padStart(2,'0') + '-' + String(dc.getDate()).padStart(2,'0');
      daily.push(dayMap[dKey] || {day: dKey, count: 0, amount: 0});
    }
  }
  if (daily.length > 0) {
    h += '<div style="margin-bottom:32px">';
    var chartPeriodLabel = '';
    if (expandedMonth) { chartPeriodLabel = ''; }
    else if (analyticsDateFrom && analyticsDateTo) { chartPeriodLabel = ' (' + analyticsDateFrom + ' \\u2014 ' + analyticsDateTo + ')'; }
    else if (analyticsDateFrom) { chartPeriodLabel = ' (\\u0441 ' + analyticsDateFrom + ')'; }
    else { chartPeriodLabel = ' (30 \\u0434\\u043d\\u0435\\u0439)'; }
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-chart-bar" style="color:#8B5CF6;margin-right:8px"></i>\\u0417\\u0430\\u044f\\u0432\\u043a\\u0438 \\u043f\\u043e \\u0434\\u043d\\u044f\\u043c' + chartPeriodLabel + '</h3>';
    // Compute daily average
    var dailyTotalCnt = 0; for (var dti = 0; dti < daily.length; dti++) dailyTotalCnt += Number(daily[dti].count)||0;
    var dailyAvg = daily.length > 0 ? (dailyTotalCnt / daily.length).toFixed(1) : '0';
    h += '<div style="font-size:0.78rem;color:#64748b;margin-bottom:8px">Всего: <strong style="color:#a78bfa">' + dailyTotalCnt + '</strong> заявок \\u2022 Среднее/день: <strong style="color:#F59E0B">' + dailyAvg + '</strong></div>';
    h += '<div class="card" style="padding:20px"><div style="display:flex;gap:3px;align-items:flex-end;height:180px">';
    var maxD = Math.max.apply(null, daily.map(function(x){return Number(x.count)||1;}));
    for (var di = 0; di < daily.length; di++) {
      var dd = daily[di]; var dCnt = Number(dd.count) || 0; var barH = Math.max(6, Math.round((dCnt / maxD) * 140));
      var barColor = dCnt > 0 ? (di === daily.length - 1 ? '#8B5CF6' : '#4F46E5') : '#334155';
      var dayNum = (dd.day||'').slice(8);
      h += '<div style="flex:1;text-align:center;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">';
      h += '<div style="font-size:0.58rem;font-weight:700;color:' + (dCnt > 0 ? '#a78bfa' : '#475569') + ';margin-bottom:2px">' + dCnt + '</div>';
      h += '<div style="background:' + barColor + ';width:100%;height:' + barH + 'px;border-radius:3px 3px 0 0;transition:all 0.2s;position:relative" title="' + (dd.day || '') + ': ' + dCnt + ' \\u0437\\u0430\\u044f\\u0432\\u043e\\u043a, ' + fmtAmt(Number(dd.amount)||0) + '"></div>';
      if (daily.length <= 31) h += '<div style="font-size:0.52rem;color:#94a3b8;margin-top:3px;font-weight:600">' + dayNum + '</div>';
      h += '</div>';
    }
    h += '</div>';
    if (daily.length > 31) {
      h += '<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:0.65rem;color:#475569"><span>' + (daily[0]?.day||'').slice(5) + '</span><span>' + (daily[daily.length-1]?.day||'').slice(5) + '</span></div>';
    }
    h += '</div></div>';
  }

  // ===== COMMISSION ANALYTICS BLOCK (always show) =====
  var commData = d.commission_data || {};
  var byMethod = commData.by_method || [];
  h += '<div class="card" style="margin-top:20px;border:1px solid rgba(59,130,246,0.3)">';
  h += '<h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-credit-card" style="color:#3B82F6;margin-right:8px"></i>Комиссии за способы оплаты</h3>';
  // Summary KPIs
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px">';
  h += '<div style="padding:14px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:4px">Итого комиссий</div><div style="font-size:1.4rem;font-weight:800;color:#3B82F6">' + fmtAmt(commData.total_commission || 0) + '</div></div>';
  h += '<div style="padding:14px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:8px"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:4px">С методом оплаты</div><div style="font-size:1.4rem;font-weight:800;color:#22C55E">' + fmtNum(commData.leads_with_method || 0) + '</div></div>';
  h += '<div style="padding:14px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:4px">Без метода оплаты</div><div style="font-size:1.4rem;font-weight:800;color:#F59E0B">' + fmtNum(commData.leads_without_method || 0) + '</div></div>';
  h += '</div>';
  // Breakdown table
  if (byMethod.length > 0) {
    h += '<table style="width:100%;border-collapse:collapse;font-size:0.82rem"><thead><tr style="background:#1e293b;border-bottom:2px solid #334155">' +
      '<th style="padding:10px 12px;text-align:left;color:#94a3b8">Способ оплаты</th>' +
      '<th style="padding:10px 12px;text-align:center;color:#94a3b8">Комиссия %</th>' +
      '<th style="padding:10px 12px;text-align:center;color:#94a3b8">Лидов</th>' +
      '<th style="padding:10px 12px;text-align:right;color:#94a3b8">База (сумма заказов)</th>' +
      '<th style="padding:10px 12px;text-align:right;color:#94a3b8">Комиссия</th>' +
      '</tr></thead><tbody>';
    for (var ci = 0; ci < byMethod.length; ci++) {
      var cm = byMethod[ci];
      h += '<tr style="border-bottom:1px solid #334155">' +
        '<td style="padding:8px 12px;color:#e2e8f0;font-weight:600"><i class="fas fa-credit-card" style="margin-right:6px;color:#3B82F6"></i>' + escHtml(cm.name_ru) + '</td>' +
        '<td style="padding:8px 12px;text-align:center;color:#94a3b8">' + cm.pct + '%</td>' +
        '<td style="padding:8px 12px;text-align:center;color:#e2e8f0;font-weight:600">' + fmtNum(cm.count) + '</td>' +
        '<td style="padding:8px 12px;text-align:right;color:#94a3b8;white-space:nowrap">' + fmtAmt(cm.total_base) + '</td>' +
        '<td style="padding:8px 12px;text-align:right;color:#3B82F6;font-weight:700;white-space:nowrap">' + fmtAmt(cm.total_commission) + '</td></tr>';
    }
    h += '</tbody></table>';
  } else {
    h += '<div style="text-align:center;color:#64748b;padding:12px;font-size:0.82rem"><i class="fas fa-info-circle" style="margin-right:6px"></i>Нет лидов с выбранным способом оплаты в статусах «В работе / Проверка / Завершён» за выбранный период</div>';
  }
  h += '</div>';

  return h;
}

function toggleExcludeStatus(statusKey, checked) {
  if (checked) { delete excludedStatuses[statusKey]; }
  else { excludedStatuses[statusKey] = true; }
  render();
}

function toggleAllStatuses(checked) {
  var allKeys = ['new','contacted','in_progress','rejected','checking','done'];
  if (checked) {
    excludedStatuses = {};
  } else {
    for (var i = 0; i < allKeys.length; i++) { excludedStatuses[allKeys[i]] = true; }
  }
  render();
}

// ============ TAB 2: ЗАТРАТЫ И ЗП ============
function renderBizCostsV2(d, sd, fin) {
  var h = '';
  var cats = data.expenseCategories || [];
  var freqs = data.expenseFreqTypes || [];
  var exps = data.expenses || [];

  // ---- SECTION: Expense management ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-receipt" style="color:#EF4444;margin-right:8px"></i>Коммерческие затраты</h3>';
  // Categories management
  h += '<div class="card" style="padding:16px;margin-bottom:16px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h4 style="font-weight:600;color:#94a3b8">Категории затрат</h4>';
  h += '<button class="btn btn-outline" style="padding:6px 14px;font-size:0.8rem" onclick="showAddCategoryForm=!showAddCategoryForm;render()"><i class="fas fa-plus" style="margin-right:4px"></i>Категория</button></div>';
  if (showAddCategoryForm) {
    h += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center;padding:12px;background:#0f172a;border-radius:8px">';
    h += '<input type="text" id="new-cat-name" class="input" style="flex:1;min-width:150px;padding:6px 10px;font-size:0.82rem" placeholder="Название категории">';
    h += '<input type="color" id="new-cat-color" value="#8B5CF6" style="width:40px;height:32px;border:none;cursor:pointer">';
    h += '<label style="font-size:0.78rem;color:#94a3b8;display:flex;align-items:center;gap:4px"><input type="checkbox" id="new-cat-marketing"> Маркетинг</label>';
    h += '<button class="btn btn-primary" style="padding:6px 12px;font-size:0.8rem" onclick="saveNewCategory()">Сохранить</button>';
    h += '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.8rem" onclick="showAddCategoryForm=false;render()">Отмена</button></div>';
  }
  h += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
  for (var ci = 0; ci < cats.length; ci++) {
    var cat = cats[ci];
    h += '<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:0.8rem;font-weight:600;background:' + (cat.color||'#8B5CF6') + '22;color:' + (cat.color||'#8B5CF6') + ';border:1px solid ' + (cat.color||'#8B5CF6') + '44">';
    h += '<span style="width:8px;height:8px;border-radius:50%;background:' + (cat.color||'#8B5CF6') + '"></span>' + escHtml(cat.name);
    if (cat.is_marketing) h += ' <i class="fas fa-bullhorn" style="font-size:0.65rem"></i>';
    h += ' <i class="fas fa-times" style="cursor:pointer;opacity:0.5;font-size:0.65rem" onclick="deleteExpenseCategory(' + cat.id + ')"></i></span>';
  }
  h += '</div></div>';

  // Frequency types
  h += '<div class="card" style="padding:16px;margin-bottom:16px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h4 style="font-weight:600;color:#94a3b8">Типы периодичности</h4>';
  h += '<button class="btn btn-outline" style="padding:6px 14px;font-size:0.8rem" onclick="showAddFreqTypeForm=!showAddFreqTypeForm;render()"><i class="fas fa-plus" style="margin-right:4px"></i>Тип</button></div>';
  if (showAddFreqTypeForm) {
    h += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center;padding:12px;background:#0f172a;border-radius:8px">';
    h += '<input type="text" id="new-freq-name" class="input" style="flex:1;min-width:150px;padding:6px 10px;font-size:0.82rem" placeholder="Название типа">';
    h += '<button class="btn btn-primary" style="padding:6px 12px;font-size:0.8rem" onclick="saveNewFreqType()">Сохранить</button>';
    h += '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.8rem" onclick="showAddFreqTypeForm=false;render()">Отмена</button></div>';
  }
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  for (var fi = 0; fi < freqs.length; fi++) {
    var fr = freqs[fi];
    h += '<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:0.78rem;font-weight:600;background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3)">' + escHtml(fr.name);
    h += ' <i class="fas fa-times" style="cursor:pointer;opacity:0.5;font-size:0.65rem" onclick="deleteFreqType(' + fr.id + ')"></i></span>';
  }
  h += '</div></div>';

  // Expense list with add form
  h += '<div class="card" style="padding:16px;margin-bottom:16px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h4 style="font-weight:600;color:#94a3b8">Текущие затраты (' + exps.length + ')</h4>';
  h += '<button class="btn btn-primary" style="padding:8px 16px;font-size:0.85rem" onclick="showAddExpenseForm=!showAddExpenseForm;render()"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить затрату</button></div>';
  if (showAddExpenseForm) {
    h += '<div style="padding:16px;background:#0f172a;border:2px solid #8B5CF6;border-radius:10px;margin-bottom:16px">';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">';
    h += '<div><label style="font-size:0.72rem;color:#64748b">Название *</label><input class="input" id="new-exp-name" placeholder="Напр: Аренда офиса"></div>';
    h += '<div><label style="font-size:0.72rem;color:#64748b">Сумма (\\u058f) *</label><input class="input" id="new-exp-amount" type="number" placeholder="0"></div>';
    h += '<div><label style="font-size:0.72rem;color:#64748b">Категория</label><select class="input" id="new-exp-category"><option value="">— Без категории —</option>';
    for (var ci2 = 0; ci2 < cats.length; ci2++) h += '<option value="' + cats[ci2].id + '">' + escHtml(cats[ci2].name) + '</option>';
    h += '</select></div>';
    h += '<div><label style="font-size:0.72rem;color:#64748b">Периодичность</label><select class="input" id="new-exp-freq"><option value="">— Тип —</option>';
    for (var fi2 = 0; fi2 < freqs.length; fi2++) h += '<option value="' + freqs[fi2].id + '">' + escHtml(freqs[fi2].name) + '</option>';
    h += '</select></div>';
    h += '<div><label style="font-size:0.72rem;color:#64748b">Дата начала</label><input class="input" id="new-exp-start" type="date" style="width:100%;padding:6px 10px"></div>';
    h += '<div><label style="font-size:0.72rem;color:#64748b">Дата окончания <span style="font-size:0.6rem;color:#475569">(пусто = бессрочно)</span></label><input class="input" id="new-exp-end" type="date" style="width:100%;padding:6px 10px"></div>';
    h += '</div>';
    h += '<div style="margin-bottom:10px"><label style="font-size:0.72rem;color:#64748b">Заметка</label><input class="input" id="new-exp-notes" placeholder="Комментарий (опционально)"></div>';
    h += '<div style="display:flex;gap:8px"><button class="btn btn-success" onclick="saveNewExpense()"><i class="fas fa-check" style="margin-right:4px"></i>Сохранить</button>';
    h += '<button class="btn btn-outline" onclick="showAddExpenseForm=false;render()">Отмена</button></div></div>';
  }
  // Table
  if (exps.length > 0) {
    var totalExp = 0;
    h += '<table style="width:100%;border-collapse:collapse;font-size:0.85rem"><thead><tr style="border-bottom:2px solid #334155"><th style="padding:8px 12px;text-align:left;color:#94a3b8">Затрата</th><th style="padding:8px;text-align:right;color:#94a3b8">Сумма</th><th style="padding:8px;text-align:center;color:#94a3b8">Категория</th><th style="padding:8px;text-align:center;color:#94a3b8">Период</th><th style="padding:8px;text-align:center;color:#94a3b8">Действует</th><th style="padding:8px;width:50px"></th></tr></thead><tbody>';
    for (var ei = 0; ei < exps.length; ei++) {
      var exp = exps[ei]; totalExp += (exp.amount || 0);
      var expDateStr = '';
      if (exp.start_date || exp.end_date) {
        expDateStr = (exp.start_date || '...') + ' — ' + (exp.end_date || 'бессрочно');
      }
      h += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:8px 12px;font-weight:600">' + escHtml(exp.name) + (exp.notes ? '<div style="font-size:0.7rem;color:#64748b">' + escHtml(exp.notes) + '</div>' : '') + '</td>';
      h += '<td style="padding:8px;text-align:right;font-weight:600;color:#f87171">' + fmtAmt(exp.amount) + '</td>';
      h += '<td style="padding:8px;text-align:center"><span style="padding:2px 8px;border-radius:10px;font-size:0.72rem;background:' + (exp.category_color||'#475569') + '22;color:' + (exp.category_color||'#94a3b8') + '">' + escHtml(exp.category_name||'\\u2014') + '</span></td>';
      h += '<td style="padding:8px;text-align:center;font-size:0.8rem;color:#64748b">' + escHtml(exp.frequency_name||'\\u2014') + '</td>';
      h += '<td style="padding:8px;text-align:center;font-size:0.72rem;color:#475569">' + (expDateStr || '\\u2014') + '</td>';
      h += '<td style="padding:8px;white-space:nowrap"><button class="btn btn-outline" style="padding:2px 6px;font-size:0.55rem;color:#F59E0B;border-color:#F59E0B33;margin-right:3px" onclick="editingExpenseId=' + exp.id + ';render()" title="Изменить"><i class="fas fa-pencil-alt"></i></button><button class="tier-del-btn" onclick="deleteExpense(' + exp.id + ')"><i class="fas fa-trash" style="font-size:0.55rem"></i></button></td></tr>';
      // Inline edit form for this expense
      if (editingExpenseId === exp.id) {
        h += '<tr><td colspan="6" style="padding:12px 16px;background:#0f172a;border:1px solid #8B5CF6;border-radius:0">';
        h += '<div style="font-weight:700;color:#F59E0B;margin-bottom:10px;font-size:0.85rem"><i class="fas fa-pencil-alt" style="margin-right:4px"></i>Редактирование: ' + escHtml(exp.name) + '</div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">';
        h += '<div><label style="font-size:0.7rem;color:#64748b">Название</label><input class="input" id="edit-exp-name-' + exp.id + '" value="' + escHtml(exp.name||'') + '" style="width:100%;padding:6px 10px"></div>';
        h += '<div><label style="font-size:0.7rem;color:#64748b">Сумма (\\u058f)</label><input class="input" id="edit-exp-amount-' + exp.id + '" type="number" value="' + (exp.amount||0) + '" style="width:100%;padding:6px 10px"></div>';
        h += '<div><label style="font-size:0.7rem;color:#64748b">Категория</label><select class="input" id="edit-exp-cat-' + exp.id + '" style="width:100%;padding:6px 10px"><option value="">— Без категории —</option>';
        for (var eci = 0; eci < cats.length; eci++) h += '<option value="' + cats[eci].id + '"' + (exp.category_id == cats[eci].id ? ' selected' : '') + '>' + escHtml(cats[eci].name) + '</option>';
        h += '</select></div>';
        h += '<div><label style="font-size:0.7rem;color:#64748b">Периодичность</label><select class="input" id="edit-exp-freq-' + exp.id + '" style="width:100%;padding:6px 10px"><option value="">— Тип —</option>';
        for (var efi = 0; efi < freqs.length; efi++) h += '<option value="' + freqs[efi].id + '"' + (exp.frequency_type_id == freqs[efi].id ? ' selected' : '') + '>' + escHtml(freqs[efi].name) + '</option>';
        h += '</select></div>';
        h += '<div><label style="font-size:0.7rem;color:#64748b">Дата начала</label><input class="input" id="edit-exp-start-' + exp.id + '" type="date" value="' + (exp.start_date||'') + '" style="width:100%;padding:6px 10px"></div>';
        h += '<div><label style="font-size:0.7rem;color:#64748b">Дата окончания</label><input class="input" id="edit-exp-end-' + exp.id + '" type="date" value="' + (exp.end_date||'') + '" style="width:100%;padding:6px 10px"></div>';
        h += '</div>';
        h += '<div style="margin-bottom:10px"><label style="font-size:0.7rem;color:#64748b">Заметка</label><input class="input" id="edit-exp-notes-' + exp.id + '" value="' + escHtml(exp.notes||'') + '" style="width:100%;padding:6px 10px" placeholder="Комментарий"></div>';
        h += '<div style="display:flex;gap:8px"><button class="btn btn-success" style="padding:6px 14px;font-size:0.82rem" onclick="saveEditedExpense(' + exp.id + ')"><i class="fas fa-check" style="margin-right:4px"></i>Сохранить</button>';
        h += '<button class="btn btn-outline" style="padding:6px 14px;font-size:0.82rem" onclick="editingExpenseId=0;render()">Отмена</button></div>';
        h += '</td></tr>';
      }
    }
    h += '<tr style="border-top:2px solid #8B5CF6;font-weight:700"><td style="padding:10px 12px">ИТОГО</td><td style="padding:10px;text-align:right;color:#EF4444">' + fmtAmt(totalExp) + '</td><td colspan="4"></td></tr>';
    h += '</tbody></table>';
  } else {
    h += '<div style="text-align:center;padding:24px;color:#475569"><i class="fas fa-inbox" style="font-size:1.5rem;margin-bottom:8px;display:block"></i>Затраты не добавлены</div>';
  }
  h += '</div></div>';

  // ---- SECTION: Salaries ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-users-cog" style="color:#3B82F6;margin-right:8px"></i>Зарплаты и бонусы</h3>';
  // Use employees from analytics API (auto-pulled from Employees section)
  var employees = d.employees || [];
  var salaryTypeLabels = { monthly: 'Помесячно', biweekly: 'За 15 дней', per_task: 'За работу' };
  var totalSalary = 0; var totalBonus = 0; var totalFines = 0; var totalNetPay = 0; var totalVacPaid = 0; var totalVacPaidDays = 0; var totalVacUnpaidDays = 0;
  for (var si3 = 0; si3 < employees.length; si3++) {
    var empSal = Number(employees[si3].salary) || 0;
    var empBon = Number(employees[si3].bonuses_total) || 0;
    var empFin = Number(employees[si3].fines_total) || 0;
    var empVacPaid = Number(employees[si3].vacation_paid_amount) || 0;
    totalSalary += empSal; totalBonus += empBon; totalFines += empFin;
    totalVacPaid += empVacPaid;
    totalVacPaidDays += Number(employees[si3].vacation_paid_days) || 0;
    totalVacUnpaidDays += Number(employees[si3].vacation_unpaid_days) || 0;
    totalNetPay += empSal + empBon + empFin + empVacPaid;
  }
  // Summary cards (6 indicators)
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px">';
  h += '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:#94a3b8">ФОТ (зарплаты)</div><div style="font-size:1.3rem;font-weight:700;color:#3B82F6">' + fmtAmt(totalSalary) + '</div></div>';
  h += '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:#94a3b8">Бонусы</div><div style="font-size:1.3rem;font-weight:700;color:#22C55E">' + fmtAmt(totalBonus) + '</div></div>';
  h += '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:#94a3b8">Штрафы</div><div style="font-size:1.3rem;font-weight:700;color:#EF4444">' + fmtAmt(Math.abs(totalFines)) + '</div></div>';
  h += '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:#94a3b8"><i class="fas fa-umbrella-beach" style="margin-right:3px;color:#fbbf24"></i>Отпускные</div><div style="font-size:1.3rem;font-weight:700;color:#fbbf24">' + fmtAmt(totalVacPaid) + '</div><div style="font-size:0.6rem;color:#475569;margin-top:2px">' + totalVacPaidDays + ' оплач. / ' + totalVacUnpaidDays + ' неоплач. дн.</div></div>';
  h += '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:#94a3b8">Стоимость / чел.</div><div style="font-size:1.1rem;font-weight:700;color:#a78bfa">' + fmtAmt(employees.length > 0 ? Math.round(totalNetPay / employees.length) : 0) + '</div><div style="font-size:0.6rem;color:#475569;margin-top:2px">средняя на сотрудника</div></div>';
  h += '<div class="card" style="padding:14px;text-align:center;border:1px solid ' + (totalNetPay >= 0 ? '#8B5CF633' : '#EF444433') + '"><div style="font-size:0.75rem;color:#94a3b8">ИТОГО к выплате</div><div style="font-size:1.3rem;font-weight:700;color:' + (totalNetPay >= 0 ? '#a78bfa' : '#EF4444') + '">' + fmtAmt(totalNetPay) + '</div><div style="font-size:0.6rem;color:#475569;margin-top:2px">ЗП + Бонусы \\u2212 Штрафы + Отпускные</div></div>';
  h += '</div>';
  // Employee salary table — data auto-pulled from Employees
  if (employees.length > 0) {
    h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.82rem">';
    h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:10px 16px;text-align:left;color:#94a3b8">Сотрудник</th><th style="padding:10px;text-align:left;color:#94a3b8">Должность</th><th style="padding:10px;text-align:left;color:#94a3b8">Тип оплаты</th><th style="padding:10px;text-align:right;color:#94a3b8">ЗП</th><th style="padding:10px;text-align:center;color:#94a3b8">С даты</th><th style="padding:10px;text-align:center;color:#94a3b8">По дату</th><th style="padding:10px;text-align:right;color:#22C55E">Бонусы</th><th style="padding:10px;text-align:right;color:#EF4444">Штрафы</th><th style="padding:10px;text-align:right;color:#a78bfa">Итого</th><th style="padding:10px;width:90px"></th></tr></thead><tbody>';
    for (var ui = 0; ui < employees.length; ui++) {
      var u = employees[ui];
      var uSal = Number(u.salary) || 0;
      var uBonus = Number(u.bonuses_total) || 0;
      var uFines = Number(u.fines_total) || 0;
      var uNet = uSal + uBonus + uFines;
      h += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:10px 16px"><div style="font-weight:600">' + escHtml(u.display_name||u.username||'—') + '</div><div style="font-size:0.68rem;color:#64748b">' + escHtml(u.role||'') + '</div></td>';
      h += '<td style="padding:10px;color:#94a3b8;font-size:0.8rem">' + escHtml(u.position_title||'\\u2014') + '</td>';
      h += '<td style="padding:10px;font-size:0.78rem;color:#64748b">' + (salaryTypeLabels[u.salary_type||'monthly']||(u.salary_type||'monthly')) + '</td>';
      h += '<td style="padding:10px;text-align:right;font-weight:600;color:#3B82F6">' + fmtAmt(uSal) + '</td>';
      h += '<td style="padding:10px;text-align:center;font-size:0.72rem;color:#a78bfa">' + (u.hire_date || '\\u2014') + '</td>';
      h += '<td style="padding:10px;text-align:center;font-size:0.72rem;color:' + (u.end_date ? '#f87171' : '#475569') + '">' + (u.end_date || '\\u0431\\u0435\\u0441\\u0441\\u0440\\u043e\\u0447\\u043d\\u043e') + '</td>';
      h += '<td style="padding:10px;text-align:right;font-weight:600;color:#22C55E">' + (uBonus > 0 ? '+' + fmtAmt(uBonus) : '\\u2014') + '</td>';
      h += '<td style="padding:10px;text-align:right;font-weight:600;color:#EF4444">' + (uFines < 0 ? '\\u2212' + fmtAmt(Math.abs(uFines)) : '\\u2014') + '</td>';
      h += '<td style="padding:10px;text-align:right;font-weight:700;color:' + (uNet >= 0 ? '#a78bfa' : '#EF4444') + '">' + fmtAmt(uNet) + '</td>';
      h += '<td style="padding:10px"><div style="display:flex;gap:4px">';
      h += '<button class="btn btn-outline" style="padding:4px 7px;font-size:0.68rem;color:#22C55E;border-color:#22C55E44" onclick="showAddBonusUserId=' + u.id + ';addBonusType=&apos;bonus&apos;;render()" title="Добавить бонус"><i class="fas fa-plus"></i></button>';
      h += '<button class="btn btn-outline" style="padding:4px 7px;font-size:0.68rem;color:#EF4444;border-color:#EF444444" onclick="showAddBonusUserId=' + u.id + ';addBonusType=&apos;fine&apos;;render()" title="Добавить штраф"><i class="fas fa-minus"></i></button>';
      h += '<button class="btn btn-outline" style="padding:4px 7px;font-size:0.68rem;color:#64748b" onclick="toggleBonusList(' + u.id + ')" title="Показать историю"><i class="fas fa-list"></i></button>';
      h += '</div></td></tr>';
      // Bonus/fine form
      if (showAddBonusUserId === u.id) {
        var isFine = (typeof addBonusType !== 'undefined' && addBonusType === 'fine');
        h += '<tr><td colspan="10" style="padding:10px 16px;background:#0f172a"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
        h += '<span style="font-size:0.78rem;font-weight:600;color:' + (isFine ? '#EF4444' : '#22C55E') + '">' + (isFine ? '\\u0428\\u0442\\u0440\\u0430\\u0444' : '\\u0411\\u043e\\u043d\\u0443\\u0441') + ':</span>';
        h += '<input class="input" id="bonus-amount-' + u.id + '" type="number" placeholder="Сумма" style="width:120px;padding:6px 10px" min="0">';
        h += '<input class="input" id="bonus-desc-' + u.id + '" placeholder="' + (isFine ? 'Причина штрафа' : 'Описание бонуса') + '" style="flex:1;padding:6px 10px;min-width:120px">';
        h += '<input class="input" id="bonus-date-' + u.id + '" type="date" style="width:140px;padding:6px 10px" required value="' + (new Date().toISOString().slice(0,10)) + '">';
        h += '<button class="btn ' + (isFine ? 'btn-outline' : 'btn-success') + '" style="padding:6px 12px;' + (isFine ? 'color:#EF4444;border-color:#EF4444' : '') + '" onclick="saveBonus(' + u.id + ',&apos;' + (isFine ? 'fine' : 'bonus') + '&apos;)"><i class="fas fa-check"></i></button>';
        h += '<button class="btn btn-outline" style="padding:6px 12px" onclick="showAddBonusUserId=0;render()"><i class="fas fa-times"></i></button>';
        h += '</div></td></tr>';
      }
      // Bonus/fine list (expandable)
      if (showBonusListUserId === u.id && bonusListData.length > 0) {
        h += '<tr><td colspan="10" style="padding:0;background:#0f172a"><table style="width:100%;border-collapse:collapse;font-size:0.75rem">';
        h += '<tr style="border-bottom:1px solid #1e293b"><th style="padding:6px 16px;text-align:left;color:#475569">Тип</th><th style="padding:6px;text-align:left;color:#475569">Описание</th><th style="padding:6px;text-align:right;color:#475569">Сумма</th><th style="padding:6px;text-align:center;color:#475569">Дата</th><th style="padding:6px;width:70px"></th></tr>';
        for (var bi = 0; bi < bonusListData.length; bi++) {
          var b = bonusListData[bi];
          var bType = b.bonus_type === 'fine' ? 'fine' : 'bonus';
          var bColor = bType === 'fine' ? '#EF4444' : '#22C55E';
          var bAmt = Number(b.amount) || 0;
          if (editingBonusId === b.id) {
            // Inline edit mode
            h += '<tr style="border-bottom:1px solid #1e293b22;background:#0f172a">';
            h += '<td style="padding:5px 16px;color:' + bColor + ';font-weight:600">' + (bType === 'fine' ? '\\u0428\\u0442\\u0440\\u0430\\u0444' : '\\u0411\\u043e\\u043d\\u0443\\u0441') + '</td>';
            h += '<td style="padding:5px"><input class="input" id="edit-bonus-desc-' + b.id + '" value="' + escHtml(b.description || '') + '" style="padding:4px 8px;font-size:0.75rem;width:100%"></td>';
            h += '<td style="padding:5px"><input class="input" id="edit-bonus-amt-' + b.id + '" type="number" value="' + Math.abs(bAmt) + '" style="padding:4px 8px;font-size:0.75rem;width:80px;text-align:right" min="0"></td>';
            h += '<td style="padding:5px"><input class="input" id="edit-bonus-date-' + b.id + '" type="date" value="' + (b.bonus_date || '') + '" style="padding:4px 6px;font-size:0.72rem"></td>';
            h += '<td style="padding:5px;text-align:center;white-space:nowrap">';
            h += '<button class="btn btn-success" style="padding:2px 6px;font-size:0.6rem;margin-right:2px" onclick="saveBonusEdit(' + b.id + ',' + u.id + ',&apos;' + bType + '&apos;)" title="\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0438\\u0442\\u044c"><i class="fas fa-check"></i></button>';
            h += '<button class="btn btn-outline" style="padding:2px 6px;font-size:0.6rem" onclick="editingBonusId=0;render()" title="\\u041e\\u0442\\u043c\\u0435\\u043d\\u0430"><i class="fas fa-times"></i></button>';
            h += '</td></tr>';
          } else {
            h += '<tr style="border-bottom:1px solid #1e293b22">';
            h += '<td style="padding:5px 16px;color:' + bColor + ';font-weight:600">' + (bType === 'fine' ? '\\u0428\\u0442\\u0440\\u0430\\u0444' : '\\u0411\\u043e\\u043d\\u0443\\u0441') + '</td>';
            h += '<td style="padding:5px;color:#94a3b8">' + escHtml(b.description || '\\u2014') + '</td>';
            h += '<td style="padding:5px;text-align:right;font-weight:600;color:' + bColor + '">' + (bAmt < 0 ? '\\u2212' : '+') + fmtAmt(Math.abs(bAmt)) + '</td>';
            h += '<td style="padding:5px;text-align:center;color:#64748b">' + (b.bonus_date || '\\u2014') + '</td>';
            h += '<td style="padding:5px;text-align:center;white-space:nowrap">';
            h += '<button class="btn btn-outline" style="padding:2px 6px;font-size:0.6rem;color:#F59E0B;border-color:#F59E0B33;margin-right:2px" onclick="editingBonusId=' + b.id + ';render()" title="\\u0420\\u0435\\u0434\\u0430\\u043a\\u0442\\u0438\\u0440\\u043e\\u0432\\u0430\\u0442\\u044c"><i class="fas fa-pencil-alt"></i></button>';
            h += '<button class="btn btn-outline" style="padding:2px 6px;font-size:0.6rem;color:#EF4444;border-color:#EF444433" onclick="deleteBonus(' + b.id + ',' + u.id + ')" title="\\u0423\\u0434\\u0430\\u043b\\u0438\\u0442\\u044c"><i class="fas fa-trash"></i></button>';
            h += '</td></tr>';
          }
        }
        h += '</table></td></tr>';
      } else if (showBonusListUserId === u.id) {
        h += '<tr><td colspan="10" style="padding:10px 16px;background:#0f172a;color:#64748b;font-size:0.78rem;text-align:center">Нет записей бонусов / штрафов</td></tr>';
      }
    }
    h += '<tr style="border-top:2px solid #8B5CF6;font-weight:700"><td style="padding:10px 16px">ИТОГО</td><td colspan="3"></td>';
    h += '<td style="padding:10px;text-align:right;color:#3B82F6">' + fmtAmt(totalSalary) + '</td>';
    h += '<td></td><td></td>';
    h += '<td style="padding:10px;text-align:right;color:#22C55E">' + fmtAmt(totalBonus) + '</td>';
    h += '<td style="padding:10px;text-align:right;color:#EF4444">' + (totalFines < 0 ? '\\u2212' + fmtAmt(Math.abs(totalFines)) : '\\u2014') + '</td>';
    h += '<td style="padding:10px;text-align:right;color:#a78bfa">' + fmtAmt(totalNetPay) + '</td>';
    h += '<td></td></tr>';
    h += '</tbody></table></div>';
  } else {
    h += '<div class="card" style="padding:24px;text-align:center;color:#475569"><i class="fas fa-user-slash" style="margin-right:8px"></i>Нет сотрудников с установленной зарплатой. Добавьте через раздел «Сотрудники».</div>';
  }
  h += '</div>';

  // ---- SECTION: Lost Revenue (Discounts as hidden cost) ----
  var promoD2 = d.promo_costs || {};
  var promoKeys3 = Object.keys(promoD2);
  var totalDiscCost2 = Number(d.total_discount_cost || 0);
  var totalDiscLeads2 = Number(d.total_discount_leads || 0);
  var svcBeforeDisc2 = Number(d.services_before_discount || 0);
  {
    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-hand-holding-usd" style="color:#FBBF24;margin-right:8px"></i>Упущенная выручка (скидки)</h3>';
    h += '<div style="font-size:0.78rem;color:#64748b;margin-bottom:12px">Скидки клиентам по промокодам — это выручка, от которой вы отказались. Ниже — полная картина стоимости скидок.</div>';
    if (promoKeys3.length === 0 && totalDiscCost2 === 0) {
      h += '<div class="card" style="padding:24px;text-align:center;color:#64748b"><i class="fas fa-hand-holding-usd" style="font-size:1.5rem;margin-bottom:8px;display:block;color:#475569"></i>Нет данных по скидкам за выбранный период. Когда лидам будут назначены промокоды, здесь появится отчёт по стоимости скидок.</div>';
    }
    // KPI cards
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px">';
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #FBBF24"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-tags" style="color:#FBBF24;margin-right:4px"></i>Активных промокодов</div><div style="font-size:1.5rem;font-weight:800;color:#FBBF24">' + promoKeys3.length + '</div></div>';
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #EF4444;background:rgba(239,68,68,0.04)"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-money-bill-wave" style="color:#EF4444;margin-right:4px"></i>Общая сумма скидок</div><div style="font-size:1.5rem;font-weight:800;color:#EF4444">' + (totalDiscCost2 > 0 ? '-' : '') + fmtAmt(totalDiscCost2) + '</div><div style="font-size:0.58rem;color:#475569;margin-top:2px">упущенная выручка</div></div>';
    var avgDiscPerLead2 = totalDiscLeads2 > 0 ? Math.round(totalDiscCost2 / totalDiscLeads2) : 0;
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #F59E0B"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-user-tag" style="color:#F59E0B;margin-right:4px"></i>Ср. скидка / лид</div><div style="font-size:1.5rem;font-weight:800;color:#F59E0B">' + fmtAmt(avgDiscPerLead2) + '</div><div style="font-size:0.58rem;color:#475569;margin-top:2px">' + totalDiscLeads2 + ' лидов</div></div>';
    var discRatePct2 = svcBeforeDisc2 > 0 ? (totalDiscCost2 / svcBeforeDisc2 * 100).toFixed(1) : '0';
    h += '<div class="card" style="padding:14px;text-align:center;border-left:3px solid #a78bfa"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-percent" style="color:#a78bfa;margin-right:4px"></i>Доля от выручки услуг</div><div style="font-size:1.5rem;font-weight:800;color:#a78bfa">' + discRatePct2 + '%</div><div style="font-size:0.58rem;color:#475569;margin-top:2px">от ' + fmtAmt(svcBeforeDisc2) + '</div></div>';
    h += '</div>';
    // Compare discount cost vs other expense categories
    var totalExpensesAll = 0;
    for (var ei2 = 0; ei2 < exps.length; ei2++) totalExpensesAll += (Number(exps[ei2].amount) || 0);
    var discVsExpPct = totalExpensesAll > 0 ? (totalDiscCost2 / totalExpensesAll * 100).toFixed(1) : '0';
    var discVsSalPct = totalSalary > 0 ? (totalDiscCost2 / totalSalary * 100).toFixed(1) : '0';
    h += '<div class="card" style="padding:16px;margin-bottom:16px;background:rgba(251,191,36,0.05);border-color:#FBBF2433">';
    h += '<div style="font-weight:700;color:#FBBF24;margin-bottom:10px;font-size:0.88rem"><i class="fas fa-balance-scale" style="margin-right:6px"></i>Сравнение скидок с расходами</div>';
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">';
    // Bar 1: Discounts vs Total expenses
    h += '<div><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:6px">Скидки / Все затраты</div>';
    h += '<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:8px;background:#1e293b;border-radius:4px;overflow:hidden"><div style="width:' + Math.min(100, Number(discVsExpPct)) + '%;height:100%;background:linear-gradient(90deg,#FBBF24,#EF4444);border-radius:4px"></div></div>';
    h += '<span style="font-weight:700;color:#FBBF24;font-size:0.88rem;min-width:45px;text-align:right">' + discVsExpPct + '%</span></div>';
    h += '<div style="font-size:0.62rem;color:#475569;margin-top:3px">' + fmtAmt(totalDiscCost2) + ' vs ' + fmtAmt(totalExpensesAll) + '</div></div>';
    // Bar 2: Discounts vs Salaries
    h += '<div><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:6px">Скидки / ФОТ</div>';
    h += '<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:8px;background:#1e293b;border-radius:4px;overflow:hidden"><div style="width:' + Math.min(100, Number(discVsSalPct)) + '%;height:100%;background:linear-gradient(90deg,#FBBF24,#3B82F6);border-radius:4px"></div></div>';
    h += '<span style="font-weight:700;color:#3B82F6;font-size:0.88rem;min-width:45px;text-align:right">' + discVsSalPct + '%</span></div>';
    h += '<div style="font-size:0.62rem;color:#475569;margin-top:3px">' + fmtAmt(totalDiscCost2) + ' vs ' + fmtAmt(totalSalary) + '</div></div>';
    // Bar 3: What could have been (revenue without discounts)
    var revenueWithoutDisc = (Number(fin.services) || 0) + totalDiscCost2;
    var actualPct2 = revenueWithoutDisc > 0 ? ((Number(fin.services) || 0) / revenueWithoutDisc * 100).toFixed(1) : '100';
    h += '<div><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:6px">Факт vs Потенциал выручки</div>';
    h += '<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;height:8px;background:#1e293b;border-radius:4px;overflow:hidden"><div style="width:' + actualPct2 + '%;height:100%;background:linear-gradient(90deg,#22C55E,#8B5CF6);border-radius:4px"></div></div>';
    h += '<span style="font-weight:700;color:#22C55E;font-size:0.88rem;min-width:45px;text-align:right">' + actualPct2 + '%</span></div>';
    h += '<div style="font-size:0.62rem;color:#475569;margin-top:3px">' + fmtAmt(Number(fin.services) || 0) + ' из ' + fmtAmt(revenueWithoutDisc) + '</div></div>';
    h += '</div></div>';
    // Per-code breakdown table
    if (promoKeys3.length > 0) {
      var sortedPromo2 = promoKeys3.sort(function(a,b) { return (promoD2[b].discount_total||0) - (promoD2[a].discount_total||0); });
      h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.82rem">';
      h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:8px 14px;text-align:left;color:#94a3b8">Промокод</th><th style="padding:8px;text-align:center;color:#94a3b8">Скидка %</th><th style="padding:8px;text-align:center;color:#94a3b8">Лидов</th><th style="padding:8px;text-align:right;color:#94a3b8">Подитог услуг</th><th style="padding:8px;text-align:right;color:#94a3b8">Стоимость скидки</th><th style="padding:8px;text-align:right;color:#94a3b8">Факт. оплата</th><th style="padding:8px;text-align:right;color:#94a3b8">Доля скидки</th></tr></thead><tbody>';
      for (var pi2 = 0; pi2 < sortedPromo2.length; pi2++) {
        var pk2 = sortedPromo2[pi2]; var pc2 = promoD2[pk2]; var cd22 = pc2.code_details || {};
        var pcDiscPct2 = pc2.services_total > 0 ? (pc2.discount_total / pc2.services_total * 100).toFixed(1) : '0';
        h += '<tr style="border-bottom:1px solid #1e293b">';
        h += '<td style="padding:8px 14px;font-weight:700;color:#a78bfa"><i class="fas fa-tag" style="margin-right:4px;color:#8B5CF6"></i>' + escHtml(pk2) + '</td>';
        h += '<td style="padding:8px;text-align:center;color:#fbbf24;font-weight:600">' + (cd22.discount_percent || 0) + '%</td>';
        h += '<td style="padding:8px;text-align:center;font-weight:600">' + pc2.count + '</td>';
        h += '<td style="padding:8px;text-align:right;color:#94a3b8">' + fmtAmt(pc2.services_total || 0) + '</td>';
        h += '<td style="padding:8px;text-align:right;color:#EF4444;font-weight:700">' + (pc2.discount_total > 0 ? '-' + fmtAmt(pc2.discount_total) : '0 ֏') + '</td>';
        h += '<td style="padding:8px;text-align:right;color:#10B981;font-weight:600">' + fmtAmt(pc2.revenue || 0) + '</td>';
        h += '<td style="padding:8px;text-align:right"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><div style="width:50px;height:5px;background:#1e293b;border-radius:3px;overflow:hidden"><div style="width:' + Math.min(100, Number(pcDiscPct2)) + '%;height:100%;background:#FBBF24;border-radius:3px"></div></div><span style="font-size:0.75rem;font-weight:600;color:#FBBF24">' + pcDiscPct2 + '%</span></div></td>';
        h += '</tr>';
      }
      var totalSvcBefore2 = 0, totalDiscSum2 = 0, totalRevPromo = 0;
      sortedPromo2.forEach(function(k) { totalSvcBefore2 += (promoD2[k].services_total||0); totalDiscSum2 += (promoD2[k].discount_total||0); totalRevPromo += (promoD2[k].revenue||0); });
      var totalDiscPctAll = totalSvcBefore2 > 0 ? (totalDiscSum2 / totalSvcBefore2 * 100).toFixed(1) : '0';
      h += '<tr style="border-top:2px solid #FBBF24;font-weight:700"><td style="padding:10px 14px">ИТОГО</td><td></td><td style="padding:8px;text-align:center">' + totalDiscLeads2 + '</td>';
      h += '<td style="padding:8px;text-align:right;color:#94a3b8">' + fmtAmt(totalSvcBefore2) + '</td>';
      h += '<td style="padding:8px;text-align:right;color:#EF4444;font-weight:800">' + (totalDiscSum2 > 0 ? '-' + fmtAmt(totalDiscSum2) : '0 ֏') + '</td>';
      h += '<td style="padding:8px;text-align:right;color:#10B981;font-weight:700">' + fmtAmt(totalRevPromo) + '</td>';
      h += '<td style="padding:8px;text-align:right;color:#FBBF24;font-weight:700">' + totalDiscPctAll + '%</td></tr>';
      h += '</tbody></table></div>';
    }
    // Monthly discount trend (costs perspective)
    var mDiscounts2 = d.monthly_discounts || {};
    var mDiscKeys2 = Object.keys(mDiscounts2).sort();
    if (mDiscKeys2.length > 0) {
      var maxMDisc = 0;
      mDiscKeys2.forEach(function(k) { var v = Number(mDiscounts2[k].discount_total||0); if(v>maxMDisc) maxMDisc=v; });
      h += '<div style="margin-top:16px">';
      h += '<h4 style="font-weight:600;font-size:0.92rem;color:#e2e8f0;margin-bottom:10px"><i class="fas fa-chart-bar" style="color:#FBBF24;margin-right:6px"></i>Динамика скидок по месяцам</h4>';
      h += '<div class="card" style="padding:20px">';
      h += '<div style="display:flex;gap:8px;align-items:flex-end;height:120px;padding-bottom:24px">';
      var mNames4 = ['','Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
      for (var md2i = 0; md2i < mDiscKeys2.length; md2i++) {
        var md2k = mDiscKeys2[md2i]; var md2v = mDiscounts2[md2k];
        var md2Amt = Number(md2v.discount_total || 0);
        var barH2 = maxMDisc > 0 ? Math.max(4, Math.round((md2Amt / maxMDisc) * 90)) : 4;
        var md2MNum = parseInt(md2k.split('-')[1]);
        h += '<div style="flex:1;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">';
        h += '<div style="font-size:0.58rem;font-weight:700;color:' + (md2Amt > 0 ? '#EF4444' : '#475569') + ';margin-bottom:2px">' + (md2Amt > 0 ? fmtAmt(md2Amt) : '') + '</div>';
        h += '<div style="background:' + (md2Amt > 0 ? 'linear-gradient(180deg,#FBBF24,#EF4444)' : '#334155') + ';width:100%;max-width:40px;height:' + barH2 + 'px;border-radius:3px 3px 0 0"></div>';
        h += '<div style="font-size:0.6rem;color:#94a3b8;margin-top:4px">' + (mNames4[md2MNum] || '') + '</div>';
        h += '</div>';
      }
      h += '</div></div></div>';
    }
    h += '</div>';
  }

  // ===== COMMISSION BLOCK IN COSTS =====
  var commDataCost = d.commission_data || {};
  var byMethodCost = commDataCost.by_method || [];
  h += '<div style="margin-top:24px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-credit-card" style="color:#3B82F6;margin-right:8px"></i>Комиссии за способы оплаты</h3>';
  h += '<div class="card" style="padding:20px;border:1px solid rgba(59,130,246,0.2)">';
  h += '<div style="font-size:0.82rem;color:#94a3b8;margin-bottom:12px"><i class="fas fa-info-circle" style="margin-right:6px;color:#3B82F6"></i>Комиссия оплачивается клиентом сверх суммы заказа. Не является расходом компании, но важна для понимания реальной стоимости для клиента.</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px">';
  h += '<div style="padding:14px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px"><div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px">Итого комиссий</div><div style="font-size:1.3rem;font-weight:800;color:#3B82F6">' + fmtAmt(commDataCost.total_commission || 0) + '</div></div>';
  h += '<div style="padding:14px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:8px"><div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px">С методом оплаты</div><div style="font-size:1.3rem;font-weight:800;color:#22C55E">' + fmtNum(commDataCost.leads_with_method || 0) + '</div></div>';
  h += '<div style="padding:14px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px"><div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px">Без метода оплаты</div><div style="font-size:1.3rem;font-weight:800;color:#F59E0B">' + fmtNum(commDataCost.leads_without_method || 0) + '</div></div>';
  h += '</div>';
  if (byMethodCost.length > 0) {
    h += '<table style="width:100%;border-collapse:collapse;font-size:0.82rem"><thead><tr style="background:#1e293b;border-bottom:2px solid #334155">' +
      '<th style="padding:8px 12px;text-align:left;color:#94a3b8">Способ оплаты</th>' +
      '<th style="padding:8px;text-align:center;color:#94a3b8">%</th>' +
      '<th style="padding:8px;text-align:center;color:#94a3b8">Лидов</th>' +
      '<th style="padding:8px;text-align:right;color:#94a3b8">База</th>' +
      '<th style="padding:8px;text-align:right;color:#94a3b8">Комиссия</th>' +
      '</tr></thead><tbody>';
    for (var cci = 0; cci < byMethodCost.length; cci++) {
      var ccm = byMethodCost[cci];
      h += '<tr style="border-bottom:1px solid #1e293b">' +
        '<td style="padding:8px 12px;color:#e2e8f0;font-weight:600"><i class="fas fa-credit-card" style="margin-right:6px;color:#3B82F6;font-size:0.7rem"></i>' + escHtml(ccm.name_ru) + '</td>' +
        '<td style="padding:8px;text-align:center;color:#94a3b8">' + ccm.pct + '%</td>' +
        '<td style="padding:8px;text-align:center;color:#e2e8f0;font-weight:600">' + fmtNum(ccm.count) + '</td>' +
        '<td style="padding:8px;text-align:right;color:#94a3b8;white-space:nowrap">' + fmtAmt(ccm.total_base) + '</td>' +
        '<td style="padding:8px;text-align:right;color:#3B82F6;font-weight:700;white-space:nowrap">' + fmtAmt(ccm.total_commission) + '</td></tr>';
    }
    h += '</tbody></table>';
  } else {
    h += '<div style="text-align:center;color:#64748b;padding:12px;font-size:0.82rem"><i class="fas fa-info-circle" style="margin-right:6px"></i>\\u041d\\u0435\\u0442 \\u043b\\u0438\\u0434\\u043e\\u0432 \\u0441 \\u043a\\u043e\\u043c\\u0438\\u0441\\u0441\\u0438\\u0435\\u0439 \\u0432 \\u0440\\u0430\\u0431\\u043e\\u0447\\u0438\\u0445 \\u0441\\u0442\\u0430\\u0442\\u0443\\u0441\\u0430\\u0445 \\u0437\\u0430 \\u0432\\u044b\\u0431\\u0440\\u0430\\u043d\\u043d\\u044b\\u0439 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434</div>';
  }
  h += '</div></div>';

  return h;
}

// ============ TAB 3: ВОРОНКА И ДЕТАЛИ ============
function renderBizFunnelV2(d, sd, fin) {
  var h = '';
  var totalLeads = d.total_leads || 1;
  var stageTimings = d.stage_timings || {};
  // ---- SECTION: Visual funnel ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-funnel-dollar" style="color:#8B5CF6;margin-right:8px"></i>\\u0412\\u043e\\u0440\\u043e\\u043d\\u043a\\u0430 \\u043f\\u0440\\u043e\\u0434\\u0430\\u0436</h3>';
  var funnelStages = [
    {key:'new',label:'\\u041d\\u043e\\u0432\\u044b\\u0435 \\u043b\\u0438\\u0434\\u044b',color:'#10B981'},
    {key:'contacted',label:'\\u041a\\u043e\\u043d\\u0442\\u0430\\u043a\\u0442',color:'#3B82F6'},
    {key:'in_progress',label:'\\u0412 \\u0440\\u0430\\u0431\\u043e\\u0442\\u0435',color:'#F59E0B'},
    {key:'checking',label:'\\u041f\\u0440\\u043e\\u0432\\u0435\\u0440\\u043a\\u0430',color:'#8B5CF6'},
    {key:'done',label:'\\u0417\\u0430\\u0432\\u0435\\u0440\\u0448\\u0435\\u043d\\u043e',color:'#22C55E'}
  ];
  var totalF = 0; for (var fi3 = 0; fi3 < funnelStages.length; fi3++) totalF += (Number((sd[funnelStages[fi3].key]||{}).count)||0);
  h += '<div class="card" style="padding:24px">';
  var prevCnt = totalF;
  for (var fi4 = 0; fi4 < funnelStages.length; fi4++) {
    var fs = funnelStages[fi4]; var fv = sd[fs.key] || {};
    var cnt = Number(fv.count) || 0; var widthPct = totalF > 0 ? Math.max(15, Math.round(cnt / totalF * 100)) : 15;
    var funnelW = 100 - (fi4 * 12); // tapering effect
    var convFromPrev = prevCnt > 0 && fi4 > 0 ? ((cnt / prevCnt) * 100).toFixed(1) : '';
    var stageDays = stageTimings[fs.key] || 0;
    h += '<div style="margin-bottom:10px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
    h += '<span style="font-size:0.85rem;font-weight:600;color:' + fs.color + '">' + fs.label;
    if (stageDays > 0) h += ' <span style="font-size:0.65rem;color:#64748b;font-weight:400">(~' + stageDays + ' \\u0434\\u043d)</span>';
    h += '</span>';
    var fvSvc = Number(fv.services)||0; var fvArt = Number(fv.articles)||0; var fvAmt = Number(fv.amount)||0;
    h += '<span style="font-size:0.85rem;font-weight:700">' + cnt + ' <span style="color:#64748b;font-weight:400">(' + fmtAmt(fvAmt) + ')</span>';
    if (convFromPrev) h += ' <span style="font-size:0.68rem;padding:2px 6px;border-radius:8px;background:rgba(139,92,246,0.15);color:#a78bfa;margin-left:6px">\\u2192 ' + convFromPrev + '%</span>';
    h += '</span></div>';
    h += '<div style="display:flex;gap:12px;margin-bottom:4px;padding-left:4px">';
    h += '<span style="font-size:0.68rem;color:#8B5CF6"><i class="fas fa-concierge-bell" style="margin-right:2px"></i>\\u0423\\u0441\\u043b: ' + fmtAmt(fvSvc) + '</span>';
    h += '<span style="font-size:0.68rem;color:#F59E0B"><i class="fas fa-box" style="margin-right:2px"></i>\\u0412\\u044b\\u043a: ' + fmtAmt(fvArt) + '</span>';
    h += '</div>';
    h += '<div style="width:' + funnelW + '%;margin:0 auto;height:32px;background:#0f172a;border-radius:6px;overflow:hidden">';
    h += '<div style="height:100%;width:' + widthPct + '%;background:linear-gradient(90deg,' + fs.color + ',' + fs.color + '88);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:white;transition:width 0.5s">' + (cnt > 0 ? cnt : '') + '</div></div>';
    h += '</div>';
    prevCnt = cnt;
  }
  // Rejected
  var rejected = sd.rejected || {};
  var rejCnt = Number(rejected.count) || 0;
  h += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid #334155">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center"><span style="color:#EF4444;font-weight:600"><i class="fas fa-times-circle" style="margin-right:4px"></i>\\u041e\\u0442\\u043a\\u043b\\u043e\\u043d\\u0435\\u043d\\u043e</span>';
  h += '<span style="font-weight:700">' + rejCnt + ' (' + fmtAmt(Number(rejected.amount)||0) + ') <span style="font-size:0.72rem;color:#64748b">' + (totalLeads > 0 ? ((rejCnt / totalLeads * 100).toFixed(1) + '% \\u043e\\u0442\\u043a\\u0430\\u0437\\u043e\\u0432') : '') + '</span></span></div>';
  h += '</div></div>';

  // Conversion metrics with clear descriptions
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px">';
  h += '<div class="card" style="text-align:center;padding:18px"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:6px"><i class="fas fa-percentage" style="margin-right:4px"></i>\\u041a\\u043e\\u043d\\u0432\\u0435\\u0440\\u0441\\u0438\\u044f</div><div style="font-size:2rem;font-weight:900;color:#8B5CF6">' + fmtPct(fin.conversion_rate) + '</div><div style="font-size:0.6rem;color:#475569;margin-top:4px">Завершённые \\u00f7 Все лиды за период</div></div>';
  h += '<div class="card" style="text-align:center;padding:18px"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:6px"><i class="fas fa-ban" style="margin-right:4px"></i>\\u041e\\u0442\\u043a\\u0430\\u0437\\u044b</div><div style="font-size:2rem;font-weight:900;color:#EF4444">' + (d.total_leads > 0 ? ((rejCnt / d.total_leads) * 100).toFixed(1) : '0') + '%</div><div style="font-size:0.6rem;color:#475569;margin-top:4px">Отклонённые \\u00f7 Все лиды</div></div>';
  h += '<div class="card" style="text-align:center;padding:18px"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:6px"><i class="fas fa-clock" style="margin-right:4px"></i>\\u0421\\u0440. \\u0432\\u044b\\u043f\\u043e\\u043b\\u043d\\u0435\\u043d\\u0438\\u0435</div><div style="font-size:2rem;font-weight:900;color:#3B82F6">' + (Number(fin.avg_fulfillment_days)||0) + ' <span style="font-size:0.9rem">\\u0434\\u043d</span></div><div style="font-size:0.6rem;color:#475569;margin-top:4px">Среднее время от создания до завершения</div></div>';
  h += '<div class="card" style="text-align:center;padding:18px"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:6px"><i class="fas fa-shopping-cart" style="margin-right:4px"></i>\\u0421\\u0440. \\u0447\\u0435\\u043a (\\u0443\\u0441\\u043b\\u0443\\u0433\\u0438)</div><div style="font-size:2rem;font-weight:900;color:#F59E0B">' + fmtAmt(fin.avg_check) + '</div><div style="font-size:0.6rem;color:#475569;margin-top:4px">Только услуги завершённых (без выкупов)</div></div>';
  h += '</div></div>';

  // ---- SECTION: Rejection reasons ----
  var rejLeads = d.rejected_leads || [];
  if (rejLeads.length > 0) {
    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-exclamation-circle" style="color:#EF4444;margin-right:8px"></i>\\u041f\\u0440\\u0438\\u0447\\u0438\\u043d\\u044b \\u043e\\u0442\\u043a\\u0430\\u0437\\u043e\\u0432</h3>';
    h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.82rem">';
    h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:10px 16px;text-align:left;color:#94a3b8">\\u041b\\u0438\\u0434</th><th style="padding:10px;text-align:left;color:#94a3b8">\\u041a\\u043e\\u043d\\u0442\\u0430\\u043a\\u0442</th><th style="padding:10px;text-align:right;color:#94a3b8">\\u0421\\u0443\\u043c\\u043c\\u0430</th><th style="padding:10px;text-align:left;color:#94a3b8">\\u041f\\u0440\\u0438\\u0447\\u0438\\u043d\\u0430 / \\u0417\\u0430\\u043c\\u0435\\u0442\\u043a\\u0438</th></tr></thead><tbody>';
    for (var ri = 0; ri < Math.min(rejLeads.length, 20); ri++) {
      var rl2 = rejLeads[ri];
      h += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:8px 16px;font-weight:600">#' + (rl2.id||'') + ' ' + escHtml(rl2.name||'\\u2014') + '</td>';
      h += '<td style="padding:8px;color:#94a3b8">' + escHtml(rl2.contact||'\\u2014') + '</td>';
      h += '<td style="padding:8px;text-align:right;font-weight:600;color:#f87171">' + fmtAmt(Number(rl2.total_amount)||0) + '</td>';
      h += '<td style="padding:8px;color:#e2e8f0;max-width:300px;overflow:hidden;text-overflow:ellipsis">' + escHtml(rl2.notes||'\\u041d\\u0435 \\u0443\\u043a\\u0430\\u0437\\u0430\\u043d\\u0430') + '</td></tr>';
    }
    h += '</tbody></table></div></div>';
  }

  // ---- SECTION: By source ----
  var bySource = d.by_source || {};
  var sourceKeys = Object.keys(bySource);
  if (sourceKeys.length > 0) {
    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-globe" style="color:#F59E0B;margin-right:8px"></i>\\u0418\\u0441\\u0442\\u043e\\u0447\\u043d\\u0438\\u043a\\u0438</h3>';
    var srcLabels = { form: '\\u0424\\u043e\\u0440\\u043c\\u0430 \\u043d\\u0430 \\u0441\\u0430\\u0439\\u0442\\u0435', popup: '\\u041f\\u043e\\u043f\\u0430\\u043f', calculator_pdf: '\\u0414\\u043e\\u0431\\u0430\\u0432\\u043b\\u0435\\u043d\\u044b \\u0432\\u0440\\u0443\\u0447\\u043d\\u0443\\u044e', manual: '\\u0414\\u043e\\u0431\\u0430\\u0432\\u043b\\u0435\\u043d\\u044b \\u0432\\u0440\\u0443\\u0447\\u043d\\u0443\\u044e', direct: '\\u041f\\u0440\\u044f\\u043c\\u043e\\u0439', admin_panel: '\\u0414\\u043e\\u0431\\u0430\\u0432\\u043b\\u0435\\u043d\\u044b \\u0432\\u0440\\u0443\\u0447\\u043d\\u0443\\u044e (\\u0441\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u043a)' };
    h += '<div class="card" style="padding:16px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
    for (var ski = 0; ski < sourceKeys.length; ski++) {
      var sk = sourceKeys[ski]; var sv = bySource[sk];
      h += '<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #1e293b"><span style="color:#94a3b8">' + escHtml(srcLabels[sk] || sk || '\\u041f\\u0440\\u044f\\u043c\\u043e\\u0439') + '</span><span style="font-weight:600">' + (Number(sv?.count)||sv||0) + ' / ' + fmtAmt(Number(sv?.amount)||0) + '</span></div>';
    }
    h += '</div></div></div>';
  }

  // ---- SECTION: Popular services ----
  var services = d.services || [];
  if (services.length > 0) {
    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-fire" style="color:#EF4444;margin-right:8px"></i>\\u041f\\u043e\\u043f\\u0443\\u043b\\u044f\\u0440\\u043d\\u044b\\u0435 \\u0443\\u0441\\u043b\\u0443\\u0433\\u0438</h3>';
    h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.85rem">';
    h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:10px 16px;text-align:left;color:#94a3b8">#</th><th style="padding:10px;text-align:left;color:#94a3b8">\\u0423\\u0441\\u043b\\u0443\\u0433\\u0430</th><th style="padding:10px;text-align:center;color:#94a3b8">\\u0417\\u0430\\u043a\\u0430\\u0437\\u043e\\u0432</th><th style="padding:10px;text-align:center;color:#94a3b8">\\u041a\\u043e\\u043b-\\u0432\\u043e</th><th style="padding:10px;text-align:right;color:#94a3b8">\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430</th><th style="padding:10px;text-align:right;color:#94a3b8">%</th></tr></thead><tbody>';
    var totalSvcRev = services.reduce(function(a, s) { return a + (Number(s.revenue)||0); }, 0);
    for (var svi = 0; svi < Math.min(services.length, 15); svi++) {
      var svc = services[svi]; var svcPctV = totalSvcRev > 0 ? ((Number(svc.revenue) / totalSvcRev) * 100).toFixed(1) : '0';
      var barW = totalSvcRev > 0 ? Math.round((Number(svc.revenue) / totalSvcRev) * 100) : 0;
      h += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:8px 16px;color:#64748b">' + (svi+1) + '</td>';
      h += '<td style="padding:8px;font-weight:600">' + escHtml(svc.name) + '</td>';
      h += '<td style="padding:8px;text-align:center;color:#94a3b8">' + (svc.count||0) + '</td>';
      h += '<td style="padding:8px;text-align:center;color:#94a3b8">' + (svc.qty||svc.count||0) + '</td>';
      h += '<td style="padding:8px;text-align:right;font-weight:700;color:#a78bfa">' + fmtAmt(Number(svc.revenue)||0) + '</td>';
      h += '<td style="padding:8px;text-align:right"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><div style="width:60px;height:5px;background:#1e293b;border-radius:3px;overflow:hidden"><div style="width:' + barW + '%;height:100%;background:#8B5CF6;border-radius:3px"></div></div><span style="font-size:0.75rem;font-weight:600">' + svcPctV + '%</span></div></td></tr>';
    }
    h += '</tbody></table></div></div>';
  }

  // ---- SECTION: Package sales analytics ----
  var packages = d.packages || [];
  if (packages.length > 0) {
    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-box-open" style="color:#F59E0B;margin-right:8px"></i>\\u041f\\u0440\\u043e\\u0434\\u0430\\u0436\\u0438 \\u043f\\u0430\\u043a\\u0435\\u0442\\u043e\\u0432</h3>';
    h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.85rem">';
    h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:10px 16px;text-align:left;color:#94a3b8">#</th><th style="padding:10px;text-align:left;color:#94a3b8">\\u041f\\u0430\\u043a\\u0435\\u0442</th><th style="padding:10px;text-align:center;color:#94a3b8">\\u041f\\u0440\\u043e\\u0434\\u0430\\u043d\\u043e</th><th style="padding:10px;text-align:right;color:#94a3b8">\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430</th><th style="padding:10px;text-align:right;color:#94a3b8">%</th></tr></thead><tbody>';
    var totalPkgRev = packages.reduce(function(a, p) { return a + (Number(p.revenue)||0); }, 0);
    for (var pki = 0; pki < packages.length; pki++) {
      var pkStat = packages[pki];
      var pkPct = totalPkgRev > 0 ? ((Number(pkStat.revenue) / totalPkgRev) * 100).toFixed(1) : '0';
      var pkBarW = totalPkgRev > 0 ? Math.round((Number(pkStat.revenue) / totalPkgRev) * 100) : 0;
      h += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:8px 16px;color:#64748b">' + (pki+1) + '</td>';
      h += '<td style="padding:8px;font-weight:600"><i class="fas fa-box-open" style="color:#F59E0B;margin-right:4px"></i>' + escHtml(pkStat.package_name || 'Unknown') + '</td>';
      h += '<td style="padding:8px;text-align:center;font-weight:700;color:#F59E0B">' + (pkStat.count||0) + '</td>';
      h += '<td style="padding:8px;text-align:right;font-weight:700;color:#a78bfa">' + fmtAmt(Number(pkStat.revenue)||0) + '</td>';
      h += '<td style="padding:8px;text-align:right"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><div style="width:60px;height:5px;background:#1e293b;border-radius:3px;overflow:hidden"><div style="width:' + pkBarW + '%;height:100%;background:#F59E0B;border-radius:3px"></div></div><span style="font-size:0.75rem;font-weight:600">' + pkPct + '%</span></div></td></tr>';
    }
    h += '</tbody></table></div>';
    // Total package revenue summary
    h += '<div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap">';
    h += '<div class="card" style="padding:14px 20px;flex:1;min-width:160px;border-left:3px solid #F59E0B;background:rgba(245,158,11,0.05)">';
    h += '<div style="font-size:0.72rem;color:#94a3b8">\\u0412\\u0441\\u0435\\u0433\\u043e \\u043f\\u0440\\u043e\\u0434\\u0430\\u043d\\u043e \\u043f\\u0430\\u043a\\u0435\\u0442\\u043e\\u0432</div>';
    h += '<div style="font-size:1.4rem;font-weight:800;color:#F59E0B">' + packages.reduce(function(a, p) { return a + (Number(p.count)||0); }, 0) + '</div>';
    h += '</div>';
    h += '<div class="card" style="padding:14px 20px;flex:1;min-width:160px;border-left:3px solid #8B5CF6;background:rgba(139,92,246,0.05)">';
    h += '<div style="font-size:0.72rem;color:#94a3b8">\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 \\u043e\\u0442 \\u043f\\u0430\\u043a\\u0435\\u0442\\u043e\\u0432</div>';
    h += '<div style="font-size:1.4rem;font-weight:800;color:#8B5CF6">' + fmtAmt(totalPkgRev) + '</div>';
    h += '</div>';
    var avgPkgCheck = packages.reduce(function(a, p) { return a + (Number(p.count)||0); }, 0);
    h += '<div class="card" style="padding:14px 20px;flex:1;min-width:160px;border-left:3px solid #22C55E;background:rgba(34,197,94,0.05)">';
    h += '<div style="font-size:0.72rem;color:#94a3b8">\\u0421\\u0440. \\u0447\\u0435\\u043a \\u043f\\u0430\\u043a\\u0435\\u0442\\u0430</div>';
    h += '<div style="font-size:1.4rem;font-weight:800;color:#22C55E">' + fmtAmt(avgPkgCheck > 0 ? Math.round(totalPkgRev / avgPkgCheck) : 0) + '</div>';
    h += '</div></div>';
    h += '</div>';
  }

  // ---- SECTION: Referral Conversion Comparison ----
  // Count leads with and without promo codes, their conversion to 'done'
  var allLeadsRaw = d.all_leads_status || [];
  var allPC = d.promo_costs || {};
  var allPCKeys = Object.keys(allPC);
  {
    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-exchange-alt" style="color:#FBBF24;margin-right:8px"></i>Эффективность промокодов: конверсия и средний чек</h3>';
    h += '<div style="font-size:0.78rem;color:#64748b;margin-bottom:12px">Сравнение поведения лидов с промокодом и без — помогает оценить ROI скидочной программы.</div>';
    if (allPCKeys.length === 0) {
      h += '<div class="card" style="padding:24px;text-align:center;color:#64748b"><i class="fas fa-exchange-alt" style="font-size:1.5rem;margin-bottom:8px;display:block;color:#475569"></i>Нет данных для сравнения. Когда лидам будут применены промокоды, здесь появится сравнение конверсии и среднего чека.</div>';
    } else {
    var withPromoTotal = 0, withPromoDone = 0, withPromoRev = 0, withPromoSvc = 0;
    var withoutPromoTotal = 0, withoutPromoDone = 0, withoutPromoRev = 0, withoutPromoSvc = 0;
    // Use per-code data: total leads with promo codes
    allPCKeys.forEach(function(k) { 
      var pc3 = allPC[k]; 
      withPromoTotal += pc3.count;
      withPromoRev += pc3.revenue;
      withPromoSvc += (pc3.services_total||0);
      if (pc3.leads) {
        for (var lpi = 0; lpi < pc3.leads.length; lpi++) {
          if (pc3.leads[lpi].status === 'done') withPromoDone++;
        }
      }
    });
    var totalAllLeads = Number(d.total_leads || 0);
    withoutPromoTotal = totalAllLeads - withPromoTotal;
    var doneAll = Number((sd.done || {}).count || 0);
    withoutPromoDone = doneAll - withPromoDone;
    var svcAll = Number(fin.services || 0);
    withoutPromoSvc = svcAll - withPromoSvc;
    var amtAll = Number(fin.turnover || 0);
    withoutPromoRev = amtAll - withPromoRev;
    var convWithPromo = withPromoTotal > 0 ? (withPromoDone / withPromoTotal * 100).toFixed(1) : '0';
    var convWithoutPromo = withoutPromoTotal > 0 ? (withoutPromoDone / withoutPromoTotal * 100).toFixed(1) : '0';
    var avgCheckPromo = withPromoDone > 0 ? Math.round(withPromoSvc / withPromoDone) : 0;
    var avgCheckNoPromo = withoutPromoDone > 0 ? Math.round(withoutPromoSvc / withoutPromoDone) : 0;

    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">';
    // Card: With promo
    h += '<div class="card" style="padding:20px;border-left:3px solid #FBBF24;background:rgba(251,191,36,0.04)">';
    h += '<div style="font-size:0.82rem;font-weight:700;color:#FBBF24;margin-bottom:12px"><i class="fas fa-tag" style="margin-right:6px"></i>С промокодом</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    h += '<div><div style="font-size:0.68rem;color:#94a3b8">Лидов</div><div style="font-size:1.3rem;font-weight:800;color:#FBBF24">' + withPromoTotal + '</div></div>';
    h += '<div><div style="font-size:0.68rem;color:#94a3b8">Конверсия</div><div style="font-size:1.3rem;font-weight:800;color:' + (Number(convWithPromo) > Number(convWithoutPromo) ? '#22C55E' : '#EF4444') + '">' + convWithPromo + '%</div></div>';
    h += '<div><div style="font-size:0.68rem;color:#94a3b8">Завершено</div><div style="font-size:1.3rem;font-weight:800;color:#22C55E">' + withPromoDone + '</div></div>';
    h += '<div><div style="font-size:0.68rem;color:#94a3b8">Ср. чек (услуги)</div><div style="font-size:1.1rem;font-weight:800;color:#8B5CF6">' + fmtAmt(avgCheckPromo) + '</div></div>';
    h += '</div>';
    h += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #334155"><div style="font-size:0.68rem;color:#94a3b8;margin-bottom:4px">Выручка</div><div style="font-size:1.1rem;font-weight:700;color:#10B981">' + fmtAmt(withPromoRev) + '</div></div>';
    h += '</div>';
    // Card: Without promo
    h += '<div class="card" style="padding:20px;border-left:3px solid #3B82F6;background:rgba(59,130,246,0.04)">';
    h += '<div style="font-size:0.82rem;font-weight:700;color:#3B82F6;margin-bottom:12px"><i class="fas fa-user" style="margin-right:6px"></i>Без промокода</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    h += '<div><div style="font-size:0.68rem;color:#94a3b8">Лидов</div><div style="font-size:1.3rem;font-weight:800;color:#3B82F6">' + withoutPromoTotal + '</div></div>';
    h += '<div><div style="font-size:0.68rem;color:#94a3b8">Конверсия</div><div style="font-size:1.3rem;font-weight:800;color:' + (Number(convWithoutPromo) > Number(convWithPromo) ? '#22C55E' : '#EF4444') + '">' + convWithoutPromo + '%</div></div>';
    h += '<div><div style="font-size:0.68rem;color:#94a3b8">Завершено</div><div style="font-size:1.3rem;font-weight:800;color:#22C55E">' + withoutPromoDone + '</div></div>';
    h += '<div><div style="font-size:0.68rem;color:#94a3b8">Ср. чек (услуги)</div><div style="font-size:1.1rem;font-weight:800;color:#8B5CF6">' + fmtAmt(avgCheckNoPromo) + '</div></div>';
    h += '</div>';
    h += '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #334155"><div style="font-size:0.68rem;color:#94a3b8;margin-bottom:4px">Выручка</div><div style="font-size:1.1rem;font-weight:700;color:#10B981">' + fmtAmt(withoutPromoRev) + '</div></div>';
    h += '</div>';
    h += '</div>';
    // Insight box
    var convDiff = (Number(convWithPromo) - Number(convWithoutPromo)).toFixed(1);
    var checkDiff = avgCheckPromo - avgCheckNoPromo;
    h += '<div class="card" style="padding:14px 18px;background:rgba(139,92,246,0.05);border-color:#8B5CF633">';
    h += '<div style="font-weight:700;color:#a78bfa;margin-bottom:8px;font-size:0.82rem"><i class="fas fa-lightbulb" style="margin-right:6px"></i>Выводы</div>';
    h += '<div style="display:flex;gap:20px;flex-wrap:wrap;font-size:0.8rem">';
    h += '<div style="color:#e2e8f0"><span style="color:#94a3b8">Конверсия:</span> промо ' + (Number(convDiff) >= 0 ? '<span style="color:#22C55E">+' + convDiff + '%</span>' : '<span style="color:#EF4444">' + convDiff + '%</span>') + ' vs обычные</div>';
    h += '<div style="color:#e2e8f0"><span style="color:#94a3b8">Ср. чек:</span> промо ' + (checkDiff >= 0 ? '<span style="color:#22C55E">+' + fmtAmt(checkDiff) + '</span>' : '<span style="color:#EF4444">' + fmtAmt(checkDiff) + '</span>') + ' vs обычные</div>';
    var discCostAll = Number(d.total_discount_cost || 0);
    var promoRevenueGain = withPromoRev;
    var promoROI = discCostAll > 0 ? ((promoRevenueGain / discCostAll - 1) * 100).toFixed(0) : '∞';
    h += '<div style="color:#e2e8f0"><span style="color:#94a3b8">ROI скидок:</span> <span style="color:' + (Number(promoROI) > 0 || promoROI === '∞' ? '#22C55E' : '#EF4444') + ';font-weight:700">' + promoROI + '%</span> <span style="color:#475569;font-size:0.68rem">(выручка промо / стоимость скидок)</span></div>';
    h += '</div></div>';
    } // end else (allPCKeys.length > 0)
    h += '</div>';
  }

  // ---- SECTION: PROMO CODE ANALYTICS ----
  var promoCosts = d.promo_costs || {};
  var promoKeys = Object.keys(promoCosts);
  {
    var totalDiscCost = Number(d.total_discount_cost || 0);
    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-gift" style="color:#8B5CF6;margin-right:8px"></i>Аналитика промокодов</h3>';
    if (promoKeys.length === 0) {
      h += '<div class="card" style="padding:24px;text-align:center;color:#64748b"><i class="fas fa-gift" style="font-size:1.5rem;margin-bottom:8px;display:block;color:#475569"></i>Нет использованных промокодов за выбранный период. Добавьте промокод в разделе «Реферальные коды» и примените к лиду.</div>';
    }
    
    // KPIs
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">';
    h += '<div class="card" style="padding:16px;text-align:center;background:rgba(139,92,246,0.08);border-color:#8B5CF633"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-tags" style="margin-right:4px"></i>Промокодов использовано</div><div style="font-size:1.8rem;font-weight:800;color:#8B5CF6">' + promoKeys.length + '</div></div>';
    var promoLeadsTotal = 0; promoKeys.forEach(function(k) { promoLeadsTotal += promoCosts[k].count; });
    h += '<div class="card" style="padding:16px;text-align:center;background:rgba(16,185,129,0.08);border-color:#10B98133"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-users" style="margin-right:4px"></i>Лидов с промокодами</div><div style="font-size:1.8rem;font-weight:800;color:#10B981">' + promoLeadsTotal + '</div></div>';
    h += '<div class="card" style="padding:16px;text-align:center;background:rgba(239,68,68,0.08);border-color:#EF444433"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-hand-holding-usd" style="margin-right:4px"></i>Общая стоимость скидок</div><div style="font-size:1.8rem;font-weight:800;color:#EF4444">' + fmtAmt(totalDiscCost) + '</div></div>';
    var promoRevTotal = 0; promoKeys.forEach(function(k) { promoRevTotal += promoCosts[k].revenue; });
    h += '<div class="card" style="padding:16px;text-align:center;background:rgba(59,130,246,0.08);border-color:#3B82F633"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-coins" style="margin-right:4px"></i>Выручка с промокодами</div><div style="font-size:1.8rem;font-weight:800;color:#3B82F6">' + fmtAmt(promoRevTotal) + '</div></div>';
    h += '</div>';
    
    // Table
    h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.85rem">';
    h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:10px 16px;text-align:left;color:#94a3b8">Промокод</th><th style="padding:10px;text-align:center;color:#94a3b8">Скидка %</th><th style="padding:10px;text-align:center;color:#94a3b8">Лидов</th><th style="padding:10px;text-align:right;color:#94a3b8">Стоимость скидки</th><th style="padding:10px;text-align:right;color:#94a3b8">Ср. скидка / лид</th><th style="padding:10px;text-align:right;color:#94a3b8">Выручка</th><th style="padding:10px;text-align:center;color:#94a3b8">Статус</th></tr></thead><tbody>';
    var sortedPromo = promoKeys.sort(function(a,b) { return promoCosts[b].discount_total - promoCosts[a].discount_total; });
    for (var pri = 0; pri < sortedPromo.length; pri++) {
      var pk = sortedPromo[pri]; var pc = promoCosts[pk]; var cd2 = pc.code_details || {};
      var avgDisc = pc.count > 0 ? Math.round(pc.discount_total / pc.count) : 0;
      var isActive = cd2.is_active !== 0;
      h += '<tr style="border-bottom:1px solid #1e293b">';
      h += '<td style="padding:8px 16px;font-weight:700;color:#a78bfa"><i class="fas fa-tag" style="margin-right:6px;color:#8B5CF6"></i>' + escHtml(pk) + (cd2.description ? '<div style="font-size:0.68rem;color:#64748b;margin-top:2px">' + escHtml(cd2.description) + '</div>' : '') + '</td>';
      h += '<td style="padding:8px;text-align:center;font-weight:600;color:#fbbf24">' + (cd2.discount_percent || 0) + '%</td>';
      h += '<td style="padding:8px;text-align:center;font-weight:600">' + pc.count + '</td>';
      h += '<td style="padding:8px;text-align:right;font-weight:700;color:#EF4444">' + (pc.discount_total > 0 ? '-' + fmtAmt(pc.discount_total) : '0 ֏') + '</td>';
      h += '<td style="padding:8px;text-align:right;color:#94a3b8">' + fmtAmt(avgDisc) + '</td>';
      h += '<td style="padding:8px;text-align:right;font-weight:600;color:#10B981">' + fmtAmt(pc.revenue) + '</td>';
      h += '<td style="padding:8px;text-align:center"><span class="badge ' + (isActive ? 'badge-green' : 'badge-red') + '">' + (isActive ? 'Актив' : 'Неактив') + '</span></td>';
      h += '</tr>';
    }
    h += '</tbody></table></div>';
    // Service-specific discounts configured per referral code
    var refCodeSvcs = d.ref_code_services || {};
    var hasCodeSvcs = Object.keys(refCodeSvcs).length > 0;
    if (hasCodeSvcs) {
      h += '<div style="margin-top:16px">';
      h += '<h4 style="font-weight:600;font-size:0.92rem;color:#e2e8f0;margin-bottom:10px"><i class="fas fa-percentage" style="color:#FBBF24;margin-right:6px"></i>Скидки на конкретные услуги (по кодам)</h4>';
      h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.82rem">';
      h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:8px 14px;text-align:left;color:#94a3b8">Код</th><th style="padding:8px 14px;text-align:left;color:#94a3b8">Услуга</th><th style="padding:8px;text-align:center;color:#94a3b8">Скидка</th><th style="padding:8px;text-align:center;color:#94a3b8">Кол-во</th><th style="padding:8px;text-align:right;color:#94a3b8">Цена</th><th style="padding:8px;text-align:right;color:#94a3b8">Тип</th></tr></thead><tbody>';
      var rcKeys = Object.keys(refCodeSvcs);
      for (var rci = 0; rci < rcKeys.length; rci++) {
        var rcCode = rcKeys[rci]; var rcSvcs = refCodeSvcs[rcCode];
        for (var rcsi = 0; rcsi < rcSvcs.length; rcsi++) {
          var rcs = rcSvcs[rcsi];
          var isFreeRc = rcs.discount_percent === 0 || rcs.discount_percent >= 100;
          var typeLabel = isFreeRc ? '<span class="badge badge-green" style="font-size:0.68rem">Бесплатно</span>' : '<span class="badge badge-amber" style="font-size:0.68rem">-' + rcs.discount_percent + '%</span>';
          h += '<tr style="border-bottom:1px solid #1e293b">';
          h += '<td style="padding:6px 14px;font-weight:600;color:#a78bfa">' + (rcsi === 0 ? '<i class="fas fa-tag" style="margin-right:4px;color:#8B5CF6"></i>' + escHtml(rcCode) : '') + '</td>';
          h += '<td style="padding:6px 14px;color:#e2e8f0">' + escHtml(rcs.service_name || '\\u2014') + '</td>';
          h += '<td style="padding:6px 8px;text-align:center;font-weight:600;color:#fbbf24">' + (isFreeRc ? '100%' : rcs.discount_percent + '%') + '</td>';
          h += '<td style="padding:6px 8px;text-align:center;color:#94a3b8">' + (rcs.quantity || 1) + '</td>';
          h += '<td style="padding:6px 8px;text-align:right;color:#94a3b8">' + fmtAmt(rcs.price || 0) + '</td>';
          h += '<td style="padding:6px 8px;text-align:right">' + typeLabel + '</td></tr>';
        }
      }
      h += '</tbody></table></div></div>';
    }
    // Per-lead discount details (expandable)
    var allPromoLeads = [];
    promoKeys.forEach(function(k) { 
      var pc2 = promoCosts[k]; 
      if (pc2.leads) { 
        for (var pli = 0; pli < pc2.leads.length; pli++) { 
          pc2.leads[pli]._code = k; 
          allPromoLeads.push(pc2.leads[pli]); 
        } 
      } 
    });
    if (allPromoLeads.length > 0) {
      allPromoLeads.sort(function(a,b) { return b.discount - a.discount; });
      h += '<div style="margin-top:16px">';
      h += '<h4 style="font-weight:600;font-size:0.92rem;color:#e2e8f0;margin-bottom:10px;cursor:pointer" onclick="toggleSection(&apos;promo-leads-body&apos;,&apos;promo-leads-arrow&apos;)"><i class="fas fa-list" style="color:#3B82F6;margin-right:6px"></i>Детализация скидок по лидам (' + allPromoLeads.length + ') <i id="promo-leads-arrow" class="fas fa-chevron-right" style="font-size:0.7rem;color:#64748b;margin-left:6px;transition:transform 0.2s"></i></h4>';
      h += '<div id="promo-leads-body" style="display:none">';
      h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.8rem">';
      h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:8px 12px;text-align:left;color:#94a3b8">#</th><th style="padding:8px 12px;text-align:left;color:#94a3b8">Клиент</th><th style="padding:8px;text-align:center;color:#94a3b8">Код</th><th style="padding:8px;text-align:center;color:#94a3b8">Статус</th><th style="padding:8px;text-align:right;color:#94a3b8">Услуги</th><th style="padding:8px;text-align:right;color:#94a3b8">Скидка</th><th style="padding:8px;text-align:right;color:#94a3b8">Итого</th><th style="padding:8px;text-align:right;color:#94a3b8">Дата</th></tr></thead><tbody>';
      var statusLabels2 = {new:'\\uD83D\\uDFE2 Новый',contacted:'\\uD83D\\uDCAC Связь',in_progress:'\\uD83D\\uDD04 Работа',checking:'\\uD83D\\uDD0D Проверка',done:'\\u2705 Готов',rejected:'\\u274C Откл'};
      for (var pli2 = 0; pli2 < Math.min(allPromoLeads.length, 50); pli2++) {
        var pl = allPromoLeads[pli2];
        h += '<tr style="border-bottom:1px solid #1e293b;cursor:pointer" onclick="navigate(&apos;leads&apos;);setTimeout(function(){handleCardClick({stopPropagation:function(){}},'+pl.id+')},500)">';
        h += '<td style="padding:6px 12px;color:#a78bfa;font-weight:600">#' + pl.id + '</td>';
        h += '<td style="padding:6px 12px;color:#e2e8f0">' + escHtml(pl.name || '\\u2014') + '</td>';
        h += '<td style="padding:6px 8px;text-align:center"><span class="badge badge-purple" style="font-size:0.68rem">' + escHtml(pl._code) + '</span></td>';
        h += '<td style="padding:6px 8px;text-align:center;font-size:0.72rem">' + (statusLabels2[pl.status] || pl.status) + '</td>';
        h += '<td style="padding:6px 8px;text-align:right;color:#94a3b8">' + fmtAmt(pl.services || 0) + '</td>';
        h += '<td style="padding:6px 8px;text-align:right;color:#EF4444;font-weight:600">' + (pl.discount > 0 ? '-' + fmtAmt(pl.discount) : '0 \\u058f') + '</td>';
        h += '<td style="padding:6px 8px;text-align:right;color:#e2e8f0;font-weight:600">' + fmtAmt(pl.total) + '</td>';
        h += '<td style="padding:6px 8px;text-align:right;color:#64748b;font-size:0.72rem;white-space:nowrap">' + (pl.date ? pl.date.substring(0,10) : '') + '</td>';
        h += '</tr>';
      }
      h += '</tbody></table></div></div></div>';
    }
    // Monthly discount trend
    var mDiscounts = d.monthly_discounts || {};
    var mDiscKeys = Object.keys(mDiscounts).sort();
    if (mDiscKeys.length > 1) {
      h += '<div style="margin-top:16px">';
      h += '<h4 style="font-weight:600;font-size:0.92rem;color:#e2e8f0;margin-bottom:10px"><i class="fas fa-chart-area" style="color:#EF4444;margin-right:6px"></i>Скидки по месяцам</h4>';
      h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.82rem">';
      h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:8px 14px;text-align:left;color:#94a3b8">Месяц</th><th style="padding:8px;text-align:center;color:#94a3b8">Лидов</th><th style="padding:8px;text-align:right;color:#94a3b8">Сумма скидок</th><th style="padding:8px;text-align:right;color:#94a3b8">Подитог услуг</th><th style="padding:8px;text-align:right;color:#94a3b8">% скидок</th></tr></thead><tbody>';
      var mNames3 = ['','Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
      for (var mdi = 0; mdi < mDiscKeys.length; mdi++) {
        var mdKey = mDiscKeys[mdi]; var mdVal = mDiscounts[mdKey];
        var mdMonthNum = parseInt(mdKey.split('-')[1]);
        var mdPct = mdVal.services_before > 0 ? (mdVal.discount_total / mdVal.services_before * 100).toFixed(1) : '0';
        h += '<tr style="border-bottom:1px solid #1e293b">';
        h += '<td style="padding:6px 14px;font-weight:600;color:#e2e8f0">' + (mNames3[mdMonthNum] || mdKey) + ' ' + mdKey.split('-')[0] + '</td>';
        h += '<td style="padding:6px 8px;text-align:center;color:#94a3b8">' + (mdVal.leads_count || 0) + '</td>';
        h += '<td style="padding:6px 8px;text-align:right;color:#EF4444;font-weight:600">' + (mdVal.discount_total > 0 ? '-' + fmtAmt(mdVal.discount_total) : '0 \\u058f') + '</td>';
        h += '<td style="padding:6px 8px;text-align:right;color:#94a3b8">' + fmtAmt(mdVal.services_before || 0) + '</td>';
        h += '<td style="padding:6px 8px;text-align:right;color:#fbbf24;font-weight:600">' + mdPct + '%</td>';
        h += '</tr>';
      }
      h += '</tbody></table></div></div>';
    }
    h += '</div>';
  }

  // ===== COMMISSION SUMMARY IN FUNNEL =====
  var commDataFun = d.commission_data || {};
  var totalCommFun = commDataFun.total_commission || 0;
  if (totalCommFun > 0 || (commDataFun.leads_with_method || 0) > 0) {
    h += '<div class="card" style="margin-top:20px;padding:20px;border:1px solid rgba(59,130,246,0.2)">';
    h += '<h3 style="font-weight:700;margin-bottom:12px;font-size:0.95rem"><i class="fas fa-credit-card" style="color:#3B82F6;margin-right:8px"></i>Влияние комиссий на стоимость для клиента</h3>';
    var funnelTurnover = Number(fin.turnover || 0);
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">';
    h += '<div style="padding:14px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:8px"><div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px">\\u041e\\u0431\\u043e\\u0440\\u043e\\u0442 (base)</div><div style="font-size:1.2rem;font-weight:800;color:#a78bfa">' + fmtAmt(funnelTurnover) + '</div></div>';
    h += '<div style="padding:14px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px"><div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px">\\u041a\\u043e\\u043c\\u0438\\u0441\\u0441\\u0438\\u0438</div><div style="font-size:1.2rem;font-weight:800;color:#3B82F6">+' + fmtAmt(totalCommFun) + '</div></div>';
    h += '<div style="padding:14px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:8px"><div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px">\\u0418\\u0442\\u043e\\u0433\\u043e \\u043a \\u043e\\u043f\\u043b\\u0430\\u0442\\u0435 \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u0430\\u043c\\u0438</div><div style="font-size:1.2rem;font-weight:800;color:#10B981">' + fmtAmt(funnelTurnover + totalCommFun) + '</div></div>';
    h += '<div style="padding:14px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px"><div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px">\\u041b\\u0438\\u0434\\u043e\\u0432 \\u0441 \\u043e\\u043f\\u043b\\u0430\\u0442\\u043e\\u0439</div><div style="font-size:1.2rem;font-weight:800;color:#F59E0B">' + fmtNum(commDataFun.leads_with_method || 0) + '</div></div>';
    h += '</div></div>';
  }

  return h;
}

// ============ TAB 4: ДЕТАЛЬНЫЕ ПОКАЗАТЕЛИ ============
function renderBizPeriodsV2(d, sd, fin) {
  var h = '';
  var now = new Date();
  var currentYear = now.getFullYear();
  var currentMonth = now.getMonth() + 1;
  var currentQ = Math.ceil(currentMonth / 3);
  var snapshots = data.periodSnapshots || [];
  var monthlyData = d.monthly_data || [];

  // ---- SECTION: Year overview in numbers (no graphs) ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-list-ol" style="color:#8B5CF6;margin-right:8px"></i>Показатели ' + currentYear + ' по месяцам</h3>';
  // Numeric table of months
  h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.78rem">';
  h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155">';
  h += '<th style="padding:8px 12px;text-align:left;color:#94a3b8;white-space:nowrap">Месяц</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#22C55E;white-space:nowrap" title="Завершённые лиды">Закрытые</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#F59E0B;white-space:nowrap" title="В работе / на связи">В работе</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#EF4444;white-space:nowrap" title="Отказы">Отказы</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#3B82F6;white-space:nowrap" title="На проверке">Проверка</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#a78bfa;white-space:nowrap" title="Услуги + Выкупы (оплата клиента)">Приход (итого)</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#F59E0B;white-space:nowrap">Выкупы</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#f87171;white-space:nowrap" title="Возвраты клиентам от выкупов">Возврат</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#8B5CF6;white-space:nowrap">Услуги</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#FBBF24;white-space:nowrap" title="Скидки по промокодам">Скидки</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#EF4444;white-space:nowrap">Расходы</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#22C55E;white-space:nowrap" title="Услуги - Расходы">Прибыль</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#F59E0B;white-space:nowrap" title="Налоги за месяц">Налоги</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#EF4444;white-space:nowrap" title="Платежи по кредитам">Кредиты</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#8B5CF6;white-space:nowrap" title="Дивиденды за месяц">Дивид.</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#10B981;white-space:nowrap" title="Прибыль после налогов">Чистая</th>';
  h += '<th style="padding:8px 6px;text-align:center;color:#94a3b8;white-space:nowrap">Статус</th>';
  h += '<th style="padding:8px 6px;width:60px"></th>';
  h += '</tr></thead><tbody>';
  var monthNames = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  var yearTotals = {done:0, inProgress:0, rejected:0, checking:0, turnover:0, services:0, articles:0, refunds:0, expenses:0, profit:0, taxes:0, loanPayments:0, dividends:0, netProfit:0, discounts:0};
  for (var mi3 = 1; mi3 <= 12; mi3++) {
    var mKey = currentYear + '-' + String(mi3).padStart(2,'0');
    var mSnap = snapshots.find(function(s){return s.period_type==='month' && s.period_key===mKey;});
    var mData = monthlyData.find(function(m){return m.month===mKey;});
    var isCurrent = mi3 === currentMonth;
    var isPast = mi3 < currentMonth;
    var isFuture = mi3 > currentMonth;
    var isLocked = mSnap && mSnap.is_locked;
    var isEditing = editingMonthKey === mKey;
    // Lead counts by status
    var mDone, mInProg, mRejected, mChecking;
    var mSvc, mArt, mRefunds, mExp, mProfit, mTurnover;
    // Check for snapshot adjustments (works for any month that has a snapshot)
    var mAdjs = [];
    var mAdjTotal = 0;
    var mExpSal = 0, mExpComm = 0, mExpMkt = 0; // Split expenses for edit form
    if (mSnap) { try { var cd5 = JSON.parse(mSnap.custom_data || '{}'); mAdjs = cd5.adjustments || []; if (!mAdjs.length && cd5.adjustment) { mAdjs = [{amount: Math.abs(cd5.adjustment), type: cd5.adjustment_type || 'inflow', comment: cd5.adjustment_comment || ''}]; } for (var aj = 0; aj < mAdjs.length; aj++) { var a5 = mAdjs[aj]; mAdjTotal += a5.type === 'outflow' ? -Math.abs(a5.amount) : Math.abs(a5.amount); } } catch(e) {} }
    if (isLocked) {
      // From snapshot
      mDone = Number(mSnap.leads_done)||0;
      var snapCD = {}; try { snapCD = JSON.parse(mSnap.custom_data || '{}'); } catch(e) {}
      mInProg = Number(snapCD.in_progress_count)||0;
      mRejected = Number(snapCD.rejected_count)||0;
      mChecking = Number(snapCD.checking_count)||0;
      mSvc = Number(mSnap.revenue_services)||0;
      mArt = Number(mSnap.revenue_articles)||0;
      mRefunds = Number(mSnap.refunds)||0;
      mExpSal = Math.abs(Number(mSnap.expense_salaries)||0);
      mExpComm = Math.abs(Number(mSnap.expense_commercial)||0);
      mExpMkt = Math.abs(Number(mSnap.expense_marketing)||0);
      mExp = mExpSal + mExpComm + mExpMkt;
      mTurnover = mSvc + mArt;
      mProfit = mSvc - mExp + mAdjTotal;
    } else if ((isCurrent || isPast) && mData) {
      // ALWAYS use monthly_data for both current and past months — this data
      // is grouped by actual created_at month, not affected by date picker
      mDone = Number(mData.done_count)||0;
      mInProg = (Number(mData.in_progress_count)||0) + (Number(mData.contacted_count)||0);
      mRejected = Number(mData.rejected_count)||0;
      mChecking = Number(mData.checking_count)||0;
      mSvc = Number(mData.services)||0;
      mArt = Number(mData.articles)||0;
      mRefunds = Number(mData.refunds)||0;
      // Try to get expenses from salSummaryCache (loaded async)
      if (isCurrent) {
        // For current month, prefer live expense data if available
        mExpSal = (Number(fin.salaries)||0) + (Number(fin.bonuses)||0) + (Number(fin.fines)||0);
        mExpComm = Number(fin.commercial_expenses)||0;
        mExpMkt = Number(fin.marketing_expenses)||0;
        mExp = Number(fin.total_expenses)||0;
      } else {
        var cachedSal = salSummaryCache[mKey];
        if (cachedSal) {
          mExpSal = Number(cachedSal.expense_salaries) || 0;
          mExpComm = Number(cachedSal.commercial_expenses) || 0;
          mExpMkt = Number(cachedSal.marketing_expenses) || 0;
          mExp = mExpSal + mExpComm + mExpMkt;
        } else {
          mExp = 0;
        }
      }
      mTurnover = mSvc + mArt;
      mProfit = mSvc - mExp + mAdjTotal;
    } else if (isCurrent) {
      // Fallback: current month but no mData (first day, no leads yet)
      mDone = 0; mInProg = 0; mRejected = 0; mChecking = 0;
      mSvc = 0; mArt = 0; mRefunds = 0;
      mExpSal = (Number(fin.salaries)||0) + (Number(fin.bonuses)||0) + (Number(fin.fines)||0);
      mExpComm = Number(fin.commercial_expenses)||0;
      mExpMkt = Number(fin.marketing_expenses)||0;
      mExp = Number(fin.total_expenses)||0;
      mTurnover = 0;
      mProfit = -mExp + mAdjTotal;
    } else {
      mDone = 0; mInProg = 0; mRejected = 0; mChecking = 0;
      mSvc = 0; mArt = 0; mRefunds = 0; mExp = 0; mTurnover = 0; mProfit = 0;
    }
    // Tax data for this month (from tax_payments in bulk data)
    var mTaxes = 0;
    var allTaxPayments = data.taxPayments || [];
    for (var ti = 0; ti < allTaxPayments.length; ti++) {
      if (allTaxPayments[ti].period_key === mKey) mTaxes += Number(allTaxPayments[ti].amount) || 0;
    }
    // Loan payments for this month (from loanPayments in bulk data)
    var mLoanPayments = 0;
    var allLoanPayments = data.loanPayments || [];
    for (var li = 0; li < allLoanPayments.length; li++) {
      var lpDate = allLoanPayments[li].payment_date || '';
      if (lpDate >= mKey + '-01' && lpDate <= mKey + '-31') mLoanPayments += Number(allLoanPayments[li].amount) || 0;
    }
    // Dividends for this month
    var mDivs = 0;
    var allDivs = data.dividends || [];
    for (var di = 0; di < allDivs.length; di++) {
      if (allDivs[di].period_key === mKey) mDivs += (Number(allDivs[di].amount) || 0) + (Number(allDivs[di].tax_amount) || 0);
    }
    var mNetProfit = mProfit - mTaxes - mLoanPayments - mDivs;
    yearTotals.done += mDone; yearTotals.inProgress += mInProg;
    yearTotals.rejected += mRejected; yearTotals.checking += mChecking;
    yearTotals.turnover += mTurnover; yearTotals.services += mSvc;
    yearTotals.articles += mArt; yearTotals.refunds += mRefunds;
    yearTotals.expenses += mExp; yearTotals.profit += mProfit;
    yearTotals.taxes += mTaxes; yearTotals.loanPayments += mLoanPayments;
    yearTotals.dividends += mDivs; yearTotals.netProfit += mNetProfit;
    var rowBg = isCurrent ? 'background:rgba(139,92,246,0.06);' : isFuture ? 'opacity:0.4;' : '';
    h += '<tr style="border-bottom:1px solid #1e293b;' + rowBg + '">';
    h += '<td style="padding:8px 12px;font-weight:700;color:' + (isCurrent ? '#a78bfa' : isLocked ? '#34d399' : '#e2e8f0') + '">' + monthNames[mi3-1];
    if (isCurrent) h += ' <span style="font-size:0.55rem;padding:1px 5px;background:#8B5CF6;color:white;border-radius:8px;vertical-align:middle">СЕЙЧАС</span>';
    h += '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#22C55E">' + (mDone || '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#F59E0B">' + (mInProg || '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#EF4444">' + (mRejected || '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#3B82F6">' + (mChecking || '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;font-weight:600;color:#a78bfa">' + (mTurnover ? fmtAmt(mTurnover) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#F59E0B">' + (mArt ? fmtAmt(mArt) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#f87171">' + (mRefunds ? '-' + fmtAmt(Math.abs(mRefunds)) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#8B5CF6">' + (mSvc ? fmtAmt(mSvc) : '\\u2014') + '</td>';
    // Monthly discount from promo codes — use monthly_data.discounts (per-month, independent of date picker)
    var mDiscAmt = mData ? Number(mData.discounts || 0) : 0;
    // Fallback to monthly_discounts for locked/snapshot months
    if (mDiscAmt === 0) {
      var mDiscData = (d.monthly_discounts || {})[mKey];
      mDiscAmt = mDiscData ? Number(mDiscData.discount_total || 0) : 0;
    }
    yearTotals.discounts += mDiscAmt;
    h += '<td style="padding:8px 6px;text-align:right;color:#FBBF24">' + (mDiscAmt > 0 ? '-' + fmtAmt(mDiscAmt) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#EF4444">' + (mExp ? '-' + fmtAmt(Math.abs(mExp)) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;font-weight:700;color:' + (mProfit >= 0 ? '#22C55E' : '#EF4444') + '">' + ((mProfit || isCurrent) ? fmtAmt(mProfit) : '\\u2014');
    if (mAdjTotal !== 0) h += '<div style="font-size:0.6rem;color:' + (mAdjTotal > 0 ? '#22C55E' : '#EF4444') + '">' + (mAdjTotal > 0 ? '+' : '') + fmtAmt(mAdjTotal) + '</div>';
    h += '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#F59E0B">' + (mTaxes ? fmtAmt(mTaxes) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#EF4444">' + (mLoanPayments ? fmtAmt(mLoanPayments) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#8B5CF6">' + (mDivs ? fmtAmt(mDivs) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;font-weight:600;color:' + (mNetProfit >= 0 ? '#10B981' : '#EF4444') + '">' + ((mNetProfit || isCurrent) ? fmtAmt(mNetProfit) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:center">';
    // Check custom status from snapshot — is_locked ALWAYS takes priority
    var customStatus = '';
    if (mSnap) { try { var cd8 = JSON.parse(mSnap.custom_data || '{}'); customStatus = cd8.status || ''; } catch(e) {} }
    if (isLocked) h += '<span style="color:#22C55E;font-size:0.68rem"><i class="fas fa-lock"></i> Закрыт</span>';
    else if (customStatus === 'locked') h += '<span style="color:#22C55E;font-size:0.68rem"><i class="fas fa-lock"></i> Закрыт</span>';
    else if (customStatus === 'checking') h += '<span style="color:#3B82F6;font-size:0.68rem"><i class="fas fa-search"></i> Проверка</span>';
    else if (customStatus === 'custom') { var customLabel2 = ''; try { customLabel2 = JSON.parse(mSnap.custom_data || '{}').status_label || ''; } catch(e) {} h += '<span style="color:#a78bfa;font-size:0.68rem">' + (customLabel2 || 'Другое') + '</span>'; }
    else if (isCurrent) h += '<span style="color:#F59E0B;font-size:0.68rem"><i class="fas fa-sync-alt fa-spin" style="font-size:0.5rem;margin-right:3px"></i>Текущий</span>';
    else if (isPast) h += '<span style="color:#F59E0B;font-size:0.68rem">Открыт</span>';
    else h += '<span style="color:#334155;font-size:0.68rem">\\u2014</span>';
    h += '</td>';
    h += '<td style="padding:8px 6px;text-align:center;white-space:nowrap">';
    // Edit button for ANY non-future month
    if (!isFuture) {
      h += '<button class="btn btn-outline" style="padding:3px 7px;font-size:0.6rem;color:#F59E0B;border-color:#F59E0B44" onclick="editingMonthKey=&apos;' + mKey + '&apos;;render();setTimeout(function(){loadSalarySummary(&apos;' + mKey + '&apos;)},100)" title="Редактировать"><i class="fas fa-pencil-alt"></i></button>';
    }
    h += '</td></tr>';
    // Editable inline form for ANY month (when editing)
    if (isEditing && !isFuture) {
      var snapId4Edit = mSnap ? mSnap.id : 0;
      // Parse existing adjustments and status from snapshot custom_data
      var existingAdjs = [];
      var snapStatus = '';
      if (mSnap) { try { var cd4 = JSON.parse(mSnap.custom_data || '{}'); existingAdjs = cd4.adjustments || []; snapStatus = cd4.status || ''; if (!existingAdjs.length && cd4.adjustment) { existingAdjs = [{amount: Math.abs(cd4.adjustment), type: cd4.adjustment_type || 'inflow', comment: cd4.adjustment_comment || ''}]; } } catch(e) {} }
      // is_locked in DB always overrides custom_data.status
      if (isLocked) { snapStatus = 'locked'; }
      else if (!snapStatus) { snapStatus = isCurrent ? 'current' : isPast ? 'open' : ''; }
      h += '<tr style="background:#0f172a"><td colspan="18" style="padding:12px 16px">';
      h += '<div style="font-weight:700;color:#F59E0B;margin-bottom:10px"><i class="fas fa-pencil-alt" style="margin-right:6px"></i>Редактирование: ' + monthNames[mi3-1] + ' ' + currentYear + '</div>';
      // Row 1: Lead counts
      h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">';
      h += '<div><label style="font-size:0.7rem;color:#22C55E">Закрытые</label><input class="input" id="edit-done-' + mKey + '" type="number" value="' + mDone + '" style="width:100%;padding:6px 10px"></div>';
      h += '<div><label style="font-size:0.7rem;color:#F59E0B">В работе</label><input class="input" id="edit-inprog-' + mKey + '" type="number" value="' + mInProg + '" style="width:100%;padding:6px 10px"></div>';
      h += '<div><label style="font-size:0.7rem;color:#EF4444">Отказы</label><input class="input" id="edit-rejected-' + mKey + '" type="number" value="' + mRejected + '" style="width:100%;padding:6px 10px"></div>';
      h += '<div><label style="font-size:0.7rem;color:#3B82F6">Проверка</label><input class="input" id="edit-checking-' + mKey + '" type="number" value="' + mChecking + '" style="width:100%;padding:6px 10px"></div>';
      h += '</div>';
      // Row 2: Financial fields
      h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">';
      h += '<div><label style="font-size:0.7rem;color:#8B5CF6">Услуги</label><input class="input" id="edit-svc-' + mKey + '" type="number" value="' + mSvc + '" style="width:100%;padding:6px 10px"></div>';
      h += '<div><label style="font-size:0.7rem;color:#F59E0B">Выкупы</label><input class="input" id="edit-art-' + mKey + '" type="number" value="' + mArt + '" style="width:100%;padding:6px 10px"></div>';
      h += '<div><label style="font-size:0.7rem;color:#f87171">Возврат</label><input class="input" id="edit-ref-' + mKey + '" type="number" value="' + mRefunds + '" style="width:100%;padding:6px 10px"></div>';
      h += '</div>';
      h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">';
      h += '<div><label style="font-size:0.7rem;color:#3B82F6"><i class="fas fa-lock" style="font-size:0.55rem;margin-right:3px;opacity:0.6"></i>ЗП + Бонусы <span style="color:#475569;font-size:0.55rem">(авто)</span></label><input class="input" id="edit-expsal-' + mKey + '" type="number" value="' + mExpSal + '" style="width:100%;padding:6px 10px;background:#1e293b;color:#94a3b8;border-color:#334155;cursor:not-allowed" readonly title="Автоматически из листа Зарплаты и бонусы">';
      h += '<div id="sal-hint-' + mKey + '" style="margin-top:4px;font-size:0.65rem;color:#475569"><i class="fas fa-spinner fa-spin" style="margin-right:3px"></i>Загрузка из Зарплаты и бонусы...</div></div>';
      h += '<div><label style="font-size:0.7rem;color:#EF4444">Коммерческие</label><input class="input" id="edit-expcomm-' + mKey + '" type="number" value="' + mExpComm + '" style="width:100%;padding:6px 10px"></div>';
      h += '<div><label style="font-size:0.7rem;color:#EC4899">Маркетинг</label><input class="input" id="edit-expmkt-' + mKey + '" type="number" value="' + mExpMkt + '" style="width:100%;padding:6px 10px"></div>';
      h += '</div>';
      // Auto-fetch salary breakdown from DB for editing month (triggered by edit button onclick)
      // Row 2.5: Computed summary (read-only, matches table headers)
      var editTurnover = mSvc + mArt;
      var editExpTotal = mExpSal + mExpComm + mExpMkt;
      var editProfit = mSvc - editExpTotal + mAdjTotal;
      var editTaxes = mTaxes;
      var editNetProfit = editProfit - editTaxes;
      h += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:10px;padding:10px 12px;background:#0f172a;border-radius:8px;border:1px solid #1e293b">';
      h += '<div><label style="font-size:0.65rem;color:#a78bfa;text-transform:uppercase">\\u041f\\u0440\\u0438\\u0445\\u043e\\u0434 (\\u0438\\u0442\\u043e\\u0433\\u043e)</label><div style="font-weight:700;color:#a78bfa;font-size:0.95rem">' + fmtAmt(editTurnover) + '</div><div style="font-size:0.6rem;color:#475569">\\u0423\\u0441\\u043b\\u0443\\u0433\\u0438 + \\u0412\\u044b\\u043a\\u0443\\u043f\\u044b</div></div>';
      h += '<div><label style="font-size:0.65rem;color:#EF4444;text-transform:uppercase">\\u0420\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b (\\u0438\\u0442\\u043e\\u0433\\u043e)</label><div style="font-weight:700;color:#EF4444;font-size:0.95rem">-' + fmtAmt(Math.abs(editExpTotal)) + '</div><div style="font-size:0.6rem;color:#475569">\\u0417\\u041f + \\u041a\\u043e\\u043c\\u043c. + \\u041c\\u043a\\u0442.</div></div>';
      h += '<div><label style="font-size:0.65rem;color:' + (editProfit >= 0 ? '#22C55E' : '#EF4444') + ';text-transform:uppercase">\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c</label><div style="font-weight:700;color:' + (editProfit >= 0 ? '#22C55E' : '#EF4444') + ';font-size:0.95rem">' + fmtAmt(editProfit) + '</div><div style="font-size:0.6rem;color:#475569">\\u0423\\u0441\\u043b\\u0443\\u0433\\u0438 - \\u0420\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b' + (mAdjTotal !== 0 ? ' + \\u041a\\u043e\\u0440\\u0440.' : '') + '</div></div>';
      h += '<div><label style="font-size:0.65rem;color:#F59E0B;text-transform:uppercase">\\u041d\\u0430\\u043b\\u043e\\u0433\\u0438</label><div style="font-weight:700;color:#F59E0B;font-size:0.95rem">' + (editTaxes ? fmtAmt(editTaxes) : '\\u2014') + '</div><div style="font-size:0.6rem;color:#475569">\\u0418\\u0437 \\u043b\\u0438\\u0441\\u0442\\u0430 P&L</div></div>';
      h += '<div><label style="font-size:0.65rem;color:' + (editNetProfit >= 0 ? '#10B981' : '#EF4444') + ';text-transform:uppercase">\\u0427\\u0438\\u0441\\u0442\\u0430\\u044f</label><div style="font-weight:700;color:' + (editNetProfit >= 0 ? '#10B981' : '#EF4444') + ';font-size:0.95rem">' + fmtAmt(editNetProfit) + '</div><div style="font-size:0.6rem;color:#475569">\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c - \\u041d\\u0430\\u043b\\u043e\\u0433\\u0438</div></div>';
      h += '</div>';
      // Row 3: Status selector
      h += '<div style="display:grid;grid-template-columns:1fr 3fr;gap:10px;margin-bottom:12px">';
      h += '<div><label style="font-size:0.7rem;color:#94a3b8">Статус</label><select class="input" id="edit-status-' + mKey + '" style="width:100%;padding:6px 10px">';
      h += '<option value="locked"' + (snapStatus === 'locked' ? ' selected' : '') + '>Закрыт</option>';
      h += '<option value="checking"' + (snapStatus === 'checking' ? ' selected' : '') + '>Проверка</option>';
      h += '<option value="open"' + (snapStatus === 'open' ? ' selected' : '') + '>Открыт</option>';
      h += '<option value="current"' + (snapStatus === 'current' ? ' selected' : '') + '>Текущий</option>';
      h += '<option value="custom"' + (snapStatus === 'custom' ? ' selected' : '') + '>Другое...</option>';
      h += '</select></div>';
      h += '<div><label style="font-size:0.7rem;color:#94a3b8">Своё название (если "Другое")</label><input class="input" id="edit-status-custom-' + mKey + '" style="width:100%;padding:6px 10px" placeholder="Введите статус"></div>';
      h += '</div>';
      // Existing adjustments list
      if (existingAdjs.length > 0) {
        h += '<div style="border-top:1px solid #334155;padding-top:10px;margin-bottom:10px">';
        h += '<div style="font-weight:600;color:#a78bfa;margin-bottom:8px;font-size:0.82rem"><i class="fas fa-list" style="margin-right:4px"></i>Существующие корректировки</div>';
        for (var ai = 0; ai < existingAdjs.length; ai++) {
          var adj = existingAdjs[ai];
          var adjIsInflow = adj.type === 'inflow';
          h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:6px 10px;background:#1e293b;border-radius:6px;border:1px solid ' + (adjIsInflow ? '#22C55E33' : '#EF444433') + '">';
          h += '<span style="color:' + (adjIsInflow ? '#22C55E' : '#EF4444') + ';font-weight:700;font-size:0.85rem;min-width:80px">' + (adjIsInflow ? '+' : '-') + fmtAmt(Math.abs(adj.amount)) + '</span>';
          h += '<span style="color:' + (adjIsInflow ? '#34d399' : '#f87171') + ';font-size:0.72rem;padding:2px 8px;background:' + (adjIsInflow ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)') + ';border-radius:4px;min-width:50px;text-align:center">' + (adjIsInflow ? 'Приток' : 'Отток') + '</span>';
          h += '<span style="color:#94a3b8;font-size:0.75rem">' + (adj.comment || '') + '</span>';
          h += '<button class="btn btn-outline" style="padding:2px 6px;font-size:0.6rem;color:#EF4444;border-color:#EF444433;margin-left:auto;flex-shrink:0" onclick="deleteAdjustment(&apos;' + mKey + '&apos;,' + snapId4Edit + ',' + ai + ')" title="Удалить"><i class="fas fa-trash"></i></button>';
          h += '</div>';
        }
        h += '</div>';
      }
      // Add new adjustment section
      h += '<div style="border-top:1px solid #334155;padding-top:12px;margin-bottom:12px">';
      h += '<div style="font-weight:600;color:#a78bfa;margin-bottom:8px;font-size:0.82rem"><i class="fas fa-plus-circle" style="margin-right:4px"></i>Добавить корректировку</div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">';
      h += '<div><label style="font-size:0.7rem;color:#64748b">Сумма</label><input class="input" id="edit-adj-amount-' + mKey + '" type="number" value="" style="width:100%;padding:6px 10px" placeholder="0"></div>';
      h += '<div><label style="font-size:0.7rem;color:#64748b">Тип</label><select class="input" id="edit-adj-type-' + mKey + '" style="width:100%;padding:6px 10px"><option value="inflow">Приток (плюс к прибыли)</option><option value="outflow">Отток (минус из прибыли)</option></select></div>';
      h += '<div><label style="font-size:0.7rem;color:#64748b">Комментарий</label><input class="input" id="edit-adj-comment-' + mKey + '" placeholder="Описание" style="width:100%;padding:6px 10px"></div>';
      h += '</div></div>';
      h += '<div style="display:flex;gap:8px"><button class="btn btn-success" style="padding:6px 14px;font-size:0.82rem" onclick="saveEditedMonth(&apos;' + mKey + '&apos;,' + snapId4Edit + ')"><i class="fas fa-check" style="margin-right:4px"></i>Сохранить</button>';
      h += '<button class="btn btn-outline" style="padding:6px 14px;font-size:0.82rem" onclick="editingMonthKey=&apos;&apos;;render()">Отмена</button></div>';
      h += '</td></tr>';
    }
  }
  h += '<tr style="border-top:2px solid #8B5CF6;font-weight:800"><td style="padding:8px 12px">ИТОГО ' + currentYear + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#22C55E">' + yearTotals.done + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#F59E0B">' + yearTotals.inProgress + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#EF4444">' + yearTotals.rejected + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#3B82F6">' + yearTotals.checking + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#a78bfa">' + fmtAmt(yearTotals.turnover) + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#F59E0B">' + (yearTotals.articles ? fmtAmt(yearTotals.articles) : '\\u2014') + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#f87171">' + (yearTotals.refunds ? '-' + fmtAmt(Math.abs(yearTotals.refunds)) : '\\u2014') + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#8B5CF6">' + (yearTotals.services ? fmtAmt(yearTotals.services) : '\\u2014') + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#FBBF24">' + (yearTotals.discounts > 0 ? '-' + fmtAmt(yearTotals.discounts) : '\\u2014') + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#EF4444">' + (yearTotals.expenses ? '-' + fmtAmt(Math.abs(yearTotals.expenses)) : '\\u2014') + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;font-weight:700;color:' + (yearTotals.profit >= 0 ? '#22C55E' : '#EF4444') + '">' + fmtAmt(yearTotals.profit) + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;font-weight:700;color:#F59E0B">' + (yearTotals.taxes ? fmtAmt(yearTotals.taxes) : '\\u2014') + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;font-weight:700;color:#EF4444">' + (yearTotals.loanPayments ? fmtAmt(yearTotals.loanPayments) : '\\u2014') + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;font-weight:700;color:#8B5CF6">' + (yearTotals.dividends ? fmtAmt(yearTotals.dividends) : '\\u2014') + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;font-weight:700;color:' + (yearTotals.netProfit >= 0 ? '#10B981' : '#EF4444') + '">' + fmtAmt(yearTotals.netProfit) + '</td>';
  h += '<td colspan="2"></td></tr>';
  h += '</tbody></table></div></div>';

  // ---- SECTION: Quarters (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec) ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-calendar-alt" style="color:#F59E0B;margin-right:8px"></i>\\u041a\\u0432\\u0430\\u0440\\u0442\\u0430\\u043b\\u044b ' + currentYear + '</h3>';
  h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.78rem">';
  h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155">';
  h += '<th style="padding:8px 12px;text-align:left;color:#94a3b8">Квартал</th>';
  h += '<th style="padding:8px 6px;text-align:left;color:#94a3b8;font-size:0.72rem">Месяцы</th>';
  h += '<th style="padding:8px 6px;text-align:center;color:#94a3b8">Закрыто</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#22C55E" title="Закрытые лиды">Закрытые</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#F59E0B" title="В работе">В работе</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#EF4444" title="Отказы">Отказы</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#3B82F6" title="На проверке">Проверка</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#a78bfa">Приход</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#F59E0B">Выкупы</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#f87171">Возврат</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#8B5CF6">Услуги</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#EF4444">Расходы</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#22C55E" title="Услуги - Расходы">Прибыль</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#F59E0B" title="Налоги за квартал">Налоги</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#EF4444" title="Кредиты за квартал">Кредиты</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#8B5CF6" title="Дивиденды за квартал">Дивид.</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#10B981" title="Чистая прибыль">Чистая</th>';
  h += '<th style="padding:8px;width:50px"></th></tr></thead><tbody>';
  var qMonthsMap = [[1,2,3],[4,5,6],[7,8,9],[10,11,12]];
  var qNames = ['Q1 (Янв\\u2013Мар)','Q2 (Апр\\u2013Июн)','Q3 (Июл\\u2013Сен)','Q4 (Окт\\u2013Дек)'];
  for (var qi2 = 0; qi2 < 4; qi2++) {
    var qNum = qi2 + 1;
    var qKey = currentYear + '-Q' + qNum;
    var qSnap = snapshots.find(function(s){return s.period_type==='quarter' && s.period_key===qKey;});
    var qIsCurrent = qNum === currentQ;
    var qLocked = qSnap && qSnap.is_locked;
    var closedInQ = 0;
    var qTurnover = 0, qSvc = 0, qArt = 0, qRef = 0, qExp = 0, qProfit = 0, qDone = 0, qTaxes = 0, qInProg = 0, qRejected = 0, qChecking = 0;
    for (var qmi = 0; qmi < 3; qmi++) {
      var qmNum = qMonthsMap[qi2][qmi];
      var qmKey = currentYear + '-' + String(qmNum).padStart(2,'0');
      var qmSnap = snapshots.find(function(s){return s.period_type==='month' && s.period_key===qmKey;});
      if (qmSnap && qmSnap.is_locked) {
        closedInQ++;
      }
      if (qmNum === currentMonth && !qmSnap?.is_locked) {
        // ALWAYS use live data for current month (unless locked)
        var cSvc = Number(fin.services)||0;
        var cArt = Number(fin.articles)||0;
        var cExp = Number(fin.total_expenses)||0;
        qSvc += cSvc;
        qArt += cArt;
        qRef += Number(fin.refunds)||0;
        qExp += cExp;
        qTurnover += cSvc + cArt;
        qProfit += cSvc - cExp;
        qDone += (sd.done ? Number(sd.done.count)||0 : 0);
        qInProg += (sd.in_progress ? Number(sd.in_progress.count)||0 : 0) + (sd.contacted ? Number(sd.contacted.count)||0 : 0);
        qRejected += (sd.rejected ? Number(sd.rejected.count)||0 : 0);
        qChecking += (sd.checking ? Number(sd.checking.count)||0 : 0);
      } else if (qmSnap) {
        // Use snapshot data for past months
        var qmSvc = Number(qmSnap.revenue_services)||0;
        var qmArt = Number(qmSnap.revenue_articles)||0;
        var qmExp = Math.abs(Number(qmSnap.expense_salaries)||0)+Math.abs(Number(qmSnap.expense_commercial)||0)+Math.abs(Number(qmSnap.expense_marketing)||0);
        var qmAdj = 0;
        try { var qmCD = JSON.parse(qmSnap.custom_data || '{}'); var qmAdjs = qmCD.adjustments || []; for (var qai = 0; qai < qmAdjs.length; qai++) { qmAdj += qmAdjs[qai].type === 'outflow' ? -Math.abs(qmAdjs[qai].amount) : Math.abs(qmAdjs[qai].amount); } } catch(e) {}
        qSvc += qmSvc;
        qArt += qmArt;
        qRef += Number(qmSnap.refunds)||0;
        qExp += qmExp;
        qTurnover += qmSvc + qmArt;
        qProfit += qmSvc - qmExp + qmAdj;
        qDone += Number(qmSnap.leads_done)||0;
        try { var qmCD2 = JSON.parse(qmSnap.custom_data || '{}'); qInProg += Number(qmCD2.in_progress_count)||0; qRejected += Number(qmCD2.rejected_count)||0; qChecking += Number(qmCD2.checking_count)||0; } catch(e) {}
      }
    }
    // Use quarter snapshot if locked
    if (qLocked) {
      var qlSvc = Number(qSnap.revenue_services)||0;
      var qlExp = Math.abs(Number(qSnap.expense_salaries)||0)+Math.abs(Number(qSnap.expense_commercial)||0)+Math.abs(Number(qSnap.expense_marketing)||0);
      qTurnover = qlSvc + (Number(qSnap.revenue_articles)||0);
      qSvc = qlSvc;
      qArt = Number(qSnap.revenue_articles)||0;
      qRef = Number(qSnap.refunds)||0;
      qExp = qlExp;
      qProfit = qSvc - qExp; // Прибыль = Услуги - Расходы
      qDone = Number(qSnap.leads_done)||0;
    }
    // Sum taxes for this quarter from tax_payments
    var allTP = data.taxPayments || [];
    for (var qti = 0; qti < 3; qti++) {
      var qtmKey = currentYear + '-' + String(qMonthsMap[qi2][qti]).padStart(2,'0');
      for (var qtj = 0; qtj < allTP.length; qtj++) {
        if (allTP[qtj].period_key === qtmKey) qTaxes += Number(allTP[qtj].amount) || 0;
      }
    }
    // Sum loan payments for this quarter
    var qLoanPayments = 0;
    var allLP2 = data.loanPayments || [];
    for (var qli = 0; qli < 3; qli++) {
      var qlmKey = currentYear + '-' + String(qMonthsMap[qi2][qli]).padStart(2,'0');
      for (var qlj = 0; qlj < allLP2.length; qlj++) {
        var qlDate = allLP2[qlj].payment_date || '';
        if (qlDate >= qlmKey + '-01' && qlDate <= qlmKey + '-31') qLoanPayments += Number(allLP2[qlj].amount) || 0;
      }
    }
    // Sum dividends for this quarter
    var qDivs = 0;
    var allDivs2 = data.dividends || [];
    for (var qdi = 0; qdi < 3; qdi++) {
      var qdmKey = currentYear + '-' + String(qMonthsMap[qi2][qdi]).padStart(2,'0');
      for (var qdj = 0; qdj < allDivs2.length; qdj++) {
        if (allDivs2[qdj].period_key === qdmKey) qDivs += (Number(allDivs2[qdj].amount) || 0) + (Number(allDivs2[qdj].tax_amount) || 0);
      }
    }
    var qNetProfit = qProfit - qTaxes - qLoanPayments - qDivs;
    var qColor = qIsCurrent ? '#F59E0B' : qLocked ? '#22C55E' : '#e2e8f0';
    h += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:8px 12px;font-weight:700;color:' + qColor + '">' + qNames[qi2] + '</td>';
    h += '<td style="padding:8px 6px;color:#64748b;font-size:0.72rem">' + qMonthsMap[qi2].map(function(m){return monthNames[m-1];}).join(', ') + '</td>';
    h += '<td style="padding:8px 6px;text-align:center">' + closedInQ + '/3</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#22C55E">' + (qDone || '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#F59E0B">' + (qInProg || '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#EF4444">' + (qRejected || '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#3B82F6">' + (qChecking || '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;font-weight:600;color:#a78bfa">' + (qTurnover ? fmtAmt(qTurnover) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#F59E0B">' + (qArt ? fmtAmt(qArt) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#f87171">' + (qRef ? '-' + fmtAmt(Math.abs(qRef)) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#8B5CF6">' + (qSvc ? fmtAmt(qSvc) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#EF4444">' + (qExp ? '-' + fmtAmt(Math.abs(qExp)) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;font-weight:700;color:' + (qProfit >= 0 ? '#22C55E' : '#EF4444') + '">' + (qProfit ? fmtAmt(qProfit) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#F59E0B">' + (qTaxes ? fmtAmt(qTaxes) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#EF4444">' + (qLoanPayments ? fmtAmt(qLoanPayments) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#8B5CF6">' + (qDivs ? fmtAmt(qDivs) : '\\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;font-weight:600;color:' + (qNetProfit >= 0 ? '#10B981' : '#EF4444') + '">' + (qNetProfit || qTaxes ? fmtAmt(qNetProfit) : '\\u2014') + '</td>';
    h += '<td style="padding:8px;text-align:center">';
    if (qNum < currentQ && closedInQ === 3 && !qLocked) {
      h += '<button class="btn btn-primary" style="padding:3px 10px;font-size:0.72rem" onclick="closePeriodAction(&apos;quarter&apos;,&apos;' + qKey + '&apos;,true)"><i class="fas fa-lock"></i></button>';
    } else if (qLocked) {
      h += '<span style="color:#22C55E;font-size:0.72rem"><i class="fas fa-check-circle"></i></span>';
    }
    h += '</td></tr>';
  }
  h += '</tbody></table></div>';

  // Year total
  var yearKey = String(currentYear);
  var yearSnap = snapshots.find(function(s){return s.period_type==='year' && s.period_key===yearKey;});
  var closedQ = 0;
  for (var yqi = 1; yqi <= 4; yqi++) { if(snapshots.find(function(s){return s.period_type==='quarter' && s.period_key===currentYear+'-Q'+yqi && s.is_locked;})) closedQ++; }
  h += '<div class="card" style="padding:20px;text-align:center;border:2px solid ' + (yearSnap && yearSnap.is_locked ? '#22C55E' : '#8B5CF6') + ';margin-top:16px">';
  h += '<div style="font-size:1.3rem;font-weight:800;color:#a78bfa">\\u0413\\u043e\\u0434 ' + currentYear + '</div>';
  h += '<div style="font-size:0.85rem;color:#64748b;margin-top:4px">\\u041a\\u0432\\u0430\\u0440\\u0442\\u0430\\u043b\\u043e\\u0432 \\u0437\\u0430\\u043a\\u0440\\u044b\\u0442\\u043e: ' + closedQ + '/4</div>';
  if (yearSnap) h += '<div style="font-size:0.85rem;margin-top:8px">\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u0437\\u0430 \\u0433\\u043e\\u0434: <strong style="color:' + ((yearSnap.net_profit||0) >= 0 ? '#22C55E' : '#EF4444') + '">' + fmtAmt(yearSnap.net_profit) + '</strong></div>';
  if (closedQ === 4 && !(yearSnap && yearSnap.is_locked)) {
    h += '<button class="btn btn-primary" style="margin-top:12px" onclick="closePeriodAction(&apos;year&apos;,&apos;' + yearKey + '&apos;,true)"><i class="fas fa-lock" style="margin-right:6px"></i>\\u0417\\u0430\\u043a\\u0440\\u044b\\u0442\\u044c \\u0433\\u043e\\u0434</button>';
  }
  h += '</div></div>';

  // ---- SECTION: Manual Period Comparison ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-exchange-alt" style="color:#F59E0B;margin-right:8px"></i>\\u0421\\u0440\\u0430\\u0432\\u043d\\u0435\\u043d\\u0438\\u0435 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434\\u043e\\u0432</h3>';
  var allSnaps = snapshots.slice().sort(function(a,b){return a.period_key>b.period_key?-1:1;});
  // Quick comparison buttons
  var monthSnaps = allSnaps.filter(function(s){return s.period_type==='month';}).sort(function(a,b){return a.period_key>b.period_key?-1:1;});
  var quarterSnaps = allSnaps.filter(function(s){return s.period_type==='quarter';}).sort(function(a,b){return a.period_key>b.period_key?-1:1;});
  if (monthSnaps.length >= 1 || quarterSnaps.length >= 1) {
    h += '<div class="card" style="padding:12px 16px;margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
    h += '<span style="font-size:0.78rem;color:#94a3b8;font-weight:600"><i class="fas fa-bolt" style="margin-right:4px;color:#F59E0B"></i>\\u0411\\u044b\\u0441\\u0442\\u0440\\u044b\\u0439 \\u043f\\u0440\\u043e\\u0441\\u043c\\u043e\\u0442\\u0440:</span>';
    // Single period quick view
    if (monthSnaps.length >= 1) {
      h += '<button class="tab-btn" style="padding:5px 12px;font-size:0.75rem" onclick="comparePeriod1=&apos;' + monthSnaps[0].id + '&apos;;comparePeriod2=&apos;&apos;;render()"><i class="fas fa-eye" style="margin-right:3px"></i>' + monthSnaps[0].period_key.slice(5) + '</button>';
    }
    // 1-month vs prev month
    if (monthSnaps.length >= 2) {
      h += '<button class="tab-btn" style="padding:5px 12px;font-size:0.75rem" onclick="comparePeriod1=&apos;' + monthSnaps[0].id + '&apos;;comparePeriod2=&apos;' + monthSnaps[1].id + '&apos;;render()"><i class="fas fa-calendar-day" style="margin-right:3px"></i>1 \\u043c\\u0435\\u0441: ' + monthSnaps[0].period_key.slice(5) + ' vs ' + monthSnaps[1].period_key.slice(5) + '</button>';
    }
    // 2-month comparison (latest vs 2 months ago)
    if (monthSnaps.length >= 3) {
      h += '<button class="tab-btn" style="padding:5px 12px;font-size:0.75rem" onclick="comparePeriod1=&apos;' + monthSnaps[0].id + '&apos;;comparePeriod2=&apos;' + monthSnaps[2].id + '&apos;;render()"><i class="fas fa-calendar-alt" style="margin-right:3px"></i>2 \\u043c\\u0435\\u0441: ' + monthSnaps[0].period_key.slice(5) + ' vs ' + monthSnaps[2].period_key.slice(5) + '</button>';
    }
    // 3-month comparison (latest vs 3 months ago)
    if (monthSnaps.length >= 4) {
      h += '<button class="tab-btn" style="padding:5px 12px;font-size:0.75rem" onclick="comparePeriod1=&apos;' + monthSnaps[0].id + '&apos;;comparePeriod2=&apos;' + monthSnaps[3].id + '&apos;;render()"><i class="fas fa-calendar-week" style="margin-right:3px"></i>3 \\u043c\\u0435\\u0441: ' + monthSnaps[0].period_key.slice(5) + ' vs ' + monthSnaps[3].period_key.slice(5) + '</button>';
    }
    // Quarter comparison
    if (quarterSnaps.length >= 2) {
      h += '<button class="tab-btn" style="padding:5px 12px;font-size:0.75rem" onclick="comparePeriod1=&apos;' + quarterSnaps[0].id + '&apos;;comparePeriod2=&apos;' + quarterSnaps[1].id + '&apos;;render()"><i class="fas fa-layer-group" style="margin-right:3px"></i>\\u041a\\u0432\\u0430\\u0440\\u0442: ' + quarterSnaps[0].period_key + ' vs ' + quarterSnaps[1].period_key + '</button>';
    }
    h += '</div>';
  }
  if (allSnaps.length >= 1) {
    // Manual selection dropdowns
    h += '<div class="card" style="padding:16px;margin-bottom:16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">';
    h += '<div style="font-size:0.82rem;color:#94a3b8;font-weight:600">\\u0412\\u044b\\u0431\\u0435\\u0440\\u0438\\u0442\\u0435 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434\\u044b \\u0434\\u043b\\u044f \\u0441\\u0440\\u0430\\u0432\\u043d\\u0435\\u043d\\u0438\\u044f:</div>';
    h += '<select class="input" style="width:220px;padding:6px 10px;font-size:0.82rem" onchange="comparePeriod1=this.value;render()" id="cmpPeriod1">';
    h += '<option value="">\\u2014 \\u041f\\u0435\\u0440\\u0438\\u043e\\u0434 1 \\u2014</option>';
    for (var cs1 = 0; cs1 < allSnaps.length; cs1++) {
      var sn1 = allSnaps[cs1]; var lbl1 = sn1.period_type === 'month' ? sn1.period_key : sn1.period_type === 'quarter' ? sn1.period_key : '\\u0413\\u043e\\u0434 ' + sn1.period_key;
      var lockIcon1 = sn1.is_locked ? ' \\ud83d\\udd12' : ' \\ud83d\\udcca';
      h += '<option value="' + sn1.id + '"' + (comparePeriod1 == sn1.id ? ' selected' : '') + '>' + lbl1 + ' (' + sn1.period_type + ')' + lockIcon1 + '</option>';
    }
    h += '</select>';
    h += '<span style="color:#64748b">vs</span>';
    h += '<select class="input" style="width:220px;padding:6px 10px;font-size:0.82rem" onchange="comparePeriod2=this.value;render()" id="cmpPeriod2">';
    h += '<option value="">\\u2014 \\u041f\\u0435\\u0440\\u0438\\u043e\\u0434 2 (\\u043e\\u043f\\u0446\\u0438\\u043e\\u043d\\u0430\\u043b\\u044c\\u043d\\u043e) \\u2014</option>';
    for (var cs2 = 0; cs2 < allSnaps.length; cs2++) {
      var sn2 = allSnaps[cs2]; var lbl2 = sn2.period_type === 'month' ? sn2.period_key : sn2.period_type === 'quarter' ? sn2.period_key : '\\u0413\\u043e\\u0434 ' + sn2.period_key;
      var lockIcon2 = sn2.is_locked ? ' \\ud83d\\udd12' : ' \\ud83d\\udcca';
      h += '<option value="' + sn2.id + '"' + (comparePeriod2 == sn2.id ? ' selected' : '') + '>' + lbl2 + ' (' + sn2.period_type + ')' + lockIcon2 + '</option>';
    }
    h += '</select></div>';
    // Show comparison if period 1 selected (period 2 is optional for single-period view)
    var snap1 = comparePeriod1 ? allSnaps.find(function(s){return s.id == comparePeriod1;}) : null;
    var snap2 = comparePeriod2 ? allSnaps.find(function(s){return s.id == comparePeriod2;}) : null;
    if (snap1) {
      // Parse custom_data for extra metrics
      var cd1 = {}; var cd2 = {};
      try { cd1 = JSON.parse(snap1.custom_data || '{}'); } catch(e) {}
      if (snap2) { try { cd2 = JSON.parse(snap2.custom_data || '{}'); } catch(e) {} }
      // All expense values must be POSITIVE (absolute) — guard against corrupted snapshots
      var snap1ExpSal = Math.abs(Number(snap1.expense_salaries)||0);
      var snap1ExpComm = Math.abs(Number(snap1.expense_commercial)||0);
      var snap1ExpMkt = Math.abs(Number(snap1.expense_marketing)||0);
      var snap2ExpSal = snap2 ? Math.abs(Number(snap2.expense_salaries)||0) : 0;
      var snap2ExpComm = snap2 ? Math.abs(Number(snap2.expense_commercial)||0) : 0;
      var snap2ExpMkt = snap2 ? Math.abs(Number(snap2.expense_marketing)||0) : 0;
      // Compute salary_base and bonuses_net from snapshot data (custom_data may be stale/zero)
      // Strategy: use live analytics data OR salSummaryCache for the matching period when snapshot data is stale/zero
      var liveFin = (analyticsData && analyticsData.financial) ? analyticsData.financial : {};
      var liveMonth = analyticsData ? analyticsData.month : '';
      // Override snapshot expense values from live analytics or salary cache if they are 0
      function enrichFromLive(snap, snapExpSal, snapExpComm, snapExpMkt) {
        var r = { sal: snapExpSal, comm: snapExpComm, mkt: snapExpMkt };
        if (!snap) return r;
        var pk = snap.period_key || '';
        // First try salSummaryCache (works for ANY month)
        var cached = salSummaryCache[pk];
        if (cached) {
          if (r.sal === 0) { r.sal = Number(cached.expense_salaries) || 0; }
          if (r.comm === 0) { r.comm = Number(cached.commercial_expenses) || 0; }
          if (r.mkt === 0) { r.mkt = Number(cached.marketing_expenses) || 0; }
        }
        // Then try live analytics (only for current month)
        if (pk === liveMonth && liveFin.salaries !== undefined) {
          if (r.sal === 0) { r.sal = (Number(liveFin.salaries)||0) + (Number(liveFin.bonuses)||0) + (Number(liveFin.fines)||0); }
          if (r.comm === 0) { r.comm = Number(liveFin.commercial_expenses)||0; }
          if (r.mkt === 0) { r.mkt = Number(liveFin.marketing_expenses)||0; }
        }
        return r;
      }
      var enriched1 = enrichFromLive(snap1, snap1ExpSal, snap1ExpComm, snap1ExpMkt);
      snap1ExpSal = enriched1.sal; snap1ExpComm = enriched1.comm; snap1ExpMkt = enriched1.mkt;
      if (snap2) {
        var enriched2 = enrichFromLive(snap2, snap2ExpSal, snap2ExpComm, snap2ExpMkt);
        snap2ExpSal = enriched2.sal; snap2ExpComm = enriched2.comm; snap2ExpMkt = enriched2.mkt;
      }
      // Compute salary_base and bonuses_net — priority: salSummaryCache > live analytics > snapshot custom_data > fallback
      function getSalBreakdown(snap, cd, snapExpSal) {
        var sb = Number(cd.salary_base) || 0;
        var bn = Number(cd.bonuses_net) || 0;
        if (!snap) return { base: sb || snapExpSal, net: bn };
        var pk = snap.period_key || '';
        // Priority 1: salSummaryCache (most accurate, from DB)
        var cached = salSummaryCache[pk];
        if (cached) {
          return { base: Number(cached.salaries) || sb || snapExpSal, net: (Number(cached.bonuses) || 0) + (Number(cached.fines) || 0) };
        }
        // Priority 2: live analytics (current month only)
        if (pk === liveMonth && liveFin.salaries !== undefined) {
          return { base: Number(liveFin.salaries) || sb || snapExpSal, net: (Number(liveFin.bonuses) || 0) + (Number(liveFin.fines) || 0) };
        }
        // Priority 3: derive from snapshot data
        if (bn === 0 && sb > 0 && snapExpSal > sb) { bn = snapExpSal - sb; }
        if (sb === 0) { sb = snapExpSal; }
        return { base: sb, net: bn };
      }
      var sal1 = getSalBreakdown(snap1, cd1, snap1ExpSal);
      var snap1SalBase = sal1.base;
      var snap1BonNet = sal1.net;
      var sal2 = snap2 ? getSalBreakdown(snap2, cd2, snap2ExpSal) : { base: 0, net: 0 };
      var snap2SalBase = sal2.base;
      var snap2BonNet = sal2.net;
      // Trigger async loading of salary summary for comparison snapshots if not cached (with guard against infinite loop)
      var snapPeriodsToLoad = [];
      if (snap1 && snap1.period_type === 'month' && !salSummaryCache[snap1.period_key] && !salSummaryLoading[snap1.period_key]) snapPeriodsToLoad.push(snap1.period_key);
      if (snap2 && snap2.period_type === 'month' && !salSummaryCache[snap2.period_key] && !salSummaryLoading[snap2.period_key]) snapPeriodsToLoad.push(snap2.period_key);
      if (snapPeriodsToLoad.length > 0) {
        for (var _li = 0; _li < snapPeriodsToLoad.length; _li++) salSummaryLoading[snapPeriodsToLoad[_li]] = true;
        setTimeout(function() {
          var loadPromises = snapPeriodsToLoad.map(function(pk) {
            return api('/salary-summary/' + pk).then(function(res) {
              if (res && res.salaries !== undefined) salSummaryCache[pk] = res;
              delete salSummaryLoading[pk];
            }).catch(function(){ delete salSummaryLoading[pk]; });
          });
          Promise.all(loadPromises).then(function() { render(); });
        }, 50);
      }
      var exp1 = snap1ExpSal + snap1ExpComm + snap1ExpMkt;
      var exp2 = snap2ExpSal + snap2ExpComm + snap2ExpMkt;
      // Recompute net_profit from expenses if snapshot had corrupted negative expenses or zero expenses enriched from live
      var snap1NP = Number(snap1.net_profit)||0;
      var snap2NP = snap2 ? Number(snap2.net_profit)||0 : 0;
      // Check if any expense was negative (corrupted) or if we enriched from live data — then recalculate profit
      var snap1Corrupted = Number(snap1.expense_commercial) < 0 || Number(snap1.expense_salaries) < 0 || Number(snap1.expense_marketing) < 0;
      var snap1Enriched = (snap1.period_key === liveMonth) && (Math.abs(Number(snap1.expense_marketing)||0) === 0 || Math.abs(Number(snap1.expense_salaries)||0) === 0);
      if (snap1Corrupted || snap1Enriched) {
        snap1NP = (Number(snap1.revenue_services)||0) - exp1;
      }
      if (snap2 && (Number(snap2.expense_commercial) < 0 || Number(snap2.expense_salaries) < 0 || Number(snap2.expense_marketing) < 0 || ((snap2.period_key === liveMonth) && (Math.abs(Number(snap2.expense_marketing)||0) === 0 || Math.abs(Number(snap2.expense_salaries)||0) === 0)))) {
        snap2NP = (Number(snap2.revenue_services)||0) - exp2;
      }
      // Helper: get valid avg_check (0 if no leads_done)
      var snap1AvgCheck = (Number(snap1.leads_done)||0) > 0 ? Number(snap1.avg_check)||0 : 0;
      var snap2AvgCheck = snap2 ? ((Number(snap2.leads_done)||0) > 0 ? Number(snap2.avg_check)||0 : 0) : 0;
      // Profit margin: (net_profit / services) * 100
      var snap1ProfitMargin = (Number(snap1.revenue_services)||0) > 0 ? snap1NP / (Number(snap1.revenue_services)||1) * 100 : 0;
      var snap2ProfitMargin = snap2 ? ((Number(snap2.revenue_services)||0) > 0 ? snap2NP / (Number(snap2.revenue_services)||1) * 100 : 0) : 0;
      // Cost per lead
      var snap1CPL = (Number(snap1.leads_count)||0) > 0 ? exp1 / (Number(snap1.leads_count)||1) : 0;
      var snap2CPL = snap2 ? ((Number(snap2.leads_count)||0) > 0 ? exp2 / (Number(snap2.leads_count)||1) : 0) : 0;
      // Cost per acquisition (expenses / leads_done)
      var snap1CPA = (Number(snap1.leads_done)||0) > 0 ? exp1 / (Number(snap1.leads_done)||1) : 0;
      var snap2CPA = snap2 ? ((Number(snap2.leads_done)||0) > 0 ? exp2 / (Number(snap2.leads_done)||1) : 0) : 0;
      // Revenue per lead
      var snap1RPL = (Number(snap1.leads_count)||0) > 0 ? (Number(snap1.revenue_services)||0) / (Number(snap1.leads_count)||1) : 0;
      var snap2RPL = snap2 ? ((Number(snap2.leads_count)||0) > 0 ? (Number(snap2.revenue_services)||0) / (Number(snap2.leads_count)||1) : 0) : 0;
      // LTV: use live data for snap1 if available, snapshot custom_data ltv only (no fallback guesses)
      var liveLtv = (fin.ltv_data || {}).ltv || 0;
      var snap1LTV = liveLtv || Number(cd1.ltv) || 0;
      var snap2LTV = snap2 ? (Number(cd2.ltv) || 0) : 0;
      // CAC = Customer Acquisition Cost = total expenses / leads_done
      var snap1CAC = (Number(snap1.leads_done)||0) > 0 ? exp1 / Number(snap1.leads_done) : 0;
      var snap2CAC = snap2 ? ((Number(snap2.leads_done)||0) > 0 ? exp2 / Number(snap2.leads_done) : 0) : 0;

      // === COMPUTE KPI from raw snapshot data if custom_data is empty (old snapshots) ===
      var snap1Conv = Number(cd1.conversion_rate) || 0;
      if (!snap1Conv && (Number(snap1.leads_count)||0) > 0 && (Number(snap1.leads_done)||0) > 0) {
        snap1Conv = Math.round((Number(snap1.leads_done) / Number(snap1.leads_count)) * 1000) / 10;
      }
      var snap2Conv = snap2 ? (Number(cd2.conversion_rate) || 0) : 0;
      if (snap2 && !snap2Conv && (Number(snap2.leads_count)||0) > 0 && (Number(snap2.leads_done)||0) > 0) {
        snap2Conv = Math.round((Number(snap2.leads_done) / Number(snap2.leads_count)) * 1000) / 10;
      }
      var snap1Margin = Number(cd1.marginality) || 0;
      if (!snap1Margin && (Number(snap1.revenue_services)||0) > 0) {
        snap1Margin = Math.round((snap1NP / (Number(snap1.revenue_services)||1)) * 1000) / 10;
      }
      var snap2Margin = snap2 ? (Number(cd2.marginality) || 0) : 0;
      if (snap2 && !snap2Margin && (Number(snap2.revenue_services)||0) > 0) {
        snap2Margin = Math.round((snap2NP / (Number(snap2.revenue_services)||1)) * 1000) / 10;
      }
      var snap1ROI = Number(cd1.roi) || 0;
      if (!snap1ROI && exp1 > 0) { snap1ROI = Math.round((snap1NP / exp1) * 1000) / 10; }
      var snap2ROI = snap2 ? (Number(cd2.roi) || 0) : 0;
      if (snap2 && !snap2ROI && exp2 > 0) { snap2ROI = Math.round((snap2NP / exp2) * 1000) / 10; }
      var snap1ROMI = Number(cd1.romi) || 0;
      var mkt1 = Number(snap1.expense_marketing)||0;
      if (!snap1ROMI && mkt1 > 0) { snap1ROMI = Math.round((((Number(snap1.revenue_services)||0) - mkt1) / mkt1) * 1000) / 10; }
      var snap2ROMI = snap2 ? (Number(cd2.romi) || 0) : 0;
      var mkt2 = snap2 ? Number(snap2.expense_marketing)||0 : 0;
      if (snap2 && !snap2ROMI && mkt2 > 0) { snap2ROMI = Math.round((((Number(snap2.revenue_services)||0) - mkt2) / mkt2) * 1000) / 10; }
      // LTV is already set from live data or snapshot - no fallback overwrite

      // Compute taxes for each comparison period from tax_payments
      var snap1Taxes = 0, snap2Taxes = 0;
      var allTxP = data.taxPayments || [];
      if (snap1 && snap1.period_type === 'month') {
        for (var txI = 0; txI < allTxP.length; txI++) { if (allTxP[txI].period_key === snap1.period_key) snap1Taxes += Number(allTxP[txI].amount) || 0; }
      } else if (snap1 && snap1.period_type === 'quarter') {
        var qmMap = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]};
        var qn = parseInt((snap1.period_key||'').replace(/.*Q/,'')) || 0;
        var qy = parseInt((snap1.period_key||'').split('-')[0]) || currentYear;
        if (qmMap[qn]) { for (var qmi2 = 0; qmi2 < qmMap[qn].length; qmi2++) { var qmk2 = qy + '-' + String(qmMap[qn][qmi2]).padStart(2,'0'); for (var txJ = 0; txJ < allTxP.length; txJ++) { if (allTxP[txJ].period_key === qmk2) snap1Taxes += Number(allTxP[txJ].amount) || 0; } } }
      }
      if (snap2 && snap2.period_type === 'month') {
        for (var txK = 0; txK < allTxP.length; txK++) { if (allTxP[txK].period_key === snap2.period_key) snap2Taxes += Number(allTxP[txK].amount) || 0; }
      } else if (snap2 && snap2.period_type === 'quarter') {
        var qmMap2 = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]};
        var qn2 = parseInt((snap2.period_key||'').replace(/.*Q/,'')) || 0;
        var qy2 = parseInt((snap2.period_key||'').split('-')[0]) || currentYear;
        if (qmMap2[qn2]) { for (var qmi3 = 0; qmi3 < qmMap2[qn2].length; qmi3++) { var qmk3 = qy2 + '-' + String(qmMap2[qn2][qmi3]).padStart(2,'0'); for (var txL = 0; txL < allTxP.length; txL++) { if (allTxP[txL].period_key === qmk3) snap2Taxes += Number(allTxP[txL].amount) || 0; } } }
      }

      // Section separator helper
      var SECTION = '__section__';

      var cmpMetrics = [
        // ===== REVENUE =====
        {label:'\\u0414\\u043e\\u0445\\u043e\\u0434\\u044b',section:true},
        {label:'\\u041e\\u0431\\u043e\\u0440\\u043e\\u0442',v1:Number(snap1.total_turnover)||0,v2:snap2 ? Number(snap2.total_turnover)||0 : 0,color:'#a78bfa',icon:'fa-coins'},
        {label:'\\u0423\\u0441\\u043b\\u0443\\u0433\\u0438',v1:Number(snap1.revenue_services)||0,v2:snap2 ? Number(snap2.revenue_services)||0 : 0,color:'#8B5CF6',icon:'fa-concierge-bell'},
        {label:'\\u0412\\u044b\\u043a\\u0443\\u043f\\u044b',v1:Number(snap1.revenue_articles)||0,v2:snap2 ? Number(snap2.revenue_articles)||0 : 0,color:'#F59E0B',icon:'fa-shopping-bag'},
        {label:'\\u0412\\u043e\\u0437\\u0432\\u0440\\u0430\\u0442\\u044b',v1:Number(snap1.refunds)||0,v2:snap2 ? Number(snap2.refunds)||0 : 0,color:'#f87171',icon:'fa-undo',isExpense:true},
        // ===== EXPENSES =====
        {label:'\\u0420\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b',section:true},
        {label:'\\u0417\\u041f + \\u0411\\u043e\\u043d\\u0443\\u0441\\u044b',v1:snap1ExpSal,v2:snap2ExpSal,color:'#3B82F6',icon:'fa-users',isExpense:true,
          detail1: (snap1 && salSummaryLoading[snap1.period_key]) ? '<i class="fas fa-spinner fa-spin" style="font-size:0.55rem"></i> загрузка...' : '\\u0417\\u041f: ' + fmtAmt(snap1SalBase) + ' | \\u0411\\u043e\\u043d/\\u0428\\u0442\\u0440: ' + (snap1BonNet >= 0 ? '+' : '') + fmtAmt(snap1BonNet),
          detail2: snap2 ? ((salSummaryLoading[snap2.period_key]) ? '<i class="fas fa-spinner fa-spin" style="font-size:0.55rem"></i> загрузка...' : '\\u0417\\u041f: ' + fmtAmt(snap2SalBase) + ' | \\u0411\\u043e\\u043d/\\u0428\\u0442\\u0440: ' + (snap2BonNet >= 0 ? '+' : '') + fmtAmt(snap2BonNet)) : ''},
        {label:'\\u041a\\u043e\\u043c\\u043c\\u0435\\u0440\\u0447\\u0435\\u0441\\u043a\\u0438\\u0435',v1:snap1ExpComm,v2:snap2ExpComm,color:'#EF4444',icon:'fa-store',isExpense:true},
        {label:'\\u041c\\u0430\\u0440\\u043a\\u0435\\u0442\\u0438\\u043d\\u0433',v1:snap1ExpMkt,v2:snap2ExpMkt,color:'#EC4899',icon:'fa-bullhorn',isExpense:true},
        {label:'\\u0420\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b (\\u0438\\u0442\\u043e\\u0433\\u043e)',v1:exp1,v2:exp2,color:'#EF4444',icon:'fa-receipt',isExpense:true,bold:true},
        // ===== PROFIT =====
        {label:'\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c',section:true},
        {label:'\\u0427\\u0438\\u0441\\u0442\\u0430\\u044f \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c',v1:snap1NP,v2:snap2NP,color:'#22C55E',icon:'fa-chart-line',bold:true},
        {label:'\\u041c\\u0430\\u0440\\u0436\\u0430 \\u043f\\u0440\\u0438\\u0431\\u044b\\u043b\\u0438 %',v1:snap1ProfitMargin,v2:snap2ProfitMargin,color:'#10B981',icon:'fa-percentage',isPct:true},
        // ===== TAXES =====
        {label:'\\u041d\\u0430\\u043b\\u043e\\u0433\\u0438',section:true},
        {label:'\\u041d\\u0430\\u043b\\u043e\\u0433\\u0438 (\\u0438\\u0442\\u043e\\u0433\\u043e)',v1:snap1Taxes,v2:snap2Taxes,color:'#F59E0B',icon:'fa-landmark',isExpense:true},
        {label:'\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u043f\\u043e\\u0441\\u043b\\u0435 \\u043d\\u0430\\u043b\\u043e\\u0433\\u043e\\u0432',v1:snap1NP - snap1Taxes,v2:snap2NP - snap2Taxes,color:'#10B981',icon:'fa-check-double',bold:true},
        // ===== LEADS =====
        {label:'\\u041b\\u0438\\u0434\\u044b',section:true},
        {label:'\\u041b\\u0438\\u0434\\u044b (\\u0432\\u0441\\u0435\\u0433\\u043e)',v1:Number(snap1.leads_count)||0,v2:snap2 ? Number(snap2.leads_count)||0 : 0,color:'#10B981',icon:'fa-users',isCnt:true},
        {label:'\\u0417\\u0430\\u0432\\u0435\\u0440\\u0448\\u0435\\u043d\\u043e',v1:Number(snap1.leads_done)||0,v2:snap2 ? Number(snap2.leads_done)||0 : 0,color:'#22C55E',icon:'fa-check-circle',isCnt:true},
        {label:'\\u0421\\u0440. \\u0447\\u0435\\u043a (\\u0443\\u0441\\u043b\\u0443\\u0433\\u0438)',v1:snap1AvgCheck,v2:snap2AvgCheck,color:'#8B5CF6',icon:'fa-shopping-cart'},
        // ===== KPI =====
        {label:'\\u041a\\u043b\\u044e\\u0447\\u0435\\u0432\\u044b\\u0435 KPI',section:true},
        {label:'\\u041a\\u043e\\u043d\\u0432\\u0435\\u0440\\u0441\\u0438\\u044f',v1:snap1Conv,v2:snap2Conv,color:'#F59E0B',icon:'fa-percentage',isPct:true},
        {label:'\\u041c\\u0430\\u0440\\u0436\\u0438\\u043d\\u0430\\u043b\\u044c\\u043d\\u043e\\u0441\\u0442\\u044c',v1:snap1Margin,v2:snap2Margin,color:'#10B981',icon:'fa-percentage',isPct:true},
        {label:'ROI',v1:snap1ROI,v2:snap2ROI,color:'#3B82F6',icon:'fa-chart-bar',isPct:true},
        {label:'ROMI',v1:snap1ROMI,v2:snap2ROMI,color:'#EC4899',icon:'fa-bullhorn',isPct:true},
        // ===== PRO METRICS =====
        {label:'\\u041f\\u0440\\u043e\\u0444-\\u043c\\u0435\\u0442\\u0440\\u0438\\u043a\\u0438',section:true},
        {label:'CPL (\\u0441\\u0442\\u043e\\u0438\\u043c. \\u043b\\u0438\\u0434\\u0430)',v1:snap1CPL,v2:snap2CPL,color:'#F97316',icon:'fa-tag',isExpense:true},
        {label:'CPA (\\u0441\\u0442\\u043e\\u0438\\u043c. \\u043a\\u043b\\u0438\\u0435\\u043d\\u0442\\u0430)',v1:snap1CPA,v2:snap2CPA,color:'#EF4444',icon:'fa-crosshairs',isExpense:true},
        {label:'CAC (\\u043f\\u0440\\u0438\\u0432\\u043b\\u0435\\u0447\\u0435\\u043d\\u0438\\u0435)',v1:snap1CAC,v2:snap2CAC,color:'#F97316',icon:'fa-user-plus',isExpense:true},
        {label:'\\u0414\\u043e\\u0445\\u043e\\u0434 \\u043d\\u0430 \\u043b\\u0438\\u0434',v1:snap1RPL,v2:snap2RPL,color:'#22C55E',icon:'fa-hand-holding-usd'},
        {label:'LTV',v1:snap1LTV,v2:snap2LTV,color:'#a78bfa',icon:'fa-gem'},
      ];
      // Period status labels
      var snap1Lbl = snap1.period_key + (snap1.is_locked ? ' \\ud83d\\udd12' : ' (\\u0442\\u0435\\u043a\\u0443\\u0449\\u0438\\u0439)');
      var snap2Lbl = snap2 ? snap2.period_key + (snap2.is_locked ? ' \\ud83d\\udd12' : ' (\\u0442\\u0435\\u043a\\u0443\\u0449\\u0438\\u0439)') : '';
      var isSingleView = !snap2;
      h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.82rem">';
      h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155">';
      h += '<th style="padding:10px 16px;text-align:left;color:#94a3b8">\\u041c\\u0435\\u0442\\u0440\\u0438\\u043a\\u0430</th>';
      h += '<th style="padding:10px;text-align:right;color:#a78bfa">' + snap1Lbl + '</th>';
      if (!isSingleView) {
        h += '<th style="padding:10px;text-align:right;color:#F59E0B">' + snap2Lbl + '</th>';
        h += '<th style="padding:10px;text-align:right;color:#94a3b8">\\u0394 \\u0420\\u0430\\u0437\\u043d\\u0438\\u0446\\u0430</th>';
        h += '<th style="padding:10px;text-align:right;color:#94a3b8;min-width:120px">% \\u0418\\u0437\\u043c\\u0435\\u043d\\u0435\\u043d\\u0438\\u0435</th>';
      }
      h += '</tr></thead><tbody>';
      for (var cmi = 0; cmi < cmpMetrics.length; cmi++) {
        var cm = cmpMetrics[cmi];
        // Section headers
        if (cm.section) {
          h += '<tr style="background:rgba(139,92,246,0.06);border-bottom:1px solid #334155"><td colspan="' + (isSingleView ? 2 : 5) + '" style="padding:8px 16px;font-weight:700;font-size:0.78rem;color:#a78bfa;text-transform:uppercase;letter-spacing:0.05em"><i class="fas fa-caret-right" style="margin-right:6px"></i>' + cm.label + '</td></tr>';
          continue;
        }
        // Values — expenses stored as POSITIVE in DB, display as negative
        var rawV1 = cm.v1 || 0;
        var rawV2 = cm.v2 || 0;

        // For diff calculation: expenses increase = bad, so diff on raw values
        // diff > 0 means period1 has MORE of this metric
        var diff = rawV1 - rawV2;

        // Percentage: compare raw absolute values correctly
        // For expenses: spending went from rawV2 to rawV1
        // % change = (rawV1 - rawV2) / rawV2 * 100
        var diffPctVal = 0;
        if (rawV2 !== 0) {
          diffPctVal = (diff / Math.abs(rawV2)) * 100;
        } else if (rawV1 !== 0 && !isSingleView) {
          diffPctVal = rawV1 > 0 ? 100 : -100;
        }

        // Color logic:
        // - For expenses (isExpense): MORE spending = RED, LESS spending = GREEN
        // - For revenue/profit: MORE = GREEN, LESS = RED
        var diffColor;
        if (isSingleView || diff === 0) { diffColor = '#64748b'; }
        else if (cm.isExpense) { diffColor = diff > 0 ? '#EF4444' : '#22C55E'; }
        else { diffColor = diff > 0 ? '#22C55E' : diff < 0 ? '#EF4444' : '#64748b'; }

        // Format value for display
        var fmtV = function(v, m) {
          if (m.isCnt) return String(Math.round(v));
          if (m.isPct) return v.toFixed(1) + '%';
          if (m.isExpense && v > 0) return '-' + fmtAmt(Math.round(v));
          if (m.isExpense && v === 0) return fmtAmt(0);
          return fmtAmt(Math.round(v));
        };

        // Format diff for display
        var fmtDiffFn = function(d2, m) {
          if (m.isCnt) return (d2 > 0 ? '+' : '') + Math.round(d2);
          if (m.isPct) return (d2 > 0 ? '+' : '') + d2.toFixed(1) + '%';
          if (m.isExpense) {
            // For expenses: increase in spending is bad, show as positive diff
            return (d2 > 0 ? '+' : '') + fmtAmt(Math.round(d2));
          }
          return (d2 > 0 ? '+' : '') + fmtAmt(Math.round(d2));
        };

        // Value color: expenses always red, revenue/profit depends
        var valColor1 = cm.isExpense ? '#EF4444' : (cm.bold ? (rawV1 >= 0 ? '#22C55E' : '#EF4444') : cm.color);
        var valColor2 = cm.isExpense ? '#EF4444' : (cm.bold ? (rawV2 >= 0 ? '#22C55E' : '#EF4444') : cm.color);

        var rowStyle = cm.bold ? 'font-weight:700;background:rgba(139,92,246,0.04);' : '';
        h += '<tr style="border-bottom:1px solid #1e293b;' + rowStyle + '">';
        h += '<td style="padding:9px 16px;font-weight:600"><i class="fas ' + cm.icon + '" style="color:' + cm.color + ';margin-right:6px;font-size:0.7rem;width:14px;text-align:center"></i>' + cm.label + '</td>';
        h += '<td style="padding:9px;text-align:right;font-weight:600;color:' + valColor1 + '">' + fmtV(rawV1, cm) + '</td>';
        if (!isSingleView) {
          h += '<td style="padding:9px;text-align:right;font-weight:600;color:' + valColor2 + '">' + fmtV(rawV2, cm) + '</td>';
          h += '<td style="padding:9px;text-align:right;font-weight:700;color:' + diffColor + '">' + fmtDiffFn(diff, cm) + '</td>';
          h += '<td style="padding:9px;text-align:right;font-weight:700;color:' + diffColor + '">';
          if (diff !== 0 && !isSingleView) {
            var arrow = (cm.isExpense ? (diff > 0 ? '\\u2191' : '\\u2193') : (diff > 0 ? '\\u2191' : '\\u2193'));
            var absPct = Math.min(Math.abs(diffPctVal), 999);
            var barW = Math.max(Math.min(absPct * 0.6, 100), 4);
            h += '<div style="display:inline-flex;align-items:center;gap:6px;justify-content:flex-end">';
            h += '<div style="width:60px;height:6px;background:#1e293b;border-radius:3px;overflow:hidden;display:inline-block"><div style="width:' + barW + '%;height:100%;background:' + diffColor + ';border-radius:3px"></div></div>';
            h += '<span>' + arrow + ' ' + (diffPctVal > 0 ? '+' : '') + diffPctVal.toFixed(1) + '%</span>';
            h += '</div>';
          } else { h += '<span style="color:#64748b">\\u2014</span>'; }
          h += '</td>';
        }
        h += '</tr>';
        // Show detail rows (salary/bonus breakdown etc.)
        if (cm.detail1 || cm.detail2) {
          h += '<tr style="border-bottom:1px solid #0f172a;background:#0f172a22"><td style="padding:3px 16px;padding-left:36px;font-size:0.68rem;color:#475569"></td>';
          h += '<td style="padding:3px;text-align:right;font-size:0.68rem;color:#64748b">' + (cm.detail1 || '') + '</td>';
          if (!isSingleView) {
            h += '<td style="padding:3px;text-align:right;font-size:0.68rem;color:#64748b">' + (cm.detail2 || '') + '</td>';
            h += '<td colspan="2"></td>';
          }
          h += '</tr>';
        }
      }
      h += '</tbody></table></div>';

      // ===== PRO: SUMMARY / INSIGHTS CARD =====
      if (!isSingleView) {
        var totalMetrics = 0; var improvCount = 0; var declineCount = 0;
        var improvLabels = []; var declineLabels = [];
        for (var si4 = 0; si4 < cmpMetrics.length; si4++) {
          var m2 = cmpMetrics[si4];
          if (m2.section || m2.isCnt) continue;
          var d4 = (m2.v1||0) - (m2.v2||0);
          if (d4 === 0) continue;
          totalMetrics++;
          var isGood = m2.isExpense ? (d4 < 0) : (d4 > 0);
          if (isGood) { improvCount++; improvLabels.push(m2.label); }
          else { declineCount++; declineLabels.push(m2.label); }
        }
        var healthScore = totalMetrics > 0 ? Math.round((improvCount / totalMetrics) * 100) : 0;
        var healthColor = healthScore >= 60 ? '#22C55E' : healthScore >= 40 ? '#F59E0B' : '#EF4444';
        var healthIcon = healthScore >= 60 ? 'fa-arrow-trend-up' : healthScore >= 40 ? 'fa-arrows-alt-h' : 'fa-arrow-trend-down';
        var healthLabel = healthScore >= 60 ? '\\u041f\\u043e\\u0437\\u0438\\u0442\\u0438\\u0432\\u043d\\u0430\\u044f \\u0434\\u0438\\u043d\\u0430\\u043c\\u0438\\u043a\\u0430' : healthScore >= 40 ? '\\u0421\\u0442\\u0430\\u0431\\u0438\\u043b\\u044c\\u043d\\u043e' : '\\u0422\\u0440\\u0435\\u0431\\u0443\\u0435\\u0442 \\u0432\\u043d\\u0438\\u043c\\u0430\\u043d\\u0438\\u044f';
        h += '<div class="card" style="padding:20px;margin-top:16px;border:2px solid ' + healthColor + '33">';
        h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">';
        h += '<div style="width:60px;height:60px;border-radius:50%;background:' + healthColor + '15;display:flex;align-items:center;justify-content:center"><i class="fas ' + healthIcon + '" style="color:' + healthColor + ';font-size:1.4rem"></i></div>';
        h += '<div style="flex:1"><div style="font-weight:700;font-size:1.1rem;color:' + healthColor + '">' + healthLabel + '</div>';
        h += '<div style="font-size:0.82rem;color:#94a3b8;margin-top:2px">\\u0417\\u0434\\u043e\\u0440\\u043e\\u0432\\u044c\\u0435 \\u0431\\u0438\\u0437\\u043d\\u0435\\u0441\\u0430: <strong style="color:' + healthColor + '">' + healthScore + '%</strong> | \\u0423\\u043b\\u0443\\u0447\\u0448\\u0435\\u043d\\u0438\\u044f: <strong style="color:#22C55E">' + improvCount + '</strong> | \\u0421\\u043d\\u0438\\u0436\\u0435\\u043d\\u0438\\u044f: <strong style="color:#EF4444">' + declineCount + '</strong></div></div>';
        // Score ring
        h += '<div style="position:relative;width:56px;height:56px;flex-shrink:0"><svg viewBox="0 0 36 36" style="width:56px;height:56px"><path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#1e293b" stroke-width="3"/><path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="' + healthColor + '" stroke-width="3" stroke-dasharray="' + healthScore + ', 100" stroke-linecap="round"/></svg><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.7rem;color:' + healthColor + '">' + healthScore + '</div></div>';
        h += '</div>';
        // Key delta cards
        var profitDiff = snap1NP - snap2NP;
        var revDiff = (Number(snap1.revenue_services)||0) - (Number(snap2.revenue_services)||0);
        var expDiffCalc = exp1 - exp2;
        h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">';
        h += '<div style="padding:12px;border-radius:8px;background:#0f172a;text-align:center;border:1px solid ' + (profitDiff >= 0 ? '#22C55E33' : '#EF444433') + '"><div style="font-size:0.7rem;color:#94a3b8">\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u0394</div><div style="font-weight:700;font-size:1.05rem;color:' + (profitDiff >= 0 ? '#22C55E' : '#EF4444') + '">' + (profitDiff >= 0 ? '+' : '') + fmtAmt(profitDiff) + '</div></div>';
        h += '<div style="padding:12px;border-radius:8px;background:#0f172a;text-align:center;border:1px solid ' + (revDiff >= 0 ? '#22C55E33' : '#EF444433') + '"><div style="font-size:0.7rem;color:#94a3b8">\\u0412\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 \\u0394</div><div style="font-weight:700;font-size:1.05rem;color:' + (revDiff >= 0 ? '#22C55E' : '#EF4444') + '">' + (revDiff >= 0 ? '+' : '') + fmtAmt(revDiff) + '</div></div>';
        h += '<div style="padding:12px;border-radius:8px;background:#0f172a;text-align:center;border:1px solid ' + (expDiffCalc <= 0 ? '#22C55E33' : '#EF444433') + '"><div style="font-size:0.7rem;color:#94a3b8">\\u0420\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b \\u0394</div><div style="font-weight:700;font-size:1.05rem;color:' + (expDiffCalc <= 0 ? '#22C55E' : '#EF4444') + '">' + (expDiffCalc > 0 ? '+' : '') + fmtAmt(expDiffCalc) + '</div></div>';
        h += '</div>';
        // Detailed improvement/decline breakdown
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
        if (improvLabels.length > 0) {
          h += '<div style="padding:12px;border-radius:8px;background:rgba(34,197,94,0.06);border:1px solid #22C55E22">';
          h += '<div style="font-size:0.75rem;font-weight:700;color:#22C55E;margin-bottom:8px"><i class="fas fa-check-circle" style="margin-right:4px"></i>\\u0423\\u043b\\u0443\\u0447\\u0448\\u0435\\u043d\\u0438\\u044f (' + improvLabels.length + ')</div>';
          for (var il2 = 0; il2 < improvLabels.length; il2++) {
            h += '<div style="font-size:0.72rem;color:#94a3b8;padding:2px 0"><i class="fas fa-arrow-up" style="color:#22C55E;margin-right:4px;font-size:0.6rem"></i>' + improvLabels[il2] + '</div>';
          }
          h += '</div>';
        }
        if (declineLabels.length > 0) {
          h += '<div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.06);border:1px solid #EF444422">';
          h += '<div style="font-size:0.75rem;font-weight:700;color:#EF4444;margin-bottom:8px"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>\\u0422\\u0440\\u0435\\u0431\\u0443\\u0435\\u0442 \\u0432\\u043d\\u0438\\u043c\\u0430\\u043d\\u0438\\u044f (' + declineLabels.length + ')</div>';
          for (var dl2 = 0; dl2 < declineLabels.length; dl2++) {
            h += '<div style="font-size:0.72rem;color:#94a3b8;padding:2px 0"><i class="fas fa-arrow-down" style="color:#EF4444;margin-right:4px;font-size:0.6rem"></i>' + declineLabels[dl2] + '</div>';
          }
          h += '</div>';
        }
        h += '</div>';
        // Expert recommendation
        var recommendation = '';
        if (profitDiff > 0 && revDiff > 0 && expDiffCalc <= 0) recommendation = '\\u0418\\u0434\\u0435\\u0430\\u043b\\u044c\\u043d\\u0430\\u044f \\u0434\\u0438\\u043d\\u0430\\u043c\\u0438\\u043a\\u0430: \\u0432\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 \\u0440\\u0430\\u0441\\u0442\\u0451\\u0442, \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b \\u0441\\u043d\\u0438\\u0436\\u0430\\u044e\\u0442\\u0441\\u044f. \\u041c\\u0430\\u0441\\u0448\\u0442\\u0430\\u0431\\u0438\\u0440\\u0443\\u0439\\u0442\\u0435 \\u0442\\u0435\\u043a\\u0443\\u0449\\u0443\\u044e \\u0441\\u0442\\u0440\\u0430\\u0442\\u0435\\u0433\\u0438\\u044e.';
        else if (profitDiff > 0 && expDiffCalc > 0) recommendation = '\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u0440\\u0430\\u0441\\u0442\\u0451\\u0442, \\u043d\\u043e \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b \\u0442\\u043e\\u0436\\u0435. \\u041f\\u0440\\u043e\\u0432\\u0435\\u0440\\u044c\\u0442\\u0435 \\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u043e\\u0441\\u0442\\u044c \\u0442\\u0440\\u0430\\u0442 \\u2014 \\u043e\\u043f\\u0442\\u0438\\u043c\\u0438\\u0437\\u0430\\u0446\\u0438\\u044f \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u043e\\u0432 \\u043c\\u043e\\u0436\\u0435\\u0442 \\u0443\\u0432\\u0435\\u043b\\u0438\\u0447\\u0438\\u0442\\u044c \\u043c\\u0430\\u0440\\u0436\\u0443.';
        else if (profitDiff < 0 && revDiff < 0) recommendation = '\\u041f\\u0440\\u0438\\u0431\\u044b\\u043b\\u044c \\u0438 \\u0432\\u044b\\u0440\\u0443\\u0447\\u043a\\u0430 \\u0441\\u043d\\u0438\\u0436\\u0430\\u044e\\u0442\\u0441\\u044f. \\u041f\\u0435\\u0440\\u0435\\u0441\\u043c\\u043e\\u0442\\u0440\\u0438\\u0442\\u0435 \\u0432\\u043e\\u0440\\u043e\\u043d\\u043a\\u0443 \\u043f\\u0440\\u043e\\u0434\\u0430\\u0436, \\u043c\\u0430\\u0440\\u043a\\u0435\\u0442\\u0438\\u043d\\u0433 \\u0438 \\u0446\\u0435\\u043d\\u043e\\u043e\\u0431\\u0440\\u0430\\u0437\\u043e\\u0432\\u0430\\u043d\\u0438\\u0435.';
        else if (profitDiff < 0 && expDiffCalc > 0) recommendation = '\\u0420\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b \\u0440\\u0430\\u0441\\u0442\\u0443\\u0442 \\u0431\\u044b\\u0441\\u0442\\u0440\\u0435\\u0435 \\u0434\\u043e\\u0445\\u043e\\u0434\\u043e\\u0432. \\u0421\\u0440\\u043e\\u0447\\u043d\\u043e \\u043f\\u0440\\u043e\\u0432\\u0435\\u0434\\u0438\\u0442\\u0435 \\u0430\\u0443\\u0434\\u0438\\u0442 \\u0437\\u0430\\u0442\\u0440\\u0430\\u0442 \\u0438 \\u0441\\u043e\\u043a\\u0440\\u0430\\u0442\\u0438\\u0442\\u0435 \\u043d\\u0435\\u044d\\u0444\\u0444\\u0435\\u043a\\u0442\\u0438\\u0432\\u043d\\u044b\\u0435 \\u0440\\u0430\\u0441\\u0445\\u043e\\u0434\\u044b.';
        else recommendation = '\\u0414\\u0438\\u043d\\u0430\\u043c\\u0438\\u043a\\u0430 \\u0441\\u043c\\u0435\\u0448\\u0430\\u043d\\u043d\\u0430\\u044f. \\u0410\\u043d\\u0430\\u043b\\u0438\\u0437\\u0438\\u0440\\u0443\\u0439\\u0442\\u0435 \\u043a\\u0430\\u0436\\u0434\\u0443\\u044e \\u043c\\u0435\\u0442\\u0440\\u0438\\u043a\\u0443 \\u043e\\u0442\\u0434\\u0435\\u043b\\u044c\\u043d\\u043e \\u0434\\u043b\\u044f \\u043f\\u043e\\u0438\\u0441\\u043a\\u0430 \\u0442\\u043e\\u0447\\u0435\\u043a \\u0440\\u043e\\u0441\\u0442\\u0430.';
        h += '<div style="margin-top:12px;padding:12px 16px;border-radius:8px;background:#0f172a;border-left:3px solid ' + healthColor + '">';
        h += '<div style="font-size:0.72rem;font-weight:600;color:' + healthColor + ';margin-bottom:4px"><i class="fas fa-lightbulb" style="margin-right:4px"></i>\\u0420\\u0435\\u043a\\u043e\\u043c\\u0435\\u043d\\u0434\\u0430\\u0446\\u0438\\u044f</div>';
        h += '<div style="font-size:0.78rem;color:#e2e8f0">' + recommendation + '</div>';
        h += '</div>';
        h += '</div>';
      }
    } else {
      h += '<div class="card" style="padding:20px;text-align:center;color:#475569"><i class="fas fa-arrows-alt-h" style="margin-right:8px"></i>\\u0412\\u044b\\u0431\\u0435\\u0440\\u0438\\u0442\\u0435 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434 \\u0434\\u043b\\u044f \\u043f\\u0440\\u043e\\u0441\\u043c\\u043e\\u0442\\u0440\\u0430 (\\u0438\\u043b\\u0438 \\u0434\\u0432\\u0430 \\u0434\\u043b\\u044f \\u0441\\u0440\\u0430\\u0432\\u043d\\u0435\\u043d\\u0438\\u044f)</div>';
    }
  } else {
    h += '<div class="card" style="padding:24px;text-align:center;color:#475569"><i class="fas fa-info-circle" style="margin-right:8px"></i>\\u0417\\u0430\\u043a\\u0440\\u043e\\u0439\\u0442\\u0435 \\u043f\\u0435\\u0440\\u0432\\u044b\\u0439 \\u043c\\u0435\\u0441\\u044f\\u0446 \\u0447\\u0442\\u043e\\u0431\\u044b \\u0443\\u0432\\u0438\\u0434\\u0435\\u0442\\u044c \\u0441\\u0440\\u0430\\u0432\\u043d\\u0435\\u043d\\u0438\\u0435</div>';
  }
  h += '</div>';

  // ===== COMMISSION TREND IN PERIODS =====
  var commDataPer = d.commission_data || {};
  var totalCommPer = commDataPer.total_commission || 0;
  h += '<div class="card" style="margin-top:20px;padding:20px;border:1px solid rgba(59,130,246,0.2)">';
  h += '<h3 style="font-weight:700;margin-bottom:12px;font-size:0.95rem"><i class="fas fa-credit-card" style="color:#3B82F6;margin-right:8px"></i>\\u041a\\u043e\\u043c\\u0438\\u0441\\u0441\\u0438\\u0438 \\u0437\\u0430 \\u0441\\u043f\\u043e\\u0441\\u043e\\u0431\\u044b \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b</h3>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">';
  h += '<div style="padding:12px;background:rgba(59,130,246,0.08);border-radius:8px"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:2px">\\u0418\\u0442\\u043e\\u0433\\u043e \\u043a\\u043e\\u043c\\u0438\\u0441\\u0441\\u0438\\u0439</div><div style="font-size:1.2rem;font-weight:800;color:#3B82F6">' + fmtAmt(totalCommPer) + '</div></div>';
  h += '<div style="padding:12px;background:rgba(34,197,94,0.08);border-radius:8px"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:2px">\\u041b\\u0438\\u0434\\u043e\\u0432 \\u0441 \\u043e\\u043f\\u043b\\u0430\\u0442\\u043e\\u0439</div><div style="font-size:1.2rem;font-weight:800;color:#22C55E">' + fmtNum(commDataPer.leads_with_method || 0) + '</div></div>';
  h += '<div style="padding:12px;background:rgba(245,158,11,0.08);border-radius:8px"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:2px">\\u0411\\u0435\\u0437 \\u043c\\u0435\\u0442\\u043e\\u0434\\u0430 \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b</div><div style="font-size:1.2rem;font-weight:800;color:#F59E0B">' + fmtNum(commDataPer.leads_without_method || 0) + '</div></div>';
  var avgCommPer = (commDataPer.leads_with_method || 0) > 0 ? Math.round(totalCommPer / commDataPer.leads_with_method) : 0;
  h += '<div style="padding:12px;background:rgba(139,92,246,0.08);border-radius:8px"><div style="font-size:0.72rem;color:#94a3b8;margin-bottom:2px">\\u0421\\u0440\\u0435\\u0434\\u043d\\u044f\\u044f \\u043a\\u043e\\u043c\\u0438\\u0441\\u0441\\u0438\\u044f</div><div style="font-size:1.2rem;font-weight:800;color:#a78bfa">' + fmtAmt(avgCommPer) + '</div></div>';
  h += '</div>';
  var byMethodPer = commDataPer.by_method || [];
  if (byMethodPer.length > 0) {
    h += '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;margin-top:12px"><thead><tr style="border-bottom:2px solid #334155">' +
      '<th style="padding:8px 12px;text-align:left;color:#94a3b8">\\u0421\\u043f\\u043e\\u0441\\u043e\\u0431</th>' +
      '<th style="padding:8px;text-align:center;color:#94a3b8">%</th>' +
      '<th style="padding:8px;text-align:center;color:#94a3b8">\\u041b\\u0438\\u0434\\u043e\\u0432</th>' +
      '<th style="padding:8px;text-align:right;color:#94a3b8">\\u0411\\u0430\\u0437\\u0430</th>' +
      '<th style="padding:8px;text-align:right;color:#94a3b8">\\u041a\\u043e\\u043c\\u0438\\u0441\\u0441\\u0438\\u044f</th></tr></thead><tbody>';
    for (var cpi = 0; cpi < byMethodPer.length; cpi++) {
      var cpm = byMethodPer[cpi];
      h += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:6px 12px;color:#e2e8f0;font-weight:600"><i class="fas fa-credit-card" style="margin-right:6px;color:#3B82F6;font-size:0.7rem"></i>' + escHtml(cpm.name_ru) + '</td>' +
        '<td style="padding:6px 8px;text-align:center;color:#94a3b8">' + cpm.pct + '%</td>' +
        '<td style="padding:6px 8px;text-align:center;color:#e2e8f0;font-weight:600">' + fmtNum(cpm.count) + '</td>' +
        '<td style="padding:6px 8px;text-align:right;color:#94a3b8">' + fmtAmt(cpm.total_base) + '</td>' +
        '<td style="padding:6px 8px;text-align:right;color:#3B82F6;font-weight:700">' + fmtAmt(cpm.total_commission) + '</td></tr>';
    }
    h += '</tbody></table>';
  } else {
    h += '<div style="text-align:center;color:#64748b;padding:12px;font-size:0.82rem;margin-top:8px"><i class="fas fa-info-circle" style="margin-right:6px"></i>\\u041d\\u0435\\u0442 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445 \\u043e \\u043a\\u043e\\u043c\\u0438\\u0441\\u0441\\u0438\\u044f\\u0445 \\u0437\\u0430 \\u0432\\u044b\\u0431\\u0440\\u0430\\u043d\\u043d\\u044b\\u0439 \\u043f\\u0435\\u0440\\u0438\\u043e\\u0434</div>';
  }
  h += '</div>';

  return h;
}

function expandMonthFromChart(month) {
  if (!month) return;
  expandedMonth = month;
  analyticsData = null;
  loadAnalyticsData();
}

// ===== ANALYTICS HELPER FUNCTIONS =====
async function saveNewCategory() {
  var name = document.getElementById('new-cat-name')?.value;
  var color = document.getElementById('new-cat-color')?.value || '#8B5CF6';
  var isMkt = document.getElementById('new-cat-marketing')?.checked || false;
  if (!name) { toast('Введите название', 'error'); return; }
  var res = await api('/expense-categories', 'POST', { name: name, color: color, is_marketing: isMkt });
  if (res && res.success) { toast('Категория создана'); showAddCategoryForm = false; var r = await api('/expense-categories'); data.expenseCategories = (r&&r.categories)||[]; analyticsData = null; loadAnalyticsData(); }
  else { toast(res?.error || 'Ошибка', 'error'); }
}

async function deleteExpenseCategory(id) {
  if (!confirm('Удалить категорию?')) return;
  await api('/expense-categories/' + id, 'DELETE');
  var r = await api('/expense-categories'); data.expenseCategories = (r&&r.categories)||[]; analyticsData = null; loadAnalyticsData();
}

async function saveNewFreqType() {
  var name = document.getElementById('new-freq-name')?.value;
  if (!name) { toast('Введите название', 'error'); return; }
  var res = await api('/expense-frequency-types', 'POST', { name: name });
  if (res && res.success) { toast('Тип создан'); showAddFreqTypeForm = false; var r = await api('/expense-frequency-types'); data.expenseFreqTypes = (r&&r.types)||[]; render(); }
  else { toast(res?.error || 'Ошибка', 'error'); }
}

async function deleteFreqType(id) {
  if (!confirm('Удалить тип периодичности?')) return;
  await api('/expense-frequency-types/' + id, 'DELETE');
  var r = await api('/expense-frequency-types'); data.expenseFreqTypes = (r&&r.types)||[]; render();
}

async function saveNewExpense() {
  var name = document.getElementById('new-exp-name')?.value;
  var amount = Number(document.getElementById('new-exp-amount')?.value) || 0;
  var categoryId = document.getElementById('new-exp-category')?.value || null;
  var freqId = document.getElementById('new-exp-freq')?.value || null;
  var notes = document.getElementById('new-exp-notes')?.value || '';
  var startDate = document.getElementById('new-exp-start')?.value || '';
  var endDate = document.getElementById('new-exp-end')?.value || '';
  if (!name) { toast('Введите название', 'error'); return; }
  var res = await api('/expenses', 'POST', { name: name, amount: amount, category_id: categoryId ? Number(categoryId) : null, frequency_type_id: freqId ? Number(freqId) : null, notes: notes, start_date: startDate, end_date: endDate });
  if (res && res.success) { toast('Затрата добавлена'); showAddExpenseForm = false; var r = await api('/expenses'); data.expenses = (r&&r.expenses)||[]; analyticsData = null; loadAnalyticsData(); }
  else { toast(res?.error || 'Ошибка', 'error'); }
}

async function deleteExpense(id) {
  if (!confirm('Удалить затрату?')) return;
  await api('/expenses/' + id, 'DELETE');
  var r = await api('/expenses'); data.expenses = (r&&r.expenses)||[]; analyticsData = null; loadAnalyticsData();
}

async function editExpenseInline(id, currentAmount) {
  // Legacy — redirect to inline form
  editingExpenseId = id; render();
}

async function saveEditedExpense(id) {
  var name = document.getElementById('edit-exp-name-' + id)?.value;
  var amount = Number(document.getElementById('edit-exp-amount-' + id)?.value) || 0;
  var categoryId = document.getElementById('edit-exp-cat-' + id)?.value || null;
  var freqId = document.getElementById('edit-exp-freq-' + id)?.value || null;
  var notes = document.getElementById('edit-exp-notes-' + id)?.value || '';
  var startDate = document.getElementById('edit-exp-start-' + id)?.value || '';
  var endDate = document.getElementById('edit-exp-end-' + id)?.value || '';
  if (!name) { toast('\\u0412\\u0432\\u0435\\u0434\\u0438\\u0442\\u0435 \\u043d\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435', 'error'); return; }
  var body = { name: name, amount: amount, category_id: categoryId ? Number(categoryId) : null, frequency_type_id: freqId ? Number(freqId) : null, notes: notes, start_date: startDate, end_date: endDate };
  var res = await api('/expenses/' + id, 'PUT', body);
  if (res && res.success) { toast('\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u043e'); editingExpenseId = 0; var r = await api('/expenses'); data.expenses = (r&&r.expenses)||[]; analyticsData = null; loadAnalyticsData(); }
  else { toast(res?.error || '\\u041e\\u0448\\u0438\\u0431\\u043a\\u0430', 'error'); }
}

async function updateUserSalary(userId, field, value) {
  var body = {};
  body[field] = value;
  var res = await api('/users/' + userId + '/salary', 'PUT', body);
  if (res && res.success) { toast('Обновлено'); var r = await api('/users'); data.users = ensureArray(r); analyticsData = null; loadAnalyticsData(); }
  else { toast(res?.error || 'Ошибка', 'error'); }
}

async function saveBonus(userId, bonusType) {
  var amount = Number(document.getElementById('bonus-amount-' + userId)?.value) || 0;
  var desc = document.getElementById('bonus-desc-' + userId)?.value || '';
  var bdate = document.getElementById('bonus-date-' + userId)?.value || '';
  if (!amount) { toast('Введите сумму', 'error'); return; }
  if (!bdate) { toast('Укажите дату', 'error'); return; }
  // For fines, send negative amount
  var actualAmount = bonusType === 'fine' ? -Math.abs(amount) : Math.abs(amount);
  var res = await api('/users/' + userId + '/bonuses', 'POST', { amount: actualAmount, bonus_type: bonusType || 'bonus', description: desc, bonus_date: bdate });
  if (res && res.success) { toast(bonusType === 'fine' ? 'Штраф добавлен' : 'Бонус добавлен'); showAddBonusUserId = 0; analyticsData = null; loadAnalyticsData(); }
  else { toast(res?.error || 'Ошибка', 'error'); }
}

async function toggleBonusList(userId) {
  if (showBonusListUserId === userId) { showBonusListUserId = 0; bonusListData = []; render(); return; }
  showBonusListUserId = userId;
  var res = await api('/users/' + userId + '/bonuses');
  bonusListData = (res && res.bonuses) || [];
  render();
}

async function deleteBonus(bonusId, userId) {
  if (!confirm('Удалить эту запись?')) return;
  await api('/bonuses/' + bonusId, 'DELETE');
  // Refresh list
  var res = await api('/users/' + userId + '/bonuses');
  bonusListData = (res && res.bonuses) || [];
  analyticsData = null; loadAnalyticsData();
}

async function saveBonusEdit(bonusId, userId, bonusType) {
  var desc = document.getElementById('edit-bonus-desc-' + bonusId)?.value || '';
  var amt = Number(document.getElementById('edit-bonus-amt-' + bonusId)?.value) || 0;
  var bdate = document.getElementById('edit-bonus-date-' + bonusId)?.value || '';
  if (!amt) { toast('\\u0412\\u0432\\u0435\\u0434\\u0438\\u0442\\u0435 \\u0441\\u0443\\u043c\\u043c\\u0443', 'error'); return; }
  var actualAmt = bonusType === 'fine' ? -Math.abs(amt) : Math.abs(amt);
  var res = await api('/bonuses/' + bonusId, 'PUT', { amount: actualAmt, description: desc, bonus_date: bdate });
  if (res && res.success) {
    toast('\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0435\\u043d\\u043e');
    editingBonusId = 0;
    var r = await api('/users/' + userId + '/bonuses');
    bonusListData = (r && r.bonuses) || [];
    analyticsData = null; loadAnalyticsData();
  } else { toast(res?.error || '\\u041e\\u0448\\u0438\\u0431\\u043a\\u0430', 'error'); }
}


`;
