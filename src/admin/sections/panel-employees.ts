/**
 * Admin Panel — Employees management page
 * 603 lines of admin SPA JS code
 */
export const CODE: string = `
// ===== EMPLOYEES PAGE =====
var _empSearch = '';
var _empFilterRole = '';
var _empFilterStatus = '';
var _empViewMode = 'cards'; // cards | table
var _empEarningsCache = {};
var _empVacationExpanded = {};

function getCompanyRoleName(cr) { return cr.role_name || cr.role_label || cr.role_key || ''; }

function isUserOnline(userId) {
  return (data.onlineUsers || []).some(function(o) { return o.user_id === userId; });
}
function getUserActivity(userId) {
  return (data.onlineUsers || []).find(function(o) { return o.user_id === userId; });
}
function getUserVacations(userId) {
  return (data.vacations || []).filter(function(v) { return v.user_id === userId; });
}
function isUserOnVacation(userId) {
  var today = new Date().toISOString().slice(0,10);
  return (data.vacations || []).some(function(v) {
    return v.user_id === userId && v.status === 'active' && v.start_date <= today && v.end_date >= today;
  });
}

function filterEmployees(users) {
  var q = (_empSearch || '').toLowerCase().trim();
  return users.filter(function(u) {
    // Role filter
    if (_empFilterRole && u.role !== _empFilterRole) return false;
    // Status filter
    if (_empFilterStatus === 'active' && !u.is_active) return false;
    if (_empFilterStatus === 'inactive' && u.is_active) return false;
    if (_empFilterStatus === 'online' && !isUserOnline(u.id)) return false;
    if (_empFilterStatus === 'vacation' && !isUserOnVacation(u.id)) return false;
    // Search across all fields
    if (q) {
      var fields = [u.display_name, u.username, u.phone, u.telegram_link, u.email, u.position_title, u.role, String(u.salary||'')].join(' ').toLowerCase();
      if (fields.indexOf(q) < 0) return false;
    }
    return true;
  });
}

function calcWorkDuration(hireDate, endDate) {
  if (!hireDate) return null;
  var start = new Date(hireDate + 'T00:00:00Z');
  var end = endDate ? new Date(endDate + 'T00:00:00Z') : new Date();
  var months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  var days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (months < 1) return days + ' дн.';
  var years = Math.floor(months / 12);
  var remMonths = months % 12;
  if (years > 0) return years + ' г. ' + (remMonths > 0 ? remMonths + ' мес.' : '');
  return remMonths + ' мес.';
}

function renderEmployees() {
  if (!Array.isArray(data.users)) data.users = [];
  const isAdmin = currentUser && currentUser.role === 'main_admin';
  const rl = rolesConfig?.role_labels || {};
  const roles = rolesConfig?.roles || [];
  var roleColors = { main_admin: '#8B5CF6', developer: '#3B82F6', analyst: '#10B981', operator: '#F59E0B', buyer: '#EF4444', courier: '#6366F1' };
  // Enrich role labels and colors with custom company roles
  var compRolesAll = data.companyRoles || [];
  for (var crj = 0; crj < compRolesAll.length; crj++) {
    var crjItem = compRolesAll[crj];
    if (crjItem.role_key) {
      if (!rl[crjItem.role_key]) rl[crjItem.role_key] = getCompanyRoleName(crjItem);
      if (!roleColors[crjItem.role_key]) roleColors[crjItem.role_key] = crjItem.color || '#8B5CF6';
    }
  }
  var filtered = filterEmployees(data.users);
  var onlineCount = data.users.filter(function(u) { return isUserOnline(u.id); }).length;
  var vacationCount = data.users.filter(function(u) { return isUserOnVacation(u.id); }).length;
  var disabledCount = data.users.filter(function(u) { return !u.is_active; }).length;
  var activeCount = data.users.length - disabledCount;
  var curMonth = new Date().toISOString().slice(0,7);
  var totalSalaryBudget = data.users.reduce(function(s,u) { return s + (u.is_active ? Number(u.salary||0) : 0); }, 0);

  let h = '<div style="padding:28px 32px">';
  // === HEADER ===
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:16px">';
  h += '<div>';
  h += '<h1 style="font-size:2rem;font-weight:900;background:linear-gradient(135deg,#e2e8f0,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:inline-block"><i class="fas fa-users" style="margin-right:10px;-webkit-text-fill-color:#8B5CF6"></i>Команда</h1>';
  h += '<div style="display:flex;gap:14px;margin-top:8px;flex-wrap:wrap;align-items:center">';
  h += '<span style="color:#94a3b8;font-size:0.88rem">' + data.users.length + ' сотрудник(ов)</span>';
  if (onlineCount > 0) h += '<span style="color:#10B981;font-size:0.82rem"><i class="fas fa-circle" style="font-size:0.45rem;vertical-align:middle;margin-right:3px;animation:pulse 2s infinite"></i>' + onlineCount + ' онлайн</span>';
  if (vacationCount > 0) h += '<span style="color:#f59e0b;font-size:0.82rem"><i class="fas fa-umbrella-beach" style="margin-right:3px"></i>' + vacationCount + ' в отпуске</span>';
  if (disabledCount > 0) h += '<span style="color:#EF4444;font-size:0.82rem"><i class="fas fa-user-slash" style="margin-right:3px"></i>' + disabledCount + ' отключено</span>';
  h += '</div></div>';
  if (isAdmin) {
    h += '<div style="display:flex;gap:8px">';
    h += '<button class="btn btn-outline" style="padding:10px 16px;font-size:0.85rem" onclick="loadAllEarnings()" title="Загрузить заработок всех сотрудников"><i class="fas fa-sync-alt" style="margin-right:6px"></i>Обновить данные</button>';
    h += '<button class="btn btn-primary" style="padding:10px 20px;font-size:0.85rem" onclick="showEmployeeModal()"><i class="fas fa-user-plus" style="margin-right:6px"></i>Добавить</button>';
    h += '</div>';
  }
  h += '</div>';

  // === ANALYTICS DASHBOARD ===
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:12px;margin-bottom:24px">';
  // Total
  h += '<div style="background:linear-gradient(135deg,#1e293b,#0f172a);border:1px solid #334155;border-radius:14px;padding:18px 16px;position:relative;overflow:hidden">';
  h += '<div style="position:absolute;top:-10px;right:-10px;width:60px;height:60px;border-radius:50%;background:rgba(139,92,246,0.06)"></div>';
  h += '<div style="font-size:2rem;font-weight:900;color:#e2e8f0">' + data.users.length + '</div>';
  h += '<div style="color:#94a3b8;font-size:0.82rem;margin-top:2px"><i class="fas fa-users" style="color:#8B5CF6;margin-right:4px"></i>Всего</div></div>';
  // Active
  h += '<div style="background:linear-gradient(135deg,rgba(16,185,129,0.08),#0f172a);border:1px solid rgba(16,185,129,0.2);border-radius:14px;padding:18px 16px">';
  h += '<div style="font-size:2rem;font-weight:900;color:#10B981">' + activeCount + '</div>';
  h += '<div style="color:#94a3b8;font-size:0.82rem;margin-top:2px"><i class="fas fa-check-circle" style="color:#10B981;margin-right:4px"></i>Активных</div></div>';
  // Online
  h += '<div style="background:linear-gradient(135deg,rgba(16,185,129,0.12),#0f172a);border:1px solid rgba(16,185,129,0.25);border-radius:14px;padding:18px 16px">';
  h += '<div style="font-size:2rem;font-weight:900;color:#34d399">' + onlineCount + '</div>';
  h += '<div style="color:#94a3b8;font-size:0.82rem;margin-top:2px"><i class="fas fa-signal" style="color:#34d399;margin-right:4px"></i>Онлайн</div></div>';
  // Salary budget
  h += '<div style="background:linear-gradient(135deg,rgba(59,130,246,0.08),#0f172a);border:1px solid rgba(59,130,246,0.2);border-radius:14px;padding:18px 16px">';
  h += '<div style="font-size:1.4rem;font-weight:900;color:#60a5fa">' + fmtAmt(totalSalaryBudget) + '</div>';
  h += '<div style="color:#94a3b8;font-size:0.82rem;margin-top:2px"><i class="fas fa-wallet" style="color:#60a5fa;margin-right:4px"></i>ФОТ / мес</div></div>';
  // Disabled
  if (disabledCount > 0) {
    h += '<div style="background:linear-gradient(135deg,rgba(239,68,68,0.08),#0f172a);border:1px solid rgba(239,68,68,0.2);border-radius:14px;padding:18px 16px">';
    h += '<div style="font-size:2rem;font-weight:900;color:#f87171">' + disabledCount + '</div>';
    h += '<div style="color:#94a3b8;font-size:0.82rem;margin-top:2px"><i class="fas fa-user-slash" style="color:#f87171;margin-right:4px"></i>Отключено</div></div>';
  }
  // Vacation
  if (vacationCount > 0) {
    h += '<div style="background:linear-gradient(135deg,rgba(245,158,11,0.08),#0f172a);border:1px solid rgba(245,158,11,0.2);border-radius:14px;padding:18px 16px">';
    h += '<div style="font-size:2rem;font-weight:900;color:#fbbf24">' + vacationCount + '</div>';
    h += '<div style="color:#94a3b8;font-size:0.82rem;margin-top:2px"><i class="fas fa-umbrella-beach" style="color:#fbbf24;margin-right:4px"></i>В отпуске</div></div>';
  }
  h += '</div>';

  // === SEARCH & FILTERS BAR ===
  h += '<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center;background:#0f172a;padding:12px 16px;border-radius:12px;border:1px solid #1e293b">';
  h += '<div style="flex:1;min-width:220px;position:relative"><i class="fas fa-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b"></i><input class="input" style="padding-left:36px;border-radius:10px" placeholder="Поиск по имени, телефону, Telegram, должности..." value="' + escHtml(_empSearch) + '" oninput="_empSearch=this.value;render()"></div>';
  h += '<select class="input" style="width:auto;min-width:140px;border-radius:10px" onchange="_empFilterRole=this.value;render()"><option value="">Все роли</option>';
  var filterRolesSet = {};
  for (var ri = 0; ri < roles.length; ri++) {
    filterRolesSet[roles[ri]] = true;
    h += '<option value="' + roles[ri] + '"' + (_empFilterRole===roles[ri]?' selected':'') + '>' + escHtml(rl[roles[ri]]||roles[ri]) + '</option>';
  }
  // Also show custom company roles in filter
  var compRolesFilter = data.companyRoles || [];
  for (var crf = 0; crf < compRolesFilter.length; crf++) {
    var crfKey = compRolesFilter[crf].role_key;
    if (crfKey && !filterRolesSet[crfKey]) {
      var crfLabel = getCompanyRoleName(compRolesFilter[crf]);
      h += '<option value="' + escHtml(crfKey) + '"' + (_empFilterRole===crfKey?' selected':'') + '>' + escHtml(crfLabel || crfKey) + '</option>';
    }
  }
  h += '</select>';
  h += '<select class="input" style="width:auto;min-width:140px;border-radius:10px" onchange="_empFilterStatus=this.value;render()"><option value="">Все статусы</option><option value="active"' + (_empFilterStatus==='active'?' selected':'') + '>Активные</option><option value="inactive"' + (_empFilterStatus==='inactive'?' selected':'') + '>Отключённые</option><option value="online"' + (_empFilterStatus==='online'?' selected':'') + '>Онлайн</option><option value="vacation"' + (_empFilterStatus==='vacation'?' selected':'') + '>В отпуске</option></select>';
  h += '<span style="color:#64748b;font-size:0.82rem;white-space:nowrap"><i class="fas fa-filter" style="margin-right:4px"></i>' + filtered.length + ' / ' + data.users.length + '</span>';
  h += '</div>';

  // === EMPLOYEE CARDS GRID ===
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:18px">';
  for (const u of filtered) {
    var rColor = roleColors[u.role] || '#64748b';
    var initials = (u.display_name||'U').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().substring(0,2);
    var online = isUserOnline(u.id);
    var onVacation = isUserOnVacation(u.id);
    var activity = getUserActivity(u.id);
    var isDisabled = !u.is_active;
    var workDuration = calcWorkDuration(u.hire_date, u.end_date);

    // Card wrapper with gradient border-top and hover effect
    h += '<div class="card emp-card" style="padding:0;overflow:hidden;border-radius:16px;border-top:3px solid ' + (isDisabled ? '#475569' : rColor) + ';' + (isDisabled ? 'opacity:0.55;filter:grayscale(0.3);' : '') + '">';

    // === CARD HEADER with gradient bg ===
    h += '<div style="padding:18px 20px 14px;background:linear-gradient(135deg,' + (isDisabled ? 'rgba(71,85,105,0.1)' : rColor + '08') + ',transparent);display:flex;gap:14px;align-items:center">';
    // Avatar
    h += '<div style="position:relative;flex-shrink:0">';
    h += '<div style="width:56px;height:56px;border-radius:16px;background:' + (isDisabled ? '#1e293b' : 'linear-gradient(135deg,' + rColor + '33,' + rColor + '11)') + ';border:2px solid ' + (isDisabled ? '#475569' : rColor + '66') + ';display:flex;align-items:center;justify-content:center;font-weight:900;color:' + (isDisabled ? '#64748b' : rColor) + ';font-size:1.1rem;letter-spacing:1px">' + initials + '</div>';
    if (online && !isDisabled) h += '<div style="position:absolute;bottom:-1px;right:-1px;width:14px;height:14px;border-radius:50%;background:#10B981;border:2.5px solid #1e293b;box-shadow:0 0 8px rgba(16,185,129,0.5)" title="Онлайн"></div>';
    if (onVacation) h += '<div style="position:absolute;top:-6px;right:-6px;font-size:0.85rem;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))" title="В отпуске">\\ud83c\\udfd6\\ufe0f</div>';
    if (isDisabled) h += '<div style="position:absolute;bottom:-2px;right:-2px;width:18px;height:18px;border-radius:50%;background:#EF4444;border:2.5px solid #1e293b;display:flex;align-items:center;justify-content:center"><i class="fas fa-ban" style="font-size:0.5rem;color:white"></i></div>';
    h += '</div>';
    // Name & role
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-weight:800;font-size:1.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:8px;color:' + (isDisabled ? '#94a3b8' : '#f1f5f9') + '">' + escHtml(u.display_name);
    if (online && !isDisabled) h += '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;box-shadow:0 0 6px rgba(16,185,129,0.5);flex-shrink:0"></span>';
    if (isDisabled) h += '<span style="font-size:0.65rem;color:#EF4444;font-weight:500;background:rgba(239,68,68,0.1);padding:1px 8px;border-radius:8px">ОТКЛЮЧЁН</span>';
    h += '</div>';
    h += '<div style="display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap">';
    h += '<span style="padding:3px 12px;border-radius:8px;font-size:0.73rem;font-weight:700;background:' + (isDisabled ? 'rgba(51,65,85,0.3)' : rColor + '1a') + ';color:' + (isDisabled ? '#64748b' : rColor) + ';border:1px solid ' + (isDisabled ? 'transparent' : rColor + '33') + '">' + escHtml(rl[u.role]||u.role) + '</span>';
    if (u.position_title) h += '<span style="font-size:0.72rem;color:#94a3b8;background:#1e293b;padding:2px 8px;border-radius:6px">' + escHtml(u.position_title) + '</span>';
    if (onVacation) h += '<span style="font-size:0.65rem;color:#fbbf24;background:rgba(245,158,11,0.1);padding:2px 8px;border-radius:6px;font-weight:600">В отпуске</span>';
    h += '</div>';
    if (activity && !isDisabled) { h += '<div style="font-size:0.68rem;color:#475569;margin-top:4px"><i class="fas fa-desktop" style="margin-right:4px;color:#334155"></i>' + escHtml(activity.last_page || '') + '</div>'; }
    h += '</div></div>';

    // === INFO GRID ===
    h += '<div style="padding:4px 20px 12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">';
    h += '<div style="padding:8px 0;border-bottom:1px solid #1e293b"><span style="color:#475569;font-size:0.68rem;display:block;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px">Логин</span><span style="font-family:monospace;color:#94a3b8;font-size:0.8rem">' + escHtml(u.username) + '</span></div>';
    h += '<div style="padding:8px 0;border-bottom:1px solid #1e293b"><span style="color:#475569;font-size:0.68rem;display:block;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px">Телефон</span><span style="color:#e2e8f0;font-size:0.8rem">' + (u.phone ? '<a href="tel:' + escHtml(u.phone) + '" style="color:#60a5fa;text-decoration:none">' + escHtml(u.phone) + '</a>' : '<span style="color:#334155">\\u2014</span>') + '</span></div>';
    h += '<div style="padding:8px 0;border-bottom:1px solid #1e293b"><span style="color:#475569;font-size:0.68rem;display:block;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.5px"><i class="fab fa-telegram" style="color:#26A5E4;margin-right:3px;font-size:0.6rem"></i>Telegram</span><span style="color:#e2e8f0;font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block">' + (u.telegram_link ? '<a href="' + escHtml(u.telegram_link) + '" target="_blank" style="color:#26A5E4;text-decoration:none">' + escHtml(u.telegram_link.replace('https://t.me/', '@')) + '</a>' : '<span style="color:#334155">\\u2014</span>') + '</span></div>';
    h += '</div>';

    // === SALARY & EMPLOYMENT ROW ===
    h += '<div style="padding:0 20px 12px;display:flex;gap:10px;flex-wrap:wrap">';
    if (u.salary) {
      var salaryTypeLabel = {monthly:'/мес',biweekly:'/15дн',per_task:'/раб',percent:'%'}[u.salary_type||'monthly']||'';
      h += '<div style="flex:1;min-width:120px;background:linear-gradient(135deg,rgba(59,130,246,0.08),rgba(59,130,246,0.03));border:1px solid rgba(59,130,246,0.15);border-radius:10px;padding:10px 14px">';
      h += '<div style="color:#475569;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px"><i class="fas fa-money-bill-wave" style="margin-right:3px"></i>Зарплата</div>';
      h += '<div style="color:#60a5fa;font-weight:800;font-size:1.1rem">' + fmtAmt(u.salary) + ' <span style="color:#475569;font-weight:400;font-size:0.72rem">' + escHtml(salaryTypeLabel) + '</span></div>';
      h += '</div>';
    }
    if (u.hire_date) {
      h += '<div style="flex:1;min-width:120px;background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(139,92,246,0.03));border:1px solid rgba(139,92,246,0.15);border-radius:10px;padding:10px 14px">';
      h += '<div style="color:#475569;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px"><i class="fas fa-briefcase" style="margin-right:3px"></i>Стаж</div>';
      h += '<div style="display:flex;align-items:baseline;gap:6px"><span style="color:#a78bfa;font-weight:700;font-size:0.95rem">' + (workDuration || '\\u2014') + '</span>';
      h += '<span style="color:#475569;font-size:0.68rem">c ' + escHtml(u.hire_date) + '</span></div>';
      if (u.end_date) h += '<div style="color:#f87171;font-size:0.7rem;margin-top:2px"><i class="fas fa-calendar-times" style="margin-right:3px"></i>По ' + escHtml(u.end_date) + '</div>';
      h += '</div>';
    }
    h += '</div>';

    // === EARNINGS BLOCK ===
    h += '<div style="padding:0 20px 12px">';
    // Find any cached earnings for this user (prefer curMonth, then any other month)
    var earningsMonth = curMonth;
    var earnings = _empEarningsCache[u.id + '_' + curMonth];
    if (!earnings) {
      for (var ek in _empEarningsCache) {
        if (ek.indexOf(u.id + '_') === 0 && _empEarningsCache[ek]) {
          earnings = _empEarningsCache[ek];
          earningsMonth = ek.replace(u.id + '_', '');
          break;
        }
      }
    }
    if (earnings) {
      var cacheKey = u.id + '_' + earningsMonth;
      h += '<div style="background:linear-gradient(135deg,#0c1222,#0f172a);border-radius:12px;padding:14px 16px;border:1px solid #1e293b;position:relative">';
      // Close button
      h += '<button onclick="delete _empEarningsCache[&apos;' + cacheKey + '&apos;];render()" style="position:absolute;top:8px;right:8px;background:rgba(100,116,139,0.2);border:none;color:#94a3b8;cursor:pointer;width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.8rem;transition:all 0.2s" title="Скрыть заработок"><i class="fas fa-times"></i></button>';
      // Month header
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-right:28px">';
      h += '<span style="font-size:0.75rem;color:#64748b"><i class="fas fa-chart-bar" style="margin-right:4px;color:#8B5CF6"></i>Заработок: ' + earningsMonth + '</span>';
      h += '<span style="color:#c4b5fd;font-weight:900;font-size:1rem">' + fmtAmt(earnings.total_earnings) + '</span></div>';
      // Partial month indicator
      if (earnings.is_partial_month) {
        h += '<div style="font-size:0.68rem;color:#F59E0B;background:rgba(245,158,11,0.08);padding:4px 10px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(245,158,11,0.15)"><i class="fas fa-calendar-day" style="margin-right:4px"></i>Неполный месяц: ' + (earnings.worked_days||0) + ' из ' + (earnings.total_days_in_month||30) + ' дней (ЗП пропорционально)</div>';
      }
      // Visual breakdown bar
      var maxEarn = Math.max(earnings.salary || 0, 1);
      var salW = Math.min(100, Math.round(((earnings.month_salary_after_vac !== undefined ? earnings.month_salary_after_vac : earnings.salary) / maxEarn) * 100));
      var bonW = Math.min(50, Math.round((earnings.bonuses / maxEarn) * 100));
      var penW = Math.min(50, Math.round((earnings.penalties / maxEarn) * 100));
      h += '<div style="display:flex;height:6px;border-radius:3px;overflow:hidden;gap:2px;margin-bottom:10px">';
      h += '<div style="flex:' + salW + ';background:linear-gradient(90deg,#3B82F6,#60a5fa);border-radius:3px" title="ЗП: ' + fmtAmt(earnings.month_salary_after_vac !== undefined ? earnings.month_salary_after_vac : earnings.salary) + '"></div>';
      if (bonW > 0) h += '<div style="flex:' + bonW + ';background:linear-gradient(90deg,#10B981,#34d399);border-radius:3px" title="Бонусы: +' + fmtAmt(earnings.bonuses) + '"></div>';
      if (penW > 0) h += '<div style="flex:' + penW + ';background:linear-gradient(90deg,#EF4444,#f87171);border-radius:3px" title="Штрафы: -' + fmtAmt(earnings.penalties) + '"></div>';
      h += '</div>';
      // Metrics grid
      h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">';
      h += '<div style="text-align:center"><div style="color:#475569;font-size:0.62rem;text-transform:uppercase;margin-bottom:3px">ЗП</div><div style="color:#60a5fa;font-weight:700;font-size:0.82rem">' + fmtAmt(earnings.month_salary_after_vac !== undefined ? earnings.month_salary_after_vac : earnings.salary) + '</div></div>';
      h += '<div style="text-align:center"><div style="color:#475569;font-size:0.62rem;text-transform:uppercase;margin-bottom:3px">Бонусы</div><div style="color:#34d399;font-weight:700;font-size:0.82rem">+' + fmtAmt(earnings.bonuses) + '</div></div>';
      h += '<div style="text-align:center"><div style="color:#475569;font-size:0.62rem;text-transform:uppercase;margin-bottom:3px">Штрафы</div><div style="color:#f87171;font-weight:700;font-size:0.82rem">' + (earnings.penalties > 0 ? '-' : '') + fmtAmt(earnings.penalties) + '</div></div>';
      h += '<div style="text-align:center"><div style="color:#475569;font-size:0.62rem;text-transform:uppercase;margin-bottom:3px">Отпуск дн.</div><div style="color:#fbbf24;font-weight:700;font-size:0.82rem">' + (earnings.vacation_total_days || 0) + ' дн.</div></div>';
      h += '</div>';
      // === VACATION EARNINGS ===
      if (earnings.vacation_paid_amount > 0) {
        h += '<div style="margin-top:8px;font-size:0.78rem;color:#10B981;background:rgba(16,185,129,0.06);padding:8px 12px;border-radius:8px;border:1px solid rgba(16,185,129,0.12);display:flex;justify-content:space-between;align-items:center"><span><i class="fas fa-umbrella-beach" style="margin-right:6px;color:#fbbf24"></i><strong>Отпуск (оплачиваемый)</strong></span><span style="font-weight:800;color:#34d399">+' + fmtAmt(earnings.vacation_paid_amount) + '</span></div>';
      }
      // Unpaid vacation notice
      if (earnings.unpaid_deduction > 0) {
        h += '<div style="margin-top:8px;font-size:0.72rem;color:#f87171;background:rgba(239,68,68,0.06);padding:6px 10px;border-radius:8px;border:1px solid rgba(239,68,68,0.1)"><i class="fas fa-exclamation-triangle" style="margin-right:4px"></i>Вычет за неоплач. отпуск: -' + fmtAmt(earnings.unpaid_deduction) + '</div>';
      }
      // Lifetime totals
      if (earnings.lifetime && earnings.lifetime.months_worked > 0) {
        h += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid #1e293b">';
        h += '<div style="font-size:0.72rem;color:#64748b;margin-bottom:8px;display:flex;align-items:center;gap:6px"><i class="fas fa-history" style="color:#8B5CF6"></i><span>За всё время работы</span><span style="background:#1e293b;padding:1px 8px;border-radius:6px;font-weight:600;color:#a78bfa">' + earnings.lifetime.months_worked + ' мес.</span></div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:6px">';
        h += '<div style="text-align:center"><div style="color:#475569;font-size:0.6rem;text-transform:uppercase;margin-bottom:2px">ЗП</div><div style="color:#60a5fa;font-weight:700;font-size:0.78rem">' + fmtAmt(earnings.lifetime.total_salary) + '</div></div>';
        h += '<div style="text-align:center"><div style="color:#475569;font-size:0.6rem;text-transform:uppercase;margin-bottom:2px">Бонусы</div><div style="color:#34d399;font-weight:700;font-size:0.78rem">+' + fmtAmt(earnings.lifetime.total_bonuses) + '</div></div>';
        h += '<div style="text-align:center"><div style="color:#475569;font-size:0.6rem;text-transform:uppercase;margin-bottom:2px">Штрафы</div><div style="color:#f87171;font-weight:700;font-size:0.78rem">-' + fmtAmt(earnings.lifetime.total_penalties) + '</div></div>';
        if (earnings.lifetime.paid_vacation_amount > 0) {
          h += '<div style="text-align:center"><div style="color:#475569;font-size:0.6rem;text-transform:uppercase;margin-bottom:2px">Отпуск</div><div style="color:#fbbf24;font-weight:700;font-size:0.78rem">+' + fmtAmt(earnings.lifetime.paid_vacation_amount) + '</div></div>';
        } else {
          h += '<div></div>';
        }
        h += '<div style="text-align:center;background:rgba(139,92,246,0.06);border-radius:8px;padding:4px"><div style="color:#a78bfa;font-size:0.6rem;text-transform:uppercase;margin-bottom:2px;font-weight:600">ИТОГО</div><div style="color:#c4b5fd;font-weight:900;font-size:0.9rem">' + fmtAmt(earnings.lifetime.grand_total) + '</div></div>';
        h += '</div>';
        if (earnings.lifetime.unpaid_deduction > 0) {
          h += '<div style="font-size:0.65rem;color:#64748b;margin-top:4px;text-align:right">Неоплач. отпуск: -' + fmtAmt(earnings.lifetime.unpaid_deduction) + '</div>';
        }
        h += '</div>';
      }
      h += '</div>';
    } else {
      h += '<div style="display:flex;gap:6px">';
      h += '<button class="btn btn-outline" style="flex:1;padding:10px;font-size:0.82rem;border-radius:10px;border-style:dashed" onclick="loadEmpEarnings(' + u.id + ',&apos;' + curMonth + '&apos;)"><i class="fas fa-chart-line" style="margin-right:6px;color:#8B5CF6"></i>Заработок за ' + curMonth + '</button>';
      h += '<button class="btn btn-outline" style="padding:10px 14px;font-size:0.82rem;border-radius:10px;border-style:dashed" onclick="showPeriodEarningsModal(' + u.id + ')" title="Заработок за период"><i class="fas fa-calendar-alt" style="color:#F59E0B"></i></button>';
      h += '</div>';
    }
    h += '</div>';

    // === VACATION SECTION ===
    var userVacs = getUserVacations(u.id);
    if (userVacs.length > 0 || isAdmin) {
      h += '<div style="padding:0 20px 12px">';
      var totalVacDays = 0; var paidVacDays = 0;
      for (var vi = 0; vi < userVacs.length; vi++) { totalVacDays += userVacs[vi].days_count || 0; if (userVacs[vi].is_paid) paidVacDays += userVacs[vi].days_count || 0; }
      if (userVacs.length > 0) {
        h += '<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;color:#94a3b8;margin-bottom:6px;background:#0f172a;padding:8px 12px;border-radius:8px;border:1px solid #1e293b">';
        h += '<i class="fas fa-umbrella-beach" style="color:#fbbf24"></i>';
        h += '<span style="flex:1">Отпуск: <strong style="color:#e2e8f0">' + totalVacDays + '</strong> дн.';
        if (paidVacDays > 0) h += ' <span style="color:#10B981;font-size:0.72rem">(' + paidVacDays + ' оплач.)</span>';
        h += '</span>';
        h += '<button class="btn btn-outline" style="padding:3px 10px;font-size:0.7rem;border-radius:6px" onclick="_empVacationExpanded[' + u.id + ']=!_empVacationExpanded[' + u.id + '];render()"><i class="fas fa-chevron-' + (_empVacationExpanded[u.id] ? 'up' : 'down') + '" style="font-size:0.6rem"></i></button>';
        h += '</div>';
        if (_empVacationExpanded[u.id]) {
          h += '<div style="margin-top:6px;display:flex;flex-direction:column;gap:4px">';
          for (var vj = 0; vj < userVacs.length; vj++) {
            var v = userVacs[vj];
            var vStatusColor = v.status === 'active' ? '#10B981' : v.status === 'completed' ? '#64748b' : '#3B82F6';
            h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:#0f172a;border-radius:8px;border-left:3px solid ' + vStatusColor + ';font-size:0.76rem">';
            h += '<span style="color:#e2e8f0;font-weight:500">' + escHtml(v.start_date) + ' \\u2014 ' + escHtml(v.end_date) + '</span>';
            h += '<span style="padding:1px 6px;border-radius:4px;font-size:0.65rem;background:' + vStatusColor + '22;color:' + vStatusColor + ';font-weight:600">' + escHtml({planned:'План',active:'Активен',completed:'Завершён',cancelled:'Отменён'}[v.status]||v.status) + '</span>';
            h += '<span style="color:#94a3b8">' + v.days_count + 'д</span>';
            h += '<span style="color:' + (v.is_paid ? '#10B981' : '#EF4444') + ';font-weight:600;font-size:0.72rem">' + (v.is_paid ? '\\u2713 Оплач.' : '\\u2717 Без') + '</span>';
            if (v.paid_amount > 0) h += '<span style="color:#60a5fa;font-size:0.72rem">' + fmtAmt(v.paid_amount) + '</span>';
            if (isAdmin) h += '<button class="btn btn-danger" style="padding:2px 7px;font-size:0.65rem;margin-left:auto;border-radius:6px" onclick="deleteVacation(' + v.id + ')"><i class="fas fa-times"></i></button>';
            h += '</div>';
          }
          h += '</div>';
        }
      }
      if (isAdmin) {
        h += '<button class="btn btn-outline" style="padding:5px 12px;font-size:0.72rem;margin-top:6px;border-radius:8px;border-style:dashed" onclick="showVacationModal(' + u.id + ')"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить отпуск</button>';
      }
      h += '</div>';
    }

    // === ACTIONS PANEL ===
    if (isAdmin) {
      // Hide edit/credentials buttons for main_admin — admin profile is managed in Settings
      var isTargetMainAdmin = u.role === 'main_admin';
      if (isTargetMainAdmin) {
        h += '<div style="padding:10px 20px 14px;border-top:1px solid #1e293b;text-align:center;background:linear-gradient(180deg,transparent,rgba(15,23,42,0.5))">';
        h += '<span style="font-size:0.78rem;color:#64748b"><i class="fas fa-shield-alt" style="margin-right:4px;color:#8B5CF6"></i>Управление профилем — в разделе <a href="#" onclick="navigate(&apos;settings&apos;);return false" style="color:#a78bfa;text-decoration:underline">Настройки</a></span>';
        h += '</div>';
      } else {
      h += '<div style="padding:10px 20px 16px;border-top:1px solid #1e293b;display:flex;gap:6px;flex-wrap:wrap;background:linear-gradient(180deg,transparent,rgba(15,23,42,0.5))">';
      h += '<button class="btn btn-outline" style="padding:8px 16px;font-size:0.8rem;flex:1;border-radius:10px" onclick="editEmployee(' + u.id + ')"><i class="fas fa-edit" style="margin-right:5px"></i>Ред.</button>';
      h += '<button class="btn btn-outline" style="padding:8px 16px;font-size:0.8rem;flex:1;border-radius:10px" onclick="showChangePassForm(' + u.id + ')"><i class="fas fa-key" style="margin-right:5px"></i>Учётные</button>';
      h += '<button class="btn btn-outline" style="padding:8px 12px;font-size:0.8rem;border-radius:10px" onclick="navigate(&apos;team_access&apos;);editPermUserId=' + u.id + ';render()" title="Права доступа"><i class="fas fa-shield-alt"></i></button>';
      if (u.is_active && u.role !== 'main_admin') {
        h += '<button class="btn" style="padding:8px 14px;font-size:0.8rem;background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.2);border-radius:10px" onclick="forceStopEmployee(' + u.id + ',&apos;' + escHtml(u.display_name) + '&apos;)" title="Принудительно завершить работу"><i class="fas fa-user-slash" style="margin-right:4px"></i>Стоп</button>';
      } else if (!u.is_active && u.role !== 'main_admin') {
        h += '<button class="btn" style="padding:8px 14px;font-size:0.8rem;background:rgba(16,185,129,0.1);color:#34d399;border:1px solid rgba(16,185,129,0.2);border-radius:10px" onclick="reactivateEmployee(' + u.id + ',&apos;' + escHtml(u.display_name) + '&apos;)" title="Активировать сотрудника"><i class="fas fa-user-check" style="margin-right:4px"></i>Вкл.</button>';
      }
      if (u.role !== 'main_admin') h += '<button class="btn btn-danger" style="padding:8px 12px;font-size:0.8rem;border-radius:10px" onclick="deleteEmployee(' + u.id + ',&apos;' + escHtml(u.display_name) + '&apos;)" title="Удалить"><i class="fas fa-trash"></i></button>';
      h += '</div>';
      // Credentials change form
      if (_changePassUserId === u.id) {
        h += '<div style="padding:14px 20px 18px;background:linear-gradient(135deg,rgba(139,92,246,0.05),#0f172a);border-top:1px solid #8B5CF6">';
        h += '<div style="font-size:0.85rem;font-weight:700;margin-bottom:12px;color:#a78bfa"><i class="fas fa-user-edit" style="margin-right:5px"></i>Учётные данные: ' + escHtml(u.display_name) + '</div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">';
        h += '<div><label style="font-size:0.72rem;color:#64748b;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px">Логин</label><input class="input" id="newuser-' + u.id + '" type="text" placeholder="Новый логин" value="' + escHtml(u.username) + '" style="border-radius:10px"></div>';
        h += '<div><label style="font-size:0.72rem;color:#64748b;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px">Пароль</label><div style="position:relative"><input class="input" id="newpass-' + u.id + '" type="password" placeholder="Новый пароль" style="padding-right:36px;border-radius:10px">';
        h += '<button type="button" onclick="var i=document.getElementById(&apos;newpass-' + u.id + '&apos;);i.type=i.type===&apos;password&apos;?&apos;text&apos;:&apos;password&apos;;this.querySelector(&apos;i&apos;).className=&apos;fas fa-&apos;+(i.type===&apos;password&apos;?&apos;eye&apos;:&apos;eye-slash&apos;)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:#64748b;cursor:pointer;padding:4px"><i class="fas fa-eye"></i></button></div></div>';
        h += '</div>';
        h += '<div style="display:flex;gap:8px;align-items:center;justify-content:flex-end">';
        h += '<span style="font-size:0.72rem;color:#475569;flex:1">Пустое поле = без изменений</span>';
        h += '<button class="btn btn-success" style="padding:9px 16px;border-radius:10px" onclick="doChangeCredentials(' + u.id + ')"><i class="fas fa-check" style="margin-right:4px"></i>Сохранить</button>';
        h += '<button class="btn btn-outline" style="padding:9px 16px;border-radius:10px" onclick="_changePassUserId=0;render()"><i class="fas fa-times"></i></button>';
        h += '</div></div>';
      }
      } // end if !isTargetMainAdmin
    }
    h += '</div>'; // card end
  }
  h += '</div>';
  if (filtered.length === 0) {
    h += '<div style="text-align:center;padding:60px 20px;color:#64748b"><i class="fas fa-users-slash" style="font-size:3rem;margin-bottom:16px;display:block;opacity:0.2"></i>';
    h += '<p style="font-size:1.1rem;font-weight:600;color:#94a3b8">Сотрудники не найдены</p>';
    h += '<p style="font-size:0.85rem;margin-top:6px">Измените фильтры или добавьте нового сотрудника</p></div>';
  }
  h += '<div id="employeeModalArea"></div>';
  h += '<div id="vacationModalArea"></div>';
  return h + '</div>';
}

async function loadEmpEarnings(userId, month) {
  try {
    var res = await api('/users/' + userId + '/earnings/' + month);
    if (res && !res.error) { _empEarningsCache[userId + '_' + month] = res; render(); }
    else { toast(res?.error || 'Ошибка загрузки', 'error'); }
  } catch(e) { toast('Ошибка загрузки', 'error'); }
}

async function loadAllEarnings() {
  var curMonth = new Date().toISOString().slice(0,7);
  var users = ensureArray(data.users);
  toast('Загрузка данных о заработке...', 'info');
  var promises = users.filter(function(u) { return u.salary > 0 || u.hire_date; }).map(function(u) {
    return api('/users/' + u.id + '/earnings/' + curMonth).then(function(res) {
      if (res && !res.error) _empEarningsCache[u.id + '_' + curMonth] = res;
    }).catch(function(){});
  });
  await Promise.all(promises);
  toast('Данные обновлены!');
  render();
}

function showPeriodEarningsModal(userId) {
  var h = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center" onclick="this.remove()">';
  h += '<div class="card" style="width:400px;max-width:90vw" onclick="event.stopPropagation()">';
  h += '<h3 style="font-size:1.05rem;font-weight:700;margin-bottom:16px"><i class="fas fa-calendar-alt" style="color:#F59E0B;margin-right:8px"></i>Заработок за период</h3>';
  h += '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">Выберите месяц</label>';
  h += '<input class="input" type="month" id="periodMonth" value="' + new Date().toISOString().slice(0,7) + '"></div>';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end">';
  h += '<button type="button" class="btn btn-outline" onclick="this.closest(&apos;[style*=fixed]&apos;).remove()">Отмена</button>';
  h += '<button type="button" class="btn btn-primary" onclick="var m=document.getElementById(&apos;periodMonth&apos;).value;if(m){loadEmpEarnings(' + userId + ',m);this.closest(&apos;[style*=fixed]&apos;).remove();}"><i class="fas fa-search" style="margin-right:6px"></i>Показать</button>';
  h += '</div></div></div>';
  var area = document.getElementById('employeeModalArea');
  if (area) area.innerHTML = h;
}

function showVacationModal(userId) {
  var h = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center" onclick="this.remove()">';
  h += '<div class="card" style="width:480px;max-width:90vw" onclick="event.stopPropagation()">';
  h += '<h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px"><i class="fas fa-umbrella-beach" style="color:#f59e0b;margin-right:8px"></i>Новый отпуск</h3>';
  h += '<form onsubmit="saveVacation(event,' + userId + ')">';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">';
  h += '<div><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">Дата начала *</label><input class="input" type="date" id="vacStartDate" required></div>';
  h += '<div><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">Дата окончания *</label><input class="input" type="date" id="vacEndDate" required></div>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">';
  h += '<div><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">Статус</label><select class="input" id="vacStatus"><option value="planned">Запланирован</option><option value="active">Активен</option><option value="completed">Завершён</option><option value="cancelled">Отменён</option></select></div>';
  h += '<div><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">Оплачиваемый?</label><select class="input" id="vacIsPaid"><option value="1">Да</option><option value="0">Нет</option></select></div>';
  h += '</div>';
  h += '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">Сумма оплаты (если оплачиваемый)</label><input class="input" type="number" id="vacPaidAmount" value="0" step="0.01"></div>';
  h += '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">Примечание</label><input class="input" id="vacNotes" placeholder="Необязательно"></div>';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn-outline" onclick="this.closest(&apos;[style*=fixed]&apos;).remove()">Отмена</button>';
  h += '<button type="submit" class="btn btn-primary"><i class="fas fa-check" style="margin-right:6px"></i>Сохранить</button></div>';
  h += '</form></div></div>';
  var area = document.getElementById('vacationModalArea');
  if (area) area.innerHTML = h;
}

async function saveVacation(e, userId) {
  e.preventDefault();
  var body = {
    start_date: document.getElementById('vacStartDate').value,
    end_date: document.getElementById('vacEndDate').value,
    status: document.getElementById('vacStatus').value,
    is_paid: document.getElementById('vacIsPaid').value === '1',
    paid_amount: Number(document.getElementById('vacPaidAmount').value) || 0,
    notes: document.getElementById('vacNotes').value
  };
  var res = await api('/users/' + userId + '/vacations', { method:'POST', body: JSON.stringify(body) });
  if (res && res.success) {
    toast('Отпуск добавлен');
    var vacData = await api('/vacations');
    data.vacations = (vacData && vacData.vacations) || [];
    render();
  } else { toast(res?.error || 'Ошибка', 'error'); }
}

async function deleteVacation(id) {
  if (!confirm('Удалить запись об отпуске?')) return;
  var res = await api('/vacations/' + id, { method:'DELETE' });
  if (res && res.success) {
    toast('Запись удалена');
    var vacData = await api('/vacations');
    data.vacations = (vacData && vacData.vacations) || [];
    render();
  } else { toast(res?.error || 'Ошибка', 'error'); }
}

var _changePassUserId = 0;
function showChangePassForm(id) { _changePassUserId = id; render(); }
async function doChangeCredentials(userId) {
  var newPass = document.getElementById('newpass-' + userId)?.value || '';
  var newUser = (document.getElementById('newuser-' + userId)?.value || '').trim();
  var currentUsr = (ensureArray(data.users)).find(function(x){ return x.id === userId; });
  var usernameChanged = newUser && newUser !== (currentUsr?.username || '');
  if (!newPass && !usernameChanged) { toast('Внесите изменения в логин или пароль', 'error'); return; }
  if (newPass && newPass.length < 3) { toast('Пароль слишком короткий (мин. 3 символа)', 'error'); return; }
  if (newUser && newUser.length < 2) { toast('Логин слишком короткий (мин. 2 символа)', 'error'); return; }
  var body = {};
  if (usernameChanged) body.new_username = newUser;
  if (newPass) body.new_password = newPass;
  var res = await api('/users/' + userId + '/reset-password', { method:'POST', body: JSON.stringify(body) });
  if (res && (res.success || res.new_password)) { 
    var msg = [];
    if (usernameChanged) msg.push('Логин изменён');
    if (newPass) msg.push('Пароль изменён');
    toast(msg.join(' + ') + '!'); 
    _changePassUserId = 0; 
    data.users = ensureArray(await api('/users'));
    render(); 
  }
  else { toast(res?.error || 'Ошибка', 'error'); }
}

async function toggleUserActive(id, val) {
  await api('/users/' + id, { method:'PUT', body: JSON.stringify({is_active: val}) });
  data.users = ensureArray(await api('/users'));
  render();
}

async function forceStopEmployee(id, name) {
  if (!confirm('\\u26a0\\ufe0f Принудительно завершить работу сотрудника "' + name + '"? Сотрудник будет отключён и не сможет войти. Дата окончания = сегодня.')) return;
  var today = new Date().toISOString().slice(0,10);
  await api('/users/' + id, { method:'PUT', body: JSON.stringify({ is_active: 0, end_date: today }) });
  data.users = ensureArray(await api('/users'));
  toast('Сотрудник "' + name + '" отключён. Вход заблокирован.');
  render();
}

async function reactivateEmployee(id, name) {
  if (!confirm('Активировать сотрудника "' + name + '"? Сотрудник снова сможет входить. Дата начала = сегодня, дата окончания очищена.')) return;
  var today = new Date().toISOString().slice(0,10);
  await api('/users/' + id, { method:'PUT', body: JSON.stringify({ is_active: 1, hire_date: today, end_date: '' }) });
  data.users = ensureArray(await api('/users'));
  toast('Сотрудник "' + name + '" активирован с ' + today);
  render();
}

async function deleteEmployee(id, name) {
  if (!confirm('\\u0423\\u0434\\u0430\\u043b\\u0438\\u0442\\u044c \\u0441\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u043a\\u0430 "' + name + '"?')) return;
  await api('/users/' + id, { method:'DELETE' });
  data.users = ensureArray(await api('/users'));
  toast('\\u0421\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u043a \\u0443\\u0434\\u0430\\u043b\\u0451\\u043d');
  render();
}

async function resetEmployeePass(id, name) {
  // Redirect to inline password form
  showChangePassForm(id);
}

function showEmployeeModal(userId) {
  const roles = rolesConfig?.roles || [];
  const rl = rolesConfig?.role_labels || {};
  const u = userId ? ensureArray(data.users).find(x => x.id === userId) : null;
  const compRoles = data.companyRoles || [];
  let h = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999;display:flex;align-items:center;justify-content:center" onclick="this.remove()">' +
    '<div class="card" style="width:520px;max-width:90vw;max-height:90vh;overflow-y:auto" onclick="event.stopPropagation()">' +
    '<h3 style="font-size:1.1rem;font-weight:700;margin-bottom:16px">' + (u ? '\\u0420\\u0435\\u0434\\u0430\\u043a\\u0442\\u0438\\u0440\\u043e\\u0432\\u0430\\u0442\\u044c' : '\\u041d\\u043e\\u0432\\u044b\\u0439 \\u0441\\u043e\\u0442\\u0440\\u0443\\u0434\\u043d\\u0438\\u043a') + '</h3>' +
    '<form onsubmit="saveEmployee(event,' + (u ? u.id : 'null') + ')">' +
    '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\\u0418\\u043c\\u044f / \\u0424\\u0418\\u041e *</label><input class="input" id="empName" value="' + escHtml(u?.display_name||'') + '" required></div>';
  if (!u) {
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\\u041b\\u043e\\u0433\\u0438\\u043d *</label><input class="input" id="empUser" required></div>' +
      '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\\u041f\\u0430\\u0440\\u043e\\u043b\\u044c *</label><input class="input" type="password" id="empPass" required></div></div>';
  }
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
  h += '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\\u0420\\u043e\\u043b\\u044c *</label><select class="input" id="empRole">';
  // Merge hardcoded roles + custom company roles (deduplicated)
  var allRolesSet = {};
  for (const r of roles) { allRolesSet[r] = rl[r] || r; h += '<option value="' + r + '"' + (u?.role===r?' selected':'') + '>' + escHtml(rl[r]||r) + '</option>'; }
  for (var cri2 = 0; cri2 < compRoles.length; cri2++) {
    var crKey = compRoles[cri2].role_key;
    if (crKey && !allRolesSet[crKey]) {
      var crLabel = getCompanyRoleName(compRoles[cri2]);
      h += '<option value="' + escHtml(crKey) + '"' + (u?.role===crKey?' selected':'') + '>' + escHtml(crLabel || crKey) + '</option>';
    }
  }
  h += '</select></div>';
  // Position from company roles only (no manual entry)
  h += '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\\u0414\\u043e\\u043b\\u0436\\u043d\\u043e\\u0441\\u0442\\u044c</label><select class="input" id="empPosition">';
  h += '<option value="">\\u2014 \\u0412\\u044b\\u0431\\u0440\\u0430\\u0442\\u044c \\u2014</option>';
  for (var cri = 0; cri < compRoles.length; cri++) {
    var cr = compRoles[cri];
    var crName = getCompanyRoleName(cr);
    if (!crName) continue;
    h += '<option value="' + escHtml(crName) + '"' + (u?.position_title === crName ? ' selected' : '') + '>' + escHtml(crName) + '</option>';
  }
  h += '</select></div></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\\u0422\\u0435\\u043b\\u0435\\u0444\\u043e\\u043d</label><input class="input" id="empPhone" value="' + escHtml(u?.phone||'') + '"></div>' +
    '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px"><i class="fab fa-telegram" style="color:#26A5E4;margin-right:4px"></i>Telegram</label><input class="input" id="empTelegram" value="' + escHtml(u?.telegram_link||'') + '" placeholder="https://t.me/username"></div></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\\u0417\\u0430\\u0440\\u043f\\u043b\\u0430\\u0442\\u0430</label><input class="input" type="number" id="empSalary" value="' + (u?.salary||0) + '"></div>';
  h += '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\\u0422\\u0438\\u043f \\u043e\\u043f\\u043b\\u0430\\u0442\\u044b</label><select class="input" id="empSalaryType">';
  var stypesModal = [{v:'monthly',l:'\\u041f\\u043e\\u043c\\u0435\\u0441\\u044f\\u0447\\u043d\\u043e'},{v:'biweekly',l:'\\u0417\\u0430 15 \\u0434\\u043d\\u0435\\u0439'},{v:'per_task',l:'\\u0417\\u0430 \\u0440\\u0430\\u0431\\u043e\\u0442\\u0443'},{v:'percent',l:'\\u041f\\u0440\\u043e\\u0446\\u0435\\u043d\\u0442 \\u043e\\u0442 \\u043e\\u0431\\u043e\\u0440\\u043e\\u0442\\u0430'}];
  for (var sti3 = 0; sti3 < stypesModal.length; sti3++) {
    h += '<option value="' + stypesModal[sti3].v + '"' + ((u?.salary_type||'monthly') === stypesModal[sti3].v ? ' selected' : '') + '>' + stypesModal[sti3].l + '</option>';
  }
  h += '</select></div></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\\u0414\\u0430\\u0442\\u0430 \\u043d\\u0430\\u0447\\u0430\\u043b\\u0430 \\u0440\\u0430\\u0431\\u043e\\u0442\\u044b</label><input class="input" type="date" id="empHireDate" value="' + escHtml(u?.hire_date||'') + '"></div>';
  h += '<div style="margin-bottom:12px"><label style="font-size:0.8rem;color:#94a3b8;display:block;margin-bottom:4px">\\u0414\\u0430\\u0442\\u0430 \\u043e\\u043a\\u043e\\u043d\\u0447\\u0430\\u043d\\u0438\\u044f <span style="font-size:0.65rem;color:#475569">(\\u043f\\u0443\\u0441\\u0442\\u043e = \\u0440\\u0430\\u0431\\u043e\\u0442\\u0430\\u0435\\u0442)</span></label><input class="input" type="date" id="empEndDate" value="' + escHtml(u?.end_date||'') + '"></div></div>';
  h += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button type="button" class="btn btn-outline" onclick="this.closest(&apos;[style*=fixed]&apos;).remove()">\\u041e\\u0442\\u043c\\u0435\\u043d\\u0430</button><button type="submit" class="btn btn-primary"><i class="fas fa-check" style="margin-right:6px"></i>' + (u?'\\u0421\\u043e\\u0445\\u0440\\u0430\\u043d\\u0438\\u0442\\u044c':'\\u0421\\u043e\\u0437\\u0434\\u0430\\u0442\\u044c') + '</button></div></form></div></div>';
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
    telegram_link: document.getElementById('empTelegram')?.value || '',
    position_title: document.getElementById('empPosition')?.value || '',
    salary: Number(document.getElementById('empSalary')?.value) || 0,
    salary_type: document.getElementById('empSalaryType')?.value || 'monthly',
    hire_date: document.getElementById('empHireDate')?.value || '',
    end_date: document.getElementById('empEndDate')?.value || ''
  };
  // Enforce single main_admin
  if (body.role === 'main_admin' && !id) {
    var existing = ensureArray(data.users).find(function(u) { return u.role === 'main_admin'; });
    if (existing) { toast('Главный админ уже существует: ' + existing.display_name, 'error'); return; }
  }
  if (body.role === 'main_admin' && id) {
    var existing2 = ensureArray(data.users).find(function(u) { return u.role === 'main_admin' && u.id !== id; });
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
  data.users = ensureArray(await api('/users'));
  toast(id ? 'Сотрудник обновлён' : 'Сотрудник создан');
  render();
}


`;
