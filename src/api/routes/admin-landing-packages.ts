/**
 * Admin Landing Packages API — CRUD for the «Пакеты лендинга» section
 * (3 marketing cards on /home + detail pages /package/:slug).
 *
 * NOT to be confused with `calculator_packages` (calculator bundles)
 * or `site_blocks` (CMS text blocks). This is a dedicated admin-managed
 * marketing tile system.
 *
 * Image uploads reuse the shared `/api/admin/upload-image` route in
 * `admin-site-blocks.ts` — admin uploads first, then sends `cover_url`
 * (the `/api/media/...` URL) as part of POST/PUT body.
 */
import { Hono } from 'hono'

type Bindings = { DB: D1Database; MEDIA: R2Bucket }

// Slug whitelist: lowercase letters, digits, hyphen. Length 1..80.
function isValidSlug(s: string): boolean {
  return typeof s === 'string' && /^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$/.test(s)
}

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: any) {
  // List all packages (admin sees all, including hidden)
  api.get('/landing-packages', authMiddleware, async (c) => {
    const db = c.env.DB
    const rows = await db.prepare(
      'SELECT id, slug, title_ru, title_am, description_ru, description_am, price_text_ru, price_text_am, cover_url, sort_order, is_visible, created_at, updated_at FROM landing_packages ORDER BY sort_order, id'
    ).all()
    return c.json(rows.results || [])
  })

  // Single package
  api.get('/landing-packages/:id', authMiddleware, async (c) => {
    const db = c.env.DB
    const id = c.req.param('id')
    const row = await db.prepare('SELECT * FROM landing_packages WHERE id = ?').bind(id).first()
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json(row)
  })

  // Create
  api.post('/landing-packages', authMiddleware, async (c) => {
    const db = c.env.DB
    const body = await c.req.json().catch(() => ({}))
    const {
      slug,
      title_ru,
      title_am,
      description_ru,
      description_am,
      price_text_ru,
      price_text_am,
      cover_url,
      sort_order,
      is_visible,
    } = body || {}

    if (!slug || !title_ru) {
      return c.json({ error: 'slug and title_ru required' }, 400)
    }
    if (!isValidSlug(slug)) {
      return c.json({ error: 'Invalid slug. Use lowercase letters, digits and hyphens (1-80 chars).' }, 400)
    }
    const existing = await db.prepare('SELECT id FROM landing_packages WHERE slug = ?').bind(slug).first()
    if (existing) return c.json({ error: 'Slug already exists' }, 409)

    await db.prepare(
      `INSERT INTO landing_packages
        (slug, title_ru, title_am, description_ru, description_am, price_text_ru, price_text_am, cover_url, sort_order, is_visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      slug,
      String(title_ru),
      String(title_am || ''),
      String(description_ru || ''),
      String(description_am || ''),
      String(price_text_ru || ''),
      String(price_text_am || ''),
      String(cover_url || ''),
      Number(sort_order) || 0,
      is_visible === 0 ? 0 : 1,
    ).run()
    const row = await db.prepare('SELECT * FROM landing_packages ORDER BY id DESC LIMIT 1').first()
    return c.json({ success: true, package: row })
  })

  // Update
  api.put('/landing-packages/:id', authMiddleware, async (c) => {
    const db = c.env.DB
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const {
      slug,
      title_ru,
      title_am,
      description_ru,
      description_am,
      price_text_ru,
      price_text_am,
      cover_url,
      sort_order,
      is_visible,
    } = body || {}

    if (slug && !isValidSlug(slug)) {
      return c.json({ error: 'Invalid slug. Use lowercase letters, digits and hyphens (1-80 chars).' }, 400)
    }
    if (slug) {
      const existing = await db.prepare('SELECT id FROM landing_packages WHERE slug = ? AND id != ?')
        .bind(slug, id).first()
      if (existing) return c.json({ error: 'Slug already exists' }, 409)
    }

    await db.prepare(
      `UPDATE landing_packages
       SET slug = COALESCE(?, slug),
           title_ru = ?,
           title_am = ?,
           description_ru = ?,
           description_am = ?,
           price_text_ru = ?,
           price_text_am = ?,
           cover_url = ?,
           sort_order = ?,
           is_visible = ?,
           updated_at = strftime('%s','now')
       WHERE id = ?`
    ).bind(
      slug || null,
      String(title_ru || ''),
      String(title_am || ''),
      String(description_ru || ''),
      String(description_am || ''),
      String(price_text_ru || ''),
      String(price_text_am || ''),
      String(cover_url || ''),
      Number(sort_order) || 0,
      is_visible === 0 ? 0 : 1,
      id,
    ).run()
    return c.json({ success: true })
  })

  // Toggle visibility (lightweight endpoint, mirrors blog publish)
  api.post('/landing-packages/:id/visibility', authMiddleware, async (c) => {
    const db = c.env.DB
    const id = c.req.param('id')
    const { is_visible } = await c.req.json().catch(() => ({}))
    await db.prepare(
      "UPDATE landing_packages SET is_visible = ?, updated_at = strftime('%s','now') WHERE id = ?"
    ).bind(is_visible ? 1 : 0, id).run()
    return c.json({ success: true })
  })

  // Reorder (mirror of blog reorder)
  api.post('/landing-packages/reorder', authMiddleware, async (c) => {
    const db = c.env.DB
    const { order } = await c.req.json().catch(() => ({})) as { order?: Array<{ id: number; sort_order: number }> }
    if (!Array.isArray(order)) return c.json({ error: 'order array required' }, 400)
    for (const item of order) {
      await db.prepare('UPDATE landing_packages SET sort_order = ? WHERE id = ?')
        .bind(Number(item.sort_order) || 0, Number(item.id)).run()
    }
    return c.json({ success: true })
  })

  // Delete
  api.delete('/landing-packages/:id', authMiddleware, async (c) => {
    const db = c.env.DB
    const id = c.req.param('id')
    await db.prepare('DELETE FROM landing_packages WHERE id = ?').bind(id).run()
    return c.json({ success: true })
  })
}
