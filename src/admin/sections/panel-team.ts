/**
 * Admin Panel — Team access, roles, permissions, company roles
 * 574 lines of admin SPA JS code
 */
export const CODE: string = `
// ===== TEAM ACCESS (ROLES + PERMISSIONS) — UNIFIED =====
var _teamAccessTab = 'matrix'; // matrix | roles | log
var editPermUserId = 0;
let selectedPermUserId = null;
let selectedPermSections = [];

function renderTeamAccess() {
  var isAdmin = currentUser && currentUser.role === 'main_admin';
  var roles = data.companyRoles || [];
  var users = ensureArray(data.users);
  var rl = rolesConfig?.role_labels || {};
  var sl = rolesConfig?.section_labels || {};
  var allSections = rolesConfig?.sections || [];
  
  var h = '<div style="padding:32px">';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">';
  h += '<div><h1 style="font-size:1.8rem;font-weight:800"><i class="fas fa-shield-alt" style="color:#8B5CF6;margin-right:10px"></i>Роли и доступы</h1>';
  h += '<p style="color:#94a3b8;margin-top:4px">Управление ролями, правами доступа и назначениями сотрудников</p></div>';
  if (isAdmin) {
    h += '<div style="display:flex;gap:8px">';
    h += '<button class="btn btn-outline" onclick="_matrixPermsLoaded=false;loadUserPermsForMatrix();var r2=api(&apos;/company-roles&apos;);r2.then(function(x){data.companyRoles=(x&amp;&amp;x.roles)||[];render();});toast(&apos;Обновление...&apos;,&apos;info&apos;)" title="Обновить данные"><i class="fas fa-sync-alt"></i></button>';
    h += '<button class="btn btn-primary" onclick="showCompanyRoleModal()"><i class="fas fa-plus" style="margin-right:6px"></i>Новая роль</button>';
    h += '</div>';
  }
  h += '</div>';
  
  // Tab navigation
  h += '<div style="display:flex;gap:4px;margin-bottom:24px;border-bottom:2px solid #334155;padding-bottom:0">';
  var tabs = [
    { id: 'matrix', icon: 'fa-th', label: 'Матрица доступов' },
    { id: 'roles', icon: 'fa-user-tag', label: 'Роли компании (' + roles.length + ')' },
    { id: 'users', icon: 'fa-users', label: 'По сотрудникам' },
    { id: 'stats', icon: 'fa-chart-pie', label: 'Статистика команды' }
  ];
  for (var ti = 0; ti < tabs.length; ti++) {
    var t = tabs[ti];
    var active = _teamAccessTab === t.id;
    h += '<button class="tab-btn' + (active ? ' active' : '') + '" style="border-radius:8px 8px 0 0;border-bottom:2px solid ' + (active ? '#8B5CF6' : 'transparent') + ';margin-bottom:-2px;padding:10px 20px" onclick="_teamAccessTab=&apos;' + t.id + '&apos;;render()"><i class="fas ' + t.icon + '" style="margin-right:6px"></i>' + t.label + '</button>';
  }
  h += '</div>';

  // Tab content
  if (_teamAccessTab === 'matrix') {
    h += renderAccessMatrix(users, roles, allSections, sl, rl, isAdmin);
  } else if (_teamAccessTab === 'roles') {
    h += renderRolesTab(roles, sl, isAdmin);
  } else if (_teamAccessTab === 'users') {
    h += renderUserPermissionsTab(users, allSections, sl, rl, isAdmin);
  } else if (_teamAccessTab === 'stats') {
    h += renderTeamStats();
  }
  
  h += '<div id="companyRoleModalArea"></div>';
  h += '</div>';
  
  // Auto-select user if navigated from employee card
  if (typeof editPermUserId !== 'undefined' && editPermUserId > 0) {
    setTimeout(function(){ _teamAccessTab = 'users'; render(); setTimeout(function(){ selectPermUser(editPermUserId); editPermUserId = 0; }, 150); }, 50);
  }
  return h;
}

// === TAB 1: ACCESS MATRIX ===
// Preload user permissions for matrix display
async function loadUserPermsForMatrix() {
  var users = ensureArray(data.users);
  for (var i = 0; i < users.length; i++) {
    var uid = users[i].id;
    try {
      var res = await api('/permissions/' + uid);
      var perms = (res && res.permissions) || [];
      window['_userPermsMatrix_' + uid] = perms;
    } catch(e) {}
  }
  render();
}
// Auto-load on first matrix view
var _matrixPermsLoaded = false;

function renderAccessMatrix(users, roles, allSections, sl, rl, isAdmin) {
  // Trigger load of actual user permissions if not done yet
  if (!_matrixPermsLoaded) {
    _matrixPermsLoaded = true;
    loadUserPermsForMatrix();
  }
  var h = '';
  // Stats cards
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:24px">';
  h += '<div class="stat-card"><div class="stat-num">' + users.length + '</div><div style="color:#94a3b8;font-size:0.82rem;margin-top:4px">Сотрудников</div></div>';
  h += '<div class="stat-card"><div class="stat-num">' + roles.length + '</div><div style="color:#94a3b8;font-size:0.82rem;margin-top:4px">Ролей</div></div>';
  h += '<div class="stat-card"><div class="stat-num">' + allSections.length + '</div><div style="color:#94a3b8;font-size:0.82rem;margin-top:4px">Разделов</div></div>';
  var activeCount = users.filter(function(u){ return u.is_active; }).length;
  h += '<div class="stat-card"><div class="stat-num" style="color:#10B981">' + activeCount + '</div><div style="color:#94a3b8;font-size:0.82rem;margin-top:4px">Активных</div></div>';
  h += '</div>';

  // Access matrix table
  h += '<div class="card" style="padding:0;overflow-x:auto">';
  h += '<table style="width:100%;border-collapse:collapse;font-size:0.8rem">';
  h += '<thead><tr style="background:#0f172a;border-bottom:2px solid #334155">';
  h += '<th style="padding:12px 16px;text-align:left;color:#a78bfa;font-weight:700;position:sticky;left:0;background:#0f172a;z-index:1;min-width:180px">Сотрудник / Роль</th>';
  for (var si = 0; si < allSections.length; si++) {
    var secLabel = (sl[allSections[si]] || allSections[si]);
    // Shorten labels for table
    if (secLabel.length > 12) secLabel = secLabel.substring(0, 11) + '…';
    h += '<th style="padding:8px 6px;text-align:center;color:#94a3b8;font-size:0.72rem;font-weight:600;min-width:70px;writing-mode:vertical-lr;transform:rotate(180deg);height:100px" title="' + escHtml(sl[allSections[si]] || allSections[si]) + '">' + escHtml(secLabel) + '</th>';
  }
  h += '</tr></thead><tbody>';
  
  // First: show role templates
  h += '<tr style="background:#1a1a3e;border-bottom:1px solid #334155"><td colspan="' + (allSections.length + 1) + '" style="padding:8px 16px;font-weight:700;color:#a78bfa;font-size:0.78rem"><i class="fas fa-user-tag" style="margin-right:6px"></i>Шаблоны ролей</td></tr>';
  for (var ri = 0; ri < roles.length; ri++) {
    var r = roles[ri];
    var rSections = [];
    try { rSections = JSON.parse(r.default_sections || '[]'); } catch(e) {}
    h += '<tr style="border-bottom:1px solid #1e293b;background:' + (ri % 2 === 0 ? '#131b2e' : '#0f172a') + '">';
    h += '<td style="padding:8px 16px;position:sticky;left:0;background:inherit;z-index:1"><div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:50%;background:' + escHtml(r.color || '#8B5CF6') + ';flex-shrink:0"></span><span style="font-weight:600;color:#e2e8f0">' + escHtml(r.role_name) + '</span>';
    if (r.is_system) h += '<span style="font-size:0.6rem;color:#64748b;background:#1e293b;padding:1px 4px;border-radius:3px">sys</span>';
    h += '</div></td>';
    for (var sj = 0; sj < allSections.length; sj++) {
      var hasAccess = rSections.indexOf(allSections[sj]) >= 0;
      h += '<td style="padding:4px;text-align:center"><span style="display:inline-block;width:22px;height:22px;border-radius:4px;background:' + (hasAccess ? 'rgba(139,92,246,0.3)' : 'rgba(100,116,139,0.1)') + ';line-height:22px;font-size:0.7rem;color:' + (hasAccess ? '#a78bfa' : '#475569') + '">' + (hasAccess ? '✓' : '·') + '</span></td>';
    }
    h += '</tr>';
  }
  
  // Separator
  h += '<tr style="background:#1a1a3e;border-bottom:1px solid #334155"><td colspan="' + (allSections.length + 1) + '" style="padding:8px 16px;font-weight:700;color:#10B981;font-size:0.78rem"><i class="fas fa-users" style="margin-right:6px"></i>Сотрудники (индивидуальные доступы)</td></tr>';
  
  // Users — fetch actual permissions from API cache or use role defaults
  for (var ui = 0; ui < users.length; ui++) {
    var u = users[ui];
    var userRole = roles.find(function(r){ return r.role_key === u.role; });
    var defaultSections = [];
    try { defaultSections = userRole ? JSON.parse(userRole.default_sections || '[]') : []; } catch(e) {}
    // Check if user has custom permissions stored
    var userPermsKey = '_userPermsMatrix_' + u.id;
    var userCustomPerms = window[userPermsKey] || null;
    var effectiveSections = userCustomPerms || defaultSections;
    h += '<tr style="border-bottom:1px solid #1e293b;background:' + (ui % 2 === 0 ? '#131b2e' : '#0f172a') + ';cursor:pointer" onclick="_teamAccessTab=&apos;users&apos;;render();setTimeout(function(){selectPermUser(' + u.id + ')},100)">';
    h += '<td style="padding:8px 16px;position:sticky;left:0;background:inherit;z-index:1"><div style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:' + (u.is_active ? '#10B981' : '#EF4444') + ';flex-shrink:0"></span><span style="font-weight:600;color:#e2e8f0">' + escHtml(u.display_name) + '</span><span style="font-size:0.68rem;color:#64748b">' + escHtml(rl[u.role] || u.role) + '</span></div></td>';
    for (var sk = 0; sk < allSections.length; sk++) {
      var sec = allSections[sk];
      var isMainAdmin = u.role === 'main_admin';
      var hasFromRole = defaultSections.indexOf(sec) >= 0;
      var hasCustom = userCustomPerms ? userCustomPerms.indexOf(sec) >= 0 : false;
      var hasAccess2 = isMainAdmin || hasFromRole || hasCustom;
      var cellColor, textColor;
      if (isMainAdmin) { cellColor = 'rgba(139,92,246,0.4)'; textColor = '#c4b5fd'; }
      else if (hasCustom && !hasFromRole) { cellColor = 'rgba(245,158,11,0.25)'; textColor = '#fbbf24'; }
      else if (hasAccess2) { cellColor = 'rgba(16,185,129,0.25)'; textColor = '#34d399'; }
      else { cellColor = 'rgba(100,116,139,0.1)'; textColor = '#475569'; }
      h += '<td style="padding:4px;text-align:center"><span style="display:inline-block;width:22px;height:22px;border-radius:4px;background:' + cellColor + ';line-height:22px;font-size:0.7rem;color:' + textColor + '">' + (hasAccess2 ? '✓' : '·') + '</span></td>';
    }
    h += '</tr>';
  }
  
  h += '</tbody></table></div>';
  
  // Legend
  h += '<div style="display:flex;gap:20px;margin-top:16px;font-size:0.78rem;color:#64748b;flex-wrap:wrap">';
  h += '<div style="display:flex;align-items:center;gap:6px"><span style="width:14px;height:14px;border-radius:3px;background:rgba(139,92,246,0.4)"></span>Полный доступ (Главный Админ)</div>';
  h += '<div style="display:flex;align-items:center;gap:6px"><span style="width:14px;height:14px;border-radius:3px;background:rgba(16,185,129,0.25)"></span>Доступ по роли</div>';
  h += '<div style="display:flex;align-items:center;gap:6px"><span style="width:14px;height:14px;border-radius:3px;background:rgba(245,158,11,0.25)"></span>Индивидуальный доступ</div>';
  h += '<div style="display:flex;align-items:center;gap:6px"><span style="width:14px;height:14px;border-radius:3px;background:rgba(100,116,139,0.1)"></span>Нет доступа</div>';
  h += '<div style="display:flex;align-items:center;gap:6px"><i class="fas fa-info-circle" style="color:#3B82F6"></i>Кликните на сотрудника для редактирования</div>';
  h += '</div>';
  return h;
}

// === TAB 2: ROLES ===
function renderRolesTab(roles, sl, isAdmin) {
  var h = '';
  if (roles.length === 0) {
    h += '<div class="card" style="text-align:center;padding:48px;color:#64748b"><i class="fas fa-user-tag" style="font-size:2.5rem;margin-bottom:12px;display:block;opacity:0.3"></i><p>Роли ещё не настроены</p></div>';
  } else {
    h += '<div style="display:grid;gap:12px">';
    for (var i = 0; i < roles.length; i++) {
      var r = roles[i];
      var sections = [];
      try { sections = JSON.parse(r.default_sections || '[]'); } catch(e) { sections = []; }
      var sectionNames = sections.map(function(s) { return sl[s] || s; }).join(', ');
      // Count users with this role
      var usersWithRole = (ensureArray(data.users)).filter(function(u) { return u.role === r.role_key; });
      h += '<div class="card" style="padding:0;overflow:hidden;border-left:4px solid ' + escHtml(r.color || '#8B5CF6') + '">';
      h += '<div style="padding:20px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap">';
      h += '<div style="flex:1;min-width:200px">';
      h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">';
      h += '<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:' + escHtml(r.color || '#8B5CF6') + '"></span>';
      h += '<span style="font-size:1.15rem;font-weight:700">' + escHtml(getCompanyRoleName(r)) + '</span>';
      h += '<span style="font-family:monospace;font-size:0.72rem;color:#64748b;background:#0f172a;padding:2px 8px;border-radius:4px">' + escHtml(r.role_key) + '</span>';
      if (r.is_system) h += '<span class="badge badge-purple" style="font-size:0.65rem">Системная</span>';
      if (!r.is_active) h += '<span class="badge" style="background:rgba(239,68,68,0.2);color:#f87171;font-size:0.65rem">Неактивна</span>';
      h += '<span class="badge" style="background:rgba(59,130,246,0.15);color:#60a5fa;font-size:0.65rem">' + usersWithRole.length + ' чел.</span>';
      h += '</div>';
      if (r.description) h += '<p style="color:#94a3b8;font-size:0.82rem;margin-bottom:10px">' + escHtml(r.description) + '</p>';
      // Sections as tags
      h += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
      for (var si2 = 0; si2 < sections.length; si2++) {
        h += '<span style="padding:3px 8px;border-radius:4px;font-size:0.7rem;background:rgba(139,92,246,0.1);color:#a78bfa;border:1px solid rgba(139,92,246,0.2)">' + escHtml(sl[sections[si2]] || sections[si2]) + '</span>';
      }
      if (sections.length === 0) h += '<span style="color:#475569;font-size:0.78rem">Нет доступов</span>';
      h += '</div>';
      // Users with this role
      if (usersWithRole.length > 0) {
        h += '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">';
        for (var uw = 0; uw < usersWithRole.length; uw++) {
          var uu = usersWithRole[uw];
          h += '<span style="padding:3px 10px;border-radius:12px;font-size:0.72rem;background:#0f172a;border:1px solid #334155;color:#e2e8f0"><i class="fas fa-user" style="margin-right:4px;font-size:0.6rem;color:#64748b"></i>' + escHtml(uu.display_name) + '</span>';
        }
        h += '</div>';
      }
      h += '</div>';
      if (isAdmin) {
        h += '<div style="display:flex;gap:6px;flex-shrink:0;align-items:flex-start">';
        h += '<button class="btn btn-outline" style="padding:8px 12px;font-size:0.82rem" onclick="showCompanyRoleModal(' + r.id + ')" title="Редактировать"><i class="fas fa-edit"></i></button>';
        h += '<button class="btn btn-outline" style="padding:8px 12px;font-size:0.82rem" onclick="cloneCompanyRole(' + r.id + ')" title="К\\u043b\\u043e\\u043d\\u0438\\u0440\\u043e\\u0432\\u0430\\u0442\\u044c \\u0440\\u043e\\u043b\\u044c"><i class="fas fa-copy"></i></button>';
        if (r.role_key !== 'main_admin') h += '<button class="btn btn-danger" style="padding:8px 12px;font-size:0.82rem" onclick="deleteCompanyRole(' + r.id + ',&apos;' + escHtml(getCompanyRoleName(r)) + '&apos;)" title="Удалить"><i class="fas fa-trash"></i></button>';
        h += '</div>';
      }
      h += '</div></div>';
    }
    h += '</div>';
  }
  return h;
}

// === TAB 3: USER PERMISSIONS ===
function renderUserPermissionsTab(users, allSections, sl, rl, isAdmin) {
  var h = '';
  h += '<div style="display:grid;grid-template-columns:280px 1fr;gap:20px">';
  // User list
  h += '<div class="card" style="padding:0;overflow:hidden"><div style="padding:14px 20px;border-bottom:1px solid #334155;font-weight:700;font-size:0.88rem;color:#a78bfa"><i class="fas fa-users" style="margin-right:6px"></i>Сотрудники</div>';
  for (var ui2 = 0; ui2 < users.length; ui2++) {
    var u2 = users[ui2];
    var roleColor = '#64748b';
    var compRole = (data.companyRoles || []).find(function(r2){ return r2.role_key === u2.role; });
    if (compRole) roleColor = compRole.color || '#64748b';
    h += '<div style="padding:12px 20px;cursor:pointer;border-bottom:1px solid #1e293b;transition:all 0.2s;border-left:3px solid transparent;display:flex;align-items:center;gap:10px" class="perm-user-item" data-uid="' + u2.id + '" onclick="selectPermUser(' + u2.id + ')">';
    h += '<span style="width:8px;height:8px;border-radius:50%;background:' + (u2.is_active ? '#10B981' : '#EF4444') + ';flex-shrink:0"></span>';
    h += '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(u2.display_name) + '</div>';
    h += '<div style="font-size:0.72rem;color:' + roleColor + '">' + escHtml(rl[u2.role]||u2.role) + '</div></div></div>';
  }
  h += '</div>';
  // Permissions editor
  h += '<div class="card" id="permEditor"><div style="text-align:center;padding:40px;color:#64748b"><i class="fas fa-shield-alt" style="font-size:2.5rem;margin-bottom:12px;display:block;opacity:0.3"></i><p>Выберите сотрудника для настройки доступов</p><p style="font-size:0.78rem;margin-top:8px;color:#475569">Доступы наследуются от роли. Вы можете добавить или убрать разделы индивидуально.</p></div></div>';
  h += '</div>';
  return h;
}

async function selectPermUser(uid, skipFetch) {
  selectedPermUserId = uid;
  if (!skipFetch) {
    var res = await api('/permissions/' + uid);
    selectedPermSections = (res && res.permissions) || [];
  }
  var u = ensureArray(data.users).find(function(x) { return x.id === uid; });
  var isMainAdmin2 = u && u.role === 'main_admin';
  var isAdmin2 = currentUser && currentUser.role === 'main_admin';
  var rl2 = rolesConfig?.role_labels || {};
  var sl2 = rolesConfig?.section_labels || {};
  var allSections2 = rolesConfig?.sections || [];
  
  // Get role defaults for comparison
  var userCompRole = (data.companyRoles || []).find(function(r3){ return r3.role_key === u?.role; });
  var roleDefaults = [];
  try { roleDefaults = userCompRole ? JSON.parse(userCompRole.default_sections || '[]') : []; } catch(e) {}
  
  // Highlight selected user
  document.querySelectorAll('.perm-user-item').forEach(function(el) { el.style.borderLeftColor = el.dataset.uid == uid ? '#8B5CF6' : 'transparent'; el.style.background = el.dataset.uid == uid ? 'rgba(139,92,246,0.1)' : ''; });
  
  var h = '';
  // User header
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px"><div style="display:flex;align-items:center;gap:12px">';
  var roleColor2 = userCompRole?.color || '#8B5CF6';
  h += '<div style="width:40px;height:40px;border-radius:50%;background:' + roleColor2 + '22;border:2px solid ' + roleColor2 + ';display:flex;align-items:center;justify-content:center;font-weight:700;color:' + roleColor2 + ';font-size:0.85rem">' + escHtml((u?.display_name||'U').substring(0,2).toUpperCase()) + '</div>';
  h += '<div><h3 style="font-weight:700;font-size:1.1rem">' + escHtml(u?.display_name) + '</h3>';
  h += '<div style="display:flex;gap:6px;margin-top:4px"><span class="badge badge-purple">' + escHtml(rl2[u?.role]||u?.role) + '</span>';
  if (u?.position_title) h += '<span class="badge" style="background:rgba(59,130,246,0.15);color:#60a5fa">' + escHtml(u.position_title) + '</span>';
  h += '</div></div></div>';
  if (isAdmin2 && !isMainAdmin2) h += '<button class="btn btn-primary" onclick="savePermissions()"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить</button>';
  h += '</div>';
  
  if (isMainAdmin2) h += '<div style="padding:12px 16px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:8px;margin-bottom:16px;font-size:0.85rem;color:#a78bfa"><i class="fas fa-crown" style="margin-right:6px"></i>Главный Админ имеет полный доступ ко всем разделам</div>';
  
  // Quick actions
  if (isAdmin2 && !isMainAdmin2) {
    h += '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">';
    h += '<button class="btn btn-outline" style="padding:6px 14px;font-size:0.78rem" onclick="applyRoleDefaults()"><i class="fas fa-undo" style="margin-right:4px"></i>Сбросить к роли</button>';
    h += '<button class="btn btn-outline" style="padding:6px 14px;font-size:0.78rem" onclick="selectAllPerms()"><i class="fas fa-check-double" style="margin-right:4px"></i>Выбрать все</button>';
    h += '<button class="btn btn-outline" style="padding:6px 14px;font-size:0.78rem" onclick="clearAllPerms()"><i class="fas fa-times" style="margin-right:4px"></i>Снять все</button>';
    h += '</div>';
  }
  
  // Section permissions grid
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px">';
  for (var si3 = 0; si3 < allSections2.length; si3++) {
    var sec2 = allSections2[si3];
    var checked2 = isMainAdmin2 || selectedPermSections.indexOf(sec2) >= 0;
    var fromRole = roleDefaults.indexOf(sec2) >= 0;
    var disabled2 = !isAdmin2 || isMainAdmin2;
    var borderColor = checked2 ? '#8B5CF6' : '#334155';
    var indicator = '';
    if (!isMainAdmin2 && checked2 && fromRole) indicator = '<span style="font-size:0.6rem;color:#10B981;margin-left:auto" title="Унаследовано от роли">▪ роль</span>';
    else if (!isMainAdmin2 && checked2 && !fromRole) indicator = '<span style="font-size:0.6rem;color:#F59E0B;margin-left:auto" title="Добавлено индивидуально (не из роли)">▪ инд.</span>';
    h += '<label style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0f172a;border:1px solid ' + borderColor + ';border-radius:8px;cursor:' + (disabled2?'default':'pointer') + ';opacity:' + (disabled2?'0.6':'1') + ';transition:all 0.2s">' +
      '<input type="checkbox" ' + (checked2?'checked':'') + ' ' + (disabled2?'disabled':'') + ' onchange="togglePermSection(&apos;' + sec2 + '&apos;)" style="accent-color:#8B5CF6;flex-shrink:0">' +
      '<span style="font-size:0.82rem">' + escHtml(sl2[sec2]||sec2) + '</span>' + indicator + '</label>';
  }
  h += '</div>';
  
  document.getElementById('permEditor').innerHTML = h;
}

function togglePermSection(sec) {
  var idx = selectedPermSections.indexOf(sec);
  if (idx >= 0) selectedPermSections.splice(idx, 1);
  else selectedPermSections.push(sec);
}

function applyRoleDefaults() {
  if (!selectedPermUserId) return;
  var u = ensureArray(data.users).find(function(x) { return x.id === selectedPermUserId; });
  var compRole = (data.companyRoles || []).find(function(r) { return r.role_key === u?.role; });
  try { selectedPermSections = compRole ? JSON.parse(compRole.default_sections || '[]') : ['dashboard']; } catch(e) { selectedPermSections = ['dashboard']; }
  selectPermUser(selectedPermUserId, true);
}

function selectAllPerms() {
  selectedPermSections = (rolesConfig?.sections || []).slice();
  selectPermUser(selectedPermUserId, true);
}

function clearAllPerms() {
  selectedPermSections = ['dashboard'];
  selectPermUser(selectedPermUserId, true);
}

async function savePermissions() {
  if (!selectedPermUserId) return;
  await api('/permissions/' + selectedPermUserId, { method:'PUT', body: JSON.stringify({ sections: selectedPermSections }) });
  // Update matrix cache
  window['_userPermsMatrix_' + selectedPermUserId] = selectedPermSections.slice();
  toast('Доступы сохранены!');
  render();
}

// === TAB 4: TEAM STATS ===
function renderTeamStats() {
  var users = ensureArray(data.users);
  var roles = data.companyRoles || [];
  var rl = rolesConfig?.role_labels || {};
  var h = '';
  
  // Salary overview
  var totalSalary = 0;
  var salaryByRole = {};
  var activeCount = 0;
  var onlineCount = 0;
  var vacationCount = 0;
  var salaryTypes = { monthly: 0, biweekly: 0, per_task: 0, percent: 0 };
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var sal = Number(u.salary) || 0;
    totalSalary += sal;
    var rKey = u.role || 'other';
    salaryByRole[rKey] = (salaryByRole[rKey] || 0) + sal;
    if (u.is_active) activeCount++;
    if (isUserOnline(u.id)) onlineCount++;
    if (isUserOnVacation(u.id)) vacationCount++;
    salaryTypes[u.salary_type || 'monthly'] = (salaryTypes[u.salary_type || 'monthly'] || 0) + 1;
  }
  
  // Stats cards
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:24px">';
  h += '<div class="stat-card"><div class="stat-num">' + users.length + '</div><div style="color:#94a3b8;font-size:0.82rem;margin-top:4px">\\u0421\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u043a\\u043e\\u0432</div></div>';
  h += '<div class="stat-card"><div class="stat-num" style="color:#10B981">' + activeCount + '</div><div style="color:#94a3b8;font-size:0.82rem;margin-top:4px">\\u0410\\u043a\\u0442\\u0438\\u0432\\u043d\\u044b\\u0445</div></div>';
  h += '<div class="stat-card"><div class="stat-num" style="color:#EF4444">' + (users.length - activeCount) + '</div><div style="color:#94a3b8;font-size:0.82rem;margin-top:4px">\\u041e\\u0442\\u043a\\u043b\\u044e\\u0447\\u0435\\u043d\\u044b\\u0445</div></div>';
  h += '<div class="stat-card"><div class="stat-num" style="color:#22d3ee">' + onlineCount + '</div><div style="color:#94a3b8;font-size:0.82rem;margin-top:4px"><i class="fas fa-circle" style="color:#10B981;font-size:0.5rem;margin-right:3px"></i>Онлайн</div></div>';
  h += '<div class="stat-card"><div class="stat-num" style="color:#f59e0b">' + vacationCount + '</div><div style="color:#94a3b8;font-size:0.82rem;margin-top:4px"><i class="fas fa-umbrella-beach" style="margin-right:3px"></i>В отпуске</div></div>';
  h += '<div class="stat-card"><div class="stat-num" style="color:#3B82F6">' + fmtAmt(totalSalary) + '</div><div style="color:#94a3b8;font-size:0.82rem;margin-top:4px">\\u0424\\u041e\\u0422 / \\u043c\\u0435\\u0441</div></div>';
  h += '<div class="stat-card"><div class="stat-num" style="color:#F59E0B">' + roles.length + '</div><div style="color:#94a3b8;font-size:0.82rem;margin-top:4px">\\u0420\\u043e\\u043b\\u0435\\u0439</div></div>';
  var avgSalary = users.length > 0 ? Math.round(totalSalary / users.length) : 0;
  h += '<div class="stat-card"><div class="stat-num" style="color:#a78bfa">' + fmtAmt(avgSalary) + '</div><div style="color:#94a3b8;font-size:0.82rem;margin-top:4px">\\u0421\\u0440. \\u0417\\u041f</div></div>';
  h += '</div>';
  
  // Online employees panel
  if (onlineCount > 0) {
    var onlineUsers = (data.onlineUsers || []);
    h += '<div class="card" style="margin-bottom:16px;border-left:3px solid #10B981">';
    h += '<h3 style="font-weight:700;font-size:1rem;margin-bottom:12px"><i class="fas fa-circle" style="color:#10B981;font-size:0.6rem;margin-right:8px"></i>Сейчас онлайн (' + onlineCount + ')</h3>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:10px">';
    for (var oi = 0; oi < onlineUsers.length; oi++) {
      var ou = onlineUsers[oi];
      h += '<div style="padding:10px 14px;background:#0f172a;border-radius:8px;border:1px solid #1e293b;min-width:200px">';
      h += '<div style="font-weight:600;color:#e2e8f0;font-size:0.88rem">' + escHtml(ou.display_name) + '</div>';
      h += '<div style="font-size:0.72rem;color:#64748b;margin-top:2px">' + escHtml(ou.position_title||ou.role) + '</div>';
      h += '<div style="font-size:0.72rem;color:#94a3b8;margin-top:4px"><i class="fas fa-eye" style="margin-right:3px;color:#3B82F6"></i>' + escHtml(ou.last_action || ou.last_page || 'Активен') + '</div>';
      h += '<div style="font-size:0.65rem;color:#475569;margin-top:2px">' + escHtml(ou.last_seen_at || '') + '</div>';
      h += '</div>';
    }
    h += '</div></div>';
  }
  
  // Vacation panel
  if (vacationCount > 0) {
    var today = new Date().toISOString().slice(0,10);
    var currentVacs = (data.vacations || []).filter(function(v) { return v.status === 'active' && v.start_date <= today && v.end_date >= today; });
    h += '<div class="card" style="margin-bottom:16px;border-left:3px solid #f59e0b">';
    h += '<h3 style="font-weight:700;font-size:1rem;margin-bottom:12px"><i class="fas fa-umbrella-beach" style="color:#f59e0b;margin-right:8px"></i>В отпуске (' + vacationCount + ')</h3>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:10px">';
    for (var vi2 = 0; vi2 < currentVacs.length; vi2++) {
      var cv = currentVacs[vi2];
      h += '<div style="padding:10px 14px;background:#0f172a;border-radius:8px;border:1px solid #1e293b;min-width:200px">';
      h += '<div style="font-weight:600;color:#e2e8f0;font-size:0.88rem">' + escHtml(cv.display_name) + '</div>';
      h += '<div style="font-size:0.75rem;color:#f59e0b;margin-top:4px">' + escHtml(cv.start_date) + ' \\u2014 ' + escHtml(cv.end_date) + '</div>';
      h += '<div style="font-size:0.72rem;color:#94a3b8;margin-top:2px">' + cv.days_count + ' дн. \\u00b7 ' + (cv.is_paid ? 'Оплачиваемый' : 'Без оплаты') + '</div>';
      h += '</div>';
    }
    h += '</div></div>';
  }
  
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  
  // Salary by role
  h += '<div class="card"><h3 style="font-weight:700;font-size:1rem;margin-bottom:16px"><i class="fas fa-coins" style="color:#F59E0B;margin-right:8px"></i>\\u0417\\u041f \\u043f\\u043e \\u0440\\u043e\\u043b\\u044f\\u043c</h3>';
  h += '<div style="display:flex;flex-direction:column;gap:8px">';
  var sortedRoles = Object.keys(salaryByRole).sort(function(a,b) { return salaryByRole[b] - salaryByRole[a]; });
  for (var ri = 0; ri < sortedRoles.length; ri++) {
    var rk = sortedRoles[ri];
    var pct = totalSalary > 0 ? Math.round(salaryByRole[rk] / totalSalary * 100) : 0;
    h += '<div><div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:4px"><span style="color:#e2e8f0">' + escHtml(rl[rk]||rk) + '</span><span style="color:#3B82F6;font-weight:600">' + fmtAmt(salaryByRole[rk]) + ' (' + pct + '%)</span></div>';
    h += '<div style="height:6px;background:#1e293b;border-radius:3px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#8B5CF6,#3B82F6);border-radius:3px;transition:width 0.5s"></div></div></div>';
  }
  h += '</div></div>';
  
  // Users by role
  h += '<div class="card"><h3 style="font-weight:700;font-size:1rem;margin-bottom:16px"><i class="fas fa-users" style="color:#8B5CF6;margin-right:8px"></i>\\u041a\\u043e\\u043c\\u0430\\u043d\\u0434\\u0430 \\u043f\\u043e \\u0440\\u043e\\u043b\\u044f\\u043c</h3>';
  h += '<div style="display:flex;flex-direction:column;gap:10px">';
  var roleColors2 = { main_admin: '#8B5CF6', developer: '#3B82F6', analyst: '#10B981', operator: '#F59E0B', buyer: '#EF4444', courier: '#6366F1' };
  for (var ri2 = 0; ri2 < roles.length; ri2++) {
    var r2 = roles[ri2];
    var rName = getCompanyRoleName(r2);
    var roleUsers = users.filter(function(u2) { return u2.role === r2.role_key; });
    h += '<div style="padding:10px 14px;background:#0f172a;border-radius:8px;border-left:3px solid ' + escHtml(r2.color || roleColors2[r2.role_key] || '#64748b') + '">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-weight:600;color:#e2e8f0;font-size:0.88rem">' + escHtml(rName) + '</span><span class="badge badge-purple" style="font-size:0.72rem">' + roleUsers.length + ' \\u0447\\u0435\\u043b.</span></div>';
    if (roleUsers.length > 0) {
      h += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
      for (var ru = 0; ru < roleUsers.length; ru++) {
        h += '<span style="padding:2px 8px;border-radius:10px;font-size:0.72rem;background:#1e293b;border:1px solid #334155;color:' + (roleUsers[ru].is_active ? '#e2e8f0' : '#64748b') + ';text-decoration:' + (roleUsers[ru].is_active ? 'none' : 'line-through') + '">' + escHtml(roleUsers[ru].display_name) + '</span>';
      }
      h += '</div>';
    } else {
      h += '<span style="font-size:0.78rem;color:#475569">\\u041d\\u0435\\u0442 \\u0441\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u043a\\u043e\\u0432</span>';
    }
    h += '</div>';
  }
  h += '</div></div>';
  h += '</div>';
  
  // Salary type distribution
  h += '<div class="card" style="margin-top:16px"><h3 style="font-weight:700;font-size:1rem;margin-bottom:16px"><i class="fas fa-chart-bar" style="color:#10B981;margin-right:8px"></i>\\u0420\\u0430\\u0441\\u043f\\u0440\\u0435\\u0434\\u0435\\u043b\\u0435\\u043d\\u0438\\u0435 \\u043f\\u043e \\u0442\\u0438\\u043f\\u0443 \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b</h3>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">';
  var stLabels = { monthly: '\\u041f\\u043e\\u043c\\u0435\\u0441\\u044f\\u0447\\u043d\\u043e', biweekly: '\\u0417\\u0430 15 \\u0434\\u043d\\u0435\\u0439', per_task: '\\u0417\\u0430 \\u0440\\u0430\\u0431\\u043e\\u0442\\u0443', percent: '\\u041f\\u0440\\u043e\\u0446\\u0435\\u043d\\u0442' };
  var stColors = { monthly: '#3B82F6', biweekly: '#10B981', per_task: '#F59E0B', percent: '#EF4444' };
  for (var stk in salaryTypes) {
    if (salaryTypes[stk] > 0) {
      h += '<div style="padding:14px;background:#0f172a;border-radius:8px;border-left:3px solid ' + (stColors[stk]||'#64748b') + ';text-align:center"><div style="font-size:1.3rem;font-weight:700;color:' + (stColors[stk]||'#64748b') + '">' + salaryTypes[stk] + '</div><div style="font-size:0.78rem;color:#94a3b8;margin-top:4px">' + (stLabels[stk]||stk) + '</div></div>';
    }
  }
  h += '</div></div>';
  
  return h;
}

// === COMPANY ROLE MODAL ===
function showCompanyRoleModal(roleId) {
  var r = roleId ? (data.companyRoles || []).find(function(x) { return x.id === roleId; }) : null;
  var sl = rolesConfig?.section_labels || {};
  var allSections = rolesConfig?.sections || [];
  var existingSections = [];
  if (r) { try { existingSections = JSON.parse(r.default_sections || '[]'); } catch(e) { existingSections = []; } }
  else { existingSections = ['dashboard']; }

  var h = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px" onclick="this.remove()">';
  h += '<div class="card" style="width:620px;max-width:95vw;max-height:90vh;overflow-y:auto" onclick="event.stopPropagation()">';
  h += '<h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px"><i class="fas fa-user-tag" style="color:#8B5CF6;margin-right:8px"></i>' + (r ? 'Редактировать роль' : 'Новая роль') + '</h3>';
  h += '<form onsubmit="saveCompanyRole(event,' + (r ? r.id : 'null') + ')">';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">';
  h += '<div><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">Название роли *</label><input class="input" id="crRoleName" value="' + escHtml(r?.role_name || '') + '" required placeholder="Например: Менеджер"></div>';
  h += '<div><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">Ключ роли *' + (r ? ' (нельзя менять)' : '') + '</label><input class="input" id="crRoleKey" value="' + escHtml(r?.role_key || '') + '" ' + (r ? 'readonly style="opacity:0.6"' : 'placeholder="manager (латиница)"') + ' required pattern="[a-z_]+" title="Только латинские буквы и подчёркивание"></div>';
  h += '</div>';
  h += '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">Описание</label><input class="input" id="crRoleDesc" value="' + escHtml(r?.description || '') + '" placeholder="Краткое описание роли"></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';
  h += '<div><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">Цвет</label><input type="color" id="crRoleColor" value="' + (r?.color || '#8B5CF6') + '" style="width:100%;height:40px;border:1px solid #334155;border-radius:8px;background:#0f172a;cursor:pointer"></div>';
  h += '<div><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">Порядок <span style="font-size:0.65rem;color:#475569">(меньше = выше)</span></label><input type="number" class="input" id="crRoleOrder" value="' + (r?.sort_order || 0) + '"></div>';
  h += '</div>';
  h += '<div style="margin-bottom:16px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:8px"><i class="fas fa-key" style="margin-right:4px"></i>Разделы по умолчанию <span style="font-size:0.65rem;color:#475569">(новым сотрудникам с этой ролью)</span></label>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">';
  for (var j = 0; j < allSections.length; j++) {
    var sec = allSections[j];
    var checked = existingSections.indexOf(sec) >= 0;
    h += '<label style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#0f172a;border:1px solid ' + (checked ? '#8B5CF6' : '#334155') + ';border-radius:6px;cursor:pointer;font-size:0.82rem;transition:all 0.15s">';
    h += '<input type="checkbox" class="crSectionCheck" value="' + sec + '" ' + (checked ? 'checked' : '') + ' style="accent-color:#8B5CF6">';
    h += (sl[sec] || sec) + '</label>';
  }
  h += '</div></div>';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn-outline" onclick="this.closest(&apos;[style*=fixed]&apos;).remove()">Отмена</button>';
  h += '<button type="submit" class="btn btn-primary"><i class="fas fa-check" style="margin-right:6px"></i>' + (r ? 'Сохранить' : 'Создать') + '</button></div>';
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
    toast(res?.error || 'Ошибка сохранения роли', 'error');
    return;
  }
  var rolesRes = await api('/company-roles');
  data.companyRoles = (rolesRes && rolesRes.roles) || [];
  toast(id ? 'Роль обновлена' : 'Роль создана');
  render();
}

async function deleteCompanyRole(id, name) {
  if (!confirm('Удалить роль "' + name + '"?')) return;
  var res = await api('/company-roles/' + id, { method: 'DELETE' });
  if (!res || res.error) { toast(res?.error || 'Ошибка удаления', 'error'); return; }
  var rolesRes = await api('/company-roles');
  data.companyRoles = (rolesRes && rolesRes.roles) || [];
  toast('Роль удалена');
  render();
}

async function cloneCompanyRole(id) {
  var r = (data.companyRoles || []).find(function(x) { return x.id === id; });
  if (!r) return;
  var rName = getCompanyRoleName(r);
  var newName = prompt('Н\\u0430\\u0437\\u0432\\u0430\\u043d\\u0438\\u0435 \\u043a\\u043b\\u043e\\u043d\\u0430:', rName + ' (\\u043a\\u043e\\u043f\\u0438\\u044f)');
  if (!newName) return;
  var newKey = newName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').substring(0, 30);
  if (!newKey) newKey = 'clone_' + Date.now();
  var sections = [];
  try { sections = JSON.parse(r.default_sections || '[]'); } catch(e) {}
  var body = { role_name: newName, role_key: newKey, description: (r.description || '') + ' (\\u043a\\u043e\\u043f\\u0438\\u044f)', color: r.color || '#8B5CF6', sort_order: (r.sort_order || 0) + 1, default_sections: sections };
  var res = await api('/company-roles', { method: 'POST', body: JSON.stringify(body) });
  if (!res || res.error) { toast(res?.error || '\\u041e\\u0448\\u0438\\u0431\\u043a\\u0430 \\u043a\\u043b\\u043e\\u043d\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u0438\\u044f', 'error'); return; }
  var rolesRes = await api('/company-roles');
  data.companyRoles = (rolesRes && rolesRes.roles) || [];
  toast('\\u0420\\u043e\\u043b\\u044c \\u043a\\u043b\\u043e\\u043d\\u0438\\u0440\\u043e\\u0432\\u0430\\u043d\\u0430!');
  render();
}



`;
