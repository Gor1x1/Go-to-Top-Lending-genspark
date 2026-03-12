/**
 * Admin Panel — State, auth, API helpers, UI helpers, login, data loading, navigation
 * 354 lines of admin SPA JS code
 */
export const CODE: string = `
// ===== STATE =====
let token = localStorage.getItem('gtt_token') || '';
let currentPage = 'dashboard';
let currentUser = JSON.parse(localStorage.getItem('gtt_user') || 'null');
let rolesConfig = JSON.parse(localStorage.getItem('gtt_roles') || 'null');
let data = { content: [], calcTabs: [], calcServices: [], calcPackages: [], telegram: [], scripts: [], stats: {}, referrals: [], sectionOrder: [], leads: { leads: [], total: 0 }, telegramBot: [], pdfTemplate: {}, slotCounters: [], settings: {}, footer: {}, photoBlocks: [], users: [], siteBlocks: [], leadsAnalytics: null, leadComments: {}, leadArticles: {}, companyRoles: [], expenseCategories: [], expenseFreqTypes: [], expenses: [], periodSnapshots: [], taxPayments: [], assets: [], loans: [], loanPayments: [], dividends: [], otherIncomeExpenses: [], loanSettings: { repayment_mode: 'standard', aggressive_pct: 10, standard_extra_pct: 0 }, paymentMethods: [] };

// ===== TOKEN AUTO-REFRESH (every 6 hours) =====
var _tokenRefreshInterval = null;
function startTokenRefresh() {
  if (_tokenRefreshInterval) clearInterval(_tokenRefreshInterval);
  _tokenRefreshInterval = setInterval(async function() {
    if (!token) return;
    try {
      var res = await fetch(API + '/refresh-token', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } });
      if (res.ok) {
        var d = await res.json();
        if (d.token) { token = d.token; localStorage.setItem('gtt_token', token); }
      }
    } catch(e) { console.warn('Token refresh failed:', e); }
  }, 6 * 60 * 60 * 1000); // every 6 hours
}
if (token) startTokenRefresh();

// ===== API HELPERS =====
const API = '/api/admin';
function ensureArray(v) { return Array.isArray(v) ? v : []; }
async function api(path, methodOrOpts, bodyData) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  var opts = {};
  var silent = false;
  if (typeof methodOrOpts === 'string') {
    opts = { method: methodOrOpts };
    if (bodyData !== undefined) opts.body = JSON.stringify(bodyData);
  } else if (methodOrOpts) {
    opts = methodOrOpts;
    if (methodOrOpts._silent) { silent = true; delete opts._silent; }
  }
  // Cache-busting: append timestamp to GET requests to prevent stale data
  var fetchMethod = (opts.method || 'GET').toUpperCase();
  var fetchUrl = API + path;
  if (fetchMethod === 'GET') {
    var sep = path.indexOf('?') >= 0 ? '&' : '?';
    fetchUrl = API + path + sep + '_t=' + Date.now();
  }
  try {
    const res = await fetch(fetchUrl, { ...opts, headers, cache: 'no-store' });
    if (res.status === 401 && !silent) {
      // Try to refresh token once before logging out
      try {
        var refreshRes = await fetch(API + '/refresh-token', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } });
        if (refreshRes.ok) {
          var rd = await refreshRes.json();
          if (rd.token) { token = rd.token; localStorage.setItem('gtt_token', token); return api(path, methodOrOpts, bodyData); }
        }
      } catch(re) {}
      token = ''; localStorage.removeItem('gtt_token'); render(); return null;
    }
    if (res.status === 401) return null;
    return await res.json();
  } catch(e) {
    console.error('API error:', path, e);
    return null;
  }
}

// ===== OPTIMISTIC UI HELPERS =====
function btnLoading(btn, text) {
  if (!btn) return function(){};
  var orig = btn.innerHTML;
  var origW = btn.offsetWidth;
  btn.style.minWidth = origW + 'px';
  btn.disabled = true;
  btn.style.opacity = '0.7';
  btn.style.pointerEvents = 'none';
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;vertical-align:middle;margin-right:6px"></span>' + (text || '');
  return function() { btn.innerHTML = orig; btn.disabled = false; btn.style.opacity = '1'; btn.style.pointerEvents = ''; btn.style.minWidth = ''; };
}
function quickUpdate(selector, html) {
  var el = document.querySelector(selector);
  if (el) el.innerHTML = html;
}
function setProgress(msg) {
  var el = document.getElementById('loadProgress');
  if (el) el.textContent = msg;
}
// Auto-loading state for buttons: wraps onclick handlers
document.addEventListener('click', function(e) {
  var btn = e.target.closest('button, .btn');
  if (!btn || btn.disabled) return;
  if (btn.getAttribute('data-no-spin')) return;
  var onclick = btn.getAttribute('onclick');
  if (!onclick) return;
  // Only auto-spin for save/delete/add/update operations
  if (!/save|delete|remove|add|create|update|force|reactivate|submit|load.*Earning|sendBonus/i.test(onclick)) return;
  // Add spinner
  var origHtml = btn.innerHTML;
  var origW = btn.offsetWidth;
  btn.style.minWidth = origW + 'px';
  btn.classList.add('btn-loading');
  var spinHtml = '<span class="spinner" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></span>';
  var shortText = btn.textContent.trim().substring(0, 12);
  btn.innerHTML = spinHtml + shortText + '...';
  // Auto-restore after 8s max (safety)
  setTimeout(function() { if (btn.classList.contains('btn-loading')) { btn.innerHTML = origHtml; btn.classList.remove('btn-loading'); btn.style.minWidth = ''; } }, 8000);
}, true);

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-amber-600');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function showModal(innerHtml) {
  closeModal();
  var overlay = document.createElement('div');
  overlay.id = '_adminModal';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9998;display:flex;align-items:center;justify-content:center;padding:24px';
  overlay.onclick = function(e) { if (e.target === overlay) closeModal(); };
  var box = document.createElement('div');
  box.style.cssText = 'background:#0f172a;border:1px solid #334155;border-radius:12px;padding:24px;max-width:700px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,0.5)';
  box.innerHTML = innerHtml;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function closeModal() {
  var m = document.getElementById('_adminModal');
  if (m) m.remove();
}

// ===== LOGIN =====
function renderLogin() {
  return '<div class="login-bg"><div class="card" style="width:400px;max-width:90vw">' +
    '<div style="text-align:center;margin-bottom:24px">' +
      '<div style="font-size:2rem;font-weight:800;background:linear-gradient(135deg,#8B5CF6,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Go to Top</div>' +
      '<p style="color:#94a3b8;margin-top:8px">Админ-панель управления сайтом</p>' +
    '</div>' +
    '<form onsubmit="doLogin(event)">' +
      '<div style="margin-bottom:16px"><label style="display:block;font-size:0.85rem;color:#94a3b8;margin-bottom:6px">Логин</label><input class="input" id="loginUser" value="admin" required></div>' +
      '<div style="margin-bottom:20px"><label style="display:block;font-size:0.85rem;color:#94a3b8;margin-bottom:6px">Пароль</label><input class="input" type="password" id="loginPass" required placeholder="Введите пароль"></div>' +
      '<button type="submit" class="btn btn-primary" style="width:100%;padding:12px"><i class="fas fa-sign-in-alt" style="margin-right:8px"></i>Войти</button>' +
    '</form>' +
  '</div></div>';
}

async function doLogin(e) {
  e.preventDefault();
  try {
    const res = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: document.getElementById('loginUser').value, password: document.getElementById('loginPass').value })
    }).then(r => r.json());
    if (res.token) {
      token = res.token;
      currentUser = res.user;
      rolesConfig = res.rolesConfig;
      localStorage.setItem('gtt_token', token);
      localStorage.setItem('gtt_user', JSON.stringify(res.user));
      localStorage.setItem('gtt_roles', JSON.stringify(res.rolesConfig));
      startTokenRefresh();
      toast('Добро пожаловать, ' + (res.user.display_name || res.user.username));
      try { await loadData(); await loadRefServices(); } catch(err) { console.error('loadData error:', err); }
      render();
    } else {
      toast(res.error || 'Ошибка входа', 'error');
    }
  } catch(err) {
    console.error('Login error:', err);
    toast('Ошибка сети', 'error');
  }
}

// ===== DATA LOADING (optimized: single bulk request) =====
async function loadData() {
  setProgress('Загрузка данных...');
  var bulk = await api('/bulk-data');
  if (bulk && !bulk.error) {
    data.content = bulk.content || [];
    data.calcTabs = bulk.calcTabs || [];
    data.calcServices = bulk.calcServices || [];
    data.calcPackages = bulk.calcPackages || [];
    data.telegram = bulk.telegram || [];
    data.scripts = bulk.scripts || [];
    data.stats = bulk.stats || {};
    data.referrals = bulk.referrals || [];
    data.sectionOrder = bulk.sectionOrder || [];
    data.leads = bulk.leads || { leads: [], total: 0 };
    data.telegramBot = bulk.telegramBot || [];
    data.pdfTemplate = bulk.pdfTemplate || {};
    data.slotCounters = bulk.slotCounters || [];
    data.settings = bulk.settings || {};
    data.footer = bulk.footer || {};
    data.photoBlocks = bulk.photoBlocks || [];
    data.users = ensureArray(bulk.users);
    data.siteBlocks = (bulk.siteBlocks || []).map(function(b) {
      // Ensure texts_ru/texts_am are always arrays (defensive parse)
      if (typeof b.texts_ru === 'string') { try { b.texts_ru = JSON.parse(b.texts_ru); } catch(e) { b.texts_ru = []; } }
      if (typeof b.texts_am === 'string') { try { b.texts_am = JSON.parse(b.texts_am); } catch(e) { b.texts_am = []; } }
      if (typeof b.images === 'string') { try { b.images = JSON.parse(b.images); } catch(e) { b.images = []; } }
      if (typeof b.buttons === 'string') { try { b.buttons = JSON.parse(b.buttons); } catch(e) { b.buttons = []; } }
      if (!Array.isArray(b.texts_ru)) b.texts_ru = [];
      if (!Array.isArray(b.texts_am)) b.texts_am = [];
      if (!Array.isArray(b.images)) b.images = [];
      if (!Array.isArray(b.buttons)) b.buttons = [];
      return b;
    });
    data.companyRoles = bulk.companyRoles || [];
    data.expenseCategories = bulk.expenseCategories || [];
    data.expenseFreqTypes = bulk.expenseFreqTypes || [];
    data.expenses = bulk.expenses || [];
    data.periodSnapshots = bulk.periodSnapshots || [];
    data.vacations = bulk.vacations || [];
    data.paymentMethods = bulk.paymentMethods || [];
    data.onlineUsers = bulk.online || [];
    if (bulk.leadArticles) { for (var k in bulk.leadArticles) { data.leadArticles[k] = bulk.leadArticles[k]; } }
    data.taxPayments = bulk.taxPayments || [];
    data.assets = bulk.assets || [];
    data.loans = bulk.loans || [];
    data.loanPayments = bulk.loanPayments || [];
    data.dividends = bulk.dividends || [];
    data.otherIncomeExpenses = bulk.otherIncomeExpenses || [];
    if (bulk.loanSettings) data.loanSettings = bulk.loanSettings;
  } else {
    // Fallback: load data the old way if bulk fails
    setProgress('Fallback загрузка...');
    var [usersData, companyRolesData, stats, settings, sectionOrder] = await Promise.all([
      api('/users'), api('/company-roles'), api('/stats'), api('/settings'), api('/section-order')
    ]);
    data.users = ensureArray(usersData);
    data.companyRoles = (companyRolesData && companyRolesData.roles) || [];
    data.stats = stats || {};
    data.settings = settings || {};
    data.sectionOrder = sectionOrder || [];
    var [content, tabs, services, telegram, scripts, referrals, leads, telegramBot, pdfTemplate, slotCounterRes, footerData, photoBlocksData, siteBlocksData, expenseCategoriesData, expenseFreqTypesData, expensesData, calcPackagesData] = await Promise.all([
      api('/content'), api('/calc-tabs'), api('/calc-services'), api('/telegram'), api('/scripts'), api('/referrals'),
      api('/leads?limit=200'), api('/telegram-bot'), api('/pdf-template'), api('/slot-counter'), api('/footer'), api('/photo-blocks'),
      api('/site-blocks'), api('/expense-categories'), api('/expense-frequency-types'), api('/expenses'), api('/calc-packages')
    ]);
    data.content = content || [];
    data.calcTabs = tabs || [];
    data.calcServices = services || [];
    data.calcPackages = calcPackagesData || [];
    data.telegram = telegram || [];
    data.scripts = scripts || [];
    data.referrals = referrals || [];
    data.leads = leads || { leads: [], total: 0 };
    data.telegramBot = telegramBot || [];
    data.pdfTemplate = pdfTemplate || {};
    data.slotCounters = (slotCounterRes && slotCounterRes.counters) || [];
    data.footer = footerData || {};
    data.photoBlocks = (photoBlocksData && photoBlocksData.blocks) || [];
    data.siteBlocks = (siteBlocksData && siteBlocksData.blocks) || [];
    data.expenseCategories = (expenseCategoriesData && expenseCategoriesData.categories) || [];
    data.expenseFreqTypes = (expenseFreqTypesData && expenseFreqTypesData.types) || [];
    data.expenses = (expensesData && expensesData.expenses) || [];
    try { var snapshotsData = await api('/period-snapshots'); data.periodSnapshots = (snapshotsData && snapshotsData.snapshots) || []; } catch(e) { data.periodSnapshots = []; }
    try { var vacData = await api('/vacations'); data.vacations = (vacData && vacData.vacations) || []; } catch(e) { data.vacations = []; }
    try { var pmData = await api('/payment-methods'); data.paymentMethods = (pmData && pmData.methods) || []; } catch(e) { data.paymentMethods = []; }
    try { var onlineData = await api('/activity/online'); data.onlineUsers = (onlineData && onlineData.online) || []; } catch(e) { data.onlineUsers = []; }
    var leadsWithArticles = ((data.leads && data.leads.leads) || []).filter(function(l) { return l.articles_count > 0; });
    if (leadsWithArticles.length > 0) {
      var artPromises = leadsWithArticles.map(function(l) { return api('/leads/' + l.id + '/articles').then(function(res) { data.leadArticles[l.id] = (res && res.articles) ? res.articles : []; }); });
      await Promise.all(artPromises);
    }
    // P&L data fallback
    try {
      var [tpF,asF,loF,dvF,oiF] = await Promise.all([api('/tax-payments'),api('/assets'),api('/loans'),api('/dividends'),api('/other-income-expenses')]);
      data.taxPayments = (tpF && tpF.payments) || [];
      data.assets = (asF && asF.assets) || [];
      if (loF) { data.loans = loF.loans || []; data.loanPayments = loF.payments || []; }
      data.dividends = (dvF && dvF.dividends) || [];
      data.otherIncomeExpenses = (oiF && oiF.items) || [];
    } catch(e) { console.error('P&L fallback load error:', e); }
  }
  setProgress('');
}

// ===== NAVIGATION =====
const pages = [
  { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Дашборд' },
  { id: 'leads', icon: 'fa-users', label: 'Лиды / CRM' },
  { id: 'analytics', icon: 'fa-chart-line', label: 'Бизнес-аналитика' },
  { id: 'employees', icon: 'fa-user-friends', label: 'Сотрудники' },
  { id: 'team_access', icon: 'fa-shield-alt', label: 'Роли и доступы' },
  { id: 'blocks', icon: 'fa-cubes', label: 'Управление сайтом' },
  { id: 'calculator', icon: 'fa-calculator', label: 'Калькулятор' },
  { id: 'tgbot', icon: 'fa-robot', label: 'TG Бот / Уведомления' },
  { id: 'scripts', icon: 'fa-code', label: 'Скрипты' },
  { id: 'settings', icon: 'fa-cog', label: 'Настройки' },
];

function renderSidebar() {
  const isAdmin = currentUser && currentUser.role === 'main_admin';
  const userPerms = currentUser?.permissions || [];
  let h = '<div class="sidebar flex flex-col"><div style="padding:20px;border-bottom:1px solid #334155">' +
    '<div style="font-size:1.3rem;font-weight:800;color:#a78bfa">Go to Top</div>' +
    '<div style="font-size:0.8rem;color:#64748b;margin-top:4px">Админ-панель</div>';
  if (currentUser) {
    const rl = rolesConfig?.role_labels || {};
    h += '<div style="margin-top:10px;padding:8px 12px;background:#0f172a;border-radius:8px;font-size:0.78rem">' +
      '<div style="color:#e2e8f0;font-weight:600">' + escHtml(currentUser.display_name) + '</div>' +
      '<div style="color:#8B5CF6;font-size:0.72rem">' + escHtml(rl[currentUser.role] || currentUser.role) + '</div></div>';
  }
  h += '</div><div style="padding:8px 0;flex:1">';
  for (const p of pages) {
    // Check permissions: main_admin sees all, others see only allowed sections
    if (!isAdmin && !userPerms.includes(p.id) && p.id !== 'dashboard') continue;
    h += '<div class="nav-item' + (currentPage === p.id ? ' active' : '') + '" data-page="' + p.id + '" onclick="navigate(&apos;' + p.id + '&apos;)">' +
      '<i class="' + (p.fab ? 'fab' : 'fas') + ' ' + p.icon + '"></i><span>' + p.label + '</span></div>';
  }
  h += '</div><div style="padding:16px;border-top:1px solid #334155">' +
    '<div class="nav-item" onclick="doLogout()"><i class="fas fa-sign-out-alt"></i><span>Выйти</span></div>' +
    '<a href="/" target="_blank" class="nav-item" style="color:#10B981"><i class="fas fa-external-link-alt"></i><span>Открыть сайт</span></a>' +
    '<div class="nav-item" style="color:#f59e0b;cursor:pointer" onclick="previewSite()"><i class="fas fa-sync-alt"></i><span>Обновить сайт</span></div>' +
  '</div></div>';
  return h;
}

function navigate(page) {
  currentPage = page;
  loanModeDetailsOpen = false; // reset repayment mode collapse on page change
  // Fast navigate: only update main area + sidebar active states
  var mainEl = document.getElementById('mainArea');
  if (mainEl) {
    mainEl.innerHTML = '<div style="padding:40px;text-align:center"><div class="spinner" style="width:24px;height:24px;margin:0 auto"></div></div>';
    // Update sidebar active state instantly
    document.querySelectorAll('.nav-item').forEach(function(el) {
      var pg = el.getAttribute('data-page');
      if (pg === page) el.classList.add('active');
      else el.classList.remove('active');
    });
    // Render page content asynchronously
    setTimeout(function() {
      mainEl.innerHTML = getPageHtml();
      // Post-render: init SortableJS for calculator service lists
      setTimeout(function() { initCalcSortables(); }, 50);
      // Post-render: init SortableJS for site blocks
      setTimeout(function() { if (typeof sbInitSortable === 'function') sbInitSortable(); }, 50);
    }, 10);
  } else {
    render();
  }
}
function doLogout() { token = ''; currentUser = null; rolesConfig = null; localStorage.removeItem('gtt_token'); localStorage.removeItem('gtt_user'); localStorage.removeItem('gtt_roles'); render(); }
function previewSite() {
  toast('Изменения применены! Сайт обновляется автоматически при каждой загрузке страницы.', 'success');
  window.open('/?_nocache=' + Date.now(), '_blank');
}


`;
