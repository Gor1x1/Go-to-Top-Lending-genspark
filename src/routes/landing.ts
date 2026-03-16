/**
 * Landing page HTML generation — main page route with full SSR
 * This is the largest module: generates complete HTML with embedded CSS/JS
 */
import { Hono } from 'hono'
import { html } from 'hono/html'
import { initDatabase } from '../lib/db'
import { SEED_CONTENT_SECTIONS, SEED_CALC_TABS, SEED_CALC_SERVICES, SEED_TG_MESSAGES } from '../seed-data'

type Bindings = { DB: D1Database }

export function register(app: Hono<{ Bindings: Bindings }>) {
app.get('/', async (c) => {
  // Allow CDN caching for 60s, browser for 10s — stale-while-revalidate for instant repeat visits
  c.header('Cache-Control', 'public, max-age=10, s-maxage=60, stale-while-revalidate=300');
  
  // Start site-data fetch in parallel with SSR (will be awaited at the end)
  const siteDataPromise = (async () => {
    try {
      const req = new Request(new URL('/api/site-data', c.req.url).toString());
      const resp = await app.fetch(req, c.env);
      return resp.ok ? await resp.text() : null;
    } catch { return null; }
  })();
  
  // Detect language early for all SSR needs (nav, OG tags, etc.)
  const reqPath = new URL(c.req.url).pathname;
  const pathLang = reqPath === '/am' ? 'am' : (reqPath === '/ru' ? 'ru' : '');
  const urlLang = pathLang || new URL(c.req.url).searchParams.get('lang') || '';
  const acceptLang = (c.req.header('Accept-Language') || '').toLowerCase();
  const isArmenian = urlLang === 'am' || urlLang === 'hy' || 
    (!urlLang && urlLang !== 'ru');
  
  // Build textMap from DB so we can inject current texts into HTML server-side
  // Strategy: Match seed items to DB items per section using content-aware alignment
  // (not just positional matching, which breaks when DB has fewer items than seed)
  let textMap: Record<string, {ru: string, am: string}> = {};
  let photoMap: Record<string, string> = {};
  let buttonMap: Record<string, any[]> = {};
  let styleMap: Record<string, {texts_ru: string[], styles: any[]}> = {};
  let orderMap: Record<string, string[]> = {};
  let photoSettingsMap: Record<string, any> = {};
  try {
    const db = c.env.DB;
    const contentRes = await db.prepare('SELECT section_key, content_json FROM site_content ORDER BY sort_order').all();
    const dbContent: Record<string, any[]> = {};
    for (const row of contentRes.results) {
      try { dbContent[row.section_key as string] = JSON.parse(row.content_json as string); } catch { dbContent[row.section_key as string] = []; }
    }
    for (const seedSection of SEED_CONTENT_SECTIONS) {
      const dbItems = dbContent[seedSection.key] || [];
      if (!dbItems.length) continue;
      
      // Smart matching: find exact matches first (unchanged items), then align remaining
      // Step 1: Find seed items that exist unchanged in DB (exact ru match at close positions)
      const seedLen = seedSection.items.length;
      const dbLen = dbItems.length;
      const seedMatched = new Array(seedLen).fill(-1); // seedIdx -> dbIdx
      const dbMatched = new Array(dbLen).fill(-1); // dbIdx -> seedIdx
      
      // First pass: exact text matches (prefer same position, then nearby positions)
      for (let si = 0; si < seedLen; si++) {
        const seedRu = seedSection.items[si].ru;
        // Try exact position first
        if (si < dbLen && dbMatched[si] === -1 && dbItems[si].ru === seedRu) {
          seedMatched[si] = si;
          dbMatched[si] = si;
          continue;
        }
        // Try nearby positions (within ±3)
        for (let offset = 1; offset <= 3; offset++) {
          for (const di of [si - offset, si + offset]) {
            if (di >= 0 && di < dbLen && dbMatched[di] === -1 && dbItems[di].ru === seedRu) {
              seedMatched[si] = di;
              dbMatched[di] = si;
              break;
            }
          }
          if (seedMatched[si] !== -1) break;
        }
      }
      
      // Second pass: match remaining unmatched items by sequential order
      let nextUnmatchedDb = 0;
      for (let si = 0; si < seedLen; si++) {
        if (seedMatched[si] !== -1) continue; // already matched
        // Find next unmatched DB item
        while (nextUnmatchedDb < dbLen && dbMatched[nextUnmatchedDb] !== -1) nextUnmatchedDb++;
        if (nextUnmatchedDb < dbLen) {
          seedMatched[si] = nextUnmatchedDb;
          dbMatched[nextUnmatchedDb] = si;
          nextUnmatchedDb++;
        }
      }
      
      // Build textMap entries for matched items where content differs
      for (let si = 0; si < seedLen; si++) {
        const di = seedMatched[si];
        if (di === -1) continue; // no DB match for this seed item
        const origRu = seedSection.items[si].ru;
        const dbItem = dbItems[di];
        if (dbItem && (dbItem.ru !== origRu || dbItem.am !== seedSection.items[si].am)) {
          textMap[origRu] = { ru: dbItem.ru, am: dbItem.am };
        }
      }
    }
    
    // Also load photo_url for key sections to inject server-side (avoids photo flash)
    const photoBlocks = await db.prepare(
      "SELECT block_key, photo_url, custom_html FROM site_blocks WHERE block_key IN ('hero','about','guarantee') AND is_visible = 1"
    ).all();
    for (const blk of (photoBlocks.results || [])) {
      let url = blk.photo_url as string || '';
      if (!url) {
        try { const opts = JSON.parse(blk.custom_html as string || '{}'); url = opts.photo_url || ''; } catch {}
      }
      if (url) photoMap[blk.block_key as string] = url;
    }
    
    // Load buttons from site_blocks for server-side injection (avoids button text flash)
    const buttonBlocks = await db.prepare(
      "SELECT block_key, buttons FROM site_blocks WHERE is_visible = 1 AND buttons IS NOT NULL AND buttons != '[]'"
    ).all();
    for (const blk of (buttonBlocks.results || [])) {
      try {
        const btns = JSON.parse(blk.buttons as string || '[]');
        if (btns.length > 0) {
          buttonMap[blk.block_key as string] = btns;
        }
      } catch { /* skip invalid JSON */ }
    }
    
    // Load text_styles and element_order for server-side CSS injection (avoids color/order flash)
    const styleBlocks = await db.prepare(
      "SELECT block_key, text_styles, texts_ru, custom_html FROM site_blocks WHERE is_visible = 1"
    ).all();
    for (const blk of (styleBlocks.results || [])) {
      try {
        const styles = JSON.parse(blk.text_styles as string || '[]');
        const textsRu = (() => { try { return JSON.parse(blk.texts_ru as string || '[]'); } catch { return []; } })();
        if (styles.length > 0 && styles.some((s: any) => s && (s.color || s.size))) {
          styleMap[blk.block_key as string] = { texts_ru: textsRu, styles };
        }
        // Load element_order from custom_html JSON
        try {
          const opts = JSON.parse(blk.custom_html as string || '{}');
          if (opts.element_order && Array.isArray(opts.element_order) && opts.element_order.length > 0) {
            orderMap[blk.block_key as string] = opts.element_order;
          }
          if (opts.photo_settings && typeof opts.photo_settings === 'object') {
            const ps = opts.photo_settings;
            if (ps.max_height_mobile || ps.max_height_desktop || ps.object_fit || ps.border_radius != null) {
              photoSettingsMap[blk.block_key as string] = ps;
            }
          }
        } catch {}
      } catch { /* skip */ }
    }
    
    // Calculator texts are handled client-side via blockFeatures (not via textMap/HTMLRewriter)
    // The HTMLRewriter skips the calculator section to avoid site_content positional corruption
    
    // Load footer_settings for server-side footer injection (prevents flash of old footer)
    try {
      const footerRow = await db.prepare('SELECT * FROM footer_settings LIMIT 1').first();
      if (footerRow) {
        (globalThis as any).__footerSettings = footerRow;
      }
    } catch {}
    
    // Load footer block social_links + social_settings from site_blocks (for server-side footer socials)
    try {
      const fBlock = await db.prepare("SELECT social_links, custom_html FROM site_blocks WHERE block_key = 'footer' AND is_visible = 1 LIMIT 1").first();
      if (fBlock) {
        let fSocials: any[] = [];
        try { fSocials = JSON.parse(fBlock.social_links as string || '[]'); } catch {}
        let fOpts: any = {};
        try { fOpts = JSON.parse(fBlock.custom_html as string || '{}'); } catch {}
        (globalThis as any).__footerBlockSocials = fSocials;
        (globalThis as any).__footerBlockSocialSettings = fOpts.social_settings || {};
      }
    } catch {}

    // Load popup block for server-side popup injection (prevents stale hardcoded texts)
    try {
      const popupRow = await db.prepare("SELECT texts_ru, texts_am, buttons FROM site_blocks WHERE block_key = 'popup' AND is_visible = 1 LIMIT 1").first();
      if (popupRow) {
        (globalThis as any).__popupBlock = popupRow;
      }
      // Load SEO/OG block for meta tag injection
      const seoRow = await db.prepare("SELECT texts_ru, texts_am, photo_url, custom_html FROM site_blocks WHERE block_key = 'seo_og' AND is_visible = 1 LIMIT 1").first();
      if (seoRow) {
        // Fallback: if photo_url column is empty, try custom_html JSON
        if (!seoRow.photo_url && seoRow.custom_html) {
          try {
            const opts = JSON.parse(seoRow.custom_html as string);
            if (opts.photo_url) (seoRow as any).photo_url = opts.photo_url;
          } catch {}
        }
        (globalThis as any).__seoOgBlock = seoRow;
      }
    } catch {}

    // Save sectionOrder + blockFeatures for server-side reorder/injection
    // Query section_order and site_blocks directly (not from API scope)
    const soRes = await db.prepare('SELECT * FROM section_order ORDER BY sort_order').all();
    (globalThis as any).__sectionOrder = soRes.results || [];
    
    // Load blockFeatures for nav links injection
    const bfRes = await db.prepare("SELECT block_key, texts_ru, texts_am, custom_html FROM site_blocks WHERE is_visible = 1 ORDER BY sort_order").all();
    const bfArr: any[] = [];
    for (const blk of (bfRes.results || [])) {
      let textsRu: string[] = [];
      let textsAm: string[] = [];
      let opts: any = {};
      try { textsRu = JSON.parse(blk.texts_ru as string || '[]'); } catch { textsRu = []; }
      try { textsAm = JSON.parse(blk.texts_am as string || '[]'); } catch { textsAm = []; }
      try { opts = JSON.parse(blk.custom_html as string || '{}'); } catch { opts = {}; }
      bfArr.push({
        key: blk.block_key,
        texts_ru: textsRu,
        texts_am: textsAm,
        nav_links: opts.nav_links || []
      });
    }
    (globalThis as any).__blockFeatures = bfArr;

    // Load packages for SSR (instant display without waiting for client-side JS)
    try {
      const ssrPkgs = await db.prepare('SELECT * FROM calculator_packages WHERE is_active = 1 ORDER BY sort_order, id').all();
      const ssrPkgItems = await db.prepare('SELECT pi.*, cs.name_ru as service_name_ru, cs.name_am as service_name_am FROM calculator_package_items pi LEFT JOIN calculator_services cs ON pi.service_id = cs.id').all();
      const ssrItemsByPkg: Record<number, any[]> = {};
      for (const it of (ssrPkgItems.results || [])) { const pid = it.package_id as number; if (!ssrItemsByPkg[pid]) ssrItemsByPkg[pid] = []; ssrItemsByPkg[pid].push(it); }
      const ssrPkgList = (ssrPkgs.results || []).map((p: any) => ({ ...p, items: ssrItemsByPkg[p.id] || [] }));
      const ssrSettings: Record<string, string> = {};
      try {
        const setRes = await db.prepare("SELECT key, value FROM site_settings WHERE key LIKE 'packages_%'").all();
        for (const r of (setRes.results || [])) { ssrSettings[r.key as string] = r.value as string; }
      } catch {}
      (globalThis as any).__ssrPackages = ssrPkgList;
      (globalThis as any).__ssrPkgSettings = ssrSettings;
    } catch { (globalThis as any).__ssrPackages = []; }
  } catch (e) {
    // If DB fails, serve original HTML without modifications
  }
  
  let pageHtml = /* raw HTML template follows */`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>Go to Top — Продвижение на Wildberries | Առաջխաղացում Wildberries-ում</title>
<link rel="preload" href="/static/img/founder.jpg" as="image" fetchpriority="high">
<meta name="description" content="Go to Top — продвижение карточек на Wildberries под ключ: выкупы живыми людьми и продающий контент. Собственный склад в Ереване.">
<meta property="og:title" content="Go to Top — Առաջխաղացում Wildberries-ում">
<meta property="og:description" content="Выкупы живыми людьми, отзывы с реальными фото, собственный склад в Ереване. Более 1000 аккаунтов.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://gototop.win">
<meta property="og:image" content="https://gototop.win/static/img/og-image-dark.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Go to Top - логотип">
<meta property="og:site_name" content="Go to Top">
<meta property="og:locale" content="ru_RU">
<meta property="og:locale:alternate" content="hy_AM">
<link rel="alternate" hreflang="ru" href="https://gototop.win">
<link rel="alternate" hreflang="hy" href="https://gototop.win">
<link rel="alternate" hreflang="x-default" href="https://gototop.win">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Go to Top — Առաջխաղացում Wildberries-ում">
<meta name="twitter:description" content="Выкупы живыми людьми, отзывы с реальными фото, собственный склад в Ереване. Более 1000 аккаунтов.">
<meta name="twitter:image" content="https://gototop.win/static/img/og-image-dark.png">
<link rel="icon" type="image/png" href="/static/img/logo-gototop.png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="preload" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css"></noscript>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --purple:#8B5CF6;--purple-dark:#7C3AED;--purple-deep:#6D28D9;--violet:#5B21B6;
  --accent:#A78BFA;--accent-light:#C4B5FD;
  --bg:#0F0A1A;--bg-card:#1A1128;--bg-hover:#221638;--bg-surface:#130D20;
  --text:#F5F3FF;--text-sec:#A5A0B8;--text-muted:#6B6580;
  --success:#10B981;--warning:#F59E0B;--danger:#EF4444;
  --border:rgba(139,92,246,0.15);--glow:0 0 30px rgba(139,92,246,0.15);
  --r:16px;--r-sm:10px;--r-lg:24px;
  --t:all 0.3s cubic-bezier(0.4,0,0.2,1);
}
html{scroll-behavior:smooth;font-size:16px;overflow-x:hidden;width:100%;max-width:100vw;-webkit-text-size-adjust:100%}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);line-height:1.7;overflow-x:hidden;width:100%;max-width:100vw;min-height:100vh;min-height:100dvh;-webkit-overflow-scrolling:touch}
*,*::before,*::after{box-sizing:border-box}
.container{max-width:1200px;margin:0 auto;padding:0 24px;overflow-x:hidden;width:100%;box-sizing:border-box}
a{text-decoration:none;color:inherit}
img{max-width:100%;height:auto}
.header{position:fixed;top:0;left:0;right:0;z-index:1000;padding:12px 0;transition:var(--t);background:rgba(15,10,26,0.8);backdrop-filter:blur(20px);border-bottom:1px solid transparent;width:100%}
.header.scrolled{border-bottom:1px solid var(--border);background:rgba(15,10,26,0.95)}
.nav{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:nowrap}
.logo{display:flex;align-items:center;gap:12px}
.logo img{height:44px;width:auto;border-radius:8px}
.logo-text{font-size:1.3rem;font-weight:800;background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;white-space:nowrap}
@media(max-width:1100px){.nav-links{gap:1px}.nav-links a{font-size:0.72rem;padding:4px 5px}.nav-cta{padding:6px 10px;font-size:0.72rem}.logo-text{font-size:1rem}}
@media(max-width:1000px){.logo-text{display:none}.nav-links a{font-size:0.7rem;padding:4px 4px}.lang-btn{padding:5px 10px;font-size:0.72rem}}
@media(max-width:900px){.nav-links{display:none}.hamburger{display:flex;z-index:10001;position:relative}.nav-right .nav-cta{display:none}}
.nav-links{display:flex;align-items:center;gap:4px;list-style:none;flex:1;justify-content:center;min-width:0;flex-wrap:nowrap;overflow:hidden}
.nav-links a{font-size:clamp(0.65rem,0.78vw,0.85rem);font-weight:500;color:var(--text-sec);transition:var(--t);white-space:nowrap;padding:5px 7px;border-radius:6px;text-overflow:ellipsis;overflow:hidden}
.nav-links a:hover{color:var(--text)}
.nav-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
.lang-switch{display:flex;background:var(--bg-card);border-radius:8px;overflow:hidden;border:1px solid var(--border)}
.lang-btn{padding:5px 10px;font-size:1.1rem;cursor:pointer;transition:var(--t);background:transparent;border:none;color:var(--text-muted);line-height:1;display:flex;align-items:center;justify-content:center;gap:4px}
.lang-btn.active{background:var(--purple);color:white}
.lang-btn .lang-text{font-size:0.7rem;font-weight:600;letter-spacing:0.5px}
.lang-btn .lang-flag{font-size:1.1rem}
.nav-cta{padding:8px 16px;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white!important;border-radius:var(--r-sm);font-weight:600;font-size:clamp(0.72rem,0.8vw,0.88rem);transition:var(--t);display:flex;align-items:center;gap:6px;white-space:nowrap;flex-shrink:0}
.nav-cta:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(139,92,246,0.4)}
.hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;padding:8px}
.hamburger span{width:24px;height:2px;background:var(--text);transition:var(--t);border-radius:2px}
.hamburger.active span:nth-child(1){transform:rotate(45deg) translate(5px,5px)}
.hamburger.active span:nth-child(2){opacity:0}
.hamburger.active span:nth-child(3){transform:rotate(-45deg) translate(5px,-5px)}
.nav-mobile-cta{display:none}
/* Bottom Navigation Bar - mobile only */
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:9999;background:rgba(15,10,26,0.96);backdrop-filter:blur(20px);border-top:1px solid var(--border);padding:6px 8px;padding-bottom:max(6px,env(safe-area-inset-bottom))}
.bottom-nav-items{display:flex;justify-content:space-around;align-items:stretch;gap:2px}
.bottom-nav-item{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:3px;padding:6px 4px;border-radius:8px;text-decoration:none;color:var(--text-muted);font-size:0.72rem;font-weight:500;transition:color 0.3s ease;flex:1;min-width:0;cursor:pointer;background:none;border:none}
.bottom-nav-item.active{color:var(--purple)}
.bottom-nav-item:hover,.bottom-nav-item:active{color:var(--purple)}
.bottom-nav-item i{font-size:1.15rem;width:24px;height:24px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.bottom-nav-item i.fa-hand-holding{transform:translateY(-3px)}
.bottom-nav-item span{white-space:normal;overflow:hidden;text-overflow:ellipsis;max-width:100%;font-size:0.6rem;text-align:center;line-height:1.15;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word;flex-shrink:0}
.bottom-nav-more{position:relative}
.bottom-nav-more.active{color:var(--purple)}
.bottom-nav-more span:first-of-type{font-size:0.6rem}
.bottom-nav-more-menu{display:none;position:absolute;bottom:100%;right:0;margin-bottom:8px;background:rgba(15,10,26,0.98);backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:12px;padding:8px;min-width:200px;box-shadow:0 -8px 30px rgba(0,0,0,0.4)}
.bottom-nav-more-menu.active{display:block}
.bottom-nav-more-menu a{display:flex;align-items:center;gap:10px;padding:10px 14px;color:var(--text);font-size:0.88rem;font-weight:500;border-radius:8px;text-decoration:none;transition:var(--t)}
.bottom-nav-more-menu a:hover{background:rgba(139,92,246,0.15);color:var(--purple)}
.bottom-nav-more-menu a i{width:20px;text-align:center;color:var(--purple);font-size:0.9rem}
.hero{padding:140px 0 80px;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-50%;right:-30%;width:80%;height:150%;background:radial-gradient(ellipse,rgba(139,92,246,0.08) 0%,transparent 70%);pointer-events:none}
.hero-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-areas:"title photo" "texts photo" "stats photo" "buttons photo";gap:0 60px;align-items:start}
.hero-el-title{grid-area:title}
.hero-el-texts{grid-area:texts}
.hero-el-stats{grid-area:stats;margin-bottom:36px}
.hero-el-buttons{grid-area:buttons}
.hero-image{grid-area:photo;align-self:center}
.hero-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 18px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.85rem;font-weight:500;color:var(--accent);margin-bottom:24px}
.hero h1{font-size:3rem;font-weight:800;line-height:1.15;margin-bottom:20px;letter-spacing:-0.02em}
.hero h1 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero-desc{font-size:1.05rem;color:var(--text-sec);margin-bottom:32px;max-width:520px;line-height:1.8}
.hero-stats{display:flex;gap:32px}
.stat{text-align:left}
.stat-num{font-size:2rem;font-weight:800;color:var(--purple)}
.stat-label{font-size:0.78rem;color:var(--text-muted);margin-top:2px}
.hero-buttons{display:flex;gap:16px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:10px;padding:14px 28px;border-radius:var(--r-sm);font-weight:600;font-size:0.95rem;transition:var(--t);cursor:pointer;border:none}
.btn-primary{background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white;box-shadow:0 4px 15px rgba(139,92,246,0.3)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(139,92,246,0.5)}
.btn-outline{background:transparent;color:var(--text);border:1px solid var(--border)}
.btn-outline:hover{border-color:var(--purple);background:rgba(139,92,246,0.05)}
.btn-lg{padding:16px 32px;font-size:1.05rem}
.hero-image{position:relative}
.hero-image img{border-radius:var(--r-lg);width:100%;height:auto;aspect-ratio:3/4;max-height:520px;object-fit:cover;object-position:center;border:1px solid var(--border)}
.hero-badge-img{position:absolute;bottom:20px;left:20px;background:rgba(15,10,26,0.9);backdrop-filter:blur(10px);padding:12px 18px;border-radius:var(--r-sm);display:flex;align-items:center;gap:10px;border:1px solid var(--border)}
.hero-badge-img i{color:var(--success);font-size:1.1rem}
.hero-badge-img span{font-size:0.85rem;font-weight:500}
.ticker{padding:20px 0;background:var(--bg-surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border);overflow:hidden}
.ticker-track{display:flex;animation:ticker 40s linear infinite;white-space:nowrap}
.ticker-item{display:flex;align-items:center;gap:10px;padding:0 40px;font-size:0.88rem;color:var(--text-sec);flex-shrink:0}
.ticker-item i{color:var(--purple)}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.section{padding:56px 0;opacity:0;transform:translateY(20px);transition:opacity 0.6s ease,transform 0.6s ease;overflow:visible}
.section.section-revealed{opacity:1;transform:translateY(0)}
html.server-injected .section,html.server-injected .ticker,html.server-injected .stats-bar,html.server-injected .wb-banner,html.server-injected .slot-counter-bar,html.server-injected .footer{opacity:1!important;transform:translateY(0)!important}
html.server-injected .fade-up{opacity:1!important;transform:translateY(0)!important}
.section-dark{background:var(--bg-surface)}
.section-header{text-align:center;margin-bottom:40px}
/* Tighter header for reviews */
#client-reviews .section-header{margin-bottom:24px}
#client-reviews{padding-bottom:0!important;margin-bottom:0!important}
#client-reviews .container{padding-bottom:0!important;margin-bottom:0!important}
#client-reviews > .container{margin-bottom:0;padding-bottom:0}
.section-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px}
.section-title{font-size:2.2rem;font-weight:800;line-height:1.2;margin-bottom:16px;letter-spacing:-0.02em}
.section-sub{font-size:1rem;color:var(--text-sec);max-width:640px;margin:0 auto;line-height:1.7}
.services-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px;margin-bottom:16px}
.svc-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:32px;transition:var(--t);position:relative;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);display:flex;flex-direction:column}
.svc-card:hover{border-color:rgba(139,92,246,0.3);transform:translateY(-4px);box-shadow:var(--glow)}
.svc-card .svc-features{flex:1}
.svc-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--purple),var(--accent));opacity:1;transition:var(--t)}
.svc-card:hover::before{opacity:1}
.svc-icon{width:56px;height:56px;border-radius:14px;background:rgba(139,92,246,0.1);display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:var(--purple);margin-bottom:20px}
.svc-card h3{font-size:1.2rem;font-weight:700;margin-bottom:10px}
.svc-card p{color:var(--text-sec);font-size:0.92rem;line-height:1.7;margin-bottom:16px}
.svc-features{list-style:none}
.svc-features li{display:flex;align-items:flex-start;gap:10px;padding:5px 0;font-size:0.88rem;color:var(--text-sec)}
.svc-features li i{color:var(--success);margin-top:4px;font-size:0.78rem}
.calc-wrap{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:40px;max-width:860px;margin:0 auto}
.calc-tabs{display:flex;gap:8px;margin-bottom:28px;flex-wrap:wrap}
.calc-tab{padding:8px 20px;border-radius:50px;font-size:0.82rem;font-weight:600;cursor:pointer;transition:var(--t);background:var(--bg-surface);border:1px solid var(--border);color:var(--text-muted)}
.calc-tab.active{background:var(--purple);color:white;border-color:var(--purple)}
.calc-tab:hover:not(.active){border-color:var(--purple);color:var(--text)}
.calc-group{display:none}
.calc-group.active{display:block}
.calc-packages{margin-bottom:28px;padding:24px;background:linear-gradient(135deg,rgba(245,158,11,0.04),rgba(249,115,22,0.02));border:1px solid rgba(245,158,11,0.15);border-radius:16px;overflow:visible}
.calc-packages-header{text-align:center;margin-bottom:20px}
.calc-packages-title{font-size:1.2rem;font-weight:800;display:flex;align-items:center;justify-content:center;gap:10px;color:var(--text)}
.calc-packages-subtitle{font-size:0.85rem;color:var(--text-muted);margin-top:6px;max-width:500px;margin-left:auto;margin-right:auto;line-height:1.5}
.calc-packages-grid{display:flex;gap:16px;justify-content:center;align-items:stretch;flex-wrap:nowrap;padding:20px 10px;overflow:visible;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.calc-packages-grid::-webkit-scrollbar{display:none}
.calc-packages-grid.single-pkg{max-width:400px;margin:0 auto}
.calc-pkg-card{background:var(--bg-surface);border:2px solid var(--border);border-radius:16px;padding:20px;cursor:pointer;transition:all 0.3s ease;position:relative;overflow:hidden;flex:1 1 0;min-width:180px;max-width:280px;display:flex;flex-direction:column;-webkit-tap-highlight-color:transparent}

.calc-pkg-card:hover{border-color:#f59e0b;transform:translateY(-3px);box-shadow:0 12px 30px rgba(245,158,11,0.12)}
.calc-pkg-card.selected{border-color:#f59e0b !important;background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(249,115,22,0.04)) !important;box-shadow:0 0 0 3px rgba(245,158,11,0.25),0 8px 20px rgba(245,158,11,0.12) !important}
.calc-pkg-card.selected::after{content:'\u2713';position:absolute;top:14px;left:14px;width:22px;height:22px;background:#f59e0b;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;z-index:10}
.calc-pkg-card .pkg-badge{position:absolute;top:12px;right:12px;background:linear-gradient(135deg,#8B5CF6,#a78bfa);color:white;font-size:0.7rem;padding:4px 10px;border-radius:12px;font-weight:700;letter-spacing:0.3px}
.calc-pkg-card .pkg-popular{position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#f59e0b,#f97316,#ef4444);z-index:4}
.calc-pkg-card .pkg-crown{position:absolute;top:10px;right:10px;display:flex;align-items:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))}
.calc-pkg-card .pkg-tier-badge{position:absolute;top:0;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#f59e0b,#f97316);color:#000;font-size:0.72rem;padding:4px 14px;border-radius:0 0 12px 12px;font-weight:700;letter-spacing:0.3px;white-space:nowrap;z-index:5;box-shadow:0 2px 8px rgba(245,158,11,0.3)}
.calc-pkg-card.pkg-crown-gold{border:2px solid rgba(255,215,0,0.3);border-top:4px solid #FFD700;box-shadow:0 0 8px rgba(255,215,0,0.08),0 4px 12px rgba(255,215,0,0.04);z-index:3;padding:24px 22px;min-height:auto;background:linear-gradient(145deg,var(--bg-surface),rgba(255,215,0,0.03));transform:scale(1.03)}
.calc-pkg-card.pkg-crown-gold .pkg-name{font-size:1.08rem}
.calc-pkg-card.pkg-crown-gold .pkg-new-price{font-size:1.35rem}
.calc-pkg-card.pkg-crown-gold .pkg-items{font-size:0.82rem}
.calc-pkg-card.pkg-crown-gold .pkg-crown{display:none}
.calc-pkg-card.pkg-crown-gold:hover{border-color:#FFD700;box-shadow:0 0 10px rgba(255,215,0,0.15),0 4px 12px rgba(255,215,0,0.08);transform:scale(1.03) translateY(-3px)}
.calc-pkg-card.pkg-crown-gold::before{display:none}
.calc-pkg-card.pkg-crown-silver{border:2px solid rgba(192,192,192,0.3);border-top:3px solid #C0C0C0;box-shadow:0 0 6px rgba(192,192,192,0.04);z-index:2;padding:20px 19px;min-height:auto;background:linear-gradient(145deg,var(--bg-surface),rgba(192,192,192,0.01))}
.calc-pkg-card.pkg-crown-silver .pkg-name{font-size:1.02rem}
.calc-pkg-card.pkg-crown-silver .pkg-new-price{font-size:1.28rem}
.calc-pkg-card.pkg-crown-silver .pkg-crown{display:none}
.calc-pkg-card.pkg-crown-silver:hover{border-color:#C0C0C0;box-shadow:0 6px 22px rgba(192,192,192,0.15);transform:translateY(-3px)}
.calc-pkg-card.pkg-crown-silver::before{display:none}
.calc-pkg-card.pkg-crown-bronze{border:2px solid rgba(205,127,50,0.25);border-top:3px solid #CD7F32;box-shadow:0 0 5px rgba(205,127,50,0.03);z-index:1;padding:20px 18px;min-height:auto}
.calc-pkg-card.pkg-crown-bronze .pkg-name{font-size:1rem}
.calc-pkg-card.pkg-crown-bronze .pkg-new-price{font-size:1.25rem}
.calc-pkg-card.pkg-crown-bronze .pkg-crown{display:none}
.calc-pkg-card.pkg-crown-bronze:hover{border-color:#CD7F32;box-shadow:0 5px 18px rgba(205,127,50,0.12);transform:translateY(-3px)}
.calc-pkg-card.pkg-crown-bronze::before{display:none}
.calc-pkg-card .pkg-name{font-weight:700;font-size:1rem;margin-bottom:6px;margin-top:18px;line-height:1.3}
.calc-pkg-card .pkg-desc{font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;line-height:1.5;flex-grow:1}
.calc-pkg-card .pkg-prices{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.calc-pkg-card .pkg-old-price{text-decoration:line-through;color:var(--text-muted);font-size:0.85rem}
.calc-pkg-card .pkg-new-price{font-weight:800;font-size:1.25rem;color:#f59e0b}
.calc-pkg-card .pkg-discount{background:linear-gradient(135deg,#059669,#10B981);color:white;font-size:0.7rem;padding:3px 8px;border-radius:10px;font-weight:700}
.calc-pkg-card .pkg-items{font-size:0.78rem;color:var(--text-muted);line-height:1.8;border-top:1px solid var(--border);padding-top:10px;margin-top:auto}
.calc-pkg-card .pkg-items div{display:flex;align-items:flex-start;gap:6px;margin-bottom:2px}
.calc-pkg-card .pkg-items i{color:#22c55e;font-size:0.65rem;flex-shrink:0;margin-top:5px}
@media(max-width:768px){.calc-packages{padding:16px 0;overflow:visible;position:relative}.calc-packages-grid{display:flex;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;gap:12px;padding:12px 16px;scrollbar-width:none;justify-content:flex-start;align-items:stretch;touch-action:pan-x pan-y}.calc-packages-grid.smooth-scroll{scroll-behavior:smooth}.calc-packages-grid::-webkit-scrollbar{display:none}.calc-packages-grid.single-pkg{max-width:100%;overflow:visible;justify-content:center}.calc-pkg-card{flex:0 0 72vw;max-width:72vw;min-width:0;padding:18px 16px;overflow:hidden;opacity:1;transform:none;transition:border-color 0.3s ease,box-shadow 0.3s ease,background 0.3s ease;border-radius:14px;-webkit-tap-highlight-color:transparent;scroll-snap-align:center;scroll-snap-stop:always;touch-action:auto;-webkit-user-select:none;user-select:none}.calc-pkg-card.pkg-crown-gold{padding:18px 16px;min-height:auto;flex:0 0 72vw;max-width:72vw;transform:none;border:3px solid #FFD700;box-shadow:0 0 8px rgba(255,215,0,0.15),0 4px 10px rgba(255,215,0,0.06);opacity:1;z-index:auto}.calc-pkg-card.pkg-crown-gold .pkg-name{font-size:1.05rem}.calc-pkg-card.pkg-crown-gold .pkg-new-price{font-size:1.35rem}.calc-pkg-card.pkg-crown-gold .pkg-items{font-size:0.82rem;line-height:1.9}.calc-pkg-card.pkg-crown-gold .pkg-desc{font-size:0.85rem;line-height:1.5}.calc-pkg-card.pkg-crown-gold .pkg-prices{margin-bottom:12px}.calc-pkg-card.pkg-crown-gold .pkg-badge{font-size:0.72rem;padding:4px 10px}.calc-pkg-card.pkg-crown-gold:hover{transform:none}.calc-pkg-card.pkg-crown-silver{padding:18px 16px;min-height:auto;flex:0 0 72vw;max-width:72vw;transform:none;opacity:1}.calc-pkg-card.pkg-crown-silver:hover{transform:none}.calc-pkg-card.pkg-crown-bronze{padding:18px 16px;min-height:auto;flex:0 0 72vw;max-width:72vw;transform:none;opacity:1}.calc-pkg-card.pkg-crown-bronze:hover{transform:none}.calc-pkg-card .pkg-name{font-size:0.88rem}.calc-pkg-card .pkg-new-price{font-size:1.05rem}.calc-pkg-card .pkg-items{font-size:0.72rem}.calc-packages-title{font-size:1.05rem}}
.calc-row{display:grid;grid-template-columns:1fr auto auto;gap:16px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)}
.calc-row:last-of-type{border-bottom:none}
.calc-label{font-size:0.92rem;font-weight:500}
.calc-price{font-size:0.82rem;color:var(--text-muted);white-space:nowrap}
.calc-input{display:flex;align-items:center;gap:8px}
.calc-input button{width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:0.95rem;cursor:pointer;transition:var(--t);display:flex;align-items:center;justify-content:center}
.calc-input button:hover{border-color:var(--purple);background:rgba(139,92,246,0.1)}
.calc-input input[type="number"]{width:48px;text-align:center;font-weight:600;font-size:1rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 3px;-moz-appearance:textfield;outline:none;transition:var(--t)}
.calc-input input[type="number"]:focus{border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.15)}
.calc-input input[type="number"]::-webkit-outer-spin-button,.calc-input input[type="number"]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.calc-total{display:flex;justify-content:space-between;align-items:center;padding:24px 0;margin-top:16px;border-top:2px solid var(--purple)}
.calc-total-label{font-size:1.1rem;font-weight:600}
.calc-total-value{font-size:1.8rem;font-weight:800;color:var(--purple);white-space:nowrap}
.calc-old-price{font-size:1rem;font-weight:600;color:var(--text-sec);text-decoration:line-through;opacity:0.7;margin-right:6px}
.calc-discount-line{font-size:0.82rem;color:var(--success);font-weight:600;margin-top:2px}
.calc-total-prices{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.calc-cta{margin-top:24px;text-align:center}
.buyout-tier-info{margin-top:8px;padding:12px 16px;background:rgba(139,92,246,0.05);border:1px solid var(--border);border-radius:var(--r-sm);font-size:0.82rem;color:var(--text-sec);line-height:1.6}
.buyout-tier-info strong{color:var(--accent)}

/* ===== WHY BUYOUTS + WB OFFICIAL BLOCKS ===== */
.why-block{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:40px;margin-bottom:24px}
.why-block h3{font-size:1.3rem;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:10px}
.why-block h3 i{color:var(--purple);font-size:1.1rem}
.why-block p{color:var(--text-sec);font-size:0.92rem;line-height:1.8;margin-bottom:16px}
.why-block p:last-child{margin-bottom:0}
.why-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin:24px 0}
.why-step{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r);padding:20px;display:flex;gap:14px;align-items:flex-start;transition:var(--t)}
.why-step:hover{border-color:rgba(139,92,246,0.3);transform:translateY(-2px)}
.why-step-num{width:36px;height:36px;min-width:36px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--accent));color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem}
.why-step h4{font-size:0.95rem;font-weight:600;margin-bottom:4px}
.why-step p{font-size:0.85rem;color:var(--text-sec);line-height:1.6;margin:0}
.compare-box{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:24px 0}
.compare-side{padding:24px;border-radius:var(--r);border:1px solid var(--border)}
.compare-side.bad{background:rgba(239,68,68,0.05);border-color:rgba(239,68,68,0.2)}
.compare-side.good{background:rgba(139,92,246,0.05);border-color:rgba(139,92,246,0.3)}
.compare-side h4{font-size:1rem;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.compare-side.bad h4{color:#ef4444}
.compare-side.good h4{color:var(--purple)}
.compare-side p{font-size:0.88rem;color:var(--text-sec);line-height:1.7;margin:0}
.compare-side .price-tag{font-size:1.3rem;font-weight:800;margin:8px 0}
.compare-side.bad .price-tag{color:#ef4444}
.compare-side.good .price-tag{color:var(--purple)}
.wb-official-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:20px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:#10B981;font-weight:600;font-size:0.88rem;margin-bottom:16px}
.highlight-result{background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(168,85,247,0.08));border:1px solid rgba(139,92,246,0.2);border-radius:var(--r);padding:20px 24px;margin:20px 0;font-size:0.95rem;line-height:1.7}
.highlight-result i{color:var(--purple);margin-right:8px}
.highlight-result strong{color:var(--text)}
@media(max-width:768px){.compare-box{grid-template-columns:1fr}.why-steps{grid-template-columns:1fr}}
.process-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;position:relative}
.step{text-align:center;position:relative}
.step-num{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.1rem;margin:0 auto 16px;position:relative;z-index:2}
.step-line{position:absolute;top:24px;left:50%;right:-50%;height:2px;background:var(--border);z-index:1}
.step:last-child .step-line{display:none}
.step h4{font-size:0.92rem;font-weight:600;margin-bottom:8px}
.step p{font-size:0.78rem;color:var(--text-muted);line-height:1.5}
.wh-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.wh-item{position:relative;border-radius:var(--r);overflow:hidden;border:1px solid var(--border);cursor:pointer;transition:var(--t)}
.wh-item:hover{transform:scale(1.02);border-color:rgba(139,92,246,0.3)}
.wh-item img{width:100%;height:250px;object-fit:cover;transition:var(--t)}
.wh-item:hover img{transform:scale(1.05)}
.wh-caption{position:absolute;bottom:0;left:0;right:0;padding:12px 16px;background:linear-gradient(transparent,rgba(0,0,0,0.8));font-size:0.85rem;font-weight:500}
.guarantee-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px;display:grid;grid-template-columns:1fr 1fr;grid-template-areas:"photo title" "photo texts" "photo buttons";gap:0 48px;align-items:start}
.guarantee-el-photo{grid-area:photo;display:flex;justify-content:center;align-items:center}
.guarantee-el-title{grid-area:title}
.guarantee-el-texts{grid-area:texts}
.guarantee-el-buttons{grid-area:buttons}
.guarantee-card img,.guarantee-el-photo img{border-radius:var(--r);width:100%;height:auto;max-height:500px;object-fit:cover;border:1px solid var(--border)}


.guarantee-card h2,.guarantee-el-title h2{font-size:1.9rem;font-weight:800;margin-bottom:16px}
.guarantee-card>div p,.guarantee-el-texts p{color:var(--text-sec);margin-bottom:16px;line-height:1.8}
.g-list{list-style:none;margin:20px 0}
.g-list li{display:flex;align-items:flex-start;gap:12px;padding:8px 0;font-size:0.92rem}
.g-list li i{color:var(--success);margin-top:4px}
.g-badge{display:inline-flex;align-items:center;gap:10px;padding:12px 20px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:var(--r-sm);color:var(--success);font-weight:600;margin-top:16px}
.cmp-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:var(--r);margin:0;padding:0;max-width:100%;display:block}
.cmp-table{width:100%;min-width:500px;border-collapse:collapse;background:var(--bg-card);border-radius:var(--r);overflow:hidden;border:1px solid var(--border)}
.cmp-table th{padding:16px 20px;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.5px;font-weight:600}
.cmp-table th:first-child{text-align:left;color:var(--text-muted)}
.cmp-table th:nth-child(2){background:rgba(139,92,246,0.1);color:var(--purple)}
.cmp-table th:nth-child(3){color:var(--text-muted)}
.cmp-table td{padding:14px 20px;border-top:1px solid var(--border);font-size:0.88rem;color:var(--text-sec)}
.cmp-table td:nth-child(2){background:rgba(139,92,246,0.03);font-weight:500;color:var(--text)}
.chk{color:var(--success)}.crs{color:var(--danger)}
.faq-list{max-width:800px;margin:0 auto}
.faq-item{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);margin-bottom:12px;overflow:hidden;transition:var(--t)}
.faq-item.active{border-color:rgba(139,92,246,0.3)}
.faq-q{padding:20px 24px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;font-weight:600;font-size:0.92rem}
.faq-q i{color:var(--purple);transition:var(--t);font-size:0.78rem}
.faq-item.active .faq-q i{transform:rotate(180deg)}
.faq-a{padding:0 24px;max-height:0;overflow:hidden;transition:max-height 0.4s ease,padding 0.4s ease}
.faq-item.active .faq-a{max-height:500px;padding:0 24px 20px}
.faq-a p{color:var(--text-sec);font-size:0.88rem;line-height:1.8}
.form-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px;max-width:600px;margin:0 auto}
.form-group{margin-bottom:20px}
.form-group label{display:block;font-size:0.82rem;font-weight:600;margin-bottom:8px;color:var(--text-sec)}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:12px 16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:1rem;font-family:inherit;transition:var(--t)}
.form-group input:focus,.form-group textarea:focus,.form-group select:focus{outline:none;border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.15)}
.form-group textarea{resize:vertical;min-height:100px}
.form-group select option{background:var(--bg-card)}
.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:600px;margin:0 auto 32px}
.contact-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:24px;text-align:center;transition:var(--t)}
.contact-card:hover{border-color:rgba(139,92,246,0.3);transform:translateY(-2px)}
.contact-card i.fab{font-size:2rem;color:var(--purple);margin-bottom:12px}
.contact-card h4{font-size:1rem;font-weight:600;margin-bottom:4px}
.contact-card p{font-size:0.82rem;color:var(--text-muted);line-height:1.5}
.footer{padding:60px 0 28px;border-top:1px solid var(--border);margin-top:0;opacity:0;transition:opacity 0.5s ease;background:var(--bg-surface)}
section[style*="display: none"],section[style*="display:none"],div[style*="display: none"],div[style*="display:none"]{margin:0!important;padding:0!important;height:0!important;overflow:hidden!important;min-height:0!important;border:0!important}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px;margin-bottom:40px}
.footer-brand{position:relative}
.footer-brand .logo{margin-bottom:16px}
.footer-brand p{color:var(--text-muted);font-size:0.88rem;margin-top:0;line-height:1.8}
.footer-col h4{font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--purple);margin-bottom:20px;position:relative;padding-bottom:10px}
.footer-col h4::after{content:'';position:absolute;bottom:0;left:0;width:24px;height:2px;background:var(--purple);border-radius:2px}
.footer-col ul{list-style:none}
.footer-col li{margin-bottom:12px}
.footer-col a{color:var(--text-sec);font-size:0.88rem;transition:var(--t);display:inline-flex;align-items:center;gap:8px}
.footer-col a:hover{color:var(--purple);transform:translateX(4px)}
.footer-col a i{font-size:1rem;width:20px;text-align:center}
.footer-social-btn:hover{transform:scale(1.15)}
.footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:24px;border-top:1px solid var(--border);font-size:0.78rem;color:var(--text-muted)}
.tg-float{position:fixed;bottom:86px;right:24px;z-index:999;display:flex;align-items:center;gap:12px;padding:14px 24px;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white;border-radius:50px;box-shadow:0 8px 30px rgba(139,92,246,0.4);transition:var(--t);font-weight:600;font-size:0.88rem}
.tg-float:hover{transform:translateY(-3px) scale(1.03);box-shadow:0 12px 40px rgba(139,92,246,0.5)}
.tg-float i{font-size:1.2rem}
.calc-float{position:fixed;bottom:24px;right:24px;z-index:999;display:flex;align-items:center;gap:10px;padding:14px 22px;background:linear-gradient(135deg,#10B981,#059669);color:white;border-radius:50px;box-shadow:0 8px 30px rgba(16,185,129,0.4);transition:var(--t);font-weight:600;font-size:0.88rem;cursor:pointer}
.calc-float:hover{transform:translateY(-3px) scale(1.03);box-shadow:0 12px 40px rgba(16,185,129,0.5)}
.calc-float i{font-size:1.1rem}
.lightbox{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:9999;align-items:center;justify-content:center;padding:40px;cursor:pointer;-webkit-tap-highlight-color:transparent;overflow-y:auto;-webkit-overflow-scrolling:touch}
.lightbox.show{display:flex}
.lightbox img{max-width:92%;max-height:90vh;border-radius:var(--r);object-fit:contain;-webkit-user-drag:none;user-select:none;touch-action:pinch-zoom}
@media(max-width:768px){.lightbox{padding:12px;align-items:flex-start;padding-top:60px}.lightbox img{max-width:98%;max-height:none;border-radius:8px;margin-bottom:60px}}

/* ===== CTA BUTTONS AFTER SECTIONS ===== */
.section-cta{display:flex;gap:14px;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:28px;padding-top:24px;border-top:1px solid var(--border)}
/* Force correct order: content blocks BEFORE CTA buttons in why-buyouts & fifty-vs-fifty */
section#why-buyouts .container{display:flex;flex-direction:column}
section#why-buyouts .section-header{order:0!important}
section#why-buyouts .why-block{order:1!important}
section#why-buyouts .section-cta{order:2!important}
/* Reset order for children INSIDE .why-block so server CSS doesn't break inner layout */
section#why-buyouts .why-block > *{order:0!important}
section#why-buyouts .why-block .highlight-result{order:99!important}
section#fifty-vs-fifty .container{display:flex;flex-direction:column}
section#fifty-vs-fifty .section-header{order:0!important}
section#fifty-vs-fifty .why-block{order:1!important}
section#fifty-vs-fifty .section-cta{order:2!important}
section#fifty-vs-fifty .why-block > *{order:0!important}
section#fifty-vs-fifty .why-block .highlight-result{order:99!important}
.slot-counter-bar .section-cta{margin-top:0;padding-top:0;border-top:none;padding-bottom:16px}
.slot-counter-bar .section-cta:empty{display:none}
.section-cta .btn{font-size:0.9rem;padding:12px 24px}
.section-cta .btn i{margin-right:6px}
.btn-success{background:linear-gradient(135deg,#10B981,#059669);color:white;box-shadow:0 4px 15px rgba(16,185,129,0.3)}
.btn-success:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(16,185,129,0.5)}
.btn-warning{background:linear-gradient(135deg,#F59E0B,#D97706);color:white;box-shadow:0 4px 15px rgba(245,158,11,0.3)}
.btn-warning:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(245,158,11,0.5)}
.btn-tg{background:linear-gradient(135deg,#0088cc,#0077b5);color:white;box-shadow:0 4px 15px rgba(0,136,204,0.3)}
.btn-tg:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,136,204,0.5)}

/* ===== POPUP - Mobile-friendly slide-up ===== */
.popup-overlay{
  display:none;
  position:fixed;top:0;left:0;right:0;bottom:0;
  width:100%;height:100%;
  background:rgba(0,0,0,0.85);
  z-index:100000;
  justify-content:center;align-items:center;
  padding:20px;
  overflow:hidden;
  -webkit-overflow-scrolling:none;
  touch-action:none;
}
.popup-overlay.show{
  display:flex !important;
  visibility:visible !important;
  opacity:1 !important;
}
.popup-card{
  background:linear-gradient(145deg,#2a1a4e,#3d2470);
  border:2px solid rgba(167,139,250,0.6);
  border-radius:20px;
  padding:36px;
  text-align:center;
  max-width:460px;width:100%;
  position:relative;
  z-index:100001;
  box-shadow:0 0 80px rgba(139,92,246,0.4),0 25px 60px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.1);
  animation:popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;
  opacity:1;
  transform:scale(1);
}
@keyframes popIn{0%{transform:scale(0.7) translateY(30px);opacity:0}100%{transform:scale(1) translateY(0);opacity:1}}
@keyframes slideUpMobile{0%{transform:translateY(100%)}100%{transform:translateY(0)}}
@media(max-width:640px){
  .popup-overlay{align-items:flex-end;padding:0}
  .popup-card{
    border-radius:20px 20px 0 0;
    max-width:100%;width:100%;
    animation:slideUpMobile 0.4s ease forwards;
    padding:28px 16px;
    max-height:85vh;
    overflow-y:auto;
    margin:0;
  }
  .popup-card h3{font-size:1.2rem}
  .popup-card .pf-row{grid-template-columns:1fr}
  .slot-counter-bar .container > div{flex-direction:column;gap:12px;text-align:center}
  .slot-counter-bar #slotProgress{width:100%;max-width:280px}
}
.popup-card .popup-close{
  position:absolute;top:14px;right:14px;
  width:34px;height:34px;border-radius:50%;
  background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);
  color:#fff;font-size:1.2rem;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:var(--t);line-height:1;
}
.popup-card .popup-close:hover{background:rgba(239,68,68,0.5);border-color:rgba(239,68,68,0.6)}
.popup-card .popup-icon{
  width:64px;height:64px;border-radius:50%;
  background:linear-gradient(135deg,var(--purple),var(--accent));
  display:flex;align-items:center;justify-content:center;
  margin:0 auto 16px;font-size:1.6rem;color:white;
}
.popup-card h3{font-size:1.4rem;font-weight:800;margin-bottom:8px;color:#fff}
.popup-card .popup-sub{color:#c4b5fd;margin-bottom:20px;font-size:0.9rem;line-height:1.5}
.popup-card .pf-group{margin-bottom:14px;text-align:left}
.popup-card .pf-label{display:block;font-size:0.8rem;font-weight:600;color:#c4b5fd;margin-bottom:6px}
.popup-card .pf-input{
  width:100%;padding:12px 14px;
  background:rgba(15,10,26,0.6);
  border:1px solid rgba(139,92,246,0.35);
  border-radius:10px;color:#fff;font-size:1rem;
  font-family:inherit;transition:var(--t);
}
.popup-card .pf-input:focus{outline:none;border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.25)}
.popup-card .pf-input::placeholder{color:rgba(165,160,184,0.6)}
.popup-card .pf-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.popup-card .popup-success{display:none;text-align:center;padding:20px 0}
.popup-card .popup-success i{font-size:3rem;color:var(--success);margin-bottom:12px}
.popup-card .popup-success h4{font-size:1.1rem;margin-bottom:6px;color:#fff}
.popup-card .popup-success p{color:#c4b5fd;font-size:0.88rem}

.fade-up{opacity:0;transform:translateY(30px);transition:opacity 0.7s ease,transform 0.7s ease}
.fade-up.visible{opacity:1;transform:translateY(0)}
/* Hero visible immediately — no loading overlay needed */
#hero.section,.hero-section{opacity:1;transform:none}
.ticker,.stats-bar,.wb-banner,.slot-counter-bar{opacity:0;transform:translateY(20px);transition:opacity 0.6s ease,transform 0.6s ease}
.ticker.section-revealed,.stats-bar.section-revealed,.wb-banner.section-revealed,.slot-counter-bar.section-revealed{opacity:1;transform:translateY(0)}
/* Reviews gallery - tighter layout when no carousel */
.reviews-gallery-area:empty,.reviews-gallery-area:has(> div:only-child:empty){display:none}
#reviewsCarouselArea{transition:opacity 0.4s ease}
/* Reviews section — eliminate ALL bottom gaps */
#client-reviews .section-cta{margin-top:8px;margin-bottom:0!important;padding-bottom:0!important;border-top:none}
#client-reviews .rv-dots{margin-top:10px;margin-bottom:0!important;padding-bottom:0!important}
#client-reviews .reviews-gallery-area{margin-bottom:0!important;padding-bottom:0!important}
#reviewsCarouselArea{margin-bottom:0!important;padding-bottom:0!important}
#reviewsCtaArea:empty{display:none!important;margin:0!important;padding:0!important;height:0!important;overflow:hidden}
#reviewsCtaArea{margin-top:8px;margin-bottom:0!important;padding-bottom:0!important}
#client-reviews .rv-carousel{margin-bottom:0!important}
#client-reviews .rv-swipe-hint{margin-top:8px;margin-bottom:0!important;padding-bottom:0!important}
#client-reviews .extra-text{margin-bottom:0!important;padding-bottom:0!important}
#client-reviews .container{padding-bottom:0!important;margin-bottom:0!important}
#client-reviews > .container > *:last-child{margin-bottom:0!important;padding-bottom:0!important}
/* Photo block review cards — no bottom gap */
.pb-card{margin-bottom:0}
.pb-carousel{margin-bottom:0;padding-bottom:0}
.pb-card-size img{width:100%;height:auto;max-height:500px;object-fit:contain}
@media(max-width:480px){.pb-card-size img{max-height:400px}}
/* Photo block sections — remove extra padding below photos */
section[data-section-id^="photo-block"]{padding-bottom:16px!important}
section[data-section-id^="photo-block"] .container{padding-bottom:0}

/* ===== STATS BAR ===== */
.stats-bar{padding:60px 0;background:var(--bg-surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:32px;text-align:center}
.stat-card .stat-big{font-size:2.8rem;font-weight:900;color:var(--purple);line-height:1}
.stat-card .stat-desc{font-size:0.88rem;color:var(--text-sec);margin-top:6px;font-weight:500}
.slot-counter-bar{padding:0;background:linear-gradient(135deg,rgba(16,185,129,0.05),rgba(139,92,246,0.05));border-bottom:1px solid var(--border);width:100%;overflow:hidden;opacity:0;transform:translateY(20px);transition:opacity 0.6s ease,transform 0.6s ease}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}


/* ===== WB BANNER ===== */
.wb-banner{padding:20px 0;background:var(--bg-surface);border-bottom:1px solid var(--border)}
.wb-banner-inner{display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap}
.wb-banner-card{display:flex;align-items:center;gap:16px;padding:16px 28px;background:linear-gradient(135deg,#ff3366,var(--purple));border-radius:var(--r);flex:1;min-width:280px;position:relative;overflow:hidden}
.wb-banner-card::after{content:"!";position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:3.5rem;font-weight:900;color:rgba(255,255,255,0.15)}
.wb-banner-card .wb-icon{font-size:1.6rem;color:#fff}
.wb-banner-card .wb-text{font-weight:800;font-size:1rem;color:#fff;line-height:1.3;text-transform:uppercase}
.wb-banner-right{display:flex;align-items:center;gap:16px;padding:16px 28px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);flex:1;min-width:280px}
.wb-banner-right .wb-r-icon{font-size:1.4rem}
.wb-banner-right .wb-r-text{font-weight:700;font-size:0.92rem;line-height:1.4}
.wb-banner-right .btn{margin-left:auto;white-space:nowrap;font-size:0.82rem;padding:10px 20px}

/* ===== ABOUT SECTION ===== */
.about-grid{display:grid;grid-template-columns:1fr 1.5fr;grid-template-areas:"photo title" "photo texts" "photo buttons";gap:0 48px;align-items:start}
.about-el-title{grid-area:title}
.about-el-texts{grid-area:texts}
.about-el-buttons{grid-area:buttons}
.about-img{grid-area:photo}
.about-img{position:relative;border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--border);background:var(--bg-card);display:block}
.about-img img{width:100%;height:auto;object-fit:cover;display:block}
.about-el-title h2,.about-text h2{font-size:2rem;font-weight:800;margin-bottom:20px;line-height:1.3}
.about-el-title h2 .gr,.about-text h2 .gr{background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.about-el-texts p,.about-text p{color:var(--text-sec);font-size:1rem;line-height:1.8;margin-bottom:16px}
.about-highlight{background:rgba(139,92,246,0.08);border:1px solid var(--border);border-radius:var(--r);padding:20px 24px;margin-top:16px}
.about-highlight p{font-weight:600;color:var(--accent);margin:0!important}

/* ===== BUYOUT SERVICE DETAIL ===== */
.buyout-detail{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px}
.buyout-detail-header{margin-bottom:32px}
.buyout-detail-header h2{font-size:2rem;font-weight:800;margin-bottom:12px}
.buyout-detail-header h2 .gr{background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.buyout-detail-header .subtitle{font-weight:700;font-size:1.1rem;margin-bottom:8px}
.buyout-detail-header p{color:var(--text-sec);font-size:0.92rem;line-height:1.7}
.buyout-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:20px}
.buyout-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r);padding:28px;transition:var(--t)}
.buyout-card:hover{border-color:rgba(139,92,246,0.3)}
.buyout-card h4{font-size:1rem;font-weight:700;margin-bottom:12px;text-transform:uppercase;color:var(--accent)}
.buyout-card p{color:var(--text-sec);font-size:0.88rem;line-height:1.7}
.buyout-card ul{list-style:none;margin-top:12px;counter-reset:buyout-step}
.buyout-card ul li{padding:4px 0;font-size:0.88rem;color:var(--text-sec);counter-increment:buyout-step}
.buyout-card ul li::before{content:counter(buyout-step);color:var(--purple);margin-right:8px;font-weight:700}
.buyout-cta{text-align:right;margin-top:24px}

/* ===== REVIEWS DETAIL ===== */
.reviews-detail{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px;margin-top:32px}
.reviews-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin-top:32px}

/* ===== REVIEWS SINGLE-PHOTO CAROUSEL ===== */
.rv-carousel{position:relative;width:100%;max-width:480px;margin:0 auto;overflow:hidden;border-radius:16px;border:none;background:transparent;box-shadow:none}
.rv-carousel .rv-track{display:flex;flex-wrap:nowrap;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;scroll-behavior:smooth;touch-action:pan-x pan-y}
.rv-carousel .rv-track::-webkit-scrollbar{display:none}
.rv-carousel .rv-slide{flex:0 0 100%;width:100%;position:relative;scroll-snap-align:start;scroll-snap-stop:always}
.rv-carousel .rv-slide img{width:100%;height:auto;object-fit:contain;display:block;background:transparent;-webkit-user-drag:none;user-select:none}
.rv-carousel .rv-caption{padding:12px 16px;background:rgba(139,92,246,0.08);border-radius:0 0 12px 12px}
.rv-carousel .rv-caption-text{font-size:0.92rem;line-height:1.6;color:var(--text-sec,#8b8b9e);font-style:italic}
.rv-carousel .rv-badge{position:absolute;top:12px;right:12px;background:rgba(139,92,246,0.9);color:#fff;font-size:0.72rem;padding:4px 10px;border-radius:20px;font-weight:600;backdrop-filter:blur(6px);z-index:2}
.rv-carousel .rv-nav-btn{position:absolute;top:45%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:rgba(139,92,246,0.85);color:#fff;border:none;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:3;transition:transform 0.2s,background 0.2s}
.rv-carousel .rv-nav-btn:hover{background:var(--purple,#8B5CF6);transform:translateY(-50%) scale(1.1)}
.rv-carousel .rv-nav-btn.rv-prev{left:10px}
.rv-carousel .rv-nav-btn.rv-next{right:10px}
.rv-dots{display:flex;justify-content:center;gap:8px;margin-top:16px}
.rv-dots .rv-dot{width:10px;height:10px;border-radius:50%;background:rgba(139,92,246,0.25);cursor:pointer;transition:all 0.3s}
.rv-dots .rv-dot.active{background:var(--purple,#8B5CF6);transform:scale(1.3);box-shadow:0 0 8px rgba(139,92,246,0.5)}
.rv-swipe-hint{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;font-size:0.82rem;color:var(--text-muted,#666);animation:rvSwipeHint 2.5s ease-in-out infinite}
@keyframes rvSwipeHint{0%,100%{opacity:0.6;transform:translateX(0)}50%{opacity:1;transform:translateX(6px)}}
/* Lightbox navigation */
.lightbox .lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:50px;height:50px;border-radius:50%;background:rgba(139,92,246,0.85);color:#fff;border:none;cursor:pointer;font-size:1.3rem;display:flex;align-items:center;justify-content:center;z-index:10001;transition:transform 0.2s}
.lightbox .lb-nav:hover{transform:translateY(-50%) scale(1.15)}
.lightbox .lb-prev{left:16px}
.lightbox .lb-next{right:16px}
.lightbox .lb-close{position:absolute;top:20px;right:20px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.15);color:#fff;border:none;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center;z-index:10001}
@media(max-width:768px){
  .rv-carousel{max-width:100%}
  .rv-carousel .rv-slide img{height:auto;object-fit:contain}
  .rv-carousel{background:transparent;border:none;box-shadow:none}
  .rv-carousel .rv-nav-btn{width:38px;height:38px;font-size:0.95rem}
  .lightbox .lb-nav{width:40px;height:40px;font-size:1rem}
}
@media(max-width:480px){
  .rv-carousel .rv-slide img{height:auto;object-fit:contain}
  .rv-carousel{background:transparent;border:none;box-shadow:none}
  .rv-carousel .rv-caption{padding:10px 16px}
  .rv-carousel .rv-caption-text{font-size:0.85rem}
  .rv-carousel .rv-nav-btn{width:34px;height:34px;font-size:0.85rem}
  .rv-dots .rv-dot{width:8px;height:8px}
  .lightbox .lb-nav{width:36px;height:36px;font-size:0.9rem}
}
.review-point{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r);padding:24px;text-align:center;transition:var(--t)}
.review-point:hover{border-color:rgba(139,92,246,0.3);transform:translateY(-3px)}
.review-point i{font-size:2rem;color:var(--purple);margin-bottom:14px}
.review-point h4{font-size:1rem;font-weight:700;margin-bottom:8px}
.review-point p{color:var(--text-sec);font-size:0.85rem;line-height:1.6}

/* ===== STATS BAR ===== */
.stats-bar{padding:60px 0;background:var(--bg-surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:32px;text-align:center}
.stat-card .stat-big{font-size:2.8rem;font-weight:900;color:var(--purple);line-height:1}
.stat-card .stat-desc{font-size:0.88rem;color:var(--text-sec);margin-top:6px;font-weight:500}

@media(max-width:1024px){
  .hero h1{font-size:2.4rem}
  .hero-grid{grid-template-columns:1fr;gap:40px}
  .hero-image{max-width:100%}
  .process-grid{grid-template-columns:repeat(3,1fr)}
  .step:nth-child(n+4){margin-top:16px}
  .guarantee-card{grid-template-columns:1fr;gap:32px}
  .footer-grid{grid-template-columns:1fr 1fr}
  .wb-banner-inner{flex-direction:column}
  .about-grid{grid-template-columns:1fr}
  .buyout-grid{grid-template-columns:1fr 1fr}
  .stats-grid{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:900px){
  .nav-links{display:none!important}
  .nav-mobile-cta{display:none!important}
  .hamburger{display:none!important}
  .nav-right .nav-cta{display:none}
  .bottom-nav{display:block}
  body{padding-bottom:64px}
  .tg-float{display:none!important}
  .calc-float{display:none!important}
}
@media(max-width:768px){
  .hero{padding:110px 0 60px}
  .hero h1{font-size:1.9rem}
  .hero-stats{flex-wrap:wrap;gap:20px}
  .hero-buttons{flex-direction:column;align-items:center;width:100%}
  .hero-buttons .btn{width:100%;max-width:400px;justify-content:center}
  .hero-image img{height:auto;max-height:none}
  .section-title{font-size:1.7rem}
  .services-grid{grid-template-columns:1fr;gap:20px}
  .wh-grid{grid-template-columns:1fr}
  .buyout-grid{grid-template-columns:1fr}
  .stats-grid{grid-template-columns:repeat(2,1fr);gap:20px}
  .process-grid{grid-template-columns:1fr 1fr}
  .cmp-table{font-size:0.78rem;min-width:420px}
  .cmp-table td,.cmp-table th{padding:10px 8px}
  .calc-row{grid-template-columns:1fr;gap:8px}
  .calc-wrap{padding:24px}
  .calc-tabs{gap:6px}
  .contact-grid{grid-template-columns:1fr}
  .form-card{padding:28px}
  .footer-grid{grid-template-columns:1fr}
  .footer-bottom{flex-direction:column;gap:8px;text-align:center}
  .tg-float{display:none!important}
  .calc-float{display:none!important}
  .popup-card .pf-row{grid-template-columns:1fr}
  .slot-counter-bar .container > div{flex-direction:column;gap:12px;text-align:center}
  .slot-counter-bar #slotProgress{width:100%;max-width:280px}
  /* ===== MOBILE: proper element order inside sections ===== */
  /* About: flex-column with orderable children (overridden by server element_order) */
  .about-grid{display:flex!important;flex-direction:column;gap:24px}
  .about-el-title{order:0}
  .about-el-texts{order:1}
  .about-el-buttons{order:2;width:100%;display:flex;flex-direction:column;align-items:center}
  .about-img{order:3;border-radius:12px;margin:0 auto;width:100%;position:relative;overflow:hidden;min-height:auto;height:auto;aspect-ratio:auto}
  .about-img img{width:100%;height:auto;min-height:auto;object-fit:cover;display:block;position:relative;border-radius:12px}
  /* Hero: flex-column with orderable children (overridden by server element_order) */
  .hero-grid{display:flex!important;flex-direction:column;gap:24px}
  .hero-el-title{order:0}
  .hero-el-texts{order:1}
  .hero-el-stats{order:2;margin-bottom:0}
  .hero-el-buttons{order:3;width:100%;display:flex;flex-direction:column;align-items:center}
  .hero-image{order:4;max-width:100%;margin:0 auto;width:100%}
  .hero-image img{height:auto;max-height:none;width:100%;aspect-ratio:auto;border-radius:12px;border:none}
  /* Guarantee: flex-column with orderable children (overridden by server element_order) */
  .guarantee-card{display:flex!important;flex-direction:column;gap:24px}
  .guarantee-el-title{order:0}
  .guarantee-el-texts{order:1}
  .guarantee-el-buttons{order:2;width:100%;display:flex;flex-direction:column;align-items:center}
  .guarantee-el-photo{order:3}
  .guarantee-el-photo{margin:0 auto;width:100%}
  .guarantee-el-photo img,.guarantee-card > img{max-height:none;width:100%;height:auto;object-fit:cover;border-radius:12px}
  /* WB Official — proper block ordering on mobile */
  .why-block{display:flex;flex-direction:column}
  /* Warehouse — stack photos */
  .wh-grid{display:flex!important;flex-direction:column;gap:16px}
  /* Buyout detail — stack cards */
  .buyout-grid{display:flex!important;flex-direction:column;gap:16px}
  .buyout-detail{display:flex;flex-direction:column}
  /* ===== MOBILE: remove ALL inner scroll from sections ===== */
  .section{overflow:hidden!important}
  /* Allow carousel sections to scroll horizontally inside */
  #client-reviews{overflow:visible!important}
  #client-reviews .container{overflow:visible!important}
  section[data-section-id^="photo-block"]{overflow:visible!important}
  section[data-section-id^="photo-block"] .container{overflow:visible!important}
  #calculator{overflow:visible!important}
  #calculator .container{overflow:visible!important}
  .section .container{overflow:visible!important;max-width:100%!important}
  /* Key fix: prevent ANY child from causing horizontal scroll */
  body{overflow-x:hidden}
  .section *:not(.rv-track):not(.rv-slide):not(.calc-packages-grid):not(.calc-pkg-card):not(.pb-carousel):not(.pb-card):not(.pb-card-size){max-width:100%;box-sizing:border-box}
  /* Comparison table: fixed layout, no scroll outside wrapper */
  .cmp-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:var(--r);margin:0;padding:0;max-width:100%}
  .cmp-table{min-width:0!important;width:100%;table-layout:fixed;font-size:0.72rem}
  .cmp-table td,.cmp-table th{padding:8px 6px;word-wrap:break-word;overflow-wrap:break-word}
  /* Carousels: horizontal scroll only inside, vertical scroll passthrough to page */
  .rv-carousel{overflow:hidden;max-width:100%;position:relative}
  .rv-carousel .rv-track{width:100%!important;flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;scroll-snap-type:x mandatory!important;-webkit-overflow-scrolling:touch!important;scroll-behavior:smooth!important;scrollbar-width:none!important}
  .rv-carousel .rv-track::-webkit-scrollbar{display:none!important}
  .pb-carousel{overflow-x:scroll;overflow-y:hidden;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;-ms-overflow-style:none;scrollbar-width:none}
  .pb-carousel::-webkit-scrollbar{display:none}
  /* Section CTA buttons — always at bottom with proper spacing */
  .section-cta{margin-top:24px!important;text-align:center;display:flex;flex-direction:column;align-items:center}
  .section-cta .btn{width:100%;max-width:400px;justify-content:center;display:inline-flex}
  /* Fix photos inside sections — no overflow */
  img{max-width:100%;height:auto}
  .block-photo-gallery{grid-template-columns:1fr!important;margin:0 -14px!important;width:calc(100% + 28px)!important;padding:0!important}
  .block-photo-gallery img{height:auto!important;max-height:none!important;border-radius:0!important}
  .block-photo-gallery > div{border-radius:0!important}
  .wh-item{overflow:hidden;border-radius:var(--r)}
  .wh-item img{width:100%;height:auto;max-height:none;object-fit:cover}
  /* Why-steps, process-grid — single column on mobile */
  .why-steps{grid-template-columns:1fr!important}
  .process-grid{grid-template-columns:1fr!important}
  /* Compare box — stack columns */
  .compare-box{display:flex!important;flex-direction:column;gap:16px}
  .compare-side{width:100%!important}
  /* Services grid — single column */
  .services-grid{grid-template-columns:1fr!important;gap:20px}
  /* Stats grid: 2 columns on mobile */
  .stats-grid{grid-template-columns:repeat(2,1fr)!important;gap:16px!important}
  /* Contact grid */
  .contact-grid{grid-template-columns:1fr!important}
  /* Ticker — no overflow issues */
  .ticker{overflow:hidden!important}
  /* Slot counter */
  .slot-counter-bar .container{overflow:visible!important}
  /* WB Banner */
  .wb-banner-inner{flex-direction:column;gap:16px;text-align:center}
  .wb-banner-right{flex-direction:column;gap:8px;min-width:0}
  .wb-banner-right .btn{width:100%;margin-left:0}
}
@media(max-width:480px){
  .hero h1{font-size:1.5rem}
  .section{padding:36px 0}
  .section-title{font-size:1.3rem}
  .section-sub{font-size:0.85rem}
  .container{padding:0 14px}
  .calc-wrap{padding:14px}
  .svc-card{padding:16px}
  .buyout-detail{padding:20px}
  .reviews-detail{padding:20px}
  .guarantee-card{padding:20px!important;flex-direction:column!important;gap:20px!important}
  .guarantee-el-photo img,.guarantee-card > img{max-height:none!important;object-fit:cover;border-radius:12px}
  .about-grid{gap:16px!important}
  .about-img{min-height:auto!important;aspect-ratio:auto!important}
  .about-img img{min-height:auto!important}
  .form-card{padding:16px}
  .wb-banner-card{min-width:0;padding:10px 14px}
  .wb-banner-right{min-width:0;padding:10px 14px;flex-wrap:wrap}
  .wb-banner-right .btn{margin-left:0;margin-top:8px;width:100%}
  .cmp-table{min-width:0!important;width:100%!important;table-layout:fixed!important;font-size:0.68rem}
  .hero-stats{gap:16px}
  .stat-num{font-size:1.6rem}
  .stat-label{font-size:0.72rem}
  .hero-desc{font-size:0.9rem}
  .btn{padding:12px 20px;font-size:0.88rem}
  .btn-lg{padding:14px 24px;font-size:0.95rem}
  .hero-badge{font-size:0.78rem;padding:6px 14px}
  .nav{gap:8px}
  .lang-btn{padding:5px 10px;font-size:0.72rem}
  .logo img{height:36px}
  .wh-item img{height:auto;max-height:none;aspect-ratio:4/3;object-fit:cover}
  .wh-caption{font-size:0.78rem;padding:10px 14px}
  .footer{padding:40px 0 20px}
}

/* ===== MOBILE FULL-WIDTH FIXES ===== */
@media(max-width:768px){
  .slot-counter-bar,.ticker,.stats-bar,.wb-banner,.footer,.section-dark{width:100vw;margin-left:calc(-50vw + 50%);margin-left:0;box-sizing:border-box}
  .popup-overlay{-webkit-tap-highlight-color:transparent}
  input,textarea,select,button{font-size:16px!important;-webkit-appearance:none;border-radius:0;border-radius:10px}
}
@media(max-width:360px){
  .container{padding:0 10px}
  .hero{padding:95px 0 40px}
  .hero h1{font-size:1.25rem}
  .hero-desc{font-size:0.82rem;margin-bottom:20px}
  .hero-stats{gap:12px}
  .stat-num{font-size:1.4rem}
  .section-title{font-size:1.15rem}
  .calc-tab{padding:5px 10px;font-size:0.72rem}
  .calc-wrap{padding:12px}
  .svc-card{padding:14px}
  .svc-card h3{font-size:0.95rem}
  .btn{padding:10px 16px;font-size:0.82rem}
  .section{padding:28px 0}
  .section-cta{gap:10px;margin-top:20px}
  .hero-buttons{gap:10px;align-items:center;width:100%}
  .hero-buttons .btn{width:100%;max-width:100%;justify-content:center}
  .g-list li{font-size:0.82rem}
  .process-grid{grid-template-columns:1fr !important}
  .buyout-grid{grid-template-columns:1fr !important}
}
@media(max-width:320px){
  .container{padding:0 8px}
  .hero{padding:85px 0 30px}
  .hero h1{font-size:1.1rem}
  .section-title{font-size:1.05rem}
  .btn{padding:8px 14px;font-size:0.78rem}
  .logo img{height:30px}
  .lang-btn{padding:4px 8px;font-size:0.68rem}
}
</style>
</head>
<body>

<!-- ===== HEADER ===== -->
<header class="header" id="header">
<div class="container">
<nav class="nav">
  <a href="#" class="logo">
    <img src="/static/img/logo-gototop.png" alt="Go to Top">
    <span class="logo-text">Go to Top</span>
  </a>
  <ul class="nav-links" id="navLinks">
    <li><a href="#about" data-ru="О нас" data-am="Մեր մասին">О нас</a></li>
    <li><a href="#services" data-ru="Услуги" data-am="Ծառայություններ">Услуги</a></li>
    <li><a href="#calculator" data-ru="Калькулятор" data-am="Հաշվիչ">Калькулятор</a></li>
    <li><a href="#warehouse" data-ru="Склад" data-am="Պահեստ">Склад</a></li>
    <li><a href="#guarantee" data-ru="Гарантии" data-am="Երաշխիքներ">Гарантии</a></li>
    <li><a href="#faq" data-ru="FAQ" data-am="ՀՏՀ">FAQ</a></li>
    <li><a href="#contact" data-ru="Контакты" data-am="Կոնտակտներ">Контакты</a></li>
    <li class="nav-mobile-cta"><a href="https://wa.me/37441888389" target="_blank" class="btn btn-primary"><i class="fab fa-whatsapp"></i> <span data-ru="Написать нам" data-am="Գրել հիմա" data-no-rewrite="1">Написать нам</span></a></li>
  </ul>
  <div class="nav-right">
    <div class="lang-switch">
      <button class="lang-btn" data-lang="ru" onclick="switchLang('ru')"><span class="lang-flag">\u{1F1F7}\u{1F1FA}</span><span class="lang-text">RU</span></button>
      <button class="lang-btn active" data-lang="am" onclick="switchLang('am')"><span class="lang-flag">\u{1F1E6}\u{1F1F2}</span><span class="lang-text">AM</span></button>
    </div>
    <a href="https://wa.me/37441888389" target="_blank" class="nav-cta">
      <i class="fab fa-whatsapp"></i>
      <span data-ru="Написать нам" data-am="Գրել հիմա">Написать нам</span>
    </a>
  </div>
  <button class="hamburger" id="hamburger" onclick="toggleMenu()">
    <span></span><span></span><span></span>
  </button>
</nav>
</div>
</header>

<!-- ===== HERO ===== -->
<section class="hero" id="hero" data-section-id="hero">
<div class="container">
<div class="hero-grid">
  <div class="hero-el-title">
    <div class="hero-badge">
      <i class="fas fa-circle" style="color:var(--success);font-size:0.5rem"></i>
      <span data-ru="Успешный опыт с 2021 года" data-am="Հաջողված փորձ 2021 թվականից">Успешный опыт с 2021 года</span>
    </div>
    <h1>
      <span data-ru="Выведем ваш товар" data-am="Մենք կբարձրացնենք ձեր ապրանքը">Выведем ваш товар</span><br>
      <span class="gr" data-ru="в ТОП Wildberries" data-am="Wildberries-ի TOP">в ТОП Wildberries</span>
    </h1>
  </div>
  <div class="hero-el-texts">
    <p class="hero-desc" data-ru="Самовыкупы с аккаунтов реальных пользователей по вашим ключевым словам. С нами ваши товары становятся ТОПами продаж на Wildberries. Собственный склад и более 1000 реальных аккаунтов в Ереване." data-am="Իրական մարդկանց հաշիվներից ինքնագնումներ ձեր ցանկալի բանալի բառով: Մեզ հետ ձեր ապրանքները դառնում են Wildberries-ի TOP-ում վաճառվողներ: Սեփական պահեստ և ավելի քան 1000 իրական հաշիվ Երևանում:">
      Самовыкупы с аккаунтов реальных пользователей по вашим ключевым словам. С нами ваши товары становятся ТОПами продаж на Wildberries. Собственный склад и более 1000 реальных аккаунтов в Ереване.
    </p>
  </div>
  <div class="hero-el-stats">
    <div class="hero-stats">
      <div class="stat"><div class="stat-num" data-count="847">0</div><div class="stat-label" data-ru="товаров в ТОП" data-am="ապրանքներ TOP-ում">товаров в ТОП</div></div>
      <div class="stat"><div class="stat-num" data-count="0">0</div><div class="stat-label" data-ru="блокировок" data-am="արգելափակում">блокировок</div></div>
      <div class="stat"><div class="stat-num" data-count="1000">0</div><div class="stat-label" data-ru="аккаунтов" data-am="հաշիվներ">аккаунтов</div></div>
    </div>
  </div>
  <div class="hero-el-buttons">
    <div class="hero-buttons">
      <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary btn-lg">
        <i class="fab fa-telegram"></i>
        <span data-ru="Написать в Telegram" data-am="Գրել Telegram-ով">Написать в Telegram</span>
      </a>
      <a href="#calculator" class="btn btn-outline btn-lg">
        <i class="fas fa-calculator"></i>
        <span data-ru="Рассчитать стоимость" data-am="Հաշվել արժեքը">Рассчитать стоимость</span>
      </a>
    </div>
  </div>
  <div class="hero-image">
    <img src="/static/img/founder.jpg" alt="Go to Top" loading="eager" fetchpriority="high" decoding="async">
    <div class="hero-badge-img">
      <i class="fas fa-shield-alt"></i>
      <span data-ru="Надежный метод продвижения" data-am="Ապահով առաջխաղացման մեթոդ">Надежный метод продвижения</span>
    </div>
  </div>
</div>
</div>
</section>

<!-- ===== TICKER ===== -->
<div class="ticker" data-section-id="ticker">
<div class="ticker-track" id="tickerTrack"></div>
</div>


<!-- ===== WB BANNER ===== -->
<div class="wb-banner fade-up" data-section-id="wb-banner">
<div class="container">
<div class="wb-banner-inner">
  <div class="wb-banner-card">
    <i class="fas fa-gavel wb-icon"></i>
    <div class="wb-text" data-ru="WB официально отменил штрафы за выкупы!" data-am="WB-ն պաշտոնապես վերացրել է տուգանքները ինքնագնումների համար!">WB официально отменил штрафы за выкупы!</div>
  </div>
  <div class="wb-banner-right">
    <span class="wb-r-icon">🚀</span>
    <div class="wb-r-text" data-ru="Повысь рейтинг магазина прямо сейчас" data-am="Բարձրացրեք խանութի վարկանիշը հիմա">Повысь рейтинг магазина прямо сейчас</div>
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><span data-ru="Узнать" data-am="Իմանալ">Узнать</span></a>
  </div>
</div>
</div>
</div>

<!-- ===== STATS BAR ===== -->
<div class="stats-bar fade-up" data-section-id="stats-bar">
<div class="container">
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-big" data-count-s="500">0</div>
      <div class="stat-desc" data-ru="поставщиков сотрудничают с нами" data-am="մատակարար համագործակցում է մեզ հետ">поставщиков сотрудничают с нами</div>
    </div>
    <div class="stat-card">
      <div class="stat-big" data-count-s="1000">0+</div>
      <div class="stat-desc" data-ru="аккаунтов с индивидуальной картой" data-am="հաշիվներ անհատական քարտով">аккаунтов с индивидуальной картой</div>
    </div>
    <div class="stat-card">
      <div class="stat-big" data-count-s="21">0</div>
      <div class="stat-desc" data-ru="день до выхода в ТОП" data-am="ապրանք TOP-ում օրական">день до выхода в ТОП</div>
    </div>
    <div class="stat-card">
      <div class="stat-big" data-count-s="200">0+</div>
      <div class="stat-desc" data-ru="выкупов каждый день" data-am="գնում ամեն օր">выкупов каждый день</div>
    </div>
  </div>
</div>
</div>


<!-- ===== ABOUT ===== -->
<section class="section" id="about" data-section-id="about">
<div class="container">
  <div class="about-grid fade-up">
    <div class="about-img">
      <img src="/static/img/about-hero2.jpg" alt="Go to Top — О компании">
    </div>
    <div class="about-el-title">
      <div class="section-badge"><i class="fas fa-info-circle"></i> <span data-ru="О компании" data-am="Ընկերության մասին">О компании</span></div>
      <h2 data-ru="Что такое" data-am="Ի՞նչ է Go to Top-ը">Что такое <span class="gr">Go to Top</span>?</h2>
    </div>
    <div class="about-el-texts">
      <p data-ru="«Go to Top» — сервис развития Вашего бизнеса на маркетплейсах с помощью комплексного продвижения и услуги выкупов по ключевым словам. Для долгосрочного закрепления товара в TOPе." data-am="«Go to Top» — ձեր բիզնեսի զարգացման ծառայություն մարկետփլեյսներում՝ ինքնագնումների միջոցով առաջխաղացման մեթոդ է TOP-ում երկարաժամկետ դիրքավորվելու համար:">«Go to Top» — сервис развития Вашего бизнеса на маркетплейсах с помощью комплексного продвижения и услуги выкупов по ключевым словам. Для долгосрочного закрепления товара в TOPе.</p>
      <p data-ru="Наша команда профессионалов с 2021 года работает на результат. У нас собственные склады и офисы в Ереване. Используем для выкупов Вашего товара только реальные аккаунты людей и производим всё вручную." data-am="Մեր մասնագետների թիմը 2021 թվականից աշխատում է արդյունքի համար: Մենք ունենք սեփական պահեստներ և գրասենյակներ Երևանում: Գնումների համար օգտագործում ենք միայն իրական մարդկանց հաշիվներ և ամեն ինչ անում ենք ձեռքով:">Наша команда профессионалов с 2021 года работает на результат. У нас собственные склады и офисы в Ереване. Используем для выкупов Вашего товара только реальные аккаунты людей и производим всё вручную.</p>
      <div class="about-highlight">
        <p data-ru="Наилучший результат Вы получите, воспользовавшись комплексом наших услуг!" data-am="Լավագույն արդյունքը կստանաք օգտվելով մեր ծառայությունների փաթեթը!"><i class="fas fa-bolt" style="margin-right:8px"></i>Наилучший результат Вы получите, воспользовавшись комплексом наших услуг!</p>
      </div>
    </div>
    <div class="about-el-buttons">
      <div class="section-cta">
        <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><i class="fas fa-shopping-cart"></i> <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">Заказать сейчас</span></a>
      </div>
    </div>
  </div>
</div>
</section>

<!-- ===== SERVICES ===== -->
<section class="section" id="services" data-section-id="services">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-rocket"></i> <span data-ru="Наши услуги" data-am="Մեր ծառայությունները">Наши услуги</span></div>
    <h2 class="section-title" data-ru="Полный спектр продвижения на WB" data-am="WB-ում առաջխաղացման լիարժեք սպեկտր">Полный спектр продвижения на WB</h2>
    <p class="section-sub" data-ru="Выкупы живыми людьми, отзывы с реальными фото, профессиональные фотосессии — всё для вашего товара" data-am="Գնումներ իրական մարդկանցով, կարծիքներ իրական լուսանկարներով, մասնագիտական լուսանկարահանումներ — ամենը ձեր ապրանքի համար">Выкупы живыми людьми, отзывы с реальными фото, профессиональные фотосессии — всё для вашего товара</p>
  </div>
  <div class="services-grid">
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-shopping-cart"></i></div>
      <h3 data-ru="Выкупы по ключевым запросам" data-am="Գնումներ բանալի հարցումներով">Выкупы по ключевым запросам</h3>
      <p data-ru="Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану." data-am="Ձեր ապրանքը գնվում է իրական մարդկանցով։ Իրական հաշիվներից տարբեր ՊՎԶ-ներով ամբողջ Երևանում:">Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану.</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Реальные аккаунты с историей покупок" data-am="Իրական հաշիվներ գնումների պատմությամբ">Реальные аккаунты с историей покупок</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Географическое распределение" data-am="Աշխարհագրական բաշխում">Географическое распределение</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Естественное поведение покупателей" data-am="Գնորդների բնական վարքագիծ">Естественное поведение покупателей</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Забор товара из ПВЗ" data-am="Ապրանքի ստացում ՊՎԶ-ից">Забор товара из ПВЗ</span></li>
      </ul>
      <div style="margin-top:20px;text-align:center"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-tg" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-rocket"></i> <span data-ru="Повысить рейтинг" data-am="Բարձրացնել վարկանիշը">Повысить рейтинг</span></a></div>
    </div>
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-star"></i></div>
      <h3 data-ru="Отзывы и оценки" data-am="Կարծիքներ և գնահատականներ">Отзывы и оценки</h3>
      <p data-ru="Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга." data-am="Մանրամասն կարծիքներ լուսանկարներով և տեսանյութով իրական հաշիվներից վարկանիշի բարձրացման համար:">Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга.</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Текст отзыва + фото/видео" data-am="Կարծիքի տեքստ + լուսանկար/տեսանյութ">Текст отзыва + фото/видео</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Профессиональная фотосессия" data-am="Մասնագիտական լուսանկարահանում">Профессиональная фотосессия</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Разные локации и модели" data-am="Տարբեր վայրեր և մոդելներ">Разные локации и модели</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="До 50% отзывов от выкупов" data-am="Մինչև 50% կարծիքներ գնումներից">До 50% отзывов от выкупов</span></li>
      </ul>
      <div style="margin-top:20px;text-align:center"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-rocket"></i> <span data-ru="Начать продвижение" data-am="Սկսել առաջխաղացումը">Начать продвижение</span></a></div>
    </div>
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-key"></i></div>
      <h3 data-ru="Активация ключевых слов" data-am="Բանալի բառերի ակտիվացում">Активация ключевых слов</h3>
      <p data-ru="Есть ключевое слово, по которому хотите показываться, но алгоритмы не связывают его с вашей карточкой? Мы знаем решение — делаем целевые выкупы, которые активируют товар в нужном кластере." data-am="Ունե՞ք բանալի բառ, որով ցանկանում եք, որ ձեր ապրանքը ցուցադրվի, բայց ալգоրիթմները չեն կապում այն ձեր քարտին։ Մենք գիտենք լուծումը՝ կատարվում ենք նպատակային գնումներ, որоնք ակտիվացնում են ապրանքը ճիշտ կլաստերում։">Есть ключевое слово, по которому хотите показываться, но алгоритмы не связывают его с вашей карточкой? Мы знаем решение — делаем целевые выкупы, которые активируют товар в нужном кластере.</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Органический трафик — резкий рост" data-am="Օրգանիկ տրաֆիկի կտրուկ աճ">Органический трафик — резкий рост</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Укрепление позиций новыми ключевыми словами" data-am="Դիրքերի ամրապնդում նոր բանալի բառերով">Укрепление позиций новыми ключевыми словами</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Подключение к целевым и прибыльным запросам" data-am="Միացում թիրախային և եկամտաբեր հարցումներին">Подключение к целевым и прибыльным запросам</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Стабильные позиции без рекламы" data-am="Կայուն դիրքեր առանց գովազդի">Стабильные позиции без рекламы</span></li>
      </ul>
      <div style="margin-top:20px;text-align:center"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-key"></i> <span data-ru="Активировать ключевые" data-am="Ակտիվացնել բանալիները">Активировать ключевые</span></a></div>
    </div>
  </div>
</div>
</section>


<!-- ===== BUYOUT DETAIL ===== -->
<section class="section" data-section-id="buyout-detail">
<div class="container">
  <div class="buyout-detail fade-up">
    <div class="buyout-detail-header">
      <div class="section-badge"><i class="fas fa-shopping-bag"></i> <span data-ru="Услуга выкупа" data-am="Գնումի ծառայություն">Услуга выкупа</span></div>
      <h2 data-ru="Что включает в себя услуга выкупа" data-am="Ինչ է ներառում գնումի ծառայությունը">Что включает в себя <span class="gr">услуга выкупа</span></h2>
      <p data-ru="Индивидуальный подход к каждому клиенту. Выкупы только по ключевым запросам, каждый заказ оформляет реальный человек вручную." data-am="Անհատական մոտեցում յուրաքանչյուր հաճախորդի համար: Գնումներ միայն բանալի հարցումներով, յուրաքանչյուր պատվերը կատարում է իրական մարդ ձեռքով:">Индивидуальный подход к каждому клиенту. Выкупы только по ключевым запросам, каждый заказ оформляет реальный человек вручную.</p>
    </div>
    <div class="buyout-grid">
      <div class="buyout-card">
        <h4 data-ru="Полное сопровождение" data-am="Լիարժեք ուղեկցում">Полное сопровождение</h4>
        <ul>
          <li data-ru="Консультация" data-am="Խորհրդատվություն">Консультация</li>
          <li data-ru="Создание чата с менеджером" data-am="Մենեջերի հետ չատի ստեղծում">Создание чата с менеджером</li>
          <li data-ru="Согласование плана выкупов" data-am="Գնումների պլանի համաձայնեցում">Согласование плана выкупов</li>
          <li data-ru="Выкупы по ключевым запросам" data-am="Գնումներ բանալի հարցումներով">Выкупы по ключевым запросам</li>
          <li data-ru="Забор товара из ПВЗ курьерами" data-am="Ապրանքի ստացում ՊՎԶ-ից մեր առաքիչների օգնությամբ">Забор товара из ПВЗ курьерами</li>
          <li data-ru="Возврат на склады маркетплейсов" data-am="Վերադարձ մարկետփլեյսների պահեստներ">Возврат на склады маркетплейсов</li>
          <li data-ru="Публикация отзывов" data-am="Կարծիքների հրապարակում">Публикация отзывов</li>
        </ul>
      </div>
      <div class="buyout-card">
        <h4 data-ru="Отчётность" data-am="Հաշվետվություն">Отчётность</h4>
        <p data-ru="Формирование итоговой отчётности по каждому выкупу. Полная прозрачность на каждом этапе." data-am="Վերջնական հաշվետվության ձևավորում յուրաքանչյուր գնումի համար: Լիարժեք թափանցիկություն յուրաքանչյուր փուլում:">Формирование итоговой отчётности по каждому выкупу. Полная прозрачность на каждом этапе.</p>
        <div style="margin-top:16px;text-align:center"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-warning" style="font-size:0.82rem;padding:9px 18px"><i class="fas fa-fire"></i> <span data-ru="Начать выкупы сейчас" data-am="Սկսել գնումները">Начать выкупы сейчас</span></a></div>
      </div>
      <div class="buyout-card">
        <h4 data-ru="Контроль" data-am="Վերահսկողություն">Контроль</h4>
        <p data-ru="Сопровождение и контроль на всех этапах. Точное следование алгоритму для безопасности вашего кабинета." data-am="Ուղեկցում և վերահսկողություն բոլոր փուլերում: Ալգորիթմի ճիշտ հետևողականություն ձեր հաշվի անվտանգության համար:">Сопровождение и контроль на всех этапах. Точное следование алгоритму для безопасности вашего кабинета.</p>
        <div style="margin-top:16px;text-align:center"><a href="https://t.me/suport_admin_2" target="_blank" class="btn btn-tg" style="font-size:0.82rem;padding:9px 18px"><i class="fab fa-telegram"></i> <span data-ru="Получить индивидуальный расчёт" data-am="Ստանալ ինդիվիդուալ հաշվարկ">Получить индивидуальный расчёт</span></a></div>
      </div>
    </div>
  </div>
</div>
</section>


<!-- ===== WHY BUYOUTS BY KEYWORDS ===== -->
<section class="section" id="why-buyouts" data-section-id="why-buyouts">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-chart-line"></i> <span data-ru="Почему это работает" data-am="Ինչու է սա աշխատում.">Почему это работает</span></div>
    <h2 class="section-title" data-ru="Почему выкупы по ключевым запросам — самый эффективный способ продвижения" data-am="Ինչու է գնումները բանալի բառերով — ամենա արդյունավետը">Почему выкупы по ключевым запросам — <span class="gr">самый эффективный способ</span> продвижения</h2>
  </div>

  <div class="why-block fade-up">
    <h3><i class="fas fa-funnel-dollar"></i> <span data-ru="Мы не просто покупаем ваш товар — мы прокачиваем всю воронку" data-am="Մենք ոչ միայն գնում ենք — մենք բարձրացնում ենք բոլոր քայլերի կոնվերսիաները">Мы не просто покупаем ваш товар — мы прокачиваем всю воронку</span></h3>
    <p data-ru="Каждый выкуп по ключевому запросу — это полноценное продвижение вашей карточки. Наши люди делают всё так, как это делает реальный покупатель. Вот что происходит при каждом выкупе:" data-am="Յուրաքանչյուր գնում բանալի բառով — լիարժեք առաջխաղացման մեթոդ.">Каждый выкуп по ключевому запросу — это полноценное продвижение вашей карточки. Наши люди делают всё так, как это делает реальный покупатель. Вот что происходит при каждом выкупе:</p>
    
    <div class="why-steps">
      <div class="why-step"><div class="why-step-num">1</div><div><h4 data-ru="Поиск по ключевому запросу" data-am="Վորոնում բանալի բառով">Поиск по ключевому запросу</h4><p data-ru="Находим ваш товар именно так, как ищет реальный покупатель — через поисковую строку WB" data-am="Գտնում ենք ձեր ապրանքը։">Находим ваш товар именно так, как ищет реальный покупатель — через поисковую строку WB</p></div></div>
      <div class="why-step"><div class="why-step-num">2</div><div><h4 data-ru="Просмотр карточки" data-am="Քարտի դիտարկում">Просмотр карточки</h4><p data-ru="Полностью просматриваем фото и видео, листаем описание — повышаем конверсию из просмотра в переход" data-am="Դիտարկվում ենք բոլոր լուսանկարները և հոլովակը։">Полностью просматриваем фото и видео, листаем описание — повышаем конверсию из просмотра в переход</p></div></div>
      <div class="why-step"><div class="why-step-num">3</div><div><h4 data-ru="Работа с отзывами" data-am="Աշխատանք կարծիքների հետ">Работа с отзывами</h4><p data-ru="Пролистываем отзывы, лайкаем положительные — это улучшает ранжирование лучших отзывов" data-am="Թերթում ենք կարծիքների բաժինը, լայքում ենք լավ կարծիքները">Пролистываем отзывы, лайкаем положительные — это улучшает ранжирование лучших отзывов</p></div></div>
      <div class="why-step"><div class="why-step-num">4</div><div><h4 data-ru="Добавление конкурентов" data-am="Մրցակիցների ավելացում">Добавление конкурентов</h4><p data-ru="Добавляем в корзину товары конкурентов вместе с вашим — имитируем реальное поведение покупателя" data-am="Ավելացնում ենք մրցակիցներին զամբյուղ, մարդկային վարքագծի համար">Добавляем в корзину товары конкурентов вместе с вашим — имитируем реальное поведение покупателя</p></div></div>
      <div class="why-step"><div class="why-step-num">5</div><div><h4 data-ru="Удаление конкурентов из корзины" data-am="Մրցակիցների հեռացում զամբյուղից">Удаление конкурентов из корзины</h4><p data-ru="В момент заказа удаляем конкурентов и оставляем только ваш товар — WB видит, что выбирают именно вас" data-am="Պատվիրելու պահին, մենք հեռացնում ենք մրցակիցներին և թողնում միայն ձեր ապրանքը։ WB-ն տեսնում է, որ մարդիկ ընտրում են ձեզ։">В момент заказа удаляем конкурентов и оставляем только ваш товар — WB видит, что выбирают именно вас</p></div></div>
      <div class="why-step"><div class="why-step-num">6</div><div><h4 data-ru="Заказ и получение" data-am="Պատվեր և ստացում">Заказ и получение</h4><p data-ru="Оформляем заказ, забираем из ПВЗ, оставляем отзыв — полный цикл реального покупателя" data-am="Պատվիրում ենք ապրանքը, վերցնում ենք այն ստացման կետից և թողնում ենք կարծիք՝ իրական հաճախորդի ամբողջական ճանապարհ">Оформляем заказ, забираем из ПВЗ, оставляем отзыв — полный цикл реального покупателя</p></div></div>
    </div>

    <div class="highlight-result" data-ru="В результате повышаются ВСЕ конверсии вашей карточки: CTR, переходы, добавления в корзину, заказы. Карточка закрепляется в ТОПе и начинает получать органический трафик. Чем выше позиция — тем больше органических продаж без дополнительных вложений." data-am="Արդյունքում, ձեր քարտի ԲՈԼՈՐ փոխակերպումները մեծանում են՝ CTR, զամբյուղում ավելացումներ և պատվերներ: Ձեր քարտը դառնում է որոնման ամենաբարձր վարկանիշ ունեցող արդյունք և սկսում է ստանալ օրգանական տրաֆիկ: Որքան բարձր է վարկանիշը, այնքան շատ օրգանական վաճառքներ դուք կապահովեք առանց որևէ լրացուցիչ ներդրման:"><i class="fas fa-bolt"></i> <strong>Результат:</strong> повышаются <strong>ВСЕ конверсии</strong> вашей карточки: CTR, переходы, добавления в корзину, заказы. Карточка закрепляется в ТОПе и начинает получать <strong>органический трафик</strong>. Чем выше позиция — тем больше органических продаж без дополнительных вложений.</div>
  </div>

  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-warning"><i class="fas fa-fire"></i> <span data-ru="Начать выкупы" data-am="Սկսել գնումները">Начать выкупы</span></a>
  </div>
</div>
</section>


<!-- ===== 50K: BLOGGER VS BUYOUTS ===== -->
<section class="section" id="fifty-vs-fifty" data-section-id="fifty-vs-fifty">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-balance-scale-right"></i> <span data-ru="Сравнение бюджетов" data-am="Բյուջեների համեմատություն">Сравнение бюджетов</span></div>
    <h2 class="section-title" data-ru="50 000 ֏ на блогера vs 50 000 ֏ на выкупы" data-am="50 000 ֏ բլոգեր vs 50 000 ֏ ինքնագնումներ">50 000 ֏ на блогера vs 50 000 ֏ на выкупы</h2>
  </div>

<div class="why-block fade-up">
    <h3><i class="fas fa-balance-scale-right"></i> <span data-ru="50 000 ֏ на блогера vs 50 000 ֏ на выкупы — что эффективнее?" data-am="50 000 ֏ բլոգեր vs 50 000 ֏ ինքնագնումներ — որն է ավելի արդյունավետ?">50 000 ֏ на блогера vs 50 000 ֏ на выкупы — что эффективнее?</span></h3>
    <div class="compare-box">
      <div class="compare-side bad">
        <h4><i class="fas fa-dice"></i> <span data-ru="Reels у блогера" data-am="Reels բլոգերի մոտ">Reels у блогера</span></h4>
        <div class="price-tag">50 000 ֏</div>
        <p data-ru="1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это всегда риск без гарантий результата. Нету просмотров на Reels соответственно нету продаж на товары. Блогер не ключ к продажам. Инвестируйте в рекламу с умом!" data-am="Բլոգերի 1 տեսանյութը ռիսկ է։ Անկախ նրանից՝ այն կհավագի դիտումներ, թե ոչ՝ ոչ ոք չգիտի։ Եթե ոչ, գումարը կորած է։ Դա միշտ ռիսկ է՝ առանց երաշխավորված արդյունքի։ Չկան դիտումներ չկան նաև վաճառքներ։ Բլոգերը դա վաճառքի բանալի չէ։ Ներդրեք գումարը գովազդի մեջ մտածված։">1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это <strong>всегда риск</strong> без гарантий результата. Нету просмотров на Reels — соответственно нету продаж на товары. Блогер не ключ к продажам. <strong>Инвестируйте в рекламу с умом!</strong></p>
      </div>
      <div class="compare-side good">
        <h4><i class="fas fa-chart-line"></i> <span data-ru="25 выкупов по ключевым" data-am="25 ինքնագնում բանալի բառով">25 выкупов по ключевым</span></h4>
        <div class="price-tag">50 000 ֏</div>
        <p data-ru="25 выкупов по целевому запросу — это 100% проверенный способ продвижения. Ваш товар быстро поднимается в ТОП выдачи зависимо от изначальных позиций, закрепляется там и начинает привлекать органический трафик. Больше продаж. Больше гарантированной выручки." data-am="25 ինքնագնում բանալի բառով 100% ապացուցված առաջխաղացման մեթոդ է: Ձեր ապրանքը արագորեն բարձրանում է որոնման արդյունքների առաջատար դիրքեր, հաստատվում է և սկսում է գրացել օրգանիգ դիտումներ: Շատ դիտում ավելի շատ վաճառք: Երաշխավորված ավելի շատ եկամուտ: ">25 выкупов по целевому запросу — это <strong>100% проверенный способ</strong> продвижения. Ваш товар быстро поднимается в ТОП выдачи зависимо от изначальных позиций, закрепляется там и начинает привлекать <strong>органический трафик</strong>. Больше продаж. Больше гарантированной выручки.</p>
      </div>
    </div>
    <div class="highlight-result" data-ru="Факт: при выкупах по 1 ключевому запросу уже от 25 штук товар быстро продвигается в ТОП и закрепляется там надолго — за счёт улучшения всех поведенческих метрик. А органический трафик WB становится вашим основным источником продаж." data-am="25 հատ ինքնագնման դեպքոմ կախված ապրանքի սկզբնական դիրքից ապրանքն արագ առաջ է շարժվում դեպի վերև և այնտեղ դիրքավորվում է երկար ժամանակով՝ բոլոր վարքագծային չափորոշիչների բարելավման հաշվին։ Իսկ WB-ի օրգանիկ անվճար տրաֆիկը դառնում է ձեր վաճառքի հիմնական աղբյուրը:"><i class="fas fa-lightbulb"></i> <strong>Факт:</strong> при выкупах по 1 ключевому запросу уже от <strong>25 штук</strong> товар быстро продвигается в ТОП и закрепляется там надолго — за счёт улучшения всех поведенческих метрик. А органический трафик WB становится вашим основным источником продаж.</div>
  </div>

  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-warning"><i class="fas fa-fire"></i> <span data-ru="Начать выкупы по ключевикам" data-am="Սկսել գնումները բանալի բառերով">Начать выкупы по ключевикам</span></a>
  </div>
</div>
</section>


<!-- ===== WB OFFICIAL ===== -->
<section class="section section-dark" id="wb-official" data-section-id="wb-official">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-gavel"></i> <span data-ru="Официально" data-am="Պաշտոնապես">Официально</span></div>
    <h2 class="section-title" data-ru="Wildberries официально разрешил самовыкупы" data-am="Wildberries-ը պաշտոնապես թույլատրել է ինքնագնումները">Wildberries <span class="gr">официально разрешил</span> самовыкупы</h2>
  </div>

  <div class="why-block fade-up">
    <div class="wb-official-badge"><i class="fas fa-check-circle"></i> Подтверждено в оферте WB</div>
    
    <h3><i class="fas fa-shield-alt"></i> <span data-ru="Никаких штрафов. Никаких рисков." data-am="Ոչ մի տուգանք: Ոչ մի ռիսկ:">Никаких штрафов. Никаких рисков.</span></h3>
    <p data-ru="Wildberries официально подтвердил в своей оферте, что самовыкупы не являются нарушением. За это не предусмотрены штрафы или блокировки кабинета. Тысячи успешных продавцов используют этот инструмент каждый день." data-am="Wildberries-ը պաշտոնապես հաստատել է իր օֆերտայում، որ ինքնագնումները խախտում չեն: Տուգանքներ կամ արգելափակումներ նախատեսված չեն: Հազարավոր հաջողակ վաճառողներ օգտագործում են այս գործիքը ամեն օր:">Wildberries официально подтвердил в своей оферте, что самовыкупы <strong>не являются нарушением</strong>. За это не предусмотрены штрафы или блокировки кабинета. Тысячи успешных продавцов используют этот инструмент каждый день.</p>
    
    <h3><i class="fas fa-arrow-up"></i> <span data-ru="WB вернул приоритет органической выдачи" data-am="WB-ն վերադարձրել է օրգանիկի առաջնահերթությունը:">WB вернул приоритет органической выдачи</span></h3>
    <p data-ru="Wildberries подтвердил в обновлённой оферте: приоритет в поисковой выдаче получают товары с лучшими поведенческими метриками — конверсия, время на карточке, добавления в корзину, заказы. Именно это мы и прокачиваем при каждом выкупе." data-am="Wildberries-ը հաստատել է թարմացված օֆերտայում։ որոնման արդյունքներում առաջնահերթություն են ստանում լավագույն վարքագծային ցուցանիշներով ապրանքները։ Հենց դա է, ինչ մենք ապահովում ենք յուրաքանչյուր գնումի ընթացքում: Հիմա գլխավոր էջի թոփ 100-ի մեծ մասը օրգանիկ դիրքեր են, նախկին գովազդի փոխարեն։ Թարմացված օֆերտայում նշված է، որ որոնման արդյունքներում առաջնահերթություն ստանում են լավագույն վարքագծական ցուցանիշներով ապրանքները:">Wildberries подтвердил в обновлённой оферте: приоритет в поисковой выдаче получают товары с лучшими <strong>поведенческими метриками</strong> — конверсия, время на карточке, добавления в корзину, заказы. <strong>Именно это мы и прокачиваем при каждом выкупе.</strong> Сейчас на главной странице в топ-100 выдаче больше органической выдачи. Ранее всё было заполнено рекламными местами. В оферте WB подтверждает, что приоритет сейчас — в конверсиях карточки.</p>

    <div class="highlight-result" data-ru="Сейчас — лучшее время для продвижения вашего товара. Пока конкуренты сомневаются — вы уже можете занять ТОП выдачи, привлечь органический трафик и зарабатывать больше. Не ждите, пока конкуренты сделают это первыми." data-am="Այժմ լավագույն ժամանակն է ձեր ապրանքների առաջխաղացման համար: Մինչ մրցակիցները կասկածում են, դուք արդեն կարող եք վերցնել լավագույն դիրքերը TOP-ում, ներգրավել օրգանական թրաֆիկը և վաստակել ավել գումար։ Մի սպասեք, որ մրցակիցները դա անեն առաջինը:"><i class="fas fa-rocket"></i> <strong>Сейчас — лучшее время</strong> для продвижения вашего товара. Пока конкуренты сомневаются — вы уже можете занять ТОП выдачи, привлечь органический трафик и <strong>зарабатывать больше</strong>. Не ждите, пока конкуренты сделают это первыми.</div>

  </div>

  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success"><i class="fas fa-rocket"></i> <span data-ru="Занять ТОП прямо сейчас" data-am="Զբաղեցնել ՏՏՏ-ը հիմա">Занять ТОП прямо сейчас</span></a>
  </div>
</div>
</section>

<!-- ===== CALCULATOR ===== -->
<section class="section section-dark" id="calculator" data-section-id="calculator">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-calculator"></i> <span data-ru="Калькулятор" data-am="Հաշվիչ">Калькулятор</span></div>
    <h2 class="section-title" data-ru="Рассчитайте стоимость услуг" data-am="Հաշվեք ծառայությունների արժեքը">Рассчитайте стоимость услуг</h2>
    <p class="section-sub" data-ru="Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram." data-am="Ընտրեք անհրաժեշտ ծառայությունները, նշեք քանակը և իմացեք գումարը: Պատվերը ձևակերպվում է Telegram-ով:">Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram.</p>
  </div>
  <div class="calc-wrap fade-up">
    <div class="calc-packages" id="calcPackages" style="display:none"></div>
    <div class="calc-tabs">
      <div class="calc-tab active" onclick="showCalcTab('buyouts',this)" data-ru="Выкупы" data-am="Գնումներ">Выкупы</div>
      <div class="calc-tab" onclick="showCalcTab('reviews',this)" data-ru="Отзывы" data-am="Կարծիքներ">Отзывы</div>
      <div class="calc-tab" onclick="showCalcTab('photo',this)" data-ru="Фотосъёмка" data-am="Լուսանկարահանում">Фотосъёмка</div>
      <div class="calc-tab" onclick="showCalcTab('ff',this)" data-ru="ФФ" data-am="Ֆուլֆիլմենթ">ФФ</div>
      <div class="calc-tab" onclick="showCalcTab('logistics',this)" data-ru="Логистика" data-am="Լոգիստիկա">Логистика</div>
      <div class="calc-tab" onclick="showCalcTab('other',this)" data-ru="Прочие услуги" data-am="Այլ ծառայություններ">Прочие услуги</div>
    </div>

    <!-- ===== ВЫКУПЫ ===== -->
    <div class="calc-group active" id="cg-buyouts">
      <div class="calc-row" data-price="buyout" id="buyoutRow">
        <div class="calc-label" data-ru="Выкуп + забор из ПВЗ" data-am="Գնում + ստացում ՊՎԶ-ից">Выкуп + забор из ПВЗ</div>
        <div class="calc-price" id="buyoutPriceLabel">2 000 ֏</div>
        <div class="calc-input"><button onclick="ccBuyout(-1)">−</button><input type="number" id="buyoutQty" value="0" min="0" max="999" onchange="onBuyoutInput()" oninput="onBuyoutInput()"><button onclick="ccBuyout(1)">+</button></div>
      </div>
      <!-- tier-info removed: dynamically generated from DB by JS -->
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Выкуп КГТ + забор из ПВЗ" data-am="Ծանրաքաշ ապրանքի գնում + ստացում ՊՎԶ-ից">Выкуп КГТ + забор из ПВЗ</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ОТЗЫВЫ ===== -->
    <div class="calc-group" id="cg-reviews">
      <div class="calc-row" data-price="300">
        <div class="calc-label" data-ru="Оценка" data-am="Գնահատական">Оценка</div>
        <div class="calc-price">300 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="500">
        <div class="calc-label" data-ru="Оценка + отзыв" data-am="Գնահատական + կարծիք">Оценка + отзыв</div>
        <div class="calc-price">500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="500">
        <div class="calc-label" data-ru="Вопрос к товару" data-am="Հարց ապրանքի վերաբերյալ">Вопрос к товару</div>
        <div class="calc-price">500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="250">
        <div class="calc-label" data-ru="Написание текста отзыва" data-am="Կարծիքի տեքստի գրում">Написание текста отзыва</div>
        <div class="calc-price">250 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="100">
        <div class="calc-label" data-ru="Подписка на бренд / страницу" data-am="Բրենդի / էջի բաժանորդագրություն">Подписка на бренд / страницу</div>
        <div class="calc-price">100 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ФОТОСЪЁМКА ===== -->
    <div class="calc-group" id="cg-photo">
      <div class="calc-row" data-price="3500">
        <div class="calc-label" data-ru="Фотосессия в гардеробной WB (жен. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (կին մոդել)">Фотосессия в гардеробной WB (жен. модель)</div>
        <div class="calc-price">3 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="4500">
        <div class="calc-label" data-ru="Фотосессия в гардеробной WB (муж. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (տղամարդ մոդել)">Фотосессия в гардеробной WB (муж. модель)</div>
        <div class="calc-price">4 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Предметная фотосъёмка (3 фото)" data-am="Առարկայական լուսանկարահանում (3 լուսանկար)">Предметная фотосъёмка (3 фото)</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="5000">
        <div class="calc-label" data-ru="Предметная съёмка (крупное / техника, 3 фото)" data-am="Առարկայական լուսանկարահանում (խոշոր / տեխնիկա, 3 լուս.)">Предметная съёмка (крупное / техника, 3 фото)</div>
        <div class="calc-price">5 000 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Ребёнок модель (до 14 лет)" data-am="Երեխա մոդել (մինչև 14 տարեկան)">Ребёнок модель (до 14 лет)</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="7000">
        <div class="calc-label" data-ru="Видеообзор товара" data-am="Ապրանքի վիդեոհոլովակ">Видеообзор товара</div>
        <div class="calc-price">7 000 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ФФ (Фулфилмент) ===== -->
    <div class="calc-group" id="cg-ff">
      <div class="calc-row" data-price="100">
        <div class="calc-label" data-ru="Замена штрихкода" data-am="Շտրիխկոդի փոխարինում">Замена штрихкода</div>
        <div class="calc-price">100 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="200">
        <div class="calc-label" data-ru="Переупаковка (наша)" data-am="Վերափաթեթավորում (մեր փաթեթ)">Переупаковка (наша)</div>
        <div class="calc-price">200 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="150">
        <div class="calc-label" data-ru="Переупаковка (клиента)" data-am="Վերափաթեթավորում (հաճախորդի փաթեթ)">Переупаковка (клиента)</div>
        <div class="calc-price">150 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ЛОГИСТИКА ===== -->
    <div class="calc-group" id="cg-logistics">
      <div class="calc-row" data-price="2000">
        <div class="calc-label" data-ru="Доставка на склад WB (1 коробка 60х40х40)" data-am="Առաքում WB պահեստ (1 տուփ 60x40x40)">Доставка на склад WB (1 коробка 60х40х40)</div>
        <div class="calc-price">2 000 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Доставка до вашего склада (1 коробка 60х40х40)" data-am="Առաքում ձեր պահեստ (1 տուփ 60x40x40)">Доставка до вашего склада (1 коробка 60х40х40)</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ПРОЧИЕ УСЛУГИ ===== -->
    <div class="calc-group" id="cg-other">
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Глажка одежды (одиночная вещь)" data-am="Հագուստի արդուկում (մեկ իր)">Глажка одежды (одиночная вещь)</div>
        <div class="calc-price">1 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Глажка одежды (верхняя одежда)" data-am="Հագուստի արդուկում (վերնահագուստ)">Глажка одежды (верхняя одежда)</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Забор из ПВЗ для съёмки" data-am="Վերցնում ՊՎԶ-ից">Забор из ПВЗ для съёмки</div>
        <div class="calc-price">1 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Возврат в ПВЗ после съёмки" data-am="Վերցնում ՊՎԶ-ից">Возврат в ПВЗ после съёмки</div>
        <div class="calc-price">1 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>
    <div class="calc-total">
      <div class="calc-total-label" data-ru="Итого:" data-am="Ընդամենը:">Итого:</div>
      <div class="calc-total-value" id="calcTotal" data-total="0">0 ֏</div>
    </div>
    <!-- Referral code field -->
    <div id="calcRefWrap" style="margin-top:16px;padding:16px;background:rgba(139,92,246,0.05);border:1px solid var(--border);border-radius:var(--r-sm)">
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <label style="display:block;font-size:0.82rem;font-weight:600;color:var(--accent);margin-bottom:6px"><i class="fas fa-gift" style="margin-right:6px"></i><span data-ru="Есть промокод?" data-am="Պրոմոկոդ ունեք?">Есть промокод?</span></label>
          <input type="text" id="refCodeInput" placeholder="PROMO2026" style="width:100%;padding:10px 14px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.92rem;font-family:inherit;text-transform:uppercase;outline:none;transition:var(--t)" onfocus="this.style.borderColor='var(--purple)'" onblur="this.style.borderColor='var(--border)'">
        </div>
        <button onclick="checkRefCode()" class="btn btn-outline" style="padding:10px 20px;font-size:0.88rem;white-space:nowrap"><i class="fas fa-check-circle" style="margin-right:6px"></i><span data-ru="Применить" data-am="Կիրառել">Применить</span></button>
      </div>
      <div id="refResult" style="display:none;margin-top:10px;padding:10px 14px;border-radius:8px;font-size:0.88rem;font-weight:500"></div>
    </div>
    <div class="calc-cta" style="display:none">
      <a href="https://t.me/goo_to_top" id="calcTgBtn" class="btn btn-primary btn-lg" target="_blank">
        <i class="fab fa-telegram"></i>
        <span data-ru="Заказать в Telegram" data-am="Պատվիրել հիմա">Заказать сейчас</span>
      </a>
    </div>
  </div>
</div>
</section>

<!-- ===== PROCESS ===== -->
<section class="section" id="process" data-section-id="process">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-route"></i> <span data-ru="Как мы работаем" data-am="Ինչպես ենք աշխատում">Как мы работаем</span></div>
    <h2 class="section-title" data-ru="5 шагов от заявки до ТОПа" data-am="5 քայլ մինչև TOP">5 шагов от заявки до ТОПа</h2>
  </div>
  <div class="process-grid fade-up">
    <div class="step"><div class="step-line"></div><div class="step-num">1</div><h4 data-ru="Заявка" data-am="Հայտ">Заявка</h4><p data-ru="Пишете в Telegram и описываете товар" data-am="Գրում եք Telegram-ով և նկարագրում ապրանքը">Пишете в Telegram и описываете товар</p></div>
    <div class="step"><div class="step-line"></div><div class="step-num">2</div><h4 data-ru="Анализ" data-am="Վերլուծություն">Анализ</h4><p data-ru="Анализируем нишу и создаём стратегию" data-am="Վերլուծում ենք ապրանքը և ստեղծում ստրատեգիա">Анализируем нишу и создаём стратегию</p></div>
    <div class="step"><div class="step-line"></div><div class="step-num">3</div><h4 data-ru="Запуск" data-am="Մեկնարկ">Запуск</h4><p data-ru="Начинаем выкупы в течение 24 часов" data-am="Սկսում ենք գնումները 24 ժամվա ընթացքում">Начинаем выкупы в течение 24 часов</p></div>
    <div class="step"><div class="step-line"></div><div class="step-num">4</div><h4 data-ru="Контроль" data-am="Վերահսկողություն">Контроль</h4><p data-ru="Ежедневные отчёты о прогрессе" data-am="Ամենօրյա հաշվետվություններ ընթացքի մասին">Ежедневные отчёты о прогрессе</p></div>
    <div class="step"><div class="step-num">5</div><h4 data-ru="Результат" data-am="Արդյունք">Результат</h4><p data-ru="Ваш товар в ТОПе выдачи WB" data-am="Ձեր ապրանքը WB-ի TOP-ում է">Ваш товар в ТОПе выдачи WB</p></div>
  </div>
  <div class="section-cta">
    <a href="https://t.me/suport_admin_2" target="_blank" class="btn btn-tg"><i class="fab fa-telegram"></i> <span data-ru="Написать менеджеру" data-am="Գրել մենեջերին">Написать менеджеру</span></a>
  </div>
</div>
</section>

<!-- ===== WAREHOUSE ===== -->
<section class="section section-dark" id="warehouse" data-section-id="warehouse">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-warehouse"></i> <span data-ru="Наш склад" data-am="Մեր պահեստը">Наш склад</span></div>
    <h2 class="section-title" data-ru="Всё организовано и по полочкам" data-am="Ամեն ինչ կազմակերպված է և կարգավորված">Всё организовано и по полочкам</h2>
  </div>
  <div class="wh-grid fade-up">
    <div class="wh-item" onclick="openLightbox(this)">
      <img src="/static/img/warehouse1.jpg" alt="Организованное хранение товаров">
      <div class="wh-caption" data-ru="Организованное хранение" data-am="Կազմակերպված պահպանում">Организованное хранение</div>
    </div>
    <div class="wh-item" onclick="openLightbox(this)">
      <img src="/static/img/warehouse2.jpg" alt="Склад с товарами">
      <div class="wh-caption" data-ru="Система учёта" data-am="Հաշվառման համակարգ">Система учёта</div>
    </div>

  </div>
  <p class="section-sub fade-up" style="text-align:center;max-width:700px;margin:32px auto 0" data-ru="Собственный склад в Ереване. Забор ваших товаров с ПВЗ. Надежное хранение товара. Отгрузка Ваших товаров на склад WB СЦ Ереван" data-am="Սեփական պահեստ Երևանում: Ձեր ապրանքների ստացում ՊՎԶ-ից: Հուսալի պահպանում: Ձեր ապրանքների առաքում WB Երևան պահեստ">Собственный склад в Ереване. Забор ваших товаров с ПВЗ. Надежное хранение товара. Отгрузка Ваших товаров на склад WB СЦ Ереван</p>
  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><i class="fas fa-shopping-cart"></i> <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">Заказать сейчас</span></a>
  </div>
</div>
</section>

<!-- ===== GUARANTEE ===== -->
<section class="section" id="guarantee" data-section-id="guarantee">
<div class="container">
    <div class="guarantee-card fade-up">
    <div class="guarantee-el-photo">
    <img src="/static/img/team-office.jpg" alt="Команда Go to Top">
    </div>
    <div class="guarantee-el-title">
      <div class="section-badge"><i class="fas fa-shield-alt"></i> <span data-ru="Гарантия безопасности" data-am="Անվտանգության երաշխիք">Гарантия безопасности</span></div>
      <h2 data-ru="Всё организовано и по полочкам. Наша команда" data-am="Ամեն ինչ կազմակերպված է և կարգավորված։ Մեր թիմը">Всё организовано и по полочкам. Наша команда</h2>
    </div>
    <div class="guarantee-el-texts">
      <p data-ru="За всё время работы ни один кабинет клиента не получил блокировку. Каждый проект ведётся опытной командой с полным контролем на каждом этапе." data-am="Աշխատանքի ողջ ընթացքում ոչ մի հաճախորդի հաշիվ չի արգելափակվել: Երբ նախագիծը վարվում է փորձառու թիմի կողմից լիարժեք վերահսկողությամբ յուրաքանչյուր փուլում:">За всё время работы ни один кабинет клиента не получил блокировку. Каждый проект ведётся опытной командой с полным контролем на каждом этапе.</p>
      <ul class="g-list">
        <li><i class="fas fa-check-circle"></i> <span data-ru="Реальное поведение человека во время выкупа" data-am="Իրական մարդկային վարքագիծ գնում կատարելիս">Реальное поведение человека во время выкупа</span></li>
        <li><i class="fas fa-check-circle"></i> <span data-ru="Реальные аккаунты с историей покупок" data-am="Իրական հաշիվներ գնումների պատմությամբ">Реальные аккаунты с историей покупок</span></li>
        <li><i class="fas fa-check-circle"></i> <span data-ru="Естественное распределение по географии" data-am="Բնական աշխարհագրական բաշխում">Естественное распределение по географии</span></li>
      </ul>
      <div class="g-badge">
        <i class="fas fa-award"></i>
        <span data-ru="0 блокировок за всё время работы" data-am="0 արգելափակում աշխատանքի ողջ ընթացքում">0 блокировок за всё время работы</span>
      </div>
    </div>
    <div class="guarantee-el-buttons">
      <div class="section-cta" style="margin-top:24px">
        <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success"><i class="fas fa-rocket"></i> <span data-ru="Начать продвижение" data-am="Սկսել առաջխաղացումը">Начать продвижение</span></a>
      </div>
    </div>
  </div>
</div>
</section>

<!-- ===== COMPARISON ===== -->
<section class="section section-dark" data-section-id="comparison">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-balance-scale"></i> <span data-ru="Сравнение" data-am="Համեմատություն">Сравнение</span></div>
    <h2 class="section-title" data-ru="Go to Top vs Другие агентства" data-am="Go to Top vs Այլ գործակալություններ">Go to Top vs Другие агентства</h2>
  </div>
  <div class="fade-up"><div class="cmp-table-wrap">
  <table class="cmp-table">
    <thead><tr>
      <th data-ru="Критерий" data-am="Չափանիշ">Критерий</th>
      <th>Go to Top</th>
      <th data-ru="Другие" data-am="Այլեր">Другие</th>
    </tr></thead>
    <tbody>
      <tr><td data-ru="Реальные люди" data-am="Իրական մարդիկ">Реальные люди</td><td><i class="fas fa-check-circle chk"></i> <span data-ru="Да" data-am="Այո">Да</span></td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Часто боты" data-am="Հաճախ բոտեր">Часто боты</span></td></tr>
      <tr><td data-ru="Собственный склад" data-am="Սեփական պահեստ">Собственный склад</td><td><i class="fas fa-check-circle chk"></i> <span data-ru="Ереван" data-am="Երևան">Ереван</span></td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Нет" data-am="Ոչ">Нет</span></td></tr>
      <tr><td data-ru="Блокировки" data-am="Արգելափակումներ">Блокировки</td><td><i class="fas fa-check-circle chk"></i> 0</td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Бывают" data-am="Լինում են">Бывают</span></td></tr>
      <tr><td data-ru="Фотосессия товаров" data-am="Ապրանքների լուսանկարահանում">Фотосессия товаров</td><td><i class="fas fa-check-circle chk"></i> <span data-ru="Свои модели" data-am="Սեփական մոդելներ">Свои модели</span></td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Нет" data-am="Ոչ">Нет</span></td></tr>
      <tr><td data-ru="Прозрачная отчётность" data-am="Թափանցիկ հաշվետվություն">Прозрачная отчётность</td><td><i class="fas fa-check-circle chk"></i> <span data-ru="Ежедневно" data-am="Ամենօր">Ежедневно</span></td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Раз в неделю" data-am="Շաբաթը մեկ անգամ">Раз в неделю</span></td></tr>
    </tbody>
  </table>
  </div></div>
  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success"><i class="fas fa-rocket"></i> <span data-ru="Убедитесь сами — начните сейчас" data-am="Սկսել գնումները հիմա">Начать выкупы сейчас</span></a>
  </div>
</div>
</section>

<!-- ===== IMPORTANT NOTES ===== -->
<section class="section" data-section-id="important">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-info-circle"></i> <span data-ru="Важно знать" data-am="Կարևոր է իմանալ">Важно знать</span></div>
    <h2 class="section-title" data-ru="Условия работы" data-am="Աշխատանքի պայմաններ">Условия работы</h2>
  </div>
  <div class="services-grid fade-up">
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-percent"></i></div>
      <h3 data-ru="Лимит отзывов" data-am="Կարծիքների սահմանափակում">Лимит отзывов</h3>
      <p data-ru="Публикуем отзывы не более чем на 50% выкупленных товаров — для безопасности вашего кабинета." data-am="Կարծիքներ հրապարակում ենք գնված ապրանքների ոչ ավելի քան 50%-ի վրա — ձեր հաշվի անվտանգության համար:">Публикуем отзывы не более чем на 50% выкупленных товаров — для безопасности вашего кабинета.</p>
    </div>
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-box-open"></i></div>
      <h3 data-ru="Крупногабаритный товар" data-am="Խոշոր չափսի ապրանք">Крупногабаритный товар</h3>
      <p data-ru="Товар свыше 3 кг или одна сторона длиннее 55 см. Свыше 10 кг — стоимость рассчитывается индивидуально." data-am="3 կգ-ից ավելի կամ մի կողմ 55 սմ-ից ավելի: 10 կգ-ից ավելի ապրանքների համար — արժեքը հաշվարկվում է անհատական:">Товар свыше 3 кг или одна сторона длиннее 55 см. Свыше 10 кг — стоимость рассчитывается индивидуально.</p>
    </div>
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-box"></i></div>
      <h3 data-ru="Защитные пломбы" data-am="Պաշտպանիչ կապարաններ">Защитные пломбы</h3>
      <p data-ru="Товары с защитными пломбами или заводской упаковкой после фотосессии не восстанавливаются." data-am="Պաշտպանիչ կապարաններով կամ գործարանային փաթեթավորմամբ ապրանքները լուսանկարահանումից հետո չեն վերականգնվում:">Товары с защитными пломбами или заводской упаковкой после фотосессии не восстанавливаются.</p>
    </div>
  </div>
  <div class="section-cta">
    <a href="https://t.me/suport_admin_2" target="_blank" class="btn btn-tg"><i class="fab fa-telegram"></i> <span data-ru="Уточнить условия" data-am="Գրել մենեջերին">Написать менеджеру</span></a>
  </div>
</div>
</section>

<!-- ===== CLIENT REVIEWS / REAL CASES ===== -->
<section class="section" id="client-reviews" data-section-id="client-reviews">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-star"></i> <span data-ru="Реальные кейсы" data-am="Իրական դեպքեր">Реальные кейсы</span></div>
    <h2 class="section-title" data-ru="Отзывы наших клиентов" data-am="Մեր հաճախորդների կարծիքները">Отзывы наших клиентов</h2>
    <p class="section-sub" data-ru="Результаты говорят сами за себя — вот что получают наши клиенты" data-am="Արդյունքները խոսում են ինքնիրենք — ահա թե ինչ են ստանում մեր հաճախորդները">Результаты говорят сами за себя — вот что получают наши клиенты</p>
  </div>
  <div class="reviews-gallery-area fade-up" id="reviewsCarouselArea">
    <!-- Photos injected dynamically from admin panel via blockFeatures -->
    <div style="text-align:center;padding:16px 0;color:var(--text-muted,#666)">
      <i class="fas fa-spinner fa-spin" style="font-size:1.2rem;opacity:0.3"></i>
    </div>
  </div>
  <!-- Dynamic CTA buttons injected here -->
  <div class="section-cta fade-up" id="reviewsCtaArea" style="text-align:center"></div>
</div>
</section>

<!-- ===== FAQ ===== -->
<section class="section section-dark" id="faq" data-section-id="faq">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-question-circle"></i> <span data-ru="FAQ" data-am="ՀՏՀ">FAQ</span></div>
    <h2 class="section-title" data-ru="Частые вопросы" data-am="Հաճախ տրվող հարցեր">Частые вопросы</h2>
  </div>
  <div class="faq-list fade-up">
    <div class="faq-item active">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Могут ли заблокировать мой кабинет?" data-am="Կարող են արգելափակել իմ կաբինետը։">Могут ли заблокировать мой кабинет?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="За всё время нашей работы ни один кабинет клиента не получил блокировку. Мы используем реальные аккаунты с историей покупок, собственный склад и естественное распределение по географии." data-am="Մեր աշխատանքի ողջ ընթացքում ոց մի հաճախորդի կաբինետ չի արգելափակվել: Մենք օգտագործում ենք իրական հաշիվներ գնումների պատմությամբ, սեփական պահեստ և բնական աշխարհագրական բաշխում:">За всё время нашей работы ни один кабинет клиента не получил блокировку. Мы используем реальные аккаунты с историей покупок, собственный склад и естественное распределение по географии.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Как быстро начнётся продвижение?" data-am="Ինչքան արագ կսկսվի առաջխաղացումը։">Как быстро начнётся продвижение?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="В течение 24 часов после согласования стратегии и оплаты." data-am="24 ժամվա ընթացքում ստրատեգիայի համաձայնեցումից և վճարման հետո:">В течение 24 часов после согласования стратегии и оплаты.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Выкупы делают реальные люди или боты?" data-am="Գնումները կատարում են իրական մարդիկ թե։ բոտեր։">Выкупы делают реальные люди или боты?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Только реальные люди. У нас собственный склад с устройствами и реальными аккаунтами. Каждый выкуп делается вручную, никаких ботов." data-am="Միայն իրական մարդիկ: Մենք ունենք սեփական պահեստ սարքերով և իրական հաշիվներով: Եվ գնումները կատարվում են ձեռքով, ոչ մի բոտ:">Только реальные люди.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Почему не все выкупы получают отзывы?" data-am="Ինչու ոչ բոլոր գնումներն են ստանում կարծիքներ։">Почему не все выкупы получают отзывы?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Для безопасности вашего кабинета мы публикуем отзывы не более чем на 50% выкупленных товаров. Это имитирует естественное поведение покупателей." data-am="Ձեր կաբինետի անվտանգության համար կարծիքները հրապարակում ենք գնված ապրանքների ոչ ավելի քան 50%-ի համար: Սա նմանակում է գնորդների բնական վարքագիցը:">Для безопасности вашего кабинета мы публикуем отзывы не более чем на 50% выкупленных товаров.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Можно ли заказать только отзывы без выкупов?" data-am="Հնարավոր է պատվիրել միայն կարծիքներ առանց գնումների։">Можно ли заказать только отзывы без выкупов?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Да, мы можем выкупить товар для фото/видео отзыва и затем сделать возврат на ПВЗ. Стоимость уточняйте у менеджера." data-am="Այո, մենք կարող ենք գնել ապրանքը լուսանկար/տեսանյութ կարծիքի համար և հետո վերադարձնել ՊՎԶ: Արժեքը ճշտեք մենեջերի մոտ:">Да, мы можем выкупить товар для фото/видео отзыва и затем сделать возврат на ПВЗ.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Какие отчёты мы получаем?" data-am="Ինչ հաշվետվություններ ենք ստանում։">Какие отчёты мы получаем?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Ежедневные отчёты: статус каждого выкупа, даты забора, статус отзывов. Полная прозрачность на каждом этапе." data-am="Ամենօրյա հաշվետվություններ՝ յուրաքանչյուր գնումի կարգավիճակ, վերցնման ամսաթվեր, կարծիքների կարգավիճակ: Լիարժեք թափանցիկություն յուրաքանչյուր փուլում:">Ежедневные отчёты: статус каждого выкупа, даты забора, статус отзывов. Полная прозрачность на каждом этапе.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="В какой валюте идут цены?" data-am="Ինչ արժույթով են գները։">В какой валюте идут цены?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Все цены указаны в армянских драмах (֏ AMD). Оплата в драмах." data-am="Բոլոր գները նշված են հայկական դրամով (֏ AMD): Վճարումը դրամով:">Все цены указаны в армянских драмах (֏ AMD). Оплата в драмах.</p></div>
    </div>
  </div>
  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><i class="fas fa-shopping-cart"></i> <span data-ru="Остались вопросы? Напишите нам" data-am="Հարցեր ունեք։ Գրեք մեզ">Заказать сейчас</span></a>
  </div>
</div>
</section>

<!-- ===== CONTACT FORM ===== -->
<section class="section" id="contact" data-section-id="contact">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-paper-plane"></i> <span data-ru="Связаться с нами" data-am="Կապվել մեզ">Связаться с нами</span></div>
    <h2 class="section-title" data-ru="Готовы начать продвижение?" data-am="Պատրաստ եք սկսել առաջխաղացումը։">Готовы начать продвижение?</h2>
    <p class="section-sub" data-ru="Напишите нам в Telegram или оставьте заявку" data-am="Գրեք մեզ Telegram-ով կամ թողեք հայտ">Напишите нам в Telegram или оставьте заявку</p>
  </div>
  <div class="contact-grid fade-up">
    <a href="https://t.me/goo_to_top" target="_blank" class="contact-card">
      <i class="fab fa-telegram"></i>
      <h4 data-ru="Администратор" data-am="Ադմինիստրատոր">Администратор</h4>
      <p data-ru="Готов оплатить и приступить к продвижению? Пишите сюда." data-am="Պատրաստ եք վճարել և սկսել առաջխաղացումը։ Գրեք:">Готов оплатить и приступить к продвижению? Пишите сюда.</p>
    </a>
    <a href="https://t.me/suport_admin_2" target="_blank" class="contact-card">
      <i class="fab fa-telegram"></i>
      <h4 data-ru="Менеджер" data-am="Մենեջեր">Менеджер</h4>
      <p data-ru="Остались вопросы? Нужен детальный расчёт? Пишите сюда." data-am="Հարցեր ունեք։ Մանրամասն հաշվարկ է պետք։ Գրեք:">Остались вопросы? Нужен детальный расчёт? Пишите сюда.</p>
    </a>
  </div>
  <div class="form-card fade-up">
    <form id="leadForm" onsubmit="submitForm(event)">
      <div class="form-group"><label data-ru="Ваше имя" data-am="Ձեր անունը">Ваше имя</label><input type="text" id="formName" required placeholder="Имя" data-placeholder-ru="Имя" data-placeholder-am="Անուն"></div>
      <div class="form-group"><label data-ru="Telegram / Телефон" data-am="Telegram / Հեռախոս">Telegram / Телефон</label><input type="text" id="formContact" required placeholder="@username / +374..." data-placeholder-ru="@username / +374..." data-placeholder-am="@username կամ +374..."></div>
      <div class="form-group"><label data-ru="Что продаёте на WB?" data-am="Ինչ եք վաճառում WB-ում։">Что продаёте на WB?</label><input type="text" id="formProduct" placeholder="Одежда, электроника..." data-placeholder-ru="Одежда, электроника..." data-placeholder-am="Հագուստ, էլեկտրոնիկա..."></div>
      <div class="form-group"><label data-ru="Какие услуги интересуют?" data-am="Ինչ ծառայություններ են հետաքրքրում։">Какие услуги интересуют?</label>
        <select id="formService">
          <option value="buyouts" data-ru="Выкупы" data-am="Գնումներ">Выкупы</option>
          <option value="reviews" data-ru="Отзывы" data-am="Կարծիքներ">Отзывы</option>
          <option value="photos" data-ru="Фотосессия" data-am="Լուսանկարահանում">Фотосессия</option>
          <option value="complex" data-ru="Комплекс услуг" data-am="Ծառայությունների փաթեթ" selected>Комплекс услуг</option>
        </select>
      </div>
      <div class="form-group"><label data-ru="Комментарий (необязательно)" data-am="Մեկնաբանություն (ոչ պարտադիր)">Комментарий (необязательно)</label><textarea id="formMessage" placeholder="Опишите ваш товар..." data-placeholder-ru="Опишите ваш товар..." data-placeholder-am="Նկարագրեք ձեր ապրանքը..."></textarea></div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center">
        <i class="fas fa-paper-plane"></i>
        <span data-ru="Отправить заявку" data-am="Ուղարկել հայտը">Отправить заявку</span>
      </button>
    </form>
  </div>
</div>
</section>

<!-- ===== FOOTER ===== -->
<footer class="footer">
<div class="container">
  <div class="footer-grid">
    <div class="footer-brand">
      <div class="logo"><img src="/static/img/logo-gototop.png" alt="Go to Top" style="height:44px"><span class="logo-text">Go to Top</span></div>
      <p data-ru="Безопасное продвижение на Wildberries для армянских продавцов. Реальные покупки с аккаунтов с историей и естественным человеческим поведением. Поднимите ваш товар в ТОП-позиции — зарабатывайте больше." data-am="Անվտանգ առաջխաղացում Wildberries-ում հայ վաճառողների համար։ Իրական գնումներ պատմություն ունեցող հաշիվներով և բնական մարդկային վարքագծով։  Բարձրացրե՛ք ձեր ապրանքը TOP դիրքեր՝ վաստակե՛ք ավելի շատ" data-no-rewrite="1">Безопасное продвижение на Wildberries для армянских продавцов. Реальные покупки с аккаунтов с историей и естественным человеческим поведением. Поднимите ваш товар в ТОП-позиции — зарабатывайте больше.</p>
    </div>
    <div class="footer-col" id="footerNavCol">
      <h4 data-ru="Навигация" data-am="Նավիգացիա" data-no-rewrite="1">Навигация</h4>
      <ul id="footerNavList">
        <li><a href="#services" data-ru="Услуги и цены" data-am="Ծառայություններ և գներ" data-no-rewrite="1">Услуги и цены</a></li>
        <li><a href="#calculator" data-ru="Калькулятор" data-am="Հաշվիչ" data-no-rewrite="1">Калькулятор</a></li>
        <li><a href="#warehouse" data-ru="Наш склад" data-am="Մեր պահեստը" data-no-rewrite="1">Наш склад</a></li>
        <li><a href="#guarantee" data-ru="Гарантии" data-am="Երաշխիքներ" data-no-rewrite="1">Гарантии</a></li>
        <li><a href="#faq" data-ru="FAQ" data-am="ՀՏՀ" data-no-rewrite="1">FAQ</a></li>
      </ul>
    </div>
    <div class="footer-col" id="footerContactCol">
      <h4 data-ru="Контакты" data-am="Կոնտակտներ" data-no-rewrite="1">Контакты</h4>
      <ul>
        <li><a href="https://t.me/goo_to_top" target="_blank"><i class="fab fa-telegram"></i> <span data-ru="Администратор" data-am="Ադմինիստրատոր" data-no-rewrite="1">Администратор</span></a></li>
        <li><a href="https://t.me/suport_admin_2" target="_blank"><i class="fab fa-telegram"></i> <span data-ru="Менеджер" data-am="Մենեջեր" data-no-rewrite="1">Менеджер</span></a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Go to Top. <span data-ru="Все права защищены" data-am="Բոլոր իրավունքները պաշտպանված են" data-no-rewrite="1">Все права защищены</span></span>
    <span data-ru="Ереван, Армения" data-am="Երևան, Հայաստան" data-no-rewrite="1">Ереван, Армения</span>
  </div>
</div>
</footer>

<!-- FLOATING TG BUTTON -->
<a href="https://wa.me/37441888389" target="_blank" class="tg-float">
  <i class="fab fa-whatsapp"></i>
  <span data-ru="Написать нам" data-am="Գրել հիմա" data-no-rewrite="1">Написать нам</span>
</a>

<!-- FLOATING CALC BUTTON -->
<a href="#calculator" class="calc-float" id="calcFloatBtn">
  <i class="fas fa-calculator"></i>
  <span data-ru="Калькулятор" data-am="Հաշվիչ" data-no-rewrite="1">Հաշվիչ</span>
</a>

<!-- LIGHTBOX -->
<div class="lightbox" id="lightbox" onclick="lbClickHandler(event)">
  <button class="lb-close" onclick="closeLightbox()"><i class="fas fa-times"></i></button>
  <button class="lb-nav lb-prev" onclick="event.stopPropagation();lbNav(-1)"><i class="fas fa-chevron-left"></i></button>
  <img id="lightboxImg" src="" alt="">
  <button class="lb-nav lb-next" onclick="event.stopPropagation();lbNav(1)"><i class="fas fa-chevron-right"></i></button>
</div>

<!-- ===== POPUP (5 sec) ===== -->
<div class="popup-overlay" id="popupOverlay">
  <div class="popup-card">
    <button class="popup-close" id="popupCloseBtn">✕</button>
    <div id="popupFormWrap">
      <div class="popup-icon"><i class="fas fa-chart-line"></i></div>
      <h3 data-ru="Повысь рейтинг магазина прямо сейчас!" data-am="Բարձրացրեք խանութի վարկանիշը հիմա!">Повысь рейтинг магазина прямо сейчас!</h3>
      <p class="popup-sub" data-ru="Выкупы живыми людьми, отзывы с фото, профессиональные фотосессии. Узнайте сколько это стоит!" data-am="Անձնական մենեջերը կկապվի ձեզ և կպատրաստի անհատական հաշվարկ">Персональный менеджер свяжется с вами и подготовит индивидуальный расчёт</p>
      <form id="popupForm">
        <div class="pf-group">
          <label class="pf-label" data-ru="Ваше имя" data-am="Ձեր անունը" data-no-rewrite="1">Ваше имя</label>
          <input class="pf-input" type="text" id="popupName" required placeholder="Имя" data-placeholder-ru="Имя" data-placeholder-am="Անուն">
        </div>
        <div class="pf-row">
          <div class="pf-group">
            <label class="pf-label" data-ru="Сколько выкупов нужно?" data-am="Քանի գնում է պետք։">Сколько выкупов нужно?</label>
            <input class="pf-input" type="number" id="popupBuyouts" min="0" placeholder="Напр: 20" required data-placeholder-ru="Напр: 20" data-placeholder-am="Օրինակ: 20">
          </div>
          <div class="pf-group">
            <label class="pf-label" data-ru="Сколько отзывов нужно?" data-am="Քանի կարծիք է պետք։">Сколько отзывов нужно?</label>
            <input class="pf-input" type="number" id="popupReviews" min="0" placeholder="Напр: 10" required data-placeholder-ru="Напр: 10" data-placeholder-am="Օրինակ: 10">
          </div>
        </div>
        <div class="pf-group">
          <label class="pf-label" data-ru="Ваш Telegram или телефон" data-am="Ձեր Telegram-ը կամ հեռախосը">Ваш Telegram или телефон</label>
          <input class="pf-input" type="text" id="popupContact" required placeholder="@username или +374..." data-placeholder-ru="@username или +374..." data-placeholder-am="@username կամ +374...">
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:12px">
          <i class="fas fa-paper-plane"></i>
          <span data-ru="Получить мою стратегию" data-am="Ստանալ իմ ռազմավարությունը">Получить мою стратегию</span>
        </button>
      </form>
    </div>
    <div class="popup-success" id="popupSuccess">
      <i class="fas fa-check-circle"></i>
      <h4 data-ru="Заявка отправлена!" data-am="Հայտը ուղարկված է!">Заявка отправлена!</h4>
      <p data-ru="Менеджер свяжется с вами в ближайшее время" data-am="Մենեջերը կկապվի ձեզ մոտակա ժամանակից">Менеджер свяжется с вами в ближайшее время</p>
    </div>
  </div>
</div>

<script>
// Force page to start from top on every load (prevent iOS scroll restoration)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
/* ===== LANGUAGE ===== */
let lang = localStorage.getItem('gtt_lang') || 'am';
const AM = {
  "Услуги":"Ծառայություններ",
  "Калькулятор":"Հաշվիչ",
  "Склад":"Պահեստ",
  "Гарантии":"Երաշխիքներ",
  "FAQ":"ՀՏՀ",
  "Контакты":"Կոնտակտներ",
  "Написать нам":"Գրել հիմա",
  "Работаем в Армении":"Աշխատում ենք Հայաստանում",
  "Выведем ваш товар":"Մենք կբարձրացնենք ձեր ապրանքը",
  "в ТОП Wildberries":"Wildberries-ի TOP",
  "Рассчитать стоимость":"Հաշվել արժեքը"
};
// Helper: set text on element while preserving child <i> icons (e.g. quote icons in captions)
function _setTextPreserveIcons(el, t) {
  // For pkg-items children: replace everything after the <i> icon using innerHTML
  if (el.parentElement && el.parentElement.classList.contains('pkg-items')) {
    var icon = el.querySelector('i');
    var iconHtml = icon ? icon.outerHTML + ' ' : '';
    el.innerHTML = iconHtml + t;
    return;
  }
  var icons = el.querySelectorAll('i');
  if (icons.length > 0) {
    // Remove only text nodes, keep icon elements intact
    var cn = Array.prototype.slice.call(el.childNodes);
    for (var ci = 0; ci < cn.length; ci++) { if (cn[ci].nodeType === 3) el.removeChild(cn[ci]); }
    el.appendChild(document.createTextNode(t));
  } else {
    el.textContent = t;
  }
}
function switchLang(l) {
  lang = l;
  localStorage.setItem('gtt_lang', l);
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === l));
  document.querySelectorAll('[data-' + l + ']').forEach(el => {
    const t = el.getAttribute('data-' + l);
    if (t && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') _setTextPreserveIcons(el, t);
  });
  // Update input placeholders for current language
  document.querySelectorAll('[data-placeholder-' + l + ']').forEach(function(el) {
    el.placeholder = el.getAttribute('data-placeholder-' + l) || '';
  });
  document.documentElement.lang = l === 'am' ? 'hy' : 'ru';
  // Update URL path to /am or /ru (without page reload) so shared links carry language
  var newPath = l === 'am' ? '/am' : '/ru';
  if (window.location.pathname !== newPath) {
    history.replaceState(null, '', newPath + window.location.hash);
  }
}

/* ===== INIT: apply default language on load ===== */
(function initLang() {
  // Detect language from URL path /am or /ru
  var pathLang = window.location.pathname === '/am' ? 'am' : (window.location.pathname === '/ru' ? 'ru' : '');
  if (pathLang) {
    lang = pathLang;
    localStorage.setItem('gtt_lang', pathLang);
  }
  switchLang(lang);
})();

/* ===== HEADER SCROLL ===== */
window.addEventListener('scroll', () => {
  document.getElementById('header').classList.toggle('scrolled', window.scrollY > 50);
});

/* ===== MOBILE MENU ===== */
function toggleMenu() {
  var nav = document.getElementById('navLinks');
  var ham = document.getElementById('hamburger');
  var isOpen = nav.classList.contains('active');
  if (isOpen) {
    nav.classList.remove('active');
    ham.classList.remove('active');
    document.body.style.overflow = '';
  } else {
    nav.classList.add('active');
    ham.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeMenu() {
  document.getElementById('navLinks').classList.remove('active');
  document.getElementById('hamburger').classList.remove('active');
  document.body.style.overflow = '';
}

function toggleBottomMore(e) {
  if (e) e.stopPropagation();
  var menu = document.getElementById('bottomMoreMenu');
  var btn = document.getElementById('bottomNavMore');
  if (menu) {
    menu.classList.toggle('active');
    if (btn) btn.classList.toggle('active', menu.classList.contains('active'));
  }
}
// Close bottom more menu on outside click
document.addEventListener('click', function(e) {
  var menu = document.getElementById('bottomMoreMenu');
  var btn = document.getElementById('bottomNavMore');
  if (menu && btn && !btn.contains(e.target)) {
    menu.classList.remove('active');
    btn.classList.remove('active');
  }
});
// Close bottom more menu on link click
document.addEventListener('click', function(e) {
  var link = e.target.closest('.bottom-nav-more-menu a');
  if (link) {
    var menu = document.getElementById('bottomMoreMenu');
    var btn = document.getElementById('bottomNavMore');
    if (menu) menu.classList.remove('active');
    if (btn) btn.classList.remove('active');
  }
});

// Active section highlighting on scroll — re-reads nav items each time
// so it works even after DB client rebuilds the bottom nav
(function() {
  var scrollTimer = null;
  function updateActiveNav() {
    var navItems = document.querySelectorAll('.bottom-nav-item[href]');
    if (!navItems.length) return;
    var moreLinks = document.querySelectorAll('.bottom-nav-more-menu a[href]');
    var moreTargets = [];
    moreLinks.forEach(function(a) {
      var href = a.getAttribute('href');
      if (href && href.startsWith('#')) moreTargets.push(href.substring(1));
    });
    // Collect all sections in DOM order (top to bottom)
    var allSections = [];
    navItems.forEach(function(a) {
      var href = a.getAttribute('href');
      if (href && href.startsWith('#')) {
        var el = document.getElementById(href.substring(1));
        if (el) allSections.push({ id: href.substring(1), top: el.getBoundingClientRect().top + window.scrollY });
      }
    });
    moreLinks.forEach(function(a) {
      var href = a.getAttribute('href');
      if (href && href.startsWith('#')) {
        var el = document.getElementById(href.substring(1));
        if (el) allSections.push({ id: href.substring(1), top: el.getBoundingClientRect().top + window.scrollY });
      }
    });
    // Sort by position on page
    allSections.sort(function(a, b) { return a.top - b.top; });
    // Find active: last section whose top is above 35% of viewport
    var scrollY = window.scrollY + window.innerHeight * 0.35;
    var activeId = '';
    for (var i = 0; i < allSections.length; i++) {
      if (allSections[i].top <= scrollY) activeId = allSections[i].id;
    }
    // Highlight matching nav item
    navItems.forEach(function(a) {
      var href = (a.getAttribute('href') || '').substring(1);
      if (href === activeId) a.classList.add('active');
      else a.classList.remove('active');
    });
    // Highlight more button if active section is inside the dropdown
    var moreBtn = document.getElementById('bottomNavMore');
    if (moreBtn) {
      var inMore = moreTargets.indexOf(activeId) >= 0;
      if (inMore) moreBtn.classList.add('active');
      else if (!moreBtn.querySelector('.bottom-nav-more-menu.active')) moreBtn.classList.remove('active');
    }
  }
  window.addEventListener('scroll', function() {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(updateActiveNav, 60);
  }, {passive: true});
  // Run after a delay to let DB client rebuild nav
  setTimeout(updateActiveNav, 500);
  setTimeout(updateActiveNav, 2000);
})();

document.querySelectorAll('.nav-links a').forEach(function(a) {
  a.addEventListener('click', function(e) {
    var href = this.getAttribute('href');
    // Don't block external links (WhatsApp, Telegram, etc.)
    if (this.getAttribute('target') === '_blank' || (href && href.startsWith('http'))) {
      closeMenu();
      return; // Let the browser handle the link normally
    }
    e.preventDefault();
    closeMenu();
    if (href && href.startsWith('#')) {
      var target = document.querySelector(href);
      if (target) {
        setTimeout(function() {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  });
});

/* Close menu when tapping outside nav links (on overlay area) */
document.getElementById('navLinks').addEventListener('click', function(e) {
  if (e.target === this) closeMenu();
});

/* ===== TICKER ===== */
(function() {
  const items = [
    {icon:"fa-check-circle", ru:"Реальные люди, не боты", am:"Իրական մարդիկ, ոչ բոտեր"},
    {icon:"fa-shield-alt", ru:"0 блокировок за всё время", am:"0 արգելափակում ողջ ընթացքում"},
    {icon:"fa-warehouse", ru:"Собственный склад в Ереване", am:"Սեփական պահեստ Երևանում"},
    {icon:"fa-mobile-alt", ru:"1000+ аккаунтов", am:"1000+ հաշիվներ"},
    {icon:"fa-map-marker-alt", ru:"Ереван, Армения", am:"Երևան, Հայաստան"},
    {icon:"fa-star", ru:"Профессиональные фото для отзывов", am:"Մասնագիտական լուսանկարներ կարծիքների համար"},
    {icon:"fa-camera", ru:"Фотосессии с моделями", am:"Լուսանկարահանումներ մոդելներով"},
    {icon:"fa-truck", ru:"Доставка на склады WB", am:"Առաքում WB պահեստներ"}
  ];
  const track = document.getElementById("tickerTrack");
  let h = "";
  for (let i = 0; i < 2; i++) {
    items.forEach(it => {
      h += '<div class="ticker-item"><i class="fas ' + it.icon + '"></i><span data-ru="' + it.ru + '" data-am="' + it.am + '">' + it.ru + '</span></div>';
    });
  }
  track.innerHTML = h;
})();

/* ===== CALCULATOR ===== */
function showCalcTab(id, el) {
  document.querySelectorAll('.calc-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.calc-group').forEach(g => g.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('cg-' + id).classList.add('active');
}
function getBuyoutPrice(qty) {
  if (qty <= 0) return 0;
  if (qty <= 20) return 2000;
  if (qty <= 40) return 1700;
  if (qty <= 60) return 1500;
  return 1250;
}
function getBuyoutTotal(qty) {
  if (qty <= 0) return 0;
  if (qty <= 20) return qty * 2000;
  if (qty <= 40) return 20 * 2000 + (qty - 20) * 1700;
  if (qty <= 60) return 20 * 2000 + 20 * 1700 + (qty - 40) * 1500;
  return 20 * 2000 + 20 * 1700 + 20 * 1500 + (qty - 60) * 1250;
}
function ccBuyout(delta) {
  const inp = document.getElementById('buyoutQty');
  let v = parseInt(inp.value || 0) + delta;
  if (v < 0) v = 0; if (v > 999) v = 999;
  inp.value = v;
  const price = getBuyoutPrice(v);
  document.getElementById('buyoutPriceLabel').textContent = v > 0 ? formatNum(price) + ' ֏/шт' : '2 000 ֏';
  recalc();
}
function onBuyoutInput() {
  const inp = document.getElementById('buyoutQty');
  let v = parseInt(inp.value || 0);
  if (isNaN(v) || v < 0) v = 0; if (v > 999) v = 999;
  inp.value = v;
  const price = getBuyoutPrice(v);
  document.getElementById('buyoutPriceLabel').textContent = v > 0 ? formatNum(price) + ' ֏/шт' : '2 000 ֏';
  recalc();
}
function cc(btn, delta) {
  const row = btn.closest('.calc-row');
  const inp = row.querySelector('.calc-input input');
  let v = parseInt(inp.value || 0) + delta;
  if (v < 0) v = 0; if (v > 999) v = 999;
  inp.value = v;
  recalc();
}
function recalc() {
  let total = 0; const items = [];
  const buyoutQty = parseInt(document.getElementById('buyoutQty').value || 0);
  if (buyoutQty > 0) { total += getBuyoutTotal(buyoutQty); items.push('Выкуп + забор: ' + buyoutQty + ' шт (' + getBuyoutPrice(buyoutQty) + ' ֏/шт)'); }
  document.querySelectorAll('.calc-row:not(#buyoutRow)').forEach(row => {
    const price = parseInt(row.dataset.price);
    const inp = row.querySelector('.calc-input input');
    const qty = parseInt(inp ? inp.value : 0);
    if (!isNaN(price) && qty > 0) { total += price * qty; items.push(row.querySelector('.calc-label').textContent + ': ' + qty); }
  });
  document.getElementById('calcTotal').textContent = total.toLocaleString('ru-RU') + ' ֏';
  const msg = 'Здравствуйте! Хочу заказать:\\n' + items.join('\\n') + '\\n\\nИтого: ' + total.toLocaleString('ru-RU') + ' ֏';
  document.getElementById('calcTgBtn').href = 'https://t.me/goo_to_top?text=' + encodeURIComponent(msg);
}

/* ===== FAQ ===== */
function toggleFaq(el) {
  const item = el.closest('.faq-item');
  const was = item.classList.contains('active');
  document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
  if (!was) item.classList.add('active');
}

/* ===== LIGHTBOX WITH NAVIGATION ===== */
var _lbPhotos = [];
var _lbIdx = 0;
function openLightbox(elOrUrl) {
  var src = typeof elOrUrl === 'string' ? elOrUrl : elOrUrl.querySelector('img').src;
  // Collect all photos from the current carousel or gallery for navigation
  _lbPhotos = [];
  _lbIdx = 0;
  // Try to get photos from the reviews carousel
  var rvTrack = document.querySelector('.rv-track');
  if (rvTrack) {
    var slides = rvTrack.querySelectorAll('.rv-slide img');
    for (var si = 0; si < slides.length; si++) {
      _lbPhotos.push(slides[si].src);
      if (slides[si].src === src || slides[si].src.indexOf(src) >= 0 || src.indexOf(slides[si].getAttribute('src')) >= 0) _lbIdx = si;
    }
  }
  // If no carousel photos found, try photo blocks
  if (_lbPhotos.length === 0) {
    var pbCards = document.querySelectorAll('.pb-card img');
    for (var pi = 0; pi < pbCards.length; pi++) {
      _lbPhotos.push(pbCards[pi].src);
      if (pbCards[pi].src === src) _lbIdx = pi;
    }
  }
  // Fallback: single photo
  if (_lbPhotos.length === 0) { _lbPhotos = [src]; _lbIdx = 0; }
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('show');
  document.body.style.overflow = 'hidden'; // Prevent background scroll
  // Show/hide nav buttons
  var prevBtn = document.querySelector('.lb-prev');
  var nextBtn = document.querySelector('.lb-next');
  if (prevBtn) prevBtn.style.display = _lbPhotos.length > 1 ? 'flex' : 'none';
  if (nextBtn) nextBtn.style.display = _lbPhotos.length > 1 ? 'flex' : 'none';
}
function closeLightbox() { 
  document.getElementById('lightbox').classList.remove('show'); 
  document.body.style.overflow = ''; // Restore scroll
}
function lbNav(dir) {
  if (_lbPhotos.length <= 1) return;
  _lbIdx += dir;
  if (_lbIdx < 0) _lbIdx = _lbPhotos.length - 1;
  if (_lbIdx >= _lbPhotos.length) _lbIdx = 0;
  document.getElementById('lightboxImg').src = _lbPhotos[_lbIdx];
}
function lbClickHandler(e) {
  // Close only if clicking the backdrop (not the image or buttons)
  if (e.target.id === 'lightbox') closeLightbox();
}
// Lightbox keyboard + touch
document.addEventListener('keydown', function(e) {
  var lb = document.getElementById('lightbox');
  if (!lb || !lb.classList.contains('show')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') lbNav(-1);
  if (e.key === 'ArrowRight') lbNav(1);
});
(function() {
  var lb = document.getElementById('lightbox');
  if (!lb) return;
  var lbStartX = 0, lbStartY = 0, lbIsSwipe = false;
  lb.addEventListener('touchstart', function(e) { 
    lbStartX = e.touches[0].clientX; 
    lbStartY = e.touches[0].clientY;
    lbIsSwipe = false;
  }, {passive:true});
  lb.addEventListener('touchmove', function(e) {
    var dx = Math.abs(e.touches[0].clientX - lbStartX);
    var dy = Math.abs(e.touches[0].clientY - lbStartY);
    // If horizontal movement dominates, it's a swipe (not a scroll)
    if (dx > dy && dx > 15) lbIsSwipe = true;
  }, {passive:true});
  lb.addEventListener('touchend', function(e) {
    if (!lbIsSwipe) return; // Was a vertical scroll, not a swipe
    var diff = e.changedTouches[0].clientX - lbStartX;
    if (Math.abs(diff) > 50) { lbNav(diff < 0 ? 1 : -1); }
  }, {passive:true});
})();

/* ===== SWIPE-AWARE LIGHTBOX OPEN ===== */
/* On iOS, inline onclick on carousel images blocks native scroll-snap swipe.
   Use data-lightbox-url attribute + global tap detection instead. */
(function() {
  var _lbTouchX = 0, _lbTouchY = 0, _lbTouchMoved = false;
  document.addEventListener('touchstart', function(e) {
    var el = e.target.closest && (e.target.closest('[data-lightbox-url]') || e.target.closest('[onclick*="openLightbox"]'));
    if (!el) return;
    _lbTouchX = e.touches[0].clientX;
    _lbTouchY = e.touches[0].clientY;
    _lbTouchMoved = false;
  }, {passive: true});
  document.addEventListener('touchmove', function(e) {
    if (_lbTouchMoved) return;
    var dx = Math.abs(e.touches[0].clientX - _lbTouchX);
    var dy = Math.abs(e.touches[0].clientY - _lbTouchY);
    if (dx > 8 || dy > 8) _lbTouchMoved = true;
  }, {passive: true});
  document.addEventListener('touchend', function(e) {
    if (_lbTouchMoved) return;
    var el = e.target.closest && e.target.closest('[data-lightbox-url]');
    if (el) {
      openLightbox(el.getAttribute('data-lightbox-url'));
      return;
    }
  }, {passive: true});
})();

// Reviews carousel scroll helper (legacy — kept for photo_blocks)
function rcScroll(carId, dir) {
  var el = document.getElementById(carId);
  if (!el) return;
  var cards = el.querySelectorAll('.rc-card');
  if (!cards.length) return;
  var cardW = cards[0].offsetWidth + 16;
  var currentIdx = Math.round(el.scrollLeft / cardW);
  var newIdx = currentIdx + dir;
  if (newIdx < 0) newIdx = 0;
  if (newIdx >= cards.length) newIdx = cards.length - 1;
  el.scrollTo({ left: newIdx * cardW, behavior: 'smooth' });
  var dots = document.querySelectorAll('#' + carId + '_dots .rc-dot');
  for (var d = 0; d < dots.length; d++) {
    dots[d].style.background = d === newIdx ? '#8B5CF6' : 'rgba(139,92,246,0.3)';
    dots[d].style.transform = d === newIdx ? 'scale(1.3)' : 'scale(1)';
  }
  var cnt = document.getElementById(carId + '_counter');
  if (cnt) cnt.textContent = (newIdx + 1);
}
function rcScrollTo(carId, idx) {
  var el = document.getElementById(carId);
  if (!el) return;
  var cards = el.querySelectorAll('.rc-card');
  if (!cards.length || idx >= cards.length) return;
  var cardW = cards[0].offsetWidth + 16;
  el.scrollTo({ left: idx * cardW, behavior: 'smooth' });
  var dots = document.querySelectorAll('#' + carId + '_dots .rc-dot');
  for (var d = 0; d < dots.length; d++) {
    dots[d].style.background = d === idx ? '#8B5CF6' : 'rgba(139,92,246,0.3)';
    dots[d].style.transform = d === idx ? 'scale(1.3)' : 'scale(1)';
  }
  var cnt = document.getElementById(carId + '_counter');
  if (cnt) cnt.textContent = (idx + 1);
}

/* ===== REVIEWS SINGLE-PHOTO CAROUSEL ===== */
var _rvState = {};
function rvSlide(carId, dir) {
  var state = _rvState[carId] || { idx: 0, total: 0 };
  var track = document.getElementById(carId + '_track');
  if (!track) return;
  var slides = track.querySelectorAll('.rv-slide');
  state.total = slides.length;
  if (state.total === 0) return;
  state.idx = state.idx + dir;
  if (state.idx < 0) state.idx = state.total - 1;
  if (state.idx >= state.total) state.idx = 0;
  _rvState[carId] = state;
  // Scroll to the target slide using native scroll
  var targetSlide = slides[state.idx];
  if (targetSlide) {
    track.scrollTo({ left: targetSlide.offsetLeft, behavior: 'smooth' });
  }
  // Update dots
  var dots = document.querySelectorAll('#' + carId + '_dots .rv-dot');
  for (var d = 0; d < dots.length; d++) {
    if (d === state.idx) { dots[d].classList.add('active'); } else { dots[d].classList.remove('active'); }
  }
}
function rvGoTo(carId, idx) {
  var track = document.getElementById(carId + '_track');
  if (!track) return;
  var slides = track.querySelectorAll('.rv-slide');
  if (idx < 0 || idx >= slides.length) return;
  _rvState[carId] = { idx: idx, total: slides.length };
  var targetSlide = slides[idx];
  if (targetSlide) {
    track.scrollTo({ left: targetSlide.offsetLeft, behavior: 'smooth' });
  }
  var dots = document.querySelectorAll('#' + carId + '_dots .rv-dot');
  for (var d = 0; d < dots.length; d++) {
    if (d === idx) { dots[d].classList.add('active'); } else { dots[d].classList.remove('active'); }
  }
}

/* ===== TIMED POPUP (5 sec) — ALWAYS SHOWS ON EVERY PAGE LOAD ===== */
var _popupShown = false;

function showPopup() {
  if (_popupShown) return;
  _popupShown = true;
  var ov = document.getElementById('popupOverlay');
  if (!ov) { console.log('[Popup] No overlay element found, retrying...'); _popupShown = false; setTimeout(showPopup, 1000); return; }
  var card = ov.querySelector('.popup-card');
  if (!card) { console.log('[Popup] No card element found'); return; }
  var isMobile = window.innerWidth <= 640;
  
  // Reset any previous state completely
  card.removeAttribute('style');
  ov.removeAttribute('style');
  
  // FORCE show overlay with inline styles to override ANY CSS/cache/extension
  ov.className = 'popup-overlay show';
  ov.style.setProperty('display', 'flex', 'important');
  ov.style.setProperty('position', 'fixed', 'important');
  ov.style.setProperty('top', '0', 'important');
  ov.style.setProperty('left', '0', 'important');
  ov.style.setProperty('width', '100vw', 'important');
  ov.style.setProperty('height', '100vh', 'important');
  ov.style.setProperty('background', 'rgba(0,0,0,0.85)', 'important');
  ov.style.setProperty('z-index', '100000', 'important');
  ov.style.setProperty('overflow', 'hidden', 'important');
  ov.style.setProperty('visibility', 'visible', 'important');
  ov.style.setProperty('opacity', '1', 'important');
  ov.style.setProperty('touch-action', 'none', 'important');
  
  if (isMobile) {
    ov.style.setProperty('justify-content', 'center', 'important');
    ov.style.setProperty('align-items', 'flex-end', 'important');
    ov.style.setProperty('padding', '0', 'important');
    card.style.cssText = 'max-width:100% !important;width:100% !important;margin:0 !important;border-radius:20px 20px 0 0 !important;max-height:85vh !important;overflow-y:auto !important;padding:28px 16px !important;opacity:1 !important;visibility:visible !important;display:block !important;animation:slideUpMobile 0.4s ease forwards !important;-webkit-overflow-scrolling:touch !important;overscroll-behavior:contain !important;';
  } else {
    ov.style.setProperty('justify-content', 'center', 'important');
    ov.style.setProperty('align-items', 'center', 'important');
    ov.style.setProperty('padding', '20px', 'important');
    card.style.cssText = 'opacity:1 !important;visibility:visible !important;display:block !important;';
  }
  
  // Ensure form is visible (reset from previous success state)
  var formWrap = document.getElementById('popupFormWrap');
  var successWrap = document.getElementById('popupSuccess');
  if (formWrap) formWrap.style.display = 'block';
  if (successWrap) successWrap.style.display = 'none';
  
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
  document.body.style.top = '-' + window.scrollY + 'px';
  document.body.dataset.popupScrollY = String(window.scrollY);
  // Prevent touch scroll on overlay (iOS bounce prevention)
  ov.addEventListener('touchmove', _preventOverlayScroll, { passive: false });
  console.log('[Popup] Shown on ' + (isMobile ? 'mobile' : 'desktop') + ', w=' + window.innerWidth);
}

// Prevent scroll on popup overlay (but allow scroll inside popup card)
function _preventOverlayScroll(e) {
  var card = document.querySelector('.popup-card');
  if (card && card.contains(e.target)) {
    // Allow scroll inside card if it has overflow content
    var isScrollable = card.scrollHeight > card.clientHeight;
    if (isScrollable) return; // let card scroll
  }
  e.preventDefault();
}

function hidePopup() {
  var ov = document.getElementById('popupOverlay');
  if (ov) {
    ov.classList.remove('show');
    ov.style.cssText = 'display:none;visibility:hidden;opacity:0;';
    ov.removeEventListener('touchmove', _preventOverlayScroll);
  }
  // Restore body scroll position
  var scrollY = parseInt(document.body.dataset.popupScrollY || '0', 10);
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.width = '';
  document.body.style.top = '';
  window.scrollTo(0, scrollY);
  console.log('[Popup] Hidden');
}

/* Close button */
var _closeBtn = document.getElementById('popupCloseBtn');
if (_closeBtn) {
  _closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    hidePopup();
  });
}

/* Click overlay to close (only when clicking the dark area, NOT the card) */
var _popupOv = document.getElementById('popupOverlay');
if (_popupOv) {
  _popupOv.addEventListener('click', function(e) {
    if (e.target === _popupOv) hidePopup();
  });
}

/* Show after 5 seconds — ALWAYS, no sessionStorage check, no popupDismissed */
/* Use multiple timers as safety net in case one fails */
setTimeout(showPopup, 5000);
setTimeout(function() { if (!_popupShown) showPopup(); }, 6000);
setTimeout(function() { if (!_popupShown) showPopup(); }, 8000);
console.log('[Popup] Timer set, will fire in 5s (with retry at 6s, 8s)');

/* Form submit */
document.getElementById('popupForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var popupName = (document.getElementById('popupName') || {}).value || '';
  var buyouts = document.getElementById('popupBuyouts').value;
  var reviews = document.getElementById('popupReviews').value;
  var contact = document.getElementById('popupContact').value;
  /* Build auto-notes from form data */
  var autoNotes = (lang === 'am'
    ? 'Գնումներ: ' + buyouts + ' | Կարծիքներ: ' + reviews
    : 'Выкупов: ' + buyouts + ' | Отзывов: ' + reviews);
  var btn = this.querySelector('button[type=submit]');
  var orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (lang === 'am' ? 'Սպասեք...' : 'Отправка...');
  fetch('/api/popup-lead', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({name:popupName, buyouts:buyouts, reviews:reviews, contact:contact, lang:lang, notes:autoNotes, ts: new Date().toISOString()})
  }).then(function(r){ return r.json(); }).then(function() {
    btn.disabled = false;
    document.getElementById('popupFormWrap').style.display = 'none';
    document.getElementById('popupSuccess').style.display = 'block';
    setTimeout(hidePopup, 3000);
  }).catch(function() {
    btn.disabled = false;
    document.getElementById('popupFormWrap').style.display = 'none';
    document.getElementById('popupSuccess').style.display = 'block';
    setTimeout(hidePopup, 3000);
  });
});

/* ===== FORM SUBMIT ===== */
function submitForm(e) {
  e.preventDefault();
  var name = document.getElementById('formName').value;
  var contact = document.getElementById('formContact').value;
  var product = document.getElementById('formProduct').value;
  var service = document.getElementById('formService');
  var serviceText = service.options[service.selectedIndex].textContent;
  var message = document.getElementById('formMessage').value;

  var btn = e.target.querySelector('button[type=submit]');
  var orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (lang === 'am' ? 'Սպասեք...' : 'Отправка...');

  fetch('/api/lead', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name:name, contact:contact, product:product, service: service.value, message:message, lang:lang, ts: new Date().toISOString()}) })
  .then(function(r){ return r.json(); })
  .then(function(data) {
    btn.disabled = false;
    /* Show success overlay on the form */
    var formCard = document.querySelector('.form-card');
    if (formCard) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:absolute;inset:0;background:rgba(15,10,26,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:inherit;z-index:10;animation:fadeIn 0.3s ease';
      overlay.innerHTML = '<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#10B981,#059669);display:flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 0 30px rgba(16,185,129,0.4)"><i class="fas fa-check" style="font-size:2rem;color:white"></i></div>' +
        '<div style="font-size:1.3rem;font-weight:800;color:#e2e8f0;margin-bottom:8px">' + (lang === 'am' ? 'Հայտը ուղարկված է!' : 'Заявка отправлена!') + '</div>' +
        '<div style="font-size:0.95rem;color:#94a3b8;text-align:center;max-width:300px">' + (lang === 'am' ? 'Մենեջերը կկապվի ձեզ հետ մոտակա ժամանակին:' : 'Менеджер свяжется с вами в ближайшее время.') + '</div>';
      formCard.style.position = 'relative';
      formCard.appendChild(overlay);
      setTimeout(function() {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s';
        setTimeout(function() { overlay.remove(); }, 300);
      }, 4000);
    }
    btn.innerHTML = '<i class="fas fa-check" style="color:#10B981"></i> ' + (lang === 'am' ? 'Ուղարկված է!' : 'Отправлено!');
    btn.style.background = 'linear-gradient(135deg,#10B981,#059669)';
    setTimeout(function() { btn.innerHTML = orig; btn.style.background = ''; }, 4000);
    e.target.reset();
  })
  .catch(function(err) {
    console.error('Lead error:', err);
    btn.disabled = false;
    btn.innerHTML = orig;
    btn.style.background = '';
  });
}

/* ===== SCROLL ANIMATIONS ===== */
var obs = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) { if (entry.isIntersecting) { entry.target.classList.add('visible'); obs.unobserve(entry.target); } });
}, {threshold:0.1, rootMargin:'0px 0px -50px 0px'});
document.querySelectorAll('.fade-up').forEach(function(el) { obs.observe(el); });

/* ===== COUNTER ANIMATION ===== */
var cObs = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      var el = entry.target;
      var target = parseInt(el.dataset.count);
      var dur = 2000; var start = performance.now();
      function anim(now) {
        var p = Math.min((now - start) / dur, 1);
        el.textContent = Math.floor(target * (1 - Math.pow(1 - p, 3))).toLocaleString('ru-RU');
        if (p < 1) requestAnimationFrame(anim);
        else el.textContent = target === 0 ? '0' : target.toLocaleString('ru-RU');
      }
      requestAnimationFrame(anim); cObs.unobserve(el);
    }
  });
}, {threshold:0.5});
document.querySelectorAll('.stat-num[data-count]').forEach(function(el) { cObs.observe(el); });

/* Stats bar counter animation */
var sObs = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      var el = entry.target;
      var target = parseInt(el.dataset.countS) || 0;
      if (isNaN(target) || target === 0) { sObs.unobserve(el); return; }
      var dur = 2000; var start = performance.now();
      function animS(now) {
        var p = Math.min((now - start) / dur, 1);
        var val = Math.floor(target * (1 - Math.pow(1 - p, 3)));
        el.textContent = val.toLocaleString('ru-RU') + (el.textContent.includes('+') ? '+' : '');
        if (p < 1) requestAnimationFrame(animS);
        else el.textContent = target.toLocaleString('ru-RU') + (target > 100 ? '+' : '');
      }
      requestAnimationFrame(animS); sObs.unobserve(el);
    }
  });
}, {threshold:0.5});
document.querySelectorAll('.stat-big[data-count-s]').forEach(function(el) { sObs.observe(el); });

// Re-observe counters on server-injected pages (sections already revealed above)
if (document.documentElement.classList.contains('server-injected')) {
  setTimeout(function() {
    document.querySelectorAll('.stat-num[data-count]').forEach(function(el) { cObs.observe(el); });
    document.querySelectorAll('.stat-big[data-count-s]').forEach(function(el) { sObs.observe(el); });
    document.querySelectorAll('.fade-up:not(.visible)').forEach(function(el) { obs.observe(el); });
  }, 100);
}

/* ===== SMOOTH SCROLL ===== */
document.querySelectorAll('a[href^="#"]').forEach(function(a) {
  a.addEventListener('click', function(e) {
    var href = a.getAttribute('href');
    if (href === '#') return;
    var t = document.querySelector(href);
    if (t) { e.preventDefault(); window.scrollTo({top: t.offsetTop - 80, behavior:'smooth'}); }
  });
});

console.log('Go to Top — site loaded v6 - CTA buttons + team photo moved');

/* ===== DYNAMIC DATA FROM D1 DATABASE v2 ===== */
// Helper functions
function escCalc(s) { return s ? String(s).replace(/'/g, "&#39;").replace(/"/g, '&quot;') : ''; }
function formatNum(n) { return Number(n).toLocaleString('ru-RU'); }

function getTierPrice(tiers, qty) {
  if (qty <= 0) return 0;
  for (var i = 0; i < tiers.length; i++) {
    if (qty >= tiers[i].min && qty <= tiers[i].max) return tiers[i].price;
  }
  return tiers[tiers.length - 1].price;
}

function getTierTotal(tiers, qty) {
  if (qty <= 0) return 0;
  // Flat-rate model: entire batch at the tier price matching the quantity
  var unitPrice = getTierPrice(tiers, qty);
  return unitPrice * qty;
}

function ccTiered(svcId, delta) {
  var inp = document.getElementById('qty_' + svcId);
  var v = parseInt(inp.value || 0) + delta;
  if (v < 0) v = 0; if (v > 999) v = 999;
  inp.value = v;
  var row = document.getElementById('row_' + svcId);
  try {
    var tiers = JSON.parse(row.getAttribute('data-tiers'));
    var price = getTierPrice(tiers, v);
    document.getElementById('price_' + svcId).textContent = v > 0 ? formatNum(price) + ' ֏/шт' : formatNum(tiers[0].price) + ' ֏';
  } catch(e) {}
  recalcDynamic();
}

function onTieredInput(svcId) {
  var inp = document.getElementById('qty_' + svcId);
  var v = parseInt(inp.value || 0);
  if (isNaN(v) || v < 0) v = 0; if (v > 999) v = 999;
  inp.value = v;
  ccTiered(svcId, 0);
}

var _selectedPackageId = null;
function selectPackage(pkgId) {
  if (_selectedPackageId === pkgId) {
    _selectedPackageId = null;
  } else {
    _selectedPackageId = pkgId;
  }
  // Update visual selection
  document.querySelectorAll('.calc-pkg-card').forEach(function(c) {
    if (parseInt(c.getAttribute('data-pkg-id')) === _selectedPackageId) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  });
  recalcDynamic();
}

/* ===== SWIPE-AWARE PACKAGE CARD TAP ===== */
/* On iOS, onclick fires even during scroll, blocking swipe.
   Instead, track touch start/end positions and only trigger selectPackage
   if the finger didn't move (tap, not swipe). */
(function() {
  var _pkgTouchStartX = 0, _pkgTouchStartY = 0, _pkgTouchMoved = false;
  document.addEventListener('touchstart', function(e) {
    var card = e.target.closest && e.target.closest('.calc-pkg-card');
    if (!card) return;
    _pkgTouchStartX = e.touches[0].clientX;
    _pkgTouchStartY = e.touches[0].clientY;
    _pkgTouchMoved = false;
  }, {passive: true});
  document.addEventListener('touchmove', function(e) {
    if (_pkgTouchMoved) return;
    var dx = Math.abs(e.touches[0].clientX - _pkgTouchStartX);
    var dy = Math.abs(e.touches[0].clientY - _pkgTouchStartY);
    if (dx > 8 || dy > 8) _pkgTouchMoved = true;
  }, {passive: true});
  document.addEventListener('touchend', function(e) {
    if (_pkgTouchMoved) return;
    var card = e.target.closest && e.target.closest('.calc-pkg-card');
    if (!card) return;
    var pkgId = parseInt(card.getAttribute('data-pkg-id'));
    if (pkgId) selectPackage(pkgId);
  }, {passive: true});
  // Desktop: use click
  document.addEventListener('click', function(e) {
    if ('ontouchstart' in window) return; // skip on touch devices, handled by touch events
    var card = e.target.closest && e.target.closest('.calc-pkg-card');
    if (!card) return;
    var pkgId = parseInt(card.getAttribute('data-pkg-id'));
    if (pkgId) selectPackage(pkgId);
  });
})();

function getSelectedPackage() {
  if (!_selectedPackageId || !window._calcPackages) return null;
  for (var i = 0; i < window._calcPackages.length; i++) {
    if (Number(window._calcPackages[i].id) === Number(_selectedPackageId)) return window._calcPackages[i];
  }
  return null;
}

function recalcDynamic() {
  var total = 0, items = [];
  var linkedTotal = 0; // subtotal of services that match linked_services
  var hasLinkedFilter = typeof _refLinkedServices !== 'undefined' && _refLinkedServices.length > 0;
  // ALL calc groups (not just active) — collect from all
  document.querySelectorAll('.calc-row[data-price="tiered"]').forEach(function(row) {
    var inp = row.querySelector('.calc-input input');
    var qty = parseInt(inp ? inp.value : 0);
    if (qty > 0) {
      try {
        var tiers = JSON.parse(row.getAttribute('data-tiers'));
        var rowTotal = getTierTotal(tiers, qty);
        total += rowTotal;
        var svcId = parseInt(row.getAttribute('data-svc-id') || '0');
        if (!hasLinkedFilter || _refLinkedServices.map(Number).indexOf(svcId) !== -1) linkedTotal += rowTotal;
        var label = row.querySelector('.calc-label');
        var labelText = label ? label.textContent : '';
        var pcsWord = lang === 'am' ? 'հատ' : 'шт';
        items.push(labelText + ': ' + qty + ' ' + pcsWord + ' (' + formatNum(getTierPrice(tiers, qty)) + ' ֏/' + pcsWord + ')');
      } catch(e) {}
    }
  });
  document.querySelectorAll('.calc-row:not([data-price="tiered"])').forEach(function(row) {
    var price = parseInt(row.getAttribute('data-price'));
    var inp = row.querySelector('.calc-input input');
    var qty = parseInt(inp ? inp.value : 0);
    if (!isNaN(price) && qty > 0) {
      var rowTotal = price * qty;
      total += rowTotal;
      var svcId = parseInt(row.getAttribute('data-svc-id') || '0');
      if (!hasLinkedFilter || _refLinkedServices.map(Number).indexOf(svcId) !== -1) linkedTotal += rowTotal;
      var label = row.querySelector('.calc-label');
      var labelText = label ? label.textContent : '';
      items.push(labelText + ': ' + qty);
    }
  });
  // Add package price
  var servicesTotal = total; // services subtotal before package
  var selectedPkg = getSelectedPackage();
  var packageAmount = 0;
  if (selectedPkg) {
    packageAmount = selectedPkg.package_price || 0;
    total += packageAmount;
  }
  // Apply referral discount based on linked services and packages
  var subtotalBeforeDiscount = total;
  var discountAmount = 0;
  var packageDiscountAmount = 0;
  if (typeof _refDiscount !== 'undefined' && _refDiscount > 0) {
    // Discount on services: if linked_services is empty → all services; otherwise only linked ones
    var discountableServices = hasLinkedFilter ? linkedTotal : servicesTotal;
    if (discountableServices > 0) {
      discountAmount = Math.round(discountableServices * _refDiscount / 100);
      total = total - discountAmount;
    }
    // Discount on package: ONLY when specific packages are checked in the promo code
    // linked_packages=[] (empty) → NO discount on packages
    // linked_packages=[id1,id2] → discount only on those specific packages
    if (selectedPkg && packageAmount > 0) {
      var pkgIdNum = Number(selectedPkg.id);
      if (_refLinkedPackages.length > 0 && _refLinkedPackages.map(Number).indexOf(pkgIdNum) !== -1) {
        packageDiscountAmount = Math.round(packageAmount * _refDiscount / 100);
        total = total - packageDiscountAmount;
      }
    }
  }
  var totalDiscountAmount = discountAmount + packageDiscountAmount;
  var calcTotalEl = document.getElementById('calcTotal');
  calcTotalEl.setAttribute('data-total', total);
  // Store package data for PDF submission
  if (selectedPkg) calcTotalEl.setAttribute('data-package', JSON.stringify({ package_id: selectedPkg.id, name: lang==='am'?(selectedPkg.name_am||selectedPkg.name_ru):selectedPkg.name_ru, name_ru: selectedPkg.name_ru, name_am: selectedPkg.name_am, package_price: selectedPkg.package_price, original_price: selectedPkg.original_price, items: selectedPkg.items }));
  else calcTotalEl.removeAttribute('data-package');
  
  var totalHtml = '';
  if (selectedPkg && packageAmount > 0) {
    totalHtml += '<div style="font-size:0.78rem;color:#f59e0b;margin-bottom:2px"><i class="fas fa-box-open" style="margin-right:4px"></i>' + (lang==='am'?(selectedPkg.name_am||selectedPkg.name_ru):selectedPkg.name_ru) + ': ' + formatNum(packageAmount) + ' \u058f</div>';
  }
  if (totalDiscountAmount > 0 && subtotalBeforeDiscount > 0) {
    calcTotalEl.innerHTML = totalHtml + '<div class="calc-total-prices">' +
      '<span class="calc-old-price">' + formatNum(subtotalBeforeDiscount) + ' \u058f</span>' +
      '<span>' + formatNum(total) + ' \u058f</span>' +
      '</div>' +
      '<div class="calc-discount-line"><i class="fas fa-gift" style="margin-right:4px"></i>' +
      (lang === 'am' ? String.fromCharCode(0x0536,0x0565,0x0572,0x0573) + ': -' : '\u0421\u043a\u0438\u0434\u043a\u0430: -') + formatNum(totalDiscountAmount) + ' \u058f (-' + _refDiscount + '%)</div>';
  } else if (totalHtml) {
    calcTotalEl.innerHTML = totalHtml + '<span>' + formatNum(total) + ' \u058f</span>';
  } else {
    calcTotalEl.textContent = formatNum(total) + ' \u058f';
  }
  // Update promo result with live discount amount  
  var refResultEl = document.getElementById('refResult');
  if (refResultEl && refResultEl.style.display !== 'none' && _refDiscount > 0) {
    // Check if promo matches selected package
    var pkgMismatch = selectedPkg && _refLinkedPackages.length > 0 && _refLinkedPackages.map(Number).indexOf(Number(selectedPkg.id)) === -1;
    if (pkgMismatch) {
      // Show red error for package mismatch, but still show green service discount if applicable
      var errMsg = lang === 'am'
        ? '<i class="fas fa-times-circle" style="margin-right:6px"></i>\u054f\u057e\u0575\u0561\u056c \u057a\u0580\u0578\u0574\u0578\u056f\u0578\u0564\u0568 \u0579\u056b \u0576\u0565\u0580\u0561\u057c\u0578\u0582\u0574 \u057f\u057e\u0575\u0561\u056c \u0583\u0561\u0569\u0565\u0569\u0568\u0589'
        : '<i class="fas fa-times-circle" style="margin-right:6px"></i>\u042d\u0442\u043e\u0442 \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434 \u043d\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u043d\u0430 \u0434\u0430\u043d\u043d\u044b\u0439 \u043f\u0430\u043a\u0435\u0442';
      if (discountAmount > 0) {
        errMsg += '<br><span style="font-size:0.85rem;font-weight:700;color:var(--success)">' + 
          (lang === 'am' ? String.fromCharCode(0x0536,0x0565,0x0572,0x0573,0x20,0x056e,0x0561,0x057c,0x0561,0x0575,0x0578,0x0582,0x0569,0x0575,0x0578,0x0582,0x0576,0x0576,0x0565,0x0580,0x056b,0x3a,0x20,0x2d) : '\u0421\u043a\u0438\u0434\u043a\u0430 \u043d\u0430 \u0443\u0441\u043b\u0443\u0433\u0438: -') + formatNum(discountAmount) + ' \u058f</span>';
      }
      refResultEl.innerHTML = errMsg;
      if (discountAmount > 0) {
        // Dual display: red error for package + separate green for services
        refResultEl.style.background = 'linear-gradient(180deg, rgba(239,68,68,0.1) 0%, rgba(16,185,129,0.08) 100%)';
        refResultEl.style.border = '1px solid rgba(239,68,68,0.3)';
        refResultEl.style.color = 'var(--danger)';
      } else {
        refResultEl.style.background = 'rgba(239,68,68,0.1)';
        refResultEl.style.border = '1px solid rgba(239,68,68,0.3)';
        refResultEl.style.color = 'var(--danger)';
      }
    } else {
      var _amActivated = String.fromCharCode(0x054a,0x0580,0x0578,0x0574,0x0578,0x056f,0x0578,0x0564,0x0568,0x20,0x0561,0x056f,0x057f,0x056b,0x057e,0x0561,0x0581,0x057e,0x0561,0x056e,0x20,0x0567,0x21);
      var _amDiscount = String.fromCharCode(0x0536,0x0565,0x0572,0x0573,0x3a,0x20);
      var promoMsg = lang === 'am'
        ? '<i class="fas fa-check-circle" style="margin-right:6px;color:var(--success)"></i>' + _amActivated
        : '<i class="fas fa-check-circle" style="margin-right:6px;color:var(--success)"></i>\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434 \u0430\u043a\u0442\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u043d!';
      promoMsg += '<br><span style="font-size:0.85rem;font-weight:700;color:var(--success)">';
      if (subtotalBeforeDiscount > 0) {
        promoMsg += (lang === 'am' ? _amDiscount + '-' : '\u0421\u043a\u0438\u0434\u043a\u0430: -') + formatNum(totalDiscountAmount) + ' \u058f (-' + _refDiscount + '%)';
      } else {
        promoMsg += (lang === 'am' ? _amDiscount : '\u0421\u043a\u0438\u0434\u043a\u0430: ') + _refDiscount + '%';
      }
      promoMsg += '</span>';
      refResultEl.style.background = 'rgba(16,185,129,0.1)';
      refResultEl.style.border = '1px solid rgba(16,185,129,0.3)';
      refResultEl.style.color = 'var(--success)';
      refResultEl.innerHTML = promoMsg;
    }
  }
  var tgUrl = (window._tgData && window._tgData.calc_order_msg && window._tgData.calc_order_msg.telegram_url) || 'https://t.me/goo_to_top';
  var greeting = lang === 'am' ? 'Ողջույն! Ուզում եմ պատվիրել:' : 'Здравствуйте! Хочу заказать:';
  var totalLabel = lang === 'am' ? 'Ընդամենը:' : 'Итого:';
  var msg = greeting + '\\n' + items.join('\\n');
  if (discountAmount > 0) {
    var refCode = document.getElementById('refCodeInput') ? document.getElementById('refCodeInput').value : '';
    msg += '\\n\\n' + (lang === 'am' ? 'Պրոմոկոդ: ' : 'Промокод: ') + refCode + ' (-' + _refDiscount + '%, -' + formatNum(discountAmount) + ' ֏)';
  }
  msg += '\\n\\n' + totalLabel + ' ' + formatNum(total) + ' ֏';
  var isWaCalc = tgUrl.includes('wa.me') || tgUrl.includes('whatsapp');
  var calcBtn = document.getElementById('calcTgBtn');
  if (isWaCalc) {
    calcBtn.href = tgUrl + (tgUrl.includes('?') ? '&text=' : '?text=') + encodeURIComponent(msg);
  } else {
    calcBtn.href = tgUrl + '?text=' + encodeURIComponent(msg);
  }
  var calcIcon = calcBtn.querySelector('i.fab');
  if (calcIcon) calcIcon.className = isWaCalc ? 'fab fa-whatsapp' : 'fab fa-telegram';
}

// Override recalc
var _origRecalc = recalc;
recalc = function() { if (window._calcServices) recalcDynamic(); else _origRecalc(); };

// Update all messenger links (Telegram/WhatsApp) to match current language
function updateMessengerIcon(a, url) {
  // Skip if icon was manually set by admin (don't override user choice)
  if (a.hasAttribute('data-icon-manual')) return;
  // Update icon to match messenger type
  var icon = a.querySelector('i.fab, i.fas');
  if (icon) {
    var isWa = url && (url.includes('wa.me') || url.includes('whatsapp'));
    icon.className = isWa ? 'fab fa-whatsapp' : 'fab fa-telegram';
  }
}
function updateTelegramLinks() {
  if (!window._tgData) return;
  var tgByLabel = {};
  for (var tgKey in window._tgData) {
    var tgMsg = window._tgData[tgKey];
    if (tgMsg && tgMsg.button_label_ru) {
      tgByLabel[tgMsg.button_label_ru.trim()] = tgMsg;
      if (tgMsg.button_label_am) tgByLabel[tgMsg.button_label_am.trim()] = tgMsg;
    }
  }
  // Also add new button labels from _blockFeaturesBtns (set during blockFeatures processing)
  if (window._blockFeaturesBtns) {
    for (var bfKey in window._blockFeaturesBtns) {
      var bfBtns = window._blockFeaturesBtns[bfKey];
      for (var bi = 0; bi < bfBtns.length; bi++) {
        var bfBtn = bfBtns[bi];
        if (bfBtn.text_ru && !tgByLabel[bfBtn.text_ru.trim()]) {
          // Find matching telegram message for this section
          for (var tk2 in window._tgData) {
            if (tk2.indexOf(bfKey + '_') === 0) {
              tgByLabel[bfBtn.text_ru.trim()] = window._tgData[tk2];
              if (bfBtn.text_am) tgByLabel[bfBtn.text_am.trim()] = window._tgData[tk2];
              break;
            }
          }
        }
      }
    }
  }
  // Match all links with t.me/ or wa.me/ or whatsapp
  document.querySelectorAll('a[href*="t.me/"], a[href*="wa.me/"], a[href*="whatsapp"]').forEach(function(a) {
    if (a.id === 'calcTgBtn') return;
    var spanWithDataRu = a.querySelector('span[data-ru]');
    var buttonText = null;
    if (spanWithDataRu) { buttonText = spanWithDataRu.getAttribute('data-ru'); }
    if (!buttonText && a.hasAttribute('data-ru')) { buttonText = a.getAttribute('data-ru'); }
    if (!buttonText) { var h4 = a.querySelector('h4[data-ru]'); if (h4) buttonText = h4.getAttribute('data-ru'); }
    if (!buttonText) return;
    buttonText = buttonText.trim();
    var tgMsg = tgByLabel[buttonText];
    if (!tgMsg) return;
    var msgTemplate = (lang === 'am' && tgMsg.message_template_am) ? tgMsg.message_template_am : tgMsg.message_template_ru;
    var mUrl = tgMsg.telegram_url || 'https://t.me/goo_to_top';
    var isWa = mUrl.includes('wa.me') || mUrl.includes('whatsapp');
    if (msgTemplate) {
      if (isWa) {
        a.href = mUrl + (mUrl.includes('?') ? '&text=' : '?text=') + encodeURIComponent(msgTemplate);
      } else {
        a.href = mUrl + '?text=' + encodeURIComponent(msgTemplate);
      }
    } else {
      a.href = mUrl;
    }
    updateMessengerIcon(a, mUrl);
  });
  // Update calc button
  if (typeof recalcDynamic === 'function') recalcDynamic();
}

// Override switchLang to always use latest data-ru/data-am and update Telegram links
switchLang = function(l) {
  lang = l;
  localStorage.setItem('gtt_lang', l);
  document.querySelectorAll('.lang-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.lang === l); });
  document.querySelectorAll('[data-' + l + ']').forEach(function(el) {
    var t = el.getAttribute('data-' + l);
    if (t && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') _setTextPreserveIcons(el, t);
  });
  // Update input placeholders for current language
  document.querySelectorAll('[data-placeholder-' + l + ']').forEach(function(el) {
    el.placeholder = el.getAttribute('data-placeholder-' + l) || '';
  });
  document.documentElement.lang = l === 'am' ? 'hy' : 'ru';
  // Update URL path to /am or /ru (without page reload) so shared links carry language
  var newPath = l === 'am' ? '/am' : '/ru';
  if (window.location.pathname !== newPath) {
    history.replaceState(null, '', newPath + window.location.hash);
  }
  // Re-apply Telegram links with correct language message templates
  updateTelegramLinks();
};

// ===== IMMEDIATE SECTION REVEAL (before loadSiteData) =====
// On server-injected pages, reveal all sections IMMEDIATELY — don't wait for data loading
(function immediateReveal() {
  var isServerInjected = document.documentElement.classList.contains('server-injected');
  if (isServerInjected) {
    document.querySelectorAll('section.section, div.wb-banner, div.stats-bar, div.slot-counter-bar, div.ticker').forEach(function(sec) {
      sec.classList.add('section-revealed');
      sec.querySelectorAll('.fade-up:not(.visible)').forEach(function(el) { el.classList.add('visible'); });
    });
    var ft = document.querySelector('footer.footer');
    if (ft) ft.style.opacity = '1';
  }
})();

(async function loadSiteData() {
  try {
    // Use SSR-inlined data if available (no extra fetch needed!)
    var db = window.__SITE_DATA || null;
    if (!db) {
      var res = await fetch('/api/site-data');
      if (!res.ok) { console.log('[DB] API unavailable'); return; }
      db = await res.json();
    }
    
    var hasContent = db.textMap && Object.keys(db.textMap).length > 0;
    var hasCalc = db.tabs && db.tabs.length && db.services && db.services.length;
    var hasTg = db.telegram && Object.keys(db.telegram).length > 0;
    var hasBlockFeatures = db.blockFeatures && db.blockFeatures.length > 0;
    
    console.log('[DB] Loaded data. Changed texts:', Object.keys(db.textMap || {}).length, ', services:', (db.services || []).length);
    
    // ===== 1. APPLY CHANGED TEXTS =====
    // textMap: { original_ru: {ru, am} } — only for CHANGED texts
    // If server already injected texts (server-injected class), skip text replacement
    // to avoid cascading conflicts. Only update data-am for elements where ru matches.
    var serverInjected = document.documentElement.classList.contains('server-injected');
    if (hasContent) {
      if (serverInjected) {
        // Server already replaced texts by position — only update data-am where needed
        // Build a reverse map: newRu -> am (from textMap values)
        var amMap = {};
        Object.keys(db.textMap).forEach(function(origKey) {
          var entry = db.textMap[origKey];
          amMap[entry.ru] = entry.am;
          // Also map origKey in case ru didn't change
          amMap[origKey] = entry.am;
        });
        document.querySelectorAll('[data-ru]').forEach(function(el) {
          // Skip elements with data-no-rewrite (floating buttons, footer)
          // Their text is managed by blockFeatures/footer API, not textMap
          if (el.getAttribute('data-no-rewrite') === '1') return;
          // Also skip elements inside footer or floating buttons
          if (el.closest('.tg-float') || el.closest('.calc-float') || el.closest('footer')) return;
          var currentRu = el.getAttribute('data-ru');
          if (!currentRu) return;
          var newAm = amMap[currentRu.trim()];
          if (newAm) {
            el.setAttribute('data-am', newAm);
            // Update visible text for current language
            var t = el.getAttribute('data-' + lang);
            if (t && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') _setTextPreserveIcons(el, t);
          }
        });
        console.log('[DB] Server-injected texts: only AM updated client-side');
      } else {
        // Fallback: server didn't inject — do full client-side replacement
        document.querySelectorAll('[data-ru]').forEach(function(el) {
          // Skip elements with data-no-rewrite (floating buttons, footer)
          if (el.getAttribute('data-no-rewrite') === '1') return;
          if (el.closest('.tg-float') || el.closest('.calc-float') || el.closest('footer')) return;
          var origRu = el.getAttribute('data-ru');
          if (!origRu) return;
          var changed = db.textMap[origRu.trim()];
          if (changed) {
            el.setAttribute('data-ru', changed.ru);
            el.setAttribute('data-am', changed.am);
            var t = el.getAttribute('data-' + lang);
            if (t && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') _setTextPreserveIcons(el, t);
          }
        });
        console.log('[DB] Texts applied (client-side fallback)');
      }
    }
    
    // ===== 1b. INJECT EXTRA TEXTS FROM db.content INTO EXISTING SECTIONS =====
    // Only inject NEW texts that don't match ANY existing data-ru element in the section
    if (db.content) {
      // Iterate over ALL content keys, not just blockFeatures
      var contentKeys = Object.keys(db.content);
      contentKeys.forEach(function(contentKey) {
        var sectionId = contentKey.replace(/_/g, '-');
        var section = document.querySelector('[data-section-id="' + sectionId + '"]');
        if (!section) return;
        var contentTexts = db.content[contentKey];
        if (!contentTexts || contentTexts.length === 0) return;
        // Skip injection for sections with structured HTML layouts
        // These sections have specific design (compare-box, why-steps, etc.) that plain text would break
        var hasStructuredContent = section.querySelector('.compare-box, .why-steps, .buyout-grid, .process-grid, .wh-grid, .stats-grid, .about-grid, .calc-wrap, .services-grid');
        if (hasStructuredContent) return;
        // Collect ALL existing data-ru values in this section
        var existingRuValues = {};
        section.querySelectorAll('[data-ru]').forEach(function(el) {
          var v = (el.getAttribute('data-ru') || '').trim();
          if (v) existingRuValues[v] = true;
        });
        // Find texts in db.content that DON'T match any existing element
        var container = section.querySelector('.container');
        if (!container) return;
        // Find insertion point — insert AFTER major content (photos, carousel) but BEFORE CTA
        var insertRef = null;
        var ctaCandidates = container.querySelectorAll('.section-cta, #reviewsCtaArea');
        for (var cai = 0; cai < ctaCandidates.length; cai++) {
          if (ctaCandidates[cai].parentNode === container) { insertRef = ctaCandidates[cai]; break; }
        }
        // If no CTA, try inserting before footer-like elements
        if (!insertRef) {
          var fallbacks = container.querySelectorAll('.block-socials, .block-slot-counter');
          for (var fbi = 0; fbi < fallbacks.length; fbi++) {
            if (fallbacks[fbi].parentNode === container) { insertRef = fallbacks[fbi]; break; }
          }
        }
        var injected = 0;
        for (var eti = 0; eti < contentTexts.length; eti++) {
          var et = contentTexts[eti];
          if (!et || (!et.ru && !et.am)) continue;
          var ruVal = (et.ru || '').trim();
          // Skip if this text already exists in the section
          if (ruVal && existingRuValues[ruVal]) continue;
          // Skip if already injected as extra-text
          var exists = false;
          section.querySelectorAll('.extra-text').forEach(function(ex) {
            if ((ex.getAttribute('data-ru') || '').trim() === ruVal) exists = true;
          });
          if (exists) continue;
          var etText = lang === 'am' && et.am ? et.am : (et.ru || '');
          var etEl = document.createElement('p');
          etEl.className = 'extra-text section-sub fade-up';
          etEl.setAttribute('data-ru', et.ru || '');
          etEl.setAttribute('data-am', et.am || '');
          etEl.style.cssText = 'text-align:center;color:var(--text-sec);margin-bottom:16px;max-width:700px;margin-left:auto;margin-right:auto;font-size:0.95rem;line-height:1.7';
          etEl.textContent = etText;
          if (insertRef) { container.insertBefore(etEl, insertRef); }
          else { container.appendChild(etEl); }
          injected++;
        }
        if (injected > 0) console.log('[DB] Extra texts injected in', sectionId, ':', injected, 'new');
      });
    }
    
    // ===== 2. REBUILD CALCULATOR FROM DB =====
    if (hasCalc) {
      var calcWrap = document.querySelector('.calc-wrap');
      if (calcWrap) {
        window._calcServices = db.services;
        window._calcTabs = db.tabs;
        
        var tabsDiv = calcWrap.querySelector('.calc-tabs');
        if (tabsDiv) {
          var th = '';
          db.tabs.forEach(function(tab, idx) {
            th += '<div class="calc-tab' + (idx === 0 ? ' active' : '') + '" onclick="showCalcTab(&apos;'+tab.tab_key+'&apos;,this)" data-ru="'+escCalc(tab.name_ru)+'" data-am="'+escCalc(tab.name_am)+'">' + (lang === 'am' ? tab.name_am : tab.name_ru) + '</div>';
          });
          tabsDiv.innerHTML = th;
        }
        
        calcWrap.querySelectorAll('.calc-group').forEach(function(g) { g.remove(); });
        calcWrap.querySelectorAll('.buyout-tier-info').forEach(function(g) { g.remove(); });
        
        var calcTotal = calcWrap.querySelector('.calc-total');
        var byTab = {};
        db.services.forEach(function(svc) {
          if (!byTab[svc.tab_key]) byTab[svc.tab_key] = [];
          byTab[svc.tab_key].push(svc);
        });
        
        db.tabs.forEach(function(tab, tabIdx) {
          var group = document.createElement('div');
          group.className = 'calc-group' + (tabIdx === 0 ? ' active' : '');
          group.id = 'cg-' + tab.tab_key;
          var svcs = byTab[tab.tab_key] || [];
          var gh = '';
          
          svcs.forEach(function(svc) {
            var hasTiers = svc.price_type === 'tiered' && svc.price_tiers_json;
            var tiers = null;
            if (hasTiers) { try { tiers = JSON.parse(svc.price_tiers_json); } catch(e) { tiers = null; hasTiers = false; } }
            
            if (hasTiers && tiers && tiers.length > 0) {
              var svcId = 'tiered_' + svc.id;
              var tiersAttr = svc.price_tiers_json.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
              gh += '<div class="calc-row" data-price="tiered" data-tiers="'+tiersAttr+'" data-svc-id="'+svc.id+'" id="row_'+svcId+'">';
              gh += '<div class="calc-label" data-ru="'+escCalc(svc.name_ru)+'" data-am="'+escCalc(svc.name_am)+'">' + (lang==='am' ? svc.name_am : svc.name_ru) + '</div>';
              gh += '<div class="calc-price" id="price_'+svcId+'">'+formatNum(tiers[0].price)+' ֏</div>';
              gh += '<div class="calc-input"><button onclick="ccTiered(&apos;'+svcId+'&apos;,-1)">−</button><input type="number" id="qty_'+svcId+'" value="0" min="0" max="999" onchange="onTieredInput(&apos;'+svcId+'&apos;)"><button onclick="ccTiered(&apos;'+svcId+'&apos;,1)">+</button></div>';
              gh += '</div>';
              gh += '<div class="buyout-tier-info"><strong>'+( lang==='am' ? 'Որքան շատ — այնքան էժան:' : 'Чем больше — тем дешевле:')+'</strong><br>';
              gh += '<span>' + tiers.map(function(t) { 
                var range = t.max >= 999 ? t.min+'+' : t.min+'-'+t.max;
                return range + ' → ' + formatNum(t.price) + ' ֏'; 
              }).join(' &nbsp;|&nbsp; ') + '</span></div>';
            } else {
              gh += '<div class="calc-row" data-price="'+svc.price+'" data-svc-id="'+svc.id+'">';
              gh += '<div class="calc-label" data-ru="'+escCalc(svc.name_ru)+'" data-am="'+escCalc(svc.name_am)+'">'+(lang==='am' ? svc.name_am : svc.name_ru)+'</div>';
              gh += '<div class="calc-price">'+formatNum(svc.price)+' ֏</div>';
              gh += '<div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalcDynamic()" oninput="recalcDynamic()"><button onclick="cc(this,1)">+</button></div>';
              gh += '</div>';
            }
          });
          group.innerHTML = gh;
          calcTotal.parentNode.insertBefore(group, calcTotal);
        });
        console.log('[DB] Calculator rebuilt:', db.services.length, 'services,', db.tabs.length, 'tabs');
      }
      
      // ===== 2b. RENDER PACKAGES =====
      var pkgsContainer = document.getElementById('calcPackages');
      if (pkgsContainer && db.packages && db.packages.length > 0) {
        window._calcPackages = db.packages;
        // Title and subtitle from settings (editable in admin)
        var pkgTitleRu = (db.settings && db.settings.packages_title_ru) || '\u0413\u043e\u0442\u043e\u0432\u044b\u0435 \u043f\u0430\u043a\u0435\u0442\u044b';
        var pkgTitleAm = (db.settings && db.settings.packages_title_am) || '\u054a\u0561\u057f\u0580\u0561\u057d\u057f \u0583\u0561\u0569\u0565\u0569\u0576\u0565\u0580';
        var pkgSubRu = (db.settings && db.settings.packages_subtitle_ru) || '';
        var pkgSubAm = (db.settings && db.settings.packages_subtitle_am) || '';
        var isSingle = db.packages.length === 1;
        var ph = '<div class="calc-packages-header">';
        ph += '<div class="calc-packages-title"><i class="fas fa-box-open" style="color:#f59e0b"></i> <span data-ru="' + escCalc(pkgTitleRu) + '" data-am="' + escCalc(pkgTitleAm) + '">' + (lang==='am' ? pkgTitleAm : pkgTitleRu) + '</span></div>';
        if (pkgSubRu || pkgSubAm) {
          ph += '<div class="calc-packages-subtitle" data-ru="' + escCalc(pkgSubRu) + '" data-am="' + escCalc(pkgSubAm) + '">' + (lang==='am' ? (pkgSubAm||pkgSubRu) : pkgSubRu) + '</div>';
        }
        ph += '</div>';
        ph += '<div class="calc-packages-grid' + (isSingle ? ' single-pkg' : '') + '">';
        // Sort: cheaper packages left, gold center, expensive right
        var sortedPkgs = db.packages.slice();
        var _goldPkg = null;
        var _otherPkgs = [];
        for (var _gi = 0; _gi < sortedPkgs.length; _gi++) {
          var _gc = sortedPkgs[_gi].crown_tier || (sortedPkgs[_gi].is_popular ? 'gold' : '');
          if (_gc === 'gold' && !_goldPkg) { _goldPkg = sortedPkgs[_gi]; }
          else { _otherPkgs.push(sortedPkgs[_gi]); }
        }
        _otherPkgs.sort(function(a, b) { return (a.package_price || 0) - (b.package_price || 0); });
        if (_goldPkg) {
          // cheaper left, gold center, expensive right
          var _left = _otherPkgs.slice(0, Math.ceil(_otherPkgs.length / 2));
          var _right = _otherPkgs.slice(Math.ceil(_otherPkgs.length / 2));
          sortedPkgs = _left.concat([_goldPkg]).concat(_right);
        } else {
          sortedPkgs = _otherPkgs;
        }
        for (var pki = 0; pki < sortedPkgs.length; pki++) {
          var pk = sortedPkgs[pki];
          var pkDisc = pk.original_price > 0 ? Math.round((1 - pk.package_price / pk.original_price) * 100) : 0;
          var pkCrown = pk.crown_tier || (pk.is_popular ? 'gold' : '');
          ph += '<div class="calc-pkg-card' + (pkCrown ? ' pkg-crown-' + pkCrown : '') + '" data-pkg-id="' + pk.id + '">';
          // Badge instead of crown
          var badgeText = lang === 'am' ? (pk.badge_am || pk.badge_ru || '') : (pk.badge_ru || '');
          var badgeRu = pk.badge_ru || '';
          var badgeAm = pk.badge_am || '';
          if (!badgeRu && pkCrown === 'gold') badgeRu = '\u041b\u0443\u0447\u0448\u0435\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435';
          if (!badgeAm && pkCrown === 'gold') badgeAm = '\u0531\u0574\u0565\u0576\u0561\u0577\u0561\u0570\u0561\u057E\u0565\u057F';
          if (!badgeText && pkCrown === 'gold') badgeText = lang === 'am' ? badgeAm : badgeRu;
          if (badgeText) ph += '<div class="pkg-tier-badge" data-ru="' + escCalc(badgeRu) + '" data-am="' + escCalc(badgeAm) + '">' + escCalc(badgeText) + '</div>';
          ph += '<div class="pkg-name" data-ru="' + escCalc(pk.name_ru) + '" data-am="' + escCalc(pk.name_am) + '">' + (lang==='am' ? pk.name_am : pk.name_ru) + '</div>';
          if (pk.description_ru || pk.description_am) {
            ph += '<div class="pkg-desc" data-ru="' + escCalc(pk.description_ru || '') + '" data-am="' + escCalc(pk.description_am || '') + '">' + (lang==='am' ? (pk.description_am||pk.description_ru) : pk.description_ru) + '</div>';
          }
          ph += '<div class="pkg-prices">';
          if (pk.original_price > 0 && pk.original_price > pk.package_price) {
            ph += '<span class="pkg-old-price">' + formatNum(pk.original_price) + ' \u058f</span>';
          }
          ph += '<span class="pkg-new-price">' + formatNum(pk.package_price) + ' \u058f</span>';
          if (pkDisc > 0) ph += '<span class="pkg-discount">\u2212' + pkDisc + '%</span>';
          ph += '</div>';
          if (pk.items && pk.items.length > 0) {
            ph += '<div class="pkg-items">';
            for (var pii = 0; pii < pk.items.length; pii++) {
              var pi2 = pk.items[pii];
              var piName = lang==='am' ? (pi2.service_name_am || pi2.service_name_ru || '') : (pi2.service_name_ru || '');
              var piNameRu = pi2.service_name_ru || '';
              var piNameAm = pi2.service_name_am || pi2.service_name_ru || '';
              var piQty = pi2.quantity || 1;
              var piExtra = '';
              var piExtraRu = '';
              var piExtraAm = '';
              if (pi2.use_tiered && pi2.price_type === 'tiered' && pi2.price_tiers_json) {
                try {
                  var piTiers = JSON.parse(pi2.price_tiers_json);
                  var piUnitP = getTierPrice(piTiers, piQty);
                  piExtraRu = ' <span style="color:#a78bfa;font-size:0.72rem">(' + formatNum(piUnitP) + ' \u058f/\u0448\u0442)</span>';
                  piExtraAm = ' <span style="color:#a78bfa;font-size:0.72rem">(' + formatNum(piUnitP) + ' \u058f/\u0570\u0561\u057f)</span>';
                  piExtra = lang==='am' ? piExtraAm : piExtraRu;
                } catch(e) {}
              }
              var itemRu = escCalc(piNameRu) + ' \u00d7 ' + piQty + piExtraRu;
              var itemAm = escCalc(piNameAm) + ' \u00d7 ' + piQty + piExtraAm;
              var itemCur = lang==='am' ? itemAm : itemRu;
              ph += '<div data-ru="' + itemRu.replace(/"/g,'&quot;') + '" data-am="' + itemAm.replace(/"/g,'&quot;') + '"><i class="fas fa-check-circle"></i> ' + itemCur + '</div>';
            }
            ph += '</div>';
          }
          ph += '</div>';
        }
        ph += '</div>';
        pkgsContainer.innerHTML = ph;
        pkgsContainer.style.display = '';
        console.log('[DB] Packages rendered:', db.packages.length);
        // Scroll to gold package card on mobile so it's visible first
        (function centerGold() {
          var grid = pkgsContainer.querySelector('.calc-packages-grid');
          if (!grid || window.innerWidth > 768) return;
          var goldCard = grid.querySelector('.calc-pkg-card.pkg-crown-gold');
          if (!goldCard) return;
          // Disable snap temporarily for instant jump
          grid.style.scrollSnapType = 'none';
          grid.style.scrollBehavior = 'auto';
          requestAnimationFrame(function() {
            var sl = goldCard.offsetLeft - (grid.offsetWidth - goldCard.offsetWidth) / 2;
            grid.scrollLeft = Math.max(0, sl);
            // Re-enable snap and smooth scroll after jump
            requestAnimationFrame(function() {
              grid.style.scrollSnapType = 'x mandatory';
              grid.classList.add('smooth-scroll');
            });
          });
        })();
      }
    }
    
    // ===== 3. APPLY TELEGRAM LINKS DYNAMICALLY =====
    if (hasTg) {
      window._tgData = db.telegram;
      
      // Build a lookup: button_label_ru -> telegram message data
      var tgByLabel = {};
      for (var tgKey in db.telegram) {
        var tgMsg = db.telegram[tgKey];
        if (tgMsg && tgMsg.button_label_ru) {
          tgByLabel[tgMsg.button_label_ru.trim()] = tgMsg;
        }
      }
      
      // When server has injected buttons with NEW labels from blockFeatures,
      // the tgByLabel map only has OLD labels (from telegram_messages table).
      // We need to also map NEW button labels to their telegram message data,
      // so that updateTelegramLinks() can find them after language switch.
      if (hasBlockFeatures && serverInjected) {
        db.blockFeatures.forEach(function(bfTg) {
          if (!bfTg.buttons || bfTg.buttons.length === 0) return;
          // Find telegram messages for this section
          var sKey = bfTg.key;
          bfTg.buttons.forEach(function(btn, idx) {
            if (!btn.text_ru) return;
            var newLabel = btn.text_ru.trim();
            if (tgByLabel[newLabel]) return; // already mapped
            // Try to find matching telegram message by section key pattern
            for (var tk in db.telegram) {
              if (tk.indexOf(sKey + '_') === 0) {
                var tm = db.telegram[tk];
                if (tm && !tgByLabel[newLabel]) {
                  // Check if this telegram message was for the old label of this button position
                  tgByLabel[newLabel] = tm;
                  break;
                }
              }
            }
          });
        });
      }
      
      // Find all <a> tags pointing to t.me/ or wa.me/ and update their href with message template
      document.querySelectorAll('a[href*="t.me/"], a[href*="wa.me/"], a[href*="whatsapp"]').forEach(function(a) {
        if (a.id === 'calcTgBtn') return;
        var spanWithDataRu = a.querySelector('span[data-ru]');
        var buttonText = spanWithDataRu ? spanWithDataRu.getAttribute('data-ru') : null;
        if (!buttonText && a.hasAttribute('data-ru')) { buttonText = a.getAttribute('data-ru'); }
        if (!buttonText) { var h4 = a.querySelector('h4[data-ru]'); if (h4) buttonText = h4.getAttribute('data-ru'); }
        if (!buttonText) return;
        buttonText = buttonText.trim();
        var tgMsg = tgByLabel[buttonText];
        if (!tgMsg) return;
        var msgTemplate = (lang === 'am' && tgMsg.message_template_am) ? tgMsg.message_template_am : tgMsg.message_template_ru;
        var mUrl = tgMsg.telegram_url || 'https://t.me/goo_to_top';
        var isWa = mUrl.includes('wa.me') || mUrl.includes('whatsapp');
        if (msgTemplate) {
          a.href = isWa ? (mUrl + (mUrl.includes('?') ? '&text=' : '?text=') + encodeURIComponent(msgTemplate)) : (mUrl + '?text=' + encodeURIComponent(msgTemplate));
        } else {
          a.href = mUrl;
        }
        updateMessengerIcon(a, mUrl);
        if (spanWithDataRu) {
          // When server-injected, buttons already have correct labels from blockFeatures.
          // telegram_messages may have OLD labels (e.g., "Написать в Telegram" instead of "Начать сейчас").
          // Only update labels from telegram_messages when NOT server-injected.
          if (!serverInjected) {
            var newLabelRu = tgMsg.button_label_ru;
            var newLabelAm = tgMsg.button_label_am;
            if (newLabelRu) spanWithDataRu.setAttribute('data-ru', newLabelRu);
            if (newLabelAm) spanWithDataRu.setAttribute('data-am', newLabelAm);
            var currentLangText = spanWithDataRu.getAttribute('data-' + lang);
            if (currentLangText && spanWithDataRu.tagName !== 'INPUT') spanWithDataRu.textContent = currentLangText;
          } else {
            // Server-injected: only update data-am from telegram if it provides Armenian translation
            // but DON'T change data-ru or visible text (those come from blockFeatures buttons)
            if (tgMsg.button_label_am && !spanWithDataRu.getAttribute('data-am')) {
              spanWithDataRu.setAttribute('data-am', tgMsg.button_label_am);
            }
          }
        }
      });
      
      // Also update the contact form submit handler & popup form to use DB telegram URLs
      if (db.telegram.contact_form_msg) {
        window._tgContactUrl = db.telegram.contact_form_msg.telegram_url || 'https://t.me/suport_admin_2';
        window._tgContactTemplate = db.telegram.contact_form_msg.message_template_ru || '';
      }
      if (db.telegram.popup_form_msg) {
        window._tgPopupUrl = db.telegram.popup_form_msg.telegram_url || 'https://t.me/suport_admin_2';
        window._tgPopupTemplate = db.telegram.popup_form_msg.message_template_ru || '';
      }
      
      console.log('[DB] Telegram data loaded and applied:', Object.keys(db.telegram).length, 'messages');
    }
    
    // ===== 3b. BUTTON CLICKS — no lead tracking =====
    // Button clicks only open messenger links, NO auto-lead creation.
    // Leads come only from: contact form, popup form, calculator PDF.
    console.log('[DB] Button click lead-tracking DISABLED (leads only from forms & calculator)');
    
    // ===== 3c. DYNAMIC TICKER FROM DB =====
    if (db.tickerItems && db.tickerItems.length > 0) {
      var tickerTrack = document.getElementById('tickerTrack');
      if (tickerTrack) {
        var th = '';
        for (var ti = 0; ti < 2; ti++) {
          db.tickerItems.forEach(function(it) {
            th += '<div class="ticker-item"><i class="fas ' + (it.icon || 'fa-check-circle') + '"></i><span data-ru="' + (it.ru||'').replace(/"/g,'&quot;') + '" data-am="' + (it.am||'').replace(/"/g,'&quot;') + '">' + (lang === 'am' ? (it.am||it.ru) : it.ru) + '</span></div>';
          });
        }
        tickerTrack.innerHTML = th;
        console.log('[DB] Ticker updated from admin:', db.tickerItems.length, 'items');
      }
    }
    
    // ===== 3d. FOOTER SOCIAL LINKS — inside contacts column =====
    // Server-side injects socials inside #footerContactCol. Client-side fallback only if needed.
    if (db.footerSocials && db.footerSocials.length > 0) {
      var existingSocialsBlock = document.querySelector('#footerContactCol .footer-socials-block');
      if (!existingSocialsBlock) {
        // Server didn't inject — create client-side inside contacts column
        var contactCol = document.getElementById('footerContactCol');
        if (contactCol) {
          var socialIcons = { instagram:'fab fa-instagram', facebook:'fab fa-facebook', telegram:'fab fa-telegram', whatsapp:'fab fa-whatsapp', youtube:'fab fa-youtube', tiktok:'fab fa-tiktok', twitter:'fab fa-twitter', linkedin:'fab fa-linkedin', vk:'fab fa-vk' };
          var socialColors = { instagram:'#E4405F', facebook:'#1877F2', telegram:'#26A5E4', whatsapp:'#25D366', youtube:'#FF0000', tiktok:'#000', twitter:'#1DA1F2', linkedin:'#0A66C2', vk:'#4680C2' };
          var footerBf = null;
          if (db.blockFeatures) { for (var fi = 0; fi < db.blockFeatures.length; fi++) { if (db.blockFeatures[fi].key === 'footer') { footerBf = db.blockFeatures[fi]; break; } } }
          var fss = footerBf ? (footerBf.social_settings || {}) : {};
          
          var socialsDiv = document.createElement('div');
          socialsDiv.className = 'footer-socials-block';
          socialsDiv.style.cssText = 'margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08)';
          var fsh = '';
          var fsTitle = lang === 'am' ? (fss.title_am || fss.title_ru || '') : (fss.title_ru || '');
          if (fsTitle) fsh += '<div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:var(--accent,#8B5CF6);margin-bottom:12px">' + fsTitle + '</div>';
          fsh += '<div style="display:flex;gap:' + (fss.gap || 10) + 'px;flex-wrap:wrap">';
          db.footerSocials.forEach(function(s) {
            var icon = socialIcons[s.type] || 'fas fa-link';
            var color = s.bg_color || socialColors[s.type] || '#8B5CF6';
            var sz = s.icon_size || 36;
            fsh += '<a href="' + (s.url||'#') + '" target="_blank" rel="noopener" class="footer-social-btn" style="display:inline-flex;align-items:center;justify-content:center;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + color + ';color:white;font-size:' + Math.round(sz*0.45) + 'px;transition:transform 0.2s">' +
              '<i class="' + icon + '"></i></a>';
          });
          fsh += '</div>';
          socialsDiv.innerHTML = fsh;
          contactCol.appendChild(socialsDiv);
          console.log('[DB] Footer social links injected into contacts column (client fallback):', db.footerSocials.length);
        }
      } else {
        console.log('[DB] Footer social links already in contacts column:', db.footerSocials.length);
      }
    }
    

    // ===== 4. INJECT CUSTOM SCRIPTS =====
    if (db.scripts) {
      if (db.scripts.head && db.scripts.head.length) {
        db.scripts.head.forEach(function(code) {
          var div = document.createElement('div');
          div.innerHTML = code;
          div.querySelectorAll('script').forEach(function(s) {
            var ns = document.createElement('script');
            if (s.src) ns.src = s.src; else ns.textContent = s.textContent;
            document.head.appendChild(ns);
          });
          div.querySelectorAll(':not(script)').forEach(function(el) { document.head.appendChild(el.cloneNode(true)); });
        });
      }
      if (db.scripts.body_end && db.scripts.body_end.length) {
        db.scripts.body_end.forEach(function(code) {
          var div = document.createElement('div');
          div.innerHTML = code;
          document.body.appendChild(div);
        });
      }
    }
    
    // ===== 5a. CREATE MISSING SECTIONS (for copied/new blocks) =====
    // Must happen BEFORE reordering so new sections participate in sort
    if (db.blockFeatures && db.blockFeatures.length > 0) {
      var footer5 = document.querySelector('footer');
      var mainParent5 = footer5 ? footer5.parentElement : document.querySelector('main') || document.body;
      // Build a set of existing section IDs in the DOM (both hyphen and underscore)
      var _existingSectionIds = {};
      document.querySelectorAll('[data-section-id]').forEach(function(el) {
        var sid = el.getAttribute('data-section-id') || '';
        _existingSectionIds[sid] = true;
        _existingSectionIds[sid.replace(/-/g, '_')] = true;
        _existingSectionIds[sid.replace(/_/g, '-')] = true;
      });
      // Resolve button icon: manual > auto-detect from URL > default
      function resolveIcon(ic, url) {
        var defs = ['fas fa-link','fas fa-arrow-right',''];
        if (ic && defs.indexOf(ic) < 0) return ic;
        if (url) {
          if (url.indexOf('t.me/')>=0||url.indexOf('telegram.')>=0) return 'fab fa-telegram';
          if (url.indexOf('wa.me/')>=0||url.indexOf('whatsapp.')>=0) return 'fab fa-whatsapp';
          if (url.indexOf('instagram.com')>=0) return 'fab fa-instagram';
          if (url.indexOf('facebook.com')>=0) return 'fab fa-facebook';
          if (url.indexOf('tiktok.com')>=0) return 'fab fa-tiktok';
          if (url.indexOf('youtube.com')>=0) return 'fab fa-youtube';
          if (url.indexOf('#calc')>=0) return 'fas fa-calculator';
          if (url.indexOf('tel:')>=0) return 'fas fa-phone';
        }
        return ic || 'fas fa-link';
      }
      db.blockFeatures.forEach(function(bf) {
        if (bf.key === 'floating_tg' || bf.key === 'footer' || bf.key === 'seo_og' || bf.block_type === 'floating' || bf.block_type === 'footer' || bf.block_type === 'calculator' || bf.block_type === 'navigation' || bf.block_type === 'ticker' || bf.block_type === 'popup' || bf.block_type === 'seo') return;
        
        // ── SLOT COUNTER BLOCK TYPE — create counter bar instead of section ──
        if (bf.block_type === 'slot_counter') {
          var scSectionId = bf.key.replace(/_/g, '-');
          if (_existingSectionIds[scSectionId] || _existingSectionIds[bf.key]) return;
          // Check visibility from sectionOrder
          if (db.sectionOrder) {
            for (var sci = 0; sci < db.sectionOrder.length; sci++) {
              var sco = db.sectionOrder[sci];
              var scoNorm = (sco.section_id || '').replace(/_/g, '-');
              if ((scoNorm === scSectionId) && !sco.is_visible) return;
            }
          }
          var scTotal = bf.total_slots || 10;
          var scBooked = bf.booked_slots || 0;
          var scFree = Math.max(0, scTotal - scBooked);
          var scPct = scTotal > 0 ? Math.round(((scTotal - scFree) / scTotal) * 100) : 0;
          var scLabelRu = (bf.texts_ru && bf.texts_ru[0]) || 'Свободных мест';
          var scLabelAm = (bf.texts_am && bf.texts_am[0]) || '';
          var scLabel = lang === 'am' && scLabelAm ? scLabelAm : scLabelRu;
          
          var scEl = document.createElement('div');
          scEl.className = 'slot-counter-bar';
          scEl.setAttribute('data-section-id', scSectionId);
          scEl.id = scSectionId;
          scEl.innerHTML = '<div class="container">' +
            '<div style="display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap;padding:24px 0">' +
              '<div style="display:flex;align-items:center;gap:12px">' +
                '<div style="width:14px;height:14px;border-radius:50%;background:#10B981;animation:pulse 2s infinite"></div>' +
                '<span style="font-size:1rem;font-weight:600;color:var(--text-secondary)" data-ru="' + scLabelRu.replace(/"/g, '&quot;') + '" data-am="' + (scLabelAm || '').replace(/"/g, '&quot;') + '">' + scLabel + '</span>' +
              '</div>' +
              '<div style="display:flex;align-items:center;gap:8px">' +
                '<span style="font-size:2.2rem;font-weight:900;color:var(--purple)">' + scFree + '</span>' +
                '<span style="font-size:0.85rem;color:var(--text-muted)">/ ' + scTotal + '</span>' +
              '</div>' +
              '<div style="width:200px;height:8px;background:var(--bg-card);border-radius:4px;overflow:hidden">' +
                '<div style="height:100%;background:linear-gradient(90deg,#10B981,#8B5CF6);border-radius:4px;transition:width 1s ease;width:' + scPct + '%"></div>' +
              '</div>' +
            '</div>' +
            '<div class="section-cta" style="padding-bottom:16px"></div>' +
          '</div>';
          
          // Insert before footer
          if (footer5) mainParent5.insertBefore(scEl, footer5);
          else mainParent5.appendChild(scEl);
          _existingSectionIds[scSectionId] = true;
          _existingSectionIds[bf.key] = true;
          console.log('[DB] Created slot-counter-bar:', scSectionId, 'free:', scFree, '/', scTotal);
          return;
        }
        
        var sectionId = bf.key.replace(/_/g, '-');
        // Check BOTH formats to prevent duplicate creation
        if (_existingSectionIds[sectionId] || _existingSectionIds[bf.key]) return;
        // Check visibility from sectionOrder
        if (db.sectionOrder) {
          for (var oi = 0; oi < db.sectionOrder.length; oi++) {
            var so = db.sectionOrder[oi];
            var soNorm = (so.section_id || '').replace(/_/g, '-');
            if ((soNorm === sectionId) && !so.is_visible) return;
          }
        }
        // Find texts from content
        var blockTexts = [];
        if (db.content) {
          for (var ck in db.content) {
            var ckNorm = ck.replace(/_/g, '-');
            if (ckNorm === sectionId) { blockTexts = db.content[ck] || []; break; }
          }
        }
        // Only create section if it has at least some content (title text or photos)
        var hasContent5 = false;
        if (blockTexts.length > 0) {
          for (var tci = 0; tci < blockTexts.length; tci++) {
            var tc = blockTexts[tci];
            if (tc && (tc.ru || tc.am || (typeof tc === 'string' && tc.trim()))) { hasContent5 = true; break; }
          }
        }
        if (bf.photos && bf.photos.length > 0) hasContent5 = true;
        if (!hasContent5) return; // Don't create empty sections
        // Create section element
        var newSec = document.createElement('section');
        newSec.className = 'section fade-up';
        newSec.setAttribute('data-section-id', sectionId);
        newSec.id = sectionId;
        var bfStyles = bf.text_styles || [];
        var secH = '<div class="container">';
        if (blockTexts.length > 0 && blockTexts[0]) {
          var titleText = lang === 'am' && blockTexts[0].am ? blockTexts[0].am : (blockTexts[0].ru || blockTexts[0] || '');
          var ts0 = bfStyles[0] || {};
          var ts0Css = '';
          if (ts0.color) ts0Css += 'color:' + ts0.color + ';';
          if (ts0.size) ts0Css += 'font-size:' + ts0.size + ';';
          secH += '<h2 class="section-title" style="text-align:center;margin-bottom:32px;' + ts0Css + '"><span data-ru="' + (blockTexts[0].ru||'') + '" data-am="' + (blockTexts[0].am||'') + '">' + titleText + '</span></h2>';
        }
        for (var ti = 1; ti < blockTexts.length; ti++) {
          var t = blockTexts[ti];
          if (t) {
            var tText = lang === 'am' && t.am ? t.am : (t.ru || t || '');
            var tsI = bfStyles[ti] || {};
            var tsICss = '';
            if (tsI.color) tsICss += 'color:' + tsI.color + ';';
            if (tsI.size) tsICss += 'font-size:' + tsI.size + ';';
            secH += '<p style="text-align:center;color:var(--text-secondary);margin-bottom:16px;max-width:700px;margin-left:auto;margin-right:auto;' + tsICss + '"><span data-ru="' + (t.ru||'') + '" data-am="' + (t.am||'') + '">' + tText + '</span></p>';
          }
        }
        secH += '<div class="section-cta"></div>';
        secH += '</div>';
        newSec.innerHTML = secH;
        if (footer5 && mainParent5) { mainParent5.insertBefore(newSec, footer5); }
        else if (mainParent5) { mainParent5.appendChild(newSec); }
        // Register so we don't create duplicates
        _existingSectionIds[sectionId] = true;
        _existingSectionIds[bf.key] = true;
        console.log('[DB] Created missing section:', sectionId);
      });
    }
    
    // ===== 5b. REORDER ALL SECTIONS (including newly created ones) =====
    // Skip if server already reordered sections (data-server-ordered="1" on <html>)
    var serverOrdered = document.documentElement.getAttribute('data-server-ordered') === '1';
    if (db.sectionOrder && db.sectionOrder.length > 0 && !serverOrdered) {
      // Build orderMap with normalized (hyphen) key lookups
      var orderMap = {};
      db.sectionOrder.forEach(function(s) {
        var norm = (s.section_id || '').replace(/_/g, '-');
        orderMap[norm] = s;
        orderMap[s.section_id] = s;
        var alt = s.section_id.indexOf('-') >= 0 ? s.section_id.replace(/-/g, '_') : s.section_id.replace(/_/g, '-');
        if (!orderMap[alt]) orderMap[alt] = s;
      });
      // Re-query all sections (including dynamically created ones from step 5a)
      var allSections = document.querySelectorAll('[data-section-id]');
      var parent = allSections.length > 0 ? allSections[0].parentNode : null;
      if (parent) {
        var sectionArr = Array.from(allSections);
        // Deduplicate: if two sections have same normalized ID, remove the empty/smaller one
        var _seenNorm = {};
        var _toRemove = [];
        sectionArr.forEach(function(sec) {
          var sid = sec.getAttribute('data-section-id') || '';
          var norm = sid.replace(/_/g, '-');
          if (_seenNorm[norm]) {
            // Duplicate — keep the one with more content
            var prev = _seenNorm[norm];
            var prevLen = (prev.innerHTML || '').length;
            var curLen = (sec.innerHTML || '').length;
            if (curLen > prevLen) {
              _toRemove.push(prev);
              _seenNorm[norm] = sec;
            } else {
              _toRemove.push(sec);
            }
          } else {
            _seenNorm[norm] = sec;
          }
        });
        _toRemove.forEach(function(el) { el.remove(); });
        // Re-query after dedup
        sectionArr = Array.from(document.querySelectorAll('[data-section-id]'));
        var activeCount = 0;
        // Stable sort: sections with same sort_order keep their DOM order
        var _originalIndex = {};
        sectionArr.forEach(function(s, i) { _originalIndex[s.getAttribute('data-section-id')] = i; });
        sectionArr.sort(function(a, b) {
          var aidN = (a.getAttribute('data-section-id') || '').replace(/_/g, '-');
          var bidN = (b.getAttribute('data-section-id') || '').replace(/_/g, '-');
          var oa = orderMap[aidN] || orderMap[a.getAttribute('data-section-id')];
          var ob = orderMap[bidN] || orderMap[b.getAttribute('data-section-id')];
          var sa = oa ? oa.sort_order : 999;
          var sb = ob ? ob.sort_order : 999;
          if (sa !== sb) return sa - sb;
          // Same sort_order: preserve original DOM order
          return (_originalIndex[a.getAttribute('data-section-id')] || 0) - (_originalIndex[b.getAttribute('data-section-id')] || 0);
        });
        var footer = document.querySelector('footer');
        sectionArr.forEach(function(section) {
          var sid = section.getAttribute('data-section-id');
          var sidNorm = (sid || '').replace(/_/g, '-');
          var info = orderMap[sidNorm] || orderMap[sid];
          if (info && !info.is_visible) {
            section.style.display = 'none';
          } else {
            activeCount++;
          }
          if (footer) {
            parent.insertBefore(section, footer);
          }
        });
        console.log('[DB] Sections reordered:', db.sectionOrder.length, 'total sections:', sectionArr.length, 'active:', activeCount);
      }
    }
    
    if (db.blockFeatures && db.blockFeatures.length > 0) {
      var socialIcons = { instagram:'fab fa-instagram', facebook:'fab fa-facebook', telegram:'fab fa-telegram', whatsapp:'fab fa-whatsapp', youtube:'fab fa-youtube', tiktok:'fab fa-tiktok', twitter:'fab fa-x-twitter', linkedin:'fab fa-linkedin', vk:'fab fa-vk', website:'fas fa-globe', email:'fas fa-envelope', phone:'fas fa-phone', pinterest:'fab fa-pinterest', snapchat:'fab fa-snapchat', discord:'fab fa-discord', github:'fab fa-github', threads:'fab fa-threads', viber:'fab fa-viber' };
      var socialColors = { instagram:'#E4405F', facebook:'#1877F2', telegram:'#26A5E4', whatsapp:'#25D366', youtube:'#FF0000', tiktok:'#000', twitter:'#1DA1F2', linkedin:'#0A66C2', vk:'#4680C2', website:'#8B5CF6', email:'#F59E0B', phone:'#10B981', pinterest:'#E60023', snapchat:'#FFFC00', discord:'#5865F2', github:'#333', threads:'#000', viber:'#7360F2' };
      
      // Build a map of blockFeature buttons for updateTelegramLinks() to use with new labels
      window._blockFeaturesBtns = {};
      if (hasBlockFeatures) {
        db.blockFeatures.forEach(function(bfMap) {
          if (bfMap.buttons && bfMap.buttons.length > 0) {
            window._blockFeaturesBtns[bfMap.key] = bfMap.buttons;
          }
        });
      }
      
      db.blockFeatures.forEach(function(bf) {
        // Map block_key (underscores) to data-section-id (hyphens)
        var sectionId = bf.key.replace(/_/g, '-');
        var section = document.querySelector('[data-section-id="' + sectionId + '"]');
        if (!section) return;
        
        // Replace main photo if photo_url is set AND different from current
        if (bf.photo_url) {
          var heroImg = section.querySelector('.hero-image img, img[alt]');
          if (heroImg) {
            var currentSrc = heroImg.getAttribute('src') || '';
            // Only replace if URL actually changed (avoid re-triggering image load)
            if (currentSrc !== bf.photo_url && !currentSrc.endsWith(bf.photo_url.split('/').pop())) {
              heroImg.setAttribute('src', bf.photo_url);
            }
          }
        }

        // Inject photos if photos array has items (no toggle required)
        // BUT skip if section already has images from HTML template (avoid duplicates)
        if (bf.photos && bf.photos.length > 0) {
          // Clean up any previously injected galleries first
          var existingPhotoGal = section.querySelector('.block-photo-gallery');
          if (existingPhotoGal) existingPhotoGal.remove();
          var existingReviewGallery = section.querySelector('.rv-gallery, .rv-carousel');
          if (existingReviewGallery) existingReviewGallery.remove();
          var existingReviewCarousel = section.querySelector('.reviews-carousel-wrap');
          if (existingReviewCarousel) existingReviewCarousel.remove();
          
          // Check if section has NATIVE content containers (grid, gallery, carousel already in HTML)
          // This catches static templates like warehouse (.wh-grid), about (.about-grid), etc.
          var hasStaticPhotoContainer = !!(section.querySelector('.wh-grid, .wh-item, .about-grid, .guarantee-card'));
          
          // Check if section has NATIVE images (from HTML template, not our injection)
          var nativeImgs = section.querySelectorAll('img:not(.block-photo-gallery img):not(.rv-carousel img):not(.reviews-carousel-wrap img)');
          var hasNativePhotos = nativeImgs.length > 0 && bf.block_type !== 'reviews';
          
          // If section has native photos, check if ANY DB photo URLs overlap
          var shouldSkip = false;
          if (hasStaticPhotoContainer || hasNativePhotos) {
            var validCheck = bf.photos.filter(function(p) { return p && p.url; });
            // Extract just the filename from each URL for reliable comparison
            function extractFilename(u) { return (u || '').split('/').pop().split('?')[0].toLowerCase(); }
            var allAlreadyInDom = true;
            for (var vci = 0; vci < validCheck.length; vci++) {
              var found = false;
              var checkUrl = validCheck[vci].url;
              var checkName = extractFilename(checkUrl);
              for (var ni = 0; ni < nativeImgs.length; ni++) {
                var imgSrc = nativeImgs[ni].getAttribute('src') || nativeImgs[ni].src || '';
                var imgName = extractFilename(imgSrc);
                // Compare: exact match, substring containment, OR filename match
                if (imgSrc === checkUrl || imgSrc.indexOf(checkUrl) >= 0 || checkUrl.indexOf(imgSrc) >= 0 || (checkName && imgName && checkName === imgName)) { 
                  found = true; break; 
                }
              }
              if (!found) { allAlreadyInDom = false; break; }
            }
            if (allAlreadyInDom || hasStaticPhotoContainer) {
              shouldSkip = true; // Section has native photos — skip injection
              console.log('[DB] Skipping photo injection for', sectionId, '(native photos present)');
            }
          }
          
          if (shouldSkip) {
            // Section has matching native photos — do NOT inject gallery
          } else {
          
          var validPhotos = bf.photos.filter(function(p) { return p && p.url; });
          if (validPhotos.length > 0) {
            // Reviews: single-photo carousel with swipe cues and descriptions
            if (bf.block_type === 'reviews') {
              var carouselWrap = document.createElement('div');
              carouselWrap.className = 'rv-carousel';
              var carId = 'rvCar_' + (bf.key || 'reviews');
              var cH = '<div class="rv-track" id="' + carId + '_track">';
              validPhotos.forEach(function(p, pi) {
                var captionRu = p.caption_ru || p.caption || '';
                var captionAm = p.caption_am || '';
                var captionText = lang === 'am' && captionAm ? captionAm : captionRu;
                if (!captionText) {
                  // Default trust-building descriptions
                  var defaultCaptions = [
                    '\u0421 \u043c\u043e\u043c\u0435\u043d\u0442\u0430 \u0441\u0442\u0430\u0440\u0442\u0430 \u043f\u0440\u043e\u0448\u043b\u043e 12 \u0434\u043d\u0435\u0439 \u2014 \u0432\u043e\u0442 \u0442\u0430\u043a\u0438\u0435 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b',
                    '\u0420\u0435\u0430\u043b\u044c\u043d\u0430\u044f \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0430 \u2014 \u0440\u043e\u0441\u0442 \u0437\u0430\u043a\u0430\u0437\u043e\u0432 \u0438 \u043e\u0440\u0433\u0430\u043d\u0438\u043a\u0438',
                    '\u041e\u0442 \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u0432\u044b\u043a\u0443\u043f\u0430 \u0434\u043e \u0422\u041e\u041f-10 \u0437\u0430 2 \u043d\u0435\u0434\u0435\u043b\u0438',
                    '\u041a\u043b\u0438\u0435\u043d\u0442 \u0443\u0432\u0435\u043b\u0438\u0447\u0438\u043b \u043f\u0440\u043e\u0434\u0430\u0436\u0438 \u0432 3 \u0440\u0430\u0437\u0430 \u0437\u0430 \u043c\u0435\u0441\u044f\u0446',
                    '\u0411\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0435 \u0432\u044b\u043a\u0443\u043f\u044b \u2014 \u043d\u0438 \u043e\u0434\u043d\u043e\u0439 \u0431\u043b\u043e\u043a\u0438\u0440\u043e\u0432\u043a\u0438',
                    '\u041f\u043e\u0434\u043d\u044f\u043b\u0438 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443 \u0441 0 \u0434\u043e 500+ \u0437\u0430\u043a\u0430\u0437\u043e\u0432 \u0432 \u043c\u0435\u0441\u044f\u0446'
                  ];
                  captionText = defaultCaptions[pi % defaultCaptions.length];
                }
                cH += '<div class="rv-slide">' +
                  '<div class="rv-badge">' + (pi + 1) + ' / ' + validPhotos.length + '</div>' +
                  '<img src="' + p.url + '" alt="' + captionText.replace(/"/g,'&quot;') + '" loading="eager" data-lightbox-url="' + (p.url||'').replace(/"/g,'&quot;') + '">' +
                  '<div class="rv-caption"><div class="rv-caption-text" data-ru="' + captionRu.replace(/"/g,'&quot;') + '" data-am="' + captionAm.replace(/"/g,'&quot;') + '"><i class="fas fa-quote-left" style="font-size:0.7em;margin-right:6px;opacity:0.5;vertical-align:top"></i>' + captionText + '</div></div>' +
                '</div>';
              });
              cH += '</div>';
              // Navigation arrows
              if (validPhotos.length > 1) {
                cH += '<button class="rv-nav-btn rv-prev" onclick="rvSlide(&apos;' + carId + '&apos;,-1)" aria-label="Prev"><i class="fas fa-chevron-left"></i></button>';
                cH += '<button class="rv-nav-btn rv-next" onclick="rvSlide(&apos;' + carId + '&apos;,1)" aria-label="Next"><i class="fas fa-chevron-right"></i></button>';
              }
              carouselWrap.innerHTML = cH;
              // Dots + swipe hint container
              var dotsDiv = document.createElement('div');
              var dotsH = '<div class="rv-dots" id="' + carId + '_dots">';
              for (var di = 0; di < validPhotos.length; di++) {
                dotsH += '<div class="rv-dot' + (di === 0 ? ' active' : '') + '" onclick="rvGoTo(&apos;' + carId + '&apos;,' + di + ')"></div>';
              }
              dotsH += '</div>';
              if (validPhotos.length > 1) {
                var swipeHintRu = bf.swipe_hint_ru || '\u041b\u0438\u0441\u0442\u0430\u0439\u0442\u0435 \u0434\u043b\u044f \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430';
                var swipeHintAm = bf.swipe_hint_am || '\u054d\u0561\u0570\u0565\u0581\u0580\u0565\u0584 \u0564\u056b\u057f\u0565\u056c\u0578\u0582';
                var swipeHintText = lang === 'am' ? swipeHintAm : swipeHintRu;
                dotsH += '<div class="rv-swipe-hint"><i class="fas fa-hand-pointer" style="color:var(--purple,#8B5CF6)"></i> <span data-ru="' + swipeHintRu.replace(/"/g,'&quot;') + '" data-am="' + swipeHintAm.replace(/"/g,'&quot;') + '">' + swipeHintText + '</span> <i class="fas fa-arrow-right" style="font-size:0.75rem;animation:rvSwipeHint 2s ease-in-out infinite"></i></div>';
              }
              dotsDiv.innerHTML = dotsH;
              // Place into DOM (NO counter text — removed per user request)
              var placeholder = section.querySelector('#reviewsCarouselArea');
              if (placeholder) {
                placeholder.innerHTML = '';
                placeholder.appendChild(carouselWrap);
                placeholder.appendChild(dotsDiv);
              } else {
                var container = section.querySelector('.container');
                if (container) { container.appendChild(carouselWrap); container.appendChild(dotsDiv); }
                else { section.appendChild(carouselWrap); section.appendChild(dotsDiv); }
              }
              // Initialize state and add scroll listener for dot sync + loop
              _rvState[carId] = { idx: 0, total: validPhotos.length };
              (function(cid, totalSlides) {
                var track = document.getElementById(cid + '_track');
                if (!track) return;
                // Sync dots with native scroll position
                var scrollTimer = null;
                track.addEventListener('scroll', function() {
                  if (scrollTimer) clearTimeout(scrollTimer);
                  scrollTimer = setTimeout(function() {
                    var slideW = track.offsetWidth;
                    if (slideW <= 0) return;
                    var newIdx = Math.round(track.scrollLeft / slideW);
                    newIdx = Math.max(0, Math.min(newIdx, totalSlides - 1));
                    _rvState[cid] = { idx: newIdx, total: totalSlides };
                    var dots = document.querySelectorAll('#' + cid + '_dots .rv-dot');
                    for (var d = 0; d < dots.length; d++) {
                      if (d === newIdx) dots[d].classList.add('active');
                      else dots[d].classList.remove('active');
                    }
                    var hint = document.querySelector('.rv-swipe-hint');
                    if (hint) hint.style.display = 'none';
                  }, 80);
                }, {passive: true});
                // Loop: swipe past last → go to first, swipe before first → go to last
                var _rvLoopTouchX = 0;
                track.addEventListener('touchstart', function(e) {
                  _rvLoopTouchX = e.touches[0].clientX;
                }, {passive: true});
                track.addEventListener('touchend', function(e) {
                  var dx = e.changedTouches[0].clientX - _rvLoopTouchX;
                  var state = _rvState[cid] || { idx: 0, total: totalSlides };
                  // Swiped left on last slide → go to first
                  if (dx < -30 && state.idx >= totalSlides - 1) {
                    setTimeout(function() { rvGoTo(cid, 0); }, 100);
                  }
                  // Swiped right on first slide → go to last
                  if (dx > 30 && state.idx <= 0) {
                    setTimeout(function() { rvGoTo(cid, totalSlides - 1); }, 100);
                  }
                }, {passive: true});
              })(carId, validPhotos.length);
            } else {
              // Default grid view for regular blocks
              var photoDiv = document.createElement('div');
              photoDiv.className = 'block-photo-gallery';
              photoDiv.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;padding:16px 0;margin-top:12px';
              var phH = '';
              validPhotos.forEach(function(p) {
                phH += '<div style="border-radius:12px;overflow:hidden;border:1px solid var(--border,rgba(255,255,255,0.1));cursor:pointer" onclick="openLightbox(&apos;' + (p.url||'').replace(/'/g,'') + '&apos;)">' +
                  '<img src="' + p.url + '" alt="' + (p.caption||'') + '" style="width:100%;height:auto;object-fit:cover;transition:transform 0.3s" onmouseover="this.style.transform=&apos;scale(1.05)&apos;" onmouseout="this.style.transform=&apos;scale(1)&apos;">' +
                  (p.caption ? '<div style="padding:8px 12px;font-size:0.82rem;color:var(--text-sec,#aaa)">' + p.caption + '</div>' : '') +
                '</div>';
              });
              photoDiv.innerHTML = phH;
              var container = section.querySelector('.container');
              if (container) container.appendChild(photoDiv);
              else section.appendChild(photoDiv);
            }
          }
          } // end else (no native photos or show_photos enabled)
        }
        
        // Inject social links if socials have URLs (no toggle required)
        // Guard: social_links might be a string instead of array (DB parsing issue)
        var socLinks = bf.social_links;
        if (typeof socLinks === 'string') { try { socLinks = JSON.parse(socLinks); } catch(e) { socLinks = []; } }
        if (!Array.isArray(socLinks)) socLinks = [];
        if (socLinks.length > 0 && socLinks.some(function(s) { return !!s.url; })) {
          // Remove existing social container if any
          var existing = section.querySelector('.block-socials');
          if (existing) existing.remove();
          
          var ss = bf.social_settings || {};
          var socGap = ss.gap || 12;
          var socAlign = ss.align || 'center';
          var socPosition = ss.position || 'bottom';
          var justifyMap = { center: 'center', left: 'flex-start', right: 'flex-end' };
          
          var socDiv = document.createElement('div');
          socDiv.className = 'block-socials';
          socDiv.style.cssText = 'display:flex;flex-direction:column;align-items:' + (socAlign === 'center' ? 'center' : socAlign === 'right' ? 'flex-end' : 'flex-start') + ';padding:16px 0;margin-top:12px';
          
          var socH = '';
          // Title (subtitle removed - only title shown)
          var socTitle = lang === 'am' ? (ss.title_am || ss.title_ru || '') : (ss.title_ru || '');
          if (socTitle) socH += '<div style="font-size:1.1rem;font-weight:700;color:var(--text-primary,#fff);margin-bottom:4px">' + socTitle + '</div>';
          
          // Icons row
          socH += '<div style="display:flex;gap:' + socGap + 'px;justify-content:' + (justifyMap[socAlign] || 'center') + ';align-items:flex-start;flex-wrap:wrap">';
          socLinks.forEach(function(s) {
            if (!s.url) return;
            var icon = socialIcons[s.type] || 'fas fa-link';
            var color = s.bg_color || socialColors[s.type] || '#8B5CF6';
            var sz = s.icon_size || 44;
            var fontSize = Math.round(sz * 0.45);
            var textSz = s.text_size || 14;
            socH += '<a href="' + s.url + '" target="_blank" rel="noopener" style="display:inline-flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none" onmouseover="this.querySelector(&apos;.soc-icon&apos;).style.transform=&apos;scale(1.15)&apos;;this.querySelector(&apos;.soc-icon&apos;).style.boxShadow=&apos;0 4px 15px ' + color + '66&apos;" onmouseout="this.querySelector(&apos;.soc-icon&apos;).style.transform=&apos;scale(1)&apos;;this.querySelector(&apos;.soc-icon&apos;).style.boxShadow=&apos;none&apos;">' +
              '<div class="soc-icon" style="display:inline-flex;align-items:center;justify-content:center;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:' + color + ';color:white;font-size:' + fontSize + 'px;transition:transform 0.2s,box-shadow 0.2s">' +
              '<i class="' + icon + '"></i></div>' +
              (s.label ? '<span style="font-size:' + textSz + 'px;color:var(--text-secondary,#999);max-width:' + (sz + 40) + 'px;text-align:center;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + s.label + '</span>' : '') +
            '</a>';
          });
          socH += '</div>';
          
          socDiv.innerHTML = socH;
          var container = section.querySelector('.container');
          if (socPosition === 'top') {
            if (container) { container.insertBefore(socDiv, container.firstChild); }
            else { section.insertBefore(socDiv, section.firstChild); }
          } else {
            if (container) { container.appendChild(socDiv); }
            else { section.appendChild(socDiv); }
          }
        }
        
        // Slot counter injection removed — now handled as separate block type 'slot_counter'

        // Dynamic buttons: update CTA buttons in section from DB
        // Skip calculator — its button (calcTgBtn) is handled separately after this loop
        if (bf.buttons && bf.buttons.length > 0 && bf.block_type !== 'calculator') {
          var sectionIdH = bf.key.replace(/_/g, '-');
          
          // floating_tg is handled separately after the main loop
          // (this forEach skips floating_tg on entry, so this code block is for regular sections only)
          
          {
            // For regular sections: UPDATE existing buttons IN-PLACE only
            // NEVER create new containers or buttons — only update what already exists in HTML
            // This prevents duplicate buttons from appearing after async DB load
            
            // Mark section as already processed to prevent double-processing
            if (section.getAttribute('data-btns-applied') === '1') return;
            section.setAttribute('data-btns-applied', '1');
            
            // 1. Find the dedicated CTA container (if any)
            var ctaContainer = section.querySelector('#reviewsCtaArea') || section.querySelector('.section-cta') || section.querySelector('.hero-buttons');
            
            // 2. Find ALL button links AND form buttons in the section (in ANY container)
            var allBtns = section.querySelectorAll('a.btn, a.btn-primary, a.btn-tg, a.btn-success, a.btn-warning, a.btn-outline, button.btn, button.btn-primary, button.btn-lg');
            var existingBtns = [];
            for (var eb = 0; eb < allBtns.length; eb++) {
              var btn = allBtns[eb];
              // Skip nav items, popup buttons, footer, stats
              if (btn.closest('.nav-links') || btn.closest('.popup-card') || btn.closest('.hero-stats') || btn.closest('.stat') || btn.closest('footer') || btn.closest('.tg-float') || btn.closest('.calc-float')) continue;
              existingBtns.push(btn);
            }
            
            // 3. If section has a form with a submit button, treat it as having buttons (don't inject duplicates)
            var hasFormButton = !!section.querySelector('form button[type="submit"], form .btn');
            
            // === SERVER-INJECTED BUTTON CHECK ===
            // If server already injected buttons via HTMLRewriter, buttons already have correct text.
            // Only update data-am for current language, don't replace text (prevents flash/flicker).
            if (serverInjected && existingBtns.length > 0) {
              var validDbBtns3 = bf.buttons.filter(function(b3) { return b3.text_ru || b3.text_am; });
              var needsUpdate = false;
              for (var si = 0; si < validDbBtns3.length && si < existingBtns.length; si++) {
                var dbBtn3 = validDbBtns3[si];
                var eBtn3 = existingBtns[si];
                var eSpan3 = eBtn3.querySelector('span[data-ru]');
                if (eSpan3) {
                  var currentBtnRu = eSpan3.getAttribute('data-ru') || '';
                  // Only do full replacement if server didn't inject this button correctly
                  if (currentBtnRu !== (dbBtn3.text_ru || '')) {
                    needsUpdate = true;
                    break;
                  }
                  // Server already set correct text — just ensure data-am is current and update visible text for current language
                  if (dbBtn3.text_am) eSpan3.setAttribute('data-am', dbBtn3.text_am);
                  if (dbBtn3.url) eBtn3.href = dbBtn3.url;
                  // Update visible text for current language without flash
                  var curLangText = eSpan3.getAttribute('data-' + lang);
                  if (curLangText && eSpan3.textContent !== curLangText) eSpan3.textContent = curLangText;
                } else {
                  needsUpdate = true;
                  break;
                }
              }
              if (!needsUpdate) {
                // Hide surplus HTML buttons if DB has fewer
                for (var hIdx3 = validDbBtns3.length; hIdx3 < existingBtns.length; hIdx3++) {
                  existingBtns[hIdx3].style.display = 'none';
                  existingBtns[hIdx3].setAttribute('data-db-hidden', 'true');
                }
                console.log('[DB] Buttons already server-injected in', sectionIdH, '- only AM/lang updated');
                return; // Skip full replacement — no flash
              }
              // If needsUpdate=true, fall through to full replacement below
            }
            
            // 4. If no CTA container exists at all AND no existing buttons AND no form buttons, CREATE one
            if (!ctaContainer && existingBtns.length === 0 && !hasFormButton) {
              var containerEl = section.querySelector('.container');
              if (containerEl) {
                ctaContainer = document.createElement('div');
                ctaContainer.className = 'section-cta';
                containerEl.appendChild(ctaContainer);
              }
            }
            
            var ctaIsEmpty = ctaContainer && ctaContainer.children.length === 0;
            
            if (existingBtns.length === 0 && ctaIsEmpty && !hasFormButton) {
              // Empty CTA area — safe to inject buttons
              var _injectedCount = 0;
              for (var bNew = 0; bNew < bf.buttons.length; bNew++) {
                var dbBtnNew = bf.buttons[bNew];
                if (!dbBtnNew.text_ru && !dbBtnNew.text_am) continue;
                var btnTextNew = lang === 'am' && dbBtnNew.text_am ? dbBtnNew.text_am : (dbBtnNew.text_ru || '');
                var btnIconNew = resolveIcon(dbBtnNew.icon, dbBtnNew.url);
                var newBtn = document.createElement('a');
                newBtn.href = dbBtnNew.url || '#';
                newBtn.className = 'btn btn-tg';
                if (dbBtnNew.action_type === 'whatsapp' || (dbBtnNew.url && dbBtnNew.url.indexOf('wa.me') >= 0)) {
                  newBtn.className = 'btn btn-primary';
                  newBtn.style.cssText = 'background:linear-gradient(135deg,#25D366,#128C7E);border:none';
                }
                newBtn.setAttribute('target', '_blank');
                // Mark button if icon was manually set by admin
                var _defs = ['fas fa-link','fas fa-arrow-right',''];
                if (dbBtnNew.icon && _defs.indexOf(dbBtnNew.icon) < 0) newBtn.setAttribute('data-icon-manual', '1');
                newBtn.innerHTML = '<i class="' + btnIconNew + '"></i> <span data-ru="' + (dbBtnNew.text_ru||'').replace(/"/g,'&quot;') + '" data-am="' + (dbBtnNew.text_am||'').replace(/"/g,'&quot;') + '">' + btnTextNew + '</span>';
                ctaContainer.appendChild(newBtn);
                _injectedCount++;
              }
              if (_injectedCount > 0) console.log('[DB] Injected', _injectedCount, 'buttons into section:', sectionIdH);
            } else if (existingBtns.length > 0) {
              // 4. UPDATE existing buttons with DB data (URL, text, icon) — NO new elements created
              var dbBtnIdx = 0;
              var validDbBtns = bf.buttons.filter(function(b2) { return b2.text_ru || b2.text_am; });
              for (var bIdx2 = 0; bIdx2 < validDbBtns.length && dbBtnIdx < existingBtns.length; bIdx2++) {
                var dbBtn2 = validDbBtns[bIdx2];
                var btnText2 = lang === 'am' && dbBtn2.text_am ? dbBtn2.text_am : (dbBtn2.text_ru || '');
                var btnIcon2 = resolveIcon(dbBtn2.icon, dbBtn2.url);
                var eBtn = existingBtns[dbBtnIdx];
                if (dbBtn2.url) eBtn.href = dbBtn2.url;
                eBtn.setAttribute('target', '_blank');
                // Mark button if icon was manually set by admin
                var _defs2 = ['fas fa-link','fas fa-arrow-right',''];
                if (dbBtn2.icon && _defs2.indexOf(dbBtn2.icon) < 0) eBtn.setAttribute('data-icon-manual', '1');
                else eBtn.removeAttribute('data-icon-manual');
                var eIcon = eBtn.querySelector('i');
                if (eIcon) eIcon.className = btnIcon2;
                var eSpan = eBtn.querySelector('span');
                if (eSpan) {
                  eSpan.textContent = btnText2;
                  eSpan.setAttribute('data-ru', dbBtn2.text_ru || '');
                  eSpan.setAttribute('data-am', dbBtn2.text_am || '');
                } else {
                  eBtn.innerHTML = '<i class="' + btnIcon2 + '"></i> <span data-ru="' + (dbBtn2.text_ru||'').replace(/"/g,'&quot;') + '" data-am="' + (dbBtn2.text_am||'').replace(/"/g,'&quot;') + '">' + btnText2 + '</span>';
                }
                dbBtnIdx++;
              }
              // Hide surplus HTML buttons that no longer exist in DB
              for (var hIdx = dbBtnIdx; hIdx < existingBtns.length; hIdx++) {
                existingBtns[hIdx].style.display = 'none';
                existingBtns[hIdx].setAttribute('data-db-hidden', 'true');
              }
              if (dbBtnIdx < existingBtns.length) {
                console.log('[DB] Hidden', (existingBtns.length - dbBtnIdx), 'surplus buttons in', sectionIdH);
              }
            }
            // If DB has 0 buttons but HTML has buttons — hide all HTML buttons
            if (bf.buttons.length === 0 && existingBtns.length > 0) {
              for (var hb = 0; hb < existingBtns.length; hb++) {
                existingBtns[hb].style.display = 'none';
                existingBtns[hb].setAttribute('data-db-hidden', 'true');
              }
              console.log('[DB] Hidden all', existingBtns.length, 'buttons in', sectionIdH, '(0 in DB)');
            }
          }
        }
      });
      console.log('[DB] Block features applied:', db.blockFeatures.length, 'blocks');
      
      // ===== APPLY CONTACT CARDS (update messenger links/icons in contact section) =====
      var contactBf = db.blockFeatures.find(function(b) { return b.key === 'contact'; });
      if (contactBf && contactBf.options && contactBf.options.contact_cards) {
        var ccCards = contactBf.options.contact_cards;
        var contactSection = document.getElementById('contact');
        if (contactSection && ccCards.length > 0) {
          var contactCardEls = contactSection.querySelectorAll('.contact-card');
          for (var cci = 0; cci < ccCards.length && cci < contactCardEls.length; cci++) {
            var ccData = ccCards[cci];
            var ccEl = contactCardEls[cci];
            // Update URL
            if (ccData.url) ccEl.setAttribute('href', ccData.url);
            // Determine icon: auto-detect from URL or use manual override
            var ccIcon = 'fab fa-telegram';
            if (ccData.icon && ccData.icon !== 'auto') {
              ccIcon = ccData.icon;
            } else if (ccData.url) {
              if (ccData.url.indexOf('wa.me') >= 0 || ccData.url.indexOf('whatsapp') >= 0) ccIcon = 'fab fa-whatsapp';
              else if (ccData.url.indexOf('viber') >= 0) ccIcon = 'fab fa-viber';
              else if (ccData.url.indexOf('instagram') >= 0) ccIcon = 'fab fa-instagram';
              else if (ccData.url.indexOf('t.me') >= 0 || ccData.url.indexOf('telegram') >= 0) ccIcon = 'fab fa-telegram';
              else if (ccData.url.indexOf('mailto:') >= 0) ccIcon = 'fas fa-envelope';
              else if (ccData.url.indexOf('tel:') >= 0) ccIcon = 'fas fa-phone';
            }
            // Update icon element
            var ccIconEl = ccEl.querySelector('i.fab, i.fas');
            if (ccIconEl) ccIconEl.className = ccIcon;
          }
          console.log('[DB] Contact cards updated:', ccCards.length, 'cards');
        }
      }

      // Also update footer contact links (Администратор / Менеджер) from same contact_cards data
      if (contactBf && contactBf.options && contactBf.options.contact_cards) {
        var footerContactLinks = document.querySelectorAll('footer a[href*="t.me/"], footer a[href*="wa.me/"]');
        var ccCards2 = contactBf.options.contact_cards;
        // Footer has Admin link first, Manager link second — match by order
        var footerAdminLink = null, footerManagerLink = null;
        for (var fli = 0; fli < footerContactLinks.length; fli++) {
          var flSpan = footerContactLinks[fli].querySelector('span[data-ru]');
          if (flSpan) {
            var flRu = flSpan.getAttribute('data-ru') || '';
            if (flRu.indexOf('Администратор') >= 0 || flRu.indexOf('Админ') >= 0) footerAdminLink = footerContactLinks[fli];
            else if (flRu.indexOf('Менеджер') >= 0) footerManagerLink = footerContactLinks[fli];
          }
        }
        if (footerAdminLink && ccCards2[0]) {
          footerAdminLink.setAttribute('href', ccCards2[0].url || footerAdminLink.getAttribute('href'));
          var fai = footerAdminLink.querySelector('i');
          if (fai && ccCards2[0].url) {
            var faIcon = 'fab fa-telegram';
            if (ccCards2[0].icon && ccCards2[0].icon !== 'auto') faIcon = ccCards2[0].icon;
            else if (ccCards2[0].url.indexOf('wa.me') >= 0) faIcon = 'fab fa-whatsapp';
            else if (ccCards2[0].url.indexOf('viber') >= 0) faIcon = 'fab fa-viber';
            fai.className = faIcon;
          }
        }
        if (footerManagerLink && ccCards2[1]) {
          footerManagerLink.setAttribute('href', ccCards2[1].url || footerManagerLink.getAttribute('href'));
          var fmi = footerManagerLink.querySelector('i');
          if (fmi && ccCards2[1].url) {
            var fmIcon = 'fab fa-telegram';
            if (ccCards2[1].icon && ccCards2[1].icon !== 'auto') fmIcon = ccCards2[1].icon;
            else if (ccCards2[1].url.indexOf('wa.me') >= 0) fmIcon = 'fab fa-whatsapp';
            else if (ccCards2[1].url.indexOf('viber') >= 0) fmIcon = 'fab fa-viber';
            fmi.className = fmIcon;
          }
        }
      }

      // ===== APPLY FLOATING BUTTONS (separate from main loop which skips floating_tg) =====
      var floatBf = db.blockFeatures.find(function(b) { return b.key === 'floating_tg'; });
      if (floatBf && floatBf.buttons && floatBf.buttons.length > 0) {
        var floatEl = document.querySelector('.tg-float');
        if (floatEl && floatBf.buttons[0]) {
          var fb = floatBf.buttons[0];
          if (fb.url) floatEl.setAttribute('href', fb.url);
          var fIcon = floatEl.querySelector('i');
          if (fIcon) fIcon.className = resolveIcon(fb.icon, fb.url);
          var fSpan = floatEl.querySelector('span');
          if (fSpan) {
            var fText = lang === 'am' && fb.text_am ? fb.text_am : (fb.text_ru || '');
            if (fText) { fSpan.textContent = fText; fSpan.setAttribute('data-ru', fb.text_ru || ''); fSpan.setAttribute('data-am', fb.text_am || ''); fSpan.setAttribute('data-no-rewrite', '1'); }
          }
          // Update messenger icon based on URL type
          if (typeof updateMessengerIcon === 'function') updateMessengerIcon(floatEl, fb.url);
        }
        // Also update nav CTA button (desktop + mobile) from same floating block button[0]
        if (floatBf.buttons[0]) {
          var fb0 = floatBf.buttons[0];
          // Desktop nav CTA
          var navCta = document.querySelector('.nav-cta');
          if (navCta) {
            if (fb0.url) navCta.setAttribute('href', fb0.url);
            var ncIcon = navCta.querySelector('i');
            if (ncIcon) ncIcon.className = resolveIcon(fb0.icon, fb0.url);
            var ncSpan = navCta.querySelector('span');
            if (ncSpan) {
              var ncText = lang === 'am' && fb0.text_am ? fb0.text_am : (fb0.text_ru || '');
              if (ncText) { ncSpan.textContent = ncText; ncSpan.setAttribute('data-ru', fb0.text_ru || ''); ncSpan.setAttribute('data-am', fb0.text_am || ''); ncSpan.setAttribute('data-no-rewrite', '1'); }
            }
            if (typeof updateMessengerIcon === 'function') updateMessengerIcon(navCta, fb0.url);
          }
          // Mobile nav CTA
          var mobCta = document.querySelector('.nav-mobile-cta a');
          if (mobCta) {
            if (fb0.url) mobCta.setAttribute('href', fb0.url);
            var mcIcon = mobCta.querySelector('i');
            if (mcIcon) mcIcon.className = resolveIcon(fb0.icon, fb0.url);
            var mcSpan = mobCta.querySelector('span');
            var mcText = lang === 'am' && fb0.text_am ? fb0.text_am : (fb0.text_ru || '');
            if (mcSpan) {
              if (mcText) { mcSpan.textContent = mcText; mcSpan.setAttribute('data-ru', fb0.text_ru || ''); mcSpan.setAttribute('data-am', fb0.text_am || ''); mcSpan.setAttribute('data-no-rewrite', '1'); }
            } else if (mcText) {
              // Fallback: update <a> directly if no <span>
              mobCta.setAttribute('data-ru', fb0.text_ru || ''); mobCta.setAttribute('data-am', fb0.text_am || '');
            }
            if (typeof updateMessengerIcon === 'function') updateMessengerIcon(mobCta, fb0.url);
          }
        }
        // Handle second floating button (calc)
        if (floatBf.buttons[1]) {
          var calcFloat = document.querySelector('.calc-float');
          if (calcFloat) {
            var cb = floatBf.buttons[1];
            if (cb.url) calcFloat.setAttribute('href', cb.url);
            var cIcon = calcFloat.querySelector('i');
            if (cIcon) cIcon.className = resolveIcon(cb.icon, cb.url);
            var cSpan = calcFloat.querySelector('span');
            if (cSpan) {
              var cText = lang === 'am' && cb.text_am ? cb.text_am : (cb.text_ru || '');
              if (cText) { cSpan.textContent = cText; cSpan.setAttribute('data-ru', cb.text_ru || ''); cSpan.setAttribute('data-am', cb.text_am || ''); cSpan.setAttribute('data-no-rewrite', '1'); }
            }
          }
        }
        console.log('[DB] Floating buttons applied from blockFeatures');
      }
      
      // ===== APPLY POPUP TEXTS & BUTTON (separate from main loop which skips popup) =====
      var popupBf = db.blockFeatures.find(function(b) { return b.key === 'popup' || b.block_type === 'popup'; });
      if (popupBf) {
        var popupCard = document.querySelector('.popup-card');
        if (popupCard) {
          // Map popup texts: [0]=heading, [1]=subtitle, [2]=label1, [3]=label2, [4]=label3, [5]=success title, [6]=success msg
          var pTextsRu = popupBf.texts_ru || [];
          var pTextsAm = popupBf.texts_am || [];
          
          // Update heading (h3)
          var pH3 = popupCard.querySelector('h3');
          if (pH3 && (pTextsRu[0] || pTextsAm[0])) {
            if (pTextsRu[0]) pH3.setAttribute('data-ru', pTextsRu[0]);
            if (pTextsAm[0]) pH3.setAttribute('data-am', pTextsAm[0]);
            var pHeadTxt = lang === 'am' && pTextsAm[0] ? pTextsAm[0] : (pTextsRu[0] || '');
            if (pHeadTxt) pH3.textContent = pHeadTxt;
          }
          
          // Update subtitle (.popup-sub)
          var pSub = popupCard.querySelector('.popup-sub');
          if (pSub && (pTextsRu[1] || pTextsAm[1])) {
            if (pTextsRu[1]) pSub.setAttribute('data-ru', pTextsRu[1]);
            if (pTextsAm[1]) pSub.setAttribute('data-am', pTextsAm[1]);
            var pSubTxt = lang === 'am' && pTextsAm[1] ? pTextsAm[1] : (pTextsRu[1] || '');
            if (pSubTxt) pSub.textContent = pSubTxt;
          }
          
          // Update form labels
          var pLabels = popupCard.querySelectorAll('.pf-label:not([data-no-rewrite])');
          for (var pli = 0; pli < pLabels.length && pli < 3; pli++) {
            var ruIdx = pli + 2; // texts[2], texts[3], texts[4]
            if (pTextsRu[ruIdx] || pTextsAm[ruIdx]) {
              if (pTextsRu[ruIdx]) pLabels[pli].setAttribute('data-ru', pTextsRu[ruIdx]);
              if (pTextsAm[ruIdx]) pLabels[pli].setAttribute('data-am', pTextsAm[ruIdx]);
              var plTxt = lang === 'am' && pTextsAm[ruIdx] ? pTextsAm[ruIdx] : (pTextsRu[ruIdx] || '');
              if (plTxt) pLabels[pli].textContent = plTxt;
            }
          }
          
          // Update success message
          var pSuccH4 = popupCard.querySelector('.popup-success h4');
          if (pSuccH4 && (pTextsRu[5] || pTextsAm[5])) {
            if (pTextsRu[5]) pSuccH4.setAttribute('data-ru', pTextsRu[5]);
            if (pTextsAm[5]) pSuccH4.setAttribute('data-am', pTextsAm[5]);
            var psHTxt = lang === 'am' && pTextsAm[5] ? pTextsAm[5] : (pTextsRu[5] || '');
            if (psHTxt) pSuccH4.textContent = psHTxt;
          }
          var pSuccP = popupCard.querySelector('.popup-success p');
          if (pSuccP && (pTextsRu[6] || pTextsAm[6])) {
            if (pTextsRu[6]) pSuccP.setAttribute('data-ru', pTextsRu[6]);
            if (pTextsAm[6]) pSuccP.setAttribute('data-am', pTextsAm[6]);
            var psPTxt = lang === 'am' && pTextsAm[6] ? pTextsAm[6] : (pTextsRu[6] || '');
            if (psPTxt) pSuccP.textContent = psPTxt;
          }
          
          // Update submit button from buttons array
          if (popupBf.buttons && popupBf.buttons[0]) {
            var pBtn = popupBf.buttons[0];
            var pSubmit = popupCard.querySelector('form button[type="submit"], form .btn');
            if (pSubmit) {
              var pBtnSpan = pSubmit.querySelector('span[data-ru], span');
              if (pBtnSpan) {
                if (pBtn.text_ru) pBtnSpan.setAttribute('data-ru', pBtn.text_ru);
                if (pBtn.text_am) pBtnSpan.setAttribute('data-am', pBtn.text_am);
                var pBtnTxt = lang === 'am' && pBtn.text_am ? pBtn.text_am : (pBtn.text_ru || '');
                if (pBtnTxt) pBtnSpan.textContent = pBtnTxt;
              }
              // Update icon
              var pBtnIcon = pSubmit.querySelector('i');
              if (pBtnIcon && pBtn.icon) pBtnIcon.className = resolveIcon(pBtn.icon, pBtn.url);
              // Update URL for popup form submission
              if (pBtn.url) window._tgPopupUrl = pBtn.url;
            }
          }
          
          console.log('[DB] Popup texts & button applied from blockFeatures');
        }
      }
      
      // ===== APPLY CALCULATOR BUTTONS (separate from main loop which skips calculator) =====
      var calcBf = db.blockFeatures.find(function(b) { return b.key === 'calculator' || b.block_type === 'calculator'; });
      var calcCtaWrap = document.querySelector('.calc-cta');
      if (calcBf && calcBf.buttons && calcBf.buttons.length > 0) {
        var calcSec = document.getElementById('calculator');
        if (calcSec) {
          var calcTgBtn = document.getElementById('calcTgBtn');
          if (calcTgBtn && calcBf.buttons[0]) {
            var cBtn = calcBf.buttons[0];
            if (cBtn.url) calcTgBtn.setAttribute('href', cBtn.url);
            var cSpn = calcTgBtn.querySelector('span[data-ru]');
            if (cSpn) {
              if (cBtn.text_ru) cSpn.setAttribute('data-ru', cBtn.text_ru);
              if (cBtn.text_am) cSpn.setAttribute('data-am', cBtn.text_am);
              var cTxt = lang === 'am' && cBtn.text_am ? cBtn.text_am : (cBtn.text_ru || '');
              if (cTxt) cSpn.textContent = cTxt;
            }
            var cIco = calcTgBtn.querySelector('i');
            if (cIco && cBtn.icon) cIco.className = resolveIcon(cBtn.icon, cBtn.url);
          }
          // Show the calc-cta wrapper (hidden by default)
          if (calcCtaWrap) calcCtaWrap.style.display = '';
          console.log('[DB] Calculator buttons applied:', calcBf.buttons.length);
        }
      } else {
        // No buttons in DB — keep calc-cta hidden
        if (calcCtaWrap) calcCtaWrap.style.display = 'none';
      }
      
      // ===== APPLY CALCULATOR TEXTS from blockFeatures =====
      if (calcBf && calcBf.texts_ru && calcBf.texts_ru.length > 2) {
        var calcSec2 = document.getElementById('calculator');
        if (calcSec2) {
          // texts[2] = description (section-sub), texts[3] = total label, texts[4] = promo label, texts[5] = apply button
          var calcTextMap = [
            null, null, // 0,1 handled by server textMap
            { sel: '.section-sub', attr: 'data-ru' },
            { sel: '.calc-total-label', attr: 'data-ru' },
            { sel: '#calcRefWrap label span', attr: 'data-ru' },
            { sel: '#calcRefWrap button span', attr: 'data-ru' }
          ];
          for (var cti = 2; cti < calcBf.texts_ru.length && cti < calcTextMap.length; cti++) {
            var cMap = calcTextMap[cti];
            if (!cMap) continue;
            var cEl = calcSec2.querySelector(cMap.sel);
            if (!cEl) continue;
            var cRu = calcBf.texts_ru[cti] || '';
            var cAm = (calcBf.texts_am && calcBf.texts_am[cti]) || '';
            if (cRu) cEl.setAttribute('data-ru', cRu);
            if (cAm) cEl.setAttribute('data-am', cAm);
            var cText2 = lang === 'am' && cAm ? cAm : (cRu || '');
            if (cText2) cEl.textContent = cText2;
          }
          console.log('[DB] Calculator texts applied from blockFeatures');
          
          // ===== APPLY PDF FORM TEXTS from blockFeatures (texts[6]-[9]) =====
          if (calcBf.texts_ru.length > 6 && typeof window._applyPdfTexts === 'function') {
            window._applyPdfTexts(calcBf.texts_ru, calcBf.texts_am, lang);
          }
        }
      }
      
      // ===== APPLY NAV LINKS from blockFeatures (nav block) =====
      var navBf = db.blockFeatures.find(function(b) { return b.key === 'nav'; });
      if (navBf && navBf.texts_ru && navBf.texts_ru.length > 0) {
        var navUl = document.getElementById('navLinks');
        if (navUl) {
          // Build nav_links map: idx -> target
          var navTargetMap = {};
          if (navBf.nav_links) {
            for (var nmi = 0; nmi < navBf.nav_links.length; nmi++) {
              navTargetMap[navBf.nav_links[nmi].idx] = navBf.nav_links[nmi].target || '';
            }
          }
          // Default section targets for original 7 items
          var defaultTargets = ['about', 'services', 'calculator', 'warehouse', 'guarantee', 'faq', 'contact'];
          
          // Count valid nav items from DB (skip CTA-type)
          var dbNavItems = [];
          for (var ni = 0; ni < navBf.texts_ru.length; ni++) {
            var ruText = navBf.texts_ru[ni] || '';
            var amText = (navBf.texts_am && navBf.texts_am[ni]) || '';
            if (!ruText && !amText) continue;
            var target = navTargetMap[ni] || (ni < defaultTargets.length ? defaultTargets[ni] : '');
            target = target.replace(/_/g, '-');
            if (target === '_telegram' || target === '_cta') continue;
            dbNavItems.push({ ru: ruText, am: amText, target: target });
          }
          
          var existingLis = navUl.querySelectorAll('li:not(.nav-mobile-cta)');
          
          // If count matches — just update in place (no flash)
          if (existingLis.length === dbNavItems.length) {
            for (var ui = 0; ui < dbNavItems.length; ui++) {
              var exA = existingLis[ui].querySelector('a');
              if (!exA) continue;
              var di = dbNavItems[ui];
              if (di.target) exA.setAttribute('href', '#' + di.target);
              exA.setAttribute('data-ru', di.ru);
              exA.setAttribute('data-am', di.am);
              var navTxt = lang === 'am' && di.am ? di.am : di.ru;
              if (navTxt && exA.textContent !== navTxt) exA.textContent = navTxt;
            }
          } else {
            // Count changed — rebuild nav items
            for (var rli = 0; rli < existingLis.length; rli++) {
              existingLis[rli].remove();
            }
            var ctaLi = navUl.querySelector('.nav-mobile-cta');
            
            for (var ci = 0; ci < dbNavItems.length; ci++) {
              var d = dbNavItems[ci];
              var li = document.createElement('li');
              var a = document.createElement('a');
              a.setAttribute('href', d.target ? '#' + d.target : '#');
              a.setAttribute('data-ru', d.ru);
              a.setAttribute('data-am', d.am);
              a.textContent = lang === 'am' && d.am ? d.am : d.ru;
              a.addEventListener('click', function(e) {
                var href = this.getAttribute('href');
                if (href && href.charAt(0) === '#' && href.length > 1) {
                  e.preventDefault();
                  var targetEl = document.getElementById(href.substring(1)) || document.querySelector('[data-section-id="' + href.substring(1) + '"]');
                  if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    var navMenu = document.getElementById('navLinks');
                    if (navMenu) navMenu.classList.remove('active');
                    var hamburger = document.getElementById('hamburger');
                    if (hamburger) hamburger.classList.remove('active');
                  }
                }
              });
              li.appendChild(a);
              if (ctaLi) navUl.insertBefore(li, ctaLi);
              else navUl.appendChild(li);
            }
          }
          console.log('[DB] Nav links applied:', dbNavItems.length, 'items');
          
          // ===== SYNC FOOTER NAVIGATION with header nav =====
          // Skip if server already injected footer nav (data-server-ordered="1")
          // Footer nav mirrors header nav dynamically — what you add in admin nav appears in footer
          if (!serverOrdered) {
          var footerNavList = document.getElementById('footerNavList');
          if (footerNavList && dbNavItems.length > 0) {
            var footerNavHtml = '';
            var footerNavCount = 0;
            for (var fni = 0; fni < dbNavItems.length; fni++) {
              var fnItem = dbNavItems[fni];
              // Skip items without section target (CTA buttons like _telegram, _cta)
              if (!fnItem.target || fnItem.target.charAt(0) === '_') continue;
              var fnText = lang === 'am' && fnItem.am ? fnItem.am : fnItem.ru;
              footerNavHtml += '<li><a href="#' + fnItem.target + '" data-ru="' + fnItem.ru.replace(/"/g,'&quot;') + '" data-am="' + (fnItem.am||'').replace(/"/g,'&quot;') + '" data-no-rewrite="1">' + fnText + '</a></li>';
              footerNavCount++;
            }
            footerNavList.innerHTML = footerNavHtml;
            // Add smooth scroll to footer nav links
            footerNavList.querySelectorAll('a[href^="#"]').forEach(function(a) {
              a.addEventListener('click', function(e) {
                e.preventDefault();
                var href = this.getAttribute('href');
                if (href && href.length > 1) {
                  var t = document.getElementById(href.substring(1)) || document.querySelector('[data-section-id="' + href.substring(1) + '"]');
                  if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              });
            });
            console.log('[DB] Footer nav synced with header:', footerNavCount, 'items');
          }
          } // end !serverOrdered check for footer nav
          
          // ===== SYNC BOTTOM NAVIGATION with header nav =====
          if (!serverOrdered) {
          var bottomNav = document.getElementById('bottomNav');
          if (bottomNav && dbNavItems.length > 0) {
            var bnIconMap = {
              'about': 'fas fa-info-circle', 'services': 'fas fa-hand-holding',
              'calculator': 'fas fa-calculator', 'warehouse': 'fas fa-warehouse',
              'guarantee': 'fas fa-shield-alt', 'faq': 'fas fa-question-circle',
              'contact': 'fas fa-envelope', 'client-reviews': 'fas fa-star',
              'fifty-vs-fifty': 'fas fa-person-circle-question', 'why-buyouts': 'fas fa-person-circle-question'
            };
            var bnMain = dbNavItems.slice(0, 4);
            var bnMore = dbNavItems.slice(4);
            var bnHtml = '<div class="bottom-nav-items">';
            for (var bni = 0; bni < bnMain.length; bni++) {
              var bnItem = bnMain[bni];
              var bnIcon = bnIconMap[bnItem.target] || 'fas fa-link';
              var bnText = lang === 'am' && bnItem.am ? bnItem.am : bnItem.ru;
              bnHtml += '<a href="#' + bnItem.target + '" class="bottom-nav-item"><i class="' + bnIcon + '"></i><span data-ru="' + bnItem.ru.replace(/"/g,'&quot;') + '" data-am="' + (bnItem.am||'').replace(/"/g,'&quot;') + '">' + bnText + '</span></a>';
            }
            if (bnMore.length > 0) {
              var bnMoreText = lang === 'am' ? '\u0531\u057E\u0565\u056C\u056B\u0576' : '\u0415\u0449\u0451';
              bnHtml += '<button class="bottom-nav-item bottom-nav-more" id="bottomNavMore" onclick="toggleBottomMore()"><i class="fas fa-ellipsis-h"></i><span data-ru="\u0415\u0449\u0451" data-am="\u0531\u057E\u0565\u056C\u056B\u0576">' + bnMoreText + '</span>';
              bnHtml += '<div class="bottom-nav-more-menu" id="bottomMoreMenu">';
              for (var bmi = 0; bmi < bnMore.length; bmi++) {
                var bmItem = bnMore[bmi];
                if (!bmItem.target || bmItem.target.charAt(0) === '_') continue;
                var bmIcon = bnIconMap[bmItem.target] || 'fas fa-link';
                var bmText = lang === 'am' && bmItem.am ? bmItem.am : bmItem.ru;
                bnHtml += '<a href="#' + bmItem.target + '"><i class="' + bmIcon + '"></i><span data-ru="' + bmItem.ru.replace(/"/g,'&quot;') + '" data-am="' + (bmItem.am||'').replace(/"/g,'&quot;') + '">' + bmText + '</span></a>';
              }
              bnHtml += '</div></button>';
            }
            bnHtml += '</div>';
            bottomNav.innerHTML = bnHtml;
            console.log('[DB] Bottom nav synced with header:', dbNavItems.length, 'items');
          }
          } // end !serverOrdered check for bottom nav
        }
      }
      
      // ===== APPLY TEXT STYLES (color/size) from blockFeatures to all sections =====
      // When server-injected, CSS styles are already in <style id="server-styles"> tag
      // Only apply client-side as fallback when NOT server-injected
      if (!serverInjected) {
      db.blockFeatures.forEach(function(bf) {
        var bfStyles = bf.text_styles;
        if (!bfStyles || bfStyles.length === 0) return;
        var sId = bf.key.replace(/_/g, '-');
        var sec = document.querySelector('[data-section-id="' + sId + '"]') || document.querySelector('#' + sId);
        if (!sec) return;
        // Collect all data-ru elements in order (they correspond to texts_ru indices)
        var ruEls = sec.querySelectorAll('[data-ru]');
        // Build ordered list matching text indices
        var textsRu = bf.texts_ru || [];
        for (var sti = 0; sti < textsRu.length; sti++) {
          var stDef = bfStyles[sti];
          if (!stDef || (!stDef.color && !stDef.size)) continue;
          var targetRu = (textsRu[sti] || '').trim();
          if (!targetRu) continue;
          // Find the matching DOM element by data-ru value
          for (var sei = 0; sei < ruEls.length; sei++) {
            var elRu = (ruEls[sei].getAttribute('data-ru') || '').trim();
            if (elRu === targetRu) {
              var targetEl = ruEls[sei].closest('h2, h3, p, li, span, div') || ruEls[sei];
              if (stDef.color) targetEl.style.color = stDef.color;
              if (stDef.size) targetEl.style.fontSize = stDef.size;
              break;
            }
          }
        }
      });
      console.log('[DB] Text styles applied (client-side fallback)');
      } else {
        console.log('[DB] Text styles already server-injected via CSS');
      }
    }
    
    // ===== APPLY ELEMENT ORDER (flex + CSS order within sections) =====
    // When server-injected, CSS order rules are already in <style id="server-styles"> tag
    // Only apply client-side as fallback when NOT server-injected
    if (db.blockFeatures && db.blockFeatures.length > 0) {
      if (!serverInjected) {
      // Map section IDs to their element selectors (direct flex children)
      var sectionElMap = {
        'hero': { title: '.hero-el-title', photo: '.hero-image', texts: '.hero-el-texts', stats: '.hero-el-stats', buttons: '.hero-el-buttons', socials: '.block-socials' },
        'about': { title: '.about-el-title', photo: '.about-img', texts: '.about-el-texts', stats: '.block-slot-counter', buttons: '.about-el-buttons', socials: '.block-socials' },
        'guarantee': { title: '.guarantee-el-title', photo: '.guarantee-el-photo', texts: '.guarantee-el-texts', stats: '.block-slot-counter', buttons: '.guarantee-el-buttons', socials: '.block-socials' }
      };
      
      var defaultTypeMap = {
        'photo': '.block-photo-gallery, img.section-photo, .wh-grid, .wh-item',
        'title': '.section-header, h2, h1',
        'stats': '.stats-grid, .block-slot-counter',
        'texts': 'p.section-sub, .why-block, .why-steps, .process-grid, .buyout-grid, .faq-list, .compare-box',
        'buttons': '.section-cta',
        'socials': '.block-socials'
      };
      
      db.blockFeatures.forEach(function(bf) {
        if (!bf.element_order || !Array.isArray(bf.element_order) || bf.element_order.length === 0) return;
        var sectionId = bf.key.replace(/_/g, '-');
        var section = document.querySelector('[data-section-id="' + sectionId + '"]');
        if (!section) return;
        
        var elMap = sectionElMap[sectionId];
        
        if (elMap) {
          // Known sections with specific element wrappers
          bf.element_order.forEach(function(elType, orderIdx) {
            var selector = elMap[elType];
            if (!selector) return;
            var el = section.querySelector(selector);
            if (el) el.style.order = String(orderIdx);
          });
        } else {
          // Generic sections
          var container = section.querySelector('.container') || section;
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          
          bf.element_order.forEach(function(elType, orderIdx) {
            var selString = defaultTypeMap[elType];
            if (!selString) return;
            try {
              container.querySelectorAll(selString).forEach(function(t) {
                t.style.order = String(orderIdx);
              });
            } catch(e) {}
          });
        }
        
        console.log('[DB] Element order applied for:', sectionId, bf.element_order);
      });
      console.log('[DB] Element order applied (client-side fallback)');
      } else {
        console.log('[DB] Element order already server-injected via CSS');
      }
    }
    
    // ===== APPLY PHOTO SETTINGS (client-side fallback when not server-injected) =====
    if (db.blockFeatures && db.blockFeatures.length > 0) {
      var photoSectionSelectors = {
        'hero': '.hero-image img',
        'about': '.about-img img',
        'guarantee': '.guarantee-el-photo img',
        'warehouse': '.wh-item img'
      };
      var photoContainerSelectors = {
        'hero': '.hero-image',
        'about': '.about-img',
        'guarantee': '.guarantee-el-photo'
      };
      db.blockFeatures.forEach(function(bf) {
        var ps = bf.photo_settings;
        if (!ps || typeof ps !== 'object') return;
        // Skip empty settings (no values set)
        if (!ps.max_height_mobile && !ps.max_height_desktop && !ps.object_fit && ps.border_radius == null && ps.full_width_mobile == null) return;
        var sid = bf.key.replace(/_/g, '-');
        var section = document.querySelector('[data-section-id="' + sid + '"]');
        if (!section) return;
        
        var imgSel = photoSectionSelectors[sid] || '.block-photo-gallery img';
        var imgs = section.querySelectorAll(imgSel);
        
        imgs.forEach(function(img) {
          if (ps.object_fit) img.style.objectFit = ps.object_fit;
          if (ps.border_radius != null) img.style.borderRadius = ps.border_radius + 'px';
          // Apply mobile or desktop max-height depending on screen
          var isMobile = window.innerWidth <= 768;
          if (isMobile && ps.max_height_mobile > 0) {
            img.style.maxHeight = ps.max_height_mobile + 'px';
            img.style.height = 'auto';
          } else if (!isMobile && ps.max_height_desktop > 0) {
            img.style.maxHeight = ps.max_height_desktop + 'px';
            img.style.height = 'auto';
          }
        });
        
        // Container border-radius + full width mobile
        var contSel = photoContainerSelectors[sid];
        if (contSel) {
          var cont = section.querySelector(contSel);
          if (cont) {
            if (ps.border_radius != null) {
              cont.style.borderRadius = ps.border_radius + 'px';
              cont.style.overflow = 'hidden';
            }
            // If full_width_mobile is disabled, remove negative margins
            var isMob = window.innerWidth <= 768;
            if (isMob && ps.full_width_mobile === false) {
              cont.style.margin = '0';
              cont.style.width = '100%';
            }
          }
        }
        
        console.log('[DB] Photo settings applied for:', sid, ps);
      });
    }
    
    // Clear reviews placeholder if no photos were injected — hide completely
    var reviewsPlaceholder = document.getElementById('reviewsCarouselArea');
    if (reviewsPlaceholder && !reviewsPlaceholder.querySelector('.rv-carousel') && !reviewsPlaceholder.querySelector('.reviews-carousel-wrap')) {
      reviewsPlaceholder.innerHTML = '';
      reviewsPlaceholder.style.display = 'none';
    }
    
    // ===== BUILD BLOCKFEATURES SET FIRST =====
    // IMPORTANT: Must be defined BEFORE the hide-deleted-sections block that uses it
    var _bfKeySet = {};
    var _bfLoaded = db.blockFeatures && db.blockFeatures.length > 0;
    if (_bfLoaded) {
      db.blockFeatures.forEach(function(b) {
        _bfKeySet[b.key] = true;
        _bfKeySet[b.key.replace(/_/g, '-')] = true;
        _bfKeySet[b.key.replace(/-/g, '_')] = true;
      });
    }
    
    // ===== HIDE SECTIONS DELETED IN ADMIN =====
    // If sectionOrder data exists, hide any sections not listed (they were deleted/removed in admin)
    if (db.sectionOrder && db.sectionOrder.length > 0) {
      var knownSections = {};
      db.sectionOrder.forEach(function(s) {
        var norm = (s.section_id || '').replace(/_/g, '-');
        knownSections[norm] = true;
        knownSections[s.section_id] = true;
        knownSections[s.section_id.replace(/-/g, '_')] = true;
      });
      // Also keep system sections
      knownSections['nav'] = true;
      knownSections['footer'] = true;
      knownSections['floating_tg'] = true;
      knownSections['floating-tg'] = true;
      knownSections['popup'] = true;
      // Keep dynamically created slot counters and photo blocks
      // Also add all blockFeature keys as known sections
      if (_bfLoaded) {
        db.blockFeatures.forEach(function(b) {
          var bk = b.key || '';
          knownSections[bk] = true;
          knownSections[bk.replace(/_/g, '-')] = true;
          knownSections[bk.replace(/-/g, '_')] = true;
        });
      }
      document.querySelectorAll('[data-section-id]').forEach(function(sec) {
        var sid = sec.getAttribute('data-section-id') || '';
        var sidNorm = sid.replace(/_/g, '-');
        if (sid.indexOf('slot-counter-') === 0 || sid.indexOf('photo-block-') === 0) return; // skip dynamic sections
        if (!knownSections[sid] && !knownSections[sidNorm] && sec.style.display !== 'none') {
          sec.style.display = 'none';
          console.log('[DB] Hidden deleted section:', sid);
        }
      });
    }
    
    // ===== REMOVE EMPTY GAP SECTIONS =====
    // _bfKeySet and _bfLoaded already defined above
    document.querySelectorAll('section[data-section-id], div.slot-counter-bar[data-section-id]').forEach(function(sec) {
      if (sec.style.display === 'none') return;
      var sid = sec.getAttribute('data-section-id') || '';
      var sidNorm = sid.replace(/_/g, '-');
      var sidAlt = sid.replace(/-/g, '_');
      // Skip system sections
      if (['nav','footer','floating-tg','floating_tg','popup'].indexOf(sidNorm) >= 0) return;
      if (sid.indexOf('slot-counter-') === 0 || sid.indexOf('slotCounter') === 0) return;
      
      // Check 1: Section exists in sectionOrder but NOT in blockFeatures → template/orphan
      // Only apply this check if blockFeatures actually loaded (otherwise keep everything visible)
      if (!_bfLoaded) return; // No blockFeatures data — skip orphan check entirely
      var inBF = _bfKeySet[sid] || _bfKeySet[sidNorm] || _bfKeySet[sidAlt];
      if (!inBF) {
        // Not in blockFeatures — hide it (it's an orphaned template section)
        sec.style.display = 'none';
        sec.style.setProperty('margin', '0', 'important');
        sec.style.setProperty('padding', '0', 'important');
        sec.style.setProperty('height', '0', 'important');
        sec.style.setProperty('overflow', 'hidden');
        sec.style.setProperty('min-height', '0', 'important');
        console.log('[DB] Hidden orphan section (no blockFeature):', sid);
        return;
      }
      
      // Check 2: Has only placeholder/template content
      var textContent = (sec.textContent || '').trim();
      var hasImages = sec.querySelector('img');
      var hasForm = sec.querySelector('form, input, select, textarea');
      var hasCards = sec.querySelector('.svc-card, .faq-item, .guarantee-card, .wh-grid, .process-grid, .calc-wrap, .contact-grid, .buyout-grid, .compare-box, .rv-carousel, .block-photo-gallery, .reviews-carousel-wrap, .block-socials, .block-slot-counter, .about-grid, .hero-grid, .compare-row, .wb-banner-card, .ticker-track, .stats-grid');
      var hasButtons = sec.querySelector('.section-cta a.btn, .section-cta a.btn-tg, a.btn-primary');
      var isPlaceholder = false;
      if (textContent) {
        var lc = textContent.toLowerCase();
        if (lc === 'новая секция' || lc === 'текст вашей секции' || 
            (lc.indexOf('новая секция') >= 0 && lc.indexOf('текст вашей секции') >= 0) ||
            (lc.indexOf('новая секция') >= 0 && lc.indexOf('описание вашего') >= 0) ||
            (lc.indexOf('новая секция') >= 0 && lc.indexOf('специальное предложение') >= 0) ||
            (lc.indexOf('новая секция') >= 0 && lc.indexOf('примеры наших работ') >= 0)) {
          isPlaceholder = true;
        }
      }
      if ((!textContent || isPlaceholder) && !hasImages && !hasForm && !hasCards && !hasButtons) {
        sec.style.display = 'none';
        sec.style.setProperty('margin', '0', 'important');
        sec.style.setProperty('padding', '0', 'important');
        sec.style.setProperty('height', '0', 'important');
        sec.style.setProperty('min-height', '0', 'important');
        console.log('[DB] Hidden empty/placeholder section:', sid);
      }
    });
    
    // ===== FINAL CLEANUP: Remove ALL elements between contact and footer =====
    // Only run aggressive cleanup if blockFeatures loaded successfully
    var _ft = document.querySelector('footer');
    if (_ft && _bfLoaded) {
      // AGGRESSIVE: Remove every hidden/empty sibling before footer
      var prev = _ft.previousElementSibling;
      while (prev) {
        var _prev2 = prev.previousElementSibling;
        var sid = prev.getAttribute('data-section-id') || prev.id || '';
        var isHidden = prev.style.display === 'none' || 
                       (prev.offsetHeight === 0 && prev.offsetWidth === 0);
        // Remove if hidden OR if it's a slot-counter placeholder
        if (isHidden || sid === 'slot-counter' || sid.indexOf('slotCounter') === 0) {
          prev.remove();
          console.log('[DB] Removed element before footer:', sid || prev.tagName);
          prev = _prev2;
          continue;
        }
        // Check if element is actually empty (no real content)
        var hasRealContent = (prev.textContent || '').trim().length > 5 || 
                             prev.querySelector('img, form, input, canvas, video');
        if (!hasRealContent) {
          prev.remove();
          console.log('[DB] Removed empty element before footer:', sid || prev.tagName);
          prev = _prev2;
          continue;
        }
        break; // Stop at first real visible element
      }
      // Set margin/padding on footer to 0 to prevent gap
      _ft.style.marginTop = '0';
      _ft.style.paddingTop = '48px';
    }
    
    // ===== STAGGERED SECTION REVEAL =====
    // When server-injected, sections are already visible via CSS – add classes instantly
    var allSections = document.querySelectorAll('section.section, div.wb-banner, div.stats-bar, div.slot-counter-bar, div.ticker');
    if (serverInjected) {
      allSections.forEach(function(sec) {
        sec.classList.add('section-revealed');
        sec.querySelectorAll('.fade-up:not(.visible)').forEach(function(el) { el.classList.add('visible'); });
      });
      var _footer = document.querySelector('footer.footer');
      if (_footer) { _footer.style.opacity = '1'; }
      // Re-observe counters after sections are revealed (IntersectionObserver may have missed them)
      setTimeout(function() {
        document.querySelectorAll('.stat-num[data-count]').forEach(function(el) { cObs.observe(el); });
        document.querySelectorAll('.stat-big[data-count-s]').forEach(function(el) { sObs.observe(el); });
        document.querySelectorAll('.fade-up:not(.visible)').forEach(function(el) { obs.observe(el); });
      }, 100);
    } else {
      // Reveal sections one by one with a cascade delay
      var revealDelay = 0;
      allSections.forEach(function(sec) {
        if (sec.style.display === 'none' || window.getComputedStyle(sec).display === 'none') return;
        revealDelay += 80;
        setTimeout(function() {
          sec.classList.add('section-revealed');
          // Re-observe fade-up children since section is now visible
          sec.querySelectorAll('.fade-up:not(.visible)').forEach(function(el) { obs.observe(el); });
        }, revealDelay);
      });
      // Reveal footer
      var _footer = document.querySelector('footer.footer');
      if (_footer) {
        setTimeout(function() { _footer.style.opacity = '1'; }, revealDelay + 80);
      }
    }
    
    console.log('[DB] All dynamic data applied v7 – loading overlay removed');
  } catch(e) {
    console.log('[DB] Error:', e.message || e);
    // Fallback: reveal all sections immediately if data loading fails
    document.querySelectorAll('section.section, div.wb-banner, div.stats-bar, div.slot-counter-bar, div.ticker').forEach(function(s) {
      s.classList.add('section-revealed');
    });

  }
})();

// Safety fallback: if sections still hidden after 8s (mobile / slow network), reveal everything
setTimeout(function() {
  document.querySelectorAll('section.section:not(.section-revealed), div.wb-banner:not(.section-revealed), div.stats-bar:not(.section-revealed), div.slot-counter-bar:not(.section-revealed), div.ticker:not(.section-revealed)').forEach(function(s) {
    s.classList.add('section-revealed');
  });
  // Also reveal footer if still hidden
  var _fallbackFooter = document.querySelector('footer.footer');
  if (_fallbackFooter && (!_fallbackFooter.style.opacity || _fallbackFooter.style.opacity === '0')) {
    _fallbackFooter.style.opacity = '1';
  }
}, 8000);

/* ===== REFERRAL CODE CHECK ===== */
var _refDiscount = 0;
var _refLinkedPackages = [];
var _refLinkedServices = [];
var _refApplyToPackages = 0;
async function checkRefCode() {
  var code = document.getElementById('refCodeInput').value.trim();
  var result = document.getElementById('refResult');
  if (!code) { result.style.display = 'none'; _refDiscount = 0; _refLinkedPackages = []; _refLinkedServices = []; _refApplyToPackages = 0; recalcDynamic(); return; }
  try {
    var res = await fetch('/api/referral/check', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({code:code}) });
    var data = await res.json();
    if (data.valid) {
      _refDiscount = data.discount_percent || 0;
      _refLinkedPackages = data.linked_packages || [];
      _refLinkedServices = data.linked_services || [];
      _refApplyToPackages = data.apply_to_packages || 0;
      
      // Check if promo applies to currently selected package
      var selectedPkg = getSelectedPackage();
      var pkgMismatch = false;
      if (selectedPkg && _refLinkedPackages.length > 0 && _refLinkedPackages.map(Number).indexOf(Number(selectedPkg.id)) === -1) {
        pkgMismatch = true;
      }
      
      if (pkgMismatch) {
        // Promo does not apply to selected package — show red error
        result.style.display = 'block';
        result.style.background = 'rgba(239,68,68,0.1)';
        result.style.border = '1px solid rgba(239,68,68,0.3)';
        result.style.color = 'var(--danger)';
        result.innerHTML = lang === 'am'
          ? '<i class="fas fa-times-circle" style="margin-right:6px"></i>\u054f\u057e\u0575\u0561\u056c \u057a\u0580\u0578\u0574\u0578\u056f\u0578\u0564\u0568 \u0579\u056b \u0576\u0565\u0580\u0561\u057c\u0578\u0582\u0574 \u057f\u057e\u0575\u0561\u056c \u0583\u0561\u0569\u0565\u0569\u0568\u0589'
          : '<i class="fas fa-times-circle" style="margin-right:6px"></i>\u042d\u0442\u043e\u0442 \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434 \u043d\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u043d\u0430 \u0434\u0430\u043d\u043d\u044b\u0439 \u043f\u0430\u043a\u0435\u0442';
        // Still allow discount on services if applicable
        recalcDynamic();
      } else {
        // Show activation — recalcDynamic() will update with live discount amount
        result.style.display = 'block';
        result.style.background = 'rgba(16,185,129,0.1)';
        result.style.border = '1px solid rgba(16,185,129,0.3)';
        result.style.color = 'var(--success)';
        var msg = lang === 'am' 
          ? '<i class="fas fa-check-circle" style="margin-right:6px;color:var(--success)"></i>\u054a\u0580\u0578\u0574\u0578\u056f\u0578\u0564\u0568 \u0561\u056f\u057f\u056b\u057e\u0561\u0581\u057e\u0561\u056e \u0567!'
          : '<i class="fas fa-check-circle" style="margin-right:6px;color:var(--success)"></i>\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434 \u0430\u043a\u0442\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u043d!';
        result.innerHTML = msg;
        recalcDynamic();
      }
    } else if (data.reason === 'limit_reached') {
      _refDiscount = 0; _refLinkedPackages = []; _refLinkedServices = []; _refApplyToPackages = 0;
      result.style.display = 'block';
      result.style.background = 'rgba(245,158,11,0.1)';
      result.style.border = '1px solid rgba(245,158,11,0.3)';
      result.style.color = '#F59E0B';
      var limitMsg = lang === 'am' ? (data.message_am || 'Limit reached') : (data.message_ru || '\u041b\u0438\u043c\u0438\u0442 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0439 \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u0430 \u0438\u0441\u0447\u0435\u0440\u043f\u0430\u043d');
      result.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>' + limitMsg;
      recalcDynamic();
    } else {
      _refDiscount = 0; _refLinkedPackages = []; _refLinkedServices = []; _refApplyToPackages = 0;
      result.style.display = 'block';
      result.style.background = 'rgba(239,68,68,0.1)';
      result.style.border = '1px solid rgba(239,68,68,0.3)';
      result.style.color = 'var(--danger)';
      result.innerHTML = lang === 'am' 
        ? '<i class="fas fa-times-circle" style="margin-right:6px"></i>\u054a\u0580\u0578\u0574\u0578\u056f\u0578\u0564\u0568 \u0579\u056b \u0563\u057f\u0576\u057e\u0565\u056c'
        : '<i class="fas fa-times-circle" style="margin-right:6px"></i>\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d';
      recalcDynamic();
    }
  } catch(e) {
    console.log('Ref check error:', e);
  }
}

/* ===== SLOT COUNTERS — now rendered via blockFeatures (block_type='slot_counter') ===== */
/* Old standalone fetch removed — counters are managed as site_blocks in admin */

/* ===== DYNAMIC FOOTER FROM DB ===== */
/* Footer is now server-side injected to prevent flash. Client-side only updates attributes for:
   - Language switching (data-ru/data-am on new elements)
   - Elements not covered by server injection (custom_html)
   This prevents the "old content -> new content" flash on page load. */
(function() {
  fetch('/api/footer').then(function(r){return r.json()}).then(function(f) {
    if (!f || (!f.contacts_json && !f.brand_text_ru && !f.copyright_ru)) return;
    var footer = document.querySelector('footer.footer');
    if (!footer) return;

    // Update brand text attributes (server already set the content, we only update for live changes)
    if (f.brand_text_ru) {
      var brandP = footer.querySelector('.footer-brand p');
      if (brandP) {
        var currentBrandRu = brandP.getAttribute('data-ru') || '';
        // Only update if brand text changed from what server injected
        if (currentBrandRu !== f.brand_text_ru) {
          brandP.setAttribute('data-ru', f.brand_text_ru);
          if (f.brand_text_am) brandP.setAttribute('data-am', f.brand_text_am);
          var brandAm = f.brand_text_am || brandP.getAttribute('data-am') || '';
          _setTextPreserveIcons(brandP, lang === 'am' && brandAm ? brandAm : f.brand_text_ru);
        }
      }
    }

    // Rebuild contacts — only if data changed from server-injected version
    var contacts = [];
    try { contacts = JSON.parse(f.contacts_json || '[]'); } catch(e) {}
    if (contacts.length > 0) {
      var contactCol = document.getElementById('footerContactCol');
      if (contactCol) {
        // Check if contacts differ from server-injected version
        var existingLinks = contactCol.querySelectorAll('ul li a');
        var needsRebuild = existingLinks.length !== contacts.length;
        if (!needsRebuild) {
          for (var ci = 0; ci < contacts.length; ci++) {
            var linkEl = existingLinks[ci];
            if (!linkEl || linkEl.getAttribute('href') !== (contacts[ci].url || '#')) {
              needsRebuild = true; break;
            }
            var nameSpan = linkEl.querySelector('span');
            if (nameSpan && nameSpan.getAttribute('data-ru') !== (contacts[ci].name_ru || '')) {
              needsRebuild = true; break;
            }
          }
        }
        if (needsRebuild) {
          // Preserve existing socials block before rebuilding contacts
          var existingSocials = contactCol.querySelector('.footer-socials-block');
          var socialsHtml = existingSocials ? existingSocials.outerHTML : '';
          var chtml = '<h4 data-ru="Контакты" data-am="Կոնտակտներ" data-no-rewrite="1">' + (lang==='am' ? 'Կոնտակտներ' : 'Контакты') + '</h4><ul>';
          for (var i = 0; i < contacts.length; i++) {
            var c = contacts[i];
            var nameAmAttr = c.name_am ? ' data-ru="' + (c.name_ru||'').replace(/"/g,'&quot;') + '" data-am="' + c.name_am.replace(/"/g,'&quot;') + '" data-no-rewrite="1"' : ' data-ru="' + (c.name_ru||'').replace(/"/g,'&quot;') + '" data-am="' + (c.name_ru||'').replace(/"/g,'&quot;') + '" data-no-rewrite="1"';
            chtml += '<li><a href="' + (c.url || '#') + '" target="_blank"><i class="' + (c.icon || 'fab fa-telegram') + '"></i> <span' + nameAmAttr + '>' + (lang === 'am' && c.name_am ? c.name_am : (c.name_ru || '')) + '</span></a></li>';
          }
          chtml += '</ul>' + socialsHtml;
          contactCol.innerHTML = chtml;
        }
      }
    }

    // Update copyright — only if changed
    if (f.copyright_ru) {
      var copySp = footer.querySelector('.footer-bottom > span:first-child');
      if (copySp) {
        var copyAm = f.copyright_am || '';
        var copySpan = copySp.querySelector('[data-ru]');
        if (copySpan) {
          // Just update attributes for language switching
          if (copyAm) copySp.querySelector('[data-am]') && copySpan.setAttribute('data-am', copyAm);
        }
      }
    }
    // Update location — only if changed
    if (f.location_ru) {
      var locSp = footer.querySelector('.footer-bottom > span:last-of-type');
      if (locSp) {
        var currentLocRu = locSp.getAttribute('data-ru') || '';
        if (currentLocRu !== f.location_ru) {
          var locAm = f.location_am || locSp.getAttribute('data-am') || '';
          locSp.setAttribute('data-ru', f.location_ru);
          if (f.location_am) locSp.setAttribute('data-am', f.location_am);
          _setTextPreserveIcons(locSp, lang === 'am' && locAm ? locAm : f.location_ru);
        }
      }
    }
    // Custom HTML
    if (f.custom_html) {
      var customDiv = footer.querySelector('.footer-custom');
      if (!customDiv) { customDiv = document.createElement('div'); customDiv.className = 'footer-custom'; footer.querySelector('.container').appendChild(customDiv); }
      customDiv.innerHTML = f.custom_html;
    }
    
    // Re-apply language to all footer elements (ensures AM text is shown when language is AM)
    if (lang === 'am') {
      footer.querySelectorAll('[data-am]').forEach(function(el) {
        var t = el.getAttribute('data-am');
        if (t && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') _setTextPreserveIcons(el, t);
      });
    }
  }).catch(function(){});
})();

/* ===== DYNAMIC PHOTO BLOCKS FROM DB (mobile-first) ===== */
(function() {
  fetch('/api/photo-blocks').then(function(r){return r.json()}).then(function(data) {
    var blocks = data.blocks || [];
    if (!blocks.length) return;

    /* --- inject CSS for review cards --- */
    var style = document.createElement('style');
    style.textContent = '.pb-carousel::-webkit-scrollbar{display:none}.pb-carousel{-ms-overflow-style:none;scrollbar-width:none}' +
      '.pb-card{transition:transform 0.3s,box-shadow 0.3s}.pb-card:hover{transform:translateY(-4px);box-shadow:0 8px 30px rgba(139,92,246,0.25)}' +
      '.pb-card img{transition:transform 0.4s}.pb-card:hover img{transform:scale(1.03)}' +
      '.pb-counter{width:8px;height:8px;border-radius:50%;transition:all 0.3s;cursor:pointer}' +
      '@media(max-width:900px){.pb-card-size{flex:0 0 85vw !important}.pb-title{font-size:1.3rem !important}}' +
      '@media(min-width:901px){.pb-card-size{flex:0 0 min(400px,80%) !important}}';
    document.head.appendChild(style);

    blocks.forEach(function(b) {
      var photos = [];
      try { photos = JSON.parse(b.photos_json || '[]'); } catch(e) { photos = []; }
      var validPhotos = photos.filter(function(p){ return p && p.url; });
      if (!validPhotos.length) return;

      var el = document.createElement('section');
      el.className = 'section fade-up';
      el.setAttribute('data-section-id', 'photo-block-' + b.id);

      var blockName = lang === 'am' && b.description_am ? b.description_am : (b.block_name || '');
      var desc = lang === 'am' && b.description_am ? b.description_am : (b.description_ru || '');
      var carId = 'pbCar_' + b.id;
      var isReviewStyle = validPhotos.length >= 3; /* carousel for 3+ photos */

      var html = '<div class="container" style="padding:0 16px">';

      /* Block title */
      if (blockName) {
        html += '<h2 class="pb-title" style="text-align:center;font-size:1.6rem;font-weight:800;margin-bottom:8px;background:linear-gradient(135deg,#8B5CF6,#F59E0B);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">' +
          '<i class="fas fa-star" style="margin-right:8px;-webkit-text-fill-color:#F59E0B"></i>' + blockName + '</h2>';
      }
      if (desc && desc !== blockName) {
        html += '<p style="text-align:center;color:var(--text-sec,#94a3b8);margin-bottom:20px;font-size:0.95rem;max-width:600px;margin-left:auto;margin-right:auto">' + desc + '</p>';
      }

      if (isReviewStyle) {
        /* ── Mobile-first horizontal swipe carousel ── */
        html += '<div style="position:relative;overflow:visible;padding:8px 0">';
        html += '<div id="' + carId + '" class="pb-carousel" style="display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;padding:4px 8px;-ms-overflow-style:none">';
        for (var i = 0; i < validPhotos.length; i++) {
          var p = validPhotos[i];
          html += '<div class="pb-card pb-card-size" data-lightbox-url="' + (p.url||'').replace(/"/g,'&quot;') + '" style="flex:0 0 340px;scroll-snap-align:start;border-radius:16px;overflow:hidden;border:1px solid var(--border,rgba(255,255,255,0.1));background:var(--bg-card,#1a1a2e);box-shadow:0 4px 20px rgba(0,0,0,0.2);cursor:pointer;display:flex;flex-direction:column">' +
            '<img src="' + p.url + '" alt="' + (p.caption||'') + '" style="width:100%;height:auto;object-fit:contain;flex-shrink:0" loading="eager">' +
            (p.caption ? '<div style="padding:10px 14px;font-size:0.85rem;color:var(--text-sec,#94a3b8)">' + p.caption + '</div>' : '') +
          '</div>';
        }
        html += '</div>';
        /* Nav arrows (desktop) */
        if (validPhotos.length > 1) {
          html += '<button onclick="document.getElementById(&apos;' + carId + '&apos;).scrollBy({left:-296,behavior:&apos;smooth&apos;})" style="position:absolute;left:4px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:rgba(139,92,246,0.85);color:#fff;border:none;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,0.3);z-index:2"><i class="fas fa-chevron-left"></i></button>';
          html += '<button onclick="document.getElementById(&apos;' + carId + '&apos;).scrollBy({left:296,behavior:&apos;smooth&apos;})" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:50%;background:rgba(139,92,246,0.85);color:#fff;border:none;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,0.3);z-index:2"><i class="fas fa-chevron-right"></i></button>';
          /* Dot counters */
          html += '<div id="' + carId + '_dots" style="display:flex;justify-content:center;gap:8px;margin-top:10px;margin-bottom:0">';
          for (var d = 0; d < validPhotos.length; d++) {
            html += '<div class="pb-counter" style="background:' + (d===0?'#8B5CF6':'rgba(139,92,246,0.3)') + '" onclick="document.getElementById(&apos;' + carId + '&apos;).children[' + d + '].scrollIntoView({behavior:&apos;smooth&apos;,inline:&apos;center&apos;,block:&apos;nearest&apos;})"></div>';
          }
          html += '</div>';
        }
        /* Photo counter badge */
        html += '<div style="text-align:center;margin-top:4px;margin-bottom:0;font-size:0.75rem;color:var(--text-sec,#64748b);opacity:0.7"><i class="fas fa-hand-pointer" style="margin-right:4px;font-size:0.7rem"></i>' + (lang==='am'?'Սահեցրեք դիտելու':'листайте') + '</div>';
        html += '</div>';
      } else {
        /* ── Grid for 1-2 photos ── */
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">';
        for (var gi = 0; gi < validPhotos.length; gi++) {
          var gp = validPhotos[gi];
          html += '<div class="pb-card" data-lightbox-url="' + (gp.url||'').replace(/"/g,'&quot;') + '" style="border-radius:var(--r,16px);overflow:hidden;border:1px solid var(--border,rgba(255,255,255,0.1));background:var(--bg-card,#1a1a2e);cursor:pointer">' +
            '<img src="' + gp.url + '" alt="' + (gp.caption||'') + '" style="width:100%;height:auto;object-fit:contain" loading="eager">' +
            (gp.caption ? '<div style="padding:10px 14px;font-size:0.85rem;color:var(--text-sec,#94a3b8)">' + gp.caption + '</div>' : '') +
          '</div>';
        }
        html += '</div>';
      }

      html += '</div>';
      el.innerHTML = html;

      /* Position insertion */
      var pos = b.position || 'after-services';
      var target = null;
      if (pos === 'after-hero') { target = document.getElementById('hero') || document.querySelector('.hero'); if (target) target.parentNode.insertBefore(el, target.nextSibling); }
      else if (pos === 'after-services') { target = document.getElementById('services'); if (target) target.parentNode.insertBefore(el, target.nextSibling); }
      else if (pos === 'before-calc') { target = document.getElementById('calculator'); if (target) target.parentNode.insertBefore(el, target); }
      else if (pos === 'after-about') { target = document.getElementById('about'); if (target) target.parentNode.insertBefore(el, target.nextSibling); }
      else if (pos === 'before-contact') { target = document.getElementById('contact'); if (target) target.parentNode.insertBefore(el, target); }
      else if (pos === 'after-guarantee') { target = document.getElementById('guarantee'); if (target) target.parentNode.insertBefore(el, target.nextSibling); }
      else { var ft = document.querySelector('footer'); if (ft) ft.parentNode.insertBefore(el, ft); }

      /* Active dot tracking via IntersectionObserver (after DOM insertion) */
      if (isReviewStyle && validPhotos.length > 1) {
        (function(cid) {
          setTimeout(function() {
            var c = document.getElementById(cid);
            if (!c) return;
            var dots = document.getElementById(cid + '_dots');
            if (!dots) return;
            var ds = dots.children;
            var obs = new IntersectionObserver(function(entries) {
              entries.forEach(function(e) {
                if (e.isIntersecting) {
                  var idx = Array.prototype.indexOf.call(c.children, e.target);
                  for (var j = 0; j < ds.length; j++) {
                    ds[j].style.background = j === idx ? '#8B5CF6' : 'rgba(139,92,246,0.3)';
                    ds[j].style.width = j === idx ? '24px' : '8px';
                  }
                }
              });
            }, { root: c, threshold: 0.6 });
            for (var k = 0; k < c.children.length; k++) { obs.observe(c.children[k]); }
          }, 100);
        })(carId);
      }
    });
  }).catch(function(){});
})();

/* ===== PDF DOWNLOAD — FORM + BUTTON ===== */
(function() {
  var calcSection = document.getElementById('calculator');
  if (!calcSection) return;
  var totalEl = document.getElementById('calcTotal');
  if (!totalEl) return;
  var totalWrap = totalEl.closest('.calc-total') || totalEl.parentElement;
  if (!totalWrap || !totalWrap.parentElement) return;

  // Create contact form + PDF button container
  var formDiv = document.createElement('div');
  formDiv.id = 'pdfFormWrap';
  formDiv.style.cssText = 'margin-top:20px;background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.2);border-radius:16px;padding:20px;';
  formDiv.innerHTML =
    '<div style="font-size:0.95rem;font-weight:700;margin-bottom:14px;color:var(--text)">' +
      '<i class="fas fa-file-pdf" style="color:#F59E0B;margin-right:8px"></i>' +
      '<span data-ru="Скачать расчёт (PDF)" data-am="Ներբեռնել հաշվարկ (PDF)">Скачать расчёт (PDF)</span>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px" class="pdf-form-row">' +
      '<input type="text" id="pdfClientName" placeholder="' + (lang==='am' ? 'Անուն *' : 'Имя *') + '" style="padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:0.9rem;outline:none;width:100%">' +
      '<input type="tel" id="pdfClientPhone" placeholder="' + (lang==='am' ? 'Հեռախոս *' : 'Телефон *') + '" style="padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:0.9rem;outline:none;width:100%">' +
    '</div>' +
    '<div id="pdfFormError" style="display:none;color:#EF4444;font-size:0.82rem;margin-bottom:8px;padding:6px 10px;background:rgba(239,68,68,0.1);border-radius:8px"></div>' +
    '<button type="button" id="pdfDownloadBtn" style="margin-top:4px;background:linear-gradient(135deg,#F59E0B,#D97706);color:white;border:none;padding:14px 28px;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;width:100%;justify-content:center;transition:all 0.3s">' +
      '<i class="fas fa-file-pdf"></i> <span data-ru="Скачать КП (PDF)" data-am="Ներբեռնել ԿԱ (PDF)">Скачать КП (PDF)</span>' +
    '</button>';

  totalWrap.parentElement.insertBefore(formDiv, totalWrap.nextSibling);

  // Register global callback for blockFeatures to update PDF form texts
  window._applyPdfTexts = function(textsRu, textsAm, curLang) {
    if (!textsRu) return;
    // texts[6] = PDF form header
    if (textsRu[6]) {
      var hs = formDiv.querySelector('div > span[data-ru]');
      if (hs) {
        hs.setAttribute('data-ru', textsRu[6]);
        if (textsAm && textsAm[6]) hs.setAttribute('data-am', textsAm[6]);
        hs.textContent = curLang === 'am' && textsAm && textsAm[6] ? textsAm[6] : textsRu[6];
      }
    }
    // texts[7] = Name placeholder
    if (textsRu[7]) {
      var ni = formDiv.querySelector('#pdfClientName');
      if (ni) ni.placeholder = (curLang === 'am' && textsAm && textsAm[7] ? textsAm[7] : textsRu[7]) + ' *';
    }
    // texts[8] = Phone placeholder
    if (textsRu[8]) {
      var pi = formDiv.querySelector('#pdfClientPhone');
      if (pi) pi.placeholder = (curLang === 'am' && textsAm && textsAm[8] ? textsAm[8] : textsRu[8]) + ' *';
    }
    // texts[9] = Download button label
    if (textsRu[9]) {
      var bs = formDiv.querySelector('#pdfDownloadBtn span[data-ru]');
      if (bs) {
        bs.setAttribute('data-ru', textsRu[9]);
        if (textsAm && textsAm[9]) bs.setAttribute('data-am', textsAm[9]);
        bs.textContent = curLang === 'am' && textsAm && textsAm[9] ? textsAm[9] : textsRu[9];
      }
    }
    console.log('[DB] PDF form texts applied from blockFeatures');
  };

  // Helper: get current PDF button label from DOM (accounts for blockFeatures updates)
  function _getPdfBtnLabel() {
    var sp = document.querySelector('#pdfDownloadBtn span[data-ru]');
    if (!sp) return lang==='am' ? '\u0546\u0565\u0580\u0562\u0565\u057c\u0576\u0565\u056c \u053f\u0531 (PDF)' : '\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u041a\u041f (PDF)';
    return sp.getAttribute('data-' + lang) || sp.textContent || sp.getAttribute('data-ru');
  }

  var pdfBtn = document.getElementById('pdfDownloadBtn');

  pdfBtn.addEventListener('click', function() {
    var nameInput = document.getElementById('pdfClientName');
    var phoneInput = document.getElementById('pdfClientPhone');
    var errDiv = document.getElementById('pdfFormError');
    var clientName = (nameInput.value || '').trim();
    var clientPhone = (phoneInput.value || '').trim();

    if (!clientName || !clientPhone) {
      errDiv.style.display = 'block';
      errDiv.textContent = lang === 'am' ? 'Լրացրեք անունը և հեռախոսը' : 'Укажите имя и телефон';
      if (!clientName) nameInput.style.borderColor = '#EF4444';
      if (!clientPhone) phoneInput.style.borderColor = '#EF4444';
      return;
    }
    errDiv.style.display = 'none';
    nameInput.style.borderColor = '';
    phoneInput.style.borderColor = '';

    var items = [];
    calcSection.querySelectorAll('.calc-row').forEach(function(row) {
      var qtyInput = row.querySelector('input[type="number"]');
      if (!qtyInput) return;
      var qty = parseInt(qtyInput.value) || 0;
      if (qty <= 0) return;
      var nameEl = row.querySelector('.calc-label');
      var name = nameEl ? nameEl.textContent.trim() : '';
      var nameRu = nameEl ? (nameEl.getAttribute('data-ru') || name) : name;
      var nameAm = nameEl ? (nameEl.getAttribute('data-am') || name) : name;
      var dp = row.getAttribute('data-price');
      var svcId = parseInt(row.getAttribute('data-svc-id') || '0') || 0;
      if (dp === 'buyout') {
        items.push({ name: name, name_ru: nameRu, name_am: nameAm, price: getBuyoutPrice(qty), qty: qty, subtotal: getBuyoutTotal(qty), service_id: svcId });
      } else if (dp === 'tiered') {
        try { var t = JSON.parse(row.getAttribute('data-tiers')); items.push({ name: name, name_ru: nameRu, name_am: nameAm, price: getTierPrice(t,qty), qty: qty, subtotal: getTierTotal(t,qty), service_id: svcId }); }
        catch(e) { var pe=row.querySelector('.calc-price'); var pp=pe?parseInt(pe.textContent.replace(/[^0-9]/g,''))||0:0; items.push({name:name,name_ru:nameRu,name_am:nameAm,price:pp,qty:qty,subtotal:pp*qty,service_id:svcId}); }
      } else {
        var p = parseInt(dp) || 0;
        items.push({ name: name, name_ru: nameRu, name_am: nameAm, price: p, qty: qty, subtotal: p * qty, service_id: svcId });
      }
    });

    if (!items.length && !getSelectedPackage()) {
      errDiv.style.display = 'block';
      errDiv.textContent = lang === 'am' ? 'Ընտրեք ծառայություններ կամ փաթեթ' : 'Выберите услуги или пакет';
      return;
    }

    var totalVal = totalEl.getAttribute('data-total') || totalEl.textContent.replace(/[^0-9]/g, '');
    var refCode = '';
    var refInput = document.getElementById('refCodeInput');
    if (refInput) refCode = refInput.value || '';
    
    // Get package data if selected
    var pkgData = null;
    var pkgAttr = totalEl.getAttribute('data-package');
    if (pkgAttr) { try { pkgData = JSON.parse(pkgAttr); } catch(e) {} }

    pdfBtn.disabled = true;
    pdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (lang === 'am' ? 'Սպասեք...' : 'Загрузка...');

    /* Open blank tab BEFORE async fetch — this is in a synchronous click handler context,
       so popup blockers won't block it. We'll redirect this tab to the PDF URL after fetch completes. */
    var pdfTab = window.open('about:blank', '_blank');

    fetch('/api/generate-pdf', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ items: items, total: parseInt(totalVal)||0, lang: lang, clientName: clientName, clientContact: clientPhone, referralCode: refCode, package: pkgData })
    }).then(function(r){ return r.json(); }).then(function(data) {
      pdfBtn.disabled = false;
      pdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> ' + _getPdfBtnLabel();
      var pdfUrl = (data && data.url) ? data.url : ((data && data.leadId) ? '/pdf/' + data.leadId : null);
      if (pdfUrl) {
        /* Redirect the pre-opened tab to PDF page — data on main site is preserved */
        if (pdfTab && !pdfTab.closed) {
          pdfTab.location.href = window.location.origin + pdfUrl;
        } else {
          /* Fallback: if popup was blocked, open in same tab */
          window.location.href = pdfUrl;
        }
      } else if (pdfTab && !pdfTab.closed) {
        pdfTab.close();
      }
    }).catch(function(e){
      console.error('PDF error:', e);
      pdfBtn.disabled = false;
      pdfBtn.innerHTML = '<i class="fas fa-file-pdf"></i> ' + _getPdfBtnLabel();
    });
  });

  if (lang === 'am') {
    formDiv.querySelectorAll('[data-am]').forEach(function(el) { _setTextPreserveIcons(el, el.getAttribute('data-am')); });
  }
  var _s = document.createElement('style');
  _s.textContent = '@media(max-width:640px){.pdf-form-row{grid-template-columns:1fr!important}}';
  document.head.appendChild(_s);
})();

/* ===== PAGE VIEW TRACKING ===== */
(function() {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        page: window.location.pathname,
        referrer: document.referrer || '',
        ua: navigator.userAgent ? navigator.userAgent.substring(0, 200) : '',
        lang: lang || 'ru'
      })
    }).catch(function(){});
  } catch(e) {}
})();
</script>

<!-- Bottom Navigation Bar (mobile) -->
<nav class="bottom-nav" id="bottomNav">
<div class="bottom-nav-items">
  <a href="#about" class="bottom-nav-item" data-nav-idx="0"><i class="fas fa-info-circle"></i><span data-ru="\u041E \u043D\u0430\u0441" data-am="\u0544\u0565\u0580 \u0574\u0561\u057D\u056B\u0576">\u041E \u043D\u0430\u0441</span></a>
  <a href="#services" class="bottom-nav-item" data-nav-idx="1"><i class="fas fa-hand-holding"></i><span data-ru="\u0423\u0441\u043B\u0443\u0433\u0438" data-am="\u053E\u0561\u057C\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0576\u0565\u0580">\u0423\u0441\u043B\u0443\u0433\u0438</span></a>
  <a href="#calculator" class="bottom-nav-item" data-nav-idx="2"><i class="fas fa-calculator"></i><span data-ru="\u041A\u0430\u043B\u044C\u043A\u0443\u043B\u044F\u0442\u043E\u0440" data-am="\u0540\u0561\u0577\u057E\u056B\u0579">\u041A\u0430\u043B\u044C\u043A\u0443\u043B\u044F\u0442\u043E\u0440</span></a>
  <a href="#guarantee" class="bottom-nav-item" data-nav-idx="3"><i class="fas fa-shield-alt"></i><span data-ru="\u0413\u0430\u0440\u0430\u043D\u0442\u0438\u0438" data-am="\u0535\u0580\u0561\u0577\u056D\u056B\u0584\u0576\u0565\u0580">\u0413\u0430\u0440\u0430\u043D\u0442\u0438\u0438</span></a>
  <button class="bottom-nav-item bottom-nav-more" id="bottomNavMore" onclick="toggleBottomMore()"><i class="fas fa-ellipsis-h"></i><span data-ru="\u0415\u0449\u0451" data-am="\u0531\u057E\u0565\u056C\u056B\u0576">\u0415\u0449\u0451</span>
    <div class="bottom-nav-more-menu" id="bottomMoreMenu">
      <a href="#warehouse"><i class="fas fa-warehouse"></i><span data-ru="\u0421\u043A\u043B\u0430\u0434" data-am="\u054A\u0561\u0570\u0565\u057D\u057F">\u0421\u043A\u043B\u0430\u0434</span></a>
      <a href="#faq"><i class="fas fa-question-circle"></i><span data-ru="FAQ" data-am="\u0540\u054F\u0540">FAQ</span></a>
      <a href="#contact"><i class="fas fa-envelope"></i><span data-ru="\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B" data-am="\u053F\u0578\u0576\u057F\u0561\u056F\u057F\u0576\u0565\u0580">\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B</span></a>
    </div>
  </button>
</div>
</nav>

</body>
</html>`;
  
  // ===== SERVER-SIDE TEXT INJECTION using HTMLRewriter =====
  // HTMLRewriter is Cloudflare's built-in streaming HTML parser/transformer.
  // Strategy: Use textMap (origRu -> {ru, am}) to match elements by their data-ru attribute.
  // HTMLRewriter reads original attribute values before any modifications, so no cascade conflicts.
  // Each element is processed independently — changing data-ru="A" to "B" won't affect
  // another element that originally had data-ru="B".
  
  // Photo injection (simple string replace - no conflicts)
  if (photoMap['hero']) {
    pageHtml = pageHtml.replace('/static/img/founder.jpg', photoMap['hero']);
  }
  if (photoMap['about']) {
    pageHtml = pageHtml.replace('/static/img/about-hero2.jpg', photoMap['about']);
  }
  if (photoMap['guarantee']) {
    pageHtml = pageHtml.replace('/static/img/team-office.jpg', photoMap['guarantee']);
  }
  
  // Mark as server-injected and apply text replacements if we have changes
  const hasTextChanges = Object.keys(textMap).length > 0;
  const hasButtonChanges = Object.keys(buttonMap).length > 0;
  const hasAnyServerChanges = hasTextChanges || hasButtonChanges || Object.keys(styleMap).length > 0 || Object.keys(orderMap).length > 0 || Object.keys(photoSettingsMap).length > 0;
  if (hasAnyServerChanges) {
    pageHtml = pageHtml.replace('<html lang="ru">', '<html lang="ru" class="server-injected">');
  }
  
  // ===== SERVER-SIDE BUTTON INJECTION =====
  // Replace button texts/URLs/icons in HTML with data from admin panel (blockFeatures.buttons)
  // This prevents the flash of old button text on page load
  if (hasButtonChanges) {
    // Use HTMLRewriter to track sections and replace buttons
    const btnResponse = new Response(pageHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
    
    let currentSection = '';
    let btnCounters: Record<string, number> = {};
    // Track depth: when we enter a section, depth=1. Nested sections increase depth.
    // When we leave, depth decreases. Buttons only replaced at depth >= 1.
    let sectionDepth = 0;
    
    const btnRewritten = new HTMLRewriter()
      // Track which section we're in
      .on('[data-section-id]', {
        element(el) {
          const sectionId = el.getAttribute('data-section-id') || '';
          currentSection = sectionId.replace(/-/g, '_');
          btnCounters[currentSection] = 0;
          sectionDepth++;
          // Use onEndTag to know when we leave this section
          el.onEndTag(() => {
            sectionDepth--;
            if (sectionDepth <= 0) {
              currentSection = '';
              sectionDepth = 0;
            }
          });
        }
      })
      // Process anchor buttons inside sections (class="btn" catches all button styles)
      .on('a.btn', {
        element(el) {
          if (!currentSection || sectionDepth <= 0) return;
          
          // Skip buttons that are internal links (like #calculator)
          const href = el.getAttribute('href') || '';
          
          // Get buttons for this section
          const sectionBtns = buttonMap[currentSection];
          if (!sectionBtns || sectionBtns.length === 0) return;
          
          const btnIdx = btnCounters[currentSection] || 0;
          btnCounters[currentSection] = btnIdx + 1;
          
          if (btnIdx >= sectionBtns.length) return;
          
          const dbBtn = sectionBtns[btnIdx];
          if (!dbBtn || (!dbBtn.text_ru && !dbBtn.text_am)) return;
          
          // Update URL
          if (dbBtn.url) {
            el.setAttribute('href', dbBtn.url);
          }
          // Set target
          el.setAttribute('target', '_blank');
          
          // Determine icon class — DB value is PRIORITY, URL auto-detect only for defaults
          let iconClass = dbBtn.icon || '';
          const defaultIcons = ['fas fa-link', 'fas fa-arrow-right', ''];
          const isDefaultIcon = defaultIcons.includes(iconClass);
          
          // Only auto-detect from URL if icon is default/empty
          if (isDefaultIcon && dbBtn.url) {
            if (dbBtn.url.includes('wa.me') || dbBtn.url.includes('whatsapp')) {
              iconClass = 'fab fa-whatsapp';
            } else if (dbBtn.url.includes('t.me') || dbBtn.url.includes('telegram')) {
              iconClass = 'fab fa-telegram';
            } else if (dbBtn.url.includes('instagram.com')) {
              iconClass = 'fab fa-instagram';
            } else if (dbBtn.url.includes('#calc')) {
              iconClass = 'fas fa-calculator';
            }
          }
          if (!iconClass) iconClass = 'fas fa-link';
          
          // Mark button if icon was manually set (prevents updateMessengerIcon override)
          if (!isDefaultIcon && dbBtn.icon) {
            el.setAttribute('data-icon-manual', '1');
          }
          
          // Replace inner content with new icon + span
          const textRu = (dbBtn.text_ru || '').replace(/"/g, '&quot;');
          const textAm = (dbBtn.text_am || '').replace(/"/g, '&quot;');
          el.setInnerContent(
            `<i class="${iconClass}"></i> <span data-ru="${textRu}" data-am="${textAm}">${dbBtn.text_ru || ''}</span>`,
            { html: true }
          );
        }
      })
      .transform(btnResponse);
    
    pageHtml = await btnRewritten.text();
  }
  
  // ===== SERVER-SIDE CALC-CTA VISIBILITY =====
  // Show .calc-cta if calculator has buttons in DB, otherwise keep hidden
  if (buttonMap['calculator'] && buttonMap['calculator'].length > 0) {
    pageHtml = pageHtml.replace(
      '<div class="calc-cta" style="display:none">',
      '<div class="calc-cta">'
    );
  }
  
  // ===== SERVER-SIDE CSS INJECTION for text_styles + element_order =====
  // Generate a <style> block with text colors/sizes and mobile element ordering
  // This prevents the "flash of unstyled content" (FOUC) for colors and element order
  const hasStyleChanges = Object.keys(styleMap).length > 0;
  const hasOrderChanges = Object.keys(orderMap).length > 0;
  
  if (hasStyleChanges || hasOrderChanges) {
    let cssRules: string[] = [];
    
    // 1. Text styles (color, size) — target elements by data-ru attribute value
    if (hasStyleChanges) {
      for (const [blockKey, data] of Object.entries(styleMap)) {
        const sectionId = blockKey.replace(/_/g, '-');
        for (let i = 0; i < data.styles.length; i++) {
          const st = data.styles[i];
          if (!st || (!st.color && !st.size)) continue;
          const textRu = (data.texts_ru[i] || '').trim();
          if (!textRu) continue;
          // CSS attribute selector — escape special chars for CSS
          const escapedRu = textRu.replace(/\\/g, '\\\\\\\\').replace(/"/g, '\\\\"').replace(/\n/g, '\\\\a ');
          const props: string[] = [];
          if (st.color) props.push(`color:${st.color}!important`);
          if (st.size) props.push(`font-size:${st.size}!important`);
          cssRules.push(`[data-section-id="${sectionId}"] [data-ru="${escapedRu}"]{${props.join(';')}}`);
        }
      }
    }
    
    // 2. Element order — generate CSS for mobile layout ordering
    // Each element type (title, photo, texts, stats, buttons, socials) maps to a specific
    // CSS class that is a DIRECT child of the flex container on mobile.
    if (hasOrderChanges) {
      let orderCss: string[] = [];
      
      // Map element types to CSS selectors per section
      const sectionElementMap: Record<string, Record<string, string>> = {
        'hero': {
          'title': '.hero-el-title',
          'photo': '.hero-image',
          'texts': '.hero-el-texts',
          'stats': '.hero-el-stats',
          'buttons': '.hero-el-buttons',
          'socials': '.block-socials'
        },
        'about': {
          'title': '.about-el-title',
          'photo': '.about-img',
          'texts': '.about-el-texts',
          'stats': '.block-slot-counter',
          'buttons': '.about-el-buttons',
          'socials': '.block-socials'
        },
        'guarantee': {
          'title': '.guarantee-el-title',
          'photo': '.guarantee-el-photo',
          'texts': '.guarantee-el-texts',
          'stats': '.block-slot-counter',
          'buttons': '.guarantee-el-buttons',
          'socials': '.block-socials'
        }
      };
      
      // Default selector map for generic sections
      const defaultElementMap: Record<string, string[]> = {
        'photo': ['.block-photo-gallery', 'img.section-photo', '.wh-grid', '.wh-item'],
        'title': ['.section-header', 'h2', 'h1'],
        'stats': ['.stats-grid', '.block-slot-counter'],
        'texts': ['p.section-sub', '.why-block', '.why-steps', '.process-grid', '.buyout-grid', '.faq-list', '.compare-box'],
        'buttons': ['.section-cta'],
        'socials': ['.block-socials']
      };
      
      for (const [blockKey, order] of Object.entries(orderMap)) {
        const sectionId = blockKey.replace(/_/g, '-');
        const elMap = sectionElementMap[sectionId];
        
        if (elMap) {
          // Known sections with specific element wrappers — each element is a direct flex child
          order.forEach((elType: string, idx: number) => {
            const selector = elMap[elType];
            if (!selector) return;
            orderCss.push(`[data-section-id="${sectionId}"] ${selector}{order:${idx}!important}`);
          });
          
          // Also override grid-template-areas on desktop based on element_order
          // This lets photo appear in a different column position on desktop too
          if (sectionId === 'hero') {
            const areas = order.filter((t: string) => t !== 'photo').map((t: string) => `"${t} photo"`).join(' ');
            orderCss.push(`[data-section-id="hero"] .hero-grid{grid-template-areas:${areas}}`);
          } else if (sectionId === 'about') {
            const areas = order.filter((t: string) => t !== 'photo').map((t: string) => `"photo ${t}"`).join(' ');
            orderCss.push(`[data-section-id="about"] .about-grid{grid-template-areas:${areas}}`);
          } else if (sectionId === 'guarantee') {
            const areas = order.filter((t: string) => t !== 'photo').map((t: string) => `"photo ${t}"`).join(' ');
            orderCss.push(`[data-section-id="guarantee"] .guarantee-card{grid-template-areas:${areas}}`);
          }
        } else {
          // Generic sections: apply order to matching selectors
          order.forEach((elType: string, idx: number) => {
            const selectors = defaultElementMap[elType];
            if (!selectors) return;
            selectors.forEach(sel => {
              orderCss.push(`[data-section-id="${sectionId}"] ${sel}{order:${idx}!important}`);
            });
          });
          
          // Ensure container is flex column for ordering to work
          orderCss.push(`[data-section-id="${sectionId}"] .container{display:flex!important;flex-direction:column}`);
        }
      }
      
      if (orderCss.length > 0) {
        // Separate desktop CSS (grid-template-areas) from mobile CSS (order)
        const desktopCss: string[] = [];
        const mobileCss: string[] = [];
        
        for (const rule of orderCss) {
          if (rule.includes('grid-template-areas')) {
            desktopCss.push(rule);
          } else {
            mobileCss.push(rule);
          }
        }
        
        // Desktop: grid-template-areas apply on all screen sizes
        if (desktopCss.length > 0) {
          cssRules.push(desktopCss.join(''));
        }
        // Mobile: order property only applies when flex-column is active
        if (mobileCss.length > 0) {
          cssRules.push(`@media(max-width:768px){${mobileCss.join('')}}`);
        }
      }
    }
    
    // 3. Photo settings — generate CSS for photo display customization
    const hasPhotoSettings = Object.keys(photoSettingsMap).length > 0;
    if (hasPhotoSettings) {
      // Known section photo selectors
      const photoSelectors: Record<string, string[]> = {
        'hero': ['.hero-image img'],
        'about': ['.about-img img', '.about-img'],
        'guarantee': ['.guarantee-el-photo img', '.guarantee-card > img'],
        'warehouse': ['.wh-item img'],
      };
      
      for (const [blockKey, ps] of Object.entries(photoSettingsMap)) {
        const sectionId = blockKey.replace(/_/g, '-');
        const selectors = photoSelectors[sectionId] || ['.block-photo-gallery img', 'img.section-photo'];
        const imgSel = selectors[0]; // primary img selector
        const containerSel = selectors.length > 1 ? selectors[1] : null;
        
        let desktopPhotoRules: string[] = [];
        let mobilePhotoRules: string[] = [];
        
        // Desktop max-height
        if (ps.max_height_desktop && ps.max_height_desktop > 0) {
          desktopPhotoRules.push(`[data-section-id="${sectionId}"] ${imgSel}{max-height:${ps.max_height_desktop}px!important;height:auto!important}`);
        }
        
        // Object-fit (applies everywhere)
        if (ps.object_fit && ps.object_fit !== 'cover') {
          desktopPhotoRules.push(`[data-section-id="${sectionId}"] ${imgSel}{object-fit:${ps.object_fit}!important}`);
        }
        
        // Border radius
        if (ps.border_radius != null && ps.border_radius !== 12) {
          desktopPhotoRules.push(`[data-section-id="${sectionId}"] ${imgSel}{border-radius:${ps.border_radius}px!important}`);
          if (containerSel) {
            desktopPhotoRules.push(`[data-section-id="${sectionId}"] ${containerSel}{border-radius:${ps.border_radius}px!important;overflow:hidden}`);
          }
        }
        
        // Mobile max-height
        if (ps.max_height_mobile && ps.max_height_mobile > 0) {
          mobilePhotoRules.push(`[data-section-id="${sectionId}"] ${imgSel}{max-height:${ps.max_height_mobile}px!important;height:auto!important}`);
        }
        
        // Full width mobile
        if (ps.full_width_mobile === false) {
          mobilePhotoRules.push(`[data-section-id="${sectionId}"] .hero-image,[data-section-id="${sectionId}"] .about-img,[data-section-id="${sectionId}"] .guarantee-el-photo,[data-section-id="${sectionId}"] .block-photo-gallery{margin:0!important;width:100%!important}`);
        }
        
        if (desktopPhotoRules.length > 0) {
          cssRules.push(desktopPhotoRules.join(''));
        }
        if (mobilePhotoRules.length > 0) {
          cssRules.push(`@media(max-width:768px){${mobilePhotoRules.join('')}}`);
        }
      }
    }
    
    if (cssRules.length > 0) {
      const styleTag = `<style id="server-styles">${cssRules.join('')}</style></head>`;
      pageHtml = pageHtml.replace('</head>', styleTag);
    }
  }
  
  // ===== SERVER-SIDE PACKAGE RENDERING (instant display) =====
  try {
    const ssrPkgs = (globalThis as any).__ssrPackages || [];
    if (ssrPkgs.length > 0) {
      const ssrPkgSets = (globalThis as any).__ssrPkgSettings || {};
      const titleRu = ssrPkgSets.packages_title_ru || '\u0413\u043e\u0442\u043e\u0432\u044b\u0435 \u043f\u0430\u043a\u0435\u0442\u044b';
      const titleAm = ssrPkgSets.packages_title_am || '\u054a\u0561\u057f\u0580\u0561\u057d\u057f \u0583\u0561\u0569\u0565\u0569\u0576\u0565\u0580';
      const subRu = ssrPkgSets.packages_subtitle_ru || '';
      const subAm = ssrPkgSets.packages_subtitle_am || '';
      const isSingle = ssrPkgs.length === 1;
      const esc = (s: string) => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const fmtN = (n: number) => Number(n).toLocaleString('ru-RU');
      let pkgHtml = '<div class="calc-packages-header">';
      pkgHtml += '<div class="calc-packages-title"><i class="fas fa-box-open" style="color:#f59e0b"></i> <span data-ru="' + esc(titleRu) + '" data-am="' + esc(titleAm) + '">' + esc(isArmenian ? titleAm : titleRu) + '</span></div>';
      if (subRu) {
        pkgHtml += '<div class="calc-packages-subtitle" data-ru="' + esc(subRu) + '" data-am="' + esc(subAm) + '">' + esc(isArmenian ? (subAm || subRu) : subRu) + '</div>';
      }
      pkgHtml += '</div>';
      pkgHtml += '<div class="calc-packages-grid' + (isSingle ? ' single-pkg' : '') + '">';
      // Sort: cheaper packages left, gold center, expensive right
      let goldSsrPkg: any = null;
      const otherSsrPkgs: any[] = [];
      for (const p of ssrPkgs) {
        const tier = p.crown_tier || (p.is_popular ? 'gold' : '');
        if (tier === 'gold' && !goldSsrPkg) { goldSsrPkg = p; }
        else { otherSsrPkgs.push(p); }
      }
      otherSsrPkgs.sort((a: any, b: any) => (a.package_price || 0) - (b.package_price || 0));
      let sortedSsrPkgs: any[];
      if (goldSsrPkg) {
        const leftSsr = otherSsrPkgs.slice(0, Math.ceil(otherSsrPkgs.length / 2));
        const rightSsr = otherSsrPkgs.slice(Math.ceil(otherSsrPkgs.length / 2));
        sortedSsrPkgs = [...leftSsr, goldSsrPkg, ...rightSsr];
      } else {
        sortedSsrPkgs = otherSsrPkgs;
      }
      for (const pk of sortedSsrPkgs) {
        const disc = pk.original_price > 0 ? Math.round((1 - pk.package_price / pk.original_price) * 100) : 0;
        const ssrCrown = pk.crown_tier || (pk.is_popular ? 'gold' : '');
        pkgHtml += '<div class="calc-pkg-card' + (ssrCrown ? ' pkg-crown-' + ssrCrown : '') + '" data-pkg-id="' + pk.id + '">';
        // Badge instead of crown
        const badgeRu = pk.badge_ru || (ssrCrown === 'gold' ? '\u041b\u0443\u0447\u0448\u0435\u0435 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0435' : '');
        const badgeAm = pk.badge_am || (ssrCrown === 'gold' ? '\u0531\u0574\u0565\u0576\u0561\u0577\u0561\u0570\u0561\u057E\u0565\u057F' : '');
        const badge = badgeRu;
        if (badge) {
          pkgHtml += '<div class="pkg-tier-badge" data-ru="' + esc(badgeRu) + '" data-am="' + esc(badgeAm) + '">' + esc(isArmenian ? (badgeAm || badgeRu) : badgeRu) + '</div>';
        }
        pkgHtml += '<div class="pkg-name" data-ru="' + esc(pk.name_ru) + '" data-am="' + esc(pk.name_am || '') + '">' + esc(isArmenian ? (pk.name_am || pk.name_ru) : pk.name_ru) + '</div>';
        if (pk.description_ru || pk.description_am) pkgHtml += '<div class="pkg-desc" data-ru="' + esc(pk.description_ru || '') + '" data-am="' + esc(pk.description_am || '') + '">' + esc(isArmenian ? (pk.description_am || pk.description_ru || '') : (pk.description_ru || '')) + '</div>';
        pkgHtml += '<div class="pkg-prices">';
        if (pk.original_price > 0 && pk.original_price > pk.package_price) {
          pkgHtml += '<span class="pkg-old-price">' + fmtN(pk.original_price) + ' \u058f</span>';
        }
        pkgHtml += '<span class="pkg-new-price">' + fmtN(pk.package_price) + ' \u058f</span>';
        if (disc > 0) pkgHtml += '<span class="pkg-discount">\u2212' + disc + '%</span>';
        pkgHtml += '</div>';
        if (pk.items && pk.items.length > 0) {
          pkgHtml += '<div class="pkg-items">';
          for (const pi of pk.items) {
            const piQty = pi.quantity || 1;
            let piExtra = '';
            if (pi.use_tiered && pi.price_type === 'tiered' && pi.price_tiers_json) {
              try {
                const piTiers = JSON.parse(pi.price_tiers_json as string);
                let piUnitP = 0;
                for (const t of piTiers) { if (piQty >= t.min && piQty <= t.max) { piUnitP = t.price; break; } }
                if (!piUnitP && piTiers.length) piUnitP = piTiers[piTiers.length - 1].price;
                piExtra = ' <span style="color:#a78bfa;font-size:0.72rem">(' + fmtN(piUnitP) + ' \u058f/\u0448\u0442)</span>';
              } catch {}
            }
            const piNameSsr = isArmenian ? (pi.service_name_am || pi.service_name_ru || '') : (pi.service_name_ru || '');
            const piNameRuSsr = pi.service_name_ru || '';
            const piNameAmSsr = pi.service_name_am || pi.service_name_ru || '';
            let piExtraRuSsr = '';
            let piExtraAmSsr = '';
            if (piExtra) {
              piExtraRuSsr = piExtra.includes('/\u0570\u0561\u057f') ? piExtra.replace('/\u0570\u0561\u057f', '/\u0448\u0442') : piExtra;
              piExtraAmSsr = piExtra.includes('/\u0448\u0442') ? piExtra.replace('/\u0448\u0442', '/\u0570\u0561\u057f') : piExtra;
            }
            const itemRuSsr = esc(piNameRuSsr) + ' \u00d7 ' + piQty + piExtraRuSsr;
            const itemAmSsr = esc(piNameAmSsr) + ' \u00d7 ' + piQty + piExtraAmSsr;
            const itemCurSsr = isArmenian ? itemAmSsr : itemRuSsr;
            pkgHtml += '<div data-ru="' + itemRuSsr.replace(/"/g,'&quot;') + '" data-am="' + itemAmSsr.replace(/"/g,'&quot;') + '"><i class="fas fa-check-circle"></i> ' + itemCurSsr + '</div>';
          }
          pkgHtml += '</div>';
        }
        pkgHtml += '</div>';
      }
      pkgHtml += '</div>';
      // Also inject _calcPackages data for selectPackage() to work
      // Find gold card index in sorted array for initial centering
      const goldCardIdx = sortedSsrPkgs.findIndex((p: any) => (p.crown_tier || (p.is_popular ? 'gold' : '')) === 'gold');
      const initIdx = goldCardIdx >= 0 ? goldCardIdx : 0;
      pkgHtml += '<scr' + 'ipt>window._calcPackages=' + JSON.stringify(ssrPkgs) + ';'
        + '(function(){var idx=' + initIdx + ';if(idx>0&&window.innerWidth<=768){'
        + 'var g=document.querySelector(".calc-packages-grid");if(g){'
        + 'g.style.scrollSnapType="none";g.style.scrollBehavior="auto";'
        + 'requestAnimationFrame(function(){var c=g.children[idx];if(c){g.scrollLeft=Math.max(0,c.offsetLeft-(g.offsetWidth-c.offsetWidth)/2)}'
        + 'requestAnimationFrame(function(){g.style.scrollSnapType="x mandatory";g.classList.add("smooth-scroll")})})'
        + '}}})()</scr' + 'ipt>';
      pageHtml = pageHtml.replace(
        '<div class="calc-packages" id="calcPackages" style="display:none"></div>',
        '<div class="calc-packages" id="calcPackages">' + pkgHtml + '</div>'
      );
    }
  } catch {}
  
  // Use HTMLRewriter to replace texts by matching data-ru attribute values against textMap
  // Skip calculator section: its texts are managed via site_blocks.texts_ru,
  // and site_content positional matching can corrupt calculator structural elements
  if (hasTextChanges) {
    const response = new Response(pageHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
    
    // Track current section via data-section-id to skip calculator and elements outside sections
    let currentTextSection = '';
    let textSectionDepth = 0;
    
    const rewritten = new HTMLRewriter()
      .on('[data-section-id]', {
        element(el) {
          currentTextSection = el.getAttribute('data-section-id') || '';
          textSectionDepth++;
          el.onEndTag(() => {
            textSectionDepth--;
            if (textSectionDepth <= 0) {
              currentTextSection = '';
              textSectionDepth = 0;
            }
          });
        }
      })
      // Skip floating buttons and footer — their text comes from blockFeatures/footer API, not textMap
      // NOTE: HTMLRewriter does NOT support compound selectors like '.tg-float [data-ru]'
      // Instead, we use data-no-rewrite="1" attribute directly on elements in HTML
      // Process all elements with data-ru attribute
      .on('[data-ru]', {
        element(el) {
          // Skip elements marked with data-no-rewrite (floating buttons)
          if (el.getAttribute('data-no-rewrite') === '1') return;
          const currentRu = el.getAttribute('data-ru') || '';
          if (!currentRu) return;
          
          // Skip replacement inside calculator section
          if (currentTextSection === 'calculator') return;
          
          // Skip elements outside any section (e.g. floating buttons after footer)
          if (!currentTextSection || textSectionDepth <= 0) return;
          
          // Look up this element's data-ru text in textMap
          const replacement = textMap[currentRu];
          if (!replacement) return;
          
          // Update data-ru attribute with new Russian text
          if (replacement.ru !== currentRu) {
            el.setAttribute('data-ru', replacement.ru);
          }
          // Always update data-am (might have changed even if ru stayed same)
          if (replacement.am) {
            el.setAttribute('data-am', replacement.am);
          }
          // Replace visible text content only if ru changed
          if (replacement.ru !== currentRu) {
            el.setInnerContent(replacement.ru);
          }
        }
      })
      .transform(response);
    
    // Get the transformed HTML
    pageHtml = await rewritten.text();
  }
  
  // ===== SERVER-SIDE FOOTER INJECTION =====
  // Inject footer_settings data into HTML to prevent flash of old footer content
  const footerSettings = (globalThis as any).__footerSettings;
  const footerBlockSocials = (globalThis as any).__footerBlockSocials || [];
  const footerBlockSocialSettings = (globalThis as any).__footerBlockSocialSettings || {};
  // Clean up global refs
  delete (globalThis as any).__footerSettings;
  delete (globalThis as any).__footerBlockSocials;
  delete (globalThis as any).__footerBlockSocialSettings;
  
  if (footerSettings) {
    // 1. Inject brand text from footer_settings
    if (footerSettings.brand_text_ru) {
      const brandAm = footerSettings.brand_text_am || '';
      const oldBrandMatch = pageHtml.match(/<p data-ru="[^"]*" data-am="[^"]*" data-no-rewrite="1">[^<]*<\/p>\s*<\/div>\s*<div class="footer-col" id="footerNavCol">/);
      if (oldBrandMatch) {
        const escRu = (footerSettings.brand_text_ru as string).replace(/"/g, '&quot;');
        const escAm = brandAm ? (brandAm as string).replace(/"/g, '&quot;') : '';
        const newBrand = `<p data-ru="${escRu}" data-am="${escAm || escRu}" data-no-rewrite="1">${footerSettings.brand_text_ru}</p></div>\n    <div class="footer-col" id="footerNavCol">`;
        pageHtml = pageHtml.replace(oldBrandMatch[0], newBrand);
      }
    }
    
    // 2. Inject contacts + socials COMBINED into contacts column
    let contacts: any[] = [];
    try { contacts = JSON.parse(footerSettings.contacts_json as string || '[]'); } catch {}
    {
      let contactHtml = '<h4 data-ru="Контакты" data-am="Կոնտակտներ" data-no-rewrite="1">Контакты</h4>\n      <ul>\n';
      if (contacts.length > 0) {
        for (const ct of contacts) {
          const nameRu = (ct.name_ru || '').replace(/"/g, '&quot;');
          const nameAm = (ct.name_am || '').replace(/"/g, '&quot;');
          contactHtml += `        <li><a href="${ct.url || '#'}" target="_blank"><i class="${ct.icon || 'fab fa-telegram'}"></i> <span data-ru="${nameRu}" data-am="${nameAm || nameRu}" data-no-rewrite="1">${ct.name_ru || ''}</span></a></li>\n`;
        }
      } else {
        contactHtml += '        <li><a href="https://t.me/goo_to_top" target="_blank"><i class="fab fa-telegram"></i> <span data-ru="Администратор" data-am="Ադմինիստրատոր" data-no-rewrite="1">Администратор</span></a></li>\n';
      }
      contactHtml += '      </ul>';
      
      // Add social links INSIDE contacts column (below contacts list)
      if (footerBlockSocials.length > 0) {
        const socialIcons: Record<string,string> = { instagram:'fab fa-instagram', facebook:'fab fa-facebook', telegram:'fab fa-telegram', whatsapp:'fab fa-whatsapp', youtube:'fab fa-youtube', tiktok:'fab fa-tiktok', twitter:'fab fa-twitter' };
        const socialColors: Record<string,string> = { instagram:'#E4405F', facebook:'#1877F2', telegram:'#26A5E4', whatsapp:'#25D366', youtube:'#FF0000', tiktok:'#000', twitter:'#1DA1F2' };
        const ss = footerBlockSocialSettings;
        const gap = ss.gap || 10;
        
        contactHtml += '\n      <div class="footer-socials-block" style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08)">';
        if (ss.title_ru) {
          const titleRu = (ss.title_ru as string).replace(/"/g, '&quot;');
          const titleAm = ss.title_am ? (ss.title_am as string).replace(/"/g, '&quot;') : titleRu;
          contactHtml += `<div data-ru="${titleRu}" data-am="${titleAm}" data-no-rewrite="1" style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:var(--accent,#8B5CF6);margin-bottom:12px">${ss.title_ru}</div>`;
        }
        contactHtml += `<div style="display:flex;gap:${gap}px;flex-wrap:wrap">`;
        for (const s of footerBlockSocials) {
          if (!s.url) continue;
          const icon = socialIcons[s.type] || 'fas fa-link';
          const color = s.bg_color || socialColors[s.type] || '#8B5CF6';
          const sz = s.icon_size || 36;
          const fontSize = Math.round(sz * 0.45);
          contactHtml += `<a href="${s.url}" target="_blank" rel="noopener" class="footer-social-btn" style="display:inline-flex;align-items:center;justify-content:center;width:${sz}px;height:${sz}px;border-radius:50%;background:${color};color:white;font-size:${fontSize}px;transition:transform 0.2s"><i class="${icon}"></i></a>`;
        }
        contactHtml += '</div></div>';
      }
      
      // Replace the contacts column content
      const contactColMatch = pageHtml.match(/<div class="footer-col" id="footerContactCol">[\s\S]*?<\/div>/);
      if (contactColMatch) {
        pageHtml = pageHtml.replace(contactColMatch[0], `<div class="footer-col" id="footerContactCol">\n      ${contactHtml}\n    </div>`);
      }
    }

    
    // 3. Inject copyright
    if (footerSettings.copyright_ru) {
      const copyAm = footerSettings.copyright_am || '';
      const copyRu = footerSettings.copyright_ru as string;
      // Replace the copyright span content
      const oldCopyMatch = pageHtml.match(/© 2026 Go to Top\. <span data-ru="[^"]*" data-am="[^"]*" data-no-rewrite="1">[^<]*<\/span>/);
      if (oldCopyMatch) {
        pageHtml = pageHtml.replace(oldCopyMatch[0], `${copyRu.includes('©') ? '' : ''}${copyRu.replace('© 2026 Go to Top. ', '')}`.length > 0 ? 
          `© 2026 Go to Top. <span data-ru="\u0412\u0441\u0435 \u043f\u0440\u0430\u0432\u0430 \u0437\u0430\u0449\u0438\u0449\u0435\u043d\u044b" data-am="${copyAm ? (copyAm as string).replace(/"/g, '&quot;') : '\u0532\u0578\u056c\u0578\u0580 \u056b\u0580\u0561\u057e\u0578\u0582\u0576\u0584\u0576\u0565\u0580\u0568 \u057a\u0561\u0577\u057f\u057a\u0561\u0576\u057e\u0561\u056e \u0565\u0576'}" data-no-rewrite="1">\u0412\u0441\u0435 \u043f\u0440\u0430\u0432\u0430 \u0437\u0430\u0449\u0438\u0449\u0435\u043d\u044b</span>` : oldCopyMatch[0]);
      }
    }
    
    // 4. Inject location
    if (footerSettings.location_ru) {
      const locRu = (footerSettings.location_ru as string).replace(/"/g, '&quot;');
      const locAm = footerSettings.location_am ? (footerSettings.location_am as string).replace(/"/g, '&quot;') : '';
      const oldLocMatch = pageHtml.match(/<span data-ru="[^"]*" data-am="[^"]*" data-no-rewrite="1">[^<]*<\/span>\s*<\/div>\s*<\/div>\s*<\/footer>/);
      if (oldLocMatch) {
        pageHtml = pageHtml.replace(oldLocMatch[0], `<span data-ru="${locRu}" data-am="${locAm || locRu}" data-no-rewrite="1">${footerSettings.location_ru}</span>\n  </div>\n</div>\n</footer>`);
      }
    }
  }
  
  // 5. Footer social links now injected INSIDE contacts column (step 2 above)
  // No separate block needed
  
  // ===== 5b. SERVER-SIDE POPUP INJECTION =====
  // Update popup texts and button from site_blocks so admin changes are reflected immediately
  // IMPORTANT: All replacements scoped to popupOverlay section to avoid touching other page elements
  const popupBlock = (globalThis as any).__popupBlock;
  delete (globalThis as any).__popupBlock;
  if (popupBlock) {
    let pTextsRu: string[] = [];
    let pTextsAm: string[] = [];
    let pButtons: any[] = [];
    try { pTextsRu = JSON.parse(popupBlock.texts_ru as string || '[]'); } catch {}
    try { pTextsAm = JSON.parse(popupBlock.texts_am as string || '[]'); } catch {}
    try { pButtons = JSON.parse(popupBlock.buttons as string || '[]'); } catch {}
    
    // Extract popup section from HTML for scoped replacements
    const popupStart = pageHtml.indexOf('id="popupOverlay"');
    const popupScriptStart = pageHtml.indexOf('<script>', popupStart > 0 ? popupStart : 0);
    if (popupStart > 0 && popupScriptStart > popupStart) {
      let popupHtml = pageHtml.substring(popupStart, popupScriptStart);
      
      // Replace heading (h3)
      if (pTextsRu[0]) {
        const h3Match = popupHtml.match(/<h3 data-ru="[^"]*" data-am="[^"]*">[^<]*<\/h3>/);
        if (h3Match) {
          const escRu = pTextsRu[0].replace(/"/g, '&quot;');
          const escAm = (pTextsAm[0] || '').replace(/"/g, '&quot;');
          popupHtml = popupHtml.replace(h3Match[0], `<h3 data-ru="${escRu}" data-am="${escAm || escRu}">${pTextsRu[0]}</h3>`);
        }
      }
      
      // Replace subtitle (.popup-sub)
      if (pTextsRu[1]) {
        const subMatch = popupHtml.match(/<p class="popup-sub" data-ru="[^"]*" data-am="[^"]*">[^<]*<\/p>/);
        if (subMatch) {
          const escRu = pTextsRu[1].replace(/"/g, '&quot;');
          const escAm = (pTextsAm[1] || '').replace(/"/g, '&quot;');
          popupHtml = popupHtml.replace(subMatch[0], `<p class="popup-sub" data-ru="${escRu}" data-am="${escAm || escRu}">${pTextsRu[1]}</p>`);
        }
      }
      
      // Replace form labels (all 3 at once using counter)
      {
        let labelIdx = 0;
        popupHtml = popupHtml.replace(/<label class="pf-label" data-ru="[^"]*" data-am="[^"]*">[^<]*<\/label>/g, (match) => {
          const ruText = pTextsRu[labelIdx + 2] || '';
          const amText = pTextsAm[labelIdx + 2] || '';
          labelIdx++;
          if (!ruText) return match;
          const escRu = ruText.replace(/"/g, '&quot;');
          const escAm = amText.replace(/"/g, '&quot;');
          return `<label class="pf-label" data-ru="${escRu}" data-am="${escAm || escRu}">${ruText}</label>`;
        });
      }
      
      // Replace success heading (h4)
      if (pTextsRu[5]) {
        const succH4Match = popupHtml.match(/<h4 data-ru="[^"]*" data-am="[^"]*">[^<]*<\/h4>/);
        if (succH4Match) {
          const escRu = pTextsRu[5].replace(/"/g, '&quot;');
          const escAm = (pTextsAm[5] || '').replace(/"/g, '&quot;');
          popupHtml = popupHtml.replace(succH4Match[0], `<h4 data-ru="${escRu}" data-am="${escAm || escRu}">${pTextsRu[5]}</h4>`);
        }
      }
      
      // Replace success message (p after h4 in popup-success)
      if (pTextsRu[6]) {
        const succPIdx = popupHtml.indexOf('popup-success');
        if (succPIdx > 0) {
          const succArea = popupHtml.substring(succPIdx);
          const succPMatch = succArea.match(/<p data-ru="[^"]*" data-am="[^"]*">[^<]*<\/p>/);
          if (succPMatch) {
            const escRu = pTextsRu[6].replace(/"/g, '&quot;');
            const escAm = (pTextsAm[6] || '').replace(/"/g, '&quot;');
            popupHtml = popupHtml.replace(succPMatch[0], `<p data-ru="${escRu}" data-am="${escAm || escRu}">${pTextsRu[6]}</p>`);
          }
        }
      }
      
      // Replace submit button text
      if (pButtons[0]) {
        const btnSpanMatch = popupHtml.match(/<span data-ru="[^"]*" data-am="[^"]*">[^<]*<\/span>/);
        if (btnSpanMatch) {
          const escRu = (pButtons[0].text_ru || '').replace(/"/g, '&quot;');
          const escAm = (pButtons[0].text_am || '').replace(/"/g, '&quot;');
          popupHtml = popupHtml.replace(btnSpanMatch[0], `<span data-ru="${escRu}" data-am="${escAm || escRu}">${pButtons[0].text_ru || ''}</span>`);
        }
      }
      
      // Replace popup section in full HTML
      const originalPopup = pageHtml.substring(popupStart, popupScriptStart);
      pageHtml = pageHtml.replace(originalPopup, popupHtml);
    }
  }
  
  // ===== 6. SERVER-SIDE SECTION REORDERING =====
  // Reorder sections in HTML based on section_order from DB so the page loads with correct order instantly
  const sectionOrder: any[] = (globalThis as any).__sectionOrder || [];
  const blockFeatures: any[] = (globalThis as any).__blockFeatures || [];
  delete (globalThis as any).__sectionOrder;
  delete (globalThis as any).__blockFeatures;
  
  if (sectionOrder.length > 0) {
    // Build order map: normalized section_id -> { sort_order, is_visible }
    const soMap: Record<string, { sort_order: number, is_visible: number }> = {};
    for (const s of sectionOrder) {
      const sid = (s.section_id || '').replace(/_/g, '-');
      soMap[sid] = { sort_order: s.sort_order ?? 999, is_visible: s.is_visible ?? 1 };
      // Also store underscore variant
      const sidU = (s.section_id || '').replace(/-/g, '_');
      if (!soMap[sidU]) soMap[sidU] = soMap[sid];
    }
    
    // Extract sections using HTML comment markers as boundaries
    // Each section starts with <!-- ===== NAME ===== --> followed by a tag with data-section-id
    // Important: Only match top-level section comments (not nested ones inside calculator)
    const sectionComments: Array<{ name: string, sectionId: string, pos: number }> = [
      { name: 'HERO', sectionId: 'hero', pos: -1 },
      { name: 'TICKER', sectionId: 'ticker', pos: -1 },
      { name: 'WB BANNER', sectionId: 'wb-banner', pos: -1 },
      { name: 'STATS BAR', sectionId: 'stats-bar', pos: -1 },
      { name: 'ABOUT', sectionId: 'about', pos: -1 },
      { name: 'SERVICES', sectionId: 'services', pos: -1 },
      { name: 'BUYOUT DETAIL', sectionId: 'buyout-detail', pos: -1 },
      { name: 'WHY BUYOUTS BY KEYWORDS', sectionId: 'why-buyouts', pos: -1 },
      { name: '50K: BLOGGER VS BUYOUTS', sectionId: 'fifty-vs-fifty', pos: -1 },
      { name: 'WB OFFICIAL', sectionId: 'wb-official', pos: -1 },
      { name: 'CALCULATOR', sectionId: 'calculator', pos: -1 },
      { name: 'PROCESS', sectionId: 'process', pos: -1 },
      { name: 'WAREHOUSE', sectionId: 'warehouse', pos: -1 },
      { name: 'GUARANTEE', sectionId: 'guarantee', pos: -1 },
      { name: 'COMPARISON', sectionId: 'comparison', pos: -1 },
      { name: 'IMPORTANT NOTES', sectionId: 'important', pos: -1 },
      { name: 'CLIENT REVIEWS / REAL CASES', sectionId: 'client-reviews', pos: -1 },
      { name: 'FAQ', sectionId: 'faq', pos: -1 },
      { name: 'CONTACT FORM', sectionId: 'contact', pos: -1 },
    ];
    
    // Find each section comment position
    for (const sc of sectionComments) {
      const marker = `<!-- ===== ${sc.name} =====`;
      sc.pos = pageHtml.indexOf(marker);
    }
    
    // Filter to only found sections and sort by position
    const foundSections = sectionComments.filter(sc => sc.pos >= 0).sort((a, b) => a.pos - b.pos);
    const footerPos = pageHtml.indexOf('\n<!-- ===== FOOTER =====');
    
    if (foundSections.length > 0 && footerPos > 0) {
      const beforeSections = pageHtml.substring(0, foundSections[0].pos);
      const afterSections = pageHtml.substring(footerPos);
      
      // Extract each section's HTML chunk
      const sectionParts: Array<{ id: string, html: string, sortOrder: number }> = [];
      for (let i = 0; i < foundSections.length; i++) {
        const start = foundSections[i].pos;
        const end = i < foundSections.length - 1 ? foundSections[i + 1].pos : footerPos;
        const norm = foundSections[i].sectionId;
        const so = soMap[norm]?.sort_order ?? 999;
        sectionParts.push({
          id: norm,
          html: pageHtml.substring(start, end),
          sortOrder: so
        });
      }
      
      // Sort sections based on DB section_order
      sectionParts.sort((a, b) => a.sortOrder - b.sortOrder);
      
      // Store debug info for output (remove in production)
      
      // Hide invisible sections via inline style
      for (const part of sectionParts) {
        const info = soMap[part.id];
        if (info && !info.is_visible) {
          part.html = part.html.replace(
            new RegExp(`data-section-id="${part.id}"`),
            `data-section-id="${part.id}" style="display:none"`
          );
        }
      }
      
      // Reassemble HTML
      pageHtml = beforeSections + sectionParts.map(p => p.html).join('') + afterSections;
    }
    
    // ===== 7. SERVER-SIDE NAV LINKS INJECTION =====
    // Replace hard-coded header nav and footer nav with DB values
    const navBf = blockFeatures.find((b: any) => b.key === 'nav');
    if (navBf && navBf.texts_ru && navBf.texts_ru.length > 0) {
      const defaultTargets = ['about', 'services', 'calculator', 'warehouse', 'guarantee', 'faq', 'contact'];
      const navLinks = navBf.nav_links || [];
      const navTargetMap: Record<number, string> = {};
      for (const nl of navLinks) {
        navTargetMap[nl.idx] = nl.target || '';
      }
      
      // Build nav items
      const navItems: Array<{ru: string, am: string, target: string}> = [];
      for (let i = 0; i < navBf.texts_ru.length; i++) {
        const ru = navBf.texts_ru[i] || '';
        const am = (navBf.texts_am && navBf.texts_am[i]) || '';
        if (!ru && !am) continue;
        let target = navTargetMap[i] || (i < defaultTargets.length ? defaultTargets[i] : '');
        target = target.replace(/_/g, '-');
        if (target === '_telegram' || target === '_cta') continue;
        navItems.push({ ru, am, target });
      }
      
      if (navItems.length > 0) {
        // Build header nav HTML
        let headerNavHtml = '';
        for (const item of navItems) {
          const navText = isArmenian ? (item.am || item.ru) : item.ru;
          headerNavHtml += `    <li><a href="#${item.target}" data-ru="${item.ru.replace(/"/g,'&quot;')}" data-am="${(item.am||'').replace(/"/g,'&quot;')}">${navText}</a></li>\n`;
        }
        // Add mobile CTA (use floating_tg block data if available for correct URL and text)
        const floatBf = blockFeatures.find((b: any) => b.key === 'floating_tg');
        const floatBtn = floatBf?.buttons?.[0];
        const mobCtaUrl = floatBtn?.url || 'https://wa.me/37441888389';
        const mobCtaRu = floatBtn?.text_ru || 'Написать нам';
        const mobCtaAm = floatBtn?.text_am || 'Գրել հիմա';
        const mobCtaIcon = floatBtn?.icon || 'fab fa-whatsapp';
        const mobCtaText = isArmenian ? mobCtaAm : mobCtaRu;
        headerNavHtml += `    <li class="nav-mobile-cta"><a href="${mobCtaUrl}" target="_blank" class="btn btn-primary"><i class="${mobCtaIcon}"></i> <span data-ru="${mobCtaRu.replace(/"/g,'&quot;')}" data-am="${mobCtaAm.replace(/"/g,'&quot;')}" data-no-rewrite="1">${mobCtaText}</span></a></li>`;
        
        // Replace header nav links
        const headerNavMatch = pageHtml.match(/<ul class="nav-links" id="navLinks">[\s\S]*?<\/ul>/);
        if (headerNavMatch) {
          pageHtml = pageHtml.replace(headerNavMatch[0], `<ul class="nav-links" id="navLinks">\n${headerNavHtml}\n  </ul>`);
        }
        
        // Build footer nav HTML
        let footerNavHtml = '';
        for (const item of navItems) {
          if (!item.target || item.target.charAt(0) === '_') continue;
          const footNavText = isArmenian ? (item.am || item.ru) : item.ru;
          footerNavHtml += `        <li><a href="#${item.target}" data-ru="${item.ru.replace(/"/g,'&quot;')}" data-am="${(item.am||'').replace(/"/g,'&quot;')}" data-no-rewrite="1">${footNavText}</a></li>\n`;
        }
        
        // Replace footer nav links
        const footerNavMatch = pageHtml.match(/<ul id="footerNavList">[\s\S]*?<\/ul>/);
        if (footerNavMatch) {
          pageHtml = pageHtml.replace(footerNavMatch[0], `<ul id="footerNavList">\n${footerNavHtml}      </ul>`);
        }
        
        // Build bottom nav HTML from admin nav items (sync order)
        const bottomNavIcons: Record<string, string> = {
          'about': 'fas fa-info-circle', 'services': 'fas fa-hand-holding',
          'calculator': 'fas fa-calculator', 'warehouse': 'fas fa-warehouse',
          'guarantee': 'fas fa-shield-alt', 'faq': 'fas fa-question-circle',
          'contact': 'fas fa-envelope', 'client-reviews': 'fas fa-star',
          'fifty-vs-fifty': 'fas fa-person-circle-question', 'why-buyouts': 'fas fa-person-circle-question'
        };
        const mainBottomItems = navItems.slice(0, 4);
        const moreBottomItems = navItems.slice(4);
        let bottomHtml = '<div class="bottom-nav-items">\n';
        for (const item of mainBottomItems) {
          const icon = bottomNavIcons[item.target] || 'fas fa-link';
          const text = isArmenian ? (item.am || item.ru) : item.ru;
          bottomHtml += `  <a href="#${item.target}" class="bottom-nav-item"><i class="${icon}"></i><span data-ru="${item.ru.replace(/"/g,'&quot;')}" data-am="${(item.am||'').replace(/"/g,'&quot;')}">${text}</span></a>\n`;
        }
        if (moreBottomItems.length > 0) {
          const moreText = isArmenian ? '\u0531\u057E\u0565\u056C\u056B\u0576' : '\u0415\u0449\u0451';
          bottomHtml += `  <button class="bottom-nav-item bottom-nav-more" id="bottomNavMore" onclick="toggleBottomMore()"><i class="fas fa-ellipsis-h"></i><span data-ru="\u0415\u0449\u0451" data-am="\u0531\u057E\u0565\u056C\u056B\u0576">${moreText}</span>\n`;
          bottomHtml += `    <div class="bottom-nav-more-menu" id="bottomMoreMenu">\n`;
          for (const item of moreBottomItems) {
            const icon = bottomNavIcons[item.target] || 'fas fa-link';
            const text = isArmenian ? (item.am || item.ru) : item.ru;
            bottomHtml += `      <a href="#${item.target}"><i class="${icon}"></i><span data-ru="${item.ru.replace(/"/g,'&quot;')}" data-am="${(item.am||'').replace(/"/g,'&quot;')}">${text}</span></a>\n`;
          }
          bottomHtml += `    </div>\n  </button>\n`;
        }
        bottomHtml += '</div>';
        const bottomNavMatch = pageHtml.match(/<nav class="bottom-nav" id="bottomNav">[\s\S]*?<\/nav>/);
        if (bottomNavMatch) {
          pageHtml = pageHtml.replace(bottomNavMatch[0], `<nav class="bottom-nav" id="bottomNav">\n${bottomHtml}\n</nav>`);
        }
      }
    }
  }
  
  // ===== 8. SERVER-SIDE SEO / OPEN GRAPH INJECTION =====
  const seoBlock = (globalThis as any).__seoOgBlock;
  delete (globalThis as any).__seoOgBlock;
  if (seoBlock) {
    let seoTextsRu: string[] = [];
    let seoTextsAm: string[] = [];
    try { seoTextsRu = JSON.parse(seoBlock.texts_ru || '[]'); } catch { seoTextsRu = []; }
    try { seoTextsAm = JSON.parse(seoBlock.texts_am || '[]'); } catch { seoTextsAm = []; }
    const seoImage = (seoBlock.photo_url || '').trim();
    // Make image URL absolute (Telegram needs full URL)
    const baseUrl = new URL(c.req.url).origin;
    const seoImageAbsolute = seoImage.startsWith('http') ? seoImage : (seoImage ? baseUrl + (seoImage.startsWith('/') ? '' : '/') + seoImage : '');
    
    // Pick text by language (with RU fallback) — isArmenian already defined at top of handler
    const ogTitle = (isArmenian && seoTextsAm[0]) ? seoTextsAm[0] : (seoTextsRu[0] || '');
    const ogDesc = (isArmenian && seoTextsAm[1]) ? seoTextsAm[1] : (seoTextsRu[1] || '');
    
    // Replace og:title
    if (ogTitle) {
      const escTitle = ogTitle.replace(/"/g, '&quot;');
      pageHtml = pageHtml.replace(
        /<meta property="og:title" content="[^"]*">/,
        `<meta property="og:title" content="${escTitle}">`
      );
      pageHtml = pageHtml.replace(
        /<meta name="twitter:title" content="[^"]*">/,
        `<meta name="twitter:title" content="${escTitle}">`
      );
      // Also update <title> tag
      pageHtml = pageHtml.replace(
        /<title>[^<]*<\/title>/,
        `<title>${ogTitle}</title>`
      );
    }
    
    // Replace og:description
    if (ogDesc) {
      const escDesc = ogDesc.replace(/"/g, '&quot;');
      pageHtml = pageHtml.replace(
        /<meta property="og:description" content="[^"]*">/,
        `<meta property="og:description" content="${escDesc}">`
      );
      pageHtml = pageHtml.replace(
        /<meta name="twitter:description" content="[^"]*">/,
        `<meta name="twitter:description" content="${escDesc}">`
      );
      pageHtml = pageHtml.replace(
        /<meta name="description" content="[^"]*">/,
        `<meta name="description" content="${escDesc}">`
      );
    }
    
    // Replace og:image
    if (seoImageAbsolute) {
      const escImg = seoImageAbsolute.replace(/"/g, '&quot;');
      pageHtml = pageHtml.replace(
        /<meta property="og:image" content="[^"]*">/,
        `<meta property="og:image" content="${escImg}">`
      );
      pageHtml = pageHtml.replace(
        /<meta name="twitter:image" content="[^"]*">/,
        `<meta name="twitter:image" content="${escImg}">`
      );
    }
    
    // Update og:locale based on detected language
    if (isArmenian) {
      pageHtml = pageHtml.replace(
        /<meta property="og:locale" content="[^"]*">/,
        `<meta property="og:locale" content="hy_AM">`
      );
      // Update og:url to include /am path
      pageHtml = pageHtml.replace(
        /<meta property="og:url" content="[^"]*">/,
        `<meta property="og:url" content="https://gototop.win/am">`
      );
      // Set html lang
      pageHtml = pageHtml.replace('<html lang="ru"', '<html lang="hy"');
    }
  }
  
  // Clean up globals
  const soCount = (globalThis as any).__sectionOrderCount || 0;
  delete (globalThis as any).__sectionOrderCount;
  const reorderDebug = (globalThis as any).__reorderDebug || '';
  delete (globalThis as any).__reorderDebug;
  
  // Add marker so client-side JS knows server already handled reordering
  if (sectionOrder.length > 0) {
    pageHtml = pageHtml.replace('<html lang="ru"', '<html lang="ru" data-server-ordered="1"');
  }
  
  // ===== FINAL: SERVER-SIDE ARMENIAN TEXT RENDERING =====
  // Runs LAST after all SSR injections to ensure all elements (nav, packages, footer) get Armenian text
  if (isArmenian) {
    const amResponse = new Response(pageHtml, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
    const amRewritten = new HTMLRewriter()
      .on('[data-am]', {
        element(el) {
          const amText = el.getAttribute('data-am') || '';
          if (amText && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'META') {
            el.setInnerContent(amText);
          }
        }
      })
      .transform(amResponse);
    pageHtml = await amRewritten.text();
    // Set correct initial lang variable in JS so client doesn't flash Russian
    pageHtml = pageHtml.replace(
      "let lang = localStorage.getItem('gtt_lang') || 'am';",
      "let lang = 'am'; localStorage.setItem('gtt_lang','am');"
    );
  }

  // === Inline site-data (started in parallel at the beginning) ===
  const siteDataJson = await siteDataPromise;
  if (siteDataJson) {
    pageHtml = pageHtml.replace('</head>', '<script>window.__SITE_DATA=' + siteDataJson + '</script>\n</head>');
  }

  return c.html(pageHtml);
})

// Language-specific routes: /am and /ru — rewrite to / with lang query param
// These must render the SAME page (not redirect) so Telegram/WhatsApp see OG tags
app.get('/am', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = '/';
  url.searchParams.set('lang', 'am');
  const newReq = new Request(url.href, c.req.raw);
  return app.fetch(newReq, c.env, c.executionCtx);
})

app.get('/ru', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = '/';
  url.searchParams.set('lang', 'ru');
  const newReq = new Request(url.href, c.req.raw);
  return app.fetch(newReq, c.env, c.executionCtx);
})
}
