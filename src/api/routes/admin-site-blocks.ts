/**
 * Admin API — Site blocks constructor, import, sync, image upload/serving
 *
 * Phase 4 additions:
 *   - History/restore: every UPDATE/DELETE writes a JSON snapshot to
 *     `site_blocks_history` so admins can roll back. List + restore
 *     endpoints below.
 *   - Bulk actions: bulk visibility toggle / bulk delete / move blocks
 *     between pages (renames the `<page>__` prefix in `block_key`).
 *   - Export / Import: full JSON dump for backup, idempotent INSERT OR
 *     REPLACE on import (matches by `block_key`).
 *   - Pro seed: massively extended `seed-subpages` payload now covers
 *     home / calculator / package / shell / blog chrome on top of the
 *     existing 6 subpages — so the admin "Управление сайтом" can edit
 *     literally every visible string and button label on the site.
 */
import { Hono } from 'hono'
import { SEED_CONTENT_SECTIONS } from '../../seed-data'
type Bindings = { DB: D1Database; MEDIA: R2Bucket }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

// ---------------------------------------------------------------------
// History helper — saves a JSON snapshot of a block right BEFORE every
// update/delete so admins can restore via the new "История" UI. Trims
// per-block history to the latest 200 entries.
// ---------------------------------------------------------------------
async function recordBlockHistory(
  db: D1Database,
  blockId: number | string,
  action: 'update' | 'delete' | 'restore',
  user: { id?: number | null; name?: string } = {}
): Promise<void> {
  try {
    const existing = await db.prepare('SELECT * FROM site_blocks WHERE id = ?').bind(blockId).first()
    if (!existing) return
    const snapshot = JSON.stringify(existing)
    await db.prepare(
      'INSERT INTO site_blocks_history (block_id, block_key, snapshot, action, user_id, user_name) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      Number(blockId), String(existing.block_key || ''), snapshot, action,
      user.id ?? null, user.name ?? ''
    ).run()
    // Trim history per block to the most recent 200 entries.
    await db.prepare(
      "DELETE FROM site_blocks_history WHERE block_id = ? AND id NOT IN (SELECT id FROM site_blocks_history WHERE block_id = ? ORDER BY id DESC LIMIT 200)"
    ).bind(Number(blockId), Number(blockId)).run()
  } catch (e) {
    // History is best-effort — never block the actual mutation.
  }
}

function getActorFromContext(c: any): { id?: number | null; name?: string } {
  try {
    const user = c.get('user')
    if (!user) return {}
    return {
      id: user.user_id ?? user.id ?? null,
      name: user.username || user.display_name || user.name || ''
    }
  } catch {
    return {}
  }
}

export function register(api: Hono<{ Bindings: Bindings }>, authMiddleware: AuthMiddleware) {
// ===== SITE BLOCKS (unified block constructor) =====
api.get('/site-blocks', authMiddleware, async (c) => {
  const db = c.env.DB;
  // Ensure text_styles column exists
  try { await db.prepare("ALTER TABLE site_blocks ADD COLUMN text_styles TEXT DEFAULT '[]'").run(); } catch {}
  try { await db.prepare("ALTER TABLE site_blocks ADD COLUMN photo_url TEXT DEFAULT ''").run(); } catch {}
  const res = await db.prepare('SELECT * FROM site_blocks ORDER BY sort_order').all();
  const blocks = (res.results || []).map((b: any) => ({
    ...b,
    texts_ru: JSON.parse(b.texts_ru || '[]'),
    texts_am: JSON.parse(b.texts_am || '[]'),
    images: JSON.parse(b.images || '[]'),
    buttons: JSON.parse(b.buttons || '[]'),
    social_links: b.social_links || '[]',
    text_styles: JSON.parse(b.text_styles || '[]'),
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
  // Phase 4: capture pre-update snapshot for history (best-effort, never blocks).
  await recordBlockHistory(db, id, 'update', getActorFromContext(c));
  const fields: string[] = [];
  const vals: any[] = [];
  if (d.block_key !== undefined) { fields.push('block_key=?'); vals.push(d.block_key); }
  if (d.block_type !== undefined) { fields.push('block_type=?'); vals.push(d.block_type); }
  if (d.title_ru !== undefined) { fields.push('title_ru=?'); vals.push(d.title_ru); }
  if (d.title_am !== undefined) { fields.push('title_am=?'); vals.push(d.title_am); }
  if (d.texts_ru !== undefined) { fields.push('texts_ru=?'); vals.push(typeof d.texts_ru === 'string' ? d.texts_ru : JSON.stringify(d.texts_ru)); }
  if (d.texts_am !== undefined) { fields.push('texts_am=?'); vals.push(typeof d.texts_am === 'string' ? d.texts_am : JSON.stringify(d.texts_am)); }
  if (d.images !== undefined) { fields.push('images=?'); vals.push(typeof d.images === 'string' ? d.images : JSON.stringify(d.images)); }
  if (d.buttons !== undefined) { fields.push('buttons=?'); vals.push(typeof d.buttons === 'string' ? d.buttons : JSON.stringify(d.buttons)); }
  if (d.custom_css !== undefined) { fields.push('custom_css=?'); vals.push(d.custom_css); }
  if (d.custom_html !== undefined) { fields.push('custom_html=?'); vals.push(d.custom_html); }
  if (d.is_visible !== undefined) { fields.push('is_visible=?'); vals.push(d.is_visible ? 1 : 0); }
  if (d.sort_order !== undefined) { fields.push('sort_order=?'); vals.push(d.sort_order); }
  if (d.social_links !== undefined) { 
    fields.push('social_links=?'); 
    // Prevent double-encoding: if it's already a string, validate it's proper JSON array
    let slVal = d.social_links;
    if (typeof slVal === 'string') {
      try { const parsed = JSON.parse(slVal); slVal = JSON.stringify(Array.isArray(parsed) ? parsed : []); } catch { slVal = '[]'; }
    } else {
      slVal = JSON.stringify(Array.isArray(slVal) ? slVal : []);
    }
    vals.push(slVal);
  }
  if (d.text_styles !== undefined) {
    fields.push('text_styles=?');
    vals.push(typeof d.text_styles === 'string' ? d.text_styles : JSON.stringify(d.text_styles || []));
  }
  if (d.photo_url !== undefined) { fields.push('photo_url=?'); vals.push(d.photo_url); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(id);
  await db.prepare(`UPDATE site_blocks SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return c.json({ success: true });
});

api.delete('/site-blocks/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  // Phase 4: snapshot the row before deletion so admin can restore it.
  await recordBlockHistory(db, id, 'delete', getActorFromContext(c));
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

// ===== IMPORT BLOCKS FROM SITE (populate site_blocks from seed data + DB) =====
api.post('/site-blocks/import-from-site', authMiddleware, async (c) => {
  const db = c.env.DB;
  
  // Button mapping: section_key -> array of buttons with urls/messages from seed TG messages
  // Map button labels to their TG message data
  const tgMsgMap: Record<string, any> = {};
  for (const tm of SEED_TG_MESSAGES) {
    tgMsgMap[tm.labelRu] = tm;
  }
  
  // Define which sections have which CTA buttons (mirrors the actual HTML structure)
  // Armenian labels are resolved from tgMsgMap at runtime, these are fallbacks only
  const sectionButtons: Record<string, {text_ru: string, text_am: string, icon: string}[]> = {
    'hero': [
      {text_ru: 'Написать в Telegram', text_am: 'Գրել Telegram-ով', icon: 'fab fa-telegram'},
      {text_ru: 'Рассчитать стоимость', text_am: 'Հաशvel arjequn', icon: 'fas fa-calculator'}
    ],
    'wb_banner': [{text_ru: 'Узнать', text_am: 'Իմananal', icon: 'fas fa-arrow-right'}],
    'about': [{text_ru: 'Заказать сейчас', text_am: 'Պatvirel hima', icon: 'fas fa-shopping-cart'}],
    'services': [
      {text_ru: 'Начать продвижение', text_am: 'Սksel arachkhaghatsum', icon: 'fas fa-rocket'},
      {text_ru: 'Заказать съёмку', text_am: 'Պatvirel lusankar', icon: 'fas fa-camera'}
    ],
    'buyout_detail': [
      {text_ru: 'Начать выкупы сейчас', text_am: 'Սksel gnumnere', icon: 'fas fa-shopping-bag'},
      {text_ru: 'Получить индивидуальный расчёт', text_am: 'Ստandsanal hashvark', icon: 'fas fa-calculator'}
    ],
    'why_buyouts': [{text_ru: 'Начать выкупы', text_am: 'Սksel gnumnere', icon: 'fas fa-fire'}],
    'fifty_vs_fifty': [{text_ru: 'Начать выкупы по ключевикам', text_am: 'Սksel gnumnere banali barerov', icon: 'fas fa-fire'}],
    'wb_official': [{text_ru: 'Занять ТОП прямо сейчас', text_am: 'Զbaghetsnel TOP hima', icon: 'fas fa-rocket'}],
    'process': [{text_ru: 'Написать менеджеру', text_am: 'Գrel menedzherin', icon: 'fab fa-telegram'}],
    'warehouse': [{text_ru: 'Заказать сейчас', text_am: 'Պatvirel hima', icon: 'fas fa-shopping-cart'}],
    'guarantee': [{text_ru: 'Начать продвижение', text_am: 'Սksel arachkhaghatsum', icon: 'fas fa-rocket'}],
    'comparison': [{text_ru: 'Убедитесь сами — начните сейчас', text_am: 'Համozvek — sksel hima', icon: 'fas fa-rocket'}],
    'important': [{text_ru: 'Уточнить условия', text_am: 'Shtkel paymannere', icon: 'fab fa-telegram'}],
    'faq': [{text_ru: 'Остались вопросы? Напишите нам', text_am: 'Hartser uneq? Greq mez', icon: 'fas fa-comment-dots'}],
    'client_reviews': [{text_ru: 'Начать сейчас', text_am: 'Սկսել հիմա', icon: 'fab fa-whatsapp'}],
    'contact': [{text_ru: 'Отправить заявку', text_am: 'Ughарkel hayty', icon: 'fas fa-paper-plane'}],
    'floating_tg': [{text_ru: 'Написать нам', text_am: 'Гrel mez', icon: 'fab fa-telegram'}],
    'popup': [{text_ru: 'Получить расчёт в Telegram', text_am: 'Ստandsanal hashvark Telegram-ov', icon: 'fab fa-telegram'}],
    'calculator': [{text_ru: 'Заказать в Telegram', text_am: 'Պատվիրել հիմա', icon: 'fab fa-telegram'}]
  };
  
  // Load section order for visibility
  const orderRes = await db.prepare('SELECT * FROM section_order ORDER BY sort_order').all();
  const orderMap: Record<string, any> = {};
  for (const o of (orderRes.results || [])) {
    orderMap[o.section_id as string] = o;
  }
  
  // Load existing DB content (may have edits)
  const contentRes = await db.prepare('SELECT * FROM site_content ORDER BY sort_order').all();
  const dbContentMap: Record<string, any[]> = {};
  for (const row of (contentRes.results || [])) {
    try { dbContentMap[row.section_key as string] = JSON.parse(row.content_json as string); } catch { dbContentMap[row.section_key as string] = []; }
  }
  
  // Load TG messages from DB
  const tgRes = await db.prepare('SELECT * FROM telegram_messages ORDER BY sort_order').all();
  const dbTgMessages: Record<string, any> = {};
  for (const row of (tgRes.results || [])) {
    dbTgMessages[row.button_key as string] = row;
    // Also index by label for matching
    dbTgMessages['label:' + (row.button_label_ru as string)] = row;
  }
  
  // Load existing site_blocks BEFORE clearing — to preserve photos, buttons, custom settings
  const existingBlocksRes = await db.prepare('SELECT * FROM site_blocks ORDER BY sort_order').all();
  const existingBlockMap: Record<string, any> = {};
  for (const eblk of (existingBlocksRes.results || [])) {
    existingBlockMap[eblk.block_key as string] = eblk;
  }
  
  // Clear existing site_blocks BUT preserve subpage blocks (block_key like '<page>__<key>').
  // Phase 3C soft-enforcement: subpage blocks live in the same table; reimport must not wipe them.
  await db.prepare("DELETE FROM site_blocks WHERE block_key NOT LIKE '%\\_\\_%' ESCAPE '\\'").run();
  
  // Create blocks from SEED_CONTENT_SECTIONS (mirrors exact site order)
  let sortIdx = 0;
  for (const seedSec of SEED_CONTENT_SECTIONS) {
    const key = seedSec.key;
    const name = seedSec.name;
    
    // Use DB content if available (may have admin edits), fallback to seed
    const dbItems = dbContentMap[key] || [];
    const seedItems = seedSec.items;
    const useItems = dbItems.length >= seedItems.length ? dbItems : seedItems;
    
    // Build buttons array first (need to know button labels to exclude from texts)
    const buttons: any[] = [];
    const secBtns = sectionButtons[key] || [];
    // Collect button text labels to exclude from texts
    const btnTextLabels = new Set(secBtns.map((b: any) => b.text_ru.trim()));
    
    const textsRu: string[] = [];
    const textsAm: string[] = [];
    
    // For calculator block: only store 6 structural texts (title, subtitle, description, total, promo, apply)
    // The remaining texts (tab names, service names, prices) are managed via site_content + calculator_tabs/services
    if (key === 'calculator') {
      // Calculator structural text defaults (matching positions used by admin panel & client)
      const calcDefaults = [
        { ru: 'Калькулятор', am: 'Հաշվիչ' },
        { ru: 'Рассчитайте стоимость услуг', am: 'Հաշվեք ծառայությունների արժեքը' },
        { ru: 'Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram.', am: 'Ընտրեք անհրաժեշտ ծառայությունները, նշեք քանակը և իմացեք գումարը: Պատվերը ձևակերպվում է Telegram-ով:' },
        { ru: 'Итого:', am: 'Ընդամենը:' },
        { ru: 'Есть промокод?', am: 'Պրոմոկոդ ունեք?' },
        { ru: 'Применить', am: 'Կիրառել' },
        { ru: 'Скачать расчёт (PDF)', am: 'Ներբեռնել հաշվարկ (PDF)' },
        { ru: 'Имя', am: 'Անուն' },
        { ru: 'Телефон', am: 'Հեռախոս' },
        { ru: 'Скачать КП (PDF)', am: 'Ներբեռնել ԿԱ (PDF)' }
      ];
      for (const cd of calcDefaults) {
        // Try to find updated text from DB items (by exact match on original ru)
        const dbMatch = useItems.find((it: any) => (it as any).ru === cd.ru);
        textsRu.push(dbMatch ? (dbMatch as any).ru : cd.ru);
        textsAm.push(dbMatch ? (dbMatch as any).am : cd.am);
      }
    } else {
      for (let ti = 0; ti < useItems.length; ti++) {
        const ruText = (useItems[ti] as any).ru || '';
        const amText = (useItems[ti] as any).am || '';
        // Skip items that match button labels (they belong in buttons, not texts)
        if (btnTextLabels.has(ruText.trim())) continue;
        textsRu.push(ruText);
        textsAm.push(amText);
      }
    }
    
    for (const btnDef of secBtns) {
      const tgMsg = tgMsgMap[btnDef.text_ru] || {};
      const dbTg = dbTgMessages['label:' + btnDef.text_ru] || {};
      buttons.push({
        text_ru: dbTg.button_label_ru || tgMsg.labelRu || btnDef.text_ru,
        text_am: dbTg.button_label_am || tgMsg.labelAm || btnDef.text_am,
        url: dbTg.telegram_url || tgMsg.url || 'https://t.me/goo_to_top',
        icon: btnDef.icon || 'fas fa-arrow-right',
        action_type: 'telegram',
        message_ru: dbTg.message_template_ru || tgMsg.msgRu || '',
        message_am: dbTg.message_template_am || tgMsg.msgAm || ''
      });
    }
    
    const order = orderMap[key];
    const isVisible = order ? (order.is_visible === 1 || order.is_visible === true) : true;
    const titleAm = order?.label_am || '';
    
    // Determine block type
    let blockType = 'section';
    if (key === 'nav') blockType = 'navigation';
    else if (key === 'hero') blockType = 'hero';
    else if (key === 'ticker') blockType = 'ticker';
    else if (key === 'calculator') blockType = 'calculator';
    else if (key === 'footer') blockType = 'footer';
    else if (key === 'floating_tg') blockType = 'floating';
    else if (key === 'popup') blockType = 'popup';
    else if (key === 'stats_bar') blockType = 'stats';
    else if (key === 'wb_banner') blockType = 'banner';
    else if (key === 'client_reviews' || key === 'client-reviews') blockType = 'reviews';
    
    // For ticker blocks, store icons in images array
    let images: any[] = [];
    if (key === 'ticker') {
      images = (seedSec.items as any[]).map((it: any) => it.icon || 'fa-check-circle');
    }
    
    // Default social links for footer block
    let socialLinks: any[] = [];
    if (key === 'footer') {
      socialLinks = [
        { type: 'instagram', url: 'https://instagram.com/gototopwb.ru' },
        { type: 'facebook', url: 'https://facebook.com/gototopwb.ru' },
        { type: 'telegram', url: 'https://t.me/goo_to_top' },
        { type: 'tiktok', url: 'https://tiktok.com/@gototopwb.ru' }
      ];
    }
    
    // Auto-detect photos for known blocks (from original HTML structure)
    // IMPORTANT: Preserve existing photos from database if block already existed
    let customHtml: Record<string, any> = {};
    const photoMap: Record<string, { photo_url: string, photos: any[], show_photos?: boolean }> = {
      'hero': { photo_url: '/static/img/founder.jpg', photos: [] },
      'about': { photo_url: '/static/img/about-hero2.jpg', photos: [] },
      'warehouse': { photo_url: '', photos: [
        { url: '/static/img/warehouse1.jpg', caption: 'Склад Ереван' },
        { url: '/static/img/warehouse2.jpg', caption: 'Рабочее пространство' }
      ]},
      'client_reviews': { photo_url: '', photos: [], show_photos: true },
    };
    
    // Try to preserve existing block data (photos, buttons, custom settings) from DB
    const existingBlock = existingBlockMap[key];
    if (existingBlock) {
      try {
        const existOpts = JSON.parse(existingBlock.custom_html as string || '{}');
        // Preserve ALL existing custom_html if it has meaningful settings (photos, photo_url, show_slots, etc.)
        // NOTE: existOpts.photo_url is included so a custom main photo set via admin isn't lost on re-import.
        if ((existOpts.photos && existOpts.photos.length > 0) || existOpts.photo_url || existOpts.show_slots || existOpts.show_photos || existOpts.bg_class) {
          customHtml = existOpts; // Preserve ALL existing custom_html (photos, settings, etc.)
        } else if (photoMap[key]) {
          customHtml = photoMap[key];
        }
        // Preserve existing buttons if the block had user-customized ones
        const existBtns = JSON.parse(existingBlock.buttons as string || '[]');
        if (existBtns.length > 0 && buttons.length === 0) {
          buttons.push(...existBtns);
        }
      } catch(e) {
        if (photoMap[key]) customHtml = photoMap[key];
      }
    } else if (photoMap[key]) {
      customHtml = photoMap[key];
    }
    
    await db.prepare('INSERT INTO site_blocks (block_key, block_type, title_ru, title_am, texts_ru, texts_am, images, buttons, custom_css, custom_html, is_visible, sort_order, social_links) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(key, blockType, name, titleAm, JSON.stringify(textsRu), JSON.stringify(textsAm), JSON.stringify(images), JSON.stringify(buttons), '', JSON.stringify(customHtml), isVisible ? 1 : 0, sortIdx, JSON.stringify(socialLinks)).run();
    sortIdx++;
  }
  
  // Sync telegram_messages from all block buttons so "Быстрые сообщения" tab has data
  await db.prepare('DELETE FROM telegram_messages').run();
  const allNewBlocks = await db.prepare('SELECT * FROM site_blocks ORDER BY sort_order').all();
  let tgSortIdx = 0;
  for (const blk of (allNewBlocks.results || [])) {
    let btns: any[] = [];
    try { btns = JSON.parse(blk.buttons as string || '[]'); } catch { btns = []; }
    for (const btn of btns) {
      if (!btn.text_ru) continue;
      const btnKey = (blk.block_key as string) + '_' + btn.text_ru.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_').substring(0, 30);
      await db.prepare('INSERT INTO telegram_messages (button_key, button_label_ru, button_label_am, telegram_url, message_template_ru, message_template_am, description, sort_order) VALUES (?,?,?,?,?,?,?,?)')
        .bind(btnKey, btn.text_ru || '', btn.text_am || '', btn.url || 'https://t.me/goo_to_top', btn.message_ru || '', btn.message_am || '', 'Блок: ' + (blk.title_ru || blk.block_key), tgSortIdx).run();
      tgSortIdx++;
    }
  }
  
  // Sync slot counters from block settings (show_slots)
  // For each block with show_slots=true in custom_html, ensure a slot_counter exists
  try {
    const importedBlocks = await db.prepare('SELECT * FROM site_blocks ORDER BY sort_order').all();
    const existingCounters = await db.prepare('SELECT * FROM slot_counter ORDER BY id').all();
    const counterPositions = new Set((existingCounters.results || []).map((c: any) => c.position));
    
    for (const blk of (importedBlocks.results || [])) {
      try {
        const opts = JSON.parse(blk.custom_html as string || '{}');
        if (opts.show_slots) {
          const pos = 'in-' + (blk.block_key as string);
          if (!counterPositions.has(pos)) {
            // Create a new counter for this block
            await db.prepare('INSERT INTO slot_counter (counter_name, total_slots, booked_slots, label_ru, label_am, show_timer, reset_day, position) VALUES (?,?,?,?,?,?,?,?)')
              .bind('Счётчик: ' + (blk.block_key as string), 10, 0, 'Свободных мест', '', 1, 'monday', pos).run();
            counterPositions.add(pos);
          }
        }
      } catch(e) { /* skip parse errors */ }
    }
  } catch(e) { /* ignore slot sync errors */ }
  
  // Seed default slot counter if none exist after sync
  const existingSlots = await db.prepare('SELECT COUNT(*) as cnt FROM slot_counter').first().catch(() => ({cnt: 0}));
  if (!(existingSlots as any)?.cnt) {
    await db.prepare('INSERT INTO slot_counter (counter_name, total_slots, booked_slots, label_ru, label_am, show_timer, reset_day, position) VALUES (?,?,?,?,?,?,?,?)')
      .bind('main', 100, 80, 'Свободных мест на этой неделе', 'Ազdelays this week', 1, 'monday', 'after-hero').run();
  }
  
  // Deduplicate section_order: remove duplicate entries where hyphen/underscore variants coexist
  try {
    const allOrder = await db.prepare('SELECT id, section_id FROM section_order ORDER BY sort_order').all();
    const seenNorm: Record<string, number> = {};
    const dupeIds: number[] = [];
    for (const row of (allOrder.results || [])) {
      const norm = (row.section_id as string).replace(/_/g, '-');
      if (seenNorm[norm]) {
        dupeIds.push(row.id as number);
      } else {
        seenNorm[norm] = row.id as number;
      }
    }
    if (dupeIds.length > 0) {
      for (const did of dupeIds) {
        await db.prepare('DELETE FROM section_order WHERE id = ?').bind(did).run();
      }
    }
  } catch(e) { /* ignore dedup errors */ }
  
  return c.json({ success: true, imported: sortIdx, tg_messages: tgSortIdx });
});

// ===== SYNC BLOCK BACK TO SITE CONTENT (for instant site update) =====
api.post('/site-blocks/:id/sync-to-site', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  
  const block = await db.prepare('SELECT * FROM site_blocks WHERE id = ?').bind(id).first();
  if (!block) return c.json({ error: 'Block not found' }, 404);
  
  const blockKey = block.block_key as string;
  const blockType = block.block_type as string;
  
  // For calculator type, sync to calculator_tabs/services
  if (blockType === 'calculator') {
    // Calculator sync is more complex — parse tagged texts
    const textsRu = JSON.parse(block.texts_ru as string || '[]');
    const textsAm = JSON.parse(block.texts_am as string || '[]');
    
    for (let i = 0; i < textsRu.length; i++) {
      const ru = textsRu[i] || '';
      const am = textsAm[i] || '';
      
      // Parse [SVC:tab_key] name — price format
      const svcMatch = ru.match(/^\[SVC:(\w+)\]\s*(.+?)\s*—\s*(\d+)/);
      if (svcMatch) {
        const tabKey = svcMatch[1];
        const nameRu = svcMatch[2];
        const price = parseInt(svcMatch[3]);
        const amSvcMatch = am.match(/^\[SVC:\w+\]\s*(.+?)\s*—/);
        const nameAm = amSvcMatch ? amSvcMatch[1] : '';
        
        // Update service by tab_key + sort position
        const tab = await db.prepare('SELECT id FROM calculator_tabs WHERE tab_key = ?').bind(tabKey).first();
        if (tab) {
          // Find service by name or create
          const existing = await db.prepare('SELECT id FROM calculator_services WHERE tab_id = ? AND name_ru = ?').bind(tab.id, nameRu).first();
          if (existing) {
            await db.prepare('UPDATE calculator_services SET name_am = ?, price = ? WHERE id = ?').bind(nameAm, price, existing.id).run();
          }
        }
      }
      
      // Parse [TAB] name format
      const tabMatch = ru.match(/^\[TAB\]\s*(.+)/);
      if (tabMatch) {
        const tabNameRu = tabMatch[1];
        const amTabMatch = am.match(/^\[TAB\]\s*(.+)/);
        const tabNameAm = amTabMatch ? amTabMatch[1] : '';
        
        await db.prepare('UPDATE calculator_tabs SET name_ru = ?, name_am = ? WHERE name_ru = ?').bind(tabNameRu, tabNameAm, tabNameRu).run();
      }
    }
    return c.json({ success: true, synced: 'calculator' });
  }
  
  // For footer block, sync texts to footer_settings table
  if (blockType === 'footer' || blockKey === 'footer') {
    const fTextsRu = JSON.parse(block.texts_ru as string || '[]');
    const fTextsAm = JSON.parse(block.texts_am as string || '[]');
    // footer texts_ru layout: [0]=brand, [1]=nav_title, [2..N-4]=nav_items, [N-3]=contact_admin, [N-2]=contact_manager, [N-1]=copyright, [N]=location
    // Map: texts_ru[0] → brand_text, last 2 → copyright, location
    const brandRu = fTextsRu[0] || '';
    const brandAm = fTextsAm[0] || '';
    const copyrightRu = fTextsRu.length >= 2 ? (fTextsRu[fTextsRu.length - 2] || '') : '';
    const copyrightAm = fTextsAm.length >= 2 ? (fTextsAm[fTextsAm.length - 2] || '') : '';
    const locationRu = fTextsRu.length >= 1 ? (fTextsRu[fTextsRu.length - 1] || '') : '';
    const locationAm = fTextsAm.length >= 1 ? (fTextsAm[fTextsAm.length - 1] || '') : '';
    
    const fExists = await db.prepare('SELECT id FROM footer_settings LIMIT 1').first();
    if (fExists) {
      await db.prepare('UPDATE footer_settings SET brand_text_ru=?, brand_text_am=?, copyright_ru=?, copyright_am=?, location_ru=?, location_am=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .bind(brandRu, brandAm, copyrightRu, copyrightAm, locationRu, locationAm, fExists.id).run();
    }
    
    // Also sync nav links from footer block to navigation
    // texts_ru[1] = nav title, texts_ru[2..N-4] = nav items
    // Parse custom_html for nav_links targets
    let fOpts: any = {};
    try { fOpts = JSON.parse(block.custom_html as string || '{}'); } catch {}
    const navLinks = fOpts.nav_links || [];
    
    // Update navigation block if it exists
    const navBlock = await db.prepare("SELECT id, texts_ru, texts_am, custom_html FROM site_blocks WHERE block_key = 'nav' LIMIT 1").first();
    if (navBlock) {
      // Footer nav items are at indices 2 to N-4 (between nav_title and contact/copyright/location)
      const navItemsRu = fTextsRu.slice(2, fTextsRu.length - 4);
      const navItemsAm = fTextsAm.slice(2, fTextsAm.length - 4);
      if (navItemsRu.length > 0) {
        await db.prepare('UPDATE site_blocks SET texts_ru=?, texts_am=? WHERE id=?')
          .bind(JSON.stringify(navItemsRu), JSON.stringify(navItemsAm), navBlock.id).run();
      }
    }
  }
  
  // For regular sections, sync to site_content
  const textsRu = JSON.parse(block.texts_ru as string || '[]');
  const textsAm = JSON.parse(block.texts_am as string || '[]');
  
  // Build content_json array of {ru, am} pairs
  const maxLen = Math.max(textsRu.length, textsAm.length);
  const contentItems: {ru: string, am: string}[] = [];
  for (let i = 0; i < maxLen; i++) {
    contentItems.push({
      ru: textsRu[i] || '',
      am: textsAm[i] || ''
    });
  }
  
  // Update or insert into site_content
  const existing = await db.prepare('SELECT id FROM site_content WHERE section_key = ?').bind(blockKey).first();
  if (existing) {
    await db.prepare('UPDATE site_content SET content_json = ?, section_name = ? WHERE section_key = ?')
      .bind(JSON.stringify(contentItems), block.title_ru, blockKey).run();
  } else {
    await db.prepare('INSERT INTO site_content (section_key, section_name, content_json, sort_order) VALUES (?,?,?,?)')
      .bind(blockKey, block.title_ru, JSON.stringify(contentItems), 999).run();
  }
  
  // Also update section_order visibility and labels
  // Try both underscore and hyphen variants since section_order may use either format
  const blockKeyHyphen = blockKey.replace(/_/g, '-');
  const orderExists = await db.prepare('SELECT id FROM section_order WHERE section_id = ? OR section_id = ?').bind(blockKey, blockKeyHyphen).first();
  if (orderExists) {
    const existingId = orderExists.section_id as string;
    await db.prepare('UPDATE section_order SET is_visible = ?, label_ru = ?, label_am = ? WHERE section_id = ?')
      .bind(block.is_visible, block.title_ru, block.title_am, existingId).run();
  } else {
    // Create section_order entry if it doesn't exist (e.g. for copied blocks)
    const sortOrder = block.sort_order || 999;
    await db.prepare('INSERT INTO section_order (section_id, sort_order, is_visible, label_ru, label_am) VALUES (?,?,?,?,?)')
      .bind(blockKeyHyphen, sortOrder, block.is_visible ?? 1, block.title_ru || '', block.title_am || '').run();
  }
  
  // Sync buttons back to telegram_messages
  let btns: any[] = [];
  try { btns = JSON.parse(block.buttons as string || '[]'); } catch {}
  
  // Collect current button labels for this block
  const currentBtnLabels = new Set<string>();
  for (const btn of btns) {
    if (!btn.text_ru) continue;
    currentBtnLabels.add(btn.text_ru.trim());
    const existingTg = await db.prepare('SELECT id FROM telegram_messages WHERE button_label_ru = ?').bind(btn.text_ru).first();
    if (existingTg) {
      await db.prepare('UPDATE telegram_messages SET button_label_am = ?, telegram_url = ?, message_template_ru = ?, message_template_am = ? WHERE id = ?')
        .bind(btn.text_am || '', btn.url || '', btn.message_ru || '', btn.message_am || '', existingTg.id).run();
    }
  }
  
  // Delete telegram_messages that belong to this block but are no longer in the buttons array
  // button_key format: {block_key}_{button_text_sanitized}
  const blockKeyPrefix = blockKey + '_';
  const blockKeyPrefixAlt = blockKey.replace(/-/g, '_') + '_';
  const allTgForBlock = await db.prepare(
    'SELECT id, button_key, button_label_ru FROM telegram_messages WHERE button_key LIKE ? OR button_key LIKE ?'
  ).bind(blockKeyPrefix + '%', blockKeyPrefixAlt + '%').all();
  
  for (const tgMsg of (allTgForBlock.results || [])) {
    const label = (tgMsg.button_label_ru as string || '').trim();
    if (label && !currentBtnLabels.has(label)) {
      // This telegram_message no longer has a matching button in the block — delete it
      await db.prepare('DELETE FROM telegram_messages WHERE id = ?').bind(tgMsg.id).run();
    }
  }
  
  return c.json({ success: true, synced: blockKey });
});

api.post('/site-blocks/duplicate/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const orig = await db.prepare('SELECT * FROM site_blocks WHERE id = ?').bind(id).first();
  if (!orig) return c.json({ error: 'Not found' }, 404);
  const newKey = `${orig.block_key}_copy_${Date.now()}`;
  await db.prepare('INSERT INTO site_blocks (block_key, block_type, title_ru, title_am, texts_ru, texts_am, images, buttons, custom_css, custom_html, is_visible, sort_order, social_links) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(newKey, orig.block_type, orig.title_ru + ' (копия)', orig.title_am, orig.texts_ru, orig.texts_am, orig.images, orig.buttons, orig.custom_css, orig.custom_html, orig.is_visible, (orig.sort_order as number || 0) + 1, orig.social_links || '[]').run();
  
  // Also create section_order entry for the copied block so it appears on the site
  const newKeyHyphen = newKey.replace(/_/g, '-');
  const newSortOrder = (orig.sort_order as number || 0) + 1;
  await db.prepare('INSERT INTO section_order (section_id, sort_order, is_visible, label_ru, label_am) VALUES (?,?,?,?,?)')
    .bind(newKeyHyphen, newSortOrder, orig.is_visible ?? 1, (orig.title_ru || '') + ' (копия)', orig.title_am || '').run();
  
  // Also copy content to site_content
  const origContent = await db.prepare('SELECT * FROM site_content WHERE section_key = ?').bind(orig.block_key).first();
  if (origContent) {
    await db.prepare('INSERT INTO site_content (section_key, section_name, content_json, sort_order) VALUES (?,?,?,?)')
      .bind(newKey, (orig.title_ru || '') + ' (копия)', origContent.content_json, newSortOrder).run();
  }
  
  return c.json({ success: true });
});

// ===== SEED SUBPAGE BLOCKS (Phase 3C) =====
// Idempotent: uses INSERT OR IGNORE on UNIQUE block_key.
// Safe to call multiple times — existing blocks are not touched.
api.post('/site-blocks/seed-subpages', authMiddleware, async (c) => {
  const db = c.env.DB;

  type SubpageBlock = {
    key: string;
    page: string;
    sort: number;
    titleRu: string;
    titleAm: string;
    textsRu: string[];
    textsAm: string[];
  };

  const SUBPAGE_BLOCKS: SubpageBlock[] = [
    // ===== about (sort 100-102) =====
    {
      key: 'about__hero', page: 'about', sort: 100,
      titleRu: 'About: Hero', titleAm: 'Մեր մասին: Hero',
      textsRu: [
        'О компании',
        'О компании',
        'Go to Top',
        'Маркетплейс-агентство из Еревана: продвигаем карточки на Wildberries вживую под ключ — выкупы реальными людьми, отзывы с фото, фотосессии и работа по ключевым запросам. Собственный склад, 1000+ аккаунтов и команда с опытом WB с 2021 года.'
      ],
      textsAm: [
        'Ընկերության մասին',
        'Go to Top-ի մասին',
        'Go to Top',
        'Մարքեթփլեյս գործակալություն Երևանից՝ Wildberries-ի քարտերի ամբողջական առաջխաղացում իրական մարդկանցով։ Գնումներ, լուսանկարներով կարծիքներ, լուսանկարահանումներ և բանալի բառերով աշխատանք։ Սեփական պահեստ, 1000+ հաշիվ և թիմ՝ WB-ի փորձով 2021 թվականից։'
      ]
    },
    {
      key: 'about__cta_strip', page: 'about', sort: 102,
      titleRu: 'About: CTA полоса', titleAm: 'About: CTA',
      // Matches landing.ts:853-859 hardcoded fallbacks (Phase 3C reviewer note).
      textsRu: [
        'Готовы начать?',
        'Откройте калькулятор, напишите в Telegram или закажите обратный звонок — мы подберём пакет под вашу задачу.',
        'Открыть калькулятор'
      ],
      textsAm: [
        'Պատրա՞ստ եք սկսել',
        'Բացեք հաշվիչը, գրեք Telegram-ով կամ պատվիրեք հետադարձ զանգ — մենք կընտրենք փաթեթ ձեր խնդրի համար։',
        'Բացել հաշվիչը'
      ]
    },
    // ===== services (sort 200-201) =====
    {
      key: 'services__hero', page: 'services', sort: 200,
      titleRu: 'Services: Hero', titleAm: 'Services: Hero',
      // Matches landing.ts:1082-1088 hardcoded fallbacks.
      textsRu: [
        'Наши услуги',
        'Услуги',
        'для Wildberries',
        'Выкупы реальными людьми, отзывы с фото и работа по ключевым запросам — полный пакет продвижения карточек на Wildberries. Рассчитайте стоимость в калькуляторе или соберите готовый пакет.'
      ],
      textsAm: [
        'Մեր ծառայությունները',
        'Ծառայություններ',
        'Wildberries-ի համար',
        'Իրական մարդկանցով գնումներ, լուսանկարներով կարծիքներ և բանալի բառերով աշխատանք — Wildberries-ի քարտերի առաջխաղացման ամբողջական փաթեթ։ Հաշվեք արժեքը հաշվիչում կամ ընտրեք պատրաստի փաթեթ։'
      ]
    },
    {
      key: 'services__cta_strip', page: 'services', sort: 201,
      titleRu: 'Services: CTA', titleAm: 'Services: CTA',
      // Matches landing.ts:1403-1409 hardcoded fallbacks.
      textsRu: [
        'Готовы заказать?',
        'Напишите в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов.',
        'Telegram'
      ],
      textsAm: [
        'Պատրա՞ստ եք պատվիրել',
        'Գրեք Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։',
        'Telegram'
      ]
    },
    // ===== buyouts (sort 300-301) =====
    {
      key: 'buyouts__hero', page: 'buyouts', sort: 300,
      titleRu: 'Buyouts: Hero', titleAm: 'Buyouts: Hero',
      // Matches landing.ts:1698-1704 hardcoded fallbacks. Index [2] is the
      // gradient `<span class="gr">` — keep brand 'Wildberries' word here,
      // not a fragment like 'запросам' (otherwise gradient highlights the
      // wrong word visually).
      textsRu: [
        'Услуга выкупа',
        'Выкупы на',
        'Wildberries',
        'Реальные выкупы живыми покупателями по нужным ключевым запросам — ваш товар поднимается в ТОП выдачи WB, закрепляется там и начинает получать органический трафик. Собственный склад и 200+ выкупов в день в Ереване.'
      ],
      textsAm: [
        'Գնումի ծառայություն',
        'Հետագնումներ',
        'Wildberries',
        'Իրական հետագնումներ կենդանի գնորդների կողմից անհրաժեշտ բանալի բառերով — ձեր ապրանքը բարձրանում է WB-ի TOP-ում, ամրապնդվում է այնտեղ և սկսում է ստանալ օրգանական տրաֆիկ։ Սեփական պահեստ և 200+ հետագնում օրական Երևանում։'
      ]
    },
    {
      key: 'buyouts__cta_strip', page: 'buyouts', sort: 301,
      titleRu: 'Buyouts: CTA', titleAm: 'Buyouts: CTA',
      // Matches landing.ts:2069-2075 hardcoded fallbacks.
      textsRu: [
        'Готовы начать выкупы?',
        'Напишите в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов.',
        'Telegram'
      ],
      textsAm: [
        'Պատրա՞ստ եք սկսել գնումները',
        'Գրեք Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։',
        'Telegram'
      ]
    },
    // ===== faq (sort 400-402) =====
    {
      key: 'faq__hero', page: 'faq', sort: 400,
      titleRu: 'FAQ: Hero', titleAm: 'FAQ: Hero',
      textsRu: [
        'FAQ',
        'Часто задаваемые',
        'вопросы',
        'Ответы на ключевые вопросы по выкупам Wildberries: безопасность кабинета, сроки, оплата, документы и легальность. Не нашли ответ — напишите нам в Telegram.'
      ],
      textsAm: [
        'ՀՏՀ',
        'Հաճախ տրվող',
        'հարցեր',
        'Պատասխաններ Wildberries-ի հետագնումների վերաբերյալ հիմնական հարցերին՝ կաբինետի անվտանգություն, ժամկետներ, վճարում, փաստաթղթեր և օրինականություն: Չգտա՞ք պատասխանը — գրեք մեզ Telegram-ով:'
      ]
    },
    {
      key: 'faq__items', page: 'faq', sort: 401,
      titleRu: 'FAQ: Вопросы и ответы (24 строки = 12 пар Q+A)',
      titleAm: 'FAQ: Հարցեր և պատասխաններ',
      // 12 pairs (Q,A) → 24 entries; index [2*i] = question, [2*i+1] = answer.
      textsRu: [
        'Могут ли заблокировать мой кабинет?',
        'За всё время нашей работы ни один кабинет клиента не получил блокировку. Мы используем реальные аккаунты с историей покупок, собственный склад и естественное распределение по географии — алгоритмы WB не отличают такие выкупы от обычных заказов.',
        'Как быстро начнётся продвижение?',
        'В течение 24 часов после согласования стратегии и оплаты. Менеджер составляет план выкупов по ключевым запросам и запускает первые заказы в тот же день.',
        'Выкупы делают реальные люди или боты?',
        'Только реальные люди. У нас собственный склад в Ереване с устройствами и реальными аккаунтами. Каждый выкуп оформляется вручную живым покупателем — никаких ботов и эмуляторов.',
        'Почему не все выкупы получают отзывы?',
        'Для безопасности вашего кабинета мы публикуем отзывы не более чем на 50% выкупленных товаров. Это имитирует естественное поведение покупателей: реальные клиенты тоже не все оставляют отзывы.',
        'Можно ли заказать только отзывы без выкупов?',
        'Да, мы можем выкупить товар для фото- или видеоотзыва и затем сделать возврат на ПВЗ. Стоимость отдельной услуги уточняйте у менеджера в Telegram.',
        'Какие отчёты мы получаем?',
        'Ежедневные отчёты: статус каждого выкупа, даты забора из ПВЗ, статус и тексты отзывов. Полная прозрачность на каждом этапе — вы всегда видите, на каком шаге находится заказ.',
        'В какой валюте идут цены?',
        'Все цены на сайте указаны в армянских драмах (֏ AMD). Принимаем оплату в драмах или рублях по согласованному курсу — детали обсудим перед стартом.',
        'Какие способы оплаты вы принимаете?',
        'Перевод на банковскую карту в RUB или AMD, безналичный расчёт по реквизитам компании, наличными в офисе в Ереване. Конкретный вариант согласуем в Telegram перед запуском.',
        'Что если выкупы не дадут результата?',
        'Мы не обещаем конкретные позиции в выдаче — на ранжирование влияют карточка, ниша, сезон, конкуренция. Но гарантируем выполнение оговорённого объёма выкупов с реальными отзывами и прозрачной отчётностью. На практике 9 из 10 клиентов возвращаются за повторными пакетами.',
        'Сколько по времени занимает один пакет?',
        'Стандартный пакет из 25–50 выкупов выполняем за 5–7 дней — этот темп выглядит для алгоритмов WB естественно и не вызывает подозрений. Большие объёмы разбиваем на несколько недель по согласованному графику.',
        'Подписываете ли вы договор и выдаёте ли документы?',
        'Да. Мы официальная компания, зарегистрированная в Армении: работаем по договору с актами выполненных работ. По запросу выставляем счёт в RUB или AMD. Все документы предоставляем до старта работ.',
        'Это законно? Не нарушаю ли я правила Wildberries?',
        'Wildberries официально подтвердил в обновлённой оферте, что самовыкупы не являются нарушением и штрафы за них не предусмотрены. Алгоритм WB ранжирует товары по поведенческим метрикам — именно их мы и улучшаем при каждом выкупе по ключевому запросу.'
      ],
      textsAm: [
        'Կարող են արգելափակել իմ կաբինետը?',
        'Մեր աշխատանքի ողջ ընթացքում ոչ մի հաճախորդի կաբինետ չի արգելափակվել: Մենք օգտագործում ենք իրական հաշիվներ գնումների պատմությամբ, սեփական պահեստ և բնական աշխարհագրական բաշխում — WB-ի ալգորիթմները նման հետագնումները չեն տարբերում սովորական պատվերներից:',
        'Ինչքան արագ կսկսվի առաջխաղացումը?',
        '24 ժամվա ընթացքում ստրատեգիայի համաձայնեցումից և վճարումից հետո: Մենեջերը կազմում է հետագնումների պլանը բանալի հարցումներով և գործարկում առաջին պատվերները նույն օրը:',
        'Հետագնումները կատարում են իրական մարդիկ թե բոտեր?',
        'Միայն իրական մարդիկ: Մենք ունենք սեփական պահեստ Երևանում սարքերով և իրական հաշիվներով: Յուրաքանչյուր հետագնում ձևակերպվում է ձեռքով կենդանի գնորդի կողմից — ոչ մի բոտ ու էմուլյատոր:',
        'Ինչու ոչ բոլոր հետագնումներն են ստանում կարծիքներ?',
        'Ձեր կաբինետի անվտանգության համար կարծիքները հրապարակում ենք գնված ապրանքների ոչ ավելի քան 50%-ի համար: Սա նմանակում է գնորդների բնական վարքագիծը՝ իրական հաճախորդներն էլ բոլորը կարծիք չեն թողնում:',
        'Հնարավոր է պատվիրել միայն կարծիքներ առանց հետագնումների?',
        'Այո, մենք կարող ենք գնել ապրանքը լուսանկար- կամ տեսանյութ կարծիքի համար և հետո վերադարձնել ՊՎԶ: Առանձին ծառայության արժեքը ճշտեք մենեջերի մոտ Telegram-ով:',
        'Ինչ հաշվետվություններ ենք ստանում?',
        'Ամենօրյա հաշվետվություններ՝ յուրաքանչյուր հետագնման կարգավիճակ, ՊՎԶ-ից վերցնման ամսաթվեր, կարծիքների կարգավիճակ ու տեքստեր: Լիարժեք թափանցիկություն յուրաքանչյուր փուլում — դուք միշտ տեսնում եք, թե որ քայլում է պատվերը:',
        'Ինչ արժույթով են գները?',
        'Կայքի բոլոր գները նշված են հայկական դրամով (֏ AMD): Ընդունում ենք վճարում դրամով կամ ռուբլիով համաձայնեցված կուրսով — մանրամասները կքննարկենք մինչ սկիզբը:',
        'Ինչ վճարման եղանակներ եք ընդունում?',
        'Բանկային քարտին փոխանցում RUB-ով կամ AMD-ով, անկանխիկ վճարում ընկերության վավերապահանջներով, կանխիկ Երևանի գրասենյակում: Կոնկրետ տարբերակը կհամաձայնեցնենք Telegram-ով մինչ գործարկումը:',
        'Իսկ եթե հետագնումները արդյունք չտան?',
        'Մենք չենք խոստանում կոնկրետ դիրքեր որոնման մեջ — դասակարգման վրա ազդում են քարտը, նիշան, սեզոնը, մրցակցությունը: Բայց երաշխավորում ենք համաձայնեցված ծավալի հետագնումների կատարումը իրական կարծիքներով և թափանցիկ հաշվետվությամբ: Գործնականում 10-ից 9 հաճախորդը վերադառնում է կրկնակի փաթեթների համար:',
        'Որքա՞ն ժամանակ է պահանջում մեկ փաթեթը?',
        '25–50 հետագնումից բաղկացած ստանդարտ փաթեթը կատարում ենք 5–7 օրվա ընթացքում — այս տեմպը WB-ի ալգորիթմների համար բնական է երևում և կասկածներ չի առաջացնում: Մեծ ծավալները բաժանում ենք մի քանի շաբաթների՝ համաձայնեցված գրաֆիկով:',
        'Կնքու՞մ եք պայմանագիր և տրամադրու՞մ եք փաստաթղթեր:',
        'Այո: Մենք պաշտոնապես գրանցված ընկերություն ենք Հայաստանում, աշխատում ենք պայմանագրով՝ կատարված աշխատանքների ակտերով: Ըստ պահանջի դուրս ենք գրում հաշիվ RUB-ով կամ AMD-ով: Բոլոր փաստաթղթերը տրամադրում ենք մինչ աշխատանքների սկիզբը:',
        'Արդյո՞ք սա օրինական է: Wildberries-ի կանոնները չե՞մ խախտում:',
        'Wildberries-ը պաշտոնապես հաստատել է թարմացված օֆերտայում, որ ինքնագնումները խախտում չեն, և դրանց համար տուգանքներ նախատեսված չեն: WB-ի ալգորիթմը դասակարգում է ապրանքները վարքագծային ցուցանիշներով — հենց դրանք մենք բարելավում ենք յուրաքանչյուր հետագնման ժամանակ բանալի բառով:'
      ]
    },
    {
      key: 'faq__cta_strip', page: 'faq', sort: 402,
      titleRu: 'FAQ: CTA', titleAm: 'FAQ: CTA',
      textsRu: [
        'Не нашли ответ?',
        'Напишите нам в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов.',
        'Перезвоните мне',
        'Контакты'
      ],
      textsAm: [
        'Չգտա՞ք պատասխանը:',
        'Գրեք մեզ Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։',
        'Հետ զանգահարեք',
        'Կոնտակտներ'
      ]
    },
    // ===== contacts (sort 500-502) =====
    {
      key: 'contacts__hero', page: 'contacts', sort: 500,
      titleRu: 'Contacts: Hero', titleAm: 'Contacts: Hero',
      // Matches landing.ts:2542-2548 hardcoded fallbacks.
      textsRu: [
        'Контакты',
        'Свяжитесь',
        'с нами',
        'Выберите удобный канал — Telegram, WhatsApp, форма заявки или обратный звонок. Менеджер отвечает в среднем за 5 минут в рабочее время.'
      ],
      textsAm: [
        'Կապ',
        'Կապվեք',
        'մեզ հետ',
        'Ընտրեք ձեզ հարմար եղանակը՝ Telegram, WhatsApp, հայտի ձև կամ հետադարձ զանգ: Մենեջերը պատասխանում է միջինը 5 րոպեի ընթացքում աշխատանքային ժամերին:'
      ]
    },
    {
      key: 'contacts__channels', page: 'contacts', sort: 501,
      titleRu: 'Contacts: Каналы связи', titleAm: 'Contacts: Կապի ալիքներ',
      // Matches landing.ts:2559-2581 hardcoded fallbacks. 3 channels × 2 (h3 + p) = 6 strings.
      textsRu: [
        'Telegram — администратор',
        'Готовы оплатить и стартовать? Менеджер ответит в течение 5 минут в рабочее время.',
        'Telegram — поддержка',
        'Нужен детальный расчёт или консультация по продвижению? Пишите сюда — отвечает старший менеджер.',
        'WhatsApp',
        'Удобно с телефона? Напишите в WhatsApp — отвечаем так же быстро, как в Telegram.'
      ],
      textsAm: [
        'Telegram — ադմինիստրատոր',
        'Պատրաստ եք վճարել և սկսել: Մենեջերը կպատասխանի 5 րոպեի ընթացքում աշխատանքային ժամերին:',
        'Telegram — աջակցություն',
        'Պետք է մանրամասն հաշվարկ կամ խորհրդատվություն: Գրեք այստեղ — պատասխանում է ավագ մենեջերը:',
        'WhatsApp',
        'Հարմա՞ր է հեռախոսից: Գրեք WhatsApp-ով — պատասխանում ենք նույնքան արագ, որքան Telegram-ով:'
      ]
    },
    {
      key: 'contacts__cta_strip', page: 'contacts', sort: 502,
      titleRu: 'Contacts: CTA', titleAm: 'Contacts: CTA',
      // Matches landing.ts:2693-2699 hardcoded fallbacks.
      textsRu: [
        'Не нашли подходящий канал?',
        'Закажите обратный звонок — менеджер перезвонит в удобное вам время и поможет с любым вопросом.',
        'Перезвоните мне'
      ],
      textsAm: [
        'Չգտա՞ք ձեզ հարմար եղանակ:',
        'Պատվիրեք հետադարձ զանգ — մենեջերը կզանգահարի ձեզ հարմար ժամանակին և կօգնի ցանկացած հարցում:',
        'Հետ զանգահարեք'
      ]
    },
    // ===== referral (sort 600-602) =====
    {
      key: 'referral__hero', page: 'referral', sort: 600,
      titleRu: 'Referral: Hero', titleAm: 'Referral: Hero',
      // Matches landing.ts:3028-3034 hardcoded fallbacks. Index [2] is the
      // gradient `<span class="gr">` — keep the brand 'Go to Top'.
      textsRu: [
        'Партнёрская программа',
        'Реферальная программа',
        'Go to Top',
        'Получайте бонусы за каждого приведённого клиента — от 5% до 15% с первой оплаты и индивидуальные условия для активных партнёров. Прозрачная сетка комиссий, выплаты в RUB или AMD.'
      ],
      textsAm: [
        'Գործընկերային ծրագիր',
        'Հղման ծրագիր',
        'Go to Top',
        'Ստացեք բոնուսներ յուրաքանչյուր ձեր կողմից բերված հաճախորդի համար՝ 5%-ից 15% առաջին վճարումից և անհատական պայմաններ ակտիվ գործընկերների համար։ Թափանցիկ հանձնաժողովների ցանց, վճարումներ RUB-ով կամ AMD-ով։'
      ]
    },
    {
      key: 'referral__steps', page: 'referral', sort: 601,
      titleRu: 'Referral: 3 шага', titleAm: 'Referral: 3 քայլ',
      // 3 steps × 2 strings (title + description) = 6 entries.
      // Matches landing.ts:3066-3077 hardcoded fallbacks.
      textsRu: [
        'Получите промокод',
        'Напишите менеджеру в Telegram — выдадим персональный промокод и партнёрскую ссылку в течение рабочего дня.',
        'Делитесь с клиентами',
        'Отправляйте код в личных переписках, добавляйте в посты, сторис и видео — клиент вводит его в калькуляторе на главной.',
        'Получайте бонус',
        'Бонус начисляется с каждой оплаты приведённого клиента — выплаты раз в две недели на карту в RUB или AMD по согласованию.'
      ],
      textsAm: [
        'Ստացեք պրոմո կոդ',
        'Գրեք մենեջերին Telegram-ով — կտրամադրենք անհատական պրոմո կոդ և գործընկերային հղում աշխատանքային օրվա ընթացքում։',
        'Կիսվեք հաճախորդների հետ',
        'Ուղարկեք կոդը անձնական նամակագրություններում, ավելացրեք գրառումներում, ստորիներում և տեսանյութերում — հաճախորդը մուտքագրում է այն գլխավոր էջի հաշվիչում։',
        'Ստացեք բոնուս',
        'Բոնուսը հաշվարկվում է բերված հաճախորդի յուրաքանչյուր վճարումից — վճարումները երկու շաբաթը մեկ՝ քարտին RUB-ով կամ AMD-ով համաձայնության համաձայն։'
      ]
    },
    {
      key: 'referral__cta_strip', page: 'referral', sort: 602,
      titleRu: 'Referral: CTA', titleAm: 'Referral: CTA',
      // Matches landing.ts:3171-3177 hardcoded fallbacks.
      textsRu: [
        'Готовы стать партнёром?',
        'Получите промокод за 5 минут, обсудите условия с менеджером или напишите нам на странице контактов.',
        'Получить код'
      ],
      textsAm: [
        'Պատրա՞ստ եք դառնալ գործընկեր',
        'Ստացեք պրոմո կոդ 5 րոպեում, քննարկեք պայմանները մենեջերի հետ կամ գրեք մեզ կոնտակտների էջից։',
        'Ստանալ կոդը'
      ]
    }
  ];

  // Sanity check: texts_ru and texts_am must have identical length per block.
  for (const b of SUBPAGE_BLOCKS) {
    if (b.textsRu.length !== b.textsAm.length) {
      return c.json({ error: `Block ${b.key}: texts_ru/texts_am length mismatch (${b.textsRu.length} vs ${b.textsAm.length})` }, 500);
    }
  }

  let inserted = 0;
  for (const b of SUBPAGE_BLOCKS) {
    const res = await db.prepare(
      'INSERT OR IGNORE INTO site_blocks (block_key, page, block_type, title_ru, title_am, texts_ru, texts_am, images, buttons, custom_css, custom_html, is_visible, sort_order, social_links, text_styles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      b.key, b.page, 'subpage', b.titleRu, b.titleAm,
      JSON.stringify(b.textsRu), JSON.stringify(b.textsAm),
      '[]', '[]', '', '{}', 1, b.sort, '[]', '[]'
    ).run();
    // D1 .meta.changes is 1 only when the row was actually inserted (0 when ignored by UNIQUE).
    const changes = res?.meta && (res.meta as any).changes;
    if (typeof changes === 'number' && changes > 0) inserted++;
  }

  return c.json({ success: true, total: SUBPAGE_BLOCKS.length, inserted });
});

// ===== UPLOAD IMAGE (R2 storage, with D1 fallback for local dev) =====
api.post('/upload-image', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const body = await c.req.parseBody();
    const file = body['file'] as any;
    if (!file || !file.arrayBuffer) return c.json({ error: 'No file' }, 400);
    const buffer = await file.arrayBuffer();
    const mimeType = file.type || 'image/jpeg';
    const filename = (file.name || 'image.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    const blockId = body['block_id'] ? parseInt(body['block_id'] as string) : null;
    
    // Try R2 first (production), fall back to base64 in D1 (local dev without R2)
    let url = '';
    let dataUrl = '';
    
    if (c.env.MEDIA) {
      // R2 path: store file and return /api/media/... URL
      const key = `uploads/${Date.now()}_${filename}`;
      await c.env.MEDIA.put(key, buffer, {
        httpMetadata: { contentType: mimeType },
        customMetadata: { blockId: blockId ? String(blockId) : '' }
      });
      url = `/api/media/${key}`;
      // Store metadata in uploads table (no base64)
      await db.prepare('INSERT INTO uploads (filename, mime_type, data_base64, block_id) VALUES (?,?,?,?)')
        .bind(filename, mimeType, url, blockId).run();
    } else {
      // Fallback: base64 in D1 (local dev)
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      dataUrl = `data:${mimeType};base64,${base64}`;
      await db.prepare('INSERT INTO uploads (filename, mime_type, data_base64, block_id) VALUES (?,?,?,?)')
        .bind(filename, mimeType, dataUrl, blockId).run();
      url = '';
    }
    
    const lastRow = await db.prepare('SELECT id, data_base64 FROM uploads ORDER BY id DESC LIMIT 1').first();
    const imageId = lastRow ? lastRow.id : 0;
    const storedUrl = url || `/api/admin/uploads/${imageId}`;
    const storedDataUrl = dataUrl || (lastRow?.data_base64 as string) || '';
    
    return c.json({ success: true, url: storedUrl, id: imageId, data_url: storedDataUrl });
  } catch(e: any) {
    return c.json({ error: 'Upload failed: ' + (e?.message || 'unknown') }, 500);
  }
});

// ===== GET UPLOADED IMAGE =====
api.get('/uploads/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const row = await db.prepare('SELECT data_base64, mime_type FROM uploads WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  const dataUrl = row.data_base64 as string;
  // If it's a data URL, extract base64 part and return binary
  if (dataUrl.startsWith('data:')) {
    const parts = dataUrl.split(',');
    const base64 = parts[1];
    const mimeMatch = parts[0].match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : (row.mime_type as string || 'image/jpeg');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Response(bytes, { headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000' } });
  }
  return c.json({ error: 'Invalid format' }, 500);
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
  
  // Enrich service items: add service_id when missing by matching name against DB
  // This is needed because older leads may not have service_id saved in calcData items
  try {
    const svcRows = await db.prepare('SELECT id, name_ru, name_am FROM calculator_services').all();
    const nameToId: Record<string, number> = {};
    for (const s of (svcRows.results || [])) {
      if (s.name_ru) nameToId[String(s.name_ru).trim()] = Number(s.id);
      if (s.name_am) nameToId[String(s.name_am).trim()] = Number(s.id);
    }
    for (const si of serviceItems) {
      if (!si.service_id) {
        const nameKey = String(si.name_ru || si.name || '').trim();
        if (nameKey && nameToId[nameKey]) {
          si.service_id = nameToId[nameKey];
        }
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
  const allItems = [...serviceItems, ...articleItems];
  
  // Apply referral code discount
  // IMPORTANT: Use lead DB field as primary source; only fall back to calcData if DB field is null/undefined
  // When admin clears the code, leadRow.referral_code = '' — must NOT fall back to old calcData value
  const leadRefCode = leadRow.referral_code as string;
  // Only fall back to calcData when DB field is truly null/undefined (field missing), NOT when it's empty string (explicitly cleared)
  const referralCode = (leadRefCode !== null && leadRefCode !== undefined) ? leadRefCode : (existingCalcData?.referralCode || '');
  let discountPercent = 0;
  let discountAmount = 0;
  let refFreeServices: any[] = [];
  let refServiceDiscountsTotal = 0;
  if (referralCode) {
    try {
      const refRow = await db.prepare('SELECT * FROM referral_codes WHERE UPPER(code) = UPPER(?) AND is_active = 1').bind(referralCode.trim()).first();
      if (refRow) {
        discountPercent = Number(refRow.discount_percent) || 0;
        // Parse linked_services to apply discount only to specific services
        let linkedServices: number[] = [];
        try { linkedServices = JSON.parse((refRow.linked_services as string) || '[]'); } catch { linkedServices = []; }
        if (discountPercent > 0) {
          if (linkedServices.length > 0) {
            // Discount applies ONLY to linked services
            let linkedSubtotal = 0;
            for (const si of serviceItems) {
              if (si.service_id && linkedServices.map(Number).indexOf(Number(si.service_id)) !== -1) {
                linkedSubtotal += Number(si.subtotal) || 0;
              }
            }
            // Fallback: if no items matched linked services (e.g. name enrichment failed),
            // apply to all services to avoid silent discount loss
            if (linkedSubtotal === 0 && servicesTotalAmount > 0 && !serviceItems.some((si: any) => si.service_id)) {
              linkedSubtotal = servicesTotalAmount;
            }
            discountAmount = Math.round(linkedSubtotal * discountPercent / 100);
          } else {
            // No linked_services filter → discount applies to ALL services
            discountAmount = Math.round(servicesTotalAmount * discountPercent / 100);
          }
        }
        // Load free/bonus services
        const fsRes = await db.prepare('SELECT rfs.*, cs.name_ru, cs.name_am, cs.price FROM referral_free_services rfs LEFT JOIN calculator_services cs ON rfs.service_id = cs.id WHERE rfs.referral_code_id = ?').bind(refRow.id).all();
        refFreeServices = (fsRes.results || []).map((fs: any) => {
          const dp = Number(fs.discount_percent) || 0;
          const price = Number(fs.price) || 0;
          const qty = Number(fs.quantity) || 1;
          // discount_percent=0 or >=100 means fully free; otherwise partial discount
          const isFree = dp === 0 || dp >= 100;
          const actualSubtotal = isFree ? 0 : Math.round(price * qty * (100 - dp) / 100);
          // Accumulate partial-discount service totals (e.g. -50% on buyouts → client pays half)
          if (!isFree) {
            refServiceDiscountsTotal += actualSubtotal;
          }
          return {
            name: fs.name_ru || '',
            name_am: fs.name_am || '',
            qty: qty,
            price: price,
            discount_percent: dp,
            service_id: fs.service_id,
            subtotal: actualSubtotal
          };
        });
      }
    } catch {}
  }
  
  // Include package price in total
  // BUG-006 fix: discount applies ONLY to services, not articles — separate the subtraction
  const packagePrice = existingCalcData?.package ? (Number(existingCalcData.package.package_price) || 0) : 0;
  const servicesAfterDiscount = Math.max(0, servicesTotalAmount - discountAmount);
  // Include partial-discount bonus services (e.g. -50% buyouts) in total
  const totalAmount = servicesAfterDiscount + articlesTotalAmount + packagePrice + refServiceDiscountsTotal;
  
  // Compute commission from payment method
  let commissionAmount = 0;
  const pmId = leadRow.payment_method_id;
  if (pmId) {
    try {
      const pmRow = await db.prepare('SELECT commission_pct FROM payment_methods WHERE id = ? AND is_active = 1').bind(pmId).first();
      if (pmRow) {
        const pct = Number(pmRow.commission_pct) || 0;
        if (pct > 0) {
          commissionAmount = Math.round(totalAmount * pct / 100);
        }
      }
    } catch {}
  }
  
  // Update lead total_amount, commission_amount and calc_data (for PDF)
  // PRESERVE existing package data from calc_data
  const existingPackage = existingCalcData?.package || null;
  const calcData = JSON.stringify({
    items: allItems,
    subtotal: subtotalAmount,
    servicesSubtotal: servicesTotalAmount,
    articlesSubtotal: articlesTotalAmount,
    total: totalAmount,
    refund: refundAmount,
    referralCode: referralCode,
    discountPercent: discountPercent,
    discountAmount: discountAmount,
    freeServices: refFreeServices,
    ...(existingPackage ? { package: existingPackage } : {})
  });
  // Ensure commission_amount column exists
  try { await db.prepare("SELECT commission_amount FROM leads LIMIT 1").first(); } catch { try { await db.prepare("ALTER TABLE leads ADD COLUMN commission_amount REAL DEFAULT 0").run(); } catch {} }
  await db.prepare('UPDATE leads SET total_amount = ?, commission_amount = ?, calc_data = ? WHERE id = ?')
    .bind(totalAmount, commissionAmount, calcData, leadId).run();
  // Set source to calculator_pdf ONLY if lead has calc_data with items (not for manual leads)
  if (allItems.length > 0) {
    await db.prepare("UPDATE leads SET source = 'calculator_pdf' WHERE id = ? AND source NOT IN ('calculator_pdf','manual','popup')").bind(leadId).run();
  }
  await updateLeadArticlesCount(db, Number(leadId));
  return c.json({ success: true, total_amount: totalAmount, commission_amount: commissionAmount, articles_count: articles.length, calc_data: JSON.parse(calcData) });
});

// =====================================================================
// Phase 4 — Pro CMS endpoints
// =====================================================================

// Bulk visibility toggle
api.post('/site-blocks/bulk-visibility', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { ids, is_visible } = await c.req.json();
  if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: 'ids required' }, 400);
  const v = is_visible ? 1 : 0;
  const actor = getActorFromContext(c);
  let updated = 0;
  for (const id of ids) {
    await recordBlockHistory(db, id, 'update', actor);
    const r = await db.prepare('UPDATE site_blocks SET is_visible = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(v, id).run();
    if ((r?.meta as any)?.changes) updated++;
  }
  return c.json({ success: true, updated });
});

// Bulk delete
api.post('/site-blocks/bulk-delete', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { ids } = await c.req.json();
  if (!Array.isArray(ids) || ids.length === 0) return c.json({ error: 'ids required' }, 400);
  const actor = getActorFromContext(c);
  let deleted = 0;
  for (const id of ids) {
    await recordBlockHistory(db, id, 'delete', actor);
    const r = await db.prepare('DELETE FROM site_blocks WHERE id = ?').bind(id).run();
    if ((r?.meta as any)?.changes) deleted++;
  }
  return c.json({ success: true, deleted });
});

// Move block to another page — renames the `<page>__<sub>` prefix in
// block_key and updates the page column. Idempotent: skips if the new
// key collides with an existing one. Used by drag-drop between page
// groups in the admin UI.
api.post('/site-blocks/move-page', authMiddleware, async (c) => {
  const db = c.env.DB;
  const { id, new_page } = await c.req.json();
  if (!id || !new_page) return c.json({ error: 'id and new_page required' }, 400);
  // Whitelist target pages so we can't be tricked into arbitrary keys.
  const ALLOWED_PAGES = new Set(['home', 'about', 'services', 'buyouts', 'faq', 'contacts', 'referral', 'calculator', 'package', 'shell', 'blog']);
  if (!ALLOWED_PAGES.has(new_page)) return c.json({ error: 'invalid new_page' }, 400);
  const block = await db.prepare('SELECT * FROM site_blocks WHERE id = ?').bind(id).first();
  if (!block) return c.json({ error: 'Not found' }, 404);
  const oldKey = String(block.block_key || '');
  // Compute the sub-key (everything after `__`).
  let sub = oldKey;
  const idx = oldKey.indexOf('__');
  if (idx >= 0) sub = oldKey.slice(idx + 2);
  // Avoid empty sub keys.
  if (!sub) sub = 'section';
  // For target 'home', historically blocks live without prefix. We keep
  // the prefix to stay searchable & filterable in the admin UI.
  const newKey = `${new_page}__${sub}`;
  if (newKey === oldKey) {
    await db.prepare('UPDATE site_blocks SET page = ? WHERE id = ?').bind(new_page, id).run();
    return c.json({ success: true, unchanged: true, key: newKey });
  }
  // Collision check.
  const exists = await db.prepare('SELECT id FROM site_blocks WHERE block_key = ?').bind(newKey).first();
  if (exists) {
    return c.json({ error: 'Block with key ' + newKey + ' already exists. Rename or delete it first.' }, 409);
  }
  await recordBlockHistory(db, id, 'update', getActorFromContext(c));
  await db.prepare('UPDATE site_blocks SET block_key = ?, page = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newKey, new_page, id).run();
  return c.json({ success: true, key: newKey });
});

// Export all site_blocks as a JSON document (download from admin UI).
api.get('/site-blocks/export', authMiddleware, async (c) => {
  const db = c.env.DB;
  const res = await db.prepare('SELECT * FROM site_blocks ORDER BY page, sort_order, id').all();
  const blocks = (res.results || []).map((b: any) => ({
    block_key: b.block_key,
    page: b.page,
    block_type: b.block_type,
    title_ru: b.title_ru,
    title_am: b.title_am,
    texts_ru: b.texts_ru,
    texts_am: b.texts_am,
    images: b.images,
    buttons: b.buttons,
    custom_css: b.custom_css,
    custom_html: b.custom_html,
    is_visible: b.is_visible,
    sort_order: b.sort_order,
    social_links: b.social_links
  }));
  return c.json({ exported_at: new Date().toISOString(), version: 1, count: blocks.length, blocks });
});

// Import from JSON dump — INSERT OR REPLACE on block_key. Designed to
// pair with /export. Each block must have a `block_key`. Returns
// counts of inserted/updated rows.
api.post('/site-blocks/import', authMiddleware, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const blocks = Array.isArray(body?.blocks) ? body.blocks : [];
  if (blocks.length === 0) return c.json({ error: 'No blocks' }, 400);
  let imported = 0;
  for (const b of blocks) {
    if (!b.block_key) continue;
    const existing = await db.prepare('SELECT id FROM site_blocks WHERE block_key = ?').bind(b.block_key).first();
    if (existing) {
      await recordBlockHistory(db, existing.id as number, 'update', getActorFromContext(c));
      await db.prepare(
        'UPDATE site_blocks SET page=?, block_type=?, title_ru=?, title_am=?, texts_ru=?, texts_am=?, images=?, buttons=?, custom_css=?, custom_html=?, is_visible=?, sort_order=?, social_links=?, updated_at=CURRENT_TIMESTAMP WHERE block_key=?'
      ).bind(
        b.page || 'home', b.block_type || 'section', b.title_ru || '', b.title_am || '',
        typeof b.texts_ru === 'string' ? b.texts_ru : JSON.stringify(b.texts_ru || []),
        typeof b.texts_am === 'string' ? b.texts_am : JSON.stringify(b.texts_am || []),
        typeof b.images === 'string' ? b.images : JSON.stringify(b.images || []),
        typeof b.buttons === 'string' ? b.buttons : JSON.stringify(b.buttons || []),
        b.custom_css || '', b.custom_html || '',
        b.is_visible ? 1 : 0, b.sort_order || 0,
        typeof b.social_links === 'string' ? b.social_links : JSON.stringify(b.social_links || []),
        b.block_key
      ).run();
    } else {
      await db.prepare(
        'INSERT INTO site_blocks (block_key, page, block_type, title_ru, title_am, texts_ru, texts_am, images, buttons, custom_css, custom_html, is_visible, sort_order, social_links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        b.block_key, b.page || 'home', b.block_type || 'section',
        b.title_ru || '', b.title_am || '',
        typeof b.texts_ru === 'string' ? b.texts_ru : JSON.stringify(b.texts_ru || []),
        typeof b.texts_am === 'string' ? b.texts_am : JSON.stringify(b.texts_am || []),
        typeof b.images === 'string' ? b.images : JSON.stringify(b.images || []),
        typeof b.buttons === 'string' ? b.buttons : JSON.stringify(b.buttons || []),
        b.custom_css || '', b.custom_html || '',
        b.is_visible ? 1 : 0, b.sort_order || 0,
        typeof b.social_links === 'string' ? b.social_links : JSON.stringify(b.social_links || [])
      ).run();
    }
    imported++;
  }
  return c.json({ success: true, imported });
});

// History list for a single block — newest first, capped to 50 by default.
api.get('/site-blocks/:id/history', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10) || 50, 1), 200);
  const res = await db.prepare(
    'SELECT id, block_id, block_key, action, user_id, user_name, created_at FROM site_blocks_history WHERE block_id = ? ORDER BY id DESC LIMIT ?'
  ).bind(id, limit).all();
  return c.json({ history: res.results || [] });
});

// Restore a block from a specific history entry. Records a fresh
// snapshot of the current state before applying the restore.
api.post('/site-blocks/:id/restore/:historyId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const historyId = c.req.param('historyId');
  const histRow = await db.prepare('SELECT * FROM site_blocks_history WHERE id = ? AND block_id = ?').bind(historyId, id).first();
  if (!histRow) return c.json({ error: 'History entry not found' }, 404);
  let snap: any = null;
  try { snap = JSON.parse(histRow.snapshot as string); } catch { return c.json({ error: 'Invalid snapshot' }, 500); }
  if (!snap) return c.json({ error: 'Empty snapshot' }, 500);
  // Save current state before restoring.
  await recordBlockHistory(db, id, 'restore', getActorFromContext(c));
  // For DELETE history entries, the row may not currently exist — INSERT
  // OR REPLACE handles both cases. We never resurrect old `id`s; instead
  // we update the block row matched by `block_key` if present, or insert
  // a new row otherwise. The HTTP route still uses the original id for
  // future history queries.
  const existing = await db.prepare('SELECT id FROM site_blocks WHERE block_key = ?').bind(snap.block_key).first();
  if (existing) {
    await db.prepare(
      'UPDATE site_blocks SET page=?, block_type=?, title_ru=?, title_am=?, texts_ru=?, texts_am=?, images=?, buttons=?, custom_css=?, custom_html=?, is_visible=?, sort_order=?, social_links=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).bind(
      snap.page || 'home', snap.block_type || 'section', snap.title_ru || '', snap.title_am || '',
      snap.texts_ru || '[]', snap.texts_am || '[]', snap.images || '[]', snap.buttons || '[]',
      snap.custom_css || '', snap.custom_html || '',
      snap.is_visible ? 1 : 0, snap.sort_order || 0,
      snap.social_links || '[]', existing.id
    ).run();
    return c.json({ success: true, restored_to_id: existing.id });
  }
  // The block was deleted; recreate it.
  await db.prepare(
    'INSERT INTO site_blocks (block_key, page, block_type, title_ru, title_am, texts_ru, texts_am, images, buttons, custom_css, custom_html, is_visible, sort_order, social_links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    snap.block_key, snap.page || 'home', snap.block_type || 'section',
    snap.title_ru || '', snap.title_am || '', snap.texts_ru || '[]', snap.texts_am || '[]',
    snap.images || '[]', snap.buttons || '[]', snap.custom_css || '', snap.custom_html || '',
    snap.is_visible ? 1 : 0, snap.sort_order || 0, snap.social_links || '[]'
  ).run();
  return c.json({ success: true, recreated: true });
});

// =====================================================================
// Phase 4 — Pro seed: shell + home + calculator + package + blog blocks
// =====================================================================
// Mirrors the layout used by `seed-subpages` (Phase 3C). Idempotent via
// INSERT OR IGNORE on UNIQUE block_key. Adds the chrome blocks that
// were previously hardcoded in `landing.ts`:
//   - shell__nav      8 nav items + CTA label (header + bottom nav share strings)
//   - shell__footer   brand line, nav heading, 5 nav links, contacts heading, 2 contact labels, copyright, location
//   - shell__modal    callback popup labels + placeholders
//   - shell__floats   floating WhatsApp + calculator buttons
//   - shell__bottom   labels for the 5 main bottom-nav slots + 5 "more" menu items
//   - home__*         hero / ticker / wb_banner / stats_bar / services / why_buyouts / for_whom / contact_cta
//   - calculator__*   hero / features / how_to / cta_strip
//   - package__chrome surrounding labels for /package/:slug detail pages
//   - blog__chrome    listing + post chrome strings
api.post('/site-blocks/seed-pro', authMiddleware, async (c) => {
  const db = c.env.DB;

  type ProBlock = {
    key: string;
    page: string;
    sort: number;
    titleRu: string;
    titleAm: string;
    textsRu: string[];
    textsAm: string[];
  };

  const PRO_BLOCKS: ProBlock[] = [
    // ===== shell (sort 1-9) =====
    {
      key: 'shell__nav', page: 'shell', sort: 1,
      titleRu: 'Шапка: пункты меню', titleAm: 'Շապիկ: մենյու',
      // 8 nav labels (RU/AM pairs) + 1 CTA label = 9 strings
      textsRu: ['Главная', 'О нас', 'Услуги', 'Выкупы', 'Калькулятор', 'FAQ', 'Контакты', 'Блог', 'Перезвоните мне'],
      textsAm: ['Գլխավոր', 'Մեր մասին', 'Ծառայություններ', 'Հետագնումներ', 'Հաշվիչ', 'ՀՏՀ', 'Կոնտակտներ', 'Բլոգ', 'Հետ զանգահարեք']
    },
    {
      key: 'shell__footer', page: 'shell', sort: 2,
      titleRu: 'Футер: тексты', titleAm: 'Footer: տեքստեր',
      // [0] brand_p, [1] nav_h4, [2..6] nav_links, [7] contacts_h4, [8] admin_label, [9] manager_label, [10] copyright, [11] location
      textsRu: [
        'Безопасное продвижение на Wildberries для армянских продавцов.',
        'Навигация',
        'Услуги и цены',
        'Калькулятор',
        'Наш склад',
        'Гарантии',
        'FAQ',
        'Контакты',
        'Администратор',
        'Менеджер',
        'Все права защищены',
        'Ереван, Армения'
      ],
      textsAm: [
        'Անվտանգ առաջխաղացում Wildberries-ում հայ վաճառողների համար։',
        'Նավիգացիա',
        'Ծառայություններ և գներ',
        'Հաշվիչ',
        'Մեր պահեստը',
        'Երաշխիքներ',
        'ՀՏՀ',
        'Կոնտակտներ',
        'Ադմինիստրատոր',
        'Մենեջեր',
        'Բոլոր իրավունքները պաշտպանված են',
        'Երևան, Հայաստան'
      ]
    },
    {
      key: 'shell__modal', page: 'shell', sort: 3,
      titleRu: 'Модалка обратного звонка', titleAm: 'Հետ զանգի մոդալ',
      // [0] title, [1] sub, [2] name_label, [3] phone_label, [4] time_label, [5] question_label, [6] name_placeholder, [7] phone_placeholder, [8] time_placeholder, [9] question_placeholder, [10] submit_btn
      textsRu: [
        'Перезвоните мне',
        'Оставьте заявку — мы свяжемся в удобное для вас время',
        'Ваше имя *',
        'Номер телефона *',
        'Удобное время для звонка',
        'Ваш вопрос (необязательно)',
        'Иван Иванов',
        '+7 (___) ___-__-__',
        'Например: после 18:00',
        'Кратко опишите, что хотите обсудить...',
        'Отправить заявку'
      ],
      textsAm: [
        'Հետ զանգահարեք',
        'Թողեք հայտ — կզանգահարենք ձեզ հարմար ժամանակ',
        'Ձեր անունը *',
        'Հեռախոսահամար *',
        'Հարմարավետ ժամ զանգի համար',
        'Ձեր հարցը (ոչ պարտադիր)',
        'Անուն Ազգանուն',
        '+374 __ ______',
        'Օրինակ՝ 18:00-ից հետո',
        'Կարճ նկարագրեք, ինչ եք ուզում քննարկել...',
        'Ուղարկել հայտը'
      ]
    },
    {
      key: 'shell__floats', page: 'shell', sort: 4,
      titleRu: 'Плавающие кнопки', titleAm: 'Լողացող կոճակներ',
      // [0] whatsapp_label, [1] calc_label
      textsRu: ['Написать нам', 'Калькулятор'],
      textsAm: ['Գրել հիմա', 'Հաշվիչ']
    },
    {
      key: 'shell__bottom', page: 'shell', sort: 5,
      titleRu: 'Нижняя навигация (моб.)', titleAm: 'Ներքևի մենյու',
      // 5 main + 5 more menu = 10 strings
      // [0] Главная, [1] Услуги, [2] Выкупы, [3] Калькулятор, [4] Ещё, [5] О нас, [6] FAQ, [7] Контакты, [8] Бонусы, [9] Блог
      textsRu: ['Главная', 'Услуги', 'Выкупы', 'Калькулятор', 'Ещё', 'О нас', 'FAQ', 'Контакты', 'Бонусы', 'Блог'],
      textsAm: ['Գլխավոր', 'Ծառայություններ', 'Հետագնումներ', 'Հաշվիչ', 'Ավելին', 'Մեր մասին', 'ՀՏՀ', 'Կոնտակտներ', 'Բոնուսներ', 'Բլոգ']
    },
    // ===== home (new homepage chrome) sort 50-59 =====
    {
      key: 'home__hero', page: 'home', sort: 50,
      titleRu: 'Home: Hero', titleAm: 'Home: Hero',
      // [0] eyebrow, [1] h1_line1, [2] h1_line2_grad, [3] desc, [4..6] stat labels, [7] cta_main, [8] cta_secondary
      textsRu: [
        'Wildberries · продвижение',
        'Реальные выкупы',
        'без блокировок',
        'Маркетплейс-агентство в Ереване: 1000+ реальных аккаунтов, собственный склад, выкупы по ключевым запросам, отзывы с фото — за 7-14 дней ваш товар поднимается в ТОП.',
        'товаров в ТОП',
        'блокировок с 2021',
        'реальных аккаунтов',
        'Рассчитать стоимость',
        'Написать в Telegram'
      ],
      textsAm: [
        'Wildberries · առաջխաղացում',
        'Իրական հետագնումներ',
        'առանց արգելափակումների',
        'Մարքեթփլեյս գործակալություն Երևանում՝ 1000+ իրական հաշիվ, սեփական պահեստ, հետագնումներ բանալի բառերով, լուսանկարներով կարծիքներ — 7-14 օրում ձեր ապրանքը բարձրանում է TOP-ում:',
        'ապրանք TOP-ում',
        'արգելափակում 2021-ից',
        'իրական հաշիվ',
        'Հաշվել արժեքը',
        'Գրել Telegram-ով'
      ]
    },
    {
      key: 'home__wb_banner', page: 'home', sort: 51,
      titleRu: 'Home: WB банер', titleAm: 'Home: WB բաններ',
      // [0] title_html, [1] sub, [2] cta
      textsRu: [
        'WB официально отменил штрафы за выкупы!',
        'В обновлённой оферте Wildberries: самовыкупы НЕ являются нарушением. Выкупы по ключевым словам — это легальный путь в ТОП.',
        'Узнать'
      ],
      textsAm: [
        'WB-ը պաշտոնապես չեղարկել է հետագնումների տուգանքները!',
        'Wildberries-ի թարմացված օֆերտայում՝ ինքնագնումները խախտում չեն: Բանալի բառերով հետագնումները՝ TOP-ի օրինական ճանապարհն են:',
        'Իմանալ'
      ]
    },
    {
      key: 'home__stats_bar', page: 'home', sort: 52,
      titleRu: 'Home: Полоса статистики', titleAm: 'Home: Վիճակագրություն',
      // 4 labels (numbers stay hardcoded, only labels are CMS)
      textsRu: ['товаров вывели в ТОП', 'верифицированных аккаунтов', 'месяца на рынке', 'выкупов в день'],
      textsAm: ['ապրանք բարձրացրինք TOP', 'վերիֆիկացված հաշիվ', 'ամիս շուկայում', 'հետագնում օրական']
    },
    {
      key: 'home__services', page: 'home', sort: 53,
      titleRu: 'Home: Услуги (3 карточки)', titleAm: 'Home: Ծառայություններ',
      // 3 services × (title + desc + cta) = 9 strings
      textsRu: [
        'Отзывы с фото',
        'Профессиональные отзывы с фото в реальном использовании. Каждый отзыв пишется индивидуально под ваш товар после реального выкупа.',
        'Повысить рейтинг',
        'Выкупы по ключам',
        'Реальные люди покупают ваш товар по нужным ключевым запросам. Карточка поднимается в ТОП за 7-14 дней. Собственный склад в Ереване.',
        'Начать продвижение',
        'Работа с ключами',
        'Анализ ниши, подбор и активация высокочастотных ключевых запросов, постоянный мониторинг позиций. Полный цикл SEO-продвижения карточки на WB.',
        'Активировать ключевые'
      ],
      textsAm: [
        'Կարծիքներ լուսանկարով',
        'Մասնագիտական կարծիքներ իրական օգտագործման լուսանկարներով: Յուրաքանչյուր կարծիք գրվում է անհատապես ձեր ապրանքի համար իրական գնումից հետո:',
        'Բարձրացնել վարկանիշը',
        'Հետագնումներ բանալիներով',
        'Իրական մարդիկ գնում են ձեր ապրանքը անհրաժեշտ բանալի բառերով: Քարտը 7-14 օրում բարձրանում է TOP: Սեփական պահեստ Երևանում:',
        'Սկսել առաջխաղացումը',
        'Աշխատանք բանալիների հետ',
        'Նիշայի վերլուծություն, բարձր հաճախականության բանալի բառերի ընտրություն և ակտիվացում, դիրքերի անընդհատ մոնիթորինգ: SEO-առաջխաղացման ամբողջական ցիկլ WB-ում:',
        'Ակտիվացնել բանալիները'
      ]
    },
    {
      key: 'home__why_buyouts', page: 'home', sort: 54,
      titleRu: 'Home: Почему это работает (6 шагов)', titleAm: 'Home: Ինչու է աշխատում',
      // header + 6 steps (title+desc) + result line + final CTA = 1 + 12 + 1 + 1 = 15
      textsRu: [
        'Почему выкупы работают',
        'Поиск по ключевому слову',
        'Покупатель вводит запрос → ваш товар появляется в выдаче',
        'Просмотр карточки',
        'Покупатель открывает товар → растёт CTR (поведенческая метрика)',
        'Работа с отзывами',
        'Покупатель читает отзывы → высокий рейтинг + фото = доверие',
        'Добавление в корзину',
        'Покупатель добавляет конкурентов в корзину для сравнения',
        'Удаление конкурентов',
        'Покупатель удаляет товары конкурентов и оставляет ваш',
        'Заказ и получение',
        'Покупатель оформляет заказ и забирает с ПВЗ → завершённая воронка',
        'Результат: повышаются ВСЕ конверсии — алгоритм WB видит «горячую» карточку и поднимает её в ТОП.',
        'Начать выкупы'
      ],
      textsAm: [
        'Ինչու են հետագնումները աշխատում',
        'Որոնում բանալի բառով',
        'Գնորդը մուտքագրում է հարցումը → ձեր ապրանքը հայտնվում է ցուցակում',
        'Քարտի դիտարկում',
        'Գնորդը բացում է ապրանքը → աճում է CTR (վարքային ցուցանիշ)',
        'Աշխատանք կարծիքների հետ',
        'Գնորդը կարդում է կարծիքները → բարձր վարկանիշ + լուսանկարներ = վստահություն',
        'Մրցակիցների ավելացում',
        'Գնորդը ավելացնում է մրցակիցների ապրանքները զամբյուղում համեմատելու համար',
        'Մրցակիցների հեռացում',
        'Գնորդը հեռացնում է մրցակիցների ապրանքները և թողնում ձերը',
        'Պատվեր և ստացում',
        'Գնորդը ձևակերպում է պատվերը և վերցնում ՊՎԶ-ից → ավարտված ձագար',
        'Արդյունքում՝ բարձրանում են ԲՈԼՈՐ կոնվերսիաները — WB-ի ալգորիթմը տեսնում է «թեժ» քարտը և բարձրացնում TOP:',
        'Սկսել հետագնումները'
      ]
    },
    {
      key: 'home__for_whom', page: 'home', sort: 55,
      titleRu: 'Home: Для кого (5 карточек)', titleAm: 'Home: Ում համար է',
      // header (eyebrow + h2 + h2_grad + desc) + 5 cards × (title + desc) = 4 + 10 = 14
      textsRu: [
        'Для кого',
        'Для кого полезен',
        'наш сервис',
        'Прозрачные условия и быстрый старт — для тех, кто продаёт сам или помогает другим продавцам.',
        'Менеджеры WB',
        'Получите реальные результаты для своих клиентов: ТОП-позиции, рост заказов, отзывы с фото — без рисков для кабинета.',
        'Агентства',
        'Расширьте линейку услуг для клиентов: выкупы, отзывы, фото — под ключ от партнёра с собственным складом.',
        'Блогеры и инфлюенсеры',
        'Зарабатывайте на промокодах: ваш код = бонус с каждой оплаты от приведённых клиентов. До 15% с заказа.',
        'Онлайн-школы',
        'Продвижение карточек ваших учеников — практическая работа с реальными выкупами, отзывами и аналитикой.',
        'Курсы и марафоны',
        'Демонстрируйте результаты учеников через настоящие кейсы — выкупы, отзывы, рост позиций в WB.'
      ],
      textsAm: [
        'Ում համար է',
        'Ում համար է օգտակար',
        'մեր ծառայությունը',
        'Թափանցիկ պայմաններ և արագ սկիզբ — նրանց համար, ովքեր վաճառում են իրենց կամ օգնում են այլ վաճառողներին:',
        'WB մենեջերներ',
        'Ստացեք իրական արդյունքներ ձեր հաճախորդների համար՝ TOP-դիրքեր, պատվերների աճ, լուսանկարներով կարծիքներ — առանց կաբինետի ռիսկերի:',
        'Գործակալություններ',
        'Ընդարձակեք ձեր ծառայությունների ցանկը հաճախորդների համար՝ հետագնումներ, կարծիքներ, լուսանկարներ — բանալիով սեփական պահեստ ունեցող գործընկերից:',
        'Բլոգերներ և ինֆլյուենսերներ',
        'Վաստակեք պրոմոկոդերով՝ ձեր կոդը = բոնուս յուրաքանչյուր վճարումից բերված հաճախորդներից: Մինչև 15% պատվերից:',
        'Օնլայն-դպրոցներ',
        'Ձեր աշակերտների քարտերի առաջխաղացում — գործնական աշխատանք իրական հետագնումներով, կարծիքներով և անալիտիկայով:',
        'Դասընթացներ և մարաթոններ',
        'Ցույց տվեք աշակերտների արդյունքները իրական դեպքերով՝ հետագնումներ, կարծիքներ, դիրքերի աճ WB-ում:'
      ]
    },
    {
      key: 'home__contact_cta', page: 'home', sort: 56,
      titleRu: 'Home: Свяжитесь с нами', titleAm: 'Home: Կապ',
      // [0] eyebrow, [1] h2, [2] desc, [3] whatsapp_btn, [4] callback_btn, [5] contacts_btn
      textsRu: [
        'Свяжитесь с нами',
        'Готовы вывести ваш товар в ТОП?',
        'Напишите в WhatsApp или Telegram, либо закажите обратный звонок — менеджер ответит в течение 5 минут.',
        'WhatsApp',
        'Перезвоните мне',
        'Все контакты'
      ],
      textsAm: [
        'Կապվեք մեզ հետ',
        'Պատրա՞ստ եք բարձրացնել ձեր ապրանքը TOP-ում',
        'Գրեք WhatsApp կամ Telegram-ով, կամ պատվիրեք հետադարձ զանգ — մենեջերը կպատասխանի 5 րոպեի ընթացքում:',
        'WhatsApp',
        'Հետ զանգահարեք',
        'Բոլոր կոնտակտները'
      ]
    },
    // ===== calculator (sort 70-73) =====
    {
      key: 'calculator__hero', page: 'calculator', sort: 70,
      titleRu: 'Calculator: Hero', titleAm: 'Calculator: Hero',
      // [0] eyebrow, [1] h1_line1, [2] h1_line2_grad, [3] desc, [4..7] feature chips
      textsRu: [
        'Калькулятор',
        'Рассчитайте стоимость',
        'продвижения',
        'Выберите услуги, укажите количество, получите готовое предложение в Telegram. Прозрачные цены без скрытых комиссий.',
        'Мгновенный расчёт',
        'Готовые пакеты',
        'Без скрытых комиссий',
        'Промокод-скидка'
      ],
      textsAm: [
        'Հաշվիչ',
        'Հաշվեք առաջխաղացման',
        'արժեքը',
        'Ընտրեք ծառայությունները, նշեք քանակը, ստացեք պատրաստի առաջարկ Telegram-ով: Թափանցիկ գներ առանց թաքնված միջնորդավճարների:',
        'Ակնթարթային հաշվարկ',
        'Պատրաստի փաթեթներ',
        'Առանց թաքնված միջնորդավճարների',
        'Պրոմո-զեղչ'
      ]
    },
    {
      key: 'calculator__packages_header', page: 'calculator', sort: 71,
      titleRu: 'Calculator: Заголовок пакетов', titleAm: 'Calculator: Փաթեթների վերնագիր',
      // [0] h2, [1] sub
      textsRu: [
        'Готовые пакеты + индивидуальный расчёт',
        'Выберите готовый пакет или соберите свой набор услуг — система пересчитает итог в реальном времени.'
      ],
      textsAm: [
        'Պատրաստի փաթեթներ + անհատական հաշվարկ',
        'Ընտրեք պատրաստի փաթեթ կամ ստեղծեք ձեր սեփական ծառայությունների հավաքածուն — համակարգը կվերահաշվի ընդհանուրը իրական ժամանակում:'
      ]
    },
    {
      key: 'calculator__how_to', page: 'calculator', sort: 72,
      titleRu: 'Calculator: Как пользоваться', titleAm: 'Calculator: Ինչպես օգտվել',
      // header (eyebrow + h2) + 3 cards × (title + desc) = 2 + 6 = 8
      textsRu: [
        'Как пользоваться',
        'Три простых шага',
        'Выберите пакет',
        'Готовый набор услуг с фиксированной ценой — нажмите на пакет и переходите к оформлению.',
        'Соберите вручную',
        'Откройте табы калькулятора, выберите услуги и количество. Итог обновляется в реальном времени.',
        'Введите промокод',
        'Получите дополнительную скидку или бесплатные услуги по партнёрскому коду от блогеров и менеджеров.'
      ],
      textsAm: [
        'Ինչպես օգտվել',
        'Երեք պարզ քայլ',
        'Ընտրեք փաթեթը',
        'Պատրաստի ծառայությունների հավաքածու ֆիքսված գնով — սեղմեք փաթեթի վրա և անցեք ձևակերպման:',
        'Հավաքեք ձեռքով',
        'Բացեք հաշվիչի թաբերը, ընտրեք ծառայությունները և քանակը: Ընդհանուրը թարմացվում է իրական ժամանակում:',
        'Մուտքագրեք պրոմո-կոդը',
        'Ստացեք լրացուցիչ զեղչ կամ անվճար ծառայություններ բլոգերներից ու մենեջերներից գործընկերային կոդով:'
      ]
    },
    {
      key: 'calculator__cta_strip', page: 'calculator', sort: 73,
      titleRu: 'Calculator: CTA полоса', titleAm: 'Calculator: CTA',
      // [0] h3, [1] sub, [2] whatsapp_btn, [3] telegram_btn, [4] callback_btn
      textsRu: [
        'Готовы оформить?',
        'Напишите в WhatsApp или Telegram с готовым расчётом, либо закажите обратный звонок.',
        'WhatsApp',
        'Telegram',
        'Перезвоните мне'
      ],
      textsAm: [
        'Պատրա՞ստ եք ձևակերպել',
        'Գրեք WhatsApp կամ Telegram-ով պատրաստի հաշվարկով, կամ պատվիրեք հետադարձ զանգ:',
        'WhatsApp',
        'Telegram',
        'Հետ զանգահարեք'
      ]
    },
    // ===== package detail page chrome (sort 80) =====
    {
      key: 'package__chrome', page: 'package', sort: 80,
      titleRu: 'Package: Подписи', titleAm: 'Package: Տեքստեր',
      // [0] back_link, [1] eyebrow, [2] price_label, [3] order_btn, [4] calculator_btn, [5] others_h2, [6] others_more
      textsRu: ['Все пакеты', 'Пакет', 'Стоимость', 'Заказать пакет', 'Рассчитать стоимость', 'Другие пакеты', 'Подробнее'],
      textsAm: ['Բոլոր փաթեթները', 'Փաթեթ', 'Արժեք', 'Պատվիրել փաթեթը', 'Հաշվել արժեքը', 'Այլ փաթեթներ', 'Մանրամասն']
    },
    // ===== blog chrome (sort 90) =====
    {
      key: 'blog__chrome', page: 'blog', sort: 90,
      titleRu: 'Blog: Подписи', titleAm: 'Blog: Տեքստեր',
      // [0] hero_eyebrow, [1] hero_title, [2] hero_sub, [3] all_chip, [4] empty_state, [5] read_more, [6] back_to_list, [7] related_h2, [8] cta_h3, [9] cta_text, [10] cta_btn
      textsRu: [
        'Блог',
        'Статьи',
        'Кейсы, разборы и инструкции по продвижению на Wildberries — от команды Go to Top.',
        'Все',
        'Здесь пока ничего нет — мы готовим новые материалы.',
        'Читать →',
        'Вернуться в блог',
        'Другие статьи',
        'Понравилась статья?',
        'Подпишитесь на наш Telegram, чтобы не пропускать новые материалы.',
        'Подписаться'
      ],
      textsAm: [
        'Բլոգ',
        'Հոդվածներ',
        'Դեպքեր, վերլուծություններ և ուղեցույցներ Wildberries-ում առաջխաղացման մասին — Go to Top-ի թիմից:',
        'Բոլորը',
        'Այստեղ դեռ ոչինչ չկա — մենք պատրաստում ենք նոր նյութեր:',
        'Կարդալ →',
        'Վերադառնալ բլոգ',
        'Այլ հոդվածներ',
        'Հավանեցի՞ք հոդվածը',
        'Բաժանորդագրվեք մեր Telegram-ին՝ նոր նյութերը բաց չթողնելու համար:',
        'Բաժանորդագրվել'
      ]
    }
  ];

  for (const b of PRO_BLOCKS) {
    if (b.textsRu.length !== b.textsAm.length) {
      return c.json({ error: `Block ${b.key}: texts_ru/texts_am length mismatch (${b.textsRu.length} vs ${b.textsAm.length})` }, 500);
    }
  }

  let inserted = 0;
  for (const b of PRO_BLOCKS) {
    const res = await db.prepare(
      'INSERT OR IGNORE INTO site_blocks (block_key, page, block_type, title_ru, title_am, texts_ru, texts_am, images, buttons, custom_css, custom_html, is_visible, sort_order, social_links, text_styles) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      b.key, b.page, 'subpage', b.titleRu, b.titleAm,
      JSON.stringify(b.textsRu), JSON.stringify(b.textsAm),
      '[]', '[]', '', '{}', 1, b.sort, '[]', '[]'
    ).run();
    const changes = res?.meta && (res.meta as any).changes;
    if (typeof changes === 'number' && changes > 0) inserted++;
  }

  return c.json({ success: true, total: PRO_BLOCKS.length, inserted });
});

}
