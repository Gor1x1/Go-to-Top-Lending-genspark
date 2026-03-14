/**
 * Admin API — Users/employees management and permissions
 */
import { Hono } from 'hono'
import { DEFAULT_PERMISSIONS } from '../../lib/db'
import { hashPassword, generatePassword } from '../../lib/auth'
type Bindings = { DB: D1Database }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: AuthMiddleware) {
// ===== USERS / EMPLOYEES =====
api.get('/users', authMiddleware, async (c) => {
  const db = c.env.DB;
  const caller = c.get('user');
  const isMainAdmin = caller.role === 'main_admin';
  // main_admin sees password_plain for credential management; others don't
  const cols = isMainAdmin
    ? 'id, username, password_plain, role, display_name, phone, email, telegram_link, is_active, salary, salary_type, position_title, hire_date, end_date, created_at'
    : 'id, username, role, display_name, phone, email, telegram_link, is_active, salary, salary_type, position_title, hire_date, end_date, created_at';
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
  await db.prepare('INSERT INTO users (username, password_hash, password_plain, role, display_name, phone, email, telegram_link, is_active, salary, salary_type, position_title, hire_date, end_date) VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?,?)')
    .bind(d.username, hash, d.password, d.role || 'operator', d.display_name, d.phone || '', d.email || '', d.telegram_link || '', d.salary || 0, d.salary_type || 'monthly', d.position_title || '', d.hire_date || '', d.end_date || '').run();
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
  
  // Only main_admin can edit main_admin's card (other admins cannot)
  const targetUser = await db.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
  if (targetUser && targetUser.role === 'main_admin' && caller.role !== 'main_admin') {
    return c.json({ error: 'Только главный администратор может редактировать свой профиль' }, 403);
  }
  
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
  if (d.telegram_link !== undefined) { fields.push('telegram_link=?'); vals.push(d.telegram_link); }
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
  
  // Only main_admin can change main_admin credentials
  const targetUser = await db.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
  if (targetUser && targetUser.role === 'main_admin' && caller.role !== 'main_admin') {
    return c.json({ error: 'Только главный администратор может менять свои учётные данные' }, 403);
  }
  
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

}
