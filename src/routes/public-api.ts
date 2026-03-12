/**
 * Public API routes — site data, leads, health, slots, tracking, referral, footer, photo blocks
 */
import { Hono } from 'hono'
import { initDatabase } from '../lib/db'
import { SEED_CONTENT_SECTIONS, SEED_CALC_TABS, SEED_CALC_SERVICES, SEED_TG_MESSAGES } from '../seed-data'
import { notifyTelegram } from '../helpers/telegram'

type Bindings = { DB: D1Database }

export function register(app: Hono<{ Bindings: Bindings }>) {
// ===== PUBLIC API: Site data from D1 (for dynamic rendering) =====
app.get('/api/site-data', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    
    // Load all content sections from DB
    const contentRes = await db.prepare('SELECT section_key, content_json FROM site_content ORDER BY sort_order').all();
    const dbContent: Record<string, any[]> = {};
    for (const row of contentRes.results) {
      try { dbContent[row.section_key as string] = JSON.parse(row.content_json as string); } catch { dbContent[row.section_key as string] = []; }
    }
    
    // Build text_map: original_ru -> {ru, am} using smart content-aware matching
    // The HTML has data-ru="original text" hardcoded from seed. We need to find which DB items
    // correspond to which seed items, even when DB has fewer items (missing CTA buttons etc.)
    const textMap: Record<string, {ru: string, am: string}> = {};
    for (const seedSection of SEED_CONTENT_SECTIONS) {
      const dbItems = dbContent[seedSection.key] || [];
      if (!dbItems.length) continue;
      
      const seedLen = seedSection.items.length;
      const dbLen = dbItems.length;
      const seedMatched = new Array(seedLen).fill(-1);
      const dbMatched = new Array(dbLen).fill(-1);
      
      // First pass: exact text matches (prefer same position, then nearby)
      for (let si = 0; si < seedLen; si++) {
        const seedRu = seedSection.items[si].ru;
        if (si < dbLen && dbMatched[si] === -1 && dbItems[si].ru === seedRu) {
          seedMatched[si] = si; dbMatched[si] = si; continue;
        }
        for (let offset = 1; offset <= 3; offset++) {
          for (const di of [si - offset, si + offset]) {
            if (di >= 0 && di < dbLen && dbMatched[di] === -1 && dbItems[di].ru === seedRu) {
              seedMatched[si] = di; dbMatched[di] = si; break;
            }
          }
          if (seedMatched[si] !== -1) break;
        }
      }
      
      // Second pass: match remaining unmatched items sequentially
      let nextUnmatchedDb = 0;
      for (let si = 0; si < seedLen; si++) {
        if (seedMatched[si] !== -1) continue;
        while (nextUnmatchedDb < dbLen && dbMatched[nextUnmatchedDb] !== -1) nextUnmatchedDb++;
        if (nextUnmatchedDb < dbLen) {
          seedMatched[si] = nextUnmatchedDb;
          dbMatched[nextUnmatchedDb] = si;
          nextUnmatchedDb++;
        }
      }
      
      for (let si = 0; si < seedLen; si++) {
        const di = seedMatched[si];
        if (di === -1) continue;
        const origRu = seedSection.items[si].ru;
        const dbItem = dbItems[di];
        if (dbItem && (dbItem.ru !== origRu || dbItem.am !== seedSection.items[si].am)) {
          textMap[origRu] = { ru: dbItem.ru, am: dbItem.am };
        }
      }
    }
    
    // Load calculator tabs
    const tabsRes = await db.prepare('SELECT * FROM calculator_tabs WHERE is_active = 1 ORDER BY sort_order').all();
    
    // Load calculator services with tiers
    const svcsRes = await db.prepare(`
      SELECT cs.*, ct.tab_key 
      FROM calculator_services cs 
      JOIN calculator_tabs ct ON cs.tab_id = ct.id 
      WHERE cs.is_active = 1 
      ORDER BY cs.tab_id, cs.sort_order
    `).all();
    
    // Load calculator packages with items
    let packagesData: any[] = [];
    try {
      const pkgsRes = await db.prepare('SELECT * FROM calculator_packages WHERE is_active = 1 ORDER BY sort_order, id').all();
      const pkgItemsRes = await db.prepare('SELECT pi.*, cs.name_ru as service_name_ru, cs.name_am as service_name_am, cs.price as service_price, cs.price_type, cs.price_tiers_json FROM calculator_package_items pi LEFT JOIN calculator_services cs ON pi.service_id = cs.id').all();
      const itemsByPkg: Record<number, any[]> = {};
      for (const it of pkgItemsRes.results) { const pid = it.package_id as number; if (!itemsByPkg[pid]) itemsByPkg[pid] = []; itemsByPkg[pid].push(it); }
      packagesData = (pkgsRes.results || []).map((p: any) => ({ ...p, items: itemsByPkg[p.id] || [] }));
    } catch {}
    
    // Load telegram messages
    const tgRes = await db.prepare('SELECT * FROM telegram_messages WHERE is_active = 1 ORDER BY sort_order').all();
    const telegram: Record<string, any> = {};
    for (const row of tgRes.results) { telegram[row.button_key as string] = row; }
    
    // Load custom scripts
    const scriptsRes = await db.prepare('SELECT * FROM custom_scripts WHERE is_active = 1 ORDER BY sort_order').all();
    const scripts = { head: [] as string[], body_start: [] as string[], body_end: [] as string[] };
    for (const row of scriptsRes.results) {
      const p = row.placement as string;
      const code = row.code as string;
      if (p === 'head') scripts.head.push(code);
      else if (p === 'body_start') scripts.body_start.push(code);
      else if (p === 'body_end') scripts.body_end.push(code);
    }
    
    // Load section order
    const sectionOrderRes = await db.prepare('SELECT * FROM section_order ORDER BY sort_order').all();
    
    // Load slot counters (for frontend rendering)
    const slotCountersRes = await db.prepare('SELECT * FROM slot_counter WHERE show_timer = 1 ORDER BY id').all();
    
    // Load photo blocks (for frontend rendering)
    const photoBlocksRes = await db.prepare('SELECT * FROM photo_blocks WHERE is_visible = 1 ORDER BY sort_order').all();
    
    // Load ticker items from site_blocks (editable in admin)
    let tickerItems: any[] = [];
    try {
      const tickerBlock = await db.prepare("SELECT texts_ru, texts_am, images FROM site_blocks WHERE block_key = 'ticker' LIMIT 1").first();
      if (tickerBlock) {
        const tRu = JSON.parse(tickerBlock.texts_ru as string || '[]');
        const tAm = JSON.parse(tickerBlock.texts_am as string || '[]');
        const tIcons = JSON.parse(tickerBlock.images as string || '[]');
        for (let i = 0; i < Math.max(tRu.length, tAm.length); i++) {
          tickerItems.push({ icon: tIcons[i] || 'fa-check-circle', ru: tRu[i] || '', am: tAm[i] || '' });
        }
      }
    } catch(te) { /* ticker not yet imported */ }

    // Load footer social links from site_blocks
    let footerSocials: any[] = [];
    try {
      const footerBlock = await db.prepare("SELECT social_links FROM site_blocks WHERE block_key = 'footer' LIMIT 1").first();
      if (footerBlock && footerBlock.social_links) {
        footerSocials = JSON.parse(footerBlock.social_links as string || '[]');
      }
    } catch(fe) { /* footer not yet imported */ }

    // Load all site_blocks for per-block features (social links, photos, slots, custom_html)
    let siteBlockFeatures: any[] = [];
    try {
      // Ensure text_styles column exists (safe ALTER — no-op if already present)
      try { await db.prepare("ALTER TABLE site_blocks ADD COLUMN text_styles TEXT DEFAULT '[]'").run(); } catch {}
      try { await db.prepare("ALTER TABLE site_blocks ADD COLUMN photo_url TEXT DEFAULT ''").run(); } catch {}
      const blocksRes = await db.prepare("SELECT block_key, block_type, social_links, images, buttons, custom_html, is_visible, texts_ru, texts_am, text_styles, photo_url FROM site_blocks WHERE is_visible = 1 ORDER BY sort_order").all();
      for (const blk of (blocksRes.results || [])) {
        let socials: any[] = [];
        try { 
          let parsed = JSON.parse(blk.social_links as string || '[]'); 
          // Handle double-encoded JSON strings
          if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { parsed = []; } }
          socials = Array.isArray(parsed) ? parsed : [];
        } catch { socials = []; }
        let blockOpts: any = {};
        try { blockOpts = JSON.parse(blk.custom_html as string || '{}'); } catch { blockOpts = {}; }
        let blockPhotos: any[] = [];
        try { blockPhotos = Array.isArray(blockOpts.photos) ? blockOpts.photos : []; } catch { blockPhotos = []; }
        let blockBtns: any[] = [];
        try { blockBtns = JSON.parse(blk.buttons as string || '[]'); } catch { blockBtns = []; }
        // Parse texts for slot_counter blocks (needed for labels)
        let textsRu: string[] = [];
        let textsAm: string[] = [];
        try { textsRu = JSON.parse(blk.texts_ru as string || '[]'); } catch { textsRu = []; }
        try { textsAm = JSON.parse(blk.texts_am as string || '[]'); } catch { textsAm = []; }
        siteBlockFeatures.push({
            key: blk.block_key,
            social_links: socials,
            social_settings: blockOpts.social_settings || {},
            photos: blockPhotos,
            photo_url: (blk as any).photo_url || blockOpts.photo_url || '',
            show_socials: socials.length > 0 || blockOpts.show_socials || false,
            show_photos: blockPhotos.length > 0 || blockOpts.show_photos || false,
            show_slots: blockOpts.show_slots || false,
            block_type: blk.block_type || 'section',
            buttons: blockBtns,
            // Slot counter data (from custom_html)
            total_slots: blockOpts.total_slots || 0,
            booked_slots: blockOpts.booked_slots || 0,
            // Text labels for slot counters and other blocks
            texts_ru: textsRu,
            texts_am: textsAm,
            text_styles: (() => { try { return JSON.parse((blk as any).text_styles as string || '[]'); } catch { return []; } })(),
            // Nav links mapping (for nav block)
            nav_links: blockOpts.nav_links || [],
            // Element order within section (for frontend reordering)
            element_order: blockOpts.element_order || [],
            // Photo display settings
            photo_settings: blockOpts.photo_settings || {},
            // Swipe hint text (reviews blocks)
            swipe_hint_ru: blockOpts.swipe_hint_ru || '',
            swipe_hint_am: blockOpts.swipe_hint_am || '',
            // Contact cards (for contact block messenger links)
            options: { contact_cards: blockOpts.contact_cards || null },
          });
      }
    } catch(bf) { /* blocks not yet imported */ }

    // Set Cache-Control to no-cache so edits appear instantly
    // Load site settings (package titles, etc.)
    let siteSettings: Record<string, string> = {};
    try {
      const settingsRes = await db.prepare("SELECT key, value FROM site_settings WHERE key LIKE 'packages_%'").all();
      for (const row of (settingsRes.results || [])) { siteSettings[row.key as string] = row.value as string; }
    } catch {}

    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
    return c.json({
      content: dbContent,
      textMap, // original_ru -> {ru, am} for changed texts only
      tabs: tabsRes.results,
      services: svcsRes.results,
      packages: packagesData,
      telegram,
      scripts,
      settings: siteSettings,
      sectionOrder: (function() {
        // Deduplicate sectionOrder: keep only one entry per normalized ID (hyphen version wins)
        var seen = {};
        var deduped = [];
        for (var _i = 0; _i < sectionOrderRes.results.length; _i++) {
          var _s = sectionOrderRes.results[_i] as any;
          var norm = (_s.section_id || '').replace(/_/g, '-');
          if (!seen[norm]) { seen[norm] = true; deduped.push(_s); }
        }
        return deduped;
      })(),
      slotCounters: slotCountersRes.results,
      photoBlocks: photoBlocksRes.results,
      tickerItems: tickerItems.length > 0 ? tickerItems : null,
      footerSocials: footerSocials.length > 0 ? footerSocials : null,
      blockFeatures: siteBlockFeatures.length > 0 ? siteBlockFeatures : [],
      _ts: Date.now()
    });
  } catch (e: any) {
    // If DB not initialized yet, return empty — frontend will use hardcoded fallback
    return c.json({ content: {}, textMap: {}, tabs: [], services: [], packages: [], telegram: {}, scripts: { head: [], body_start: [], body_end: [] }, sectionOrder: [], slotCounters: [], photoBlocks: [], tickerItems: null, footerSocials: null, _ts: Date.now() });
  }
});

app.post('/api/lead', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const body = await c.req.json();
    const ua = c.req.header('User-Agent') || '';
    // Get next lead number
    const lastLead = await db.prepare('SELECT MAX(lead_number) as max_num FROM leads').first();
    const nextNum = ((lastLead?.max_num as number) || 0) + 1;
    // Build auto-notes from contact form data
    const notesParts: string[] = [];
    if (body.product) notesParts.push(`Товар: ${body.product}`);
    if (body.service) notesParts.push(`Услуга: ${body.service}`);
    if (body.message) notesParts.push(`Комментарий: ${body.message}`);
    const autoNotes = notesParts.join(' | ');
    await db.prepare('INSERT INTO leads (lead_number, source, name, contact, product, service, message, lang, referral_code, user_agent, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(nextNum, 'form', body.name||'', body.contact||'', body.product||'', body.service||'', body.message||'', body.lang||'ru', body.referral_code||'', ua.substring(0,200), autoNotes).run();
    notifyTelegram(db, { ...body, source: 'form' });
    return c.json({ success: true, message: 'Lead received' });
  } catch (e) {
    console.error('Lead error:', e);
    return c.json({ error: 'Failed to save lead' }, 500);
  }
})

// API endpoint for popup form -> save + notify
app.post('/api/popup-lead', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const body = await c.req.json();
    const ua = c.req.header('User-Agent') || '';
    // Get next lead number
    const lastLead = await db.prepare('SELECT MAX(lead_number) as max_num FROM leads').first();
    const nextNum = ((lastLead?.max_num as number) || 0) + 1;
    // Build notes from popup form data (buyouts, reviews)
    const autoNotes = body.notes || '';
    await db.prepare('INSERT INTO leads (lead_number, source, name, contact, product, service, message, lang, user_agent, notes) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(nextNum, 'popup', body.name||'', body.contact||'', body.product||'', body.service||'', body.message||'', body.lang||'ru', ua.substring(0,200), autoNotes).run();
    notifyTelegram(db, { ...body, source: 'popup', message: autoNotes });
    return c.json({ success: true, message: 'Lead received' });
  } catch (e) {
    console.error('Popup lead error:', e);
    return c.json({ error: 'Failed to save lead' }, 500);
  }
})

// NOTE: /api/button-lead endpoint REMOVED — button clicks should NOT create leads.
// Leads are only created from: /api/lead (contact form), /api/popup-lead (popup form), /api/generate-pdf (calculator).

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ===== PUBLIC SLOT COUNTERS (multiple) =====
app.get('/api/slots', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const rows = await db.prepare('SELECT * FROM slot_counter ORDER BY id').all();
    if (!rows.results || rows.results.length === 0) return c.json({ counters: [] });
    const counters = rows.results.map((row: any) => ({
      id: row.id,
      counter_name: row.counter_name || 'main',
      total: row.total_slots, booked: row.booked_slots,
      free: Math.max(0, (row.total_slots as number) - (row.booked_slots as number)),
      label_ru: row.label_ru, label_am: row.label_am, show_timer: row.show_timer,
      position: row.position || 'after-hero'
    }));
    return c.json({ counters });
  } catch { return c.json({ counters: [] }); }
})


app.post('/api/track', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const body = await c.req.json();
    await db.prepare('INSERT INTO page_views (page, referrer, user_agent, lang, country) VALUES (?,?,?,?,?)')
      .bind(body.page || '/', body.referrer || '', body.ua || '', body.lang || 'ru', body.country || '').run();
    return c.json({ ok: true });
  } catch { return c.json({ ok: true }); }
})

// ===== REFERRAL CODE VALIDATION =====
app.post('/api/referral/check', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const { code } = await c.req.json();
    if (!code) return c.json({ valid: false });
    const row = await db.prepare('SELECT * FROM referral_codes WHERE code = ? AND is_active = 1').bind(code.trim().toUpperCase()).first();
    if (!row) return c.json({ valid: false });
    
    // Check max_uses limit: count leads with paid statuses that used this code
    const maxUses = Number(row.max_uses) || 0;
    if (maxUses > 0) {
      const paidCount = await db.prepare(
        "SELECT COUNT(*) as cnt FROM leads WHERE UPPER(referral_code) = ? AND status IN ('in_progress','checking','done')"
      ).bind(String(row.code).toUpperCase()).first();
      const currentPaid = Number(paidCount?.cnt) || 0;
      if (currentPaid >= maxUses) {
        return c.json({ 
          valid: false, 
          reason: 'limit_reached',
          message_ru: 'Лимит использований промокода исчерпан',
          message_am: '\u054a\u0580\u0578\u0574\u0578\u056f\u0578\u0564\u056b \u0585\u0563\u057f\u0561\u0563\u0578\u0580\u056e\u0574\u0561\u0576 \u057d\u0561\u0570\u0574\u0561\u0576\u0568 \u057d\u057a\u0561\u057c\u057e\u0565\u056c \u0567'
        });
      }
    }
    
    // Increment uses count
    await db.prepare('UPDATE referral_codes SET uses_count = uses_count + 1 WHERE id = ?').bind(row.id).run();
    
    // Get free services for this referral code
    let freeServices: any[] = [];
    try {
      const fsRes = await db.prepare(
        'SELECT rfs.*, cs.name_ru, cs.name_am, cs.price FROM referral_free_services rfs LEFT JOIN calculator_services cs ON rfs.service_id = cs.id WHERE rfs.referral_code_id = ?'
      ).bind(row.id).all();
      freeServices = (fsRes.results || []).map((fs: any) => ({
        name_ru: fs.name_ru || '',
        name_am: fs.name_am || '',
        price: fs.price || 0,
        discount_percent: fs.discount_percent || 0
      }));
    } catch {}
    
    // Parse linked_packages and linked_services
    let linkedPackages: number[] = [];
    let linkedServices: number[] = [];
    try { linkedPackages = JSON.parse((row.linked_packages as string) || '[]'); } catch { linkedPackages = []; }
    try { linkedServices = JSON.parse((row.linked_services as string) || '[]'); } catch { linkedServices = []; }
    
    return c.json({
      valid: true,
      discount_percent: row.discount_percent,
      description: row.description,
      free_services: freeServices,
      linked_packages: linkedPackages,
      linked_services: linkedServices,
      apply_to_packages: row.apply_to_packages || 0
    });
  } catch { return c.json({ valid: false }); }
})

// ===== PUBLIC FOOTER SETTINGS =====
app.get('/api/footer', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    let row = await db.prepare('SELECT * FROM footer_settings LIMIT 1').first();
    if (!row) return c.json({});
    return c.json(row);
  } catch { return c.json({}); }
})

// ===== PUBLIC PHOTO BLOCKS =====
app.get('/api/photo-blocks', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    const rows = await db.prepare('SELECT * FROM photo_blocks WHERE is_visible = 1 ORDER BY sort_order').all();
    return c.json({ blocks: rows.results || [] });
  } catch { return c.json({ blocks: [] }); }
})

}
