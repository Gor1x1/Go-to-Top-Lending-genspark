/**
 * Admin API — Leads CRM — CRUD, analytics, comments, CSV export
 */
import { Hono } from 'hono'
import { verifyToken } from '../../lib/auth'

type Bindings = { DB: D1Database }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: AuthMiddleware) {
// ===== LEADS CRM =====
api.get('/leads', authMiddleware, async (c) => {
  const db = c.env.DB;
  const status = c.req.query('status');
  const source = c.req.query('source');
  const limit = parseInt(c.req.query('limit') || '200');
  const offset = parseInt(c.req.query('offset') || '0');
  let sql = 'SELECT l.*, u.display_name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id';
  const conditions: string[] = [];
  const params: any[] = [];
  if (status && status !== 'all') { conditions.push('l.status = ?'); params.push(status); }
  if (source && source !== 'all') { conditions.push('l.source = ?'); params.push(source); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const res = await db.prepare(sql).bind(...params).all();
  const total = await db.prepare('SELECT COUNT(*) as count FROM leads').first();
  return c.json({ leads: res.results, total: total?.count || 0 });
});

// CSV Export — token via query param for universal download support
api.get('/leads/export', async (c) => {
  const db = c.env.DB;
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.query('token') || '';
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const payload = await verifyToken(token, c.env);
    if (!payload) return c.json({ error: 'Unauthorized' }, 401);
  } catch { return c.json({ error: 'Unauthorized' }, 401); }
  const res = await db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  const leads = res.results;
  let csv = '\uFEFFID,Source,Name,Contact,Language,Status,Notes,Referral,Total,Refund,Created\n';
  for (const l of leads) {
    csv += [l.id, l.source, `"${(l.name as string || '').replace(/"/g, '""')}"`, `"${(l.contact as string || '').replace(/"/g, '""')}"`,
      l.lang, l.status,
      `"${(l.notes as string || '').replace(/"/g, '""')}"`, l.referral_code, l.total_amount, l.refund_amount || 0, l.created_at].join(',') + '\n';
  }
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads_export.csv"'
    }
  });
});

api.put('/leads/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  // Track old values for audit log
  let oldLead: any = null;
  if (d.status !== undefined || d.total_amount !== undefined || d.referral_code !== undefined || d.refund_amount !== undefined) {
    oldLead = await db.prepare('SELECT status, total_amount, referral_code, refund_amount, assigned_to FROM leads WHERE id = ?').bind(id).first();
  }
  if (d.status !== undefined) {
    fields.push('status=?'); vals.push(d.status);
    // BUG-FIX: Track status_changed_at when status changes
    if (!oldLead || oldLead.status !== d.status) {
      fields.push('status_changed_at=CURRENT_TIMESTAMP');
    }
    // BUG-FIX: Track completed_at when lead is marked as done
    if (d.status === 'done') {
      fields.push('completed_at=CURRENT_TIMESTAMP');
    }
  }
  if (d.notes !== undefined) { fields.push('notes=?'); vals.push(d.notes); }
  if (d.assigned_to !== undefined) { fields.push('assigned_to=?'); vals.push(d.assigned_to || null); }
  if (d.name !== undefined) { fields.push('name=?'); vals.push(d.name); }
  if (d.contact !== undefined) { fields.push('contact=?'); vals.push(d.contact); }
  if (d.product !== undefined) { fields.push('product=?'); vals.push(d.product); }
  if (d.service !== undefined) { fields.push('service=?'); vals.push(d.service); }
  if (d.message !== undefined) { fields.push('message=?'); vals.push(d.message); }
  if (d.total_amount !== undefined) { fields.push('total_amount=?'); vals.push(d.total_amount); }
  if (d.calc_data !== undefined) { fields.push('calc_data=?'); vals.push(d.calc_data); }
  if (d.referral_code !== undefined) { fields.push('referral_code=?'); vals.push(d.referral_code); }
  if (d.custom_fields !== undefined) { fields.push('custom_fields=?'); vals.push(d.custom_fields); }
  if (d.telegram_group !== undefined) { fields.push('telegram_group=?'); vals.push(d.telegram_group); }
  if (d.tz_link !== undefined) { fields.push('tz_link=?'); vals.push(d.tz_link); }
  if (d.refund_amount !== undefined) { fields.push('refund_amount=?'); vals.push(d.refund_amount); }
  if (d.payment_method_id !== undefined) { fields.push('payment_method_id=?'); vals.push(d.payment_method_id); }
  if (d.source !== undefined) { fields.push('source=?'); vals.push(d.source); }
  if (d.email !== undefined) { fields.push('email=?'); vals.push(d.email); }
  if (d.lang !== undefined) { fields.push('lang=?'); vals.push(d.lang); }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  vals.push(id);
  await db.prepare(`UPDATE leads SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  // Audit log for significant changes
  try {
    const caller = c.get('user');
    const userName = caller?.display_name || caller?.username || 'System';
    const changes: string[] = [];
    if (d.status !== undefined && oldLead && oldLead.status !== d.status) changes.push(`status: ${oldLead.status} -> ${d.status}`);
    if (d.total_amount !== undefined && oldLead && oldLead.total_amount !== d.total_amount) changes.push(`amount: ${oldLead.total_amount} -> ${d.total_amount}`);
    if (d.refund_amount !== undefined && oldLead && oldLead.refund_amount !== d.refund_amount) changes.push(`refund: ${oldLead.refund_amount || 0} -> ${d.refund_amount}`);
    if (d.assigned_to !== undefined && oldLead && oldLead.assigned_to !== d.assigned_to) changes.push(`assigned: ${oldLead.assigned_to || 'none'} -> ${d.assigned_to || 'none'}`);
    if (changes.length > 0) {
      await db.prepare('INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, old_value, new_value) VALUES (?,?,?,?,?,?,?)')
        .bind(caller?.sub || 0, userName, 'lead_update', 'lead', Number(id), JSON.stringify(oldLead || {}), JSON.stringify(changes)).run();
    }
  } catch {}
  return c.json({ success: true });
});

api.post('/leads', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  // Get next lead number
  const lastLead = await db.prepare('SELECT MAX(lead_number) as max_num FROM leads').first();
  const nextNum = ((lastLead?.max_num as number) || 0) + 1;
  await db.prepare('INSERT INTO leads (lead_number, source, name, contact, product, service, message, lang, total_amount, calc_data, referral_code, custom_fields, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(nextNum, d.source || 'manual', d.name || '', d.contact || '', d.product || '', d.service || '', '', d.lang || 'ru', d.total_amount || 0, d.calc_data || '', d.referral_code || '', d.custom_fields || '', d.message || '').run();
  // Increment referral code usage counter if code was used
  if (d.referral_code) {
    try { await db.prepare("UPDATE referral_codes SET uses_count = uses_count + 1 WHERE code = ? AND is_active = 1").bind(d.referral_code).run(); } catch {}
  }
  return c.json({ success: true });
});

api.get('/leads/analytics', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
  const url = new URL(c.req.url);
  const dateFrom = url.searchParams.get('from') || '';
  const dateTo = url.searchParams.get('to') || '';
  
  let dateFilter = '';
  const dateParams: string[] = [];
  if (dateFrom) { dateFilter += " AND date(created_at) >= ?"; dateParams.push(dateFrom); }
  if (dateTo) { dateFilter += " AND date(created_at) <= ?"; dateParams.push(dateTo); }
  
  // Total stats — use simple queries with fallbacks for missing columns
  const total = await db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE 1=1' + dateFilter).bind(...dateParams).first().catch(() => ({ count: 0, amount: 0 }));
  const todayCount = await db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) = date('now')").first().catch(() => ({ count: 0, amount: 0 }));
  const weekCount = await db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now','-7 days')").first().catch(() => ({ count: 0, amount: 0 }));
  const monthCount = await db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now','-30 days')").first().catch(() => ({ count: 0, amount: 0 }));
  
  // By status (with date filter)
  let byStatus: Record<string, any> = {};
  try {
    const byStatusRes = await db.prepare("SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE 1=1" + dateFilter + " GROUP BY status").bind(...dateParams).all();
    for (const r of byStatusRes.results) { byStatus[r.status as string] = { count: r.count, amount: r.amount }; }
  } catch {}
  
  // By source (with date filter)
  let bySource: Record<string, any> = {};
  try {
    const bySourceRes = await db.prepare("SELECT source, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE 1=1" + dateFilter + " GROUP BY source").bind(...dateParams).all();
    for (const r of bySourceRes.results) { bySource[r.source as string] = { count: r.count, amount: r.amount }; }
  } catch {}
  
  // By assignee (with date filter)
  const byAssignee: any[] = [];
  try {
    const byAssigneeRes = await db.prepare("SELECT l.assigned_to, u.display_name, COUNT(*) as count, COALESCE(SUM(l.total_amount),0) as amount FROM leads l LEFT JOIN users u ON l.assigned_to=u.id WHERE 1=1" + dateFilter.replace(/created_at/g, 'l.created_at') + " GROUP BY l.assigned_to").bind(...dateParams).all();
    for (const r of byAssigneeRes.results) { byAssignee.push({ user_id: r.assigned_to, name: r.display_name || 'Не назначен', count: r.count, amount: r.amount }); }
  } catch {}
  
  // Daily breakdown (last 30 days)
  let dailyResults: any[] = [];
  try {
    const dailyRes = await db.prepare("SELECT date(created_at) as day, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now','-30 days') GROUP BY date(created_at) ORDER BY day").all();
    dailyResults = dailyRes.results || [];
  } catch {}
  
  // Service popularity — parse calc_data from all leads + split services vs articles per status
  let allLeadsResults: any[] = [];
  try {
    const allLeadsRes = await db.prepare("SELECT id, calc_data, total_amount, status FROM leads WHERE 1=1" + dateFilter).bind(...dateParams).all();
    allLeadsResults = allLeadsRes.results || [];
  } catch {}
  const serviceStats: Record<string, { count: number; qty: number; revenue: number }> = {};
  const statusAmounts: Record<string, { services: number; articles: number }> = {};
  for (const lead of allLeadsResults) {
    const st = lead.status as string || 'new';
    if (!statusAmounts[st]) statusAmounts[st] = { services: 0, articles: 0 };
    try {
      const cd = JSON.parse((lead.calc_data as string) || '{}');
      if (cd.items && Array.isArray(cd.items)) {
        for (const item of cd.items) {
          if (item.wb_article) {
            statusAmounts[st].articles += Number(item.subtotal || 0);
          } else {
            const name = item.name || 'Неизвестно';
            if (!serviceStats[name]) serviceStats[name] = { count: 0, qty: 0, revenue: 0 };
            serviceStats[name].count++;
            serviceStats[name].qty += Number(item.qty || 1);
            serviceStats[name].revenue += Number(item.subtotal || 0);
            statusAmounts[st].services += Number(item.subtotal || 0);
          }
        }
      }
    } catch {}
  }
  // Get articles totals per lead from lead_articles table
  try {
    const articlesPerLead = await db.prepare("SELECT la.lead_id, SUM(la.total_price) as art_total FROM lead_articles la JOIN leads l ON la.lead_id = l.id WHERE 1=1" + dateFilter.replace(/created_at/g, 'l.created_at') + " GROUP BY la.lead_id").bind(...dateParams).all();
    for (const ar of articlesPerLead.results) {
      const lead = allLeadsResults.find((l: any) => l.id === ar.lead_id);
      const st = (lead?.status as string) || 'new';
      if (!statusAmounts[st]) statusAmounts[st] = { services: 0, articles: 0 };
      statusAmounts[st].articles += Number(ar.art_total || 0);
    }
  } catch {}
  const serviceList = Object.entries(serviceStats).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.revenue - a.revenue);
  
  // Package popularity from calc_data
  const packageStats: Record<string, { count: number; revenue: number; package_name: string }> = {};
  for (const lead of allLeadsResults) {
    try {
      const cd = JSON.parse((lead.calc_data as string) || '{}');
      if (cd.package) {
        const pName = cd.package.name || 'Unknown';
        const pId = String(cd.package.package_id || pName);
        if (!packageStats[pId]) packageStats[pId] = { count: 0, revenue: 0, package_name: pName };
        packageStats[pId].count++;
        packageStats[pId].revenue += Number(cd.package.package_price || 0);
      }
    } catch {}
  }
  const packageList = Object.values(packageStats).sort((a, b) => b.revenue - a.revenue);
  
  // Conversion funnel
  const statusCounts = {
    new: (byStatus.new?.count || 0),
    contacted: (byStatus.contacted?.count || 0),
    in_progress: (byStatus.in_progress?.count || 0),
    checking: (byStatus.checking?.count || 0),
    done: (byStatus.done?.count || 0),
    rejected: (byStatus.rejected?.count || 0),
  };
  const conversionRate = (total?.count || 0) > 0 ? ((statusCounts.done / (total?.count || 1)) * 100).toFixed(1) : '0';
  const avgCheck = statusCounts.done > 0 ? Math.round((byStatus.done?.amount || 0) / statusCounts.done) : 0;
  
  // Referral stats — with discount cost calculation
  let refResults: any[] = [];
  let totalDiscountCost = 0;
  try {
    const refRes = await db.prepare("SELECT referral_code, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE referral_code != '' AND referral_code IS NOT NULL" + dateFilter + " GROUP BY referral_code ORDER BY count DESC").bind(...dateParams).all();
    refResults = refRes.results || [];
  } catch {}
  
  // Calculate actual discount amounts from calc_data for each lead with a promo code
  const promoCodeCosts: Record<string, { count: number; discount_total: number; revenue: number; code_details?: any }> = {};
  for (const lead of allLeadsResults) {
    const rc = lead.referral_code as string;
    if (!rc) continue;
    if (!promoCodeCosts[rc]) promoCodeCosts[rc] = { count: 0, discount_total: 0, revenue: 0 };
    promoCodeCosts[rc].count++;
    promoCodeCosts[rc].revenue += Number(lead.total_amount || 0);
    try {
      const cd = JSON.parse((lead.calc_data as string) || '{}');
      const da = Number(cd.discountAmount || 0);
      promoCodeCosts[rc].discount_total += da;
      totalDiscountCost += da;
    } catch {}
  }
  // Enrich with referral_codes table data
  try {
    const allCodes = await db.prepare("SELECT * FROM referral_codes").all();
    for (const code of (allCodes.results || [])) {
      const key = code.code as string;
      if (promoCodeCosts[key]) {
        promoCodeCosts[key].code_details = { discount_percent: code.discount_percent, uses_count: code.uses_count, is_active: code.is_active, description: code.description };
      }
    }
  } catch {}
  
  return c.json({
    total: { count: total?.count || 0, amount: total?.amount || 0 },
    today: { count: todayCount?.count || 0, amount: todayCount?.amount || 0 },
    week: { count: weekCount?.count || 0, amount: weekCount?.amount || 0 },
    month: { count: monthCount?.count || 0, amount: monthCount?.amount || 0 },
    by_status: byStatus,
    by_source: bySource,
    by_assignee: byAssignee,
    daily: dailyResults,
    services: serviceList,
    packages: packageList,
    status_amounts: statusAmounts,
    conversion_rate: conversionRate,
    avg_check: avgCheck,
    referrals: refResults,
    promo_costs: promoCodeCosts,
    total_discount_cost: totalDiscountCost,
    date_from: dateFrom,
    date_to: dateTo,
  });
  } catch (err: any) {
    // Top-level catch: if the whole analytics crashes, return empty data instead of 500
    console.error('Analytics error:', err?.message || err);
    return c.json({
      total: { count: 0, amount: 0 }, today: { count: 0, amount: 0 },
      week: { count: 0, amount: 0 }, month: { count: 0, amount: 0 },
      by_status: {}, by_source: {}, by_assignee: [], daily: [],
      services: [], status_amounts: {}, conversion_rate: '0', avg_check: 0,
      referrals: [], date_from: '', date_to: '', error: 'Analytics temporarily unavailable: ' + (err?.message || 'unknown error')
    });
  }
});

// ===== LEAD COMMENTS =====
api.get('/leads/:id/comments', authMiddleware, async (c) => {
  const db = c.env.DB;
  const leadId = c.req.param('id');
  const res = await db.prepare('SELECT * FROM lead_comments WHERE lead_id = ? ORDER BY created_at DESC').bind(leadId).all();
  return c.json(res.results);
});

api.post('/leads/:id/comments', authMiddleware, async (c) => {
  const db = c.env.DB;
  const leadId = c.req.param('id');
  const { comment } = await c.req.json();
  // Get current user from token
  const auth = c.req.header('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  let userName = 'Система';
  let userId = 0;
  try {
    const payload = await verifyToken(token, c.env);
    if (payload) {
      userId = Number(payload.sub) || 0;
      const user = await db.prepare('SELECT display_name FROM users WHERE id = ?').bind(userId).first();
      userName = (user?.display_name as string) || 'Пользователь';
    }
  } catch {}
  await db.prepare('INSERT INTO lead_comments (lead_id, user_id, user_name, comment) VALUES (?,?,?,?)').bind(leadId, userId, userName, comment).run();
  return c.json({ success: true });
});

api.delete('/leads/comments/:commentId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const commentId = c.req.param('commentId');
  await db.prepare('DELETE FROM lead_comments WHERE id = ?').bind(commentId).run();
  return c.json({ success: true });
});

api.delete('/leads/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM leads WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

}
