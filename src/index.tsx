/**
 * Main application entry point — route aggregator
 * 
 * All routes are split into modular files under ./routes/
 * This file only handles imports and route registration.
 * 
 * Performance: Cloudflare Cache API wraps landing pages so that
 * subsequent requests from the same edge PoP are served from cache
 * (~50ms TTFB instead of ~2-3s for SSR + D1 queries).
 */
import { Hono } from 'hono'
import adminApi from './api/admin'
import { getAdminHTML } from './admin/panel'
import { CACHE_VERSION, CACHEABLE_PATHS as CACHE_PATHS, KNOWN_ORIGINS } from './lib/cache-config'

// Route modules
import { register as registerPublicApi } from './routes/public-api'
import { register as registerPdf } from './routes/pdf'
import { register as registerSeedApi } from './routes/seed-api'
import { register as registerLanding } from './routes/landing'
import { register as registerBlog } from './routes/blog'

type Bindings = { DB: D1Database; MEDIA: R2Bucket }
const app = new Hono<{ Bindings: Bindings }>()

// ===== PUBLIC API ROUTES =====
registerPublicApi(app)

// ===== PDF ROUTES =====
registerPdf(app)

// ===== ADMIN API =====
app.route('/api/admin', adminApi)

// ===== ADMIN PANEL UI =====
app.get('/admin', (c) => {
  return c.html(getAdminHTML())
})

// ===== CACHE PURGE ENDPOINT =====
// Called by admin panel after any content save to invalidate edge cache
app.post('/api/admin/purge-cache', async (c) => {
  try {
    const cache = caches.default;
    const origin = new URL(c.req.url).origin;
    // Purge all cached landing page variants
    const paths = CACHE_PATHS;
    // Also purge versioned cache keys
    const vPaths = paths.map(p => p.includes('?') ? p + '&_cv=' + CACHE_VERSION : p + '?_cv=' + CACHE_VERSION);
    // Purge ALL known origins (not just the requesting one)
    const origins = new Set([origin, ...KNOWN_ORIGINS]);
    const purgePromises: Promise<boolean>[] = [];
    for (const o of origins) {
      for (const p of [...paths, ...vPaths]) {
        purgePromises.push(cache.delete(new Request(o + p)).catch(() => false));
      }
    }
    const results = await Promise.all(purgePromises);
    return c.json({ ok: true, purged: results.filter(Boolean).length });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message });
  }
})

// ===== SEED FROM SITE =====
registerSeedApi(app)

// ===== MULTI-PAGE NAVIGATION ROUTES =====
// Clean URLs that render a lightweight redirect page pointing to the
// appropriate anchor on the main landing page.
// This allows proper sharing/bookmarking of /services, /calculator etc.
const PAGE_SECTIONS: Record<string, { anchor: string; title_ru: string; title_am: string }> = {
  services:   { anchor: 'services',   title_ru: 'Услуги',       title_am: 'Ծараyutyan' },
  calculator: { anchor: 'calculator', title_ru: 'Калькулятор',  title_am: 'Հашviч' },
  guarantee:  { anchor: 'guarantee',  title_ru: 'Гарантии',     title_am: 'Eराशखiknern' },
  contacts:   { anchor: 'contact',    title_ru: 'Контакты',     title_am: 'Контaktner' },
};

for (const [path, info] of Object.entries(PAGE_SECTIONS)) {
  app.get(`/${path}`, (c) => {
    // Client-side redirect to landing page anchor
    return c.html(`<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>${info.title_ru} — Go to Top</title>
<meta http-equiv="refresh" content="0;url=/#${info.anchor}">
<link rel="canonical" href="${new URL(c.req.url).origin}/#${info.anchor}">
<script>window.location.replace('/#${info.anchor}');</script>
</head>
<body style="background:#0f0a1a;color:#f1f0f5;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center">
<div><p style="color:#a09cb8">Перенаправление...</p><p><a href="/#${info.anchor}" style="color:#8B5CF6">Нажмите, если не переходит</a></p></div>
</body></html>`);
  });
}

// ===== BLOG ROUTES =====
registerBlog(app)

// ===== SEO: robots.txt =====
app.get('/robots.txt', (c) => {
  const origin = new URL(c.req.url).origin;
  return new Response(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\nSitemap: ${origin}/sitemap.xml`,
    { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=86400' } }
  );
});

// ===== SEO: sitemap.xml =====
app.get('/sitemap.xml', async (c) => {
  const origin = new URL(c.req.url).origin;
  let blogUrls = '';
  try {
    const db = c.env.DB;
    const posts = await db.prepare('SELECT slug, updated_at FROM blog_posts WHERE published = 1').all();
    blogUrls = (posts.results || []).map((p: any) => `
  <url><loc>${origin}/blog/${p.slug}</loc><lastmod>${(p.updated_at || '').substring(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('');
  } catch { /* DB not ready */ }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${origin}/ru</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>${origin}/am</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>${origin}/blog</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>${blogUrls}
</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } });
});

// ===== MEDIA FILES (R2) =====
// Serves uploaded images/videos from Cloudflare R2
app.get('/api/media/*', async (c) => {
  if (!c.env.MEDIA) return c.json({ error: 'Media storage not configured' }, 503);
  const key = c.req.path.replace('/api/media/', '');
  try {
    const obj = await c.env.MEDIA.get(key);
    if (!obj) return c.json({ error: 'Not found' }, 404);
    const contentType = obj.httpMetadata?.contentType || 'image/jpeg';
    return new Response(obj.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': obj.etag || '',
      }
    });
  } catch(e: any) {
    return c.json({ error: 'Media error: ' + e.message }, 500);
  }
});

// ===== LANDING PAGE (main HTML) =====
registerLanding(app)

// ===== LANGUAGE ROUTES =====
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

// ===== 404 HANDLER =====
app.notFound((c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>404 — Страница не найдена</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f0a1a;color:#f1f0f5;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px}
.container{max-width:480px}
.code{font-size:8rem;font-weight:800;background:linear-gradient(135deg,#8B5CF6,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1}
h1{font-size:1.5rem;font-weight:700;margin:16px 0 8px;color:#f1f0f5}
p{color:#a09cb8;margin-bottom:32px;line-height:1.7}
.btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
a{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:8px;font-weight:600;font-size:0.92rem;text-decoration:none;transition:all 0.3s}
.btn-p{background:linear-gradient(135deg,#8B5CF6,#7C3AED);color:white;box-shadow:0 4px 15px rgba(139,92,246,0.3)}
.btn-p:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(139,92,246,0.5)}
.btn-o{background:transparent;color:#f1f0f5;border:1px solid rgba(139,92,246,0.3)}
.btn-o:hover{border-color:#8B5CF6}
</style></head>
<body><div class="container">
<div class="code">404</div>
<h1>Страница не найдена</h1>
<p>Возможно, страница была перемещена или её никогда не существовало. Вернитесь на главную.</p>
<div class="btns">
  <a href="/" class="btn-p">← На главную</a>
  <a href="/blog" class="btn-o">Читать блог</a>
</div>
</div></body></html>`, 404);
});

// ===== EDGE CACHE WRAPPER =====
// Wraps the Hono app with Cloudflare Cache API for landing pages.
// Cache key = full URL (normalized). On cache HIT the Worker returns
// immediately without touching D1, giving ~50ms TTFB.
// TTL = 600s (10 min). Admin saves auto-purge via /api/admin middleware.
const CACHE_TTL = 600; // seconds — edge cache lifetime (10 min; short TTL ensures stale content expires fast even if purge misses some PoPs)
const CACHEABLE_PATHS = new Set(['/', '/am', '/ru', '/blog']);

// ===== DOMAIN CONSOLIDATION =====
// Primary domain: gototopwb.ru — all traffic should end up here.
// Secondary domain: gototop.win — 301 permanent redirect to primary.
// This avoids SEO duplicate-content penalties and gives users one canonical URL.
const PRIMARY_HOST = 'gototopwb.ru';
const REDIRECT_HOSTS = new Set(['gototop.win', 'www.gototop.win', 'www.gototopwb.ru']);

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 301 redirect non-primary domains to the canonical primary domain
    // Skip admin/API paths so Cloudflare dashboard proxying still works
    if (REDIRECT_HOSTS.has(url.hostname) && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/admin')) {
      const dest = new URL(url.toString());
      dest.hostname = PRIMARY_HOST;
      return new Response(null, {
        status: 301,
        headers: { 'Location': dest.toString(), 'Cache-Control': 'public, max-age=86400' },
      });
    }

    const isCacheable = CACHEABLE_PATHS.has(url.pathname) && request.method === 'GET';

    // Only cache GET requests for landing pages (not admin, API, etc.)
    if (!isCacheable) {
      return app.fetch(request, env, ctx);
    }

    const cache = caches.default;
    // Normalize cache key: strip query params except lang
    const cacheUrl = new URL(url.origin + url.pathname);
    const langParam = url.searchParams.get('lang');
    if (langParam) cacheUrl.searchParams.set('lang', langParam);
    cacheUrl.searchParams.set('_cv', CACHE_VERSION);
    const cacheKey = new Request(cacheUrl.toString());

    // Try cache first
    let response = await cache.match(cacheKey);
    if (response) {
      // Cache HIT — return immediately (~50ms)
      // Add HIT header for debugging (clone to make headers mutable)
      const hitResp = new Response(response.body, response);
      hitResp.headers.set('X-Cache-Status', 'HIT');
      return hitResp;
    }

    // Cache MISS — run SSR
    response = await app.fetch(request, env, ctx);

    // Only cache successful HTML responses
    if (response.status === 200 && response.headers.get('content-type')?.includes('text/html')) {
      // Clone and set cache headers
      const body = await response.arrayBuffer();
      const cachedResponse = new Response(body, {
        status: 200,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'Cache-Control': `public, max-age=30, s-maxage=${CACHE_TTL}, stale-while-revalidate=${CACHE_TTL}`,
          'CDN-Cache-Control': `max-age=${CACHE_TTL}`,
          'X-Cache-Status': 'MISS',
          'Vary': 'Accept-Encoding',
        },
      });
      // Store in cache (non-blocking)
      ctx.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
      return cachedResponse;
    }

    return response;
  },
};
