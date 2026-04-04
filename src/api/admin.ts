/**
 * Admin API — Main router (modular architecture)
 * 
 * Each route group is split into its own file under ./routes/
 * This file handles: global middleware, auth, and route registration
 */
import { Hono } from 'hono'
import { verifyToken, hashPassword, verifyPassword, createToken, initDefaultAdmin } from '../lib/auth'
import { initDatabase, ALL_ROLES, ALL_SECTIONS, ROLE_LABELS, SECTION_LABELS, DEFAULT_PERMISSIONS } from '../lib/db'
import { CACHE_VERSION, CACHEABLE_PATHS, KNOWN_ORIGINS } from '../lib/cache-config'

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
// Exception: /uploads/ serves static images and should be cached
api.use('*', async (c, next) => {
  await next();
  if (!c.req.path.includes('/uploads/')) {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
  }
  // Auto-purge edge cache after any successful admin write operation
  // so that landing page reflects changes within seconds
  if (['POST','PUT','PATCH','DELETE'].includes(c.req.method) && c.res.status < 400) {
    try {
      const cache = caches.default;
      const origin = new URL(c.req.url).origin;
      // Build versioned + unversioned paths
      const vPaths = CACHEABLE_PATHS.map(p => p.includes('?') ? p + '&_cv=' + CACHE_VERSION : p + '?_cv=' + CACHE_VERSION);
      const allPaths = [...CACHEABLE_PATHS, ...vPaths];
      // Purge from ALL known origins (not just the requesting origin)
      const origins = new Set([origin, ...KNOWN_ORIGINS]);
      const purgePromises: Promise<boolean>[] = [];
      for (const o of origins) {
        for (const p of allPaths) {
          purgePromises.push(cache.delete(new Request(o + p)).catch(() => false));
        }
      }
      c.executionCtx.waitUntil(Promise.all(purgePromises));
    } catch { /* cache purge is best-effort */ }
  }
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

// ===== OPENAPI / SWAGGER DOCUMENTATION =====
api.get('/api-docs', async (c) => {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'GoToTop CRM API',
      version: '2.0.0',
      description: 'Complete API documentation for GoToTop Landing & CRM system. Includes public endpoints, admin CRM, analytics, and financial management.',
      contact: { name: 'GoToTop', url: 'https://goo-to-top.com' }
    },
    servers: [{ url: '/api/admin', description: 'Admin API' }, { url: '/', description: 'Public API' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    },
    security: [{ bearerAuth: [] }],
    paths: {
      '/api/lead': { post: { tags: ['Public'], summary: 'Create lead from contact form', security: [], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: {type:'string'}, contact: {type:'string'}, product: {type:'string'}, service: {type:'string'}, message: {type:'string'}, lang: {type:'string',enum:['ru','am','en']}, referral_code: {type:'string'} }}}}}, responses: { '200': { description: 'Lead created' }, '429': { description: 'Rate limited' }}}},
      '/api/generate-pdf': { post: { tags: ['Public'], summary: 'Generate PDF invoice and create lead', security: [], responses: { '200': { description: 'PDF lead created with URL' }, '429': { description: 'Rate limited' }}}},
      '/api/site-data': { get: { tags: ['Public'], summary: 'Get all site content for rendering', security: [], responses: { '200': { description: 'Site data JSON' }}}},
      '/api/health': { get: { tags: ['Public'], summary: 'Health check', security: [], responses: { '200': { description: 'OK' }}}},
      '/api/referral/check': { post: { tags: ['Public'], summary: 'Validate referral/promo code', security: [], responses: { '200': { description: 'Validation result' }}}},
      '/login': { post: { tags: ['Auth'], summary: 'Admin login', security: [], responses: { '200': { description: 'JWT token + user info' }}}},
      '/refresh-token': { post: { tags: ['Auth'], summary: 'Refresh JWT token', responses: { '200': { description: 'New token' }}}},
      '/change-password': { post: { tags: ['Auth'], summary: 'Change password', responses: { '200': { description: 'Success' }}}},
      '/leads': { get: { tags: ['Leads'], summary: 'List leads with filtering', parameters: [{name:'status',in:'query'},{name:'source',in:'query'},{name:'limit',in:'query'},{name:'offset',in:'query'}], responses: { '200': { description: 'Leads list' }}}, post: { tags: ['Leads'], summary: 'Create lead manually', responses: { '200': { description: 'Success' }}}},
      '/leads/{id}': { put: { tags: ['Leads'], summary: 'Update lead (tracks status_changed_at, completed_at)', responses: { '200': { description: 'Success' }}}, delete: { tags: ['Leads'], summary: 'Delete lead', responses: { '200': { description: 'Success' }}}},
      '/leads/export': { get: { tags: ['Leads'], summary: 'Export leads as CSV', responses: { '200': { description: 'CSV file' }}}},
      '/leads/analytics': { get: { tags: ['Analytics'], summary: 'Lead analytics (basic)', responses: { '200': { description: 'Analytics data' }}}},
      '/business-analytics': { get: { tags: ['Analytics'], summary: 'Comprehensive business analytics with KPIs (CAC, ROAS, funnel, forecast, cohort)', parameters: [{name:'from',in:'query'},{name:'to',in:'query'},{name:'month',in:'query'}], responses: { '200': { description: 'Full analytics payload' }}}},
      '/stats': { get: { tags: ['Dashboard'], summary: 'Dashboard statistics', responses: { '200': { description: 'Dashboard stats' }}}},
      '/users': { get: { tags: ['Employees'], summary: 'List employees', responses: { '200': { description: 'Users list' }}}, post: { tags: ['Employees'], summary: 'Create employee', responses: { '200': { description: 'Success' }}}},
      '/expenses': { get: { tags: ['Finance'], summary: 'List expenses (filtered by period)', responses: { '200': { description: 'Expenses list' }}}},
      '/pnl/{periodKey}': { get: { tags: ['Finance'], summary: 'P&L report for period', responses: { '200': { description: 'P&L data' }}}},
      '/audit-log': { get: { tags: ['Audit'], summary: 'View audit log', parameters: [{name:'entity_type',in:'query'},{name:'entity_id',in:'query'},{name:'limit',in:'query'}], responses: { '200': { description: 'Audit log entries' }}}},
      '/db-backup': { get: { tags: ['System'], summary: 'Export full DB backup as JSON', responses: { '200': { description: 'JSON backup file' }}}},
      '/overdue-leads': { get: { tags: ['Notifications'], summary: 'Get overdue leads (new > 24h without assignment)', responses: { '200': { description: 'Overdue leads list' }}}},
      '/auto-close-month': { post: { tags: ['Finance'], summary: 'Auto-close month (create locked snapshot)', responses: { '200': { description: 'Month closed' }}}},
      '/referrals': { get: { tags: ['Referrals'], summary: 'List referral codes', responses: { '200': { description: 'Referral codes' }}}},
      '/period-snapshots': { get: { tags: ['Finance'], summary: 'List period snapshots', responses: { '200': { description: 'Snapshots' }}}},
    },
    tags: [
      { name: 'Public', description: 'Public-facing API endpoints (no auth required)' },
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Leads', description: 'Lead/CRM management' },
      { name: 'Analytics', description: 'Business analytics and KPIs' },
      { name: 'Dashboard', description: 'Dashboard statistics' },
      { name: 'Employees', description: 'Employee management' },
      { name: 'Finance', description: 'Financial management (P&L, expenses, loans, taxes)' },
      { name: 'Audit', description: 'Audit log for financial operations' },
      { name: 'System', description: 'System administration (backup, DB init)' },
      { name: 'Notifications', description: 'Overdue leads and alerts' },
      { name: 'Referrals', description: 'Referral/promo code management' },
    ]
  };
  return c.json(spec);
});

// Swagger UI HTML page
api.get('/docs', async (c) => {
  const html = `<!DOCTYPE html><html><head><title>GoToTop API Docs</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:'/api/admin/api-docs',dom_id:'#swagger-ui',presets:[SwaggerUIBundle.presets.apis],layout:'BaseLayout'})</script>
</body></html>`;
  return c.html(html);
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
