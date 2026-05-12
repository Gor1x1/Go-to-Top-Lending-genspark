/**
 * Admin API — Text Overrides + Custom Blocks (Phase 5.1)
 *
 * Powers the inline visual editor's ability to edit ANY text on the site
 * (not just CMS-backed `tb()` calls) and to add brand-new blocks via the
 * "+ Добавить блок" UI.
 *
 * Tables:
 *   - site_text_overrides — page+txt_id keyed text/href overrides
 *   - site_custom_blocks  — admin-added blocks rendered after a target block
 */
import { Hono } from 'hono'

type Bindings = { DB: D1Database; MEDIA: R2Bucket }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: AuthMiddleware) {

  // ─────────────────── TEXT OVERRIDES ────────────────────────────────────────

  // List all overrides for a page (admin)
  api.get('/text-overrides', authMiddleware, async (c) => {
    const db = c.env.DB;
    const page = c.req.query('page') || '';
    let stmt = page
      ? db.prepare('SELECT * FROM site_text_overrides WHERE page = ? ORDER BY id DESC').bind(page)
      : db.prepare('SELECT * FROM site_text_overrides ORDER BY id DESC');
    const res = await stmt.all();
    return c.json({ overrides: res.results || [] });
  });

  // Upsert a single override (admin)
  api.put('/text-overrides', authMiddleware, async (c) => {
    const db = c.env.DB;
    const d = await c.req.json();
    if (!d.page || !d.txt_id) return c.json({ error: 'page and txt_id required' }, 400);
    const text_ru = typeof d.text_ru === 'string' ? d.text_ru : '';
    const text_am = typeof d.text_am === 'string' ? d.text_am : '';
    const href = typeof d.href === 'string' ? d.href : '';
    await db.prepare(
      `INSERT INTO site_text_overrides (page, txt_id, text_ru, text_am, href, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(page, txt_id) DO UPDATE SET
         text_ru = excluded.text_ru,
         text_am = excluded.text_am,
         href = excluded.href,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(d.page, d.txt_id, text_ru, text_am, href).run();
    return c.json({ success: true });
  });

  // Bulk upsert (admin) — used by editor.js "Save all"
  api.post('/text-overrides/bulk', authMiddleware, async (c) => {
    const db = c.env.DB;
    const { items } = await c.req.json();
    if (!Array.isArray(items)) return c.json({ error: 'items array required' }, 400);
    let saved = 0;
    let skipped = 0;
    // Phase 5.1.6: surface row-level failures instead of silently swallowing
    // them. Previously the catch block ate every SQLite error and returned
    // `{ success: true, saved: < items.length }`, so the inline editor cleared
    // pendingOverrides and the admin lost edits without any UI signal.
    const errors: Array<{ txt_id: string; page: string; error: string }> = [];
    for (const it of items) {
      if (!it || !it.page || !it.txt_id) { skipped++; continue; }
      try {
        await db.prepare(
          `INSERT INTO site_text_overrides (page, txt_id, text_ru, text_am, href, updated_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(page, txt_id) DO UPDATE SET
             text_ru = excluded.text_ru,
             text_am = excluded.text_am,
             href = excluded.href,
             updated_at = CURRENT_TIMESTAMP`
        ).bind(it.page, it.txt_id, it.text_ru || '', it.text_am || '', it.href || '').run();
        saved++;
      } catch (e: any) {
        errors.push({ txt_id: String(it.txt_id), page: String(it.page), error: String(e?.message || e) });
      }
    }
    // success === full pass-through (every well-formed item written).
    // Partial writes return success:false so editor.js keeps pendingOverrides
    // for the failed txt_ids and can retry on the next "Сохранить всё".
    const okAll = errors.length === 0;
    return c.json({ success: okAll, saved, skipped, errors });
  });

  // Delete an override (admin) — useful for "reset to original"
  api.delete('/text-overrides/:id', authMiddleware, async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    await db.prepare('DELETE FROM site_text_overrides WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  });

  // Phase 5.1.4: bulk-delete by txt_id prefix. Used to wipe stale `__order__*`
  // rows that were saved by the previous (broken) drag-drop reorder feature.
  // Admin-protected so it can't be abused.
  api.post('/text-overrides/cleanup-prefix', authMiddleware, async (c) => {
    try {
      const { prefix } = await c.req.json();
      if (!prefix || typeof prefix !== 'string' || prefix.length < 3) {
        return c.json({ error: 'prefix required (min 3 chars)' }, 400);
      }
      const res = await c.env.DB.prepare(
        'DELETE FROM site_text_overrides WHERE txt_id LIKE ?'
      ).bind(prefix + '%').run();
      return c.json({ success: true, deleted: (res as any).meta?.changes ?? 0 });
    } catch (e: any) {
      return c.json({ error: String(e?.message || e) }, 500);
    }
  });

  // ─────────────────── CUSTOM BLOCKS ─────────────────────────────────────────

  // List custom blocks for a page (admin)
  api.get('/custom-blocks', authMiddleware, async (c) => {
    const db = c.env.DB;
    const page = c.req.query('page') || '';
    const stmt = page
      ? db.prepare('SELECT * FROM site_custom_blocks WHERE page = ? ORDER BY sort_order, id').bind(page)
      : db.prepare('SELECT * FROM site_custom_blocks ORDER BY page, sort_order, id');
    const res = await stmt.all();
    return c.json({ blocks: res.results || [] });
  });

  // Create custom block (admin) — called by editor.js "+ Добавить блок"
  api.post('/custom-blocks', authMiddleware, async (c) => {
    const db = c.env.DB;
    const d = await c.req.json();
    if (!d.page) return c.json({ error: 'page required' }, 400);
    const result = await db.prepare(
      `INSERT INTO site_custom_blocks
       (page, position_after, title_ru, title_am, text_ru, text_am,
        button_text_ru, button_text_am, button_url, is_visible, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      d.page,
      d.position_after || '',
      d.title_ru || 'Новый блок',
      d.title_am || 'Նոր բլոկ',
      d.text_ru || 'Описание блока. Редактируйте в режиме редактирования.',
      d.text_am || 'Բլոկի նկարագրություն։',
      d.button_text_ru || '',
      d.button_text_am || '',
      d.button_url || '',
      d.is_visible !== false ? 1 : 0,
      d.sort_order || 999
    ).run();
    return c.json({ success: true, id: (result as any).meta?.last_row_id });
  });

  // Update custom block (admin)
  api.put('/custom-blocks/:id', authMiddleware, async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    const d = await c.req.json();
    const fields: string[] = [];
    const vals: any[] = [];
    const allowed = ['position_after','title_ru','title_am','text_ru','text_am',
                     'button_text_ru','button_text_am','button_url','is_visible','sort_order'];
    for (const k of allowed) {
      if (d[k] !== undefined) {
        fields.push(`${k} = ?`);
        vals.push(k === 'is_visible' ? (d[k] ? 1 : 0) : d[k]);
      }
    }
    if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
    fields.push('updated_at = CURRENT_TIMESTAMP');
    vals.push(id);
    await db.prepare(`UPDATE site_custom_blocks SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
    return c.json({ success: true });
  });

  // Delete custom block (admin)
  api.delete('/custom-blocks/:id', authMiddleware, async (c) => {
    const db = c.env.DB;
    const id = c.req.param('id');
    await db.prepare('DELETE FROM site_custom_blocks WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  });
}
