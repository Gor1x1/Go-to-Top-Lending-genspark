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
</style>
</head>
<body>
<div id="app"></div>
<script>
// ===== STATE =====
let token = localStorage.getItem('gtt_token') || '';
let currentPage = 'dashboard';
let data = { content: [], calcTabs: [], calcServices: [], telegram: [], scripts: [], stats: {} };

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
  const [content, tabs, services, telegram, scripts, stats] = await Promise.all([
    api('/content'), api('/calc-tabs'), api('/calc-services'), api('/telegram'), api('/scripts'), api('/stats')
  ]);
  data.content = content || [];
  data.calcTabs = tabs || [];
  data.calcServices = services || [];
  data.telegram = telegram || [];
  data.scripts = scripts || [];
  data.stats = stats || {};
}

// ===== NAVIGATION =====
const pages = [
  { id: 'dashboard', icon: 'fa-tachometer-alt', label: 'Дашборд' },
  { id: 'content', icon: 'fa-file-alt', label: 'Тексты сайта' },
  { id: 'calculator', icon: 'fa-calculator', label: 'Калькулятор' },
  { id: 'telegram', icon: 'fa-telegram', label: 'Telegram сообщения', fab: true },
  { id: 'scripts', icon: 'fa-code', label: 'Скрипты' },
  { id: 'settings', icon: 'fa-cog', label: 'Настройки' },
];

function renderSidebar() {
  let h = '<div class="sidebar flex flex-col"><div style="padding:20px;border-bottom:1px solid #334155">' +
    '<div style="font-size:1.3rem;font-weight:800;color:#a78bfa">Go to Top</div>' +
    '<div style="font-size:0.8rem;color:#64748b;margin-top:4px">Админ-панель</div></div><div style="padding:8px 0;flex:1">';
  for (const p of pages) {
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
function doLogout() { token = ''; localStorage.removeItem('gtt_token'); render(); }
function previewSite() {
  toast('Изменения применены! Сайт обновляется автоматически при каждой загрузке страницы.', 'success');
  window.open('/?_nocache=' + Date.now(), '_blank');
}

// ===== DASHBOARD =====
function renderDashboard() {
  const s = data.stats;
  return '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Дашборд</h1>' +
    '<p style="color:#94a3b8;margin-bottom:32px">Обзор управления сайтом Go to Top</p>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin-bottom:32px">' +
      '<div class="stat-card"><div class="stat-num">' + (s.content_sections || 0) + '</div><div style="color:#94a3b8;font-size:0.85rem;margin-top:4px">Секций контента</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + (s.calculator_services || 0) + '</div><div style="color:#94a3b8;font-size:0.85rem;margin-top:4px">Услуг в калькуляторе</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + (s.telegram_buttons || 0) + '</div><div style="color:#94a3b8;font-size:0.85rem;margin-top:4px">Telegram кнопок</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + (s.custom_scripts || 0) + '</div><div style="color:#94a3b8;font-size:0.85rem;margin-top:4px">Скриптов</div></div>' +
    '</div>' +
    '<div class="card"><h3 style="font-weight:700;margin-bottom:12px"><i class="fas fa-info-circle" style="color:#8B5CF6;margin-right:8px"></i>Как пользоваться</h3>' +
      '<ul style="color:#94a3b8;font-size:0.9rem;line-height:2">' +
        '<li>📝 <strong>Тексты сайта</strong> — редактирование всех текстов на RU и AM</li>' +
        '<li>🧮 <strong>Калькулятор</strong> — управление услугами, ценами и вкладками</li>' +
        '<li>💬 <strong>Telegram сообщения</strong> — шаблоны сообщений для каждой кнопки на сайте</li>' +
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
      
      h += '<div style="text-align:right;margin-top:12px"><button class="btn btn-success" onclick="saveSection(\\'' + section.section_key + '\\')"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить секцию</button></div>';
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
  let h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:8px">Калькулятор услуг</h1>' +
    '<p style="color:#94a3b8;margin-bottom:24px">Управление вкладками и услугами калькулятора</p>';
  
  // Tabs management
  h += '<div class="card" style="margin-bottom:24px"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-folder" style="color:#8B5CF6;margin-right:8px"></i>Вкладки калькулятора</h3>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">';
  for (const tab of data.calcTabs) {
    h += '<div class="tab-btn active" style="position:relative;padding-right:32px">' + tab.name_ru + ' / ' + tab.name_am +
      '<span onclick="event.stopPropagation();deleteCalcTab(' + tab.id + ')" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);cursor:pointer;color:#ef4444;font-size:0.7rem"><i class="fas fa-times"></i></span></div>';
  }
  h += '<button class="btn btn-outline" style="font-size:0.8rem" onclick="addCalcTab()"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button>';
  h += '</div></div>';
  
  // Services
  h += '<div class="card"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-list" style="color:#8B5CF6;margin-right:8px"></i>Услуги</h3>';
  h += '<button class="btn btn-primary" style="margin-bottom:16px" onclick="addCalcService()"><i class="fas fa-plus" style="margin-right:6px"></i>Добавить услугу</button>';
  
  // Group by tab
  const byTab = {};
  for (const svc of data.calcServices) {
    const tabKey = svc.tab_key || 'unknown';
    if (!byTab[tabKey]) byTab[tabKey] = [];
    byTab[tabKey].push(svc);
  }
  
  for (const [tabKey, svcs] of Object.entries(byTab)) {
    const tab = data.calcTabs.find(t => t.tab_key === tabKey);
    h += '<div style="margin-bottom:20px"><h4 style="color:#a78bfa;font-weight:600;margin-bottom:8px">' + (tab ? tab.name_ru : tabKey) + '</h4>';
    for (const svc of svcs) {
      var isTiered = svc.price_type === 'tiered' && svc.price_tiers_json;
      var tiers = [];
      if (isTiered) { try { tiers = JSON.parse(svc.price_tiers_json); } catch(e) { tiers = []; } }
      
      h += '<div class="section-edit-row" style="margin-bottom:12px">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr auto auto auto;gap:12px;align-items:center">' +
          '<div><div style="font-size:0.7rem;color:#64748b">RU</div><input class="input" value="' + escHtml(svc.name_ru) + '" id="svc_ru_' + svc.id + '"></div>' +
          '<div><div style="font-size:0.7rem;color:#64748b">AM</div><input class="input" value="' + escHtml(svc.name_am) + '" id="svc_am_' + svc.id + '"></div>' +
          '<div><div style="font-size:0.7rem;color:#64748b">Цена (֏)</div><input class="input" type="number" value="' + svc.price + '" style="width:100px" id="svc_price_' + svc.id + '"></div>' +
          '<button class="btn btn-success" style="padding:8px 12px" onclick="saveCalcService(' + svc.id + ')"><i class="fas fa-save"></i></button>' +
          '<button class="btn btn-danger" style="padding:8px 12px" onclick="deleteCalcService(' + svc.id + ')"><i class="fas fa-trash"></i></button>' +
        '</div>';
      
      // Tier editor for tiered services
      if (isTiered && tiers.length > 0) {
        h += '<div style="margin-top:10px;padding:12px;background:#0f172a;border:1px solid rgba(139,92,246,0.3);border-radius:8px">' +
          '<div style="font-size:0.8rem;font-weight:600;color:#a78bfa;margin-bottom:8px"><i class="fas fa-layer-group" style="margin-right:6px"></i>Тарифная шкала (price tiers)</div>';
        for (var ti = 0; ti < tiers.length; ti++) {
          h += '<div style="display:grid;grid-template-columns:auto 80px auto 80px auto 100px auto;gap:8px;align-items:center;margin-bottom:6px">' +
            '<span style="font-size:0.8rem;color:#94a3b8">от</span>' +
            '<input class="input" type="number" value="' + tiers[ti].min + '" style="padding:6px 8px;font-size:0.85rem" id="tier_min_' + svc.id + '_' + ti + '">' +
            '<span style="font-size:0.8rem;color:#94a3b8">до</span>' +
            '<input class="input" type="number" value="' + tiers[ti].max + '" style="padding:6px 8px;font-size:0.85rem" id="tier_max_' + svc.id + '_' + ti + '">' +
            '<span style="font-size:0.8rem;color:#94a3b8">= ֏</span>' +
            '<input class="input" type="number" value="' + tiers[ti].price + '" style="padding:6px 8px;font-size:0.85rem" id="tier_price_' + svc.id + '_' + ti + '">' +
            '<button class="btn btn-danger" style="padding:4px 8px;font-size:0.7rem" onclick="deleteTier(' + svc.id + ',' + ti + ',' + tiers.length + ')" title="Удалить строку"><i class="fas fa-trash"></i></button>' +
          '</div>';
        }
        h += '<div style="margin-top:8px;display:flex;gap:8px">' +
          '<button class="btn btn-success" style="padding:6px 14px;font-size:0.8rem" onclick="saveTiers(' + svc.id + ',' + tiers.length + ')"><i class="fas fa-save" style="margin-right:4px"></i>Сохранить тарифы</button>' +
          '<button class="btn btn-outline" style="padding:6px 14px;font-size:0.8rem" onclick="addTier(' + svc.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить строку</button>' +
        '</div></div>';
      }
      h += '</div>';
    }
    h += '</div>';
  }
  h += '</div></div>';
  return h;
}

async function saveCalcService(id) {
  const svc = data.calcServices.find(s => s.id === id);
  if (!svc) return;
  const ru = document.getElementById('svc_ru_' + id).value;
  const am = document.getElementById('svc_am_' + id).value;
  const price = parseInt(document.getElementById('svc_price_' + id).value);
  await api('/calc-services/' + id, { method: 'PUT', body: JSON.stringify({ ...svc, name_ru: ru, name_am: am, price: price }) });
  toast('Услуга сохранена');
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
  if (!tiers.length) { toast('Заполните хотя бы один тариф', 'error'); return; }
  var svc = data.calcServices.find(s => s.id === svcId);
  if (!svc) return;
  await api('/calc-services/' + svcId, { method: 'PUT', body: JSON.stringify({ ...svc, price_tiers_json: JSON.stringify(tiers), price: tiers[0].price }) });
  toast('Тарифы сохранены! Обновите сайт для проверки.');
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
  toast('Строка добавлена');
  await loadData(); render();
}

async function deleteTier(svcId, tierIndex, totalTiers) {
  if (totalTiers <= 1) { toast('Нельзя удалить последний тариф. Должна остаться хотя бы 1 строка.', 'error'); return; }
  if (!confirm('Удалить эту строку тарифа?')) return;
  var svc = data.calcServices.find(s => s.id === svcId);
  if (!svc) return;
  var tiers = [];
  try { tiers = JSON.parse(svc.price_tiers_json); } catch(e) { tiers = []; }
  if (tierIndex < 0 || tierIndex >= tiers.length) return;
  tiers.splice(tierIndex, 1);
  await api('/calc-services/' + svcId, { method: 'PUT', body: JSON.stringify({ ...svc, price_tiers_json: JSON.stringify(tiers), price: tiers[0].price }) });
  toast('Строка тарифа удалена');
  await loadData(); render();
}

async function deleteCalcService(id) {
  if (!confirm('Удалить эту услугу?')) return;
  await api('/calc-services/' + id, { method: 'DELETE' });
  toast('Услуга удалена');
  await loadData(); render();
}

async function addCalcService() {
  const tabId = data.calcTabs.length ? data.calcTabs[0].id : null;
  if (!tabId) { toast('Сначала создайте вкладку', 'error'); return; }
  const ru = prompt('Название услуги (RU):');
  if (!ru) return;
  const am = prompt('Название услуги (AM):') || ru;
  const price = parseInt(prompt('Цена (֏):') || '0');
  await api('/calc-services', { method: 'POST', body: JSON.stringify({ tab_id: tabId, name_ru: ru, name_am: am, price, price_type: 'fixed', sort_order: data.calcServices.length + 1 }) });
  toast('Услуга добавлена');
  await loadData(); render();
}

async function addCalcTab() {
  const key = prompt('Ключ вкладки (англ, напр: buyouts):');
  if (!key) return;
  const ru = prompt('Название (RU):');
  const am = prompt('Название (AM):') || ru;
  await api('/calc-tabs', { method: 'POST', body: JSON.stringify({ tab_key: key, name_ru: ru, name_am: am, sort_order: data.calcTabs.length + 1 }) });
  toast('Вкладка добавлена');
  await loadData(); render();
}

async function deleteCalcTab(id) {
  if (!confirm('Удалить вкладку и все её услуги?')) return;
  await api('/calc-tabs/' + id, { method: 'DELETE' });
  toast('Вкладка удалена');
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
    case 'content': pageHtml = renderContent(); break;
    case 'calculator': pageHtml = renderCalculator(); break;
    case 'telegram': pageHtml = renderTelegram(); break;
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
