/**
 * Admin API — Dashboard statistics and analytics
 */
import { Hono } from 'hono'

type Bindings = { DB: D1Database }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: AuthMiddleware) {
// ===== DASHBOARD STATS =====
api.get('/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const content = await db.prepare('SELECT COUNT(*) as count FROM site_content').first();
  const services = await db.prepare('SELECT COUNT(*) as count FROM calculator_services').first();
  const messages = await db.prepare('SELECT COUNT(*) as count FROM telegram_messages').first();
  const scripts = await db.prepare('SELECT COUNT(*) as count FROM custom_scripts').first();
  
  // Leads stats
  const totalLeads = await db.prepare('SELECT COUNT(*) as count FROM leads').first().catch(() => ({ count: 0 }));
  const newLeads = await db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'new'").first().catch(() => ({ count: 0 }));
  const todayLeads = await db.prepare("SELECT COUNT(*) as count FROM leads WHERE date(created_at) = date('now')").first().catch(() => ({ count: 0 }));
  
  // Analytics data
  const todayViews = await db.prepare("SELECT COUNT(*) as count FROM page_views WHERE date(created_at) = date('now')").first().catch(() => ({ count: 0 }));
  const weekViews = await db.prepare("SELECT COUNT(*) as count FROM page_views WHERE created_at >= datetime('now', '-7 days')").first().catch(() => ({ count: 0 }));
  const monthViews = await db.prepare("SELECT COUNT(*) as count FROM page_views WHERE created_at >= datetime('now', '-30 days')").first().catch(() => ({ count: 0 }));
  const totalViews = await db.prepare("SELECT COUNT(*) as count FROM page_views").first().catch(() => ({ count: 0 }));
  
  // Views by day (last 7 days)
  const dailyViews = await db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count 
    FROM page_views 
    WHERE created_at >= datetime('now', '-7 days') 
    GROUP BY date(created_at) 
    ORDER BY day DESC
  `).all().catch(() => ({ results: [] }));
  
  // Top referrers
  const topReferrers = await db.prepare(`
    SELECT referrer, COUNT(*) as count 
    FROM page_views 
    WHERE referrer != '' AND created_at >= datetime('now', '-30 days')
    GROUP BY referrer ORDER BY count DESC LIMIT 10
  `).all().catch(() => ({ results: [] }));
  
  // Language stats
  const langStats = await db.prepare(`
    SELECT lang, COUNT(*) as count 
    FROM page_views 
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY lang ORDER BY count DESC
  `).all().catch(() => ({ results: [] }));
  
  // Active referral codes
  const refCodes = await db.prepare("SELECT COUNT(*) as count FROM referral_codes WHERE is_active = 1").first().catch(() => ({ count: 0 }));
  
  // ===== DASHBOARD FINANCIAL METRICS =====
  // Lead status breakdown with amounts
  const statusBreakdown = await db.prepare(`
    SELECT status, COUNT(*) as count, 
           COALESCE(SUM(total_amount),0) as amount,
           COALESCE(SUM(commission_amount),0) as commission
    FROM leads GROUP BY status
  `).all().catch(() => ({ results: [] }));
  
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
  
  // Turnover (in_progress + checking + done)
  const dashTurnover = allLeadsAmount;
  const dashCommissions = allLeadsCommission;
  
  // Done amounts
  const dashDoneAmount = statusMap.done?.amount || 0;
  const dashDoneCount = statusMap.done?.count || 0;
  
  // Conversion: done / total leads
  const dashTotalLeadsCount = Object.values(statusMap).reduce((s, v) => s + v.count, 0);
  const dashConversion = dashTotalLeadsCount > 0 ? Math.round((dashDoneCount / dashTotalLeadsCount) * 1000) / 10 : 0;
  
  // Average check (from done leads)
  const dashAvgCheck = dashDoneCount > 0 ? Math.round(dashDoneAmount / dashDoneCount) : 0;
  
  // Refunds total
  const dashRefunds = await db.prepare("SELECT COALESCE(SUM(refund_amount),0) as total FROM leads WHERE refund_amount > 0 AND status IN ('in_progress','checking','done')").first().catch(() => ({ total: 0 }));
  
  // Expenses (monthly)
  const dashExpenses = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE is_active = 1").first().catch(() => ({ total: 0 }));
  const dashMarketingExp = await db.prepare("SELECT COALESCE(SUM(e.amount),0) as total FROM expenses e JOIN expense_categories ec ON e.category_id = ec.id WHERE e.is_active = 1 AND ec.is_marketing = 1").first().catch(() => ({ total: 0 }));
  
  // Net profit (simplified: turnover - expenses - refunds)
  const dashNetProfit = dashTurnover - Number(dashExpenses?.total || 0) - Number(dashRefunds?.total || 0);
  
  // Leads this week vs last week (for trend)
  const leadsThisWeek = await db.prepare("SELECT COUNT(*) as count FROM leads WHERE created_at >= datetime('now', '-7 days')").first().catch(() => ({ count: 0 }));
  const leadsLastWeek = await db.prepare("SELECT COUNT(*) as count FROM leads WHERE created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')").first().catch(() => ({ count: 0 }));
  
  // Leads by source
  const leadsBySource = await db.prepare("SELECT COALESCE(source, 'unknown') as source, COUNT(*) as count FROM leads GROUP BY source ORDER BY count DESC").all().catch(() => ({ results: [] }));
  
  // Leads by assignee (active leads only)
  const leadsByAssignee = await db.prepare("SELECT u.display_name, COUNT(*) as count, COALESCE(SUM(l.total_amount),0) as amount FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.status IN ('new','contacted','in_progress','checking') GROUP BY l.assigned_to ORDER BY count DESC").all().catch(() => ({ results: [] }));
  
  // Payment methods usage
  const pmUsage = await db.prepare("SELECT pm.name_ru, pm.commission_pct, COUNT(*) as count, COALESCE(SUM(l.commission_amount),0) as total_commission FROM leads l JOIN payment_methods pm ON l.payment_method_id = pm.id GROUP BY l.payment_method_id ORDER BY count DESC").all().catch(() => ({ results: [] }));
  
  // Recent leads (last 5)
  const recentLeads = await db.prepare("SELECT id, name, contact, status, total_amount, commission_amount, source, created_at FROM leads ORDER BY created_at DESC LIMIT 5").all().catch(() => ({ results: [] }));
  
  // Leads today breakdown by hour
  const leadsToday = await db.prepare("SELECT strftime('%H', created_at) as hour, COUNT(*) as count FROM leads WHERE date(created_at) = date('now') GROUP BY hour ORDER BY hour").all().catch(() => ({ results: [] }));

  return c.json({
    content_sections: content?.count || 0,
    calculator_services: services?.count || 0,
    telegram_buttons: messages?.count || 0,
    custom_scripts: scripts?.count || 0,
    referral_codes: refCodes?.count || 0,
    leads: {
      total: totalLeads?.count || 0,
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
    // Dashboard financial data
    dashboard: {
      status_breakdown: statusMap,
      turnover: dashTurnover,
      commissions: dashCommissions,
      done_amount: dashDoneAmount,
      done_count: dashDoneCount,
      conversion: dashConversion,
      avg_check: dashAvgCheck,
      refunds: Number(dashRefunds?.total || 0),
      total_expenses: Number(dashExpenses?.total || 0),
      marketing_expenses: Number(dashMarketingExp?.total || 0),
      net_profit: dashNetProfit,
      leads_this_week: Number(leadsThisWeek?.count || 0),
      leads_last_week: Number(leadsLastWeek?.count || 0),
      leads_by_source: leadsBySource?.results || [],
      leads_by_assignee: leadsByAssignee?.results || [],
      payment_methods: pmUsage?.results || [],
      recent_leads: recentLeads?.results || [],
      leads_today_hours: leadsToday?.results || []
    }
  });
});
}
