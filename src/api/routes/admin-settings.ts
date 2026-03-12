/**
 * Admin API — Site settings, Telegram bot, PDF templates, payment methods, slot counters, footer, photo blocks
 */
import { Hono } from 'hono'

type Bindings = { DB: D1Database }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: AuthMiddleware) {
// ===== SITE SETTINGS (webhook URLs, bot token, slot counter, etc.) =====
api.get('/settings', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM site_settings').all();
  const settings: Record<string, string> = {};
  for (const row of res.results) {
    settings[row.key as string] = row.value as string;
  }
  return c.json(settings);
});

api.put('/settings', authMiddleware, async (c) => {
  const db = c.env.DB;
  const data = await c.req.json();
  for (const [key, value] of Object.entries(data)) {
    await db.prepare('INSERT INTO site_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP')
      .bind(key, value as string).run();
  }
  return c.json({ success: true });
});

// ===== TELEGRAM BOT CONFIG =====
api.get('/telegram-bot', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM telegram_bot_config ORDER BY id').all();
  return c.json(res.results);
});

api.post('/telegram-bot', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { bot_token, chat_id, chat_name, notify_leads, notify_calc } = await c.req.json();
  await db.prepare('INSERT INTO telegram_bot_config (bot_token, chat_id, chat_name, notify_leads, notify_calc) VALUES (?,?,?,?,?)')
    .bind(bot_token, chat_id, chat_name || '', notify_leads ?? 1, notify_calc ?? 0).run();
  return c.json({ success: true });
});

api.put('/telegram-bot/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const { bot_token, chat_id, chat_name, notify_leads, notify_calc, is_active } = await c.req.json();
  await db.prepare('UPDATE telegram_bot_config SET bot_token=?, chat_id=?, chat_name=?, notify_leads=?, notify_calc=?, is_active=? WHERE id=?')
    .bind(bot_token, chat_id, chat_name || '', notify_leads ?? 1, notify_calc ?? 0, is_active ?? 1, id).run();
  return c.json({ success: true });
});

api.delete('/telegram-bot/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM telegram_bot_config WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

api.post('/telegram-bot/test', authMiddleware, async (c) => {
  const { bot_token, chat_id, message } = await c.req.json();
  try {
    const res = await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text: message || 'Test from Go to Top admin panel', parse_mode: 'HTML' })
    });
    const data = await res.json() as any;
    if (data.ok) {
      return c.json({ success: true, message: 'Message sent successfully' });
    } else {
      return c.json({ success: false, error: data.description || 'Telegram API error' }, 400);
    }
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ===== PDF TEMPLATE =====
api.get('/pdf-template', authMiddleware, async (c) => {
  const db = c.env.DB;
  let row = await db.prepare("SELECT * FROM pdf_templates WHERE template_key = 'default'").first();
  if (!row) {
    await db.prepare("INSERT INTO pdf_templates (template_key) VALUES ('default')").run();
    row = await db.prepare("SELECT * FROM pdf_templates WHERE template_key = 'default'").first();
  }
  return c.json(row);
});

api.put('/pdf-template', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  
  // Get existing columns in pdf_templates to avoid "no such column" errors
  let existingCols: Set<string>;
  try {
    const pragmaRes = await db.prepare("PRAGMA table_info(pdf_templates)").all();
    existingCols = new Set((pragmaRes.results || []).map((r: any) => r.name));
  } catch {
    existingCols = new Set();
  }
  
  // Auto-create missing label/order_message columns on the fly
  const labelFields = ['label_service','label_qty','label_price','label_sum','label_total','label_subtotal','label_client','label_date','label_invoice','label_back','order_message'];
  for (const lf of labelFields) {
    for (const lng of ['_ru','_am','_en']) {
      const col = lf + lng;
      if (!existingCols.has(col)) {
        try { await db.prepare(`ALTER TABLE pdf_templates ADD COLUMN ${col} TEXT DEFAULT ''`).run(); existingCols.add(col); } catch {}
      }
    }
  }
  
  // Build dynamic update — only update fields that are explicitly provided in the request
  // This prevents overwriting existing values (e.g. company_logo_url) with empty defaults
  const fieldMap: Record<string, any> = {};
  const knownFields = [
    'header_ru','header_am','header_en','footer_ru','footer_am','footer_en',
    'intro_ru','intro_am','intro_en','outro_ru','outro_am','outro_en',
    'company_name','company_phone','company_email','company_address',
    'company_logo_url','company_website','company_inn',
    'btn_order_ru','btn_order_am','btn_order_en',
    'btn_download_ru','btn_download_am','btn_download_en',
    'order_telegram_url','invoice_prefix','accent_color',
    'terms_ru','terms_am','terms_en',
    'bank_details_ru','bank_details_am','bank_details_en',
  ];
  for (const f of knownFields) {
    if (d[f] !== undefined && existingCols.has(f)) fieldMap[f] = d[f];
  }
  // show_qr is special (boolean → int)
  if (d.show_qr !== undefined && existingCols.has('show_qr')) fieldMap['show_qr'] = d.show_qr ? 1 : 0;
  // Label fields (already auto-created above)
  for (const lf of labelFields) {
    for (const lng of ['_ru','_am','_en']) {
      const key = lf + lng;
      if (d[key] !== undefined && existingCols.has(key)) fieldMap[key] = d[key];
    }
  }
  const keys = Object.keys(fieldMap);
  if (keys.length === 0) return c.json({ success: true, message: 'No fields to update' });
  const setClauses = keys.map(k => k + '=?').join(', ');
  const vals = keys.map(k => fieldMap[k]);
  await db.prepare(`UPDATE pdf_templates SET ${setClauses}, updated_at=CURRENT_TIMESTAMP WHERE template_key='default'`).bind(...vals).run();
  // Return updated record so frontend can verify the save
  const updated = await db.prepare("SELECT * FROM pdf_templates WHERE template_key = 'default'").first();
  return c.json({ success: true, data: updated });
});

// ===== PAYMENT METHODS =====
api.get('/payment-methods', authMiddleware, async (c) => {
  const db = c.env.DB;
  try { await db.prepare("SELECT payment_method_id FROM leads LIMIT 1").first(); } catch { try { await db.prepare("ALTER TABLE leads ADD COLUMN payment_method_id INTEGER DEFAULT NULL").run(); } catch {} }
  const rows = await db.prepare('SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY sort_order').all();
  return c.json({ methods: rows.results || [] });
});

api.post('/payment-methods', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  await db.prepare('INSERT INTO payment_methods (name_ru, name_am, commission_pct, sort_order) VALUES (?,?,?,?)')
    .bind(d.name_ru || '', d.name_am || '', d.commission_pct ?? 0, d.sort_order ?? 99).run();
  return c.json({ success: true });
});

api.put('/payment-methods/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  await db.prepare('UPDATE payment_methods SET name_ru=?, name_am=?, commission_pct=?, sort_order=?, is_active=? WHERE id=?')
    .bind(d.name_ru ?? '', d.name_am ?? '', d.commission_pct ?? 0, d.sort_order ?? 0, d.is_active ?? 1, id).run();
  return c.json({ success: true });
});

api.delete('/payment-methods/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('UPDATE payment_methods SET is_active = 0 WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// Update lead payment method
api.put('/leads/:id/payment-method', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  try { await db.prepare("SELECT payment_method_id FROM leads LIMIT 1").first(); } catch { try { await db.prepare("ALTER TABLE leads ADD COLUMN payment_method_id INTEGER DEFAULT NULL").run(); } catch {} }
  try { await db.prepare("SELECT commission_amount FROM leads LIMIT 1").first(); } catch { try { await db.prepare("ALTER TABLE leads ADD COLUMN commission_amount REAL DEFAULT 0").run(); } catch {} }
  await db.prepare('UPDATE leads SET payment_method_id = ? WHERE id = ?').bind(d.payment_method_id, id).run();
  
  // Compute commission immediately
  let commissionAmount = 0;
  if (d.payment_method_id) {
    const lead = await db.prepare('SELECT total_amount FROM leads WHERE id = ?').bind(id).first();
    const pmRow = await db.prepare('SELECT commission_pct FROM payment_methods WHERE id = ? AND is_active = 1').bind(d.payment_method_id).first();
    if (lead && pmRow) {
      const base = Number(lead.total_amount) || 0;
      const pct = Number(pmRow.commission_pct) || 0;
      commissionAmount = pct > 0 ? Math.round(base * pct / 100) : 0;
    }
  }
  await db.prepare('UPDATE leads SET commission_amount = ? WHERE id = ?').bind(commissionAmount, id).run();
  return c.json({ success: true, commission_amount: commissionAmount });
});

// ===== SLOT COUNTER (multiple) =====
api.get('/slot-counter', authMiddleware, async (c) => {
  const db = c.env.DB;
  const rows = await db.prepare('SELECT * FROM slot_counter ORDER BY id').all();
  return c.json({ counters: rows.results || [] });
});

api.post('/slot-counter', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  // No limit on number of counters
  await db.prepare('INSERT INTO slot_counter (counter_name, total_slots, booked_slots, label_ru, label_am, show_timer, reset_day, position) VALUES (?,?,?,?,?,?,?,?)')
    .bind(d.counter_name || 'new', d.total_slots ?? 10, d.booked_slots ?? 0, d.label_ru || '', d.label_am || '', d.show_timer ?? 1, d.reset_day || 'monday', d.position || 'after-hero').run();
  return c.json({ success: true });
});

api.put('/slot-counter/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  await db.prepare('UPDATE slot_counter SET counter_name=?, total_slots=?, booked_slots=?, label_ru=?, label_am=?, show_timer=?, reset_day=?, position=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .bind(d.counter_name || 'main', d.total_slots ?? 10, d.booked_slots ?? 0, d.label_ru || '', d.label_am || '', d.show_timer ?? 1, d.reset_day || 'monday', d.position || 'after-hero', id).run();
  return c.json({ success: true });
});

api.delete('/slot-counter/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM slot_counter WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

api.delete('/slot-counter-all', authMiddleware, async (c) => {
  const db = c.env.DB;
  await db.prepare('DELETE FROM slot_counter').run();
  return c.json({ success: true, message: 'All slot counters deleted' });
});

// ===== FOOTER SETTINGS =====
api.get('/footer', authMiddleware, async (c) => {
  const db = c.env.DB;
  let row = await db.prepare('SELECT * FROM footer_settings LIMIT 1').first();
  if (!row) {
    await db.prepare("INSERT INTO footer_settings (brand_text_ru, copyright_ru, location_ru) VALUES ('Безопасное продвижение товаров на Wildberries в Армении.', '© 2026 Go to Top. Все права защищены', 'Ереван, Армения')").run();
    row = await db.prepare('SELECT * FROM footer_settings LIMIT 1').first();
  }
  return c.json(row);
});

api.put('/footer', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  const exists = await db.prepare('SELECT id FROM footer_settings LIMIT 1').first();
  if (exists) {
    await db.prepare('UPDATE footer_settings SET brand_text_ru=?, brand_text_am=?, contacts_json=?, socials_json=?, nav_links_json=?, custom_html=?, copyright_ru=?, copyright_am=?, location_ru=?, location_am=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .bind(d.brand_text_ru||'', d.brand_text_am||'', d.contacts_json||'[]', d.socials_json||'[]', d.nav_links_json||'[]', d.custom_html||'', d.copyright_ru||'', d.copyright_am||'', d.location_ru||'', d.location_am||'', exists.id).run();
  } else {
    await db.prepare('INSERT INTO footer_settings (brand_text_ru, brand_text_am, contacts_json, socials_json, nav_links_json, custom_html, copyright_ru, copyright_am, location_ru, location_am) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(d.brand_text_ru||'', d.brand_text_am||'', d.contacts_json||'[]', d.socials_json||'[]', d.nav_links_json||'[]', d.custom_html||'', d.copyright_ru||'', d.copyright_am||'', d.location_ru||'', d.location_am||'').run();
  }
  return c.json({ success: true });
});

// ===== PHOTO BLOCKS =====
api.get('/photo-blocks', authMiddleware, async (c) => {
  const db = c.env.DB;
  const rows = await db.prepare('SELECT * FROM photo_blocks ORDER BY sort_order').all();
  return c.json({ blocks: rows.results || [] });
});

api.post('/photo-blocks', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  await db.prepare('INSERT INTO photo_blocks (block_name, description_ru, description_am, photos_json, position, sort_order, is_visible) VALUES (?,?,?,?,?,?,?)')
    .bind(d.block_name||'', d.description_ru||'', d.description_am||'', d.photos_json||'[]', d.position||'after-services', d.sort_order||0, d.is_visible??1).run();
  return c.json({ success: true });
});

api.put('/photo-blocks/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  await db.prepare('UPDATE photo_blocks SET block_name=?, description_ru=?, description_am=?, photos_json=?, position=?, sort_order=?, is_visible=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .bind(d.block_name||'', d.description_ru||'', d.description_am||'', d.photos_json||'[]', d.position||'after-services', d.sort_order||0, d.is_visible??1, id).run();
  return c.json({ success: true });
});

api.delete('/photo-blocks/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM photo_blocks WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

}
