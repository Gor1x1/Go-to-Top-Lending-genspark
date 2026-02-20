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

CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_freq ON expenses(frequency_type_id);
CREATE INDEX IF NOT EXISTS idx_bonuses_user ON employee_bonuses(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_period ON period_snapshots(period_type, period_key);
`;

export async function initDatabase(db: D1Database): Promise<void> {
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
  'dashboard', 'leads', 'analytics', 'employees', 'permissions', 'company_roles',
  'blocks', 'calculator', 'pdf', 'referrals', 'slots',
  'footer', 'telegram', 'tgbot', 'scripts', 'settings'
] as const;
export const ROLE_LABELS: Record<string, string> = {
  main_admin: 'Главный Админ', developer: 'Разработчик', analyst: 'Аналитик',
  operator: 'Оператор', buyer: 'Выкупщик', courier: 'Курьер',
};
export const SECTION_LABELS: Record<string, string> = {
  dashboard: 'Дашборд', leads: 'Лиды / CRM', analytics: 'Бизнес-аналитика', employees: 'Сотрудники',
  permissions: 'Управление доступами', company_roles: 'Роли компании', blocks: 'Конструктор блоков',
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
