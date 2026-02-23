/**
 * Admin API routes — full CRUD for all admin panel sections
 */
import { Hono } from 'hono'
import { verifyToken, hashPassword, verifyPassword, createToken, initDefaultAdmin, generatePassword } from '../lib/auth'
import { initDatabase, ALL_ROLES, ALL_SECTIONS, ROLE_LABELS, SECTION_LABELS, DEFAULT_PERMISSIONS } from '../lib/db'

type Bindings = { DB: D1Database }
const api = new Hono<{ Bindings: Bindings }>()

// Global error handler - return JSON instead of "Internal Server Error"
api.onError((err, c) => {
  console.error('API Error:', err?.message, err?.stack);
  return c.json({ error: 'Server error: ' + (err?.message || 'Unknown') }, 500);
})

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
  try {
    const { username, password } = await c.req.json();
    const db = c.env.DB;
    
    // Init DB and default admin on first request
    try { await initDatabase(db); } catch(dbErr: any) { console.error('initDatabase error:', dbErr?.message || dbErr); }
    try { await initDefaultAdmin(db); } catch(adminErr: any) { console.error('initDefaultAdmin error:', adminErr?.message || adminErr); }
    
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
  } catch(err: any) {
    console.error('Login error:', err?.message || err, err?.stack);
    return c.json({ error: 'Login failed: ' + (err?.message || 'Unknown error') }, 500);
  }
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

// CSV Export — token via query param for universal download support
api.get('/leads/export', async (c) => {
  const db = c.env.DB;
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.query('token') || '';
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const { verifyToken } = await import('../lib/auth');
    const payload = await verifyToken(token);
    if (!payload) return c.json({ error: 'Unauthorized' }, 401);
  } catch { return c.json({ error: 'Unauthorized' }, 401); }
  const res = await db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  const leads = res.results;
  let csv = '\uFEFFID,Source,Name,Contact,Language,Status,Notes,Referral,Total,Refund,Created\n';
  for (const l of leads) {
    csv += [l.id, l.source, `"${(l.name as string || '').replace(/"/g, '""')}"`, `"${(l.contact as string || '').replace(/"/g, '""')}"`,
      l.lang, l.status,
      `"${(l.notes as string || '').replace(/"/g, '""')}"`, l.referral_code, l.total_amount, l.refund_amount || 0, l.created_at].join(',') + '\n';
  }
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads_export.csv"'
    }
  });
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
  if (d.telegram_group !== undefined) { fields.push('telegram_group=?'); vals.push(d.telegram_group); }
  if (d.tz_link !== undefined) { fields.push('tz_link=?'); vals.push(d.tz_link); }
  if (d.refund_amount !== undefined) { fields.push('refund_amount=?'); vals.push(d.refund_amount); }
  if (d.lang !== undefined) { fields.push('lang=?'); vals.push(d.lang); }
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
  await db.prepare('INSERT INTO leads (lead_number, source, name, contact, product, service, message, lang, total_amount, calc_data, referral_code, custom_fields, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(nextNum, d.source || 'manual', d.name || '', d.contact || '', d.product || '', d.service || '', '', d.lang || 'ru', d.total_amount || 0, d.calc_data || '', d.referral_code || '', d.custom_fields || '', d.message || '').run();
  return c.json({ success: true });
});

api.get('/leads/analytics', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
  const url = new URL(c.req.url);
  const dateFrom = url.searchParams.get('from') || '';
  const dateTo = url.searchParams.get('to') || '';
  
  let dateFilter = '';
  const dateParams: string[] = [];
  if (dateFrom) { dateFilter += " AND date(created_at) >= ?"; dateParams.push(dateFrom); }
  if (dateTo) { dateFilter += " AND date(created_at) <= ?"; dateParams.push(dateTo); }
  
  // Total stats — use simple queries with fallbacks for missing columns
  const total = await db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE 1=1' + dateFilter).bind(...dateParams).first().catch(() => ({ count: 0, amount: 0 }));
  const todayCount = await db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) = date('now')").first().catch(() => ({ count: 0, amount: 0 }));
  const weekCount = await db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now','-7 days')").first().catch(() => ({ count: 0, amount: 0 }));
  const monthCount = await db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now','-30 days')").first().catch(() => ({ count: 0, amount: 0 }));
  
  // By status (with date filter)
  let byStatus: Record<string, any> = {};
  try {
    const byStatusRes = await db.prepare("SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE 1=1" + dateFilter + " GROUP BY status").bind(...dateParams).all();
    for (const r of byStatusRes.results) { byStatus[r.status as string] = { count: r.count, amount: r.amount }; }
  } catch {}
  
  // By source (with date filter)
  let bySource: Record<string, any> = {};
  try {
    const bySourceRes = await db.prepare("SELECT source, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE 1=1" + dateFilter + " GROUP BY source").bind(...dateParams).all();
    for (const r of bySourceRes.results) { bySource[r.source as string] = { count: r.count, amount: r.amount }; }
  } catch {}
  
  // By assignee (with date filter)
  const byAssignee: any[] = [];
  try {
    const byAssigneeRes = await db.prepare("SELECT l.assigned_to, u.display_name, COUNT(*) as count, COALESCE(SUM(l.total_amount),0) as amount FROM leads l LEFT JOIN users u ON l.assigned_to=u.id WHERE 1=1" + dateFilter.replace(/created_at/g, 'l.created_at') + " GROUP BY l.assigned_to").bind(...dateParams).all();
    for (const r of byAssigneeRes.results) { byAssignee.push({ user_id: r.assigned_to, name: r.display_name || 'Не назначен', count: r.count, amount: r.amount }); }
  } catch {}
  
  // Daily breakdown (last 30 days)
  let dailyResults: any[] = [];
  try {
    const dailyRes = await db.prepare("SELECT date(created_at) as day, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now','-30 days') GROUP BY date(created_at) ORDER BY day").all();
    dailyResults = dailyRes.results || [];
  } catch {}
  
  // Service popularity — parse calc_data from all leads + split services vs articles per status
  let allLeadsResults: any[] = [];
  try {
    const allLeadsRes = await db.prepare("SELECT id, calc_data, total_amount, status FROM leads WHERE 1=1" + dateFilter).bind(...dateParams).all();
    allLeadsResults = allLeadsRes.results || [];
  } catch {}
  const serviceStats: Record<string, { count: number; qty: number; revenue: number }> = {};
  const statusAmounts: Record<string, { services: number; articles: number }> = {};
  for (const lead of allLeadsResults) {
    const st = lead.status as string || 'new';
    if (!statusAmounts[st]) statusAmounts[st] = { services: 0, articles: 0 };
    try {
      const cd = JSON.parse((lead.calc_data as string) || '{}');
      if (cd.items && Array.isArray(cd.items)) {
        for (const item of cd.items) {
          if (item.wb_article) {
            statusAmounts[st].articles += Number(item.subtotal || 0);
          } else {
            const name = item.name || 'Неизвестно';
            if (!serviceStats[name]) serviceStats[name] = { count: 0, qty: 0, revenue: 0 };
            serviceStats[name].count++;
            serviceStats[name].qty += Number(item.qty || 1);
            serviceStats[name].revenue += Number(item.subtotal || 0);
            statusAmounts[st].services += Number(item.subtotal || 0);
          }
        }
      }
    } catch {}
  }
  // Get articles totals per lead from lead_articles table
  try {
    const articlesPerLead = await db.prepare("SELECT la.lead_id, SUM(la.total_price) as art_total FROM lead_articles la JOIN leads l ON la.lead_id = l.id WHERE 1=1" + dateFilter.replace(/created_at/g, 'l.created_at') + " GROUP BY la.lead_id").bind(...dateParams).all();
    for (const ar of articlesPerLead.results) {
      const lead = allLeadsResults.find((l: any) => l.id === ar.lead_id);
      const st = (lead?.status as string) || 'new';
      if (!statusAmounts[st]) statusAmounts[st] = { services: 0, articles: 0 };
      statusAmounts[st].articles += Number(ar.art_total || 0);
    }
  } catch {}
  const serviceList = Object.entries(serviceStats).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.revenue - a.revenue);
  
  // Conversion funnel
  const statusCounts = {
    new: (byStatus.new?.count || 0),
    contacted: (byStatus.contacted?.count || 0),
    in_progress: (byStatus.in_progress?.count || 0),
    checking: (byStatus.checking?.count || 0),
    done: (byStatus.done?.count || 0),
    rejected: (byStatus.rejected?.count || 0),
  };
  const conversionRate = (total?.count || 0) > 0 ? ((statusCounts.done / (total?.count || 1)) * 100).toFixed(1) : '0';
  const avgCheck = statusCounts.done > 0 ? Math.round((byStatus.done?.amount || 0) / statusCounts.done) : 0;
  
  // Referral stats
  let refResults: any[] = [];
  try {
    const refRes = await db.prepare("SELECT referral_code, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE referral_code != '' AND referral_code IS NOT NULL" + dateFilter + " GROUP BY referral_code ORDER BY count DESC").bind(...dateParams).all();
    refResults = refRes.results || [];
  } catch {}
  
  return c.json({
    total: { count: total?.count || 0, amount: total?.amount || 0 },
    today: { count: todayCount?.count || 0, amount: todayCount?.amount || 0 },
    week: { count: weekCount?.count || 0, amount: weekCount?.amount || 0 },
    month: { count: monthCount?.count || 0, amount: monthCount?.amount || 0 },
    by_status: byStatus,
    by_source: bySource,
    by_assignee: byAssignee,
    daily: dailyResults,
    services: serviceList,
    status_amounts: statusAmounts,
    conversion_rate: conversionRate,
    avg_check: avgCheck,
    referrals: refResults,
    date_from: dateFrom,
    date_to: dateTo,
  });
  } catch (err: any) {
    // Top-level catch: if the whole analytics crashes, return empty data instead of 500
    console.error('Analytics error:', err?.message || err);
    return c.json({
      total: { count: 0, amount: 0 }, today: { count: 0, amount: 0 },
      week: { count: 0, amount: 0 }, month: { count: 0, amount: 0 },
      by_status: {}, by_source: {}, by_assignee: [], daily: [],
      services: [], status_amounts: {}, conversion_rate: '0', avg_check: 0,
      referrals: [], date_from: '', date_to: '', error: 'Analytics temporarily unavailable: ' + (err?.message || 'unknown error')
    });
  }
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
  const caller = c.get('user');
  const isMainAdmin = caller.role === 'main_admin';
  // main_admin sees password_plain for credential management; others don't
  const cols = isMainAdmin
    ? 'id, username, password_plain, role, display_name, phone, email, is_active, salary, salary_type, position_title, hire_date, end_date, created_at'
    : 'id, username, role, display_name, phone, email, is_active, salary, salary_type, position_title, hire_date, end_date, created_at';
  const res = await db.prepare('SELECT ' + cols + ' FROM users ORDER BY id').all();
  return c.json(res.results);
});

api.post('/users', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can create users' }, 403);
  const d = await c.req.json();
  if (!d.username || !d.password || !d.display_name) return c.json({ error: 'username, password, display_name required' }, 400);
  // main_admin can only be one
  if (d.role === 'main_admin') {
    const existingAdmin = await db.prepare("SELECT id FROM users WHERE role = 'main_admin'").first();
    if (existingAdmin) return c.json({ error: 'Главный Админ может быть только один' }, 400);
  }
  const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(d.username).first();
  if (existing) return c.json({ error: 'Username already exists' }, 400);
  const hash = await hashPassword(d.password);
  await db.prepare('INSERT INTO users (username, password_hash, password_plain, role, display_name, phone, email, is_active, salary, salary_type, position_title, hire_date, end_date) VALUES (?,?,?,?,?,?,?,1,?,?,?,?,?)')
    .bind(d.username, hash, d.password, d.role || 'operator', d.display_name, d.phone || '', d.email || '', d.salary || 0, d.salary_type || 'monthly', d.position_title || '', d.hire_date || '', d.end_date || '').run();
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
  // Protect: can't change role to main_admin if one already exists (and it's not this user)
  if (d.role === 'main_admin') {
    const existingAdmin = await db.prepare("SELECT id FROM users WHERE role = 'main_admin' AND id != ?").bind(id).first();
    if (existingAdmin) return c.json({ error: 'Главный Админ может быть только один' }, 400);
  }
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.display_name !== undefined) { fields.push('display_name=?'); vals.push(d.display_name); }
  if (d.role !== undefined) { fields.push('role=?'); vals.push(d.role); }
  if (d.phone !== undefined) { fields.push('phone=?'); vals.push(d.phone); }
  if (d.email !== undefined) { fields.push('email=?'); vals.push(d.email); }
  if (d.is_active !== undefined) { fields.push('is_active=?'); vals.push(d.is_active ? 1 : 0); }
  if (d.username !== undefined) { fields.push('username=?'); vals.push(d.username); }
  if (d.salary !== undefined) { fields.push('salary=?'); vals.push(d.salary); }
  if (d.salary_type !== undefined) { fields.push('salary_type=?'); vals.push(d.salary_type); }
  if (d.position_title !== undefined) { fields.push('position_title=?'); vals.push(d.position_title); }
  if (d.hire_date !== undefined) { fields.push('hire_date=?'); vals.push(d.hire_date); }
  if (d.end_date !== undefined) { fields.push('end_date=?'); vals.push(d.end_date); }
  // Update password if provided in user edit
  if (d.new_password) {
    const newHash = await hashPassword(d.new_password);
    fields.push('password_hash=?'); vals.push(newHash);
    fields.push('password_plain=?'); vals.push(d.new_password);
  }
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
  // Protect only the very first admin (id=1) from deletion; other main_admins can be removed
  if (Number(id) === 1) return c.json({ error: 'Cannot delete the primary admin account' }, 400);
  await db.prepare('DELETE FROM user_permissions WHERE user_id = ?').bind(id).run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

api.post('/users/:id/reset-password', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can reset passwords' }, 403);
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const wantNewPass = !!body.new_password;
  const wantNewUser = !!body.new_username;
  if (!wantNewPass && !wantNewUser) {
    // Generate random password if nothing specified
    const newPass = generatePassword(10);
    const hash = await hashPassword(newPass);
    await db.prepare('UPDATE users SET password_hash = ?, password_plain = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(hash, newPass, id).run();
    return c.json({ success: true, new_password: newPass });
  }
  // Update username if provided
  if (wantNewUser) {
    const existing = await db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').bind(body.new_username, id).first();
    if (existing) return c.json({ error: 'Username already taken' }, 400);
  }
  // Build update query
  const fields: string[] = [];
  const vals: any[] = [];
  if (wantNewUser) { fields.push('username = ?'); vals.push(body.new_username); }
  if (wantNewPass) {
    const hash = await hashPassword(body.new_password);
    fields.push('password_hash = ?'); vals.push(hash);
    fields.push('password_plain = ?'); vals.push(body.new_password);
  }
  fields.push('updated_at = CURRENT_TIMESTAMP');
  vals.push(id);
  await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  return c.json({ success: true, new_password: wantNewPass ? body.new_password : undefined });
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

// Recalculate lead total_amount from articles + services and update calc_data for PDF
api.post('/leads/:id/recalc', authMiddleware, async (c) => {
  const db = c.env.DB;
  const leadId = c.req.param('id');
  
  // Get existing lead data (services from calculator)
  const leadRow = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first();
  if (!leadRow) return c.json({ error: 'Lead not found' }, 404);
  
  // Parse existing calc_data to get service items
  let existingCalcData: any = null;
  let serviceItems: any[] = [];
  let servicesTotalAmount = 0;
  try {
    existingCalcData = JSON.parse(leadRow.calc_data as string || '{}');
    // Keep service items (those without wb_article field)
    if (existingCalcData.items) {
      serviceItems = existingCalcData.items.filter((item: any) => !item.wb_article);
      for (const si of serviceItems) {
        servicesTotalAmount += Number(si.subtotal) || 0;
      }
    }
  } catch {}
  
  // Sum all articles total_price
  const articlesRes = await db.prepare('SELECT * FROM lead_articles WHERE lead_id = ? ORDER BY sort_order, id').bind(leadId).all();
  const articles = articlesRes.results || [];
  let articlesTotalAmount = 0;
  const articleItems: any[] = [];
  for (const art of articles) {
    const tp = Number(art.total_price) || 0;
    articlesTotalAmount += tp;
    articleItems.push({
      name: (art.product_name || art.wb_article || 'Артикул') + (art.size ? ' (р.' + art.size + ')' : '') + (art.color ? ' ' + art.color : ''),
      qty: Number(art.quantity) || 1,
      price: Number(art.price_per_unit) || 0,
      subtotal: tp,
      wb_article: art.wb_article
    });
  }
  
  // Total = services + articles; refund stored separately, does NOT reduce total_amount
  const refundAmount = Number(leadRow.refund_amount) || 0;
  const subtotalAmount = servicesTotalAmount + articlesTotalAmount;
  const totalAmount = subtotalAmount; // total_amount stays unchanged by refunds
  const allItems = [...serviceItems, ...articleItems];
  
  // Update lead total_amount and calc_data (for PDF)
  // subtotal = raw sum of all items, total = same (refund tracked separately in refund_amount field)
  const calcData = JSON.stringify({ items: allItems, subtotal: subtotalAmount, total: totalAmount, refund: refundAmount, referralCode: existingCalcData?.referralCode || '' });
  await db.prepare('UPDATE leads SET total_amount = ?, calc_data = ? WHERE id = ?')
    .bind(totalAmount, calcData, leadId).run();
  // Set source to calculator_pdf so PDF route works
  await db.prepare("UPDATE leads SET source = 'calculator_pdf' WHERE id = ? AND (source = 'form' OR source = 'manual' OR source = 'popup')").bind(leadId).run();
  await updateLeadArticlesCount(db, Number(leadId));
  return c.json({ success: true, total_amount: totalAmount, articles_count: articles.length });
});

// ===== LEAD ARTICLES (WB артикулы привязанные к лидам) =====
api.get('/leads/:id/articles', authMiddleware, async (c) => {
  const db = c.env.DB;
  const leadId = c.req.param('id');
  const res = await db.prepare(`
    SELECT la.*, u.display_name as buyer_name 
    FROM lead_articles la 
    LEFT JOIN users u ON la.buyer_id = u.id 
    WHERE la.lead_id = ? 
    ORDER BY la.sort_order, la.id
  `).bind(leadId).all();
  return c.json({ articles: res.results || [] });
});

api.post('/leads/:id/articles', authMiddleware, async (c) => {
  const db = c.env.DB;
  const leadId = c.req.param('id');
  const d = await c.req.json();
  const totalPrice = (Number(d.price_per_unit) || 0) * (Number(d.quantity) || 1);
  await db.prepare(`INSERT INTO lead_articles (lead_id, wb_article, wb_link, product_name, size, color, quantity, price_per_unit, total_price, status, buyer_id, notes, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(leadId, d.wb_article || '', d.wb_link || '', d.product_name || '', d.size || '', d.color || '', d.quantity || 1, d.price_per_unit || 0, totalPrice, d.status || 'pending', d.buyer_id || null, d.notes || '', d.sort_order || 0).run();
  // Update articles count on lead
  await updateLeadArticlesCount(db, Number(leadId));
  return c.json({ success: true });
});

api.put('/leads/articles/:articleId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const articleId = c.req.param('articleId');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.wb_article !== undefined) { fields.push('wb_article=?'); vals.push(d.wb_article); }
  if (d.wb_link !== undefined) { fields.push('wb_link=?'); vals.push(d.wb_link); }
  if (d.product_name !== undefined) { fields.push('product_name=?'); vals.push(d.product_name); }
  if (d.size !== undefined) { fields.push('size=?'); vals.push(d.size); }
  if (d.color !== undefined) { fields.push('color=?'); vals.push(d.color); }
  if (d.quantity !== undefined) { fields.push('quantity=?'); vals.push(d.quantity); }
  if (d.price_per_unit !== undefined) { fields.push('price_per_unit=?'); vals.push(d.price_per_unit); }
  if (d.quantity !== undefined || d.price_per_unit !== undefined) {
    // Recalculate total_price
    const existing = await db.prepare('SELECT quantity, price_per_unit FROM lead_articles WHERE id = ?').bind(articleId).first();
    const qty = d.quantity !== undefined ? Number(d.quantity) : Number(existing?.quantity || 1);
    const ppu = d.price_per_unit !== undefined ? Number(d.price_per_unit) : Number(existing?.price_per_unit || 0);
    fields.push('total_price=?'); vals.push(qty * ppu);
  }
  if (d.status !== undefined) { fields.push('status=?'); vals.push(d.status); }
  if (d.buyer_id !== undefined) { fields.push('buyer_id=?'); vals.push(d.buyer_id || null); }
  if (d.notes !== undefined) { fields.push('notes=?'); vals.push(d.notes); }
  if (d.sort_order !== undefined) { fields.push('sort_order=?'); vals.push(d.sort_order); }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(articleId);
  await db.prepare(`UPDATE lead_articles SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  // Update articles count on parent lead
  const art = await db.prepare('SELECT lead_id FROM lead_articles WHERE id = ?').bind(articleId).first();
  if (art) await updateLeadArticlesCount(db, art.lead_id as number);
  return c.json({ success: true });
});

api.delete('/leads/articles/:articleId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const articleId = c.req.param('articleId');
  const art = await db.prepare('SELECT lead_id FROM lead_articles WHERE id = ?').bind(articleId).first();
  await db.prepare('DELETE FROM lead_articles WHERE id = ?').bind(articleId).run();
  if (art) await updateLeadArticlesCount(db, art.lead_id as number);
  return c.json({ success: true });
});

// Bulk update articles statuses
api.post('/leads/:id/articles/bulk-status', authMiddleware, async (c) => {
  const db = c.env.DB;
  const leadId = c.req.param('id');
  const { article_ids, status, buyer_id } = await c.req.json();
  if (!article_ids || !Array.isArray(article_ids) || !status) return c.json({ error: 'article_ids and status required' }, 400);
  for (const aid of article_ids) {
    const updates = ['status=?', 'updated_at=CURRENT_TIMESTAMP'];
    const params: any[] = [status];
    if (buyer_id !== undefined) { updates.push('buyer_id=?'); params.push(buyer_id || null); }
    params.push(aid);
    await db.prepare(`UPDATE lead_articles SET ${updates.join(',')} WHERE id=? AND lead_id=${leadId}`).bind(...params).run();
  }
  await updateLeadArticlesCount(db, Number(leadId));
  return c.json({ success: true });
});

// Helper: update articles count cache on leads table
async function updateLeadArticlesCount(db: D1Database, leadId: number) {
  const total = await db.prepare('SELECT COUNT(*) as cnt FROM lead_articles WHERE lead_id = ?').bind(leadId).first();
  const done = await db.prepare("SELECT COUNT(*) as cnt FROM lead_articles WHERE lead_id = ? AND status IN ('delivered','completed')").bind(leadId).first();
  await db.prepare('UPDATE leads SET articles_count = ?, articles_done = ? WHERE id = ?')
    .bind(total?.cnt || 0, done?.cnt || 0, leadId).run();
}

// ===== ROLES CONFIG (for frontend) =====
api.get('/roles-config', authMiddleware, async (c) => {
  return c.json({ roles: ALL_ROLES, sections: ALL_SECTIONS, role_labels: ROLE_LABELS, section_labels: SECTION_LABELS, default_permissions: DEFAULT_PERMISSIONS });
});

// ===== COMPANY ROLES MANAGEMENT =====
api.get('/company-roles', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare('SELECT * FROM company_roles ORDER BY sort_order, id').all();
    // Ensure role_name is populated (fallback to role_label for legacy data)
    const roles = (res.results || []).map((r: any) => ({
      ...r,
      role_name: r.role_name || r.role_label || r.role_key || ''
    }));
    return c.json({ roles });
  } catch {
    return c.json({ roles: [] });
  }
});

api.post('/company-roles', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can manage roles' }, 403);
  const d = await c.req.json();
  if (!d.role_key || !d.role_name) return c.json({ error: 'role_key and role_name required' }, 400);
  const existing = await db.prepare('SELECT id FROM company_roles WHERE role_key = ?').bind(d.role_key).first();
  if (existing) return c.json({ error: 'Role key already exists' }, 400);
  await db.prepare('INSERT INTO company_roles (role_key, role_name, role_label, description, default_sections, color, is_system, sort_order) VALUES (?,?,?,?,?,?,0,?)')
    .bind(d.role_key, d.role_name, d.role_name, d.description || '', JSON.stringify(d.default_sections || ['dashboard']), d.color || '#8B5CF6', d.sort_order || 99).run();
  return c.json({ success: true });
});

api.put('/company-roles/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can manage roles' }, 403);
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.role_name !== undefined) { fields.push('role_name=?'); vals.push(d.role_name); fields.push('role_label=?'); vals.push(d.role_name); }
  if (d.description !== undefined) { fields.push('description=?'); vals.push(d.description); }
  if (d.default_sections !== undefined) { fields.push('default_sections=?'); vals.push(JSON.stringify(d.default_sections)); }
  if (d.color !== undefined) { fields.push('color=?'); vals.push(d.color); }
  if (d.is_active !== undefined) { fields.push('is_active=?'); vals.push(d.is_active ? 1 : 0); }
  if (d.sort_order !== undefined) { fields.push('sort_order=?'); vals.push(d.sort_order); }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  vals.push(id);
  await db.prepare(`UPDATE company_roles SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.delete('/company-roles/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can manage roles' }, 403);
  const id = c.req.param('id');
  // Don't allow deleting system roles
  const role = await db.prepare('SELECT is_system FROM company_roles WHERE id = ?').bind(id).first();
  if (role?.is_system) return c.json({ error: 'Cannot delete system roles' }, 400);
  await db.prepare('DELETE FROM company_roles WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== EXPENSE CATEGORIES =====
api.get('/expense-categories', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare('SELECT * FROM expense_categories ORDER BY sort_order, id').all();
    return c.json({ categories: res.results || [] });
  } catch { return c.json({ categories: [] }); }
});

api.post('/expense-categories', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  if (!d.name) return c.json({ error: 'name required' }, 400);
  await db.prepare('INSERT INTO expense_categories (name, color, is_marketing, sort_order) VALUES (?,?,?,?)')
    .bind(d.name, d.color || '#8B5CF6', d.is_marketing ? 1 : 0, d.sort_order || 99).run();
  return c.json({ success: true });
});

api.put('/expense-categories/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = []; const vals: any[] = [];
  if (d.name !== undefined) { fields.push('name=?'); vals.push(d.name); }
  if (d.color !== undefined) { fields.push('color=?'); vals.push(d.color); }
  if (d.is_marketing !== undefined) { fields.push('is_marketing=?'); vals.push(d.is_marketing ? 1 : 0); }
  if (d.sort_order !== undefined) { fields.push('sort_order=?'); vals.push(d.sort_order); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  vals.push(id);
  await db.prepare(`UPDATE expense_categories SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.delete('/expense-categories/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('UPDATE expenses SET category_id = NULL WHERE category_id = ?').bind(id).run();
  await db.prepare('DELETE FROM expense_categories WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== EXPENSE FREQUENCY TYPES =====
api.get('/expense-frequency-types', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare('SELECT * FROM expense_frequency_types ORDER BY sort_order, id').all();
    return c.json({ types: res.results || [] });
  } catch { return c.json({ types: [] }); }
});

api.post('/expense-frequency-types', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  if (!d.name) return c.json({ error: 'name required' }, 400);
  await db.prepare('INSERT INTO expense_frequency_types (name, multiplier_monthly, sort_order) VALUES (?,?,?)')
    .bind(d.name, d.multiplier_monthly || 1, d.sort_order || 99).run();
  return c.json({ success: true });
});

api.put('/expense-frequency-types/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = []; const vals: any[] = [];
  if (d.name !== undefined) { fields.push('name=?'); vals.push(d.name); }
  if (d.multiplier_monthly !== undefined) { fields.push('multiplier_monthly=?'); vals.push(d.multiplier_monthly); }
  if (d.sort_order !== undefined) { fields.push('sort_order=?'); vals.push(d.sort_order); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  vals.push(id);
  await db.prepare(`UPDATE expense_frequency_types SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.delete('/expense-frequency-types/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('UPDATE expenses SET frequency_type_id = NULL WHERE frequency_type_id = ?').bind(id).run();
  await db.prepare('DELETE FROM expense_frequency_types WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== EXPENSES (Commercial Costs) =====
api.get('/expenses', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare(`SELECT e.*, ec.name as category_name, ec.color as category_color, ec.is_marketing,
      eft.name as frequency_name, eft.multiplier_monthly
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN expense_frequency_types eft ON e.frequency_type_id = eft.id
      ORDER BY e.created_at DESC`).all();
    return c.json({ expenses: res.results || [] });
  } catch { return c.json({ expenses: [] }); }
});

api.post('/expenses', authMiddleware, async (c) => {
  const db = c.env.DB;
  const d = await c.req.json();
  if (!d.name) return c.json({ error: 'name required' }, 400);
  await db.prepare('INSERT INTO expenses (name, amount, category_id, frequency_type_id, is_active, notes, start_date, end_date) VALUES (?,?,?,?,?,?,?,?)')
    .bind(d.name, d.amount || 0, d.category_id || null, d.frequency_type_id || null, d.is_active !== false ? 1 : 0, d.notes || '', d.start_date || '', d.end_date || '').run();
  return c.json({ success: true });
});

api.put('/expenses/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = []; const vals: any[] = [];
  if (d.name !== undefined) { fields.push('name=?'); vals.push(d.name); }
  if (d.amount !== undefined) { fields.push('amount=?'); vals.push(d.amount); }
  if (d.category_id !== undefined) { fields.push('category_id=?'); vals.push(d.category_id || null); }
  if (d.frequency_type_id !== undefined) { fields.push('frequency_type_id=?'); vals.push(d.frequency_type_id || null); }
  if (d.is_active !== undefined) { fields.push('is_active=?'); vals.push(d.is_active ? 1 : 0); }
  if (d.notes !== undefined) { fields.push('notes=?'); vals.push(d.notes); }
  if (d.start_date !== undefined) { fields.push('start_date=?'); vals.push(d.start_date); }
  if (d.end_date !== undefined) { fields.push('end_date=?'); vals.push(d.end_date); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(id);
  await db.prepare(`UPDATE expenses SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.delete('/expenses/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM expenses WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== EMPLOYEE BONUSES =====
api.get('/users/:id/bonuses', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.req.param('id');
  try {
    const res = await db.prepare('SELECT * FROM employee_bonuses WHERE user_id = ? ORDER BY bonus_date DESC, id DESC').bind(userId).all();
    return c.json({ bonuses: res.results || [] });
  } catch { return c.json({ bonuses: [] }); }
});

api.post('/users/:id/bonuses', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.req.param('id');
  const d = await c.req.json();
  // Ensure bonus_type column exists (migration may not have run on production)
  try { await db.prepare("ALTER TABLE employee_bonuses ADD COLUMN bonus_type TEXT DEFAULT 'bonus'").run(); } catch {}
  await db.prepare('INSERT INTO employee_bonuses (user_id, amount, bonus_type, description, bonus_date) VALUES (?,?,?,?,?)')
    .bind(userId, d.amount || 0, d.bonus_type || 'bonus', d.description || '', d.bonus_date || new Date().toISOString().slice(0, 10)).run();
  return c.json({ success: true });
});

api.delete('/bonuses/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM employee_bonuses WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

api.put('/bonuses/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.amount !== undefined) { fields.push('amount=?'); vals.push(d.amount); }
  if (d.description !== undefined) { fields.push('description=?'); vals.push(d.description); }
  if (d.bonus_date !== undefined) { fields.push('bonus_date=?'); vals.push(d.bonus_date); }
  if (d.bonus_type !== undefined) { fields.push('bonus_type=?'); vals.push(d.bonus_type); }
  if (fields.length === 0) return c.json({ error: 'Nothing to update' }, 400);
  vals.push(id);
  await db.prepare('UPDATE employee_bonuses SET ' + fields.join(', ') + ' WHERE id = ?').bind(...vals).run();
  return c.json({ success: true });
});

// ===== SALARY UPDATE (extends users PUT) =====
api.put('/users/:id/salary', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can edit salaries' }, 403);
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = []; const vals: any[] = [];
  if (d.salary !== undefined) { fields.push('salary=?'); vals.push(d.salary); }
  if (d.salary_type !== undefined) { fields.push('salary_type=?'); vals.push(d.salary_type); }
  if (d.position_title !== undefined) { fields.push('position_title=?'); vals.push(d.position_title); }
  if (d.hire_date !== undefined) { fields.push('hire_date=?'); vals.push(d.hire_date); }
  if (d.end_date !== undefined) { fields.push('end_date=?'); vals.push(d.end_date); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(id);
  await db.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

// ===== SALARY SUMMARY FOR A MONTH (auto-calculates salary + bonuses + fines) =====
api.get('/salary-summary/:month', authMiddleware, async (c) => {
  const db = c.env.DB;
  const month = c.req.param('month'); // Format: YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return c.json({ error: 'Invalid month format (YYYY-MM)' }, 400);
  try {
    // Total active salaries (all active employees with salary > 0)
    const salaryRes = await db.prepare("SELECT COALESCE(SUM(salary), 0) as total_salary FROM users WHERE is_active = 1 AND salary > 0").first();
    const totalSalaries = Math.round((Number(salaryRes?.total_salary || 0)) * 100) / 100;

    // Bonuses and fines for the specific month
    const bonusRes = await db.prepare("SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) as total_bonuses, COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END),0) as total_fines, COALESCE(SUM(amount),0) as net_total FROM employee_bonuses WHERE strftime('%Y-%m', bonus_date) = ?").bind(month).first();
    const totalBonuses = Math.round((Number(bonusRes?.total_bonuses || 0)) * 100) / 100;
    const totalFines = Math.round((Number(bonusRes?.total_fines || 0)) * 100) / 100;
    const bonusesNet = Math.round((Number(bonusRes?.net_total || 0)) * 100) / 100;

    // Expenses breakdown (marketing vs commercial)
    const expRes = await db.prepare(`SELECT e.amount, ec.is_marketing FROM expenses e 
      LEFT JOIN expense_categories ec ON e.category_id = ec.id WHERE e.is_active = 1`).all();
    let marketingExpenses = 0, commercialExpenses = 0;
    for (const exp of (expRes.results || [])) {
      const amt = Math.round((Number(exp.amount) || 0) * 100) / 100;
      if (exp.is_marketing) marketingExpenses += amt;
      else commercialExpenses += amt;
    }

    // Combined expense_salaries = salaries + bonuses + fines
    const expenseSalaries = Math.round((totalSalaries + totalBonuses + totalFines) * 100) / 100;

    return c.json({
      month,
      salaries: totalSalaries,
      bonuses: totalBonuses,
      fines: totalFines,
      bonuses_net: bonusesNet,
      expense_salaries: expenseSalaries,
      commercial_expenses: commercialExpenses,
      marketing_expenses: marketingExpenses,
      total_expenses: expenseSalaries + commercialExpenses + marketingExpenses
    });
  } catch (err: any) {
    return c.json({ error: 'Salary summary error: ' + (err?.message || 'unknown') }, 500);
  }
});

// ===== PERIOD SNAPSHOTS (Close month/quarter/year) =====
api.get('/period-snapshots', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare('SELECT * FROM period_snapshots ORDER BY period_key DESC').all();
    return c.json({ snapshots: res.results || [] });
  } catch { return c.json({ snapshots: [] }); }
});

api.post('/period-snapshots', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can close periods' }, 403);
  const d = await c.req.json();
  if (!d.period_type || !d.period_key) return c.json({ error: 'period_type and period_key required' }, 400);
  // Check if already exists
  const existing = await db.prepare('SELECT id, is_locked FROM period_snapshots WHERE period_type = ? AND period_key = ?').bind(d.period_type, d.period_key).first();
  if (existing && existing.is_locked) return c.json({ error: 'Period already locked' }, 400);
  if (existing) {
    // Update
    await db.prepare(`UPDATE period_snapshots SET revenue_services=?, revenue_articles=?, total_turnover=?, refunds=?,
      expense_salaries=?, expense_commercial=?, expense_marketing=?, net_profit=?,
      leads_count=?, leads_done=?, avg_check=?, custom_data=?, is_locked=?, closed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
      WHERE id=?`).bind(
      d.revenue_services || 0, d.revenue_articles || 0, d.total_turnover || 0, d.refunds || 0,
      d.expense_salaries || 0, d.expense_commercial || 0, d.expense_marketing || 0, d.net_profit || 0,
      d.leads_count || 0, d.leads_done || 0, d.avg_check || 0, JSON.stringify(d.custom_data || {}),
      d.is_locked ? 1 : 0, existing.id
    ).run();
  } else {
    await db.prepare(`INSERT INTO period_snapshots (period_type, period_key, revenue_services, revenue_articles, total_turnover, refunds,
      expense_salaries, expense_commercial, expense_marketing, net_profit, leads_count, leads_done, avg_check, custom_data, is_locked, closed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(
      d.period_type, d.period_key,
      d.revenue_services || 0, d.revenue_articles || 0, d.total_turnover || 0, d.refunds || 0,
      d.expense_salaries || 0, d.expense_commercial || 0, d.expense_marketing || 0, d.net_profit || 0,
      d.leads_count || 0, d.leads_done || 0, d.avg_check || 0, JSON.stringify(d.custom_data || {}),
      d.is_locked ? 1 : 0
    ).run();
  }
  return c.json({ success: true });
});

api.put('/period-snapshots/:id/unlock', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can unlock periods' }, 403);
  const id = c.req.param('id');
  await db.prepare('UPDATE period_snapshots SET is_locked = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// Update period snapshot data (edit locked period values)
api.put('/period-snapshots/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.revenue_services !== undefined) { fields.push('revenue_services=?'); vals.push(d.revenue_services); }
  if (d.revenue_articles !== undefined) { fields.push('revenue_articles=?'); vals.push(d.revenue_articles); }
  if (d.refunds !== undefined) { fields.push('refunds=?'); vals.push(d.refunds); }
  if (d.expense_salaries !== undefined) { fields.push('expense_salaries=?'); vals.push(d.expense_salaries); }
  if (d.expense_commercial !== undefined) { fields.push('expense_commercial=?'); vals.push(d.expense_commercial); }
  if (d.expense_marketing !== undefined) { fields.push('expense_marketing=?'); vals.push(d.expense_marketing); }
  if (d.net_profit !== undefined) { fields.push('net_profit=?'); vals.push(d.net_profit); }
  if (d.total_turnover !== undefined) { fields.push('total_turnover=?'); vals.push(d.total_turnover); }
  if (d.leads_done !== undefined) { fields.push('leads_done=?'); vals.push(d.leads_done); }
  if (d.leads_count !== undefined) { fields.push('leads_count=?'); vals.push(d.leads_count); }
  if (d.custom_data !== undefined) { fields.push('custom_data=?'); vals.push(typeof d.custom_data === 'string' ? d.custom_data : JSON.stringify(d.custom_data)); }
  if (fields.length === 0) return c.json({ error: 'Nothing to update' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(id);
  await db.prepare('UPDATE period_snapshots SET ' + fields.join(', ') + ' WHERE id = ?').bind(...vals).run();
  return c.json({ success: true });
});

// ===== BUSINESS ANALYTICS V2 =====
api.get('/business-analytics', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const url = new URL(c.req.url);
    const dateFrom = url.searchParams.get('from') || '';
    const dateTo = url.searchParams.get('to') || '';
    // Also accept month param for period-specific analytics
    const monthParam = url.searchParams.get('month') || ''; // e.g. "2026-02"
    
    let dateFilter = '';
    const dateParams: string[] = [];
    if (monthParam) {
      dateFilter += " AND strftime('%Y-%m', l.created_at) = ?";
      dateParams.push(monthParam);
    } else {
      if (dateFrom) { dateFilter += " AND date(l.created_at) >= ?"; dateParams.push(dateFrom); }
      if (dateTo) { dateFilter += " AND date(l.created_at) <= ?"; dateParams.push(dateTo); }
    }

    // 1. Lead stats by status with services/articles breakdown
    // TURNOVER = in_progress + checking + done (money already received by company)
    const turnoverStatuses = ['in_progress', 'checking', 'done'];
    const allStatuses = ['new', 'contacted', 'in_progress', 'rejected', 'checking', 'done'];
    const statusData: Record<string, any> = {};
    for (const st of allStatuses) {
      const res = await db.prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(l.total_amount),0) as amt FROM leads l WHERE l.status = ?" + dateFilter).bind(st, ...dateParams).first().catch(() => null);
      statusData[st] = { count: Number(res?.cnt || 0), amount: Number(res?.amt || 0), services: 0, articles: 0 };
    }

    // Parse calc_data for SERVICES only; articles come exclusively from lead_articles table to avoid double-counting
    const allLeads = await db.prepare("SELECT id, status, calc_data, refund_amount, total_amount, assigned_to FROM leads l WHERE 1=1" + dateFilter).bind(...dateParams).all().catch(() => ({ results: [] }));
    let totalRefunds = 0;
    const leadsById: Record<number, any> = {};
    for (const lead of (allLeads.results || [])) {
      const st = lead.status as string || 'new';
      const lid = Number(lead.id);
      leadsById[lid] = lead;
      totalRefunds += Number(lead.refund_amount) || 0;
      try {
        const cd = JSON.parse((lead.calc_data as string) || '{}');
        if (cd.items && Array.isArray(cd.items)) {
          for (const item of cd.items) {
            // Only count services from calc_data; articles are tracked in lead_articles table
            if (!item.wb_article) {
              const subtotal = Number(item.subtotal) || 0;
              if (statusData[st]) statusData[st].services += subtotal;
            }
          }
        }
      } catch {}
    }

    // Articles totals from lead_articles table (single source of truth for articles)
    try {
      const artDateFilter = dateFilter.replace(/l\./g, 'l2.');
      const artTotals = await db.prepare("SELECT l2.status, COALESCE(SUM(la.total_price),0) as art_total FROM lead_articles la JOIN leads l2 ON la.lead_id = l2.id WHERE 1=1" + artDateFilter + " GROUP BY l2.status").bind(...dateParams).all();
      for (const r of (artTotals.results || [])) {
        const st = r.status as string;
        if (statusData[st]) statusData[st].articles += Number(r.art_total || 0);
      }
    } catch {}

    // 2. Financial summary
    // TURNOVER = total_amount of in_progress + checking + done leads (all money in company)
    let turnover = 0, servicesTotal = 0, articlesTotal = 0;
    for (const st of turnoverStatuses) {
      turnover += statusData[st]?.amount || 0;
      servicesTotal += statusData[st]?.services || 0;
      articlesTotal += statusData[st]?.articles || 0;
    }
    // Ensure turnover is never negative, sanitize big-number issues
    turnover = Math.max(0, Math.round(turnover * 100) / 100);
    servicesTotal = Math.max(0, Math.round(servicesTotal * 100) / 100);
    articlesTotal = Math.max(0, Math.round(articlesTotal * 100) / 100);

    // Completed (done) sums — separate for correct "Completed" card display
    const doneAmount = statusData.done?.amount || 0;
    const doneServices = statusData.done?.services || 0;
    const doneArticles = statusData.done?.articles || 0;
    const doneCount = statusData.done?.count || 0;

    // 3. Expenses
    const expenseRes = await db.prepare(`SELECT e.*, ec.is_marketing, ec.name as cat_name, eft.name as freq_name, eft.multiplier_monthly
      FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN expense_frequency_types eft ON e.frequency_type_id = eft.id
      WHERE e.is_active = 1`).all().catch(() => ({ results: [] }));
    let totalExpenses = 0, marketingExpenses = 0, commercialExpenses = 0;
    for (const exp of (expenseRes.results || [])) {
      const amt = Math.round((Number(exp.amount) || 0) * 100) / 100;
      totalExpenses += amt;
      if (exp.is_marketing) marketingExpenses += amt;
      else commercialExpenses += amt;
    }

    // 4. Salaries
    const salaryRes = await db.prepare("SELECT COALESCE(SUM(salary), 0) as total_salary FROM users WHERE is_active = 1 AND salary > 0").first().catch(() => null);
    const totalSalaries = Math.round((Number(salaryRes?.total_salary || 0)) * 100) / 100;

    // Bonuses for period
    let bonusFilter = '';
    const bonusParams: string[] = [];
    if (monthParam) {
      bonusFilter += " AND strftime('%Y-%m', bonus_date) = ?";
      bonusParams.push(monthParam);
    } else {
      if (dateFrom) { bonusFilter += " AND bonus_date >= ?"; bonusParams.push(dateFrom); }
      if (dateTo) { bonusFilter += " AND bonus_date <= ?"; bonusParams.push(dateTo); }
    }
    const bonusRes = await db.prepare("SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) as total_bonuses, COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END),0) as total_fines, COALESCE(SUM(amount),0) as net_total FROM employee_bonuses WHERE 1=1" + bonusFilter).bind(...bonusParams).first().catch(() => null);
    const totalBonuses = Math.round((Number(bonusRes?.total_bonuses || 0)) * 100) / 100;
    const totalFines = Math.round((Number(bonusRes?.total_fines || 0)) * 100) / 100;

    // 5. Financial metrics (profit from services, not articles — articles are client money)
    // Fines (negative bonuses) reduce salary cost, so net effect: salaries + bonuses + fines + expenses
    const allExpensesSum = totalSalaries + totalBonuses + totalFines + totalExpenses;
    const netProfit = Math.round((servicesTotal - allExpensesSum) * 100) / 100;
    const marginality = servicesTotal > 0 ? Math.round((netProfit / servicesTotal) * 1000) / 10 : 0;
    const roi = allExpensesSum > 0 ? Math.round((netProfit / allExpensesSum) * 1000) / 10 : 0;
    const romi = marketingExpenses > 0 ? Math.round(((servicesTotal - marketingExpenses) / marketingExpenses) * 1000) / 10 : 0;
    // AVG CHECK = only from services of completed leads (excluding purchases/articles)
    const avgCheck = doneCount > 0 ? Math.round(doneServices / doneCount) : 0;
    const totalLeadsCount = Object.values(statusData).reduce((a: number, s: any) => a + (Number(s.count) || 0), 0);
    const conversionRate = totalLeadsCount > 0 ? Math.round((doneCount / totalLeadsCount) * 1000) / 10 : 0;
    const breakEven = allExpensesSum;

    // Articles net (articles minus refunds)
    const articlesNet = Math.max(0, Math.round((articlesTotal - totalRefunds) * 100) / 100);

    // 6. Order fulfillment time
    let avgFulfillmentDays = 0;
    try {
      const dfNoAlias = dateFilter.replace(/l\./g, '');
      const ftRes = await db.prepare("SELECT AVG(julianday('now') - julianday(created_at)) as avg_days FROM leads WHERE status = 'done'" + dfNoAlias).bind(...dateParams).first();
      avgFulfillmentDays = Math.round(Number(ftRes?.avg_days || 0) * 10) / 10;
    } catch {}

    // 7. Daily breakdown (for bar chart)
    let dailyResults: any[] = [];
    try {
      if (monthParam) {
        const dailyQ = "SELECT date(created_at) as day, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE strftime('%Y-%m', created_at) = ? GROUP BY date(created_at) ORDER BY day";
        const dailyRes = await db.prepare(dailyQ).bind(monthParam).all();
        dailyResults = dailyRes.results || [];
      } else if (dateFrom || dateTo) {
        let dailyQ = "SELECT date(created_at) as day, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE 1=1";
        const dailyParams: string[] = [];
        if (dateFrom) { dailyQ += " AND date(created_at) >= ?"; dailyParams.push(dateFrom); }
        if (dateTo) { dailyQ += " AND date(created_at) <= ?"; dailyParams.push(dateTo); }
        dailyQ += " GROUP BY date(created_at) ORDER BY day";
        const dailyRes = await db.prepare(dailyQ).bind(...dailyParams).all();
        dailyResults = dailyRes.results || [];
      } else {
        const dailyQ = "SELECT date(created_at) as day, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now','-30 days') GROUP BY date(created_at) ORDER BY day";
        const dailyRes = await db.prepare(dailyQ).all();
        dailyResults = dailyRes.results || [];
      }
    } catch {}

    // 8. By assignee — enhanced with services/articles/operator/buyer breakdown
    const byAssignee: any[] = [];
    try {
      const byAssRes = await db.prepare("SELECT l.assigned_to, u.display_name, u.role, u.position_title, COUNT(*) as cnt, COALESCE(SUM(l.total_amount),0) as amt FROM leads l LEFT JOIN users u ON l.assigned_to=u.id WHERE l.status IN ('in_progress','checking','done')" + dateFilter + " GROUP BY l.assigned_to ORDER BY amt DESC").bind(...dateParams).all();
      for (const r of (byAssRes.results || [])) {
        // Calculate per-assignee services only from calc_data (articles from lead_articles)
        let assServices = 0, assArticles = 0;
        for (const lead of (allLeads.results || [])) {
          if (Number(lead.assigned_to) !== Number(r.assigned_to)) continue;
          if (!['in_progress','checking','done'].includes(lead.status as string)) continue;
          try {
            const cd = JSON.parse((lead.calc_data as string) || '{}');
            if (cd.items && Array.isArray(cd.items)) {
              for (const item of cd.items) {
                if (!item.wb_article) {
                  assServices += Number(item.subtotal) || 0;
                }
              }
            }
          } catch {}
        }
        // Get articles for this assignee from lead_articles table
        try {
          const artAss = await db.prepare("SELECT COALESCE(SUM(la.total_price),0) as art_total FROM lead_articles la JOIN leads l3 ON la.lead_id = l3.id WHERE l3.assigned_to = ? AND l3.status IN ('in_progress','checking','done')" + dateFilter.replace(/l\./g, 'l3.')).bind(r.assigned_to, ...dateParams).first();
          assArticles = Number(artAss?.art_total || 0);
        } catch {}
        byAssignee.push({ 
          user_id: r.assigned_to, display_name: r.display_name || 'Не назначен', 
          role: r.role || '', position_title: r.position_title || '',
          count: Number(r.cnt), amount: Number(r.amt),
          services: Math.round(assServices * 100) / 100,
          articles: Math.round(assArticles * 100) / 100
        });
      }
    } catch {}

    // 9. Service popularity (from calc_data items) — always display Russian names
    // Build translation map from calculator_services (name_am → name_ru)
    const svcNameMap: Record<string, string> = {};
    try {
      const allSvcs = await db.prepare("SELECT name_ru, name_am FROM calculator_services WHERE is_active = 1").all();
      for (const s of (allSvcs.results || [])) {
        if (s.name_am && s.name_ru) svcNameMap[s.name_am as string] = s.name_ru as string;
        if (s.name_ru) svcNameMap[s.name_ru as string] = s.name_ru as string;
      }
    } catch {}
    const serviceStats: Record<string, { count: number; qty: number; revenue: number }> = {};
    for (const lead of (allLeads.results || [])) {
      try {
        const cd = JSON.parse((lead.calc_data as string) || '{}');
        if (cd.items && Array.isArray(cd.items)) {
          for (const item of cd.items) {
            if (!item.wb_article) {
              const rawName = item.name || 'Неизвестно';
              // Translate to Russian if possible
              const name = svcNameMap[rawName] || rawName;
              if (!serviceStats[name]) serviceStats[name] = { count: 0, qty: 0, revenue: 0 };
              serviceStats[name].count++;
              serviceStats[name].qty += Number(item.qty || 1);
              serviceStats[name].revenue += Number(item.subtotal || 0);
            }
          }
        }
      } catch {}
    }
    const serviceList = Object.entries(serviceStats).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.revenue - a.revenue);

    // 10. Referral stats
    let refResults: any[] = [];
    try {
      const dfNoAlias = dateFilter.replace(/l\./g, '');
      const refRes = await db.prepare("SELECT referral_code, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE referral_code != '' AND referral_code IS NOT NULL" + dfNoAlias + " GROUP BY referral_code ORDER BY count DESC").bind(...dateParams).all();
      refResults = refRes.results || [];
    } catch {}

    // 11. By source
    const bySource: Record<string, any> = {};
    try {
      const bsRes = await db.prepare("SELECT source, COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as amt FROM leads l WHERE 1=1" + dateFilter + " GROUP BY source").bind(...dateParams).all();
      for (const r of (bsRes.results || [])) { bySource[r.source as string || 'direct'] = { count: Number(r.cnt), amount: Number(r.amt) }; }
    } catch {}

    // 12. Employees with salaries
    const employees: any[] = [];
    try {
      // Ensure hire_date and end_date columns exist
      try { await db.prepare("ALTER TABLE users ADD COLUMN hire_date TEXT DEFAULT ''").run(); } catch {}
      try { await db.prepare("ALTER TABLE users ADD COLUMN end_date TEXT DEFAULT ''").run(); } catch {}
      const empRes = await db.prepare("SELECT id, display_name, role, salary, salary_type, position_title, is_active, hire_date, end_date FROM users WHERE salary > 0 OR role != 'main_admin' ORDER BY salary DESC").all();
      for (const e of (empRes.results || [])) {
        const bSum = await db.prepare("SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) as total_bonuses, COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END),0) as total_fines, COALESCE(SUM(amount),0) as net_total FROM employee_bonuses WHERE user_id = ?" + bonusFilter).bind(e.id, ...bonusParams).first().catch(() => null);
        employees.push({ 
          ...e, 
          bonuses_total: Math.round((Number(bSum?.total_bonuses || 0)) * 100) / 100,
          fines_total: Math.round((Number(bSum?.total_fines || 0)) * 100) / 100,
          bonuses_net: Math.round((Number(bSum?.net_total || 0)) * 100) / 100
        });
      }
    } catch {}

    // 13. Rejected leads with reasons
    let rejectedLeads: any[] = [];
    try {
      const rejRes = await db.prepare("SELECT id, name, contact, notes, total_amount, created_at FROM leads l WHERE l.status = 'rejected'" + dateFilter + " ORDER BY l.created_at DESC LIMIT 50").bind(...dateParams).all();
      rejectedLeads = rejRes.results || [];
    } catch {}

    // 14. Stage timings (avg days per stage)
    const stageTimings: Record<string, number> = {};
    try {
      for (const st of allStatuses) {
        if (st === 'new') continue;
        const tRes = await db.prepare("SELECT AVG(julianday('now') - julianday(l.created_at)) as avg_days FROM leads l WHERE l.status = ?" + dateFilter).bind(st, ...dateParams).first();
        stageTimings[st] = Math.round((Number(tRes?.avg_days || 0)) * 10) / 10;
      }
    } catch {}

    // 15. Monthly data for yearly chart — detailed breakdown by status + financials
    let monthlyData: any[] = [];
    try {
      const yr = monthParam ? monthParam.substring(0, 4) : String(new Date().getFullYear());
      const mRes = await db.prepare(`SELECT strftime('%Y-%m', created_at) as month, 
        COUNT(*) as count, 
        COALESCE(SUM(total_amount),0) as amount, 
        SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done_count,
        SUM(CASE WHEN status='done' THEN total_amount ELSE 0 END) as done_amount,
        SUM(CASE WHEN status='in_progress' OR status='contacted' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected_count,
        SUM(CASE WHEN status='checking' THEN 1 ELSE 0 END) as checking_count,
        COALESCE(SUM(refund_amount),0) as refunds
        FROM leads WHERE strftime('%Y', created_at) = ? 
        GROUP BY strftime('%Y-%m', created_at) ORDER BY month`).bind(yr).all();
      // Now enrich with services/articles per month from calc_data + lead_articles
      const mDataArr = mRes.results || [];
      for (const md of mDataArr) {
        const mk = md.month as string;
        // Services from calc_data for this month's done leads
        const svcRes = await db.prepare(`SELECT COALESCE(SUM(total_amount),0) as svc_total FROM leads 
          WHERE strftime('%Y-%m', created_at) = ? AND status = 'done'`).bind(mk).first().catch(() => ({svc_total:0}));
        // Articles total from lead_articles for this month
        const artRes = await db.prepare(`SELECT COALESCE(SUM(la.total_price),0) as art_total 
          FROM lead_articles la JOIN leads l ON la.lead_id = l.id 
          WHERE strftime('%Y-%m', l.created_at) = ?`).bind(mk).first().catch(() => ({art_total:0}));
        // Services = look at calc_data items without wb_article for done leads
        const svcItemsRes = await db.prepare(`SELECT l.calc_data FROM leads l 
          WHERE strftime('%Y-%m', l.created_at) = ? AND l.status = 'done'`).bind(mk).all().catch(() => ({results:[]}));
        let svcTotal = 0;
        for (const row of (svcItemsRes.results || [])) {
          try {
            const cd = JSON.parse(row.calc_data as string || '{}');
            const items = cd.items || cd.services || [];
            for (const it of items) {
              if (!it.wb_article) svcTotal += (Number(it.price) || 0) * (Number(it.qty) || Number(it.quantity) || 1);
            }
          } catch {}
        }
        (md as any).services = svcTotal;
        (md as any).articles = Number((artRes as any)?.art_total) || 0;
      }
      monthlyData = mDataArr;
    } catch {}

    // 16. Weekly data
    let weeklyData: any[] = [];
    try {
      const wRes = await db.prepare("SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now', '-90 days') GROUP BY strftime('%Y-W%W', created_at) ORDER BY week").all();
      weeklyData = wRes.results || [];
    } catch {}

    // 17. Daily breakdown for expanded month view
    let monthDailyData: any[] = [];
    if (monthParam) {
      try {
        const mdRes = await db.prepare(`SELECT date(created_at) as day, COUNT(*) as count, 
          COALESCE(SUM(total_amount),0) as amount,
          SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done_count,
          SUM(CASE WHEN status='done' THEN total_amount ELSE 0 END) as done_amount,
          SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected_count
          FROM leads WHERE strftime('%Y-%m', created_at) = ? 
          GROUP BY date(created_at) ORDER BY day`).bind(monthParam).all();
        monthDailyData = mdRes.results || [];
      } catch {}
    }

    // 18. LTV calculation based on repeat customers (by phone number)
    // LTV = Средний чек × Частота покупок × Срок жизни клиента (мес)
    let ltvData: any = { ltv: 0, avg_check_ltv: 0, purchase_frequency: 0, customer_lifespan_months: 0, unique_customers: 0, repeat_customers: 0, total_orders: 0 };
    try {
      // Get customer data grouped by contact (phone number)
      let ltvQ = `SELECT contact, COUNT(*) as orders, 
        ROUND(AVG(total_amount),2) as avg_check,
        MIN(created_at) as first_order, MAX(created_at) as last_order
        FROM leads WHERE contact IS NOT NULL AND contact != '' 
        AND status IN ('done','in_progress','checking')`;
      const ltvParams: string[] = [];
      if (monthParam) {
        ltvQ += " AND strftime('%Y-%m', created_at) = ?";
        ltvParams.push(monthParam);
      } else {
        if (dateFrom) { ltvQ += " AND date(created_at) >= ?"; ltvParams.push(dateFrom); }
        if (dateTo) { ltvQ += " AND date(created_at) <= ?"; ltvParams.push(dateTo); }
      }
      ltvQ += " GROUP BY contact ORDER BY orders DESC";
      const ltvRes = await db.prepare(ltvQ).bind(...ltvParams).all();
      const customers = ltvRes.results || [];
      
      if (customers.length > 0) {
        const uniqueCustomers = customers.length;
        const totalOrders = customers.reduce((sum: number, c: any) => sum + Number(c.orders), 0);
        const repeatCustomers = customers.filter((c: any) => Number(c.orders) > 1).length;
        
        // Средний чек по всем клиентам
        const avgCheckLtv = customers.reduce((sum: number, c: any) => sum + Number(c.avg_check || 0), 0) / uniqueCustomers;
        
        // Частота покупок = общее число заказов / уникальные клиенты
        const purchaseFrequency = totalOrders / uniqueCustomers;
        
        // Срок жизни клиента (в месяцах)
        // Для повторных клиентов: среднее время между первым и последним заказом
        // Если повторных нет — берём 1 месяц как базовый
        let customerLifespanMonths = 1;
        const repeatCustomersList = customers.filter((c: any) => Number(c.orders) > 1);
        if (repeatCustomersList.length > 0) {
          let totalLifespanDays = 0;
          for (const rc of repeatCustomersList) {
            const first = new Date(rc.first_order as string).getTime();
            const last = new Date(rc.last_order as string).getTime();
            const diffDays = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
            totalLifespanDays += diffDays;
          }
          const avgLifespanDays = totalLifespanDays / repeatCustomersList.length;
          // Конвертируем дни в месяцы, минимум 1 месяц
          customerLifespanMonths = Math.max(1, Math.round((avgLifespanDays / 30) * 10) / 10);
        }
        
        // LTV = Средний чек × Частота покупок × Срок жизни (мес)
        const ltv = Math.round(avgCheckLtv * purchaseFrequency * customerLifespanMonths);
        
        ltvData = {
          ltv,
          avg_check_ltv: Math.round(avgCheckLtv),
          purchase_frequency: Math.round(purchaseFrequency * 100) / 100,
          customer_lifespan_months: customerLifespanMonths,
          unique_customers: uniqueCustomers,
          repeat_customers: repeatCustomers,
          total_orders: totalOrders,
          repeat_rate: uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 1000) / 10 : 0,
        };
      }
    } catch {}

    return c.json({
      status_data: statusData,
      financial: {
        turnover, services: servicesTotal, articles: articlesTotal, articles_net: articlesNet, refunds: totalRefunds,
        salaries: totalSalaries, bonuses: totalBonuses, fines: totalFines, commercial_expenses: commercialExpenses,
        marketing_expenses: marketingExpenses, total_expenses: allExpensesSum,
        net_profit: netProfit, marginality, roi, romi,
        avg_check: avgCheck, conversion_rate: conversionRate,
        break_even: breakEven, avg_fulfillment_days: avgFulfillmentDays,
        done_amount: doneAmount, done_services: doneServices, done_articles: doneArticles,
      },
      daily: dailyResults,
      by_assignee: byAssignee,
      by_source: bySource,
      services: serviceList,
      referrals: refResults,
      employees,
      rejected_leads: rejectedLeads,
      stage_timings: stageTimings,
      monthly_data: monthlyData,
      weekly_data: weeklyData,
      month_daily_data: monthDailyData,
      ltv_data: ltvData,
      total_leads: totalLeadsCount,
      date_from: dateFrom,
      date_to: dateTo,
      month: monthParam,
    });
  } catch (err: any) {
    console.error('Business analytics error:', err?.message || err);
    return c.json({
      status_data: {}, financial: {}, daily: [], by_assignee: [], by_source: {},
      services: [], referrals: [], employees: [], total_leads: 0,
      date_from: '', date_to: '', month: '', error: 'Analytics error: ' + (err?.message || 'unknown')
    });
  }
});

// ===== ACTIVITY TRACKING (heartbeat / online presence) =====
api.post('/activity/heartbeat', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').sub;
  const d = await c.req.json().catch(() => ({}));
  const action = d.action || '';
  const page = d.page || '';
  try {
    const existing = await db.prepare('SELECT id FROM activity_sessions WHERE user_id = ?').bind(userId).first();
    if (existing) {
      await db.prepare('UPDATE activity_sessions SET last_action = ?, last_page = ?, last_seen_at = CURRENT_TIMESTAMP WHERE user_id = ?')
        .bind(action, page, userId).run();
    } else {
      await db.prepare('INSERT INTO activity_sessions (user_id, last_action, last_page) VALUES (?,?,?)')
        .bind(userId, action, page).run();
    }
  } catch {}
  return c.json({ success: true });
});

api.get('/activity/online', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    // Users active within last 5 minutes are "online"
    const res = await db.prepare(`
      SELECT a.user_id, a.last_action, a.last_page, a.last_seen_at,
        u.display_name, u.role, u.position_title
      FROM activity_sessions a
      JOIN users u ON a.user_id = u.id
      WHERE a.last_seen_at >= datetime('now', '-5 minutes')
      ORDER BY a.last_seen_at DESC
    `).all();
    return c.json({ online: res.results || [] });
  } catch { return c.json({ online: [] }); }
});

// ===== EMPLOYEE VACATIONS =====
api.get('/users/:id/vacations', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.req.param('id');
  try {
    const res = await db.prepare('SELECT * FROM employee_vacations WHERE user_id = ? ORDER BY start_date DESC').bind(userId).all();
    return c.json({ vacations: res.results || [] });
  } catch { return c.json({ vacations: [] }); }
});

api.get('/vacations', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare(`
      SELECT v.*, u.display_name, u.role, u.position_title
      FROM employee_vacations v
      JOIN users u ON v.user_id = u.id
      ORDER BY v.start_date DESC
    `).all();
    return c.json({ vacations: res.results || [] });
  } catch { return c.json({ vacations: [] }); }
});

api.get('/vacations/current', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const res = await db.prepare(`
      SELECT v.*, u.display_name, u.role, u.position_title
      FROM employee_vacations v
      JOIN users u ON v.user_id = u.id
      WHERE v.status = 'active' AND date(v.start_date) <= date('now') AND date(v.end_date) >= date('now')
      ORDER BY v.end_date ASC
    `).all();
    return c.json({ vacations: res.results || [] });
  } catch { return c.json({ vacations: [] }); }
});

api.post('/users/:id/vacations', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can manage vacations' }, 403);
  const userId = c.req.param('id');
  const d = await c.req.json();
  if (!d.start_date || !d.end_date) return c.json({ error: 'start_date and end_date required' }, 400);
  // Auto-calculate days_count
  const start = new Date(d.start_date);
  const end = new Date(d.end_date);
  const diffMs = end.getTime() - start.getTime();
  const daysCount = d.days_count || Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
  await db.prepare('INSERT INTO employee_vacations (user_id, start_date, end_date, days_count, is_paid, paid_amount, status, notes) VALUES (?,?,?,?,?,?,?,?)')
    .bind(userId, d.start_date, d.end_date, daysCount, d.is_paid !== false ? 1 : 0, d.paid_amount || 0, d.status || 'planned', d.notes || '').run();
  return c.json({ success: true });
});

api.put('/vacations/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can manage vacations' }, 403);
  const id = c.req.param('id');
  const d = await c.req.json();
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.start_date !== undefined) { fields.push('start_date=?'); vals.push(d.start_date); }
  if (d.end_date !== undefined) { fields.push('end_date=?'); vals.push(d.end_date); }
  if (d.days_count !== undefined) { fields.push('days_count=?'); vals.push(d.days_count); }
  if (d.is_paid !== undefined) { fields.push('is_paid=?'); vals.push(d.is_paid ? 1 : 0); }
  if (d.paid_amount !== undefined) { fields.push('paid_amount=?'); vals.push(d.paid_amount); }
  if (d.status !== undefined) { fields.push('status=?'); vals.push(d.status); }
  if (d.notes !== undefined) { fields.push('notes=?'); vals.push(d.notes); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(id);
  await db.prepare(`UPDATE employee_vacations SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.delete('/vacations/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main_admin can manage vacations' }, 403);
  const id = c.req.param('id');
  await db.prepare('DELETE FROM employee_vacations WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ===== EMPLOYEE SEARCH (global across all fields) =====
api.get('/users/search', authMiddleware, async (c) => {
  const db = c.env.DB;
  const q = (c.req.query('q') || '').trim();
  if (!q) return c.json({ results: [] });
  const like = `%${q}%`;
  try {
    const res = await db.prepare(`
      SELECT id, username, role, display_name, phone, email, is_active, salary, salary_type, 
        position_title, hire_date, end_date, created_at
      FROM users 
      WHERE display_name LIKE ? OR username LIKE ? OR phone LIKE ? OR email LIKE ? OR position_title LIKE ? OR role LIKE ?
      ORDER BY display_name
    `).bind(like, like, like, like, like, like).all();
    return c.json({ results: res.results || [] });
  } catch { return c.json({ results: [] }); }
});

// ===== EMPLOYEE EARNINGS SUMMARY (salary + bonuses + penalties per month) =====
// Returns both requested month's earnings AND total lifetime earnings since hire_date
api.get('/users/:id/earnings/:month', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.req.param('id');
  const month = c.req.param('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return c.json({ error: 'Invalid month format' }, 400);
  try {
    const user = await db.prepare('SELECT salary, salary_type, hire_date, end_date, is_active, display_name FROM users WHERE id = ?').bind(userId).first();
    const monthlySalary = Number(user?.salary || 0);
    const hireDate = (user?.hire_date as string) || '';
    const endDate = (user?.end_date as string) || '';

    // === CURRENT MONTH EARNINGS ===
    const bonusRes = await db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN bonus_type='bonus' OR (bonus_type IS NULL AND amount > 0) THEN amount ELSE 0 END),0) as bonuses,
        COALESCE(SUM(CASE WHEN bonus_type='penalty' OR (bonus_type IS NULL AND amount < 0) THEN ABS(amount) ELSE 0 END),0) as penalties,
        COALESCE(SUM(amount),0) as net
      FROM employee_bonuses WHERE user_id = ? AND strftime('%Y-%m', bonus_date) = ?
    `).bind(userId, month).first();
    const bonuses = Number(bonusRes?.bonuses || 0);
    const penalties = Number(bonusRes?.penalties || 0);
    const bonusesNet = Number(bonusRes?.net || 0);

    // Vacation days this month with paid/unpaid breakdown
    let vacRes: any = { paid_days: 0, unpaid_days: 0, paid_amount: 0, total_days: 0 };
    try {
      vacRes = await db.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN is_paid = 1 THEN days_count ELSE 0 END),0) as paid_days,
          COALESCE(SUM(CASE WHEN is_paid = 0 THEN days_count ELSE 0 END),0) as unpaid_days,
          COALESCE(SUM(days_count),0) as total_days,
          COALESCE(SUM(paid_amount),0) as paid_amount
        FROM employee_vacations WHERE user_id = ? AND (
          strftime('%Y-%m', start_date) = ? OR strftime('%Y-%m', end_date) = ?
        )
      `).bind(userId, month, month).first();
    } catch {}
    const unpaidVacDays = Number(vacRes?.unpaid_days || 0);
    const paidVacDays = Number(vacRes?.paid_days || 0);
    const vacationPaid = Number(vacRes?.paid_amount || 0);

    // Calculate salary deduction for unpaid vacation days
    // Assume ~22 working days per month
    const dailySalary = monthlySalary / 22;
    const unpaidDeduction = Math.round(unpaidVacDays * dailySalary * 100) / 100;
    // Paid vacation: salary stays the same, no deduction
    const monthSalaryAfterVac = Math.max(0, Math.round((monthlySalary - unpaidDeduction) * 100) / 100);
    // Paid vacation amount is added to total earnings as separate line
    const monthTotal = Math.round((monthSalaryAfterVac + bonusesNet + vacationPaid) * 100) / 100;

    // === LIFETIME EARNINGS (since hire_date) ===
    // Count months worked
    let totalMonthsWorked = 0;
    let lifetimeSalary = 0;
    let lifetimeBonuses = 0;
    let lifetimePenalties = 0;
    let lifetimeUnpaidDays = 0;
    let lifetimeUnpaidDeduction = 0;
    let lifetimeTotal = 0;

    if (hireDate) {
      const hd = new Date(hireDate + 'T00:00:00Z');
      const ed = endDate ? new Date(endDate + 'T00:00:00Z') : new Date();
      // Calculate months between hire and end/now
      totalMonthsWorked = Math.max(1, 
        (ed.getFullYear() - hd.getFullYear()) * 12 + (ed.getMonth() - hd.getMonth()) + 1
      );
      lifetimeSalary = Math.round(monthlySalary * totalMonthsWorked * 100) / 100;

      // Lifetime bonuses/penalties since hire
      const lifeBonus = await db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN bonus_type='bonus' OR (bonus_type IS NULL AND amount > 0) THEN amount ELSE 0 END),0) as bonuses,
          COALESCE(SUM(CASE WHEN bonus_type='penalty' OR (bonus_type IS NULL AND amount < 0) THEN ABS(amount) ELSE 0 END),0) as penalties,
          COALESCE(SUM(amount),0) as net
        FROM employee_bonuses WHERE user_id = ? AND bonus_date >= ? ${endDate ? "AND bonus_date <= ?" : ""}
      `).bind(userId, hireDate, ...(endDate ? [endDate] : [])).first();
      lifetimeBonuses = Number(lifeBonus?.bonuses || 0);
      lifetimePenalties = Number(lifeBonus?.penalties || 0);
      const lifetimeBonusNet = Number(lifeBonus?.net || 0);

      // Lifetime unpaid vacation days + paid vacation amounts
      let lifetimePaidVacAmount = 0;
      try {
        const lifeVac = await db.prepare(`
          SELECT COALESCE(SUM(CASE WHEN is_paid = 0 THEN days_count ELSE 0 END),0) as unpaid_days,
            COALESCE(SUM(paid_amount),0) as total_paid_amount
          FROM employee_vacations WHERE user_id = ? AND start_date >= ? ${endDate ? "AND start_date <= ?" : ""}
        `).bind(userId, hireDate, ...(endDate ? [endDate] : [])).first();
        lifetimeUnpaidDays = Number(lifeVac?.unpaid_days || 0);
        lifetimePaidVacAmount = Number(lifeVac?.total_paid_amount || 0);
      } catch {}
      lifetimeUnpaidDeduction = Math.round(lifetimeUnpaidDays * dailySalary * 100) / 100;
      lifetimeTotal = Math.round((lifetimeSalary - lifetimeUnpaidDeduction + lifetimeBonusNet + lifetimePaidVacAmount) * 100) / 100;
    }

    return c.json({
      month, user_id: Number(userId), 
      display_name: user?.display_name || '',
      salary: monthlySalary, salary_type: user?.salary_type || 'monthly',
      hire_date: hireDate, end_date: endDate,
      // Current month breakdown
      bonuses, penalties, bonuses_net: bonusesNet,
      vacation_paid_days: paidVacDays,
      vacation_unpaid_days: unpaidVacDays,
      vacation_total_days: Number(vacRes?.total_days || 0),
      vacation_paid_amount: vacationPaid,
      unpaid_deduction: unpaidDeduction,
      month_salary_after_vac: monthSalaryAfterVac,
      total_earnings: monthTotal,
      // Lifetime totals
      lifetime: {
        months_worked: totalMonthsWorked,
        total_salary: lifetimeSalary,
        total_bonuses: lifetimeBonuses,
        total_penalties: lifetimePenalties,
        unpaid_vac_days: lifetimeUnpaidDays,
        unpaid_deduction: lifetimeUnpaidDeduction,
        paid_vacation_amount: lifetimePaidVacAmount,
        grand_total: lifetimeTotal
      }
    });
  } catch (err: any) {
    return c.json({ error: 'Earnings error: ' + (err?.message || 'unknown') }, 500);
  }
});

export default api
