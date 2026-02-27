/**
 * Database initialization and helpers
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  display_name TEXT,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sections_json TEXT DEFAULT '[]',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_key TEXT UNIQUE NOT NULL,
  block_type TEXT DEFAULT 'section',
  title_ru TEXT DEFAULT '',
  title_am TEXT DEFAULT '',
  texts_ru TEXT DEFAULT '[]',
  texts_am TEXT DEFAULT '[]',
  images TEXT DEFAULT '[]',
  buttons TEXT DEFAULT '[]',
  custom_css TEXT DEFAULT '',
  custom_html TEXT DEFAULT '',
  is_visible INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  social_links TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_name TEXT DEFAULT '',
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_key TEXT UNIQUE NOT NULL,
  section_name TEXT NOT NULL,
  content_json TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calculator_tabs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab_key TEXT UNIQUE NOT NULL,
  name_ru TEXT NOT NULL,
  name_am TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS calculator_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab_id INTEGER NOT NULL,
  name_ru TEXT NOT NULL,
  name_am TEXT NOT NULL,
  price INTEGER NOT NULL,
  price_type TEXT DEFAULT 'fixed',
  price_tiers_json TEXT,
  tier_desc_ru TEXT,
  tier_desc_am TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (tab_id) REFERENCES calculator_tabs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS telegram_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  button_key TEXT UNIQUE NOT NULL,
  button_label_ru TEXT NOT NULL DEFAULT '',
  button_label_am TEXT NOT NULL DEFAULT '',
  telegram_url TEXT NOT NULL,
  message_template_ru TEXT NOT NULL DEFAULT '',
  message_template_am TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS custom_scripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  script_type TEXT NOT NULL DEFAULT 'js',
  placement TEXT NOT NULL DEFAULT 'head',
  code TEXT NOT NULL DEFAULT '',
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page TEXT NOT NULL DEFAULT '/',
  referrer TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  lang TEXT DEFAULT 'ru',
  country TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS section_order (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id TEXT UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_visible INTEGER DEFAULT 1,
  label_ru TEXT DEFAULT '',
  label_am TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS referral_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  discount_percent INTEGER DEFAULT 0,
  free_reviews INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  uses_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_number INTEGER DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'form',
  name TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  product TEXT DEFAULT '',
  service TEXT DEFAULT '',
  message TEXT DEFAULT '',
  calc_data TEXT DEFAULT '',
  lang TEXT DEFAULT 'ru',
  status TEXT DEFAULT 'new',
  notes TEXT DEFAULT '',
  assigned_to INTEGER DEFAULT NULL,
  total_amount REAL DEFAULT 0,
  referral_code TEXT DEFAULT '',
  custom_fields TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  user_id INTEGER,
  user_name TEXT DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS telegram_bot_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_token TEXT NOT NULL DEFAULT '',
  chat_id TEXT NOT NULL DEFAULT '',
  chat_name TEXT DEFAULT '',
  notify_leads INTEGER DEFAULT 1,
  notify_calc INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pdf_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT UNIQUE NOT NULL DEFAULT 'default',
  header_ru TEXT DEFAULT 'Коммерческое предложение',
  header_am TEXT DEFAULT 'Կomerch առdelays',
  footer_ru TEXT DEFAULT '',
  footer_am TEXT DEFAULT '',
  intro_ru TEXT DEFAULT '',
  intro_am TEXT DEFAULT '',
  outro_ru TEXT DEFAULT '',
  outro_am TEXT DEFAULT '',
  button_label_ru TEXT DEFAULT 'Скачать КП (PDF)',
  button_label_am TEXT DEFAULT 'Ներdelays КП (PDF)',
  btn_order_ru TEXT DEFAULT 'Заказать сейчас',
  btn_order_am TEXT DEFAULT 'Պատվիրել հիմա',
  btn_download_ru TEXT DEFAULT 'Скачать',
  btn_download_am TEXT DEFAULT 'Ներբեռնել',
  order_telegram_url TEXT DEFAULT 'https://t.me/goo_to_top',
  company_name TEXT DEFAULT 'Go to Top',
  company_phone TEXT DEFAULT '',
  company_email TEXT DEFAULT '',
  company_address TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS slot_counter (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  counter_name TEXT DEFAULT 'main',
  total_slots INTEGER DEFAULT 10,
  booked_slots INTEGER DEFAULT 0,
  label_ru TEXT DEFAULT 'Свободных мест на этой неделе',
  label_am TEXT DEFAULT '',
  show_timer INTEGER DEFAULT 1,
  reset_day TEXT DEFAULT 'monday',
  position TEXT DEFAULT 'after-hero',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS footer_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_text_ru TEXT DEFAULT '',
  brand_text_am TEXT DEFAULT '',
  contacts_json TEXT DEFAULT '[]',
  socials_json TEXT DEFAULT '[]',
  nav_links_json TEXT DEFAULT '[]',
  custom_html TEXT DEFAULT '',
  copyright_ru TEXT DEFAULT '',
  copyright_am TEXT DEFAULT '',
  location_ru TEXT DEFAULT '',
  location_am TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS photo_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_name TEXT DEFAULT '',
  description_ru TEXT DEFAULT '',
  description_am TEXT DEFAULT '',
  photos_json TEXT DEFAULT '[]',
  position TEXT DEFAULT 'after-services',
  sort_order INTEGER DEFAULT 0,
  is_visible INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lead_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  wb_article TEXT NOT NULL DEFAULT '',
  wb_link TEXT DEFAULT '',
  product_name TEXT DEFAULT '',
  size TEXT DEFAULT '',
  color TEXT DEFAULT '',
  quantity INTEGER DEFAULT 1,
  price_per_unit REAL DEFAULT 0,
  total_price REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  buyer_id INTEGER DEFAULT NULL,
  notes TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_articles_lead ON lead_articles(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_articles_status ON lead_articles(status);
CREATE INDEX IF NOT EXISTS idx_lead_articles_buyer ON lead_articles(buyer_id);

CREATE TABLE IF NOT EXISTS company_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_key TEXT UNIQUE NOT NULL,
  role_name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  default_sections TEXT DEFAULT '["dashboard"]',
  color TEXT DEFAULT '#8B5CF6',
  is_system INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  color TEXT DEFAULT '#8B5CF6',
  is_marketing INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_frequency_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  multiplier_monthly REAL DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  amount REAL DEFAULT 0,
  category_id INTEGER DEFAULT NULL,
  frequency_type_id INTEGER DEFAULT NULL,
  is_active INTEGER DEFAULT 1,
  notes TEXT DEFAULT '',
  start_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (frequency_type_id) REFERENCES expense_frequency_types(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS employee_bonuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL DEFAULT 0,
  bonus_type TEXT DEFAULT 'bonus',
  description TEXT DEFAULT '',
  bonus_date TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS period_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_type TEXT NOT NULL DEFAULT 'month',
  period_key TEXT NOT NULL DEFAULT '',
  revenue_services REAL DEFAULT 0,
  revenue_articles REAL DEFAULT 0,
  total_turnover REAL DEFAULT 0,
  refunds REAL DEFAULT 0,
  expense_salaries REAL DEFAULT 0,
  expense_commercial REAL DEFAULT 0,
  expense_marketing REAL DEFAULT 0,
  net_profit REAL DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  leads_done INTEGER DEFAULT 0,
  avg_check REAL DEFAULT 0,
  custom_data TEXT DEFAULT '{}',
  is_locked INTEGER DEFAULT 0,
  closed_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_type, period_key)
);

CREATE TABLE IF NOT EXISTS employee_vacations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  days_count INTEGER DEFAULT 0,
  is_paid INTEGER DEFAULT 1,
  paid_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'planned',
  notes TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  last_action TEXT DEFAULT '',
  last_page TEXT DEFAULT '',
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip TEXT DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vacations_user ON employee_vacations(user_id);
CREATE INDEX IF NOT EXISTS idx_vacations_dates ON employee_vacations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_freq ON expenses(frequency_type_id);
CREATE INDEX IF NOT EXISTS idx_bonuses_user ON employee_bonuses(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_period ON period_snapshots(period_type, period_key);

CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT DEFAULT '',
  mime_type TEXT DEFAULT '',
  data_base64 TEXT NOT NULL,
  block_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

let dbInitialized = false;

export async function initDatabase(db: D1Database): Promise<void> {
  // Quick check: if already initialized in this worker instance, skip
  if (dbInitialized) return;
  
  // Quick check: if key tables exist, mark as initialized and skip heavy init
  try {
    const check = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='period_snapshots'").first();
    if (check) {
      dbInitialized = true;
      // ALWAYS run latest migrations even on existing DBs
      await runLatestMigrations(db);
      // Still run seeds in case they're missing
      await runSeeds(db);
      return;
    }
  } catch {}
  
  const statements = SCHEMA.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    await db.prepare(stmt + ';').run();
  }
  // Migrations
  try { await db.prepare("ALTER TABLE slot_counter ADD COLUMN position TEXT DEFAULT 'after-hero'").run(); } catch {}
  try { await db.prepare("ALTER TABLE slot_counter ADD COLUMN counter_name TEXT DEFAULT 'main'").run(); } catch {}
  try { await db.prepare("ALTER TABLE pdf_templates ADD COLUMN btn_order_ru TEXT DEFAULT 'Заказать сейчас'").run(); } catch {}
  try { await db.prepare("ALTER TABLE pdf_templates ADD COLUMN btn_order_am TEXT DEFAULT 'Պատվիրել հիմա'").run(); } catch {}
  try { await db.prepare("ALTER TABLE pdf_templates ADD COLUMN btn_download_ru TEXT DEFAULT 'Скачать'").run(); } catch {}
  try { await db.prepare("ALTER TABLE pdf_templates ADD COLUMN btn_download_am TEXT DEFAULT 'Ներբեռնdelays'").run(); } catch {}
  try { await db.prepare("ALTER TABLE pdf_templates ADD COLUMN order_telegram_url TEXT DEFAULT 'https://t.me/goo_to_top'").run(); } catch {}
  // v2 Migrations: employee system + site blocks
  try { await db.prepare("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''").run(); } catch {}
  try { await db.prepare("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''").run(); } catch {}
  try { await db.prepare("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1").run(); } catch {}
  try { await db.prepare("ALTER TABLE leads ADD COLUMN lead_number INTEGER DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE leads ADD COLUMN assigned_to INTEGER DEFAULT NULL").run(); } catch {}
  try { await db.prepare("ALTER TABLE leads ADD COLUMN total_amount REAL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE leads ADD COLUMN custom_fields TEXT DEFAULT ''").run(); } catch {}
  // v3 Migrations: lead_articles support + articles_count cache on leads
  try { await db.prepare("ALTER TABLE leads ADD COLUMN articles_count INTEGER DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE leads ADD COLUMN articles_done INTEGER DEFAULT 0").run(); } catch {}
  // v4 Migrations: telegram group link & TZ link for leads
  try { await db.prepare("ALTER TABLE leads ADD COLUMN telegram_group TEXT DEFAULT ''").run(); } catch {}
  try { await db.prepare("ALTER TABLE leads ADD COLUMN tz_link TEXT DEFAULT ''").run(); } catch {}
  // v5 Migrations: refund_amount for leads
  try { await db.prepare("ALTER TABLE leads ADD COLUMN refund_amount REAL DEFAULT 0").run(); } catch {}
  // v7 Migrations: salary fields on users
  try { await db.prepare("ALTER TABLE users ADD COLUMN salary REAL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE users ADD COLUMN salary_type TEXT DEFAULT 'monthly'").run(); } catch {}
  try { await db.prepare("ALTER TABLE users ADD COLUMN position_title TEXT DEFAULT ''").run(); } catch {}
  try { await db.prepare("ALTER TABLE users ADD COLUMN password_plain TEXT DEFAULT ''").run(); } catch {}
  // v8 Migrations: ensure company_roles has role_name column  
  try { await db.prepare("ALTER TABLE company_roles ADD COLUMN role_name TEXT NOT NULL DEFAULT ''").run(); } catch {}
  // v9 Migrations: bonus_type for fines support
  try { await db.prepare("ALTER TABLE employee_bonuses ADD COLUMN bonus_type TEXT DEFAULT 'bonus'").run(); } catch {}
  // v9 Cleanup: remove accounts with display_name containing 'готр' (any role, except primary admin id=1)
  try { await db.prepare("DELETE FROM users WHERE display_name LIKE '%готр%' AND id != 1").run(); } catch {}
  // Run seeds
  await runSeeds(db);
  dbInitialized = true;
}

// Latest migrations that MUST run on every DB (including already-initialized production)
async function runLatestMigrations(db: D1Database): Promise<void> {
  // v8: ensure company_roles has role_name column
  try { await db.prepare("ALTER TABLE company_roles ADD COLUMN role_name TEXT NOT NULL DEFAULT ''").run(); } catch {}
  // v9 Migrations: bonus_type for fines support
  try { await db.prepare("ALTER TABLE employee_bonuses ADD COLUMN bonus_type TEXT DEFAULT 'bonus'").run(); } catch {}
  // v10: ensure users have hire_date and end_date columns
  try { await db.prepare("ALTER TABLE users ADD COLUMN hire_date TEXT DEFAULT ''").run(); } catch {}
  try { await db.prepare("ALTER TABLE users ADD COLUMN end_date TEXT DEFAULT ''").run(); } catch {}
  // v9 Cleanup: remove accounts with display_name containing 'готр' (any role, except primary admin id=1)
  try { await db.prepare("DELETE FROM users WHERE display_name LIKE '%готр%' AND id != 1").run(); } catch {}
  // v11: Migrate old permissions/company_roles to team_access
  try {
    const rows = await db.prepare('SELECT user_id, sections_json FROM user_permissions').all();
    for (const row of rows.results || []) {
      let sections: string[] = [];
      try { sections = JSON.parse(row.sections_json as string); } catch { continue; }
      let changed = false;
      const hasOldPerms = sections.includes('permissions');
      const hasOldRoles = sections.includes('company_roles');
      if (hasOldPerms || hasOldRoles) {
        sections = sections.filter(s => s !== 'permissions' && s !== 'company_roles');
        if (!sections.includes('team_access')) sections.push('team_access');
        changed = true;
      }
      if (changed) {
        await db.prepare('UPDATE user_permissions SET sections_json = ? WHERE user_id = ?')
          .bind(JSON.stringify(sections), row.user_id).run();
      }
    }
  } catch {}
  // v11: Migrate company_roles default_sections from permissions/company_roles to team_access
  try {
    const roles = await db.prepare('SELECT id, default_sections FROM company_roles').all();
    for (const role of roles.results || []) {
      let sections: string[] = [];
      try { sections = JSON.parse(role.default_sections as string); } catch { continue; }
      const hasOld = sections.includes('permissions') || sections.includes('company_roles');
      if (hasOld) {
        sections = sections.filter(s => s !== 'permissions' && s !== 'company_roles');
        if (!sections.includes('team_access')) sections.push('team_access');
        await db.prepare('UPDATE company_roles SET default_sections = ? WHERE id = ?')
          .bind(JSON.stringify(sections), role.id).run();
      }
    }
  } catch {}
  // v12: ensure employee_vacations & activity_sessions tables exist
  // Use .prepare().run() instead of .exec() for D1 production compatibility
  try { await db.prepare(`CREATE TABLE IF NOT EXISTS employee_vacations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, start_date TEXT NOT NULL DEFAULT '',
    end_date TEXT NOT NULL DEFAULT '', days_count INTEGER DEFAULT 0, is_paid INTEGER DEFAULT 1,
    paid_amount REAL DEFAULT 0, status TEXT DEFAULT 'planned', notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).run(); } catch {}
  try { await db.prepare(`CREATE TABLE IF NOT EXISTS activity_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, last_action TEXT DEFAULT '',
    last_page TEXT DEFAULT '', last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP, ip TEXT DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).run(); } catch {}
  try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_vacations_user ON employee_vacations(user_id)').run(); } catch {}
  try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_vacations_dates ON employee_vacations(start_date, end_date)').run(); } catch {}
  try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_sessions(user_id)').run(); } catch {}
  // v13: ensure company_roles has description column (fix copy/edit error)
  try { await db.prepare("ALTER TABLE company_roles ADD COLUMN description TEXT DEFAULT ''").run(); } catch {}
  // v13: ensure company_roles has is_active column
  try { await db.prepare("ALTER TABLE company_roles ADD COLUMN is_active INTEGER DEFAULT 1").run(); } catch {}
  // v14: ensure company_roles has updated_at column (fix D1_ERROR: no such column: updated_at)
  try { await db.prepare("ALTER TABLE company_roles ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP").run(); } catch {}
  // v14: ensure company_roles has role_label column (fix NOT NULL constraint on legacy DBs)
  try { await db.prepare("ALTER TABLE company_roles ADD COLUMN role_label TEXT DEFAULT ''").run(); } catch {}
  // v14: sync role_label = role_name where role_label is empty
  try { await db.prepare("UPDATE company_roles SET role_label = role_name WHERE role_label = '' AND role_name != ''").run(); } catch {}
  try { await db.prepare("UPDATE company_roles SET role_name = role_label WHERE role_name = '' AND role_label != ''").run(); } catch {}
  // v15: add telegram_link to users (replaces email for contact)
  try { await db.prepare("ALTER TABLE users ADD COLUMN telegram_link TEXT DEFAULT ''").run(); } catch {}
  // v15: migrate email data to telegram_link if it looks like telegram
  try { await db.prepare("UPDATE users SET telegram_link = email WHERE email LIKE '%t.me%' AND (telegram_link = '' OR telegram_link IS NULL)").run(); } catch {}
  // v16: P&L Financial tables — taxes, assets (amortization), loans, dividends, other_income_expenses
  try { await db.prepare(`CREATE TABLE IF NOT EXISTS tax_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, tax_type TEXT NOT NULL DEFAULT 'income_tax',
    tax_name TEXT DEFAULT '', amount REAL DEFAULT 0, period_key TEXT DEFAULT '',
    payment_date TEXT DEFAULT '', due_date TEXT DEFAULT '', status TEXT DEFAULT 'paid',
    notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run(); } catch {}
  try { await db.prepare(`CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '',
    purchase_date TEXT DEFAULT '', purchase_cost REAL DEFAULT 0,
    useful_life_months INTEGER DEFAULT 60, residual_value REAL DEFAULT 0,
    depreciation_method TEXT DEFAULT 'straight_line', category TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1, notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run(); } catch {}
  try { await db.prepare(`CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL DEFAULT '',
    lender TEXT DEFAULT '', principal REAL DEFAULT 0,
    interest_rate REAL DEFAULT 0, start_date TEXT DEFAULT '',
    end_date TEXT DEFAULT '', monthly_payment REAL DEFAULT 0,
    remaining_balance REAL DEFAULT 0, loan_type TEXT DEFAULT 'bank',
    is_active INTEGER DEFAULT 1, notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run(); } catch {}
  try { await db.prepare(`CREATE TABLE IF NOT EXISTS loan_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, loan_id INTEGER NOT NULL,
    amount REAL DEFAULT 0, principal_part REAL DEFAULT 0,
    interest_part REAL DEFAULT 0, payment_date TEXT DEFAULT '',
    notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
  )`).run(); } catch {}
  try { await db.prepare(`CREATE TABLE IF NOT EXISTS dividends (
    id INTEGER PRIMARY KEY AUTOINCREMENT, amount REAL DEFAULT 0,
    recipient TEXT DEFAULT '', payment_date TEXT DEFAULT '',
    period_key TEXT DEFAULT '', tax_amount REAL DEFAULT 0,
    notes TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run(); } catch {}
  try { await db.prepare(`CREATE TABLE IF NOT EXISTS other_income_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT DEFAULT 'expense',
    name TEXT NOT NULL DEFAULT '', amount REAL DEFAULT 0,
    category TEXT DEFAULT 'other', date TEXT DEFAULT '',
    period_key TEXT DEFAULT '', notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run(); } catch {}
  try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_tax_period ON tax_payments(period_key)').run(); } catch {}
  try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_dividends_period ON dividends(period_key)').run(); } catch {}
  try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_other_ie_period ON other_income_expenses(period_key)').run(); } catch {}
  try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id)').run(); } catch {}
  // v16: Add date column to expenses if missing (for period-based filtering)
  try { await db.prepare("ALTER TABLE expenses ADD COLUMN date TEXT DEFAULT ''").run(); } catch {}
  // v17: Add tax_rate and tax_base columns to tax_payments for auto-calculation
  try { await db.prepare("ALTER TABLE tax_payments ADD COLUMN tax_rate REAL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE tax_payments ADD COLUMN tax_base TEXT DEFAULT 'fixed'").run(); } catch {}
  try { await db.prepare("ALTER TABLE tax_payments ADD COLUMN is_auto INTEGER DEFAULT 0").run(); } catch {}
  // v18: Tax Rules engine — recurring rules that auto-generate monthly tax payments
  try { await db.prepare(`CREATE TABLE IF NOT EXISTS tax_rules (
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
  )`).run(); } catch {}
  try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_tax_rules_active ON tax_rules(is_active)').run(); } catch {}
  // v18: Add rule_id to tax_payments to link auto-generated payments to their rule
  try { await db.prepare("ALTER TABLE tax_payments ADD COLUMN rule_id INTEGER DEFAULT NULL").run(); } catch {}
  // v18b: Add is_suppressed to tax_payments (soft-delete for rule-based taxes so they don't auto-regenerate)
  try { await db.prepare("ALTER TABLE tax_payments ADD COLUMN is_suppressed INTEGER DEFAULT 0").run(); } catch {}
  // v19: Add hire_date/end_date to users for payroll tax period filtering
  try { await db.prepare("ALTER TABLE users ADD COLUMN hire_date TEXT DEFAULT ''").run(); } catch {}
  try { await db.prepare("ALTER TABLE users ADD COLUMN end_date TEXT DEFAULT ''").run(); } catch {}
  // v20: Enhanced loan module — new fields for annuity, overdraft, collateral, aggressive repayment
  try { await db.prepare("ALTER TABLE loans ADD COLUMN term_months INTEGER DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE loans ADD COLUMN desired_term_months INTEGER DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE loans ADD COLUMN original_monthly_payment REAL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE loans ADD COLUMN collateral_type TEXT DEFAULT 'none'").run(); } catch {}
  try { await db.prepare("ALTER TABLE loans ADD COLUMN collateral_desc TEXT DEFAULT ''").run(); } catch {}
  try { await db.prepare("ALTER TABLE loans ADD COLUMN priority INTEGER DEFAULT 10").run(); } catch {}
  try { await db.prepare("ALTER TABLE loans ADD COLUMN repayment_mode TEXT DEFAULT 'standard'").run(); } catch {}
  try { await db.prepare("ALTER TABLE loans ADD COLUMN aggressive_pct REAL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE loans ADD COLUMN overdraft_limit REAL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE loans ADD COLUMN overdraft_used REAL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE loans ADD COLUMN overdraft_rate REAL DEFAULT 0").run(); } catch {}
  // v20: Add period_key and extra_principal to loan_payments for tracking extra payments
  try { await db.prepare("ALTER TABLE loan_payments ADD COLUMN period_key TEXT DEFAULT ''").run(); } catch {}
  try { await db.prepare("ALTER TABLE loan_payments ADD COLUMN is_extra INTEGER DEFAULT 0").run(); } catch {}
  // v21: actual_end_date for loans (when a credit is actually paid off early)
  try { await db.prepare("ALTER TABLE loans ADD COLUMN actual_end_date TEXT DEFAULT ''").run(); } catch {}
  // v21: Global loan settings stored in site_settings — repayment_mode + aggressive_pct apply system-wide
  // Settings are stored via the existing settings table mechanism
  // v22: Dividend schedule support (monthly, quarterly, yearly)
  try { await db.prepare("ALTER TABLE dividends ADD COLUMN schedule TEXT DEFAULT 'monthly'").run(); } catch {}
  // v22: Overdraft term/payment fields for unified calculations
  try { await db.prepare("ALTER TABLE loans ADD COLUMN bank_monthly_payment REAL DEFAULT 0").run(); } catch {}
  // v23: site_blocks — add social_links column for per-block social media links
  try { await db.prepare("ALTER TABLE site_blocks ADD COLUMN social_links TEXT DEFAULT '[]'").run(); } catch {}
}

async function runSeeds(db: D1Database): Promise<void> {
  // v8 Migrations: seed default expense categories
  try {
    const catCount = await db.prepare('SELECT COUNT(*) as cnt FROM expense_categories').first();
    if (!catCount || (catCount.cnt as number) === 0) {
      const cats = [
        { name: 'Реклама / Маркетинг', color: '#EF4444', marketing: 1, order: 0 },
        { name: 'Аренда', color: '#3B82F6', marketing: 0, order: 1 },
        { name: 'Софт / Подписки', color: '#8B5CF6', marketing: 0, order: 2 },
        { name: 'Логистика', color: '#F59E0B', marketing: 0, order: 3 },
        { name: 'Связь / Интернет', color: '#10B981', marketing: 0, order: 4 },
        { name: 'Прочее', color: '#64748B', marketing: 0, order: 5 },
      ];
      for (const c of cats) {
        await db.prepare('INSERT INTO expense_categories (name, color, is_marketing, sort_order) VALUES (?,?,?,?)').bind(c.name, c.color, c.marketing, c.order).run();
      }
    }
  } catch {}
  // v9 Migrations: seed default expense frequency types
  try {
    const freqCount = await db.prepare('SELECT COUNT(*) as cnt FROM expense_frequency_types').first();
    if (!freqCount || (freqCount.cnt as number) === 0) {
      const freqs = [
        { name: 'Разовая', mult: 0, order: 0 },
        { name: 'Ежемесячная', mult: 1, order: 1 },
        { name: 'За 15 дней', mult: 2, order: 2 },
        { name: 'Почасовая', mult: 0, order: 3 },
      ];
      for (const f of freqs) {
        await db.prepare('INSERT INTO expense_frequency_types (name, multiplier_monthly, sort_order) VALUES (?,?,?)').bind(f.name, f.mult, f.order).run();
      }
    }
  } catch {}
  // v6 Migrations: seed default company_roles
  try {
    const rolesCount = await db.prepare('SELECT COUNT(*) as cnt FROM company_roles').first();
    if (!rolesCount || (rolesCount.cnt as number) === 0) {
      const defaultRoles = [
        { key: 'main_admin', name: 'Главный Админ', desc: 'Полный доступ ко всем разделам', sections: JSON.stringify([...ALL_SECTIONS]), color: '#8B5CF6', system: 1, order: 0 },
        { key: 'developer', name: 'Разработчик', desc: 'Доступ к блокам, калькулятору, скриптам, настройкам', sections: JSON.stringify(['dashboard','blocks','calculator','scripts','settings']), color: '#3B82F6', system: 1, order: 1 },
        { key: 'analyst', name: 'Аналитик', desc: 'Доступ к лидам и аналитике', sections: JSON.stringify(['dashboard','leads','analytics']), color: '#10B981', system: 1, order: 2 },
        { key: 'operator', name: 'Оператор', desc: 'Работа с лидами / CRM', sections: JSON.stringify(['dashboard','leads']), color: '#F59E0B', system: 1, order: 3 },
        { key: 'buyer', name: 'Выкупщик', desc: 'Базовый доступ', sections: JSON.stringify(['dashboard']), color: '#EF4444', system: 1, order: 4 },
        { key: 'courier', name: 'Курьер', desc: 'Базовый доступ', sections: JSON.stringify(['dashboard']), color: '#6366F1', system: 1, order: 5 },
      ];
      for (const r of defaultRoles) {
        await db.prepare('INSERT OR IGNORE INTO company_roles (role_key, role_name, description, default_sections, color, is_system, sort_order) VALUES (?,?,?,?,?,?,?)')
          .bind(r.key, r.name, r.desc, r.sections, r.color, r.system, r.order).run();
      }
    }
  } catch {}
}

// ===== ROLES & PERMISSIONS CONFIG =====
export const ALL_ROLES = ['main_admin', 'developer', 'analyst', 'operator', 'buyer', 'courier'] as const;
export const ALL_SECTIONS = [
  'dashboard', 'leads', 'analytics', 'employees', 'team_access',
  'blocks', 'calculator', 'pdf', 'referrals', 'slots',
  'footer', 'telegram', 'tgbot', 'scripts', 'settings'
] as const;
export const ROLE_LABELS: Record<string, string> = {
  main_admin: 'Главный Админ', developer: 'Разработчик', analyst: 'Аналитик',
  operator: 'Оператор', buyer: 'Выкупщик', courier: 'Курьер',
};
export const SECTION_LABELS: Record<string, string> = {
  dashboard: 'Дашборд', leads: 'Лиды / CRM', analytics: 'Бизнес-аналитика', employees: 'Сотрудники',
  team_access: 'Роли и доступы', blocks: 'Конструктор блоков',
  calculator: 'Калькулятор', pdf: 'PDF шаблон', referrals: 'Реферальные коды',
  slots: 'Счётчики слотов', footer: 'Футер сайта', telegram: 'TG сообщения',
  tgbot: 'TG Бот / Уведомления', scripts: 'Скрипты', settings: 'Настройки',
};
export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  main_admin: [...ALL_SECTIONS],
  // analyst gets analytics access by default
  developer: ['dashboard', 'blocks', 'calculator', 'scripts', 'settings'],
  analyst: ['dashboard', 'leads', 'analytics'],
  operator: ['dashboard', 'leads'],
  buyer: ['dashboard'],
  courier: ['dashboard'],
};

export async function getAllContent(db: D1Database): Promise<Record<string, any>> {
  const rows = await db.prepare('SELECT section_key, content_json FROM site_content ORDER BY sort_order').all();
  const content: Record<string, any> = {};
  for (const row of rows.results) {
    try {
      content[row.section_key as string] = JSON.parse(row.content_json as string);
    } catch {
      content[row.section_key as string] = [];
    }
  }
  return content;
}

export async function getCalcTabs(db: D1Database): Promise<any[]> {
  const res = await db.prepare('SELECT * FROM calculator_tabs WHERE is_active = 1 ORDER BY sort_order').all();
  return res.results;
}

export async function getCalcServices(db: D1Database): Promise<any[]> {
  const res = await db.prepare('SELECT * FROM calculator_services WHERE is_active = 1 ORDER BY tab_id, sort_order').all();
  return res.results;
}

export async function getTelegramMessages(db: D1Database): Promise<Record<string, any>> {
  const res = await db.prepare('SELECT * FROM telegram_messages WHERE is_active = 1 ORDER BY sort_order').all();
  const msgs: Record<string, any> = {};
  for (const row of res.results) {
    msgs[row.button_key as string] = row;
  }
  return msgs;
}

export async function getCustomScripts(db: D1Database): Promise<{ head: string[]; body_start: string[]; body_end: string[] }> {
  const res = await db.prepare('SELECT * FROM custom_scripts WHERE is_active = 1 ORDER BY sort_order').all();
  const scripts = { head: [] as string[], body_start: [] as string[], body_end: [] as string[] };
  for (const row of res.results) {
    const placement = row.placement as string;
    const code = row.code as string;
    if (placement === 'head') scripts.head.push(code);
    else if (placement === 'body_start') scripts.body_start.push(code);
    else if (placement === 'body_end') scripts.body_end.push(code);
  }
  return scripts;
}
