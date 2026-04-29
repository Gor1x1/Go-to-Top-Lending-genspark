/**
 * Admin API — Site content, calculator tabs/services/packages, telegram messages, scripts, seed data
 */
import { Hono } from 'hono'

type Bindings = { DB: D1Database }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: AuthMiddleware) {
// ===== SITE CONTENT =====
api.get('/content', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM site_content ORDER BY sort_order').all();
  return c.json(res.results);
});

api.get('/content/:key', authMiddleware, async (c) => {
  const db = c.env.DB;
  const key = c.req.param('key');
  const row = await db.prepare('SELECT * FROM site_content WHERE section_key = ?').bind(key).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

api.put('/content/:key', authMiddleware, async (c) => {
  const db = c.env.DB;
  const key = c.req.param('key');
  const { content_json, section_name } = await c.req.json();
  
  const existing = await db.prepare('SELECT id FROM site_content WHERE section_key = ?').bind(key).first();
  if (existing) {
    await db.prepare('UPDATE site_content SET content_json = ?, section_name = COALESCE(?, section_name), updated_at = CURRENT_TIMESTAMP WHERE section_key = ?')
      .bind(JSON.stringify(content_json), section_name || null, key).run();
  } else {
    await db.prepare('INSERT INTO site_content (section_key, section_name, content_json) VALUES (?, ?, ?)')
      .bind(key, section_name || key, JSON.stringify(content_json)).run();
  }
  return c.json({ success: true });
});

// Create new content section (duplicate/new block)
api.post('/content', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { section_key, section_name, content_json, sort_order } = await c.req.json();
  if (!section_key) return c.json({ error: 'section_key required' }, 400);
  const existing = await db.prepare('SELECT id FROM site_content WHERE section_key = ?').bind(section_key).first();
  if (existing) return c.json({ error: 'Section key already exists' }, 400);
  await db.prepare('INSERT INTO site_content (section_key, section_name, content_json, sort_order) VALUES (?,?,?,?)')
    .bind(section_key, section_name || section_key, JSON.stringify(content_json || []), sort_order || 999).run();
  // Also add to section_order
  await db.prepare('INSERT OR IGNORE INTO section_order (section_id, sort_order, is_visible, label_ru, label_am) VALUES (?,?,1,?,?)')
    .bind(section_key, sort_order || 999, section_name || section_key, '').run();
  return c.json({ success: true });
});

// Delete content section completely
api.delete('/content/:key', authMiddleware, async (c) => {
  const db = c.env.DB;
  const key = c.req.param('key');
  await db.prepare('DELETE FROM site_content WHERE section_key = ?').bind(key).run();
  await db.prepare('DELETE FROM section_order WHERE section_id = ?').bind(key).run();
  return c.json({ success: true });
});

// ===== CALCULATOR TABS =====
api.get('/calc-tabs', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM calculator_tabs ORDER BY sort_order').all();
  return c.json(res.results);
});

api.post('/calc-tabs', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { tab_key, name_ru, name_am, sort_order } = await c.req.json();
  await db.prepare('INSERT INTO calculator_tabs (tab_key, name_ru, name_am, sort_order) VALUES (?, ?, ?, ?)')
    .bind(tab_key, name_ru, name_am, sort_order || 0).run();
  return c.json({ success: true });
});

api.put('/calc-tabs/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const { name_ru, name_am, sort_order, is_active } = await c.req.json();
  await db.prepare('UPDATE calculator_tabs SET name_ru=?, name_am=?, sort_order=?, is_active=? WHERE id=?')
    .bind(name_ru, name_am, sort_order, is_active, id).run();
  return c.json({ success: true });
});

api.delete('/calc-tabs/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM calculator_services WHERE tab_id = ?').bind(id).run();
  await db.prepare('DELETE FROM calculator_tabs WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== CALCULATOR SERVICES =====
api.get('/calc-services', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare(`
    SELECT cs.*, ct.tab_key, ct.name_ru as tab_name_ru 
    FROM calculator_services cs 
    JOIN calculator_tabs ct ON cs.tab_id = ct.id 
    ORDER BY cs.tab_id, cs.sort_order
  `).all();
  return c.json(res.results);
});

api.post('/calc-services', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { tab_id, name_ru, name_am, price, price_type, price_tiers_json, tier_desc_ru, tier_desc_am, sort_order } = await c.req.json();
  await db.prepare(`INSERT INTO calculator_services (tab_id, name_ru, name_am, price, price_type, price_tiers_json, tier_desc_ru, tier_desc_am, sort_order) VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(tab_id, name_ru, name_am, price, price_type || 'fixed', price_tiers_json || null, tier_desc_ru || null, tier_desc_am || null, sort_order || 0).run();
  return c.json({ success: true });
});

api.put('/calc-services/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const { tab_id, name_ru, name_am, price, price_type, price_tiers_json, tier_desc_ru, tier_desc_am, sort_order, is_active } = await c.req.json();
  await db.prepare(`UPDATE calculator_services SET tab_id=?, name_ru=?, name_am=?, price=?, price_type=?, price_tiers_json=?, tier_desc_ru=?, tier_desc_am=?, sort_order=?, is_active=? WHERE id=?`)
    .bind(tab_id, name_ru, name_am, price, price_type, price_tiers_json || null, tier_desc_ru || null, tier_desc_am || null, sort_order, is_active, id).run();
  return c.json({ success: true });
});

api.delete('/calc-services/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM calculator_services WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== REORDER CALC SERVICES (drag-and-drop) =====
api.put('/calc-services-reorder', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { orders } = await c.req.json(); // [{id, sort_order, tab_id?}]
  if (!Array.isArray(orders)) return c.json({ error: 'orders must be array' }, 400);
  for (const o of orders) {
    if (o.tab_id !== undefined) {
      await db.prepare('UPDATE calculator_services SET sort_order = ?, tab_id = ? WHERE id = ?').bind(o.sort_order, o.tab_id, o.id).run();
    } else {
      await db.prepare('UPDATE calculator_services SET sort_order = ? WHERE id = ?').bind(o.sort_order, o.id).run();
    }
  }
  return c.json({ success: true });
});

// ===== CALCULATOR PACKAGES =====
api.get('/calc-packages', authMiddleware, async (c) => {
  const db = c.env.DB;
  const packages = await db.prepare('SELECT * FROM calculator_packages ORDER BY sort_order, id').all();
  const items = await db.prepare('SELECT pi.*, cs.name_ru as service_name_ru, cs.name_am as service_name_am FROM calculator_package_items pi LEFT JOIN calculator_services cs ON pi.service_id = cs.id ORDER BY pi.id').all();
  const itemsByPkg: Record<number, any[]> = {};
  for (const it of items.results) {
    const pid = it.package_id as number;
    if (!itemsByPkg[pid]) itemsByPkg[pid] = [];
    itemsByPkg[pid].push(it);
  }
  const result = (packages.results || []).map((p: any) => ({ ...p, items: itemsByPkg[p.id] || [] }));
  return c.json(result);
});

api.post('/calc-packages', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  const res = await db.prepare(`INSERT INTO calculator_packages (name_ru, name_am, description_ru, description_am, original_price, package_price, badge_ru, badge_am, is_popular, crown_tier, sort_order, is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(d.name_ru||'', d.name_am||'', d.description_ru||'', d.description_am||'', d.original_price||0, d.package_price||0, d.badge_ru||'', d.badge_am||'', d.crown_tier?1:0, d.crown_tier||'', d.sort_order||0, d.is_active!==undefined?d.is_active:1).run();
  const pkgId = res.meta?.last_row_id;
  if (pkgId && d.items && Array.isArray(d.items)) {
    for (const item of d.items) {
      await db.prepare('INSERT INTO calculator_package_items (package_id, service_id, quantity, use_tiered) VALUES (?,?,?,?)').bind(pkgId, item.service_id, item.quantity||1, item.use_tiered?1:0).run();
    }
  }
  return c.json({ success: true, id: pkgId });
});

api.put('/calc-packages/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'));
  const d = await c.req.json();
  await db.prepare(`UPDATE calculator_packages SET name_ru=?, name_am=?, description_ru=?, description_am=?, original_price=?, package_price=?, badge_ru=?, badge_am=?, is_popular=?, crown_tier=?, sort_order=?, is_active=? WHERE id=?`)
    .bind(d.name_ru||'', d.name_am||'', d.description_ru||'', d.description_am||'', d.original_price||0, d.package_price||0, d.badge_ru||'', d.badge_am||'', d.crown_tier?1:0, d.crown_tier||'', d.sort_order||0, d.is_active!==undefined?d.is_active:1, id).run();
  // Replace items
  await db.prepare('DELETE FROM calculator_package_items WHERE package_id = ?').bind(id).run();
  if (d.items && Array.isArray(d.items)) {
    for (const item of d.items) {
      await db.prepare('INSERT INTO calculator_package_items (package_id, service_id, quantity, use_tiered) VALUES (?,?,?,?)').bind(id, item.service_id, item.quantity||1, item.use_tiered?1:0).run();
    }
  }
  return c.json({ success: true });
});

api.delete('/calc-packages/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = parseInt(c.req.param('id'));
  await db.prepare('DELETE FROM calculator_package_items WHERE package_id = ?').bind(id).run();
  await db.prepare('DELETE FROM calculator_packages WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

api.put('/calc-packages-reorder', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { order } = await c.req.json();
  for (const o of order) {
    await db.prepare('UPDATE calculator_packages SET sort_order = ? WHERE id = ?').bind(o.sort_order, o.id).run();
  }
  return c.json({ success: true });
});

// ===== TELEGRAM MESSAGES =====
api.get('/telegram', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM telegram_messages ORDER BY sort_order, id').all();
  return c.json(res.results);
});

api.post('/telegram', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { button_key, button_label_ru, button_label_am, telegram_url, message_template_ru, message_template_am, description } = await c.req.json();
  await db.prepare(`INSERT INTO telegram_messages (button_key, button_label_ru, button_label_am, telegram_url, message_template_ru, message_template_am, description) VALUES (?,?,?,?,?,?,?)`)
    .bind(button_key, button_label_ru, button_label_am, telegram_url, message_template_ru, message_template_am, description || '').run();
  return c.json({ success: true });
});

api.put('/telegram/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const { button_label_ru, button_label_am, telegram_url, message_template_ru, message_template_am, description, is_active } = await c.req.json();
  await db.prepare(`UPDATE telegram_messages SET button_label_ru=?, button_label_am=?, telegram_url=?, message_template_ru=?, message_template_am=?, description=?, is_active=? WHERE id=?`)
    .bind(button_label_ru, button_label_am, telegram_url, message_template_ru, message_template_am, description, is_active, id).run();
  return c.json({ success: true });
});

api.delete('/telegram/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM telegram_messages WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== CUSTOM SCRIPTS =====
api.get('/scripts', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM custom_scripts ORDER BY sort_order').all();
  return c.json(res.results);
});

api.post('/scripts', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { name, description, script_type, placement, code } = await c.req.json();
  await db.prepare('INSERT INTO custom_scripts (name, description, script_type, placement, code) VALUES (?,?,?,?,?)')
    .bind(name, description || '', script_type || 'js', placement || 'head', code).run();
  return c.json({ success: true });
});

api.put('/scripts/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const { name, description, script_type, placement, code, is_active } = await c.req.json();
  await db.prepare('UPDATE custom_scripts SET name=?, description=?, script_type=?, placement=?, code=?, is_active=? WHERE id=?')
    .bind(name, description, script_type, placement, code, is_active, id).run();
  return c.json({ success: true });
});

api.delete('/scripts/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM custom_scripts WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== SEED DATA =====
api.post('/seed', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { data } = await c.req.json();
  // data is an array of SQL statements or structured data
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.type === 'content') {
        await db.prepare('INSERT OR REPLACE INTO site_content (section_key, section_name, content_json, sort_order) VALUES (?,?,?,?)')
          .bind(item.section_key, item.section_name, JSON.stringify(item.content_json), item.sort_order || 0).run();
      }
    }
  }
  return c.json({ success: true });
});
}
