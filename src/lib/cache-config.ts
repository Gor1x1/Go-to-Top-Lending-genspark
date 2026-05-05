/**
 * Shared cache configuration used by both the main worker (index.tsx) 
 * and admin API (admin.ts) for consistent cache key construction and purging.
 * 
 * IMPORTANT: Bump CACHE_VERSION on every deploy to bust stale edge caches.
 */
export const CACHE_VERSION = 'v11';
export const CACHEABLE_PATHS = [
  '/',
  '/am',
  '/ru',
  '/?lang=am',
  '/?lang=ru',
  '/blog',
  '/about',
  '/buyouts',
  '/services',
  '/faq',
  '/contacts',
  '/referral',
];
export const KNOWN_ORIGINS = ['https://gototopwb.ru', 'https://gototop.win', 'https://gototop-lending.pages.dev'];
