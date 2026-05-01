/**
 * Admin Blog API — CRUD for blog posts and categories
 */
import { Hono } from 'hono'

type Bindings = { DB: D1Database; MEDIA: R2Bucket }

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: any) {
  // ===== BLOG CATEGORIES =====
  api.get('/blog-categories', authMiddleware, async (c) => {
    const db = c.env.DB;
    const rows = await db.prepare('SELECT * FROM blog_categories ORDER BY sort_order, id').all();
    return c.json(rows.results || []);
  });

  api.post('/blog-categories', authMiddleware, async (c) => {
    const db = c.env.DB;
    const { slug, name_ru, name_am, sort_order } = await c.req.json();
    if (!slug || !name_ru) return c.json({ error: 'slug and name_ru required' }, 400);
    await db.prepare('INSERT INTO blog_categories (slug, name_ru, name_am, sort_order) VALUES (?,?,?,?)')
      .bind(slug, name_ru, name_am || '', sort_order || 0).run();
    return c.json({ success: true });
  });

  api.put('/blog-categories/:id', authMiddleware, async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    const { slug, name_ru, name_am, sort_order } = await c.req.json();
    await db.prepare('UPDATE blog_categories SET slug=?, name_ru=?, name_am=?, sort_order=? WHERE id=?')
      .bind(slug, name_ru, name_am || '', sort_order || 0, id).run();
    return c.json({ success: true });
  });

  api.delete('/blog-categories/:id', authMiddleware, async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    await db.prepare('UPDATE blog_posts SET category_id = NULL WHERE category_id = ?').bind(id).run();
    await db.prepare('DELETE FROM blog_categories WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  });

  // ===== BLOG POSTS =====
  api.get('/blog-posts', authMiddleware, async (c) => {
    const db = c.env.DB;
    const published = c.req.query('published');
    const categoryId = c.req.query('category_id');
    let q = 'SELECT bp.*, bc.name_ru as category_name_ru, bc.name_am as category_name_am FROM blog_posts bp LEFT JOIN blog_categories bc ON bp.category_id = bc.id WHERE 1=1';
    const binds: any[] = [];
    if (published !== undefined) { q += ' AND bp.published = ?'; binds.push(Number(published)); }
    if (categoryId) { q += ' AND bp.category_id = ?'; binds.push(Number(categoryId)); }
    q += ' ORDER BY bp.sort_order, bp.created_at DESC';
    const stmt = db.prepare(q);
    const rows = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
    return c.json(rows.results || []);
  });

  api.get('/blog-posts/:id', authMiddleware, async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    const row = await db.prepare('SELECT bp.*, bc.name_ru as category_name_ru FROM blog_posts bp LEFT JOIN blog_categories bc ON bp.category_id = bc.id WHERE bp.id = ?').bind(id).first();
    if (!row) return c.json({ error: 'Not found' }, 404);
    return c.json(row);
  });

  api.post('/blog-posts', authMiddleware, async (c) => {
    const db = c.env.DB;
    const body = await c.req.json();
    const { slug, title_ru, title_am, body_ru, body_am, cover_url, category_id, published, sort_order } = body;
    if (!slug || !title_ru) return c.json({ error: 'slug and title_ru required' }, 400);
    // Check slug uniqueness
    const existing = await db.prepare('SELECT id FROM blog_posts WHERE slug = ?').bind(slug).first();
    if (existing) return c.json({ error: 'Slug already exists' }, 400);
    await db.prepare(`INSERT INTO blog_posts (slug, title_ru, title_am, body_ru, body_am, cover_url, category_id, published, sort_order) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(slug, title_ru, title_am || '', body_ru || '', body_am || '', cover_url || '', category_id || null, published ? 1 : 0, sort_order || 0).run();
    const row = await db.prepare('SELECT * FROM blog_posts ORDER BY id DESC LIMIT 1').first();
    return c.json({ success: true, post: row });
  });

  api.put('/blog-posts/:id', authMiddleware, async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    const body = await c.req.json();
    const { slug, title_ru, title_am, body_ru, body_am, cover_url, category_id, published, sort_order } = body;
    // Check slug uniqueness (exclude self)
    if (slug) {
      const existing = await db.prepare('SELECT id FROM blog_posts WHERE slug = ? AND id != ?').bind(slug, id).first();
      if (existing) return c.json({ error: 'Slug already exists' }, 400);
    }
    await db.prepare(`UPDATE blog_posts SET slug=?, title_ru=?, title_am=?, body_ru=?, body_am=?, cover_url=?, category_id=?, published=?, sort_order=?, updated_at=datetime('now') WHERE id=?`)
      .bind(slug, title_ru, title_am || '', body_ru || '', body_am || '', cover_url || '', category_id || null, published ? 1 : 0, sort_order || 0, id).run();
    return c.json({ success: true });
  });

  api.post('/blog-posts/:id/publish', authMiddleware, async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    const { published } = await c.req.json();
    await db.prepare("UPDATE blog_posts SET published=?, updated_at=datetime('now') WHERE id=?").bind(published ? 1 : 0, id).run();
    return c.json({ success: true });
  });

  api.post('/blog-posts/reorder', authMiddleware, async (c) => {
    const db = c.env.DB;
    const { order } = await c.req.json(); // [{id, sort_order}]
    for (const item of order) {
      await db.prepare('UPDATE blog_posts SET sort_order=? WHERE id=?').bind(item.sort_order, item.id).run();
    }
    return c.json({ success: true });
  });

  api.delete('/blog-posts/:id', authMiddleware, async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    await db.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  });
}
