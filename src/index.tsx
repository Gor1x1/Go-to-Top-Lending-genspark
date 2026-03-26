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

// Route modules
import { register as registerPublicApi } from './routes/public-api'
import { register as registerPdf } from './routes/pdf'
import { register as registerSeedApi } from './routes/seed-api'
import { register as registerLanding } from './routes/landing'

type Bindings = { DB: D1Database }
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
    const paths = ['/', '/am', '/ru', '/?lang=am', '/?lang=ru'];
    // Also purge versioned cache keys
    const vPaths = paths.map(p => p.includes('?') ? p + '&_cv=' + CACHE_VERSION : p + '?_cv=' + CACHE_VERSION);
    // Purge both primary and secondary domain caches
    const origins = [origin];
    if (!origin.includes('gototop.win')) origins.push('https://gototop.win');
    if (!origin.includes('gototopwb.ru')) origins.push('https://gototopwb.ru');
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

// ===== EDGE CACHE WRAPPER =====
// Wraps the Hono app with Cloudflare Cache API for landing pages.
// Cache key = full URL (normalized). On cache HIT the Worker returns
// immediately without touching D1, giving ~50ms TTFB.
// TTL = 600s (10 min). Admin saves auto-purge via /api/admin middleware.
const CACHE_TTL = 86400; // seconds — edge cache lifetime (24 hours; admin save auto-purges)
const CACHEABLE_PATHS = new Set(['/', '/am', '/ru']);
// Cache version — bump on every deploy to bust stale edge caches
// The version is embedded in the cache key so old cached HTML is never returned.
const CACHE_VERSION = 'v4';

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
          'Cache-Control': `public, max-age=30, s-maxage=${CACHE_TTL}, stale-while-revalidate=86400`,
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
