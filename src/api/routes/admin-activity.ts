/**
 * Admin API — Activity tracking, employee vacations, search, earnings summary
 */
import { Hono } from 'hono'

type Bindings = { DB: D1Database }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: AuthMiddleware) {
// ===== ACTIVITY TRACKING (heartbeat / online presence) =====
api.post('/activity/heartbeat', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').sub;
  const d = await c.req.json().catch(() => ({}));
  const action = d.action || '';
  const page = d.page || '';
  try {
    const existing = await db.prepare('SELECT id FROM activity_sessions WHERE user_id = ?').bind(userId).first();
    if (existing) {
      await db.prepare('UPDATE activity_sessions SET last_action = ?, last_page = ?, last_seen_at = CURRENT_TIMESTAMP WHERE user_id = ?')
        .bind(action, page, userId).run();
    } else {
      await db.prepare('INSERT INTO activity_sessions (user_id, last_action, last_page) VALUES (?,?,?)')
        .bind(userId, action, page).run();
    }
  } catch {}
  return c.json({ success: true });
});

api.get('/activity/online', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    // Users active within last 5 minutes are "online"
    const res = await db.prepare(`
      SELECT a.user_id, a.last_action, a.last_page, a.last_seen_at,
        u.display_name, u.role, u.position_title
      FROM activity_sessions a
      JOIN users u ON a.user_id = u.id
      WHERE a.last_seen_at >= datetime('now', '-5 minutes')
      ORDER BY a.last_seen_at DESC
    `).all();
    return c.json({ online: res.results || [] });
  } catch { return c.json({ online: [] }); }
});

// ===== EMPLOYEE VACATIONS =====
api.get('/users/:id/vacations', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.req.param('id');
  try {
    const res = await db.prepare('SELECT * FROM employee_vacations WHERE user_id = ? ORDER BY start_date DESC').bind(userId).all();
    return c.json({ vacations: res.results || [] });
  } catch { return c.json({ vacations: [] }); }
});

api.get('/vacations', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare(`
      SELECT v.*, u.display_name, u.role, u.position_title
      FROM employee_vacations v
      JOIN users u ON v.user_id = u.id
      ORDER BY v.start_date DESC
    `).all();
    return c.json({ vacations: res.results || [] });
  } catch { return c.json({ vacations: [] }); }
});

api.get('/vacations/current', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare(`
      SELECT v.*, u.display_name, u.role, u.position_title
      FROM employee_vacations v
      JOIN users u ON v.user_id = u.id
      WHERE v.status = 'active' AND date(v.start_date) <= date('now') AND date(v.end_date) >= date('now')
      ORDER BY v.end_date ASC
    `).all();
    return c.json({ vacations: res.results || [] });
  } catch { return c.json({ vacations: [] }); }
});

api.post('/users/:id/vacations', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can manage vacations' }, 403);
  const userId = c.req.param('id');
  const d = await c.req.json();
  if (!d.start_date || !d.end_date) return c.json({ error: 'start_date and end_date required' }, 400);
  // Auto-calculate days_count
  const start = new Date(d.start_date);
  const end = new Date(d.end_date);
  const diffMs = end.getTime() - start.getTime();
  const daysCount = d.days_count || Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
  await db.prepare('INSERT INTO employee_vacations (user_id, start_date, end_date, days_count, is_paid, paid_amount, status, notes) VALUES (?,?,?,?,?,?,?,?)')
    .bind(userId, d.start_date, d.end_date, daysCount, d.is_paid !== false ? 1 : 0, d.paid_amount || 0, d.status || 'planned', d.notes || '').run();
  return c.json({ success: true });
});

api.put('/vacations/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can manage vacations' }, 403);
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.start_date !== undefined) { fields.push('start_date=?'); vals.push(d.start_date); }
  if (d.end_date !== undefined) { fields.push('end_date=?'); vals.push(d.end_date); }
  if (d.days_count !== undefined) { fields.push('days_count=?'); vals.push(d.days_count); }
  if (d.is_paid !== undefined) { fields.push('is_paid=?'); vals.push(d.is_paid ? 1 : 0); }
  if (d.paid_amount !== undefined) { fields.push('paid_amount=?'); vals.push(d.paid_amount); }
  if (d.status !== undefined) { fields.push('status=?'); vals.push(d.status); }
  if (d.notes !== undefined) { fields.push('notes=?'); vals.push(d.notes); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(id);
  await db.prepare(`UPDATE employee_vacations SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.delete('/vacations/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can manage vacations' }, 403);
  const id = c.req.param('id');
  await db.prepare('DELETE FROM employee_vacations WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== EMPLOYEE SEARCH (global across all fields) =====
api.get('/users/search', authMiddleware, async (c) => {
  const db = c.env.DB;
  const q = (c.req.query('q') || '').trim();
  if (!q) return c.json({ results: [] });
  const like = `%${q}%`;
  try {
    const res = await db.prepare(`
      SELECT id, username, role, display_name, phone, email, is_active, salary, salary_type, 
        position_title, hire_date, end_date, created_at
      FROM users 
      WHERE display_name LIKE ? OR username LIKE ? OR phone LIKE ? OR email LIKE ? OR position_title LIKE ? OR role LIKE ?
      ORDER BY display_name
    `).bind(like, like, like, like, like, like).all();
    return c.json({ results: res.results || [] });
  } catch { return c.json({ results: [] }); }
});

// ===== EMPLOYEE EARNINGS SUMMARY (salary + bonuses + penalties per month) =====
// Returns both requested month's earnings AND total lifetime earnings since hire_date
api.get('/users/:id/earnings/:month', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.req.param('id');
  const month = c.req.param('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return c.json({ error: 'Invalid month format' }, 400);
  try {
    const user = await db.prepare('SELECT salary, salary_type, hire_date, end_date, is_active, display_name FROM users WHERE id = ?').bind(userId).first();
    const fullMonthlySalary = Number(user?.salary || 0);
    const salaryType = (user?.salary_type as string) || 'monthly';
    const hireDate = (user?.hire_date as string) || '';
    const endDate = (user?.end_date as string) || '';

    // === PROPORTIONAL SALARY CALCULATION ===
    // Calculate working days in this month based on hire/end dates
    const monthStart = new Date(month + '-01T00:00:00Z');
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0); // last day of month
    const totalDaysInMonth = monthEnd.getDate();
    
    let workStartDay = 1;
    let workEndDay = totalDaysInMonth;
    
    if (hireDate && hireDate.slice(0,7) === month) {
      workStartDay = Math.max(1, parseInt(hireDate.slice(8,10)));
    }
    if (endDate && endDate.slice(0,7) === month) {
      workEndDay = Math.min(totalDaysInMonth, parseInt(endDate.slice(8,10)));
    }
    // If hire_date is after this month or end_date before this month — 0 salary
    let monthlySalary = fullMonthlySalary;
    let workedDays = totalDaysInMonth;
    let isPartialMonth = false;
    
    if (hireDate && hireDate > month + '-' + String(totalDaysInMonth).padStart(2,'0')) {
      monthlySalary = 0; workedDays = 0;
    } else if (endDate && endDate < month + '-01') {
      monthlySalary = 0; workedDays = 0;
    } else if (workStartDay > 1 || workEndDay < totalDaysInMonth) {
      workedDays = Math.max(0, workEndDay - workStartDay + 1);
      if (salaryType === 'monthly' || salaryType === 'biweekly') {
        monthlySalary = Math.round((fullMonthlySalary * workedDays / totalDaysInMonth) * 100) / 100;
        isPartialMonth = true;
      }
    }

    // === CURRENT MONTH EARNINGS ===
    const bonusRes = await db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN bonus_type='bonus' OR (bonus_type IS NULL AND amount > 0) THEN amount ELSE 0 END),0) as bonuses,
        COALESCE(SUM(CASE WHEN bonus_type IN ('penalty','fine') OR (bonus_type IS NULL AND amount < 0) THEN ABS(amount) ELSE 0 END),0) as penalties,
        COALESCE(SUM(amount),0) as net
      FROM employee_bonuses WHERE user_id = ? AND strftime('%Y-%m', bonus_date) = ?
    `).bind(userId, month).first();
    const bonuses = Number(bonusRes?.bonuses || 0);
    const penalties = Number(bonusRes?.penalties || 0);
    const bonusesNet = Number(bonusRes?.net || 0);

    // Vacation days this month with paid/unpaid breakdown
    let vacRes: any = { paid_days: 0, unpaid_days: 0, paid_amount: 0, total_days: 0 };
    try {
      vacRes = await db.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN is_paid = 1 THEN days_count ELSE 0 END),0) as paid_days,
          COALESCE(SUM(CASE WHEN is_paid = 0 THEN days_count ELSE 0 END),0) as unpaid_days,
          COALESCE(SUM(days_count),0) as total_days,
          COALESCE(SUM(paid_amount),0) as paid_amount
        FROM employee_vacations WHERE user_id = ? AND (
          strftime('%Y-%m', start_date) = ? OR strftime('%Y-%m', end_date) = ?
        )
      `).bind(userId, month, month).first();
    } catch {}
    const unpaidVacDays = Number(vacRes?.unpaid_days || 0);
    const paidVacDays = Number(vacRes?.paid_days || 0);
    const vacationPaid = Number(vacRes?.paid_amount || 0);

    // Calculate salary deduction for unpaid vacation days
    // Assume ~22 working days per month
    const dailySalary = fullMonthlySalary / 22;
    const unpaidDeduction = Math.round(unpaidVacDays * dailySalary * 100) / 100;
    // Paid vacation: salary stays the same, no deduction
    const monthSalaryAfterVac = Math.max(0, Math.round((monthlySalary - unpaidDeduction) * 100) / 100);
    // Paid vacation amount is added to total earnings as separate line
    const monthTotal = Math.round((monthSalaryAfterVac + bonusesNet + vacationPaid) * 100) / 100;

    // === LIFETIME EARNINGS (since hire_date) ===
    // Count months worked
    let totalMonthsWorked = 0;
    let lifetimeSalary = 0;
    let lifetimeBonuses = 0;
    let lifetimePenalties = 0;
    let lifetimeUnpaidDays = 0;
    let lifetimeUnpaidDeduction = 0;
    let lifetimePaidVacAmount = 0;
    let lifetimeTotal = 0;

    if (hireDate) {
      const hd = new Date(hireDate + 'T00:00:00Z');
      const ed = endDate ? new Date(endDate + 'T00:00:00Z') : new Date();
      // Calculate months between hire and end/now
      totalMonthsWorked = Math.max(1, 
        (ed.getFullYear() - hd.getFullYear()) * 12 + (ed.getMonth() - hd.getMonth()) + 1
      );
      lifetimeSalary = Math.round(fullMonthlySalary * totalMonthsWorked * 100) / 100;

      // Lifetime bonuses/penalties since hire
      const lifeBonus = await db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN bonus_type='bonus' OR (bonus_type IS NULL AND amount > 0) THEN amount ELSE 0 END),0) as bonuses,
          COALESCE(SUM(CASE WHEN bonus_type IN ('penalty','fine') OR (bonus_type IS NULL AND amount < 0) THEN ABS(amount) ELSE 0 END),0) as penalties,
          COALESCE(SUM(amount),0) as net
        FROM employee_bonuses WHERE user_id = ? AND bonus_date >= ? ${endDate ? "AND bonus_date <= ?" : ""}
      `).bind(userId, hireDate, ...(endDate ? [endDate] : [])).first();
      lifetimeBonuses = Number(lifeBonus?.bonuses || 0);
      lifetimePenalties = Number(lifeBonus?.penalties || 0);
      const lifetimeBonusNet = Number(lifeBonus?.net || 0);

      // Lifetime unpaid vacation days + paid vacation amounts
      try {
        const lifeVac = await db.prepare(`
          SELECT COALESCE(SUM(CASE WHEN is_paid = 0 THEN days_count ELSE 0 END),0) as unpaid_days,
            COALESCE(SUM(paid_amount),0) as total_paid_amount
          FROM employee_vacations WHERE user_id = ? AND start_date >= ? ${endDate ? "AND start_date <= ?" : ""}
        `).bind(userId, hireDate, ...(endDate ? [endDate] : [])).first();
        lifetimeUnpaidDays = Number(lifeVac?.unpaid_days || 0);
        lifetimePaidVacAmount = Number(lifeVac?.total_paid_amount || 0);
      } catch {}
      lifetimeUnpaidDeduction = Math.round(lifetimeUnpaidDays * dailySalary * 100) / 100;
      lifetimeTotal = Math.round((lifetimeSalary - lifetimeUnpaidDeduction + lifetimeBonusNet + lifetimePaidVacAmount) * 100) / 100;
    }

    return c.json({
      month, user_id: Number(userId), 
      display_name: user?.display_name || '',
      salary: monthlySalary, full_salary: fullMonthlySalary, salary_type: salaryType,
      hire_date: hireDate, end_date: endDate,
      is_partial_month: isPartialMonth, worked_days: workedDays, total_days_in_month: totalDaysInMonth,
      // Current month breakdown
      bonuses, penalties, bonuses_net: bonusesNet,
      vacation_paid_days: paidVacDays,
      vacation_unpaid_days: unpaidVacDays,
      vacation_total_days: Number(vacRes?.total_days || 0),
      vacation_paid_amount: vacationPaid,
      unpaid_deduction: unpaidDeduction,
      month_salary_after_vac: monthSalaryAfterVac,
      total_earnings: monthTotal,
      // Lifetime totals
      lifetime: {
        months_worked: totalMonthsWorked,
        total_salary: lifetimeSalary,
        total_bonuses: lifetimeBonuses,
        total_penalties: lifetimePenalties,
        unpaid_vac_days: lifetimeUnpaidDays,
        unpaid_deduction: lifetimeUnpaidDeduction,
        paid_vacation_amount: lifetimePaidVacAmount,
        grand_total: lifetimeTotal
      }
    });
  } catch (err: any) {
    return c.json({ error: 'Earnings error: ' + (err?.message || 'unknown') }, 500);
  }
});

}
