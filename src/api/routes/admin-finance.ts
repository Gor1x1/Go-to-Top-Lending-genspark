/**
 * Admin API — Tax payments/rules, assets, loans, dividends, other income/expenses, P&L report, data reset
 */
import { Hono } from 'hono'
type Bindings = { DB: D1Database }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: AuthMiddleware) {
// ===== TAX PAYMENTS =====
api.get('/tax-payments', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM tax_payments WHERE (is_suppressed IS NULL OR is_suppressed = 0) ORDER BY payment_date DESC, id DESC').all();
  return c.json({ payments: res.results || [] });
});

api.post('/tax-payments', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  await db.prepare('INSERT INTO tax_payments (tax_type, tax_name, amount, period_key, payment_date, due_date, status, notes, tax_rate, tax_base, is_auto, rule_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(d.tax_type||'income_tax', d.tax_name||'', d.amount||0, d.period_key||'', d.payment_date||'', d.due_date||'', d.status||'paid', d.notes||'', d.tax_rate||0, d.tax_base||'fixed', d.is_auto ? 1 : 0, d.rule_id || null).run();
  return c.json({ success: true });
});

api.put('/tax-payments/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = []; const vals: any[] = [];
  if (d.tax_type !== undefined) { fields.push('tax_type=?'); vals.push(d.tax_type); }
  if (d.tax_name !== undefined) { fields.push('tax_name=?'); vals.push(d.tax_name); }
  if (d.amount !== undefined) { fields.push('amount=?'); vals.push(d.amount); }
  if (d.period_key !== undefined) { fields.push('period_key=?'); vals.push(d.period_key); }
  if (d.payment_date !== undefined) { fields.push('payment_date=?'); vals.push(d.payment_date); }
  if (d.due_date !== undefined) { fields.push('due_date=?'); vals.push(d.due_date); }
  if (d.status !== undefined) { fields.push('status=?'); vals.push(d.status); }
  if (d.notes !== undefined) { fields.push('notes=?'); vals.push(d.notes); }
  if (d.tax_rate !== undefined) { fields.push('tax_rate=?'); vals.push(d.tax_rate); }
  if (d.tax_base !== undefined) { fields.push('tax_base=?'); vals.push(d.tax_base); }
  if (d.is_auto !== undefined) { fields.push('is_auto=?'); vals.push(d.is_auto ? 1 : 0); }
  if (fields.length) { vals.push(id); await db.prepare(`UPDATE tax_payments SET ${fields.join(',')} WHERE id=?`).bind(...vals).run(); }
  return c.json({ success: true });
});

api.delete('/tax-payments/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  // Check if this payment was auto-generated from a rule
  const payment = await db.prepare('SELECT rule_id FROM tax_payments WHERE id = ?').bind(id).first();
  if (payment && payment.rule_id) {
    // Soft-delete: mark as suppressed so auto-generation won't recreate it
    await db.prepare('UPDATE tax_payments SET is_suppressed = 1, amount = 0, status = ? WHERE id = ?').bind('deleted', id).run();
  } else {
    // Hard delete for manually-created payments
    await db.prepare('DELETE FROM tax_payments WHERE id = ?').bind(id).run();
  }
  return c.json({ success: true });
});

// ===== TAX RULES (recurring auto-generate) =====
api.get('/tax-rules', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS tax_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT, rule_name TEXT NOT NULL DEFAULT '', tax_type TEXT NOT NULL DEFAULT 'income_tax',
      tax_base TEXT DEFAULT 'revenue', tax_rate REAL DEFAULT 0, frequency TEXT DEFAULT 'monthly',
      is_active INTEGER DEFAULT 1, apply_from TEXT DEFAULT '', apply_to TEXT DEFAULT '',
      notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
    const res = await db.prepare('SELECT * FROM tax_rules ORDER BY id DESC').all();
    return c.json({ rules: res.results || [] });
  } catch {
    return c.json({ rules: [] });
  }
});

api.post('/tax-rules', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS tax_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT, rule_name TEXT NOT NULL DEFAULT '', tax_type TEXT NOT NULL DEFAULT 'income_tax',
      tax_base TEXT DEFAULT 'revenue', tax_rate REAL DEFAULT 0, frequency TEXT DEFAULT 'monthly',
      is_active INTEGER DEFAULT 1, apply_from TEXT DEFAULT '', apply_to TEXT DEFAULT '',
      notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
    await db.prepare('INSERT INTO tax_rules (rule_name, tax_type, tax_base, tax_rate, frequency, is_active, apply_from, apply_to, notes) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(d.rule_name||'', d.tax_type||'income_tax', d.tax_base||'revenue', d.tax_rate||0, d.frequency||'monthly', d.is_active!==undefined ? (d.is_active?1:0) : 1, d.apply_from||'', d.apply_to||'', d.notes||'').run();
    // Get the ID of the newly created rule
    const lastRule = await db.prepare('SELECT id FROM tax_rules ORDER BY id DESC LIMIT 1').first() as any;
    return c.json({ success: true, rule_id: lastRule?.id || null });
  } catch (err: any) {
    return c.json({ error: err?.message || 'Failed to create tax rule' }, 500);
  }
});

api.put('/tax-rules/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = []; const vals: any[] = [];
  for (const k of ['rule_name','tax_type','tax_base','tax_rate','frequency','is_active','apply_from','apply_to','notes']) {
    if (d[k] !== undefined) { fields.push(k+'=?'); vals.push(k==='is_active' ? (d[k]?1:0) : d[k]); }
  }
  if (fields.length) { fields.push('updated_at=CURRENT_TIMESTAMP'); vals.push(id); await db.prepare(`UPDATE tax_rules SET ${fields.join(',')} WHERE id=?`).bind(...vals).run(); }
  return c.json({ success: true });
});

api.delete('/tax-rules/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  await db.prepare('DELETE FROM tax_rules WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

// Generate tax payments from rules for a specific period
api.post('/tax-rules/generate/:periodKey', authMiddleware, async (c) => {
  const db = c.env.DB;
  const periodKey = c.req.param('periodKey'); // e.g. 2026-02
  try {
    // Ensure tax_rules table exists (might not after fresh deploy)
    await db.prepare(`CREATE TABLE IF NOT EXISTS tax_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL DEFAULT '',
      tax_type TEXT NOT NULL DEFAULT 'income_tax',
      tax_base TEXT DEFAULT 'revenue',
      tax_rate REAL DEFAULT 0,
      frequency TEXT DEFAULT 'monthly',
      is_active INTEGER DEFAULT 1,
      apply_from TEXT DEFAULT '',
      apply_to TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
    const rules = await db.prepare('SELECT * FROM tax_rules WHERE is_active = 1').all();
    let generated = 0;
    for (const rule of (rules.results || []) as any[]) {
      // Check period range
      if (rule.apply_from && periodKey < rule.apply_from) continue;
      if (rule.apply_to && periodKey > rule.apply_to) continue;
      // Check frequency (quarterly = only q-end months: 03,06,09,12)
      const month = parseInt(periodKey.split('-')[1]);
      if (rule.frequency === 'quarterly' && ![3,6,9,12].includes(month)) continue;
      // Check if already exists for this rule+period (including suppressed)
      const existing = await db.prepare('SELECT id, is_suppressed FROM tax_payments WHERE rule_id = ? AND period_key = ?').bind(rule.id, periodKey).first();
      if (existing) continue; // exists (active or suppressed) — skip
      // Insert payment from rule
      await db.prepare('INSERT INTO tax_payments (tax_type, tax_name, amount, period_key, status, tax_rate, tax_base, is_auto, rule_id, is_suppressed) VALUES (?,?,0,?,?,?,?,1,?,0)')
        .bind(rule.tax_type, rule.rule_name, periodKey, 'pending', rule.tax_rate, rule.tax_base, rule.id).run();
      generated++;
    }
    return c.json({ success: true, generated });
  } catch (err: any) {
    // Handle missing table or other DB errors
    if (err?.message?.includes('no such table')) {
      return c.json({ error: 'Tax rules table not found. Please redeploy to create the table.', generated: 0 }, 500);
    }
    return c.json({ error: err?.message || 'Generation failed', generated: 0 }, 500);
  }
});

// ===== ASSETS (Amortization) =====
api.get('/assets', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM assets ORDER BY purchase_date DESC, id DESC').all();
  return c.json({ assets: res.results || [] });
});

api.post('/assets', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  await db.prepare('INSERT INTO assets (name, purchase_date, purchase_cost, useful_life_months, residual_value, depreciation_method, category, is_active, notes) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(d.name||'', d.purchase_date||'', d.purchase_cost||0, d.useful_life_months||60, d.residual_value||0, d.depreciation_method||'straight_line', d.category||'', d.is_active!==undefined?d.is_active:1, d.notes||'').run();
  return c.json({ success: true });
});

api.put('/assets/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = []; const vals: any[] = [];
  for (const k of ['name','purchase_date','purchase_cost','useful_life_months','residual_value','depreciation_method','category','is_active','notes']) {
    if (d[k] !== undefined) { fields.push(k+'=?'); vals.push(d[k]); }
  }
  if (fields.length) { vals.push(id); await db.prepare(`UPDATE assets SET ${fields.join(',')} WHERE id=?`).bind(...vals).run(); }
  return c.json({ success: true });
});

api.delete('/assets/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  await db.prepare('DELETE FROM assets WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

// ===== LOANS =====
// Helper: ensure new loan columns exist (safe idempotent migration)
async function ensureLoanColumns(db: any) {
  try { await db.prepare('ALTER TABLE loans ADD COLUMN payment_day TEXT DEFAULT \'\'').run(); } catch {}
  try { await db.prepare('ALTER TABLE loans ADD COLUMN min_payment REAL DEFAULT 0').run(); } catch {}
}

api.get('/loans', authMiddleware, async (c) => {
  const db = c.env.DB;
  await ensureLoanColumns(db);
  const loans = await db.prepare('SELECT * FROM loans ORDER BY priority ASC, start_date DESC, id DESC').all();
  const payments = await db.prepare('SELECT * FROM loan_payments ORDER BY payment_date DESC').all();
  return c.json({ loans: loans.results || [], payments: payments.results || [] });
});

api.post('/loans', authMiddleware, async (c) => {
  const db = c.env.DB;
  await ensureLoanColumns(db);
  const d = await c.req.json();
  // Auto-calculate annuity PMT if type is annuity and we have principal, rate, term
  let monthlyPayment = d.monthly_payment || 0;
  let originalMonthly = 0;
  const loanType = d.loan_type || 'annuity';
  const principal = d.principal || 0;
  const annualRate = d.interest_rate || 0;
  const termMonths = d.term_months || 0;
  const desiredTerm = d.desired_term_months || 0;

  if (loanType === 'annuity' && principal > 0 && annualRate > 0 && termMonths > 0) {
    const r = annualRate / 100 / 12;
    const n = termMonths;
    originalMonthly = Math.round(principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) * 100) / 100;
    monthlyPayment = originalMonthly;
    // If desired_term is shorter, recalculate PMT for accelerated payoff
    if (desiredTerm > 0 && desiredTerm < termMonths) {
      monthlyPayment = Math.round(principal * r * Math.pow(1 + r, desiredTerm) / (Math.pow(1 + r, desiredTerm) - 1) * 100) / 100;
    }
  }

  // Priority: collateral loans get priority 1-5, unsecured get 10
  const collateralType = d.collateral_type || 'none';
  const priority = collateralType !== 'none' ? (d.priority || 1) : (d.priority || 10);

  // Calculate end_date from start_date + term_months if not provided
  let endDate = d.end_date || '';
  if (!endDate && d.start_date && termMonths > 0) {
    const sd = new Date(d.start_date);
    sd.setMonth(sd.getMonth() + termMonths);
    endDate = sd.toISOString().slice(0, 10);
  }

  // For manual (займ с рук) type: use provided monthly_payment if set
  if (loanType === 'manual' && d.monthly_payment && d.monthly_payment > 0) {
    monthlyPayment = d.monthly_payment;
  }

  // If bank_monthly_payment is provided and we have an annuity, use it as the actual PMT if desired
  const bankMonthly = d.bank_monthly_payment || monthlyPayment || 0;

  // For overdraft: calculate monthly interest as payment
  if (loanType === 'overdraft') {
    const odUsed = d.overdraft_used || 0;
    const odRate = d.overdraft_rate || 0;
    monthlyPayment = Math.round(odUsed * odRate / 100 / 12 * 100) / 100;
  }

  await db.prepare(`INSERT INTO loans (name, lender, principal, interest_rate, start_date, end_date, monthly_payment, remaining_balance, loan_type, is_active, notes, term_months, desired_term_months, original_monthly_payment, collateral_type, collateral_desc, priority, repayment_mode, aggressive_pct, overdraft_limit, overdraft_used, overdraft_rate, actual_end_date, bank_monthly_payment, payment_day, min_payment) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(d.name||'', d.lender||'', principal, annualRate, d.start_date||'', endDate, monthlyPayment, d.remaining_balance||principal, loanType, d.is_active!==undefined?d.is_active:1, d.notes||'', termMonths, desiredTerm, originalMonthly, collateralType, d.collateral_desc||'', priority, d.repayment_mode||'standard', d.aggressive_pct||0, d.overdraft_limit||0, d.overdraft_used||0, d.overdraft_rate||0, d.actual_end_date||'', d.bank_monthly_payment||0, d.payment_day||'', d.min_payment||0).run();
  return c.json({ success: true });
});

api.put('/loans/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  await ensureLoanColumns(db);
  const id = c.req.param('id');
  const d = await c.req.json();

  // If changing terms, recalculate PMT
  if (d.loan_type === 'annuity' && d.principal && d.interest_rate && d.term_months) {
    const r = d.interest_rate / 100 / 12;
    const n = d.term_months;
    d.original_monthly_payment = Math.round(d.principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) * 100) / 100;
    d.monthly_payment = d.original_monthly_payment;
    if (d.desired_term_months && d.desired_term_months < d.term_months) {
      d.monthly_payment = Math.round(d.principal * r * Math.pow(1 + r, d.desired_term_months) / (Math.pow(1 + r, d.desired_term_months) - 1) * 100) / 100;
    }
  }

  // Auto-set priority from collateral
  if (d.collateral_type && d.collateral_type !== 'none' && !d.priority) {
    d.priority = 1;
  }

  const fields: string[] = []; const vals: any[] = [];
  // For manual (займ с рук) type: use provided monthly_payment directly
  if (d.loan_type === 'manual' && d.monthly_payment && d.monthly_payment > 0) {
    // Don't override — let it pass through
  }

  for (const k of ['name','lender','principal','interest_rate','start_date','end_date','monthly_payment','remaining_balance','loan_type','is_active','notes','term_months','desired_term_months','original_monthly_payment','collateral_type','collateral_desc','priority','repayment_mode','aggressive_pct','overdraft_limit','overdraft_used','overdraft_rate','actual_end_date','bank_monthly_payment','payment_day','min_payment']) {
    if (d[k] !== undefined) { fields.push(k+'=?'); vals.push(d[k]); }
  }
  if (fields.length) { vals.push(id); await db.prepare(`UPDATE loans SET ${fields.join(',')} WHERE id=?`).bind(...vals).run(); }
  return c.json({ success: true });
});

api.delete('/loans/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  await db.prepare('DELETE FROM loan_payments WHERE loan_id = ?').bind(c.req.param('id')).run();
  await db.prepare('DELETE FROM loans WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

api.post('/loans/:id/payments', authMiddleware, async (c) => {
  const db = c.env.DB;
  const loanId = c.req.param('id');
  const d = await c.req.json();
  await db.prepare('INSERT INTO loan_payments (loan_id, amount, principal_part, interest_part, payment_date, notes, period_key, is_extra) VALUES (?,?,?,?,?,?,?,?)')
    .bind(loanId, d.amount||0, d.principal_part||0, d.interest_part||0, d.payment_date||'', d.notes||'', d.period_key||'', d.is_extra||0).run();
  // Update remaining balance
  if (d.principal_part) {
    await db.prepare('UPDATE loans SET remaining_balance = MAX(remaining_balance - ?, 0) WHERE id = ?').bind(d.principal_part, loanId).run();
  }
  return c.json({ success: true });
});

api.delete('/loan-payments/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const paymentId = c.req.param('id');
  // Restore remaining balance before deleting
  const payment = await db.prepare('SELECT * FROM loan_payments WHERE id = ?').bind(paymentId).first();
  if (payment && payment.principal_part) {
    await db.prepare('UPDATE loans SET remaining_balance = remaining_balance + ? WHERE id = ?').bind(payment.principal_part, payment.loan_id).run();
  }
  await db.prepare('DELETE FROM loan_payments WHERE id = ?').bind(paymentId).run();
  return c.json({ success: true });
});

api.put('/loan-payments/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const paymentId = c.req.param('id');
  const d = await c.req.json();
  // Restore old principal first
  const old = await db.prepare('SELECT * FROM loan_payments WHERE id = ?').bind(paymentId).first();
  if (old && old.principal_part) {
    await db.prepare('UPDATE loans SET remaining_balance = remaining_balance + ? WHERE id = ?').bind(old.principal_part, old.loan_id).run();
  }
  await db.prepare('UPDATE loan_payments SET amount=?, principal_part=?, interest_part=?, payment_date=?, notes=? WHERE id=?')
    .bind(d.amount||0, d.principal_part||0, d.interest_part||0, d.payment_date||'', d.notes||'', paymentId).run();
  // Apply new principal
  if (d.principal_part && old) {
    await db.prepare('UPDATE loans SET remaining_balance = remaining_balance - ? WHERE id = ?').bind(d.principal_part, old.loan_id).run();
  }
  return c.json({ success: true });
});

// ===== LOAN SETTINGS (system-wide repayment mode) =====
api.get('/loan-settings', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const mode = await db.prepare("SELECT value FROM site_settings WHERE key = 'loan_repayment_mode'").first();
    const pct = await db.prepare("SELECT value FROM site_settings WHERE key = 'loan_aggressive_pct'").first();
    const extraPct = await db.prepare("SELECT value FROM site_settings WHERE key = 'loan_standard_extra_pct'").first();
    return c.json({
      repayment_mode: mode?.value || 'standard',
      aggressive_pct: pct?.value ? parseFloat(pct.value as string) : 10,
      standard_extra_pct: extraPct?.value ? parseFloat(extraPct.value as string) : 0
    });
  } catch {
    return c.json({ repayment_mode: 'standard', aggressive_pct: 10, standard_extra_pct: 0 });
  }
});

api.put('/loan-settings', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '')").run();
    if (d.repayment_mode !== undefined) {
      await db.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('loan_repayment_mode', ?)").bind(d.repayment_mode).run();
    }
    if (d.aggressive_pct !== undefined) {
      await db.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('loan_aggressive_pct', ?)").bind(String(d.aggressive_pct)).run();
    }
    if (d.standard_extra_pct !== undefined) {
      await db.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('loan_standard_extra_pct', ?)").bind(String(d.standard_extra_pct)).run();
    }
  } catch {}
  return c.json({ success: true });
});

// ===== DIVIDENDS =====
api.get('/dividends', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM dividends ORDER BY payment_date DESC, id DESC').all();
  return c.json({ dividends: res.results || [] });
});

api.post('/dividends', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  // Ensure new columns exist
  try { await db.prepare("ALTER TABLE dividends ADD COLUMN dividend_pct REAL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE dividends ADD COLUMN calc_base TEXT DEFAULT 'after_loans'").run(); } catch {}
  await db.prepare('INSERT INTO dividends (amount, recipient, payment_date, period_key, tax_amount, notes, schedule, dividend_pct, calc_base) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(d.amount||0, d.recipient||'', d.payment_date||'', d.period_key||'', d.tax_amount||0, d.notes||'', d.schedule||'monthly', d.dividend_pct||0, d.calc_base||'after_loans').run();
  // Audit log
  try { const caller = c.get('user'); await db.prepare('INSERT INTO audit_log (user_id, user_name, action, entity_type, new_value) VALUES (?,?,?,?,?)').bind(caller?.sub||0, caller?.display_name||'admin', 'dividend_create', 'dividend', JSON.stringify({amount: d.amount, recipient: d.recipient, period: d.period_key})).run(); } catch {}
  return c.json({ success: true });
});

api.put('/dividends/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = []; const vals: any[] = [];
  // Ensure new columns exist
  try { await db.prepare("ALTER TABLE dividends ADD COLUMN dividend_pct REAL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE dividends ADD COLUMN calc_base TEXT DEFAULT 'after_loans'").run(); } catch {}
  for (const k of ['amount','recipient','payment_date','period_key','tax_amount','notes','schedule','dividend_pct','calc_base']) {
    if (d[k] !== undefined) { fields.push(k+'=?'); vals.push(d[k]); }
  }
  if (fields.length) { vals.push(id); await db.prepare(`UPDATE dividends SET ${fields.join(',')} WHERE id=?`).bind(...vals).run(); }
  return c.json({ success: true });
});

api.delete('/dividends/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  await db.prepare('DELETE FROM dividends WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

// ===== OTHER INCOME / EXPENSES =====
api.get('/other-income-expenses', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM other_income_expenses ORDER BY date DESC, id DESC').all();
  return c.json({ items: res.results || [] });
});

api.post('/other-income-expenses', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  await db.prepare('INSERT INTO other_income_expenses (type, name, amount, category, date, period_key, notes) VALUES (?,?,?,?,?,?,?)')
    .bind(d.type||'expense', d.name||'', d.amount||0, d.category||'other', d.date||'', d.period_key||'', d.notes||'').run();
  return c.json({ success: true });
});

api.put('/other-income-expenses/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = []; const vals: any[] = [];
  for (const k of ['type','name','amount','category','date','period_key','notes']) {
    if (d[k] !== undefined) { fields.push(k+'=?'); vals.push(d[k]); }
  }
  if (fields.length) { vals.push(id); await db.prepare(`UPDATE other_income_expenses SET ${fields.join(',')} WHERE id=?`).bind(...vals).run(); }
  return c.json({ success: true });
});

api.delete('/other-income-expenses/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  await db.prepare('DELETE FROM other_income_expenses WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

// ===== P&L REPORT (aggregated for a period) =====
// Helper: compute P&L numbers for a given period key
async function computePnlForPeriod(db: D1Database, periodKey: string) {
  const yearStart = periodKey.substring(0, 4) + '-01';
  // Revenue from period_snapshots
  const snap = await db.prepare("SELECT * FROM period_snapshots WHERE period_key = ? AND period_type = 'month'").bind(periodKey).first();
  // Auto-generate tax payments from rules if none exist for this period
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS tax_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT, rule_name TEXT NOT NULL DEFAULT '', tax_type TEXT NOT NULL DEFAULT 'income_tax',
      tax_base TEXT DEFAULT 'revenue', tax_rate REAL DEFAULT 0, frequency TEXT DEFAULT 'monthly',
      is_active INTEGER DEFAULT 1, apply_from TEXT DEFAULT '', apply_to TEXT DEFAULT '',
      notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
    const rules = await db.prepare('SELECT * FROM tax_rules WHERE is_active = 1').all();
    const month = parseInt(periodKey.split('-')[1]);
    for (const rule of (rules.results || []) as any[]) {
      if (rule.apply_from && periodKey < rule.apply_from) continue;
      if (rule.apply_to && periodKey > rule.apply_to) continue;
      if (rule.frequency === 'quarterly' && ![3,6,9,12].includes(month)) continue;
      const existing = await db.prepare('SELECT id, is_suppressed FROM tax_payments WHERE rule_id = ? AND period_key = ?').bind(rule.id, periodKey).first();
      if (!existing) {
        await db.prepare('INSERT INTO tax_payments (tax_type, tax_name, amount, period_key, status, tax_rate, tax_base, is_auto, rule_id, is_suppressed) VALUES (?,?,0,?,?,?,?,1,?,0)')
          .bind(rule.tax_type, rule.rule_name, periodKey, 'pending', rule.tax_rate, rule.tax_base, rule.id).run();
      }
      // If existing but suppressed — do NOT recreate. User intentionally deleted it.
    }
  } catch {}

  // Re-read taxes after auto-generation (exclude suppressed entries)
  const taxesRaw = await db.prepare('SELECT * FROM tax_payments WHERE period_key = ? AND (is_suppressed IS NULL OR is_suppressed = 0)').bind(periodKey).all();
  // Assets depreciation for this month
  const assets = await db.prepare('SELECT * FROM assets WHERE is_active = 1').all();
  let monthlyDepreciation = 0;
  for (const a of (assets.results || []) as any[]) {
    if (a.purchase_date && a.purchase_date <= periodKey + '-31') {
      const monthly = (a.purchase_cost - (a.residual_value || 0)) / (a.useful_life_months || 60);
      monthlyDepreciation += Math.round(monthly * 100) / 100;
    }
  }
  // Loans interest for this period
  const loanPayments = await db.prepare("SELECT SUM(interest_part) as total_interest, SUM(amount) as total_payments, SUM(principal_part) as total_principal FROM loan_payments WHERE payment_date >= ? AND payment_date <= ?")
    .bind(periodKey + '-01', periodKey + '-31').first();
  // Loan payments list for this period
  const loanPaymentsList = await db.prepare("SELECT lp.*, l.name as loan_name FROM loan_payments lp LEFT JOIN loans l ON lp.loan_id = l.id WHERE lp.payment_date >= ? AND lp.payment_date <= ? ORDER BY lp.payment_date DESC")
    .bind(periodKey + '-01', periodKey + '-31').all();
  // Loan summary: total debt, monthly payments, load info
  const loanSummary = await db.prepare("SELECT SUM(CASE WHEN loan_type != 'overdraft' THEN remaining_balance ELSE 0 END) as total_debt, SUM(CASE WHEN loan_type != 'overdraft' THEN COALESCE(NULLIF(bank_monthly_payment, 0), monthly_payment) ELSE 0 END) + SUM(CASE WHEN loan_type = 'overdraft' THEN COALESCE(NULLIF(bank_monthly_payment, 0), monthly_payment) ELSE 0 END) as total_monthly, SUM(CASE WHEN loan_type = 'overdraft' THEN overdraft_used ELSE 0 END) as overdraft_debt, COUNT(*) as loan_count FROM loans WHERE is_active = 1").first();
  // Loan settings (system-wide)
  let loanRepayMode = 'standard', loanAggrPct = 10, loanStdExtraPct = 0;
  try {
    const modeRow = await db.prepare("SELECT value FROM site_settings WHERE key = 'loan_repayment_mode'").first();
    const pctRow = await db.prepare("SELECT value FROM site_settings WHERE key = 'loan_aggressive_pct'").first();
    const extraPctRow = await db.prepare("SELECT value FROM site_settings WHERE key = 'loan_standard_extra_pct'").first();
    if (modeRow?.value) loanRepayMode = modeRow.value as string;
    if (pctRow?.value) loanAggrPct = parseFloat(pctRow.value as string) || 10;
    if (extraPctRow?.value) loanStdExtraPct = parseFloat(extraPctRow.value as string) || 0;
  } catch {}
  // Dividends for this period
  const divs = await db.prepare('SELECT * FROM dividends WHERE period_key = ?').bind(periodKey).all();
  const totalDividends = (divs.results || []).reduce((s: number, d: any) => {
    const amt = Number(d.amount) || 0;
    // Only count tax when there's an actual dividend amount
    const tax = amt > 0 ? (Number(d.tax_amount) || 0) : 0;
    return s + amt + tax;
  }, 0);
  // Dividends YTD
  const divsYtd = await db.prepare("SELECT SUM(amount) as total_amount, SUM(tax_amount) as total_tax FROM dividends WHERE period_key >= ? AND period_key <= ?").bind(yearStart, periodKey).first();
  // Other income/expenses
  const otherIE = await db.prepare('SELECT * FROM other_income_expenses WHERE period_key = ?').bind(periodKey).all();
  let otherIncome = 0, otherExpenses = 0;
  for (const item of (otherIE.results || []) as any[]) {
    if (item.type === 'income') otherIncome += item.amount || 0;
    else otherExpenses += item.amount || 0;
  }
  // Salary summary for period — only count employees active during this period
  const periodStart = periodKey + '-01';
  const periodEnd = periodKey + '-31';
  const salaryData = await db.prepare(`SELECT 
    COALESCE(SUM(CASE WHEN u.is_active=1 AND (u.hire_date = '' OR u.hire_date IS NULL OR u.hire_date <= ?) AND (u.end_date = '' OR u.end_date IS NULL OR u.end_date >= ?) THEN u.salary ELSE 0 END), 0) as total_salaries,
    COUNT(CASE WHEN u.is_active=1 AND (u.hire_date = '' OR u.hire_date IS NULL OR u.hire_date <= ?) AND (u.end_date = '' OR u.end_date IS NULL OR u.end_date >= ?) AND u.salary > 0 THEN 1 END) as active_employee_count,
    COALESCE((SELECT SUM(CASE WHEN eb.bonus_type='bonus' OR (eb.bonus_type IS NULL AND eb.amount > 0) THEN eb.amount ELSE 0 END) FROM employee_bonuses eb WHERE eb.bonus_date >= ? AND eb.bonus_date <= ?), 0) as total_bonuses,
    COALESCE((SELECT SUM(CASE WHEN eb.bonus_type IN ('penalty','fine') OR (eb.bonus_type IS NULL AND eb.amount < 0) THEN ABS(eb.amount) ELSE 0 END) FROM employee_bonuses eb WHERE eb.bonus_date >= ? AND eb.bonus_date <= ?), 0) as total_penalties
    FROM users u WHERE u.salary > 0`)
    .bind(periodEnd, periodStart, periodEnd, periodStart, periodStart, periodEnd, periodStart, periodEnd).first();
  // Expenses from expenses table (commercial & marketing) -- BUG-FIX: filter by period
  const expData = await db.prepare(`SELECT 
    COALESCE(SUM(CASE WHEN ec.is_marketing = 0 THEN e.amount * COALESCE(eft.multiplier_monthly, 1) ELSE 0 END), 0) as commercial,
    COALESCE(SUM(CASE WHEN ec.is_marketing = 1 THEN e.amount * COALESCE(eft.multiplier_monthly, 1) ELSE 0 END), 0) as marketing
    FROM expenses e 
    LEFT JOIN expense_categories ec ON e.category_id = ec.id
    LEFT JOIN expense_frequency_types eft ON e.frequency_type_id = eft.id
    WHERE e.is_active = 1
    AND (e.start_date IS NULL OR e.start_date = '' OR e.start_date <= ?)
    AND (e.end_date IS NULL OR e.end_date = '' OR e.end_date >= ?)`).bind(periodKey + '-31', periodKey + '-01').first();
  // Commission data for this period
  let periodCommissions = 0;
  let periodCommByMethod: any[] = [];
  try {
    const commRes = await db.prepare(`SELECT pm.name_ru, pm.commission_pct, COUNT(*) as count, 
      COALESCE(SUM(l.total_amount),0) as total_base,
      COALESCE(SUM(l.commission_amount),0) as total_commission
      FROM leads l JOIN payment_methods pm ON l.payment_method_id = pm.id
      WHERE l.commission_amount > 0 AND strftime('%Y-%m', l.created_at) = ?
      GROUP BY l.payment_method_id ORDER BY total_commission DESC`).bind(periodKey).all();
    periodCommByMethod = commRes.results || [];
    for (const r of periodCommByMethod) { periodCommissions += Number((r as any).total_commission) || 0; }
  } catch {}

  // Build P&L cascade (before taxes)
  // If snapshot exists AND is locked, use snapshot data.
  // If snapshot doesn't exist or is NOT locked (open month), calculate LIVE from leads.
  let revenueServices = 0;
  let revenueArticles = 0;
  let revenuePackages = 0;
  let revenueDiscounts = 0; // track gross-to-net discount
  if (snap && snap.is_locked) {
    // Closed month — use snapshot
    revenueServices = snap.revenue_services as number || 0;
    revenueArticles = snap.revenue_articles as number || 0;
    try {
      const snapCD = JSON.parse((snap.custom_data as string) || '{}');
      revenuePackages = Number(snapCD.revenue_packages || 0);
    } catch {}
  } else {
    // Open month (current or past-but-not-locked) — calculate LIVE from leads
    // GROUND TRUTH: SUM(total_amount) is the definitive revenue (same as analytics KPI "Оборот")
    // total_amount in DB = services + articles + packages - discounts
    const liveTurnover = await db.prepare(
      `SELECT COALESCE(SUM(total_amount),0) as total FROM leads WHERE strftime('%Y-%m', created_at) = ? AND status IN ('in_progress','checking','done')`
    ).bind(periodKey).first();
    const liveRevenue = Number(liveTurnover?.total || 0);

    // Breakdown: iterate items for services/articles/packages split
    const liveLeads = await db.prepare(
      `SELECT id, total_amount, calc_data FROM leads WHERE strftime('%Y-%m', created_at) = ? AND status IN ('in_progress','checking','done')`
    ).bind(periodKey).all();
    let grossSvc = 0;
    for (const row of (liveLeads.results || [])) {
      try {
        const cd = JSON.parse(row.calc_data as string || '{}');
        // Services: iterate items, count only non-article items (same as analytics)
        if (cd.items && Array.isArray(cd.items)) {
          for (const it of cd.items) {
            if (!it.wb_article) grossSvc += Number(it.subtotal || 0);
          }
        }
        // Packages from calc_data
        if (cd.package && cd.package.package_price) {
          revenuePackages += Number(cd.package.package_price || 0);
        }
        // Discounts
        revenueDiscounts += Number(cd.discountAmount || 0);
      } catch {}
    }
    revenueServices = Math.max(0, grossSvc - revenueDiscounts); // NET services (same as analytics)
    // Articles from lead_articles table (single source of truth, same as analytics)
    const liveArt = await db.prepare(
      `SELECT COALESCE(SUM(la.total_price),0) as art_total FROM lead_articles la JOIN leads l ON la.lead_id = l.id WHERE strftime('%Y-%m', l.created_at) = ? AND l.status IN ('in_progress','checking','done')`
    ).bind(periodKey).first();
    revenueArticles = Number(liveArt?.art_total || 0);

    // Reconciliation: if breakdown doesn't add up to total_amount, adjust services to match
    // This ensures P&L Revenue ALWAYS equals SUM(total_amount) = analytics Оборот
    const breakdownSum = revenueServices + revenueArticles + revenuePackages;
    if (Math.abs(breakdownSum - liveRevenue) > 1) {
      // Difference goes into services (most likely due to rounding or stale calc_data)
      revenueServices += (liveRevenue - breakdownSum);
      if (revenueServices < 0) revenueServices = 0;
    }
  }
  const revenue = revenueServices + revenueArticles + revenuePackages; // revenue = svc + art + pkg (total client payment)
  const totalTurnover = revenueServices + revenueArticles + revenuePackages; // total money coming in
  const turnoverExclTransit = revenueServices; // services only (excluding transit buyouts)
  let refunds = 0;
  if (snap && snap.is_locked) {
    refunds = snap.refunds as number || 0;
  } else {
    // Live refunds
    const liveRef = await db.prepare(
      `SELECT COALESCE(SUM(refund_amount),0) as total FROM leads WHERE strftime('%Y-%m', created_at) = ? AND status IN ('in_progress','checking','done')`
    ).bind(periodKey).first();
    refunds = Number(liveRef?.total || 0);
  }
  const cogs = expData ? (expData.commercial as number || 0) : 0;
  const grossProfit = revenue - cogs;
  const salariesBase = salaryData?.total_salaries as number || 0;
  const bonusesVal = salaryData?.total_bonuses as number || 0;
  const penalties = salaryData?.total_penalties as number || 0;
  const activeEmployeeCount = salaryData?.active_employee_count as number || 0;
  const salaryTotal = salariesBase + bonusesVal - penalties;
  const marketing = expData ? (expData.marketing as number || 0) : 0;
  const totalOpex = salaryTotal + marketing + monthlyDepreciation;
  const ebit = grossProfit - totalOpex;
  const ebitda = ebit + monthlyDepreciation;
  const interestExpense = loanPayments ? (loanPayments.total_interest as number || 0) : 0;
  const otherNet = otherIncome - otherExpenses;
  const ebt = ebit + otherNet - interestExpense;
  const totalExpensesAll = cogs + totalOpex; // for income-minus-expenses base

  // Auto-calculate tax amounts for taxes with is_auto=1
  // tax_base: 'revenue', 'ebt', 'income_minus_expenses', 'payroll', 'vat_inclusive', 'fixed', 'total_turnover', 'turnover_excl_transit'
  const taxItems = (taxesRaw.results || []).map((t: any) => {
    if (t.is_auto && t.tax_rate > 0) {
      let base = 0;
      switch (t.tax_base) {
        case 'revenue': base = turnoverExclTransit; break; // 'revenue' mapped to turnover_excl_transit (same value)
        case 'total_turnover': base = totalTurnover; break;
        case 'turnover_excl_transit': base = turnoverExclTransit; break;
        case 'ebt': base = Math.max(ebt, 0); break;
        case 'income_minus_expenses': base = Math.max(ebt, 0); break; // mapped to ebt (merged)
        case 'payroll': base = salariesBase + bonusesVal; break;
        case 'vat_inclusive': base = revenue;
          return { ...t, amount: Math.round(revenue * t.tax_rate / (100 + t.tax_rate) * 100) / 100, calculated_base: base, calculated_base_name: 'vat_inclusive' };
        case 'vat_turnover': base = totalTurnover;
          return { ...t, amount: Math.round(totalTurnover * t.tax_rate / (100 + t.tax_rate) * 100) / 100, calculated_base: base, calculated_base_name: 'vat_turnover' };
        default: return t; // fixed — use manual amount
      }
      return { ...t, amount: Math.round(base * t.tax_rate / 100 * 100) / 100, calculated_base: base, calculated_base_name: t.tax_base };
    }
    return t;
  });

  const totalTaxes = taxItems.reduce((s: number, t: any) => s + (t.amount || 0), 0);

  // Write back auto-calculated amounts to DB so other endpoints see correct values
  for (const t of taxItems) {
    if (t.is_auto && t.tax_rate > 0 && t.id) {
      try { await db.prepare('UPDATE tax_payments SET amount = ? WHERE id = ? AND is_auto = 1').bind(t.amount || 0, t.id).run(); } catch {}
    }
  }

  // Taxes YTD (exclude suppressed)
  const taxesYtd = await db.prepare("SELECT SUM(amount) as total FROM tax_payments WHERE period_key >= ? AND period_key <= ? AND (is_suppressed IS NULL OR is_suppressed = 0)").bind(yearStart, periodKey).first();
  const autoTaxDelta = totalTaxes - (taxesRaw.results || []).reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const ytdTaxTotal = ((taxesYtd?.total as number) || 0) + autoTaxDelta;

  const netProfit = ebt - totalTaxes;
  const totalLoanPaymentsPeriod = Number(loanPayments?.total_payments) || 0;
  const totalLoanMonthlyPlan = Number(loanSummary?.total_monthly) || 0;
  // Use the greater of actual payments or planned monthly — so if no payments recorded, plan is used
  const effectiveLoanPayments = Math.max(totalLoanPaymentsPeriod, totalLoanMonthlyPlan);
  const netProfitAfterLoans = netProfit - effectiveLoanPayments;
  const retainedEarnings = netProfitAfterLoans - totalDividends;

  // Tax rules for reference (catch in case table doesn't exist yet on production)
  const taxRules = await db.prepare('SELECT * FROM tax_rules WHERE is_active = 1').all().catch(() => ({results:[]}));

  return {
    period_key: periodKey,
    revenue, revenue_services: revenueServices, revenue_articles: revenueArticles, revenue_packages: revenuePackages,
    total_turnover: totalTurnover, turnover_excl_transit: turnoverExclTransit,
    refunds, net_revenue: revenue - refunds,
    cogs, gross_profit: grossProfit,
    gross_margin: revenue > 0 ? Math.round(grossProfit / revenue * 10000) / 100 : 0,
    salaries: salariesBase, bonuses: bonusesVal, penalties, salary_total: salaryTotal,
    active_employee_count: activeEmployeeCount,
    marketing, depreciation: monthlyDepreciation, total_opex: totalOpex,
    ebit, ebit_margin: revenue > 0 ? Math.round(ebit / revenue * 10000) / 100 : 0,
    ebitda, ebitda_margin: revenue > 0 ? Math.round(ebitda / revenue * 10000) / 100 : 0,
    other_income: otherIncome, other_expenses: otherExpenses, other_net: otherNet,
    interest_expense: interestExpense,
    ebt,
    taxes: taxItems, total_taxes: totalTaxes,
    effective_tax_rate: ebt > 0 ? Math.round(totalTaxes / ebt * 10000) / 100 : 0,
    tax_burden: revenue > 0 ? Math.round(totalTaxes / revenue * 10000) / 100 : 0,
    net_profit: netProfit, net_margin: revenue > 0 ? Math.round(netProfit / revenue * 10000) / 100 : 0,
    net_profit_after_loans: netProfitAfterLoans,
    effective_loan_payments: effectiveLoanPayments,
    dividends: divs.results || [], total_dividends: totalDividends,
    retained_earnings: retainedEarnings,
    ytd_taxes: ytdTaxTotal,
    ytd_dividends_amount: divsYtd?.total_amount || 0,
    ytd_dividends_tax: divsYtd?.total_tax || 0,
    monthly_burn_rate: Math.round((totalOpex + totalTaxes + interestExpense) * 100) / 100,
    other_items: otherIE.results || [],
    assets: assets.results || [],
    loan_payments_list: loanPaymentsList.results || [],
    // Loan load data
    loan_total_debt: Number(loanSummary?.total_debt || 0) + Number(loanSummary?.overdraft_debt || 0),
    loan_total_monthly: Number(loanSummary?.total_monthly) || 0,
    loan_total_payments_period: Number(loanPayments?.total_payments) || 0,
    loan_total_principal_period: Number(loanPayments?.total_principal) || 0,
    loan_count: Number(loanSummary?.loan_count) || 0,
    loan_repayment_mode: loanRepayMode,
    loan_aggressive_pct: loanAggrPct,
    loan_standard_extra_pct: loanStdExtraPct,
    loan_load_on_revenue: revenue > 0 ? Math.round(totalLoanPaymentsPeriod / revenue * 10000) / 100 : 0,
    loan_load_on_profit: netProfit > 0 ? Math.round(totalLoanMonthlyPlan / netProfit * 10000) / 100 : 0,
    tax_rules: taxRules.results || [],
    // Commission data
    commissions_total: periodCommissions,
    commissions_by_method: periodCommByMethod,
    _bases: { revenue, ebt, payroll: salariesBase + bonusesVal, total_turnover: totalTurnover, turnover_excl_transit: turnoverExclTransit },
  };
}

// Tax summary for a specific month (for Performance section integration)
api.get('/tax-summary/:periodKey', authMiddleware, async (c) => {
  const db = c.env.DB;
  const periodKey = c.req.param('periodKey');
  try {
    const pnl = await computePnlForPeriod(db, periodKey);
    return c.json({
      period_key: periodKey,
      total_taxes: pnl.total_taxes,
      tax_burden: pnl.tax_burden,
      effective_tax_rate: pnl.effective_tax_rate,
      taxes: pnl.taxes,
      net_profit_after_tax: pnl.net_profit,
    });
  } catch (err: any) {
    return c.json({ error: 'Tax summary error: ' + (err?.message || 'unknown') }, 500);
  }
});

api.get('/pnl/:periodKey', authMiddleware, async (c) => {
  const db = c.env.DB;
  const periodKey = c.req.param('periodKey'); // format: 2026-02
  try {
    // Current period
    const current = await computePnlForPeriod(db, periodKey);
    
    // Previous month for MoM comparison
    const parts = periodKey.split('-');
    let py = parseInt(parts[0]), pm = parseInt(parts[1]) - 1;
    if (pm < 1) { pm = 12; py--; }
    const prevKey = py + '-' + String(pm).padStart(2, '0');
    const prev = await computePnlForPeriod(db, prevKey);
    
    // Fiscal year start month from settings (default: 1 = January = calendar year)
    const fiscalRow = await db.prepare("SELECT value FROM site_settings WHERE key = 'fiscal_year_start_month'").first().catch(() => null);
    const fiscalStartMonth = fiscalRow ? (parseInt(fiscalRow.value as string) || 1) : 1;
    
    // Calculate fiscal year start period_key
    const curYear = parseInt(parts[0]);
    const curMonth = parseInt(parts[1]);
    let fiscalYearStart: string;
    if (curMonth >= fiscalStartMonth) {
      fiscalYearStart = curYear + '-' + String(fiscalStartMonth).padStart(2, '0');
    } else {
      fiscalYearStart = (curYear - 1) + '-' + String(fiscalStartMonth).padStart(2, '0');
    }
    const fiscalYearStartDate = fiscalYearStart + '-01';
    
    // Count months from fiscal year start to current month
    const fStartYear = parseInt(fiscalYearStart.split('-')[0]);
    const fStartMonth = parseInt(fiscalYearStart.split('-')[1]);
    const monthsInFiscalYear = (curYear - fStartYear) * 12 + (curMonth - fStartMonth) + 1;
    
    // YTD accumulation (fiscal year start through current month)
    let ytd: any = {};
    const ytdSnaps = await db.prepare("SELECT COALESCE(SUM(revenue_services),0) as revenue_svc, COALESCE(SUM(revenue_articles),0) as revenue_art, COALESCE(SUM(refunds),0) as refunds FROM period_snapshots WHERE period_type='month' AND period_key >= ? AND period_key <= ?")
      .bind(fiscalYearStart, periodKey).first();
    const ytdTaxes = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM tax_payments WHERE period_key >= ? AND period_key <= ?")
      .bind(fiscalYearStart, periodKey).first();
    const ytdOtherIE = await db.prepare("SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) as income, COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) as expenses FROM other_income_expenses WHERE period_key >= ? AND period_key <= ?")
      .bind(fiscalYearStart, periodKey).first();
    const ytdInterest = await db.prepare("SELECT COALESCE(SUM(interest_part),0) as total FROM loan_payments WHERE payment_date >= ? AND payment_date <= ?")
      .bind(fiscalYearStartDate, periodKey + '-31').first();
    const ytdLoanPay = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM loan_payments WHERE payment_date >= ? AND payment_date <= ?")
      .bind(fiscalYearStartDate, periodKey + '-31').first();
    const ytdDivs = await db.prepare("SELECT COALESCE(SUM(amount),0) as amount, COALESCE(SUM(tax_amount),0) as tax FROM dividends WHERE period_key >= ? AND period_key <= ?")
      .bind(fiscalYearStart, periodKey).first();
    // For YTD salaries/expenses, multiply monthly rates by number of months in fiscal year
    // BUG FIX: YTD revenue must include services + articles + packages
    // Packages are stored in custom_data.revenue_packages of each snapshot
    let ytdPackages = 0;
    try {
      const pkgSnaps = await db.prepare("SELECT custom_data FROM period_snapshots WHERE period_type='month' AND period_key >= ? AND period_key <= ? AND custom_data IS NOT NULL")
        .bind(fiscalYearStart, periodKey).all();
      for (const ps of (pkgSnaps.results || [])) {
        try { const cd = JSON.parse(ps.custom_data as string || '{}'); ytdPackages += Number(cd.revenue_packages || 0); } catch {}
      }
    } catch {}
    // YTD revenue from snapshots (only locked months)
    const ytdSnapRevSvc = (ytdSnaps?.revenue_svc as number) || 0;
    const ytdSnapRevArt = (ytdSnaps?.revenue_art as number) || 0;
    let ytdRevenue = ytdSnapRevSvc + ytdSnapRevArt + ytdPackages;
    const ytdRefunds = (ytdSnaps?.refunds as number) || 0;
    // If current period is not locked (open), its revenue is NOT in snapshots,
    // so add the live-calculated current period revenue to YTD
    const currentSnap = await db.prepare("SELECT is_locked FROM period_snapshots WHERE period_key = ? AND period_type = 'month'").bind(periodKey).first();
    if (!currentSnap || !currentSnap.is_locked) {
      ytdRevenue += current.revenue;
    }
    const ytdCogs = current.cogs * monthsInFiscalYear;
    const ytdSalary = current.salary_total * monthsInFiscalYear;
    const ytdMarketing = current.marketing * monthsInFiscalYear;
    const ytdDepr = current.depreciation * monthsInFiscalYear;
    const ytdTotalOpex = ytdSalary + ytdMarketing + ytdDepr;
    const ytdGross = ytdRevenue - ytdCogs;
    const ytdEbit = ytdGross - ytdTotalOpex;
    const ytdEbitda = ytdEbit + ytdDepr;
    const ytdOtherNet = ((ytdOtherIE?.income as number) || 0) - ((ytdOtherIE?.expenses as number) || 0);
    const ytdInterestTotal = (ytdInterest?.total as number) || 0;
    const ytdEbt = ytdEbit + ytdOtherNet - ytdInterestTotal;
    const ytdTaxTotal = (ytdTaxes?.total as number) || 0;
    // Adjust YTD taxes for auto-calculated taxes in current month
    const currentAutoTaxDelta = current.total_taxes - ((current.taxes || []) as any[]).reduce((s: number, t: any) => s + (t.is_auto ? 0 : (t.amount || 0)), 0);
    const adjustedYtdTax = ytdTaxTotal + currentAutoTaxDelta;
    const ytdNet = ytdEbt - adjustedYtdTax;
    const ytdDivTotal = ((ytdDivs?.amount as number) || 0) + ((ytdDivs?.tax as number) || 0);
    // YTD loan payments: use actual payments from DB, plus plan for months without actual payments
    const ytdActualLoanPay = Number((ytdLoanPay?.total as number) || 0);
    const ytdEffLoanPayments = Math.max(ytdActualLoanPay, current.loan_total_monthly * monthsInFiscalYear);
    const ytdNetAfterLoans = ytdNet - ytdEffLoanPayments;
    
    ytd = {
      revenue: ytdRevenue, refunds: ytdRefunds, net_revenue: ytdRevenue - ytdRefunds,
      cogs: ytdCogs, gross_profit: ytdGross,
      salary_total: ytdSalary, marketing: ytdMarketing, depreciation: ytdDepr, total_opex: ytdTotalOpex,
      ebit: ytdEbit, ebitda: ytdEbitda,
      other_income: (ytdOtherIE?.income as number) || 0, other_expenses: (ytdOtherIE?.expenses as number) || 0,
      interest_expense: ytdInterestTotal, ebt: ytdEbt,
      total_taxes: adjustedYtdTax, net_profit: ytdNet,
      effective_loan_payments: ytdEffLoanPayments, net_profit_after_loans: ytdNetAfterLoans,
      total_dividends: ytdDivTotal, retained_earnings: ytdNetAfterLoans - ytdDivTotal,
      gross_margin: ytdRevenue > 0 ? Math.round(ytdGross / ytdRevenue * 10000) / 100 : 0,
      ebit_margin: ytdRevenue > 0 ? Math.round(ytdEbit / ytdRevenue * 10000) / 100 : 0,
      net_margin: ytdRevenue > 0 ? Math.round(ytdNet / ytdRevenue * 10000) / 100 : 0,
    };

    // MoM delta (current - previous)
    const mom: any = {};
    const numKeys = ['revenue','cogs','gross_profit','salary_total','marketing','depreciation','total_opex','ebit','ebitda','other_income','other_expenses','interest_expense','ebt','total_taxes','net_profit','effective_loan_payments','net_profit_after_loans','total_dividends','retained_earnings'];
    for (const k of numKeys) {
      mom[k] = Math.round(((current as any)[k] - (prev as any)[k]) * 100) / 100;
    }
    // MoM % change
    const momPct: any = {};
    for (const k of numKeys) {
      const prevVal = (prev as any)[k];
      momPct[k] = prevVal !== 0 ? Math.round(((current as any)[k] - prevVal) / Math.abs(prevVal) * 10000) / 100 : 0;
    }
    
    return c.json({
      ...current,
      prev_period: prevKey,
      fiscal_year_start: fiscalYearStart,
      fiscal_year_start_month: fiscalStartMonth,
      prev: { revenue: prev.revenue, cogs: prev.cogs, gross_profit: prev.gross_profit, salary_total: prev.salary_total, marketing: prev.marketing, depreciation: prev.depreciation, total_opex: prev.total_opex, ebit: prev.ebit, ebitda: prev.ebitda, ebt: prev.ebt, total_taxes: prev.total_taxes, net_profit: prev.net_profit, effective_loan_payments: prev.effective_loan_payments, net_profit_after_loans: prev.net_profit_after_loans, total_dividends: prev.total_dividends, retained_earnings: prev.retained_earnings },
      mom, mom_pct: momPct,
      ytd,
    });
  } catch (err: any) {
    return c.json({ error: 'P&L error: ' + (err?.message || 'unknown') }, 500);
  }
});

// ===== DATA RESET (main_admin only) =====
// Professional granular reset — clears selected data categories while preserving configuration
api.post('/data-reset', authMiddleware, async (c) => {
  const caller = c.get('user');
  if (caller.role !== 'main_admin') {
    return c.json({ error: 'Только главный администратор может выполнить сброс данных' }, 403);
  }
  
  const db = c.env.DB;
  const body = await c.req.json();
  const targets = body.targets || [];
  const confirmCode = body.confirm_code || '';
  
  if (confirmCode !== 'RESET-CONFIRM') {
    return c.json({ error: 'Для подтверждения сброса введите код: RESET-CONFIRM' }, 400);
  }
  
  const results: string[] = [];
  
  try {
    // 1. LEADS — leads, comments, articles, invoice counter
    if (targets.includes('leads')) {
      await db.prepare('DELETE FROM lead_comments').run();
      await db.prepare('DELETE FROM lead_articles').run();
      await db.prepare('DELETE FROM leads').run();
      try { await db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('leads','lead_comments','lead_articles')").run(); } catch {}
      results.push('Лиды: заявки, комментарии, артикулы удалены. Нумерация сброшена на 1.');
    }
    
    // 2. ANALYTICS — page views, activity logs, sessions
    if (targets.includes('analytics')) {
      await db.prepare('DELETE FROM page_views').run();
      await db.prepare('DELETE FROM activity_log').run();
      await db.prepare('DELETE FROM activity_sessions').run();
      try { await db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('page_views','activity_log','activity_sessions')").run(); } catch {}
      results.push('Аналитика: просмотры, логи, сессии очищены.');
    }
    
    // 3. FINANCE — loans, expenses, dividends, taxes, assets, P&L snapshots
    if (targets.includes('finance')) {
      await db.prepare('DELETE FROM loan_payments').run();
      await db.prepare('DELETE FROM loans').run();
      await db.prepare('DELETE FROM dividends').run();
      await db.prepare('DELETE FROM other_income_expenses').run();
      await db.prepare('DELETE FROM expenses').run();
      await db.prepare('DELETE FROM tax_payments').run();
      await db.prepare('DELETE FROM tax_rules').run();
      await db.prepare('DELETE FROM assets').run();
      await db.prepare('DELETE FROM period_snapshots').run();
      try { await db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('loans','loan_payments','dividends','other_income_expenses','expenses','tax_payments','tax_rules','assets','period_snapshots')").run(); } catch {}
      results.push('Финансы: кредиты, расходы, дивиденды, налоги, активы, P&L очищены.');
    }
    
    // 4. REFERRALS USAGE — reset counters only
    if (targets.includes('referrals_usage')) {
      await db.prepare('UPDATE referral_codes SET uses_count = 0, paid_uses_count = 0').run();
      results.push('Промокоды: счётчики использований сброшены (коды сохранены).');
    }
    
    // 5. EMPLOYEE DATA — bonuses, vacations
    if (targets.includes('employees')) {
      await db.prepare('DELETE FROM employee_bonuses').run();
      try { await db.prepare('DELETE FROM employee_vacations').run(); } catch {}
      try { await db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('employee_bonuses','employee_vacations')").run(); } catch {}
      results.push('Сотрудники: бонусы, штрафы, отпуска удалены (аккаунты сохранены).');
    }
    
    // 6. UPLOADS — uploaded files records
    if (targets.includes('uploads')) {
      try { await db.prepare('DELETE FROM uploads').run(); } catch {}
      try { await db.prepare("DELETE FROM sqlite_sequence WHERE name = 'uploads'").run(); } catch {}
      results.push('Загрузки: записи о загруженных файлах удалены.');
    }
    
    // 7. AUDIT LOG
    if (targets.includes('audit_log')) {
      try { await db.prepare('DELETE FROM audit_log').run(); } catch {}
      try { await db.prepare("DELETE FROM sqlite_sequence WHERE name = 'audit_log'").run(); } catch {}
      results.push('Аудит-лог: все записи журнала удалены.');
    }
    
    // 8. FULL RESET — everything above
    if (targets.includes('full')) {
      await db.prepare('DELETE FROM lead_comments').run();
      await db.prepare('DELETE FROM lead_articles').run();
      await db.prepare('DELETE FROM leads').run();
      await db.prepare('DELETE FROM page_views').run();
      await db.prepare('DELETE FROM activity_log').run();
      await db.prepare('DELETE FROM activity_sessions').run();
      await db.prepare('DELETE FROM loan_payments').run();
      await db.prepare('DELETE FROM loans').run();
      await db.prepare('DELETE FROM dividends').run();
      await db.prepare('DELETE FROM other_income_expenses').run();
      await db.prepare('DELETE FROM expenses').run();
      await db.prepare('DELETE FROM employee_bonuses').run();
      await db.prepare('DELETE FROM tax_payments').run();
      await db.prepare('DELETE FROM tax_rules').run();
      await db.prepare('DELETE FROM assets').run();
      await db.prepare('DELETE FROM period_snapshots').run();
      await db.prepare('UPDATE referral_codes SET uses_count = 0, paid_uses_count = 0').run();
      try { await db.prepare('DELETE FROM employee_vacations').run(); } catch {}
      try { await db.prepare('DELETE FROM uploads').run(); } catch {}
      try { await db.prepare('DELETE FROM audit_log').run(); } catch {}
      try { await db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('leads','lead_comments','lead_articles','page_views','activity_log','activity_sessions','loans','loan_payments','dividends','other_income_expenses','expenses','employee_bonuses','employee_vacations','tax_payments','tax_rules','assets','period_snapshots','uploads','audit_log')").run(); } catch {}
      results.push('ПОЛНЫЙ СБРОС: все операционные данные очищены. Конфигурация сохранена.');
    }
    
    if (results.length === 0) {
      return c.json({ error: 'Не выбрано ни одной категории для сброса' }, 400);
    }
    
    // Log the reset action
    try {
      await db.prepare('INSERT INTO audit_log (user_id, user_name, action, entity_type, new_value) VALUES (?,?,?,?,?)')
        .bind(caller.sub || 0, caller.display_name || 'admin', 'data_reset', 'system', JSON.stringify({ targets, results_count: results.length })).run();
    } catch {}
    
    return c.json({ success: true, results });
  } catch (err: any) {
    return c.json({ error: 'Ошибка сброса: ' + (err?.message || 'unknown') }, 500);
  }
});

// Get current data counts for reset preview
api.get('/data-counts', authMiddleware, async (c) => {
  const caller = c.get('user');
  if (caller.role !== 'main_admin') {
    return c.json({ error: 'Только главный администратор' }, 403);
  }
  
  const db = c.env.DB;
  try {
    const [leads, comments, articles, pageViews, activityLogs, sessions, loans, loanPayments, expenses, dividends, snapshots, taxPayments, assets, otherIE, bonuses, taxRules, refUses, vacations, uploads, auditLogs] = await Promise.all([
      db.prepare('SELECT COUNT(*) as cnt FROM leads').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM lead_comments').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM lead_articles').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM page_views').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM activity_log').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM activity_sessions').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM loans').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM loan_payments').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM expenses').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM dividends').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM period_snapshots').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM tax_payments').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM assets').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM other_income_expenses').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM employee_bonuses').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM tax_rules').first(),
      db.prepare('SELECT COALESCE(SUM(uses_count),0) as cnt FROM referral_codes').first(),
      db.prepare('SELECT COUNT(*) as cnt FROM employee_vacations').first().catch(() => ({cnt:0})),
      db.prepare('SELECT COUNT(*) as cnt FROM uploads').first().catch(() => ({cnt:0})),
      db.prepare('SELECT COUNT(*) as cnt FROM audit_log').first().catch(() => ({cnt:0})),
    ]);
    
    return c.json({
      leads: { leads: leads?.cnt || 0, comments: comments?.cnt || 0, articles: articles?.cnt || 0 },
      analytics: { page_views: pageViews?.cnt || 0, activity_logs: activityLogs?.cnt || 0, sessions: sessions?.cnt || 0 },
      finance: { loans: loans?.cnt || 0, loan_payments: loanPayments?.cnt || 0, expenses: expenses?.cnt || 0, dividends: dividends?.cnt || 0, snapshots: snapshots?.cnt || 0, tax_payments: taxPayments?.cnt || 0, assets: assets?.cnt || 0, other_ie: otherIE?.cnt || 0, tax_rules: taxRules?.cnt || 0 },
      referrals: { total_uses: refUses?.cnt || 0 },
      employees: { bonuses: bonuses?.cnt || 0, vacations: vacations?.cnt || 0 },
      uploads: { files: uploads?.cnt || 0 },
      audit: { logs: auditLogs?.cnt || 0 },
    });
  } catch (err: any) {
    return c.json({ error: err?.message || 'unknown' }, 500);
  }
});

}
