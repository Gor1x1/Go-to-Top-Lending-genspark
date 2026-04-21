/**
 * Admin API — Site blocks constructor, import, sync, image upload/serving
 */
import { Hono } from 'hono'
import { SEED_CONTENT_SECTIONS } from '../../seed-data'
type Bindings = { DB: D1Database }
type AuthMiddleware = (c: any, next: () => Promise<void>) => Promise<any>

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
  
  // Clear existing site_blocks
  await db.prepare('DELETE FROM site_blocks').run();
  
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
        // Preserve ALL existing custom_html if it has meaningful settings (photos, show_slots, etc.)
        if ((existOpts.photos && existOpts.photos.length > 0) || existOpts.show_slots || existOpts.show_photos || existOpts.bg_class) {
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

// ===== UPLOAD IMAGE (base64 in D1) =====
api.post('/upload-image', authMiddleware, async (c) => {
  const db = c.env.DB;
  try {
    const body = await c.req.parseBody();
    const file = body['file'] as any;
    if (!file || !file.arrayBuffer) return c.json({ error: 'No file' }, 400);
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const mimeType = file.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const blockId = body['block_id'] ? parseInt(body['block_id'] as string) : null;
    const filename = file.name || 'image.jpg';
    await db.prepare('INSERT INTO uploads (filename, mime_type, data_base64, block_id) VALUES (?,?,?,?)')
      .bind(filename, mimeType, dataUrl, blockId).run();
    const lastRow = await db.prepare('SELECT id FROM uploads ORDER BY id DESC LIMIT 1').first();
    const imageId = lastRow ? lastRow.id : 0;
    return c.json({ success: true, url: `/api/admin/uploads/${imageId}`, id: imageId, data_url: dataUrl });
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
  // IMPORTANT: Use lead DB field as primary source; only fall back to calcData if DB field is null (not empty string)
  // When admin clears the code, leadRow.referral_code = '' — must NOT fall back to old calcData value
  const leadRefCode = leadRow.referral_code as string;
  const referralCode = (leadRefCode !== null && leadRefCode !== undefined && leadRefCode !== '') ? leadRefCode : (existingCalcData?.referralCode || '');
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

}
