/**
 * Admin Panel — Leads CRM, comments, articles, calc modal
 * 1191 lines of admin SPA JS code
 */
export const CODE: string = `
// ===== LEADS / CRM =====
let leadsFilter = { status: 'all', source: 'all', search: '', assignee: 'all' };

function renderLeads() {
  var leads = (data.leads && data.leads.leads) ? data.leads.leads : [];
  var total = (data.leads && data.leads.total) ? data.leads.total : 0;
  
  // --- Analytics mini-dashboard with per-status sums + services/articles/packages split ---
  var stats = { new: {c:0,a:0,svc:0,art:0,pkg:0,disc:0}, contacted: {c:0,a:0,svc:0,art:0,pkg:0,disc:0}, in_progress: {c:0,a:0,svc:0,art:0,pkg:0,disc:0}, checking: {c:0,a:0,svc:0,art:0,pkg:0,disc:0}, done: {c:0,a:0,svc:0,art:0,pkg:0,disc:0}, rejected: {c:0,a:0,svc:0,art:0,pkg:0,disc:0} };
  var totalAmount = 0;
  for (var ai = 0; ai < leads.length; ai++) {
    var al = leads[ai];
    var st = al.status || 'new';
    if (!stats[st]) stats[st] = {c:0,a:0,svc:0,art:0,pkg:0,disc:0};
    stats[st].c++;
    // Split services vs articles vs packages from calc_data
    var cd = null;
    if (al.calc_data) { try { cd = JSON.parse(al.calc_data); } catch(e) {} }
    var leadSvc = 0, leadArt = 0, leadPkg = 0, leadDisc = 0;
    if (cd) {
      if (cd.servicesSubtotal !== undefined && cd.articlesSubtotal !== undefined) {
        leadSvc = Number(cd.servicesSubtotal || 0);
        leadArt = Number(cd.articlesSubtotal || 0);
      } else if (cd.items) {
        for (var ci = 0; ci < cd.items.length; ci++) {
          var it = cd.items[ci];
          if (it.wb_article) { leadArt += Number(it.subtotal||0); }
          else { leadSvc += Number(it.subtotal||0); }
        }
      }
      if (cd.package && cd.package.package_price) {
        leadPkg = Number(cd.package.package_price || 0);
      }
      if (cd.discountAmount) {
        leadDisc = Number(cd.discountAmount || 0);
      }
    }
    stats[st].svc += Math.max(0, leadSvc - leadDisc);
    stats[st].art += leadArt;
    stats[st].pkg += leadPkg;
    stats[st].disc += leadDisc;
    // Total = total_amount from DB = real client payment
    var amt = Number(al.total_amount || 0);
    stats[st].a += amt;
    totalAmount += amt;
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
  
  var fmtA = function(n) { return n > 0 ? Number(n).toLocaleString('ru-RU') + '\\\\u00a0֏' : '—'; };
  
  var h = '<div style="padding:32px">';
  // Header
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">' +
    '<div><h1 style="font-size:1.8rem;font-weight:800"><i class="fas fa-users" style="color:#8B5CF6;margin-right:10px"></i>Лиды / CRM</h1>' +
    '<p style="color:#94a3b8;margin-top:4px">Всего: <strong>' + total + '</strong> | Показано: <strong>' + filtered.length + '</strong></p></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-success" onclick="showCreateLeadModal()"><i class="fas fa-plus" style="margin-right:4px"></i>Новый лид</button>' +
      '<button class="btn btn-primary" onclick="navigate(&apos;analytics&apos;)"><i class="fas fa-chart-bar" style="margin-right:4px"></i>Аналитика</button>' +
      '<button class="btn btn-outline" onclick="loadLeadsData()"><i class="fas fa-sync-alt" style="margin-right:4px"></i>Обновить</button>' +
      '<a href="/api/admin/leads/export" target="_blank" class="btn btn-outline" style="text-decoration:none"><i class="fas fa-download" style="margin-right:6px"></i>CSV</a>' +
    '</div></div>';
  
  // KPI cards — 6 statuses + Total
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin-bottom:20px">';
  // 1. Новые
  h += '<div class="stat-card" style="cursor:pointer;padding:14px;background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.04));border-color:rgba(16,185,129,0.25)" onclick="setLeadsFilter(&apos;status&apos;,&apos;new&apos;)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:1.6rem;font-weight:900;color:#10B981">' + stats.new.c + '</span><span style="font-size:1.4rem">🟢</span></div>' +
    '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">Новые лиды</div>' +
    '<div style="color:#34d399;font-size:0.82rem;font-weight:700;margin-top:2px">' + fmtA(stats.new.a) + '</div></div>';
  // 2. На связи
  h += '<div class="stat-card" style="cursor:pointer;padding:14px;background:linear-gradient(135deg,rgba(59,130,246,0.12),rgba(59,130,246,0.04));border-color:rgba(59,130,246,0.25)" onclick="setLeadsFilter(&apos;status&apos;,&apos;contacted&apos;)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:1.6rem;font-weight:900;color:#3B82F6">' + stats.contacted.c + '</span><span style="font-size:1.4rem">💬</span></div>' +
    '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">На связи</div>' +
    '<div style="color:#60a5fa;font-size:0.82rem;font-weight:700;margin-top:2px">' + fmtA(stats.contacted.a) + '</div></div>';
  // 3. В работе — total at top, services and articles below
  h += '<div class="stat-card" style="cursor:pointer;padding:14px;background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.04));border-color:rgba(245,158,11,0.25)" onclick="setLeadsFilter(&apos;status&apos;,&apos;in_progress&apos;)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:1.6rem;font-weight:900;color:#F59E0B">' + stats.in_progress.c + '</span><span style="font-size:1.4rem">🔄</span></div>' +
    '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">В работе</div>' +
    '<div style="color:#fbbf24;font-size:0.88rem;font-weight:700;margin-top:2px">' + fmtA(stats.in_progress.a) + '</div>' +
    '<div style="margin-top:4px;font-size:0.7rem;color:#94a3b8"><span style="color:#a78bfa">Усл: ' + fmtA(stats.in_progress.svc) + '</span>' + (stats.in_progress.disc > 0 ? ' <span style="color:#EF4444;font-size:0.6rem">(-' + fmtA(stats.in_progress.disc) + ' скидка)</span>' : '') + '<br><span style="color:#fb923c">Зак: ' + fmtA(stats.in_progress.art) + '</span>' + (stats.in_progress.pkg > 0 ? '<br><span style="color:#FBBF24">Пак: ' + fmtA(stats.in_progress.pkg) + '</span>' : '') + '</div></div>';
  // 4. Отклонен
  h += '<div class="stat-card" style="cursor:pointer;padding:14px;background:linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.04));border-color:rgba(239,68,68,0.25)" onclick="setLeadsFilter(&apos;status&apos;,&apos;rejected&apos;)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:1.6rem;font-weight:900;color:#EF4444">' + stats.rejected.c + '</span><span style="font-size:1.4rem">❌</span></div>' +
    '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">Отклонён</div>' +
    '<div style="color:#f87171;font-size:0.82rem;font-weight:700;margin-top:2px">' + fmtA(stats.rejected.a) + '</div></div>';
  // 5. Проверка
  h += '<div class="stat-card" style="cursor:pointer;padding:14px;background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(139,92,246,0.04));border-color:rgba(139,92,246,0.25)" onclick="setLeadsFilter(&apos;status&apos;,&apos;checking&apos;)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:1.6rem;font-weight:900;color:#8B5CF6">' + stats.checking.c + '</span><span style="font-size:1.4rem">🔍</span></div>' +
    '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">Проверка</div>' +
    '<div style="color:#a78bfa;font-size:0.82rem;font-weight:700;margin-top:2px">' + fmtA(stats.checking.a) + '</div></div>';
  // 6. Завершён — total (turnover) at top, services and articles below
  h += '<div class="stat-card" style="cursor:pointer;padding:14px;background:linear-gradient(135deg,rgba(16,185,129,0.2),rgba(16,185,129,0.08));border-color:rgba(16,185,129,0.4)" onclick="setLeadsFilter(&apos;status&apos;,&apos;done&apos;)">' +
    '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:1.6rem;font-weight:900;color:#10B981">' + stats.done.c + '</span><span style="font-size:1.4rem">✅</span></div>' +
    '<div style="color:#94a3b8;font-size:0.75rem;margin-top:4px">Завершён</div>' +
    '<div style="color:#34d399;font-size:0.88rem;font-weight:700;margin-top:2px">' + fmtA(stats.done.a) + '</div>' +
    '<div style="margin-top:4px;font-size:0.7rem;color:#94a3b8"><span style="color:#a78bfa">Усл: ' + fmtA(stats.done.svc) + '</span>' + (stats.done.disc > 0 ? ' <span style="color:#EF4444;font-size:0.6rem">(-' + fmtA(stats.done.disc) + ' скидка)</span>' : '') + '<br><span style="color:#fb923c">Зак: ' + fmtA(stats.done.art) + '</span>' + (stats.done.pkg > 0 ? '<br><span style="color:#FBBF24">Пак: ' + fmtA(stats.done.pkg) + '</span>' : '') + '</div></div>';
  h += '</div>';
  
  // Filters row — 6 statuses only
  h += '<div class="card" style="padding:14px;margin-bottom:20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
    '<i class="fas fa-filter" style="color:#64748b"></i>' +
    '<select class="input" style="width:150px;padding:6px 10px;font-size:0.82rem" onchange="setLeadsFilter(&apos;status&apos;,this.value)">' +
      '<option value="all"' + (leadsFilter.status==='all'?' selected':'') + '>Все статусы</option>' +
      '<option value="new"' + (leadsFilter.status==='new'?' selected':'') + '>🟢 Новые лиды</option>' +
      '<option value="contacted"' + (leadsFilter.status==='contacted'?' selected':'') + '>💬 На связи</option>' +
      '<option value="in_progress"' + (leadsFilter.status==='in_progress'?' selected':'') + '>🔄 В работе</option>' +
      '<option value="rejected"' + (leadsFilter.status==='rejected'?' selected':'') + '>❌ Отклонён</option>' +
      '<option value="checking"' + (leadsFilter.status==='checking'?' selected':'') + '>🔍 Проверка</option>' +
      '<option value="done"' + (leadsFilter.status==='done'?' selected':'') + '>✅ Завершён</option></select>' +
    '<select class="input" style="width:150px;padding:6px 10px;font-size:0.82rem" onchange="setLeadsFilter(&apos;source&apos;,this.value)">' +
      '<option value="all"' + (leadsFilter.source==='all'?' selected':'') + '>Все источники</option>' +
      '<option value="form"' + (leadsFilter.source==='form'?' selected':'') + '>Форма</option>' +
      '<option value="popup"' + (leadsFilter.source==='popup'?' selected':'') + '>Попап</option>' +
      '<option value="calculator_pdf"' + (leadsFilter.source==='calculator_pdf'?' selected':'') + '>Калькулятор</option>' +
      '<option value="manual"' + (leadsFilter.source==='manual'?' selected':'') + '>Ручной</option>' +
      '<option value="admin_panel"' + (leadsFilter.source==='admin_panel'?' selected':'') + '>Админ-панель</option></select>' +
    '<select class="input" style="width:170px;padding:6px 10px;font-size:0.82rem" onchange="setLeadsFilter(&apos;assignee&apos;,this.value)">' +
      '<option value="all"' + (leadsFilter.assignee==='all'?' selected':'') + '>Все ответственные</option>' +
      '<option value=""' + (leadsFilter.assignee===''?' selected':'') + '>Не назначен</option>';
  for (var ui = 0; ui < ensureArray(data.users).length; ui++) {
    var usr = data.users[ui];
    h += '<option value="' + usr.id + '"' + (leadsFilter.assignee===String(usr.id)?' selected':'') + '>' + escHtml(usr.display_name) + '</option>';
  }
  h += '</select>' +
    '<input class="input" style="flex:1;min-width:180px;padding:6px 10px;font-size:0.82rem" placeholder="Поиск по имени, контакту, #id..." value="' + escHtml(leadsFilter.search) + '" oninput="setLeadsFilter(&apos;search&apos;,this.value)">' +
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
              (l.lang ? '<span class="badge" style="background:' + (l.lang === 'am' ? 'rgba(249,115,22,0.15);color:#fb923c' : 'rgba(59,130,246,0.15);color:#60a5fa') + ';font-size:0.7rem;font-weight:700">' + (l.lang === 'am' ? '🇦🇲 AM' : '🇷🇺 RU') + '</span>' : '') +
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
          '</div>';
      // ALWAYS recalculate discount from services only (never trust stale calcData.discountAmount)
      var discPct = Number(calcData && calcData.discountPercent || 0);
      // FALLBACK: if discountPercent is 0 but lead has a referral code, look up from data.referrals
      if (discPct === 0 && l.referral_code && data.referrals) {
        var refMatch = data.referrals.find(function(r) { return r.code && r.code.toUpperCase() === l.referral_code.toUpperCase(); });
        if (refMatch) discPct = Number(refMatch.discount_percent || 0);
      }
      var discAmt = (discPct > 0 && l.referral_code) ? Math.round(svcAmt * discPct / 100) : 0;
      // Payment method info for card summary — use saved commission_amount for accuracy
      var cardPmMatch = ensureArray(data.paymentMethods).find(function(m) { return m.id == l.payment_method_id; });
      var cardPmComm = Number(l.commission_amount || 0);
      h += ((svcAmt > 0 || artAmt > 0 || discAmt > 0 || cardPmMatch) ? '<div style="display:flex;gap:10px;margin-top:6px;flex-wrap:wrap">' +
              (svcAmt > 0 ? '<span style="font-size:0.72rem;color:#a78bfa;font-weight:600"><i class="fas fa-calculator" style="margin-right:3px"></i>Усл: ' + Number(svcAmt).toLocaleString('ru-RU') + ' ֏</span>' : '') +
              (artAmt > 0 ? '<span style="font-size:0.72rem;color:#fb923c;font-weight:600"><i class="fas fa-box" style="margin-right:3px"></i>Зак: ' + Number(artAmt).toLocaleString('ru-RU') + ' ֏</span>' : '') +
              (discAmt > 0 ? '<span style="font-size:0.72rem;color:#8B5CF6;font-weight:600"><i class="fas fa-gift" style="margin-right:3px"></i>Скидка: -' + Number(discAmt).toLocaleString('ru-RU') + ' ֏ (' + discPct + '%)</span>' : '') +
              (refundAmt > 0 ? '<span style="font-size:0.72rem;color:#f87171;font-weight:600"><i class="fas fa-undo-alt" style="margin-right:3px"></i>Возврат: -' + Number(refundAmt).toLocaleString('ru-RU') + ' ֏</span>' : '') +
              (l.referral_code ? '<span style="font-size:0.72rem;color:#10B981;font-weight:600"><i class="fas fa-tag" style="margin-right:3px"></i>' + escHtml(l.referral_code) + '</span>' : '') +
              (cardPmMatch ? '<span style="font-size:0.72rem;color:#3B82F6;font-weight:600"><i class="fas fa-credit-card" style="margin-right:3px"></i>' + escHtml(cardPmMatch.name_ru) + (cardPmComm > 0 ? ' +' + Number(cardPmComm).toLocaleString('ru-RU') + ' ֏' : '') + '</span>' : '') +
            '</div>' : '');
      
      // Right side: status + total + date + actions
      h += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:200px">';
      
      var leadCommission = Number(l.commission_amount || 0);
      var leadFinalTotal = leadAmt + leadCommission;
      h += '<div id="lead-total-' + l.id + '">';
      if (leadAmt > 0) {
        if (leadCommission > 0) {
          h += '<div style="text-align:right">' +
            '<div style="font-size:0.72rem;color:#64748b;text-decoration:line-through">' + Number(leadAmt).toLocaleString('ru-RU') + ' ֏</div>' +
            '<div style="font-size:1.3rem;font-weight:900;color:#22C55E;white-space:nowrap">' + Number(leadFinalTotal).toLocaleString('ru-RU') + '&nbsp;֏</div>' +
            '<div style="font-size:0.68rem;color:#3B82F6;font-weight:600">+' + Number(leadCommission).toLocaleString('ru-RU') + ' ֏ комиссия</div></div>';
        } else {
          h += '<div style="font-size:1.3rem;font-weight:900;color:#8B5CF6;white-space:nowrap">' + Number(leadAmt).toLocaleString('ru-RU') + '&nbsp;֏</div>';
        }
      }
      h += '</div>';
      
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
      for (var uj = 0; uj < ensureArray(data.users).length; uj++) {
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

      // --- 1b. PRODUCT, SERVICE & CLIENT COMMENT (from contact form) ---
      h += '<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div><div style="font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:6px"><i class="fas fa-box" style="margin-right:4px;color:#fb923c"></i>Товар (WB):</div>' +
        '<input class="input" id="lead-product-' + l.id + '" value="' + escHtml(l.product||'') + '" style="font-size:0.85rem;padding:8px" placeholder="Не указано"></div>' +
        '<div><div style="font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:6px"><i class="fas fa-concierge-bell" style="margin-right:4px;color:#60a5fa"></i>Интересует:</div>' +
        '<input class="input" id="lead-service-' + l.id + '" value="' + escHtml(l.service||'') + '" style="font-size:0.85rem;padding:8px" placeholder="Не указано" readonly></div></div>';
      if (l.message) {
        h += '<div style="margin-top:10px">' +
          '<div style="font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:6px"><i class="fas fa-comment-alt" style="margin-right:4px;color:#c084fc"></i>Комментарий клиента:</div>' +
          '<div style="font-size:0.85rem;color:#cbd5e1;padding:10px 14px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.15);border-radius:8px;line-height:1.5;white-space:pre-wrap">' + escHtml(l.message) + '</div></div>';
      }

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

      // --- 2.7. PAYMENT METHOD (commission) ---
      var pmId = l.payment_method_id || '';
      var pmMethods = ensureArray(data.paymentMethods);
      h += '<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div><div style="font-size:0.78rem;font-weight:600;color:#94a3b8;margin-bottom:6px"><i class="fas fa-credit-card" style="margin-right:4px;color:#3B82F6"></i>Способ оплаты:</div>' +
        '<select class="input" id="lead-pm-' + l.id + '" style="font-size:0.85rem;padding:8px;border-color:rgba(59,130,246,0.3)" onchange="applyPaymentMethod(' + l.id + ')">' +
        '<option value="">— Не выбран —</option>';
      for (var pmi = 0; pmi < pmMethods.length; pmi++) {
        var pm = pmMethods[pmi];
        h += '<option value="' + pm.id + '"' + (pmId == pm.id ? ' selected' : '') + '>' + escHtml(pm.name_ru) + ' (' + pm.commission_pct + '%)</option>';
      }
      h += '</select></div>';
      // Commission preview
      var pmMatch = pmMethods.find(function(m) { return m.id == pmId; });
      var pmPct = pmMatch ? Number(pmMatch.commission_pct) : 0;
      var pmBase = Number(l.total_amount || 0);
      var pmCommission = pmPct > 0 ? Math.round(pmBase * pmPct / 100) : 0;
      var pmFinal = pmBase + pmCommission;
      h += '<div id="lead-pm-preview-' + l.id + '" style="display:flex;align-items:flex-end">';
      if (pmMatch) {
        h += '<div style="font-size:0.78rem;padding:8px;line-height:1.6">' +
          '<div style="color:#64748b">Сумма заказа: <span style="color:#e2e8f0;font-weight:600">' + Number(pmBase).toLocaleString('ru-RU') + ' ֏</span></div>' +
          '<div style="color:#3B82F6;font-weight:600">Комиссия ' + pmPct + '%: +' + Number(pmCommission).toLocaleString('ru-RU') + ' ֏</div>' +
          '<div style="color:#22C55E;font-weight:700">К оплате: ' + Number(pmFinal).toLocaleString('ru-RU') + ' ֏</div></div>';
      } else {
        h += '<div style="font-size:0.78rem;color:#64748b;padding:8px">Выберите способ оплаты для расчёта комиссии</div>';
      }
      h += '</div></div>';

      // --- 3. NOTES (at top, above services) ---
      h += '<div style="margin-top:10px;border-top:1px solid #334155;padding-top:10px">' +
        '<div style="font-size:0.78rem;font-weight:600;color:#fbbf24;margin-bottom:6px"><i class="fas fa-sticky-note" style="margin-right:4px"></i>Заметка:</div>' +
        '<textarea class="input" id="lead-notes-' + l.id + '" style="min-height:40px;font-size:0.82rem;padding:8px" placeholder="Добавить заметку о клиенте...">' + escHtml(l.notes||'') + '</textarea></div>';

      // --- 3b. REFERRAL CODE ---
      var leadRefCode = l.referral_code || '';
      h += '<div style="margin-top:10px;border-top:1px solid #334155;padding-top:10px">' +
        '<div style="font-size:0.78rem;font-weight:600;color:#10B981;margin-bottom:6px"><i class="fas fa-tag" style="margin-right:4px"></i>Реферальный код:</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        '<input class="input" id="lead-refcode-' + l.id + '" value="' + escHtml(leadRefCode) + '" style="font-size:0.85rem;padding:8px;flex:1;border-color:rgba(16,185,129,0.3)" placeholder="Введите промокод...">' +
        '<button class="btn btn-success" style="padding:6px 14px;font-size:0.78rem;white-space:nowrap" onclick="applyLeadRefCode(' + l.id + ')"><i class="fas fa-check" style="margin-right:4px"></i>Применить</button>' +
        (leadRefCode ? '<button class="btn" style="padding:6px 14px;font-size:0.78rem;white-space:nowrap;background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3)" onclick="removeLeadRefCode(' + l.id + ')"><i class="fas fa-times" style="margin-right:4px"></i>Отменить</button>' : '') +
        '</div>';
      if (leadRefCode) {
        // Show discount breakdown — ALWAYS recalculate from services to ensure correctness
        var refDiscPct = Number(calcData && calcData.discountPercent || 0);
        // FALLBACK: look up from data.referrals if calc_data has no discountPercent
        if (refDiscPct === 0 && data.referrals) {
          var refMatch2 = data.referrals.find(function(r) { return r.code && r.code.toUpperCase() === leadRefCode.toUpperCase(); });
          if (refMatch2) refDiscPct = Number(refMatch2.discount_percent || 0);
        }
        var refSvcBase = svcAmt || Number(calcData && calcData.servicesSubtotal || 0);
        // Recalculate discount from services base (never trust stored discountAmount — may be stale)
        var refDiscAmt = refDiscPct > 0 ? Math.round(refSvcBase * refDiscPct / 100) : 0;
        var svcAfterDisc = refSvcBase - refDiscAmt;
        h += '<div id="lead-refcode-info-' + l.id + '" style="margin-top:6px;padding:10px 12px;background:#0f2d1f;border:1px solid rgba(16,185,129,0.2);border-radius:8px;font-size:0.78rem;color:#6ee7b7">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span><i class="fas fa-check-circle" style="margin-right:4px"></i>Код «' + escHtml(leadRefCode) + '» применён</span>' +
          (refDiscPct > 0 ? '<span class="badge badge-green" style="font-size:0.72rem">-' + refDiscPct + '%</span>' : '') + '</div>';
        if (refDiscAmt > 0) {
          h += '<div style="margin-top:6px;padding:8px;background:rgba(0,0,0,0.15);border-radius:6px;font-size:0.72rem;line-height:1.6">' +
            '<div style="display:flex;justify-content:space-between"><span style="color:#94a3b8">Подитог услуг:</span><span>' + Number(refSvcBase).toLocaleString('ru-RU') + ' ֏</span></div>' +
            '<div style="display:flex;justify-content:space-between;color:#a78bfa"><span>Скидка ' + refDiscPct + '% на услуги:</span><span style="font-weight:700">-' + Number(refDiscAmt).toLocaleString('ru-RU') + ' ֏</span></div>' +
            '<div style="display:flex;justify-content:space-between;font-weight:700;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px;margin-top:4px"><span>Услуги со скидкой:</span><span style="color:#10B981">' + Number(svcAfterDisc).toLocaleString('ru-RU') + ' ֏</span></div>' +
          '</div>';
        }
        h += '</div>';
      } else {
        h += '<div id="lead-refcode-info-' + l.id + '"></div>';
      }
      h += '</div>';

      // --- 4. SERVICES — collapsible with total shown when closed ---
      var svcTotal = 0;
      for (var si3 = 0; si3 < serviceItems.length; si3++) { svcTotal += Number(serviceItems[si3].subtotal || 0); }
      var leadDiscPct2 = Number(calcData && calcData.discountPercent || 0);
      // FALLBACK: look up from data.referrals if calc_data has no discountPercent
      if (leadDiscPct2 === 0 && l.referral_code && data.referrals) {
        var refMatch3 = data.referrals.find(function(r) { return r.code && r.code.toUpperCase() === l.referral_code.toUpperCase(); });
        if (refMatch3) leadDiscPct2 = Number(refMatch3.discount_percent || 0);
      }
      // Recalculate discount from actual services total
      var leadDiscAmt2 = leadDiscPct2 > 0 && l.referral_code ? Math.round(svcTotal * leadDiscPct2 / 100) : 0;
      var svcAfterDisc2 = leadDiscAmt2 > 0 ? (svcTotal - leadDiscAmt2) : svcTotal;
      h += '<div style="margin-top:10px;border-top:1px solid #334155;padding-top:10px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleSection(&apos;svc-body-' + l.id + '&apos;,&apos;svc-arrow-' + l.id + '&apos;)">' +
        '<span style="font-size:0.85rem;font-weight:700;color:#a78bfa"><i class="fas fa-calculator" style="margin-right:6px"></i>Услуги (' + serviceItems.length + ') — ' +
        (leadDiscAmt2 > 0 ? '<span style="text-decoration:line-through;color:#64748b;font-weight:400;margin-right:4px">' + Number(svcTotal).toLocaleString('ru-RU') + '</span><span style="color:#10B981">' + Number(svcAfterDisc2).toLocaleString('ru-RU') + '&nbsp;֏</span> <span style="color:#8B5CF6;font-size:0.72rem;font-weight:400">(-' + leadDiscPct2 + '%)</span>' : '<span style="color:#8B5CF6">' + Number(svcTotal).toLocaleString('ru-RU') + '&nbsp;֏</span>') +
        '</span>' +
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
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn-outline" onclick="this.closest(&apos;[style*=fixed]&apos;).remove()">Отмена</button><button type="submit" class="btn btn-primary"><i class="fas fa-check" style="margin-right:6px"></i>Создать</button></div>' +
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

async function applyLeadRefCode(leadId) {
  var codeInput = document.getElementById('lead-refcode-' + leadId);
  var infoDiv = document.getElementById('lead-refcode-info-' + leadId);
  if (!codeInput) return;
  var code = codeInput.value.trim();
  if (!code) { toast('Введите промокод', 'error'); return; }
  
  // Validate code against referral_codes
  var res = await api('/referral-codes/check?code=' + encodeURIComponent(code));
  if (!res || !res.valid) {
    if (infoDiv) infoDiv.innerHTML = '<div style="padding:8px;background:#2d1f1f;border:1px solid rgba(239,68,68,0.2);border-radius:6px;font-size:0.78rem;color:#fca5a5"><i class="fas fa-times-circle" style="margin-right:4px"></i>Код не найден или неактивен</div>';
    toast('Промокод не найден', 'error');
    return;
  }
  
  // Save code to lead
  await api('/leads/' + leadId, { method:'PUT', body: JSON.stringify({ referral_code: code }) });
  var lead = ((data.leads && data.leads.leads)||[]).find(function(x) { return x.id === leadId; });
  if (lead) lead.referral_code = code;
  
  // Show discount info
  var infoHtml = '<div style="padding:8px;background:#0f2d1f;border:1px solid rgba(16,185,129,0.2);border-radius:6px;font-size:0.78rem;color:#6ee7b7">' +
    '<i class="fas fa-check-circle" style="margin-right:4px"></i>Код «' + escHtml(code) + '» применён';
  if (res.discount_percent) infoHtml += ' | Скидка: <strong>' + res.discount_percent + '%</strong>';

  if (res.free_services && res.free_services.length > 0) {
    infoHtml += '<br>Бесплатные услуги: ';
    res.free_services.forEach(function(s) { infoHtml += '<span style="background:rgba(16,185,129,0.15);padding:1px 6px;border-radius:4px;margin:0 2px">' + escHtml(s.name_ru || s.service_name) + '</span>'; });
  }
  if (res.service_discounts && res.service_discounts.length > 0) {
    infoHtml += '<br>Скидки на услуги: ';
    res.service_discounts.forEach(function(s) { infoHtml += '<span style="background:rgba(251,191,36,0.15);padding:1px 6px;border-radius:4px;margin:0 2px;color:#fbbf24">' + escHtml(s.name_ru || s.service_name) + ' -' + s.discount_percent + '%</span>'; });
  }
  infoHtml += '</div>';
  if (infoDiv) infoDiv.innerHTML = infoHtml;
  toast('Промокод применён: ' + (res.discount_percent ? res.discount_percent + '% скидка' : 'активен'));
  
  // Trigger recalculation to apply discount to total_amount
  try {
    var recalcRes = await api('/leads/' + leadId + '/recalc', { method: 'POST' });
    if (recalcRes && recalcRes.total_amount !== undefined) {
      if (lead) {
        lead.total_amount = recalcRes.total_amount;
        try { lead.calc_data = JSON.stringify(recalcRes.calc_data || {}); } catch(e) {}
      }
      toast('Сумма пересчитана: ' + Number(recalcRes.total_amount).toLocaleString('ru-RU') + ' ֏');
    }
    // Reload data to update card display
    await loadData();
    render();
  } catch(e) { console.log('Recalc error:', e); }
}

async function removeLeadRefCode(leadId) {
  if (!confirm('Отменить промокод и убрать скидку для этого лида?')) return;
  
  // Clear referral code from lead
  await api('/leads/' + leadId, { method:'PUT', body: JSON.stringify({ referral_code: '' }) });
  var lead = ((data.leads && data.leads.leads)||[]).find(function(x) { return x.id === leadId; });
  if (lead) lead.referral_code = '';
  
  // Recalculate without discount
  try {
    var recalcRes = await api('/leads/' + leadId + '/recalc', { method: 'POST' });
    if (recalcRes && recalcRes.total_amount !== undefined) {
      if (lead) {
        lead.total_amount = recalcRes.total_amount;
        try { lead.calc_data = JSON.stringify(recalcRes.calc_data || {}); } catch(e) {}
      }
    }
    toast('Промокод отменён, скидка убрана');
    await loadData();
    render();
  } catch(e) {
    toast('Промокод убран, обновите страницу');
    await loadData();
    render();
  }
}

async function applyPaymentMethod(leadId) {
  var sel = document.getElementById('lead-pm-' + leadId);
  var preview = document.getElementById('lead-pm-preview-' + leadId);
  if (!sel) return;
  var pmId = sel.value ? Number(sel.value) : null;
  
  // Show loading state
  if (preview) preview.innerHTML = '<div style="font-size:0.78rem;color:#3B82F6;padding:8px"><i class="fas fa-spinner fa-spin" style="margin-right:4px"></i>Пересчёт...</div>';
  
  // 1. Save payment method & get commission
  var res = await api('/leads/' + leadId + '/payment-method', { method:'PUT', body: JSON.stringify({ payment_method_id: pmId }) });
  var commAmt = Number((res && res.commission_amount) || 0);
  
  // 2. Update local data
  var lead = ((data.leads && data.leads.leads)||[]).find(function(x) { return x.id === leadId; });
  if (lead) {
    lead.payment_method_id = pmId;
    lead.commission_amount = commAmt;
  }
  
  // 3. Update preview in payment method section
  var pmMethods = ensureArray(data.paymentMethods);
  var pmMatch = pmMethods.find(function(m) { return m.id == pmId; });
  var pmBase = Number(lead && lead.total_amount || 0);
  var pmFinal = pmBase + commAmt;
  
  if (preview) {
    if (pmMatch && commAmt > 0) {
      preview.innerHTML = '<div style="font-size:0.78rem;padding:8px;line-height:1.6">' +
        '<div style="color:#64748b">Сумма заказа: <span style="color:#e2e8f0;font-weight:600">' + Number(pmBase).toLocaleString('ru-RU') + ' ֏</span></div>' +
        '<div style="color:#3B82F6;font-weight:600">Комиссия ' + pmMatch.commission_pct + '%: +' + Number(commAmt).toLocaleString('ru-RU') + ' ֏</div>' +
        '<div style="color:#22C55E;font-weight:700;font-size:0.9rem">К оплате: ' + Number(pmFinal).toLocaleString('ru-RU') + ' ֏ ✓</div></div>';
    } else if (pmMatch) {
      preview.innerHTML = '<div style="font-size:0.78rem;padding:8px;color:#22C55E;font-weight:600"><i class="fas fa-check" style="margin-right:4px"></i>' + escHtml(pmMatch.name_ru) + ' — без комиссии ✓</div>';
    } else {
      preview.innerHTML = '<div style="font-size:0.78rem;color:#64748b;padding:8px">Способ оплаты не выбран</div>';
    }
  }
  
  // 4. Update total amount display on lead card (right side)
  var totalEl = document.getElementById('lead-total-' + leadId);
  if (totalEl && pmBase > 0) {
    if (commAmt > 0) {
      totalEl.innerHTML = '<div style="text-align:right">' +
        '<div style="font-size:0.72rem;color:#64748b;text-decoration:line-through">' + Number(pmBase).toLocaleString('ru-RU') + ' ֏</div>' +
        '<div style="font-size:1.3rem;font-weight:900;color:#22C55E;white-space:nowrap">' + Number(pmFinal).toLocaleString('ru-RU') + '&nbsp;֏</div>' +
        '<div style="font-size:0.68rem;color:#3B82F6;font-weight:600">+' + Number(commAmt).toLocaleString('ru-RU') + ' ֏ комиссия</div></div>';
    } else {
      totalEl.innerHTML = '<div style="font-size:1.3rem;font-weight:900;color:#8B5CF6;white-space:nowrap">' + Number(pmBase).toLocaleString('ru-RU') + '&nbsp;֏</div>';
    }
  }
  
  toast(pmMatch ? 'Способ оплаты: ' + pmMatch.name_ru + (commAmt > 0 ? ' (+' + Number(commAmt).toLocaleString('ru-RU') + ' ֏ = ' + Number(pmFinal).toLocaleString('ru-RU') + ' ֏)' : '') : 'Способ оплаты сброшен');
}

function getAssigneeName(id) {
  var u = ensureArray(data.users).find(function(x) { return x.id == id; });
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
    '<input class="input" style="flex:1;padding:8px 12px;font-size:0.82rem" id="newComment-' + leadId + '" placeholder="Написать комментарий..." onkeydown="if(event.key===&apos;Enter&apos;)addComment(' + leadId + ')">' +
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
    '<div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleSection(&apos;art-body-' + leadId + '&apos;,&apos;art-arrow-' + leadId + '&apos;)">' +
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
  for (var bk = 0; bk < ensureArray(data.users).length; bk++) {
    var ub = data.users[bk];
    h += '<option value="' + ub.id + '"' + ((art && art.buyer_id==ub.id)?' selected':'') + '>' + escHtml(ub.display_name) + '</option>';
  }
  h += '</select></div></div>' +
    '<div style="margin-bottom:12px"><label style="font-size:0.78rem;color:#94a3b8;display:block;margin-bottom:4px">Примечание</label><textarea class="input" id="art_notes" rows="2" placeholder="Особые пожелания клиента...">' + escHtml((art && art.notes) || '') + '</textarea></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn btn-outline" onclick="this.closest(&apos;[style*=fixed]&apos;).remove()">Отмена</button><button type="submit" class="btn btn-primary"><i class="fas fa-check" style="margin-right:6px"></i>' + (isEdit ? 'Сохранить' : 'Добавить') + '</button></div>' +
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
    '<button class="btn btn-outline" onclick="this.closest(&apos;[style*=fixed]&apos;).remove()">Закрыть</button>' +
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
  // 1. Save name + contact + product + notes + telegram_group + tz_link + refund_amount
  var nameEl = document.getElementById('lead-name-' + leadId);
  var contactEl = document.getElementById('lead-contact-' + leadId);
  var productEl = document.getElementById('lead-product-' + leadId);
  var notesEl = document.getElementById('lead-notes-' + leadId);
  var tgEl = document.getElementById('lead-tg-' + leadId);
  var tzEl = document.getElementById('lead-tz-' + leadId);
  var refundEl = document.getElementById('lead-refund-' + leadId);
  var refCodeEl = document.getElementById('lead-refcode-' + leadId);
  var pmEl = document.getElementById('lead-pm-' + leadId);
  var updateData = {};
  if (nameEl) updateData.name = nameEl.value;
  if (contactEl) updateData.contact = contactEl.value;
  if (productEl) updateData.product = productEl.value;
  if (notesEl) updateData.notes = notesEl.value;
  if (tgEl) updateData.telegram_group = tgEl.value;
  if (tzEl) updateData.tz_link = tzEl.value;
  if (refundEl) updateData.refund_amount = parseFloat(refundEl.value) || 0;
  if (refCodeEl) updateData.referral_code = refCodeEl.value.trim();
  if (Object.keys(updateData).length > 0) {
    await api('/leads/' + leadId, { method:'PUT', body: JSON.stringify(updateData) });
    var lead = ((data.leads && data.leads.leads)||[]).find(function(x) { return x.id === leadId; });
    if (lead) {
      if (nameEl) lead.name = nameEl.value;
      if (contactEl) lead.contact = contactEl.value;
      if (productEl) lead.product = productEl.value;
      if (notesEl) lead.notes = notesEl.value;
      if (tgEl) lead.telegram_group = tgEl.value;
      if (tzEl) lead.tz_link = tzEl.value;
      if (refundEl) lead.refund_amount = parseFloat(refundEl.value) || 0;
    }
  }
  // 2a. Save payment method
  if (pmEl) {
    var pmVal = pmEl.value ? Number(pmEl.value) : null;
    await api('/leads/' + leadId + '/payment-method', { method:'PUT', body: JSON.stringify({ payment_method_id: pmVal }) });
    var lead2 = ((data.leads && data.leads.leads)||[]).find(function(x) { return x.id === leadId; });
    if (lead2) lead2.payment_method_id = pmVal;
  }
  // 2. Recalculate total (articles + services + commission)
  var res = await api('/leads/' + leadId + '/recalc', { method: 'POST' });
  if (res && res.success) {
    var commAmt2 = Number(res.commission_amount || 0);
    var finalAmt = Number(res.total_amount) + commAmt2;
    toast('Сохранено. Итого: ' + Number(res.total_amount).toLocaleString('ru-RU') + ' ֏' + (commAmt2 > 0 ? ' + комиссия ' + Number(commAmt2).toLocaleString('ru-RU') + ' ֏ = ' + Number(finalAmt).toLocaleString('ru-RU') + ' ֏' : ''));
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


`;
