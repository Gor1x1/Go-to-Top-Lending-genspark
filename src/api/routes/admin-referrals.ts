/**
 * Admin API — Referral codes and section order management
 */
import { Hono } from 'hono'

type Bindings = { DB: D1Database }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: AuthMiddleware) {
// ===== REFERRAL CODES =====
api.get('/referrals', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM referral_codes ORDER BY created_at DESC').all();
  // Enrich with paid_uses_count (leads with in_progress/checking/done status)
  const codes = res.results || [];
  try {
    const paidCounts = await db.prepare("SELECT UPPER(referral_code) as ref_code, COUNT(*) as cnt FROM leads WHERE referral_code IS NOT NULL AND referral_code != '' AND status IN ('in_progress','checking','done') GROUP BY UPPER(referral_code)").all();
    const countMap: Record<string, number> = {};
    for (const r of (paidCounts.results || [])) {
      countMap[(r.ref_code as string || '').toUpperCase()] = Number(r.cnt || 0);
    }
    for (const c2 of codes) {
      (c2 as any).paid_uses_count = countMap[((c2 as any).code || '').toUpperCase()] || 0;
    }
  } catch {}
  return c.json(codes);
});

api.post('/referrals', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { code, description, discount_percent, max_uses, apply_to_packages, linked_packages, linked_services, is_active } = await c.req.json();
  await db.prepare('INSERT INTO referral_codes (code, description, discount_percent, max_uses, apply_to_packages, linked_packages, linked_services, is_active) VALUES (?,?,?,?,?,?,?,?)')
    .bind((code || '').trim().toUpperCase(), description || '', discount_percent || 0, max_uses || 0, apply_to_packages ? 1 : 0, JSON.stringify(linked_packages || []), JSON.stringify(linked_services || []), is_active ?? 1).run();
  // Audit log
  try { const caller = c.get('user'); await db.prepare('INSERT INTO audit_log (user_id, user_name, action, entity_type, new_value) VALUES (?,?,?,?,?)').bind(caller?.sub||0, caller?.display_name||'admin', 'referral_create', 'referral_code', code || '').run(); } catch {}
  return c.json({ success: true });
});

api.put('/referrals/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const { code, description, discount_percent, is_active, max_uses, apply_to_packages, linked_packages, linked_services } = await c.req.json();
  // Get old value for audit
  const oldRef = await db.prepare('SELECT * FROM referral_codes WHERE id = ?').bind(id).first();
  await db.prepare('UPDATE referral_codes SET code=?, description=?, discount_percent=?, is_active=?, max_uses=?, apply_to_packages=?, linked_packages=?, linked_services=? WHERE id=?')
    .bind((code || '').trim().toUpperCase(), description || '', discount_percent || 0, is_active ?? 1, max_uses || 0, apply_to_packages ? 1 : 0, JSON.stringify(linked_packages || []), JSON.stringify(linked_services || []), id).run();
  // Audit log
  try { const caller = c.get('user'); await db.prepare('INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, old_value, new_value) VALUES (?,?,?,?,?,?,?)').bind(caller?.sub||0, caller?.display_name||'admin', 'referral_update', 'referral_code', Number(id), JSON.stringify(oldRef || {}), JSON.stringify({code, discount_percent, is_active, max_uses})).run(); } catch {}
  return c.json({ success: true });
});

api.delete('/referrals/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  await db.prepare('DELETE FROM referral_codes WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// Check referral code validity (for lead card)
api.get('/referral-codes/check', authMiddleware, async (c) => {
  const db = c.env.DB;
  const code = c.req.query('code') || '';
  if (!code) return c.json({ valid: false });
  const row = await db.prepare('SELECT * FROM referral_codes WHERE code = ? AND is_active = 1').bind(code).first();
  if (!row) return c.json({ valid: false });
  
  // Load attached services (free + discounted)
  let freeServices: any[] = [];
  let serviceDiscounts: any[] = [];
  try {
    const fsRes = await db.prepare('SELECT rfs.*, cs.name_ru, cs.name_am FROM referral_free_services rfs LEFT JOIN calculator_services cs ON rfs.service_id = cs.id WHERE rfs.referral_code_id = ?').bind(row.id).all();
    // discount_percent=0 or null or undefined or >=100 means fully free; otherwise partial discount
    freeServices = (fsRes.results || []).filter((s: any) => {
      const dp = Number(s.discount_percent);
      return dp === 0 || isNaN(dp) || dp >= 100;
    });
    serviceDiscounts = (fsRes.results || []).filter((s: any) => {
      const dp = Number(s.discount_percent);
      return dp > 0 && dp < 100;
    });
  } catch {}
  
  return c.json({
    valid: true,
    id: row.id,
    code: row.code,
    discount_percent: row.discount_percent || 0,
    description: row.description || '',
    free_services: freeServices,
    service_discounts: serviceDiscounts
  });
});

// ===== REFERRAL SERVICE ATTACHMENTS =====
api.get('/referrals/:id/services', authMiddleware, async (c) => {
  const db = c.env.DB;
  const refId = c.req.param('id');
  const res = await db.prepare('SELECT rfs.*, cs.name_ru, cs.name_am, cs.price FROM referral_free_services rfs LEFT JOIN calculator_services cs ON rfs.service_id = cs.id WHERE rfs.referral_code_id = ?').bind(refId).all();
  return c.json({ services: res.results || [] });
});

api.post('/referrals/:id/services', authMiddleware, async (c) => {
  const db = c.env.DB;
  const refId = c.req.param('id');
  const { service_id, discount_percent, quantity } = await c.req.json();
  await db.prepare('INSERT INTO referral_free_services (referral_code_id, service_id, discount_percent, quantity) VALUES (?,?,?,?)')
    .bind(refId, service_id, discount_percent || 0, quantity || 1).run();
  return c.json({ success: true });
});

api.delete('/referrals/:id/services/:svcId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const svcId = c.req.param('svcId');
  await db.prepare('DELETE FROM referral_free_services WHERE id = ?').bind(svcId).run();
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

api.put('/section-order', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { orders } = await c.req.json();
  // orders = [{section_id, sort_order}]
  if (orders && Array.isArray(orders)) {
    for (const o of orders) {
      await db.prepare('UPDATE section_order SET sort_order = ? WHERE section_id = ?').bind(o.sort_order, o.section_id).run();
    }
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
    { id: 'fifty-vs-fifty', order: 7, ru: '50K: Блогер vs Выкупы', am: '50K: Бdelays' },
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
}
