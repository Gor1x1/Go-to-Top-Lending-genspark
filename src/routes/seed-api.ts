/**
 * Seed data from site — extracts current texts into D1
 */
import { Hono } from 'hono'
import { initDatabase } from '../lib/db'
import { verifyToken } from '../lib/auth'
import { SEED_CONTENT_SECTIONS, SEED_CALC_TABS, SEED_CALC_SERVICES, SEED_TG_MESSAGES } from '../seed-data'

type Bindings = { DB: D1Database }

export function register(app: Hono<{ Bindings: Bindings }>) {
app.post('/api/admin/seed-from-site', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);
  const tokenVal = authHeader.replace('Bearer ', '');
  const payload = await verifyToken(tokenVal);
  if (!payload) return c.json({ error: 'Unauthorized' }, 401);
  
  const db = c.env.DB;
  await initDatabase(db);
  
  // Seed content sections - extracted from HTML
  const sections = SEED_CONTENT_SECTIONS;
  for (const s of sections) {
    await db.prepare('INSERT OR REPLACE INTO site_content (section_key, section_name, content_json, sort_order) VALUES (?,?,?,?)')
      .bind(s.key, s.name, JSON.stringify(s.items), s.sort).run();
  }
  
  // Seed calculator tabs
  const calcTabs = SEED_CALC_TABS;
  for (const t of calcTabs) {
    const existing = await db.prepare('SELECT id FROM calculator_tabs WHERE tab_key = ?').bind(t.key).first();
    if (!existing) {
      await db.prepare('INSERT INTO calculator_tabs (tab_key, name_ru, name_am, sort_order) VALUES (?,?,?,?)')
        .bind(t.key, t.ru, t.am, t.sort).run();
    }
  }
  
  // Seed calculator services
  const calcServices = SEED_CALC_SERVICES;
  for (const s of calcServices) {
    const tab = await db.prepare('SELECT id FROM calculator_tabs WHERE tab_key = ?').bind(s.tab).first();
    if (!tab) continue;
    const existing = await db.prepare('SELECT id FROM calculator_services WHERE tab_id = ? AND name_ru = ?').bind(tab.id, s.ru).first();
    if (!existing) {
      await db.prepare('INSERT INTO calculator_services (tab_id, name_ru, name_am, price, price_type, price_tiers_json, tier_desc_ru, tier_desc_am, sort_order) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(tab.id, s.ru, s.am, s.price, s.type, s.tiers || null, s.tierRu || null, s.tierAm || null, s.sort).run();
    }
  }
  
  // Seed telegram messages
  const tgMsgs = SEED_TG_MESSAGES;
  for (const m of tgMsgs) {
    const existing = await db.prepare('SELECT id FROM telegram_messages WHERE button_key = ?').bind(m.key).first();
    if (!existing) {
      await db.prepare('INSERT INTO telegram_messages (button_key, button_label_ru, button_label_am, telegram_url, message_template_ru, message_template_am, description) VALUES (?,?,?,?,?,?,?)')
        .bind(m.key, m.labelRu, m.labelAm, m.url, m.msgRu, m.msgAm, m.desc).run();
    }
  }
  
  // Seed slot counter (default from HTML template)
  const existingSlot = await db.prepare('SELECT id FROM slot_counter LIMIT 1').first();
  if (!existingSlot) {
    await db.prepare('INSERT INTO slot_counter (counter_name, total_slots, booked_slots, label_ru, label_am, show_timer, reset_day, position) VALUES (?,?,?,?,?,?,?,?)')
      .bind('main', 100, 80, 'Свободных мест на этой неделе', 'Delays there this week hamara', 1, 'monday', 'after-hero').run();
  }
  
  return c.json({ success: true, message: 'Seeded successfully' });
})
}
