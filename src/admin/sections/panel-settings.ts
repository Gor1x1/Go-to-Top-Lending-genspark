/**
 * Admin Panel — Settings, payment methods
 * 313 lines of admin SPA JS code
 */
export const CODE: string = `
// ===== SETTINGS =====
function renderSettings() {
  var isMainAdmin = currentUser && currentUser.role === 'main_admin';
  var adminUser = isMainAdmin ? ensureArray(data.users).find(function(u) { return u.role === 'main_admin'; }) : null;
  var h = '<div style="padding:32px"><h1 style="font-size:1.8rem;font-weight:800;margin-bottom:24px">Настройки</h1>';

  // ===== ADMIN PROFILE (only for main_admin) =====
  if (isMainAdmin && adminUser) {
    h += '<div class="card" style="max-width:600px;margin-bottom:20px;border:1px solid rgba(139,92,246,0.3)">' +
      '<h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-user-shield" style="color:#8B5CF6;margin-right:8px"></i>Профиль главного администратора</h3>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">' +
        '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Имя</label><input class="input" id="adminProfileName" value="' + escHtml(adminUser.display_name || '') + '"></div>' +
        '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Логин</label><input class="input" id="adminProfileLogin" value="' + escHtml(adminUser.username || '') + '"></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">' +
        '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Телефон</label><input class="input" id="adminProfilePhone" value="' + escHtml(adminUser.phone || '') + '"></div>' +
        '<div><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Telegram</label><input class="input" id="adminProfileTelegram" value="' + escHtml(adminUser.telegram_link || '') + '" placeholder="@username или ссылка"></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;align-items:center">' +
        '<button class="btn btn-primary" onclick="saveAdminProfile()"><i class="fas fa-save" style="margin-right:6px"></i>Сохранить профиль</button>' +
        '<span id="adminProfileResult" style="font-size:0.82rem"></span>' +
      '</div>' +
    '</div>';
  }

  // ===== CHANGE PASSWORD =====
  h += '<div class="card" style="max-width:500px;margin-bottom:20px"><h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-lock" style="color:#8B5CF6;margin-right:8px"></i>Смена пароля</h3>' +
      '<p style="color:#94a3b8;font-size:0.8rem;margin-bottom:14px">Для смены пароля необходимо ввести текущий пароль.</p>' +
      '<div style="margin-bottom:12px"><label style="font-size:0.85rem;color:#94a3b8;display:block;margin-bottom:6px">Текущий пароль</label><div style="position:relative"><input class="input" type="password" id="setPwdCurrent" style="padding-right:40px"><button type="button" onclick="var i=document.getElementById(&apos;setPwdCurrent&apos;);i.type=i.type===&apos;password&apos;?&apos;text&apos;:&apos;password&apos;;this.querySelector(&apos;i&apos;).className=&apos;fas fa-&apos;+(i.type===&apos;password&apos;?&apos;eye&apos;:&apos;eye-slash&apos;)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#64748b;cursor:pointer;padding:4px"><i class="fas fa-eye"></i></button></div></div>' +
      '<div style="margin-bottom:12px"><label style="font-size:0.85rem;color:#94a3b8;display:block;margin-bottom:6px">Новый пароль</label><div style="position:relative"><input class="input" type="password" id="setPwdNew" style="padding-right:40px"><button type="button" onclick="var i=document.getElementById(&apos;setPwdNew&apos;);i.type=i.type===&apos;password&apos;?&apos;text&apos;:&apos;password&apos;;this.querySelector(&apos;i&apos;).className=&apos;fas fa-&apos;+(i.type===&apos;password&apos;?&apos;eye&apos;:&apos;eye-slash&apos;)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#64748b;cursor:pointer;padding:4px"><i class="fas fa-eye"></i></button></div></div>' +
      '<div style="margin-bottom:16px"><label style="font-size:0.85rem;color:#94a3b8;display:block;margin-bottom:6px">Подтвердите новый пароль</label><div style="position:relative"><input class="input" type="password" id="setPwdConfirm" style="padding-right:40px"><button type="button" onclick="var i=document.getElementById(&apos;setPwdConfirm&apos;);i.type=i.type===&apos;password&apos;?&apos;text&apos;:&apos;password&apos;;this.querySelector(&apos;i&apos;).className=&apos;fas fa-&apos;+(i.type===&apos;password&apos;?&apos;eye&apos;:&apos;eye-slash&apos;)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#64748b;cursor:pointer;padding:4px"><i class="fas fa-eye"></i></button></div></div>' +
      '<button class="btn btn-primary" onclick="changePassword()"><i class="fas fa-key" style="margin-right:6px"></i>Сменить пароль</button>' +
    '</div>';
  
  // DATA RESET — only for main_admin
  if (isMainAdmin) {
    // ===== PAYMENT METHODS MANAGEMENT =====
    h += '<div class="card" style="max-width:800px;margin-bottom:20px;border:1px solid rgba(59,130,246,0.3)">' +
      '<h3 style="font-weight:700;margin-bottom:16px"><i class="fas fa-credit-card" style="color:#3B82F6;margin-right:8px"></i>Способы оплаты и комиссии</h3>' +
      '<p style="color:#94a3b8;font-size:0.82rem;margin-bottom:16px">Управление способами оплаты для клиентов. Комиссия автоматически прибавляется к итоговой сумме в PDF-инвойсе.</p>';
    var pmList = ensureArray(data.paymentMethods);
    if (pmList.length > 0) {
      h += '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;margin-bottom:16px"><thead><tr style="background:#1e293b;border-bottom:2px solid #334155">' +
        '<th style="padding:10px 12px;text-align:left;color:#94a3b8">Название (RU)</th>' +
        '<th style="padding:10px 12px;text-align:left;color:#94a3b8">Название (AM)</th>' +
        '<th style="padding:10px 12px;text-align:center;color:#94a3b8">Комиссия %</th>' +
        '<th style="padding:10px 12px;text-align:center;color:#94a3b8">Порядок</th>' +
        '<th style="padding:10px 12px;width:100px"></th></tr></thead><tbody>';
      for (var pmi2 = 0; pmi2 < pmList.length; pmi2++) {
        var pm2 = pmList[pmi2];
        h += '<tr style="border-bottom:1px solid #334155">' +
          '<td style="padding:8px 12px"><input class="input" id="pm_name_ru_' + pm2.id + '" value="' + escHtml(pm2.name_ru || '') + '" style="font-size:0.82rem;padding:6px 8px"></td>' +
          '<td style="padding:8px 12px"><input class="input" id="pm_name_am_' + pm2.id + '" value="' + escHtml(pm2.name_am || '') + '" style="font-size:0.82rem;padding:6px 8px"></td>' +
          '<td style="padding:8px 12px;text-align:center"><input class="input" type="number" min="0" max="100" step="0.1" id="pm_pct_' + pm2.id + '" value="' + (pm2.commission_pct || 0) + '" style="width:80px;font-size:0.82rem;padding:6px 8px;text-align:center"></td>' +
          '<td style="padding:8px 12px;text-align:center"><input class="input" type="number" min="0" id="pm_sort_' + pm2.id + '" value="' + (pm2.sort_order || 0) + '" style="width:60px;font-size:0.82rem;padding:6px 8px;text-align:center"></td>' +
          '<td style="padding:8px 12px;text-align:center;white-space:nowrap">' +
            '<button class="btn btn-primary" style="padding:4px 10px;font-size:0.75rem;margin-right:4px" onclick="savePaymentMethod(' + pm2.id + ')"><i class="fas fa-save"></i></button>' +
            '<button class="btn btn-danger" style="padding:4px 10px;font-size:0.75rem" onclick="deletePaymentMethod(' + pm2.id + ')"><i class="fas fa-trash"></i></button>' +
          '</td></tr>';
      }
      h += '</tbody></table>';
    } else {
      h += '<div style="padding:16px;text-align:center;color:#64748b;font-size:0.85rem"><i class="fas fa-info-circle" style="margin-right:6px"></i>Нет способов оплаты. Добавьте первый.</div>';
    }
    h += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px;background:#0f172a;border-radius:8px;border:1px solid #1e293b">' +
      '<input class="input" id="new_pm_name_ru" placeholder="Название (RU)" style="flex:1;min-width:150px;font-size:0.82rem;padding:6px 8px">' +
      '<input class="input" id="new_pm_name_am" placeholder="Название (AM)" style="flex:1;min-width:150px;font-size:0.82rem;padding:6px 8px">' +
      '<input class="input" type="number" min="0" max="100" step="0.1" id="new_pm_pct" placeholder="%" style="width:70px;font-size:0.82rem;padding:6px 8px;text-align:center">' +
      '<button class="btn btn-success" style="padding:8px 16px;font-size:0.82rem;white-space:nowrap" onclick="addPaymentMethod()"><i class="fas fa-plus" style="margin-right:4px"></i>Добавить</button>' +
    '</div></div>';

    h += '<div class="card" style="max-width:800px;margin-top:24px;border:1px solid rgba(239,68,68,0.3)">' +
      '<h3 style="font-weight:700;margin-bottom:8px;color:#f87171"><i class="fas fa-exclamation-triangle" style="margin-right:8px"></i>Сброс данных</h3>' +
      '<p style="color:#94a3b8;font-size:0.85rem;margin-bottom:16px;line-height:1.5">Очистка операционных данных перед запуском. Выберите категории для удаления.</p>' +

      // — data counts preview area —
      '<div id="resetCountsArea" style="margin-bottom:20px"><button class="btn" style="background:rgba(139,92,246,0.15);color:#a78bfa;font-size:0.82rem" onclick="loadDataCounts()"><i class="fas fa-database" style="margin-right:4px"></i>Показать текущие данные перед сбросом</button></div>' +

      // — Category 1: Leads —
      '<div style="border:1px solid #334155;border-radius:10px;margin-bottom:14px;overflow:hidden">' +
        '<label style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:rgba(239,68,68,0.06);cursor:pointer;margin:0">' +
          '<input type="checkbox" id="resetLeads" style="width:18px;height:18px;accent-color:#EF4444">' +
          '<div style="flex:1"><span style="font-weight:700;color:#f87171;font-size:0.95rem">Лиды и инвойсы</span></div>' +
        '</label>' +
        '<div style="padding:10px 16px 14px;display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:0.8rem">' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">Все заявки (leads)</span></div>' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">Комментарии к лидам</span></div>' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">WB артикулы лидов</span></div>' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">Нумерация INV &rarr; с 1</span></div>' +
          '<div style="grid-column:1/-1;margin-top:6px;padding-top:6px;border-top:1px solid #1e293b"><span style="color:#10B981">&#10003;</span> <span style="color:#64748b">Калькулятор, услуги, цены, промокоды, тексты, PDF-шаблон</span></div>' +
        '</div>' +
      '</div>' +

      // — Category 2: Analytics —
      '<div style="border:1px solid #334155;border-radius:10px;margin-bottom:14px;overflow:hidden">' +
        '<label style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:rgba(245,158,11,0.06);cursor:pointer;margin:0">' +
          '<input type="checkbox" id="resetAnalytics" style="width:18px;height:18px;accent-color:#F59E0B">' +
          '<div style="flex:1"><span style="font-weight:700;color:#FBBF24;font-size:0.95rem">Аналитика</span></div>' +
        '</label>' +
        '<div style="padding:10px 16px 14px;display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:0.8rem">' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">Просмотры страниц (page_views)</span></div>' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">Логи активности</span></div>' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">Сессии сотрудников</span></div>' +
          '<div style="grid-column:1/-1;margin-top:6px;padding-top:6px;border-top:1px solid #1e293b"><span style="color:#10B981">&#10003;</span> <span style="color:#64748b">Настройки, пользователи, конфигурация</span></div>' +
        '</div>' +
      '</div>' +

      // — Category 3: Finance —
      '<div style="border:1px solid #334155;border-radius:10px;margin-bottom:14px;overflow:hidden">' +
        '<label style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:rgba(59,130,246,0.06);cursor:pointer;margin:0">' +
          '<input type="checkbox" id="resetFinance" style="width:18px;height:18px;accent-color:#3B82F6">' +
          '<div style="flex:1"><span style="font-weight:700;color:#60A5FA;font-size:0.95rem">Финансы</span></div>' +
        '</label>' +
        '<div style="padding:10px 16px 14px;display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:0.8rem">' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">Кредиты и платежи</span></div>' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">Расходы и бонусы</span></div>' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">Дивиденды</span></div>' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">Налоги и правила</span></div>' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">Основные средства</span></div>' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">P&amp;L снепшоты периодов</span></div>' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">Прочие доходы/расходы</span></div>' +
          '<div style="grid-column:1/-1;margin-top:6px;padding-top:6px;border-top:1px solid #1e293b"><span style="color:#10B981">&#10003;</span> <span style="color:#64748b">Категории расходов, роли, типы частот</span></div>' +
        '</div>' +
      '</div>' +

      // — Category 4: Promo counters —
      '<div style="border:1px solid #334155;border-radius:10px;margin-bottom:14px;overflow:hidden">' +
        '<label style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:rgba(139,92,246,0.06);cursor:pointer;margin:0">' +
          '<input type="checkbox" id="resetRefUsage" style="width:18px;height:18px;accent-color:#8B5CF6">' +
          '<div style="flex:1"><span style="font-weight:700;color:#A78BFA;font-size:0.95rem">Счётчики промокодов</span></div>' +
        '</label>' +
        '<div style="padding:10px 16px 14px;display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:0.8rem">' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">uses_count &rarr; 0</span></div>' +
          '<div><span style="color:#EF4444">&#10005;</span> <span style="color:#94a3b8">paid_uses_count &rarr; 0</span></div>' +
          '<div style="grid-column:1/-1;margin-top:6px;padding-top:6px;border-top:1px solid #1e293b"><span style="color:#10B981">&#10003;</span> <span style="color:#64748b">Сами промокоды, скидки, привязанные услуги</span></div>' +
        '</div>' +
      '</div>' +

      // — Protected data —
      '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:14px 16px;margin-bottom:20px">' +
        '<div style="font-weight:700;color:#10B981;margin-bottom:8px;font-size:0.9rem"><i class="fas fa-shield-alt" style="margin-right:6px"></i>Защищено от удаления (никогда не сбрасывается)</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 16px;font-size:0.8rem">' +
          '<div><span style="color:#10B981">&#10003;</span> <span style="color:#94a3b8">Калькулятор: вкладки</span></div>' +
          '<div><span style="color:#10B981">&#10003;</span> <span style="color:#94a3b8">Калькулятор: услуги</span></div>' +
          '<div><span style="color:#10B981">&#10003;</span> <span style="color:#94a3b8">Калькулятор: цены</span></div>' +
          '<div><span style="color:#10B981">&#10003;</span> <span style="color:#94a3b8">Тексты сайта (RU/AM)</span></div>' +
          '<div><span style="color:#10B981">&#10003;</span> <span style="color:#94a3b8">PDF шаблон</span></div>' +
          '<div><span style="color:#10B981">&#10003;</span> <span style="color:#94a3b8">Промокоды (настройки)</span></div>' +
          '<div><span style="color:#10B981">&#10003;</span> <span style="color:#94a3b8">Telegram кнопки</span></div>' +
          '<div><span style="color:#10B981">&#10003;</span> <span style="color:#94a3b8">Пользователи / Роли</span></div>' +
          '<div><span style="color:#10B981">&#10003;</span> <span style="color:#94a3b8">Блоки сайта / Фото</span></div>' +
          '<div><span style="color:#10B981">&#10003;</span> <span style="color:#94a3b8">Скрипты</span></div>' +
          '<div><span style="color:#10B981">&#10003;</span> <span style="color:#94a3b8">Футер / Слоты</span></div>' +
          '<div><span style="color:#10B981">&#10003;</span> <span style="color:#94a3b8">Категории расходов</span></div>' +
        '</div>' +
      '</div>' +

      // — Confirm —
      '<div style="border-top:2px solid rgba(239,68,68,0.3);padding-top:16px">' +
        '<p style="color:#f87171;font-size:0.85rem;font-weight:700;margin-bottom:12px"><i class="fas fa-lock" style="margin-right:6px"></i>Действие необратимо! Код подтверждения: <code style="background:#1e293b;padding:2px 8px;border-radius:4px;color:#FBBF24;letter-spacing:2px">RESET-CONFIRM</code></p>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
          '<input class="input" id="resetConfirmCode" placeholder="Введите код..." style="max-width:220px;font-family:monospace;letter-spacing:1px">' +
          '<button class="btn" style="background:#EF4444;color:white;font-weight:700" onclick="executeDataReset()"><i class="fas fa-trash-alt" style="margin-right:6px"></i>Выполнить сброс</button>' +
        '</div>' +
        '<div id="resetResult" style="margin-top:12px"></div>' +
      '</div>' +
    '</div>';
  }
  
  h += '</div>';
  return h;
}

async function changePassword() {
  const cur = document.getElementById('setPwdCurrent').value;
  const nw = document.getElementById('setPwdNew').value;
  const cf = document.getElementById('setPwdConfirm').value;
  if (!cur || !nw) { toast('Заполните все поля', 'error'); return; }
  if (nw !== cf) { toast('Пароли не совпадают', 'error'); return; }
  if (nw.length < 4) { toast('Пароль слишком короткий (мин. 4 символа)', 'error'); return; }
  const res = await api('/change-password', { method: 'POST', body: JSON.stringify({ current_password: cur, new_password: nw }) });
  if (res && res.success) { 
    toast('Пароль изменён');
    document.getElementById('setPwdCurrent').value = '';
    document.getElementById('setPwdNew').value = '';
    document.getElementById('setPwdConfirm').value = '';
  } else { toast(res?.error || 'Ошибка', 'error'); }
}

async function saveAdminProfile() {
  var name = (document.getElementById('adminProfileName')?.value || '').trim();
  var login = (document.getElementById('adminProfileLogin')?.value || '').trim();
  var phone = (document.getElementById('adminProfilePhone')?.value || '').trim();
  var tg = (document.getElementById('adminProfileTelegram')?.value || '').trim();
  if (!name) { toast('Имя не может быть пустым', 'error'); return; }
  if (!login || login.length < 2) { toast('Логин минимум 2 символа', 'error'); return; }
  var res = await api('/admin-profile', { method: 'PUT', body: JSON.stringify({ display_name: name, username: login, phone: phone, telegram_link: tg }) });
  if (res && res.success) {
    toast('Профиль сохранён');
    // Refresh user data
    data.users = ensureArray(await api('/users'));
    var resultEl = document.getElementById('adminProfileResult');
    if (resultEl) resultEl.innerHTML = '<span style="color:#10B981"><i class="fas fa-check"></i> Сохранено</span>';
    setTimeout(function() { if (resultEl) resultEl.innerHTML = ''; }, 3000);
  } else { toast(res?.error || 'Ошибка сохранения', 'error'); }
}

// ===== PAYMENT METHODS CRUD =====
async function addPaymentMethod() {
  var nameRu = document.getElementById('new_pm_name_ru').value.trim();
  var nameAm = document.getElementById('new_pm_name_am').value.trim();
  var pct = parseFloat(document.getElementById('new_pm_pct').value) || 0;
  if (!nameRu) { toast('Введите название', 'error'); return; }
  var sortOrder = ensureArray(data.paymentMethods).length + 1;
  await api('/payment-methods', { method: 'POST', body: JSON.stringify({ name_ru: nameRu, name_am: nameAm || nameRu, commission_pct: pct, sort_order: sortOrder }) });
  toast('Способ оплаты добавлен');
  try { var pmData = await api('/payment-methods'); data.paymentMethods = (pmData && pmData.methods) || []; } catch(e) { }
  render();
}

async function savePaymentMethod(id) {
  var nameRu = document.getElementById('pm_name_ru_' + id).value.trim();
  var nameAm = document.getElementById('pm_name_am_' + id).value.trim();
  var pct = parseFloat(document.getElementById('pm_pct_' + id).value) || 0;
  var sort = parseInt(document.getElementById('pm_sort_' + id).value) || 0;
  await api('/payment-methods/' + id, { method: 'PUT', body: JSON.stringify({ name_ru: nameRu, name_am: nameAm, commission_pct: pct, sort_order: sort, is_active: 1 }) });
  toast('Сохранено');
  try { var pmData = await api('/payment-methods'); data.paymentMethods = (pmData && pmData.methods) || []; } catch(e) { }
  render();
}

async function deletePaymentMethod(id) {
  if (!confirm('Удалить этот способ оплаты?')) return;
  await api('/payment-methods/' + id, { method: 'DELETE' });
  toast('Способ оплаты удалён');
  try { var pmData = await api('/payment-methods'); data.paymentMethods = (pmData && pmData.methods) || []; } catch(e) { }
  render();
}

async function loadDataCounts() {
  var area = document.getElementById('resetCountsArea');
  area.innerHTML = '<span style="color:#94a3b8;font-size:0.82rem"><i class="fas fa-spinner fa-spin"></i> Загрузка...</span>';
  var res = await api('/data-counts');
  if (!res || res.error) { area.innerHTML = '<span style="color:#f87171">Ошибка: ' + (res?.error || 'нет данных') + '</span>'; return; }
  var l = res.leads || {};
  var a = res.analytics || {};
  var f = res.finance || {};
  var r = res.referrals || {};
  area.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">' +
    '<div style="background:rgba(239,68,68,0.08);padding:10px 14px;border-radius:8px;border:1px solid rgba(239,68,68,0.15)"><div style="font-size:0.7rem;color:#f87171">Лиды</div><div style="font-size:1.3rem;font-weight:800;color:#f87171">' + (l.leads||0) + '</div><div style="font-size:0.68rem;color:#64748b">' + (l.comments||0) + ' комм. / ' + (l.articles||0) + ' арт.</div></div>' +
    '<div style="background:rgba(245,158,11,0.08);padding:10px 14px;border-radius:8px;border:1px solid rgba(245,158,11,0.15)"><div style="font-size:0.7rem;color:#FBBF24">Просмотры</div><div style="font-size:1.3rem;font-weight:800;color:#FBBF24">' + (a.page_views||0) + '</div><div style="font-size:0.68rem;color:#64748b">' + (a.activity_logs||0) + ' лог / ' + (a.sessions||0) + ' сесс.</div></div>' +
    '<div style="background:rgba(59,130,246,0.08);padding:10px 14px;border-radius:8px;border:1px solid rgba(59,130,246,0.15)"><div style="font-size:0.7rem;color:#60A5FA">Финансы</div><div style="font-size:1.3rem;font-weight:800;color:#60A5FA">' + ((f.loans||0)+(f.expenses||0)+(f.dividends||0)+(f.tax_payments||0)+(f.assets||0)) + '</div><div style="font-size:0.68rem;color:#64748b">' + (f.loans||0) + ' кр. / ' + (f.expenses||0) + ' расх. / ' + (f.snapshots||0) + ' P&L</div></div>' +
    '<div style="background:rgba(139,92,246,0.08);padding:10px 14px;border-radius:8px;border:1px solid rgba(139,92,246,0.15)"><div style="font-size:0.7rem;color:#A78BFA">Промокоды</div><div style="font-size:1.3rem;font-weight:800;color:#A78BFA">' + (r.total_uses||0) + '</div><div style="font-size:0.68rem;color:#64748b">общих использ.</div></div>' +
  '</div>';
}

async function executeDataReset() {
  var code = document.getElementById('resetConfirmCode').value.trim();
  if (code !== 'RESET-CONFIRM') {
    toast('Введите код подтверждения: RESET-CONFIRM', 'error');
    return;
  }
  var targets = [];
  if (document.getElementById('resetLeads').checked) targets.push('leads');
  if (document.getElementById('resetAnalytics').checked) targets.push('analytics');
  if (document.getElementById('resetFinance').checked) targets.push('finance');
  if (document.getElementById('resetRefUsage').checked) targets.push('referrals_usage');
  
  if (targets.length === 0) {
    toast('Выберите хотя бы одну категорию для сброса', 'error');
    return;
  }
  
  // Build detailed confirmation message without \\\\n (template literal safe)
  var msg = 'ВНИМАНИЕ! Будут УДАЛЕНЫ данные:';
  if (targets.includes('leads')) msg += ' | Лиды, комментарии, артикулы WB';
  if (targets.includes('analytics')) msg += ' | Просмотры, логи, сессии';
  if (targets.includes('finance')) msg += ' | Кредиты, расходы, дивиденды, налоги, P&L';
  if (targets.includes('referrals_usage')) msg += ' | Счётчики промокодов';
  msg += ' | Это действие НЕОБРАТИМО. Продолжить?';
  if (!confirm(msg)) return;
  
  var resultDiv = document.getElementById('resetResult');
  resultDiv.innerHTML = '<span style="color:#FBBF24"><i class="fas fa-spinner fa-spin"></i> Выполняется сброс...</span>';
  
  var res = await api('/data-reset', { method: 'POST', body: JSON.stringify({ targets: targets, confirm_code: code }) });
  
  if (res && res.success) {
    resultDiv.innerHTML = '<div style="background:rgba(16,185,129,0.1);padding:12px;border-radius:8px;border:1px solid rgba(16,185,129,0.3)">' +
      res.results.map(function(r) { return '<div style="color:#10B981;font-size:0.85rem;margin-bottom:4px">' + r + '</div>'; }).join('') +
      '</div>';
    toast('Сброс выполнен успешно', 'success');
    // Reset checkboxes
    document.getElementById('resetConfirmCode').value = '';
    ['resetLeads','resetAnalytics','resetFinance','resetRefUsage'].forEach(function(id) { var el = document.getElementById(id); if (el) el.checked = false; });
    // Refresh counts
    setTimeout(loadDataCounts, 500);
    // Reload leads data
    setTimeout(async function() {
      try {
        var bulk = await api('/bulk-data');
        if (bulk) {
          data.leads = bulk.leads || { leads: [], total: 0 };
          data.referrals = bulk.referrals || [];
        }
      } catch(e) {}
    }, 1000);
  } else {
    resultDiv.innerHTML = '<div style="color:#f87171;font-size:0.85rem">' + (res?.error || 'Ошибка при сбросе') + '</div>';
    toast(res?.error || 'Ошибка при сбросе', 'error');
  }
}


`;
