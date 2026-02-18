/**
 * Admin panel HTML — full SPA for managing site content
 */
export function getAdminHTML(): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
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
let data = { content: [], calcTabs: [], calcServices: [], telegram: [], scripts: [], stats: {}, referrals: [], sectionOrder: [], leads: { leads: [], total: 0 }, telegramBot: [], pdfTemplate: {}, slotCounters: [], settings: {}, footer: {}, photoBlocks: [] };

// ===== API HELPERS =====
const API = '/api/admin';
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
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
  const res = await fetch(API + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: document.getElementById('loginUser').value, password: document.getElementById('loginPass').value })
  }).then(r => r.json());
  if (res.token) {
    token = res.token;
    localStorage.setItem('gtt_token', token);
    toast('Добро пожаловать, ' + (res.user.display_name || res.user.username));
    await loadData();
    render();
  } else {
    toast(res.error || 'Ошибка входа', 'error');
  }
}

// ===== DATA LOADING =====
async function loadData() {
  const [content, tabs, services, telegram, scripts, stats, referrals, sectionOrder, leads, telegramBot, pdfTemplate, slotCounterRes, settings, footerData, photoBlocksData] = await Promise.all([
    api('/content'), api('/calc-tabs'), api('/calc-services'), api('/telegram'), api('/scripts'), api('/stats'), api('/referrals'), api('/section-order'),
    api('/leads?limit=50'), api('/telegram-bot'), api('/pdf-template'), api('/slot-counter'), api('/settings'), api('/footer'), api('/photo-blocks')
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
}

// ===== NAVIGATION =====
const pages = [
  { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Дашборд' },
  { id: 'leads', icon: 'fa-users', label: 'Лиды / CRM' },
  { id: 'content', icon: 'fa-file-alt', label: 'Тексты сайта' },
  { id: 'calculator', icon: 'fa-calculator', label: 'Калькулятор' },
  { id: 'pdf', icon: 'fa-file-pdf', label: 'PDF шаблон' },
  { id: 'referrals', icon: 'fa-gift', label: 'Реферальные коды' },
  { id: 'sections', icon: 'fa-th-list', label: 'Порядок блоков' },
  { id: 'slots', icon: 'fa-clock', label: 'Счётчик слотов' },
  { id: 'footer', icon: 'fa-shoe-prints', label: 'Футер сайта' },
  { id: 'photos', icon: 'fa-images', label: 'Фото блоки' },
  { id: 'telegram', icon: 'fa-telegram', label: 'TG сообщения', fab: true },
  { id: 'tgbot', icon: 'fa-robot', label: 'TG Бот / Уведомления' },
  { id: 'scripts', icon: 'fa-code', label: 'Скрипты' },
  { id: 'settings', icon: 'fa-cog', label: 'Настройки' },
];

function renderSidebar() {
  let h = '<div class="sidebar flex flex-col"><div style="padding:20px;border-bottom:1px solid #334155">' +
    '<div style="font-size:1.3rem;font-weight:800;color:#a78bfa">Go to Top</div>' +
    '<div style="font-size:0.8rem;color:#64748b;margin-top:4px">Админ-панель</div></div><div style="padding:8px 0;flex:1">';
  for (const p of pages) {
    h += '<div class="nav-item' + (currentPage === p.id ? ' active' : '') + '" onclick="navigate(&apos;' + p.id + '&apos;)">' +
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
function doLogout() { token = ''; localStorage.removeItem('gtt_token'); render(); }
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
        '<li>📝 <strong>Тексты сайта</strong> — редактирование всех текстов на RU и AM</li>' +
        '<li>🧮 <strong>Калькулятор</strong> — управление услугами, ценами и вкладками</li>' +
        '<li>📄 <strong>PDF шаблон</strong> — тексты для автоматического коммерческого предложения</li>' +
        '<li>🎁 <strong>Реферальные коды</strong> — кодовые слова для скидок и бесплатных отзывов</li>' +
        '<li>📦 <strong>Порядок блоков</strong> — перемещайте и скрывайте секции сайта</li>' +
        '<li>⏱ <strong>Счётчик слотов</strong> — показ свободных мест на сайте</li>' +
        '<li>💬 <strong>TG сообщения</strong> — шаблоны сообщений для каждой кнопки на сайте</li>' +
        '<li>🤖 <strong>TG Бот</strong> — автоматические уведомления о заявках в Telegram</li>' +
        '<li>📜 <strong>Скрипты</strong> — добавление аналитики, пикселей, meta-тегов</li>' +
        '<li>⚙️ <strong>Настройки</strong> — смена пароля</li>' +
      '</ul>' +
    '</div>' +
  '</div>';
}

// ===== CONTENT EDITOR =====
function renderContent() {
  let h = '<div style="padding:32px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">' +
    '<div><h1 style="font-size:1.8rem;font-weight:800">Тексты сайта</h1><p style="color:#94a3b8;margin-top:4px">Редактирование текстов на русском и армянском</p></div>' +
    '<button class="btn btn-primary" onclick="seedContent()"><i class="fas fa-download" style="margin-right:6px"></i>Загрузить тексты с сайта</button>' +
  '</div>';
  
  if (!data.content.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-inbox" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8">Контент ещё не загружен. Нажмите "Загрузить тексты с сайта" для импорта всех текущих текстов.</p></div>';
  } else {
    for (const section of data.content) {
      let items = [];
      try { items = JSON.parse(section.content_json); } catch {}
      h += '<div class="card" style="margin-bottom:16px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;cursor:pointer" onclick="toggleSection(this)">' +
          '<div><span class="badge badge-purple">' + section.section_key + '</span> <strong style="margin-left:8px">' + section.section_name + '</strong> <span style="color:#64748b;font-size:0.8rem">(' + items.length + ' текстов)</span></div>' +
          '<i class="fas fa-chevron-down" style="color:#64748b;transition:transform 0.2s"></i>' +
        '</div>' +
        '<div class="section-items" style="display:none">';
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        h += '<div class="section-edit-row">' +
          '<div style="display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:start">' +
            '<span style="color:#64748b;font-size:0.8rem;padding-top:10px">#' + (i+1) + '</span>' +
            '<div>' +
              '<div style="margin-bottom:8px"><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">RU</label>' +
                '<textarea class="input" style="min-height:40px;margin-top:4px" data-section="' + section.section_key + '" data-idx="' + i + '" data-lang="ru">' + escHtml(item.ru) + '</textarea></div>' +
              '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">AM</label>' +
                '<textarea class="input" style="min-height:40px;margin-top:4px" data-section="' + section.section_key + '" data-idx="' + i + '" data-lang="am">' + escHtml(item.am) + '</textarea></div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }
      
      h += '<div style="text-align:right;margin-top:12px"><button class="btn btn-success" onclick="saveSection(&apos;' + section.section_key + '&apos;)"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить секцию</button></div>';
      h += '</div></div>';
    }
  }
  h += '</div>';
  return h;
}

function toggleSection(el) {
  const items = el.nextElementSibling;
  const icon = el.querySelector('i');
  if (items.style.display === 'none') {
    items.style.display = 'block';
    icon.style.transform = 'rotate(180deg)';
  } else {
    items.style.display = 'none';
    icon.style.transform = '';
  }
}

async function saveSection(key) {
  const section = data.content.find(s => s.section_key === key);
  if (!section) return;
  let items = [];
  try { items = JSON.parse(section.content_json); } catch {}
  
  document.querySelectorAll('[data-section="' + key + '"]').forEach(el => {
    const idx = parseInt(el.dataset.idx);
    const lang = el.dataset.lang;
    if (items[idx]) items[idx][lang] = el.value;
  });
  
  await api('/content/' + key, { method: 'PUT', body: JSON.stringify({ content_json: items }) });
  section.content_json = JSON.stringify(items);
  toast('Секция "' + key + '" сохранена');
}

async function seedContent() {
  toast('Загрузка текстов с сайта...', 'info');
  const res = await fetch('/api/admin/seed-from-site', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } });
  if (res.ok) {
    toast('Тексты успешно загружены!');
    await loadData();
    render();
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

// ===== SECTION ORDER =====
function renderSections() {
  var sections = data.sectionOrder;
  var h = '<div style="padding:32px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">' +
    '<div><h1 style="font-size:1.8rem;font-weight:800">Порядок блоков сайта</h1><p style="color:#94a3b8;margin-top:4px">Перемещайте блоки вверх/вниз и скрывайте ненужные</p></div>' +
    '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-outline" onclick="seedSections()"><i class="fas fa-download" style="margin-right:6px"></i>Загрузить блоки</button>' +
      '<button class="btn btn-success" onclick="saveSectionOrder()"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить порядок</button>' +
    '</div>' +
  '</div>';
  
  if (!sections.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-th-list" style="font-size:3rem;color:#475569;margin-bottom:16px"></i>' +
      '<p style="color:#94a3b8">Блоки ещё не загружены. Нажмите \"Загрузить блоки\" для импорта.</p></div>';
  } else {
    h += '<div id="sectionList">';
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      h += '<div class="card" style="margin-bottom:8px;padding:14px 20px;display:flex;align-items:center;gap:16px;' + (!s.is_visible ? 'opacity:0.5;' : '') + '" data-section-idx="' + i + '">' +
        '<div style="display:flex;flex-direction:column;gap:4px">' +
          '<button class="btn btn-outline" style="padding:4px 8px;font-size:0.7rem;line-height:1" onclick="moveSection(' + i + ',-1)" ' + (i === 0 ? 'disabled style="padding:4px 8px;font-size:0.7rem;line-height:1;opacity:0.3"' : '') + '><i class="fas fa-chevron-up"></i></button>' +
          '<button class="btn btn-outline" style="padding:4px 8px;font-size:0.7rem;line-height:1" onclick="moveSection(' + i + ',1)" ' + (i === sections.length-1 ? 'disabled style="padding:4px 8px;font-size:0.7rem;line-height:1;opacity:0.3"' : '') + '><i class="fas fa-chevron-down"></i></button>' +
        '</div>' +
        '<div style="flex:1"><span style="font-weight:700;font-size:0.95rem">' + escHtml(s.label_ru || s.section_id) + '</span> <span style="color:#64748b;font-size:0.8rem;margin-left:8px">#' + s.section_id + '</span></div>' +
        '<button class="btn ' + (s.is_visible ? 'btn-success' : 'btn-danger') + '" style="padding:6px 14px;font-size:0.8rem" onclick="toggleSectionVis(' + i + ')">' +
          (s.is_visible ? '<i class="fas fa-eye"></i> Видим' : '<i class="fas fa-eye-slash"></i> Скрыт') +
        '</button>' +
      '</div>';
    }
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function moveSection(idx, dir) {
  var arr = data.sectionOrder;
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= arr.length) return;
  var tmp = arr[idx];
  arr[idx] = arr[newIdx];
  arr[newIdx] = tmp;
  // Update sort_order values
  for (var i = 0; i < arr.length; i++) arr[i].sort_order = i;
  render();
}

function toggleSectionVis(idx) {
  data.sectionOrder[idx].is_visible = data.sectionOrder[idx].is_visible ? 0 : 1;
  render();
}

async function saveSectionOrder() {
  var sections = data.sectionOrder.map(function(s, i) {
    return { section_id: s.section_id, sort_order: i, is_visible: s.is_visible, label_ru: s.label_ru, label_am: s.label_am };
  });
  await api('/section-order', { method: 'POST', body: JSON.stringify({ sections: sections }) });
  toast('Порядок блоков сохранён! Обновите сайт для проверки.');
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
function renderLeads() {
  var leads = (data.leads && data.leads.leads) ? data.leads.leads : [];
  var total = (data.leads && data.leads.total) ? data.leads.total : 0;
  var h = '<div style="padding:32px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">' +
    '<div><h1 style="font-size:1.8rem;font-weight:800"><i class="fas fa-users" style="color:#8B5CF6;margin-right:10px"></i>Лиды / CRM</h1><p style="color:#94a3b8;margin-top:4px">Все заявки с сайта. Всего: ' + total + '</p></div>' +
    '<a href="/api/admin/leads/export" target="_blank" class="btn btn-success" style="text-decoration:none"><i class="fas fa-download" style="margin-right:6px"></i>Экспорт CSV</a>' +
  '</div>';

  if (!leads.length) {
    h += '<div class="card" style="text-align:center;padding:48px"><i class="fas fa-inbox" style="font-size:3rem;color:#475569;margin-bottom:16px"></i><p style="color:#94a3b8">Заявок пока нет.</p></div>';
  } else {
    for (var i = 0; i < leads.length; i++) {
      var l = leads[i];
      var isCalc = l.source === 'calculator_pdf';
      var calcData = null;
      if (isCalc && l.calc_data) { try { calcData = JSON.parse(l.calc_data); } catch(e) {} }
      var statusIcon = {'new':'🟢','contacted':'💬','in_progress':'🔄','done':'✅','rejected':'❌'}[l.status] || '⚪';
      
      h += '<div class="card" style="margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">' +
          '<div style="flex:1;min-width:200px">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
              '<span style="font-size:1rem;font-weight:800;color:#a78bfa">#' + l.id + '</span>' +
              '<span class="badge badge-purple">' + (l.source || 'form') + '</span>' +
              (l.referral_code ? '<span class="badge badge-amber">🏷 ' + escHtml(l.referral_code) + '</span>' : '') +
            '</div>' +
            '<div style="font-size:1.05rem;font-weight:700;color:#e2e8f0">' + escHtml(l.name || '—') + '</div>' +
            '<div style="font-size:0.9rem;color:#a78bfa;margin-top:2px">' + escHtml(l.contact || '—') + '</div>' +
            (l.message ? '<div style="font-size:0.82rem;color:#94a3b8;margin-top:4px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(l.message).substring(0,80) + '</div>' : '') +
          '</div>';
      
      // Right side: status + total + date + actions
      h += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:180px">';
      
      if (calcData && calcData.total) {
        h += '<div style="font-size:1.3rem;font-weight:900;color:#8B5CF6;white-space:nowrap">' + Number(calcData.total).toLocaleString('ru-RU') + '&nbsp;֏</div>';
      }
      
      h += '<select class="input" style="width:150px;padding:4px 8px;font-size:0.82rem" onchange="updateLeadStatus(' + l.id + ', this.value)">' +
        '<option value="new"' + (l.status === 'new' ? ' selected' : '') + '>🟢 Новый</option>' +
        '<option value="contacted"' + (l.status === 'contacted' ? ' selected' : '') + '>💬 Связались</option>' +
        '<option value="in_progress"' + (l.status === 'in_progress' ? ' selected' : '') + '>🔄 В работе</option>' +
        '<option value="done"' + (l.status === 'done' ? ' selected' : '') + '>✅ Завершён</option>' +
        '<option value="rejected"' + (l.status === 'rejected' ? ' selected' : '') + '>❌ Отклонён</option></select>';
      
      h += '<div style="font-size:0.78rem;color:#64748b">' + (l.created_at || '').substring(0, 16) + '</div>';
      h += '<div style="display:flex;gap:4px">';
      if (isCalc) {
        h += '<a href="/pdf/' + l.id + '" target="_blank" class="btn btn-primary" style="padding:4px 10px;font-size:0.75rem;text-decoration:none"><i class="fas fa-file-pdf" style="margin-right:4px"></i>КП</a>';
      }
      h += '<button class="btn btn-danger" style="padding:4px 8px;font-size:0.75rem" onclick="deleteLead(' + l.id + ')"><i class="fas fa-trash"></i></button>';
      h += '</div></div></div>';
      
      // Services breakdown
      if (calcData && calcData.items && calcData.items.length > 0) {
        h += '<div style="margin-top:10px;border-top:1px solid #334155;padding-top:10px">' +
          '<div style="font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:6px"><i class="fas fa-receipt" style="margin-right:4px;color:#a78bfa"></i>Выбранные услуги:</div>' +
          '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:4px 12px;font-size:0.82rem">' +
          '<div style="color:#64748b;font-weight:600">Услуга</div><div style="color:#64748b;font-weight:600;text-align:center">Кол-во</div><div style="color:#64748b;font-weight:600;text-align:right">Цена</div><div style="color:#64748b;font-weight:600;text-align:right">Сумма</div>';
        for (var ci = 0; ci < calcData.items.length; ci++) {
          var item = calcData.items[ci];
          h += '<div style="color:#e2e8f0">' + escHtml(item.name || '') + '</div>' +
            '<div style="text-align:center;color:#94a3b8">' + (item.qty || 1) + '</div>' +
            '<div style="text-align:right;color:#94a3b8;white-space:nowrap">' + Number(item.price || 0).toLocaleString('ru-RU') + '&nbsp;֏</div>' +
            '<div style="text-align:right;color:#a78bfa;font-weight:600;white-space:nowrap">' + Number(item.subtotal || 0).toLocaleString('ru-RU') + '&nbsp;֏</div>';
        }
        h += '</div></div>';
      }
      h += '</div>';
    }
  }
  h += '</div>';
  return h;
}

async function updateLeadStatus(id, status) {
  await api('/leads/' + id, { method: 'PUT', body: JSON.stringify({ status: status, notes: '' }) });
  toast('Статус обновлён');
}

async function deleteLead(id) {
  if (!confirm('Удалить эту заявку?')) return;
  await api('/leads/' + id, { method: 'DELETE' });
  toast('Заявка удалена');
  await loadData(); render();
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
  var positions = [
    { id: 'in-header', label: '📍 В шапке сайта', desc: 'Под навигацией' },
    { id: 'after-hero', label: '⭐ После Hero', desc: 'Между Hero и услугами' },
    { id: 'before-calc', label: '🧮 Перед калькулятором', desc: 'Над калькулятором' },
    { id: 'before-contact', label: '📞 Перед контактами', desc: 'Перед футером' },
    { id: 'after-ticker', label: '🏃 После бегущей строки', desc: 'Между тикером и услугами' }
  ];

  var h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Счётчики свободных мест</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">До 2 счётчиков с отдельными именами и позициями</p>';

  if (counters.length < 2) {
    h += '<button class="btn btn-primary" style="margin-bottom:20px" onclick="addSlotCounter()"><i class="fas fa-plus" style="margin-right:6px"></i>Добавить счётчик</button>';
  }

  for (var ci = 0; ci < counters.length; ci++) {
    var s = counters[ci];
    var cid = s.id;
    var pos = s.position || 'after-hero';
    h += '<div class="card" style="margin-bottom:20px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<h3 style="font-weight:700"><i class="fas fa-hashtag" style="color:#8B5CF6;margin-right:8px"></i>Счётчик #' + (ci+1) + ' — <span style="color:#a78bfa">' + escHtml(s.counter_name || 'main') + '</span></h3>' +
      '<button class="btn btn-danger" style="font-size:0.8rem;padding:6px 14px" onclick="deleteSlotCounter('+cid+')"><i class="fas fa-trash"></i></button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:16px">' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Имя</label><input class="input" id="sc_name_'+cid+'" value="' + escHtml(s.counter_name) + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Всего мест</label><input class="input" type="number" id="sc_total_'+cid+'" value="' + (s.total_slots || 10) + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Занято</label><input class="input" type="number" id="sc_booked_'+cid+'" value="' + (s.booked_slots || 0) + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#64748b;font-weight:600">Свободно</label><div style="font-size:1.8rem;font-weight:800;color:#10B981;padding:6px 0">' + Math.max(0, (s.total_slots || 10) - (s.booked_slots || 0)) + '</div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div><label style="font-size:0.75rem;color:#8B5CF6;font-weight:600">Надпись (RU)</label><input class="input" id="sc_lru_'+cid+'" value="' + escHtml(s.label_ru) + '"></div>' +
        '<div><label style="font-size:0.75rem;color:#F59E0B;font-weight:600">Надпись (AM)</label><input class="input" id="sc_lam_'+cid+'" value="' + escHtml(s.label_am) + '"></div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><input type="checkbox" id="sc_show_'+cid+'"' + (s.show_timer ? ' checked' : '') + '><label style="font-size:0.9rem;color:#94a3b8">Показывать на сайте</label></div>' +
      '<div style="margin-bottom:12px"><label style="font-size:0.75rem;color:#64748b;font-weight:600;margin-bottom:8px;display:block">Позиция на странице</label><select class="input" id="sc_pos_'+cid+'" style="cursor:pointer">';
    for (var pi = 0; pi < positions.length; pi++) {
      h += '<option value="'+positions[pi].id+'"'+(pos===positions[pi].id?' selected':'')+'>'+positions[pi].label+' — '+positions[pi].desc+'</option>';
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
  var positions = [
    { id: 'after-hero', label: 'После Hero' },
    { id: 'after-services', label: 'После услуг' },
    { id: 'before-calc', label: 'Перед калькулятором' },
    { id: 'after-about', label: 'После «О нас»' },
    { id: 'before-contact', label: 'Перед контактами' },
    { id: 'after-guarantee', label: 'После гарантий' }
  ];

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

function render() {
  const app = document.getElementById('app');
  if (!token) { app.innerHTML = renderLogin(); return; }
  
  let pageHtml = '';
  switch (currentPage) {
    case 'dashboard': pageHtml = renderDashboard(); break;
    case 'leads': pageHtml = renderLeads(); break;
    case 'content': pageHtml = renderContent(); break;
    case 'calculator': pageHtml = renderCalculator(); break;
    case 'pdf': pageHtml = renderPdfTemplate(); break;
    case 'referrals': pageHtml = renderReferrals(); break;
    case 'sections': pageHtml = renderSections(); break;
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
(async function() {
  if (token) {
    try { await loadData(); } catch { token = ''; localStorage.removeItem('gtt_token'); }
  }
  render();
})();
</script>
</body>
</html>`;
}
