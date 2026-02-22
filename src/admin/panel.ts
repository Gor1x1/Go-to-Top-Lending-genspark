/**
 * Admin panel HTML — full SPA for managing site content
 */
export function getAdminHTML(): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%238B5CF6'/><text x='16' y='22' font-size='18' font-weight='bold' fill='white' text-anchor='middle'>G</text></svg>">
<title>Go to Top — Админ-панель</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css">
<style>
  body { font-family: 'Inter', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
  .sidebar { width: 260px; min-height: 100vh; background: #1e293b; border-right: 1px solid #334155; }
  .main { flex: 1; min-height: 100vh; }
  .nav-item { padding: 12px 20px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s; border-left: 3px solid transparent; }
  .nav-item:hover { background: #334155; }
  .nav-item.active { background: rgba(139,92,246,0.15); border-left-color: #8B5CF6; color: #a78bfa; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; }
  .btn { padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; font-size: 0.9rem; }
  .btn-primary { background: #8B5CF6; color: white; }
  .btn-primary:hover { background: #7C3AED; }
  .btn-success { background: #10B981; color: white; }
  .btn-success:hover { background: #059669; }
  .btn-danger { background: #EF4444; color: white; }
  .btn-danger:hover { background: #DC2626; }
  .btn-outline { background: transparent; border: 1px solid #475569; color: #94a3b8; }
  .btn-outline:hover { border-color: #8B5CF6; color: #a78bfa; }
  .input { width: 100%; padding: 10px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 0.9rem; }
  .input:focus { outline: none; border-color: #8B5CF6; box-shadow: 0 0 0 3px rgba(139,92,246,0.2); }
  textarea.input { min-height: 80px; resize: vertical; }
  .badge { padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
  .badge-purple { background: rgba(139,92,246,0.2); color: #a78bfa; }
  .badge-green { background: rgba(16,185,129,0.2); color: #34d399; }
  .badge-amber { background: rgba(245,158,11,0.2); color: #fbbf24; }
  .toast { position: fixed; bottom: 24px; right: 24px; padding: 14px 24px; border-radius: 10px; font-weight: 600; z-index: 9999; animation: slideUp 0.3s ease; }
  @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .login-bg { background: linear-gradient(135deg, #1e1b4b, #312e81, #1e293b); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .section-edit-row { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .tab-btn { padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: all 0.2s; background: #1e293b; border: 1px solid #334155; color: #94a3b8; }
  .tab-btn.active { background: #8B5CF6; color: white; border-color: #8B5CF6; }
  .tab-btn:hover:not(.active) { border-color: #8B5CF6; color: #a78bfa; }
  .stat-card { background: linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.05)); border: 1px solid rgba(139,92,246,0.2); border-radius: 12px; padding: 20px; text-align: center; }
  .stat-num { font-size: 2rem; font-weight: 800; color: #8B5CF6; }
  .spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .tier-del-btn { width:24px;height:24px;min-width:24px;border-radius:50%;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171;font-size:0.65rem;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all 0.2s;padding:0; }
  .tier-del-btn:hover { background:#EF4444;color:white; }
</style>
</head>
<body>
<div id="app"></div>
<script>
// ===== STATE =====
let token = localStorage.getItem('gtt_token') || '';
let currentPage = 'dashboard';
let currentUser = JSON.parse(localStorage.getItem('gtt_user') || 'null');
let rolesConfig = JSON.parse(localStorage.getItem('gtt_roles') || 'null');
let data = { content: [], calcTabs: [], calcServices: [], telegram: [], scripts: [], stats: {}, referrals: [], sectionOrder: [], leads: { leads: [], total: 0 }, telegramBot: [], pdfTemplate: {}, slotCounters: [], settings: {}, footer: {}, photoBlocks: [], users: [], siteBlocks: [], leadsAnalytics: null, leadComments: {}, leadArticles: {}, companyRoles: [], expenseCategories: [], expenseFreqTypes: [], expenses: [], periodSnapshots: [] };

// ===== API HELPERS =====
const API = '/api/admin';
async function api(path, methodOrOpts, bodyData) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  var opts = {};
  if (typeof methodOrOpts === 'string') {
    opts = { method: methodOrOpts };
    if (bodyData !== undefined) opts.body = JSON.stringify(bodyData);
  } else if (methodOrOpts) {
    opts = methodOrOpts;
  }
  const res = await fetch(API + path, { ...opts, headers });
  if (res.status === 401) { token = ''; localStorage.removeItem('gtt_token'); render(); return null; }
  return res.json();
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-amber-600');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
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
      toast('Добро пожаловать, ' + (res.user.display_name || res.user.username));
      try { await loadData(); } catch(err) { console.error('loadData error:', err); }
      render();
    } else {
      toast(res.error || 'Ошибка входа', 'error');
    }
  } catch(err) {
    console.error('Login error:', err);
    toast('Ошибка сети', 'error');
  }
}

// ===== DATA LOADING =====
async function loadData() {
  const [content, tabs, services, telegram, scripts, stats, referrals, sectionOrder, leads, telegramBot, pdfTemplate, slotCounterRes, settings, footerData, photoBlocksData, usersData, siteBlocksData, companyRolesData, expenseCategoriesData, expenseFreqTypesData, expensesData] = await Promise.all([
    api('/content'), api('/calc-tabs'), api('/calc-services'), api('/telegram'), api('/scripts'), api('/stats'), api('/referrals'), api('/section-order'),
    api('/leads?limit=200'), api('/telegram-bot'), api('/pdf-template'), api('/slot-counter'), api('/settings'), api('/footer'), api('/photo-blocks'),
    api('/users'), api('/site-blocks'), api('/company-roles'), api('/expense-categories'), api('/expense-frequency-types'), api('/expenses')
  ]);
  data.content = content || [];
  data.calcTabs = tabs || [];
  data.calcServices = services || [];
  data.telegram = telegram || [];
  data.scripts = scripts || [];
  data.stats = stats || {};
  data.referrals = referrals || [];
  data.sectionOrder = sectionOrder || [];
  data.leads = leads || { leads: [], total: 0 };
  data.telegramBot = telegramBot || [];
  data.pdfTemplate = pdfTemplate || {};
  data.slotCounters = (slotCounterRes && slotCounterRes.counters) || [];
  data.settings = settings || {};
  data.footer = footerData || {};
  data.photoBlocks = (photoBlocksData && photoBlocksData.blocks) || [];
  data.users = usersData || [];
  data.siteBlocks = (siteBlocksData && siteBlocksData.blocks) || [];
  data.companyRoles = (companyRolesData && companyRolesData.roles) || [];
  data.expenseCategories = (expenseCategoriesData && expenseCategoriesData.categories) || [];
  data.expenseFreqTypes = (expenseFreqTypesData && expenseFreqTypesData.types) || [];
  data.expenses = (expensesData && expensesData.expenses) || [];
  // Load period snapshots
  try { var snapshotsData = await api('/period-snapshots'); data.periodSnapshots = (snapshotsData && snapshotsData.snapshots) || []; } catch(e) { data.periodSnapshots = []; }
  // Preload articles for leads that have them
  var leadsWithArticles = ((data.leads && data.leads.leads) || []).filter(function(l) { return l.articles_count > 0; });
  if (leadsWithArticles.length > 0) {
    var artPromises = leadsWithArticles.map(function(l) { return api('/leads/' + l.id + '/articles').then(function(res) { data.leadArticles[l.id] = (res && res.articles) ? res.articles : []; }); });
    await Promise.all(artPromises);
  }
}

// ===== NAVIGATION =====
const pages = [
  { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Дашборд' },
  { id: 'leads', icon: 'fa-users', label: 'Лиды / CRM' },
  { id: 'analytics', icon: 'fa-chart-line', label: 'Бизнес-аналитика' },
  { id: 'employees', icon: 'fa-user-friends', label: 'Сотрудники' },
  { id: 'permissions', icon: 'fa-shield-alt', label: 'Доступы' },
  { id: 'company_roles', icon: 'fa-user-tag', label: 'Роли компании' },
  { id: 'blocks', icon: 'fa-cubes', label: 'Конструктор блоков' },
  { id: 'calculator', icon: 'fa-calculator', label: 'Калькулятор' },
  { id: 'pdf', icon: 'fa-file-pdf', label: 'PDF шаблон' },
  { id: 'referrals', icon: 'fa-gift', label: 'Реферальные коды' },
  { id: 'slots', icon: 'fa-clock', label: 'Счётчики слотов' },
  { id: 'footer', icon: 'fa-shoe-prints', label: 'Футер сайта' },
  { id: 'telegram', icon: 'fa-telegram', label: 'TG сообщения', fab: true },
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
    h += '<div class="nav-item' + (currentPage === p.id ? ' active' : '') + '" onclick="navigate(\\'' + p.id + '\\')">' +
      '<i class="' + (p.fab ? 'fab' : 'fas') + ' ' + p.icon + '"></i><span>' + p.label + '</span></div>';
  }
  h += '</div><div style="padding:16px;border-top:1px solid #334155">' +
    '<div class="nav-item" onclick="doLogout()"><i class="fas fa-sign-out-alt"></i><span>Выйти</span></div>' +
    '<a href="/" target="_blank" class="nav-item" style="color:#10B981"><i class="fas fa-external-link-alt"></i><span>Открыть сайт</span></a>' +
    '<div class="nav-item" style="color:#f59e0b;cursor:pointer" onclick="previewSite()"><i class="fas fa-sync-alt"></i><span>Обновить сайт</span></div>' +
  '</div></div>';
  return h;
}

function navigate(page) { currentPage = page; render(); }
function doLogout() { token = ''; currentUser = null; rolesConfig = null; localStorage.removeItem('gtt_token'); localStorage.removeItem('gtt_user'); localStorage.removeItem('gtt_roles'); render(); }
function previewSite() {
  toast('Изменения применены! Сайт обновляется автоматически при каждой загрузке страницы.', 'success');
  window.open('/?_nocache=' + Date.now(), '_blank');
}

// ===== DASHBOARD =====
function renderDashboard() {
  const s = data.stats;
  const a = s.analytics || {};
  const daily = a.daily || [];
  const refs = a.referrers || [];
  const langs = a.languages || [];
  const ld = s.leads || {};
  
  return '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Дашборд</h1>' +
    '<p style="color:#94a3b8;margin-bottom:32px">Обзор управления сайтом Go to Top</p>' +
    
    // Leads alert
    (ld.new > 0 ? '<div style="background:linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.05));border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px 24px;margin-bottom:24px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="navigate(&apos;leads&apos;)"><i class="fas fa-bell" style="color:#EF4444;font-size:1.2rem"></i><div><strong style="color:#f87171">' + ld.new + ' новых заявок!</strong><span style="color:#94a3b8;font-size:0.85rem;margin-left:8px">Нажмите для просмотра</span></div></div>' : '') +

    // Content stats
    '<h3 style="font-weight:700;margin-bottom:12px;color:#a78bfa"><i class="fas fa-database" style="margin-right:8px"></i>Контент</h3>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:32px">' +
      '<div class="stat-card"><div class="stat-num">' + (s.content_sections || 0) + '</div><div style="color:#94a3b8;font-size:0.85rem;margin-top:4px">Секций контента</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + (s.calculator_services || 0) + '</div><div style="color:#94a3b8;font-size:0.85rem;margin-top:4px">Услуг в калькуляторе</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + (s.telegram_buttons || 0) + '</div><div style="color:#94a3b8;font-size:0.85rem;margin-top:4px">Telegram кнопок</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + (s.custom_scripts || 0) + '</div><div style="color:#94a3b8;font-size:0.85rem;margin-top:4px">Скриптов</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + (s.referral_codes || 0) + '</div><div style="color:#94a3b8;font-size:0.85rem;margin-top:4px">Реф. кодов</div></div>' +
    '</div>' +
    
    // Analytics
    '<h3 style="font-weight:700;margin-bottom:12px;color:#a78bfa"><i class="fas fa-chart-line" style="margin-right:8px"></i>Аналитика посещений</h3>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">' +
      '<div class="stat-card" style="background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.05));border-color:rgba(16,185,129,0.3)"><div class="stat-num" style="color:#10B981">' + (a.today || 0) + '</div><div style="color:#94a3b8;font-size:0.85rem;margin-top:4px">Сегодня</div></div>' +
      '<div class="stat-card" style="background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(59,130,246,0.05));border-color:rgba(59,130,246,0.3)"><div class="stat-num" style="color:#3B82F6">' + (a.week || 0) + '</div><div style="color:#94a3b8;font-size:0.85rem;margin-top:4px">За 7 дней</div></div>' +
      '<div class="stat-card" style="background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05));border-color:rgba(245,158,11,0.3)"><div class="stat-num" style="color:#F59E0B">' + (a.month || 0) + '</div><div style="color:#94a3b8;font-size:0.85rem;margin-top:4px">За 30 дней</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + (a.total || 0) + '</div><div style="color:#94a3b8;font-size:0.85rem;margin-top:4px">Всего</div></div>' +
    '</div>' +
    
    // Daily chart (simple bar)
    (daily.length > 0 ? '<div class="card" style="margin-bottom:24px"><h4 style="font-weight:600;margin-bottom:12px">Посещения по дням</h4>' +
      '<div style="display:flex;gap:8px;align-items:flex-end;height:120px">' +
      daily.slice(0,7).reverse().map(function(d) {
        var maxV = Math.max.apply(null, daily.map(function(x){return x.count || 1}));
        var h = Math.max(10, Math.round((d.count / maxV) * 100));
        return '<div style="flex:1;text-align:center"><div style="background:linear-gradient(to top,#8B5CF6,#a78bfa);height:'+h+'px;border-radius:6px 6px 0 0;margin-bottom:4px"></div><div style="font-size:0.7rem;color:#94a3b8">' + (d.day || '').slice(5) + '</div><div style="font-size:0.75rem;font-weight:600;color:#e2e8f0">' + d.count + '</div></div>';
      }).join('') +
      '</div></div>' : '') +
    
    // Top referrers
    (refs.length > 0 ? '<div class="card" style="margin-bottom:24px"><h4 style="font-weight:600;margin-bottom:12px">Источники трафика (30 дней)</h4>' +
      refs.map(function(r) {
        return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #334155;font-size:0.85rem"><span style="color:#94a3b8;overflow:hidden;text-overflow:ellipsis;max-width:80%">' + escHtml(r.referrer) + '</span><span style="font-weight:600">' + r.count + '</span></div>';
      }).join('') +
    '</div>' : '') +
    
    // Language stats
    (langs.length > 0 ? '<div class="card" style="margin-bottom:24px"><h4 style="font-weight:600;margin-bottom:12px">Языки пользователей</h4>' +
      langs.map(function(l) {
        return '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:0.85rem"><span style="color:#94a3b8">' + (l.lang === 'am' ? '🇦🇲 Армянский' : l.lang === 'ru' ? '🇷🇺 Русский' : l.lang || 'Н/Д') + '</span><span style="font-weight:600">' + l.count + '</span></div>';
      }).join('') +
    '</div>' : '') +
    
    // How to use
    '<div class="card"><h3 style="font-weight:700;margin-bottom:12px"><i class="fas fa-info-circle" style="color:#8B5CF6;margin-right:8px"></i>Как пользоваться</h3>' +
      '<ul style="color:#94a3b8;font-size:0.9rem;line-height:2">' +
        '<li>📋 <strong>Лиды / CRM</strong> — все заявки с сайта, статусы, экспорт в CSV</li>' +
        '<li>🧊 <strong>Конструктор блоков</strong> — порядок, тексты, фото, видимость — всё в одном месте. Создавайте, копируйте и удаляйте блоки</li>' +
        '<li>🧮 <strong>Калькулятор</strong> — управление услугами, ценами и вкладками</li>' +
        '<li>📄 <strong>PDF шаблон</strong> — тексты для автоматического коммерческого предложения</li>' +
        '<li>🎁 <strong>Реферальные коды</strong> — кодовые слова для скидок и бесплатных отзывов</li>' +
        '<li>⏱ <strong>Счётчики слотов</strong> — неограниченное количество, привязка к любому блоку</li>' +
        '<li>👟 <strong>Футер сайта</strong> — контакты, соцсети, копирайт</li>' +
        '<li>💬 <strong>TG сообщения</strong> — шаблоны сообщений для каждой кнопки на сайте</li>' +
        '<li>🤖 <strong>TG Бот</strong> — автоматические уведомления о заявках в Telegram</li>' +
        '<li>📜 <strong>Скрипты</strong> — добавление аналитики, пикселей, meta-тегов</li>' +
        '<li>⚙️ <strong>Настройки</strong> — смена пароля</li>' +
      '</ul>' +
    '</div>' +
  '</div>';
}

// ===== UNIFIED BLOCK CONSTRUCTOR =====
// Merges: Content editor + Section order + Photo blocks into one visual editor
function getBlockContent(sectionId) {
  return data.content.find(function(c) { return c.section_key === sectionId; });
}
function getBlockPhotos(sectionId) {
  return (data.photoBlocks || []).filter(function(p) { return p.position === sectionId || p.position === 'in-' + sectionId; });
}
function getBlockCounters(sectionId) {
  return (data.slotCounters || []).filter(function(c) { return c.position === sectionId || c.position === 'after-' + sectionId || c.position === 'before-' + sectionId || c.position === 'in-' + sectionId; });
}
// Which sections typically have photos
var photoSections = ['hero', 'about', 'services', 'warehouse', 'wb-banner', 'wb-official'];

function renderBlocks() {
  var sections = data.sectionOrder || [];
  var h = '<div style="padding:32px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">' +
    '<div><h1 style="font-size:1.8rem;font-weight:800"><i class="fas fa-cubes" style="color:#8B5CF6;margin-right:10px"></i>Конструктор блоков</h1>' +
    '<p style="color:#94a3b8;margin-top:4px">Порядок, тексты, фото и видимость — всё в одном месте</p></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-primary" onclick="showCreateBlockModal()"><i class="fas fa-plus" style="margin-right:6px"></i>Новый блок</button>' +
      '<button class="btn btn-outline" onclick="seedSections()"><i class="fas fa-download" style="margin-right:6px"></i>Загрузить стандартные</button>' +
      '<button class="btn btn-outline" onclick="seedContent()"><i class="fas fa-file-import" style="margin-right:6px"></i>Импорт текстов с сайта</button>' +
      '<button class="btn btn-success" onclick="saveAllBlocks()"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить порядок</button>' +
    '</div>' +
  '</div>';

  if (!sections.length && !data.content.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-inbox" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8;margin-bottom:16px">Блоки ещё не настроены. Нажмите «Загрузить стандартные» или «Импорт текстов с сайта» для начала.</p></div>';
    h += '</div>';
    return h;
  }

  // If sections are empty but content exists, build sections from content
  if (!sections.length && data.content.length) {
    sections = data.content.map(function(c, i) {
      return { section_id: c.section_key, sort_order: i, is_visible: 1, label_ru: c.section_name, label_am: '' };
    });
    data.sectionOrder = sections;
  }

  // Render each block
  for (var i = 0; i < sections.length; i++) {
    var sec = sections[i];
    var content = getBlockContent(sec.section_id);
    var photos = getBlockPhotos(sec.section_id);
    var counters = getBlockCounters(sec.section_id);
    var items = [];
    if (content) { try { items = JSON.parse(content.content_json); } catch { items = []; } }
    var hasPhotos = photos.length > 0 || photoSections.indexOf(sec.section_id) >= 0;
    var isExpanded = sec._expanded || false;

    h += '<div class="card" style="margin-bottom:10px;padding:0;overflow:hidden;border:1px solid ' + (sec.is_visible ? '#334155' : 'rgba(239,68,68,0.3)') + ';' + (!sec.is_visible ? 'opacity:0.55;' : '') + '" data-block-idx="' + i + '">';

    // ===== BLOCK HEADER =====
    h += '<div style="display:flex;align-items:center;gap:12px;padding:14px 20px;background:' + (sec.is_visible ? '#1e293b' : 'rgba(239,68,68,0.05)') + ';cursor:pointer" onclick="toggleBlockExpand(' + i + ')">';

    // Move arrows
    h += '<div style="display:flex;flex-direction:column;gap:2px" onclick="event.stopPropagation()">' +
      '<button class="btn btn-outline" style="padding:2px 6px;font-size:0.65rem;line-height:1" onclick="moveSection(' + i + ',-1)" ' + (i === 0 ? 'disabled style="padding:2px 6px;font-size:0.65rem;line-height:1;opacity:0.3"' : '') + '><i class="fas fa-chevron-up"></i></button>' +
      '<button class="btn btn-outline" style="padding:2px 6px;font-size:0.65rem;line-height:1" onclick="moveSection(' + i + ',1)" ' + (i === sections.length-1 ? 'disabled style="padding:2px 6px;font-size:0.65rem;line-height:1;opacity:0.3"' : '') + '><i class="fas fa-chevron-down"></i></button>' +
    '</div>';

    // Block number
    h += '<span style="color:#475569;font-size:0.8rem;font-weight:700;min-width:28px">#' + (i+1) + '</span>';

    // Badges
    h += '<div style="flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
    h += '<span style="font-weight:700;font-size:0.95rem;color:' + (sec.is_visible ? '#e2e8f0' : '#f87171') + '">' + escHtml(sec.label_ru || sec.section_id) + '</span>';
    h += '<span class="badge badge-purple" style="font-size:0.7rem">' + sec.section_id + '</span>';
    if (items.length > 0) h += '<span class="badge badge-green" style="font-size:0.7rem">' + items.length + ' текст' + (items.length > 1 ? 'ов' : '') + '</span>';
    if (hasPhotos) h += '<span class="badge badge-amber" style="font-size:0.7rem"><i class="fas fa-image" style="margin-right:3px"></i>' + (photos.length > 0 ? photos.length + ' фото' : 'фото') + '</span>';
    if (counters.length > 0) h += '<span class="badge" style="font-size:0.7rem;background:rgba(59,130,246,0.2);color:#60a5fa"><i class="fas fa-clock" style="margin-right:3px"></i>' + counters.length + '</span>';
    h += '</div>';

    // Visibility toggle + actions
    h += '<div style="display:flex;align-items:center;gap:6px" onclick="event.stopPropagation()">';
    h += '<button class="btn ' + (sec.is_visible ? 'btn-success' : 'btn-danger') + '" style="padding:5px 10px;font-size:0.75rem" onclick="toggleSectionVis(' + i + ')" title="' + (sec.is_visible ? 'Скрыть' : 'Показать') + '">' +
      '<i class="fas ' + (sec.is_visible ? 'fa-eye' : 'fa-eye-slash') + '"></i></button>';
    h += '<button class="btn btn-outline" style="padding:5px 10px;font-size:0.75rem" onclick="duplicateBlock(' + i + ')" title="Копировать блок"><i class="fas fa-copy"></i></button>';
    h += '<button class="btn btn-danger" style="padding:5px 10px;font-size:0.75rem" onclick="deleteBlock(' + i + ')" title="Удалить блок"><i class="fas fa-trash"></i></button>';
    h += '</div>';

    // Expand/collapse arrow
    h += '<i class="fas fa-chevron-' + (isExpanded ? 'up' : 'down') + '" style="color:#64748b;font-size:0.8rem;transition:transform 0.2s"></i>';
    h += '</div>';

    // ===== BLOCK BODY (expanded) =====
    h += '<div style="display:' + (isExpanded ? 'block' : 'none') + ';padding:16px 20px;border-top:1px solid #334155;background:#0f172a">';

    // Block meta editing
    h += '<div style="display:grid;grid-template-columns:120px 1fr 1fr;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #1e293b">' +
      '<div><label style="font-size:0.7rem;color:#64748b">ID блока</label><input class="input" value="' + escHtml(sec.section_id) + '" style="padding:6px 10px;font-size:0.82rem;color:#64748b" disabled></div>' +
      '<div><label style="font-size:0.7rem;color:#8B5CF6">Название (RU)</label><input class="input" value="' + escHtml(sec.label_ru) + '" style="padding:6px 10px;font-size:0.85rem" data-block-label-ru="' + i + '"></div>' +
      '<div><label style="font-size:0.7rem;color:#F59E0B">Название (AM)</label><input class="input" value="' + escHtml(sec.label_am || '') + '" style="padding:6px 10px;font-size:0.85rem" data-block-label-am="' + i + '"></div>' +
    '</div>';

    // ===== TEXT ITEMS =====
    if (items.length > 0) {
      h += '<div style="margin-bottom:12px"><div style="font-size:0.8rem;font-weight:700;color:#a78bfa;margin-bottom:8px"><i class="fas fa-align-left" style="margin-right:6px"></i>Тексты блока (' + items.length + ')</div>';
      for (var ti = 0; ti < items.length; ti++) {
        var item = items[ti];
        h += '<div class="section-edit-row" style="margin-bottom:6px;padding:10px 12px">' +
          '<div style="display:grid;grid-template-columns:28px 1fr 1fr 28px;gap:8px;align-items:start">' +
            '<span style="color:#475569;font-size:0.75rem;padding-top:8px;text-align:center">' + (ti+1) + '</span>' +
            '<div><label style="font-size:0.65rem;color:#8B5CF6;font-weight:600">RU</label>' +
              '<textarea class="input" style="min-height:36px;margin-top:2px;font-size:0.85rem;padding:6px 10px" data-section="' + sec.section_id + '" data-idx="' + ti + '" data-lang="ru">' + escHtml(item.ru) + '</textarea></div>' +
            '<div><label style="font-size:0.65rem;color:#F59E0B;font-weight:600">AM</label>' +
              '<textarea class="input" style="min-height:36px;margin-top:2px;font-size:0.85rem;padding:6px 10px" data-section="' + sec.section_id + '" data-idx="' + ti + '" data-lang="am">' + escHtml(item.am) + '</textarea></div>' +
            '<button class="tier-del-btn" style="margin-top:16px" onclick="removeTextItem(&apos;' + sec.section_id + '&apos;,' + ti + ')" title="Удалить текст"><i class="fas fa-times"></i></button>' +
          '</div></div>';
      }
      h += '<div style="display:flex;gap:8px;margin-top:6px">' +
        '<button class="btn btn-outline" style="font-size:0.78rem;padding:6px 14px" onclick="addTextItem(&apos;' + sec.section_id + '&apos;)"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить текст</button>' +
        '<button class="btn btn-success" style="font-size:0.78rem;padding:6px 14px" onclick="saveBlockTexts(&apos;' + sec.section_id + '&apos;)"><i class="fas fa-save" style="margin-right:4px"></i>Сохранить тексты</button>' +
      '</div></div>';
    } else if (content) {
      h += '<div style="margin-bottom:12px;padding:12px;background:#1e293b;border-radius:8px;text-align:center"><span style="color:#64748b;font-size:0.85rem">Нет текстов в этом блоке</span> ' +
        '<button class="btn btn-outline" style="font-size:0.75rem;padding:4px 12px;margin-left:8px" onclick="addTextItem(&apos;' + sec.section_id + '&apos;)"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить текст</button></div>';
    } else {
      // No content record yet — offer to create
      h += '<div style="margin-bottom:12px;padding:12px;background:#1e293b;border-radius:8px;display:flex;justify-content:space-between;align-items:center">' +
        '<span style="color:#64748b;font-size:0.85rem"><i class="fas fa-info-circle" style="margin-right:6px;color:#8B5CF6"></i>Тексты не привязаны</span>' +
        '<button class="btn btn-primary" style="font-size:0.75rem;padding:4px 12px" onclick="createBlockContent(&apos;' + sec.section_id + '&apos;,&apos;' + escHtml(sec.label_ru) + '&apos;)"><i class="fas fa-plus" style="margin-right:4px"></i>Создать тексты</button></div>';
    }

    // ===== PHOTO BLOCKS attached to this section =====
    if (photos.length > 0) {
      h += '<div style="margin-bottom:12px"><div style="font-size:0.8rem;font-weight:700;color:#F59E0B;margin-bottom:8px"><i class="fas fa-images" style="margin-right:6px"></i>Фотографии (' + photos.length + ' блок' + (photos.length > 1 ? 'ов' : '') + ')</div>';
      for (var phi = 0; phi < photos.length; phi++) {
        var pb = photos[phi];
        var pbPhotos = [];
        try { pbPhotos = JSON.parse(pb.photos_json || '[]'); } catch { pbPhotos = []; }
        h += '<div style="padding:10px;background:#1e293b;border-radius:8px;margin-bottom:6px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<span style="font-size:0.82rem;font-weight:600;color:#e2e8f0">' + escHtml(pb.block_name) + ' <span style="color:#64748b;font-size:0.75rem">(' + pbPhotos.length + ' фото)</span></span>' +
          '<div style="display:flex;gap:4px"><button class="btn btn-outline" style="font-size:0.7rem;padding:3px 8px" onclick="navigate(&apos;photos_edit&apos;);_editPhotoBlockId=' + pb.id + '">Редактировать</button></div></div>';
        // Show thumbnails
        if (pbPhotos.length > 0) {
          h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
          for (var thi = 0; thi < Math.min(pbPhotos.length, 4); thi++) {
            h += '<div style="width:60px;height:60px;border-radius:6px;background:#0f172a;border:1px solid #334155;overflow:hidden"><img src="' + escHtml(pbPhotos[thi].url) + '" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display=&apos;none&apos;"></div>';
          }
          if (pbPhotos.length > 4) h += '<div style="width:60px;height:60px;border-radius:6px;background:#0f172a;border:1px solid #334155;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:0.8rem">+' + (pbPhotos.length - 4) + '</div>';
          h += '</div>';
        }
        h += '</div>';
      }
      h += '</div>';
    }

    // ===== SLOT COUNTERS attached to this section =====
    if (counters.length > 0) {
      h += '<div style="margin-bottom:8px"><div style="font-size:0.8rem;font-weight:700;color:#3B82F6;margin-bottom:6px"><i class="fas fa-clock" style="margin-right:6px"></i>Счётчики слотов</div>';
      for (var sci = 0; sci < counters.length; sci++) {
        var sc = counters[sci];
        var free = Math.max(0, (sc.total_slots || 10) - (sc.booked_slots || 0));
        h += '<div style="padding:8px 12px;background:#1e293b;border-radius:8px;margin-bottom:4px;display:flex;align-items:center;gap:12px">' +
          '<span style="color:#10B981;font-weight:800;font-size:1.1rem">' + free + '/' + sc.total_slots + '</span>' +
          '<span style="flex:1;color:#94a3b8;font-size:0.82rem">' + escHtml(sc.counter_name) + ' — ' + escHtml(sc.label_ru) + '</span>' +
          '<span style="font-size:0.7rem;color:#64748b">' + (sc.show_timer ? '👁 Видим' : '👁‍🗨 Скрыт') + '</span>' +
        '</div>';
      }
      h += '</div>';
    }

    h += '</div>'; // end body
    h += '</div>'; // end card
  }

  h += '</div>';
  return h;
}

// Toggle block expansion
function toggleBlockExpand(idx) {
  if (!data.sectionOrder[idx]) return;
  data.sectionOrder[idx]._expanded = !data.sectionOrder[idx]._expanded;
  render();
}

// Add text item to block
function addTextItem(sectionKey) {
  var content = data.content.find(function(c) { return c.section_key === sectionKey; });
  if (!content) return;
  var items = [];
  try { items = JSON.parse(content.content_json); } catch { items = []; }
  items.push({ ru: '', am: '' });
  content.content_json = JSON.stringify(items);
  // Keep block expanded
  var sec = data.sectionOrder.find(function(s) { return s.section_id === sectionKey; });
  if (sec) sec._expanded = true;
  render();
}

// Remove text item
function removeTextItem(sectionKey, idx) {
  var content = data.content.find(function(c) { return c.section_key === sectionKey; });
  if (!content) return;
  var items = [];
  try { items = JSON.parse(content.content_json); } catch { items = []; }
  items.splice(idx, 1);
  content.content_json = JSON.stringify(items);
  var sec = data.sectionOrder.find(function(s) { return s.section_id === sectionKey; });
  if (sec) sec._expanded = true;
  render();
}

// Save block texts (collect from DOM and save)
async function saveBlockTexts(sectionKey) {
  var content = data.content.find(function(c) { return c.section_key === sectionKey; });
  if (!content) return;
  var items = [];
  try { items = JSON.parse(content.content_json); } catch { items = []; }
  document.querySelectorAll('[data-section="' + sectionKey + '"]').forEach(function(el) {
    var idx = parseInt(el.dataset.idx);
    var lang = el.dataset.lang;
    if (items[idx]) items[idx][lang] = el.value;
  });
  // Also save block labels
  var sec = data.sectionOrder.find(function(s) { return s.section_id === sectionKey; });
  if (sec) {
    var secIdx = data.sectionOrder.indexOf(sec);
    var lruEl = document.querySelector('[data-block-label-ru="' + secIdx + '"]');
    var lamEl = document.querySelector('[data-block-label-am="' + secIdx + '"]');
    if (lruEl) sec.label_ru = lruEl.value;
    if (lamEl) sec.label_am = lamEl.value;
  }
  await api('/content/' + sectionKey, { method: 'PUT', body: JSON.stringify({ content_json: items, section_name: sec ? sec.label_ru : null }) });
  content.content_json = JSON.stringify(items);
  toast('Тексты блока "' + sectionKey + '" сохранены');
}

// Create block content record
async function createBlockContent(sectionKey, sectionName) {
  await api('/content', { method: 'POST', body: JSON.stringify({ section_key: sectionKey, section_name: sectionName, content_json: [{ ru: '', am: '' }] }) });
  toast('Текстовый блок создан');
  await loadData();
  var sec = data.sectionOrder.find(function(s) { return s.section_id === sectionKey; });
  if (sec) sec._expanded = true;
  render();
}

// Save all block order + visibility
async function saveAllBlocks() {
  // Collect labels from DOM
  for (var i = 0; i < data.sectionOrder.length; i++) {
    var lruEl = document.querySelector('[data-block-label-ru="' + i + '"]');
    var lamEl = document.querySelector('[data-block-label-am="' + i + '"]');
    if (lruEl) data.sectionOrder[i].label_ru = lruEl.value;
    if (lamEl) data.sectionOrder[i].label_am = lamEl.value;
  }
  var sections = data.sectionOrder.map(function(s, i) {
    return { section_id: s.section_id, sort_order: i, is_visible: s.is_visible, label_ru: s.label_ru, label_am: s.label_am };
  });
  await api('/section-order', { method: 'POST', body: JSON.stringify({ sections: sections }) });
  toast('Порядок блоков сохранён! Изменения отразятся на сайте.');
}

// ===== CREATE NEW BLOCK (from template or blank) =====
function showCreateBlockModal() {
  var existingModal = document.getElementById('createBlockModal');
  if (existingModal) { existingModal.remove(); return; }

  var templates = data.sectionOrder.map(function(s) {
    return '<option value="' + s.section_id + '">' + escHtml(s.label_ru || s.section_id) + '</option>';
  }).join('');

  var modalHtml = '<div id="createBlockModal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9998;display:flex;align-items:center;justify-content:center" onclick="if(event.target===this)this.remove()">' +
    '<div class="card" style="width:550px;max-width:90vw;max-height:90vh;overflow-y:auto;animation:slideUp 0.3s ease;border:2px solid #8B5CF6">' +
      '<h3 style="font-size:1.2rem;font-weight:800;margin-bottom:16px;color:#a78bfa"><i class="fas fa-plus-circle" style="margin-right:8px"></i>Создать новый блок</h3>' +

      '<div style="display:flex;gap:8px;margin-bottom:16px">' +
        '<button class="tab-btn active" id="newBlockTabBlank" onclick="switchNewBlockTab(&apos;blank&apos;)">Пустой блок</button>' +
        '<button class="tab-btn" id="newBlockTabCopy" onclick="switchNewBlockTab(&apos;copy&apos;)">Копировать существующий</button>' +
      '</div>' +

      '<div id="newBlockBlank">' +
        '<div style="display:grid;grid-template-columns:120px 1fr 1fr;gap:10px;margin-bottom:12px">' +
          '<div><label style="font-size:0.75rem;color:#64748b">ID (англ)</label><input class="input" id="nb_id" placeholder="my_block"></div>' +
          '<div><label style="font-size:0.75rem;color:#8B5CF6">Название (RU)</label><input class="input" id="nb_name_ru" placeholder="Мой блок"></div>' +
          '<div><label style="font-size:0.75rem;color:#F59E0B">Название (AM)</label><input class="input" id="nb_name_am" placeholder=""></div>' +
        '</div>' +
        '<div style="margin-bottom:12px"><label style="font-size:0.75rem;color:#64748b">Вставить после блока</label><select class="input" id="nb_after"><option value="_top">В начало</option>' + templates + '</select></div>' +
        '<div style="margin-bottom:16px;display:flex;gap:8px;align-items:center">' +
          '<input type="checkbox" id="nb_with_photo"><label style="font-size:0.85rem;color:#94a3b8">Добавить фото-блок</label>' +
        '</div>' +
        '<div id="nb_photo_upload" style="display:none;margin-bottom:12px;padding:12px;background:#0f172a;border-radius:8px;border:1px dashed #8B5CF6">' +
          '<label style="font-size:0.75rem;color:#a78bfa;font-weight:600;display:block;margin-bottom:8px"><i class="fas fa-image" style="margin-right:4px"></i>URL фотографии</label>' +
          '<input class="input" id="nb_photo_url" placeholder="https://example.com/photo.jpg">' +
          '<p style="font-size:0.7rem;color:#475569;margin-top:4px">Вставьте URL изображения. Загрузка с компьютера через base64 ниже.</p>' +
          '<div style="margin-top:8px"><label class="btn btn-outline" style="font-size:0.78rem;padding:6px 14px;cursor:pointer"><i class="fas fa-upload" style="margin-right:4px"></i>Загрузить с компьютера<input type="file" accept="image/*" id="nb_photo_file" style="display:none" onchange="handlePhotoUpload(this)"></label></div>' +
          '<div id="nb_photo_preview" style="margin-top:8px"></div>' +
        '</div>' +
      '</div>' +

      '<div id="newBlockCopy" style="display:none">' +
        '<div style="margin-bottom:12px"><label style="font-size:0.75rem;color:#64748b">Копировать блок</label><select class="input" id="nb_copy_from">' + templates + '</select></div>' +
        '<div style="display:grid;grid-template-columns:120px 1fr;gap:10px;margin-bottom:12px">' +
          '<div><label style="font-size:0.75rem;color:#64748b">Новый ID</label><input class="input" id="nb_copy_id" placeholder="copy_block"></div>' +
          '<div><label style="font-size:0.75rem;color:#8B5CF6">Новое название</label><input class="input" id="nb_copy_name" placeholder="Копия блока"></div>' +
        '</div>' +
        '<div style="margin-bottom:12px"><label style="font-size:0.75rem;color:#64748b">Вставить после блока</label><select class="input" id="nb_copy_after"><option value="_top">В начало</option>' + templates + '</select></div>' +
        '<div style="margin-bottom:16px;display:flex;gap:8px;align-items:center">' +
          '<input type="checkbox" id="nb_copy_with_photo"><label style="font-size:0.85rem;color:#94a3b8">Добавить фото при копировании</label>' +
        '</div>' +
        '<div id="nb_copy_photo_upload" style="display:none;margin-bottom:12px;padding:12px;background:#0f172a;border-radius:8px;border:1px dashed #8B5CF6">' +
          '<label style="font-size:0.75rem;color:#a78bfa;font-weight:600;display:block;margin-bottom:8px"><i class="fas fa-image" style="margin-right:4px"></i>URL фотографии для копии</label>' +
          '<input class="input" id="nb_copy_photo_url" placeholder="https://example.com/photo.jpg">' +
          '<div style="margin-top:8px"><label class="btn btn-outline" style="font-size:0.78rem;padding:6px 14px;cursor:pointer"><i class="fas fa-upload" style="margin-right:4px"></i>Загрузить с компьютера<input type="file" accept="image/*" id="nb_copy_photo_file" style="display:none" onchange="handlePhotoUploadCopy(this)"></label></div>' +
          '<div id="nb_copy_photo_preview" style="margin-top:8px"></div>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;gap:10px;margin-top:16px">' +
        '<button class="btn btn-primary" onclick="submitCreateBlock()"><i class="fas fa-check" style="margin-right:4px"></i>Создать</button>' +
        '<button class="btn btn-outline" onclick="document.getElementById(&apos;createBlockModal&apos;).remove()">Отмена</button>' +
      '</div>' +
    '</div></div>';

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Wire up checkbox toggles
  document.getElementById('nb_with_photo').onchange = function() {
    document.getElementById('nb_photo_upload').style.display = this.checked ? 'block' : 'none';
  };
  document.getElementById('nb_copy_with_photo').onchange = function() {
    document.getElementById('nb_copy_photo_upload').style.display = this.checked ? 'block' : 'none';
  };

  var idField = document.getElementById('nb_id');
  if (idField) idField.focus();
}

function switchNewBlockTab(tab) {
  document.getElementById('newBlockBlank').style.display = tab === 'blank' ? 'block' : 'none';
  document.getElementById('newBlockCopy').style.display = tab === 'copy' ? 'block' : 'none';
  document.getElementById('newBlockTabBlank').className = 'tab-btn' + (tab === 'blank' ? ' active' : '');
  document.getElementById('newBlockTabCopy').className = 'tab-btn' + (tab === 'copy' ? ' active' : '');
}

// Handle photo file upload → base64 preview (for blocks with photos)
function handlePhotoUpload(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('nb_photo_url').value = e.target.result;
    document.getElementById('nb_photo_preview').innerHTML = '<img src="' + e.target.result + '" style="max-width:120px;max-height:80px;border-radius:6px;margin-top:6px">';
  };
  reader.readAsDataURL(input.files[0]);
}
function handlePhotoUploadCopy(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('nb_copy_photo_url').value = e.target.result;
    document.getElementById('nb_copy_photo_preview').innerHTML = '<img src="' + e.target.result + '" style="max-width:120px;max-height:80px;border-radius:6px;margin-top:6px">';
  };
  reader.readAsDataURL(input.files[0]);
}

// Submit new block creation
async function submitCreateBlock() {
  var isBlank = document.getElementById('newBlockBlank').style.display !== 'none';

  if (isBlank) {
    var id = document.getElementById('nb_id').value.trim();
    var nameRu = document.getElementById('nb_name_ru').value.trim();
    var nameAm = document.getElementById('nb_name_am').value.trim();
    var afterBlock = document.getElementById('nb_after').value;
    var withPhoto = document.getElementById('nb_with_photo').checked;
    var photoUrl = document.getElementById('nb_photo_url').value.trim();

    if (!id) { toast('Укажите ID блока (англ)', 'error'); return; }
    if (!nameRu) nameRu = id;
    // Transliterate if needed
    id = id.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');

    // Create content record
    await api('/content', { method: 'POST', body: JSON.stringify({ section_key: id, section_name: nameRu, content_json: [{ ru: '', am: '' }] }) });

    // Insert into section order at position
    var insertIdx = 0;
    if (afterBlock !== '_top') {
      for (var i = 0; i < data.sectionOrder.length; i++) {
        if (data.sectionOrder[i].section_id === afterBlock) { insertIdx = i + 1; break; }
      }
    }
    data.sectionOrder.splice(insertIdx, 0, { section_id: id, sort_order: insertIdx, is_visible: 1, label_ru: nameRu, label_am: nameAm, _expanded: true });
    // Re-index
    for (var j = 0; j < data.sectionOrder.length; j++) data.sectionOrder[j].sort_order = j;
    await saveAllBlocks();

    // Photo block
    if (withPhoto && photoUrl) {
      await api('/photo-blocks', { method: 'POST', body: JSON.stringify({ block_name: nameRu + ' фото', position: id, is_visible: 1, photos_json: JSON.stringify([{ url: photoUrl, caption: '' }]) }) });
    }
  } else {
    // Copy mode
    var copyFrom = document.getElementById('nb_copy_from').value;
    var newId = document.getElementById('nb_copy_id').value.trim();
    var newName = document.getElementById('nb_copy_name').value.trim();
    var afterBlock2 = document.getElementById('nb_copy_after').value;
    var withPhoto2 = document.getElementById('nb_copy_with_photo').checked;
    var photoUrl2 = document.getElementById('nb_copy_photo_url').value.trim();

    if (!newId) { toast('Укажите новый ID', 'error'); return; }
    newId = newId.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
    if (!newName) newName = 'Копия: ' + copyFrom;

    // Find source content
    var srcContent = data.content.find(function(c) { return c.section_key === copyFrom; });
    var srcItems = [];
    if (srcContent) { try { srcItems = JSON.parse(srcContent.content_json); } catch { srcItems = []; } }

    // Create copy
    await api('/content', { method: 'POST', body: JSON.stringify({ section_key: newId, section_name: newName, content_json: srcItems }) });

    var insertIdx2 = 0;
    if (afterBlock2 !== '_top') {
      for (var k = 0; k < data.sectionOrder.length; k++) {
        if (data.sectionOrder[k].section_id === afterBlock2) { insertIdx2 = k + 1; break; }
      }
    }
    data.sectionOrder.splice(insertIdx2, 0, { section_id: newId, sort_order: insertIdx2, is_visible: 1, label_ru: newName, label_am: '', _expanded: true });
    for (var m = 0; m < data.sectionOrder.length; m++) data.sectionOrder[m].sort_order = m;
    await saveAllBlocks();

    // Copy photo blocks from source
    var srcPhotos = (data.photoBlocks || []).filter(function(p) { return p.position === copyFrom; });
    for (var pi = 0; pi < srcPhotos.length; pi++) {
      await api('/photo-blocks', { method: 'POST', body: JSON.stringify({ block_name: srcPhotos[pi].block_name + ' (копия)', position: newId, is_visible: 1, photos_json: srcPhotos[pi].photos_json, description_ru: srcPhotos[pi].description_ru, description_am: srcPhotos[pi].description_am }) });
    }
    // Additional photo
    if (withPhoto2 && photoUrl2) {
      await api('/photo-blocks', { method: 'POST', body: JSON.stringify({ block_name: newName + ' фото', position: newId, is_visible: 1, photos_json: JSON.stringify([{ url: photoUrl2, caption: '' }]) }) });
    }
  }

  document.getElementById('createBlockModal').remove();
  toast('Блок создан!');
  await loadData();
  render();
}

// Duplicate block (quick copy with auto-generated ID)
async function duplicateBlock(idx) {
  var sec = data.sectionOrder[idx];
  if (!sec) return;
  if (!confirm('Копировать блок "' + (sec.label_ru || sec.section_id) + '"?')) return;

  var newId = sec.section_id + '_copy_' + Date.now().toString(36);
  var newName = (sec.label_ru || sec.section_id) + ' (копия)';

  // Copy content
  var srcContent = data.content.find(function(c) { return c.section_key === sec.section_id; });
  var srcItems = [];
  if (srcContent) { try { srcItems = JSON.parse(srcContent.content_json); } catch { srcItems = []; } }
  await api('/content', { method: 'POST', body: JSON.stringify({ section_key: newId, section_name: newName, content_json: srcItems }) });

  // Insert after source
  data.sectionOrder.splice(idx + 1, 0, { section_id: newId, sort_order: idx + 1, is_visible: 1, label_ru: newName, label_am: sec.label_am || '', _expanded: true });
  for (var j = 0; j < data.sectionOrder.length; j++) data.sectionOrder[j].sort_order = j;
  await saveAllBlocks();

  // Copy photo blocks
  var srcPhotos = (data.photoBlocks || []).filter(function(p) { return p.position === sec.section_id; });
  for (var pi = 0; pi < srcPhotos.length; pi++) {
    await api('/photo-blocks', { method: 'POST', body: JSON.stringify({ block_name: srcPhotos[pi].block_name + ' (копия)', position: newId, is_visible: 1, photos_json: srcPhotos[pi].photos_json }) });
  }

  toast('Блок скопирован!');
  await loadData();
  render();
}

// Delete block completely
async function deleteBlock(idx) {
  var sec = data.sectionOrder[idx];
  if (!sec) return;
  if (!confirm('Удалить блок "' + (sec.label_ru || sec.section_id) + '"? Это удалит все тексты и фото блока.')) return;

  // Delete content
  await api('/content/' + sec.section_id, { method: 'DELETE' });
  // Delete photo blocks attached
  var photos = (data.photoBlocks || []).filter(function(p) { return p.position === sec.section_id; });
  for (var pi = 0; pi < photos.length; pi++) {
    await api('/photo-blocks/' + photos[pi].id, { method: 'DELETE' });
  }
  // Remove from section order
  data.sectionOrder.splice(idx, 1);
  for (var j = 0; j < data.sectionOrder.length; j++) data.sectionOrder[j].sort_order = j;
  await saveAllBlocks();

  toast('Блок удалён');
  await loadData();
  render();
}

// seedContent — load texts from live site
async function seedContent() {
  toast('Загрузка текстов с сайта...', 'info');
  var res = await fetch('/api/admin/seed-from-site', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } });
  if (res.ok) {
    toast('Тексты успешно загружены!');
    await loadData(); render();
  } else {
    toast('Ошибка загрузки', 'error');
  }
}

// ===== CALCULATOR =====
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
    
    // Services inside this folder
    for (var si2 = 0; si2 < svcs.length; si2++) {
      var svc2 = svcs[si2];
      var isTiered = svc2.price_type === 'tiered' && svc2.price_tiers_json;
      var tiers = [];
      if (isTiered) { try { tiers = JSON.parse(svc2.price_tiers_json); } catch(e) { tiers = []; } }
      
      h += '<div class="section-edit-row" style="margin-bottom:8px">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 100px auto auto;gap:8px;align-items:center">' +
          '<div><div style="font-size:0.65rem;color:#64748b;margin-bottom:2px">Название RU</div><input class="input" value="' + escHtml(svc2.name_ru) + '" id="svc_ru_' + svc2.id + '" style="padding:6px 10px;font-size:0.85rem"></div>' +
          '<div><div style="font-size:0.65rem;color:#64748b;margin-bottom:2px">Название AM</div><input class="input" value="' + escHtml(svc2.name_am || '') + '" id="svc_am_' + svc2.id + '" style="padding:6px 10px;font-size:0.85rem"></div>' +
          '<div><div style="font-size:0.65rem;color:#64748b;margin-bottom:2px">\u0426\u0435\u043d\u0430 \u058f</div><input class="input" type="number" value="' + svc2.price + '" id="svc_price_' + svc2.id + '" style="padding:6px 10px;font-size:0.85rem"></div>' +
          '<button class="btn btn-success" style="padding:6px 10px;margin-top:14px" onclick="saveCalcService(' + svc2.id + ',' + tab.id + ')" title="Сохранить"><i class="fas fa-save"></i></button>' +
          '<button class="btn btn-danger" style="padding:6px 10px;margin-top:14px" onclick="deleteCalcService(' + svc2.id + ')" title="Удалить"><i class="fas fa-trash"></i></button>' +
        '</div>';
      
      // Tier editor
      if (isTiered && tiers.length > 0) {
        h += '<div style="margin-top:8px;padding:10px;background:#0f172a;border:1px solid rgba(139,92,246,0.3);border-radius:8px">' +
          '<div style="font-size:0.78rem;font-weight:600;color:#a78bfa;margin-bottom:6px"><i class="fas fa-layer-group" style="margin-right:4px"></i>\u0422\u0430\u0440\u0438\u0444\u043d\u0430\u044f \u0448\u043a\u0430\u043b\u0430</div>';
        for (var tii = 0; tii < tiers.length; tii++) {
          h += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;flex-wrap:wrap">' +
            '<span style="font-size:0.75rem;color:#94a3b8;min-width:16px">\u043e\u0442</span>' +
            '<input class="input" type="number" value="' + tiers[tii].min + '" style="width:60px;padding:4px 6px;font-size:0.8rem" id="tier_min_' + svc2.id + '_' + tii + '">' +
            '<span style="font-size:0.75rem;color:#94a3b8;min-width:16px">\u0434\u043e</span>' +
            '<input class="input" type="number" value="' + tiers[tii].max + '" style="width:60px;padding:4px 6px;font-size:0.8rem" id="tier_max_' + svc2.id + '_' + tii + '">' +
            '<span style="font-size:0.75rem;color:#94a3b8">=</span>' +
            '<input class="input" type="number" value="' + tiers[tii].price + '" style="width:80px;padding:4px 6px;font-size:0.8rem" id="tier_price_' + svc2.id + '_' + tii + '"><span style="font-size:0.8rem;color:#94a3b8">\u058f</span>' +
            '<button class="tier-del-btn" onclick="deleteTier(' + svc2.id + ',' + tii + ',' + tiers.length + ')"><i class="fas fa-times"></i></button>' +
          '</div>';
        }
        h += '<div style="margin-top:6px;display:flex;gap:6px">' +
          '<button class="btn btn-success" style="padding:4px 10px;font-size:0.75rem" onclick="saveTiers(' + svc2.id + ',' + tiers.length + ')"><i class="fas fa-save" style="margin-right:4px"></i>\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c</button>' +
          '<button class="btn btn-outline" style="padding:4px 10px;font-size:0.75rem" onclick="addTier(' + svc2.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>\u0421\u0442\u0440\u043e\u043a\u0430</button>' +
        '</div></div>';
      }
      h += '</div>';
    }
    
    // Add service button inside folder
    h += '<button class="btn btn-outline" style="width:100%;margin-top:8px;padding:10px;font-size:0.85rem;border-style:dashed" onclick="addServiceToTab(' + tab.id + ')" data-tab-name="' + escHtml(tab.name_ru) + '">' +
      '<i class="fas fa-plus" style="margin-right:6px;color:#a78bfa"></i>\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0443\u0441\u043b\u0443\u0433\u0443 \u0432 \u00ab' + escHtml(tab.name_ru) + '\u00bb</button>';
    
    h += '</div>';
  }
  
  if (!data.calcTabs.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-folder-open" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8;margin-bottom:16px">\u0420\u0430\u0437\u0434\u0435\u043b\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442. \u0421\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u043f\u0435\u0440\u0432\u044b\u0439 \u0440\u0430\u0437\u0434\u0435\u043b.</p>' +
      '<button class="btn btn-primary" onclick="addNewSection()"><i class="fas fa-folder-plus" style="margin-right:6px"></i>\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0440\u0430\u0437\u0434\u0435\u043b</button></div>';
  }
  
  h += '</div>';
  return h;
}

// ===== CREATE NEW SECTION (tab + folder in one action) =====
async function addNewSection() {
  // Insert inline form at top of page
  var existing = document.getElementById('newSectionForm');
  if (existing) { existing.remove(); return; }
  
  var formHtml = '<div id="newSectionForm" class="card" style="margin-bottom:20px;border:2px solid #8B5CF6;animation:slideUp 0.3s ease">' +
    '<h4 style="font-weight:700;margin-bottom:12px;color:#a78bfa"><i class="fas fa-folder-plus" style="margin-right:6px"></i>\u041d\u043e\u0432\u044b\u0439 \u0440\u0430\u0437\u0434\u0435\u043b (\u0432\u043a\u043b\u0430\u0434\u043a\u0430 \u043d\u0430 \u0441\u0430\u0439\u0442\u0435)</h4>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 150px;gap:10px;margin-bottom:12px">' +
      '<div><label style="font-size:0.75rem;color:#64748b">\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 (RU) *</label><input class="input" id="newSec_ru" placeholder="\u043d\u0430\u043f\u0440: \u0414\u043e\u0441\u0442\u0430\u0432\u043a\u0430"></div>' +
      '<div><label style="font-size:0.75rem;color:#64748b">\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 (AM)</label><input class="input" id="newSec_am" placeholder="\u043e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e"></div>' +
      '<div><label style="font-size:0.75rem;color:#64748b">\u041a\u043b\u044e\u0447 (\u0430\u043d\u0433\u043b)</label><input class="input" id="newSec_key" placeholder="delivery"></div>' +
    '</div>' +
    '<div style="display:flex;gap:10px">' +
      '<button class="btn btn-primary" onclick="submitNewSection()"><i class="fas fa-check" style="margin-right:4px"></i>\u0421\u043e\u0437\u0434\u0430\u0442\u044c</button>' +
      '<button class="btn btn-outline" onclick="cancelNewSection()">\u041e\u0442\u043c\u0435\u043d\u0430</button>' +
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
  if (!ru) { toast('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0440\u0430\u0437\u0434\u0435\u043b\u0430', 'error'); return; }
  var am = document.getElementById('newSec_am').value.trim() || ru;
  var key = document.getElementById('newSec_key').value.trim();
  // Auto-generate key from RU name if not provided
  if (!key) {
    key = ru.toLowerCase().replace(/[^a-z0-9\u0430-\u044f]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    // Transliterate simple RU chars
    var tbl = {'\u0430':'a','\u0431':'b','\u0432':'v','\u0433':'g','\u0434':'d','\u0435':'e','\u0436':'zh','\u0437':'z','\u0438':'i','\u0439':'y','\u043a':'k','\u043b':'l','\u043c':'m','\u043d':'n','\u043e':'o','\u043f':'p','\u0440':'r','\u0441':'s','\u0442':'t','\u0443':'u','\u0444':'f','\u0445':'h','\u0446':'ts','\u0447':'ch','\u0448':'sh','\u0449':'shch','\u044b':'y','\u044d':'e','\u044e':'yu','\u044f':'ya'};
    key = ru.toLowerCase().split('').map(function(c) { return tbl[c] || c; }).join('').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }
  
  await api('/calc-tabs', { method: 'POST', body: JSON.stringify({ tab_key: key, name_ru: ru, name_am: am, sort_order: data.calcTabs.length + 1 }) });
  toast('\u0420\u0430\u0437\u0434\u0435\u043b \u00ab' + ru + '\u00bb \u0441\u043e\u0437\u0434\u0430\u043d! \u0422\u0435\u043f\u0435\u0440\u044c \u0434\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0443\u0441\u043b\u0443\u0433\u0438.');
  await loadData(); render();
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
    '<div style="font-size:0.85rem;font-weight:700;color:#a78bfa;margin-bottom:10px"><i class="fas fa-plus-circle" style="margin-right:4px"></i>\u041d\u043e\u0432\u0430\u044f \u0443\u0441\u043b\u0443\u0433\u0430 \u0432 \u00ab' + escHtml(tabName) + '\u00bb</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 100px 130px;gap:8px;margin-bottom:10px">' +
      '<input class="input" id="nsvc_ru_' + tabId + '" placeholder="\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 RU" style="padding:6px 10px;font-size:0.85rem">' +
      '<input class="input" id="nsvc_am_' + tabId + '" placeholder="\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 AM" style="padding:6px 10px;font-size:0.85rem">' +
      '<input class="input" type="number" id="nsvc_price_' + tabId + '" placeholder="\u0426\u0435\u043d\u0430 \u058f" value="0" style="padding:6px 10px;font-size:0.85rem">' +
      '<select class="input" id="nsvc_type_' + tabId + '" style="padding:6px 8px;font-size:0.82rem">' +
        '<option value="fixed">\u0424\u0438\u043a\u0441. \u0446\u0435\u043d\u0430</option>' +
        '<option value="tiered">\u0422\u0430\u0440\u0438\u0444\u043d\u0430\u044f \u0448\u043a\u0430\u043b\u0430</option>' +
      '</select>' +
    '</div>' +
    '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-primary" style="font-size:0.85rem" onclick="submitSvcToTab(' + tabId + ')"><i class="fas fa-check" style="margin-right:4px"></i>\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c</button>' +
      '<button class="btn btn-outline" style="font-size:0.85rem" onclick="cancelAddSvc(' + tabId + ')">\u041e\u0442\u043c\u0435\u043d\u0430</button>' +
    '</div></div>';
  
  // Find the "add service" button for this tab and insert form before it
  var addBtn = document.querySelector('button[onclick="addServiceToTab(' + tabId + ')"]');
  if (addBtn) addBtn.insertAdjacentHTML('beforebegin', formHtml);
  var ruInput = document.getElementById('nsvc_ru_' + tabId);
  if (ruInput) ruInput.focus();
}

async function submitSvcToTab(tabId) {
  var ru = document.getElementById('nsvc_ru_' + tabId).value.trim();
  if (!ru) { toast('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435', 'error'); return; }
  var am = document.getElementById('nsvc_am_' + tabId).value.trim() || ru;
  var price = parseInt(document.getElementById('nsvc_price_' + tabId).value) || 0;
  var pType = document.getElementById('nsvc_type_' + tabId).value;
  var tiersJson = null;
  if (pType === 'tiered') { tiersJson = JSON.stringify([{min:1,max:20,price:price},{min:21,max:40,price:Math.round(price*0.85)},{min:41,max:999,price:Math.round(price*0.75)}]); }
  await api('/calc-services', { method: 'POST', body: JSON.stringify({ tab_id: tabId, name_ru: ru, name_am: am, price: price, price_type: pType, price_tiers_json: tiersJson, sort_order: data.calcServices.length + 1 }) });
  toast('\u0423\u0441\u043b\u0443\u0433\u0430 \u00ab' + ru + '\u00bb \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0430!');
  await loadData(); render();
}

async function saveCalcTab(id) {
  var ru = document.getElementById('tab_ru_' + id).value;
  var am = document.getElementById('tab_am_' + id).value;
  var key = document.getElementById('tab_key_' + id).value;
  var tab = data.calcTabs.find(function(t){ return t.id === id; });
  if (!tab) return;
  await api('/calc-tabs/' + id, { method: 'PUT', body: JSON.stringify({ name_ru: ru, name_am: am, sort_order: tab.sort_order, is_active: tab.is_active ?? 1 }) });
  toast('\u0420\u0430\u0437\u0434\u0435\u043b \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d');
  await loadData(); render();
}

async function saveCalcService(id, tabId) {
  var svc = data.calcServices.find(function(s){ return s.id === id; });
  if (!svc) return;
  var ru = document.getElementById('svc_ru_' + id).value;
  var am = document.getElementById('svc_am_' + id).value;
  var price = parseInt(document.getElementById('svc_price_' + id).value) || 0;
  await api('/calc-services/' + id, { method: 'PUT', body: JSON.stringify({ ...svc, name_ru: ru, name_am: am, price: price, tab_id: tabId || svc.tab_id }) });
  toast('\u0423\u0441\u043b\u0443\u0433\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0430');
  await loadData(); render();
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
  if (!tiers.length) { toast('\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u0438\u043d \u0442\u0430\u0440\u0438\u0444', 'error'); return; }
  var svc = data.calcServices.find(s => s.id === svcId);
  if (!svc) return;
  await api('/calc-services/' + svcId, { method: 'PUT', body: JSON.stringify({ ...svc, price_tiers_json: JSON.stringify(tiers), price: tiers[0].price }) });
  toast('\u0422\u0430\u0440\u0438\u0444\u044b \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b! \u041e\u0431\u043d\u043e\u0432\u0438\u0442\u0435 \u0441\u0430\u0439\u0442 \u0434\u043b\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438.');
  await loadData(); render();
}

async function addTier(svcId) {
  var svc = data.calcServices.find(s => s.id === svcId);
  if (!svc) return;
  var tiers = [];
  try { tiers = JSON.parse(svc.price_tiers_json); } catch(e) { tiers = []; }
  var lastMax = tiers.length ? tiers[tiers.length-1].max : 0;
  tiers.push({ min: lastMax + 1, max: lastMax + 20, price: 1000 });
  await api('/calc-services/' + svcId, { method: 'PUT', body: JSON.stringify({ ...svc, price_tiers_json: JSON.stringify(tiers) }) });
  toast('\u0421\u0442\u0440\u043e\u043a\u0430 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0430');
  await loadData(); render();
}

async function deleteTier(svcId, tierIndex, totalTiers) {
  if (totalTiers <= 1) { toast('\u041d\u0435\u043b\u044c\u0437\u044f \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0442\u0430\u0440\u0438\u0444.', 'error'); return; }
  if (!confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u0443 \u0441\u0442\u0440\u043e\u043a\u0443 \u0442\u0430\u0440\u0438\u0444\u0430?')) return;
  var svc = data.calcServices.find(s => s.id === svcId);
  if (!svc) return;
  var tiers = [];
  try { tiers = JSON.parse(svc.price_tiers_json); } catch(e) { tiers = []; }
  if (tierIndex < 0 || tierIndex >= tiers.length) return;
  tiers.splice(tierIndex, 1);
  await api('/calc-services/' + svcId, { method: 'PUT', body: JSON.stringify({ ...svc, price_tiers_json: JSON.stringify(tiers), price: tiers[0].price }) });
  toast('\u0421\u0442\u0440\u043e\u043a\u0430 \u0442\u0430\u0440\u0438\u0444\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430');
  await loadData(); render();
}

async function deleteCalcService(id) {
  if (!confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u044d\u0442\u0443 \u0443\u0441\u043b\u0443\u0433\u0443?')) return;
  await api('/calc-services/' + id, { method: 'DELETE' });
  toast('\u0423\u0441\u043b\u0443\u0433\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0430');
  await loadData(); render();
}

async function deleteCalcTab(id) {
  if (!confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0440\u0430\u0437\u0434\u0435\u043b \u0438 \u0432\u0441\u0435 \u0435\u0433\u043e \u0443\u0441\u043b\u0443\u0433\u0438?')) return;
  await api('/calc-tabs/' + id, { method: 'DELETE' });
  toast('\u0420\u0430\u0437\u0434\u0435\u043b \u0443\u0434\u0430\u043b\u0451\u043d');
  await loadData(); render();
}

// ===== TELEGRAM MESSAGES =====
function renderTelegram() {
  let h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Telegram сообщения</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Настройка текстов сообщений для каждой кнопки на сайте (на 2 языках)</p>' +
    '<button class="btn btn-primary" style="margin-bottom:20px" onclick="addTelegramMsg()"><i class="fas fa-plus" style="margin-right:6px"></i>Добавить кнопку</button>';
  
  for (const msg of data.telegram) {
    h += '<div class="card" style="margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
        '<div><span class="badge badge-green">' + msg.button_key + '</span> <span style="color:#64748b;font-size:0.8rem;margin-left:8px">' + (msg.description || '') + '</span></div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-success" style="padding:6px 12px;font-size:0.8rem" onclick="saveTgMsg(' + msg.id + ')"><i class="fas fa-save"></i> Сохранить</button>' +
          '<button class="btn btn-danger" style="padding:6px 12px;font-size:0.8rem" onclick="deleteTgMsg(' + msg.id + ')"><i class="fas fa-trash"></i></button>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Текст кнопки (RU)</label><input class="input" value="' + escHtml(msg.button_label_ru) + '" id="tg_lru_' + msg.id + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Текст кнопки (AM)</label><input class="input" value="' + escHtml(msg.button_label_am) + '" id="tg_lam_' + msg.id + '"></div>' +
      '</div>' +
      '<div style="margin-bottom:12px"><label style="font-size:0.75rem;color:#64748b;font-weight:600">Telegram URL</label><input class="input" value="' + escHtml(msg.telegram_url) + '" id="tg_url_' + msg.id + '"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Шаблон сообщения (RU)</label><textarea class="input" id="tg_mru_' + msg.id + '">' + escHtml(msg.message_template_ru) + '</textarea><p style="font-size:0.7rem;color:#475569;margin-top:4px">Переменные: {items}, {total}, {buyouts}, {reviews}, {contact}, {name}, {product}, {service}, {message}</p></div>' +
        '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Шаблон сообщения (AM)</label><textarea class="input" id="tg_mam_' + msg.id + '">' + escHtml(msg.message_template_am) + '</textarea></div>' +
      '</div>' +
    '</div>';
  }
  
  if (!data.telegram.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fab fa-telegram" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8">Telegram-сообщения ещё не настроены. Нажмите "Загрузить тексты с сайта" на вкладке Тексты.</p></div>';
  }
  
  h += '</div>';
  return h;
}

async function saveTgMsg(id) {
  const msg = data.telegram.find(m => m.id === id);
  await api('/telegram/' + id, { method: 'PUT', body: JSON.stringify({
    button_label_ru: document.getElementById('tg_lru_' + id).value,
    button_label_am: document.getElementById('tg_lam_' + id).value,
    telegram_url: document.getElementById('tg_url_' + id).value,
    message_template_ru: document.getElementById('tg_mru_' + id).value,
    message_template_am: document.getElementById('tg_mam_' + id).value,
    description: msg.description,
    is_active: 1
  }) });
  toast('Сообщение сохранено');
  await loadData(); render();
}

async function deleteTgMsg(id) {
  if (!confirm('Удалить это сообщение?')) return;
  await api('/telegram/' + id, { method: 'DELETE' });
  toast('Удалено');
  await loadData(); render();
}

async function addTelegramMsg() {
  const key = prompt('Ключ кнопки (англ, напр: hero_cta):');
  if (!key) return;
  const desc = prompt('Описание (где эта кнопка):') || '';
  await api('/telegram', { method: 'POST', body: JSON.stringify({
    button_key: key, button_label_ru: 'Новая кнопка', button_label_am: 'Նor կoption',
    telegram_url: 'https://t.me/goo_to_top', message_template_ru: 'Здравствуйте!',
    message_template_am: 'Ողdelays!', description: desc
  }) });
  toast('Кнопка добавлена');
  await loadData(); render();
}

// ===== SCRIPTS =====
function renderScripts() {
  let h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Пользовательские скрипты</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Аналитика, пиксели, Meta теги и другие скрипты</p>' +
    '<button class="btn btn-primary" style="margin-bottom:20px" onclick="addScript()"><i class="fas fa-plus" style="margin-right:6px"></i>Добавить скрипт</button>';
  
  for (const s of data.scripts) {
    h += '<div class="card" style="margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
        '<div><strong>' + escHtml(s.name) + '</strong> <span class="badge badge-amber">' + s.script_type + '</span> <span class="badge badge-purple">' + s.placement + '</span>' +
          (s.is_active ? ' <span class="badge badge-green">Активен</span>' : ' <span class="badge" style="background:rgba(239,68,68,0.2);color:#f87171">Выкл</span>') +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-success" style="padding:6px 12px;font-size:0.8rem" onclick="saveScript(' + s.id + ')"><i class="fas fa-save"></i></button>' +
          '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.8rem" onclick="toggleScript(' + s.id + ',' + (s.is_active ? 0 : 1) + ')">' + (s.is_active ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>') + '</button>' +
          '<button class="btn btn-danger" style="padding:6px 12px;font-size:0.8rem" onclick="deleteScript(' + s.id + ')"><i class="fas fa-trash"></i></button>' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:8px"><label style="font-size:0.75rem;color:#64748b">Название</label><input class="input" value="' + escHtml(s.name) + '" id="scr_name_' + s.id + '"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:8px">' +
        '<div><label style="font-size:0.75rem;color:#64748b">Тип</label><select class="input" id="scr_type_' + s.id + '">' +
          '<option value="js"' + (s.script_type === 'js' ? ' selected' : '') + '>JavaScript</option>' +
          '<option value="css"' + (s.script_type === 'css' ? ' selected' : '') + '>CSS</option>' +
          '<option value="meta"' + (s.script_type === 'meta' ? ' selected' : '') + '>Meta тег</option>' +
          '<option value="html"' + (s.script_type === 'html' ? ' selected' : '') + '>HTML</option></select></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b">Размещение</label><select class="input" id="scr_place_' + s.id + '">' +
          '<option value="head"' + (s.placement === 'head' ? ' selected' : '') + '>В head</option>' +
          '<option value="body_start"' + (s.placement === 'body_start' ? ' selected' : '') + '>Начало body</option>' +
          '<option value="body_end"' + (s.placement === 'body_end' ? ' selected' : '') + '>Конец body</option></select></div>' +
      '</div>' +
      '<div><label style="font-size:0.75rem;color:#64748b">Код</label><textarea class="input" style="font-family:monospace;min-height:100px" id="scr_code_' + s.id + '">' + escHtml(s.code) + '</textarea></div>' +
    '</div>';
  }
  
  if (!data.scripts.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-code" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8">Скриптов пока нет. Добавьте аналитику, пиксели или кастомные стили.</p></div>';
  }
  
  h += '</div>';
  return h;
}

async function saveScript(id) {
  const s = data.scripts.find(x => x.id === id);
  await api('/scripts/' + id, { method: 'PUT', body: JSON.stringify({
    name: document.getElementById('scr_name_' + id).value,
    description: s.description,
    script_type: document.getElementById('scr_type_' + id).value,
    placement: document.getElementById('scr_place_' + id).value,
    code: document.getElementById('scr_code_' + id).value,
    is_active: s.is_active
  }) });
  toast('Скрипт сохранён');
  await loadData(); render();
}

async function addScript() {
  const name = prompt('Название скрипта (напр: Google Analytics):');
  if (!name) return;
  await api('/scripts', { method: 'POST', body: JSON.stringify({ name, description: '', script_type: 'js', placement: 'head', code: '<!-- Ваш код -->' }) });
  toast('Скрипт добавлен');
  await loadData(); render();
}

async function deleteScript(id) {
  if (!confirm('Удалить скрипт?')) return;
  await api('/scripts/' + id, { method: 'DELETE' });
  toast('Удалён');
  await loadData(); render();
}

async function toggleScript(id, active) {
  const s = data.scripts.find(x => x.id === id);
  await api('/scripts/' + id, { method: 'PUT', body: JSON.stringify({ ...s, is_active: active }) });
  toast(active ? 'Скрипт включён' : 'Скрипт выключен');
  await loadData(); render();
}

// ===== REFERRAL CODES =====
function renderReferrals() {
  let h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Реферальные коды</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Кодовые слова для скидок и бесплатных отзывов. Пользователь вводит код в калькуляторе и получает скидку.</p>' +
    '<button class="btn btn-primary" style="margin-bottom:20px" onclick="addReferral()"><i class="fas fa-plus" style="margin-right:6px"></i>Добавить код</button>';
  
  for (const ref of data.referrals) {
    h += '<div class="card" style="margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
        '<div><span class="badge badge-green" style="font-size:0.9rem;padding:6px 14px">' + escHtml(ref.code) + '</span>' +
          (ref.is_active ? ' <span class="badge badge-green">Активен</span>' : ' <span class="badge" style="background:rgba(239,68,68,0.2);color:#f87171">Выкл</span>') +
          ' <span style="color:#64748b;font-size:0.8rem;margin-left:8px">Использований: ' + (ref.uses_count || 0) + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-success" style="padding:6px 12px;font-size:0.8rem" onclick="saveReferral(' + ref.id + ')"><i class="fas fa-save"></i></button>' +
          '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.8rem" onclick="toggleReferral(' + ref.id + ',' + (ref.is_active ? 0 : 1) + ')">' + (ref.is_active ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>') + '</button>' +
          '<button class="btn btn-danger" style="padding:6px 12px;font-size:0.8rem" onclick="deleteReferral(' + ref.id + ')"><i class="fas fa-trash"></i></button>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Код (слово)</label><input class="input" value="' + escHtml(ref.code) + '" id="ref_code_' + ref.id + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Скидка (%)</label><input class="input" type="number" value="' + (ref.discount_percent || 0) + '" id="ref_disc_' + ref.id + '" min="0" max="100"></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Бесплатных отзывов</label><input class="input" type="number" value="' + (ref.free_reviews || 0) + '" id="ref_free_' + ref.id + '" min="0"></div>' +
      '</div>' +
      '<div style="margin-top:12px"><label style="font-size:0.75rem;color:#64748b;font-weight:600">Описание</label><input class="input" value="' + escHtml(ref.description) + '" id="ref_desc_' + ref.id + '" placeholder="Для кого этот код / комментарий"></div>' +
    '</div>';
  }
  
  if (!data.referrals.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-gift" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8">Реферальных кодов пока нет. Создайте первый код для предоставления скидок клиентам.</p></div>';
  }
  
  h += '</div>';
  return h;
}

async function addReferral() {
  const code = prompt('Кодовое слово (латиница, будет в верхнем регистре):');
  if (!code) return;
  const desc = prompt('Описание (для кого этот код):') || '';
  const disc = parseInt(prompt('Скидка в процентах (0-100):') || '0');
  const free = parseInt(prompt('Количество бесплатных отзывов (0 = нет):') || '0');
  await api('/referrals', { method: 'POST', body: JSON.stringify({ code, description: desc, discount_percent: disc, free_reviews: free }) });
  toast('Код добавлен');
  await loadData(); render();
}

async function saveReferral(id) {
  var ref = data.referrals.find(function(r) { return r.id === id; });
  if (!ref) return;
  await api('/referrals/' + id, { method: 'PUT', body: JSON.stringify({
    code: document.getElementById('ref_code_' + id).value,
    description: document.getElementById('ref_desc_' + id).value,
    discount_percent: parseInt(document.getElementById('ref_disc_' + id).value) || 0,
    free_reviews: parseInt(document.getElementById('ref_free_' + id).value) || 0,
    is_active: ref.is_active
  }) });
  toast('Код сохранён');
  await loadData(); render();
}

async function toggleReferral(id, active) {
  var ref = data.referrals.find(function(r) { return r.id === id; });
  if (!ref) return;
  await api('/referrals/' + id, { method: 'PUT', body: JSON.stringify({ ...ref, is_active: active }) });
  toast(active ? 'Код активирован' : 'Код деактивирован');
  await loadData(); render();
}

async function deleteReferral(id) {
  if (!confirm('Удалить этот код?')) return;
  await api('/referrals/' + id, { method: 'DELETE' });
  toast('Код удалён');
  await loadData(); render();
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

// ===== SETTINGS =====
function renderSettings() {
  return '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:24px">Настройки</h1>' +
    '<div class="card" style="max-width:500px"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-lock" style="color:#8B5CF6;margin-right:8px"></i>Смена пароля</h3>' +
      '<div style="margin-bottom:12px"><label style="font-size:0.85rem;color:#94a3b8;display:block;margin-bottom:6px">Текущий пароль</label><input class="input" type="password" id="setPwdCurrent"></div>' +
      '<div style="margin-bottom:12px"><label style="font-size:0.85rem;color:#94a3b8;display:block;margin-bottom:6px">Новый пароль</label><input class="input" type="password" id="setPwdNew"></div>' +
      '<div style="margin-bottom:16px"><label style="font-size:0.85rem;color:#94a3b8;display:block;margin-bottom:6px">Подтвердите новый пароль</label><input class="input" type="password" id="setPwdConfirm"></div>' +
      '<button class="btn btn-primary" onclick="changePassword()"><i class="fas fa-key" style="margin-right:6px"></i>Сменить пароль</button>' +
    '</div></div>';
}

async function changePassword() {
  const cur = document.getElementById('setPwdCurrent').value;
  const nw = document.getElementById('setPwdNew').value;
  const cf = document.getElementById('setPwdConfirm').value;
  if (!cur || !nw) { toast('Заполните все поля', 'error'); return; }
  if (nw !== cf) { toast('Пароли не совпадают', 'error'); return; }
  const res = await api('/change-password', { method: 'POST', body: JSON.stringify({ current_password: cur, new_password: nw }) });
  if (res && res.success) { toast('Пароль изменён'); } else { toast(res?.error || 'Ошибка', 'error'); }
}

// ===== LEADS / CRM =====
let leadsFilter = { status: 'all', source: 'all', search: '', assignee: 'all' };

function renderLeads() {
  var leads = (data.leads && data.leads.leads) ? data.leads.leads : [];
  var total = (data.leads && data.leads.total) ? data.leads.total : 0;
  
  // --- Analytics mini-dashboard with per-status sums + services/articles split ---
  var stats = { new: {c:0,a:0,svc:0,art:0}, contacted: {c:0,a:0,svc:0,art:0}, in_progress: {c:0,a:0,svc:0,art:0}, checking: {c:0,a:0,svc:0,art:0}, done: {c:0,a:0,svc:0,art:0}, rejected: {c:0,a:0,svc:0,art:0} };
  var totalAmount = 0;
  for (var ai = 0; ai < leads.length; ai++) {
    var al = leads[ai];
    var amt = Number(al.total_amount || 0);
    totalAmount += amt;
    var st = al.status || 'new';
    if (!stats[st]) stats[st] = {c:0,a:0,svc:0,art:0};
    stats[st].c++; stats[st].a += amt;
    // Split services vs articles from calc_data
    var cd = null;
    if (al.calc_data) { try { cd = JSON.parse(al.calc_data); } catch(e) {} }
    if (cd && cd.items) {
      for (var ci = 0; ci < cd.items.length; ci++) {
        var it = cd.items[ci];
        if (it.wb_article) { stats[st].art += Number(it.subtotal||0); }
        else { stats[st].svc += Number(it.subtotal||0); }
      }
    }
  }
  
  // --- Filter leads ---
  var filtered = leads.filter(function(l) {
    if (leadsFilter.status !== 'all' && l.status !== leadsFilter.status) return false;
    if (leadsFilter.source !== 'all' && (l.source||'form') !== leadsFilter.source) return false;
    if (leadsFilter.assignee !== 'all' && String(l.assigned_to||'') !== leadsFilter.assignee) return false;
    if (leadsFilter.search) {
      var q = leadsFilter.search.toLowerCase();
      if (!((l.name||'').toLowerCase().includes(q) || (l.contact||'').toLowerCase().includes(q) || (l.message||'').toLowerCase().includes(q) || ('#'+l.id).includes(q) || (l.lead_number && ('#'+l.lead_number).includes(q)))) return false;
    }
    return true;
  });
  
  var fmtA = function(n) { return n > 0 ? Number(n).toLocaleString('ru-RU') + '\\u00a0֏' : '—'; };
  
  var h = '<div style="padding:32px">';
  // Header
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">' +
    '<div><h1 style="font-size:1.8rem;font-weight:800"><i class="fas fa-users" style="color:#8B5CF6;margin-right:10px"></i>Лиды / CRM</h1>' +
    '<p style="color:#94a3b8;margin-top:4px">Всего: <strong>' + total + '</strong> | Показано: <strong>' + filtered.length + '</strong></p></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-success" onclick="showCreateLeadModal()"><i class="fas fa-plus" style="margin-right:4px"></i>Новый лид</button>' +
      '<button class="btn btn-primary" onclick="navigate(\\'analytics\\')"><i class="fas fa-chart-bar" style="margin-right:4px"></i>Аналитика</button>' +
      '<button class="btn btn-outline" onclick="loadLeadsData()"><i class="fas fa-sync-alt" style="margin-right:4px"></i>Обновить</button>' +
      '<a href="/api/admin/leads/export" target="_blank" class="btn btn-outline" style="text-decoration:none"><i class="fas fa-download" style="margin-right:6px"></i>CSV</a>' +
    '</div></div>';
  
  // KPI cards — 6 statuses + Total
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin-bottom:20px">';
  // 1. Новые
  h += '<div class="stat-card" style="cursor:pointer;padding:14px;background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.04));border-color:rgba(16,185,129,0.25)" onclick="setLeadsFilter(\\'status\\',\\'new\\')">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:1.6rem;font-weight:900;color:#10B981">' + stats.new.c + '</span><span style="font-size:1.4rem">🟢</span></div>' +
    '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">Новые лиды</div>' +
    '<div style="color:#34d399;font-size:0.82rem;font-weight:700;margin-top:2px">' + fmtA(stats.new.a) + '</div></div>';
  // 2. На связи
  h += '<div class="stat-card" style="cursor:pointer;padding:14px;background:linear-gradient(135deg,rgba(59,130,246,0.12),rgba(59,130,246,0.04));border-color:rgba(59,130,246,0.25)" onclick="setLeadsFilter(\\'status\\',\\'contacted\\')">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:1.6rem;font-weight:900;color:#3B82F6">' + stats.contacted.c + '</span><span style="font-size:1.4rem">💬</span></div>' +
    '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">На связи</div>' +
    '<div style="color:#60a5fa;font-size:0.82rem;font-weight:700;margin-top:2px">' + fmtA(stats.contacted.a) + '</div></div>';
  // 3. В работе — total at top, services and articles below
  h += '<div class="stat-card" style="cursor:pointer;padding:14px;background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.04));border-color:rgba(245,158,11,0.25)" onclick="setLeadsFilter(\\'status\\',\\'in_progress\\')">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:1.6rem;font-weight:900;color:#F59E0B">' + stats.in_progress.c + '</span><span style="font-size:1.4rem">🔄</span></div>' +
    '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">В работе</div>' +
    '<div style="color:#fbbf24;font-size:0.88rem;font-weight:700;margin-top:2px">' + fmtA(stats.in_progress.a) + '</div>' +
    '<div style="margin-top:4px;font-size:0.7rem;color:#94a3b8"><span style="color:#a78bfa">Усл: ' + fmtA(stats.in_progress.svc) + '</span><br><span style="color:#fb923c">Зак: ' + fmtA(stats.in_progress.art) + '</span></div></div>';
  // 4. Отклонен
  h += '<div class="stat-card" style="cursor:pointer;padding:14px;background:linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.04));border-color:rgba(239,68,68,0.25)" onclick="setLeadsFilter(\\'status\\',\\'rejected\\')">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:1.6rem;font-weight:900;color:#EF4444">' + stats.rejected.c + '</span><span style="font-size:1.4rem">❌</span></div>' +
    '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">Отклонён</div>' +
    '<div style="color:#f87171;font-size:0.82rem;font-weight:700;margin-top:2px">' + fmtA(stats.rejected.a) + '</div></div>';
  // 5. Проверка
  h += '<div class="stat-card" style="cursor:pointer;padding:14px;background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(139,92,246,0.04));border-color:rgba(139,92,246,0.25)" onclick="setLeadsFilter(\\'status\\',\\'checking\\')">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:1.6rem;font-weight:900;color:#8B5CF6">' + stats.checking.c + '</span><span style="font-size:1.4rem">🔍</span></div>' +
    '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">Проверка</div>' +
    '<div style="color:#a78bfa;font-size:0.82rem;font-weight:700;margin-top:2px">' + fmtA(stats.checking.a) + '</div></div>';
  // 6. Завершён — total (turnover) at top, services and articles below
  h += '<div class="stat-card" style="cursor:pointer;padding:14px;background:linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.08));border-color:rgba(16,185,129,0.4)" onclick="setLeadsFilter(\\'status\\',\\'done\\')">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:1.6rem;font-weight:900;color:#10B981">' + stats.done.c + '</span><span style="font-size:1.4rem">✅</span></div>' +
    '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">Завершён</div>' +
    '<div style="color:#34d399;font-size:0.88rem;font-weight:700;margin-top:2px">' + fmtA(stats.done.a) + '</div>' +
    '<div style="margin-top:4px;font-size:0.7rem;color:#94a3b8"><span style="color:#a78bfa">Усл: ' + fmtA(stats.done.svc) + '</span><br><span style="color:#fb923c">Зак: ' + fmtA(stats.done.art) + '</span></div></div>';
  h += '</div>';
  
  // Filters row — 6 statuses only
  h += '<div class="card" style="padding:14px;margin-bottom:20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
    '<i class="fas fa-filter" style="color:#64748b"></i>' +
    '<select class="input" style="width:150px;padding:6px 10px;font-size:0.82rem" onchange="setLeadsFilter(\\'status\\',this.value)">' +
      '<option value="all"' + (leadsFilter.status==='all'?' selected':'') + '>Все статусы</option>' +
      '<option value="new"' + (leadsFilter.status==='new'?' selected':'') + '>🟢 Новые лиды</option>' +
      '<option value="contacted"' + (leadsFilter.status==='contacted'?' selected':'') + '>💬 На связи</option>' +
      '<option value="in_progress"' + (leadsFilter.status==='in_progress'?' selected':'') + '>🔄 В работе</option>' +
      '<option value="rejected"' + (leadsFilter.status==='rejected'?' selected':'') + '>❌ Отклонён</option>' +
      '<option value="checking"' + (leadsFilter.status==='checking'?' selected':'') + '>🔍 Проверка</option>' +
      '<option value="done"' + (leadsFilter.status==='done'?' selected':'') + '>✅ Завершён</option></select>' +
    '<select class="input" style="width:150px;padding:6px 10px;font-size:0.82rem" onchange="setLeadsFilter(\\'source\\',this.value)">' +
      '<option value="all"' + (leadsFilter.source==='all'?' selected':'') + '>Все источники</option>' +
      '<option value="form"' + (leadsFilter.source==='form'?' selected':'') + '>Форма</option>' +
      '<option value="popup"' + (leadsFilter.source==='popup'?' selected':'') + '>Попап</option>' +
      '<option value="calculator_pdf"' + (leadsFilter.source==='calculator_pdf'?' selected':'') + '>Калькулятор</option>' +
      '<option value="manual"' + (leadsFilter.source==='manual'?' selected':'') + '>Ручной</option>' +
      '<option value="admin_panel"' + (leadsFilter.source==='admin_panel'?' selected':'') + '>Админ-панель</option></select>' +
    '<select class="input" style="width:170px;padding:6px 10px;font-size:0.82rem" onchange="setLeadsFilter(\\'assignee\\',this.value)">' +
      '<option value="all"' + (leadsFilter.assignee==='all'?' selected':'') + '>Все ответственные</option>' +
      '<option value=""' + (leadsFilter.assignee===''?' selected':'') + '>Не назначен</option>';
  for (var ui = 0; ui < (data.users||[]).length; ui++) {
    var usr = data.users[ui];
    h += '<option value="' + usr.id + '"' + (leadsFilter.assignee===String(usr.id)?' selected':'') + '>' + escHtml(usr.display_name) + '</option>';
  }
  h += '</select>' +
    '<input class="input" style="flex:1;min-width:180px;padding:6px 10px;font-size:0.82rem" placeholder="Поиск по имени, контакту, #id..." value="' + escHtml(leadsFilter.search) + '" oninput="setLeadsFilter(\\'search\\',this.value)">' +
    (leadsFilter.status!=='all'||leadsFilter.source!=='all'||leadsFilter.search||leadsFilter.assignee!=='all' ? '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.78rem" onclick="resetLeadsFilter()"><i class="fas fa-times" style="margin-right:4px"></i>Сбросить</button>' : '') +
  '</div>';

  if (!filtered.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-inbox" style="font-size:3rem;color:#475569;margin-bottom:16px"></i><p style="color:#94a3b8">' + (leads.length > 0 ? 'Нет заявок по выбранным фильтрам' : 'Заявок пока нет. Нажмите «Новый лид» для создания.') + '</p></div>';
  } else {
    for (var i = 0; i < filtered.length; i++) {
      var l = filtered[i];
      var isCalc = l.source === 'calculator_pdf';
      var calcData = null;
      if (l.calc_data) { try { calcData = JSON.parse(l.calc_data); } catch(e) {} }
      var leadAmt = Number(l.total_amount || 0);
      var refundAmt = Number(l.refund_amount || 0);
      var statusColors = { new:'#10B981', contacted:'#3B82F6', in_progress:'#F59E0B', checking:'#8B5CF6', done:'#10B981', rejected:'#EF4444' };
      var statusBorderColor = statusColors[l.status] || '#334155';
      // Compute services vs articles amounts
      var svcAmt = 0, artAmt = 0;
      var serviceItems = [];
      if (calcData && calcData.items) {
        for (var bi = 0; bi < calcData.items.length; bi++) {
          if (calcData.items[bi].wb_article) artAmt += Number(calcData.items[bi].subtotal||0);
          else { svcAmt += Number(calcData.items[bi].subtotal||0); serviceItems.push(calcData.items[bi]); }
        }
      }
      
      h += '<div class="card" style="margin-bottom:12px;border-left:3px solid ' + statusBorderColor + ';cursor:pointer" onclick="handleCardClick(event,' + l.id + ')">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">' +
          '<div style="flex:1;min-width:200px">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">' +
              '<span style="font-size:1rem;font-weight:800;color:#a78bfa">#' + (l.lead_number || l.id) + '</span>' +
              '<span class="badge badge-purple">' + (l.source || 'form') + '</span>' +
              (l.referral_code ? '<span class="badge badge-amber">🏷 ' + escHtml(l.referral_code) + '</span>' : '') +
              (l.assigned_to ? '<span class="badge badge-green" style="font-size:0.7rem"><i class="fas fa-user" style="margin-right:3px"></i>' + escHtml(getAssigneeName(l.assigned_to)) + '</span>' : '<span class="badge" style="background:rgba(239,68,68,0.15);color:#f87171;font-size:0.7rem">Не назначен</span>') +
              (l.articles_count > 0 ? '<span class="badge" style="background:rgba(249,115,22,0.15);color:#fb923c;font-size:0.7rem"><i class="fas fa-box" style="margin-right:3px"></i>' + l.articles_count + '</span>' : '') +
            '</div>' +
            '<div style="font-size:1.05rem;font-weight:700;color:#e2e8f0">' + escHtml(l.name || '—') + '</div>' +
            '<div style="font-size:0.9rem;color:#a78bfa;margin-top:2px">' + escHtml(l.contact || '—') + '</div>' +
            // TG/TZ quick links on main card
            ((l.telegram_group || l.tz_link) ? '<div style="display:flex;gap:6px;margin-top:6px">' +
              (l.telegram_group ? '<a href="' + escHtml(l.telegram_group) + '" target="_blank" style="font-size:0.72rem;color:#0EA5E9;text-decoration:none"><i class="fab fa-telegram" style="margin-right:2px"></i>TG</a>' : '') +
              (l.tz_link ? '<a href="' + escHtml(l.tz_link) + '" target="_blank" style="font-size:0.72rem;color:#F59E0B;text-decoration:none"><i class="fas fa-file-alt" style="margin-right:2px"></i>ТЗ</a>' : '') +
            '</div>' : '') +
            // Services/Articles amounts on main card
            ((svcAmt > 0 || artAmt > 0) ? '<div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap">' +
              (svcAmt > 0 ? '<span style="font-size:0.72rem;color:#a78bfa;font-weight:600"><i class="fas fa-calculator" style="margin-right:3px"></i>Усл: ' + Number(svcAmt).toLocaleString('ru-RU') + ' ֏</span>' : '') +
              (artAmt > 0 ? '<span style="font-size:0.72rem;color:#fb923c;font-weight:600"><i class="fas fa-box" style="margin-right:3px"></i>Зак: ' + Number(artAmt).toLocaleString('ru-RU') + ' ֏</span>' : '') +
              (refundAmt > 0 ? '<span style="font-size:0.72rem;color:#f87171;font-weight:600"><i class="fas fa-undo-alt" style="margin-right:3px"></i>Возврат: -' + Number(refundAmt).toLocaleString('ru-RU') + ' ֏</span>' : '') +
            '</div>' : '') +
          '</div>';
      
      // Right side: status + total + date + actions
      h += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:200px">';
      
      if (leadAmt > 0) {
        h += '<div style="font-size:1.3rem;font-weight:900;color:#8B5CF6;white-space:nowrap">' + Number(leadAmt).toLocaleString('ru-RU') + '&nbsp;֏</div>';
      }
      
      // Status selector — 6 statuses
      h += '<select class="input" style="width:150px;padding:4px 8px;font-size:0.82rem" onchange="updateLeadStatus(' + l.id + ', this.value)">' +
        '<option value="new"' + (l.status === 'new' ? ' selected' : '') + '>🟢 Новые лиды</option>' +
        '<option value="contacted"' + (l.status === 'contacted' ? ' selected' : '') + '>💬 На связи</option>' +
        '<option value="in_progress"' + (l.status === 'in_progress' ? ' selected' : '') + '>🔄 В работе</option>' +
        '<option value="rejected"' + (l.status === 'rejected' ? ' selected' : '') + '>❌ Отклонён</option>' +
        '<option value="checking"' + (l.status === 'checking' ? ' selected' : '') + '>🔍 Проверка</option>' +
        '<option value="done"' + (l.status === 'done' ? ' selected' : '') + '>✅ Завершён</option></select>';
      
      // Assign to employee
      h += '<select class="input" style="width:170px;padding:4px 8px;font-size:0.78rem;color:#64748b" onchange="assignLead(' + l.id + ', this.value)">' +
        '<option value="">Ответственный...</option>';
      for (var uj = 0; uj < (data.users||[]).length; uj++) {
        var uu = data.users[uj];
        h += '<option value="' + uu.id + '"' + (l.assigned_to==uu.id?' selected':'') + '>' + escHtml(uu.display_name) + '</option>';
      }
      h += '</select>';
      
      h += '<div style="font-size:0.78rem;color:#64748b">' + formatArmTime(l.created_at) + '</div>';
      h += '<div style="display:flex;gap:4px">';
      h += '<button class="btn btn-outline" style="padding:4px 10px;font-size:0.75rem" onclick="closeLeadDetail(' + l.id + ')" title="Свернуть/Развернуть"><i id="lead-arrow-' + l.id + '" class="fas fa-chevron-down" style="transition:transform 0.2s"></i></button>';
      h += '<button class="btn btn-danger" style="padding:4px 8px;font-size:0.75rem" onclick="deleteLead(' + l.id + ')"><i class="fas fa-trash"></i></button>';
      h += '</div></div></div>';
      
      // ========== EXPANDABLE DETAIL AREA ==========
      h += '<div id="lead-detail-' + l.id + '" style="display:none">';
      
      // --- 1. EDITABLE FIELDS: Name + Contact (phone) ---
      h += '<div style="margin-top:10px;border-top:1px solid #334155;padding-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div><div style="font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:6px"><i class="fas fa-user-edit" style="margin-right:4px;color:#a78bfa"></i>Имя клиента:</div>' +
        '<input class="input" id="lead-name-' + l.id + '" value="' + escHtml(l.name||'') + '" style="font-size:0.88rem;padding:8px" placeholder="Имя клиента..."></div>' +
        '<div><div style="font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:6px"><i class="fas fa-phone" style="margin-right:4px;color:#10B981"></i>Телефон:</div>' +
        '<input class="input" id="lead-contact-' + l.id + '" value="' + escHtml(l.contact||'') + '" style="font-size:0.88rem;padding:8px" placeholder="+374..."></div></div>';

      // --- 2. TELEGRAM GROUP & TZ LINKS ---
      h += '<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div><div style="font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:6px"><i class="fab fa-telegram" style="margin-right:4px;color:#0EA5E9"></i>Telegram группа:</div>' +
        '<input class="input" id="lead-tg-' + l.id + '" value="' + escHtml(l.telegram_group||'') + '" style="font-size:0.85rem;padding:8px" placeholder="https://t.me/..."></div>' +
        '<div><div style="font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:6px"><i class="fas fa-file-alt" style="margin-right:4px;color:#F59E0B"></i>ТЗ клиента:</div>' +
        '<input class="input" id="lead-tz-' + l.id + '" value="' + escHtml(l.tz_link||'') + '" style="font-size:0.85rem;padding:8px" placeholder="Ссылка на ТЗ..."></div></div>';

      // --- 2.5. REFUND AMOUNT ---
      var refundVal = Number(l.refund_amount || 0);
      h += '<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div><div style="font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:6px"><i class="fas fa-undo-alt" style="margin-right:4px;color:#EF4444"></i>Возврат средств (֏):</div>' +
        '<input class="input" type="number" min="0" step="1" id="lead-refund-' + l.id + '" value="' + refundVal + '" style="font-size:0.88rem;padding:8px;border-color:rgba(239,68,68,0.3)" placeholder="0"></div>' +
        '<div style="display:flex;align-items:flex-end">' +
        (refundVal > 0 ? '<div style="font-size:0.78rem;color:#f87171;font-weight:600;padding:8px"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>Возврат: ' + Number(refundVal).toLocaleString('ru-RU') + ' ֏ (из суммы выкупов)</div>' : '<div style="font-size:0.78rem;color:#64748b;padding:8px">Сумма вычитается из стоимости выкупов</div>') +
        '</div></div>';

      // --- 3. NOTES (at top, above services) ---
      h += '<div style="margin-top:10px;border-top:1px solid #334155;padding-top:10px">' +
        '<div style="font-size:0.78rem;font-weight:600;color:#fbbf24;margin-bottom:6px"><i class="fas fa-sticky-note" style="margin-right:4px"></i>Заметка:</div>' +
        '<textarea class="input" id="lead-notes-' + l.id + '" style="min-height:40px;font-size:0.82rem;padding:8px" placeholder="Добавить заметку о клиенте...">' + escHtml(l.notes||'') + '</textarea></div>';

      // --- 4. SERVICES — collapsible with total shown when closed ---
      var svcTotal = 0;
      for (var si3 = 0; si3 < serviceItems.length; si3++) { svcTotal += Number(serviceItems[si3].subtotal || 0); }
      h += '<div style="margin-top:10px;border-top:1px solid #334155;padding-top:10px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleSection(\\'svc-body-' + l.id + '\\',\\'svc-arrow-' + l.id + '\\')">' +
        '<span style="font-size:0.85rem;font-weight:700;color:#a78bfa"><i class="fas fa-calculator" style="margin-right:6px"></i>Услуги (' + serviceItems.length + ') — <span style="color:#8B5CF6">' + Number(svcTotal).toLocaleString('ru-RU') + '&nbsp;֏</span></span>' +
        '<div style="display:flex;align-items:center;gap:8px"><button class="btn btn-primary" style="padding:4px 12px;font-size:0.78rem" onclick="event.stopPropagation();showLeadCalcModal(' + l.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button>' +
        '<i id="svc-arrow-' + l.id + '" class="fas fa-chevron-right" style="color:#64748b;transition:transform 0.2s;font-size:0.75rem"></i></div></div>';
      h += '<div id="svc-body-' + l.id + '" style="display:none;margin-top:8px">';
      if (serviceItems.length > 0) {
        h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-bottom:8px">' +
          '<thead><tr style="background:#1e293b"><th style="padding:6px 8px;color:#94a3b8;font-weight:600;text-align:left">Услуга</th><th style="padding:6px 8px;color:#94a3b8;font-weight:600;text-align:center">Кол-во</th><th style="padding:6px 8px;color:#94a3b8;font-weight:600;text-align:right">Цена</th><th style="padding:6px 8px;color:#94a3b8;font-weight:600;text-align:right">Сумма</th><th style="padding:6px 8px"></th></tr></thead><tbody>';
        for (var si4 = 0; si4 < serviceItems.length; si4++) {
          var sii = serviceItems[si4];
          h += '<tr style="border-bottom:1px solid #334155">' +
            '<td style="padding:6px 8px;color:#e2e8f0">' + escHtml(sii.name) + '</td>' +
            '<td style="padding:6px 8px;text-align:center;color:#94a3b8">' + (sii.qty||1) + '</td>' +
            '<td style="padding:6px 8px;text-align:right;color:#94a3b8;white-space:nowrap">' + Number(sii.price||0).toLocaleString('ru-RU') + '&nbsp;֏</td>' +
            '<td style="padding:6px 8px;text-align:right;color:#a78bfa;font-weight:600;white-space:nowrap">' + Number(sii.subtotal||0).toLocaleString('ru-RU') + '&nbsp;֏</td>' +
            '<td style="padding:6px 8px;text-align:center"><button style="background:none;border:none;color:#EF4444;cursor:pointer;font-size:0.75rem;padding:2px 4px" onclick="removeLeadService(' + l.id + ',' + si4 + ')" title="Удалить"><i class="fas fa-trash"></i></button></td></tr>';
        }
        h += '</tbody><tfoot><tr style="background:rgba(139,92,246,0.1)"><td colspan="3" style="padding:8px;text-align:right;font-weight:700;color:#94a3b8">ИТОГО услуги:</td><td style="padding:8px;text-align:right;font-weight:900;color:#8B5CF6;white-space:nowrap">' + Number(svcTotal).toLocaleString('ru-RU') + '&nbsp;֏</td><td></td></tr></tfoot></table></div>';
      } else {
        h += '<div style="text-align:center;padding:14px;color:#64748b;font-size:0.82rem;background:#0f172a;border-radius:8px"><i class="fas fa-info-circle" style="margin-right:6px"></i>Нет услуг. Нажмите «Добавить» чтобы выбрать из калькулятора.</div>';
      }
      h += '</div></div>';

      // --- 5. ARTICLES — collapsible, loaded dynamically, with total shown ---
      h += '<div id="articles-' + l.id + '"><div style="margin-top:10px;border-top:1px solid #334155;padding-top:10px;text-align:center"><span class="spinner" style="width:16px;height:16px"></span><span style="font-size:0.82rem;color:#64748b;margin-left:8px">Загрузка артикулов...</span></div></div>';

      // --- 6. COMMENTS ---
      h += '<div id="comments-' + l.id + '"></div>';

      // --- 7. PDF BUTTONS + SAVE (at the very bottom) ---
      h += '<div style="margin-top:14px;border-top:1px solid #334155;padding-top:14px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" style="padding:10px 20px;font-size:0.88rem" onclick="generateLeadKP(' + l.id + ')"><i class="fas fa-file-pdf" style="margin-right:6px"></i>Сгенерировать PDF (КП)</button>' +
        (isCalc ? '<a href="/pdf/' + l.id + '" target="_blank" class="btn btn-outline" style="padding:10px 20px;font-size:0.88rem;text-decoration:none"><i class="fas fa-external-link-alt" style="margin-right:6px"></i>Открыть PDF</a>' : '') +
        '</div>' +
        '<button class="btn btn-success" style="padding:10px 24px;font-size:0.88rem" onclick="saveLeadAll(' + l.id + ')"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить все изменения</button></div>';

      h += '</div>'; // end lead-detail
      h += '</div>'; // end card
    }
  }
  h += '<div id="createLeadModalArea"></div>';
  h += '</div>';
  return h;
}

// Create lead modal — simplified: name, contact, language, notes
function showCreateLeadModal() {
  var h = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="this.remove()">' +
    '<div class="card" style="width:500px;max-width:95vw;max-height:90vh;overflow:auto" onclick="event.stopPropagation()">' +
    '<h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px"><i class="fas fa-user-plus" style="color:#8B5CF6;margin-right:8px"></i>Новый лид</h3>' +
    '<form onsubmit="submitCreateLead(event)">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Имя *</label><input class="input" id="nl_name" required></div>' +
      '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Контакт *</label><input class="input" id="nl_contact" required placeholder="+374..."></div></div>' +
    '<div style="margin-bottom:12px"><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Язык (для PDF)</label>' +
    '<select class="input" id="nl_lang" style="width:100%"><option value="ru">🇷🇺 Русский</option><option value="am">🇦🇲 Армянский</option></select></div>' +
    '<div style="margin-bottom:12px"><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Заметка</label><textarea class="input" id="nl_message" rows="3" placeholder="Дополнительная информация..."></textarea></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn-outline" onclick="this.closest(\\'[style*=fixed]\\').remove()">Отмена</button><button type="submit" class="btn btn-primary"><i class="fas fa-check" style="margin-right:6px"></i>Создать</button></div>' +
    '</form></div></div>';
  var area = document.getElementById('createLeadModalArea');
  if (area) area.innerHTML = h;
  else document.body.insertAdjacentHTML('beforeend', h);
  var nameEl = document.getElementById('nl_name');
  if (nameEl) nameEl.focus();
}

async function submitCreateLead(e) {
  e.preventDefault();
  await api('/leads', { method:'POST', body: JSON.stringify({
    name: document.getElementById('nl_name').value.trim(),
    contact: document.getElementById('nl_contact').value.trim(),
    message: document.getElementById('nl_message').value.trim(),
    lang: document.getElementById('nl_lang').value,
    source: 'manual'
  }) });
  toast('Лид создан');
  var modal = document.querySelector('[style*="fixed"][style*="z-index:999"]');
  if (modal) modal.remove();
  await loadData(); render();
}

async function saveLeadNotes(id) {
  var el = document.getElementById('lead-notes-' + id);
  if (!el) return;
  await api('/leads/' + id, { method:'PUT', body: JSON.stringify({ notes: el.value }) });
  var lead = ((data.leads && data.leads.leads)||[]).find(function(x) { return x.id === id; });
  if (lead) lead.notes = el.value;
  toast('Заметка сохранена');
}

function getAssigneeName(id) {
  var u = (data.users||[]).find(function(x) { return x.id == id; });
  return u ? u.display_name : '—';
}

function setLeadsFilter(key, val) {
  leadsFilter[key] = val;
  render();
}

function resetLeadsFilter() {
  leadsFilter = { status: 'all', source: 'all', search: '', assignee: 'all' };
  render();
}

async function loadLeadsData() {
  var res = await api('/leads?limit=500');
  data.leads = res || { leads: [], total: 0 };
  toast('Данные обновлены');
  render();
}

async function updateLeadStatus(id, status) {
  await api('/leads/' + id, { method: 'PUT', body: JSON.stringify({ status: status }) });
  var lead = ((data.leads && data.leads.leads)||[]).find(function(x) { return x.id === id; });
  if (lead) lead.status = status;
  toast('Статус обновлён');
}

async function assignLead(id, userId) {
  await api('/leads/' + id, { method: 'PUT', body: JSON.stringify({ assigned_to: userId ? Number(userId) : null }) });
  var lead = ((data.leads && data.leads.leads)||[]).find(function(x) { return x.id === id; });
  if (lead) lead.assigned_to = userId ? Number(userId) : null;
  toast('Ответственный назначен');
}

async function deleteLead(id) {
  if (!confirm('Удалить эту заявку?')) return;
  await api('/leads/' + id, { method: 'DELETE' });
  toast('Заявка удалена');
  await loadData(); render();
}

async function exportLeadsCSV() {
  var token = localStorage.getItem('admin_token') || '';
  try {
    // Use window.open for maximum device compatibility (iOS Safari, Android, etc.)
    window.open('/api/admin/leads/export?token=' + encodeURIComponent(token), '_blank');
    toast('CSV экспорт запущен');
  } catch(e) { toast('Ошибка экспорта', 'error'); }
}

// ===== LEAD COMMENTS =====
async function loadComments(leadId) {
  const res = await api('/leads/' + leadId + '/comments');
  data.leadComments[leadId] = res || [];
  renderCommentSection(leadId);
}

function renderCommentSection(leadId) {
  const el = document.getElementById('comments-' + leadId);
  if (!el) return;
  const comments = data.leadComments[leadId] || [];
  let h = '<div style="margin-top:12px;border-top:1px solid #334155;padding-top:12px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
    '<span style="font-size:0.82rem;font-weight:700;color:#a78bfa"><i class="fas fa-comments" style="margin-right:6px"></i>Комментарии (' + comments.length + ')</span></div>';
  for (var ci = 0; ci < comments.length; ci++) {
    var cm = comments[ci];
    h += '<div style="padding:8px 12px;background:#0f172a;border-radius:8px;margin-bottom:6px;border-left:3px solid #8B5CF6">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
        '<span style="font-size:0.78rem;font-weight:600;color:#a78bfa">' + escHtml(cm.user_name) + '</span>' +
        '<div style="display:flex;gap:8px;align-items:center"><span style="font-size:0.7rem;color:#64748b">' + formatArmTime(cm.created_at) + '</span>' +
        '<button style="background:none;border:none;color:#EF4444;cursor:pointer;font-size:0.7rem;padding:2px" onclick="deleteComment(' + cm.id + ',' + leadId + ')"><i class="fas fa-times"></i></button></div></div>' +
      '<div style="font-size:0.85rem;color:#e2e8f0;white-space:pre-wrap">' + escHtml(cm.comment) + '</div></div>';
  }
  h += '<div style="display:flex;gap:8px;margin-top:8px">' +
    '<input class="input" style="flex:1;padding:8px 12px;font-size:0.82rem" id="newComment-' + leadId + '" placeholder="Написать комментарий..." onkeydown="if(event.key===\\'Enter\\')addComment(' + leadId + ')">' +
    '<button class="btn btn-primary" style="padding:8px 14px;font-size:0.82rem;white-space:nowrap" onclick="addComment(' + leadId + ')"><i class="fas fa-paper-plane"></i></button>' +
  '</div></div>';
  el.innerHTML = h;
}

async function addComment(leadId) {
  var input = document.getElementById('newComment-' + leadId);
  if (!input || !input.value.trim()) return;
  await api('/leads/' + leadId + '/comments', { method:'POST', body: JSON.stringify({ comment: input.value.trim() }) });
  input.value = '';
  toast('Комментарий добавлен');
  await loadComments(leadId);
}

async function deleteComment(commentId, leadId) {
  await api('/leads/comments/' + commentId, { method:'DELETE' });
  toast('Удалено');
  await loadComments(leadId);
}

function openLeadDetail(id) {
  var el = document.getElementById('lead-detail-' + id);
  var arrow = document.getElementById('lead-arrow-' + id);
  if (!el) return;
  // Only OPEN, never close from card click
  if (el.style.display === 'none') {
    el.style.display = 'block';
    if (arrow) arrow.style.transform = 'rotate(180deg)';
    if (data.leadArticles[id]) {
      renderArticlesSection(id);
    } else {
      loadArticles(id);
    }
  }
}

function closeLeadDetail(id) {
  var el = document.getElementById('lead-detail-' + id);
  var arrow = document.getElementById('lead-arrow-' + id);
  if (!el) return;
  if (el.style.display === 'none') {
    // If closed, open it (arrow click should also open)
    el.style.display = 'block';
    if (arrow) arrow.style.transform = 'rotate(180deg)';
    if (data.leadArticles[id]) {
      renderArticlesSection(id);
    } else {
      loadArticles(id);
    }
  } else {
    // If open, close it
    el.style.display = 'none';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  }
}

function handleCardClick(e, id) {
  // Only toggle if click target is a neutral element (not interactive)
  var tag = e.target.tagName;
  if (tag === 'SELECT' || tag === 'OPTION' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') return;
  // Also check parent and grandparent — icon inside a button/link
  var parent = e.target.parentElement;
  if (parent && (parent.tagName === 'BUTTON' || parent.tagName === 'A' || parent.tagName === 'SELECT')) return;
  var gp = parent ? parent.parentElement : null;
  if (gp && (gp.tagName === 'BUTTON' || gp.tagName === 'A')) return;
  // Check if click is inside the detail area (expanded content) — don't close from there
  var detail = document.getElementById('lead-detail-' + id);
  if (detail && detail.style.display !== 'none' && detail.contains(e.target)) return;
  // Toggle: if closed => open; if open => close
  closeLeadDetail(id);
}

function toggleLeadExpand(id) { closeLeadDetail(id); }

function toggleSection(bodyId, arrowId) {
  var body = document.getElementById(bodyId);
  var arrow = document.getElementById(arrowId);
  if (!body) return;
  if (body.style.display === 'none') {
    body.style.display = 'block';
    if (arrow) arrow.style.transform = 'rotate(90deg)';
  } else {
    body.style.display = 'none';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  }
}

// ===== LEAD ARTICLES (WB артикулы) =====
var articleStatusLabels = { pending:'⏳ Ожидает', ordered:'📦 Заказан', shipped:'🚚 Отправлен', delivered:'✅ Доставлен', completed:'🏁 Завершён', cancelled:'❌ Отменён', returned:'↩️ Возврат' };
var articleStatusColors = { pending:'#F59E0B', ordered:'#3B82F6', shipped:'#06B6D4', delivered:'#10B981', completed:'#8B5CF6', cancelled:'#EF4444', returned:'#94a3b8' };

async function loadArticles(leadId) {
  const res = await api('/leads/' + leadId + '/articles');
  data.leadArticles[leadId] = (res && res.articles) ? res.articles : [];
  renderArticlesSection(leadId);
}

function renderArticlesSection(leadId) {
  var el = document.getElementById('articles-' + leadId);
  if (!el) return;
  var articles = data.leadArticles[leadId] || [];
  var totalSum = 0;
  for (var ti = 0; ti < articles.length; ti++) { totalSum += Number(articles[ti].total_price || 0); }
  var h = '<div style="margin-top:12px;border-top:1px solid #334155;padding-top:12px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleSection(\\'art-body-' + leadId + '\\',\\'art-arrow-' + leadId + '\\')">' +
    '<span style="font-size:0.85rem;font-weight:700;color:#fb923c"><i class="fas fa-box" style="margin-right:6px"></i>Артикулы WB (' + articles.length + ') — <span style="color:#F59E0B">' + Number(totalSum).toLocaleString('ru-RU') + '&nbsp;֏</span></span>' +
    '<div style="display:flex;align-items:center;gap:8px"><button class="btn btn-primary" style="padding:4px 12px;font-size:0.78rem" onclick="event.stopPropagation();showArticleModal(' + leadId + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button>' +
    '<i id="art-arrow-' + leadId + '" class="fas fa-chevron-right" style="color:#64748b;transition:transform 0.2s;font-size:0.75rem"></i></div></div>';
  h += '<div id="art-body-' + leadId + '" style="display:none;margin-top:8px">';
  if (articles.length === 0) {
    h += '<div style="text-align:center;padding:20px;color:#64748b;font-size:0.82rem"><i class="fas fa-inbox" style="margin-right:6px"></i>Нет артикулов. Добавьте первый.</div>';
  } else {
    // Table header
    h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.8rem;margin-bottom:8px">' +
      '<thead><tr style="background:#1e293b">' +
      '<th style="padding:6px 8px;color:#94a3b8;font-weight:600;text-align:left;white-space:nowrap">Артикул</th>' +
      '<th style="padding:6px 8px;color:#94a3b8;font-weight:600;text-align:left">Ключ. слово</th>' +
      '<th style="padding:6px 8px;color:#94a3b8;font-weight:600;text-align:center">Размер</th>' +
      '<th style="padding:6px 8px;color:#94a3b8;font-weight:600;text-align:center">Цвет</th>' +
      '<th style="padding:6px 8px;color:#94a3b8;font-weight:600;text-align:center">Кол-во</th>' +
      '<th style="padding:6px 8px;color:#94a3b8;font-weight:600;text-align:right">Цена</th>' +
      '<th style="padding:6px 8px;color:#94a3b8;font-weight:600;text-align:right">Сумма</th>' +
      '<th style="padding:6px 8px;color:#94a3b8;font-weight:600;text-align:center"></th>' +
      '</tr></thead><tbody>';
    for (var ai = 0; ai < articles.length; ai++) {
      var art = articles[ai];
      var artColor = articleStatusColors[art.status] || '#94a3b8';
      h += '<tr style="border-bottom:1px solid #334155">' +
        '<td style="padding:6px 8px">' +
          (art.wb_link ? '<a href="' + escHtml(art.wb_link) + '" target="_blank" style="color:#a78bfa;text-decoration:none;font-weight:700">' + escHtml(art.wb_article || '—') + ' <i class="fas fa-external-link-alt" style="font-size:0.6rem"></i></a>' : '<span style="color:#e2e8f0;font-weight:700">' + escHtml(art.wb_article || '—') + '</span>') +
        '</td>' +
        '<td style="padding:6px 8px;color:#e2e8f0;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(art.product_name || '—') + '</td>' +
        '<td style="padding:6px 8px;text-align:center;color:#94a3b8">' + escHtml(art.size || '—') + '</td>' +
        '<td style="padding:6px 8px;text-align:center;color:#94a3b8">' + escHtml(art.color || '—') + '</td>' +
        '<td style="padding:6px 8px;text-align:center;color:#e2e8f0;font-weight:600">' + (art.quantity || 1) + '</td>' +
        '<td style="padding:6px 8px;text-align:right;color:#94a3b8;white-space:nowrap">' + Number(art.price_per_unit||0).toLocaleString('ru-RU') + '&nbsp;֏</td>' +
        '<td style="padding:6px 8px;text-align:right;color:#a78bfa;font-weight:600;white-space:nowrap">' + Number(art.total_price||0).toLocaleString('ru-RU') + '&nbsp;֏</td>' +
        '<td style="padding:6px 8px;text-align:center;white-space:nowrap">' +
          '<button style="background:none;border:none;color:#a78bfa;cursor:pointer;font-size:0.75rem;padding:2px 4px" onclick="showArticleModal(' + leadId + ',' + art.id + ')" title="Редактировать"><i class="fas fa-edit"></i></button>' +
          '<button style="background:none;border:none;color:#EF4444;cursor:pointer;font-size:0.75rem;padding:2px 4px" onclick="deleteArticle(' + art.id + ',' + leadId + ')" title="Удалить"><i class="fas fa-trash"></i></button>' +
        '</td></tr>';
      // Show notes if any
      if (art.notes) {
        h += '<tr style="border-bottom:1px solid #1e293b"><td colspan="7" style="padding:2px 8px 6px 8px;font-size:0.72rem;color:#64748b;font-style:italic"><i class="fas fa-sticky-note" style="margin-right:4px;color:#fbbf24"></i>' + escHtml(art.notes) + '</td></tr>';
      }
    }
    h += '</tbody>' +
      '<tfoot><tr style="background:rgba(139,92,246,0.1)"><td colspan="5" style="padding:8px;text-align:right;font-weight:700;color:#94a3b8">ИТОГО артикулы:</td>' +
      '<td colspan="2" style="padding:8px;text-align:right;font-weight:900;color:#8B5CF6;font-size:0.9rem;white-space:nowrap">' + Number(totalSum).toLocaleString('ru-RU') + '&nbsp;֏</td>' +
      '</tr></tfoot></table></div>';
  }
  h += '</div></div>';
  el.innerHTML = h;
}

function showArticleModal(leadId, articleId) {
  var art = null;
  if (articleId && data.leadArticles[leadId]) {
    art = data.leadArticles[leadId].find(function(a) { return a.id === articleId; });
  }
  var isEdit = !!art;
  var h = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="this.remove()">' +
    '<div class="card" style="width:650px;max-width:95vw;max-height:90vh;overflow:auto" onclick="event.stopPropagation()">' +
    '<h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px"><i class="fas fa-box" style="color:#fb923c;margin-right:8px"></i>' + (isEdit ? 'Редактировать артикул' : 'Добавить артикул WB') + '</h3>' +
    '<form onsubmit="submitArticle(event,' + leadId + ',' + (articleId || 0) + ')">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Артикул WB *</label><input class="input" id="art_wb_article" required value="' + escHtml((art && art.wb_article) || '') + '" placeholder="123456789"></div>' +
      '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Ссылка WB</label><input class="input" id="art_wb_link" value="' + escHtml((art && art.wb_link) || '') + '" placeholder="https://www.wildberries.ru/catalog/..."></div></div>' +
    '<div style="margin-bottom:12px"><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Ключевое слово</label><input class="input" id="art_product_name" value="' + escHtml((art && art.product_name) || '') + '" placeholder="Например: кроссовки Nike Air Max"></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Размер</label><input class="input" id="art_size" value="' + escHtml((art && art.size) || '') + '" placeholder="42"></div>' +
      '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Цвет</label><input class="input" id="art_color" value="' + escHtml((art && art.color) || '') + '" placeholder="Чёрный"></div>' +
      '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Кол-во *</label><input class="input" type="number" min="1" id="art_quantity" value="' + ((art && art.quantity) || 1) + '" required onchange="calcArticleTotal()"></div>' +
      '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Цена за шт (֏)</label><input class="input" type="number" min="0" id="art_price" value="' + ((art && art.price_per_unit) || 0) + '" onchange="calcArticleTotal()"></div></div>' +
    '<div style="display:grid;grid-template-columns:' + (isEdit ? '1fr 1fr 1fr' : '1fr 1fr') + ';gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Сумма (֏)</label><input class="input" id="art_total" value="' + ((art && art.total_price) || 0) + '" readonly style="background:#1e293b;color:#a78bfa;font-weight:700"></div>' +
      (isEdit ? '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Статус</label><select class="input" id="art_status">' : '');
  if (isEdit) {
    for (var sk in articleStatusLabels) {
      h += '<option value="' + sk + '"' + ((art && art.status === sk) ? ' selected' : '') + '>' + articleStatusLabels[sk] + '</option>';
    }
  }
  h += (isEdit ? '</select></div>' : '') +
      '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Выкупщик</label><select class="input" id="art_buyer"><option value="">— Не назначен —</option>';
  for (var bk = 0; bk < (data.users||[]).length; bk++) {
    var ub = data.users[bk];
    h += '<option value="' + ub.id + '"' + ((art && art.buyer_id==ub.id)?' selected':'') + '>' + escHtml(ub.display_name) + '</option>';
  }
  h += '</select></div></div>' +
    '<div style="margin-bottom:12px"><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Примечание</label><textarea class="input" id="art_notes" rows="2" placeholder="Особые пожелания клиента...">' + escHtml((art && art.notes) || '') + '</textarea></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn-outline" onclick="this.closest(\\'[style*=fixed]\\').remove()">Отмена</button><button type="submit" class="btn btn-primary"><i class="fas fa-check" style="margin-right:6px"></i>' + (isEdit ? 'Сохранить' : 'Добавить') + '</button></div>' +
    '</form></div></div>';
  document.body.insertAdjacentHTML('beforeend', h);
  document.getElementById('art_wb_article').focus();
  calcArticleTotal();
}

function calcArticleTotal() {
  var q = parseInt(document.getElementById('art_quantity').value) || 1;
  var p = parseFloat(document.getElementById('art_price').value) || 0;
  var totalEl = document.getElementById('art_total');
  if (totalEl) totalEl.value = (q * p).toFixed(0);
}

async function submitArticle(e, leadId, articleId) {
  e.preventDefault();
  var payload = {
    wb_article: document.getElementById('art_wb_article').value.trim(),
    wb_link: document.getElementById('art_wb_link').value.trim(),
    product_name: document.getElementById('art_product_name').value.trim(),
    size: document.getElementById('art_size').value.trim(),
    color: document.getElementById('art_color').value.trim(),
    quantity: parseInt(document.getElementById('art_quantity').value) || 1,
    price_per_unit: parseFloat(document.getElementById('art_price').value) || 0,
    status: document.getElementById('art_status') ? document.getElementById('art_status').value : 'pending',
    buyer_id: document.getElementById('art_buyer').value ? Number(document.getElementById('art_buyer').value) : null,
    notes: document.getElementById('art_notes').value.trim()
  };
  if (articleId) {
    await api('/leads/articles/' + articleId, { method: 'PUT', body: JSON.stringify(payload) });
    toast('Артикул обновлён');
  } else {
    await api('/leads/' + leadId + '/articles', { method: 'POST', body: JSON.stringify(payload) });
    toast('Артикул добавлен');
  }
  var modal = document.querySelector('[style*="fixed"][style*="z-index:999"]');
  if (modal) modal.remove();
  await loadArticles(leadId);
  // Update lead data to refresh articles count badge
  var resLeads = await api('/leads?limit=500');
  data.leads = resLeads || { leads: [], total: 0 };
}

async function updateArticleStatus(articleId, leadId, status) {
  await api('/leads/articles/' + articleId, { method: 'PUT', body: JSON.stringify({ status: status }) });
  toast('Статус артикула обновлён');
  await loadArticles(leadId);
  var resLeads = await api('/leads?limit=500');
  data.leads = resLeads || { leads: [], total: 0 };
}

async function updateArticleBuyer(articleId, leadId, buyerId) {
  await api('/leads/articles/' + articleId, { method: 'PUT', body: JSON.stringify({ buyer_id: buyerId ? Number(buyerId) : null }) });
  toast('Выкупщик назначен');
  await loadArticles(leadId);
}

async function deleteArticle(articleId, leadId) {
  if (!confirm('Удалить этот артикул?')) return;
  await api('/leads/articles/' + articleId, { method: 'DELETE' });
  toast('Артикул удалён');
  await loadArticles(leadId);
  var resLeads = await api('/leads?limit=500');
  data.leads = resLeads || { leads: [], total: 0 };
}

async function recalcLeadTotal(leadId) {
  var res = await api('/leads/' + leadId + '/recalc', { method: 'POST' });
  if (res && res.success) {
    toast('Сумма лида обновлена: ' + Number(res.total_amount).toLocaleString('ru-RU') + ' ֏');
    // Refresh leads data to show new total
    var resLeads = await api('/leads?limit=500');
    data.leads = resLeads || { leads: [], total: 0 };
    render();
    // Re-expand and reload articles
    setTimeout(function() {
      var el = document.getElementById('lead-detail-' + leadId);
      if (el) { el.style.display = 'block'; loadArticles(leadId); }
    }, 100);
  } else {
    toast('Ошибка пересчёта', 'error');
  }
}

// Save lead name
async function saveLeadName(leadId) {
  var nameEl = document.getElementById('lead-name-' + leadId);
  if (!nameEl) return;
  await api('/leads/' + leadId, { method:'PUT', body: JSON.stringify({ name: nameEl.value }) });
  var lead = ((data.leads && data.leads.leads)||[]).find(function(x) { return x.id === leadId; });
  if (lead) lead.name = nameEl.value;
  toast('Имя лида обновлено');
}

// ===== LEAD CALCULATOR MODAL (select services from DB) =====
var _leadCalcSelected = {};
function showLeadCalcModal(leadId) {
  _leadCalcSelected = {};
  var tabs = data.calcTabs || [];
  var services = data.calcServices || [];
  var h = '<div id="leadCalcModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="this.remove()">' +
    '<div class="card" style="width:750px;max-width:95vw;max-height:90vh;overflow:auto" onclick="event.stopPropagation()">' +
    '<h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px"><i class="fas fa-calculator" style="color:#8B5CF6;margin-right:8px"></i>Выбрать услуги для лида #' + leadId + '</h3>';

  if (tabs.length === 0) {
    h += '<div style="text-align:center;padding:24px;color:#64748b"><i class="fas fa-inbox" style="font-size:2rem;margin-bottom:12px;display:block"></i>Нет услуг в калькуляторе.</div>';
  } else {
    h += '<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">';
    for (var ti = 0; ti < tabs.length; ti++) {
      h += '<button class="tab-btn' + (ti === 0 ? ' active' : '') + '" onclick="switchLeadCalcTab(this,' + tabs[ti].id + ')">' + escHtml(tabs[ti].name_ru) + '</button>';
    }
    h += '</div>';
    for (var ti2 = 0; ti2 < tabs.length; ti2++) {
      var tab = tabs[ti2];
      var tabServices = services.filter(function(s) { return s.tab_id === tab.id; });
      h += '<div class="lead-calc-tab" data-tab-id="' + tab.id + '" style="' + (ti2 > 0 ? 'display:none' : '') + '">';
      if (tabServices.length === 0) {
        h += '<p style="color:#64748b;font-size:0.85rem">Нет услуг в этом разделе.</p>';
      } else {
        for (var si = 0; si < tabServices.length; si++) {
          var svc = tabServices[si];
          var isTiered = svc.price_type === 'tiered' && svc.price_tiers_json;
          var tiers = [];
          if (isTiered) { try { tiers = JSON.parse(svc.price_tiers_json); } catch(e) { tiers = []; } }
          var defaultPrice = svc.price || 0;
          h += '<div id="lc_row_' + svc.id + '" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;margin-bottom:6px;flex-wrap:wrap;transition:border-color 0.2s">' +
            '<input type="checkbox" id="lc_check_' + svc.id + '" style="accent-color:#8B5CF6;width:18px;height:18px;cursor:pointer" onchange="toggleLeadCalcSvc(' + svc.id + ')">' +
            '<div style="flex:1;min-width:180px"><div style="font-weight:600;color:#e2e8f0;font-size:0.88rem">' + escHtml(svc.name_ru) + '</div>' +
            (isTiered ? '<div style="font-size:0.72rem;color:#a78bfa">' + tiers.map(function(t){return t.min+'-'+t.max+': '+t.price+' ֏';}).join(' | ') + '</div>' : '<div style="font-size:0.72rem;color:#94a3b8">' + defaultPrice + ' ֏</div>') +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:6px">' +
              '<label style="font-size:0.75rem;color:#94a3b8">Кол-во:</label>' +
              '<input type="number" class="input" min="1" value="1" style="width:70px;padding:4px 8px;font-size:0.85rem" id="lc_qty_' + svc.id + '" onchange="updateLeadCalcPrice(' + svc.id + ',' + defaultPrice + ',' + (isTiered ? '1' : '0') + ');toggleLeadCalcSvc(' + svc.id + ',true)">' +
            '</div>' +
            '<div style="min-width:80px;text-align:right"><span id="lc_price_' + svc.id + '" style="font-weight:700;color:#a78bfa">' + defaultPrice + ' ֏</span></div>' +
          '</div>';
        }
      }
      h += '</div>';
    }
  }
  h += '<div style="margin-top:16px;padding-top:16px;border-top:1px solid #334155">' +
    '<div id="lc_selected_summary" style="font-size:0.85rem;color:#94a3b8;margin-bottom:12px">Выберите услуги галочкой ☑ и нажмите «Добавить выбранные»</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
    '<button class="btn btn-outline" onclick="this.closest(\\'[style*=fixed]\\').remove()">Закрыть</button>' +
    '<button class="btn btn-success" style="padding:10px 24px;font-size:0.9rem" onclick="addSelectedServicesToLead(' + leadId + ')"><i class="fas fa-check" style="margin-right:6px"></i>Добавить выбранные (<span id="lc_sel_count">0</span>)</button>' +
    '</div></div>';
  h += '</div></div>';
  document.body.insertAdjacentHTML('beforeend', h);
}

function toggleLeadCalcSvc(svcId, forceCheck) {
  var cb = document.getElementById('lc_check_' + svcId);
  if (!cb) return;
  if (forceCheck) cb.checked = true;
  var qtyEl = document.getElementById('lc_qty_' + svcId);
  var qty = qtyEl ? (parseInt(qtyEl.value) || 1) : 1;
  if (cb.checked) { _leadCalcSelected[svcId] = qty; } else { delete _leadCalcSelected[svcId]; }
  var row = document.getElementById('lc_row_' + svcId);
  if (row) row.style.borderColor = cb.checked ? '#8B5CF6' : '#334155';
  var keys = Object.keys(_leadCalcSelected);
  var countEl = document.getElementById('lc_sel_count');
  if (countEl) countEl.textContent = keys.length;
  var summaryEl = document.getElementById('lc_selected_summary');
  if (summaryEl) {
    if (keys.length === 0) { summaryEl.innerHTML = 'Выберите услуги галочкой ☑ и нажмите «Добавить выбранные»'; }
    else {
      var names = keys.map(function(k) { var s = data.calcServices.find(function(x){return x.id==k;}); return s ? s.name_ru : '?'; });
      summaryEl.innerHTML = '<i class="fas fa-check-circle" style="color:#10B981;margin-right:4px"></i>Выбрано: <strong>' + names.join(', ') + '</strong>';
    }
  }
}

async function addSelectedServicesToLead(leadId) {
  var keys = Object.keys(_leadCalcSelected);
  if (keys.length === 0) { toast('Выберите хотя бы одну услугу', 'error'); return; }
  var lead = ((data.leads && data.leads.leads)||[]).find(function(x) { return x.id === leadId; });
  var calcData = { items: [], total: 0 };
  if (lead && lead.calc_data) { try { calcData = JSON.parse(lead.calc_data); } catch(e) { calcData = { items: [], total: 0 }; } }
  if (!calcData.items) calcData.items = [];
  for (var ki = 0; ki < keys.length; ki++) {
    var svcId = parseInt(keys[ki]);
    var svc = data.calcServices.find(function(s) { return s.id === svcId; });
    if (!svc) continue;
    var qty = _leadCalcSelected[keys[ki]] || 1;
    var price = svc.price || 0;
    if (svc.price_type === 'tiered' && svc.price_tiers_json) {
      try { var tiers = JSON.parse(svc.price_tiers_json); for (var ti3 = 0; ti3 < tiers.length; ti3++) { if (qty >= tiers[ti3].min && qty <= tiers[ti3].max) { price = tiers[ti3].price; break; } } } catch(e) {}
    }
    calcData.items.push({ name: svc.name_ru, qty: qty, price: price, subtotal: price * qty });
  }
  var newTotal = 0;
  for (var j = 0; j < calcData.items.length; j++) { newTotal += Number(calcData.items[j].subtotal || 0); }
  calcData.total = newTotal;
  await api('/leads/' + leadId, { method:'PUT', body: JSON.stringify({ calc_data: JSON.stringify(calcData), total_amount: newTotal }) });
  if (lead) { lead.calc_data = JSON.stringify(calcData); lead.total_amount = newTotal; }
  toast(keys.length + ' услуг(а) добавлено');
  _leadCalcSelected = {};
  var modal = document.getElementById('leadCalcModal');
  if (modal) modal.remove();
  var resLeads = await api('/leads?limit=500');
  data.leads = resLeads || { leads: [], total: 0 };
  render();
  setTimeout(function() {
    var el = document.getElementById('lead-detail-' + leadId);
    if (el) { el.style.display = 'block'; loadArticles(leadId); }
  }, 100);
}

function switchLeadCalcTab(btn, tabId) {
  // Switch active tab button
  var buttons = btn.parentElement.querySelectorAll('.tab-btn');
  for (var i = 0; i < buttons.length; i++) buttons[i].className = 'tab-btn';
  btn.className = 'tab-btn active';
  // Switch visible tab content
  var tabs = document.querySelectorAll('.lead-calc-tab');
  for (var j = 0; j < tabs.length; j++) {
    tabs[j].style.display = tabs[j].dataset.tabId == tabId ? 'block' : 'none';
  }
}

function updateLeadCalcPrice(svcId, defaultPrice, isTiered) {
  var qtyEl = document.getElementById('lc_qty_' + svcId);
  var priceEl = document.getElementById('lc_price_' + svcId);
  if (!qtyEl || !priceEl) return;
  var qty = parseInt(qtyEl.value) || 1;
  var price = defaultPrice;
  if (isTiered) {
    var svc = data.calcServices.find(function(s) { return s.id === svcId; });
    if (svc && svc.price_tiers_json) {
      try {
        var tiers = JSON.parse(svc.price_tiers_json);
        for (var i = 0; i < tiers.length; i++) {
          if (qty >= tiers[i].min && qty <= tiers[i].max) { price = tiers[i].price; break; }
        }
      } catch(e) {}
    }
  }
  priceEl.textContent = (price * qty) + ' ֏';
  if (_leadCalcSelected[svcId] !== undefined) _leadCalcSelected[svcId] = qty;
}

async function removeLeadService(leadId, serviceIndex) {
  var lead = ((data.leads && data.leads.leads)||[]).find(function(x) { return x.id === leadId; });
  if (!lead || !lead.calc_data) return;
  var calcData = { items: [], total: 0 };
  try { calcData = JSON.parse(lead.calc_data); } catch(e) { return; }
  if (!calcData.items) return;
  // Filter to only service items (no wb_article), remove the one at serviceIndex
  var serviceItems = [];
  var otherItems = [];
  for (var i = 0; i < calcData.items.length; i++) {
    if (calcData.items[i].wb_article) otherItems.push(calcData.items[i]);
    else serviceItems.push(calcData.items[i]);
  }
  if (serviceIndex < 0 || serviceIndex >= serviceItems.length) return;
  serviceItems.splice(serviceIndex, 1);
  calcData.items = serviceItems.concat(otherItems);
  // Recalculate total
  var newTotal = 0;
  for (var j = 0; j < calcData.items.length; j++) { newTotal += Number(calcData.items[j].subtotal || 0); }
  calcData.total = newTotal;
  await api('/leads/' + leadId, { method:'PUT', body: JSON.stringify({ calc_data: JSON.stringify(calcData), total_amount: newTotal }) });
  if (lead) { lead.calc_data = JSON.stringify(calcData); lead.total_amount = newTotal; }
  toast('Услуга удалена');
  var resLeads = await api('/leads?limit=500');
  data.leads = resLeads || { leads: [], total: 0 };
  render();
  setTimeout(function() {
    var el = document.getElementById('lead-detail-' + leadId);
    if (el) { el.style.display = 'block'; loadArticles(leadId); }
  }, 100);
}

// Save all lead changes: name + contact + notes + telegram + tz + refund + recalculate total
async function saveLeadAll(leadId) {
  // 1. Save name + contact + notes + telegram_group + tz_link + refund_amount
  var nameEl = document.getElementById('lead-name-' + leadId);
  var contactEl = document.getElementById('lead-contact-' + leadId);
  var notesEl = document.getElementById('lead-notes-' + leadId);
  var tgEl = document.getElementById('lead-tg-' + leadId);
  var tzEl = document.getElementById('lead-tz-' + leadId);
  var refundEl = document.getElementById('lead-refund-' + leadId);
  var updateData = {};
  if (nameEl) updateData.name = nameEl.value;
  if (contactEl) updateData.contact = contactEl.value;
  if (notesEl) updateData.notes = notesEl.value;
  if (tgEl) updateData.telegram_group = tgEl.value;
  if (tzEl) updateData.tz_link = tzEl.value;
  if (refundEl) updateData.refund_amount = parseFloat(refundEl.value) || 0;
  if (Object.keys(updateData).length > 0) {
    await api('/leads/' + leadId, { method:'PUT', body: JSON.stringify(updateData) });
    var lead = ((data.leads && data.leads.leads)||[]).find(function(x) { return x.id === leadId; });
    if (lead) {
      if (nameEl) lead.name = nameEl.value;
      if (contactEl) lead.contact = contactEl.value;
      if (notesEl) lead.notes = notesEl.value;
      if (tgEl) lead.telegram_group = tgEl.value;
      if (tzEl) lead.tz_link = tzEl.value;
      if (refundEl) lead.refund_amount = parseFloat(refundEl.value) || 0;
    }
  }
  // 2. Recalculate total (articles + services)
  var res = await api('/leads/' + leadId + '/recalc', { method: 'POST' });
  if (res && res.success) {
    toast('Все изменения сохранены. Итого: ' + Number(res.total_amount).toLocaleString('ru-RU') + ' ֏');
  } else {
    toast('Данные сохранены');
  }
  // 3. Refresh
  var resLeads = await api('/leads?limit=500');
  data.leads = resLeads || { leads: [], total: 0 };
  render();
  setTimeout(function() {
    var el = document.getElementById('lead-detail-' + leadId);
    if (el) { el.style.display = 'block'; loadArticles(leadId); }
  }, 100);
}

// Generate KP (PDF) for lead without calculator data
async function generateLeadKP(leadId) {
  toast('Генерация КП...', 'info');
  var res = await api('/leads/' + leadId + '/recalc', { method: 'POST' });
  if (res && res.success) {
    toast('КП создано! Открываю...', 'success');
    var resLeads = await api('/leads?limit=500');
    data.leads = resLeads || { leads: [], total: 0 };
    render();
    window.open('/pdf/' + leadId, '_blank');
  } else {
    toast('Ошибка создания КП', 'error');
  }
}

// ===== BUSINESS ANALYTICS =====
let analyticsDateFrom = '';
let analyticsDateTo = '';
let analyticsData = null;
let bizAnalyticsTab = 'overview';
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
  if (n === null || n === undefined || isNaN(Number(n))) return '0 \u058f';
  var num = Number(n);
  if (Math.abs(num) >= 1e12) return '0 \u058f'; // prevent absurd numbers
  return num.toLocaleString('ru-RU', {maximumFractionDigits: 0}) + '\u00a0\u058f';
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
  var tabs = [
    { id: 'overview', icon: 'fa-chart-pie', label: 'Обзор и Финансы' },
    { id: 'costs', icon: 'fa-wallet', label: 'Затраты и ЗП' },
    { id: 'funnel', icon: 'fa-funnel-dollar', label: 'Воронка и Детали' },
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
    h += '<button class="btn btn-outline" style="padding:6px 14px;font-size:0.8rem" onclick="expandedMonth=\\'\\';analyticsData=null;loadAnalyticsData()"><i class="fas fa-times" style="margin-right:4px"></i>Закрыть</button>';
    h += '</div>';
  }
  // Date filter (hidden when month is expanded)
  if (!expandedMonth) {
    h += '<div class="card" style="padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">';
    h += '<i class="fas fa-calendar" style="color:#8B5CF6"></i><span style="font-weight:600;color:#94a3b8">Период:</span>';
    h += '<input type="date" class="input" style="width:150px;padding:6px 10px" value="' + analyticsDateFrom + '" onchange="analyticsDateFrom=this.value;analyticsData=null;loadAnalyticsData()">';
    h += '<span style="color:#475569">\u2014</span>';
    h += '<input type="date" class="input" style="width:150px;padding:6px 10px" value="' + analyticsDateTo + '" onchange="analyticsDateTo=this.value;analyticsData=null;loadAnalyticsData()">';
    var periods = [{l:'Сегодня',v:'today'},{l:'7 дн',v:'week'},{l:'14 дн',v:'14d'},{l:'30 дн',v:'month'},{l:'90 дн',v:'90d'},{l:'Все',v:'all'}];
    for (var pi = 0; pi < periods.length; pi++) {
      h += '<button class="tab-btn" style="padding:6px 14px;font-size:0.8rem" onclick="setAnalyticsPeriod(\\'' + periods[pi].v + '\\')">' + periods[pi].l + '</button>';
    }
    h += '</div>';
  }
  // Quick KPI strip at top
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px">';
  var quickKpis = [
    {label:'Оборот',val:fmtAmt(fin.turnover),icon:'fa-coins',color:'#8B5CF6',bg:'rgba(139,92,246,0.12)',desc:'Услуги: '+fmtAmt(fin.services)+' | Выкупы: '+fmtAmt(fin.articles)},
    {label:'Чистая прибыль',val:fmtAmt(fin.net_profit),icon:fin.net_profit>=0?'fa-arrow-up':'fa-arrow-down',color:fin.net_profit>=0?'#22C55E':'#EF4444',bg:fin.net_profit>=0?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)',desc:'Усл: '+fmtAmt(fin.services)+' \\u2212 Расх: '+fmtAmt(fin.total_expenses)},
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
    h += '<button class="tab-btn' + (bizAnalyticsTab === t.id ? ' active' : '') + '" onclick="bizAnalyticsTab=\\'' + t.id + '\\';render()" style="padding:10px 20px"><i class="fas ' + t.icon + '" style="margin-right:6px"></i>' + t.label + '</button>';
  }
  h += '</div>';
  // Tab content
  if (bizAnalyticsTab === 'overview') h += renderBizOverviewV2(d, sd, fin);
  else if (bizAnalyticsTab === 'costs') h += renderBizCostsV2(d, sd, fin);
  else if (bizAnalyticsTab === 'funnel') h += renderBizFunnelV2(d, sd, fin);
  else if (bizAnalyticsTab === 'periods') h += renderBizPeriodsV2(d, sd, fin);
  h += '</div>';
  return h;
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
    h += '<div class="card" style="padding:16px;text-align:center;border-left:3px solid ' + st.color + ';cursor:pointer;opacity:' + opacity + '" onclick="navigate(\\'leads\\');setLeadsFilter(\\'status\\',\\'' + st.key + '\\')">';
    h += '<div style="font-size:0.75rem;color:#94a3b8;margin-bottom:4px"><i class="fas ' + st.icon + '" style="color:' + st.color + ';margin-right:4px"></i>' + st.label + '</div>';
    h += '<div style="font-size:1.8rem;font-weight:800;color:' + st.color + '">' + cnt + '</div>';
    h += '<div style="font-size:0.82rem;color:#e2e8f0;margin-top:4px;font-weight:600">' + fmtAmt(amt) + '</div>';
    h += '<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.68rem;color:#475569"><span>\u0423\u0441\u043b: ' + fmtAmt(svcAmt) + '</span><span>\u0417\u0430\u043a: ' + fmtAmt(artAmt) + '</span></div>';
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
  h += '<div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-chart-bar" style="margin-right:4px"></i>\u041e\u0431\u043e\u0440\u043e\u0442 <span style="font-size:0.65rem;color:#64748b">(\u0432 \u0440\u0430\u0431\u043e\u0442\u0435 + \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 + \u0434\u043e\u043d\u0435)</span></div>';
  h += '<div style="font-size:2rem;font-weight:800;color:#a78bfa">' + fmtAmt(turnover) + '</div>';
  if (turnover > 0) {
    var svcPct = Math.round(serviceRev / turnover * 100) || 0;
    h += '<div style="display:flex;height:6px;border-radius:3px;overflow:hidden;margin-top:10px;background:#1e293b">';
    h += '<div style="width:' + svcPct + '%;background:#8B5CF6" title="\u0423\u0441\u043b\u0443\u0433\u0438"></div>';
    h += '<div style="width:' + (100 - svcPct) + '%;background:#F59E0B" title="\u0410\u0440\u0442\u0438\u043a\u0443\u043b\u044b"></div></div>';
    h += '<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.72rem;color:#64748b">';
    h += '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#8B5CF6;margin-right:4px"></span>\u0423\u0441\u043b\u0443\u0433\u0438 ' + fmtAmt(serviceRev) + ' (' + svcPct + '%)</span>';
    h += '<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#F59E0B;margin-right:4px"></span>\u0410\u0440\u0442\u0438\u043a\u0443\u043b\u044b ' + fmtAmt(articlesRev) + ' (' + (100-svcPct) + '%)</span></div>';
  }
  h += '</div>';
  // Net profit
  h += '<div class="card" style="padding:20px;background:linear-gradient(135deg,rgba(' + (netProfit >= 0 ? '34,197,94' : '239,68,68') + ',0.12),transparent);border:1px solid rgba(' + (netProfit >= 0 ? '34,197,94' : '239,68,68') + ',0.3)">';
  h += '<div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-' + (netProfit >= 0 ? 'arrow-up' : 'arrow-down') + '" style="margin-right:4px"></i>\u0427\u0438\u0441\u0442\u0430\u044f \u043f\u0440\u0438\u0431\u044b\u043b\u044c</div>';
  h += '<div style="font-size:2rem;font-weight:800;color:' + profitColor + '">' + fmtAmt(netProfit) + '</div>';
  h += '<div style="font-size:0.72rem;color:#64748b;margin-top:6px">\u0423\u0441\u043b\u0443\u0433\u0438 (' + fmtAmt(serviceRev) + ') \u2212 \u0412\u0441\u0435 \u0440\u0430\u0441\u0445\u043e\u0434\u044b (' + fmtAmt(totalExpenses) + ')</div>';
  h += '</div>';
  // Total expenses
  h += '<div class="card" style="padding:20px;border-left:3px solid #EF4444">';
  h += '<div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-receipt" style="margin-right:4px"></i>\u0412\u0441\u0435 \u0440\u0430\u0441\u0445\u043e\u0434\u044b</div>';
  h += '<div style="font-size:2rem;font-weight:800;color:#f87171">' + fmtAmt(totalExpenses) + '</div>';
  h += '<div style="margin-top:8px;font-size:0.72rem;color:#64748b">';
  h += '\u0417\u041f: ' + fmtAmt(salaryExp + bonusesExp) + ' \u2022 \u041a\u043e\u043c\u043c: ' + fmtAmt(commExp) + ' \u2022 \u041c\u0430\u0440\u043a: ' + fmtAmt(mktExp);
  h += '</div>';
  if (totalExpenses > 0) {
    var sp = Math.round((salaryExp + bonusesExp) / totalExpenses * 100); var cp = Math.round(commExp / totalExpenses * 100);
    h += '<div style="display:flex;height:6px;border-radius:3px;overflow:hidden;margin-top:8px;background:#1e293b">';
    h += '<div style="width:' + sp + '%;background:#3B82F6" title="\u0417\u041f"></div>';
    h += '<div style="width:' + cp + '%;background:#F59E0B" title="\u041a\u043e\u043c\u043c"></div>';
    h += '<div style="flex:1;background:#EF4444" title="\u041c\u0430\u0440\u043a\u0435\u0442"></div></div>';
  }
  h += '</div></div>';

  // Revenue detail row (services vs articles + refunds)
  h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px">';
  h += '<div class="card" style="padding:16px"><div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-concierge-bell" style="margin-right:4px"></i>\u0414\u043e\u0445\u043e\u0434 (\u0443\u0441\u043b\u0443\u0433\u0438)</div><div style="font-size:1.5rem;font-weight:700;color:#8B5CF6">' + fmtAmt(serviceRev) + '</div><div style="font-size:0.65rem;color:#475569;margin-top:4px">\u041c\u043e\u044f \u043f\u0440\u0438\u0431\u044b\u043b\u044c</div></div>';
  h += '<div class="card" style="padding:16px"><div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-shopping-bag" style="margin-right:4px"></i>\u0412\u044b\u043a\u0443\u043f\u044b (\u0430\u0440\u0442\u0438\u043a\u0443\u043b\u044b)</div>';
  h += '<div style="font-size:1.5rem;font-weight:700;color:#F59E0B">' + fmtAmt(articlesRev) + '</div>';
  h += '<div style="font-size:0.65rem;color:#475569;margin-top:4px">\u0414\u0435\u043d\u044c\u0433\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432</div></div>';
  h += '<div class="card" style="padding:16px;border-left:3px solid #EF4444"><div style="font-size:0.8rem;color:#94a3b8;margin-bottom:4px"><i class="fas fa-undo" style="margin-right:4px"></i>\u0412\u043e\u0437\u0432\u0440\u0430\u0442\u044b</div>';
  h += '<div style="font-size:1.5rem;font-weight:700;color:#EF4444">' + (refunds > 0 ? '-' + fmtAmt(refunds) : '0 \u058f') + '</div>';
  h += '<div style="font-size:0.65rem;color:#475569;margin-top:4px">\u0412\u044b\u0447\u0442\u0435\u043d\u043e \u0438\u0437 \u0432\u044b\u043a\u0443\u043f\u043e\u0432</div></div>';
  h += '</div>';
  h += '</div>';

  // ---- SECTION: KPI Metrics ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-tachometer-alt" style="color:#10B981;margin-right:8px"></i>KPI \u043c\u0435\u0442\u0440\u0438\u043a\u0438</h3>';
  var kpis = [
    {label:'\u041a\u043e\u043d\u0432\u0435\u0440\u0441\u0438\u044f',val:fmtPct(fin.conversion_rate),color:Number(fin.conversion_rate)>20?'#22C55E':Number(fin.conversion_rate)>10?'#F59E0B':'#EF4444',icon:'fa-percentage',desc:'Завершённые / Все лиды за период'},
    {label:'\u0421\u0440. \u0447\u0435\u043a (\u0443\u0441\u043b\u0443\u0433\u0438)',val:fmtAmt(fin.avg_check),color:'#8B5CF6',icon:'fa-shopping-cart',desc:'Сумма услуг завершённых / кол-во завершённых (без выкупов)'},
    {label:'\u041c\u0430\u0440\u0436\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u0441\u0442\u044c',val:fmtPct(fin.marginality),color:Number(fin.marginality)>0?'#22C55E':'#EF4444',icon:'fa-percentage',desc:'Прибыль / Доход услуг'},
    {label:'ROI',val:fmtPct(fin.roi),color:Number(fin.roi)>0?'#22C55E':'#EF4444',icon:'fa-chart-line',desc:'Прибыль / Все расходы'},
    {label:'ROMI',val:fmtPct(fin.romi),color:Number(fin.romi)>0?'#22C55E':'#EF4444',icon:'fa-bullhorn',desc:'(Доход услуг \u2212 маркетинг) / маркетинг'},
    {label:'\u0412\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435',val:(Number(fin.avg_fulfillment_days)||0)+' \u0434\u043d',color:'#3B82F6',icon:'fa-clock',desc:'Среднее время выполнения заказа'},
    {label:'Break-even',val:fmtAmt(fin.break_even),color:'#F59E0B',icon:'fa-balance-scale',desc:'Точка безубыточности (= все расходы)'},
    {label:'\u041e\u0442\u043a\u0430\u0437\u044b',val:(fin.totalLeads > 0 ? (((Number((sd.rejected||{}).count)||0) / fin.totalLeads) * 100).toFixed(1) : '0') + '%',color:'#EF4444',icon:'fa-ban',desc:'Отклонённые / Все лиды'}
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

  // ---- SECTION: Status P&L table with exclude checkboxes ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:8px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-table" style="color:#3B82F6;margin-right:8px"></i>\u041e\u0442\u0447\u0451\u0442 \u043f\u043e \u0441\u0442\u0430\u0442\u0443\u0441\u0430\u043c</h3>';
  h += '<div style="font-size:0.72rem;color:#64748b;margin-bottom:12px">Снимите галочку, чтобы исключить статус из расчётов. Исключённые статусы будут затемнены.</div>';
  h += '<div class="card" style="overflow-x:auto;padding:0"><table style="width:100%;border-collapse:collapse;font-size:0.85rem">';
  h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155">';
  h += '<th style="padding:12px 8px;text-align:center;color:#94a3b8;width:40px"><i class="fas fa-check-square" style="font-size:0.7rem"></i></th>';
  h += '<th style="padding:12px 16px;text-align:left;color:#94a3b8">\u0421\u0442\u0430\u0442\u0443\u0441</th><th style="padding:12px;text-align:right;color:#94a3b8">\u041a\u043e\u043b-\u0432\u043e</th><th style="padding:12px;text-align:right;color:#94a3b8">\u0421\u0443\u043c\u043c\u0430</th><th style="padding:12px;text-align:right;color:#94a3b8">\u0423\u0441\u043b\u0443\u0433\u0438</th><th style="padding:12px;text-align:right;color:#94a3b8">\u0412\u044b\u043a\u0443\u043f\u044b</th></tr></thead><tbody>';
  var totalLeads2 = 0; var totalAmt2 = 0; var totalSvc = 0; var totalArt = 0;
  for (var si2 = 0; si2 < statuses.length; si2++) {
    var s2 = statuses[si2]; var rawV2 = (d.status_data || {})[s2.key] || {};
    var isExcl2 = !!excludedStatuses[s2.key];
    var cnt2 = Number(rawV2.count) || 0; var amt2 = Number(rawV2.amount) || 0;
    var svc2 = Number(rawV2.services) || 0; var art2 = Number(rawV2.articles) || 0;
    if (!isExcl2) { totalLeads2 += cnt2; totalAmt2 += amt2; totalSvc += svc2; totalArt += art2; }
    var rowOpacity = isExcl2 ? 'opacity:0.35;' : '';
    h += '<tr style="border-bottom:1px solid #1e293b;' + rowOpacity + '">';
    h += '<td style="padding:10px 8px;text-align:center"><input type="checkbox" ' + (isExcl2 ? '' : 'checked') + ' onchange="toggleExcludeStatus(\\'' + s2.key + '\\',this.checked)" style="cursor:pointer;accent-color:#8B5CF6"></td>';
    h += '<td style="padding:10px 16px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + s2.color + ';margin-right:8px"></span>' + s2.label + '</td>';
    h += '<td style="padding:10px;text-align:right;font-weight:600">' + cnt2 + '</td>';
    h += '<td style="padding:10px;text-align:right;font-weight:600">' + fmtAmt(amt2) + '</td>';
    h += '<td style="padding:10px;text-align:right;color:#8B5CF6">' + fmtAmt(svc2) + '</td>';
    h += '<td style="padding:10px;text-align:right;color:#F59E0B">' + fmtAmt(art2) + '</td></tr>';
  }
  h += '<tr style="border-top:2px solid #8B5CF6;font-weight:700"><td></td><td style="padding:10px 16px">\u0418\u0422\u041e\u0413\u041e (активные)</td><td style="padding:10px;text-align:right">' + totalLeads2 + '</td><td style="padding:10px;text-align:right">' + fmtAmt(totalAmt2) + '</td><td style="padding:10px;text-align:right;color:#8B5CF6">' + fmtAmt(totalSvc) + '</td><td style="padding:10px;text-align:right;color:#F59E0B">' + fmtAmt(totalArt) + '</td></tr>';
  h += '</tbody></table></div>';

  // P&L table
  h += '<div class="card" style="overflow-x:auto;padding:0;margin-top:16px"><table style="width:100%;border-collapse:collapse;font-size:0.85rem">';
  h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:12px 16px;text-align:left;color:#94a3b8" colspan="2">\u041f\u0440\u0438\u0431\u044b\u043b\u0438 \u0438 \u0443\u0431\u044b\u0442\u043a\u0438 (P&L)</th></tr></thead><tbody>';
  var plRows = [
    { label: '\u0414\u043e\u0445\u043e\u0434 (\u0443\u0441\u043b\u0443\u0433\u0438)', value: serviceRev, color: '#10B981', bold: true },
    { label: '\u00a0\u00a0\u0417\u0430\u0440\u043f\u043b\u0430\u0442\u044b + \u0431\u043e\u043d\u0443\u0441\u044b', value: -(salaryExp + bonusesExp), color: '#EF4444' },
    { label: '\u00a0\u00a0\u041a\u043e\u043c\u043c\u0435\u0440\u0447\u0435\u0441\u043a\u0438\u0435 \u0437\u0430\u0442\u0440\u0430\u0442\u044b', value: -commExp, color: '#EF4444' },
    { label: '\u00a0\u00a0\u041c\u0430\u0440\u043a\u0435\u0442\u0438\u043d\u0433 / \u0420\u0435\u043a\u043b\u0430\u043c\u0430', value: -mktExp, color: '#EF4444' },
    { label: '\u0418\u0422\u041e\u0413\u041e \u0440\u0430\u0441\u0445\u043e\u0434\u043e\u0432', value: -totalExpenses, color: '#F97316', bold: true },
    { label: '\u0427\u0418\u0421\u0422\u0410\u042f \u041f\u0420\u0418\u0411\u042b\u041b\u042c', value: netProfit, color: profitColor, bold: true, big: true },
  ];
  for (var pli = 0; pli < plRows.length; pli++) {
    var pr = plRows[pli]; var prVal = Number(pr.value) || 0;
    var prSign = prVal < 0 ? '\u2212 ' : '';
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
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-chart-bar" style="color:#8B5CF6;margin-right:8px"></i>\u0417\u0430\u044f\u0432\u043a\u0438 \u043f\u043e \u0434\u043d\u044f\u043c' + (expandedMonth ? '' : ' (30 \u0434\u043d\u0435\u0439)') + '</h3>';
    // Compute daily average
    var dailyTotalCnt = 0; for (var dti = 0; dti < daily.length; dti++) dailyTotalCnt += Number(daily[dti].count)||0;
    var dailyAvg = daily.length > 0 ? (dailyTotalCnt / daily.length).toFixed(1) : '0';
    h += '<div style="font-size:0.78rem;color:#64748b;margin-bottom:8px">Всего: <strong style="color:#a78bfa">' + dailyTotalCnt + '</strong> заявок \u2022 Среднее/день: <strong style="color:#F59E0B">' + dailyAvg + '</strong></div>';
    h += '<div class="card" style="padding:20px"><div style="display:flex;gap:3px;align-items:flex-end;height:180px">';
    var maxD = Math.max.apply(null, daily.map(function(x){return Number(x.count)||1;}));
    for (var di = 0; di < daily.length; di++) {
      var dd = daily[di]; var dCnt = Number(dd.count) || 0; var barH = Math.max(6, Math.round((dCnt / maxD) * 140));
      var barColor = dCnt > 0 ? (di === daily.length - 1 ? '#8B5CF6' : '#4F46E5') : '#334155';
      var dayNum = (dd.day||'').slice(8);
      h += '<div style="flex:1;text-align:center;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">';
      h += '<div style="font-size:0.58rem;font-weight:700;color:' + (dCnt > 0 ? '#a78bfa' : '#475569') + ';margin-bottom:2px">' + dCnt + '</div>';
      h += '<div style="background:' + barColor + ';width:100%;height:' + barH + 'px;border-radius:3px 3px 0 0;transition:all 0.2s;position:relative" title="' + (dd.day || '') + ': ' + dCnt + ' \u0437\u0430\u044f\u0432\u043e\u043a, ' + fmtAmt(Number(dd.amount)||0) + '"></div>';
      if (daily.length <= 31) h += '<div style="font-size:0.52rem;color:#94a3b8;margin-top:3px;font-weight:600">' + dayNum + '</div>';
      h += '</div>';
    }
    h += '</div>';
    if (daily.length > 31) {
      h += '<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:0.65rem;color:#475569"><span>' + (daily[0]?.day||'').slice(5) + '</span><span>' + (daily[daily.length-1]?.day||'').slice(5) + '</span></div>';
    }
    h += '</div></div>';
  }

  return h;
}

function toggleExcludeStatus(statusKey, checked) {
  if (checked) { delete excludedStatuses[statusKey]; }
  else { excludedStatuses[statusKey] = true; }
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
    h += '<div><label style="font-size:0.72rem;color:#64748b">Сумма (\u058f) *</label><input class="input" id="new-exp-amount" type="number" placeholder="0"></div>';
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
      h += '<td style="padding:8px;text-align:center"><span style="padding:2px 8px;border-radius:10px;font-size:0.72rem;background:' + (exp.category_color||'#475569') + '22;color:' + (exp.category_color||'#94a3b8') + '">' + escHtml(exp.category_name||'\u2014') + '</span></td>';
      h += '<td style="padding:8px;text-align:center;font-size:0.8rem;color:#64748b">' + escHtml(exp.frequency_name||'\u2014') + '</td>';
      h += '<td style="padding:8px;text-align:center;font-size:0.72rem;color:#475569">' + (expDateStr || '\u2014') + '</td>';
      h += '<td style="padding:8px;white-space:nowrap"><button class="btn btn-outline" style="padding:2px 6px;font-size:0.55rem;color:#F59E0B;border-color:#F59E0B33;margin-right:3px" onclick="editingExpenseId=' + exp.id + ';render()" title="Изменить"><i class="fas fa-pencil-alt"></i></button><button class="tier-del-btn" onclick="deleteExpense(' + exp.id + ')"><i class="fas fa-trash" style="font-size:0.55rem"></i></button></td></tr>';
      // Inline edit form for this expense
      if (editingExpenseId === exp.id) {
        h += '<tr><td colspan="6" style="padding:12px 16px;background:#0f172a;border:1px solid #8B5CF6;border-radius:0">';
        h += '<div style="font-weight:700;color:#F59E0B;margin-bottom:10px;font-size:0.85rem"><i class="fas fa-pencil-alt" style="margin-right:4px"></i>Редактирование: ' + escHtml(exp.name) + '</div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">';
        h += '<div><label style="font-size:0.7rem;color:#64748b">Название</label><input class="input" id="edit-exp-name-' + exp.id + '" value="' + escHtml(exp.name||'') + '" style="width:100%;padding:6px 10px"></div>';
        h += '<div><label style="font-size:0.7rem;color:#64748b">Сумма (\u058f)</label><input class="input" id="edit-exp-amount-' + exp.id + '" type="number" value="' + (exp.amount||0) + '" style="width:100%;padding:6px 10px"></div>';
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
  var totalSalary = 0; var totalBonus = 0; var totalFines = 0; var totalNetPay = 0;
  for (var si3 = 0; si3 < employees.length; si3++) {
    var empSal = Number(employees[si3].salary) || 0;
    var empBon = Number(employees[si3].bonuses_total) || 0;
    var empFin = Number(employees[si3].fines_total) || 0;
    totalSalary += empSal; totalBonus += empBon; totalFines += empFin;
    totalNetPay += empSal + empBon + empFin;
  }
  // Summary cards (4 indicators including new one)
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">';
  h += '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:#94a3b8">ФОТ (зарплаты)</div><div style="font-size:1.3rem;font-weight:700;color:#3B82F6">' + fmtAmt(totalSalary) + '</div></div>';
  h += '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:#94a3b8">Бонусы</div><div style="font-size:1.3rem;font-weight:700;color:#22C55E">' + fmtAmt(totalBonus) + '</div></div>';
  h += '<div class="card" style="padding:14px;text-align:center"><div style="font-size:0.75rem;color:#94a3b8">Штрафы</div><div style="font-size:1.3rem;font-weight:700;color:#EF4444">' + fmtAmt(Math.abs(totalFines)) + '</div></div>';
  h += '<div class="card" style="padding:14px;text-align:center;border:1px solid ' + (totalNetPay >= 0 ? '#8B5CF633' : '#EF444433') + '"><div style="font-size:0.75rem;color:#94a3b8">ИТОГО к выплате</div><div style="font-size:1.3rem;font-weight:700;color:' + (totalNetPay >= 0 ? '#a78bfa' : '#EF4444') + '">' + fmtAmt(totalNetPay) + '</div><div style="font-size:0.6rem;color:#475569;margin-top:2px">ЗП + Бонусы \u2212 Штрафы</div></div>';
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
      h += '<td style="padding:10px;color:#94a3b8;font-size:0.8rem">' + escHtml(u.position_title||'\u2014') + '</td>';
      h += '<td style="padding:10px;font-size:0.78rem;color:#64748b">' + (salaryTypeLabels[u.salary_type||'monthly']||(u.salary_type||'monthly')) + '</td>';
      h += '<td style="padding:10px;text-align:right;font-weight:600;color:#3B82F6">' + fmtAmt(uSal) + '</td>';
      h += '<td style="padding:10px;text-align:center;font-size:0.72rem;color:#a78bfa">' + (u.hire_date || '\u2014') + '</td>';
      h += '<td style="padding:10px;text-align:center;font-size:0.72rem;color:' + (u.end_date ? '#f87171' : '#475569') + '">' + (u.end_date || '\u0431\u0435\u0441\u0441\u0440\u043e\u0447\u043d\u043e') + '</td>';
      h += '<td style="padding:10px;text-align:right;font-weight:600;color:#22C55E">' + (uBonus > 0 ? '+' + fmtAmt(uBonus) : '\u2014') + '</td>';
      h += '<td style="padding:10px;text-align:right;font-weight:600;color:#EF4444">' + (uFines < 0 ? '\u2212' + fmtAmt(Math.abs(uFines)) : '\u2014') + '</td>';
      h += '<td style="padding:10px;text-align:right;font-weight:700;color:' + (uNet >= 0 ? '#a78bfa' : '#EF4444') + '">' + fmtAmt(uNet) + '</td>';
      h += '<td style="padding:10px"><div style="display:flex;gap:4px">';
      h += '<button class="btn btn-outline" style="padding:4px 7px;font-size:0.68rem;color:#22C55E;border-color:#22C55E44" onclick="showAddBonusUserId=' + u.id + ';addBonusType=\\'bonus\\';render()" title="Добавить бонус"><i class="fas fa-plus"></i></button>';
      h += '<button class="btn btn-outline" style="padding:4px 7px;font-size:0.68rem;color:#EF4444;border-color:#EF444444" onclick="showAddBonusUserId=' + u.id + ';addBonusType=\\'fine\\';render()" title="Добавить штраф"><i class="fas fa-minus"></i></button>';
      h += '<button class="btn btn-outline" style="padding:4px 7px;font-size:0.68rem;color:#64748b" onclick="toggleBonusList(' + u.id + ')" title="Показать историю"><i class="fas fa-list"></i></button>';
      h += '</div></td></tr>';
      // Bonus/fine form
      if (showAddBonusUserId === u.id) {
        var isFine = (typeof addBonusType !== 'undefined' && addBonusType === 'fine');
        h += '<tr><td colspan="10" style="padding:10px 16px;background:#0f172a"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
        h += '<span style="font-size:0.78rem;font-weight:600;color:' + (isFine ? '#EF4444' : '#22C55E') + '">' + (isFine ? '\u0428\u0442\u0440\u0430\u0444' : '\u0411\u043e\u043d\u0443\u0441') + ':</span>';
        h += '<input class="input" id="bonus-amount-' + u.id + '" type="number" placeholder="Сумма" style="width:120px;padding:6px 10px" min="0">';
        h += '<input class="input" id="bonus-desc-' + u.id + '" placeholder="' + (isFine ? 'Причина штрафа' : 'Описание бонуса') + '" style="flex:1;padding:6px 10px;min-width:120px">';
        h += '<input class="input" id="bonus-date-' + u.id + '" type="date" style="width:140px;padding:6px 10px" required value="' + (new Date().toISOString().slice(0,10)) + '">';
        h += '<button class="btn ' + (isFine ? 'btn-outline' : 'btn-success') + '" style="padding:6px 12px;' + (isFine ? 'color:#EF4444;border-color:#EF4444' : '') + '" onclick="saveBonus(' + u.id + ',\\'' + (isFine ? 'fine' : 'bonus') + '\\')"><i class="fas fa-check"></i></button>';
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
            h += '<td style="padding:5px 16px;color:' + bColor + ';font-weight:600">' + (bType === 'fine' ? '\u0428\u0442\u0440\u0430\u0444' : '\u0411\u043e\u043d\u0443\u0441') + '</td>';
            h += '<td style="padding:5px"><input class="input" id="edit-bonus-desc-' + b.id + '" value="' + escHtml(b.description || '') + '" style="padding:4px 8px;font-size:0.75rem;width:100%"></td>';
            h += '<td style="padding:5px"><input class="input" id="edit-bonus-amt-' + b.id + '" type="number" value="' + Math.abs(bAmt) + '" style="padding:4px 8px;font-size:0.75rem;width:80px;text-align:right" min="0"></td>';
            h += '<td style="padding:5px"><input class="input" id="edit-bonus-date-' + b.id + '" type="date" value="' + (b.bonus_date || '') + '" style="padding:4px 6px;font-size:0.72rem"></td>';
            h += '<td style="padding:5px;text-align:center;white-space:nowrap">';
            h += '<button class="btn btn-success" style="padding:2px 6px;font-size:0.6rem;margin-right:2px" onclick="saveBonusEdit(' + b.id + ',' + u.id + ',\\'' + bType + '\\')" title="\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"><i class="fas fa-check"></i></button>';
            h += '<button class="btn btn-outline" style="padding:2px 6px;font-size:0.6rem" onclick="editingBonusId=0;render()" title="\u041e\u0442\u043c\u0435\u043d\u0430"><i class="fas fa-times"></i></button>';
            h += '</td></tr>';
          } else {
            h += '<tr style="border-bottom:1px solid #1e293b22">';
            h += '<td style="padding:5px 16px;color:' + bColor + ';font-weight:600">' + (bType === 'fine' ? '\u0428\u0442\u0440\u0430\u0444' : '\u0411\u043e\u043d\u0443\u0441') + '</td>';
            h += '<td style="padding:5px;color:#94a3b8">' + escHtml(b.description || '\u2014') + '</td>';
            h += '<td style="padding:5px;text-align:right;font-weight:600;color:' + bColor + '">' + (bAmt < 0 ? '\u2212' : '+') + fmtAmt(Math.abs(bAmt)) + '</td>';
            h += '<td style="padding:5px;text-align:center;color:#64748b">' + (b.bonus_date || '\u2014') + '</td>';
            h += '<td style="padding:5px;text-align:center;white-space:nowrap">';
            h += '<button class="btn btn-outline" style="padding:2px 6px;font-size:0.6rem;color:#F59E0B;border-color:#F59E0B33;margin-right:2px" onclick="editingBonusId=' + b.id + ';render()" title="\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c"><i class="fas fa-pencil-alt"></i></button>';
            h += '<button class="btn btn-outline" style="padding:2px 6px;font-size:0.6rem;color:#EF4444;border-color:#EF444433" onclick="deleteBonus(' + b.id + ',' + u.id + ')" title="\u0423\u0434\u0430\u043b\u0438\u0442\u044c"><i class="fas fa-trash"></i></button>';
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
    h += '<td></td>';
    h += '<td style="padding:10px;text-align:right;color:#22C55E">' + fmtAmt(totalBonus) + '</td>';
    h += '<td style="padding:10px;text-align:right;color:#EF4444">' + (totalFines < 0 ? '\u2212' + fmtAmt(Math.abs(totalFines)) : '\u2014') + '</td>';
    h += '<td style="padding:10px;text-align:right;color:#a78bfa">' + fmtAmt(totalNetPay) + '</td>';
    h += '<td></td></tr>';
    h += '</tbody></table></div>';
  } else {
    h += '<div class="card" style="padding:24px;text-align:center;color:#475569"><i class="fas fa-user-slash" style="margin-right:8px"></i>Нет сотрудников с установленной зарплатой. Добавьте через раздел «Сотрудники».</div>';
  }
  h += '</div>';

  return h;
}

// ============ TAB 3: ВОРОНКА И ДЕТАЛИ ============
function renderBizFunnelV2(d, sd, fin) {
  var h = '';
  var totalLeads = d.total_leads || 1;
  var stageTimings = d.stage_timings || {};
  // ---- SECTION: Visual funnel ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-funnel-dollar" style="color:#8B5CF6;margin-right:8px"></i>\u0412\u043e\u0440\u043e\u043d\u043a\u0430 \u043f\u0440\u043e\u0434\u0430\u0436</h3>';
  var funnelStages = [
    {key:'new',label:'\u041d\u043e\u0432\u044b\u0435 \u043b\u0438\u0434\u044b',color:'#10B981'},
    {key:'contacted',label:'\u041a\u043e\u043d\u0442\u0430\u043a\u0442',color:'#3B82F6'},
    {key:'in_progress',label:'\u0412 \u0440\u0430\u0431\u043e\u0442\u0435',color:'#F59E0B'},
    {key:'checking',label:'\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430',color:'#8B5CF6'},
    {key:'done',label:'\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043e',color:'#22C55E'}
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
    if (stageDays > 0) h += ' <span style="font-size:0.65rem;color:#64748b;font-weight:400">(~' + stageDays + ' \u0434\u043d)</span>';
    h += '</span>';
    var fvSvc = Number(fv.services)||0; var fvArt = Number(fv.articles)||0; var fvAmt = Number(fv.amount)||0;
    h += '<span style="font-size:0.85rem;font-weight:700">' + cnt + ' <span style="color:#64748b;font-weight:400">(' + fmtAmt(fvAmt) + ')</span>';
    if (convFromPrev) h += ' <span style="font-size:0.68rem;padding:2px 6px;border-radius:8px;background:rgba(139,92,246,0.15);color:#a78bfa;margin-left:6px">\u2192 ' + convFromPrev + '%</span>';
    h += '</span></div>';
    h += '<div style="display:flex;gap:12px;margin-bottom:4px;padding-left:4px">';
    h += '<span style="font-size:0.68rem;color:#8B5CF6"><i class="fas fa-concierge-bell" style="margin-right:2px"></i>\u0423\u0441\u043b: ' + fmtAmt(fvSvc) + '</span>';
    h += '<span style="font-size:0.68rem;color:#F59E0B"><i class="fas fa-box" style="margin-right:2px"></i>\u0412\u044b\u043a: ' + fmtAmt(fvArt) + '</span>';
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
  h += '<div style="display:flex;justify-content:space-between;align-items:center"><span style="color:#EF4444;font-weight:600"><i class="fas fa-times-circle" style="margin-right:4px"></i>\u041e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u043e</span>';
  h += '<span style="font-weight:700">' + rejCnt + ' (' + fmtAmt(Number(rejected.amount)||0) + ') <span style="font-size:0.72rem;color:#64748b">' + (totalLeads > 0 ? ((rejCnt / totalLeads * 100).toFixed(1) + '% \u043e\u0442\u043a\u0430\u0437\u043e\u0432') : '') + '</span></span></div>';
  h += '</div></div>';

  // Conversion metrics with clear descriptions
  h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px">';
  h += '<div class="card" style="text-align:center;padding:18px"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:6px"><i class="fas fa-percentage" style="margin-right:4px"></i>\u041a\u043e\u043d\u0432\u0435\u0440\u0441\u0438\u044f</div><div style="font-size:2rem;font-weight:900;color:#8B5CF6">' + fmtPct(fin.conversion_rate) + '</div><div style="font-size:0.6rem;color:#475569;margin-top:4px">Завершённые \u00f7 Все лиды за период</div></div>';
  h += '<div class="card" style="text-align:center;padding:18px"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:6px"><i class="fas fa-ban" style="margin-right:4px"></i>\u041e\u0442\u043a\u0430\u0437\u044b</div><div style="font-size:2rem;font-weight:900;color:#EF4444">' + (d.total_leads > 0 ? ((rejCnt / d.total_leads) * 100).toFixed(1) : '0') + '%</div><div style="font-size:0.6rem;color:#475569;margin-top:4px">Отклонённые \u00f7 Все лиды</div></div>';
  h += '<div class="card" style="text-align:center;padding:18px"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:6px"><i class="fas fa-clock" style="margin-right:4px"></i>\u0421\u0440. \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435</div><div style="font-size:2rem;font-weight:900;color:#3B82F6">' + (Number(fin.avg_fulfillment_days)||0) + ' <span style="font-size:0.9rem">\u0434\u043d</span></div><div style="font-size:0.6rem;color:#475569;margin-top:4px">Среднее время от создания до завершения</div></div>';
  h += '<div class="card" style="text-align:center;padding:18px"><div style="font-size:0.78rem;color:#94a3b8;margin-bottom:6px"><i class="fas fa-shopping-cart" style="margin-right:4px"></i>\u0421\u0440. \u0447\u0435\u043a (\u0443\u0441\u043b\u0443\u0433\u0438)</div><div style="font-size:2rem;font-weight:900;color:#F59E0B">' + fmtAmt(fin.avg_check) + '</div><div style="font-size:0.6rem;color:#475569;margin-top:4px">Только услуги завершённых (без выкупов)</div></div>';
  h += '</div></div>';

  // ---- SECTION: Rejection reasons ----
  var rejLeads = d.rejected_leads || [];
  if (rejLeads.length > 0) {
    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-exclamation-circle" style="color:#EF4444;margin-right:8px"></i>\u041f\u0440\u0438\u0447\u0438\u043d\u044b \u043e\u0442\u043a\u0430\u0437\u043e\u0432</h3>';
    h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.82rem">';
    h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:10px 16px;text-align:left;color:#94a3b8">\u041b\u0438\u0434</th><th style="padding:10px;text-align:left;color:#94a3b8">\u041a\u043e\u043d\u0442\u0430\u043a\u0442</th><th style="padding:10px;text-align:right;color:#94a3b8">\u0421\u0443\u043c\u043c\u0430</th><th style="padding:10px;text-align:left;color:#94a3b8">\u041f\u0440\u0438\u0447\u0438\u043d\u0430 / \u0417\u0430\u043c\u0435\u0442\u043a\u0438</th></tr></thead><tbody>';
    for (var ri = 0; ri < Math.min(rejLeads.length, 20); ri++) {
      var rl2 = rejLeads[ri];
      h += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:8px 16px;font-weight:600">#' + (rl2.id||'') + ' ' + escHtml(rl2.name||'\u2014') + '</td>';
      h += '<td style="padding:8px;color:#94a3b8">' + escHtml(rl2.contact||'\u2014') + '</td>';
      h += '<td style="padding:8px;text-align:right;font-weight:600;color:#f87171">' + fmtAmt(Number(rl2.total_amount)||0) + '</td>';
      h += '<td style="padding:8px;color:#e2e8f0;max-width:300px;overflow:hidden;text-overflow:ellipsis">' + escHtml(rl2.notes||'\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430') + '</td></tr>';
    }
    h += '</tbody></table></div></div>';
  }

  // ---- SECTION: By source ----
  var bySource = d.by_source || {};
  var sourceKeys = Object.keys(bySource);
  if (sourceKeys.length > 0) {
    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-globe" style="color:#F59E0B;margin-right:8px"></i>\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438</h3>';
    var srcLabels = { form: '\u0424\u043e\u0440\u043c\u0430 \u043d\u0430 \u0441\u0430\u0439\u0442\u0435', popup: '\u041f\u043e\u043f\u0430\u043f', calculator_pdf: '\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u044b \u0432\u0440\u0443\u0447\u043d\u0443\u044e', manual: '\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u044b \u0432\u0440\u0443\u0447\u043d\u0443\u044e', direct: '\u041f\u0440\u044f\u043c\u043e\u0439', admin_panel: '\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u044b \u0432\u0440\u0443\u0447\u043d\u0443\u044e (\u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a)' };
    h += '<div class="card" style="padding:16px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
    for (var ski = 0; ski < sourceKeys.length; ski++) {
      var sk = sourceKeys[ski]; var sv = bySource[sk];
      h += '<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #1e293b"><span style="color:#94a3b8">' + escHtml(srcLabels[sk] || sk || '\u041f\u0440\u044f\u043c\u043e\u0439') + '</span><span style="font-weight:600">' + (Number(sv?.count)||sv||0) + ' / ' + fmtAmt(Number(sv?.amount)||0) + '</span></div>';
    }
    h += '</div></div></div>';
  }

  // ---- SECTION: Popular services ----
  var services = d.services || [];
  if (services.length > 0) {
    h += '<div style="margin-bottom:32px">';
    h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-fire" style="color:#EF4444;margin-right:8px"></i>\u041f\u043e\u043f\u0443\u043b\u044f\u0440\u043d\u044b\u0435 \u0443\u0441\u043b\u0443\u0433\u0438</h3>';
    h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.85rem">';
    h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155"><th style="padding:10px 16px;text-align:left;color:#94a3b8">#</th><th style="padding:10px;text-align:left;color:#94a3b8">\u0423\u0441\u043b\u0443\u0433\u0430</th><th style="padding:10px;text-align:center;color:#94a3b8">\u0417\u0430\u043a\u0430\u0437\u043e\u0432</th><th style="padding:10px;text-align:center;color:#94a3b8">\u041a\u043e\u043b-\u0432\u043e</th><th style="padding:10px;text-align:right;color:#94a3b8">\u0412\u044b\u0440\u0443\u0447\u043a\u0430</th><th style="padding:10px;text-align:right;color:#94a3b8">%</th></tr></thead><tbody>';
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
  h += '<th style="padding:8px 6px;text-align:right;color:#EF4444;white-space:nowrap">Расходы</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#22C55E;white-space:nowrap" title="Услуги - Расходы">Прибыль</th>';
  h += '<th style="padding:8px 6px;text-align:center;color:#94a3b8;white-space:nowrap">Статус</th>';
  h += '<th style="padding:8px 6px;width:60px"></th>';
  h += '</tr></thead><tbody>';
  var monthNames = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  var yearTotals = {done:0, inProgress:0, rejected:0, checking:0, turnover:0, services:0, articles:0, refunds:0, expenses:0, profit:0};
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
    if (mSnap) { try { var cd5 = JSON.parse(mSnap.custom_data || '{}'); mAdjs = cd5.adjustments || []; if (!mAdjs.length && cd5.adjustment) { mAdjs = [{amount: Math.abs(cd5.adjustment), type: cd5.adjustment_type || 'inflow', comment: cd5.adjustment_comment || ''}]; } for (var aj = 0; aj < mAdjs.length; aj++) { var a5 = mAdjs[aj]; mAdjTotal += a5.type === 'outflow' ? -Math.abs(a5.amount) : Math.abs(a5.amount); } } catch {} }
    if (isLocked) {
      // From snapshot
      mDone = Number(mSnap.leads_done)||0;
      var snapCD = {}; try { snapCD = JSON.parse(mSnap.custom_data || '{}'); } catch {}
      mInProg = Number(snapCD.in_progress_count)||0;
      mRejected = Number(snapCD.rejected_count)||0;
      mChecking = Number(snapCD.checking_count)||0;
      mSvc = Number(mSnap.revenue_services)||0;
      mArt = Number(mSnap.revenue_articles)||0;
      mRefunds = Number(mSnap.refunds)||0;
      mExp = (Number(mSnap.expense_salaries)||0)+(Number(mSnap.expense_commercial)||0)+(Number(mSnap.expense_marketing)||0);
      mTurnover = mSvc + mArt;
      mProfit = mSvc - mExp + mAdjTotal;
    } else if (isCurrent) {
      // Live data from fin (global analytics for current period)
      mDone = Number(sd.done && sd.done.count)||0;
      mInProg = (Number(sd.in_progress && sd.in_progress.count)||0) + (Number(sd.contacted && sd.contacted.count)||0);
      mRejected = Number(sd.rejected && sd.rejected.count)||0;
      mChecking = Number(sd.checking && sd.checking.count)||0;
      mSvc = Number(fin.services)||0;
      mArt = Number(fin.articles)||0;
      mRefunds = Number(fin.refunds)||0;
      mExp = Number(fin.total_expenses)||0;
      mTurnover = mSvc + mArt;
      mProfit = mSvc - mExp + mAdjTotal;
    } else if (isPast && mData) {
      // Historical from monthly_data query (only for past non-locked months)
      mDone = Number(mData.done_count)||0;
      mInProg = Number(mData.in_progress_count)||0;
      mRejected = Number(mData.rejected_count)||0;
      mChecking = Number(mData.checking_count)||0;
      mSvc = Number(mData.services)||0;
      mArt = Number(mData.articles)||0;
      mRefunds = Number(mData.refunds)||0;
      mExp = 0; // No per-month expense history for non-snapshot months
      mTurnover = mSvc + mArt;
      mProfit = mSvc - mExp + mAdjTotal;
    } else {
      mDone = 0; mInProg = 0; mRejected = 0; mChecking = 0;
      mSvc = 0; mArt = 0; mRefunds = 0; mExp = 0; mTurnover = 0; mProfit = 0;
    }
    yearTotals.done += mDone; yearTotals.inProgress += mInProg;
    yearTotals.rejected += mRejected; yearTotals.checking += mChecking;
    yearTotals.turnover += mTurnover; yearTotals.services += mSvc;
    yearTotals.articles += mArt; yearTotals.refunds += mRefunds;
    yearTotals.expenses += mExp; yearTotals.profit += mProfit;
    var rowBg = isCurrent ? 'background:rgba(139,92,246,0.06);' : isFuture ? 'opacity:0.4;' : '';
    h += '<tr style="border-bottom:1px solid #1e293b;' + rowBg + '">';
    h += '<td style="padding:8px 12px;font-weight:700;color:' + (isCurrent ? '#a78bfa' : isLocked ? '#34d399' : '#e2e8f0') + '">' + monthNames[mi3-1];
    if (isCurrent) h += ' <span style="font-size:0.55rem;padding:1px 5px;background:#8B5CF6;color:white;border-radius:8px;vertical-align:middle">СЕЙЧАС</span>';
    h += '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#22C55E">' + (mDone || '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#F59E0B">' + (mInProg || '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#EF4444">' + (mRejected || '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#3B82F6">' + (mChecking || '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;font-weight:600;color:#a78bfa">' + (mTurnover ? fmtAmt(mTurnover) : '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#F59E0B">' + (mArt ? fmtAmt(mArt) : '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#f87171">' + (mRefunds ? '-' + fmtAmt(Math.abs(mRefunds)) : '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#8B5CF6">' + (mSvc ? fmtAmt(mSvc) : '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#EF4444">' + (mExp ? '-' + fmtAmt(Math.abs(mExp)) : '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;font-weight:700;color:' + (mProfit >= 0 ? '#22C55E' : '#EF4444') + '">' + ((mProfit || isCurrent) ? fmtAmt(mProfit) : '\u2014');
    if (mAdjTotal !== 0) h += '<div style="font-size:0.6rem;color:' + (mAdjTotal > 0 ? '#22C55E' : '#EF4444') + '">' + (mAdjTotal > 0 ? '+' : '') + fmtAmt(mAdjTotal) + '</div>';
    h += '</td>';
    h += '<td style="padding:8px 6px;text-align:center">';
    // Check custom status from snapshot
    var customStatus = '';
    if (mSnap) { try { var cd8 = JSON.parse(mSnap.custom_data || '{}'); customStatus = cd8.status || ''; } catch {} }
    if (customStatus === 'locked' || (isLocked && !customStatus)) h += '<span style="color:#22C55E;font-size:0.68rem"><i class="fas fa-lock"></i> Закрыт</span>';
    else if (customStatus === 'checking') h += '<span style="color:#3B82F6;font-size:0.68rem"><i class="fas fa-search"></i> Проверка</span>';
    else if (customStatus === 'custom') { var customLabel2 = ''; try { customLabel2 = JSON.parse(mSnap.custom_data || '{}').status_label || ''; } catch {} h += '<span style="color:#a78bfa;font-size:0.68rem">' + (customLabel2 || 'Другое') + '</span>'; }
    else if (isCurrent && !customStatus) h += '<span style="color:#F59E0B;font-size:0.68rem"><i class="fas fa-sync-alt fa-spin" style="font-size:0.5rem;margin-right:3px"></i>Текущий</span>';
    else if (isPast && !customStatus) h += '<span style="color:#F59E0B;font-size:0.68rem">Открыт</span>';
    else if (customStatus === 'open') h += '<span style="color:#F59E0B;font-size:0.68rem">Открыт</span>';
    else h += '<span style="color:#334155;font-size:0.68rem">\u2014</span>';
    h += '</td>';
    h += '<td style="padding:8px 6px;text-align:center;white-space:nowrap">';
    // Edit button for ANY non-future month
    if (!isFuture) {
      h += '<button class="btn btn-outline" style="padding:3px 7px;font-size:0.6rem;color:#F59E0B;border-color:#F59E0B44" onclick="editingMonthKey=\\'' + mKey + '\\';render()" title="Редактировать"><i class="fas fa-pencil-alt"></i></button>';
    }
    h += '</td></tr>';
    // Editable inline form for ANY month (when editing)
    if (isEditing && !isFuture) {
      var snapId4Edit = mSnap ? mSnap.id : 0;
      // Parse existing adjustments and status from snapshot custom_data
      var existingAdjs = [];
      var snapStatus = '';
      if (mSnap) { try { var cd4 = JSON.parse(mSnap.custom_data || '{}'); existingAdjs = cd4.adjustments || []; snapStatus = cd4.status || ''; if (!existingAdjs.length && cd4.adjustment) { existingAdjs = [{amount: Math.abs(cd4.adjustment), type: cd4.adjustment_type || 'inflow', comment: cd4.adjustment_comment || ''}]; } } catch {} }
      if (!snapStatus) { snapStatus = isLocked ? 'locked' : isCurrent ? 'current' : isPast ? 'open' : ''; }
      h += '<tr style="background:#0f172a"><td colspan="13" style="padding:12px 16px">';
      h += '<div style="font-weight:700;color:#F59E0B;margin-bottom:10px"><i class="fas fa-pencil-alt" style="margin-right:6px"></i>Редактирование: ' + monthNames[mi3-1] + ' ' + currentYear + '</div>';
      // Row 1: Lead counts
      h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">';
      h += '<div><label style="font-size:0.7rem;color:#22C55E">Закрытые</label><input class="input" id="edit-done-' + mKey + '" type="number" value="' + mDone + '" style="width:100%;padding:6px 10px"></div>';
      h += '<div><label style="font-size:0.7rem;color:#F59E0B">В работе</label><input class="input" id="edit-inprog-' + mKey + '" type="number" value="' + mInProg + '" style="width:100%;padding:6px 10px"></div>';
      h += '<div><label style="font-size:0.7rem;color:#EF4444">Отказы</label><input class="input" id="edit-rejected-' + mKey + '" type="number" value="' + mRejected + '" style="width:100%;padding:6px 10px"></div>';
      h += '<div><label style="font-size:0.7rem;color:#3B82F6">Проверка</label><input class="input" id="edit-checking-' + mKey + '" type="number" value="' + mChecking + '" style="width:100%;padding:6px 10px"></div>';
      h += '</div>';
      // Row 2: Financial fields
      h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px">';
      h += '<div><label style="font-size:0.7rem;color:#8B5CF6">Услуги</label><input class="input" id="edit-svc-' + mKey + '" type="number" value="' + mSvc + '" style="width:100%;padding:6px 10px"></div>';
      h += '<div><label style="font-size:0.7rem;color:#F59E0B">Выкупы</label><input class="input" id="edit-art-' + mKey + '" type="number" value="' + mArt + '" style="width:100%;padding:6px 10px"></div>';
      h += '<div><label style="font-size:0.7rem;color:#f87171">Возврат</label><input class="input" id="edit-ref-' + mKey + '" type="number" value="' + mRefunds + '" style="width:100%;padding:6px 10px"></div>';
      h += '<div><label style="font-size:0.7rem;color:#EF4444">Расходы</label><input class="input" id="edit-exp-' + mKey + '" type="number" value="' + mExp + '" style="width:100%;padding:6px 10px"></div>';
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
          h += '<button class="btn btn-outline" style="padding:2px 6px;font-size:0.6rem;color:#EF4444;border-color:#EF444433;margin-left:auto;flex-shrink:0" onclick="deleteAdjustment(\\'' + mKey + '\\',' + snapId4Edit + ',' + ai + ')" title="Удалить"><i class="fas fa-trash"></i></button>';
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
      h += '<div style="display:flex;gap:8px"><button class="btn btn-success" style="padding:6px 14px;font-size:0.82rem" onclick="saveEditedMonth(\\'' + mKey + '\\',' + snapId4Edit + ')"><i class="fas fa-check" style="margin-right:4px"></i>Сохранить</button>';
      h += '<button class="btn btn-outline" style="padding:6px 14px;font-size:0.82rem" onclick="editingMonthKey=\\'\\';render()">Отмена</button></div>';
      h += '</td></tr>';
    }
  }
  h += '<tr style="border-top:2px solid #8B5CF6;font-weight:800"><td style="padding:8px 12px">ИТОГО ' + currentYear + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#22C55E">' + yearTotals.done + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#F59E0B">' + yearTotals.inProgress + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#EF4444">' + yearTotals.rejected + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#3B82F6">' + yearTotals.checking + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#a78bfa">' + fmtAmt(yearTotals.turnover) + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#F59E0B">' + (yearTotals.articles ? fmtAmt(yearTotals.articles) : '\u2014') + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#f87171">' + (yearTotals.refunds ? '-' + fmtAmt(Math.abs(yearTotals.refunds)) : '\u2014') + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#8B5CF6">' + (yearTotals.services ? fmtAmt(yearTotals.services) : '\u2014') + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;color:#EF4444">' + (yearTotals.expenses ? '-' + fmtAmt(Math.abs(yearTotals.expenses)) : '\u2014') + '</td>';
  h += '<td style="padding:8px 6px;text-align:right;font-weight:700;color:' + (yearTotals.profit >= 0 ? '#22C55E' : '#EF4444') + '">' + fmtAmt(yearTotals.profit) + '</td>';
  h += '<td colspan="2"></td></tr>';
  h += '</tbody></table></div></div>';

  // ---- SECTION: Quarters (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec) ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-calendar-alt" style="color:#F59E0B;margin-right:8px"></i>\u041a\u0432\u0430\u0440\u0442\u0430\u043b\u044b ' + currentYear + '</h3>';
  h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.78rem">';
  h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155">';
  h += '<th style="padding:8px 12px;text-align:left;color:#94a3b8">Квартал</th>';
  h += '<th style="padding:8px 6px;text-align:left;color:#94a3b8;font-size:0.72rem">Месяцы</th>';
  h += '<th style="padding:8px 6px;text-align:center;color:#94a3b8">Закрыто</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#22C55E" title="Закрытые лиды">Закрытые</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#a78bfa">Приход</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#F59E0B">Выкупы</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#f87171">Возврат</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#8B5CF6">Услуги</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#EF4444">Расходы</th>';
  h += '<th style="padding:8px 6px;text-align:right;color:#22C55E" title="Услуги - Расходы">Прибыль</th>';
  h += '<th style="padding:8px;width:50px"></th></tr></thead><tbody>';
  var qMonthsMap = [[1,2,3],[4,5,6],[7,8,9],[10,11,12]];
  var qNames = ['Q1 (Янв\u2013Мар)','Q2 (Апр\u2013Июн)','Q3 (Июл\u2013Сен)','Q4 (Окт\u2013Дек)'];
  for (var qi2 = 0; qi2 < 4; qi2++) {
    var qNum = qi2 + 1;
    var qKey = currentYear + '-Q' + qNum;
    var qSnap = snapshots.find(function(s){return s.period_type==='quarter' && s.period_key===qKey;});
    var qIsCurrent = qNum === currentQ;
    var qLocked = qSnap && qSnap.is_locked;
    var closedInQ = 0;
    var qTurnover = 0, qSvc = 0, qArt = 0, qRef = 0, qExp = 0, qProfit = 0, qDone = 0;
    for (var qmi = 0; qmi < 3; qmi++) {
      var qmNum = qMonthsMap[qi2][qmi];
      var qmKey = currentYear + '-' + String(qmNum).padStart(2,'0');
      var qmSnap = snapshots.find(function(s){return s.period_type==='month' && s.period_key===qmKey;});
      if (qmSnap && qmSnap.is_locked) {
        closedInQ++;
      }
      if (qmSnap) {
        var qmSvc = Number(qmSnap.revenue_services)||0;
        var qmArt = Number(qmSnap.revenue_articles)||0;
        var qmExp = (Number(qmSnap.expense_salaries)||0)+(Number(qmSnap.expense_commercial)||0)+(Number(qmSnap.expense_marketing)||0);
        // Include adjustments from month snapshot
        var qmAdj = 0;
        try { var qmCD = JSON.parse(qmSnap.custom_data || '{}'); var qmAdjs = qmCD.adjustments || []; for (var qai = 0; qai < qmAdjs.length; qai++) { qmAdj += qmAdjs[qai].type === 'outflow' ? -Math.abs(qmAdjs[qai].amount) : Math.abs(qmAdjs[qai].amount); } } catch {}
        qSvc += qmSvc;
        qArt += qmArt;
        qRef += Number(qmSnap.refunds)||0;
        qExp += qmExp;
        qTurnover += qmSvc + qmArt;
        qProfit += qmSvc - qmExp + qmAdj;
        qDone += Number(qmSnap.leads_done)||0;
      } else if (qmNum === currentMonth) {
        // Include live current month data
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
      }
    }
    // Use quarter snapshot if locked
    if (qLocked) {
      var qlSvc = Number(qSnap.revenue_services)||0;
      var qlExp = (Number(qSnap.expense_salaries)||0)+(Number(qSnap.expense_commercial)||0)+(Number(qSnap.expense_marketing)||0);
      qTurnover = qlSvc + (Number(qSnap.revenue_articles)||0);
      qSvc = qlSvc;
      qArt = Number(qSnap.revenue_articles)||0;
      qRef = Number(qSnap.refunds)||0;
      qExp = qlExp;
      qProfit = qSvc - qExp; // Прибыль = Услуги - Расходы
      qDone = Number(qSnap.leads_done)||0;
    }
    var qColor = qIsCurrent ? '#F59E0B' : qLocked ? '#22C55E' : '#e2e8f0';
    h += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:8px 12px;font-weight:700;color:' + qColor + '">' + qNames[qi2] + '</td>';
    h += '<td style="padding:8px 6px;color:#64748b;font-size:0.72rem">' + qMonthsMap[qi2].map(function(m){return monthNames[m-1];}).join(', ') + '</td>';
    h += '<td style="padding:8px 6px;text-align:center">' + closedInQ + '/3</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#22C55E">' + (qDone || '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;font-weight:600;color:#a78bfa">' + (qTurnover ? fmtAmt(qTurnover) : '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#F59E0B">' + (qArt ? fmtAmt(qArt) : '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#f87171">' + (qRef ? '-' + fmtAmt(Math.abs(qRef)) : '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#8B5CF6">' + (qSvc ? fmtAmt(qSvc) : '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;color:#EF4444">' + (qExp ? '-' + fmtAmt(Math.abs(qExp)) : '\u2014') + '</td>';
    h += '<td style="padding:8px 6px;text-align:right;font-weight:700;color:' + (qProfit >= 0 ? '#22C55E' : '#EF4444') + '">' + (qProfit ? fmtAmt(qProfit) : '\u2014') + '</td>';
    h += '<td style="padding:8px;text-align:center">';
    if (qNum < currentQ && closedInQ === 3 && !qLocked) {
      h += '<button class="btn btn-primary" style="padding:3px 10px;font-size:0.72rem" onclick="closePeriodAction(\\'quarter\\',\\'' + qKey + '\\',true)"><i class="fas fa-lock"></i></button>';
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
  h += '<div style="font-size:1.3rem;font-weight:800;color:#a78bfa">\u0413\u043e\u0434 ' + currentYear + '</div>';
  h += '<div style="font-size:0.85rem;color:#64748b;margin-top:4px">\u041a\u0432\u0430\u0440\u0442\u0430\u043b\u043e\u0432 \u0437\u0430\u043a\u0440\u044b\u0442\u043e: ' + closedQ + '/4</div>';
  if (yearSnap) h += '<div style="font-size:0.85rem;margin-top:8px">\u041f\u0440\u0438\u0431\u044b\u043b\u044c \u0437\u0430 \u0433\u043e\u0434: <strong style="color:' + ((yearSnap.net_profit||0) >= 0 ? '#22C55E' : '#EF4444') + '">' + fmtAmt(yearSnap.net_profit) + '</strong></div>';
  if (closedQ === 4 && !(yearSnap && yearSnap.is_locked)) {
    h += '<button class="btn btn-primary" style="margin-top:12px" onclick="closePeriodAction(\\'year\\',\\'' + yearKey + '\\',true)"><i class="fas fa-lock" style="margin-right:6px"></i>\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0433\u043e\u0434</button>';
  }
  h += '</div></div>';

  // ---- SECTION: Manual Period Comparison ----
  h += '<div style="margin-bottom:32px">';
  h += '<h3 style="font-weight:700;margin-bottom:16px;font-size:1.1rem;color:#e2e8f0"><i class="fas fa-exchange-alt" style="color:#F59E0B;margin-right:8px"></i>\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435 \u043f\u0435\u0440\u0438\u043e\u0434\u043e\u0432</h3>';
  var allSnaps = snapshots.slice().sort(function(a,b){return a.period_key>b.period_key?-1:1;});
  // Quick comparison buttons
  var monthSnaps = allSnaps.filter(function(s){return s.period_type==='month';}).sort(function(a,b){return a.period_key>b.period_key?-1:1;});
  var quarterSnaps = allSnaps.filter(function(s){return s.period_type==='quarter';}).sort(function(a,b){return a.period_key>b.period_key?-1:1;});
  if (monthSnaps.length >= 1 || quarterSnaps.length >= 1) {
    h += '<div class="card" style="padding:12px 16px;margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
    h += '<span style="font-size:0.78rem;color:#94a3b8;font-weight:600"><i class="fas fa-bolt" style="margin-right:4px;color:#F59E0B"></i>\u0411\u044b\u0441\u0442\u0440\u044b\u0439 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440:</span>';
    // Single period quick view
    if (monthSnaps.length >= 1) {
      h += '<button class="tab-btn" style="padding:5px 12px;font-size:0.75rem" onclick="comparePeriod1=\\'' + monthSnaps[0].id + '\\';comparePeriod2=\\'\\';render()"><i class="fas fa-eye" style="margin-right:3px"></i>' + monthSnaps[0].period_key.slice(5) + '</button>';
    }
    // 1-month vs prev month
    if (monthSnaps.length >= 2) {
      h += '<button class="tab-btn" style="padding:5px 12px;font-size:0.75rem" onclick="comparePeriod1=\\'' + monthSnaps[0].id + '\\';comparePeriod2=\\'' + monthSnaps[1].id + '\\';render()"><i class="fas fa-calendar-day" style="margin-right:3px"></i>1 \u043c\u0435\u0441: ' + monthSnaps[0].period_key.slice(5) + ' vs ' + monthSnaps[1].period_key.slice(5) + '</button>';
    }
    // 2-month comparison (latest vs 2 months ago)
    if (monthSnaps.length >= 3) {
      h += '<button class="tab-btn" style="padding:5px 12px;font-size:0.75rem" onclick="comparePeriod1=\\'' + monthSnaps[0].id + '\\';comparePeriod2=\\'' + monthSnaps[2].id + '\\';render()"><i class="fas fa-calendar-alt" style="margin-right:3px"></i>2 \u043c\u0435\u0441: ' + monthSnaps[0].period_key.slice(5) + ' vs ' + monthSnaps[2].period_key.slice(5) + '</button>';
    }
    // 3-month comparison (latest vs 3 months ago)
    if (monthSnaps.length >= 4) {
      h += '<button class="tab-btn" style="padding:5px 12px;font-size:0.75rem" onclick="comparePeriod1=\\'' + monthSnaps[0].id + '\\';comparePeriod2=\\'' + monthSnaps[3].id + '\\';render()"><i class="fas fa-calendar-week" style="margin-right:3px"></i>3 \u043c\u0435\u0441: ' + monthSnaps[0].period_key.slice(5) + ' vs ' + monthSnaps[3].period_key.slice(5) + '</button>';
    }
    // Quarter comparison
    if (quarterSnaps.length >= 2) {
      h += '<button class="tab-btn" style="padding:5px 12px;font-size:0.75rem" onclick="comparePeriod1=\\'' + quarterSnaps[0].id + '\\';comparePeriod2=\\'' + quarterSnaps[1].id + '\\';render()"><i class="fas fa-layer-group" style="margin-right:3px"></i>\u041a\u0432\u0430\u0440\u0442: ' + quarterSnaps[0].period_key + ' vs ' + quarterSnaps[1].period_key + '</button>';
    }
    h += '</div>';
  }
  if (allSnaps.length >= 1) {
    // Manual selection dropdowns
    h += '<div class="card" style="padding:16px;margin-bottom:16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">';
    h += '<div style="font-size:0.82rem;color:#94a3b8;font-weight:600">\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0435\u0440\u0438\u043e\u0434\u044b \u0434\u043b\u044f \u0441\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u044f:</div>';
    h += '<select class="input" style="width:220px;padding:6px 10px;font-size:0.82rem" onchange="comparePeriod1=this.value;render()" id="cmpPeriod1">';
    h += '<option value="">\u2014 \u041f\u0435\u0440\u0438\u043e\u0434 1 \u2014</option>';
    for (var cs1 = 0; cs1 < allSnaps.length; cs1++) {
      var sn1 = allSnaps[cs1]; var lbl1 = sn1.period_type === 'month' ? sn1.period_key : sn1.period_type === 'quarter' ? sn1.period_key : '\u0413\u043e\u0434 ' + sn1.period_key;
      var lockIcon1 = sn1.is_locked ? ' \ud83d\udd12' : ' \ud83d\udcca';
      h += '<option value="' + sn1.id + '"' + (comparePeriod1 == sn1.id ? ' selected' : '') + '>' + lbl1 + ' (' + sn1.period_type + ')' + lockIcon1 + '</option>';
    }
    h += '</select>';
    h += '<span style="color:#64748b">vs</span>';
    h += '<select class="input" style="width:220px;padding:6px 10px;font-size:0.82rem" onchange="comparePeriod2=this.value;render()" id="cmpPeriod2">';
    h += '<option value="">\u2014 \u041f\u0435\u0440\u0438\u043e\u0434 2 (\u043e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e) \u2014</option>';
    for (var cs2 = 0; cs2 < allSnaps.length; cs2++) {
      var sn2 = allSnaps[cs2]; var lbl2 = sn2.period_type === 'month' ? sn2.period_key : sn2.period_type === 'quarter' ? sn2.period_key : '\u0413\u043e\u0434 ' + sn2.period_key;
      var lockIcon2 = sn2.is_locked ? ' \ud83d\udd12' : ' \ud83d\udcca';
      h += '<option value="' + sn2.id + '"' + (comparePeriod2 == sn2.id ? ' selected' : '') + '>' + lbl2 + ' (' + sn2.period_type + ')' + lockIcon2 + '</option>';
    }
    h += '</select></div>';
    // Show comparison if period 1 selected (period 2 is optional for single-period view)
    var snap1 = comparePeriod1 ? allSnaps.find(function(s){return s.id == comparePeriod1;}) : null;
    var snap2 = comparePeriod2 ? allSnaps.find(function(s){return s.id == comparePeriod2;}) : null;
    if (snap1) {
      // Parse custom_data for extra metrics
      var cd1 = {}; var cd2 = {};
      try { cd1 = JSON.parse(snap1.custom_data || '{}'); } catch {}
      if (snap2) { try { cd2 = JSON.parse(snap2.custom_data || '{}'); } catch {} }
      var exp1 = (Number(snap1.expense_salaries)||0)+(Number(snap1.expense_commercial)||0)+(Number(snap1.expense_marketing)||0);
      var exp2 = snap2 ? (Number(snap2.expense_salaries)||0)+(Number(snap2.expense_commercial)||0)+(Number(snap2.expense_marketing)||0) : 0;
      // Helper: get valid avg_check (0 if no leads_done)
      var snap1AvgCheck = (Number(snap1.leads_done)||0) > 0 ? Number(snap1.avg_check)||0 : 0;
      var snap2AvgCheck = snap2 ? ((Number(snap2.leads_done)||0) > 0 ? Number(snap2.avg_check)||0 : 0) : 0;
      // Profit margin: (net_profit / services) * 100
      var snap1ProfitMargin = (Number(snap1.revenue_services)||0) > 0 ? (Number(snap1.net_profit)||0) / (Number(snap1.revenue_services)||1) * 100 : 0;
      var snap2ProfitMargin = snap2 ? ((Number(snap2.revenue_services)||0) > 0 ? (Number(snap2.net_profit)||0) / (Number(snap2.revenue_services)||1) * 100 : 0) : 0;
      // Cost per lead
      var snap1CPL = (Number(snap1.leads_count)||0) > 0 ? exp1 / (Number(snap1.leads_count)||1) : 0;
      var snap2CPL = snap2 ? ((Number(snap2.leads_count)||0) > 0 ? exp2 / (Number(snap2.leads_count)||1) : 0) : 0;
      // Cost per acquisition (expenses / leads_done)
      var snap1CPA = (Number(snap1.leads_done)||0) > 0 ? exp1 / (Number(snap1.leads_done)||1) : 0;
      var snap2CPA = snap2 ? ((Number(snap2.leads_done)||0) > 0 ? exp2 / (Number(snap2.leads_done)||1) : 0) : 0;
      // Revenue per lead
      var snap1RPL = (Number(snap1.leads_count)||0) > 0 ? (Number(snap1.revenue_services)||0) / (Number(snap1.leads_count)||1) : 0;
      var snap2RPL = snap2 ? ((Number(snap2.leads_count)||0) > 0 ? (Number(snap2.revenue_services)||0) / (Number(snap2.leads_count)||1) : 0) : 0;
      // LTV estimate (avg_check * conversion_rate / 100)
      var snap1LTV = snap1AvgCheck * (Number(cd1.conversion_rate)||0) / 100;
      var snap2LTV = snap2 ? (snap2AvgCheck * (Number(cd2.conversion_rate)||0) / 100) : 0;

      // Section separator helper
      var SECTION = '__section__';

      var cmpMetrics = [
        // ===== REVENUE =====
        {label:'\u0414\u043e\u0445\u043e\u0434\u044b',section:true},
        {label:'\u041e\u0431\u043e\u0440\u043e\u0442',v1:Number(snap1.total_turnover)||0,v2:snap2 ? Number(snap2.total_turnover)||0 : 0,color:'#a78bfa',icon:'fa-coins'},
        {label:'\u0423\u0441\u043b\u0443\u0433\u0438',v1:Number(snap1.revenue_services)||0,v2:snap2 ? Number(snap2.revenue_services)||0 : 0,color:'#8B5CF6',icon:'fa-concierge-bell'},
        {label:'\u0412\u044b\u043a\u0443\u043f\u044b',v1:Number(snap1.revenue_articles)||0,v2:snap2 ? Number(snap2.revenue_articles)||0 : 0,color:'#F59E0B',icon:'fa-shopping-bag'},
        {label:'\u0412\u043e\u0437\u0432\u0440\u0430\u0442\u044b',v1:Number(snap1.refunds)||0,v2:snap2 ? Number(snap2.refunds)||0 : 0,color:'#f87171',icon:'fa-undo',isExpense:true},
        // ===== EXPENSES =====
        {label:'\u0420\u0430\u0441\u0445\u043e\u0434\u044b',section:true},
        {label:'\u0417\u041f + \u0411\u043e\u043d\u0443\u0441\u044b',v1:Number(snap1.expense_salaries)||0,v2:snap2 ? Number(snap2.expense_salaries)||0 : 0,color:'#3B82F6',icon:'fa-users',isExpense:true,
          detail1: '\u0417\u041f: ' + fmtAmt(Number(cd1.salary_base)||Number(snap1.expense_salaries)||0) + (cd1.bonuses_net !== undefined ? ' | \u0411\u043e\u043d/\u0428\u0442\u0440: ' + fmtAmt(cd1.bonuses_net) : '') + (cd1.date_from ? ' | ' + cd1.date_from + ' \u2014 ' + (cd1.date_to || '\u0441\u0435\u0439\u0447\u0430\u0441') : ''),
          detail2: snap2 ? '\u0417\u041f: ' + fmtAmt(Number(cd2.salary_base)||Number(snap2.expense_salaries)||0) + (cd2.bonuses_net !== undefined ? ' | \u0411\u043e\u043d/\u0428\u0442\u0440: ' + fmtAmt(cd2.bonuses_net) : '') + (cd2.date_from ? ' | ' + cd2.date_from + ' \u2014 ' + (cd2.date_to || '\u0441\u0435\u0439\u0447\u0430\u0441') : '') : ''},
        {label:'\u041a\u043e\u043c\u043c\u0435\u0440\u0447\u0435\u0441\u043a\u0438\u0435',v1:Number(snap1.expense_commercial)||0,v2:snap2 ? Number(snap2.expense_commercial)||0 : 0,color:'#EF4444',icon:'fa-store',isExpense:true},
        {label:'\u041c\u0430\u0440\u043a\u0435\u0442\u0438\u043d\u0433',v1:Number(snap1.expense_marketing)||0,v2:snap2 ? Number(snap2.expense_marketing)||0 : 0,color:'#EC4899',icon:'fa-bullhorn',isExpense:true},
        {label:'\u0420\u0430\u0441\u0445\u043e\u0434\u044b (\u0438\u0442\u043e\u0433\u043e)',v1:exp1,v2:exp2,color:'#EF4444',icon:'fa-receipt',isExpense:true,bold:true},
        // ===== PROFIT =====
        {label:'\u041f\u0440\u0438\u0431\u044b\u043b\u044c',section:true},
        {label:'\u0427\u0438\u0441\u0442\u0430\u044f \u043f\u0440\u0438\u0431\u044b\u043b\u044c',v1:Number(snap1.net_profit)||0,v2:snap2 ? Number(snap2.net_profit)||0 : 0,color:'#22C55E',icon:'fa-chart-line',bold:true},
        {label:'\u041c\u0430\u0440\u0436\u0430 \u043f\u0440\u0438\u0431\u044b\u043b\u0438 %',v1:snap1ProfitMargin,v2:snap2ProfitMargin,color:'#10B981',icon:'fa-percentage',isPct:true},
        // ===== LEADS =====
        {label:'\u041b\u0438\u0434\u044b',section:true},
        {label:'\u041b\u0438\u0434\u044b (\u0432\u0441\u0435\u0433\u043e)',v1:Number(snap1.leads_count)||0,v2:snap2 ? Number(snap2.leads_count)||0 : 0,color:'#10B981',icon:'fa-users',isCnt:true},
        {label:'\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043e',v1:Number(snap1.leads_done)||0,v2:snap2 ? Number(snap2.leads_done)||0 : 0,color:'#22C55E',icon:'fa-check-circle',isCnt:true},
        {label:'\u0421\u0440. \u0447\u0435\u043a (\u0443\u0441\u043b\u0443\u0433\u0438)',v1:snap1AvgCheck,v2:snap2AvgCheck,color:'#8B5CF6',icon:'fa-shopping-cart'},
        // ===== KPI =====
        {label:'\u041a\u043b\u044e\u0447\u0435\u0432\u044b\u0435 KPI',section:true},
        {label:'\u041a\u043e\u043d\u0432\u0435\u0440\u0441\u0438\u044f',v1:Number(cd1.conversion_rate)||0,v2:snap2 ? Number(cd2.conversion_rate)||0 : 0,color:'#F59E0B',icon:'fa-percentage',isPct:true},
        {label:'\u041c\u0430\u0440\u0436\u0438\u043d\u0430\u043b\u044c\u043d\u043e\u0441\u0442\u044c',v1:Number(cd1.marginality)||0,v2:snap2 ? Number(cd2.marginality)||0 : 0,color:'#10B981',icon:'fa-percentage',isPct:true},
        {label:'ROI',v1:Number(cd1.roi)||0,v2:snap2 ? Number(cd2.roi)||0 : 0,color:'#3B82F6',icon:'fa-chart-bar',isPct:true},
        {label:'ROMI',v1:Number(cd1.romi)||0,v2:snap2 ? Number(cd2.romi)||0 : 0,color:'#EC4899',icon:'fa-bullhorn',isPct:true},
        // ===== PRO METRICS =====
        {label:'\u041f\u0440\u043e\u0444-\u043c\u0435\u0442\u0440\u0438\u043a\u0438',section:true},
        {label:'CPL (\u0441\u0442\u043e\u0438\u043c. \u043b\u0438\u0434\u0430)',v1:snap1CPL,v2:snap2CPL,color:'#F97316',icon:'fa-tag',isExpense:true},
        {label:'CPA (\u0441\u0442\u043e\u0438\u043c. \u043a\u043b\u0438\u0435\u043d\u0442\u0430)',v1:snap1CPA,v2:snap2CPA,color:'#EF4444',icon:'fa-crosshairs',isExpense:true},
        {label:'\u0414\u043e\u0445\u043e\u0434 \u043d\u0430 \u043b\u0438\u0434',v1:snap1RPL,v2:snap2RPL,color:'#22C55E',icon:'fa-hand-holding-usd'},
        {label:'LTV (\u043e\u0446\u0435\u043d\u043a\u0430)',v1:snap1LTV,v2:snap2LTV,color:'#a78bfa',icon:'fa-gem'},
      ];
      // Period status labels
      var snap1Lbl = snap1.period_key + (snap1.is_locked ? ' \ud83d\udd12' : ' (\u0442\u0435\u043a\u0443\u0449\u0438\u0439)');
      var snap2Lbl = snap2 ? snap2.period_key + (snap2.is_locked ? ' \ud83d\udd12' : ' (\u0442\u0435\u043a\u0443\u0449\u0438\u0439)') : '';
      var isSingleView = !snap2;
      h += '<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.82rem">';
      h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155">';
      h += '<th style="padding:10px 16px;text-align:left;color:#94a3b8">\u041c\u0435\u0442\u0440\u0438\u043a\u0430</th>';
      h += '<th style="padding:10px;text-align:right;color:#a78bfa">' + snap1Lbl + '</th>';
      if (!isSingleView) {
        h += '<th style="padding:10px;text-align:right;color:#F59E0B">' + snap2Lbl + '</th>';
        h += '<th style="padding:10px;text-align:right;color:#94a3b8">\u0394 \u0420\u0430\u0437\u043d\u0438\u0446\u0430</th>';
        h += '<th style="padding:10px;text-align:right;color:#94a3b8;min-width:120px">% \u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0435</th>';
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
          if (m.isPct) return (d2 > 0 ? '+' : '') + d2.toFixed(1) + ' \u043f.\u043f.';
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
            var arrow = (cm.isExpense ? (diff > 0 ? '\u2191' : '\u2193') : (diff > 0 ? '\u2191' : '\u2193'));
            var absPct = Math.min(Math.abs(diffPctVal), 999);
            var barW = Math.max(Math.min(absPct * 0.6, 100), 4);
            h += '<div style="display:inline-flex;align-items:center;gap:6px;justify-content:flex-end">';
            h += '<div style="width:60px;height:6px;background:#1e293b;border-radius:3px;overflow:hidden;display:inline-block"><div style="width:' + barW + '%;height:100%;background:' + diffColor + ';border-radius:3px"></div></div>';
            h += '<span>' + arrow + ' ' + (diffPctVal > 0 ? '+' : '') + diffPctVal.toFixed(1) + '%</span>';
            h += '</div>';
          } else { h += '<span style="color:#64748b">\u2014</span>'; }
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
        for (var si4 = 0; si4 < cmpMetrics.length; si4++) {
          var m2 = cmpMetrics[si4];
          if (m2.section || m2.isCnt) continue;
          var d4 = (m2.v1||0) - (m2.v2||0);
          if (d4 === 0) continue;
          totalMetrics++;
          if (m2.isExpense) { if (d4 < 0) improvCount++; else declineCount++; }
          else { if (d4 > 0) improvCount++; else declineCount++; }
        }
        var healthScore = totalMetrics > 0 ? Math.round((improvCount / totalMetrics) * 100) : 0;
        var healthColor = healthScore >= 60 ? '#22C55E' : healthScore >= 40 ? '#F59E0B' : '#EF4444';
        var healthIcon = healthScore >= 60 ? 'fa-arrow-trend-up' : healthScore >= 40 ? 'fa-arrows-alt-h' : 'fa-arrow-trend-down';
        var healthLabel = healthScore >= 60 ? '\u041f\u043e\u0437\u0438\u0442\u0438\u0432\u043d\u0430\u044f \u0434\u0438\u043d\u0430\u043c\u0438\u043a\u0430' : healthScore >= 40 ? '\u0421\u0442\u0430\u0431\u0438\u043b\u044c\u043d\u043e' : '\u0422\u0440\u0435\u0431\u0443\u0435\u0442 \u0432\u043d\u0438\u043c\u0430\u043d\u0438\u044f';
        h += '<div class="card" style="padding:20px;margin-top:16px;border:2px solid ' + healthColor + '33">';
        h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">';
        h += '<div style="width:50px;height:50px;border-radius:50%;background:' + healthColor + '15;display:flex;align-items:center;justify-content:center"><i class="fas ' + healthIcon + '" style="color:' + healthColor + ';font-size:1.2rem"></i></div>';
        h += '<div><div style="font-weight:700;font-size:1rem;color:' + healthColor + '">' + healthLabel + '</div>';
        h += '<div style="font-size:0.78rem;color:#94a3b8">\u0417\u0434\u043e\u0440\u043e\u0432\u044c\u0435 \u0431\u0438\u0437\u043d\u0435\u0441\u0430: ' + healthScore + '% | \u0423\u043b\u0443\u0447\u0448\u0435\u043d\u0438\u044f: ' + improvCount + ' | \u0421\u043d\u0438\u0436\u0435\u043d\u0438\u044f: ' + declineCount + '</div></div></div>';
        // Key insights
        var profitDiff = (Number(snap1.net_profit)||0) - (Number(snap2.net_profit)||0);
        var revDiff = (Number(snap1.revenue_services)||0) - (Number(snap2.revenue_services)||0);
        var expDiffCalc = exp1 - exp2;
        h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">';
        h += '<div style="padding:10px;border-radius:8px;background:#0f172a;text-align:center"><div style="font-size:0.68rem;color:#94a3b8">\u041f\u0440\u0438\u0431\u044b\u043b\u044c \u0414</div><div style="font-weight:700;font-size:1rem;color:' + (profitDiff >= 0 ? '#22C55E' : '#EF4444') + '">' + (profitDiff >= 0 ? '+' : '') + fmtAmt(profitDiff) + '</div></div>';
        h += '<div style="padding:10px;border-radius:8px;background:#0f172a;text-align:center"><div style="font-size:0.68rem;color:#94a3b8">\u0412\u044b\u0440\u0443\u0447\u043a\u0430 \u0414</div><div style="font-weight:700;font-size:1rem;color:' + (revDiff >= 0 ? '#22C55E' : '#EF4444') + '">' + (revDiff >= 0 ? '+' : '') + fmtAmt(revDiff) + '</div></div>';
        h += '<div style="padding:10px;border-radius:8px;background:#0f172a;text-align:center"><div style="font-size:0.68rem;color:#94a3b8">\u0420\u0430\u0441\u0445\u043e\u0434\u044b \u0414</div><div style="font-weight:700;font-size:1rem;color:' + (expDiffCalc <= 0 ? '#22C55E' : '#EF4444') + '">' + (expDiffCalc > 0 ? '+' : '') + fmtAmt(expDiffCalc) + '</div></div>';
        h += '</div></div>';
      }
    } else {
      h += '<div class="card" style="padding:20px;text-align:center;color:#475569"><i class="fas fa-arrows-alt-h" style="margin-right:8px"></i>\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0435\u0440\u0438\u043e\u0434 \u0434\u043b\u044f \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430 (\u0438\u043b\u0438 \u0434\u0432\u0430 \u0434\u043b\u044f \u0441\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u044f)</div>';
    }
  } else {
    h += '<div class="card" style="padding:24px;text-align:center;color:#475569"><i class="fas fa-info-circle" style="margin-right:8px"></i>\u0417\u0430\u043a\u0440\u043e\u0439\u0442\u0435 \u043f\u0435\u0440\u0432\u044b\u0439 \u043c\u0435\u0441\u044f\u0446 \u0447\u0442\u043e\u0431\u044b \u0443\u0432\u0438\u0434\u0435\u0442\u044c \u0441\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435</div>';
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
  if (!name) { toast('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435', 'error'); return; }
  var body = { name: name, amount: amount, category_id: categoryId ? Number(categoryId) : null, frequency_type_id: freqId ? Number(freqId) : null, notes: notes, start_date: startDate, end_date: endDate };
  var res = await api('/expenses/' + id, 'PUT', body);
  if (res && res.success) { toast('\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e'); editingExpenseId = 0; var r = await api('/expenses'); data.expenses = (r&&r.expenses)||[]; analyticsData = null; loadAnalyticsData(); }
  else { toast(res?.error || '\u041e\u0448\u0438\u0431\u043a\u0430', 'error'); }
}

async function updateUserSalary(userId, field, value) {
  var body = {};
  body[field] = value;
  var res = await api('/users/' + userId + '/salary', 'PUT', body);
  if (res && res.success) { toast('Обновлено'); var r = await api('/users'); data.users = r || []; analyticsData = null; loadAnalyticsData(); }
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
  if (!amt) { toast('\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0441\u0443\u043c\u043c\u0443', 'error'); return; }
  var actualAmt = bonusType === 'fine' ? -Math.abs(amt) : Math.abs(amt);
  var res = await api('/bonuses/' + bonusId, 'PUT', { amount: actualAmt, description: desc, bonus_date: bdate });
  if (res && res.success) {
    toast('\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e');
    editingBonusId = 0;
    var r = await api('/users/' + userId + '/bonuses');
    bonusListData = (r && r.bonuses) || [];
    analyticsData = null; loadAnalyticsData();
  } else { toast(res?.error || '\u041e\u0448\u0438\u0431\u043a\u0430', 'error'); }
}

// ===== PERIOD ACTIONS =====
async function saveEditedMonth(monthKey, snapshotId) {
  var svc = Number(document.getElementById('edit-svc-' + monthKey)?.value) || 0;
  var art = Number(document.getElementById('edit-art-' + monthKey)?.value) || 0;
  var ref = Number(document.getElementById('edit-ref-' + monthKey)?.value) || 0;
  var exp = Number(document.getElementById('edit-exp-' + monthKey)?.value) || 0;
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
  if (mSnap2) { try { var cd6 = JSON.parse(mSnap2.custom_data || '{}'); existingAdjs = cd6.adjustments || []; if (!existingAdjs.length && cd6.adjustment) { existingAdjs = [{amount: Math.abs(cd6.adjustment), type: cd6.adjustment_type || 'inflow', comment: cd6.adjustment_comment || ''}]; } } catch {} }
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
  var customData = { adjustments: existingAdjs, status: status, status_label: statusLabel, in_progress_count: inprog, rejected_count: rejected, checking_count: checking };
  if (snapshotId > 0) {
    // Update existing snapshot
    var res = await api('/period-snapshots/' + snapshotId, 'PUT', {
      revenue_services: svc, revenue_articles: art, refunds: ref,
      expense_salaries: 0, expense_commercial: exp, expense_marketing: 0,
      net_profit: profit, total_turnover: turnover,
      leads_done: done, leads_count: done + inprog + rejected + checking,
      custom_data: customData
    });
    if (res && res.success) {
      toast('Данные за ' + monthKey + ' обновлены');
      editingMonthKey = '';
      // If status changed to locked, also lock the snapshot
      if (isLocked2 && mSnap2 && !mSnap2.is_locked) {
        await api('/period-snapshots', 'POST', { period_type: 'month', period_key: monthKey, revenue_services: svc, revenue_articles: art, total_turnover: turnover, refunds: ref, expense_salaries: 0, expense_commercial: exp, expense_marketing: 0, net_profit: profit, leads_count: done+inprog+rejected+checking, leads_done: done, avg_check: done > 0 ? Math.round(svc/done) : 0, is_locked: true, custom_data: customData });
      }
      try { var snRes = await api('/period-snapshots'); data.periodSnapshots = (snRes && snRes.snapshots) || []; } catch(e) {}
      analyticsData = null; loadAnalyticsData();
    } else { toast(res?.error || 'Ошибка сохранения', 'error'); }
  } else {
    // Create new snapshot for this month
    var res2 = await api('/period-snapshots', 'POST', {
      period_type: 'month', period_key: monthKey,
      revenue_services: svc, revenue_articles: art, total_turnover: turnover, refunds: ref,
      expense_salaries: 0, expense_commercial: exp, expense_marketing: 0,
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
  try { var cd7 = JSON.parse(mSnap3.custom_data || '{}'); adjs = cd7.adjustments || []; if (!adjs.length && cd7.adjustment) { adjs = [{amount: Math.abs(cd7.adjustment), type: cd7.adjustment_type || 'inflow', comment: cd7.adjustment_comment || ''}]; } } catch {}
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
    try { var snRes3 = await api('/period-snapshots'); data.periodSnapshots = (snRes3 && snRes3.snapshots) || []; } catch {}
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

  var body = {
    period_type: periodType,
    period_key: periodKey,
    revenue_services: fin.services || 0,
    revenue_articles: fin.articles || 0,
    total_turnover: fin.turnover || 0,
    refunds: fin.refunds || 0,
    expense_salaries: (fin.salaries || 0) + (fin.bonuses || 0) + (fin.fines || 0),
    expense_commercial: fin.commercial_expenses || 0,
    expense_marketing: fin.marketing_expenses || 0,
    net_profit: (fin.services || 0) - (fin.total_expenses || 0), // Прибыль = Услуги - Расходы
    leads_count: d.total_leads || 0,
    leads_done: (d.status_data && d.status_data.done) ? d.status_data.done.count || 0 : 0,
    avg_check: ((d.status_data && d.status_data.done && d.status_data.done.count > 0) ? fin.avg_check || 0 : 0),
    is_locked: lock,
    custom_data: {
      conversion_rate: fin.conversion_rate,
      marginality: fin.marginality,
      roi: fin.roi,
      romi: fin.romi,
      date_from: d.date_from,
      date_to: d.date_to,
      salary_base: fin.salaries || 0,
      bonuses_net: (fin.bonuses || 0) + (fin.fines || 0),
      in_progress_count: ((d.status_data && d.status_data.in_progress) ? d.status_data.in_progress.count || 0 : 0) + ((d.status_data && d.status_data.contacted) ? d.status_data.contacted.count || 0 : 0),
      rejected_count: (d.status_data && d.status_data.rejected) ? d.status_data.rejected.count || 0 : 0,
      checking_count: (d.status_data && d.status_data.checking) ? d.status_data.checking.count || 0 : 0,
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


// ===== TELEGRAM BOT =====
function renderTelegramBot() {
  var bots = data.telegramBot || [];
  var h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Telegram Бот / Уведомления</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Настройка бота для автоматических уведомлений о новых заявках</p>' +
    '<button class="btn btn-primary" style="margin-bottom:20px" onclick="addTgBot()"><i class="fas fa-plus" style="margin-right:6px"></i>Добавить получателя</button>';

  for (var i = 0; i < bots.length; i++) {
    var b = bots[i];
    h += '<div class="card" style="margin-bottom:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
        '<div><strong>' + escHtml(b.chat_name || 'Chat ' + b.chat_id) + '</strong>' +
          (b.is_active ? ' <span class="badge badge-green">Активен</span>' : ' <span class="badge" style="background:rgba(239,68,68,0.2);color:#f87171">Выкл</span>') +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-success" style="padding:6px 12px;font-size:0.8rem" onclick="saveTgBot(' + b.id + ')"><i class="fas fa-save"></i></button>' +
          '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.8rem" onclick="testTgBot(' + b.id + ')"><i class="fas fa-paper-plane"></i> Тест</button>' +
          '<button class="btn btn-danger" style="padding:6px 12px;font-size:0.8rem" onclick="deleteTgBot(' + b.id + ')"><i class="fas fa-trash"></i></button>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Bot Token</label><input class="input" value="' + escHtml(b.bot_token) + '" id="tgb_token_' + b.id + '" type="password"></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Chat ID</label><input class="input" value="' + escHtml(b.chat_id) + '" id="tgb_chat_' + b.id + '"></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Название чата</label><input class="input" value="' + escHtml(b.chat_name) + '" id="tgb_name_' + b.id + '"></div>' +
        '<div style="display:flex;align-items:center;gap:8px;padding-top:18px"><input type="checkbox" id="tgb_leads_' + b.id + '"' + (b.notify_leads ? ' checked' : '') + '><label style="font-size:0.85rem;color:#94a3b8">Уведомлять о лидах</label></div>' +
        '<div style="display:flex;align-items:center;gap:8px;padding-top:18px"><input type="checkbox" id="tgb_calc_' + b.id + '"' + (b.notify_calc ? ' checked' : '') + '><label style="font-size:0.85rem;color:#94a3b8">Уведомлять о PDF</label></div>' +
      '</div>' +
    '</div>';
  }

  if (!bots.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-robot" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8">Получатели уведомлений не настроены. Добавьте бота и Chat ID для получения уведомлений о заявках.</p></div>';
  }
  h += '</div>';
  return h;
}

async function addTgBot() {
  await api('/telegram-bot', { method: 'POST', body: JSON.stringify({ bot_token: '8168691099:AAEdDYZ2RPCM99QWsgRKu_dcHsne2c4Sd_U', chat_id: '', chat_name: 'Новый получатель', notify_leads: 1, notify_calc: 0 }) });
  toast('Получатель добавлен');
  await loadData(); render();
}

async function saveTgBot(id) {
  await api('/telegram-bot/' + id, { method: 'PUT', body: JSON.stringify({
    bot_token: document.getElementById('tgb_token_' + id).value,
    chat_id: document.getElementById('tgb_chat_' + id).value,
    chat_name: document.getElementById('tgb_name_' + id).value,
    notify_leads: document.getElementById('tgb_leads_' + id).checked ? 1 : 0,
    notify_calc: document.getElementById('tgb_calc_' + id).checked ? 1 : 0,
    is_active: 1
  }) });
  toast('Сохранено');
  await loadData(); render();
}

async function testTgBot(id) {
  var token = document.getElementById('tgb_token_' + id).value;
  var chatId = document.getElementById('tgb_chat_' + id).value;
  if (!token || !chatId) { toast('Заполните Token и Chat ID', 'error'); return; }
  var res = await api('/telegram-bot/test', { method: 'POST', body: JSON.stringify({ bot_token: token, chat_id: chatId, message: '✅ Тестовое сообщение от Go to Top admin panel!' }) });
  if (res && res.success) toast('Сообщение отправлено!');
  else toast('Ошибка: ' + (res?.error || 'unknown'), 'error');
}

async function deleteTgBot(id) {
  if (!confirm('Удалить этого получателя?')) return;
  await api('/telegram-bot/' + id, { method: 'DELETE' });
  toast('Удалён');
  await loadData(); render();
}

// ===== PDF TEMPLATE =====
function renderPdfTemplate() {
  var t = data.pdfTemplate || {};
  var h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Шаблон PDF (Коммерческое предложение)</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Тексты для автоматически генерируемого PDF-файла калькулятора</p>' +
    '<div class="card">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +
      '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Заголовок (RU)</label><input class="input" id="pdf_header_ru" value="' + escHtml(t.header_ru) + '"></div>' +
      '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Заголовок (AM)</label><input class="input" id="pdf_header_am" value="' + escHtml(t.header_am) + '"></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +
      '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Вступление (RU)</label><textarea class="input" id="pdf_intro_ru">' + escHtml(t.intro_ru) + '</textarea></div>' +
      '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Вступление (AM)</label><textarea class="input" id="pdf_intro_am">' + escHtml(t.intro_am) + '</textarea></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +
      '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Завершение (RU)</label><textarea class="input" id="pdf_outro_ru">' + escHtml(t.outro_ru) + '</textarea></div>' +
      '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Завершение (AM)</label><textarea class="input" id="pdf_outro_am">' + escHtml(t.outro_am) + '</textarea></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +
      '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Подпись/Footer (RU)</label><input class="input" id="pdf_footer_ru" value="' + escHtml(t.footer_ru) + '"></div>' +
      '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Подпись/Footer (AM)</label><input class="input" id="pdf_footer_am" value="' + escHtml(t.footer_am) + '"></div>' +
    '</div>' +
    '<h3 style="font-weight:700;margin:20px 0 12px;color:#a78bfa"><i class="fas fa-building" style="margin-right:8px"></i>Данные компании</h3>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +
      '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Название компании</label><input class="input" id="pdf_company" value="' + escHtml(t.company_name) + '"></div>' +
      '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Телефон</label><input class="input" id="pdf_phone" value="' + escHtml(t.company_phone) + '"></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">' +
      '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Email</label><input class="input" id="pdf_email" value="' + escHtml(t.company_email) + '"></div>' +
      '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Адрес</label><input class="input" id="pdf_address" value="' + escHtml(t.company_address) + '"></div>' +
    '</div>' +
    '<h3 style="font-weight:700;margin:20px 0 12px;color:#a78bfa"><i class="fas fa-hand-pointer" style="margin-right:8px"></i>Кнопки на странице КП</h3>' +
    '<p style="color:#94a3b8;font-size:0.82rem;margin-bottom:12px">Настройте названия кнопок на странице расчёта</p>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +
      '<div><label style="font-size:0.75rem;color:#10B981;font-weight:600">Кнопка «Заказать» (RU)</label><input class="input" id="pdf_btn_order_ru" value="' + escHtml(t.btn_order_ru || 'Заказать сейчас') + '"></div>' +
      '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Кнопка «Заказать» (AM)</label><input class="input" id="pdf_btn_order_am" value="' + escHtml(t.btn_order_am || 'Պատվիրել հիմա') + '"></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +
      '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Кнопка «Скачать» (RU)</label><input class="input" id="pdf_btn_dl_ru" value="' + escHtml(t.btn_download_ru || 'Скачать') + '"></div>' +
      '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Кнопка «Скачать» (AM)</label><input class="input" id="pdf_btn_dl_am" value="' + escHtml(t.btn_download_am || 'Ներбেறնел') + '"></div>' +
    '</div>' +
    '<div style="margin-bottom:20px"><label style="font-size:0.75rem;color:#64748b;font-weight:600">Telegram URL менеджера (для кнопки «Заказать»)</label><input class="input" id="pdf_order_tg" value="' + escHtml(t.order_telegram_url || 'https://t.me/goo_to_top') + '" placeholder="https://t.me/your_username"></div>' +
    '<button class="btn btn-success" onclick="savePdfTemplate()"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить шаблон</button>' +
    '</div></div>';
  return h;
}

async function savePdfTemplate() {
  await api('/pdf-template', { method: 'PUT', body: JSON.stringify({
    header_ru: document.getElementById('pdf_header_ru').value,
    header_am: document.getElementById('pdf_header_am').value,
    intro_ru: document.getElementById('pdf_intro_ru').value,
    intro_am: document.getElementById('pdf_intro_am').value,
    outro_ru: document.getElementById('pdf_outro_ru').value,
    outro_am: document.getElementById('pdf_outro_am').value,
    footer_ru: document.getElementById('pdf_footer_ru').value,
    footer_am: document.getElementById('pdf_footer_am').value,
    company_name: document.getElementById('pdf_company').value,
    company_phone: document.getElementById('pdf_phone').value,
    company_email: document.getElementById('pdf_email').value,
    company_address: document.getElementById('pdf_address').value,
    btn_order_ru: document.getElementById('pdf_btn_order_ru').value,
    btn_order_am: document.getElementById('pdf_btn_order_am').value,
    btn_download_ru: document.getElementById('pdf_btn_dl_ru').value,
    btn_download_am: document.getElementById('pdf_btn_dl_am').value,
    order_telegram_url: document.getElementById('pdf_order_tg').value
  }) });
  toast('Шаблон PDF сохранён');
}

// ===== SLOT COUNTER =====
function renderSlotCounter() {
  var counters = data.slotCounters || [];
  // Build positions from section order dynamically
  var positions = [];
  var sections = data.sectionOrder || [];
  for (var si = 0; si < sections.length; si++) {
    var sid = sections[si].section_id;
    var sLabel = sections[si].label_ru || sid;
    positions.push({ id: 'before-' + sid, label: '⬆ Перед: ' + sLabel });
    positions.push({ id: 'after-' + sid, label: '⬇ После: ' + sLabel });
    positions.push({ id: 'in-' + sid, label: '📍 Внутри: ' + sLabel });
  }
  // Fallback positions
  if (positions.length === 0) {
    positions = [
      { id: 'in-header', label: 'В шапке сайта' },
      { id: 'after-hero', label: 'После Hero' },
      { id: 'before-calc', label: 'Перед калькулятором' },
      { id: 'before-contact', label: 'Перед контактами' }
    ];
  }

  var h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px"><i class="fas fa-clock" style="color:#8B5CF6;margin-right:10px"></i>Счётчики свободных мест</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Создавайте неограниченное количество счётчиков и размещайте их в любом блоке сайта</p>';

  h += '<button class="btn btn-primary" style="margin-bottom:20px" onclick="addSlotCounter()"><i class="fas fa-plus" style="margin-right:6px"></i>Добавить счётчик</button>';

  for (var ci = 0; ci < counters.length; ci++) {
    var s = counters[ci];
    var cid = s.id;
    var pos = s.position || 'after-hero';
    var free = Math.max(0, (s.total_slots || 10) - (s.booked_slots || 0));
    var pct = s.total_slots > 0 ? Math.round((free / s.total_slots) * 100) : 0;
    var barColor = pct > 50 ? '#10B981' : pct > 20 ? '#F59E0B' : '#EF4444';

    h += '<div class="card" style="margin-bottom:20px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<h3 style="font-weight:700;display:flex;align-items:center;gap:10px"><i class="fas fa-hashtag" style="color:#8B5CF6"></i>Счётчик #' + (ci+1) + ' <span style="color:#a78bfa;font-size:0.9rem">' + escHtml(s.counter_name || 'main') + '</span>' +
      (s.show_timer ? ' <span class="badge badge-green">Видим</span>' : ' <span class="badge" style="background:rgba(239,68,68,0.2);color:#f87171">Скрыт</span>') +
      '</h3>' +
      '<button class="btn btn-danger" style="font-size:0.8rem;padding:6px 14px" onclick="deleteSlotCounter('+cid+')"><i class="fas fa-trash"></i></button>' +
      '</div>' +

      // Visual bar preview
      '<div style="margin-bottom:16px;padding:12px;background:#0f172a;border-radius:8px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<span style="font-size:0.82rem;color:#94a3b8">' + escHtml(s.label_ru || 'Свободных мест') + '</span>' +
          '<span style="font-size:1.4rem;font-weight:800;color:' + barColor + '">' + free + '<span style="color:#64748b;font-weight:400;font-size:0.85rem"> / ' + s.total_slots + '</span></span>' +
        '</div>' +
        '<div style="height:8px;background:#1e293b;border-radius:4px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:4px;transition:width 0.3s"></div></div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:16px">' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Имя</label><input class="input" id="sc_name_'+cid+'" value="' + escHtml(s.counter_name) + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Всего мест</label><input class="input" type="number" id="sc_total_'+cid+'" value="' + (s.total_slots || 10) + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Занято</label><input class="input" type="number" id="sc_booked_'+cid+'" value="' + (s.booked_slots || 0) + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Свободно</label><div style="font-size:1.8rem;font-weight:800;color:#10B981;padding:6px 0">' + free + '</div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Надпись (RU)</label><input class="input" id="sc_lru_'+cid+'" value="' + escHtml(s.label_ru) + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Надпись (AM)</label><input class="input" id="sc_lam_'+cid+'" value="' + escHtml(s.label_am) + '"></div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><input type="checkbox" id="sc_show_'+cid+'"' + (s.show_timer ? ' checked' : '') + '><label style="font-size:0.9rem;color:#94a3b8">Показывать на сайте</label></div>' +
      '<div style="margin-bottom:12px"><label style="font-size:0.75rem;color:#64748b;font-weight:600;margin-bottom:8px;display:block">Позиция на странице (привязка к блоку)</label><select class="input" id="sc_pos_'+cid+'" style="cursor:pointer">';
    for (var pi = 0; pi < positions.length; pi++) {
      h += '<option value="'+positions[pi].id+'"'+(pos===positions[pi].id?' selected':'')+'>'+escHtml(positions[pi].label)+'</option>';
    }
    h += '</select></div>' +
      '<button class="btn btn-success" onclick="saveSlotCounter('+cid+')"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить</button>' +
    '</div>';
  }

  if (counters.length === 0) {
    h += '<div class="card" style="text-align:center;padding:40px;color:#64748b"><i class="fas fa-clock" style="font-size:3rem;color:#334155;margin-bottom:12px;display:block"></i>Нет счётчиков. Нажмите «Добавить счётчик» чтобы создать.</div>';
  }

  h += '</div>';
  return h;
}

async function addSlotCounter() {
  await api('/slot-counter', { method: 'POST', body: JSON.stringify({ counter_name: 'Счётчик ' + ((data.slotCounters || []).length + 1), total_slots: 10, booked_slots: 0, show_timer: 1, position: 'after-hero' }) });
  toast('Счётчик создан');
  await loadData(); render();
}

async function saveSlotCounter(id) {
  await api('/slot-counter/' + id, { method: 'PUT', body: JSON.stringify({
    counter_name: document.getElementById('sc_name_'+id).value,
    total_slots: parseInt(document.getElementById('sc_total_'+id).value) || 10,
    booked_slots: parseInt(document.getElementById('sc_booked_'+id).value) || 0,
    label_ru: document.getElementById('sc_lru_'+id).value,
    label_am: document.getElementById('sc_lam_'+id).value,
    show_timer: document.getElementById('sc_show_'+id).checked ? 1 : 0,
    position: document.getElementById('sc_pos_'+id).value
  }) });
  toast('Счётчик обновлён');
  await loadData(); render();
}

async function deleteSlotCounter(id) {
  if (!confirm('Удалить счётчик?')) return;
  await api('/slot-counter/' + id, { method: 'DELETE' });
  toast('Счётчик удалён');
  await loadData(); render();
}

// ===== FOOTER =====
function renderFooter() {
  var f = data.footer || {};
  var contacts = [];
  try { contacts = JSON.parse(f.contacts_json || '[]'); } catch { contacts = []; }
  var socials = [];
  try { socials = JSON.parse(f.socials_json || '[]'); } catch { socials = []; }

  var h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Футер сайта</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Редактирование контактов, соцсетей и содержимого подвала</p>';

  // Brand text
  h += '<div class="card" style="margin-bottom:20px"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-building" style="color:#8B5CF6;margin-right:8px"></i>Описание компании</h3>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
    '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Текст (RU)</label><textarea class="input" id="ft_brand_ru" rows="3">' + escHtml(f.brand_text_ru) + '</textarea></div>' +
    '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Текст (AM)</label><textarea class="input" id="ft_brand_am" rows="3">' + escHtml(f.brand_text_am) + '</textarea></div>' +
    '</div></div>';

  // Contacts
  h += '<div class="card" style="margin-bottom:20px"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-address-book" style="color:#10B981;margin-right:8px"></i>Контакты <button class="btn btn-outline" style="font-size:0.75rem;padding:4px 12px;margin-left:12px" onclick="addFooterContact()"><i class="fas fa-plus"></i> Добавить</button></h3>';
  h += '<div id="footerContactsList">';
  for (var ci = 0; ci < contacts.length; ci++) {
    var ct = contacts[ci];
    h += '<div style="display:grid;grid-template-columns:auto 1fr 1fr auto;gap:8px;align-items:center;margin-bottom:8px;padding:10px;background:#0f172a;border-radius:8px">' +
      '<select class="input" style="width:140px" id="fc_icon_'+ci+'"><option value="fab fa-telegram"'+(ct.icon==='fab fa-telegram'?' selected':'')+'>Telegram</option><option value="fab fa-whatsapp"'+(ct.icon==='fab fa-whatsapp'?' selected':'')+'>WhatsApp</option><option value="fas fa-phone"'+(ct.icon==='fas fa-phone'?' selected':'')+'>Телефон</option><option value="fas fa-envelope"'+(ct.icon==='fas fa-envelope'?' selected':'')+'>Email</option><option value="fab fa-instagram"'+(ct.icon==='fab fa-instagram'?' selected':'')+'>Instagram</option></select>' +
      '<input class="input" placeholder="Название (RU)" id="fc_name_'+ci+'" value="'+escHtml(ct.name_ru)+'">' +
      '<input class="input" placeholder="Ссылка/URL" id="fc_url_'+ci+'" value="'+escHtml(ct.url)+'">' +
      '<button class="tier-del-btn" onclick="removeFooterContact('+ci+')"><i class="fas fa-times"></i></button>' +
    '</div>';
  }
  h += '</div></div>';

  // Social links
  h += '<div class="card" style="margin-bottom:20px"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-share-alt" style="color:#F59E0B;margin-right:8px"></i>Соцсети <button class="btn btn-outline" style="font-size:0.75rem;padding:4px 12px;margin-left:12px" onclick="addFooterSocial()"><i class="fas fa-plus"></i> Добавить</button></h3>';
  h += '<div id="footerSocialsList">';
  for (var si = 0; si < socials.length; si++) {
    var sc = socials[si];
    h += '<div style="display:grid;grid-template-columns:auto 1fr 1fr auto;gap:8px;align-items:center;margin-bottom:8px;padding:10px;background:#0f172a;border-radius:8px">' +
      '<select class="input" style="width:140px" id="fs_icon_'+si+'"><option value="fab fa-telegram"'+(sc.icon==='fab fa-telegram'?' selected':'')+'>Telegram</option><option value="fab fa-whatsapp"'+(sc.icon==='fab fa-whatsapp'?' selected':'')+'>WhatsApp</option><option value="fab fa-instagram"'+(sc.icon==='fab fa-instagram'?' selected':'')+'>Instagram</option><option value="fab fa-facebook"'+(sc.icon==='fab fa-facebook'?' selected':'')+'>Facebook</option><option value="fab fa-youtube"'+(sc.icon==='fab fa-youtube'?' selected':'')+'>YouTube</option><option value="fab fa-tiktok"'+(sc.icon==='fab fa-tiktok'?' selected':'')+'>TikTok</option></select>' +
      '<input class="input" placeholder="Название" id="fs_name_'+si+'" value="'+escHtml(sc.name)+'">' +
      '<input class="input" placeholder="URL" id="fs_url_'+si+'" value="'+escHtml(sc.url)+'">' +
      '<button class="tier-del-btn" onclick="removeFooterSocial('+si+')"><i class="fas fa-times"></i></button>' +
    '</div>';
  }
  h += '</div></div>';

  // Copyright + location
  h += '<div class="card" style="margin-bottom:20px"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-copyright" style="color:#94a3b8;margin-right:8px"></i>Копирайт</h3>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
    '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Копирайт (RU)</label><input class="input" id="ft_copy_ru" value="'+escHtml(f.copyright_ru)+'"></div>' +
    '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Копирайт (AM)</label><input class="input" id="ft_copy_am" value="'+escHtml(f.copyright_am)+'"></div>' +
    '</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
    '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Локация (RU)</label><input class="input" id="ft_loc_ru" value="'+escHtml(f.location_ru)+'"></div>' +
    '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Локация (AM)</label><input class="input" id="ft_loc_am" value="'+escHtml(f.location_am)+'"></div>' +
    '</div></div>';

  // Custom HTML
  h += '<div class="card" style="margin-bottom:20px"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-code" style="color:#EF4444;margin-right:8px"></i>Произвольный HTML</h3>' +
    '<textarea class="input" id="ft_html" rows="4" placeholder="Дополнительный HTML для футера">' + escHtml(f.custom_html) + '</textarea></div>';

  h += '<button class="btn btn-success" onclick="saveFooter()"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить футер</button></div>';
  return h;
}

var _footerContacts = [];
var _footerSocials = [];
function initFooterData() {
  try { _footerContacts = JSON.parse(data.footer.contacts_json || '[]'); } catch { _footerContacts = []; }
  try { _footerSocials = JSON.parse(data.footer.socials_json || '[]'); } catch { _footerSocials = []; }
}

function addFooterContact() {
  initFooterData();
  _footerContacts.push({ icon: 'fab fa-telegram', name_ru: '', name_am: '', url: '' });
  data.footer.contacts_json = JSON.stringify(_footerContacts);
  render();
}
function removeFooterContact(idx) {
  initFooterData();
  _footerContacts.splice(idx, 1);
  data.footer.contacts_json = JSON.stringify(_footerContacts);
  render();
}
function addFooterSocial() {
  initFooterData();
  _footerSocials.push({ icon: 'fab fa-telegram', name: '', url: '' });
  data.footer.socials_json = JSON.stringify(_footerSocials);
  render();
}
function removeFooterSocial(idx) {
  initFooterData();
  _footerSocials.splice(idx, 1);
  data.footer.socials_json = JSON.stringify(_footerSocials);
  render();
}

function collectFooterContacts() {
  var arr = [];
  for (var i = 0; ; i++) {
    var iconEl = document.getElementById('fc_icon_'+i);
    if (!iconEl) break;
    arr.push({ icon: iconEl.value, name_ru: document.getElementById('fc_name_'+i).value, url: document.getElementById('fc_url_'+i).value });
  }
  return arr;
}
function collectFooterSocials() {
  var arr = [];
  for (var i = 0; ; i++) {
    var iconEl = document.getElementById('fs_icon_'+i);
    if (!iconEl) break;
    arr.push({ icon: iconEl.value, name: document.getElementById('fs_name_'+i).value, url: document.getElementById('fs_url_'+i).value });
  }
  return arr;
}

async function saveFooter() {
  await api('/footer', { method: 'PUT', body: JSON.stringify({
    brand_text_ru: document.getElementById('ft_brand_ru').value,
    brand_text_am: document.getElementById('ft_brand_am').value,
    contacts_json: JSON.stringify(collectFooterContacts()),
    socials_json: JSON.stringify(collectFooterSocials()),
    copyright_ru: document.getElementById('ft_copy_ru').value,
    copyright_am: document.getElementById('ft_copy_am').value,
    location_ru: document.getElementById('ft_loc_ru').value,
    location_am: document.getElementById('ft_loc_am').value,
    custom_html: document.getElementById('ft_html').value
  }) });
  toast('Футер сохранён');
  await loadData(); render();
}

// ===== PHOTO BLOCKS =====
function renderPhotos() {
  var blocks = data.photoBlocks || [];
  // Dynamic positions from section order
  var positions = [];
  var sections = data.sectionOrder || [];
  for (var si = 0; si < sections.length; si++) {
    positions.push({ id: sections[si].section_id, label: escHtml(sections[si].label_ru || sections[si].section_id) });
  }
  if (positions.length === 0) {
    positions = [
      { id: 'after-hero', label: 'После Hero' },
      { id: 'after-services', label: 'После услуг' },
      { id: 'before-calc', label: 'Перед калькулятором' },
      { id: 'after-about', label: 'После «О нас»' },
      { id: 'before-contact', label: 'Перед контактами' },
      { id: 'after-guarantee', label: 'После гарантий' }
    ];
  }

  var h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Фото блоки</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Создавайте фото-блоки с описаниями и размещайте их на сайте</p>' +
    '<button class="btn btn-primary" style="margin-bottom:20px" onclick="addPhotoBlock()"><i class="fas fa-plus" style="margin-right:6px"></i>Добавить фото-блок</button>';

  for (var bi = 0; bi < blocks.length; bi++) {
    var b = blocks[bi];
    var photos = [];
    try { photos = JSON.parse(b.photos_json || '[]'); } catch { photos = []; }
    h += '<div class="card" style="margin-bottom:20px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<h3 style="font-weight:700"><i class="fas fa-images" style="color:#8B5CF6;margin-right:8px"></i>' + escHtml(b.block_name || 'Блок #'+(bi+1)) + '</h3>' +
      '<div style="display:flex;gap:8px"><label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;color:#94a3b8"><input type="checkbox" id="pb_vis_'+b.id+'"'+(b.is_visible?' checked':'')+'>Видимый</label>' +
      '<button class="btn btn-danger" style="font-size:0.8rem;padding:6px 14px" onclick="deletePhotoBlock('+b.id+')"><i class="fas fa-trash"></i></button></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Имя блока</label><input class="input" id="pb_name_'+b.id+'" value="'+escHtml(b.block_name)+'"></div>' +
      '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Позиция</label><select class="input" id="pb_pos_'+b.id+'">';
    for (var pi = 0; pi < positions.length; pi++) {
      h += '<option value="'+positions[pi].id+'"'+(b.position===positions[pi].id?' selected':'')+'>'+positions[pi].label+'</option>';
    }
    h += '</select></div><div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Порядок</label><input class="input" type="number" id="pb_order_'+b.id+'" value="'+(b.sort_order||0)+'"></div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Описание (RU)</label><textarea class="input" id="pb_desc_ru_'+b.id+'" rows="2">'+escHtml(b.description_ru)+'</textarea></div>' +
      '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Описание (AM)</label><textarea class="input" id="pb_desc_am_'+b.id+'" rows="2">'+escHtml(b.description_am)+'</textarea></div>' +
      '</div>';

    // Photo URLs list
    h += '<div style="margin-bottom:12px"><label style="font-size:0.75rem;color:#64748b;font-weight:600;margin-bottom:8px;display:block">Фотографии (URL)</label>';
    for (var phi = 0; phi < photos.length; phi++) {
      h += '<div style="display:flex;gap:8px;margin-bottom:6px;align-items:center">' +
        '<input class="input" id="pb_photo_'+b.id+'_'+phi+'" value="'+escHtml(photos[phi].url)+'" placeholder="URL фотографии">' +
        '<input class="input" style="width:200px" id="pb_pcap_'+b.id+'_'+phi+'" value="'+escHtml(photos[phi].caption||'')+'" placeholder="Подпись">' +
        '<button class="tier-del-btn" onclick="removePhotoFromBlock('+b.id+','+phi+')"><i class="fas fa-times"></i></button>' +
      '</div>';
    }
    h += '<button class="btn btn-outline" style="font-size:0.8rem;padding:6px 14px" onclick="addPhotoToBlock('+b.id+')"><i class="fas fa-plus" style="margin-right:4px"></i>Фото</button></div>';

    h += '<button class="btn btn-success" onclick="savePhotoBlock('+b.id+')"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить</button></div>';
  }

  if (blocks.length === 0) {
    h += '<div class="card" style="text-align:center;padding:40px;color:#64748b"><i class="fas fa-images" style="font-size:3rem;color:#334155;margin-bottom:12px;display:block"></i>Нет фото-блоков. Нажмите «Добавить» чтобы создать.</div>';
  }

  h += '</div>';
  return h;
}

async function addPhotoBlock() {
  await api('/photo-blocks', { method: 'POST', body: JSON.stringify({ block_name: 'Фото блок ' + ((data.photoBlocks||[]).length+1), position: 'after-services', is_visible: 1, photos_json: '[]' }) });
  toast('Блок создан');
  await loadData(); render();
}

async function deletePhotoBlock(id) {
  if (!confirm('Удалить фото-блок?')) return;
  await api('/photo-blocks/' + id, { method: 'DELETE' });
  toast('Блок удалён');
  await loadData(); render();
}

function addPhotoToBlock(blockId) {
  var block = (data.photoBlocks||[]).find(function(b){return b.id===blockId});
  if (!block) return;
  var photos = [];
  try { photos = JSON.parse(block.photos_json || '[]'); } catch { photos = []; }
  photos.push({ url: '', caption: '' });
  block.photos_json = JSON.stringify(photos);
  render();
}

function removePhotoFromBlock(blockId, photoIdx) {
  var block = (data.photoBlocks||[]).find(function(b){return b.id===blockId});
  if (!block) return;
  var photos = [];
  try { photos = JSON.parse(block.photos_json || '[]'); } catch { photos = []; }
  photos.splice(photoIdx, 1);
  block.photos_json = JSON.stringify(photos);
  render();
}

function collectPhotos(blockId) {
  var arr = [];
  for (var i = 0; ; i++) {
    var urlEl = document.getElementById('pb_photo_'+blockId+'_'+i);
    if (!urlEl) break;
    var capEl = document.getElementById('pb_pcap_'+blockId+'_'+i);
    arr.push({ url: urlEl.value, caption: capEl ? capEl.value : '' });
  }
  return arr;
}

async function savePhotoBlock(id) {
  await api('/photo-blocks/' + id, { method: 'PUT', body: JSON.stringify({
    block_name: document.getElementById('pb_name_'+id).value,
    description_ru: document.getElementById('pb_desc_ru_'+id).value,
    description_am: document.getElementById('pb_desc_am_'+id).value,
    photos_json: JSON.stringify(collectPhotos(id)),
    position: document.getElementById('pb_pos_'+id).value,
    sort_order: parseInt(document.getElementById('pb_order_'+id).value) || 0,
    is_visible: document.getElementById('pb_vis_'+id).checked ? 1 : 0
  }) });
  toast('Фото-блок сохранён');
  await loadData(); render();
}

// ===== RENDER =====
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Format date to Armenia timezone (UTC+4)
function formatArmTime(dateStr) {
  if (!dateStr) return '';
  try {
    var d = new Date(dateStr + (dateStr.indexOf('Z') < 0 && dateStr.indexOf('+') < 0 ? 'Z' : ''));
    return d.toLocaleString('ru-RU', { timeZone: 'Asia/Yerevan', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch(e) { return (dateStr || '').substring(0, 16); }
}

// ===== EMPLOYEES PAGE =====
function renderEmployees() {
  const isAdmin = currentUser && currentUser.role === 'main_admin';
  const rl = rolesConfig?.role_labels || {};
  const roles = rolesConfig?.roles || [];
  var roleColors = { main_admin: '#8B5CF6', developer: '#3B82F6', analyst: '#10B981', operator: '#F59E0B', buyer: '#EF4444', courier: '#6366F1' };
  let h = '<div style="padding:32px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px"><div><h1 style="font-size:1.8rem;font-weight:800"><i class="fas fa-users" style="color:#8B5CF6;margin-right:10px"></i>Сотрудники</h1><p style="color:#94a3b8;margin-top:4px">Управление командой \u2014 ' + data.users.length + ' сотрудник(ов)</p></div>';
  if (isAdmin) {
    h += '<button class="btn btn-primary" onclick="showEmployeeModal()"><i class="fas fa-user-plus" style="margin-right:6px"></i>Добавить</button>';
  }
  h += '</div>';
  // Cards grid
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">';
  for (const u of data.users) {
    var rColor = roleColors[u.role] || '#64748b';
    var initials = (u.display_name||'U').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().substring(0,2);
    h += '<div class="card" style="padding:0;overflow:hidden;border-top:3px solid ' + rColor + '">';
    // Header
    h += '<div style="padding:20px 20px 12px;display:flex;gap:14px;align-items:center">';
    h += '<div style="width:48px;height:48px;border-radius:50%;background:' + rColor + '22;border:2px solid ' + rColor + ';display:flex;align-items:center;justify-content:center;font-weight:800;color:' + rColor + ';font-size:0.95rem;flex-shrink:0">' + initials + '</div>';
    h += '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(u.display_name) + '</div>';
    h += '<div style="display:flex;align-items:center;gap:8px;margin-top:4px">';
    h += '<span style="padding:2px 10px;border-radius:12px;font-size:0.72rem;font-weight:600;background:' + rColor + '22;color:' + rColor + '">' + escHtml(rl[u.role]||u.role) + '</span>';
    h += '<span class="badge ' + (u.is_active?'badge-green':'bg-red-900 text-red-300') + '" style="font-size:0.68rem;cursor:pointer" onclick="toggleUserActive(' + u.id + ',' + (u.is_active?0:1) + ')">' + (u.is_active?'Активен':'Откл') + '</span>';
    h += '</div></div></div>';
    // Info fields
    h += '<div style="padding:0 20px 12px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.82rem">';
    h += '<div><span style="color:#64748b;font-size:0.72rem">Логин</span><div style="font-family:monospace;color:#94a3b8">' + escHtml(u.username) + '</div></div>';
    h += '<div><span style="color:#64748b;font-size:0.72rem">Должность</span><div style="color:#e2e8f0">' + escHtml(u.position_title||'\u2014') + '</div></div>';
    h += '<div><span style="color:#64748b;font-size:0.72rem">Телефон</span><div style="color:#e2e8f0">' + escHtml(u.phone||'\u2014') + '</div></div>';
    h += '<div><span style="color:#64748b;font-size:0.72rem">Email</span><div style="color:#e2e8f0">' + escHtml(u.email||'\u2014') + '</div></div>';
    if (u.salary) {
      h += '<div><span style="color:#64748b;font-size:0.72rem">Зарплата</span><div style="color:#3B82F6;font-weight:600">' + fmtAmt(u.salary) + '</div></div>';
      h += '<div><span style="color:#64748b;font-size:0.72rem">Тип</span><div style="color:#94a3b8">' + escHtml({monthly:'Помесячно',biweekly:'За 15 дн',per_task:'За работу',percent:'Процент'}[u.salary_type||'monthly']||u.salary_type||'Помесячно') + '</div></div>';
    }
    if (u.hire_date) {
      h += '<div><span style="color:#64748b;font-size:0.72rem">С даты</span><div style="color:#a78bfa">' + escHtml(u.hire_date) + '</div></div>';
    }
    if (u.end_date) {
      h += '<div><span style="color:#64748b;font-size:0.72rem">По дату</span><div style="color:#f87171">' + escHtml(u.end_date) + '</div></div>';
    }
    h += '</div>';
    // Actions
    if (isAdmin) {
      h += '<div style="padding:12px 20px;border-top:1px solid #334155;display:flex;gap:6px;flex-wrap:wrap">';
      h += '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.78rem;flex:1" onclick="editEmployee(' + u.id + ')"><i class="fas fa-edit" style="margin-right:4px"></i>Ред.</button>';
      h += '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.78rem;flex:1" onclick="showChangePassForm(' + u.id + ')"><i class="fas fa-key" style="margin-right:4px"></i>Пароль</button>';
      h += '<button class="btn btn-outline" style="padding:6px 12px;font-size:0.78rem" onclick="navigate(\\'permissions\\');editPermUserId=' + u.id + ';render()"><i class="fas fa-shield-alt"></i></button>';
      if (u.role !== 'main_admin') h += '<button class="btn btn-danger" style="padding:6px 10px;font-size:0.78rem" onclick="deleteEmployee(' + u.id + ',\\'' + escHtml(u.display_name) + '\\')"><i class="fas fa-trash"></i></button>';
      h += '</div>';
      // Password change form
      if (_changePassUserId === u.id) {
        h += '<div style="padding:12px 20px 16px;background:#0f172a;border-top:1px solid #8B5CF6">';
        h += '<div style="font-size:0.82rem;font-weight:600;margin-bottom:8px;color:#a78bfa"><i class="fas fa-key" style="margin-right:4px"></i>Смена пароля для ' + escHtml(u.display_name) + '</div>';
        h += '<div style="display:flex;gap:8px;align-items:center">';
        h += '<div style="position:relative;flex:1"><input class="input" id="newpass-' + u.id + '" type="password" placeholder="Новый пароль" style="padding-right:36px">';
        h += '<button type="button" onclick="var i=document.getElementById(\\'newpass-' + u.id + '\\');i.type=i.type===\\'password\\'?\\'text\\':\\'password\\';this.querySelector(\\'i\\').className=\\'fas fa-\\'+(i.type===\\'password\\'?\\'eye\\':\\'eye-slash\\')" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:#64748b;cursor:pointer;padding:4px"><i class="fas fa-eye"></i></button></div>';
        h += '<button class="btn btn-success" style="padding:8px 14px" onclick="doChangePassword(' + u.id + ')"><i class="fas fa-check"></i></button>';
        h += '<button class="btn btn-outline" style="padding:8px 14px" onclick="_changePassUserId=0;render()"><i class="fas fa-times"></i></button>';
        h += '</div></div>';
      }
    }
    h += '</div>';
  }
  h += '</div>';
  h += '<div id="employeeModalArea"></div>';
  return h + '</div>';
}

var _changePassUserId = 0;
function showChangePassForm(id) { _changePassUserId = id; render(); }
async function doChangePassword(userId) {
  var newPass = document.getElementById('newpass-' + userId)?.value;
  if (!newPass || newPass.length < 3) { toast('Пароль слишком короткий', 'error'); return; }
  var res = await api('/users/' + userId + '/reset-password', { method:'POST', body: JSON.stringify({ new_password: newPass }) });
  if (res && (res.success || res.new_password)) { toast('Пароль изменён!'); _changePassUserId = 0; render(); }
  else { toast(res?.error || 'Ошибка', 'error'); }
}

async function toggleUserActive(id, val) {
  await api('/users/' + id, { method:'PUT', body: JSON.stringify({is_active: val}) });
  data.users = await api('/users') || [];
  render();
}

async function deleteEmployee(id, name) {
  if (!confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430 "' + name + '"?')) return;
  await api('/users/' + id, { method:'DELETE' });
  data.users = await api('/users') || [];
  toast('\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a \u0443\u0434\u0430\u043b\u0451\u043d');
  render();
}

async function resetEmployeePass(id, name) {
  // Redirect to inline password form
  showChangePassForm(id);
}

function showEmployeeModal(userId) {
  const roles = rolesConfig?.roles || [];
  const rl = rolesConfig?.role_labels || {};
  const u = userId ? data.users.find(x => x.id === userId) : null;
  const compRoles = data.companyRoles || [];
  let h = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center" onclick="this.remove()">' +
    '<div class="card" style="width:520px;max-width:90vw;max-height:90vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px">' + (u ? '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c' : '\u041d\u043e\u0432\u044b\u0439 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a') + '</h3>' +
    '<form onsubmit="saveEmployee(event,' + (u ? u.id : 'null') + ')">' +
    '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u0418\u043c\u044f / \u0424\u0418\u041e *</label><input class="input" id="empName" value="' + escHtml(u?.display_name||'') + '" required></div>';
  if (!u) {
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u041b\u043e\u0433\u0438\u043d *</label><input class="input" id="empUser" required></div>' +
      '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u041f\u0430\u0440\u043e\u043b\u044c *</label><input class="input" type="password" id="empPass" required></div></div>';
  }
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
  h += '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u0420\u043e\u043b\u044c *</label><select class="input" id="empRole">';
  for (const r of roles) { h += '<option value="' + r + '"' + (u?.role===r?' selected':'') + '>' + escHtml(rl[r]||r) + '</option>'; }
  h += '</select></div>';
  h += '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u0414\u043e\u043b\u0436\u043d\u043e\u0441\u0442\u044c</label><select class="input" id="empPosition">';
  h += '<option value="">\u2014 \u0412\u044b\u0431\u0440\u0430\u0442\u044c \u2014</option>';
  for (var cri = 0; cri < compRoles.length; cri++) {
    var cr = compRoles[cri];
    h += '<option value="' + escHtml(cr.role_name) + '"' + (u?.position_title === cr.role_name ? ' selected' : '') + '>' + escHtml(cr.role_name) + '</option>';
  }
  h += '</select></div></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u0422\u0435\u043b\u0435\u0444\u043e\u043d</label><input class="input" id="empPhone" value="' + escHtml(u?.phone||'') + '"></div>' +
    '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">Email</label><input class="input" id="empEmail" value="' + escHtml(u?.email||'') + '"></div></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u0417\u0430\u0440\u043f\u043b\u0430\u0442\u0430</label><input class="input" type="number" id="empSalary" value="' + (u?.salary||0) + '"></div>';
  h += '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u0422\u0438\u043f \u043e\u043f\u043b\u0430\u0442\u044b</label><select class="input" id="empSalaryType">';
  var stypesModal = [{v:'monthly',l:'\u041f\u043e\u043c\u0435\u0441\u044f\u0447\u043d\u043e'},{v:'biweekly',l:'\u0417\u0430 15 \u0434\u043d\u0435\u0439'},{v:'per_task',l:'\u0417\u0430 \u0440\u0430\u0431\u043e\u0442\u0443'},{v:'percent',l:'\u041f\u0440\u043e\u0446\u0435\u043d\u0442 \u043e\u0442 \u043e\u0431\u043e\u0440\u043e\u0442\u0430'}];
  for (var sti3 = 0; sti3 < stypesModal.length; sti3++) {
    h += '<option value="' + stypesModal[sti3].v + '"' + ((u?.salary_type||'monthly') === stypesModal[sti3].v ? ' selected' : '') + '>' + stypesModal[sti3].l + '</option>';
  }
  h += '</select></div></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u0414\u0430\u0442\u0430 \u043d\u0430\u0447\u0430\u043b\u0430 \u0440\u0430\u0431\u043e\u0442\u044b</label><input class="input" type="date" id="empHireDate" value="' + escHtml(u?.hire_date||'') + '"></div>';
  h += '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u0414\u0430\u0442\u0430 \u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f <span style="font-size:0.65rem;color:#475569">(\u043f\u0443\u0441\u0442\u043e = \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442)</span></label><input class="input" type="date" id="empEndDate" value="' + escHtml(u?.end_date||'') + '"></div></div>';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button type="button" class="btn btn-outline" onclick="this.closest(\\'[style*=fixed]\\').remove()">\u041e\u0442\u043c\u0435\u043d\u0430</button><button type="submit" class="btn btn-primary"><i class="fas fa-check" style="margin-right:6px"></i>' + (u?'\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c':'\u0421\u043e\u0437\u0434\u0430\u0442\u044c') + '</button></div></form></div></div>';
  const area = document.getElementById('employeeModalArea');
  if (area) area.innerHTML = h;
}

function editEmployee(id) { showEmployeeModal(id); }

async function saveEmployee(e, id) {
  e.preventDefault();
  const body = { 
    display_name: document.getElementById('empName').value, 
    role: document.getElementById('empRole').value, 
    phone: document.getElementById('empPhone').value, 
    email: document.getElementById('empEmail').value,
    position_title: document.getElementById('empPosition')?.value || '',
    salary: Number(document.getElementById('empSalary')?.value) || 0,
    salary_type: document.getElementById('empSalaryType')?.value || 'monthly',
    hire_date: document.getElementById('empHireDate')?.value || ''
  };
  // Enforce single main_admin
  if (body.role === 'main_admin' && !id) {
    var existing = data.users.find(function(u) { return u.role === 'main_admin'; });
    if (existing) { toast('Главный админ уже существует: ' + existing.display_name, 'error'); return; }
  }
  if (body.role === 'main_admin' && id) {
    var existing2 = data.users.find(function(u) { return u.role === 'main_admin' && u.id !== id; });
    if (existing2) { toast('Главный админ уже существует: ' + existing2.display_name + '. Только один main_admin допускается.', 'error'); return; }
  }
  var res;
  if (!id) {
    body.username = document.getElementById('empUser').value;
    body.password = document.getElementById('empPass').value;
    res = await api('/users', { method:'POST', body: JSON.stringify(body) });
  } else {
    res = await api('/users/' + id, { method:'PUT', body: JSON.stringify(body) });
  }
  if (!res || res.error) {
    toast(res?.error || 'Ошибка при сохранении сотрудника', 'error');
    return;
  }
  data.users = await api('/users') || [];
  toast(id ? 'Сотрудник обновлён' : 'Сотрудник создан');
  render();
}

// ===== PERMISSIONS PAGE =====
function renderPermissions() {
  const isAdmin = currentUser && currentUser.role === 'main_admin';
  const rl = rolesConfig?.role_labels || {};
  const sl = rolesConfig?.section_labels || {};
  const allSections = rolesConfig?.sections || [];
  let h = '<div style="padding:32px"><h1 style="font-size:1.5rem;font-weight:800;margin-bottom:8px">\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u0430\u043c\u0438</h1><p style="color:#94a3b8;font-size:0.85rem;margin-bottom:24px">\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u0442\u0435, \u043a\u0430\u043a\u0438\u0435 \u0440\u0430\u0437\u0434\u0435\u043b\u044b \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u044b \u043a\u0430\u0436\u0434\u043e\u043c\u0443 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0443</p>';
  h += '<div style="display:grid;grid-template-columns:260px 1fr;gap:20px">';
  // User list
  h += '<div class="card" style="padding:0;overflow:hidden"><div style="padding:14px 20px;border-bottom:1px solid #334155;font-weight:700;font-size:0.88rem;color:#a78bfa">\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0438</div>';
  for (const u of data.users) {
    h += '<div style="padding:12px 20px;cursor:pointer;border-bottom:1px solid #1e293b;transition:all 0.2s;border-left:3px solid transparent" class="perm-user-item" data-uid="' + u.id + '" onclick="selectPermUser(' + u.id + ')">' +
      '<div style="font-weight:600;font-size:0.88rem">' + escHtml(u.display_name) + '</div>' +
      '<div style="font-size:0.75rem;color:#64748b">' + escHtml(rl[u.role]||u.role) + '</div></div>';
  }
  h += '</div>';
  // Permissions grid
  h += '<div class="card" id="permEditor"><div style="text-align:center;padding:40px;color:#64748b"><i class="fas fa-shield-alt" style="font-size:2.5rem;margin-bottom:12px;display:block;opacity:0.3"></i>Выберите сотрудника</div></div>';
  h += '</div></div>';
  // Auto-select user if navigated from employee card
  if (typeof editPermUserId !== 'undefined' && editPermUserId > 0) {
    setTimeout(function(){ selectPermUser(editPermUserId); editPermUserId = 0; }, 100);
  }
  return h;
}

var editPermUserId = 0;

let selectedPermUserId = null;
let selectedPermSections = [];

async function selectPermUser(uid) {
  selectedPermUserId = uid;
  const res = await api('/permissions/' + uid);
  selectedPermSections = (res && res.permissions) || [];
  const u = data.users.find(x => x.id === uid);
  const isMainAdmin = u && u.role === 'main_admin';
  const isAdmin = currentUser && currentUser.role === 'main_admin';
  const rl = rolesConfig?.role_labels || {};
  const sl = rolesConfig?.section_labels || {};
  const allSections = rolesConfig?.sections || [];
  
  // Highlight selected user
  document.querySelectorAll('.perm-user-item').forEach(el => { el.style.borderLeftColor = el.dataset.uid == uid ? '#8B5CF6' : 'transparent'; el.style.background = el.dataset.uid == uid ? 'rgba(139,92,246,0.1)' : ''; });
  
  let h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div><h3 style="font-weight:700;font-size:1.1rem">' + escHtml(u?.display_name) + '</h3><span class="badge badge-purple" style="margin-top:6px;display:inline-block">' + escHtml(rl[u?.role]||u?.role) + '</span></div>';
  if (isAdmin && !isMainAdmin) h += '<button class="btn btn-primary" onclick="savePermissions()"><i class="fas fa-save" style="margin-right:6px"></i>\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c</button>';
  h += '</div>';
  if (isMainAdmin) h += '<div style="padding:12px 16px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:8px;margin-bottom:16px;font-size:0.85rem;color:#a78bfa"><i class="fas fa-shield-alt" style="margin-right:6px"></i>\u0413\u043b\u0430\u0432\u043d\u044b\u0439 \u0430\u0434\u043c\u0438\u043d \u0438\u043c\u0435\u0435\u0442 \u0434\u043e\u0441\u0442\u0443\u043f \u043a\u043e \u0432\u0441\u0435\u043c \u0440\u0430\u0437\u0434\u0435\u043b\u0430\u043c</div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">';
  for (const sec of allSections) {
    const checked = isMainAdmin || selectedPermSections.includes(sec);
    const disabled = !isAdmin || isMainAdmin;
    h += '<label style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0f172a;border:1px solid ' + (checked?'#8B5CF6':'#334155') + ';border-radius:8px;cursor:' + (disabled?'default':'pointer') + ';opacity:' + (disabled?'0.6':'1') + '">' +
      '<input type="checkbox" ' + (checked?'checked':'') + ' ' + (disabled?'disabled':'') + ' onchange="togglePermSection(\\'' + sec + '\\')" style="accent-color:#8B5CF6">' +
      '<span style="font-size:0.85rem">' + escHtml(sl[sec]||sec) + '</span></label>';
  }
  h += '</div>';
  document.getElementById('permEditor').innerHTML = h;
}

function togglePermSection(sec) {
  const idx = selectedPermSections.indexOf(sec);
  if (idx >= 0) selectedPermSections.splice(idx, 1);
  else selectedPermSections.push(sec);
}

async function savePermissions() {
  if (!selectedPermUserId) return;
  await api('/permissions/' + selectedPermUserId, { method:'PUT', body: JSON.stringify({ sections: selectedPermSections }) });
  toast('\u0414\u043e\u0441\u0442\u0443\u043f\u044b \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b');
}

// ===== COMPANY ROLES MANAGEMENT =====
function renderCompanyRoles() {
  var isAdmin = currentUser && currentUser.role === 'main_admin';
  var roles = data.companyRoles || [];
  var sl = rolesConfig?.section_labels || {};
  var h = '<div style="padding:32px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">';
  h += '<div><h1 style="font-size:1.5rem;font-weight:800"><i class="fas fa-user-tag" style="color:#8B5CF6;margin-right:10px"></i>\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0440\u043e\u043b\u044f\u043c\u0438 \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0438</h1>';
  h += '<p style="color:#94a3b8;font-size:0.85rem;margin-top:4px">\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u0442\u0435 \u0440\u043e\u043b\u0438, \u0438\u0445 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f, \u0446\u0432\u0435\u0442\u0430 \u0438 \u0434\u043e\u0441\u0442\u0443\u043f\u044b \u043f\u043e \u0443\u043c\u043e\u043b\u0447\u0430\u043d\u0438\u044e</p></div>';
  if (isAdmin) {
    h += '<button class="btn btn-primary" onclick="showCompanyRoleModal()"><i class="fas fa-plus" style="margin-right:6px"></i>\u041d\u043e\u0432\u0430\u044f \u0440\u043e\u043b\u044c</button>';
  }
  h += '</div>';

  if (roles.length === 0) {
    h += '<div class="card" style="text-align:center;padding:48px;color:#64748b"><i class="fas fa-user-tag" style="font-size:2.5rem;margin-bottom:12px;display:block;opacity:0.3"></i><p>\u0420\u043e\u043b\u0438 \u0435\u0449\u0451 \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u044b</p></div>';
  } else {
    h += '<div style="display:grid;gap:12px">';
    for (var i = 0; i < roles.length; i++) {
      var r = roles[i];
      var sections = [];
      try { sections = JSON.parse(r.default_sections || '[]'); } catch { sections = []; }
      var sectionNames = sections.map(function(s) { return sl[s] || s; }).join(', ');
      h += '<div class="card" style="padding:20px;border-left:4px solid ' + escHtml(r.color || '#8B5CF6') + '">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">';
      h += '<div style="flex:1;min-width:200px">';
      h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">';
      h += '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + escHtml(r.color || '#8B5CF6') + '"></span>';
      h += '<span style="font-size:1.1rem;font-weight:700">' + escHtml(r.role_name) + '</span>';
      h += '<span style="font-family:monospace;font-size:0.75rem;color:#64748b;background:#0f172a;padding:2px 8px;border-radius:4px">' + escHtml(r.role_key) + '</span>';
      if (r.is_system) h += '<span class="badge badge-purple" style="font-size:0.65rem">\u0421\u0438\u0441\u0442\u0435\u043c\u043d\u0430\u044f</span>';
      if (!r.is_active) h += '<span class="badge" style="background:rgba(239,68,68,0.2);color:#f87171;font-size:0.65rem">\u041d\u0435\u0430\u043a\u0442\u0438\u0432\u043d\u0430</span>';
      h += '</div>';
      if (r.description) h += '<p style="color:#94a3b8;font-size:0.82rem;margin-bottom:8px">' + escHtml(r.description) + '</p>';
      h += '<div style="font-size:0.78rem;color:#64748b"><i class="fas fa-key" style="margin-right:6px;color:#8B5CF6"></i>\u0414\u043e\u0441\u0442\u0443\u043f\u044b: <span style="color:#a78bfa">' + (sectionNames || '\u043d\u0435\u0442') + '</span></div>';
      h += '</div>';
      if (isAdmin) {
        h += '<div style="display:flex;gap:6px;flex-shrink:0">';
        h += '<button class="btn btn-outline" style="padding:8px 12px;font-size:0.82rem" onclick="showCompanyRoleModal(' + r.id + ')"><i class="fas fa-edit"></i></button>';
        if (!r.is_system) h += '<button class="btn btn-danger" style="padding:8px 12px;font-size:0.82rem" onclick="deleteCompanyRole(' + r.id + ',\\'' + escHtml(r.role_name) + '\\')"><i class="fas fa-trash"></i></button>';
        h += '</div>';
      }
      h += '</div></div>';
    }
    h += '</div>';
  }
  h += '<div id="companyRoleModalArea"></div>';
  h += '</div>';
  return h;
}

function showCompanyRoleModal(roleId) {
  var r = roleId ? (data.companyRoles || []).find(function(x) { return x.id === roleId; }) : null;
  var sl = rolesConfig?.section_labels || {};
  var allSections = rolesConfig?.sections || [];
  var existingSections = [];
  if (r) { try { existingSections = JSON.parse(r.default_sections || '[]'); } catch { existingSections = []; } }
  else { existingSections = ['dashboard']; }

  var h = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px" onclick="this.remove()">';
  h += '<div class="card" style="width:580px;max-width:95vw;max-height:90vh;overflow-y:auto" onclick="event.stopPropagation()">';
  h += '<h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px"><i class="fas fa-user-tag" style="color:#8B5CF6;margin-right:8px"></i>' + (r ? '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0440\u043e\u043b\u044c' : '\u041d\u043e\u0432\u0430\u044f \u0440\u043e\u043b\u044c') + '</h3>';
  h += '<form onsubmit="saveCompanyRole(event,' + (r ? r.id : 'null') + ')">';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">';
  h += '<div><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0440\u043e\u043b\u0438 *</label><input class="input" id="crRoleName" value="' + escHtml(r?.role_name || '') + '" required></div>';
  h += '<div><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u041a\u043b\u044e\u0447 \u0440\u043e\u043b\u0438 *' + (r ? ' (\u043d\u0435\u043b\u044c\u0437\u044f \u043c\u0435\u043d\u044f\u0442\u044c)' : '') + '</label><input class="input" id="crRoleKey" value="' + escHtml(r?.role_key || '') + '" ' + (r ? 'readonly style="opacity:0.6"' : '') + ' required pattern="[a-z_]+" title="\u0422\u043e\u043b\u044c\u043a\u043e \u043b\u0430\u0442\u0438\u043d\u0441\u043a\u0438\u0435 \u0431\u0443\u043a\u0432\u044b \u0438 \u043f\u043e\u0434\u0447\u0451\u0440\u043a\u0438\u0432\u0430\u043d\u0438\u0435"></div>';
  h += '</div>';
  h += '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435</label><input class="input" id="crRoleDesc" value="' + escHtml(r?.description || '') + '"></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';
  h += '<div><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u0426\u0432\u0435\u0442</label><input type="color" id="crRoleColor" value="' + (r?.color || '#8B5CF6') + '" style="width:100%;height:40px;border:1px solid #334155;border-radius:8px;background:#0f172a;cursor:pointer"></div>';
  h += '<div><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\u041f\u043e\u0440\u044f\u0434\u043e\u043a</label><input type="number" class="input" id="crRoleOrder" value="' + (r?.sort_order || 0) + '"></div>';
  h += '</div>';
  h += '<div style="margin-bottom:16px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:8px"><i class="fas fa-key" style="margin-right:4px"></i>\u0420\u0430\u0437\u0434\u0435\u043b\u044b \u043f\u043e \u0443\u043c\u043e\u043b\u0447\u0430\u043d\u0438\u044e</label>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">';
  for (var j = 0; j < allSections.length; j++) {
    var sec = allSections[j];
    var checked = existingSections.indexOf(sec) >= 0;
    h += '<label style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#0f172a;border:1px solid ' + (checked ? '#8B5CF6' : '#334155') + ';border-radius:6px;cursor:pointer;font-size:0.82rem">';
    h += '<input type="checkbox" class="crSectionCheck" value="' + sec + '" ' + (checked ? 'checked' : '') + ' style="accent-color:#8B5CF6">';
    h += (sl[sec] || sec) + '</label>';
  }
  h += '</div></div>';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn-outline" onclick="this.closest(\\'[style*=fixed]\\').remove()">\u041e\u0442\u043c\u0435\u043d\u0430</button>';
  h += '<button type="submit" class="btn btn-primary"><i class="fas fa-check" style="margin-right:6px"></i>' + (r ? '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c' : '\u0421\u043e\u0437\u0434\u0430\u0442\u044c') + '</button></div>';
  h += '</form></div></div>';
  var area = document.getElementById('companyRoleModalArea');
  if (area) area.innerHTML = h;
}

async function saveCompanyRole(e, id) {
  e.preventDefault();
  var sectionChecks = document.querySelectorAll('.crSectionCheck');
  var sections = [];
  for (var i = 0; i < sectionChecks.length; i++) {
    if (sectionChecks[i].checked) sections.push(sectionChecks[i].value);
  }
  var body = {
    role_name: document.getElementById('crRoleName').value,
    role_key: document.getElementById('crRoleKey').value,
    description: document.getElementById('crRoleDesc').value,
    color: document.getElementById('crRoleColor').value,
    sort_order: parseInt(document.getElementById('crRoleOrder').value) || 0,
    default_sections: sections
  };
  var res;
  if (id) {
    res = await api('/company-roles/' + id, { method: 'PUT', body: JSON.stringify(body) });
  } else {
    res = await api('/company-roles', { method: 'POST', body: JSON.stringify(body) });
  }
  if (!res || res.error) {
    toast(res?.error || '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u044f \u0440\u043e\u043b\u0438', 'error');
    return;
  }
  var rolesRes = await api('/company-roles');
  data.companyRoles = (rolesRes && rolesRes.roles) || [];
  toast(id ? '\u0420\u043e\u043b\u044c \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0430' : '\u0420\u043e\u043b\u044c \u0441\u043e\u0437\u0434\u0430\u043d\u0430');
  render();
}

async function deleteCompanyRole(id, name) {
  if (!confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0440\u043e\u043b\u044c "' + name + '"?')) return;
  var res = await api('/company-roles/' + id, { method: 'DELETE' });
  if (!res || res.error) { toast(res?.error || '\u041e\u0448\u0438\u0431\u043a\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f', 'error'); return; }
  var rolesRes = await api('/company-roles');
  data.companyRoles = (rolesRes && rolesRes.roles) || [];
  toast('\u0420\u043e\u043b\u044c \u0443\u0434\u0430\u043b\u0435\u043d\u0430');
  render();
}

// ===== SITE BLOCKS CONSTRUCTOR (emergent-style) =====
function renderSiteBlocks() {
  const blocks = data.siteBlocks || [];
  let h = '<div style="padding:32px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px"><div><h1 style="font-size:1.5rem;font-weight:800">\u041a\u043e\u043d\u0441\u0442\u0440\u0443\u043a\u0442\u043e\u0440 \u0431\u043b\u043e\u043a\u043e\u0432 v2</h1><p style="color:#94a3b8;font-size:0.85rem">\u0412\u0438\u0437\u0443\u0430\u043b\u044c\u043d\u043e\u0435 \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0441\u0435\u043a\u0446\u0438\u0439 \u0441\u0430\u0439\u0442\u0430 (RU/AM)</p></div>' +
    '<button class="btn btn-primary" onclick="createSiteBlock()"><i class="fas fa-plus" style="margin-right:6px"></i>\u041d\u043e\u0432\u044b\u0439 \u0431\u043b\u043e\u043a</button></div>';
  if (blocks.length === 0) {
    h += '<div class="card" style="text-align:center;padding:48px;color:#64748b"><i class="fas fa-cubes" style="font-size:2.5rem;margin-bottom:12px;display:block;opacity:0.3"></i><p>\u0411\u043b\u043e\u043a\u0438 \u0435\u0449\u0451 \u043d\u0435 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u044b</p></div>';
  } else {
    h += '<div style="display:grid;gap:8px">';
    blocks.forEach((b, idx) => {
      const textsCount = (b.texts_ru?.length||0) + (b.texts_am?.length||0);
      const imgsCount = b.images?.length||0;
      const btnsCount = b.buttons?.length||0;
      h += '<div class="card" draggable="true" ondragstart="sbDragStart(' + idx + ')" ondragover="sbDragOver(event,' + idx + ')" ondragend="sbDragEnd()" style="padding:0;overflow:hidden;opacity:' + (b.is_visible?'1':'0.5') + ';border-left:3px solid ' + (b.is_visible?'#8B5CF6':'#EF4444') + '">';
      h += '<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer;background:#1e293b" onclick="toggleSbExpand(' + b.id + ')">';
      h += '<i class="fas fa-grip-vertical" style="color:#64748b;cursor:grab" onclick="event.stopPropagation()"></i>';
      h += '<span style="color:#64748b;font-size:0.8rem;font-weight:700;min-width:28px">#' + (idx+1) + '</span>';
      h += '<div style="flex:1;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
      h += '<span style="font-weight:700;color:' + (b.is_visible?'#e2e8f0':'#f87171') + '">' + escHtml(b.title_ru||b.block_key) + '</span>';
      h += '<span class="badge badge-purple" style="font-size:0.7rem">' + escHtml(b.block_key) + '</span>';
      if (textsCount > 0) h += '<span class="badge" style="background:rgba(59,130,246,0.2);color:#60a5fa;font-size:0.68rem">' + textsCount + ' \u0442\u0435\u043a\u0441\u0442</span>';
      if (imgsCount > 0) h += '<span class="badge badge-green" style="font-size:0.68rem">' + imgsCount + ' \u0444\u043e\u0442\u043e</span>';
      if (btnsCount > 0) h += '<span class="badge badge-amber" style="font-size:0.68rem">' + btnsCount + ' \u043a\u043d\u043e\u043f\u043e\u043a</span>';
      h += '</div>';
      h += '<div style="display:flex;gap:4px" onclick="event.stopPropagation()">';
      h += '<button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem" onclick="editSiteBlock(' + b.id + ')" title="\u0420\u0435\u0434."><i class="fas fa-edit"></i></button>';
      h += '<button class="btn btn-outline" style="padding:4px 8px;font-size:0.75rem" onclick="dupSiteBlock(' + b.id + ')" title="\u041a\u043e\u043f\u0438\u044f"><i class="fas fa-copy"></i></button>';
      h += '<button class="btn ' + (b.is_visible?'btn-success':'btn-danger') + '" style="padding:4px 8px;font-size:0.75rem" onclick="toggleSbVisible(' + b.id + ',' + (b.is_visible?0:1) + ')">' + (b.is_visible?'<i class="fas fa-eye"></i>':'<i class="fas fa-eye-slash"></i>') + '</button>';
      h += '<button class="btn btn-danger" style="padding:4px 8px;font-size:0.75rem" onclick="delSiteBlock(' + b.id + ')"><i class="fas fa-trash"></i></button>';
      h += '</div>';
      h += '<i class="fas fa-chevron-down" style="color:#64748b"></i></div>';
      // Expanded preview
      h += '<div id="sb-expand-' + b.id + '" style="display:none;padding:16px;border-top:1px solid #334155;background:#0f172a">';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px"><div><div style="font-size:0.75rem;font-weight:700;color:#8B5CF6;margin-bottom:6px">\u0422\u0435\u043a\u0441\u0442\u044b (RU)</div>';
      (b.texts_ru||[]).forEach(t => { h += '<div style="font-size:0.85rem;margin-bottom:4px;padding:6px 10px;background:#1e293b;border-radius:6px;border:1px solid #334155">' + (escHtml(t)||'<span style="color:#64748b">\u043f\u0443\u0441\u0442\u043e</span>') + '</div>'; });
      h += '</div><div><div style="font-size:0.75rem;font-weight:700;color:#fbbf24;margin-bottom:6px">\u0422\u0435\u043a\u0441\u0442\u044b (AM)</div>';
      (b.texts_am||[]).forEach(t => { h += '<div style="font-size:0.85rem;margin-bottom:4px;padding:6px 10px;background:#1e293b;border-radius:6px;border:1px solid #334155">' + (escHtml(t)||'<span style="color:#64748b">\u043f\u0443\u0441\u0442\u043e</span>') + '</div>'; });
      h += '</div></div>';
      if ((b.buttons||[]).length > 0) {
        h += '<div style="font-size:0.75rem;font-weight:700;color:#a78bfa;margin-bottom:6px">\u041a\u043d\u043e\u043f\u043a\u0438</div><div style="display:flex;gap:8px;flex-wrap:wrap">';
        (b.buttons||[]).forEach(btn => { h += '<span style="padding:6px 12px;background:#8B5CF6;color:white;border-radius:6px;font-size:0.82rem">' + escHtml(btn.text_ru) + '</span>'; });
        h += '</div>';
      }
      h += '</div></div>';
    });
    h += '</div>';
  }
  h += '<div id="siteBlockModalArea"></div>';
  return h + '</div>';
}

function toggleSbExpand(id) {
  const el = document.getElementById('sb-expand-' + id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

let sbDragIdx = null;
function sbDragStart(idx) { sbDragIdx = idx; }
function sbDragOver(e, idx) { e.preventDefault(); }
async function sbDragEnd() {
  // Save current order (simplified — full reorder happens on server)
  const orders = (data.siteBlocks||[]).map((b, i) => ({ id: b.id, sort_order: i }));
  await api('/site-blocks/reorder', { method:'POST', body: JSON.stringify({ orders }) });
  sbDragIdx = null;
}

async function toggleSbVisible(id, val) {
  await api('/site-blocks/' + id, { method:'PUT', body: JSON.stringify({is_visible: val}) });
  const res = await api('/site-blocks');
  data.siteBlocks = (res && res.blocks) || [];
  render();
}

async function delSiteBlock(id) {
  if (!confirm('\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0431\u043b\u043e\u043a?')) return;
  await api('/site-blocks/' + id, { method:'DELETE' });
  const res = await api('/site-blocks');
  data.siteBlocks = (res && res.blocks) || [];
  toast('\u0411\u043b\u043e\u043a \u0443\u0434\u0430\u043b\u0451\u043d');
  render();
}

async function dupSiteBlock(id) {
  await api('/site-blocks/duplicate/' + id, { method:'POST' });
  const res = await api('/site-blocks');
  data.siteBlocks = (res && res.blocks) || [];
  toast('\u0411\u043b\u043e\u043a \u0434\u0443\u0431\u043b\u0438\u0440\u043e\u0432\u0430\u043d');
  render();
}

let editingBlock = null;
function createSiteBlock() {
  editingBlock = { block_key: 'block_' + Date.now(), block_type: 'section', title_ru: '\u041d\u043e\u0432\u044b\u0439 \u0431\u043b\u043e\u043a', title_am: '', texts_ru: [''], texts_am: [''], images: [], buttons: [], is_visible: true, custom_css: '', custom_html: '' };
  showBlockEditor();
}

function editSiteBlock(id) {
  const b = (data.siteBlocks||[]).find(x => x.id === id);
  if (!b) return;
  editingBlock = JSON.parse(JSON.stringify(b));
  showBlockEditor();
}

function showBlockEditor() {
  if (!editingBlock) return;
  const b = editingBlock;
  let h = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="closeBlockEditor()">' +
    '<div class="card" style="width:800px;max-width:95vw;max-height:90vh;overflow:auto" onclick="event.stopPropagation()">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="font-size:1.1rem;font-weight:700">' + (b.id ? '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0431\u043b\u043e\u043a' : '\u041d\u043e\u0432\u044b\u0439 \u0431\u043b\u043e\u043a') + '</h3><button class="btn btn-outline" style="padding:6px 10px" onclick="closeBlockEditor()"><i class="fas fa-times"></i></button></div>';
  // Basic fields
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px"><div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">\u041a\u043b\u044e\u0447 \u0431\u043b\u043e\u043a\u0430</label><input class="input" id="sbKey" value="' + escHtml(b.block_key) + '"></div><div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">\u0422\u0438\u043f</label><select class="input" id="sbType"><option value="section" ' + (b.block_type==='section'?'selected':'') + '>\u0421\u0435\u043a\u0446\u0438\u044f</option><option value="hero" ' + (b.block_type==='hero'?'selected':'') + '>Hero</option><option value="features" ' + (b.block_type==='features'?'selected':'') + '>Features</option><option value="cta" ' + (b.block_type==='cta'?'selected':'') + '>CTA</option><option value="custom" ' + (b.block_type==='custom'?'selected':'') + '>\u041a\u0430\u0441\u0442\u043e\u043c</option></select></div></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px"><div><label style="font-size:0.78rem;color:#8B5CF6;display:block;margin-bottom:4px">\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a (RU)</label><input class="input" id="sbTitleRu" value="' + escHtml(b.title_ru) + '"></div><div><label style="font-size:0.78rem;color:#fbbf24;display:block;margin-bottom:4px">\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a (AM)</label><input class="input" id="sbTitleAm" value="' + escHtml(b.title_am) + '"></div></div>';
  // Texts
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px"><div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><label style="font-size:0.78rem;color:#8B5CF6;font-weight:700">\u0422\u0435\u043a\u0441\u0442\u044b (RU)</label><button class="btn btn-outline" style="padding:2px 8px;font-size:0.72rem" onclick="addSbText(\\'ru\\')"><i class="fas fa-plus"></i></button></div><div id="sbTextsRu">';
  (b.texts_ru||[]).forEach((t, i) => { h += '<div style="display:flex;gap:6px;margin-bottom:6px"><textarea class="input" style="min-height:50px;font-size:0.82rem" onchange="editingBlock.texts_ru[' + i + ']=this.value">' + escHtml(t) + '</textarea><button class="tier-del-btn" onclick="rmSbText(\\'ru\\',' + i + ')"><i class="fas fa-times"></i></button></div>'; });
  h += '</div></div><div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><label style="font-size:0.78rem;color:#fbbf24;font-weight:700">\u0422\u0435\u043a\u0441\u0442\u044b (AM)</label><button class="btn btn-outline" style="padding:2px 8px;font-size:0.72rem" onclick="addSbText(\\'am\\')"><i class="fas fa-plus"></i></button></div><div id="sbTextsAm">';
  (b.texts_am||[]).forEach((t, i) => { h += '<div style="display:flex;gap:6px;margin-bottom:6px"><textarea class="input" style="min-height:50px;font-size:0.82rem" onchange="editingBlock.texts_am[' + i + ']=this.value">' + escHtml(t) + '</textarea><button class="tier-del-btn" onclick="rmSbText(\\'am\\',' + i + ')"><i class="fas fa-times"></i></button></div>'; });
  h += '</div></div></div>';
  // Buttons
  h += '<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><label style="font-size:0.78rem;font-weight:700;color:#a78bfa">\u041a\u043d\u043e\u043f\u043a\u0438</label><button class="btn btn-outline" style="padding:2px 8px;font-size:0.72rem" onclick="addSbBtn()"><i class="fas fa-plus"></i> \u041a\u043d\u043e\u043f\u043a\u0430</button></div><div id="sbButtons">';
  (b.buttons||[]).forEach((btn, i) => {
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 32px;gap:8px;margin-bottom:8px;padding:10px;background:#0f172a;border-radius:8px;border:1px solid #334155"><div><label style="font-size:0.7rem;color:#8B5CF6">\u0422\u0435\u043a\u0441\u0442 (RU)</label><input class="input" style="font-size:0.82rem" value="' + escHtml(btn.text_ru) + '" onchange="editingBlock.buttons[' + i + '].text_ru=this.value"></div>' +
      '<div><label style="font-size:0.7rem;color:#fbbf24">\u0422\u0435\u043a\u0441\u0442 (AM)</label><input class="input" style="font-size:0.82rem" value="' + escHtml(btn.text_am) + '" onchange="editingBlock.buttons[' + i + '].text_am=this.value"></div>' +
      '<div><label style="font-size:0.7rem;color:#64748b">URL</label><input class="input" style="font-size:0.82rem" value="' + escHtml(btn.url) + '" onchange="editingBlock.buttons[' + i + '].url=this.value" placeholder="https://..."></div>' +
      '<button class="tier-del-btn" style="align-self:end;margin-bottom:4px" onclick="rmSbBtn(' + i + ')"><i class="fas fa-times"></i></button></div>';
  });
  h += '</div></div>';
  // Custom CSS/HTML
  h += '<details style="margin-bottom:16px"><summary style="cursor:pointer;font-weight:700;font-size:0.85rem;color:#64748b;margin-bottom:8px">\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u043e (HTML/CSS)</summary><div style="margin-bottom:8px"><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Custom CSS</label><textarea class="input" id="sbCss" style="font-family:monospace;font-size:0.82rem;min-height:60px">' + escHtml(b.custom_css) + '</textarea></div><div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Custom HTML</label><textarea class="input" id="sbHtml" style="font-family:monospace;font-size:0.82rem;min-height:60px">' + escHtml(b.custom_html) + '</textarea></div></details>';
  // Actions
  h += '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-outline" onclick="closeBlockEditor()">\u041e\u0442\u043c\u0435\u043d\u0430</button><button class="btn btn-primary" onclick="saveSiteBlock()"><i class="fas fa-save" style="margin-right:6px"></i>\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c</button></div>';
  h += '</div></div>';
  const area = document.getElementById('siteBlockModalArea');
  if (area) area.innerHTML = h;
}

function closeBlockEditor() { editingBlock = null; const area = document.getElementById('siteBlockModalArea'); if (area) area.innerHTML = ''; }

function addSbText(lang) {
  if (!editingBlock) return;
  editingBlock['texts_' + lang].push('');
  showBlockEditor();
}
function rmSbText(lang, idx) {
  if (!editingBlock) return;
  editingBlock['texts_' + lang].splice(idx, 1);
  showBlockEditor();
}
function addSbBtn() {
  if (!editingBlock) return;
  editingBlock.buttons.push({ text_ru: '', text_am: '', url: '' });
  showBlockEditor();
}
function rmSbBtn(idx) {
  if (!editingBlock) return;
  editingBlock.buttons.splice(idx, 1);
  showBlockEditor();
}

async function saveSiteBlock() {
  if (!editingBlock) return;
  // Read current values from inputs
  editingBlock.block_key = document.getElementById('sbKey')?.value || editingBlock.block_key;
  editingBlock.block_type = document.getElementById('sbType')?.value || editingBlock.block_type;
  editingBlock.title_ru = document.getElementById('sbTitleRu')?.value || '';
  editingBlock.title_am = document.getElementById('sbTitleAm')?.value || '';
  editingBlock.custom_css = document.getElementById('sbCss')?.value || '';
  editingBlock.custom_html = document.getElementById('sbHtml')?.value || '';
  
  if (editingBlock.id) {
    await api('/site-blocks/' + editingBlock.id, { method:'PUT', body: JSON.stringify(editingBlock) });
  } else {
    await api('/site-blocks', { method:'POST', body: JSON.stringify(editingBlock) });
  }
  closeBlockEditor();
  const res = await api('/site-blocks');
  data.siteBlocks = (res && res.blocks) || [];
  toast('\u0411\u043b\u043e\u043a \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d');
  render();
}

function render() {
  const app = document.getElementById('app');
  if (!token) { app.innerHTML = renderLogin(); return; }
  
  let pageHtml = '';
  switch (currentPage) {
    case 'dashboard': pageHtml = renderDashboard(); break;
    case 'leads': pageHtml = renderLeads(); break;
    case 'analytics': pageHtml = renderLeadsAnalytics(); break;
    case 'employees': pageHtml = renderEmployees(); break;
    case 'permissions': pageHtml = renderPermissions(); break;
    case 'company_roles': pageHtml = renderCompanyRoles(); break;
    case 'blocks': pageHtml = renderSiteBlocks(); break;
    case 'calculator': pageHtml = renderCalculator(); break;
    case 'pdf': pageHtml = renderPdfTemplate(); break;
    case 'referrals': pageHtml = renderReferrals(); break;
    case 'slots': pageHtml = renderSlotCounter(); break;
    case 'footer': pageHtml = renderFooter(); break;
    case 'photos': pageHtml = renderPhotos(); break;
    case 'telegram': pageHtml = renderTelegram(); break;
    case 'tgbot': pageHtml = renderTelegramBot(); break;
    case 'scripts': pageHtml = renderScripts(); break;
    case 'settings': pageHtml = renderSettings(); break;
  }
  
  app.innerHTML = '<div style="display:flex">' + renderSidebar() + '<div class="main">' + pageHtml + '</div></div>';
}

// ===== INIT =====
window.onerror = function(msg, url, line, col) { 
  console.error('JS_ERROR:', msg, 'line:', line, 'col:', col);
  try { toast('Ошибка: ' + msg, 'error'); } catch(e) {}
};
window.addEventListener('unhandledrejection', function(e) {
  console.error('PROMISE_ERROR:', e.reason);
  try { toast('Async ошибка: ' + (e.reason?.message || e.reason), 'error'); } catch(ex) {}
});
(async function() {
  if (token) {
    try { await loadData(); } catch(err) { console.error('loadData error:', err); token = ''; localStorage.removeItem('gtt_token'); }
  }
  render();
})();
</script>
</body>
</html>`;
}
