-- ============================================
-- Go to Top — Admin Panel Database Schema v1
-- ============================================

-- Users table (admin auth + future roles)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  display_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_section ON site_content(section_key);
CREATE INDEX IF NOT EXISTS idx_calc_svc_tab ON calculator_services(tab_id);
CREATE INDEX IF NOT EXISTS idx_tg_msg_key ON telegram_messages(button_key);
CREATE INDEX IF NOT EXISTS idx_scripts_place ON custom_scripts(placement, is_active);
