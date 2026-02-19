/**
 * Admin API routes — full CRUD for all admin panel sections
 */
import { Hono } from 'hono'
import { verifyToken, hashPassword, verifyPassword, createToken, initDefaultAdmin, generatePassword } from '../lib/auth'
import { initDatabase, ALL_ROLES, ALL_SECTIONS, ROLE_LABELS, SECTION_LABELS, DEFAULT_PERMISSIONS } from '../lib/db'

type Bindings = { DB: D1Database }
const api = new Hono<{ Bindings: Bindings }>()

// ===== AUTH MIDDLEWARE =====
async function authMiddleware(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const token = authHeader.replace('Bearer ', '');
  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
  c.set('user', payload);
  await next();
}

// ===== AUTH =====
api.post('/login', async (c) => {
  const { username, password } = await c.req.json();
  const db = c.env.DB;
  
  // Init DB and default admin on first request
  await initDatabase(db);
  await initDefaultAdmin(db);
  
  const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);
  if (!user.is_active) return c.json({ error: 'Account deactivated' }, 401);
  
  const valid = await verifyPassword(password, user.password_hash as string);
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401);
  
  // Get user permissions
  const permsRow = await db.prepare('SELECT sections_json FROM user_permissions WHERE user_id = ?').bind(user.id).first();
  const userPerms = permsRow ? JSON.parse(permsRow.sections_json as string) : (DEFAULT_PERMISSIONS[user.role as string] || []);
  
  const token = await createToken(user.id as number, user.role as string);
  return c.json({ 
    token, 
    user: { id: user.id, username: user.username, role: user.role, display_name: user.display_name, permissions: userPerms },
    rolesConfig: { roles: ALL_ROLES, sections: ALL_SECTIONS, role_labels: ROLE_LABELS, section_labels: SECTION_LABELS, default_permissions: DEFAULT_PERMISSIONS }
  });
});

api.post('/change-password', authMiddleware, async (c) => {
  const { current_password, new_password } = await c.req.json();
  const db = c.env.DB;
  const userId = c.get('user').sub;
  
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return c.json({ error: 'User not found' }, 404);
  
  const valid = await verifyPassword(current_password, user.password_hash as string);
  if (!valid) return c.json({ error: 'Wrong current password' }, 400);
  
  const newHash = await hashPassword(new_password);
  await db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newHash, userId).run();
  return c.json({ success: true });
});

// ===== INIT DATABASE =====
api.post('/init-db', authMiddleware, async (c) => {
  const db = c.env.DB;
  await initDatabase(db);
  return c.json({ success: true, message: 'Database initialized' });
});

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

// ===== DASHBOARD STATS =====
api.get('/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const content = await db.prepare('SELECT COUNT(*) as count FROM site_content').first();
  const services = await db.prepare('SELECT COUNT(*) as count FROM calculator_services').first();
  const messages = await db.prepare('SELECT COUNT(*) as count FROM telegram_messages').first();
  const scripts = await db.prepare('SELECT COUNT(*) as count FROM custom_scripts').first();
  
  // Leads stats
  const totalLeads = await db.prepare('SELECT COUNT(*) as count FROM leads').first().catch(() => ({ count: 0 }));
  const newLeads = await db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'new'").first().catch(() => ({ count: 0 }));
  const todayLeads = await db.prepare("SELECT COUNT(*) as count FROM leads WHERE date(created_at) = date('now')").first().catch(() => ({ count: 0 }));
  
  // Analytics data
  const todayViews = await db.prepare("SELECT COUNT(*) as count FROM page_views WHERE date(created_at) = date('now')").first().catch(() => ({ count: 0 }));
  const weekViews = await db.prepare("SELECT COUNT(*) as count FROM page_views WHERE created_at >= datetime('now', '-7 days')").first().catch(() => ({ count: 0 }));
  const monthViews = await db.prepare("SELECT COUNT(*) as count FROM page_views WHERE created_at >= datetime('now', '-30 days')").first().catch(() => ({ count: 0 }));
  const totalViews = await db.prepare("SELECT COUNT(*) as count FROM page_views").first().catch(() => ({ count: 0 }));
  
  // Views by day (last 7 days)
  const dailyViews = await db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count 
    FROM page_views 
    WHERE created_at >= datetime('now', '-7 days') 
    GROUP BY date(created_at) 
    ORDER BY day DESC
  `).all().catch(() => ({ results: [] }));
  
  // Top referrers
  const topReferrers = await db.prepare(`
    SELECT referrer, COUNT(*) as count 
    FROM page_views 
    WHERE referrer != '' AND created_at >= datetime('now', '-30 days')
    GROUP BY referrer ORDER BY count DESC LIMIT 10
  `).all().catch(() => ({ results: [] }));
  
  // Language stats
  const langStats = await db.prepare(`
    SELECT lang, COUNT(*) as count 
    FROM page_views 
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY lang ORDER BY count DESC
  `).all().catch(() => ({ results: [] }));
  
  // Active referral codes
  const refCodes = await db.prepare("SELECT COUNT(*) as count FROM referral_codes WHERE is_active = 1").first().catch(() => ({ count: 0 }));
  
  return c.json({
    content_sections: content?.count || 0,
    calculator_services: services?.count || 0,
    telegram_buttons: messages?.count || 0,
    custom_scripts: scripts?.count || 0,
    referral_codes: refCodes?.count || 0,
    leads: {
      total: totalLeads?.count || 0,
      new: newLeads?.count || 0,
      today: todayLeads?.count || 0
    },
    analytics: {
      today: todayViews?.count || 0,
      week: weekViews?.count || 0,
      month: monthViews?.count || 0,
      total: totalViews?.count || 0,
      daily: dailyViews?.results || [],
      referrers: topReferrers?.results || [],
      languages: langStats?.results || []
    }
  });
});

// ===== REFERRAL CODES =====
api.get('/referrals', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM referral_codes ORDER BY created_at DESC').all();
  return c.json(res.results);
});

api.post('/referrals', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { code, description, discount_percent, free_reviews } = await c.req.json();
  await db.prepare('INSERT INTO referral_codes (code, description, discount_percent, free_reviews) VALUES (?,?,?,?)')
    .bind((code || '').trim().toUpperCase(), description || '', discount_percent || 0, free_reviews || 0).run();
  return c.json({ success: true });
});

api.put('/referrals/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const { code, description, discount_percent, free_reviews, is_active } = await c.req.json();
  await db.prepare('UPDATE referral_codes SET code=?, description=?, discount_percent=?, free_reviews=?, is_active=? WHERE id=?')
    .bind((code || '').trim().toUpperCase(), description || '', discount_percent || 0, free_reviews || 0, is_active ?? 1, id).run();
  return c.json({ success: true });
});

api.delete('/referrals/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM referral_codes WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== SECTION ORDER =====
api.get('/section-order', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM section_order ORDER BY sort_order').all();
  return c.json(res.results);
});

api.post('/section-order', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { sections } = await c.req.json();
  // sections = [{section_id, sort_order, is_visible, label_ru, label_am}]
  for (const s of sections) {
    await db.prepare(
      'INSERT INTO section_order (section_id, sort_order, is_visible, label_ru, label_am) VALUES (?,?,?,?,?) ON CONFLICT(section_id) DO UPDATE SET sort_order=excluded.sort_order, is_visible=excluded.is_visible, label_ru=excluded.label_ru, label_am=excluded.label_am'
    ).bind(s.section_id, s.sort_order, s.is_visible ?? 1, s.label_ru || '', s.label_am || '').run();
  }
  return c.json({ success: true });
});

api.put('/section-order/seed', authMiddleware, async (c) => {
  const db = c.env.DB;
  // Seed default section order
  const defaults = [
    { id: 'hero', order: 0, ru: 'Главный экран', am: 'Գլdelays' },
    { id: 'ticker', order: 1, ru: 'Бегущая строка', am: 'Ընdelays' },
    { id: 'wb-banner', order: 2, ru: 'WB Баннер', am: 'WB Բdelays' },
    { id: 'stats-bar', order: 3, ru: 'Статистика', am: ' Delays' },
    { id: 'about', order: 4, ru: 'О нас', am: 'Մdelays մdelays' },
    { id: 'services', order: 5, ru: 'Услуги', am: 'Ctions' },
    { id: 'buyout-detail', order: 6, ru: 'Детали выкупа', am: 'Gdelays' },
    { id: 'why-buyouts', order: 7, ru: 'Почему выкупы', am: 'Idelays' },
    { id: 'wb-official', order: 8, ru: 'WB официально', am: 'WB Пdelays' },
    { id: 'calculator', order: 9, ru: 'Калькулятор', am: 'Hdelays' },
    { id: 'process', order: 10, ru: 'Как мы работаем', am: 'Idelays' },
    { id: 'warehouse', order: 11, ru: 'Склад', am: 'Пdelays' },
    { id: 'guarantee', order: 12, ru: 'Гарантии', am: 'Edelays' },
    { id: 'comparison', order: 13, ru: 'Сравнение', am: 'Hdelays' },
    { id: 'important', order: 14, ru: 'Важно знать', am: 'Кdelays' },
    { id: 'faq', order: 15, ru: 'FAQ', am: 'ՀTdelays' },
    { id: 'contact', order: 16, ru: 'Контакты', am: 'Кdelays' },
  ];
  for (const d of defaults) {
    const existing = await db.prepare('SELECT id FROM section_order WHERE section_id = ?').bind(d.id).first();
    if (!existing) {
      await db.prepare('INSERT INTO section_order (section_id, sort_order, is_visible, label_ru, label_am) VALUES (?,?,1,?,?)')
        .bind(d.id, d.order, d.ru, d.am).run();
    }
  }
  return c.json({ success: true });
});

// ===== LEADS CRM =====
api.get('/leads', authMiddleware, async (c) => {
  const db = c.env.DB;
  const status = c.req.query('status');
  const source = c.req.query('source');
  const limit = parseInt(c.req.query('limit') || '200');
  const offset = parseInt(c.req.query('offset') || '0');
  let sql = 'SELECT l.*, u.display_name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id';
  const conditions: string[] = [];
  const params: any[] = [];
  if (status && status !== 'all') { conditions.push('l.status = ?'); params.push(status); }
  if (source && source !== 'all') { conditions.push('l.source = ?'); params.push(source); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const res = await db.prepare(sql).bind(...params).all();
  const total = await db.prepare('SELECT COUNT(*) as count FROM leads').first();
  return c.json({ leads: res.results, total: total?.count || 0 });
});

api.put('/leads/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.status !== undefined) { fields.push('status=?'); vals.push(d.status); }
  if (d.notes !== undefined) { fields.push('notes=?'); vals.push(d.notes); }
  if (d.assigned_to !== undefined) { fields.push('assigned_to=?'); vals.push(d.assigned_to || null); }
  if (d.name !== undefined) { fields.push('name=?'); vals.push(d.name); }
  if (d.contact !== undefined) { fields.push('contact=?'); vals.push(d.contact); }
  if (d.product !== undefined) { fields.push('product=?'); vals.push(d.product); }
  if (d.service !== undefined) { fields.push('service=?'); vals.push(d.service); }
  if (d.message !== undefined) { fields.push('message=?'); vals.push(d.message); }
  if (d.total_amount !== undefined) { fields.push('total_amount=?'); vals.push(d.total_amount); }
  if (d.calc_data !== undefined) { fields.push('calc_data=?'); vals.push(d.calc_data); }
  if (d.referral_code !== undefined) { fields.push('referral_code=?'); vals.push(d.referral_code); }
  if (d.custom_fields !== undefined) { fields.push('custom_fields=?'); vals.push(d.custom_fields); }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  vals.push(id);
  await db.prepare(`UPDATE leads SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.post('/leads', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  // Get next lead number
  const lastLead = await db.prepare('SELECT MAX(lead_number) as max_num FROM leads').first();
  const nextNum = ((lastLead?.max_num as number) || 0) + 1;
  await db.prepare('INSERT INTO leads (lead_number, source, name, contact, product, service, message, lang, total_amount, calc_data, referral_code, custom_fields) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(nextNum, d.source || 'manual', d.name || '', d.contact || '', d.product || '', d.service || '', d.message || '', d.lang || 'ru', d.total_amount || 0, d.calc_data || '', d.referral_code || '', d.custom_fields || '').run();
  return c.json({ success: true });
});

api.get('/leads/analytics', authMiddleware, async (c) => {
  const db = c.env.DB;
  const url = new URL(c.req.url);
  const dateFrom = url.searchParams.get('from') || '';
  const dateTo = url.searchParams.get('to') || '';
  
  let dateFilter = '';
  const dateParams: string[] = [];
  if (dateFrom) { dateFilter += " AND date(created_at) >= ?"; dateParams.push(dateFrom); }
  if (dateTo) { dateFilter += " AND date(created_at) <= ?"; dateParams.push(dateTo); }
  
  // Total stats
  const total = await db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE 1=1' + dateFilter).bind(...dateParams).first();
  const todayCount = await db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) = date('now')").first();
  const weekCount = await db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now','-7 days')").first();
  const monthCount = await db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now','-30 days')").first();
  
  // By status (with date filter)
  const byStatusRes = await db.prepare("SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE 1=1" + dateFilter + " GROUP BY status").bind(...dateParams).all();
  const byStatus: Record<string, any> = {};
  for (const r of byStatusRes.results) { byStatus[r.status as string] = { count: r.count, amount: r.amount }; }
  
  // By source (with date filter)
  const bySourceRes = await db.prepare("SELECT source, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE 1=1" + dateFilter + " GROUP BY source").bind(...dateParams).all();
  const bySource: Record<string, any> = {};
  for (const r of bySourceRes.results) { bySource[r.source as string] = { count: r.count, amount: r.amount }; }
  
  // By assignee (with date filter)
  const byAssigneeRes = await db.prepare("SELECT l.assigned_to, u.display_name, COUNT(*) as count, COALESCE(SUM(l.total_amount),0) as amount FROM leads l LEFT JOIN users u ON l.assigned_to=u.id WHERE 1=1" + dateFilter.replace(/created_at/g, 'l.created_at') + " GROUP BY l.assigned_to").bind(...dateParams).all();
  const byAssignee: any[] = [];
  for (const r of byAssigneeRes.results) { byAssignee.push({ user_id: r.assigned_to, name: r.display_name || 'Не назначен', count: r.count, amount: r.amount }); }
  
  // Daily breakdown (last 30 days)
  const dailyRes = await db.prepare("SELECT date(created_at) as day, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now','-30 days') GROUP BY date(created_at) ORDER BY day").all();
  
  // Service popularity — parse calc_data from all leads
  const allLeadsRes = await db.prepare("SELECT calc_data, total_amount, status FROM leads WHERE calc_data != '' AND calc_data IS NOT NULL" + dateFilter).bind(...dateParams).all();
  const serviceStats: Record<string, { count: number; qty: number; revenue: number }> = {};
  for (const lead of allLeadsRes.results) {
    try {
      const cd = JSON.parse(lead.calc_data as string);
      if (cd.items && Array.isArray(cd.items)) {
        for (const item of cd.items) {
          const name = item.name || 'Неизвестно';
          if (!serviceStats[name]) serviceStats[name] = { count: 0, qty: 0, revenue: 0 };
          serviceStats[name].count++;
          serviceStats[name].qty += Number(item.qty || 1);
          serviceStats[name].revenue += Number(item.subtotal || 0);
        }
      }
    } catch {}
  }
  const serviceList = Object.entries(serviceStats).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.revenue - a.revenue);
  
  // Conversion funnel
  const statusCounts = {
    new: (byStatus.new?.count || 0),
    contacted: (byStatus.contacted?.count || 0),
    in_progress: (byStatus.in_progress?.count || 0),
    done: (byStatus.done?.count || 0),
    rejected: (byStatus.rejected?.count || 0),
  };
  const conversionRate = (total?.count || 0) > 0 ? ((statusCounts.done / (total?.count || 1)) * 100).toFixed(1) : '0';
  const avgCheck = statusCounts.done > 0 ? Math.round((byStatus.done?.amount || 0) / statusCounts.done) : 0;
  
  // Referral stats
  const refRes = await db.prepare("SELECT referral_code, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE referral_code != '' AND referral_code IS NOT NULL" + dateFilter + " GROUP BY referral_code ORDER BY count DESC").bind(...dateParams).all();
  
  return c.json({
    total: { count: total?.count || 0, amount: total?.amount || 0 },
    today: { count: todayCount?.count || 0, amount: todayCount?.amount || 0 },
    week: { count: weekCount?.count || 0, amount: weekCount?.amount || 0 },
    month: { count: monthCount?.count || 0, amount: monthCount?.amount || 0 },
    by_status: byStatus,
    by_source: bySource,
    by_assignee: byAssignee,
    daily: dailyRes.results,
    services: serviceList,
    conversion_rate: conversionRate,
    avg_check: avgCheck,
    referrals: refRes.results,
    date_from: dateFrom,
    date_to: dateTo,
  });
});

// ===== LEAD COMMENTS =====
api.get('/leads/:id/comments', authMiddleware, async (c) => {
  const db = c.env.DB;
  const leadId = c.req.param('id');
  const res = await db.prepare('SELECT * FROM lead_comments WHERE lead_id = ? ORDER BY created_at DESC').bind(leadId).all();
  return c.json(res.results);
});

api.post('/leads/:id/comments', authMiddleware, async (c) => {
  const db = c.env.DB;
  const leadId = c.req.param('id');
  const { comment } = await c.req.json();
  // Get current user from token
  const auth = c.req.header('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  let userName = 'Система';
  let userId = 0;
  try {
    const { verifyToken } = await import('../lib/auth');
    const payload = await verifyToken(token);
    if (payload) {
      userId = Number(payload.sub) || 0;
      const user = await db.prepare('SELECT display_name FROM users WHERE id = ?').bind(userId).first();
      userName = (user?.display_name as string) || 'Пользователь';
    }
  } catch {}
  await db.prepare('INSERT INTO lead_comments (lead_id, user_id, user_name, comment) VALUES (?,?,?,?)').bind(leadId, userId, userName, comment).run();
  return c.json({ success: true });
});

api.delete('/leads/comments/:commentId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const commentId = c.req.param('commentId');
  await db.prepare('DELETE FROM lead_comments WHERE id = ?').bind(commentId).run();
  return c.json({ success: true });
});

api.delete('/leads/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM leads WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

api.get('/leads/export', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  const leads = res.results;
  let csv = 'ID,Source,Name,Contact,Product,Service,Message,Language,Status,Notes,Referral,Created\n';
  for (const l of leads) {
    csv += [l.id, l.source, `"${(l.name as string || '').replace(/"/g, '""')}"`, `"${(l.contact as string || '').replace(/"/g, '""')}"`,
      `"${(l.product as string || '').replace(/"/g, '""')}"`, `"${(l.service as string || '').replace(/"/g, '""')}"`,
      `"${(l.message as string || '').replace(/"/g, '""')}"`, l.lang, l.status,
      `"${(l.notes as string || '').replace(/"/g, '""')}"`, l.referral_code, l.created_at].join(',') + '\n';
  }
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename=leads_export.csv' }
  });
});

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
  await db.prepare(`UPDATE pdf_templates SET header_ru=?, header_am=?, footer_ru=?, footer_am=?, intro_ru=?, intro_am=?, outro_ru=?, outro_am=?, company_name=?, company_phone=?, company_email=?, company_address=?, btn_order_ru=?, btn_order_am=?, btn_download_ru=?, btn_download_am=?, order_telegram_url=?, updated_at=CURRENT_TIMESTAMP WHERE template_key='default'`)
    .bind(d.header_ru||'', d.header_am||'', d.footer_ru||'', d.footer_am||'', d.intro_ru||'', d.intro_am||'', d.outro_ru||'', d.outro_am||'', d.company_name||'', d.company_phone||'', d.company_email||'', d.company_address||'', d.btn_order_ru||'Заказать сейчас', d.btn_order_am||'Պատվիրել հիմա', d.btn_download_ru||'Скачать', d.btn_download_am||'Ներబేறնել', d.order_telegram_url||'https://t.me/goo_to_top').run();
  return c.json({ success: true });
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

// ===== USERS / EMPLOYEES =====
api.get('/users', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT id, username, role, display_name, phone, email, is_active, created_at FROM users ORDER BY id').all();
  return c.json(res.results);
});

api.post('/users', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can create users' }, 403);
  const d = await c.req.json();
  if (!d.username || !d.password || !d.display_name) return c.json({ error: 'username, password, display_name required' }, 400);
  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(d.username).first();
  if (existing) return c.json({ error: 'Username already exists' }, 400);
  const hash = await hashPassword(d.password);
  await db.prepare('INSERT INTO users (username, password_hash, role, display_name, phone, email, is_active) VALUES (?,?,?,?,?,?,1)')
    .bind(d.username, hash, d.role || 'operator', d.display_name, d.phone || '', d.email || '').run();
  // Set default permissions
  const newUser = await db.prepare('SELECT id FROM users WHERE username = ?').bind(d.username).first();
  if (newUser) {
    const defPerms = DEFAULT_PERMISSIONS[d.role || 'operator'] || ['dashboard'];
    await db.prepare('INSERT INTO user_permissions (user_id, sections_json) VALUES (?,?)').bind(newUser.id, JSON.stringify(defPerms)).run();
  }
  return c.json({ success: true });
});

api.put('/users/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can edit users' }, 403);
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.display_name !== undefined) { fields.push('display_name=?'); vals.push(d.display_name); }
  if (d.role !== undefined) { fields.push('role=?'); vals.push(d.role); }
  if (d.phone !== undefined) { fields.push('phone=?'); vals.push(d.phone); }
  if (d.email !== undefined) { fields.push('email=?'); vals.push(d.email); }
  if (d.is_active !== undefined) { fields.push('is_active=?'); vals.push(d.is_active ? 1 : 0); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(id);
  await db.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.delete('/users/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can delete users' }, 403);
  const id = c.req.param('id');
  // Don't allow deleting main_admin
  const target = await db.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
  if (target?.role === 'main_admin') return c.json({ error: 'Cannot delete main admin' }, 400);
  await db.prepare('DELETE FROM user_permissions WHERE user_id = ?').bind(id).run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

api.post('/users/:id/reset-password', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can reset passwords' }, 403);
  const id = c.req.param('id');
  const newPass = generatePassword(10);
  const hash = await hashPassword(newPass);
  await db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(hash, id).run();
  return c.json({ success: true, new_password: newPass });
});

// ===== PERMISSIONS =====
api.get('/permissions/:userId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.req.param('userId');
  const row = await db.prepare('SELECT sections_json FROM user_permissions WHERE user_id = ?').bind(userId).first();
  const user = await db.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();
  if (row) {
    return c.json({ permissions: JSON.parse(row.sections_json as string) });
  }
  // Return defaults based on role
  const role = user?.role as string || 'operator';
  return c.json({ permissions: DEFAULT_PERMISSIONS[role] || ['dashboard'] });
});

api.put('/permissions/:userId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can edit permissions' }, 403);
  const userId = c.req.param('userId');
  const { sections } = await c.req.json();
  const existing = await db.prepare('SELECT id FROM user_permissions WHERE user_id = ?').bind(userId).first();
  if (existing) {
    await db.prepare('UPDATE user_permissions SET sections_json = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
      .bind(JSON.stringify(sections || []), userId).run();
  } else {
    await db.prepare('INSERT INTO user_permissions (user_id, sections_json) VALUES (?,?)')
      .bind(userId, JSON.stringify(sections || [])).run();
  }
  return c.json({ success: true });
});

// ===== SITE BLOCKS (unified block constructor) =====
api.get('/site-blocks', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM site_blocks ORDER BY sort_order').all();
  const blocks = (res.results || []).map((b: any) => ({
    ...b,
    texts_ru: JSON.parse(b.texts_ru || '[]'),
    texts_am: JSON.parse(b.texts_am || '[]'),
    images: JSON.parse(b.images || '[]'),
    buttons: JSON.parse(b.buttons || '[]'),
  }));
  return c.json({ blocks });
});

api.post('/site-blocks', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  const key = d.block_key || `block_${Date.now()}`;
  await db.prepare('INSERT INTO site_blocks (block_key, block_type, title_ru, title_am, texts_ru, texts_am, images, buttons, custom_css, custom_html, is_visible, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(key, d.block_type || 'section', d.title_ru || '', d.title_am || '',
      JSON.stringify(d.texts_ru || []), JSON.stringify(d.texts_am || []),
      JSON.stringify(d.images || []), JSON.stringify(d.buttons || []),
      d.custom_css || '', d.custom_html || '', d.is_visible !== false ? 1 : 0,
      d.sort_order || 999).run();
  return c.json({ success: true });
});

api.put('/site-blocks/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.block_key !== undefined) { fields.push('block_key=?'); vals.push(d.block_key); }
  if (d.block_type !== undefined) { fields.push('block_type=?'); vals.push(d.block_type); }
  if (d.title_ru !== undefined) { fields.push('title_ru=?'); vals.push(d.title_ru); }
  if (d.title_am !== undefined) { fields.push('title_am=?'); vals.push(d.title_am); }
  if (d.texts_ru !== undefined) { fields.push('texts_ru=?'); vals.push(JSON.stringify(d.texts_ru)); }
  if (d.texts_am !== undefined) { fields.push('texts_am=?'); vals.push(JSON.stringify(d.texts_am)); }
  if (d.images !== undefined) { fields.push('images=?'); vals.push(JSON.stringify(d.images)); }
  if (d.buttons !== undefined) { fields.push('buttons=?'); vals.push(JSON.stringify(d.buttons)); }
  if (d.custom_css !== undefined) { fields.push('custom_css=?'); vals.push(d.custom_css); }
  if (d.custom_html !== undefined) { fields.push('custom_html=?'); vals.push(d.custom_html); }
  if (d.is_visible !== undefined) { fields.push('is_visible=?'); vals.push(d.is_visible ? 1 : 0); }
  if (d.sort_order !== undefined) { fields.push('sort_order=?'); vals.push(d.sort_order); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(id);
  await db.prepare(`UPDATE site_blocks SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.delete('/site-blocks/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM site_blocks WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

api.post('/site-blocks/reorder', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { orders } = await c.req.json();
  for (const o of orders) {
    await db.prepare('UPDATE site_blocks SET sort_order = ? WHERE id = ?').bind(o.sort_order, o.id).run();
  }
  return c.json({ success: true });
});

api.post('/site-blocks/duplicate/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const orig = await db.prepare('SELECT * FROM site_blocks WHERE id = ?').bind(id).first();
  if (!orig) return c.json({ error: 'Not found' }, 404);
  const newKey = `${orig.block_key}_copy_${Date.now()}`;
  await db.prepare('INSERT INTO site_blocks (block_key, block_type, title_ru, title_am, texts_ru, texts_am, images, buttons, custom_css, custom_html, is_visible, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(newKey, orig.block_type, orig.title_ru + ' (копия)', orig.title_am, orig.texts_ru, orig.texts_am, orig.images, orig.buttons, orig.custom_css, orig.custom_html, orig.is_visible, (orig.sort_order as number || 0) + 1).run();
  return c.json({ success: true });
});

// ===== ROLES CONFIG (for frontend) =====
api.get('/roles-config', authMiddleware, async (c) => {
  return c.json({ roles: ALL_ROLES, sections: ALL_SECTIONS, role_labels: ROLE_LABELS, section_labels: SECTION_LABELS, default_permissions: DEFAULT_PERMISSIONS });
});

export default api
