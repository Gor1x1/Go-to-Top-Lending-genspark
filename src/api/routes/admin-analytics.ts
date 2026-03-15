/**
 * Admin API — Business analytics V2 — comprehensive financial and lead analytics
 */
import { Hono } from 'hono'

type Bindings = { DB: D1Database }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: AuthMiddleware) {
// ===== BUSINESS ANALYTICS V2 =====
api.get('/business-analytics', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const url = new URL(c.req.url);
    const dateFrom = url.searchParams.get('from') || '';
    const dateTo = url.searchParams.get('to') || '';
    // Also accept month param for period-specific analytics
    const monthParam = url.searchParams.get('month') || ''; // e.g. "2026-02"
    
    let dateFilter = '';
    const dateParams: string[] = [];
    if (monthParam) {
      dateFilter += " AND strftime('%Y-%m', l.created_at) = ?";
      dateParams.push(monthParam);
    } else {
      if (dateFrom) { dateFilter += " AND date(l.created_at) >= ?"; dateParams.push(dateFrom); }
      if (dateTo) { dateFilter += " AND date(l.created_at) <= ?"; dateParams.push(dateTo); }
    }

    // 1. Lead stats by status with services/articles breakdown
    // TURNOVER = in_progress + checking + done (money already received by company)
    const turnoverStatuses = ['in_progress', 'checking', 'done'];
    const allStatuses = ['new', 'contacted', 'in_progress', 'rejected', 'checking', 'done'];
    const statusData: Record<string, any> = {};
    for (const st of allStatuses) {
      const res = await db.prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(l.total_amount),0) as amt FROM leads l WHERE l.status = ?" + dateFilter).bind(st, ...dateParams).first().catch(() => null);
      statusData[st] = { count: Number(res?.cnt || 0), amount: Number(res?.amt || 0), services: 0, articles: 0, packages: 0, discounts: 0 };
    }

    // Parse calc_data for SERVICES only; articles come exclusively from lead_articles table to avoid double-counting
    const allLeads = await db.prepare("SELECT id, status, calc_data, refund_amount, total_amount, assigned_to, referral_code, name, created_at FROM leads l WHERE 1=1" + dateFilter).bind(...dateParams).all().catch(() => ({ results: [] }));
    let totalRefunds = 0;
    const leadsById: Record<number, any> = {};
    // Package analytics data
    const pkgStats: Record<string, { count: number; revenue: number; package_name: string }> = {};
    let totalPkgRevenue = 0;
    let totalPkgCount = 0;
    for (const lead of (allLeads.results || [])) {
      const st = lead.status as string || 'new';
      const lid = Number(lead.id);
      leadsById[lid] = lead;
      totalRefunds += Number(lead.refund_amount) || 0;
      try {
        const cd = JSON.parse((lead.calc_data as string) || '{}');
        if (cd.items && Array.isArray(cd.items)) {
          for (const item of cd.items) {
            // Only count services from calc_data; articles are tracked in lead_articles table
            if (!item.wb_article) {
              const subtotal = Number(item.subtotal) || 0;
              if (statusData[st]) statusData[st].services += subtotal;
            }
          }
        }
        // Track package usage (for turnover statuses only)
        if (cd.package && turnoverStatuses.includes(st)) {
          const pName = cd.package.name_ru || cd.package.name || 'Unknown';
          const pId = String(cd.package.package_id || pName);
          const pPrice = Number(cd.package.package_price || 0);
          if (!pkgStats[pId]) pkgStats[pId] = { count: 0, revenue: 0, package_name: pName };
          pkgStats[pId].count++;
          pkgStats[pId].revenue += pPrice;
          totalPkgRevenue += pPrice;
          totalPkgCount++;
        }
        // Track package price per status (for all statuses)
        if (cd.package) {
          const pPrice2 = Number(cd.package.package_price || 0);
          if (statusData[st]) statusData[st].packages += pPrice2;
        }
        // Track discount per status — subtract from services so svc + art + pkg = amount
        const discAmt = Number(cd.discountAmount || 0);
        if (discAmt > 0 && statusData[st]) {
          statusData[st].services = Math.max(0, statusData[st].services - discAmt);
          statusData[st].discounts += discAmt;
        }
      } catch {}
    }
    const packagesList = Object.values(pkgStats).sort((a, b) => b.revenue - a.revenue);

    // Articles totals from lead_articles table (single source of truth for articles)
    try {
      const artDateFilter = dateFilter.replace(/l\./g, 'l2.');
      const artTotals = await db.prepare("SELECT l2.status, COALESCE(SUM(la.total_price),0) as art_total FROM lead_articles la JOIN leads l2 ON la.lead_id = l2.id WHERE 1=1" + artDateFilter + " GROUP BY l2.status").bind(...dateParams).all();
      for (const r of (artTotals.results || [])) {
        const st = r.status as string;
        if (statusData[st]) statusData[st].articles += Number(r.art_total || 0);
      }
    } catch {}

    // amount = total_amount from DB = svc + art + pkg - discount = real money from client
    // No override needed — total_amount IS the correct revenue figure

    // 2. Financial summary
    // TURNOVER = total_amount of in_progress + checking + done leads (real client payments)
    let turnover = 0, servicesTotal = 0, articlesTotal = 0, packagesTotal = 0;
    for (const st of turnoverStatuses) {
      turnover += statusData[st]?.amount || 0;
      servicesTotal += statusData[st]?.services || 0;
      articlesTotal += statusData[st]?.articles || 0;
      packagesTotal += statusData[st]?.packages || 0;
    }
    // Ensure turnover is never negative, sanitize big-number issues
    turnover = Math.max(0, Math.round(turnover * 100) / 100);
    servicesTotal = Math.max(0, Math.round(servicesTotal * 100) / 100);
    articlesTotal = Math.max(0, Math.round(articlesTotal * 100) / 100);

    // Completed (done) sums — separate for correct "Completed" card display
    const doneAmount = statusData.done?.amount || 0;
    const doneServices = statusData.done?.services || 0;
    const doneArticles = statusData.done?.articles || 0;
    const doneCount = statusData.done?.count || 0;

    // 3. Expenses — BUG-FIX: filter expenses by period (start_date/end_date)
    // Only include expenses where the period falls within [start_date, end_date]
    const currentPeriod = monthParam || (dateFrom && dateTo ? dateFrom : new Date().toISOString().slice(0,7));
    const expenseRes = await db.prepare(`SELECT e.*, ec.is_marketing, ec.name as cat_name, eft.name as freq_name, eft.multiplier_monthly
      FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN expense_frequency_types eft ON e.frequency_type_id = eft.id
      WHERE e.is_active = 1
      AND (e.start_date IS NULL OR e.start_date = '' OR e.start_date <= ?)
      AND (e.end_date IS NULL OR e.end_date = '' OR e.end_date >= ?)`)
      .bind(currentPeriod + '-31', currentPeriod + '-01').all().catch(() => ({ results: [] }));
    let totalExpenses = 0, marketingExpenses = 0, commercialExpenses = 0;
    for (const exp of (expenseRes.results || [])) {
      const amt = Math.round((Number(exp.amount) || 0) * 100) / 100;
      totalExpenses += amt;
      if (exp.is_marketing) marketingExpenses += amt;
      else commercialExpenses += amt;
    }

    // 4. Salaries
    const salaryRes = await db.prepare("SELECT COALESCE(SUM(salary), 0) as total_salary FROM users WHERE is_active = 1 AND salary > 0").first().catch(() => null);
    const totalSalaries = Math.round((Number(salaryRes?.total_salary || 0)) * 100) / 100;

    // Bonuses for period
    let bonusFilter = '';
    const bonusParams: string[] = [];
    if (monthParam) {
      bonusFilter += " AND strftime('%Y-%m', bonus_date) = ?";
      bonusParams.push(monthParam);
    } else {
      if (dateFrom) { bonusFilter += " AND bonus_date >= ?"; bonusParams.push(dateFrom); }
      if (dateTo) { bonusFilter += " AND bonus_date <= ?"; bonusParams.push(dateTo); }
    }
    const bonusRes = await db.prepare("SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) as total_bonuses, COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END),0) as total_fines, COALESCE(SUM(amount),0) as net_total FROM employee_bonuses WHERE 1=1" + bonusFilter).bind(...bonusParams).first().catch(() => null);
    const totalBonuses = Math.round((Number(bonusRes?.total_bonuses || 0)) * 100) / 100;
    const totalFines = Math.round((Number(bonusRes?.total_fines || 0)) * 100) / 100;

    // 5. Financial metrics (profit from total revenue = services + articles)
    // Fines (negative bonuses) reduce salary cost, so net effect: salaries + bonuses + fines + expenses
    const allExpensesSum = totalSalaries + totalBonuses + totalFines + totalExpenses;
    const netProfit = Math.round((turnover - allExpensesSum) * 100) / 100;
    const marginality = turnover > 0 ? Math.round((netProfit / turnover) * 1000) / 10 : 0;
    const roi = allExpensesSum > 0 ? Math.round((netProfit / allExpensesSum) * 1000) / 10 : 0;
    const romi = marketingExpenses > 0 ? Math.round(((turnover - marketingExpenses) / marketingExpenses) * 1000) / 10 : 0;
    // AVG CHECK = only from services of completed leads (excluding purchases/articles)
    const avgCheck = doneCount > 0 ? Math.round(doneServices / doneCount) : 0;
    const totalLeadsCount = Object.values(statusData).reduce((a: number, s: any) => a + (Number(s.count) || 0), 0);
    const conversionRate = totalLeadsCount > 0 ? Math.round((doneCount / totalLeadsCount) * 1000) / 10 : 0;
    const breakEven = allExpensesSum;

    // Articles net (articles minus refunds)
    const articlesNet = Math.max(0, Math.round((articlesTotal - totalRefunds) * 100) / 100);

    // 6. Order fulfillment time — BUG-FIX: use completed_at instead of now() for accurate calculation
    let avgFulfillmentDays = 0;
    try {
      const dfNoAlias = dateFilter.replace(/l\./g, '');
      const ftRes = await db.prepare("SELECT AVG(julianday(COALESCE(completed_at, 'now')) - julianday(created_at)) as avg_days FROM leads WHERE status = 'done'" + dfNoAlias).bind(...dateParams).first();
      avgFulfillmentDays = Math.round(Number(ftRes?.avg_days || 0) * 10) / 10;
    } catch {}

    // 7. Daily breakdown (for bar chart)
    let dailyResults: any[] = [];
    try {
      if (monthParam) {
        const dailyQ = "SELECT date(created_at) as day, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE strftime('%Y-%m', created_at) = ? GROUP BY date(created_at) ORDER BY day";
        const dailyRes = await db.prepare(dailyQ).bind(monthParam).all();
        dailyResults = dailyRes.results || [];
      } else if (dateFrom || dateTo) {
        let dailyQ = "SELECT date(created_at) as day, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE 1=1";
        const dailyParams: string[] = [];
        if (dateFrom) { dailyQ += " AND date(created_at) >= ?"; dailyParams.push(dateFrom); }
        if (dateTo) { dailyQ += " AND date(created_at) <= ?"; dailyParams.push(dateTo); }
        dailyQ += " GROUP BY date(created_at) ORDER BY day";
        const dailyRes = await db.prepare(dailyQ).bind(...dailyParams).all();
        dailyResults = dailyRes.results || [];
      } else {
        const dailyQ = "SELECT date(created_at) as day, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now','-30 days') GROUP BY date(created_at) ORDER BY day";
        const dailyRes = await db.prepare(dailyQ).all();
        dailyResults = dailyRes.results || [];
      }
    } catch {}

    // 8. By assignee — enhanced with services/articles/operator/buyer breakdown
    const byAssignee: any[] = [];
    try {
      const byAssRes = await db.prepare("SELECT l.assigned_to, u.display_name, u.role, u.position_title, COUNT(*) as cnt, COALESCE(SUM(l.total_amount),0) as amt FROM leads l LEFT JOIN users u ON l.assigned_to=u.id WHERE l.status IN ('in_progress','checking','done')" + dateFilter + " GROUP BY l.assigned_to ORDER BY amt DESC").bind(...dateParams).all();
      for (const r of (byAssRes.results || [])) {
        // Calculate per-assignee services only from calc_data (articles from lead_articles)
        let assServices = 0, assArticles = 0, assDiscount = 0;
        for (const lead of (allLeads.results || [])) {
          if (Number(lead.assigned_to) !== Number(r.assigned_to)) continue;
          if (!['in_progress','checking','done'].includes(lead.status as string)) continue;
          try {
            const cd = JSON.parse((lead.calc_data as string) || '{}');
            if (cd.items && Array.isArray(cd.items)) {
              for (const item of cd.items) {
                if (!item.wb_article) {
                  assServices += Number(item.subtotal) || 0;
                }
              }
            }
            assDiscount += Number(cd.discountAmount || 0);
          } catch {}
        }
        assServices = Math.max(0, assServices - assDiscount);
        // Get articles for this assignee from lead_articles table
        try {
          const artAss = await db.prepare("SELECT COALESCE(SUM(la.total_price),0) as art_total FROM lead_articles la JOIN leads l3 ON la.lead_id = l3.id WHERE l3.assigned_to = ? AND l3.status IN ('in_progress','checking','done')" + dateFilter.replace(/l\./g, 'l3.')).bind(r.assigned_to, ...dateParams).first();
          assArticles = Number(artAss?.art_total || 0);
        } catch {}
        // amount = total_amount from DB (svc + art + pkg - discount = real client payment)
        byAssignee.push({ 
          user_id: r.assigned_to, display_name: r.display_name || 'Не назначен', 
          role: r.role || '', position_title: r.position_title || '',
          count: Number(r.cnt), amount: Number(r.amt),
          services: Math.round(assServices * 100) / 100,
          articles: Math.round(assArticles * 100) / 100
        });
      }
    } catch {}

    // 9. Service popularity (from calc_data items) — always display Russian names
    // Build translation map from calculator_services (name_am → name_ru)
    const svcNameMap: Record<string, string> = {};
    try {
      const allSvcs = await db.prepare("SELECT name_ru, name_am FROM calculator_services WHERE is_active = 1").all();
      for (const s of (allSvcs.results || [])) {
        if (s.name_am && s.name_ru) svcNameMap[s.name_am as string] = s.name_ru as string;
        if (s.name_ru) svcNameMap[s.name_ru as string] = s.name_ru as string;
      }
    } catch {}
    const serviceStats: Record<string, { count: number; qty: number; revenue: number }> = {};
    for (const lead of (allLeads.results || [])) {
      try {
        const cd = JSON.parse((lead.calc_data as string) || '{}');
        if (cd.items && Array.isArray(cd.items)) {
          for (const item of cd.items) {
            if (!item.wb_article) {
              const rawName = item.name || 'Неизвестно';
              // Translate to Russian if possible
              const name = svcNameMap[rawName] || rawName;
              if (!serviceStats[name]) serviceStats[name] = { count: 0, qty: 0, revenue: 0 };
              serviceStats[name].count++;
              serviceStats[name].qty += Number(item.qty || 1);
              serviceStats[name].revenue += Number(item.subtotal || 0);
            }
          }
        }
      } catch {}
    }
    const serviceList = Object.entries(serviceStats).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.revenue - a.revenue);

    // 10. Referral stats — COMPREHENSIVE referral & discount analytics
    // IMPORTANT: Promo code analytics only counts leads with PAID statuses (in_progress, checking, done)
    const paidStatuses = ['in_progress', 'checking', 'done'];
    let refResults: any[] = [];
    let totalDiscountCost = 0;
    let totalDiscountLeads = 0;
    let servicesBeforeDiscount = 0;
    let totalFreeServicesValue = 0;
    const promoCodeCosts: Record<string, { count: number; discount_total: number; revenue: number; services_total: number; free_services_value: number; code_details?: any; leads: any[] }> = {};
    try {
      const dfNoAlias = dateFilter.replace(/l\./g, '');
      const refRes = await db.prepare("SELECT referral_code, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE referral_code != '' AND referral_code IS NOT NULL AND status IN ('in_progress','checking','done')" + dfNoAlias + " GROUP BY referral_code ORDER BY count DESC").bind(...dateParams).all();
      refResults = refRes.results || [];
    } catch {}

    // Pre-load referral_codes lookup for fallback discount calculation
    const refCodesLookup: Record<string, { discount_percent: number; id: number }> = {};
    try {
      const allRefCodes = await db.prepare("SELECT id, code, discount_percent FROM referral_codes").all();
      for (const rc of (allRefCodes.results || [])) {
        refCodesLookup[(rc.code as string || '').toUpperCase()] = {
          discount_percent: Number(rc.discount_percent || 0),
          id: Number(rc.id)
        };
      }
    } catch {}

    // Build per-code detailed costs from all leads — ONLY paid statuses
    for (const lead of (allLeads.results || [])) {
      const rc = lead.referral_code as string;
      if (!rc) continue;
      const leadStatus = lead.status as string || '';
      if (!paidStatuses.includes(leadStatus)) continue; // Only in_progress, checking, done
      if (!promoCodeCosts[rc]) promoCodeCosts[rc] = { count: 0, discount_total: 0, revenue: 0, services_total: 0, free_services_value: 0, leads: [] };
      promoCodeCosts[rc].count++;
      promoCodeCosts[rc].revenue += Number(lead.total_amount || 0);
      try {
        const cd = JSON.parse((lead.calc_data as string) || '{}');
        let da = Number(cd.discountAmount || 0);
        let svcSub = Number(cd.servicesSubtotal || 0);

        // FALLBACK: if lead has referral_code but discountAmount=0 in calc_data,
        // recalculate discount dynamically from services items + referral_codes table
        if (da === 0 && rc) {
          const refInfo = refCodesLookup[rc.toUpperCase()];
          if (refInfo && refInfo.discount_percent > 0) {
            // Calculate services subtotal from items if not stored
            if (svcSub === 0 && cd.items && Array.isArray(cd.items)) {
              for (const item of cd.items) {
                if (!item.wb_article) svcSub += Number(item.subtotal || 0);
              }
            }
            // Also try legacy subtotal field
            if (svcSub === 0) svcSub = Number(cd.subtotal || 0);
            if (svcSub > 0) {
              da = Math.round(svcSub * refInfo.discount_percent / 100);
            }
          }
        }

        promoCodeCosts[rc].discount_total += da;
        promoCodeCosts[rc].services_total += svcSub;
        totalDiscountCost += da;
        if (da > 0) totalDiscountLeads++;
        servicesBeforeDiscount += svcSub;
        // Track free services value from calc_data
        const freeServicesInLead = cd.freeServices || [];
        let leadFreeValue = 0;
        for (const fs of freeServicesInLead) {
          leadFreeValue += (Number(fs.qty || fs.quantity || 1)) * (Number(fs.price || 0));
        }
        promoCodeCosts[rc].free_services_value += leadFreeValue;
        totalFreeServicesValue += leadFreeValue;
        promoCodeCosts[rc].leads.push({
          id: lead.id, name: (lead as any).name || '', status: lead.status,
          total: Number(lead.total_amount || 0), discount: da, free_value: leadFreeValue,
          services: svcSub, date: (lead as any).created_at || ''
        });
      } catch {}
    }
    // Enrich with referral_codes table data (including services)
    try {
      const allCodes = await db.prepare("SELECT * FROM referral_codes").all();
      for (const code of (allCodes.results || [])) {
        const key = code.code as string;
        if (promoCodeCosts[key]) {
          promoCodeCosts[key].code_details = {
            id: code.id, discount_percent: code.discount_percent,
            uses_count: code.uses_count, is_active: code.is_active, description: code.description
          };
        }
      }
    } catch {}
    // Load referral_free_services for each code (service-specific discounts)
    const refCodeServices: Record<string, any[]> = {};
    try {
      const allRfs = await db.prepare(`SELECT rfs.*, cs.name_ru, cs.price, rc.code
        FROM referral_free_services rfs 
        JOIN referral_codes rc ON rfs.referral_code_id = rc.id
        LEFT JOIN calculator_services cs ON rfs.service_id = cs.id`).all();
      for (const rfs of (allRfs.results || [])) {
        const code = rfs.code as string;
        if (!refCodeServices[code]) refCodeServices[code] = [];
        refCodeServices[code].push({
          service_name: rfs.name_ru || '', price: Number(rfs.price || 0),
          discount_percent: Number(rfs.discount_percent || 0), quantity: Number(rfs.quantity || 1)
        });
      }
    } catch {}
    // Monthly discount breakdown — only paid statuses
    const monthlyDiscounts: Record<string, { discount_total: number; leads_count: number; services_before: number }> = {};
    for (const lead of (allLeads.results || [])) {
      const rc = lead.referral_code as string;
      if (!rc) continue;
      const leadStatus2 = lead.status as string || '';
      if (!paidStatuses.includes(leadStatus2)) continue; // Only in_progress, checking, done
      try {
        const cd = JSON.parse((lead.calc_data as string) || '{}');
        let da = Number(cd.discountAmount || 0);
        let svcSub = Number(cd.servicesSubtotal || 0);
        // FALLBACK: same logic as main promo stats — recalc if needed
        if (da === 0 && rc) {
          const refInfo = refCodesLookup[rc.toUpperCase()];
          if (refInfo && refInfo.discount_percent > 0) {
            if (svcSub === 0 && cd.items && Array.isArray(cd.items)) {
              for (const item of cd.items) {
                if (!item.wb_article) svcSub += Number(item.subtotal || 0);
              }
            }
            if (svcSub === 0) svcSub = Number(cd.subtotal || 0);
            if (svcSub > 0) da = Math.round(svcSub * refInfo.discount_percent / 100);
          }
        }
        const created = (lead as any).created_at as string || '';
        const monthKey = created.substring(0, 7); // '2026-02'
        if (monthKey) {
          if (!monthlyDiscounts[monthKey]) monthlyDiscounts[monthKey] = { discount_total: 0, leads_count: 0, services_before: 0 };
          monthlyDiscounts[monthKey].discount_total += da;
          if (da > 0) monthlyDiscounts[monthKey].leads_count++;
          monthlyDiscounts[monthKey].services_before += svcSub;
        }
      } catch {}
    }

    // 11. By source
    const bySource: Record<string, any> = {};
    try {
      const bsRes = await db.prepare("SELECT source, COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as amt FROM leads l WHERE 1=1" + dateFilter + " GROUP BY source").bind(...dateParams).all();
      for (const r of (bsRes.results || [])) { bySource[r.source as string || 'direct'] = { count: Number(r.cnt), amount: Number(r.amt) }; }
    } catch {}

    // 12. Employees with salaries
    const employees: any[] = [];
    try {
      // Ensure hire_date and end_date columns exist
      try { await db.prepare("ALTER TABLE users ADD COLUMN hire_date TEXT DEFAULT ''").run(); } catch {}
      try { await db.prepare("ALTER TABLE users ADD COLUMN end_date TEXT DEFAULT ''").run(); } catch {}
      const empRes = await db.prepare("SELECT id, display_name, role, salary, salary_type, position_title, is_active, hire_date, end_date, telegram_link FROM users WHERE salary > 0 OR role != 'main_admin' ORDER BY salary DESC").all();
      for (const e of (empRes.results || [])) {
        const bSum = await db.prepare("SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) as total_bonuses, COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END),0) as total_fines, COALESCE(SUM(amount),0) as net_total FROM employee_bonuses WHERE user_id = ?" + bonusFilter).bind(e.id, ...bonusParams).first().catch(() => null);
        // Vacation data for this employee
        let vacPaidDays = 0, vacUnpaidDays = 0, vacPaidAmount = 0;
        try {
          const vacSum = await db.prepare("SELECT COALESCE(SUM(CASE WHEN is_paid=1 THEN days_count ELSE 0 END),0) as paid_days, COALESCE(SUM(CASE WHEN is_paid=0 THEN days_count ELSE 0 END),0) as unpaid_days, COALESCE(SUM(paid_amount),0) as paid_amount FROM employee_vacations WHERE user_id = ?").bind(e.id).first();
          vacPaidDays = Number(vacSum?.paid_days || 0);
          vacUnpaidDays = Number(vacSum?.unpaid_days || 0);
          vacPaidAmount = Number(vacSum?.paid_amount || 0);
        } catch {}
        employees.push({ 
          ...e, 
          bonuses_total: Math.round((Number(bSum?.total_bonuses || 0)) * 100) / 100,
          fines_total: Math.round((Number(bSum?.total_fines || 0)) * 100) / 100,
          bonuses_net: Math.round((Number(bSum?.net_total || 0)) * 100) / 100,
          vacation_paid_days: vacPaidDays,
          vacation_unpaid_days: vacUnpaidDays,
          vacation_paid_amount: Math.round(vacPaidAmount * 100) / 100
        });
      }
    } catch {}

    // 12b. Total vacation costs across all employees
    let totalVacPaidAmount = 0, totalVacPaidDays = 0, totalVacUnpaidDays = 0;
    try {
      const vacTotals = await db.prepare("SELECT COALESCE(SUM(paid_amount),0) as paid_amt, COALESCE(SUM(CASE WHEN is_paid=1 THEN days_count ELSE 0 END),0) as paid_days, COALESCE(SUM(CASE WHEN is_paid=0 THEN days_count ELSE 0 END),0) as unpaid_days FROM employee_vacations").first();
      totalVacPaidAmount = Math.round(Number(vacTotals?.paid_amt || 0) * 100) / 100;
      totalVacPaidDays = Number(vacTotals?.paid_days || 0);
      totalVacUnpaidDays = Number(vacTotals?.unpaid_days || 0);
    } catch {}

    // 13. Rejected leads with reasons
    let rejectedLeads: any[] = [];
    try {
      const rejRes = await db.prepare("SELECT id, name, contact, notes, total_amount, created_at FROM leads l WHERE l.status = 'rejected'" + dateFilter + " ORDER BY l.created_at DESC LIMIT 50").bind(...dateParams).all();
      rejectedLeads = rejRes.results || [];
    } catch {}

    // 14. Stage timings (avg days per stage) — BUG-FIX: use status_changed_at for accurate timing
    const stageTimings: Record<string, number> = {};
    try {
      for (const st of allStatuses) {
        if (st === 'new') continue;
        const tRes = await db.prepare("SELECT AVG(julianday(COALESCE(l.status_changed_at, l.created_at)) - julianday(l.created_at)) as avg_days FROM leads l WHERE l.status = ?" + dateFilter).bind(st, ...dateParams).first();
        stageTimings[st] = Math.round((Number(tRes?.avg_days || 0)) * 10) / 10;
      }
    } catch {}

    // 15. Monthly data for yearly chart — detailed breakdown by status + financials
    // Uses ACTUAL month of lead creation — independent of date picker filter
    let monthlyData: any[] = [];
    try {
      const yr = monthParam ? monthParam.substring(0, 4) : String(new Date().getFullYear());
      const mRes = await db.prepare(`SELECT strftime('%Y-%m', created_at) as month, 
        COUNT(*) as count, 
        COALESCE(SUM(total_amount),0) as amount, 
        SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done_count,
        SUM(CASE WHEN status='done' THEN total_amount ELSE 0 END) as done_amount,
        SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status='contacted' THEN 1 ELSE 0 END) as contacted_count,
        SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN status='checking' THEN 1 ELSE 0 END) as checking_count,
        COALESCE(SUM(refund_amount),0) as refunds
        FROM leads WHERE strftime('%Y', created_at) = ? 
        GROUP BY strftime('%Y-%m', created_at) ORDER BY month`).bind(yr).all();
      // Now enrich with services/articles per month from calc_data + lead_articles
      const mDataArr = mRes.results || [];
      for (const md of mDataArr) {
        const mk = md.month as string;
        // Articles total from lead_articles for this month — turnover statuses only
        const artRes = await db.prepare(`SELECT COALESCE(SUM(la.total_price),0) as art_total 
          FROM lead_articles la JOIN leads l ON la.lead_id = l.id 
          WHERE strftime('%Y-%m', l.created_at) = ? AND l.status IN ('in_progress','checking','done')`).bind(mk).first().catch(() => ({art_total:0}));
        // Services = calc_data items without wb_article for turnover leads (in_progress + checking + done)
        const svcItemsRes = await db.prepare(`SELECT l.calc_data FROM leads l 
          WHERE strftime('%Y-%m', l.created_at) = ? AND l.status IN ('in_progress','checking','done')`).bind(mk).all().catch(() => ({results:[]}));
        let svcTotal = 0;
        let pkgTotal = 0;
        for (const row of (svcItemsRes.results || [])) {
          try {
            const cd = JSON.parse(row.calc_data as string || '{}');
            // Use servicesSubtotal if available (from recalc), otherwise sum items
            if (cd.servicesSubtotal) {
              svcTotal += Number(cd.servicesSubtotal);
            } else {
              const items = cd.items || cd.services || [];
              for (const it of items) {
                if (!it.wb_article) svcTotal += Number(it.subtotal) || ((Number(it.price) || 0) * (Number(it.qty) || Number(it.quantity) || 1));
              }
            }
            // Package price — real money from client
            if (cd.package && cd.package.package_price) {
              pkgTotal += Number(cd.package.package_price || 0);
            }
          } catch {}
        }
        // Discount total for this month — from ALL turnover leads (not just those with referral_code)
        const monthDiscRes = await db.prepare(`SELECT calc_data, referral_code FROM leads 
          WHERE strftime('%Y-%m', created_at) = ? 
          AND status IN ('in_progress','checking','done')`).bind(mk).all().catch(() => ({results:[]}));
        let monthDiscTotal = 0;
        for (const mdr of (monthDiscRes.results || [])) {
          try {
            const cd = JSON.parse(mdr.calc_data as string || '{}');
            let da = Number(cd.discountAmount || 0);
            if (da === 0 && mdr.referral_code) {
              const ri = refCodesLookup[(mdr.referral_code as string).toUpperCase()];
              if (ri && ri.discount_percent > 0) {
                let ss = Number(cd.servicesSubtotal || 0);
                if (ss === 0 && cd.items) {
                  for (const it of cd.items) { if (!it.wb_article) ss += Number(it.subtotal || 0); }
                }
                if (ss === 0) ss = Number(cd.subtotal || 0);
                if (ss > 0) da = Math.round(ss * ri.discount_percent / 100);
              }
            }
            monthDiscTotal += da;
          } catch {}
        }
        // Services = NET (gross - discount) so that svc + art + pkg = turnover
        (md as any).services = Math.max(0, svcTotal - monthDiscTotal);
        (md as any).articles = Number((artRes as any)?.art_total) || 0;
        (md as any).packages = pkgTotal;
        (md as any).discounts = monthDiscTotal;
      }
      monthlyData = mDataArr;
    } catch {}

    // 16. Weekly data
    let weeklyData: any[] = [];
    try {
      const wRes = await db.prepare("SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now', '-90 days') GROUP BY strftime('%Y-W%W', created_at) ORDER BY week").all();
      weeklyData = wRes.results || [];
    } catch {}

    // 17. Daily breakdown for expanded month view
    let monthDailyData: any[] = [];
    if (monthParam) {
      try {
        const mdRes = await db.prepare(`SELECT date(created_at) as day, COUNT(*) as count, 
          COALESCE(SUM(total_amount),0) as amount,
          SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done_count,
          SUM(CASE WHEN status='done' THEN total_amount ELSE 0 END) as done_amount,
          SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected_count
          FROM leads WHERE strftime('%Y-%m', created_at) = ? 
          GROUP BY date(created_at) ORDER BY day`).bind(monthParam).all();
        monthDailyData = mdRes.results || [];
      } catch {}
    }

    // 18. LTV calculation based on repeat customers (by phone number)
    // LTV = Средний чек × Частота покупок × Срок жизни клиента (мес)
    let ltvData: any = { ltv: 0, avg_check_ltv: 0, purchase_frequency: 0, customer_lifespan_months: 0, unique_customers: 0, repeat_customers: 0, total_orders: 0 };
    try {
      // Get customer data grouped by contact (phone number)
      let ltvQ = `SELECT contact, COUNT(*) as orders, 
        ROUND(AVG(total_amount),2) as avg_check,
        MIN(created_at) as first_order, MAX(created_at) as last_order
        FROM leads WHERE contact IS NOT NULL AND contact != '' 
        AND status IN ('done','in_progress','checking')`;
      const ltvParams: string[] = [];
      if (monthParam) {
        ltvQ += " AND strftime('%Y-%m', created_at) = ?";
        ltvParams.push(monthParam);
      } else {
        if (dateFrom) { ltvQ += " AND date(created_at) >= ?"; ltvParams.push(dateFrom); }
        if (dateTo) { ltvQ += " AND date(created_at) <= ?"; ltvParams.push(dateTo); }
      }
      ltvQ += " GROUP BY contact ORDER BY orders DESC";
      const ltvRes = await db.prepare(ltvQ).bind(...ltvParams).all();
      const customers = ltvRes.results || [];
      
      if (customers.length > 0) {
        const uniqueCustomers = customers.length;
        const totalOrders = customers.reduce((sum: number, c: any) => sum + Number(c.orders), 0);
        const repeatCustomers = customers.filter((c: any) => Number(c.orders) > 1).length;
        
        // Средний чек по всем клиентам
        const avgCheckLtv = customers.reduce((sum: number, c: any) => sum + Number(c.avg_check || 0), 0) / uniqueCustomers;
        
        // Частота покупок = общее число заказов / уникальные клиенты
        const purchaseFrequency = totalOrders / uniqueCustomers;
        
        // Срок жизни клиента (в месяцах)
        // Для повторных клиентов: среднее время между первым и последним заказом
        // Если повторных нет — берём 1 месяц как базовый
        let customerLifespanMonths = 1;
        const repeatCustomersList = customers.filter((c: any) => Number(c.orders) > 1);
        if (repeatCustomersList.length > 0) {
          let totalLifespanDays = 0;
          for (const rc of repeatCustomersList) {
            const first = new Date(rc.first_order as string).getTime();
            const last = new Date(rc.last_order as string).getTime();
            const diffDays = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
            totalLifespanDays += diffDays;
          }
          const avgLifespanDays = totalLifespanDays / repeatCustomersList.length;
          // Конвертируем дни в месяцы, минимум 1 месяц
          customerLifespanMonths = Math.max(1, Math.round((avgLifespanDays / 30) * 10) / 10);
        }
        
        // LTV = Средний чек × Частота покупок × Срок жизни (мес)
        const ltv = Math.round(avgCheckLtv * purchaseFrequency * customerLifespanMonths);
        
        ltvData = {
          ltv,
          avg_check_ltv: Math.round(avgCheckLtv),
          purchase_frequency: Math.round(purchaseFrequency * 100) / 100,
          customer_lifespan_months: customerLifespanMonths,
          unique_customers: uniqueCustomers,
          repeat_customers: repeatCustomers,
          total_orders: totalOrders,
          repeat_rate: uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 1000) / 10 : 0,
        };
      }
    } catch {}

    // ===== COMMISSION ANALYTICS =====
    let commissionData: any = { total_commission: 0, by_method: [], leads_with_method: 0, leads_without_method: 0 };
    try {
      // Ensure columns exist
      try { await db.prepare("SELECT payment_method_id FROM leads LIMIT 1").first(); } catch { try { await db.prepare("ALTER TABLE leads ADD COLUMN payment_method_id INTEGER DEFAULT NULL").run(); } catch {} }
      try { await db.prepare("SELECT commission_amount FROM leads LIMIT 1").first(); } catch { try { await db.prepare("ALTER TABLE leads ADD COLUMN commission_amount REAL DEFAULT 0").run(); } catch {} }
      
      // Get all leads with payment methods (turnover statuses only)
      const pmLeads = await db.prepare(
        "SELECT l.payment_method_id, l.total_amount, l.commission_amount, pm.name_ru, pm.name_am, pm.commission_pct FROM leads l LEFT JOIN payment_methods pm ON l.payment_method_id = pm.id WHERE l.status IN ('in_progress','checking','done')" + dateFilter
      ).bind(...dateParams).all().catch(() => ({ results: [] }));
      
      const methodStats: Record<number, { name_ru: string; name_am: string; pct: number; count: number; total_base: number; total_commission: number }> = {};
      let totalCommission = 0;
      let withMethod = 0;
      let withoutMethod = 0;
      
      for (const row of (pmLeads.results || [])) {
        if (row.payment_method_id) {
          withMethod++;
          const pmId = Number(row.payment_method_id);
          const base = Number(row.total_amount) || 0;
          const comm = Number(row.commission_amount) || 0;
          const pct = Number(row.commission_pct) || 0;
          totalCommission += comm;
          if (!methodStats[pmId]) {
            methodStats[pmId] = { name_ru: (row.name_ru as string) || '', name_am: (row.name_am as string) || '', pct, count: 0, total_base: 0, total_commission: 0 };
          }
          methodStats[pmId].count++;
          methodStats[pmId].total_base += base;
          methodStats[pmId].total_commission += comm;
        } else {
          withoutMethod++;
        }
      }
      
      commissionData = {
        total_commission: totalCommission,
        by_method: Object.entries(methodStats).map(([id, s]) => ({ id: Number(id), ...s })),
        leads_with_method: withMethod,
        leads_without_method: withoutMethod,
      };
    } catch {}

    // ===== DASHBOARD KPIs: CAC, ROAS =====
    const newLeadsCount = statusData.new?.count || 0;
    const totalLeadsAll = Object.values(statusData).reduce((a: number, s: any) => a + (Number(s.count) || 0), 0);
    // CAC = cost per acquisition. Prefer marketing expenses; fallback to total expenses
    const cacExpenseBase = marketingExpenses > 0 ? marketingExpenses : allExpensesSum;
    const cacDivisor = doneCount > 0 ? doneCount : totalLeadsAll;
    const cac = cacDivisor > 0 ? Math.round(cacExpenseBase / cacDivisor * 100) / 100 : 0;
    // ROAS = revenue / ad spend. Prefer marketing expenses; fallback to total expenses
    const roasExpenseBase = marketingExpenses > 0 ? marketingExpenses : allExpensesSum;
    const roas = roasExpenseBase > 0 ? Math.round(servicesTotal / roasExpenseBase * 100) / 100 : 0;

    // ===== SALES FUNNEL BY DATES =====
    let funnelByDate: any[] = [];
    try {
      const funnelQ = monthParam 
        ? `SELECT date(status_changed_at) as day, status, COUNT(*) as cnt FROM leads WHERE status_changed_at IS NOT NULL AND strftime('%Y-%m', status_changed_at) = ? GROUP BY day, status ORDER BY day`
        : `SELECT date(status_changed_at) as day, status, COUNT(*) as cnt FROM leads WHERE status_changed_at IS NOT NULL AND date(status_changed_at) >= date('now','-30 days') GROUP BY day, status ORDER BY day`;
      const funnelParams = monthParam ? [monthParam] : [];
      const funnelRes = await db.prepare(funnelQ).bind(...funnelParams).all();
      // Group by date
      const funnelMap: Record<string, Record<string, number>> = {};
      for (const r of (funnelRes.results || [])) {
        const day = r.day as string;
        const st = r.status as string;
        if (!funnelMap[day]) funnelMap[day] = {};
        funnelMap[day][st] = Number(r.cnt || 0);
      }
      funnelByDate = Object.entries(funnelMap).map(([day, statuses]) => ({ day, ...statuses }));
    } catch {}

    // ===== REVENUE FORECASTING =====
    // forecast = in_progress leads count * conversion_rate * avg_check
    const inProgressCount = statusData.in_progress?.count || 0;
    const historicalConvRate = totalLeadsCount > 0 ? doneCount / totalLeadsCount : 0;
    const revenueForecast = Math.round(inProgressCount * historicalConvRate * avgCheck);

    // ===== COHORT ANALYSIS (repeat customers by first contact month) =====
    let cohortData: any[] = [];
    try {
      const cohortQ = `SELECT strftime('%Y-%m', MIN(created_at)) as cohort_month,
        contact, COUNT(*) as orders, COALESCE(SUM(total_amount),0) as total_spent
        FROM leads WHERE contact IS NOT NULL AND contact != ''
        AND status IN ('done','in_progress','checking')
        GROUP BY contact HAVING orders > 0`;
      const cohortRes = await db.prepare(cohortQ).all();
      const cohortMap: Record<string, { customers: number; repeat: number; total_orders: number; total_revenue: number }> = {};
      for (const r of (cohortRes.results || [])) {
        const cm = r.cohort_month as string;
        if (!cohortMap[cm]) cohortMap[cm] = { customers: 0, repeat: 0, total_orders: 0, total_revenue: 0 };
        cohortMap[cm].customers++;
        cohortMap[cm].total_orders += Number(r.orders || 0);
        cohortMap[cm].total_revenue += Number(r.total_spent || 0);
        if (Number(r.orders) > 1) cohortMap[cm].repeat++;
      }
      cohortData = Object.entries(cohortMap).map(([month, data]) => ({
        month,
        ...data,
        repeat_rate: data.customers > 0 ? Math.round(data.repeat / data.customers * 1000) / 10 : 0,
        avg_orders: data.customers > 0 ? Math.round(data.total_orders / data.customers * 100) / 100 : 0,
        avg_revenue: data.customers > 0 ? Math.round(data.total_revenue / data.customers) : 0
      })).sort((a, b) => a.month.localeCompare(b.month));
    } catch {}

    // ===== OVERDUE LEADS NOTIFICATIONS (new > 24h without assignment) =====
    let overdueLeads: any[] = [];
    try {
      const overdueRes = await db.prepare(`SELECT id, lead_number, name, contact, source, created_at,
        ROUND((julianday('now') - julianday(created_at)) * 24, 1) as hours_since_creation
        FROM leads WHERE status = 'new' AND (assigned_to IS NULL OR assigned_to = 0)
        AND julianday('now') - julianday(created_at) > 1.0
        ORDER BY created_at ASC LIMIT 50`).all();
      overdueLeads = overdueRes.results || [];
    } catch {}

    return c.json({
      status_data: statusData,
      financial: {
        turnover, services: servicesTotal, articles: articlesTotal, packages: packagesTotal, articles_net: articlesNet, refunds: totalRefunds,
        salaries: totalSalaries, bonuses: totalBonuses, fines: totalFines, commercial_expenses: commercialExpenses,
        marketing_expenses: marketingExpenses, total_expenses: allExpensesSum,
        net_profit: netProfit, marginality, roi, romi,
        avg_check: avgCheck, conversion_rate: conversionRate,
        break_even: breakEven, avg_fulfillment_days: avgFulfillmentDays,
        done_amount: doneAmount, done_services: doneServices, done_articles: doneArticles,
        vacation_paid_amount: totalVacPaidAmount, vacation_paid_days: totalVacPaidDays, vacation_unpaid_days: totalVacUnpaidDays,
      },
      daily: dailyResults,
      by_assignee: byAssignee,
      by_source: bySource,
      services: serviceList,
      referrals: refResults,
      promo_costs: promoCodeCosts,
      total_discount_cost: totalDiscountCost,
      total_discount_leads: totalDiscountLeads,
      total_free_services_value: totalFreeServicesValue,
      services_before_discount: servicesBeforeDiscount,
      ref_code_services: refCodeServices,
      monthly_discounts: monthlyDiscounts,
      employees,
      rejected_leads: rejectedLeads,
      stage_timings: stageTimings,
      monthly_data: monthlyData,
      weekly_data: weeklyData,
      month_daily_data: monthDailyData,
      ltv_data: ltvData,
      commission_data: commissionData,
      packages: packagesList,
      packages_total_revenue: totalPkgRevenue,
      packages_total_count: totalPkgCount,
      total_leads: totalLeadsCount,
      // New KPIs
      kpi: {
        cac, roas,
        revenue_forecast: revenueForecast,
        in_progress_count: inProgressCount,
        historical_conversion_rate: Math.round(historicalConvRate * 1000) / 10,
      },
      funnel_by_date: funnelByDate,
      cohort_data: cohortData,
      overdue_leads: overdueLeads,
      date_from: dateFrom,
      date_to: dateTo,
      month: monthParam,
    });
  } catch (err: any) {
    console.error('Business analytics error:', err?.message || err);
    return c.json({
      status_data: {}, financial: {}, daily: [], by_assignee: [], by_source: {},
      services: [], referrals: [], employees: [], total_leads: 0,
      promo_costs: {}, total_discount_cost: 0, total_discount_leads: 0,
      services_before_discount: 0, ref_code_services: {}, monthly_discounts: {},
      date_from: '', date_to: '', month: '', error: 'Analytics error: ' + (err?.message || 'unknown')
    });
  }
});

}
