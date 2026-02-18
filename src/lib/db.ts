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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  referral_code TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  company_name TEXT DEFAULT 'Go to Top',
  company_phone TEXT DEFAULT '',
  company_email TEXT DEFAULT '',
  company_address TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS slot_counter (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total_slots INTEGER DEFAULT 10,
  booked_slots INTEGER DEFAULT 0,
  label_ru TEXT DEFAULT 'Свободных мест на этой неделе',
  label_am TEXT DEFAULT '',
  show_timer INTEGER DEFAULT 1,
  reset_day TEXT DEFAULT 'monday',
  position TEXT DEFAULT 'after-hero',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

export async function initDatabase(db: D1Database): Promise<void> {
  const statements = SCHEMA.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    await db.prepare(stmt + ';').run();
  }
  // Migration: add position column if missing
  try { await db.prepare("ALTER TABLE slot_counter ADD COLUMN position TEXT DEFAULT 'after-hero'").run(); } catch {}
}

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
