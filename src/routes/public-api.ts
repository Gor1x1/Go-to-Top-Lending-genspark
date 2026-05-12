/**
 * Public API routes — site data, leads, health, slots, tracking, referral, footer, photo blocks
 */
import { Hono } from 'hono'
import { initDatabase } from '../lib/db'
import { SEED_CONTENT_SECTIONS, SEED_CALC_TABS, SEED_CALC_SERVICES, SEED_TG_MESSAGES } from '../seed-data'
import { notifyTelegram } from '../helpers/telegram'

type Bindings = { DB: D1Database }

// Simple in-memory rate limiter (per worker instance)
const rateLimits: Record<string, { count: number; resetAt: number }> = {};
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  if (!rateLimits[key] || rateLimits[key].resetAt < now) {
    rateLimits[key] = { count: 1, resetAt: now + windowMs };
    return true;
  }
  rateLimits[key].count++;
  return rateLimits[key].count <= maxRequests;
}

export function register(app: Hono<{ Bindings: Bindings }>) {
// ===== PUBLIC API: Site data from D1 (for dynamic rendering) =====
app.get('/api/site-data', async (c) => {
  try {
    const db = c.env.DB;
    await initDatabase(db);
    
    // === PARALLEL: Run all DB queries at once for speed ===
    const [
      contentRes, tabsRes, svcsRes, pkgsRes, pkgItemsRes,
      tgRes, scriptsRes, sectionOrderRes, slotCountersRes,
      photoBlocksRes, tickerBlock, footerBlock, blocksRes, settingsRes
    ] = await Promise.all([
      db.prepare('SELECT section_key, content_json FROM site_content ORDER BY sort_order').all(),
      db.prepare('SELECT * FROM calculator_tabs WHERE is_active = 1 ORDER BY sort_order').all(),
      db.prepare('SELECT cs.*, ct.tab_key FROM calculator_services cs JOIN calculator_tabs ct ON cs.tab_id = ct.id WHERE cs.is_active = 1 ORDER BY cs.tab_id, cs.sort_order').all(),
      db.prepare('SELECT * FROM calculator_packages WHERE is_active = 1 ORDER BY sort_order, id').all().catch(() => ({ results: [] })),
      db.prepare('SELECT pi.*, cs.name_ru as service_name_ru, cs.name_am as service_name_am, cs.price as service_price, cs.price_rub as service_price_rub, cs.price_type, cs.price_tiers_json, cs.price_tiers_rub_json FROM calculator_package_items pi LEFT JOIN calculator_services cs ON pi.service_id = cs.id').all().catch(() => ({ results: [] })),
      db.prepare('SELECT * FROM telegram_messages WHERE is_active = 1 ORDER BY sort_order').all(),
      db.prepare('SELECT * FROM custom_scripts WHERE is_active = 1 ORDER BY sort_order').all(),
      db.prepare('SELECT * FROM section_order ORDER BY sort_order').all(),
      db.prepare('SELECT * FROM slot_counter WHERE show_timer = 1 ORDER BY id').all(),
      db.prepare('SELECT * FROM photo_blocks WHERE is_visible = 1 ORDER BY sort_order').all(),
      db.prepare("SELECT texts_ru, texts_am, images FROM site_blocks WHERE block_key = 'ticker' LIMIT 1").first().catch(() => null),
      db.prepare("SELECT social_links FROM site_blocks WHERE block_key = 'footer' LIMIT 1").first().catch(() => null),
      // Phase 3C: exclude subpage blocks (block_key with '__' prefix) — they
      // belong to /services /buyouts /about /faq /contacts /referral and are
      // loaded server-side by loadSubpageBlocks() in landing.ts. Including
      // them here would pollute the home page's __SITE_DATA / textMap.
      // Note: SQL LIKE treats '_' as a single-char wildcard, so we add a
      // belt-and-suspenders JS filter on `.startsWith` of any subpage prefix.
      db.prepare("SELECT block_key, block_type, social_links, images, buttons, custom_html, is_visible, texts_ru, texts_am, text_styles, photo_url FROM site_blocks WHERE is_visible = 1 AND block_key NOT LIKE '%\\_\\_%' ESCAPE '\\' ORDER BY sort_order").all().catch(() => ({ results: [] })),
      db.prepare("SELECT key, value FROM site_settings WHERE key LIKE 'packages_%' OR key = 'amd_to_rub_rate'").all().catch(() => ({ results: [] })),
    ]);

    // Phase 3: landing_packages — separate query (lightweight) so a missing
    // table on first deploy doesn't break the whole /api/site-data response.
    const landingPkgsRes = await db.prepare(
      'SELECT id, slug, title_ru, title_am, description_ru, description_am, price_text_ru, price_text_am, cover_url, sort_order FROM landing_packages WHERE is_visible = 1 ORDER BY sort_order, id'
    ).all().catch(() => ({ results: [] }));
    
    // Parse content
    const dbContent: Record<string, any[]> = {};
    for (const row of contentRes.results) {
      try { dbContent[row.section_key as string] = JSON.parse(row.content_json as string); } catch { dbContent[row.section_key as string] = []; }
    }
    
    // Build text_map: original_ru -> {ru, am}
    const textMap: Record<string, {ru: string, am: string}> = {};
    for (const seedSection of SEED_CONTENT_SECTIONS) {
      const dbItems = dbContent[seedSection.key] || [];
      if (!dbItems.length) continue;
      const seedLen = seedSection.items.length;
      const dbLen = dbItems.length;
      const seedMatched = new Array(seedLen).fill(-1);
      const dbMatched = new Array(dbLen).fill(-1);
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
      let nextUnmatchedDb = 0;
      for (let si = 0; si < seedLen; si++) {
        if (seedMatched[si] !== -1) continue;
        while (nextUnmatchedDb < dbLen && dbMatched[nextUnmatchedDb] !== -1) nextUnmatchedDb++;
        if (nextUnmatchedDb < dbLen) {
          seedMatched[si] = nextUnmatchedDb; dbMatched[nextUnmatchedDb] = si; nextUnmatchedDb++;
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
    
    // Packages with items
    const itemsByPkg: Record<number, any[]> = {};
    for (const it of (pkgItemsRes.results || [])) { const pid = it.package_id as number; if (!itemsByPkg[pid]) itemsByPkg[pid] = []; itemsByPkg[pid].push(it); }
    const packagesData = (pkgsRes.results || []).map((p: any) => ({ ...p, items: itemsByPkg[p.id] || [] }));
    
    // Telegram messages
    const telegram: Record<string, any> = {};
    for (const row of tgRes.results) { telegram[row.button_key as string] = row; }
    
    // Scripts
    const scripts = { head: [] as string[], body_start: [] as string[], body_end: [] as string[] };
    for (const row of scriptsRes.results) {
      const p = row.placement as string;
      const code = row.code as string;
      if (p === 'head') scripts.head.push(code);
      else if (p === 'body_start') scripts.body_start.push(code);
      else if (p === 'body_end') scripts.body_end.push(code);
    }
    
    // Ticker
    let tickerItems: any[] = [];
    if (tickerBlock) {
      try {
        const tRu = JSON.parse(tickerBlock.texts_ru as string || '[]');
        const tAm = JSON.parse(tickerBlock.texts_am as string || '[]');
        const tIcons = JSON.parse(tickerBlock.images as string || '[]');
        for (let i = 0; i < Math.max(tRu.length, tAm.length); i++) {
          tickerItems.push({ icon: tIcons[i] || 'fa-check-circle', ru: tRu[i] || '', am: tAm[i] || '' });
        }
      } catch {}
    }

    // Footer socials
    let footerSocials: any[] = [];
    if (footerBlock && footerBlock.social_links) {
      try { footerSocials = JSON.parse(footerBlock.social_links as string || '[]'); } catch {}
    }

    // Block features
    const siteBlockFeatures: any[] = [];
    for (const blk of (blocksRes.results || [])) {
      // Phase 3C belt-and-suspenders: SQL LIKE may unintentionally match
      // '_' as a wildcard if ESCAPE isn't honoured by the driver — re-filter
      // here to guarantee subpage blocks (block_key with '__') never leak
      // into the home page's __SITE_DATA payload.
      if (typeof blk.block_key === 'string' && blk.block_key.includes('__')) continue;
      // The legacy `nav` block holds the obsolete 6-item anchor-based menu
      // (Услуги / Почему мы / Калькулятор / Гарантии / FAQ / Контакты →
      // `#about` …). Both the legacy `/` page and every renderPageShell
      // subpage now SSR the canonical 9-item subpage nav (/home, /about,
      // /services, …); admins edit the labels via the `shell__nav` block
      // which the SSR honors. Exposing `nav` to landing.js caused the
      // client-side rebuild to overwrite the correct SSR nav with the old
      // anchor links — defense-in-depth: don't send it at all so older
      // cached landing.js bundles also see nothing to rebuild from.
      if (blk.block_key === 'nav') continue;
      let socials: any[] = [];
      try { let parsed = JSON.parse(blk.social_links as string || '[]'); if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { parsed = []; } } socials = Array.isArray(parsed) ? parsed : []; } catch {}
      let blockOpts: any = {};
      try { blockOpts = JSON.parse(blk.custom_html as string || '{}'); } catch {}
      let blockPhotos: any[] = [];
      try { blockPhotos = Array.isArray(blockOpts.photos) ? blockOpts.photos : []; } catch {}
      let blockBtns: any[] = [];
      try { blockBtns = JSON.parse(blk.buttons as string || '[]'); } catch {}
      let textsRu: string[] = []; let textsAm: string[] = [];
      try { textsRu = JSON.parse(blk.texts_ru as string || '[]'); } catch {}
      try { textsAm = JSON.parse(blk.texts_am as string || '[]'); } catch {}
      siteBlockFeatures.push({
        key: blk.block_key, social_links: socials, social_settings: blockOpts.social_settings || {},
        photos: blockPhotos, photo_url: (blk as any).photo_url || blockOpts.photo_url || '',
        show_socials: socials.length > 0 || blockOpts.show_socials || false,
        show_photos: blockPhotos.length > 0 || blockOpts.show_photos || false,
        show_slots: blockOpts.show_slots || false, block_type: blk.block_type || 'section',
        buttons: blockBtns, total_slots: blockOpts.total_slots || 0, booked_slots: blockOpts.booked_slots || 0,
        texts_ru: textsRu, texts_am: textsAm,
        text_styles: (() => { try { return JSON.parse((blk as any).text_styles as string || '[]'); } catch { return []; } })(),
        nav_links: blockOpts.nav_links || [], element_order: blockOpts.element_order || [],
        photo_settings: blockOpts.photo_settings || {},
        swipe_hint_ru: blockOpts.swipe_hint_ru || '', swipe_hint_am: blockOpts.swipe_hint_am || '',
        options: { contact_cards: blockOpts.contact_cards || null },
      });
    }

    // Settings
    let siteSettings: Record<string, string> = {};
    for (const row of (settingsRes.results || [])) { siteSettings[row.key as string] = row.value as string; }

    // No caching — data changes on every admin save; must-revalidate ensures stale content is never served
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
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
      landingPackages: landingPkgsRes.results || [],
      _ts: Date.now()
    });
  } catch (e: any) {
    // If DB not initialized yet, return empty — frontend will use hardcoded fallback
    return c.json({ content: {}, textMap: {}, tabs: [], services: [], packages: [], telegram: {}, scripts: { head: [], body_start: [], body_end: [] }, sectionOrder: [], slotCounters: [], photoBlocks: [], tickerItems: null, footerSocials: null, landingPackages: [], _ts: Date.now() });
  }
});

app.post('/api/lead', async (c) => {
  try {
    // Rate limit: 10 leads per minute per IP
    const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    if (!checkRateLimit('lead:' + clientIp, 10, 60000)) {
      return c.json({ error: 'Too many requests. Please try again later.' }, 429);
    }
    const db = c.env.DB;
    await initDatabase(db);
    const body = await c.req.json();
    // Phone is mandatory — without it we cannot reach the client.
    // Defensive server-side check in case JS validation was bypassed.
    const contact = String(body.contact || '').trim();
    if (!contact || contact.replace(/\D/g, '').length < 7) {
      return c.json({ error: 'Phone is required' }, 400);
    }
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
    const leadCurrency = (body.currency === 'rub') ? 'rub' : 'amd';
    await db.prepare('INSERT INTO leads (lead_number, source, name, contact, product, service, message, lang, referral_code, user_agent, notes, currency) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(nextNum, 'form', body.name||'', contact, body.product||'', body.service||'', body.message||'', body.lang||'ru', body.referral_code||'', ua.substring(0,200), autoNotes, leadCurrency).run();
    notifyTelegram(db, { ...body, contact, source: 'form' });
    return c.json({ success: true, message: 'Lead received' });
  } catch (e) {
    console.error('Lead error:', e);
    return c.json({ error: 'Failed to save lead' }, 500);
  }
})

// API endpoint for popup form -> save + notify
app.post('/api/popup-lead', async (c) => {
  try {
    // Rate limit: 10 popup leads per minute per IP
    const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    if (!checkRateLimit('popup:' + clientIp, 10, 60000)) {
      return c.json({ error: 'Too many requests. Please try again later.' }, 429);
    }
    const db = c.env.DB;
    await initDatabase(db);
    const body = await c.req.json();
    // Phone is mandatory — without it we cannot reach the client.
    const contact = String(body.contact || '').trim();
    if (!contact || contact.replace(/\D/g, '').length < 7) {
      return c.json({ error: 'Phone is required' }, 400);
    }
    const ua = c.req.header('User-Agent') || '';
    // Get next lead number
    const lastLead = await db.prepare('SELECT MAX(lead_number) as max_num FROM leads').first();
    const nextNum = ((lastLead?.max_num as number) || 0) + 1;
    // Build notes from popup form data (buyouts, reviews)
    const autoNotes = body.notes || '';
    const popupCurrency = (body.currency === 'rub') ? 'rub' : 'amd';
    await db.prepare('INSERT INTO leads (lead_number, source, name, contact, product, service, message, lang, user_agent, notes, currency) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(nextNum, 'popup', body.name||'', contact, body.product||'', body.service||'', body.message||'', body.lang||'ru', ua.substring(0,200), autoNotes, popupCurrency).run();
    notifyTelegram(db, { ...body, contact, source: 'popup', message: autoNotes });
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
    
    // Check max_uses limit using uses_count (incremented on every PDF generation)
    const maxUses = Number(row.max_uses) || 0;
    const usesCount = Number(row.uses_count) || 0;
    if (maxUses > 0 && usesCount >= maxUses) {
      return c.json({ 
        valid: false, 
        reason: 'limit_reached',
        message_ru: 'Лимит использований промокода исчерпан',
        message_am: 'Պdelays \u054a\u0580\u0578\u0574\u0578\u056f\u0578\u0564\u056b \u0585\u0563\u057f\u0561\u0563\u0578\u0580\u056e\u0574\u0561\u0576 \u057d\u0561\u0570\u0574\u0561\u0576\u0568 \u057d\u057a\u0561\u057c\u057e\u0565\u056c \u0567'
      });
    }
    
    // Don't increment uses_count here — it's incremented only when a lead is actually created (PDF generation)
    
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
        discount_percent: fs.discount_percent || 0,
        quantity: fs.quantity || 1,
        service_id: fs.service_id
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
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
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
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    return c.json({ blocks: rows.results || [] });
  } catch { return c.json({ blocks: [] }); }
})

// ===== PUBLIC TEXT OVERRIDES (Phase 5.1) =====
// Returns all text/href overrides for a page so SSR + editor.js can apply
// them. No auth required (overrides should be visible to every visitor).
// Cache-Control no-store so changes appear within one full page reload.
app.get('/api/text-overrides/:page', async (c) => {
  try {
    const db = c.env.DB;
    const page = c.req.param('page');
    if (!page) return c.json({ overrides: {} });
    // Fetch both page-specific and shared shell overrides so the client
    // applies shell edits (floating buttons, nav CTA) made on any page.
    const rows = await db.prepare(
      'SELECT txt_id, text_ru, text_am, href FROM site_text_overrides WHERE page = ? OR page = ?'
    ).bind(page, 'shell').all();
    const overrides: Record<string, { ru: string; am: string; href?: string }> = {};
    for (const r of (rows.results || []) as any[]) {
      overrides[r.txt_id as string] = {
        ru: (r.text_ru as string) || '',
        am: (r.text_am as string) || '',
        href: (r.href as string) || ''
      };
    }
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    return c.json({ overrides });
  } catch { return c.json({ overrides: {} }); }
})

// ===== PUBLIC CUSTOM BLOCKS (Phase 5.1) =====
// Returns custom blocks for a page so editor.js can render previews
// before SSR catches up.
app.get('/api/custom-blocks/:page', async (c) => {
  try {
    const db = c.env.DB;
    const page = c.req.param('page');
    if (!page) return c.json({ blocks: [] });
    const rows = await db.prepare(
      'SELECT * FROM site_custom_blocks WHERE page = ? AND is_visible = 1 ORDER BY sort_order, id'
    ).bind(page).all();
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    return c.json({ blocks: rows.results || [] });
  } catch { return c.json({ blocks: [] }); }
})

}
