/**
 * Admin API — Dashboard statistics and analytics
 * Supports period filtering: ?period=all|month|week|today|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
import { Hono } from 'hono'

type Bindings = { DB: D1Database }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: AuthMiddleware) {
// ===== DASHBOARD STATS =====
api.get('/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const period = c.req.query('period') || 'all'; // all | month | week | today | custom
  const from = c.req.query('from') || '';
  const to = c.req.query('to') || '';

  // Build date filter for leads based on period
  let dateFilter = '';
  let dateParams: string[] = [];
  if (period === 'today') {
    dateFilter = " AND date(l.created_at) = date('now')";
  } else if (period === 'week') {
    dateFilter = " AND l.created_at >= datetime('now', '-7 days')";
  } else if (period === 'month') {
    dateFilter = " AND l.created_at >= datetime('now', '-30 days')";
  } else if (period === 'custom' && from && to) {
    dateFilter = " AND date(l.created_at) >= ? AND date(l.created_at) <= ?";
    dateParams = [from, to];
  }
  // For non-lead tables that use different alias
  const dateFilterRaw = dateFilter.replace(/l\.created_at/g, 'created_at');

  // ===== BATCH 1: Simple counts (parallel) =====
  const [content, services, messages, scripts, refCodes, totalLeadsAll, newLeads, todayLeads] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM site_content').first().catch(() => ({ count: 0 })),
    db.prepare('SELECT COUNT(*) as count FROM calculator_services').first().catch(() => ({ count: 0 })),
    db.prepare('SELECT COUNT(*) as count FROM telegram_messages').first().catch(() => ({ count: 0 })),
    db.prepare('SELECT COUNT(*) as count FROM custom_scripts').first().catch(() => ({ count: 0 })),
    db.prepare("SELECT COUNT(*) as count FROM referral_codes WHERE is_active = 1").first().catch(() => ({ count: 0 })),
    db.prepare('SELECT COUNT(*) as count FROM leads').first().catch(() => ({ count: 0 })),
    db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'new'").first().catch(() => ({ count: 0 })),
    db.prepare("SELECT COUNT(*) as count FROM leads WHERE date(created_at) = date('now')").first().catch(() => ({ count: 0 }))
  ]);

  // ===== BATCH 2: Analytics (parallel) =====
  const [todayViews, weekViews, monthViews, totalViews, dailyViews, topReferrers, langStats] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM page_views WHERE date(created_at) = date('now')").first().catch(() => ({ count: 0 })),
    db.prepare("SELECT COUNT(*) as count FROM page_views WHERE created_at >= datetime('now', '-7 days')").first().catch(() => ({ count: 0 })),
    db.prepare("SELECT COUNT(*) as count FROM page_views WHERE created_at >= datetime('now', '-30 days')").first().catch(() => ({ count: 0 })),
    db.prepare("SELECT COUNT(*) as count FROM page_views").first().catch(() => ({ count: 0 })),
    db.prepare("SELECT date(created_at) as day, COUNT(*) as count FROM page_views WHERE created_at >= datetime('now', '-7 days') GROUP BY date(created_at) ORDER BY day DESC").all().catch(() => ({ results: [] })),
    db.prepare("SELECT referrer, COUNT(*) as count FROM page_views WHERE referrer != '' AND created_at >= datetime('now', '-30 days') GROUP BY referrer ORDER BY count DESC LIMIT 10").all().catch(() => ({ results: [] })),
    db.prepare("SELECT lang, COUNT(*) as count FROM page_views WHERE created_at >= datetime('now', '-30 days') GROUP BY lang ORDER BY count DESC").all().catch(() => ({ results: [] }))
  ]);

  // ===== BATCH 3: Dashboard financial (with period filter, parallel) =====
  // Status breakdown with date filter
  const statusSQL = "SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount, COALESCE(SUM(commission_amount),0) as commission FROM leads l WHERE 1=1" + dateFilter + " GROUP BY status";
  const refundSQL = "SELECT COALESCE(SUM(refund_amount),0) as total FROM leads l WHERE refund_amount > 0 AND status IN ('in_progress','checking','done')" + dateFilter;
  // Articles from lead_articles for active leads
  const artSQL = "SELECT COALESCE(SUM(la.total_price),0) as total FROM lead_articles la JOIN leads l ON la.lead_id = l.id WHERE l.status IN ('in_progress','checking','done')" + dateFilter;
  const curPeriod = new Date().toISOString().slice(0, 7);
  
  const [statusBreakdown, dashRefunds, dashExpenses, dashMarketingExp, leadsThisWeek, leadsLastWeek, leadsBySource, leadsByAssignee, pmUsage, recentLeads, leadsToday, dailyLeads, dashSvcPkg] = await Promise.all([
    (dateParams.length > 0
      ? db.prepare(statusSQL).bind(...dateParams)
      : db.prepare(statusSQL)
    ).all().catch(() => ({ results: [] })),
    (dateParams.length > 0
      ? db.prepare(refundSQL).bind(...dateParams)
      : db.prepare(refundSQL)
    ).first().catch(() => ({ total: 0 })),
    db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE is_active = 1 AND (start_date IS NULL OR start_date = '' OR start_date <= ?) AND (end_date IS NULL OR end_date = '' OR end_date >= ?)").bind(curPeriod + '-31', curPeriod + '-01').first().catch(() => ({ total: 0 })),
    db.prepare("SELECT COALESCE(SUM(e.amount),0) as total FROM expenses e JOIN expense_categories ec ON e.category_id = ec.id WHERE e.is_active = 1 AND ec.is_marketing = 1 AND (e.start_date IS NULL OR e.start_date = '' OR e.start_date <= ?) AND (e.end_date IS NULL OR e.end_date = '' OR e.end_date >= ?)").bind(curPeriod + '-31', curPeriod + '-01').first().catch(() => ({ total: 0 })),
    db.prepare("SELECT COUNT(*) as count FROM leads WHERE created_at >= datetime('now', '-7 days')").first().catch(() => ({ count: 0 })),
    db.prepare("SELECT COUNT(*) as count FROM leads WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')").first().catch(() => ({ count: 0 })),
    (dateParams.length > 0
      ? db.prepare("SELECT COALESCE(source, 'unknown') as source, COUNT(*) as count FROM leads l WHERE 1=1" + dateFilter + " GROUP BY source ORDER BY count DESC").bind(...dateParams)
      : db.prepare("SELECT COALESCE(source, 'unknown') as source, COUNT(*) as count FROM leads l WHERE 1=1" + dateFilter + " GROUP BY source ORDER BY count DESC")
    ).all().catch(() => ({ results: [] })),
    db.prepare("SELECT u.display_name, l.assigned_to, COUNT(*) as count, COALESCE(SUM(l.total_amount),0) as amount FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.status IN ('new','contacted','in_progress','checking') GROUP BY l.assigned_to ORDER BY count DESC").all().catch(() => ({ results: [] })),
    (dateParams.length > 0
      ? db.prepare("SELECT pm.name_ru, pm.commission_pct, COUNT(*) as count, COALESCE(SUM(l.commission_amount),0) as total_commission FROM leads l JOIN payment_methods pm ON l.payment_method_id = pm.id WHERE 1=1" + dateFilter + " GROUP BY l.payment_method_id ORDER BY count DESC").bind(...dateParams)
      : db.prepare("SELECT pm.name_ru, pm.commission_pct, COUNT(*) as count, COALESCE(SUM(l.commission_amount),0) as total_commission FROM leads l JOIN payment_methods pm ON l.payment_method_id = pm.id WHERE 1=1" + dateFilter + " GROUP BY l.payment_method_id ORDER BY count DESC")
    ).all().catch(() => ({ results: [] })),
    db.prepare("SELECT id, name, contact, status, total_amount, commission_amount, source, created_at FROM leads ORDER BY created_at DESC LIMIT 5").all().catch(() => ({ results: [] })),
    db.prepare("SELECT strftime('%H', created_at) as hour, COUNT(*) as count FROM leads WHERE date(created_at) = date('now') GROUP BY hour ORDER BY hour").all().catch(() => ({ results: [] })),
    // Daily leads for last 14 days (for chart)
    db.prepare("SELECT date(created_at) as day, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE created_at >= datetime('now', '-14 days') GROUP BY date(created_at) ORDER BY day DESC").all().catch(() => ({ results: [] })),
    // Articles total
    (dateParams.length > 0
      ? db.prepare(artSQL).bind(...dateParams)
      : db.prepare(artSQL)
    ).first().catch(() => null)
  ]);

  // Process status breakdown
  const statusMap: Record<string, { count: number; amount: number; commission: number }> = {};
  let allLeadsAmount = 0, allLeadsCommission = 0;
  for (const r of (statusBreakdown.results || [])) {
    const st = (r.status as string) || 'new';
    statusMap[st] = { count: Number(r.count || 0), amount: Number(r.amount || 0), commission: Number(r.commission || 0) };
    if (['in_progress', 'checking', 'done'].includes(st)) {
      allLeadsAmount += Number(r.amount || 0);
      allLeadsCommission += Number(r.commission || 0);
    }
  }
  
  const dashTurnover = allLeadsAmount;
  const dashCommissions = allLeadsCommission;
  const dashDoneAmount = statusMap.done?.amount || 0;
  const dashDoneCount = statusMap.done?.count || 0;
  const dashTotalLeadsCount = Object.values(statusMap).reduce((s, v) => s + v.count, 0);
  const dashConversion = dashTotalLeadsCount > 0 ? Math.round((dashDoneCount / dashTotalLeadsCount) * 1000) / 10 : 0;
  const dashAvgCheck = dashDoneCount > 0 ? Math.round(dashDoneAmount / dashDoneCount) : 0;
  const dashArticlesRev = Number(dashSvcPkg?.total || 0);
  const dashServicesAndPackages = dashTurnover - dashArticlesRev; // turnover minus articles = services + packages
  // Total expenses = expenses from table + salaries + bonuses
  const dashSalaries = await db.prepare("SELECT COALESCE(SUM(salary),0) as total FROM users WHERE salary > 0 AND is_active = 1").first().catch(() => ({ total: 0 }));
  const dashBonuses = await db.prepare("SELECT COALESCE(SUM(CASE WHEN bonus_type='bonus' OR (bonus_type IS NULL AND amount > 0) THEN amount ELSE 0 END),0) as bon, COALESCE(SUM(CASE WHEN bonus_type IN ('penalty','fine') OR (bonus_type IS NULL AND amount < 0) THEN ABS(amount) ELSE 0 END),0) as pen FROM employee_bonuses WHERE bonus_date >= ? AND bonus_date <= ?").bind(curPeriod + '-01', curPeriod + '-31').first().catch(() => ({ bon: 0, pen: 0 }));
  const dashTotalExp = Number(dashExpenses?.total || 0) + Number(dashSalaries?.total || 0) + Number(dashBonuses?.bon || 0) - Number(dashBonuses?.pen || 0);
  const dashNetProfit = dashServicesAndPackages - dashTotalExp;

  return c.json({
    period,
    content_sections: content?.count || 0,
    calculator_services: services?.count || 0,
    telegram_buttons: messages?.count || 0,
    custom_scripts: scripts?.count || 0,
    referral_codes: refCodes?.count || 0,
    leads: {
      total: totalLeadsAll?.count || 0,
      new: newLeads?.count || 0,
      today: todayLeads?.count || 0
    },
    analytics: {
      today: todayViews?.count || 0,
      week: weekViews?.count || 0,
      month: monthViews?.count || 0,
      total: totalViews?.count || 0,
      daily: dailyViews?.results || [],
      referrers: topReferrers?.results || [],
      languages: langStats?.results || []
    },
    dashboard: {
      status_breakdown: statusMap,
      turnover: dashTurnover,
      commissions: dashCommissions,
      done_amount: dashDoneAmount,
      done_count: dashDoneCount,
      total_leads_in_period: dashTotalLeadsCount,
      conversion: dashConversion,
      avg_check: dashAvgCheck,
      refunds: Number(dashRefunds?.total || 0),
      total_expenses: dashTotalExp,
      marketing_expenses: Number(dashMarketingExp?.total || 0),
      net_profit: dashNetProfit,
      leads_this_week: Number(leadsThisWeek?.count || 0),
      leads_last_week: Number(leadsLastWeek?.count || 0),
      leads_by_source: leadsBySource?.results || [],
      leads_by_assignee: leadsByAssignee?.results || [],
      payment_methods: pmUsage?.results || [],
      recent_leads: recentLeads?.results || [],
      leads_today_hours: leadsToday?.results || [],
      daily_leads: dailyLeads?.results || []
    }
  });
});
}
