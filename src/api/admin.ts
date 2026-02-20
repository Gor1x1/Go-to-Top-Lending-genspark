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
  const res = await db.prepare('SELECT id, username, role, display_name, phone, email, is_active, salary, salary_type, position_title, created_at FROM users ORDER BY id').all();
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
  
  // Total = services + articles; subtotal is WITHOUT refund, total_amount is WITH refund deducted
  const refundAmount = Number(leadRow.refund_amount) || 0;
  const subtotalAmount = servicesTotalAmount + articlesTotalAmount;
  const totalAmount = subtotalAmount - refundAmount;
  const allItems = [...serviceItems, ...articleItems];
  
  // Update lead total_amount and calc_data (for PDF)
  // subtotal = raw sum of all items (before refund), total = final amount after refund
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
    return c.json({ roles: res.results || [] });
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
  await db.prepare('INSERT INTO company_roles (role_key, role_name, description, default_sections, color, is_system, sort_order) VALUES (?,?,?,?,?,0,?)')
    .bind(d.role_key, d.role_name, d.description || '', JSON.stringify(d.default_sections || ['dashboard']), d.color || '#8B5CF6', d.sort_order || 99).run();
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
  if (d.role_name !== undefined) { fields.push('role_name=?'); vals.push(d.role_name); }
  if (d.description !== undefined) { fields.push('description=?'); vals.push(d.description); }
  if (d.default_sections !== undefined) { fields.push('default_sections=?'); vals.push(JSON.stringify(d.default_sections)); }
  if (d.color !== undefined) { fields.push('color=?'); vals.push(d.color); }
  if (d.is_active !== undefined) { fields.push('is_active=?'); vals.push(d.is_active ? 1 : 0); }
  if (d.sort_order !== undefined) { fields.push('sort_order=?'); vals.push(d.sort_order); }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
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
  await db.prepare('INSERT INTO employee_bonuses (user_id, amount, description, bonus_date) VALUES (?,?,?,?)')
    .bind(userId, d.amount || 0, d.description || '', d.bonus_date || new Date().toISOString().slice(0, 10)).run();
  return c.json({ success: true });
});

api.delete('/bonuses/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM employee_bonuses WHERE id = ?').bind(id).run();
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
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(id);
  await db.prepare(`UPDATE users SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
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

// ===== BUSINESS ANALYTICS V2 =====
api.get('/business-analytics', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const url = new URL(c.req.url);
    const dateFrom = url.searchParams.get('from') || '';
    const dateTo = url.searchParams.get('to') || '';
    let dateFilter = '';
    const dateParams: string[] = [];
    if (dateFrom) { dateFilter += " AND date(l.created_at) >= ?"; dateParams.push(dateFrom); }
    if (dateTo) { dateFilter += " AND date(l.created_at) <= ?"; dateParams.push(dateTo); }

    // 1. Lead stats by status with services/articles breakdown
    const activeStatuses = ['in_progress', 'checking', 'done'];
    const allStatuses = ['new', 'contacted', 'in_progress', 'rejected', 'checking', 'done'];
    const statusData: Record<string, any> = {};
    for (const st of allStatuses) {
      const res = await db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(l.total_amount),0) as amount FROM leads l WHERE l.status = ?" + dateFilter).bind(st, ...dateParams).first().catch(() => ({ count: 0, amount: 0 }));
      statusData[st] = { count: res?.count || 0, amount: res?.amount || 0, services: 0, articles: 0 };
    }

    // Parse calc_data for services vs articles breakdown per status
    const allLeads = await db.prepare("SELECT id, status, calc_data, refund_amount FROM leads l WHERE 1=1" + dateFilter).bind(...dateParams).all().catch(() => ({ results: [] }));
    let totalRefunds = 0;
    for (const lead of (allLeads.results || [])) {
      const st = lead.status as string || 'new';
      totalRefunds += Number(lead.refund_amount) || 0;
      try {
        const cd = JSON.parse((lead.calc_data as string) || '{}');
        if (cd.items && Array.isArray(cd.items)) {
          for (const item of cd.items) {
            if (item.wb_article) {
              if (statusData[st]) statusData[st].articles += Number(item.subtotal || 0);
            } else {
              if (statusData[st]) statusData[st].services += Number(item.subtotal || 0);
            }
          }
        }
      } catch {}
    }

    // Also get articles totals from lead_articles table
    try {
      const artTotals = await db.prepare("SELECT l.status, SUM(la.total_price) as art_total FROM lead_articles la JOIN leads l ON la.lead_id = l.id WHERE 1=1" + dateFilter + " GROUP BY l.status").bind(...dateParams).all();
      for (const r of (artTotals.results || [])) {
        const st = r.status as string;
        if (statusData[st]) statusData[st].articles += Number(r.art_total || 0);
      }
    } catch {}

    // 2. Financial summary (only active statuses: in_progress + checking + done)
    let turnover = 0, servicesTotal = 0, articlesTotal = 0;
    for (const st of activeStatuses) {
      turnover += Number(statusData[st]?.amount || 0);
      servicesTotal += Number(statusData[st]?.services || 0);
      articlesTotal += Number(statusData[st]?.articles || 0);
    }

    // 3. Expenses
    const expenseRes = await db.prepare(`SELECT e.*, ec.is_marketing, eft.name as freq_name
      FROM expenses e LEFT JOIN expense_categories ec ON e.category_id = ec.id
      LEFT JOIN expense_frequency_types eft ON e.frequency_type_id = eft.id
      WHERE e.is_active = 1`).all().catch(() => ({ results: [] }));
    let totalExpenses = 0, marketingExpenses = 0, commercialExpenses = 0;
    for (const exp of (expenseRes.results || [])) {
      const amt = Number(exp.amount) || 0;
      totalExpenses += amt;
      if (exp.is_marketing) marketingExpenses += amt;
      else commercialExpenses += amt;
    }

    // 4. Salaries
    const salaryRes = await db.prepare("SELECT COALESCE(SUM(salary), 0) as total_salary FROM users WHERE is_active = 1 AND salary > 0").first().catch(() => ({ total_salary: 0 }));
    const totalSalaries = Number(salaryRes?.total_salary || 0);

    // Bonuses for period
    let bonusFilter = '';
    const bonusParams: string[] = [];
    if (dateFrom) { bonusFilter += " AND bonus_date >= ?"; bonusParams.push(dateFrom); }
    if (dateTo) { bonusFilter += " AND bonus_date <= ?"; bonusParams.push(dateTo); }
    const bonusRes = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total_bonuses FROM employee_bonuses WHERE 1=1" + bonusFilter).bind(...bonusParams).first().catch(() => ({ total_bonuses: 0 }));
    const totalBonuses = Number(bonusRes?.total_bonuses || 0);

    // 5. Financial metrics
    const allExpenses = totalSalaries + totalBonuses + totalExpenses;
    const netProfit = servicesTotal - allExpenses;
    const marginality = servicesTotal > 0 ? ((netProfit / servicesTotal) * 100) : 0;
    const roi = allExpenses > 0 ? (((servicesTotal - allExpenses) / allExpenses) * 100) : 0;
    const romi = marketingExpenses > 0 ? (((servicesTotal - marketingExpenses) / marketingExpenses) * 100) : 0;
    const doneCount = Number(statusData.done?.count || 0);
    const avgCheck = doneCount > 0 ? Math.round(turnover / doneCount) : 0;
    const totalLeadsCount = Object.values(statusData).reduce((a: number, s: any) => a + (s.count || 0), 0);
    const conversionRate = totalLeadsCount > 0 ? ((doneCount / totalLeadsCount) * 100) : 0;
    const breakEven = allExpenses; // point where services revenue = expenses

    // 6. Order fulfillment time (from creation to done status)
    let avgFulfillmentDays = 0;
    try {
      const ftRes = await db.prepare("SELECT AVG(julianday('now') - julianday(created_at)) as avg_days FROM leads WHERE status = 'done'" + dateFilter.replace(/l\./g, '')).bind(...dateParams).first();
      avgFulfillmentDays = Math.round(Number(ftRes?.avg_days || 0) * 10) / 10;
    } catch {}

    // 7. Daily breakdown
    let dailyResults: any[] = [];
    try {
      const dailyRes = await db.prepare("SELECT date(created_at) as day, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE date(created_at) >= date('now','-30 days') GROUP BY date(created_at) ORDER BY day").all();
      dailyResults = dailyRes.results || [];
    } catch {}

    // 8. By assignee
    const byAssignee: any[] = [];
    try {
      const byAssRes = await db.prepare("SELECT l.assigned_to, u.display_name, COUNT(*) as count, COALESCE(SUM(l.total_amount),0) as amount FROM leads l LEFT JOIN users u ON l.assigned_to=u.id WHERE l.status IN ('in_progress','checking','done')" + dateFilter + " GROUP BY l.assigned_to ORDER BY amount DESC").bind(...dateParams).all();
      for (const r of (byAssRes.results || [])) { byAssignee.push({ user_id: r.assigned_to, name: r.display_name || 'Не назначен', count: r.count, amount: r.amount }); }
    } catch {}

    // 9. Service popularity
    const serviceStats: Record<string, { count: number; qty: number; revenue: number }> = {};
    for (const lead of (allLeads.results || [])) {
      try {
        const cd = JSON.parse((lead.calc_data as string) || '{}');
        if (cd.items && Array.isArray(cd.items)) {
          for (const item of cd.items) {
            if (!item.wb_article) {
              const name = item.name || 'Неизвестно';
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
      const refRes = await db.prepare("SELECT referral_code, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads WHERE referral_code != '' AND referral_code IS NOT NULL" + dateFilter.replace(/l\./g, '') + " GROUP BY referral_code ORDER BY count DESC").bind(...dateParams).all();
      refResults = refRes.results || [];
    } catch {}

    // 11. By source
    let bySource: Record<string, any> = {};
    try {
      const bsRes = await db.prepare("SELECT source, COUNT(*) as count, COALESCE(SUM(total_amount),0) as amount FROM leads l WHERE 1=1" + dateFilter + " GROUP BY source").bind(...dateParams).all();
      for (const r of (bsRes.results || [])) { bySource[r.source as string] = { count: r.count, amount: r.amount }; }
    } catch {}

    // 12. Employees with salaries for analytics
    const employees: any[] = [];
    try {
      const empRes = await db.prepare("SELECT id, display_name, role, salary, salary_type, position_title, is_active FROM users WHERE salary > 0 OR role != 'main_admin' ORDER BY salary DESC").all();
      for (const e of (empRes.results || [])) {
        // Get bonuses sum
        const bSum = await db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM employee_bonuses WHERE user_id = ?" + bonusFilter).bind(e.id, ...bonusParams).first().catch(() => ({ total: 0 }));
        employees.push({ ...e, bonuses_total: Number(bSum?.total || 0) });
      }
    } catch {}

    return c.json({
      status_data: statusData,
      financial: {
        turnover, services: servicesTotal, articles: articlesTotal, refunds: totalRefunds,
        salaries: totalSalaries, bonuses: totalBonuses, commercial_expenses: commercialExpenses,
        marketing_expenses: marketingExpenses, total_expenses: allExpenses,
        net_profit: netProfit, marginality: Math.round(marginality * 10) / 10,
        roi: Math.round(roi * 10) / 10, romi: Math.round(romi * 10) / 10,
        avg_check: avgCheck, conversion_rate: Math.round(conversionRate * 10) / 10,
        break_even: breakEven, avg_fulfillment_days: avgFulfillmentDays,
      },
      daily: dailyResults,
      by_assignee: byAssignee,
      by_source: bySource,
      services: serviceList,
      referrals: refResults,
      employees,
      total_leads: totalLeadsCount,
      date_from: dateFrom,
      date_to: dateTo,
    });
  } catch (err: any) {
    console.error('Business analytics error:', err?.message || err);
    return c.json({
      status_data: {}, financial: {}, daily: [], by_assignee: [], by_source: {},
      services: [], referrals: [], employees: [], total_leads: 0,
      date_from: '', date_to: '', error: 'Analytics error: ' + (err?.message || 'unknown')
    });
  }
});

export default api
