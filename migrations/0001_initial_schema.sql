-- ============================================
-- Go to Top — Admin Panel Database Schema
-- Full schema (includes all migrations up to v11)
-- ============================================

-- Users table (admin auth + roles + employee data)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  display_name TEXT,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  salary REAL DEFAULT 0,
  salary_type TEXT DEFAULT 'monthly',
  position_title TEXT DEFAULT '',
  password_plain TEXT DEFAULT '',
  hire_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User permissions (per-user section access)
CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sections_json TEXT DEFAULT '[]',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Site content blocks (stores JSON with all RU+AM texts per section)
CREATE TABLE IF NOT EXISTS site_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_key TEXT UNIQUE NOT NULL,
  section_name TEXT NOT NULL,
  content_json TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Calculator tabs
CREATE TABLE IF NOT EXISTS calculator_tabs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tab_key TEXT UNIQUE NOT NULL,
  name_ru TEXT NOT NULL,
  name_am TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

-- Calculator services
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

-- Telegram button messages
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

-- Custom scripts (analytics, pixels, etc.)
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

-- Page views analytics
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page TEXT NOT NULL DEFAULT '/',
  referrer TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  lang TEXT DEFAULT 'ru',
  country TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Section ordering for landing page
CREATE TABLE IF NOT EXISTS section_order (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id TEXT UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_visible INTEGER DEFAULT 1,
  label_ru TEXT DEFAULT '',
  label_am TEXT DEFAULT ''
);

-- Referral codes
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

-- Leads / CRM
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
  articles_count INTEGER DEFAULT 0,
  articles_done INTEGER DEFAULT 0,
  telegram_group TEXT DEFAULT '',
  tz_link TEXT DEFAULT '',
  refund_amount REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lead comments
CREATE TABLE IF NOT EXISTS lead_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  user_id INTEGER,
  user_name TEXT DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Site settings (key-value)
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Telegram bot config
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

-- PDF templates
CREATE TABLE IF NOT EXISTS pdf_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT UNIQUE NOT NULL DEFAULT 'default',
  header_ru TEXT DEFAULT 'Коммерческое предложение',
  header_am TEXT DEFAULT '',
  footer_ru TEXT DEFAULT '',
  footer_am TEXT DEFAULT '',
  intro_ru TEXT DEFAULT '',
  intro_am TEXT DEFAULT '',
  outro_ru TEXT DEFAULT '',
  outro_am TEXT DEFAULT '',
  button_label_ru TEXT DEFAULT 'Скачать КП (PDF)',
  button_label_am TEXT DEFAULT '',
  btn_order_ru TEXT DEFAULT 'Заказать сейчас',
  btn_order_am TEXT DEFAULT 'Պատվիրել հիdelays',
  btn_download_ru TEXT DEFAULT 'Скачать',
  btn_download_am TEXT DEFAULT 'Ներdelays',
  order_telegram_url TEXT DEFAULT 'https://t.me/goo_to_top',
  company_name TEXT DEFAULT 'Go to Top',
  company_phone TEXT DEFAULT '',
  company_email TEXT DEFAULT '',
  company_address TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Slot counter (urgency widget)
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

-- Footer settings
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

-- Photo blocks
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

-- Site blocks (visual block editor)
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

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_name TEXT DEFAULT '',
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lead articles (WB products per lead)
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

-- Company roles (role templates)
-- NOTE: Production DB has 'role_label' column; new installs use 'role_name'
-- The seed file handles both via column naming
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

-- Expense categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  color TEXT DEFAULT '#8B5CF6',
  is_marketing INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Expense frequency types
CREATE TABLE IF NOT EXISTS expense_frequency_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  multiplier_monthly REAL DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- Expenses
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

-- Employee bonuses/fines
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

-- Period snapshots (monthly/weekly analytics)
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_section ON site_content(section_key);
CREATE INDEX IF NOT EXISTS idx_calc_svc_tab ON calculator_services(tab_id);
CREATE INDEX IF NOT EXISTS idx_tg_msg_key ON telegram_messages(button_key);
CREATE INDEX IF NOT EXISTS idx_scripts_place ON custom_scripts(placement, is_active);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_freq ON expenses(frequency_type_id);
CREATE INDEX IF NOT EXISTS idx_bonuses_user ON employee_bonuses(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_period ON period_snapshots(period_type, period_key);
