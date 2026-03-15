/**
 * Admin API — Lead articles, company roles, expense categories/types, expenses, bonuses, salary, period snapshots
 */
import { Hono } from 'hono'
import { ALL_ROLES, ALL_SECTIONS, ROLE_LABELS, SECTION_LABELS, DEFAULT_PERMISSIONS } from '../../lib/db'

type Bindings = { DB: D1Database }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: AuthMiddleware) {
// ===== LEAD ARTICLES (WB артикулы привязанные к лидам) =====
api.get('/leads/:id/articles', authMiddleware, async (c) => {
  const db = c.env.DB;
  const leadId = c.req.param('id');
  const res = await db.prepare(`
    SELECT la.*, u.display_name as buyer_name 
    FROM lead_articles la 
    LEFT JOIN users u ON la.buyer_id = u.id 
    WHERE la.lead_id = ? 
    ORDER BY la.sort_order, la.id
  `).bind(leadId).all();
  return c.json({ articles: res.results || [] });
});

api.post('/leads/:id/articles', authMiddleware, async (c) => {
  const db = c.env.DB;
  const leadId = c.req.param('id');
  const d = await c.req.json();
  const totalPrice = (Number(d.price_per_unit) || 0) * (Number(d.quantity) || 1);
  await db.prepare(`INSERT INTO lead_articles (lead_id, wb_article, wb_link, product_name, size, color, quantity, price_per_unit, total_price, status, buyer_id, notes, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(leadId, d.wb_article || '', d.wb_link || '', d.product_name || '', d.size || '', d.color || '', d.quantity || 1, d.price_per_unit || 0, totalPrice, d.status || 'pending', d.buyer_id || null, d.notes || '', d.sort_order || 0).run();
  // Update articles count on lead
  await updateLeadArticlesCount(db, Number(leadId));
  return c.json({ success: true });
});

api.put('/leads/articles/:articleId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const articleId = c.req.param('articleId');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.wb_article !== undefined) { fields.push('wb_article=?'); vals.push(d.wb_article); }
  if (d.wb_link !== undefined) { fields.push('wb_link=?'); vals.push(d.wb_link); }
  if (d.product_name !== undefined) { fields.push('product_name=?'); vals.push(d.product_name); }
  if (d.size !== undefined) { fields.push('size=?'); vals.push(d.size); }
  if (d.color !== undefined) { fields.push('color=?'); vals.push(d.color); }
  if (d.quantity !== undefined) { fields.push('quantity=?'); vals.push(d.quantity); }
  if (d.price_per_unit !== undefined) { fields.push('price_per_unit=?'); vals.push(d.price_per_unit); }
  if (d.quantity !== undefined || d.price_per_unit !== undefined) {
    // Recalculate total_price
    const existing = await db.prepare('SELECT quantity, price_per_unit FROM lead_articles WHERE id = ?').bind(articleId).first();
    const qty = d.quantity !== undefined ? Number(d.quantity) : Number(existing?.quantity || 1);
    const ppu = d.price_per_unit !== undefined ? Number(d.price_per_unit) : Number(existing?.price_per_unit || 0);
    fields.push('total_price=?'); vals.push(qty * ppu);
  }
  if (d.status !== undefined) { fields.push('status=?'); vals.push(d.status); }
  if (d.buyer_id !== undefined) { fields.push('buyer_id=?'); vals.push(d.buyer_id || null); }
  if (d.notes !== undefined) { fields.push('notes=?'); vals.push(d.notes); }
  if (d.sort_order !== undefined) { fields.push('sort_order=?'); vals.push(d.sort_order); }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(articleId);
  await db.prepare(`UPDATE lead_articles SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  // Update articles count on parent lead
  const art = await db.prepare('SELECT lead_id FROM lead_articles WHERE id = ?').bind(articleId).first();
  if (art) await updateLeadArticlesCount(db, art.lead_id as number);
  return c.json({ success: true });
});

api.delete('/leads/articles/:articleId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const articleId = c.req.param('articleId');
  const art = await db.prepare('SELECT lead_id FROM lead_articles WHERE id = ?').bind(articleId).first();
  await db.prepare('DELETE FROM lead_articles WHERE id = ?').bind(articleId).run();
  if (art) await updateLeadArticlesCount(db, art.lead_id as number);
  return c.json({ success: true });
});

// Bulk update articles statuses
api.post('/leads/:id/articles/bulk-status', authMiddleware, async (c) => {
  const db = c.env.DB;
  const leadId = c.req.param('id');
  const { article_ids, status, buyer_id } = await c.req.json();
  if (!article_ids || !Array.isArray(article_ids) || !status) return c.json({ error: 'article_ids and status required' }, 400);
  for (const aid of article_ids) {
    const updates = ['status=?', 'updated_at=CURRENT_TIMESTAMP'];
    const params: any[] = [status];
    if (buyer_id !== undefined) { updates.push('buyer_id=?'); params.push(buyer_id || null); }
    params.push(aid);
    params.push(Number(leadId));
    await db.prepare(`UPDATE lead_articles SET ${updates.join(',')} WHERE id=? AND lead_id=?`).bind(...params).run();
  }
  await updateLeadArticlesCount(db, Number(leadId));
  return c.json({ success: true });
});

// Helper: update articles count cache on leads table
async function updateLeadArticlesCount(db: D1Database, leadId: number) {
  const total = await db.prepare('SELECT COUNT(*) as cnt FROM lead_articles WHERE lead_id = ?').bind(leadId).first();
  const done = await db.prepare("SELECT COUNT(*) as cnt FROM lead_articles WHERE lead_id = ? AND status IN ('delivered','completed')").bind(leadId).first();
  await db.prepare('UPDATE leads SET articles_count = ?, articles_done = ? WHERE id = ?')
    .bind(total?.cnt || 0, done?.cnt || 0, leadId).run();
}

// ===== ROLES CONFIG (for frontend) =====
api.get('/roles-config', authMiddleware, async (c) => {
  return c.json({ roles: ALL_ROLES, sections: ALL_SECTIONS, role_labels: ROLE_LABELS, section_labels: SECTION_LABELS, default_permissions: DEFAULT_PERMISSIONS });
});

// ===== COMPANY ROLES MANAGEMENT =====
api.get('/company-roles', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare('SELECT * FROM company_roles ORDER BY sort_order, id').all();
    // Ensure role_name is populated (fallback to role_label for legacy data)
    const roles = (res.results || []).map((r: any) => ({
      ...r,
      role_name: r.role_name || r.role_label || r.role_key || ''
    }));
    return c.json({ roles });
  } catch {
    return c.json({ roles: [] });
  }
});

api.post('/company-roles', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can manage roles' }, 403);
  const d = await c.req.json();
  if (!d.role_key || !d.role_name) return c.json({ error: 'role_key and role_name required' }, 400);
  const existing = await db.prepare('SELECT id FROM company_roles WHERE role_key = ?').bind(d.role_key).first();
  if (existing) return c.json({ error: 'Role key already exists' }, 400);
  await db.prepare('INSERT INTO company_roles (role_key, role_name, role_label, description, default_sections, color, is_system, sort_order) VALUES (?,?,?,?,?,?,0,?)')
    .bind(d.role_key, d.role_name, d.role_name, d.description || '', JSON.stringify(d.default_sections || ['dashboard']), d.color || '#8B5CF6', d.sort_order || 99).run();
  return c.json({ success: true });
});

api.put('/company-roles/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can manage roles' }, 403);
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.role_name !== undefined) { fields.push('role_name=?'); vals.push(d.role_name); fields.push('role_label=?'); vals.push(d.role_name); }
  if (d.description !== undefined) { fields.push('description=?'); vals.push(d.description); }
  if (d.default_sections !== undefined) { fields.push('default_sections=?'); vals.push(JSON.stringify(d.default_sections)); }
  if (d.color !== undefined) { fields.push('color=?'); vals.push(d.color); }
  if (d.is_active !== undefined) { fields.push('is_active=?'); vals.push(d.is_active ? 1 : 0); }
  if (d.sort_order !== undefined) { fields.push('sort_order=?'); vals.push(d.sort_order); }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  vals.push(id);
  await db.prepare(`UPDATE company_roles SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.delete('/company-roles/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can manage roles' }, 403);
  const id = c.req.param('id');
  // Don't allow deleting main_admin role
  const role = await db.prepare('SELECT role_key FROM company_roles WHERE id = ?').bind(id).first();
  if (role?.role_key === 'main_admin') return c.json({ error: 'Cannot delete main_admin role' }, 400);
  await db.prepare('DELETE FROM company_roles WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== EXPENSE CATEGORIES =====
api.get('/expense-categories', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare('SELECT * FROM expense_categories ORDER BY sort_order, id').all();
    return c.json({ categories: res.results || [] });
  } catch { return c.json({ categories: [] }); }
});

api.post('/expense-categories', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  if (!d.name) return c.json({ error: 'name required' }, 400);
  await db.prepare('INSERT INTO expense_categories (name, color, is_marketing, sort_order) VALUES (?,?,?,?)')
    .bind(d.name, d.color || '#8B5CF6', d.is_marketing ? 1 : 0, d.sort_order || 99).run();
  return c.json({ success: true });
});

api.put('/expense-categories/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = []; const vals: any[] = [];
  if (d.name !== undefined) { fields.push('name=?'); vals.push(d.name); }
  if (d.color !== undefined) { fields.push('color=?'); vals.push(d.color); }
  if (d.is_marketing !== undefined) { fields.push('is_marketing=?'); vals.push(d.is_marketing ? 1 : 0); }
  if (d.sort_order !== undefined) { fields.push('sort_order=?'); vals.push(d.sort_order); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  vals.push(id);
  await db.prepare(`UPDATE expense_categories SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.delete('/expense-categories/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('UPDATE expenses SET category_id = NULL WHERE category_id = ?').bind(id).run();
  await db.prepare('DELETE FROM expense_categories WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== EXPENSE FREQUENCY TYPES =====
api.get('/expense-frequency-types', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare('SELECT * FROM expense_frequency_types ORDER BY sort_order, id').all();
    return c.json({ types: res.results || [] });
  } catch { return c.json({ types: [] }); }
});

api.post('/expense-frequency-types', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  if (!d.name) return c.json({ error: 'name required' }, 400);
  await db.prepare('INSERT INTO expense_frequency_types (name, multiplier_monthly, sort_order) VALUES (?,?,?)')
    .bind(d.name, d.multiplier_monthly || 1, d.sort_order || 99).run();
  return c.json({ success: true });
});

api.put('/expense-frequency-types/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = []; const vals: any[] = [];
  if (d.name !== undefined) { fields.push('name=?'); vals.push(d.name); }
  if (d.multiplier_monthly !== undefined) { fields.push('multiplier_monthly=?'); vals.push(d.multiplier_monthly); }
  if (d.sort_order !== undefined) { fields.push('sort_order=?'); vals.push(d.sort_order); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  vals.push(id);
  await db.prepare(`UPDATE expense_frequency_types SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.delete('/expense-frequency-types/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('UPDATE expenses SET frequency_type_id = NULL WHERE frequency_type_id = ?').bind(id).run();
  await db.prepare('DELETE FROM expense_frequency_types WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== EXPENSES (Commercial Costs) =====
api.get('/expenses', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare(`SELECT e.*, ec.name as category_name, ec.color as category_color, ec.is_marketing,
      eft.name as frequency_name, eft.multiplier_monthly
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN expense_frequency_types eft ON e.frequency_type_id = eft.id
      ORDER BY e.created_at DESC`).all();
    return c.json({ expenses: res.results || [] });
  } catch { return c.json({ expenses: [] }); }
});

api.post('/expenses', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  if (!d.name) return c.json({ error: 'name required' }, 400);
  await db.prepare('INSERT INTO expenses (name, amount, category_id, frequency_type_id, is_active, notes, start_date, end_date) VALUES (?,?,?,?,?,?,?,?)')
    .bind(d.name, d.amount || 0, d.category_id || null, d.frequency_type_id || null, d.is_active !== false ? 1 : 0, d.notes || '', d.start_date || '', d.end_date || '').run();
  return c.json({ success: true });
});

api.put('/expenses/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = []; const vals: any[] = [];
  if (d.name !== undefined) { fields.push('name=?'); vals.push(d.name); }
  if (d.amount !== undefined) { fields.push('amount=?'); vals.push(d.amount); }
  if (d.category_id !== undefined) { fields.push('category_id=?'); vals.push(d.category_id || null); }
  if (d.frequency_type_id !== undefined) { fields.push('frequency_type_id=?'); vals.push(d.frequency_type_id || null); }
  if (d.is_active !== undefined) { fields.push('is_active=?'); vals.push(d.is_active ? 1 : 0); }
  if (d.notes !== undefined) { fields.push('notes=?'); vals.push(d.notes); }
  if (d.start_date !== undefined) { fields.push('start_date=?'); vals.push(d.start_date); }
  if (d.end_date !== undefined) { fields.push('end_date=?'); vals.push(d.end_date); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(id);
  await db.prepare(`UPDATE expenses SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.delete('/expenses/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM expenses WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== EMPLOYEE BONUSES =====
api.get('/users/:id/bonuses', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.req.param('id');
  try {
    const res = await db.prepare('SELECT * FROM employee_bonuses WHERE user_id = ? ORDER BY bonus_date DESC, id DESC').bind(userId).all();
    return c.json({ bonuses: res.results || [] });
  } catch { return c.json({ bonuses: [] }); }
});

api.post('/users/:id/bonuses', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.req.param('id');
  const d = await c.req.json();
  // Ensure bonus_type column exists (migration may not have run on production)
  try { await db.prepare("ALTER TABLE employee_bonuses ADD COLUMN bonus_type TEXT DEFAULT 'bonus'").run(); } catch {}
  await db.prepare('INSERT INTO employee_bonuses (user_id, amount, bonus_type, description, bonus_date) VALUES (?,?,?,?,?)')
    .bind(userId, d.amount || 0, d.bonus_type || 'bonus', d.description || '', d.bonus_date || new Date().toISOString().slice(0, 10)).run();
  return c.json({ success: true });
});

api.delete('/bonuses/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM employee_bonuses WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

api.put('/bonuses/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.amount !== undefined) { fields.push('amount=?'); vals.push(d.amount); }
  if (d.description !== undefined) { fields.push('description=?'); vals.push(d.description); }
  if (d.bonus_date !== undefined) { fields.push('bonus_date=?'); vals.push(d.bonus_date); }
  if (d.bonus_type !== undefined) { fields.push('bonus_type=?'); vals.push(d.bonus_type); }
  if (fields.length === 0) return c.json({ error: 'Nothing to update' }, 400);
  vals.push(id);
  await db.prepare('UPDATE employee_bonuses SET ' + fields.join(', ') + ' WHERE id = ?').bind(...vals).run();
  return c.json({ success: true });
});

// ===== SALARY UPDATE (extends users PUT) =====
api.put('/users/:id/salary', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can edit salaries' }, 403);
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = []; const vals: any[] = [];
  if (d.salary !== undefined) { fields.push('salary=?'); vals.push(d.salary); }
  if (d.salary_type !== undefined) { fields.push('salary_type=?'); vals.push(d.salary_type); }
  if (d.position_title !== undefined) { fields.push('position_title=?'); vals.push(d.position_title); }
  if (d.hire_date !== undefined) { fields.push('hire_date=?'); vals.push(d.hire_date); }
  if (d.end_date !== undefined) { fields.push('end_date=?'); vals.push(d.end_date); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(id);
  await db.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

// ===== SALARY SUMMARY FOR A MONTH (auto-calculates salary + bonuses + fines) =====
api.get('/salary-summary/:month', authMiddleware, async (c) => {
  const db = c.env.DB;
  const month = c.req.param('month'); // Format: YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return c.json({ error: 'Invalid month format (YYYY-MM)' }, 400);
  try {
    // Total active salaries (all active employees with salary > 0)
    const salaryRes = await db.prepare("SELECT COALESCE(SUM(salary), 0) as total_salary FROM users WHERE is_active = 1 AND salary > 0").first();
    const totalSalaries = Math.round((Number(salaryRes?.total_salary || 0)) * 100) / 100;

    // Bonuses and fines for the specific month
    const bonusRes = await db.prepare("SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) as total_bonuses, COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END),0) as total_fines, COALESCE(SUM(amount),0) as net_total FROM employee_bonuses WHERE strftime('%Y-%m', bonus_date) = ?").bind(month).first();
    const totalBonuses = Math.round((Number(bonusRes?.total_bonuses || 0)) * 100) / 100;
    const totalFines = Math.round((Number(bonusRes?.total_fines || 0)) * 100) / 100;
    const bonusesNet = Math.round((Number(bonusRes?.net_total || 0)) * 100) / 100;

    // Expenses breakdown (marketing vs commercial) -- BUG-FIX: filter by period
    const expRes = await db.prepare(`SELECT e.amount, ec.is_marketing FROM expenses e 
      LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.is_active = 1
      AND (e.start_date IS NULL OR e.start_date = '' OR e.start_date <= ?)
      AND (e.end_date IS NULL OR e.end_date = '' OR e.end_date >= ?)`).bind(month + '-31', month + '-01').all();
    let marketingExpenses = 0, commercialExpenses = 0;
    for (const exp of (expRes.results || [])) {
      const amt = Math.round((Number(exp.amount) || 0) * 100) / 100;
      if (exp.is_marketing) marketingExpenses += amt;
      else commercialExpenses += amt;
    }

    // Combined expense_salaries = salaries + bonuses + fines
    const expenseSalaries = Math.round((totalSalaries + totalBonuses + totalFines) * 100) / 100;

    return c.json({
      month,
      salaries: totalSalaries,
      bonuses: totalBonuses,
      fines: totalFines,
      bonuses_net: bonusesNet,
      expense_salaries: expenseSalaries,
      commercial_expenses: commercialExpenses,
      marketing_expenses: marketingExpenses,
      total_expenses: expenseSalaries + commercialExpenses + marketingExpenses
    });
  } catch (err: any) {
    return c.json({ error: 'Salary summary error: ' + (err?.message || 'unknown') }, 500);
  }
});

// ===== PERIOD SNAPSHOTS (Close month/quarter/year) =====
api.get('/period-snapshots', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare('SELECT * FROM period_snapshots ORDER BY period_key DESC').all();
    return c.json({ snapshots: res.results || [] });
  } catch { return c.json({ snapshots: [] }); }
});

api.post('/period-snapshots', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can close periods' }, 403);
  const d = await c.req.json();
  if (!d.period_type || !d.period_key) return c.json({ error: 'period_type and period_key required' }, 400);
  // Check if already exists
  const existing = await db.prepare('SELECT id, is_locked FROM period_snapshots WHERE period_type = ? AND period_key = ?').bind(d.period_type, d.period_key).first();
  // Allow re-saving locked periods (for editing data or re-locking)
  if (existing) {
    // Update
    await db.prepare(`UPDATE period_snapshots SET revenue_services=?, revenue_articles=?, total_turnover=?, refunds=?,
      expense_salaries=?, expense_commercial=?, expense_marketing=?, net_profit=?,
      leads_count=?, leads_done=?, avg_check=?, custom_data=?, is_locked=?, closed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
      WHERE id=?`).bind(
      d.revenue_services || 0, d.revenue_articles || 0, d.total_turnover || 0, d.refunds || 0,
      d.expense_salaries || 0, d.expense_commercial || 0, d.expense_marketing || 0, d.net_profit || 0,
      d.leads_count || 0, d.leads_done || 0, d.avg_check || 0, JSON.stringify(d.custom_data || {}),
      d.is_locked ? 1 : 0, existing.id
    ).run();
  } else {
    await db.prepare(`INSERT INTO period_snapshots (period_type, period_key, revenue_services, revenue_articles, total_turnover, refunds,
      expense_salaries, expense_commercial, expense_marketing, net_profit, leads_count, leads_done, avg_check, custom_data, is_locked, closed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(
      d.period_type, d.period_key,
      d.revenue_services || 0, d.revenue_articles || 0, d.total_turnover || 0, d.refunds || 0,
      d.expense_salaries || 0, d.expense_commercial || 0, d.expense_marketing || 0, d.net_profit || 0,
      d.leads_count || 0, d.leads_done || 0, d.avg_check || 0, JSON.stringify(d.custom_data || {}),
      d.is_locked ? 1 : 0
    ).run();
  }
  return c.json({ success: true });
});

api.put('/period-snapshots/:id/unlock', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can unlock periods' }, 403);
  const id = c.req.param('id');
  await db.prepare('UPDATE period_snapshots SET is_locked = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// Update period snapshot data (edit locked period values)
api.put('/period-snapshots/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.revenue_services !== undefined) { fields.push('revenue_services=?'); vals.push(d.revenue_services); }
  if (d.revenue_articles !== undefined) { fields.push('revenue_articles=?'); vals.push(d.revenue_articles); }
  if (d.refunds !== undefined) { fields.push('refunds=?'); vals.push(d.refunds); }
  if (d.expense_salaries !== undefined) { fields.push('expense_salaries=?'); vals.push(d.expense_salaries); }
  if (d.expense_commercial !== undefined) { fields.push('expense_commercial=?'); vals.push(d.expense_commercial); }
  if (d.expense_marketing !== undefined) { fields.push('expense_marketing=?'); vals.push(d.expense_marketing); }
  if (d.net_profit !== undefined) { fields.push('net_profit=?'); vals.push(d.net_profit); }
  if (d.total_turnover !== undefined) { fields.push('total_turnover=?'); vals.push(d.total_turnover); }
  if (d.leads_done !== undefined) { fields.push('leads_done=?'); vals.push(d.leads_done); }
  if (d.leads_count !== undefined) { fields.push('leads_count=?'); vals.push(d.leads_count); }
  if (d.custom_data !== undefined) { fields.push('custom_data=?'); vals.push(typeof d.custom_data === 'string' ? d.custom_data : JSON.stringify(d.custom_data)); }
  if (d.avg_check !== undefined) { fields.push('avg_check=?'); vals.push(d.avg_check); }
  if (d.is_locked !== undefined) { fields.push('is_locked=?'); vals.push(d.is_locked ? 1 : 0); if (d.is_locked) { fields.push('closed_at=CURRENT_TIMESTAMP'); } }
  if (fields.length === 0) return c.json({ error: 'Nothing to update' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(id);
  await db.prepare('UPDATE period_snapshots SET ' + fields.join(', ') + ' WHERE id = ?').bind(...vals).run();
  return c.json({ success: true });
});

// ===== AUDIT LOG =====
api.get('/audit-log', authMiddleware, async (c) => {
  const db = c.env.DB;
  const url = new URL(c.req.url);
  const entityType = url.searchParams.get('entity_type') || '';
  const entityId = url.searchParams.get('entity_id') || '';
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  try {
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params: any[] = [];
    if (entityType) { sql += ' AND entity_type = ?'; params.push(entityType); }
    if (entityId) { sql += ' AND entity_id = ?'; params.push(Number(entityId)); }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const res = await db.prepare(sql).bind(...params).all();
    const total = await db.prepare('SELECT COUNT(*) as cnt FROM audit_log').first();
    return c.json({ logs: res.results || [], total: total?.cnt || 0 });
  } catch { return c.json({ logs: [], total: 0 }); }
});

// ===== DB BACKUP / EXPORT =====
api.get('/db-backup', authMiddleware, async (c) => {
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can export DB' }, 403);
  const db = c.env.DB;
  try {
    const tables = ['leads', 'lead_comments', 'lead_articles', 'users', 'referral_codes',
      'referral_free_services', 'expenses', 'expense_categories', 'expense_frequency_types',
      'employee_bonuses', 'employee_vacations', 'loans', 'loan_payments', 'dividends',
      'tax_payments', 'tax_rules', 'assets', 'other_income_expenses', 'period_snapshots',
      'calculator_services', 'calculator_tabs', 'calculator_packages', 'calculator_package_items',
      'pdf_templates', 'site_settings', 'company_roles', 'payment_methods'];
    const backup: Record<string, any[]> = {};
    for (const table of tables) {
      try {
        const res = await db.prepare(`SELECT * FROM ${table}`).all();
        backup[table] = res.results || [];
      } catch { backup[table] = []; }
    }
    const json = JSON.stringify({
      version: '1.0',
      exported_at: new Date().toISOString(),
      tables: backup
    }, null, 2);
    return new Response(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="db_backup_${new Date().toISOString().slice(0,10)}.json"`
      }
    });
  } catch (err: any) {
    return c.json({ error: 'Backup failed: ' + (err?.message || 'unknown') }, 500);
  }
});

// ===== OVERDUE LEADS NOTIFICATIONS =====
api.get('/overdue-leads', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare(`SELECT id, lead_number, name, contact, source, created_at,
      ROUND((julianday('now') - julianday(created_at)) * 24, 1) as hours_since_creation
      FROM leads WHERE status = 'new' AND (assigned_to IS NULL OR assigned_to = 0)
      AND julianday('now') - julianday(created_at) > 1.0
      ORDER BY created_at ASC LIMIT 100`).all();
    return c.json({ overdue: res.results || [], count: (res.results || []).length });
  } catch { return c.json({ overdue: [], count: 0 }); }
});

// ===== AUTO-CLOSE MONTH (Monthly Snapshot) =====
api.post('/auto-close-month', authMiddleware, async (c) => {
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can auto-close months' }, 403);
  const db = c.env.DB;
  const body = await c.req.json().catch(() => ({}));
  // Default: close the previous month
  const now = new Date();
  const prevMonth = body.month || (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.toISOString().slice(0, 7);
  })();
  try {
    // Check if already closed
    const existing = await db.prepare("SELECT id, is_locked FROM period_snapshots WHERE period_type = 'month' AND period_key = ?").bind(prevMonth).first();
    if (existing && existing.is_locked) {
      return c.json({ error: `Month ${prevMonth} is already closed and locked`, already_closed: true }, 400);
    }
    // Calculate data for the month
    const turnoverStatuses = ['in_progress', 'checking', 'done'];
    const leadsRes = await db.prepare(`SELECT COUNT(*) as cnt FROM leads WHERE strftime('%Y-%m', created_at) = ?`).bind(prevMonth).first();
    const doneRes = await db.prepare(`SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as amt FROM leads WHERE strftime('%Y-%m', created_at) = ? AND status = 'done'`).bind(prevMonth).first();
    // Revenue from services (calc_data items without wb_article) for turnover statuses
    const svcLeads = await db.prepare(`SELECT calc_data FROM leads WHERE strftime('%Y-%m', created_at) = ? AND status IN ('in_progress','checking','done')`).bind(prevMonth).all();
    let revServices = 0;
    let revPackages = 0;
    let revDiscounts = 0;
    for (const row of (svcLeads.results || [])) {
      try {
        const cd = JSON.parse(row.calc_data as string || '{}');
        if (cd.servicesSubtotal) revServices += Number(cd.servicesSubtotal);
        else if (cd.items) {
          for (const it of cd.items) { if (!it.wb_article) revServices += Number(it.subtotal || 0); }
        }
        // Package revenue — real money from client
        if (cd.package && cd.package.package_price) {
          revPackages += Number(cd.package.package_price || 0);
        }
        // Discount — subtract from services so svc + art + pkg = turnover
        revDiscounts += Number(cd.discountAmount || 0);
      } catch {}
    }
    // NET services = gross - discounts
    revServices = Math.max(0, revServices - revDiscounts);
    // Articles revenue
    const artRes = await db.prepare(`SELECT COALESCE(SUM(la.total_price),0) as art_total FROM lead_articles la JOIN leads l ON la.lead_id = l.id WHERE strftime('%Y-%m', l.created_at) = ? AND l.status IN ('in_progress','checking','done')`).bind(prevMonth).first();
    const revArticles = Number(artRes?.art_total || 0);
    // Refunds
    const refRes = await db.prepare(`SELECT COALESCE(SUM(refund_amount),0) as total FROM leads WHERE strftime('%Y-%m', created_at) = ? AND status IN ('in_progress','checking','done')`).bind(prevMonth).first();
    // Expenses
    const expRes = await db.prepare(`SELECT COALESCE(SUM(CASE WHEN ec.is_marketing = 0 THEN e.amount ELSE 0 END),0) as commercial, COALESCE(SUM(CASE WHEN ec.is_marketing = 1 THEN e.amount ELSE 0 END),0) as marketing FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.is_active = 1 AND (e.start_date IS NULL OR e.start_date = '' OR e.start_date <= ?) AND (e.end_date IS NULL OR e.end_date = '' OR e.end_date >= ?)`).bind(prevMonth + '-31', prevMonth + '-01').first();
    // Salaries
    const salRes = await db.prepare("SELECT COALESCE(SUM(salary),0) as total FROM users WHERE is_active = 1 AND salary > 0").first();
    const bonRes = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM employee_bonuses WHERE strftime('%Y-%m', bonus_date) = ?").bind(prevMonth).first();
    const totalSalaries = Number(salRes?.total || 0) + Number(bonRes?.total || 0);
    const leadsCount = Number(leadsRes?.cnt || 0);
    const leadsDone = Number(doneRes?.cnt || 0);
    const avgCheck = leadsDone > 0 ? Math.round(Number(doneRes?.amt || 0) / leadsDone) : 0;
    const commercialExp = Number(expRes?.commercial || 0);
    const marketingExp = Number(expRes?.marketing || 0);
    const netProfit = (revServices + revArticles + revPackages) - totalSalaries - commercialExp - marketingExp;
    // Build custom_data with extra analytics (in_progress, rejected, checking counts + packages)
    let customDataForSnapshot: Record<string, any> = {};
    try {
      const ipRes = await db.prepare(`SELECT COUNT(*) as cnt FROM leads WHERE strftime('%Y-%m', created_at) = ? AND status = 'in_progress'`).bind(prevMonth).first();
      const rejRes2 = await db.prepare(`SELECT COUNT(*) as cnt FROM leads WHERE strftime('%Y-%m', created_at) = ? AND status = 'rejected'`).bind(prevMonth).first();
      const chkRes = await db.prepare(`SELECT COUNT(*) as cnt FROM leads WHERE strftime('%Y-%m', created_at) = ? AND status = 'checking'`).bind(prevMonth).first();
      customDataForSnapshot = {
        in_progress_count: Number(ipRes?.cnt || 0),
        rejected_count: Number(rejRes2?.cnt || 0),
        checking_count: Number(chkRes?.cnt || 0),
        revenue_packages: revPackages
      };
    } catch {}
    const customDataJson = JSON.stringify(customDataForSnapshot);
    // Upsert snapshot
    if (existing) {
      await db.prepare(`UPDATE period_snapshots SET revenue_services=?, revenue_articles=?, total_turnover=?, refunds=?,
        expense_salaries=?, expense_commercial=?, expense_marketing=?, net_profit=?,
        leads_count=?, leads_done=?, avg_check=?, custom_data=?, is_locked=1, closed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
        WHERE id=?`).bind(
        revServices, revArticles, revServices + revArticles + revPackages, Number(refRes?.total || 0),
        totalSalaries, commercialExp, marketingExp, netProfit,
        leadsCount, leadsDone, avgCheck, customDataJson, existing.id
      ).run();
    } else {
      await db.prepare(`INSERT INTO period_snapshots (period_type, period_key, revenue_services, revenue_articles, total_turnover, refunds,
        expense_salaries, expense_commercial, expense_marketing, net_profit, leads_count, leads_done, avg_check, custom_data, is_locked, closed_at)
        VALUES ('month',?,?,?,?,?,?,?,?,?,?,?,?,?,1,CURRENT_TIMESTAMP)`).bind(
        prevMonth, revServices, revArticles, revServices + revArticles + revPackages, Number(refRes?.total || 0),
        totalSalaries, commercialExp, marketingExp, netProfit,
        leadsCount, leadsDone, avgCheck, customDataJson
      ).run();
    }
    // Audit log
    try {
      await db.prepare('INSERT INTO audit_log (user_id, user_name, action, entity_type, new_value) VALUES (?,?,?,?,?)')
        .bind(caller.sub || 0, caller.display_name || 'admin', 'auto_close_month', 'period_snapshot', prevMonth).run();
    } catch {}
    return c.json({
      success: true,
      period: prevMonth,
      summary: { revenue_services: revServices, revenue_articles: revArticles, revenue_packages: revPackages, net_profit: netProfit, leads_count: leadsCount, leads_done: leadsDone }
    });
  } catch (err: any) {
    return c.json({ error: 'Auto-close failed: ' + (err?.message || 'unknown') }, 500);
  }
});

}
