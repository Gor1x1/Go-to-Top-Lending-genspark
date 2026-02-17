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
`;

export async function initDatabase(db: D1Database): Promise<void> {
  const statements = SCHEMA.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    await db.prepare(stmt + ';').run();
  }
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
