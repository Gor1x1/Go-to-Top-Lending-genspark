/**
 * Admin API — Main router (modular architecture)
 * 
 * Each route group is split into its own file under ./routes/
 * This file handles: global middleware, auth, and route registration
 */
import { Hono } from 'hono'
import { verifyToken, hashPassword, verifyPassword, createToken, initDefaultAdmin } from '../lib/auth'
import { initDatabase, ALL_ROLES, ALL_SECTIONS, ROLE_LABELS, SECTION_LABELS, DEFAULT_PERMISSIONS } from '../lib/db'

// Route modules
import { register as registerContent } from './routes/admin-content'
import { register as registerStats } from './routes/admin-stats'
import { register as registerReferrals } from './routes/admin-referrals'
import { register as registerLeads } from './routes/admin-leads'
import { register as registerSettings } from './routes/admin-settings'
import { register as registerEmployees } from './routes/admin-employees'
import { register as registerSiteBlocks } from './routes/admin-site-blocks'
import { register as registerCrmExtended } from './routes/admin-crm-extended'
import { register as registerAnalytics } from './routes/admin-analytics'
import { register as registerActivity } from './routes/admin-activity'
import { register as registerFinance } from './routes/admin-finance'

type Bindings = { DB: D1Database }
const api = new Hono<{ Bindings: Bindings }>()

// Global error handler - return JSON instead of "Internal Server Error"
api.onError((err, c) => {
  console.error('API Error:', err?.message, err?.stack);
  return c.json({ error: 'Server error: ' + (err?.message || 'Unknown') }, 500);
})

// Prevent caching of admin API responses — ensures fresh data on every request
api.use('*', async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
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

// ===== TOKEN REFRESH =====
api.post('/refresh-token', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const token = await createToken(user.sub, user.role);
    return c.json({ token });
  } catch(err: any) {
    return c.json({ error: 'Refresh failed' }, 500);
  }
});

api.post('/change-password', authMiddleware, async (c) => {
  const { current_password, new_password } = await c.req.json();
  const db = c.env.DB;
  const userId = c.get('user').sub;
  
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return c.json({ error: 'User not found' }, 404);
  
  const valid = await verifyPassword(current_password, user.password_hash as string);
  if (!valid) return c.json({ error: 'Incorrect current password' }, 400);
  
  if (!new_password || new_password.length < 4) return c.json({ error: 'Password minimum 4 characters' }, 400);
  
  const newHash = await hashPassword(new_password);
  await db.prepare('UPDATE users SET password_hash = ?, password_plain = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newHash, new_password, userId).run();
  return c.json({ success: true });
});

// ===== ADMIN PROFILE (main_admin only, self-edit) =====
api.put('/admin-profile', authMiddleware, async (c) => {
  const caller = c.get('user');
  if (caller.role !== 'main_admin') return c.json({ error: 'Only main admin allowed' }, 403);
  const db = c.env.DB;
  const body = await c.req.json();
  const { display_name, username, phone, telegram_link } = body;
  
  if (!display_name || !username) return c.json({ error: 'Name and username required' }, 400);
  if (username.length < 2) return c.json({ error: 'Username minimum 2 characters' }, 400);
  
  // Check username uniqueness
  const existing = await db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').bind(username, caller.sub).first();
  if (existing) return c.json({ error: 'Username already taken' }, 400);
  
  await db.prepare('UPDATE users SET display_name = ?, username = ?, phone = ?, telegram_link = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(display_name, username, phone || null, telegram_link || null, caller.sub).run();
  
  return c.json({ success: true });
});

// ===== INIT DATABASE =====
api.post('/init-db', authMiddleware, async (c) => {
  const db = c.env.DB;
  await initDatabase(db);
  return c.json({ success: true, message: 'Database initialized' });
});

// ===== REGISTER ALL ROUTE MODULES =====
registerContent(api, authMiddleware);
registerStats(api, authMiddleware);
registerReferrals(api, authMiddleware);
registerLeads(api, authMiddleware);
registerSettings(api, authMiddleware);
registerEmployees(api, authMiddleware);
registerSiteBlocks(api, authMiddleware);
registerCrmExtended(api, authMiddleware);
registerAnalytics(api, authMiddleware);
registerActivity(api, authMiddleware);
registerFinance(api, authMiddleware);

export default api
