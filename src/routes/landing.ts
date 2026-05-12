/**
 * Landing page HTML generation — main page route with full SSR
 * This is the largest module: generates complete HTML with embedded CSS/JS
 */
import { Hono } from 'hono'
import { html } from 'hono/html'
import { initDatabase } from '../lib/db'
import { SEED_CONTENT_SECTIONS, SEED_CALC_TABS, SEED_CALC_SERVICES, SEED_TG_MESSAGES } from '../seed-data'
import { CACHE_VERSION } from '../lib/cache-config'

type Bindings = { DB: D1Database; MEDIA: R2Bucket }

// =====================================================================
// PLACEHOLDER PAGES (Phase 1C of multi-page rewrite)
// ---------------------------------------------------------------------
// Lightweight, pure-SSR pages for /about, /buyouts, /services, /faq,
// /contacts, /referral. They reuse the same dark theme, header, footer,
// callback popup and bottom-nav as `/` so the public site feels uniform
// while real per-page content is moved over in phase 2.
//
// These pages do NOT touch site_blocks / DB content yet — phase 2 will
// add that. They share only the static landing.js bundle.
// =====================================================================
type PlaceholderPage = 'about' | 'buyouts' | 'services' | 'faq' | 'contacts' | 'referral'

const PLACEHOLDER_PAGE_DATA: Record<PlaceholderPage, {
  path: string,
  title: { ru: string, am: string },
  desc:  { ru: string, am: string },
  body:  { ru: string, am: string },
}> = {
  about: {
    path: '/about',
    title: { ru: 'О нас',  am: 'Մեր մասին' },
    desc:  { ru: 'Команда Go to Top — продвижение Wildberries-карточек под ключ из Еревана.',
             am: 'Go to Top թիմը — Wildberries-ի քարտերի ամբողջական առաջխաղացում Երևանից։' },
    body:  { ru: 'Мы — команда Go to Top из Еревана: продвигаем карточки на Wildberries вживую под ключ.',
             am: 'Մենք Go to Top թիմն ենք Երևանից՝ ամբողջական ձևով առաջխաղացնում ենք Wildberries-ի քարտերը։' },
  },
  buyouts: {
    path: '/buyouts',
    title: { ru: 'Выкупы', am: 'Գնումներ' },
    desc:  { ru: 'Реальные выкупы живыми покупателями для роста позиций и выручки на Wildberries.',
             am: 'Իրական գնումներ կենդանի օգտատերերից Wildberries-ի դիրքերի և շահույթի աճի համար։' },
    body:  { ru: 'Реальные выкупы живыми людьми с историей — растим позиции и выручку на Wildberries.',
             am: 'Իրական գնումներ պատմություն ունեցող կենդանի օգտատերերից՝ բարձրացնում ենք դիրքերը և շահույթը Wildberries-ում։' },
  },
  services: {
    path: '/services',
    title: { ru: 'Услуги', am: 'Ծառայություններ' },
    desc:  { ru: 'Полный пакет услуг по продвижению на Wildberries: выкупы, отзывы, фото, ключевики.',
             am: 'Wildberries-ի առաջխաղացման ամբողջական ծառայություններ՝ գնումներ, կարծիքներ, լուսանկարներ, բանալի բառեր։' },
    body:  { ru: 'Полный пакет: выкупы, отзывы с фото, ключевые запросы и фотосессии под Wildberries.',
             am: 'Ամբողջական փաթեթ՝ գնումներ, լուսանկարներով կարծիքներ, բանալի բառեր և լուսանկարահանումներ Wildberries-ի համար։' },
  },
  faq: {
    path: '/faq',
    title: { ru: 'FAQ',    am: 'Հաճախ տրվող հարցեր' },
    desc:  { ru: 'Ответы на популярные вопросы о выкупах, отзывах и продвижении на Wildberries.',
             am: 'Պատասխաններ Wildberries-ի գնումների, կարծիքների և առաջխաղացման մասին հաճախ տրվող հարցերին։' },
    body:  { ru: 'Здесь будут ответы на популярные вопросы о выкупах, отзывах и продвижении.',
             am: 'Այստեղ կլինեն պատասխանները հաճախ տրվող հարցերին՝ գնումների, կարծիքների և առաջխաղացման մասին։' },
  },
  contacts: {
    path: '/contacts',
    title: { ru: 'Контакты', am: 'Կապ' },
    desc:  { ru: 'Свяжитесь с командой Go to Top: Telegram, WhatsApp и форма обратного звонка.',
             am: 'Կապ հաստատեք Go to Top թիմի հետ՝ Telegram, WhatsApp և հետադարձ զանգի ձև։' },
    body:  { ru: 'Telegram, WhatsApp и форма обратного звонка — выберите удобный способ связи.',
             am: 'Telegram, WhatsApp և հետադարձ զանգի ձև՝ ընտրեք ձեզ հարմար եղանակը։' },
  },
  referral: {
    path: '/referral',
    title: { ru: 'Реферальная программа', am: 'Ուղեկից ծրագիր' },
    desc:  { ru: 'Приглашайте партнёров и получайте бонусы за каждого нового клиента Go to Top.',
             am: 'Հրավիրեք գործընկերներին և ստացեք բոնուսներ Go to Top-ի յուրաքանչյուր նոր հաճախորդի համար։' },
    body:  { ru: 'Делитесь промо-кодом — за каждого приведённого клиента получаете бонус на следующий заказ.',
             am: 'Կիսվեք պրոմո կոդով՝ յուրաքանչյուր նոր հաճախորդի համար ստացեք բոնուս հաջորդ պատվերի վրա։' },
  },
}

// TODO(phase 4): source TG_DEFAULT from `site_blocks` (footer.social_links / contacts) instead of hardcoding.
// Using the same channel that the rest of the site already advertises (header CTA, hero buttons, footer).
const PLACEHOLDER_TG_URL = 'https://t.me/goo_to_top'

/** Preserve path (+ optional `#hash`). Armenian SSR pages use `?lang=am` on internal links so nav matches DB text on first paint. */
function navHrefForLang(lang: 'ru' | 'am', href: string): string {
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/static/')) return href
  if (lang !== 'am') return href
  if (href.includes('lang=')) return href
  const hashIdx = href.indexOf('#')
  const pathPart = hashIdx >= 0 ? href.slice(0, hashIdx) : href
  const hashPart = hashIdx >= 0 ? href.slice(hashIdx + 1) : ''
  const joiner = pathPart.includes('?') ? '&' : '?'
  const withLang = `${pathPart}${joiner}lang=am`
  return hashPart ? `${withLang}#${hashPart}` : withLang
}

/** Bottom-of-page duo cards: links to the two service directions other than `current`. */
function renderSvcTriangleSection(opts: { lang: 'ru' | 'am', current: 'buyouts' | 'reviews' | 'referral' }): string {
  const { lang, current } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => (isAM ? am : ru)
  type Trio = 'buyouts' | 'reviews' | 'referral'
  const cards: Record<Trio, {
    href: string
    img: string
    icon: string
    titleRu: string
    titleAm: string
    descRu: string
    descAm: string
    ctaRu: string
    ctaAm: string
  }> = {
    buyouts: {
      href: navHrefForLang(lang, '/buyouts'),
      img: '/static/img/svc-buyouts.webp',
      icon: 'fa-shopping-cart',
      titleRu: 'Выкупы по ключам и рекламе',
      titleAm: 'Գնումներ բանալի բառերով և գովազդով',
      descRu:
        'Реальные покупки с живых аккаунтов по нужным ключевым словам — ваш товар поднимается в выдаче WB',
      descAm:
        'Իրական գնումներ կենդանի հաշիվներից ձեր անհրաժեշտ բանալի բառերով — ձեր ապրանքը բարձրանում է WB որոնման մեջ',
      ctaRu: 'Подробнее',
      ctaAm: 'Մանրամասն',
    },
    reviews: {
      href: navHrefForLang(lang, '/services/reviews'),
      img: '/static/img/svc-reviews.webp',
      icon: 'fa-star',
      titleRu: 'Отзывы под ключ',
      titleAm: 'Կարծիքներ բանալիով',
      descRu: 'Реальные отзывы с фото и видео от живых покупателей — рейтинг карточки растёт',
      descAm: 'Իրական կարծիքներ լուսանկարներով և տեսանյութերով — քարտի վարկանիշը աճում է',
      ctaRu: 'Подробнее',
      ctaAm: 'Մանրամասն',
    },
    referral: {
      href: navHrefForLang(lang, '/referral'),
      img: '/static/img/svc-referral.webp',
      icon: 'fa-users',
      titleRu: 'Реферальная программа',
      titleAm: 'Ուղեկից ծրագիր',
      descRu: 'Рекомендуйте нас коллегам и зарабатывайте — для агентств, менеджеров и владельцев ресурсов',
      descAm: 'Խորհուրդ տվեք մեզ գործընկերներին և վաստակեք — գործակալությունների և մենեջերների համար',
      ctaRu: 'Перейти',
      ctaAm: 'Անցնել',
    },
  }
  const order: Trio[] = ['buyouts', 'reviews', 'referral']
  const bodies = order
    .filter((k) => k !== current)
    .map((k) => {
      const c = cards[k]
      return `<a href="${c.href}" class="svc-quick-card svc-cross-card">
        <div class="svc-quick-img">
          <img src="${c.img}" alt="${t(c.titleRu, c.titleAm)}" loading="lazy" decoding="async">
        </div>
        <div class="svc-quick-body">
          <div class="svc-quick-icon"><i class="fas ${c.icon}"></i></div>
          <h3 data-ru="${c.titleRu.replace(/"/g, '&quot;')}" data-am="${c.titleAm.replace(/"/g, '&quot;')}">${t(c.titleRu, c.titleAm)}</h3>
          <p data-ru="${c.descRu.replace(/"/g, '&quot;')}" data-am="${c.descAm.replace(/"/g, '&quot;')}">${t(c.descRu, c.descAm)}</p>
          <span class="svc-quick-cta"><span data-ru="${c.ctaRu.replace(/"/g, '&quot;')}" data-am="${c.ctaAm.replace(/"/g, '&quot;')}">${t(c.ctaRu, c.ctaAm)}</span> →</span>
        </div>
      </a>`
    })
    .join('')
  return `
<section class="section svc-triangle-nav" data-section-id="svc-triangle" aria-label="${t('Другие направления', 'Այլ ուղղություններ')}">
  <div class="container">
    <div class="section-header">
      <h2 class="section-title" data-ru="Другие направления" data-am="Այլ ուղղություններ">${t('Другие направления', 'Այլ ուղղություններ')}</h2>
      <p class="section-sub" data-ru="Переходите к подробному описанию других услуг — они работают в связке для роста карточки на WB." data-am="Անցեք այլ ծառայությունների մանրամասն նկարագրությանը — դրանք աշխատում են մեկտեղ քարտի աճի համար։">${t(
        'Переходите к подробному описанию других услуг — они работают в связке для роста карточки на WB.',
        'Անցեք այլ ծառայությունների մանրամասն նկարագրությանը — դրանք աշխատում են մեկտեղ քարտի աճի համար։'
      )}</p>
    </div>
    <div class="svc-quick-grid svc-cross-grid">${bodies}</div>
  </div>
</section>`
}

/**
 * Read the `gtt_lang` cookie from a Hono context. Lets the SSR honour the
 * visitor's last-chosen language even when the URL doesn't carry `?lang=am`
 * — fixes the "loads in RU then flashes to AM" reload bug after switching
 * language. Returns '' when the cookie is missing/invalid so the caller can
 * fall back to URL/path detection.
 */
function readLangCookie(c: { req: { header: (k: string) => string | undefined } }): 'am' | 'ru' | '' {
  try {
    const raw = c.req.header('Cookie') || c.req.header('cookie') || ''
    const m = /(?:^|;\s*)gtt_lang=([^;]+)/i.exec(raw)
    if (!m) return ''
    const v = decodeURIComponent(m[1] || '').toLowerCase()
    if (v === 'am' || v === 'hy') return 'am'
    if (v === 'ru') return 'ru'
  } catch {}
  return ''
}

// =====================================================================
// JSON-LD helpers (Phase 3A.3) — emit Schema.org structured data so search
// engines can render rich results: Organization on `/`, Service on
// /services + /buyouts, BreadcrumbList on every subpage, LocalBusiness +
// ContactPoint on /contacts. Returned strings are ready-to-inject
// `<script type="application/ld+json">…</script>` blocks. We always
// `JSON.stringify` then escape `</` to defend against any chance of the
// payload accidentally closing its surrounding <script>.
// =====================================================================
function _ldScript(obj: unknown): string {
  const safe = JSON.stringify(obj).replace(/<\//g, '<\\/')
  return `<script type="application/ld+json">${safe}</script>`
}

function buildOrganizationLd(siteOrigin: string): string {
  return _ldScript({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Go to Top',
    url: `${siteOrigin}/`,
    logo: `${siteOrigin}/static/img/logo-gototop.webp`,
    description: 'Маркетплейс-агентство в Ереване: продвижение карточек на Wildberries — выкупы живыми людьми, отзывы с фото, фотосессии, фулфилмент.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Yerevan',
      addressRegion: 'Yerevan',
      addressCountry: 'AM',
    },
    contactPoint: [{
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: '+374-55-22-62-24',
      areaServed: ['AM', 'RU'],
      availableLanguage: ['Russian', 'Armenian'],
    }],
    sameAs: [
      'https://t.me/goo_to_top',
      'https://wa.me/37455226224',
    ],
  })
}

function buildServiceLd(opts: {
  siteOrigin: string,
  pagePath: string,
  nameRu: string,
  nameAm: string,
  descriptionRu: string,
  descriptionAm: string,
  serviceType: string,
  isAM: boolean,
}): string {
  const { siteOrigin, pagePath, isAM } = opts
  return _ldScript({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: isAM ? opts.nameAm : opts.nameRu,
    description: isAM ? opts.descriptionAm : opts.descriptionRu,
    serviceType: opts.serviceType,
    url: `${siteOrigin}${pagePath}`,
    provider: {
      '@type': 'Organization',
      name: 'Go to Top',
      url: `${siteOrigin}/`,
    },
    areaServed: [
      { '@type': 'Country', name: 'Russia' },
      { '@type': 'Country', name: 'Armenia' },
    ],
  })
}

function buildLocalBusinessLd(siteOrigin: string): string {
  return _ldScript({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Go to Top',
    image: `${siteOrigin}/static/img/og-image-dark.png`,
    url: `${siteOrigin}/contacts`,
    telephone: '+374-55-22-62-24',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Yerevan',
      addressCountry: 'AM',
    },
    priceRange: '$$',
  })
}

function buildBreadcrumbLd(opts: {
  siteOrigin: string,
  isAM: boolean,
  page: 'about' | 'services' | 'buyouts' | 'faq' | 'contacts' | 'referral' | 'package' | 'service-reviews',
  packageInfo?: { slug: string; titleRu: string; titleAm: string },
}): string {
  const { siteOrigin, isAM, page, packageInfo } = opts
  const homeName = isAM ? 'Գլխավոր' : 'Главная'
  if (page === 'package' && packageInfo) {
    const pkgName = isAM ? (packageInfo.titleAm || packageInfo.titleRu) : packageInfo.titleRu
    return _ldScript({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: homeName, item: `${siteOrigin}/` },
        { '@type': 'ListItem', position: 2, name: isAM ? 'Փաթեթներ' : 'Пакеты', item: `${siteOrigin}/home#packages` },
        { '@type': 'ListItem', position: 3, name: pkgName, item: `${siteOrigin}/package/${packageInfo.slug}` },
      ],
    })
  }
  const pageNames: Record<Exclude<typeof page, 'package'>, { ru: string, am: string }> = {
    about:    { ru: 'О нас',     am: 'Մեր մասին' },
    services: { ru: 'Услуги',    am: 'Ծառայություններ' },
    buyouts:  { ru: 'Выкупы',    am: 'Հետգնում' },
    faq:      { ru: 'FAQ',       am: 'ՀՏՀ' },
    contacts: { ru: 'Контакты',  am: 'Կոնտակտներ' },
    referral: { ru: 'Бонусы',    am: 'Բոնուսներ' },
    'service-reviews': { ru: 'Отзывы под ключ', am: 'Կարծիքներ բանալիով' },
  }
  const pageName = isAM ? pageNames[page as Exclude<typeof page, 'package'>].am : pageNames[page as Exclude<typeof page, 'package'>].ru
  const pagePath = page === 'service-reviews' ? '/services/reviews' : `/${page}`
  return _ldScript({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: homeName, item: `${siteOrigin}/` },
      { '@type': 'ListItem', position: 2, name: pageName, item: `${siteOrigin}${pagePath}` },
    ],
  })
}

// =====================================================================
// renderPageShell
// ---------------------------------------------------------------------
// Shared SSR skeleton for all secondary pages: builds full <html> doc
// with head (meta/SEO/OG/hreflang/CSS), header, footer, popups, bottom-
// nav and the /static/landing.js bundle. Page-specific markup is passed
// as `mainHtml` and rendered inside <main>; `data-page` defaults to shell `page` or `mainDataPage` when set.
//
// Currently consumed by renderPlaceholderPage; phase 2 will route /about,
// /buyouts, /services, /faq, /contacts, /referral content here too. The
// `'home'` literal is reserved for a future migration of `app.get('/')`.
// =====================================================================
export function renderPageShell(opts: {
  page: PlaceholderPage | 'home' | 'home-new' | 'calculator' | 'blog' | 'package',
  lang: 'ru' | 'am',
  siteOrigin: string,
  seo: { title: string, description: string, ogImage?: string },
  bodyClass?: string,
  mainHtml: string,
  extraHead?: string,
  shellBlocks?: Record<string, SubpageBlock>,
  /** When set (e.g. `/services/reviews`), overrides canonical/alternate URLs while `page` still drives chrome (active nav). */
  canonicalPath?: string,
  /** `data-page` on `<main>` for editor.js PAGE scope; defaults to `page`. */
  mainDataPage?: string,
}): string {
  const { page, lang, siteOrigin, seo, mainHtml, shellBlocks } = opts
  const bodyClass = opts.bodyClass || ''
  const extraHead = opts.extraHead || ''
  // Phase 5: 'home-new' is the page literal but its URL is `/home`.
  // Once Phase 6 swaps routing, it will live at '/' and this special-case goes away.
  const path = opts.canonicalPath ?? (page === 'home' ? '/' : page === 'home-new' ? '/home' : `/${page}`)
  const mainPageAttr = opts.mainDataPage ?? page
  const isAM = lang === 'am'
  const htmlLang = isAM ? 'hy' : 'ru'
  const ogLocale = isAM ? 'hy_AM' : 'ru_RU'
  const ogLocaleAlt = isAM ? 'ru_RU' : 'hy_AM'
  // Phase 4 — CMS-aware text helper for shell chrome (nav / footer /
  // modal / floats / bottom). Falls back to hard-coded RU/AM defaults
  // whenever the block is missing, hidden (is_visible=0) or the index
  // is empty so an unseeded DB renders identically to the legacy chrome.
  const tb = (blockKey: string, idx: number, fallbackRu: string, fallbackAm: string): string => {
    const block = shellBlocks?.[blockKey]
    if (!block || block.is_visible === 0) return isAM ? fallbackAm : fallbackRu
    const arr = isAM ? block.texts_am : block.texts_ru
    const v = arr?.[idx]
    return (typeof v === 'string' && v.trim()) ? v : (isAM ? fallbackAm : fallbackRu)
  }
  const ogImage = seo.ogImage || `${siteOrigin}/static/img/og-image-dark.png`
  const canonical = `${siteOrigin}${path}`
  const hrefRu = `${siteOrigin}${path}`
  // /am prefix only exists for the home page; secondary pages use ?lang=am
  // until phase 2 introduces /am/{page} routes.
  const hrefAm = path === '/' ? `${siteOrigin}/am` : `${siteOrigin}${path}?lang=am`

  // server-injected: every page from this shell ships final RU/AM copy
  // (CMS via tb() + inline-editor overrides via applyTextOverridesSSR), so
  // landing.js / editor.js's runtime override pass becomes a no-op visually.
  // No more gtt-loading: hiding <body> until JS ran was the cause of the
  // "black screen between pages" reported by the owner — it traded the old
  // text/photo flicker for an even worse blank page. With SSR-applied
  // overrides the HTML is correct from the first paint, so the body can be
  // shown immediately.
  return `<!DOCTYPE html>
<html lang="${htmlLang}" class="server-injected">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0F0A1A">
<meta name="color-scheme" content="dark">
<title>${seo.title}</title>
<meta name="description" content="${seo.description}">
<meta property="og:title" content="${seo.title}">
<meta property="og:description" content="${seo.description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Go to Top">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${ogLocale}">
<meta property="og:locale:alternate" content="${ogLocaleAlt}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="ru" href="${hrefRu}">
<link rel="alternate" hreflang="hy" href="${hrefAm}">
<link rel="alternate" hreflang="x-default" href="${hrefRu}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${seo.title}">
<meta name="twitter:description" content="${seo.description}">
<meta name="twitter:image" content="${ogImage}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="icon" type="image/x-icon" href="/static/img/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/static/img/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/static/img/apple-touch-icon.png">
<link rel="preload" as="image" href="/static/img/logo-gototop.webp" fetchpriority="high">
<link rel="preload" as="style" href="/static/css/shell-sub.css?v=${CACHE_VERSION}">
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"></noscript>
<link rel="preload" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css"></noscript>
<script type="speculationrules">{"prefetch":[{"source":"document","eagerness":"moderate","where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":["/admin*","/api/*"]}}]}}]}</script>
<link rel="stylesheet" href="/static/css/shell-sub.css?v=${CACHE_VERSION}">
${extraHead}
</head>
<body>

<!-- ===== HEADER (shared with /) ===== -->
<header class="header" id="header">
<div class="container">
<nav class="nav">
  <a href="${navHrefForLang(lang, '/home')}" class="logo">
    <img src="/static/img/logo-gototop.webp" alt="Go to Top">
    <span class="logo-text">Go to Top</span>
  </a>
  <ul class="nav-links" id="navLinks">
    <li><a href="${navHrefForLang(lang, '/home')}"${page === 'home-new' ? ' class="active" aria-current="page"' : ''} data-ru="Главная" data-am="Գլխավոր" data-edit-key="shell__nav" data-edit-idx="0">${tb('shell__nav', 0, 'Главная', 'Գլխավոր')}</a></li>
    <li><a href="${navHrefForLang(lang, '/about')}"${page === 'about' ? ' class="active" aria-current="page"' : ''} data-ru="О нас" data-am="Մեր մասին" data-edit-key="shell__nav" data-edit-idx="1">${tb('shell__nav', 1, 'О нас', 'Մեր մասին')}</a></li>
    <li><a href="${navHrefForLang(lang, '/services')}"${page === 'services' ? ' class="active" aria-current="page"' : ''} data-ru="Услуги" data-am="Ծառայություններ" data-edit-key="shell__nav" data-edit-idx="2">${tb('shell__nav', 2, 'Услуги', 'Ծառայություններ')}</a></li>
    <li><a href="${navHrefForLang(lang, '/buyouts')}"${page === 'buyouts' ? ' class="active" aria-current="page"' : ''} data-ru="Выкупы" data-am="Հետագնումներ" data-edit-key="shell__nav" data-edit-idx="3">${tb('shell__nav', 3, 'Выкупы', 'Հետագնումներ')}</a></li>
    <li><a href="${navHrefForLang(lang, '/calculator')}"${page === 'calculator' ? ' class="active" aria-current="page"' : ''} data-ru="Калькулятор" data-am="Հաշվիչ" data-edit-key="shell__nav" data-edit-idx="4">${tb('shell__nav', 4, 'Калькулятор', 'Հաշվիչ')}</a></li>
    <li><a href="${navHrefForLang(lang, '/faq')}"${page === 'faq' ? ' class="active" aria-current="page"' : ''} data-ru="FAQ" data-am="ՀՏՀ" data-edit-key="shell__nav" data-edit-idx="5">${tb('shell__nav', 5, 'FAQ', 'FAQ')}</a></li>
    <li><a href="${navHrefForLang(lang, '/contacts')}"${page === 'contacts' ? ' class="active" aria-current="page"' : ''} data-ru="Контакты" data-am="Կոնտակտներ" data-edit-key="shell__nav" data-edit-idx="6">${tb('shell__nav', 6, 'Контакты', 'Կոնտակտներ')}</a></li>
    <li><a href="${navHrefForLang(lang, '/referral')}"${page === 'referral' ? ' class="active" aria-current="page"' : ''}>${isAM ? 'Պրոմոկոդներ' : 'Промокоды'}</a></li>
    <li><a href="${navHrefForLang(lang, '/blog')}"${page === 'blog' ? ' class="active" aria-current="page"' : ''} data-ru="Блог" data-am="Բլոգ" data-edit-key="shell__nav" data-edit-idx="7">${tb('shell__nav', 7, 'Блог', 'Բլոգ')}</a></li>
    <li class="nav-mobile-lang">
      <div class="lang-switch">
        <button class="lang-btn${isAM ? '' : ' active'}" data-lang="ru" onclick="switchLang('ru')"><span class="lang-flag"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect width="36" height="8" fill="#fff"/><rect y="8" width="36" height="8" fill="#0039A6"/><rect y="16" width="36" height="8" fill="#D52B1E"/></svg></span><span class="lang-text">RU</span></button>
        <button class="lang-btn${isAM ? ' active' : ''}" data-lang="am" onclick="switchLang('am')"><span class="lang-flag"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect width="36" height="8" fill="#D90012"/><rect y="8" width="36" height="8" fill="#0033A0"/><rect y="16" width="36" height="8" fill="#F2A800"/></svg></span><span class="lang-text">AM</span></button>
      </div>
    </li>
    <li class="nav-mobile-cta"><a href="javascript:void(0)" onclick="openCallbackModal()" class="btn btn-primary"><i class="fas fa-phone"></i> <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք" data-edit-key="shell__nav" data-edit-idx="8">${tb('shell__nav', 8, 'Перезвоните мне', 'Հետ զանգահարեք')}</span></a></li>
  </ul>
  <div class="nav-right">
    <div class="lang-switch">
      <button class="lang-btn${isAM ? '' : ' active'}" data-lang="ru" onclick="switchLang('ru')"><span class="lang-flag"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect width="36" height="8" fill="#fff"/><rect y="8" width="36" height="8" fill="#0039A6"/><rect y="16" width="36" height="8" fill="#D52B1E"/></svg></span><span class="lang-text">RU</span></button>
      <button class="lang-btn${isAM ? ' active' : ''}" data-lang="am" onclick="switchLang('am')"><span class="lang-flag"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect width="36" height="8" fill="#D90012"/><rect y="8" width="36" height="8" fill="#0033A0"/><rect y="16" width="36" height="8" fill="#F2A800"/></svg></span><span class="lang-text">AM</span></button>
    </div>
    <a href="javascript:void(0)" onclick="openCallbackModal()" class="nav-cta">
      <i class="fas fa-phone"></i>
      <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք" data-edit-key="shell__nav" data-edit-idx="8">${tb('shell__nav', 8, 'Перезвоните мне', 'Հետ զանգահարեք')}</span>
    </a>
  </div>
  <button class="hamburger" id="hamburger" onclick="toggleMenu()">
    <span></span><span></span><span></span>
  </button>
</nav>
</div>
</header>

<!-- ===== PAGE MAIN ===== -->
<main class="${bodyClass}" data-page="${mainPageAttr}">
${mainHtml}
</main>

<!-- ===== FOOTER (shared with /) ===== -->
<footer class="footer">
<div class="container">
  <div class="footer-grid">
    <div class="footer-brand">
      <div class="logo"><img src="/static/img/logo-gototop.webp" alt="Go to Top" style="height:44px"><span class="logo-text">Go to Top</span></div>
      <p data-ru="Безопасное продвижение на Wildberries для армянских продавцов." data-am="Անվտանգ առաջխաղացում Wildberries-ում հայ վաճառողների համար։" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="0">${tb('shell__footer', 0, 'Безопасное продвижение на Wildberries для армянских продавцов.', 'Անվտանգ առաջխաղացում Wildberries-ում հայ վաճառողների համար։')}</p>
    </div>
    <div class="footer-col">
      <h4 data-ru="Навигация" data-am="Նավիգացիա" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="1">${tb('shell__footer', 1, 'Навигация', 'Նավիգացիա')}</h4>
      <ul>
        <li><a href="${navHrefForLang(lang, '/services')}" data-ru="Услуги и цены" data-am="Ծառայություններ և գներ" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="2">${tb('shell__footer', 2, 'Услуги и цены', 'Ծառայություններ և գներ')}</a></li>
        <li><a href="${navHrefForLang(lang, '/calculator')}" data-ru="Калькулятор" data-am="Հաշվիչ" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="3">${tb('shell__footer', 3, 'Калькулятор', 'Հաշվիչ')}</a></li>
        <li><a href="${navHrefForLang(lang, '/#warehouse')}" data-ru="Наш склад" data-am="Մեր պահեստը" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="4">${tb('shell__footer', 4, 'Наш склад', 'Մեր պահեստը')}</a></li>
        <li><a href="${navHrefForLang(lang, '/#guarantee')}" data-ru="Гарантии" data-am="Երաշխիքներ" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="5">${tb('shell__footer', 5, 'Гарантии', 'Երաշխիքներ')}</a></li>
        <li><a href="${navHrefForLang(lang, '/faq')}" data-ru="FAQ" data-am="ՀՏՀ" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="6">${tb('shell__footer', 6, 'FAQ', 'ՀՏՀ')}</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4 data-ru="Контакты" data-am="Կոնտակտներ" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="7">${tb('shell__footer', 7, 'Контакты', 'Կոնտակտներ')}</h4>
      <ul>
        <li><a href="${PLACEHOLDER_TG_URL}" target="_blank" rel="noopener"><i class="fab fa-telegram"></i> <span data-ru="Администратор" data-am="Ադմինիստրատոր" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="8">${tb('shell__footer', 8, 'Администратор', 'Ադմինիստրատոր')}</span></a></li>
        <li><a href="https://t.me/suport_admin_2" target="_blank" rel="noopener"><i class="fab fa-telegram"></i> <span data-ru="Менеджер" data-am="Մենեջեր" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="9">${tb('shell__footer', 9, 'Менеджер', 'Մենեջեր')}</span></a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Go to Top. <span data-ru="Все права защищены" data-am="Բոլոր իրավունքները պաշտպանված են" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="10">${tb('shell__footer', 10, 'Все права защищены', 'Բոլոր իրավունքները պաշտպանված են')}</span></span>
    <span data-ru="Ереван, Армения" data-am="Երևան, Հայաստան" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="11">${tb('shell__footer', 11, 'Ереван, Армения', 'Երևան, Հայաստան')}</span>
  </div>
</div>
</footer>

<!-- FLOATING TG BUTTON -->
<a href="https://wa.me/37455226224" target="_blank" rel="noopener" class="tg-float">
  <i class="fab fa-whatsapp"></i>
  <span data-ru="Написать нам" data-am="Գրել հիմա" data-no-rewrite="1" data-edit-key="shell__floats" data-edit-idx="0">${tb('shell__floats', 0, 'Написать нам', 'Գրել հիմա')}</span>
</a>

<!-- FLOATING CALC BUTTON -->
<a href="${navHrefForLang(lang, '/#calculator')}" class="calc-float" id="calcFloatBtn">
  <i class="fas fa-calculator"></i>
  <span data-ru="Калькулятор" data-am="Հաշվիչ" data-no-rewrite="1" data-edit-key="shell__floats" data-edit-idx="1">${tb('shell__floats', 1, 'Калькулятор', 'Հաշվիչ')}</span>
</a>

<!-- CALLBACK MODAL (shared with /) -->
<div id="callbackModal" class="popup-overlay" onclick="if(event.target===this)closeCallbackModal()">
  <div class="popup-card" id="callbackCard">
    <button class="popup-close" onclick="closeCallbackModal()" aria-label="Закрыть">&times;</button>
    <div class="popup-icon"><i class="fas fa-phone-alt"></i></div>
    <h3 data-ru="Перезвоните мне" data-am="Հետ զանգահարեք" data-edit-key="shell__modal" data-edit-idx="0">${tb('shell__modal', 0, 'Перезвоните мне', 'Հետ զանգահարեք')}</h3>
    <p class="popup-sub" data-ru="Оставьте заявку — мы свяжемся в удобное для вас время" data-am="Թողեք հայտ — կզանգահարենք ձեզ հարմար ժամանակ" data-edit-key="shell__modal" data-edit-idx="1">${tb('shell__modal', 1, 'Оставьте заявку — мы свяжемся в удобное для вас время', 'Թողեք հայտ — կզանգահարենք ձեզ հարմար ժամանակ')}</p>
    <form id="callbackForm" onsubmit="submitCallbackForm(event)">
      <div class="pf-group">
        <label class="pf-label" data-ru="Ваше имя *" data-am="Ձեր անունը *" data-edit-key="shell__modal" data-edit-idx="2">${tb('shell__modal', 2, 'Ваше имя *', 'Ձեր անունը *')}</label>
        <input type="text" id="cb_name" class="pf-input" placeholder="${tb('shell__modal', 6, 'Иван Иванов', 'Անուն Ազգանուն')}" required>
      </div>
      <div class="pf-group">
        <label class="pf-label" data-ru="Номер телефона *" data-am="Հեռախոսահամար *" data-edit-key="shell__modal" data-edit-idx="3">${tb('shell__modal', 3, 'Номер телефона *', 'Հեռախոսահամար *')}</label>
        <input type="tel" id="cb_phone" class="pf-input" placeholder="${tb('shell__modal', 7, '+7 (___) ___-__-__', '+374 __ ______')}" required>
      </div>
      <div class="pf-group">
        <label class="pf-label" data-ru="Удобное время для звонка" data-am="Հարմարավետ ժամ զանգի համար" data-edit-key="shell__modal" data-edit-idx="4">${tb('shell__modal', 4, 'Удобное время для звонка', 'Հարմարավետ ժամ զանգի համար')}</label>
        <input type="text" id="cb_time" class="pf-input" placeholder="${tb('shell__modal', 8, 'Например: после 18:00', 'Օրինակ՝ 18:00-ից հետո')}">
      </div>
      <div class="pf-group">
        <label class="pf-label" data-ru="Ваш вопрос (необязательно)" data-am="Ձեր հարցը (ոչ պարտադիր)" data-edit-key="shell__modal" data-edit-idx="5">${tb('shell__modal', 5, 'Ваш вопрос (необязательно)', 'Ձեր հարցը (ոչ պարտադիր)')}</label>
        <textarea id="cb_question" class="pf-input" rows="3" placeholder="${tb('shell__modal', 9, 'Кратко опишите, что хотите обсудить...', 'Կարճ նկարագրեք, ինչ եք ուզում քննարկել...')}" style="resize:vertical;min-height:72px"></textarea>
      </div>
      <div id="callbackResult" style="display:none;padding:12px;border-radius:8px;margin-bottom:12px;font-size:0.88rem;text-align:center"></div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px">
        <i class="fas fa-paper-plane"></i>
        <span data-ru="Отправить заявку" data-am="Ուղարկել հայտը" data-edit-key="shell__modal" data-edit-idx="10">${tb('shell__modal', 10, 'Отправить заявку', 'Ուղարկել հայտը')}</span>
      </button>
    </form>
  </div>
</div>

<!-- ===== INLINE BULLETPROOF COUNTER TRIGGER (shared shell) =====
     Animates every [data-count] / [data-count-s] number on the page within
     ~80-2000ms regardless of IntersectionObserver, opacity reveals or
     deferred landing.js execution. Idempotent: skips elements already
     marked counterDone="1" by landing.js so it never restarts a running
     tween. Lives in the shared shell so /home, /about, /services,
     /buyouts and every other subpage gets the same guarantee. -->
<script>
(function(){
  function _animate(el, target, suffix){
    if (el.dataset.counterDone === '1') return;
    el.dataset.counterDone = '1';
    if (!target || target <= 0) { el.textContent = '0' + (suffix || ''); return; }
    var dur = 1800, start = performance.now();
    function step(now){
      var p = Math.min((now - start) / dur, 1);
      var v = Math.floor(target * (1 - Math.pow(1 - p, 3)));
      try { el.textContent = v.toLocaleString('ru-RU') + (suffix || ''); }
      catch(_){ el.textContent = v + (suffix || ''); }
      if (p < 1) requestAnimationFrame(step);
      else { try { el.textContent = target.toLocaleString('ru-RU') + (suffix || ''); }
            catch(_){ el.textContent = target + (suffix || ''); } }
    }
    requestAnimationFrame(step);
  }
  function _fire(){
    document.querySelectorAll('.stat-num[data-count], .ah-stat-num[data-count]').forEach(function(el){
      _animate(el, parseInt(el.getAttribute('data-count')) || 0, '');
    });
    document.querySelectorAll('.stat-big[data-count-s], .ah-stat-num[data-count-s]').forEach(function(el){
      var hasPlus = (el.textContent || '').indexOf('+') !== -1;
      _animate(el, parseInt(el.getAttribute('data-count-s')) || 0, hasPlus ? '+' : '');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(_fire, 80); });
  } else { setTimeout(_fire, 80); }
  setTimeout(_fire, 600);
  setTimeout(_fire, 2000);
})();
</script>

<script src="/static/editor.js?v=${CACHE_VERSION}" defer></script>
<script src="/static/landing.js?v=${CACHE_VERSION}" defer></script>

<!-- Bottom Navigation Bar (mobile) — Phase 3A: links point to actual subpages
     so highlightActiveNav() in landing.js can mark the current page active. -->
<nav class="bottom-nav" id="bottomNav">
<div class="bottom-nav-items">
  <a href="${navHrefForLang(lang, '/home')}" class="bottom-nav-item"><i class="fas fa-home"></i><span data-ru="Главная" data-am="Գլխավոր" data-edit-key="shell__bottom" data-edit-idx="0">${tb('shell__bottom', 0, 'Главная', 'Գլխավոր')}</span></a>
  <a href="${navHrefForLang(lang, '/services')}" class="bottom-nav-item"><i class="fas fa-hand-holding"></i><span data-ru="Услуги" data-am="Ծառայություններ" data-edit-key="shell__bottom" data-edit-idx="1">${tb('shell__bottom', 1, 'Услуги', 'Ծառայություններ')}</span></a>
  <a href="${navHrefForLang(lang, '/buyouts')}" class="bottom-nav-item"><i class="fas fa-shopping-cart"></i><span data-ru="Выкупы" data-am="Հետագնումներ" data-edit-key="shell__bottom" data-edit-idx="2">${tb('shell__bottom', 2, 'Выкупы', 'Հետագնումներ')}</span></a>
  <a href="${navHrefForLang(lang, '/calculator')}" class="bottom-nav-item"><i class="fas fa-calculator"></i><span data-ru="Калькулятор" data-am="Հաշվիչ" data-edit-key="shell__bottom" data-edit-idx="3">${tb('shell__bottom', 3, 'Калькулятор', 'Հաշվիչ')}</span></a>
  <button class="bottom-nav-item bottom-nav-more" id="bottomNavMore" onclick="toggleBottomMore()"><i class="fas fa-ellipsis-h"></i><span data-ru="Ещё" data-am="Ավելին" data-edit-key="shell__bottom" data-edit-idx="4">${tb('shell__bottom', 4, 'Ещё', 'Ավելին')}</span>
    <div class="bottom-nav-more-menu" id="bottomMoreMenu">
      <a href="${navHrefForLang(lang, '/about')}"><i class="fas fa-info-circle"></i><span data-ru="О нас" data-am="Մեր մասին" data-edit-key="shell__bottom" data-edit-idx="5">${tb('shell__bottom', 5, 'О нас', 'Մեր մասին')}</span></a>
      <a href="${navHrefForLang(lang, '/faq')}"><i class="fas fa-question-circle"></i><span data-ru="FAQ" data-am="ՀՏՀ" data-edit-key="shell__bottom" data-edit-idx="6">${tb('shell__bottom', 6, 'FAQ', 'ՀՏՀ')}</span></a>
      <a href="${navHrefForLang(lang, '/contacts')}"><i class="fas fa-envelope"></i><span data-ru="Контакты" data-am="Կոնտակտներ" data-edit-key="shell__bottom" data-edit-idx="7">${tb('shell__bottom', 7, 'Контакты', 'Կոնտակտներ')}</span></a>
      <a href="${navHrefForLang(lang, '/referral')}"><i class="fas fa-gift"></i><span data-ru="Бонусы" data-am="Բոնուսներ" data-edit-key="shell__bottom" data-edit-idx="8">${tb('shell__bottom', 8, 'Бонусы', 'Բոնուսներ')}</span></a>
      <a href="${navHrefForLang(lang, '/blog')}"><i class="fas fa-newspaper"></i><span data-ru="Блог" data-am="Բլոգ" data-edit-key="shell__bottom" data-edit-idx="9">${tb('shell__bottom', 9, 'Блог', 'Բլոգ')}</span></a>
    </div>
  </button>
</div>
</nav>

<!-- ===== POPUP (5 sec) — shared with long landing ===== -->
<div class="popup-overlay" id="popupOverlay">
  <div class="popup-card">
    <button class="popup-close" id="popupCloseBtn">✕</button>
    <div id="popupFormWrap">
      <div class="popup-icon"><i class="fas fa-chart-line"></i></div>
      <h3 data-ru="Повысь рейтинг магазина прямо сейчас!" data-am="Բարձրացրեք խանութի վարկանիշը հիմա!">${isAM ? 'Բարձրացրեք խանութի վարկանիշը հիմա!' : 'Повысь рейтинг магазина прямо сейчас!'}</h3>
      <p class="popup-sub" data-ru="Выкупы живыми людьми, отзывы с фото, профессиональные фотосессии. Узнайте сколько это стоит!" data-am="Անձնական մենեջերը կկապվի ձեզ և կպատրաստի անհատական հաշվարկ">Персональный менеджер свяжется с вами и подготовит индивидуальный расчёт</p>
      <form id="popupForm">
        <div class="pf-group">
          <label class="pf-label" data-ru="Ваше имя" data-am="Ձեր անունը" data-no-rewrite="1">${isAM ? 'Ձեր անունը' : 'Ваше имя'}</label>
          <input class="pf-input" type="text" id="popupName" required placeholder="Имя" data-placeholder-ru="Имя" data-placeholder-am="Անուն">
        </div>
        <div class="pf-row">
          <div class="pf-group">
            <label class="pf-label" data-ru="Сколько выкупов нужно?" data-am="Քանի գնում է պետք։">${isAM ? 'Քանի գնում է պետք։' : 'Сколько выкупов нужно?'}</label>
            <input class="pf-input" type="number" id="popupBuyouts" min="0" placeholder="Напр: 20" required data-placeholder-ru="Напр: 20" data-placeholder-am="Օրինակ: 20">
          </div>
          <div class="pf-group">
            <label class="pf-label" data-ru="Сколько отзывов нужно?" data-am="Քանի կարծիք է պետք։">${isAM ? 'Քանի կարծիք է պետք։' : 'Сколько отзывов нужно?'}</label>
            <input class="pf-input" type="number" id="popupReviews" min="0" placeholder="Напр: 10" required data-placeholder-ru="Напр: 10" data-placeholder-am="Օրինակ: 10">
          </div>
        </div>
        <div class="pf-group">
          <label class="pf-label" data-ru="Ваш номер телефона" data-am="Ձեր հեռախոսահամարը">${isAM ? 'Ձեր հեռախոսահամարը' : 'Ваш номер телефона'}</label>
          <input class="pf-input" type="tel" id="popupPhone" required>
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px">
          <i class="fas fa-paper-plane"></i>
          <span data-ru="Получить мою стратегию" data-am="Ստանալ իմ ռազմավարությունը">${isAM ? 'Ստանալ իմ ռազմավարությունը' : 'Получить мою стратегию'}</span>
        </button>
      </form>
    </div>
    <div class="popup-success" id="popupSuccess">
      <i class="fas fa-check-circle"></i>
      <h4 data-ru="Заявка отправлена!" data-am="Հայտը ուղարկված է!">${isAM ? 'Հայտը ուղարկված է!' : 'Заявка отправлена!'}</h4>
      <p data-ru="Менеджер свяжется с вами в ближайшее время" data-am="Մենեջերը կկապվի ձեզ մոտակա ժամանակից">${isAM ? 'Մենեջերը կկապվի ձեզ մոտակա ժամանակից' : 'Менеджер свяжется с вами в ближайшее время'}</p>
    </div>
  </div>
</div>
</body>
</html>`
}

// =====================================================================
// renderPlaceholderPage — phase 1 fallback for /about /buyouts /services
// /faq /contacts /referral. Builds the placeholder-card markup and hands
// it to renderPageShell which owns the surrounding skeleton.
// =====================================================================
function renderPlaceholderPage(opts: {
  page: PlaceholderPage,
  lang: 'ru' | 'am',
  siteOrigin: string,
  shellBlocks?: Record<string, SubpageBlock>,
}): string {
  const { page, lang, siteOrigin, shellBlocks } = opts
  const data = PLACEHOLDER_PAGE_DATA[page]
  const isAM = lang === 'am'
  const title = isAM ? data.title.am : data.title.ru
  const desc = isAM ? data.desc.am : data.desc.ru
  const body = isAM ? data.body.am : data.body.ru
  const fullTitle = `${title} — Go to Top`

  const mainHtml = `  <div class="container">
    <div class="placeholder-card">
      <span class="placeholder-eyebrow" data-ru="Страница" data-am="Էջ">${isAM ? 'Էջ' : 'Страница'}</span>
      <h1 data-ru="${data.title.ru}" data-am="${data.title.am}"><span class="gr">${title}</span></h1>
      <p data-ru="${data.body.ru}" data-am="${data.body.am}">${body}</p>
      <div class="placeholder-cta">
        <a href="${navHrefForLang(lang, '/#calculator')}" class="btn btn-primary">
          <i class="fas fa-calculator"></i>
          <span data-ru="Калькулятор" data-am="Հաշվիչ">Калькулятор</span>
        </a>
        <a href="javascript:void(0)" onclick="openCallbackModal()" class="btn btn-outline">
          <i class="fas fa-phone"></i>
          <span data-ru="Перезвоните мне" data-am="Կզանգահարեն">Перезвоните мне</span>
        </a>
        <a href="${PLACEHOLDER_TG_URL}" target="_blank" rel="noopener" class="btn btn-tg">
          <i class="fab fa-telegram"></i>
          <span data-ru="Telegram чат" data-am="Telegram զրույց">Telegram чат</span>
        </a>
      </div>
      <a href="${navHrefForLang(lang, '/home')}" class="placeholder-back">
        <i class="fas fa-arrow-left"></i>
        <span data-ru="На главную" data-am="Գլխավոր էջ">На главную</span>
      </a>
    </div>
  </div>`

  return renderPageShell({
    page,
    lang,
    siteOrigin,
    seo: { title: fullTitle, description: desc },
    bodyClass: 'placeholder-page',
    mainHtml,
    shellBlocks,
  })
}

// =====================================================================
// loadSubpageBlocks — Phase 3C subpage CMS loader.
// Fetches all rows from site_blocks where block_key starts with
// `<page>__` and returns a Record<blockKey -> SubpageBlock>. Returns {}
// on any error (network, schema mismatch, missing seed) so render
// functions can transparently fall back to hard-coded defaults.
//
// SQLite LIKE treats '_' as a single-char wildcard, so `<prefix>__%`
// would match e.g. "aboutXY...". We pass the LIKE pattern through but
// also re-filter rows in JS using startsWith(prefix + '__') to enforce
// an exact literal match. This avoids relying on ESCAPE clauses, which
// are awkward to thread through D1's parameterised LIKE.
// =====================================================================
export interface SubpageBlock {
  texts_ru: string[]
  texts_am: string[]
  title_ru: string
  title_am: string
  is_visible: number
}

export async function loadSubpageBlocks(
  db: D1Database | undefined,
  pagePrefix: string
): Promise<Record<string, SubpageBlock>> {
  const out: Record<string, SubpageBlock> = {}
  if (!db) return out
  try {
    const stmt = db.prepare(
      "SELECT block_key, title_ru, title_am, texts_ru, texts_am, is_visible FROM site_blocks WHERE block_key LIKE ? ORDER BY sort_order"
    )
    const result = await stmt.bind(`${pagePrefix}__%`).all()
    const rows = (result.results || []).filter((r: any) =>
      typeof r.block_key === 'string' && r.block_key.startsWith(`${pagePrefix}__`)
    )
    for (const r of rows) {
      const key = r.block_key as string
      let textsRu: string[] = []
      let textsAm: string[] = []
      try { textsRu = JSON.parse((r.texts_ru as string) || '[]') } catch { textsRu = [] }
      try { textsAm = JSON.parse((r.texts_am as string) || '[]') } catch { textsAm = [] }
      if (!Array.isArray(textsRu)) textsRu = []
      if (!Array.isArray(textsAm)) textsAm = []
      out[key] = {
        texts_ru: textsRu,
        texts_am: textsAm,
        title_ru: (r.title_ru as string) || '',
        title_am: (r.title_am as string) || '',
        is_visible: Number(r.is_visible) || 0,
      }
    }
  } catch {
    return out
  }
  return out
}

// =====================================================================
// loadShellBlocks — Phase 4 wrapper around loadSubpageBlocks for the
// `shell__*` family (header nav, footer, callback modal, floating
// buttons, mobile bottom-nav). Consumed by renderPageShell so chrome
// strings can be CMS-overridden without touching the SSR template.
// =====================================================================
export async function loadShellBlocks(db: D1Database | undefined): Promise<Record<string, SubpageBlock>> {
  return loadSubpageBlocks(db, 'shell')
}

// =====================================================================
// loadChromeNavData — loads the `nav` and `floating_tg` blocks (and the
// `shell__nav` fallback) from `site_blocks` so the same admin-managed
// header / footer / bottom-nav can be rendered on the legacy `/` page
// AND on every renderPageShell subpage. This is what makes nav edits on
// `/` propagate to `/home`, `/about`, etc. — and vice-versa.
// =====================================================================
export interface ChromeNavBlock {
  texts_ru: string[]
  texts_am: string[]
  nav_links: Array<{ idx: number, target: string }>
  buttons: Array<{ text_ru?: string, text_am?: string, url?: string, icon?: string }>
}

export async function loadChromeNavData(db: D1Database | undefined): Promise<{
  nav: ChromeNavBlock | null,
  floatingTg: ChromeNavBlock | null,
}> {
  const out = { nav: null as ChromeNavBlock | null, floatingTg: null as ChromeNavBlock | null }
  if (!db) return out
  try {
    const result = await db.prepare(
      "SELECT block_key, texts_ru, texts_am, custom_html, buttons FROM site_blocks WHERE block_key IN ('nav', 'shell__nav', 'floating_tg') AND is_visible = 1"
    ).all()
    const map: Record<string, ChromeNavBlock> = {}
    for (const r of (result.results || []) as any[]) {
      let textsRu: string[] = []
      let textsAm: string[] = []
      let custom: any = {}
      let btns: any[] = []
      try { textsRu = JSON.parse((r.texts_ru as string) || '[]') } catch {}
      try { textsAm = JSON.parse((r.texts_am as string) || '[]') } catch {}
      try { custom = JSON.parse((r.custom_html as string) || '{}') } catch {}
      try { btns = JSON.parse((r.buttons as string) || '[]') } catch {}
      if (!Array.isArray(textsRu)) textsRu = []
      if (!Array.isArray(textsAm)) textsAm = []
      if (!Array.isArray(btns)) btns = []
      map[r.block_key as string] = {
        texts_ru: textsRu,
        texts_am: textsAm,
        nav_links: Array.isArray(custom.nav_links) ? custom.nav_links : [],
        buttons: btns,
      }
    }
    // Prefer shell__nav when populated, fall back to legacy `nav` so admins
    // who edited either surface continue to see their changes everywhere.
    const shellNav = map['shell__nav']
    const legacyNav = map['nav']
    out.nav = (shellNav && shellNav.texts_ru && shellNav.texts_ru.length > 0)
      ? shellNav
      : (legacyNav && legacyNav.texts_ru && legacyNav.texts_ru.length > 0 ? legacyNav : null)
    out.floatingTg = map['floating_tg'] || null
  } catch {
    return out
  }
  return out
}

// =====================================================================
// applySharedChromeNav — single source of truth for header nav, footer
// nav and mobile bottom-nav. Builds the markup from the `nav` (or
// `shell__nav`) site_block and rewrites the corresponding sections in
// the rendered HTML in place. Every generated <a> gets
// `data-edit-key="shell__nav"` + `data-edit-idx="${i}"` so inline-editor
// text edits save under the shared `shell` namespace and propagate to
// every other page (applyTextOverridesSSR loads `page=? OR page='shell'`).
//
// `isLegacyHome` controls anchor href shape:
//   - On `/` (legacy home), local targets render as `#about` so in-page
//     scroll still works.
//   - On every other surface (`/home`, `/about`, …) local targets render
//     as `/#about` so the click jumps back to the relevant home section.
//   - Absolute URLs (http(s)://…) and `/blog`-style paths pass through
//     unchanged regardless of surface.
// =====================================================================
export function applySharedChromeNav(
  html: string,
  navBlock: ChromeNavBlock | null,
  floatingTgBlock: ChromeNavBlock | null,
  isArmenian: boolean,
  isLegacyHome: boolean
): string {
  if (!navBlock || !navBlock.texts_ru || navBlock.texts_ru.length === 0) return html

  const defaultTargets = ['about', 'services', 'calculator', 'warehouse', 'guarantee', 'faq', 'contact']
  const navTargetMap: Record<number, string> = {}
  for (const nl of (navBlock.nav_links || [])) navTargetMap[nl.idx] = nl.target || ''

  type NavItem = { ru: string, am: string, target: string, idx: number }
  const navItems: NavItem[] = []
  for (let i = 0; i < navBlock.texts_ru.length; i++) {
    const ru = navBlock.texts_ru[i] || ''
    const am = (navBlock.texts_am && navBlock.texts_am[i]) || ''
    if (!ru && !am) continue
    let target = navTargetMap[i] || (i < defaultTargets.length ? defaultTargets[i] : '')
    target = target.replace(/_/g, '-')
    if (target === '-telegram' || target === '-cta') continue
    navItems.push({ ru, am, target, idx: i })
  }
  if (navItems.length === 0) return html

  const esc = (s: string) => s.replace(/"/g, '&quot;')
  const hrefForTarget = (t: string): string => {
    if (!t) return '#'
    if (/^https?:\/\//i.test(t)) return t
    if (t.charAt(0) === '/') return t
    return isLegacyHome ? `#${t}` : `/#${t}`
  }

  // ---- Header nav (<ul class="nav-links" id="navLinks">) ----
  let headerNavHtml = ''
  for (const item of navItems) {
    const navText = isArmenian ? (item.am || item.ru) : item.ru
    headerNavHtml += `    <li><a href="${hrefForTarget(item.target)}" data-ru="${esc(item.ru)}" data-am="${esc(item.am || '')}" data-edit-key="shell__nav" data-edit-idx="${item.idx}">${navText}</a></li>\n`
  }
  const floatBtn = floatingTgBlock?.buttons?.[0]
  const mobCtaUrl = floatBtn?.url || 'https://wa.me/37455226224'
  const mobCtaRu = floatBtn?.text_ru || 'Написать нам'
  const mobCtaAm = floatBtn?.text_am || 'Գրել հիմա'
  const mobCtaIcon = floatBtn?.icon || 'fab fa-whatsapp'
  const mobCtaText = isArmenian ? mobCtaAm : mobCtaRu
  headerNavHtml += `    <li class="nav-mobile-cta"><a href="${mobCtaUrl}" target="_blank" class="btn btn-primary"><i class="${mobCtaIcon}"></i> <span data-ru="${esc(mobCtaRu)}" data-am="${esc(mobCtaAm)}" data-no-rewrite="1">${mobCtaText}</span></a></li>`

  const headerNavMatch = html.match(/<ul class="nav-links" id="navLinks">[\s\S]*?<\/ul>/)
  if (headerNavMatch) {
    // #region agent log (v55 unified nav probe — remove after verification)
    html = html.replace(headerNavMatch[0], `<ul class="nav-links" id="navLinks" data-gtt-nav-v55="${navItems.length}-${isLegacyHome ? 'legacy' : 'sub'}">\n${headerNavHtml}\n  </ul>`)
    // #endregion
  }

  // ---- Footer nav (<ul id="footerNavList">) ----
  let footerNavHtml = ''
  for (const item of navItems) {
    if (!item.target || item.target.charAt(0) === '_') continue
    const footNavText = isArmenian ? (item.am || item.ru) : item.ru
    footerNavHtml += `        <li><a href="${hrefForTarget(item.target)}" data-ru="${esc(item.ru)}" data-am="${esc(item.am || '')}" data-no-rewrite="1" data-edit-key="shell__nav" data-edit-idx="${item.idx}">${footNavText}</a></li>\n`
  }
  const footerNavMatch = html.match(/<ul id="footerNavList">[\s\S]*?<\/ul>/)
  if (footerNavMatch) {
    html = html.replace(footerNavMatch[0], `<ul id="footerNavList">\n${footerNavHtml}      </ul>`)
  }

  // ---- Mobile bottom nav (<nav class="bottom-nav" id="bottomNav">) ----
  const bottomNavIcons: Record<string, string> = {
    'about': 'fas fa-info-circle', 'services': 'fas fa-hand-holding',
    'calculator': 'fas fa-calculator', 'warehouse': 'fas fa-warehouse',
    'guarantee': 'fas fa-shield-alt', 'faq': 'fas fa-question-circle',
    'contact': 'fas fa-envelope', 'client-reviews': 'fas fa-star',
    'fifty-vs-fifty': 'fas fa-person-circle-question', 'why-buyouts': 'fas fa-person-circle-question'
  }
  const mainBottomItems = navItems.slice(0, 4)
  const moreBottomItems = navItems.slice(4)
  let bottomHtml = '<div class="bottom-nav-items">\n'
  for (const item of mainBottomItems) {
    const icon = bottomNavIcons[item.target] || 'fas fa-link'
    const text = isArmenian ? (item.am || item.ru) : item.ru
    bottomHtml += `  <a href="${hrefForTarget(item.target)}" class="bottom-nav-item"><i class="${icon}"></i><span data-ru="${esc(item.ru)}" data-am="${esc(item.am || '')}" data-edit-key="shell__nav" data-edit-idx="${item.idx}">${text}</span></a>\n`
  }
  if (moreBottomItems.length > 0) {
    const moreText = isArmenian ? '\u0531\u057E\u0565\u056C\u056B\u0576' : '\u0415\u0449\u0451'
    bottomHtml += `  <button class="bottom-nav-item bottom-nav-more" id="bottomNavMore" onclick="toggleBottomMore()"><i class="fas fa-ellipsis-h"></i><span data-ru="\u0415\u0449\u0451" data-am="\u0531\u057E\u0565\u056C\u056B\u0576">${moreText}</span>\n`
    bottomHtml += `    <div class="bottom-nav-more-menu" id="bottomMoreMenu">\n`
    for (const item of moreBottomItems) {
      const icon = bottomNavIcons[item.target] || 'fas fa-link'
      const text = isArmenian ? (item.am || item.ru) : item.ru
      bottomHtml += `      <a href="${hrefForTarget(item.target)}"><i class="${icon}"></i><span data-ru="${esc(item.ru)}" data-am="${esc(item.am || '')}" data-edit-key="shell__nav" data-edit-idx="${item.idx}">${text}</span></a>\n`
    }
    bottomHtml += `    </div>\n  </button>\n`
  }
  bottomHtml += '</div>'
  const bottomNavMatch = html.match(/<nav class="bottom-nav" id="bottomNav">[\s\S]*?<\/nav>/)
  if (bottomNavMatch) {
    html = html.replace(bottomNavMatch[0], `<nav class="bottom-nav" id="bottomNav">\n${bottomHtml}\n</nav>`)
  }

  return html
}

// =====================================================================
// loadCustomBlocks — Phase 5.1: blocks added through the inline editor's
// "+ Добавить блок". Returned in sort_order so the renderer can splice
// them into the page near the requested anchor (`position_after`) or
// append them at the bottom when the anchor is missing.
// =====================================================================
export interface CustomBlock {
  id: number
  page: string
  position_after: string
  title_ru: string
  title_am: string
  text_ru: string
  text_am: string
  button_text_ru: string
  button_text_am: string
  button_url: string
  is_visible: number
  sort_order: number
}

export async function loadCustomBlocks(
  db: D1Database | undefined,
  page: string
): Promise<CustomBlock[]> {
  if (!db) return []
  try {
    const res = await db.prepare(
      'SELECT * FROM site_custom_blocks WHERE page = ? AND is_visible = 1 ORDER BY sort_order, id'
    ).bind(page).all()
    return (res.results || []) as unknown as CustomBlock[]
  } catch {
    return []
  }
}

// Render a single custom block as a styled section. Includes data-edit-text
// ids so the inline editor can edit its texts AFTER reload.
export function renderCustomBlock(b: CustomBlock, lang: 'ru' | 'am'): string {
  const isAM = lang === 'am'
  const title = isAM ? (b.title_am || b.title_ru) : (b.title_ru || b.title_am)
  const text = isAM ? (b.text_am || b.text_ru) : (b.text_ru || b.text_am)
  const btnText = isAM ? (b.button_text_am || b.button_text_ru) : (b.button_text_ru || b.button_text_am)
  const blockKey = `${b.page}__custom_${b.id}`
  const esc = (s: string) => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return `
<section class="section gtt-custom-block" data-block-key="${esc(blockKey)}" data-custom-block-id="${b.id}">
  <div class="container">
    <div class="gtt-custom-card">
      <h2 data-ru="${esc(b.title_ru)}" data-am="${esc(b.title_am)}" data-edit-text="${esc(blockKey)}__title">${esc(title)}</h2>
      <p data-ru="${esc(b.text_ru)}" data-am="${esc(b.text_am)}" data-edit-text="${esc(blockKey)}__text">${esc(text)}</p>
      ${btnText ? `<a href="${esc(b.button_url || '#')}" class="btn btn-primary" data-edit-text="${esc(blockKey)}__btn"><span data-ru="${esc(b.button_text_ru)}" data-am="${esc(b.button_text_am)}">${esc(btnText)}</span></a>` : ''}
    </div>
  </div>
</section>
<style>
.gtt-custom-block{padding:60px 0}
.gtt-custom-card{max-width:880px;margin:0 auto;text-align:center;padding:40px 32px;background:var(--bg-card,#1A1128);border:1px solid var(--border,rgba(139,92,246,0.15));border-radius:24px}
.gtt-custom-card h2{font-size:clamp(1.6rem,3.5vw,2.4rem);font-weight:800;margin-bottom:18px;background:linear-gradient(135deg,#8B5CF6,#A78BFA);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.gtt-custom-card p{font-size:1.05rem;color:var(--text-sec,#A5A0B8);line-height:1.7;margin-bottom:24px}
</style>
`
}

export function renderCustomBlocksHtml(blocks: CustomBlock[], lang: 'ru' | 'am'): string {
  if (!blocks || blocks.length === 0) return ''
  return blocks.map(b => renderCustomBlock(b, lang)).join('\n')
}

// =====================================================================
// renderAboutPage — phase 2A "light" page for /about.
// Reuses three sections from `/`: hero (founder), #about (who we are),
// #guarantee (team & office). No full calculator — only a compact CTA
// strip at the bottom (calculator anchor / Telegram / callback modal).
// All copy is bilingual via data-ru / data-am; the visible text is
// rendered server-side in the requested language so SEO sees real content
// without relying on the client switchLang() pass.
// =====================================================================
function renderAboutPage(opts: { lang: 'ru' | 'am', siteOrigin: string, pageBlocks?: Record<string, SubpageBlock>, shellBlocks?: Record<string, SubpageBlock> }): string {
  const { lang, siteOrigin, pageBlocks, shellBlocks } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru
  // Phase 3C: tb() reads a single string from a CMS block (texts_ru/am
  // arrays) and falls back to the hard-coded RU/AM defaults whenever the
  // block is missing, hidden (is_visible=0) or the index is empty.
  const tb = (blockKey: string, idx: number, fallbackRu: string, fallbackAm: string): string => {
    const block = pageBlocks?.[blockKey]
    if (!block || block.is_visible === 0) return isAM ? fallbackAm : fallbackRu
    const arr = isAM ? block.texts_am : block.texts_ru
    const v = arr?.[idx]
    return (typeof v === 'string' && v.trim()) ? v : (isAM ? fallbackAm : fallbackRu)
  }

  const seo = {
    title: t(
      'О компании — Go to Top | Маркетплейс-агентство',
      'Մեր մասին — Go to Top | Մարքեթփլեյս գործակալություն'
    ),
    description: t(
      'Go to Top — маркетплейс-агентство в Ереване: 1000+ аккаунтов, собственный склад, команда с опытом Wildberries',
      'Go to Top — մարքեթփլեյս գործակալություն Երևանում: հազարից ավելի հաշիվ, սեփական պահեստ, թիմ Wildberries-ի փորձով'
    ),
    ogImage: `${siteOrigin}/static/img/og-image.png`,
  }

  // Page-only styles. Reuses --purple/--bg-card/--text/etc tokens that
  // renderPageShell already declared in :root.
  const extraHead = `<link rel="stylesheet" href="/static/css/page-about.css?v=${CACHE_VERSION}">`

  const mainHtml = `
<!-- ===== ABOUT HERO ===== -->
<section class="about-hero">
  <div class="container">
    <div class="ah-grid">
      <div class="ah-text">
        <div class="ah-eyebrow">
          <i class="fas fa-info-circle"></i>
          <span data-ru="О компании" data-am="Ընկերության մասին" data-edit-key="about__hero" data-edit-idx="0">${tb('about__hero', 0, 'О компании', 'Ընկերության մասին')}</span>
        </div>
        <h1>
          <span data-ru="О компании" data-am="Go to Top-ի մասին" data-edit-key="about__hero" data-edit-idx="1">${tb('about__hero', 1, 'О компании', 'Go to Top-ի մասին')}</span>
          <span class="gr" data-ru="Go to Top" data-am="Go to Top" data-edit-key="about__hero" data-edit-idx="2">${tb('about__hero', 2, 'Go to Top', 'Go to Top')}</span>
        </h1>
        <p class="ah-desc" data-ru="Маркетплейс-агентство из Еревана: продвигаем карточки на Wildberries вживую под ключ — выкупы реальными людьми, отзывы с фото, фотосессии и работа по ключевым запросам. Собственный склад, 1000+ аккаунтов и команда с опытом WB с 2021 года." data-am="Մարքեթփլեյս գործակալություն Երևանից՝ Wildberries-ի քարտերի ամբողջական առաջխաղացում իրական մարդկանցով։ Գնումներ, լուսանկարներով կարծիքներ, լուսանկարահանումներ և բանալի բառերով աշխատանք։ Սեփական պահեստ, 1000+ հաշիվ և թիմ՝ WB-ի փորձով 2021 թվականից։" data-edit-key="about__hero" data-edit-idx="3">${tb('about__hero', 3, 'Маркетплейс-агентство из Еревана: продвигаем карточки на Wildberries вживую под ключ — выкупы реальными людьми, отзывы с фото, фотосессии и работа по ключевым запросам. Собственный склад, 1000+ аккаунтов и команда с опытом WB с 2021 года.', 'Մարքեթփլեյս գործակալություն Երևանից՝ Wildberries-ի քարտերի ամբողջական առաջխաղացում իրական մարդկանցով։ Գնումներ, լուսանկարներով կարծիքներ, լուսանկարահանումներ և բանալի բառերով աշխատանք։ Սեփական պահեստ, 1000+ հաշիվ և թիմ՝ WB-ի փորձով 2021 թվականից։')}</p>
        <div class="ah-stats">
          <div class="ah-stat">
            <div class="ah-stat-num" data-count="847">0</div>
            <div class="ah-stat-label" data-ru="товаров в ТОП" data-am="ապրանք TOP-ում">${t('товаров в ТОП', 'ապրանք TOP-ում')}</div>
          </div>
          <div class="ah-stat">
            <div class="ah-stat-num" data-count-s="1000">0+</div>
            <div class="ah-stat-label" data-ru="реальных аккаунтов" data-am="իրական հաշիվ">${t('реальных аккаунтов', 'իրական հաշիվ')}</div>
          </div>
          <div class="ah-stat">
            <div class="ah-stat-num" data-count="0">0</div>
            <div class="ah-stat-label" data-ru="блокировок с 2021" data-am="արգելափակում 2021-ից">${t('блокировок с 2021', 'արգելափակում 2021-ից')}</div>
          </div>
        </div>
        <div class="ah-cta">
          <a href="/services" class="btn btn-primary btn-lg">
            <i class="fas fa-box-open"></i>
            <span data-ru="Открыть пакеты услуг" data-am="Բացել ծառայությունների փաթեթները">${t('Открыть пакеты услуг', 'Բացել ծառայությունների փաթեթները')}</span>
          </a>
          <a href="${PLACEHOLDER_TG_URL}" target="_blank" rel="noopener" class="btn btn-tg btn-lg">
            <i class="fab fa-telegram"></i>
            <span data-ru="Написать в Telegram" data-am="Գրել Telegram-ով">${t('Написать в Telegram', 'Գրել Telegram-ով')}</span>
          </a>
        </div>
      </div>
      <div class="ah-image">
        <img src="/static/img/founder.webp" alt="${t('Основатель Go to Top', 'Go to Top-ի հիմնադիրը')}" loading="eager" fetchpriority="high" decoding="async">
      </div>
    </div>
  </div>
</section>

<!-- ===== WHO WE ARE ===== -->
<section class="about-section">
  <div class="container">
    <div class="as-grid">
      <div class="as-image">
        <img src="/static/img/about-hero2.webp" alt="${t('Go to Top — о компании', 'Go to Top — ընկերության մասին')}" loading="lazy">
      </div>
      <div class="as-text">
        <div class="as-eyebrow">
          <i class="fas fa-rocket"></i>
          <span data-ru="Кто мы" data-am="Ով ենք մենք">${t('Кто мы', 'Ով ենք մենք')}</span>
        </div>
        <h2 data-ru="Что такое" data-am="Ի՞նչ է Go to Top-ը">${t('Что такое', 'Ի՞նչ է')} <span class="gr">Go to Top</span>?</h2>
        <p data-ru="«Go to Top» — сервис развития Вашего бизнеса на маркетплейсах с помощью комплексного продвижения и услуги выкупов по ключевым словам. Для долгосрочного закрепления товара в TOPе." data-am="«Go to Top» — ձեր բիզնեսի զարգացման ծառայություն մարքեթփլեյսներում՝ համալիր առաջխաղացման և բանալի բառերով գնումների միջոցով։ Ապրանքի երկարատև ամրապնդման համար TOP-ում։">${t('«Go to Top» — сервис развития Вашего бизнеса на маркетплейсах с помощью комплексного продвижения и услуги выкупов по ключевым словам. Для долгосрочного закрепления товара в TOPе.', '«Go to Top» — ձեր բիզնեսի զարգացման ծառայություն մարքեթփլեյսներում՝ համալիր առաջխաղացման և բանալի բառերով գնումների միջոցով։ Ապրանքի երկարատև ամրապնդման համար TOP-ում։')}</p>
        <div class="as-card">
          <div class="as-card-title">
            <i class="fas fa-star"></i>
            <strong data-ru="Наши сильные стороны" data-am="Մեր ուժեղ կողմերը">${t('Наши сильные стороны', 'Մեր ուժեղ կողմերը')}</strong>
          </div>
          <ul class="as-list">
            <li><i class="fas fa-check-circle"></i><span data-ru="Собственный склад и офис в Ереване" data-am="Սեփական պահեստ և գրասենյակ Երևանում">${t('Собственный склад и офис в Ереване', 'Սեփական պահեստ և գրասենյակ Երևանում')}</span></li>
            <li><i class="fas fa-check-circle"></i><span data-ru="1000+ реальных аккаунтов, 0 блокировок" data-am="1000+ իրական հաշիվ, 0 արգելափակում">${t('1000+ реальных аккаунтов, 0 блокировок', '1000+ իրական հաշիվ, 0 արգելափակում')}</span></li>
            <li><i class="fas fa-check-circle"></i><span data-ru="Работаем с 2021 года — 847 товаров в ТОП" data-am="Աշխատում ենք 2021-ից — 847 ապրանք TOP-ում">${t('Работаем с 2021 года — 847 товаров в ТОП', 'Աշխատում ենք 2021-ից — 847 ապրանք TOP-ում')}</span></li>
            <li><i class="fas fa-check-circle"></i><span data-ru="Всё вручную, только по ключевым словам" data-am="Ամեն ինչ ձեռքով, միայն բանալի բառերով">${t('Всё вручную, только по ключевым словам', 'Ամեն ինչ ձեռքով, միայն բանալի բառերով')}</span></li>
          </ul>
        </div>
        <div class="as-card green">
          <div class="as-card-title">
            <i class="fas fa-gift"></i>
            <strong data-ru="Что получает клиент" data-am="Ինչ է ստանում հաճախորդը">${t('Что получает клиент', 'Ինչ է ստանում հաճախորդը')}</strong>
          </div>
          <ul class="as-list">
            <li><i class="fas fa-chart-line"></i><span data-ru="Рост рейтинга товара на Wildberries" data-am="Ապրանքի վարկանիշի աճ Wildberries-ում">${t('Рост рейтинга товара на Wildberries', 'Ապրանքի վարկանիշի աճ Wildberries-ում')}</span></li>
            <li><i class="fas fa-chart-line"></i><span data-ru="Органический трафик и долгосрочный ТОП" data-am="Օրգանական տրաֆիկ և երկարատև TOP">${t('Органический трафик и долгосрочный ТОП', 'Օրգանական տրաֆիկ և երկարատև TOP')}</span></li>
            <li><i class="fas fa-chart-line"></i><span data-ru="Реальные отзывы с фото и видео" data-am="Իրական կարծիքներ լուսանկարներով և տեսանյութերով">${t('Реальные отзывы с фото и видео', 'Իրական կարծիքներ լուսանկարներով և տեսանյութերով')}</span></li>
            <li><i class="fas fa-chart-line"></i><span data-ru="Индивидуальный подход, без блокировок" data-am="Անհատական մոտեցում, առանց արգելափակումների">${t('Индивидуальный подход, без блокировок', 'Անհատական մոտեցում, առանց արգելափակումների')}</span></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== TEAM & OFFICE ===== -->
<section class="about-section flip">
  <div class="container">
    <div class="as-grid">
      <div class="as-text">
        <div class="as-eyebrow">
          <i class="fas fa-shield-alt"></i>
          <span data-ru="Команда и офис" data-am="Թիմ և գրասենյակ">${t('Команда и офис', 'Թիմ և գրասենյակ')}</span>
        </div>
        <h2 data-ru="Всё организовано и по полочкам. Наша команда" data-am="Ամեն ինչ կազմակերպված է և կարգավորված։ Մեր թիմը">${t('Всё организовано и по полочкам. Наша команда', 'Ամեն ինչ կազմակերպված է և կարգավորված։ Մեր թիմը')}</h2>
        <p data-ru="За всё время работы ни один кабинет клиента не получил блокировку. Каждый проект ведётся опытной командой с полным контролем на каждом этапе." data-am="Աշխատանքի ողջ ընթացքում ոչ մի հաճախորդի հաշիվ չի արգելափակվել: Յուրաքանչյուր նախագիծ վարվում է փորձառու թիմի կողմից լիարժեք վերահսկողությամբ յուրաքանչյուր փուլում:">${t('За всё время работы ни один кабинет клиента не получил блокировку. Каждый проект ведётся опытной командой с полным контролем на каждом этапе.', 'Աշխատանքի ողջ ընթացքում ոչ մի հաճախորդի հաշիվ չի արգելափակվել: Յուրաքանչյուր նախագիծ վարվում է փորձառու թիմի կողմից լիարժեք վերահսկողությամբ յուրաքանչյուր փուլում:')}</p>
        <ul class="as-list">
          <li><i class="fas fa-check-circle"></i><span data-ru="Реальное поведение человека во время выкупа" data-am="Իրական մարդկային վարքագիծ գնում կատարելիս">${t('Реальное поведение человека во время выкупа', 'Իրական մարդկային վարքագիծ գնում կատարելիս')}</span></li>
          <li><i class="fas fa-check-circle"></i><span data-ru="Реальные аккаунты с историей покупок" data-am="Իրական հաշիվներ գնումների պատմությամբ">${t('Реальные аккаунты с историей покупок', 'Իրական հաշիվներ գնումների պատմությամբ')}</span></li>
          <li><i class="fas fa-check-circle"></i><span data-ru="Естественное распределение по географии" data-am="Բնական աշխարհագրական բաշխում">${t('Естественное распределение по географии', 'Բնական աշխարհագրական բաշխում')}</span></li>
        </ul>
        <div class="as-badge-flag">
          <i class="fas fa-award"></i>
          <span data-ru="0 блокировок за всё время работы" data-am="0 արգելափակում աշխատանքի ողջ ընթացքում">${t('0 блокировок за всё время работы', '0 արգելափակում աշխատանքի ողջ ընթացքում')}</span>
        </div>
      </div>
      <div class="as-image">
        <img src="/static/img/team-office.webp" alt="${t('Команда Go to Top', 'Go to Top թիմը')}" loading="lazy">
      </div>
    </div>
  </div>
</section>

<!-- ===== LIGHT CTA STRIP ===== -->
<section class="about-cta-strip">
  <div class="container">
    <div class="acs-card">
      <div class="acs-text">
        <h3 data-ru="Готовы начать?" data-am="Պատրա՞ստ եք սկսել" data-edit-key="about__cta_strip" data-edit-idx="0">${tb('about__cta_strip', 0, 'Готовы начать?', 'Պատրա՞ստ եք սկսել')}</h3>
        <p data-ru="Откройте калькулятор, напишите в Telegram или закажите обратный звонок — мы подберём пакет под вашу задачу." data-am="Բացեք հաշվիչը, գրեք Telegram-ով կամ պատվիրեք հետադարձ զանգ — մենք կընտրենք փաթեթ ձեր խնդրի համար։" data-edit-key="about__cta_strip" data-edit-idx="1">${tb('about__cta_strip', 1, 'Откройте калькулятор, напишите в Telegram или закажите обратный звонок — мы подберём пакет под вашу задачу.', 'Բացեք հաշվիչը, գրեք Telegram-ով կամ պատվիրեք հետադարձ զանգ — մենք կընտրենք փաթեթ ձեր խնդրի համար։')}</p>
      </div>
      <div class="acs-actions">
        <a href="${navHrefForLang(lang, '/#calculator')}" class="btn btn-primary">
          <i class="fas fa-calculator"></i>
          <span data-ru="Открыть калькулятор" data-am="Բացել հաշվիչը" data-edit-key="about__cta_strip" data-edit-idx="2">${tb('about__cta_strip', 2, 'Открыть калькулятор', 'Բացել հաշվիչը')}</span>
        </a>
        <a href="${PLACEHOLDER_TG_URL}" target="_blank" rel="noopener" class="btn btn-tg">
          <i class="fab fa-telegram"></i>
          <span data-ru="Telegram" data-am="Telegram">Telegram</span>
        </a>
        <button type="button" class="btn btn-outline" onclick="openCallbackModal()">
          <i class="fas fa-phone"></i>
          <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք">${t('Перезвоните мне', 'Հետ զանգահարեք')}</span>
        </button>
      </div>
    </div>
  </div>
</section>
`

  // SEO: BreadcrumbList lets Google render a "Home > About" trail in search.
  const jsonLd = buildBreadcrumbLd({ siteOrigin, isAM, page: 'about' })

  return renderPageShell({
    page: 'about',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'about-page',
    mainHtml,
    extraHead: extraHead + jsonLd,
    shellBlocks,
  })
}

// =====================================================================
// renderPackagePage — Phase 3 detail page for landing packages.
// Renders /package/:slug. The current package is loaded by the route
// handler in src/routes/landing.ts and passed in via `pkg`. Other
// visible packages (max 2) are passed via `otherPackages` for the
// "Другие пакеты" cross-link grid. Falls back to a 404 if pkg is null.
// =====================================================================
export function renderPackagePage(opts: {
  lang: 'ru' | 'am',
  siteOrigin: string,
  pkg: {
    id: number; slug: string; cover_url: string;
    title_ru: string; title_am: string;
    description_ru: string; description_am: string;
    price_text_ru: string; price_text_am: string;
  },
  otherPackages: Array<{
    id: number; slug: string; cover_url: string;
    title_ru: string; title_am: string;
  }>,
  pageBlocks?: Record<string, SubpageBlock>,
  shellBlocks?: Record<string, SubpageBlock>,
}): string {
  const { lang, siteOrigin, pkg, otherPackages, pageBlocks, shellBlocks } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru
  // Phase 4 — CMS-aware text helper for /package/:slug chrome.
  // Reads from package__chrome (loaded by the route handler) and
  // falls back to hardcoded RU/AM defaults whenever the block is
  // missing, hidden (is_visible=0) or the index is empty.
  const tb = (blockKey: string, idx: number, fallbackRu: string, fallbackAm: string): string => {
    const block = pageBlocks?.[blockKey]
    if (!block || block.is_visible === 0) return isAM ? fallbackAm : fallbackRu
    const arr = isAM ? block.texts_am : block.texts_ru
    const v = arr?.[idx]
    return (typeof v === 'string' && v.trim()) ? v : (isAM ? fallbackAm : fallbackRu)
  }
  const tgUrl = 'https://t.me/gototop_consultant'

  const titleRu = pkg.title_ru || ''
  const titleAm = pkg.title_am || titleRu
  const descRu = pkg.description_ru || ''
  const descAm = pkg.description_am || descRu
  const priceRu = pkg.price_text_ru || ''
  const priceAm = pkg.price_text_am || priceRu
  const cover = pkg.cover_url || '/static/img/svc-buyouts.webp'
  const escTitle = (s: string) => (s || '').replace(/"/g, '&quot;')

  const seo = {
    title: t(`${titleRu} — Go to Top`, `${titleAm} — Go to Top`),
    description: t(
      descRu.slice(0, 160),
      descAm.slice(0, 160) || descRu.slice(0, 160),
    ),
    ogImage: cover.startsWith('http') ? cover : `${siteOrigin}${cover}`,
  }

  const extraHead = `<link rel="stylesheet" href="/static/css/page-package.css?v=${CACHE_VERSION}">`

  // Product JSON-LD — packages are offerings
  const productLd = _ldScript({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: t(titleRu, titleAm),
    description: t(descRu, descAm).slice(0, 500),
    image: cover.startsWith('http') ? cover : `${siteOrigin}${cover}`,
    brand: { '@type': 'Brand', name: 'Go to Top' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'AMD',
      url: `${siteOrigin}/package/${pkg.slug}`,
      availability: 'https://schema.org/InStock',
      description: t(priceRu, priceAm),
    },
  })
  const breadcrumbLd = buildBreadcrumbLd({
    siteOrigin,
    isAM,
    page: 'package',
    packageInfo: { slug: pkg.slug, titleRu, titleAm },
  })

  const otherCards = otherPackages.slice(0, 4).map(o => {
    const oTitle = isAM ? (o.title_am || o.title_ru) : o.title_ru
    const oCover = o.cover_url || '/static/img/svc-buyouts.webp'
    return `<a class="pkg-other-card" href="/package/${encodeURIComponent(o.slug)}${isAM ? '?lang=am' : ''}">
      <div class="pkg-other-thumb"><img src="${oCover}" alt="${escTitle(oTitle)}" loading="lazy" decoding="async"></div>
      <div class="pkg-other-body">
        <h3>${oTitle.replace(/</g, '&lt;')}</h3>
        <span><span data-ru="Подробнее" data-am="Մանրամասն" data-edit-key="package__chrome" data-edit-idx="6">${tb('package__chrome', 6, 'Подробнее', 'Մանրամասն')}</span> <i class="fas fa-arrow-right"></i></span>
      </div>
    </a>`
  }).join('')

  const mainHtml = `
<section class="pkg-detail-hero">
  <div class="container">
    <a class="pkg-back" href="/home${isAM ? '?lang=am' : ''}">
      <i class="fas fa-arrow-left"></i>
      <span data-ru="Все пакеты" data-am="Բոլոր փաթեթները" data-edit-key="package__chrome" data-edit-idx="0">${tb('package__chrome', 0, 'Все пакеты', 'Բոլոր փաթեթները')}</span>
    </a>
    <div class="pkg-detail-grid">
      <div class="pkg-detail-image">
        <img src="${cover}" alt="${escTitle(t(titleRu, titleAm))}" loading="eager" decoding="async">
      </div>
      <div class="pkg-detail-text">
        <div class="pkg-eyebrow"><i class="fas fa-cube"></i> <span data-ru="Пакет" data-am="Փաթեթ" data-edit-key="package__chrome" data-edit-idx="1">${tb('package__chrome', 1, 'Пакет', 'Փաթեթ')}</span></div>
        <h1 data-ru="${escTitle(titleRu)}" data-am="${escTitle(titleAm)}"><span class="gr">${t(titleRu, titleAm)}</span></h1>
        <p class="pkg-desc" data-ru="${escTitle(descRu)}" data-am="${escTitle(descAm)}">${t(descRu, descAm)}</p>
        ${(priceRu || priceAm) ? `<div class="pkg-price">
          <span class="pkg-price-label" data-ru="Стоимость" data-am="Արժեք" data-edit-key="package__chrome" data-edit-idx="2">${tb('package__chrome', 2, 'Стоимость', 'Արժեք')}</span>
          <span class="pkg-price-value" data-ru="${escTitle(priceRu)}" data-am="${escTitle(priceAm)}">${t(priceRu, priceAm)}</span>
        </div>` : ''}
        <div class="pkg-detail-actions">
          <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-primary">
            <i class="fab fa-telegram"></i>
            <span data-ru="Заказать пакет" data-am="Պատվիրել փաթեթ" data-edit-key="package__chrome" data-edit-idx="3">${tb('package__chrome', 3, 'Заказать пакет', 'Պատվիրել փաթեթ')}</span>
          </a>
          <a href="/calculator${isAM ? '?lang=am' : ''}" class="btn btn-secondary">
            <i class="fas fa-calculator"></i>
            <span data-ru="Рассчитать стоимость" data-am="Հաշվարկել արժեքը" data-edit-key="package__chrome" data-edit-idx="4">${tb('package__chrome', 4, 'Рассчитать стоимость', 'Հաշվարկել արժեքը')}</span>
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

${otherPackages.length > 0 ? `
<section class="pkg-others">
  <div class="container">
    <h2 data-ru="Другие пакеты" data-am="Այլ փաթեթներ" data-edit-key="package__chrome" data-edit-idx="5">${tb('package__chrome', 5, 'Другие пакеты', 'Այլ փաթեթներ')}</h2>
    <div class="pkg-others-grid">${otherCards}</div>
  </div>
</section>
` : ''}
`

  return renderPageShell({
    page: 'package',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'pkg-page',
    mainHtml,
    extraHead: extraHead + productLd + breadcrumbLd,
    shellBlocks,
  })
}

// =====================================================================
// renderServicesPage — phase 2B "heavy" page for /services.
// Reuses sections from `/`: quick service cards, detailed services, the
// FULL calculator (tabs / prices / packages / promo code) and the 5-step
// process. The calculator works against `window.__SITE_DATA` injected
// post-SSR by the /services route handler (mirrors the `/` route).
// All copy is bilingual via data-ru / data-am with the requested
// language rendered server-side so SEO sees real content.
// =====================================================================
function renderServicesPage(opts: { lang: 'ru' | 'am', siteOrigin: string, pageBlocks?: Record<string, SubpageBlock>, shellBlocks?: Record<string, SubpageBlock> }): string {
  const { lang, siteOrigin, pageBlocks, shellBlocks } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru
  const tb = (blockKey: string, idx: number, fallbackRu: string, fallbackAm: string): string => {
    const block = pageBlocks?.[blockKey]
    if (!block || block.is_visible === 0) return isAM ? fallbackAm : fallbackRu
    const arr = isAM ? block.texts_am : block.texts_ru
    const v = arr?.[idx]
    return (typeof v === 'string' && v.trim()) ? v : (isAM ? fallbackAm : fallbackRu)
  }

  const seo = {
    title: t(
      'Услуги — Go to Top | для продавцов Wildberries',
      'Ծառայություններ — Go to Top | Wildberries-ի համար'
    ),
    description: t(
      'Услуги для продавцов Wildberries: выкупы, отзывы, ключевые слова. Рассчитайте стоимость в калькуляторе',
      'Wildberries-ի վաճառողների համար ծառայություններ. Հետագնումներ, կարծիքներ, հիմնաբառեր. Հաշվարկեք արժեքը կալկուլյատորում'
    ),
    ogImage: `${siteOrigin}/static/img/og-image.png`,
  }

  // Page-only styles. Reuses --purple/--bg-card/--text/etc tokens that
  // renderPageShell already declared in :root. Includes the full calc-* /
  // svc-* / process-grid CSS subset copied from the `/` SSR styles so
  // the calculator + service cards render correctly without depending on
  // the home page stylesheet.
  const extraHead = `<link rel="stylesheet" href="/static/css/page-services.css?v=${CACHE_VERSION}">`

  const tgUrl = PLACEHOLDER_TG_URL
  const managerTgUrl = 'https://t.me/suport_admin_2'

  const mainHtml = `
<!-- ===== SERVICES HERO ===== -->
<section class="svc-hero">
  <div class="container">
    <div class="sh-inner">
      <div class="sh-eyebrow">
        <i class="fas fa-th-large"></i>
        <span data-ru="Наши услуги" data-am="Մեր ծառայությունները" data-edit-key="services__hero" data-edit-idx="0">${tb('services__hero', 0, 'Наши услуги', 'Մեր ծառայությունները')}</span>
      </div>
      <h1>
        <span data-ru="Услуги" data-am="Ծառայություններ" data-edit-key="services__hero" data-edit-idx="1">${tb('services__hero', 1, 'Услуги', 'Ծառայություններ')}</span>
        <span class="gr" data-ru="для Wildberries" data-am="Wildberries-ի համար" data-edit-key="services__hero" data-edit-idx="2">${tb('services__hero', 2, 'для Wildberries', 'Wildberries-ի համար')}</span>
      </h1>
      <p class="sh-desc" data-ru="Выкупы реальными людьми, отзывы с фото и работа по ключевым запросам — полный пакет продвижения карточек на Wildberries. Рассчитайте стоимость в калькуляторе или соберите готовый пакет." data-am="Իրական մարդկանցով գնումներ, լուսանկարներով կարծիքներ և բանալի բառերով աշխատանք — Wildberries-ի քարտերի առաջխաղացման ամբողջական փաթեթ։ Հաշվեք արժեքը հաշվիչում կամ ընտրեք պատրաստի փաթեթ։" data-edit-key="services__hero" data-edit-idx="3">${tb('services__hero', 3, 'Выкупы реальными людьми, отзывы с фото и работа по ключевым запросам — полный пакет продвижения карточек на Wildberries. Рассчитайте стоимость в калькуляторе или соберите готовый пакет.', 'Իրական մարդկանցով գնումներ, լուսանկարներով կարծիքներ և բանալի բառերով աշխատանք — Wildberries-ի քարտերի առաջխաղացման ամբողջական փաթեթ։ Հաշվեք արժեքը հաշվիչում կամ ընտրեք պատրաստի փաթեթ։')}</p>
      <div class="sh-cta">
        <a href="#calculator" class="btn btn-primary btn-lg">
          <i class="fas fa-calculator"></i>
          <span data-ru="Открыть калькулятор" data-am="Բացել հաշվիչը">${t('Открыть калькулятор', 'Բացել հաշվիչը')}</span>
        </a>
        <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-tg btn-lg">
          <i class="fab fa-telegram"></i>
          <span data-ru="Написать в Telegram" data-am="Գրել Telegram-ով">${t('Написать в Telegram', 'Գրել Telegram-ով')}</span>
        </a>
      </div>
    </div>
  </div>
</section>

<!-- ===== QUICK SERVICE CARDS ===== -->
<section class="section" id="svc-cards" data-section-id="svc-cards">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-th-large"></i> <span data-ru="Что мы делаем" data-am="Ինչ ենք անում">${t('Что мы делаем', 'Ինչ ենք անում')}</span></div>
      <h2 class="section-title" data-ru="Три направления роста" data-am="Աճի երեք ուղղություն">${t('Три направления роста', 'Աճի երեք ուղղություն')}</h2>
      <p class="section-sub" data-ru="Кликните карточку, чтобы перейти к деталям и пакетам" data-am="Սեղմեք քարտի վրա մանրամասներին և փաթեթներին անցնելու համար">${t('Кликните карточку, чтобы перейти к деталям и пакетам', 'Սեղմեք քարտի վրա մանրամասներին և փաթեթներին անցնելու համար')}</p>
    </div>
    <div class="svc-quick-grid">
      <a href="${navHrefForLang(lang, '/buyouts')}" class="svc-quick-card">
        <div class="svc-quick-img">
          <img src="/static/img/svc-buyouts.webp" alt="${t('Выкупы по ключам', 'Գնումներ բանալի բառերով')}" loading="eager" fetchpriority="high">
        </div>
        <div class="svc-quick-body">
          <div class="svc-quick-icon"><i class="fas fa-shopping-cart"></i></div>
          <h3 data-ru="Выкупы по ключам и рекламе" data-am="Գնումներ բանալի բառերով և գովազդով">${t('Выкупы по ключам и рекламе', 'Գնումներ բանալի բառերով և գովազդով')}</h3>
          <p data-ru="Реальные покупки с живых аккаунтов по нужным ключевым словам — ваш товар поднимается в выдаче WB" data-am="Իրական գնումներ կենդանի հաշիվներից ձեր անհրաժեշտ բանալի բառերով — ձեր ապրանքը բարձրանում է WB որոնման մեջ">${t('Реальные покупки с живых аккаунтов по нужным ключевым словам — ваш товар поднимается в выдаче WB', 'Իրական գնումներ կենդանի հաշիվներից ձեր անհրաժեշտ բանալի բառերով — ձեր ապրանքը բարձրանում է WB որոնման մեջ')}</p>
          <span class="svc-quick-cta"><span data-ru="Подробнее" data-am="Մանրամասն">${t('Подробнее', 'Մանրամասն')}</span> →</span>
        </div>
      </a>
      <a href="${navHrefForLang(lang, '/services/reviews')}" class="svc-quick-card">
        <div class="svc-quick-img">
          <img src="/static/img/svc-reviews.webp" alt="${t('Отзывы под ключ', 'Կարծիքներ բանալիով')}" loading="lazy">
        </div>
        <div class="svc-quick-body">
          <div class="svc-quick-icon"><i class="fas fa-star"></i></div>
          <h3 data-ru="Отзывы под ключ" data-am="Կարծիքներ բանալիով">${t('Отзывы под ключ', 'Կարծիքներ բանալիով')}</h3>
          <p data-ru="Реальные отзывы с фото и видео от живых покупателей — рейтинг карточки растёт, доверие клиентов увеличивается" data-am="Իրական կարծիքներ լուսանկարներով և տեսանյութերով կենդանի հաճախորդներից — քարտի վարկանիշը աճում է, հաճախորդների վստահությունը մեծանում">${t('Реальные отзывы с фото и видео от живых покупателей — рейтинг карточки растёт, доверие клиентов увеличивается', 'Իրական կարծիքներ լուսանկարներով և տեսանյութերով կենդանի հաճախորդներից — քարտի վարկանիշը աճում է, հաճախորդների վստահությունը մեծանում')}</p>
          <span class="svc-quick-cta"><span data-ru="Подробнее" data-am="Մանրամասն">${t('Подробнее', 'Մանրամասն')}</span> →</span>
        </div>
      </a>
      <a href="${navHrefForLang(lang, '/referral')}" class="svc-quick-card">
        <div class="svc-quick-img">
          <img src="/static/img/svc-referral.webp" alt="${t('Реферальная программа', 'Ուղեկից ծրագիր')}" loading="lazy">
        </div>
        <div class="svc-quick-body">
          <div class="svc-quick-icon"><i class="fas fa-users"></i></div>
          <h3 data-ru="Реферальная программа" data-am="Ուղեկից ծրագիր">${t('Реферальная программа', 'Ուղեկից ծրագիր')}</h3>
          <p data-ru="Рекомендуйте нас коллегам и зарабатывайте. Партнёрская программа для агентств, менеджеров и владельцев ресурсов" data-am="Խորհուրդ տվեք մեզ գործընկերներին և վաստակեք։ Գործընկերային ծրագիր գործակալությունների, մենեջերների և ռեսուրսների սեփականատերերի համար">${t('Рекомендуйте нас коллегам и зарабатывайте. Партнёрская программа для агентств, менеджеров и владельцев ресурсов', 'Խորհուրդ տվեք մեզ գործընկերներին և վաստակեք։ Գործընկերային ծրագիր գործակալությունների, մենեջերների և ռեսուրսների սեփականատերերի համար')}</p>
          <span class="svc-quick-cta"><span data-ru="Перейти" data-am="Անցնել">${t('Перейти', 'Անցնել')}</span> →</span>
        </div>
      </a>
    </div>
  </div>
</section>

<!-- ===== DETAIL SERVICES ===== -->
<section class="section" id="services-detail" data-section-id="services-detail">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-rocket"></i> <span data-ru="Полный спектр" data-am="Լիարժեք սպեկտր">${t('Полный спектр', 'Լիարժեք սպեկտր')}</span></div>
      <h2 class="section-title" data-ru="Полный спектр продвижения на WB" data-am="WB-ում առաջխաղացման լիարժեք սպեկտր">${t('Полный спектр продвижения на WB', 'WB-ում առաջխաղացման լիարժեք սպեկտր')}</h2>
      <p class="section-sub" data-ru="Выкупы живыми людьми, отзывы с реальными фото, активация ключевых слов — всё для роста вашего товара." data-am="Իրական մարդկանցով գնումներ, իրական լուսանկարներով կարծիքներ, բանալի բառերի ակտիվացում — ամենը ձեր ապրանքի աճի համար։">${t('Выкупы живыми людьми, отзывы с реальными фото, активация ключевых слов — всё для роста вашего товара.', 'Իրական մարդկանցով գնումներ, իրական լուսանկարներով կարծիքներ, բանալի բառերի ակտիվացում — ամենը ձեր ապրանքի աճի համար։')}</p>
    </div>
    <div class="services-grid">
      <div class="svc-card">
        <div class="svc-icon"><i class="fas fa-shopping-cart"></i></div>
        <h3 data-ru="Выкупы по ключевым запросам" data-am="Գնումներ բանալի հարցումներով">${t('Выкупы по ключевым запросам', 'Գնումներ բանալի հարցումներով')}</h3>
        <p data-ru="Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану." data-am="Ձեր ապրանքը գնվում է իրական մարդկանցով։ Իրական հաշիվներից տարբեր ՊՎԶ-ներով ամբողջ Երևանում:">${t('Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану.', 'Ձեր ապրանքը գնվում է իրական մարդկանցով։ Իրական հաշիվներից տարբեր ՊՎԶ-ներով ամբողջ Երևանում:')}</p>
        <ul class="svc-features">
          <li><i class="fas fa-check"></i> <span data-ru="Реальные аккаунты с историей покупок" data-am="Իրական հաշիվներ գնումների պատմությամբ">${t('Реальные аккаунты с историей покупок', 'Իրական հաշիվներ գնումների պատմությամբ')}</span></li>
          <li><i class="fas fa-check"></i> <span data-ru="Географическое распределение" data-am="Աշխարհագրական բաշխում">${t('Географическое распределение', 'Աշխարհագրական բաշխում')}</span></li>
          <li><i class="fas fa-check"></i> <span data-ru="Естественное поведение покупателей" data-am="Գնորդների բնական վարքագիծ">${t('Естественное поведение покупателей', 'Գնորդների բնական վարքագիծ')}</span></li>
          <li><i class="fas fa-check"></i> <span data-ru="Забор товара из ПВЗ" data-am="Ապրանքի ստացում ՊՎԶ-ից">${t('Забор товара из ПВЗ', 'Ապրանքի ստացում ՊՎԶ-ից')}</span></li>
        </ul>
        <div style="margin-top:20px;text-align:center"><a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-tg" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-rocket"></i> <span data-ru="Повысить рейтинг" data-am="Բարձրացնել վարկանիշը">${t('Повысить рейтинг', 'Բարձրացնել վարկանիշը')}</span></a></div>
      </div>
      <div class="svc-card" id="detail-reviews">
        <div class="svc-icon"><i class="fas fa-star"></i></div>
        <h3 data-ru="Отзывы и оценки" data-am="Կարծիքներ և գնահատականներ">${t('Отзывы и оценки', 'Կարծիքներ և գնահատականներ')}</h3>
        <p data-ru="Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга." data-am="Մանրամասն կարծիքներ լուսանկարներով և տեսանյութով իրական հաշիվներից վարկանիշի բարձրացման համար:">${t('Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга.', 'Մանրամասն կարծիքներ լուսանկարներով և տեսանյութով իրական հաշիվներից վարկանիշի բարձրացման համար:')}</p>
        <ul class="svc-features">
          <li><i class="fas fa-check"></i> <span data-ru="Текст отзыва + фото/видео" data-am="Կարծիքի տեքստ + լուսանկար/տեսանյութ">${t('Текст отзыва + фото/видео', 'Կարծիքի տեքստ + լուսանկար/տեսանյութ')}</span></li>
          <li><i class="fas fa-check"></i> <span data-ru="Профессиональная фотосессия" data-am="Մասնագիտական լուսանկարահանում">${t('Профессиональная фотосессия', 'Մասնագիտական լուսանկարահանում')}</span></li>
          <li><i class="fas fa-check"></i> <span data-ru="Разные локации и модели" data-am="Տարբեր վայրեր և մոդելներ">${t('Разные локации и модели', 'Տարբեր վայրեր և մոդելներ')}</span></li>
          <li><i class="fas fa-check"></i> <span data-ru="До 50% отзывов от выкупов" data-am="Մինչև 50% կարծիքներ գնումներից">${t('До 50% отзывов от выкупов', 'Մինչև 50% կարծիքներ գնումներից')}</span></li>
        </ul>
        <div style="margin-top:20px;text-align:center"><a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-success" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-rocket"></i> <span data-ru="Начать продвижение" data-am="Սկսել առաջխաղացումը">${t('Начать продвижение', 'Սկսել առաջխաղացումը')}</span></a></div>
      </div>
      <div class="svc-card">
        <div class="svc-icon"><i class="fas fa-key"></i></div>
        <h3 data-ru="Активация ключевых слов" data-am="Բանալի բառերի ակտիվացում">${t('Активация ключевых слов', 'Բանալի բառերի ակտիվացում')}</h3>
        <p data-ru="Есть ключевое слово, по которому хотите показываться, но алгоритмы не связывают его с вашей карточкой? Делаем целевые выкупы, которые активируют товар в нужном кластере." data-am="Ունե՞ք բանալի բառ, որով ցանկանում եք ցուցադրվել, բայց ալգորիթմները չեն կապում այն ձեր քարտի հետ։ Կատարում ենք նպատակային գնումներ, որոնք ակտիվացնում են ապրանքը ճիշտ կլաստերում։">${t('Есть ключевое слово, по которому хотите показываться, но алгоритмы не связывают его с вашей карточкой? Делаем целевые выкупы, которые активируют товар в нужном кластере.', 'Ունե՞ք բանալի բառ, որով ցանկանում եք ցուցադրվել, բայց ալգորիթմները չեն կապում այն ձեր քարտի հետ։ Կատարում ենք նպատակային գնումներ, որոնք ակտիվացնում են ապրանքը ճիշտ կլաստերում։')}</p>
        <ul class="svc-features">
          <li><i class="fas fa-check"></i> <span data-ru="Органический трафик — резкий рост" data-am="Օրգանիկ տրաֆիկի կտրուկ աճ">${t('Органический трафик — резкий рост', 'Օրգանիկ տրաֆիկի կտրուկ աճ')}</span></li>
          <li><i class="fas fa-check"></i> <span data-ru="Укрепление позиций новыми ключевыми словами" data-am="Դիրքերի ամրապնդում նոր բանալի բառերով">${t('Укрепление позиций новыми ключевыми словами', 'Դիրքերի ամրապնդում նոր բանալի բառերով')}</span></li>
          <li><i class="fas fa-check"></i> <span data-ru="Подключение к целевым и прибыльным запросам" data-am="Միացում թիրախային և եկամտաբեր հարցումներին">${t('Подключение к целевым и прибыльным запросам', 'Միացում թիրախային և եկամտաբեր հարցումներին')}</span></li>
          <li><i class="fas fa-check"></i> <span data-ru="Стабильные позиции без рекламы" data-am="Կայուն դիրքեր առանց գովազդի">${t('Стабильные позиции без рекламы', 'Կայուն դիրքեր առանց գովազդի')}</span></li>
        </ul>
        <div style="margin-top:20px;text-align:center"><a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-primary" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-key"></i> <span data-ru="Активировать ключевые" data-am="Ակտիվացնել բանալիները">${t('Активировать ключевые', 'Ակտիվացնել բանալիները')}</span></a></div>
      </div>
    </div>
  </div>
</section>

<!-- ===== CALCULATOR (full) ===== -->
<section class="section section-dark" id="calculator" data-section-id="calculator">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-calculator"></i> <span data-ru="Калькулятор" data-am="Հաշվիչ">${t('Калькулятор', 'Հաշվիչ')}</span></div>
      <h2 class="section-title" data-ru="Рассчитайте стоимость услуг" data-am="Հաշվեք ծառայությունների արժեքը">${t('Рассчитайте стоимость услуг', 'Հաշվեք ծառայությունների արժեքը')}</h2>
      <p class="section-sub" data-ru="Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram." data-am="Ընտրեք անհրաժեշտ ծառայությունները, նշեք քանակը և իմացեք գումարը: Պատվերը ձևակերպվում է Telegram-ով:">${t('Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram.', 'Ընտրեք անհրաժեշտ ծառայությունները, նշեք քանակը և իմացեք գումարը: Պատվերը ձևակերպվում է Telegram-ով:')}</p>
    </div>
    <div class="calc-wrap">
      <div class="calc-packages" id="calcPackages" style="display:none"></div>
      <div class="calc-tabs">
        <div class="calc-tab active" onclick="showCalcTab('buyouts',this)" data-ru="Выкупы" data-am="Գնումներ">${t('Выкупы', 'Գնումներ')}</div>
        <div class="calc-tab" onclick="showCalcTab('reviews',this)" data-ru="Отзывы" data-am="Կարծիքներ">${t('Отзывы', 'Կարծիքներ')}</div>
        <div class="calc-tab" onclick="showCalcTab('photo',this)" data-ru="Фотосъёмка" data-am="Լուսանկարահանում">${t('Фотосъёмка', 'Լուսանկարահանում')}</div>
        <div class="calc-tab" onclick="showCalcTab('ff',this)" data-ru="ФФ" data-am="Ֆուլֆիլմենթ">${t('ФФ', 'Ֆուլֆիլմենթ')}</div>
        <div class="calc-tab" onclick="showCalcTab('logistics',this)" data-ru="Логистика" data-am="Լոգիստիկա">${t('Логистика', 'Լոգիստիկա')}</div>
        <div class="calc-tab" onclick="showCalcTab('other',this)" data-ru="Прочие услуги" data-am="Այլ ծառայություններ">${t('Прочие услуги', 'Այլ ծառայություններ')}</div>
      </div>

      <!-- ===== ВЫКУПЫ ===== -->
      <div class="calc-group active" id="cg-buyouts">
        <div class="calc-row" data-price="buyout" id="buyoutRow">
          <div class="calc-label" data-ru="Выкуп + забор из ПВЗ" data-am="Գնում + ստացում ՊՎԶ-ից">${t('Выкуп + забор из ПВЗ', 'Գնում + ստացում ՊՎԶ-ից')}</div>
          <div class="calc-price" id="buyoutPriceLabel">2 000 ֏</div>
          <div class="calc-input"><button onclick="ccBuyout(-1)">−</button><input type="number" id="buyoutQty" value="0" min="0" max="999" onchange="onBuyoutInput()" oninput="onBuyoutInput()"><button onclick="ccBuyout(1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Выкуп КГТ + забор из ПВЗ" data-am="Ծանրաքաշ ապրանքի գնում + ստացում ՊՎԶ-ից">${t('Выкуп КГТ + забор из ПВЗ', 'Ծանրաքաշ ապրանքի գնում + ստացում ՊՎԶ-ից')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>

      <!-- ===== ОТЗЫВЫ ===== -->
      <div class="calc-group" id="cg-reviews">
        <div class="calc-row" data-price="300">
          <div class="calc-label" data-ru="Оценка" data-am="Գնահատական">${t('Оценка', 'Գնահատական')}</div>
          <div class="calc-price">300 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="500">
          <div class="calc-label" data-ru="Оценка + отзыв" data-am="Գնահատական + կարծիք">${t('Оценка + отзыв', 'Գնահատական + կարծիք')}</div>
          <div class="calc-price">500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="500">
          <div class="calc-label" data-ru="Вопрос к товару" data-am="Հարց ապրանքի վերաբերյալ">${t('Вопрос к товару', 'Հարց ապրանքի վերաբերյալ')}</div>
          <div class="calc-price">500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="250">
          <div class="calc-label" data-ru="Написание текста отзыва" data-am="Կարծիքի տեքստի գրում">${t('Написание текста отзыва', 'Կարծիքի տեքստի գրում')}</div>
          <div class="calc-price">250 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="100">
          <div class="calc-label" data-ru="Подписка на бренд / страницу" data-am="Բրենդի / էջի բաժանորդագրություն">${t('Подписка на бренд / страницу', 'Բրենդի / էջի բաժանորդագրություն')}</div>
          <div class="calc-price">100 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>

      <!-- ===== ФОТОСЪЁМКА ===== -->
      <div class="calc-group" id="cg-photo">
        <div class="calc-row" data-price="3500">
          <div class="calc-label" data-ru="Фотосессия в гардеробной WB (жен. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (կին մոդել)">${t('Фотосессия в гардеробной WB (жен. модель)', 'Լուսանկարահանում WB հագուստապահարանում (կին մոդել)')}</div>
          <div class="calc-price">3 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="4500">
          <div class="calc-label" data-ru="Фотосессия в гардеробной WB (муж. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (տղամարդ մոդել)">${t('Фотосессия в гардеробной WB (муж. модель)', 'Լուսանկարահանում WB հագուստապահարանում (տղամարդ մոդել)')}</div>
          <div class="calc-price">4 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Предметная фотосъёмка (3 фото)" data-am="Առարկայական լուսանկարահանում (3 լուսանկար)">${t('Предметная фотосъёмка (3 фото)', 'Առարկայական լուսանկարահանում (3 լուսանկար)')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="5000">
          <div class="calc-label" data-ru="Предметная съёмка (крупное / техника, 3 фото)" data-am="Առարկայական լուսանկարահանում (խոշոր / տեխնիկա, 3 լուս.)">${t('Предметная съёмка (крупное / техника, 3 фото)', 'Առարկայական լուսանկարահանում (խոշոր / տեխնիկա, 3 լուս.)')}</div>
          <div class="calc-price">5 000 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Ребёнок модель (до 14 лет)" data-am="Երեխա մոդել (մինչև 14 տարեկան)">${t('Ребёнок модель (до 14 лет)', 'Երեխա մոդել (մինչև 14 տարեկան)')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="7000">
          <div class="calc-label" data-ru="Видеообзор товара" data-am="Ապրանքի վիդեոհոլովակ">${t('Видеообзор товара', 'Ապրանքի վիդեոհոլովակ')}</div>
          <div class="calc-price">7 000 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>

      <!-- ===== ФФ (Фулфилмент) ===== -->
      <div class="calc-group" id="cg-ff">
        <div class="calc-row" data-price="100">
          <div class="calc-label" data-ru="Замена штрихкода" data-am="Շտրիխկոդի փոխարինում">${t('Замена штрихкода', 'Շտրիխկոդի փոխարինում')}</div>
          <div class="calc-price">100 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="200">
          <div class="calc-label" data-ru="Переупаковка (наша)" data-am="Վերափաթեթավորում (մեր փաթեթ)">${t('Переупаковка (наша)', 'Վերափաթեթավորում (մեր փաթեթ)')}</div>
          <div class="calc-price">200 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="150">
          <div class="calc-label" data-ru="Переупаковка (клиента)" data-am="Վերափաթեթավորում (հաճախորդի փաթեթ)">${t('Переупаковка (клиента)', 'Վերափաթեթավորում (հաճախորդի փաթեթ)')}</div>
          <div class="calc-price">150 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>

      <!-- ===== ЛОГИСТИКА ===== -->
      <div class="calc-group" id="cg-logistics">
        <div class="calc-row" data-price="2000">
          <div class="calc-label" data-ru="Доставка на склад WB (1 коробка 60х40х40)" data-am="Առաքում WB պահեստ (1 տուփ 60x40x40)">${t('Доставка на склад WB (1 коробка 60х40х40)', 'Առաքում WB պահեստ (1 տուփ 60x40x40)')}</div>
          <div class="calc-price">2 000 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Доставка до вашего склада (1 коробка 60х40х40)" data-am="Առաքում ձեր պահեստ (1 տուփ 60x40x40)">${t('Доставка до вашего склада (1 коробка 60х40х40)', 'Առաքում ձեր պահեստ (1 տուփ 60x40x40)')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>

      <!-- ===== ПРОЧИЕ УСЛУГИ ===== -->
      <div class="calc-group" id="cg-other">
        <div class="calc-row" data-price="1500">
          <div class="calc-label" data-ru="Глажка одежды (одиночная вещь)" data-am="Հագուստի արդուկում (մեկ իր)">${t('Глажка одежды (одиночная вещь)', 'Հագուստի արդուկում (մեկ իր)')}</div>
          <div class="calc-price">1 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Глажка одежды (верхняя одежда)" data-am="Հագուստի արդուկում (վերնահագուստ)">${t('Глажка одежды (верхняя одежда)', 'Հագուստի արդուկում (վերնահագուստ)')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="1500">
          <div class="calc-label" data-ru="Забор из ПВЗ для съёмки" data-am="Վերցնում ՊՎԶ-ից">${t('Забор из ПВЗ для съёмки', 'Վերցնում ՊՎԶ-ից')}</div>
          <div class="calc-price">1 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="1500">
          <div class="calc-label" data-ru="Возврат в ПВЗ после съёмки" data-am="Վերադարձ ՊՎԶ լուսանկարահանումից հետո">${t('Возврат в ПВЗ после съёмки', 'Վերադարձ ՊՎԶ լուսանկարահանումից հետո')}</div>
          <div class="calc-price">1 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>

      <div class="calc-total">
        <div class="calc-total-label" data-ru="Итого:" data-am="Ընդամենը:">${t('Итого:', 'Ընդամենը:')}</div>
        <div class="calc-total-value" id="calcTotal" data-total="0">0 ֏</div>
      </div>

      <!-- Referral code field -->
      <div id="calcRefWrap" style="margin-top:16px;padding:16px;background:rgba(139,92,246,0.05);border:1px solid var(--border);border-radius:var(--r-sm)">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <label style="display:block;font-size:0.82rem;font-weight:600;color:var(--accent);margin-bottom:6px"><i class="fas fa-gift" style="margin-right:6px"></i><span data-ru="Есть промокод?" data-am="Պրոմոկոդ ունեք?">${t('Есть промокод?', 'Պրոմոկոդ ունեք?')}</span></label>
            <input type="text" id="refCodeInput" placeholder="PROMO2026" style="width:100%;padding:10px 14px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.92rem;font-family:inherit;text-transform:uppercase;outline:none;transition:var(--t)" onfocus="this.style.borderColor='var(--purple)'" onblur="this.style.borderColor='var(--border)'">
          </div>
          <button onclick="checkRefCode()" class="btn btn-outline" style="padding:10px 20px;font-size:0.88rem;white-space:nowrap"><i class="fas fa-check-circle" style="margin-right:6px"></i><span data-ru="Применить" data-am="Կիրառել">${t('Применить', 'Կիրառել')}</span></button>
        </div>
        <div id="refResult" style="display:none;margin-top:10px;padding:10px 14px;border-radius:8px;font-size:0.88rem;font-weight:500"></div>
      </div>

      <div class="calc-cta" style="display:none">
        <a href="https://wa.me/37455226224" id="calcTgBtn" class="btn btn-primary btn-lg" target="_blank">
          <i class="fab fa-whatsapp"></i>
          <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">${t('Заказать сейчас', 'Պատվիրել հիմա')}</span>
        </a>
      </div>
    </div>
  </div>
</section>

<!-- ===== PROCESS (5 steps) ===== -->
<section class="section" id="process" data-section-id="process">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-route"></i> <span data-ru="Как мы работаем" data-am="Ինչպես ենք աշխատում">${t('Как мы работаем', 'Ինչպես ենք աշխատում')}</span></div>
      <h2 class="section-title" data-ru="5 шагов от заявки до ТОПа" data-am="5 քայլ մինչև TOP">${t('5 шагов от заявки до ТОПа', '5 քայլ մինչև TOP')}</h2>
    </div>
    <div class="process-grid">
      <div class="step"><div class="step-line"></div><div class="step-num">1</div><h4 data-ru="Заявка" data-am="Հայտ">${t('Заявка', 'Հայտ')}</h4><p data-ru="Пишете в Telegram и описываете товар" data-am="Գրում եք Telegram-ով և նկարագրում ապրանքը">${t('Пишете в Telegram и описываете товар', 'Գրում եք Telegram-ով և նկարագրում ապրանքը')}</p></div>
      <div class="step"><div class="step-line"></div><div class="step-num">2</div><h4 data-ru="Анализ" data-am="Վերլուծություն">${t('Анализ', 'Վերլուծություն')}</h4><p data-ru="Анализируем нишу и создаём стратегию" data-am="Վերլուծում ենք ապրանքը և ստեղծում ստրատեգիա">${t('Анализируем нишу и создаём стратегию', 'Վերլուծում ենք ապրանքը և ստեղծում ստրատեգիա')}</p></div>
      <div class="step"><div class="step-line"></div><div class="step-num">3</div><h4 data-ru="Запуск" data-am="Մեկնարկ">${t('Запуск', 'Մեկնարկ')}</h4><p data-ru="Начинаем выкупы в течение 24 часов" data-am="Սկսում ենք գնումները 24 ժամվա ընթացքում">${t('Начинаем выкупы в течение 24 часов', 'Սկսում ենք գնումները 24 ժամվա ընթացքում')}</p></div>
      <div class="step"><div class="step-line"></div><div class="step-num">4</div><h4 data-ru="Контроль" data-am="Վերահսկողություն">${t('Контроль', 'Վերահսկողություն')}</h4><p data-ru="Ежедневные отчёты о прогрессе" data-am="Ամենօրյա հաշվետվություններ ընթացքի մասին">${t('Ежедневные отчёты о прогрессе', 'Ամենօրյա հաշվետվություններ ընթացքի մասին')}</p></div>
      <div class="step"><div class="step-num">5</div><h4 data-ru="Результат" data-am="Արդյունք">${t('Результат', 'Արդյունք')}</h4><p data-ru="Ваш товар в ТОПе выдачи WB" data-am="Ձեր ապրանքը WB-ի TOP-ում է">${t('Ваш товар в ТОПе выдачи WB', 'Ձեր ապրանքը WB-ի TOP-ում է')}</p></div>
    </div>
    <div class="section-cta">
      <a href="${managerTgUrl}" target="_blank" rel="noopener" class="btn btn-tg"><i class="fab fa-telegram"></i> <span data-ru="Написать менеджеру" data-am="Գրել մենեջերին">${t('Написать менеджеру', 'Գրել մենեջերին')}</span></a>
    </div>
  </div>
</section>

<!-- ===== FINAL CTA STRIP ===== -->
<section class="svc-cta-strip">
  <div class="container">
    <div class="acs-card">
      <div class="acs-text">
        <h3 data-ru="Готовы заказать?" data-am="Պատրա՞ստ եք պատվիրել" data-edit-key="services__cta_strip" data-edit-idx="0">${tb('services__cta_strip', 0, 'Готовы заказать?', 'Պատրա՞ստ եք պատվիրել')}</h3>
        <p data-ru="Напишите в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов." data-am="Գրեք Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։" data-edit-key="services__cta_strip" data-edit-idx="1">${tb('services__cta_strip', 1, 'Напишите в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов.', 'Գրեք Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։')}</p>
      </div>
      <div class="acs-actions">
        <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-tg">
          <i class="fab fa-telegram"></i>
          <span data-ru="Telegram" data-am="Telegram" data-edit-key="services__cta_strip" data-edit-idx="2">${tb('services__cta_strip', 2, 'Telegram', 'Telegram')}</span>
        </a>
        <button type="button" class="btn btn-outline" onclick="openCallbackModal()">
          <i class="fas fa-phone"></i>
          <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք">${t('Перезвоните мне', 'Հետ զանգահարեք')}</span>
        </button>
        <a href="/contacts" class="btn btn-primary">
          <i class="fas fa-envelope"></i>
          <span data-ru="Контакты" data-am="Կոնտակտներ">${t('Контакты', 'Կոնտակտներ')}</span>
        </a>
      </div>
    </div>
  </div>
</section>
`

  // SEO: Service schema (Wildberries promotion offering) + BreadcrumbList.
  const jsonLd =
    buildServiceLd({
      siteOrigin,
      pagePath: '/services',
      nameRu: 'Услуги для продавцов Wildberries — Go to Top',
      nameAm: 'Ծառայություններ Wildberries-ի վաճառողների համար — Go to Top',
      descriptionRu: 'Выкупы живыми людьми, отзывы с фото, фотосессии и продвижение по ключевым запросам для продавцов Wildberries.',
      descriptionAm: 'Իրական մարդկանց հետագնումներ, լուսանկարներով կարծիքներ, լուսանկարահանումներ և բանալի բառերով առաջխաղացում Wildberries-ի վաճառողների համար.',
      serviceType: 'Wildberries marketplace promotion',
      isAM,
    }) +
    buildBreadcrumbLd({ siteOrigin, isAM, page: 'services' })

  return renderPageShell({
    page: 'services',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'services-page',
    mainHtml,
    extraHead: extraHead + jsonLd,
    shellBlocks,
  })
}

// =====================================================================
// /services/reviews — detail page for «Отзывы под ключ» (+ 2 cross-cards).
// =====================================================================
function renderServiceReviewsPage(opts: { lang: 'ru' | 'am', siteOrigin: string, pageBlocks?: Record<string, SubpageBlock>, shellBlocks?: Record<string, SubpageBlock> }): string {
  const { lang, siteOrigin, pageBlocks, shellBlocks } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => (isAM ? am : ru)
  const tb = (blockKey: string, idx: number, fallbackRu: string, fallbackAm: string): string => {
    const block = pageBlocks?.[blockKey]
    if (!block || block.is_visible === 0) return isAM ? fallbackAm : fallbackRu
    const arr = isAM ? block.texts_am : block.texts_ru
    const v = arr?.[idx]
    return (typeof v === 'string' && v.trim()) ? v : (isAM ? fallbackAm : fallbackRu)
  }

  const seo = {
    title: t(
      'Отзывы под ключ для Wildberries — Go to Top',
      'Կարծիքներ բանալիով Wildberries-ի համար — Go to Top'
    ),
    description: t(
      'Реальные отзывы с фото и видео от живых покупателей — рейтинг и доверие к карточке на WB растут.',
      'Իրական կարծիքներ լուսանկարներով և տեսանյութերով — քարտի վարկանիշը և վստահությունը WB-ում աճում են։'
    ),
    ogImage: `${siteOrigin}/static/img/og-image.png`,
  }

  const extraHead = `<link rel="stylesheet" href="/static/css/page-services.css?v=${CACHE_VERSION}">`
  const tgUrl = PLACEHOLDER_TG_URL

  const mainHtml = `
<!-- ===== REVIEWS DETAIL HERO ===== -->
<section class="svc-hero">
  <div class="container">
    <div class="sh-inner">
      <div class="sh-eyebrow">
        <i class="fas fa-star"></i>
        <span data-ru="Сервис отзывов" data-am="Կարծիքների ծառայություն">${t('Сервис отзывов', 'Կարծիքների ծառայություն')}</span>
      </div>
      <h1>
        <span data-ru="Отзывы" data-am="Կարծիքներ">${t('Отзывы', 'Կարծիքներ')}</span>
        <span class="gr" data-ru="под ключ" data-am="բանալիով">${t('под ключ', 'բանալիով')}</span>
      </h1>
      <p class="sh-desc" data-ru="Развёрнутые отзывы с фото и видео от реальных аккаунтов повышают рейтинг карточки и конверсию в заказ — работают в связке с выкупами по ключевым запросам." data-am="Մանրամասն կարծիքներ լուսանկարներով և տեսանյութով իրական հաշիվներից բարձրացնում են քարտի վարկանիշը և պատվերի փոխարկումը — աշխատում են հետագնումների հետ զուգահեռ։">${t(
        'Развёрнутые отзывы с фото и видео от реальных аккаунтов повышают рейтинг карточки и конверсию в заказ — работают в связке с выкупами по ключевым запросам.',
        'Մանրամասն կարծիքներ լուսանկարներով և տեսանյութով իրական հաշիվներից բարձրացնում են քարտի վարկանիշը և պատվերի փոխարկումը — աշխատում են հետագնումների հետ զուգահեռ։'
      )}</p>
      <div class="sh-cta">
        <a href="${navHrefForLang(lang, '/calculator')}" class="btn btn-primary btn-lg">
          <i class="fas fa-calculator"></i>
          <span data-ru="Калькулятор отзывов" data-am="Կարծիքների հաշվիչ">${t('Калькулятор отзывов', 'Կարծիքների հաշվիչ')}</span>
        </a>
        <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-tg btn-lg">
          <i class="fab fa-telegram"></i>
          <span data-ru="Написать в Telegram" data-am="Գրել Telegram-ով">${t('Написать в Telegram', 'Գրել Telegram-ով')}</span>
        </a>
      </div>
    </div>
  </div>
</section>

<!-- ===== DETAIL: ONE COLUMN ===== -->
<section class="section" id="reviews-detail-body" data-section-id="reviews-detail">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-star"></i> <span data-ru="Как мы работаем" data-am="Ինչպես ենք աշխատում">${t('Как мы работаем', 'Ինչպես ենք աշխատում')}</span></div>
      <h2 class="section-title" data-ru="Отзывы и оценки под вашу стратегию" data-am="Ձեր ստրատեգիային համապատասխան գնահատականներ">${t(
        'Отзывы и оценки под вашу стратегию',
        'Ձեր ստратեգիային համապատասխան գնահատականներ'
      )}</h2>
    </div>
    <div class="services-grid" style="grid-template-columns:1fr;max-width:720px;margin:0 auto">
      <div class="svc-card" id="detail-reviews-main">
        <div class="svc-icon"><i class="fas fa-star"></i></div>
        <h3 data-ru="Отзывы и оценки" data-am="Կարծիքներ և գնահատականներ">${t('Отзывы и оценки', 'Կարծիքներ և գնահատականներ')}</h3>
        <p data-ru="Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга." data-am="Մանրամասն կարծիքներ լուսանկարներով և տեսանյութով իրական հաշիվներից վարկանիշի բարձրացման համար:">${t(
          'Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга.',
          'Մանրամասն կարծիքներ լուսանկարներով և տեսանյութով իրական հաշիվներից վարկանիշի բարձրացման համար:'
        )}</p>
        <ul class="svc-features">
          <li><i class="fas fa-check"></i> <span data-ru="Текст отзыва + фото/видео" data-am="Կարծիքի տեքստ + լուսանկար/տեսանյութ">${t(
            'Текст отзыва + фото/видео',
            'Կարծիքի տեքստ + լուսանկար/տեսանյութ'
          )}</span></li>
          <li><i class="fas fa-check"></i> <span data-ru="Профессиональная фотосессия" data-am="Մասնագիտական լուսանկարահանում">${t(
            'Профессиональная фотосессия',
            'Մասնագիտական լուսանկարահանում'
          )}</span></li>
          <li><i class="fas fa-check"></i> <span data-ru="Разные локации и модели" data-am="Տարբեր վայրեր և մոդելներ">${t(
            'Разные локации и модели',
            'Տարբեր վայրեր և մոդելներ'
          )}</span></li>
          <li><i class="fas fa-check"></i> <span data-ru="До 50% отзывов от выкупов" data-am="Մինչև 50% կարծիքներ գնումներից">${t(
            'До 50% отзывов от выкупов',
            'Մինչև 50% կարծիքներ գնումներից'
          )}</span></li>
        </ul>
        <div style="margin-top:20px;text-align:center"><a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-success" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-rocket"></i> <span data-ru="Начать продвижение" data-am="Սկսել առաջխաղացումը">${t(
          'Начать продвижение',
          'Սկսել առաջխաղացումը'
        )}</span></a></div>
      </div>
    </div>
  </div>
</section>

<!-- ===== WHY REVIEWS MATTER (compact) ===== -->
<section class="section section-dark">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-thumbs-up"></i> <span data-ru="Почему это важно" data-am="Ինչու է այն կարևոր">${t('Почему это важно', 'Ինչու է այն կարևոր')}</span></div>
      <p class="section-sub" style="max-width:700px;margin:0 auto" data-ru="Качественный отзыв с фото снижает сомнения покупателя и поднимает карточку в выдаче — особенно вместе с выкупами по ключевым словам." data-am="Որակյալ կարծիքը լուսանկարով նվազեցնում է գնորդի կասկածները և բարձրացնում է քարտը որոնման մեջ — հատկապես բանալի բառերով գնումների հետ միասին։">${t(
        'Качественный отзыв с фото снижает сомнения покупателя и поднимает карточку в выдаче — особенно вместе с выкупами по ключевым словам.',
        'Որակյալ կարծիքը լուսանկարով նվազեցնում է գնորդի կասկածները և բարձրացնում է քարտը որոնման մեջ — հատկապես բանալի բառերով գնումների հետ միասին։'
      )}</p>
    </div>
  </div>
</section>

${renderSvcTriangleSection({ lang, current: 'reviews' })}

<!-- ===== FINAL CTA STRIP ===== -->
<section class="svc-cta-strip">
  <div class="container">
    <div class="acs-card">
      <div class="acs-text">
        <h3 data-ru="Нужны продающие отзывы?" data-am="Պե՞տք են վաճառող կարծիքներ" data-edit-key="reviews__cta_strip" data-edit-idx="0">${tb('reviews__cta_strip', 0, 'Нужны продающие отзывы?', 'Պե՞տք են վաճառող կարծիքներ')}</h3>
        <p data-ru="Откройте калькулятор на сайте или напишите в Telegram — подберём объём под ваш бюджет." data-am="Բացեք կայքի հաշվիչը կամ գրեք Telegram — կընտրենք ծավալը ձեր բյուջեին համապատասխան։" data-edit-key="reviews__cta_strip" data-edit-idx="1">${tb(
          'reviews__cta_strip',
          1,
          'Откройте калькулятор на сайте или напишите в Telegram — подберём объём под ваш бюджет.',
          'Բացեք կայքի հաշվիչը կամ գրեք Telegram — կընտրենք ծավալը ձեր բյուջեին համապատասխան։'
        )}</p>
      </div>
      <div class="acs-actions">
        <a href="${navHrefForLang(lang, '/calculator')}" class="btn btn-primary">
          <i class="fas fa-calculator"></i>
          <span data-ru="Калькулятор" data-am="Հաշվիչ">${t('Калькулятор', 'Հաշվիչ')}</span>
        </a>
        <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-tg">
          <i class="fab fa-telegram"></i>
          <span>Telegram</span>
        </a>
      </div>
    </div>
  </div>
</section>
`

  const jsonLd =
    buildServiceLd({
      siteOrigin,
      pagePath: '/services/reviews',
      nameRu: 'Отзывы под ключ для продавцов Wildberries — Go to Top',
      nameAm: 'Կարծիքներ բանալիով Wildberries-ի վաճառողների համար — Go to Top',
      descriptionRu: 'Развёрнутые отзывы с фото и видео от реальных аккаунтов для роста рейтинга карточки на маркетплейсе.',
      descriptionAm: 'Մանրամասն կարծիքներ լուսանկարներով և տեսանյութով՝ քարտի վարկանիշը մարքետփլեյսում բարձրացնելու համար։',
      serviceType: 'Wildberries review service',
      isAM,
    }) + buildBreadcrumbLd({ siteOrigin, isAM, page: 'service-reviews' })

  return renderPageShell({
    page: 'services',
    canonicalPath: '/services/reviews',
    mainDataPage: 'reviews',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'services-page',
    mainHtml,
    extraHead: extraHead + jsonLd,
    shellBlocks,
  })
}

// =====================================================================
// renderBuyoutsPage — phase 2C "heavy" page for /buyouts.
// Topical content about Wildberries buyouts: hero, WB warning banner,
// stats, what buyouts are, why they work (6-step funnel), 11 000 ₽
// budget comparison, official-WB legal block, the FULL calculator and
// a final CTA strip. The calculator works against `window.__SITE_DATA`
// injected post-SSR by the /buyouts route handler (mirrors `/services`).
// All copy is bilingual via data-ru / data-am with the requested
// language rendered server-side so SEO sees real content.
// =====================================================================
function renderBuyoutsPage(opts: { lang: 'ru' | 'am', siteOrigin: string, pageBlocks?: Record<string, SubpageBlock>, shellBlocks?: Record<string, SubpageBlock> }): string {
  const { lang, siteOrigin, pageBlocks, shellBlocks } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru
  const tb = (blockKey: string, idx: number, fallbackRu: string, fallbackAm: string): string => {
    const block = pageBlocks?.[blockKey]
    if (!block || block.is_visible === 0) return isAM ? fallbackAm : fallbackRu
    const arr = isAM ? block.texts_am : block.texts_ru
    const v = arr?.[idx]
    return (typeof v === 'string' && v.trim()) ? v : (isAM ? fallbackAm : fallbackRu)
  }

  const seo = {
    title: t(
      'Выкупы Wildberries — Go to Top | Быстрый рост позиций',
      'Հետագնումներ Wildberries — Go to Top | Արագ TOP դիրքեր'
    ),
    description: t(
      'Выкупы на Wildberries для роста позиций товара в TOP. 200+ выкупов в день, собственный склад в Ереване, 0 блокировок',
      'Wildberries-ում հետագնումներ՝ ապրանքների TOP դիրքերի համար. 200+ հետագնում օրական, սեփական պահեստ Երևանում, ոչ մի արգելափակում'
    ),
    ogImage: `${siteOrigin}/static/img/og-image.png`,
  }

  // Page-only styles — copy of the subsets needed for buyouts: hero,
  // section primitives, calculator, why-block + compare-box, buyout-detail,
  // stats-bar, wb-banner, wb-official-badge, highlight-result, CTA strip.
  // Reuses --purple/--bg-card/--text/etc tokens declared in renderPageShell.
  const extraHead = `<link rel="stylesheet" href="/static/css/page-buyouts.css?v=${CACHE_VERSION}">`

  const tgUrl = PLACEHOLDER_TG_URL
  const managerTgUrl = 'https://t.me/suport_admin_2'

  const mainHtml = `
<!-- ===== BUYOUTS HERO ===== -->
<section class="bp-hero">
  <div class="container">
    <div class="bh-inner">
      <div class="bh-eyebrow">
        <i class="fas fa-shopping-bag"></i>
        <span data-ru="Услуга выкупа" data-am="Գնումի ծառայություն" data-edit-key="buyouts__hero" data-edit-idx="0">${tb('buyouts__hero', 0, 'Услуга выкупа', 'Գնումի ծառայություն')}</span>
      </div>
      <h1>
        <span data-ru="Выкупы на" data-am="Հետագնումներ" data-edit-key="buyouts__hero" data-edit-idx="1">${tb('buyouts__hero', 1, 'Выкупы на', 'Հետագնումներ')}</span>
        <span class="gr">${tb('buyouts__hero', 2, 'Wildberries', 'Wildberries')}</span>
      </h1>
      <p class="bh-desc" data-ru="Реальные выкупы живыми покупателями по нужным ключевым запросам — ваш товар поднимается в ТОП выдачи WB, закрепляется там и начинает получать органический трафик. Собственный склад и 200+ выкупов в день в Ереване." data-am="Իրական հետագնումներ կենդանի գնորդների կողմից անհրաժեշտ բանալի բառերով — ձեր ապրանքը բարձրանում է WB-ի TOP-ում, ամրապնդվում է այնտեղ և սկսում է ստանալ օրգանական տրաֆիկ։ Սեփական պահեստ և 200+ հետագնում օրական Երևանում։" data-edit-key="buyouts__hero" data-edit-idx="3">${tb('buyouts__hero', 3, 'Реальные выкупы живыми покупателями по нужным ключевым запросам — ваш товар поднимается в ТОП выдачи WB, закрепляется там и начинает получать органический трафик. Собственный склад и 200+ выкупов в день в Ереване.', 'Իրական հետագնումներ կենդանի գնորդների կողմից անհրաժեշտ բանալի բառերով — ձեր ապրանքը բարձրանում է WB-ի TOP-ում, ամրապնդվում է այնտեղ և սկսում է ստանալ օրգանական տրաֆիկ։ Սեփական պահեստ և 200+ հետագնում օրական Երևանում։')}</p>
      <div class="bh-cta">
        <a href="#calculator" class="btn btn-primary btn-lg">
          <i class="fas fa-calculator"></i>
          <span data-ru="Открыть калькулятор" data-am="Բացել հաշվիչը">${t('Открыть калькулятор', 'Բացել հաշվիչը')}</span>
        </a>
        <a href="javascript:void(0)" onclick="openCallbackModal()" class="btn btn-outline btn-lg">
          <i class="fas fa-phone"></i>
          <span data-ru="Связаться" data-am="Կապ հաստատել">${t('Связаться', 'Կապ հաստատել')}</span>
        </a>
      </div>
    </div>
  </div>
</section>

<!-- ===== WB WARNING BANNER ===== -->
<div class="wb-banner" data-section-id="wb-banner" data-block-key="home__wb_banner">
  <div class="container">
    <div class="wb-banner-inner">
      <div class="wb-banner-card">
        <i class="fas fa-gavel wb-icon"></i>
        <div class="wb-text" data-ru="WB официально отменил штрафы за выкупы!" data-am="WB-ն պաշտոնապես վերացրել է տուգանքները ինքնագնումների համար!">${t('WB официально отменил штрафы за выкупы!', 'WB-ն պաշտոնապես վերացրել է տուգանքները ինքնագնումների համար!')}</div>
      </div>
      <div class="wb-banner-right">
        <span class="wb-r-icon">🚀</span>
        <div class="wb-r-text" data-ru="Повысь рейтинг магазина прямо сейчас" data-am="Բարձրացրեք խանութի վարկանիշը հիմա">${t('Повысь рейтинг магазина прямо сейчас', 'Բարձրացրեք խանութի վարկանիշը հիմա')}</div>
        <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-primary"><span data-ru="Узнать" data-am="Իմանալ">${t('Узнать', 'Իմանալ')}</span></a>
      </div>
    </div>
  </div>
</div>

<!-- ===== STATS BAR ===== -->
<div class="stats-bar" data-section-id="stats-bar" data-block-key="home__stats_bar">
  <div class="container">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-big" data-count-s="500">0</div>
        <div class="stat-desc" data-ru="поставщиков сотрудничают с нами" data-am="մատակարար համագործակցում է մեզ հետ">${t('поставщиков сотрудничают с нами', 'մատակարար համագործակցում է մեզ հետ')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-big" data-count-s="1000">0+</div>
        <div class="stat-desc" data-ru="аккаунтов с индивидуальной картой" data-am="հաշիվներ անհատական քարտով">${t('аккаунтов с индивидуальной картой', 'հաշիվներ անհատական քարտով')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-big" data-count-s="21">0</div>
        <div class="stat-desc" data-ru="день до выхода в ТОП" data-am="օր մինչև TOP-ում հայտնվելը">${t('день до выхода в ТОП', 'օր մինչև TOP-ում հայտնվելը')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-big" data-count-s="200">0+</div>
        <div class="stat-desc" data-ru="выкупов каждый день" data-am="գնում ամեն օր">${t('выкупов каждый день', 'գնում ամեն օր')}</div>
      </div>
    </div>
  </div>
</div>

<!-- ===== ЧТО ТАКОЕ ВЫКУПЫ (buyout-detail) ===== -->
<section class="section" data-section-id="buyout-detail">
  <div class="container">
    <div class="buyout-detail">
      <div class="buyout-detail-header">
        <div class="section-badge"><i class="fas fa-shopping-bag"></i> <span data-ru="Услуга выкупа" data-am="Գնումի ծառայություն">${t('Услуга выкупа', 'Գնումի ծառայություն')}</span></div>
        <h2 data-ru="Что включает в себя услуга выкупа" data-am="Ինչ է ներառում գնումի ծառայությունը">${t('Что включает в себя ', 'Ինչ է ներառում ')}<span class="gr">${t('услуга выкупа', 'գնումի ծառայությունը')}</span></h2>
        <p data-ru="Индивидуальный подход к каждому клиенту. Выкупы только по ключевым запросам, каждый заказ оформляет реальный человек вручную." data-am="Անհատական մոտեցում յուրաքանչյուր հաճախորդի համար: Գնումներ միայն բանալի հարցումներով, յուրաքանչյուր պատվերը կատարում է իրական մարդ ձեռքով:">${t('Индивидуальный подход к каждому клиенту. Выкупы только по ключевым запросам, каждый заказ оформляет реальный человек вручную.', 'Անհատական մոտեցում յուրաքանչյուր հաճախորդի համար: Գնումներ միայն բանալի հարցումներով, յուրաքանչյուր պատվերը կատարում է իրական մարդ ձեռքով:')}</p>
      </div>
      <div class="buyout-grid">
        <div class="buyout-card">
          <h4 data-ru="Полное сопровождение" data-am="Լիարժեք ուղեկցում">${t('Полное сопровождение', 'Լիարժեք ուղեկցում')}</h4>
          <ul>
            <li data-ru="Консультация" data-am="Խորհրդատվություն">${t('Консультация', 'Խորհրդատվություն')}</li>
            <li data-ru="Создание чата с менеджером" data-am="Մենեջերի հետ չատի ստեղծում">${t('Создание чата с менеджером', 'Մենեջերի հետ չատի ստեղծում')}</li>
            <li data-ru="Согласование плана выкупов" data-am="Գնումների պլանի համաձայնեցում">${t('Согласование плана выкупов', 'Գնումների պլանի համաձայնեցում')}</li>
            <li data-ru="Выкупы по ключевым запросам" data-am="Գնումներ բանալի հարցումներով">${t('Выкупы по ключевым запросам', 'Գնումներ բանալի հարցումներով')}</li>
            <li data-ru="Забор товара из ПВЗ курьерами" data-am="Ապրանքի ստացում ՊՎԶ-ից մեր առաքիչների օգնությամբ">${t('Забор товара из ПВЗ курьерами', 'Ապրանքի ստացում ՊՎԶ-ից մեր առաքիչների օգնությամբ')}</li>
            <li data-ru="Возврат на склады маркетплейсов" data-am="Վերադարձ մարկետփլեյսների պահեստներ">${t('Возврат на склады маркетплейсов', 'Վերադարձ մարկետփլեյսների պահեստներ')}</li>
            <li data-ru="Публикация отзывов" data-am="Կարծիքների հրապարակում">${t('Публикация отзывов', 'Կարծիքների հրապարակում')}</li>
          </ul>
        </div>
        <div class="buyout-card">
          <h4 data-ru="Отчётность" data-am="Հաշվետվություն">${t('Отчётность', 'Հաշվետվություն')}</h4>
          <p data-ru="Формирование итоговой отчётности по каждому выкупу. Полная прозрачность на каждом этапе." data-am="Վերջնական հաշվետվության ձևավորում յուրաքանչյուր գնումի համար: Լիարժեք թափանցիկություն յուրաքանչյուր փուլում:">${t('Формирование итоговой отчётности по каждому выкупу. Полная прозрачность на каждом этапе.', 'Վերջնական հաշվետվության ձևավորում յուրաքանչյուր գնումի համար: Լիարժեք թափանցիկություն յուրաքանչյուր փուլում:')}</p>
          <div style="margin-top:16px;text-align:center"><a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-warning" style="font-size:0.82rem;padding:9px 18px"><i class="fas fa-fire"></i> <span data-ru="Начать выкупы сейчас" data-am="Սկսել գնումները">${t('Начать выкупы сейчас', 'Սկսել գնումները')}</span></a></div>
        </div>
        <div class="buyout-card">
          <h4 data-ru="Контроль" data-am="Վերահսկողություն">${t('Контроль', 'Վերահսկողություն')}</h4>
          <p data-ru="Сопровождение и контроль на всех этапах. Точное следование алгоритму для безопасности вашего кабинета." data-am="Ուղեկցում և վերահսկողություն բոլոր փուլերում: Ալգորիթմի ճիշտ հետևողականություն ձեր հաշվի անվտանգության համար:">${t('Сопровождение и контроль на всех этапах. Точное следование алгоритму для безопасности вашего кабинета.', 'Ուղեկցում և վերահսկողություն բոլոր փուլերում: Ալգորիթմի ճիշտ հետևողականություն ձեր հաշվի անվտանգության համար:')}</p>
          <div style="margin-top:16px;text-align:center"><a href="${managerTgUrl}" target="_blank" rel="noopener" class="btn btn-tg" style="font-size:0.82rem;padding:9px 18px"><i class="fab fa-telegram"></i> <span data-ru="Получить индивидуальный расчёт" data-am="Ստանալ ինդիվիդուալ հաշվարկ">${t('Получить индивидуальный расчёт', 'Ստանալ ինդիվիդուալ հաշվարկ')}</span></a></div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== WHY BUYOUTS WORK (6-step funnel) ===== -->
<section class="section" id="why-buyouts" data-section-id="why-buyouts" data-block-key="home__why_buyouts">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-chart-line"></i> <span data-ru="Почему это работает" data-am="Ինչու է սա աշխատում">${t('Почему это работает', 'Ինչու է սա աշխատում')}</span></div>
      <h2 class="section-title" data-ru="Почему выкупы по ключевым запросам — самый эффективный способ продвижения" data-am="Ինչու են բանալի բառերով գնումները ամենաարդյունավետը">${t('Почему выкупы по ключевым запросам — ', 'Ինչու են բանալի բառերով գնումները ')}<span class="gr">${t('самый эффективный способ', 'ամենաարդյունավետը')}</span>${t(' продвижения', '')}</h2>
    </div>

    <div class="why-block">
      <h3><i class="fas fa-funnel-dollar"></i> <span data-ru="Мы не просто покупаем ваш товар — мы прокачиваем всю воронку" data-am="Մենք ոչ միայն գնում ենք ձեր ապրանքը — մենք բարձրացնում ենք ողջ ձագարի կոնվերսիաները">${t('Мы не просто покупаем ваш товар — мы прокачиваем всю воронку', 'Մենք ոչ միայն գնում ենք ձեր ապրանքը — մենք բարձրացնում ենք ողջ ձագարի կոնվերսիաները')}</span></h3>
      <p data-ru="Каждый выкуп по ключевому запросу — это полноценное продвижение вашей карточки. Наши люди делают всё так, как это делает реальный покупатель. Вот что происходит при каждом выкупе:" data-am="Յուրաքանչյուր գնում բանալի բառով — դա ձեր քարտի լիարժեք առաջխաղացում է: Մեր մարդիկ ամեն ինչ անում են այնպես, ինչպես իրական գնորդը: Ահա թե ինչ է տեղի ունենում յուրաքանչյուր գնման ժամանակ:">${t('Каждый выкуп по ключевому запросу — это полноценное продвижение вашей карточки. Наши люди делают всё так, как это делает реальный покупатель. Вот что происходит при каждом выкупе:', 'Յուրաքանչյուր գնում բանալի բառով — դա ձեր քարտի լիարժեք առաջխաղացում է: Մեր մարդիկ ամեն ինչ անում են այնպես, ինչպես իրական գնորդը: Ահա թե ինչ է տեղի ունենում յուրաքանչյուր գնման ժամանակ:')}</p>

      <div class="why-steps">
        <div class="why-step"><div class="why-step-num">1</div><div><h4 data-ru="Поиск по ключевому запросу" data-am="Որոնում բանալի բառով">${t('Поиск по ключевому запросу', 'Որոնում բանալի բառով')}</h4><p data-ru="Находим ваш товар именно так, как ищет реальный покупатель — через поисковую строку WB" data-am="Գտնում ենք ձեր ապրանքը այնպես, ինչպես իրական գնորդը — WB-ի որոնման տողով">${t('Находим ваш товар именно так, как ищет реальный покупатель — через поисковую строку WB', 'Գտնում ենք ձեր ապրանքը այնպես, ինչպես իրական գնորդը — WB-ի որոնման տողով')}</p></div></div>
        <div class="why-step"><div class="why-step-num">2</div><div><h4 data-ru="Просмотр карточки" data-am="Քարտի դիտում">${t('Просмотр карточки', 'Քարտի դիտում')}</h4><p data-ru="Полностью просматриваем фото и видео, листаем описание — повышаем конверсию из просмотра в переход" data-am="Լիարժեք դիտում ենք բոլոր լուսանկարներն ու տեսանյութերը, թերթում ենք նկարագրությունը — բարձրացնում ենք դիտումից անցման փոխարկումը">${t('Полностью просматриваем фото и видео, листаем описание — повышаем конверсию из просмотра в переход', 'Լիարժեք դիտում ենք բոլոր լուսանկարներն ու տեսանյութերը, թերթում ենք նկարագրությունը — բարձրացնում ենք դիտումից անցման փոխարկումը')}</p></div></div>
        <div class="why-step"><div class="why-step-num">3</div><div><h4 data-ru="Работа с отзывами" data-am="Աշխատանք կարծիքների հետ">${t('Работа с отзывами', 'Աշխատանք կարծիքների հետ')}</h4><p data-ru="Пролистываем отзывы, лайкаем положительные — это улучшает ранжирование лучших отзывов" data-am="Թերթում ենք կարծիքները, լայքում դրականները — սա բարելավում է լավագույն կարծիքների վարկանիշը">${t('Пролистываем отзывы, лайкаем положительные — это улучшает ранжирование лучших отзывов', 'Թերթում ենք կարծիքները, լայքում դրականները — սա բարելավում է լավագույն կարծիքների վարկանիշը')}</p></div></div>
        <div class="why-step"><div class="why-step-num">4</div><div><h4 data-ru="Добавление конкурентов" data-am="Մրցակիցների ավելացում">${t('Добавление конкурентов', 'Մրցակիցների ավելացում')}</h4><p data-ru="Добавляем в корзину товары конкурентов вместе с вашим — имитируем реальное поведение покупателя" data-am="Զամբյուղում ավելացնում ենք մրցակիցների ապրանքները ձեր ապրանքի հետ — իմիտացիա ենք անում իրական գնորդի վարքագիծը">${t('Добавляем в корзину товары конкурентов вместе с вашим — имитируем реальное поведение покупателя', 'Զամբյուղում ավելացնում ենք մրցակիցների ապրանքները ձեր ապրանքի հետ — իմիտացիա ենք անում իրական գնորդի վարքագիծը')}</p></div></div>
        <div class="why-step"><div class="why-step-num">5</div><div><h4 data-ru="Удаление конкурентов из корзины" data-am="Մրցակիցների հեռացում զամբյուղից">${t('Удаление конкурентов из корзины', 'Մրցակիցների հեռացում զամբյուղից')}</h4><p data-ru="В момент заказа удаляем конкурентов и оставляем только ваш товар — WB видит, что выбирают именно вас" data-am="Պատվիրելու պահին հեռացնում ենք մրցակիցներին և թողնում միայն ձեր ապրանքը — WB-ն տեսնում է, որ ընտրում են հենց ձեզ">${t('В момент заказа удаляем конкурентов и оставляем только ваш товар — WB видит, что выбирают именно вас', 'Պատվիրելու պահին հեռացնում ենք մրցակիցներին և թողնում միայն ձեր ապրանքը — WB-ն տեսնում է, որ ընտրում են հենց ձեզ')}</p></div></div>
        <div class="why-step"><div class="why-step-num">6</div><div><h4 data-ru="Заказ и получение" data-am="Պատվեր և ստացում">${t('Заказ и получение', 'Պատվեր և ստացում')}</h4><p data-ru="Оформляем заказ, забираем из ПВЗ, оставляем отзыв — полный цикл реального покупателя" data-am="Ձևակերպում ենք պատվերը, վերցնում ՊՎԶ-ից, թողնում կարծիք — իրական գնորդի ամբողջական ցիկլ">${t('Оформляем заказ, забираем из ПВЗ, оставляем отзыв — полный цикл реального покупателя', 'Ձևակերպում ենք պատվերը, վերցնում ՊՎԶ-ից, թողնում կարծիք — իրական գնորդի ամբողջական ցիկլ')}</p></div></div>
      </div>

      <div class="highlight-result" data-ru="В результате повышаются ВСЕ конверсии вашей карточки: CTR, переходы, добавления в корзину, заказы. Карточка закрепляется в ТОПе и начинает получать органический трафик. Чем выше позиция — тем больше органических продаж без дополнительных вложений." data-am="Արդյունքում բարձրանում են ձեր քարտի ԲՈԼՈՐ կոնվերսիաները՝ CTR, անցումներ, զամբյուղում ավելացումներ, պատվերներ: Քարտը ամրապնդվում է TOP-ում և սկսում ստանալ օրգանական տրաֆիկ: Որքան բարձր է դիրքը՝ այնքան ավելի շատ օրգանական վաճառքներ առանց լրացուցիչ ներդրումների:"><i class="fas fa-bolt"></i> <strong>${t('Результат:', 'Արդյունք:')}</strong> ${t('повышаются <strong>ВСЕ конверсии</strong> вашей карточки: CTR, переходы, добавления в корзину, заказы. Карточка закрепляется в ТОПе и начинает получать <strong>органический трафик</strong>. Чем выше позиция — тем больше органических продаж без дополнительных вложений.', 'բարձրանում են ձեր քարտի <strong>ԲՈԼՈՐ կոնվերսիաները</strong>՝ CTR, անցումներ, զամբյուղում ավելացումներ, պատվերներ: Քարտը ամրապնդվում է TOP-ում և սկսում ստանալ <strong>օրգանական տրաֆիկ</strong>: Որքան բարձր է դիրքը՝ այնքան ավելի շատ օրգանական վաճառքներ առանց լրացուցիչ ներդրումների:')}</div>
    </div>

    <div class="section-cta">
      <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-warning"><i class="fas fa-fire"></i> <span data-ru="Начать выкупы" data-am="Սկսել գնումները">${t('Начать выкупы', 'Սկսել գնումները')}</span></a>
    </div>
  </div>
</section>

<!-- ===== ОТЗЫВЫ ПРОДАЮТ / НЕ ПРОДАЮТ ===== -->
<section class="section" id="reviews-proof" data-section-id="reviews-proof">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-star"></i> <span data-ru="Социальное доказательство" data-am="Սոցիալական ապացույց">${t('Социальное доказательство', 'Սոցիալական ապացույց')}</span></div>
      <h2 class="section-title" data-ru="Вот такие отзывы — продают" data-am="Ահա այսպիսի կարծիքները՝ վաճառում են">${t('Вот такие отзывы — ', 'Ահա այսպիսի կարծիքները՝ ')}<span class="gr">${t('продают', 'վաճառում են')}</span></h2>
      <p class="section-sub" data-ru="Реальные фото, подробные описания, живые эмоции — именно это убеждает следующего покупателя оформить заказ. Сравните сами:" data-am="Իրական լուսանկարներ, մանրամասն նկարագրություններ, կենդանի զգացմունքներ — հենց դա է համոզում հաջորդ գնորդին պատվիրել: Համեմատեք ինքներդ՝">${t('Реальные фото, подробные описания, живые эмоции — именно это убеждает следующего покупателя оформить заказ. Сравните сами:', 'Իրական լուսանկարներ, մանրամասն նկարագրություններ, կենդանի զգացմունքներ — հենց դա է համոզում հաջորդ գնորդին պատվիրել: Համեմատեք ինքներդ՝')}</p>
    </div>

    <div class="rp-compare">
      <div class="rp-col rp-good">
        <div class="rp-label rp-label-good"><i class="fas fa-check-circle"></i> <span data-ru="ПРОДАЁТ" data-am="ՎԱՃԱՌՈՒՄ Է">${t('ПРОДАЁТ', 'ՎԱՃԱՌՈՒՄ Է')}</span></div>
        <div class="rp-img"><img src="/static/img/review-good.webp" alt="Продающий отзыв на Wildberries — высокий рейтинг, фото в использовании" loading="lazy" decoding="async"></div>
        <div class="rp-text">
          <h4 data-ru="Качественные фото и подробный текст" data-am="Որակյալ լուսանկարներ և մանրամասն տեքստ">${t('Качественные фото и подробный текст', 'Որակյալ լուսանկարներ և մանրամասն տեքստ')}</h4>
          <p data-ru="Фото в реальном использовании, честный детальный текст, рейтинг 5,0 и тысячи оценок — покупатель видит реальный опыт, доверие растёт, конверсия в заказ повышается." data-am="Լուսանկարներ իրական օգտագործման մեջ, ազնիվ մանրամասն տեքստ, 5,0 վարկանիշ և հազարավոր գնահատականներ — գնորդը տեսնում է իրական փորձը, վստահությունը մեծանում է, պատվերի կոնվերսիան բարձրանում է:">${t('Фото в реальном использовании, честный детальный текст, рейтинг 5,0 и тысячи оценок — покупатель видит реальный опыт, доверие растёт, конверсия в заказ повышается.', 'Լուսանկարներ իրական օգտագործման մեջ, ազնիվ մանրամասն տեքստ, 5,0 վարկանիշ և հազարավոր գնահատականներ — գնորդը տեսնում է իրական փորձը, վստահությունը մեծանում է, պատվերի կոնվերսիան բարձրանում է:')}</p>
        </div>
      </div>
      <div class="rp-vs"><span>VS</span></div>
      <div class="rp-col rp-bad">
        <div class="rp-label rp-label-bad"><i class="fas fa-times-circle"></i> <span data-ru="НЕ ПРОДАЁТ" data-am="ՉԻ ՎԱՃԱՌՈՒՄ">${t('НЕ ПРОДАЁТ', 'ՉԻ ՎԱՃԱՌՈՒՄ')}</span></div>
        <div class="rp-img"><img src="/static/img/review-bad.webp" alt="Непродающий отзыв — низкий рейтинг, шаблонные оценки без текста" loading="lazy" decoding="async"></div>
        <div class="rp-text">
          <h4 data-ru="Шаблонные оценки без текста" data-am="Կաղապարային գնահատականներ առանց տեքստի">${t('Шаблонные оценки без текста', 'Կաղապարային գնահատականներ առանց տեքստի')}</h4>
          <p data-ru="Низкий рейтинг (3,8), мало оценок, пустые шаблонные отзывы без фото и без живого текста — покупатель не видит ценности, не доверяет товару и уходит к конкурентам." data-am="Ցածր վարկանիշ (3,8), քիչ գնահատականներ, դատարկ կաղապարային կարծիքներ առանց լուսանկարների և կենդանի տեքստի — գնորդը արժեք չի տեսնում, չի վստահում ապրանքին և գնում է մրցակիցների մոտ:">${t('Низкий рейтинг (3,8), мало оценок, пустые шаблонные отзывы без фото и без живого текста — покупатель не видит ценности, не доверяет товару и уходит к конкурентам.', 'Ցածր վարկանիշ (3,8), քիչ գնահատականներ, դատարկ կաղապարային կարծիքներ առանց լուսանկարների և կենդանի տեքստի — գնորդը արժեք չի տեսնում, չի վստահում ապրանքին և գնում է մրցակիցների մոտ:')}</p>
        </div>
      </div>
    </div>

    <div class="section-cta">
      <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-lg"><i class="fas fa-star"></i> <span data-ru="Заказать продающие отзывы" data-am="Պատվիրել վաճառող կարծիքներ">${t('Заказать продающие отзывы', 'Պատվիրել վաճառող կարծիքներ')}</span></a>
    </div>
  </div>
</section>

<!-- ===== БЮДЖЕТ: 11 000 ₽ блогер vs выкупы ===== -->
<section class="section section-dark" id="fifty-vs-fifty" data-section-id="fifty-vs-fifty">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-balance-scale-right"></i> <span data-ru="Сравнение бюджетов" data-am="Բյուջեների համեմատություն">${t('Сравнение бюджетов', 'Բյուջեների համեմատություն')}</span></div>
      <h2 class="section-title" data-ru="11 000 ₽ на блогера vs 11 000 ₽ на выкупы" data-am="50 000 ֏ բլոգերին vs 50 000 ֏ գնումներին">${t('11 000 ₽ на блогера vs 11 000 ₽ на выкупы', '50 000 ֏ բլոգերին vs 50 000 ֏ գնումներին')}</h2>
    </div>

    <div class="why-block">
      <h3><i class="fas fa-balance-scale-right"></i> <span data-ru="11 000 ₽ на блогера vs 11 000 ₽ на выкупы — что эффективнее?" data-am="50 000 ֏ բլոգերին vs 50 000 ֏ գնումներին — որն է ավելի արդյունավետ?">${t('11 000 ₽ на блогера vs 11 000 ₽ на выкупы — что эффективнее?', '50 000 ֏ բլոգերին vs 50 000 ֏ գնումներին — որն է ավելի արդյունավետ?')}</span></h3>
      <div class="compare-box">
        <div class="compare-side bad">
          <h4><i class="fas fa-dice"></i> <span data-ru="Reels у блогера" data-am="Reels բլոգերի մոտ">${t('Reels у блогера', 'Reels բլոգերի մոտ')}</span></h4>
          <div class="price-tag" data-ru="11 000 ₽" data-am="50 000 ֏">11 000 ₽</div>
          <p data-ru="1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это всегда риск без гарантий результата." data-am="1 տեսանյութ բլոգերի մոտ — դա վիճակախաղ է: Կհայտնվի՞ առաջարկություններում, թե ոչ — ոչ ոք չգիտի: Եթե չթռչի — գումարը կորած է: Դա միշտ ռիսկ է առանց արդյունքի երաշխիքների:">${t('1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это <strong>всегда риск</strong> без гарантий результата.', '1 տեսանյութ բլոգերի մոտ — դա վիճակախաղ է: Կհայտնվի՞ առաջարկություններում, թե ոչ — ոչ ոք չգիտի: Եթե չթռչի — գումարը կորած է: Դա <strong>միշտ ռիսկ է</strong> առանց արդյունքի երաշխիքների:')}</p>
        </div>
        <div class="compare-side good">
          <h4><i class="fas fa-chart-line"></i> <span data-ru="25 выкупов по ключевым" data-am="25 գնում բանալի բառերով">${t('25 выкупов по ключевым', '25 գնում բանալի բառերով')}</span></h4>
          <div class="price-tag" data-ru="11 000 ₽" data-am="50 000 ֏">11 000 ₽</div>
          <p data-ru="25 выкупов по целевому запросу — это 100% проверенный способ продвижения. Ваш товар быстро поднимается в ТОП выдачи, закрепляется там и начинает привлекать органический трафик. Больше продаж. Больше гарантированной выручки." data-am="25 գնում թիրախային բանալիով — դա 100% ապացուցված առաջխաղացման մեթոդ է: Ձեր ապրանքը արագ բարձրանում է TOP-ում, ամրապնդվում և սկսում ներգրավել օրգանական տրաֆիկ: Ավելի շատ վաճառք, ավելի շատ երաշխավորված եկամուտ:">${t('25 выкупов по целевому запросу — это <strong>100% проверенный способ</strong> продвижения. Ваш товар быстро поднимается в ТОП выдачи, закрепляется там и начинает привлекать <strong>органический трафик</strong>. Больше продаж. Больше гарантированной выручки.', '25 գնում թիրախային բանալիով — դա <strong>100% ապացուցված մեթոդ</strong> է: Ձեր ապրանքը արագ բարձրանում է TOP-ում, ամրապնդվում և սկսում ներգրավել <strong>օրգանական տրաֆիկ</strong>: Ավելի շատ վաճառք, ավելի շատ երաշխավորված եկամուտ:')}</p>
        </div>
      </div>
      <div class="highlight-result" data-ru="Факт: при выкупах по 1 ключевому запросу уже от 25 штук товар быстро продвигается в ТОП и закрепляется там надолго — за счёт улучшения всех поведенческих метрик. А органический трафик WB становится вашим основным источником продаж." data-am="Փաստ. 1 բանալի բառով արդեն 25 գնման դեպքում ապրանքը արագ առաջ է գնում TOP և ամրապնդվում երկար ժամանակով — բոլոր վարքային ցուցանիշների բարելավման հաշվին: Իսկ WB-ի օրգանական տրաֆիկը դառնում է ձեր վաճառքի հիմնական աղբյուրը:"><i class="fas fa-lightbulb"></i> <strong>${t('Факт:', 'Փաստ:')}</strong> ${t('при выкупах по 1 ключевому запросу уже от <strong>25 штук</strong> товар быстро продвигается в ТОП и закрепляется там надолго — за счёт улучшения всех поведенческих метрик. А органический трафик WB становится вашим основным источником продаж.', '1 բանալի բառով արդեն <strong>25 գնման</strong> դեպքում ապրանքը արագ առաջ է գնում TOP և ամրապնդվում երկար ժամանակով — բոլոր վարքային ցուցանիշների բարելավման հաշվին: Իսկ WB-ի օրգանական տրաֆիկը դառնում է ձեր վաճառքի հիմնական աղբյուրը:')}</div>
    </div>

    <div class="section-cta">
      <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-warning"><i class="fas fa-fire"></i> <span data-ru="Начать выкупы по ключевикам" data-am="Սկսել գնումները բանալիներով">${t('Начать выкупы по ключевикам', 'Սկսել գնումները բանալիներով')}</span></a>
    </div>
  </div>
</section>

<!-- ===== ЛЕГАЛЬНО — WB OFFICIAL ===== -->
<section class="section" id="wb-official" data-section-id="wb-official">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-gavel"></i> <span data-ru="Официально" data-am="Պաշտոնապես">${t('Официально', 'Պաշտոնապես')}</span></div>
      <h2 class="section-title" data-ru="Wildberries официально разрешил самовыкупы" data-am="Wildberries-ը պաշտոնապես թույլատրել է ինքնագնումները">Wildberries <span class="gr">${t('официально разрешил', 'պաշտոնապես թույլատրել է')}</span> ${t('самовыкупы', 'ինքնագնումները')}</h2>
    </div>

    <div class="why-block">
      <div class="wb-official-badge"><i class="fas fa-check-circle"></i> <span data-ru="Подтверждено в оферте WB" data-am="Հաստատված է WB-ի օֆերտայում">${t('Подтверждено в оферте WB', 'Հաստատված է WB-ի օֆերտայում')}</span></div>

      <h3><i class="fas fa-shield-alt"></i> <span data-ru="Никаких штрафов. Никаких рисков." data-am="Ոչ մի տուգանք: Ոչ մի ռիսկ:">${t('Никаких штрафов. Никаких рисков.', 'Ոչ մի տուգանք: Ոչ մի ռիսկ:')}</span></h3>
      <p data-ru="Wildberries официально подтвердил в своей оферте, что самовыкупы не являются нарушением. За это не предусмотрены штрафы или блокировки кабинета. Тысячи успешных продавцов используют этот инструмент каждый день." data-am="Wildberries-ը պաշտոնապես հաստատել է իր օֆերտայում, որ ինքնագնումները խախտում չեն: Դրանց համար տուգանքներ կամ արգելափակումներ չեն նախատեսված: Հազարավոր հաջողակ վաճառողներ օգտագործում են այս գործիքը ամեն օր:">${t('Wildberries официально подтвердил в своей оферте, что самовыкупы <strong>не являются нарушением</strong>. За это не предусмотрены штрафы или блокировки кабинета. Тысячи успешных продавцов используют этот инструмент каждый день.', 'Wildberries-ը պաշտոնապես հաստատել է իր օֆերտայում, որ ինքնագնումները <strong>խախտում չեն</strong>: Դրանց համար տուգանքներ կամ արգելափակումներ չեն նախատեսված: Հազարավոր հաջողակ վաճառողներ օգտագործում են այս գործիքը ամեն օր:')}</p>

      <h3><i class="fas fa-arrow-up"></i> <span data-ru="WB вернул приоритет органической выдачи" data-am="WB-ն վերադարձրել է օրգանական արդյունքների առաջնահերթությունը">${t('WB вернул приоритет органической выдачи', 'WB-ն վերադարձրել է օրգանական արդյունքների առաջնահերթությունը')}</span></h3>
      <p data-ru="Wildberries подтвердил в обновлённой оферте: приоритет в поисковой выдаче получают товары с лучшими поведенческими метриками — конверсия, время на карточке, добавления в корзину, заказы. Именно это мы и прокачиваем при каждом выкупе." data-am="Wildberries-ը հաստատել է թարմացված օֆերտայում. որոնման արդյունքներում առաջնահերթություն են ստանում լավագույն վարքային ցուցանիշներով ապրանքները — կոնվերսիա, քարտի վրա անցկացրած ժամանակ, զամբյուղում ավելացումներ, պատվերներ: Հենց դա է, ինչ մենք բարձրացնում ենք յուրաքանչյուր գնման ժամանակ:">${t('Wildberries подтвердил в обновлённой оферте: приоритет в поисковой выдаче получают товары с лучшими <strong>поведенческими метриками</strong> — конверсия, время на карточке, добавления в корзину, заказы. <strong>Именно это мы и прокачиваем при каждом выкупе.</strong>', 'Wildberries-ը հաստատել է թարմացված օֆերտայում. որոնման արդյունքներում առաջնահերթություն են ստանում լավագույն <strong>վարքային ցուցանիշներով</strong> ապրանքները — կոնվերսիա, քարտի վրա անցկացրած ժամանակ, զամբյուղում ավելացումներ, պատվերներ: <strong>Հենց դա է, ինչ մենք բարձրացնում ենք յուրաքանչյուր գնման ժամանակ:</strong>')}</p>

      <div class="highlight-result" data-ru="Сейчас — лучшее время для продвижения вашего товара. Пока конкуренты сомневаются — вы уже можете занять ТОП выдачи, привлечь органический трафик и зарабатывать больше. Не ждите, пока конкуренты сделают это первыми." data-am="Հիմա ձեր ապրանքի առաջխաղացման լավագույն ժամանակն է: Մինչ մրցակիցները կասկածում են — դուք արդեն կարող եք զբաղեցնել TOP-ը, ներգրավել օրգանական տրաֆիկ և ավելի շատ վաստակել: Մի սպասեք, որ մրցակիցները դա անեն ձեզանից առաջ:"><i class="fas fa-rocket"></i> <strong>${t('Сейчас — лучшее время', 'Հիմա — լավագույն ժամանակն է')}</strong> ${t('для продвижения вашего товара. Пока конкуренты сомневаются — вы уже можете занять ТОП выдачи, привлечь органический трафик и <strong>зарабатывать больше</strong>. Не ждите, пока конкуренты сделают это первыми.', 'ձեր ապրանքի առաջխաղացման համար: Մինչ մրցակիցները կասկածում են — դուք արդեն կարող եք զբաղեցնել TOP-ը, ներգրավել օրգանական տրաֆիկ և <strong>ավելի շատ վաստակել</strong>: Մի սպասեք, որ մրցակիցները դա անեն ձեզանից առաջ:')}</div>
    </div>

    <div class="section-cta">
      <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-success"><i class="fas fa-rocket"></i> <span data-ru="Занять ТОП прямо сейчас" data-am="Զբաղեցնել TOP-ը հիմա">${t('Занять ТОП прямо сейчас', 'Զբաղեցնել TOP-ը հիմա')}</span></a>
    </div>
  </div>
</section>

<!-- ===== CALCULATOR (full, mirrors /services) ===== -->
<section class="section section-dark" id="calculator" data-section-id="calculator">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-calculator"></i> <span data-ru="Калькулятор" data-am="Հաշվիչ">${t('Калькулятор', 'Հաշվիչ')}</span></div>
      <h2 class="section-title" data-ru="Рассчитайте стоимость выкупов" data-am="Հաշվեք գնումների արժեքը">${t('Рассчитайте стоимость выкупов', 'Հաշվեք գնումների արժեքը')}</h2>
      <p class="section-sub" data-ru="Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram." data-am="Ընտրեք անհրաժեշտ ծառայությունները, նշեք քանակը և իմացեք գումարը: Պատվերը ձևակերպվում է Telegram-ով:">${t('Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram.', 'Ընտրեք անհրաժեշտ ծառայությունները, նշեք քանակը և իմացեք գումարը: Պատվերը ձևակերպվում է Telegram-ով:')}</p>
    </div>
    <div class="calc-wrap">
      <div class="calc-packages" id="calcPackages" style="display:none"></div>
      <div class="calc-tabs">
        <div class="calc-tab active" onclick="showCalcTab('buyouts',this)" data-ru="Выкупы" data-am="Գնումներ">${t('Выкупы', 'Գնումներ')}</div>
        <div class="calc-tab" onclick="showCalcTab('reviews',this)" data-ru="Отзывы" data-am="Կարծիքներ">${t('Отзывы', 'Կարծիքներ')}</div>
        <div class="calc-tab" onclick="showCalcTab('photo',this)" data-ru="Фотосъёмка" data-am="Լուսանկարահանում">${t('Фотосъёмка', 'Լուսանկարահանում')}</div>
        <div class="calc-tab" onclick="showCalcTab('ff',this)" data-ru="ФФ" data-am="Ֆուլֆիլմենթ">${t('ФФ', 'Ֆուլֆիլմենթ')}</div>
        <div class="calc-tab" onclick="showCalcTab('logistics',this)" data-ru="Логистика" data-am="Լոգիստիկա">${t('Логистика', 'Լոգիստիկա')}</div>
        <div class="calc-tab" onclick="showCalcTab('other',this)" data-ru="Прочие услуги" data-am="Այլ ծառայություններ">${t('Прочие услуги', 'Այլ ծառայություններ')}</div>
      </div>

      <!-- ===== ВЫКУПЫ ===== -->
      <div class="calc-group active" id="cg-buyouts">
        <div class="calc-row" data-price="buyout" id="buyoutRow">
          <div class="calc-label" data-ru="Выкуп + забор из ПВЗ" data-am="Գնում + ստացում ՊՎԶ-ից">${t('Выкуп + забор из ПВЗ', 'Գնում + ստացում ՊՎԶ-ից')}</div>
          <div class="calc-price" id="buyoutPriceLabel">2 000 ֏</div>
          <div class="calc-input"><button onclick="ccBuyout(-1)">−</button><input type="number" id="buyoutQty" value="0" min="0" max="999" onchange="onBuyoutInput()" oninput="onBuyoutInput()"><button onclick="ccBuyout(1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Выкуп КГТ + забор из ПВЗ" data-am="Ծանրաքաշ ապրանքի գնում + ստացում ՊՎԶ-ից">${t('Выкуп КГТ + забор из ПВЗ', 'Ծանրաքաշ ապրանքի գնում + ստացում ՊՎԶ-ից')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>

      <!-- ===== ОТЗЫВЫ ===== -->
      <div class="calc-group" id="cg-reviews">
        <div class="calc-row" data-price="300">
          <div class="calc-label" data-ru="Оценка" data-am="Գնահատական">${t('Оценка', 'Գնահատական')}</div>
          <div class="calc-price">300 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="500">
          <div class="calc-label" data-ru="Оценка + отзыв" data-am="Գնահատական + կարծիք">${t('Оценка + отзыв', 'Գնահատական + կարծիք')}</div>
          <div class="calc-price">500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="500">
          <div class="calc-label" data-ru="Вопрос к товару" data-am="Հարց ապրանքի վերաբերյալ">${t('Вопрос к товару', 'Հարց ապրանքի վերաբերյալ')}</div>
          <div class="calc-price">500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="250">
          <div class="calc-label" data-ru="Написание текста отзыва" data-am="Կարծիքի տեքստի գրում">${t('Написание текста отзыва', 'Կարծիքի տեքստի գրում')}</div>
          <div class="calc-price">250 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="100">
          <div class="calc-label" data-ru="Подписка на бренд / страницу" data-am="Բրենդի / էջի բաժանորդագրություն">${t('Подписка на бренд / страницу', 'Բրենդի / էջի բաժանորդագրություն')}</div>
          <div class="calc-price">100 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>

      <!-- ===== ФОТОСЪЁМКА ===== -->
      <div class="calc-group" id="cg-photo">
        <div class="calc-row" data-price="3500">
          <div class="calc-label" data-ru="Фотосессия в гардеробной WB (жен. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (կին մոդել)">${t('Фотосессия в гардеробной WB (жен. модель)', 'Լուսանկարահանում WB հագուստապահարանում (կին մոդել)')}</div>
          <div class="calc-price">3 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="4500">
          <div class="calc-label" data-ru="Фотосессия в гардеробной WB (муж. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (տղամարդ մոդել)">${t('Фотосессия в гардеробной WB (муж. модель)', 'Լուսանկարահանում WB հագուստապահարանում (տղամարդ մոդել)')}</div>
          <div class="calc-price">4 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Предметная фотосъёмка (3 фото)" data-am="Առարկայական լուսանկարահանում (3 լուսանկար)">${t('Предметная фотосъёмка (3 фото)', 'Առարկայական լուսանկարահանում (3 լուսանկար)')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="5000">
          <div class="calc-label" data-ru="Предметная съёмка (крупное / техника, 3 фото)" data-am="Առարկայական լուսանկարահանում (խոշոր / տեխնիկա, 3 լուս.)">${t('Предметная съёмка (крупное / техника, 3 фото)', 'Առարկայական լուսանկարահանում (խոշոր / տեխնիկա, 3 լուս.)')}</div>
          <div class="calc-price">5 000 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Ребёнок модель (до 14 лет)" data-am="Երեխա մոդել (մինչև 14 տարեկան)">${t('Ребёнок модель (до 14 лет)', 'Երեխա մոդել (մինչև 14 տարեկան)')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="7000">
          <div class="calc-label" data-ru="Видеообзор товара" data-am="Ապրանքի վիդեոհոլովակ">${t('Видеообзор товара', 'Ապրանքի վիդեոհոլովակ')}</div>
          <div class="calc-price">7 000 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>

      <!-- ===== ФФ (Фулфилмент) ===== -->
      <div class="calc-group" id="cg-ff">
        <div class="calc-row" data-price="100">
          <div class="calc-label" data-ru="Замена штрихкода" data-am="Շտրիխկոդի փոխարինում">${t('Замена штрихкода', 'Շտրիխկոդի փոխարինում')}</div>
          <div class="calc-price">100 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="200">
          <div class="calc-label" data-ru="Переупаковка (наша)" data-am="Վերափաթեթավորում (մեր փաթեթ)">${t('Переупаковка (наша)', 'Վերափաթեթավորում (մեր փաթեթ)')}</div>
          <div class="calc-price">200 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="150">
          <div class="calc-label" data-ru="Переупаковка (клиента)" data-am="Վերափաթեթավորում (հաճախորդի փաթեթ)">${t('Переупаковка (клиента)', 'Վերափաթեթավորում (հաճախորդի փաթեթ)')}</div>
          <div class="calc-price">150 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>

      <!-- ===== ЛОГИСТИКА ===== -->
      <div class="calc-group" id="cg-logistics">
        <div class="calc-row" data-price="2000">
          <div class="calc-label" data-ru="Доставка на склад WB (1 коробка 60х40х40)" data-am="Առաքում WB պահեստ (1 տուփ 60x40x40)">${t('Доставка на склад WB (1 коробка 60х40х40)', 'Առաքում WB պահեստ (1 տուփ 60x40x40)')}</div>
          <div class="calc-price">2 000 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Доставка до вашего склада (1 коробка 60х40х40)" data-am="Առաքում ձեր պահեստ (1 տուփ 60x40x40)">${t('Доставка до вашего склада (1 коробка 60х40х40)', 'Առաքում ձեր պահեստ (1 տուփ 60x40x40)')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>

      <!-- ===== ПРОЧИЕ УСЛУГИ ===== -->
      <div class="calc-group" id="cg-other">
        <div class="calc-row" data-price="1500">
          <div class="calc-label" data-ru="Глажка одежды (одиночная вещь)" data-am="Հագուստի արդուկում (մեկ իր)">${t('Глажка одежды (одиночная вещь)', 'Հագուստի արդուկում (մեկ իր)')}</div>
          <div class="calc-price">1 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Глажка одежды (верхняя одежда)" data-am="Հագուստի արդուկում (վերնահագուստ)">${t('Глажка одежды (верхняя одежда)', 'Հագուստի արդուկում (վերնահագուստ)')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="1500">
          <div class="calc-label" data-ru="Забор из ПВЗ для съёмки" data-am="Վերցնում ՊՎԶ-ից">${t('Забор из ПВЗ для съёмки', 'Վերցնում ՊՎԶ-ից')}</div>
          <div class="calc-price">1 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="1500">
          <div class="calc-label" data-ru="Возврат в ПВЗ после съёмки" data-am="Վերադարձ ՊՎԶ լուսանկարահանումից հետո">${t('Возврат в ПВЗ после съёмки', 'Վերադարձ ՊՎԶ լուսանկարահանումից հետո')}</div>
          <div class="calc-price">1 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>

      <div class="calc-total">
        <div class="calc-total-label" data-ru="Итого:" data-am="Ընդամենը:">${t('Итого:', 'Ընդամենը:')}</div>
        <div class="calc-total-value" id="calcTotal" data-total="0">0 ֏</div>
      </div>

      <!-- Referral code field -->
      <div id="calcRefWrap" style="margin-top:16px;padding:16px;background:rgba(139,92,246,0.05);border:1px solid var(--border);border-radius:var(--r-sm)">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <label style="display:block;font-size:0.82rem;font-weight:600;color:var(--accent);margin-bottom:6px"><i class="fas fa-gift" style="margin-right:6px"></i><span data-ru="Есть промокод?" data-am="Պրոմոկոդ ունեք?">${t('Есть промокод?', 'Պրոմոկոդ ունեք?')}</span></label>
            <input type="text" id="refCodeInput" placeholder="PROMO2026" style="width:100%;padding:10px 14px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.92rem;font-family:inherit;text-transform:uppercase;outline:none;transition:var(--t)" onfocus="this.style.borderColor='var(--purple)'" onblur="this.style.borderColor='var(--border)'">
          </div>
          <button onclick="checkRefCode()" class="btn btn-outline" style="padding:10px 20px;font-size:0.88rem;white-space:nowrap"><i class="fas fa-check-circle" style="margin-right:6px"></i><span data-ru="Применить" data-am="Կիրառել">${t('Применить', 'Կիրառել')}</span></button>
        </div>
        <div id="refResult" style="display:none;margin-top:10px;padding:10px 14px;border-radius:8px;font-size:0.88rem;font-weight:500"></div>
      </div>

      <div class="calc-cta" style="display:none">
        <a href="https://wa.me/37455226224" id="calcTgBtn" class="btn btn-primary btn-lg" target="_blank">
          <i class="fab fa-whatsapp"></i>
          <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">${t('Заказать сейчас', 'Պատվիրել հիմա')}</span>
        </a>
      </div>
    </div>
  </div>
</section>

${renderSvcTriangleSection({ lang, current: 'buyouts' })}
<!-- ===== FINAL CTA STRIP ===== -->
<section class="bp-cta-strip">
  <div class="container">
    <div class="acs-card">
      <div class="acs-text">
        <h3 data-ru="Готовы начать выкупы?" data-am="Պատրա՞ստ եք սկսել գնումները" data-edit-key="buyouts__cta_strip" data-edit-idx="0">${tb('buyouts__cta_strip', 0, 'Готовы начать выкупы?', 'Պատրա՞ստ եք սկսել գնումները')}</h3>
        <p data-ru="Напишите в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов." data-am="Գրեք Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։" data-edit-key="buyouts__cta_strip" data-edit-idx="1">${tb('buyouts__cta_strip', 1, 'Напишите в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов.', 'Գրեք Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։')}</p>
      </div>
      <div class="acs-actions">
        <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-tg">
          <i class="fab fa-telegram"></i>
          <span>${tb('buyouts__cta_strip', 2, 'Telegram', 'Telegram')}</span>
        </a>
        <button type="button" class="btn btn-outline" onclick="openCallbackModal()">
          <i class="fas fa-phone"></i>
          <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք">${t('Перезвоните мне', 'Հետ զանգահարեք')}</span>
        </button>
        <a href="/contacts" class="btn btn-primary">
          <i class="fas fa-envelope"></i>
          <span data-ru="Контакты" data-am="Կոնտակտներ">${t('Контакты', 'Կոնտակտներ')}</span>
        </a>
      </div>
    </div>
  </div>
</section>
`

  // SEO: Service schema (Wildberries buyouts) + BreadcrumbList.
  const jsonLd =
    buildServiceLd({
      siteOrigin,
      pagePath: '/buyouts',
      nameRu: 'Выкупы товаров на Wildberries — Go to Top',
      nameAm: 'Ապրանքների հետգնում Wildberries-ում — Go to Top',
      descriptionRu: 'Реальные выкупы живыми людьми по ключевым запросам с собственного склада в Ереване — рост карточки в ТОП Wildberries.',
      descriptionAm: 'Իրական հետագնումներ կենդանի մարդկանց կողմից բանալի բառերով սեփական պահեստից Երևանում — քարտի աճ Wildberries-ի TOP-ում.',
      serviceType: 'Wildberries buyouts service',
      isAM,
    }) +
    buildBreadcrumbLd({ siteOrigin, isAM, page: 'buyouts' })

  return renderPageShell({
    page: 'buyouts',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'buyouts-page',
    mainHtml,
    extraHead: extraHead + jsonLd,
    shellBlocks,
  })
}

// =====================================================================
// renderFaqPage — phase 2D "light" page for /faq.
// Compact hero, 12-item bilingual accordion (uses the same `.faq-item /
// .faq-q / .faq-a` markup the home page consumes via toggleFaq() in
// landing.js) and a small CTA strip — no full calculator.
// SEO is amplified with a JSON-LD `FAQPage` block injected via
// `extraHead` so Google can pick up rich-result entries; the schema
// uses the current-language strings for `name` / `text`.
// =====================================================================
function renderFaqPage(opts: { lang: 'ru' | 'am', siteOrigin: string, pageBlocks?: Record<string, SubpageBlock>, shellBlocks?: Record<string, SubpageBlock> }): string {
  const { lang, siteOrigin, pageBlocks, shellBlocks } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru
  const tb = (blockKey: string, idx: number, fallbackRu: string, fallbackAm: string): string => {
    const block = pageBlocks?.[blockKey]
    if (!block || block.is_visible === 0) return isAM ? fallbackAm : fallbackRu
    const arr = isAM ? block.texts_am : block.texts_ru
    const v = arr?.[idx]
    return (typeof v === 'string' && v.trim()) ? v : (isAM ? fallbackAm : fallbackRu)
  }

  // 12 FAQ items: 7 carried over from the home #faq section + 5 new
  // entries covering payment, guarantees, lead times, paperwork and the
  // legal status of self-buyouts on Wildberries.
  const faqDefaults: Array<{ qRu: string, qAm: string, aRu: string, aAm: string }> = [
    {
      qRu: 'Могут ли заблокировать мой кабинет?',
      qAm: 'Կարող են արգելափակել իմ կաբինետը?',
      aRu: 'За всё время нашей работы ни один кабинет клиента не получил блокировку. Мы используем реальные аккаунты с историей покупок, собственный склад и естественное распределение по географии — алгоритмы WB не отличают такие выкупы от обычных заказов.',
      aAm: 'Մեր աշխատանքի ողջ ընթացքում ոչ մի հաճախորդի կաբինետ չի արգելափակվել: Մենք օգտագործում ենք իրական հաշիվներ գնումների պատմությամբ, սեփական պահեստ և բնական աշխարհագրական բաշխում — WB-ի ալգորիթմները նման հետագնումները չեն տարբերում սովորական պատվերներից:',
    },
    {
      qRu: 'Как быстро начнётся продвижение?',
      qAm: 'Ինչքան արագ կսկսվի առաջխաղացումը?',
      aRu: 'В течение 24 часов после согласования стратегии и оплаты. Менеджер составляет план выкупов по ключевым запросам и запускает первые заказы в тот же день.',
      aAm: '24 ժամվա ընթացքում ստրատեգիայի համաձայնեցումից և վճարումից հետո: Մենեջերը կազմում է հետագնումների պլանը բանալի հարցումներով և գործարկում առաջին պատվերները նույն օրը:',
    },
    {
      qRu: 'Выкупы делают реальные люди или боты?',
      qAm: 'Հետագնումները կատարում են իրական մարդիկ թե բոտեր?',
      aRu: 'Только реальные люди. У нас собственный склад в Ереване с устройствами и реальными аккаунтами. Каждый выкуп оформляется вручную живым покупателем — никаких ботов и эмуляторов.',
      aAm: 'Միայն իրական մարդիկ: Մենք ունենք սեփական պահեստ Երևանում սարքերով և իրական հաշիվներով: Յուրաքանչյուր հետագնում ձևակերպվում է ձեռքով կենդանի գնորդի կողմից — ոչ մի բոտ ու էմուլյատոր:',
    },
    {
      qRu: 'Почему не все выкупы получают отзывы?',
      qAm: 'Ինչու ոչ բոլոր հետագնումներն են ստանում կարծիքներ?',
      aRu: 'Для безопасности вашего кабинета мы публикуем отзывы не более чем на 50% выкупленных товаров. Это имитирует естественное поведение покупателей: реальные клиенты тоже не все оставляют отзывы.',
      aAm: 'Ձեր կաբինետի անվտանգության համար կարծիքները հրապարակում ենք գնված ապրանքների ոչ ավելի քան 50%-ի համար: Սա նմանակում է գնորդների բնական վարքագիծը՝ իրական հաճախորդներն էլ բոլորը կարծիք չեն թողնում:',
    },
    {
      qRu: 'Можно ли заказать только отзывы без выкупов?',
      qAm: 'Հնարավոր է պատվիրել միայն կարծիքներ առանց հետագնումների?',
      aRu: 'Да, мы можем выкупить товар для фото- или видеоотзыва и затем сделать возврат на ПВЗ. Стоимость отдельной услуги уточняйте у менеджера в Telegram.',
      aAm: 'Այո, մենք կարող ենք գնել ապրանքը լուսանկար- կամ տեսանյութ կարծիքի համար և հետո վերադարձնել ՊՎԶ: Առանձին ծառայության արժեքը ճշտեք մենեջերի մոտ Telegram-ով:',
    },
    {
      qRu: 'Какие отчёты мы получаем?',
      qAm: 'Ինչ հաշվետվություններ ենք ստանում?',
      aRu: 'Ежедневные отчёты: статус каждого выкупа, даты забора из ПВЗ, статус и тексты отзывов. Полная прозрачность на каждом этапе — вы всегда видите, на каком шаге находится заказ.',
      aAm: 'Ամենօրյա հաշվետվություններ՝ յուրաքանչյուր հետագնման կարգավիճակ, ՊՎԶ-ից վերցնման ամսաթվեր, կարծիքների կարգավիճակ ու տեքստեր: Լիարժեք թափանցիկություն յուրաքանչյուր փուլում — դուք միշտ տեսնում եք, թե որ քայլում է պատվերը:',
    },
    {
      qRu: 'В какой валюте идут цены?',
      qAm: 'Ինչ արժույթով են գները?',
      aRu: 'Все цены на сайте указаны в армянских драмах (֏ AMD). Принимаем оплату в драмах или рублях по согласованному курсу — детали обсудим перед стартом.',
      aAm: 'Կայքի բոլոր գները նշված են հայկական դրամով (֏ AMD): Ընդունում ենք վճարում դրամով կամ ռուբլիով համաձայնեցված կուրսով — մանրամասները կքննարկենք մինչ սկիզբը:',
    },
    {
      qRu: 'Какие способы оплаты вы принимаете?',
      qAm: 'Ինչ վճարման եղանակներ եք ընդունում?',
      aRu: 'Перевод на банковскую карту в RUB или AMD, безналичный расчёт по реквизитам компании, наличными в офисе в Ереване. Конкретный вариант согласуем в Telegram перед запуском.',
      aAm: 'Բանկային քարտին փոխանցում RUB-ով կամ AMD-ով, անկանխիկ վճարում ընկերության վավերապահանջներով, կանխիկ Երևանի գրասենյակում: Կոնկրետ տարբերակը կհամաձայնեցնենք Telegram-ով մինչ գործարկումը:',
    },
    {
      qRu: 'Что если выкупы не дадут результата?',
      qAm: 'Իսկ եթե հետագնումները արդյունք չտան?',
      aRu: 'Мы не обещаем конкретные позиции в выдаче — на ранжирование влияют карточка, ниша, сезон, конкуренция. Но гарантируем выполнение оговорённого объёма выкупов с реальными отзывами и прозрачной отчётностью. На практике 9 из 10 клиентов возвращаются за повторными пакетами.',
      aAm: 'Մենք չենք խոստանում կոնկրետ դիրքեր որոնման մեջ — դասակարգման վրա ազդում են քարտը, նիշան, սեզոնը, մրցակցությունը: Բայց երաշխավորում ենք համաձայնեցված ծավալի հետագնումների կատարումը իրական կարծիքներով և թափանցիկ հաշվետվությամբ: Գործնականում 10-ից 9 հաճախորդը վերադառնում է կրկնակի փաթեթների համար:',
    },
    {
      qRu: 'Сколько по времени занимает один пакет?',
      qAm: 'Որքա՞ն ժամանակ է պահանջում մեկ փաթեթը?',
      aRu: 'Стандартный пакет из 25–50 выкупов выполняем за 5–7 дней — этот темп выглядит для алгоритмов WB естественно и не вызывает подозрений. Большие объёмы разбиваем на несколько недель по согласованному графику.',
      aAm: '25–50 հետագնումից բաղկացած ստանդարտ փաթեթը կատարում ենք 5–7 օրվա ընթացքում — այս տեմպը WB-ի ալգորիթմների համար բնական է երևում և կասկածներ չի առաջացնում: Մեծ ծավալները բաժանում ենք մի քանի շաբաթների՝ համաձայնեցված գրաֆիկով:',
    },
    {
      qRu: 'Подписываете ли вы договор и выдаёте ли документы?',
      qAm: 'Կնքու՞մ եք պայմանագիր և տրամադրու՞մ եք փաստաթղթեր:',
      aRu: 'Да. Мы официальная компания, зарегистрированная в Армении: работаем по договору с актами выполненных работ. По запросу выставляем счёт в RUB или AMD. Все документы предоставляем до старта работ.',
      aAm: 'Այո: Մենք պաշտոնապես գրանցված ընկերություն ենք Հայաստանում, աշխատում ենք պայմանագրով՝ կատարված աշխատանքների ակտերով: Ըստ պահանջի դուրս ենք գրում հաշիվ RUB-ով կամ AMD-ով: Բոլոր փաստաթղթերը տրամադրում ենք մինչ աշխատանքների սկիզբը:',
    },
    {
      qRu: 'Это законно? Не нарушаю ли я правила Wildberries?',
      qAm: 'Արդյո՞ք սա օրինական է: Wildberries-ի կանոնները չե՞մ խախտում:',
      aRu: 'Wildberries официально подтвердил в обновлённой оферте, что самовыкупы не являются нарушением и штрафы за них не предусмотрены. Алгоритм WB ранжирует товары по поведенческим метрикам — именно их мы и улучшаем при каждом выкупе по ключевому запросу.',
      aAm: 'Wildberries-ը պաշտոնապես հաստատել է թարմացված օֆերտայում, որ ինքնագնումները խախտում չեն, և դրանց համար տուգանքներ նախատեսված չեն: WB-ի ալգորիթմը դասակարգում է ապրանքները վարքագծային ցուցանիշներով — հենց դրանք մենք բարելավում ենք յուրաքանչյուր հետագնման ժամանակ բանալի բառով:',
    },
  ]

  // Phase 3C: try to override the hard-coded list with rows from the
  // `faq__items` CMS block. The block stores 24 strings as 12 [Q, A]
  // pairs in the same language array — index 0/2/4/... = question,
  // 1/3/5/... = answer. If the block is missing/hidden or any row is
  // malformed we silently fall back to faqDefaults so SEO + JSON-LD
  // never lose content.
  const faqItemsBlock = pageBlocks?.['faq__items']
  const itemsFromDb: Array<{ qRu: string, qAm: string, aRu: string, aAm: string }> = []
  if (faqItemsBlock && faqItemsBlock.is_visible !== 0) {
    const ru = faqItemsBlock.texts_ru || []
    const am = faqItemsBlock.texts_am || []
    const len = Math.min(Math.floor(ru.length / 2), Math.floor(am.length / 2))
    for (let i = 0; i < len; i++) {
      itemsFromDb.push({
        qRu: ru[2 * i] || '',
        qAm: am[2 * i] || '',
        aRu: ru[2 * i + 1] || '',
        aAm: am[2 * i + 1] || '',
      })
    }
  }
  const faqItems = itemsFromDb.length > 0 ? itemsFromDb : faqDefaults

  const seo = {
    title: t(
      'Часто задаваемые вопросы — Go to Top | FAQ Wildberries',
      'Հաճախ տրվող հարցեր — Go to Top | FAQ Wildberries'
    ),
    description: t(
      'Ответы на самые частые вопросы продавцов Wildberries: выкупы, легальность, документы, безопасность, оплата',
      'Պատասխաններ Wildberries-ի վաճառողների ամենահաճախ տրվող հարցերին՝ հետագնումներ, օրինականություն, փաստաթղթեր, անվտանգություն'
    ),
    ogImage: `${siteOrigin}/static/img/og-image.png`,
  }

  // JSON-LD FAQPage — current-language `name` / `text`. Strict JSON via
  // JSON.stringify; we also escape `</` to `<\/` so the payload can never
  // accidentally close the surrounding <script> tag.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: isAM ? item.qAm : item.qRu,
      acceptedAnswer: {
        '@type': 'Answer',
        text: isAM ? item.aAm : item.aRu,
      },
    })),
  }
  const faqJsonLdSafe = JSON.stringify(faqJsonLd).replace(/<\//g, '<\\/')

  // Page-only styles. Reuses --purple/--bg-card/--text/etc tokens declared
  // in renderPageShell. The .faq-item / .faq-q / .faq-a rules mirror the
  // home #faq subset so toggleFaq() in landing.js works without changes.
  const extraHead = `<link rel="stylesheet" href="/static/css/page-faq.css?v=${CACHE_VERSION}">
<script type="application/ld+json">${faqJsonLdSafe}</script>`

  const tgUrl = PLACEHOLDER_TG_URL

  // Render accordion. First item gets `.active` so the answer is open by
  // default — toggleFaq() in landing.js handles the rest.
  // Phase 3C: items can come from CMS (faq__items block) — escape every
  // interpolation so admin-controlled `"`, `<`, `>` cannot break attributes
  // or inject markup on the public /faq page.
  const e = (s: string) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
  const faqItemsHtml = faqItems.map((item, idx) => {
    const activeCls = idx === 0 ? ' active' : ''
    const qText = t(item.qRu, item.qAm)
    const aText = t(item.aRu, item.aAm)
    return `      <div class="faq-item${activeCls}">
        <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="${e(item.qRu)}" data-am="${e(item.qAm)}">${e(qText)}</span><i class="fas fa-chevron-down"></i></div>
        <div class="faq-a"><p data-ru="${e(item.aRu)}" data-am="${e(item.aAm)}">${e(aText)}</p></div>
      </div>`
  }).join('\n')

  const mainHtml = `
<!-- ===== FAQ HERO ===== -->
<section class="fp-hero">
  <div class="container">
    <div class="fh-inner">
      <div class="fh-eyebrow">
        <i class="fas fa-question-circle"></i>
        <span data-ru="FAQ" data-am="ՀՏՀ" data-edit-key="faq__hero" data-edit-idx="0">${tb('faq__hero', 0, 'FAQ', 'ՀՏՀ')}</span>
      </div>
      <h1>
        <span data-ru="Часто задаваемые" data-am="Հաճախ տրվող" data-edit-key="faq__hero" data-edit-idx="1">${tb('faq__hero', 1, 'Часто задаваемые', 'Հաճախ տրվող')}</span>
        <span class="gr" data-ru="вопросы" data-am="հարցեր" data-edit-key="faq__hero" data-edit-idx="2">${tb('faq__hero', 2, 'вопросы', 'հարցեր')}</span>
      </h1>
      <p class="fh-desc" data-ru="Ответы на ключевые вопросы по выкупам Wildberries: безопасность кабинета, сроки, оплата, документы и легальность. Не нашли ответ — напишите нам в Telegram." data-am="Պատասխաններ Wildberries-ի հետագնումների վերաբերյալ հիմնական հարցերին՝ կաբինետի անվտանգություն, ժամկետներ, վճարում, փաստաթղթեր և օրինականություն: Չգտա՞ք պատասխանը — գրեք մեզ Telegram-ով:" data-edit-key="faq__hero" data-edit-idx="3">${tb('faq__hero', 3, 'Ответы на ключевые вопросы по выкупам Wildberries: безопасность кабинета, сроки, оплата, документы и легальность. Не нашли ответ — напишите нам в Telegram.', 'Պատասխաններ Wildberries-ի հետագնումների վերաբերյալ հիմնական հարցերին՝ կաբինետի անվտանգություն, ժամկետներ, վճարում, փաստաթղթեր և օրինականություն: Չգտա՞ք պատասխանը — գրեք մեզ Telegram-ով:')}</p>
    </div>
  </div>
</section>

<!-- ===== FAQ LIST ===== -->
<section class="fp-faq">
  <div class="container">
    <div class="faq-list">
${faqItemsHtml}
    </div>
  </div>
</section>

<!-- ===== FINAL CTA STRIP ===== -->
<section class="fp-cta-strip">
  <div class="container">
    <div class="acs-card">
      <div class="acs-text">
        <h3 data-ru="Не нашли ответ?" data-am="Չգտա՞ք պատասխանը:" data-edit-key="faq__cta_strip" data-edit-idx="0">${tb('faq__cta_strip', 0, 'Не нашли ответ?', 'Չգտա՞ք պատասխանը:')}</h3>
        <p data-ru="Напишите нам в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов." data-am="Գրեք մեզ Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։" data-edit-key="faq__cta_strip" data-edit-idx="1">${tb('faq__cta_strip', 1, 'Напишите нам в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов.', 'Գրեք մեզ Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։')}</p>
      </div>
      <div class="acs-actions">
        <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-tg">
          <i class="fab fa-telegram"></i>
          <span>Telegram</span>
        </a>
        <button type="button" class="btn btn-outline" onclick="openCallbackModal()">
          <i class="fas fa-phone"></i>
          <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք" data-edit-key="faq__cta_strip" data-edit-idx="2">${tb('faq__cta_strip', 2, 'Перезвоните мне', 'Հետ զանգահարեք')}</span>
        </button>
        <a href="/contacts" class="btn btn-primary">
          <i class="fas fa-envelope"></i>
          <span data-ru="Контакты" data-am="Կոնտակտներ" data-edit-key="faq__cta_strip" data-edit-idx="3">${tb('faq__cta_strip', 3, 'Контакты', 'Կոնտակտներ')}</span>
        </a>
      </div>
    </div>
  </div>
</section>
`

  // SEO: BreadcrumbList in addition to the FAQPage schema already inside extraHead.
  const breadcrumbLd = buildBreadcrumbLd({ siteOrigin, isAM, page: 'faq' })

  return renderPageShell({
    page: 'faq',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'faq-page',
    mainHtml,
    extraHead: extraHead + breadcrumbLd,
    shellBlocks,
  })
}

// =====================================================================
// renderContactsPage — phase 2E "heavy" page for /contacts.
// Compact hero → channels grid (Telegram x2 + WhatsApp) → QR codes →
// lead form (#leadForm consumed by submitForm() in landing.js, posts to
// /api/lead) → address & hours → final CTA strip with callback button.
// No calculator and no __SITE_DATA injection: the form is fully self-
// contained so we keep the page maximally cacheable. intl-tel-input is
// loaded via extraHead so the phone field gets the country selector;
// submitForm() gracefully degrades if the library hasn't booted yet.
// =====================================================================
function renderContactsPage(opts: { lang: 'ru' | 'am', siteOrigin: string, pageBlocks?: Record<string, SubpageBlock>, shellBlocks?: Record<string, SubpageBlock> }): string {
  const { lang, siteOrigin, pageBlocks, shellBlocks } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru
  const tb = (blockKey: string, idx: number, fallbackRu: string, fallbackAm: string): string => {
    const block = pageBlocks?.[blockKey]
    if (!block || block.is_visible === 0) return isAM ? fallbackAm : fallbackRu
    const arr = isAM ? block.texts_am : block.texts_ru
    const v = arr?.[idx]
    return (typeof v === 'string' && v.trim()) ? v : (isAM ? fallbackAm : fallbackRu)
  }

  const seo = {
    title: t(
      'Контакты — Go to Top | Telegram, WhatsApp, обратный звонок',
      'Կապ — Go to Top | Telegram, WhatsApp, հետադարձ զանգ'
    ),
    description: t(
      'Свяжитесь с Go to Top: Telegram, WhatsApp, обратный звонок, форма заявки. Менеджер ответит в течение 5 минут',
      'Կապվեք Go to Top-ի հետ. Telegram, WhatsApp, հետադարձ զանգ, հայտի ձև: Մենեջերը կպատասխանի 5 րոպեի ընթացքում'
    ),
    ogImage: `${siteOrigin}/static/img/og-image.png`,
  }

  const tgUrl = PLACEHOLDER_TG_URL
  const tgSupportUrl = 'https://t.me/suport_admin_2'
  const waUrl = 'https://wa.me/37455226224'

  // Page-only styles. Reuses --purple/--bg-card/--text/etc tokens declared
  // in renderPageShell. .form-card / .form-group are scoped here so they
  // don't conflict with the home-page form (which lives in a different
  // CSS context). intl-tel-input CSS+JS are loaded so #formPhone gets a
  // country selector; submitForm() in landing.js falls back to plain
  // validation when the lib isn't ready.
  const extraHead = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/intl-tel-input@25/build/css/intlTelInput.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/intl-tel-input@25/build/js/intlTelInput.min.js"></script>
<link rel="stylesheet" href="/static/css/page-contacts.css?v=${CACHE_VERSION}">`

  const mainHtml = `
<!-- ===== CONTACTS HERO ===== -->
<section class="cp-hero">
  <div class="container">
    <div class="ch-inner">
      <div class="ch-eyebrow">
        <i class="fas fa-headset"></i>
        <span data-ru="Контакты" data-am="Կապ" data-edit-key="contacts__hero" data-edit-idx="0">${tb('contacts__hero', 0, 'Контакты', 'Կապ')}</span>
      </div>
      <h1>
        <span data-ru="Свяжитесь" data-am="Կապվեք" data-edit-key="contacts__hero" data-edit-idx="1">${tb('contacts__hero', 1, 'Свяжитесь', 'Կապվեք')}</span>
        <span class="gr" data-ru="с нами" data-am="մեզ հետ" data-edit-key="contacts__hero" data-edit-idx="2">${tb('contacts__hero', 2, 'с нами', 'մեզ հետ')}</span>
      </h1>
      <p class="ch-desc" data-ru="Выберите удобный канал — Telegram, WhatsApp, форма заявки или обратный звонок. Менеджер отвечает в среднем за 5 минут в рабочее время." data-am="Ընտրեք ձեզ հարմար եղանակը՝ Telegram, WhatsApp, հայտի ձև կամ հետադարձ զանգ: Մենեջերը պատասխանում է միջինը 5 րոպեի ընթացքում աշխատանքային ժամերին:" data-edit-key="contacts__hero" data-edit-idx="3">${tb('contacts__hero', 3, 'Выберите удобный канал — Telegram, WhatsApp, форма заявки или обратный звонок. Менеджер отвечает в среднем за 5 минут в рабочее время.', 'Ընտրեք ձեզ հարմար եղանակը՝ Telegram, WhatsApp, հայտի ձև կամ հետադարձ զանգ: Մենեջերը պատասխանում է միջինը 5 րոպեի ընթացքում աշխատանքային ժամերին:')}</p>
    </div>
  </div>
</section>

<!-- ===== CHANNELS GRID ===== -->
<section class="cp-channels">
  <div class="container">
    <div class="cp-channels-grid">
      <div class="cp-channel cp-ch-tg">
        <div class="cp-channel-icon"><i class="fab fa-telegram"></i></div>
        <h3 data-ru="Telegram — администратор" data-am="Telegram — ադմինիստրատոր" data-edit-key="contacts__channels" data-edit-idx="0">${tb('contacts__channels', 0, 'Telegram — администратор', 'Telegram — ադմինիստրատոր')}</h3>
        <p class="cp-channel-desc" data-ru="Готовы оплатить и стартовать? Менеджер ответит в течение 5 минут в рабочее время." data-am="Պատրաստ եք վճարել և սկսել: Մենեջերը կպատասխանի 5 րոպեի ընթացքում աշխատանքային ժամերին:" data-edit-key="contacts__channels" data-edit-idx="1">${tb('contacts__channels', 1, 'Готовы оплатить и стартовать? Менеджер ответит в течение 5 минут в рабочее время.', 'Պատրաստ եք վճարել և սկսել: Մենեջերը կպատասխանի 5 րոպեի ընթացքում աշխատանքային ժամերին:')}</p>
        <a href="${tgUrl}" target="_blank" rel="noopener" class="cp-channel-cta">
          <i class="fab fa-telegram"></i>
          <span data-ru="Написать в Telegram" data-am="Գրել Telegram-ով" data-edit-key="contacts__cta" data-edit-idx="0">${tb('contacts__cta', 0, 'Написать в Telegram', 'Գրել Telegram-ով')}</span>
        </a>
      </div>
      <div class="cp-channel cp-ch-tg">
        <div class="cp-channel-icon"><i class="fab fa-telegram"></i></div>
        <h3 data-ru="Telegram — поддержка" data-am="Telegram — աջակցություն" data-edit-key="contacts__channels" data-edit-idx="2">${tb('contacts__channels', 2, 'Telegram — поддержка', 'Telegram — աջակցություն')}</h3>
        <p class="cp-channel-desc" data-ru="Нужен детальный расчёт или консультация по продвижению? Пишите сюда — отвечает старший менеджер." data-am="Պետք է մանրամասն հաշվարկ կամ խորհրդատվություն: Գրեք այստեղ — պատասխանում է ավագ մենեջերը:" data-edit-key="contacts__channels" data-edit-idx="3">${tb('contacts__channels', 3, 'Нужен детальный расчёт или консультация по продвижению? Пишите сюда — отвечает старший менеджер.', 'Պետք է մանրամասն հաշվարկ կամ խորհրդատվություն: Գրեք այստեղ — պատասխանում է ավագ մենեջերը:')}</p>
        <a href="${tgSupportUrl}" target="_blank" rel="noopener" class="cp-channel-cta">
          <i class="fab fa-telegram"></i>
          <span data-ru="Написать в поддержку" data-am="Գրել աջակցությանը" data-edit-key="contacts__cta" data-edit-idx="1">${tb('contacts__cta', 1, 'Написать в поддержку', 'Գրել աջակցությանը')}</span>
        </a>
      </div>
      <div class="cp-channel cp-ch-wa">
        <div class="cp-channel-icon"><i class="fab fa-whatsapp"></i></div>
        <h3 data-ru="WhatsApp" data-am="WhatsApp" data-edit-key="contacts__channels" data-edit-idx="4">${tb('contacts__channels', 4, 'WhatsApp', 'WhatsApp')}</h3>
        <p class="cp-channel-desc" data-ru="Удобно с телефона? Напишите в WhatsApp — отвечаем так же быстро, как в Telegram." data-am="Հարմա՞ր է հեռախոսից: Գրեք WhatsApp-ով — պատասխանում ենք նույնքան արագ, որքան Telegram-ով:" data-edit-key="contacts__channels" data-edit-idx="5">${tb('contacts__channels', 5, 'Удобно с телефона? Напишите в WhatsApp — отвечаем так же быстро, как в Telegram.', 'Հարմա՞ր է հեռախոսից: Գրեք WhatsApp-ով — պատասխանում ենք նույնքան արագ, որքան Telegram-ով:')}</p>
        <a href="${waUrl}" target="_blank" rel="noopener" class="cp-channel-cta">
          <i class="fab fa-whatsapp"></i>
          <span data-ru="Написать в WhatsApp" data-am="Գրել WhatsApp-ով" data-edit-key="contacts__cta" data-edit-idx="2">${tb('contacts__cta', 2, 'Написать в WhatsApp', 'Գրել WhatsApp-ով')}</span>
        </a>
      </div>
    </div>
  </div>
</section>

<!-- ===== QR CODES ===== -->
<section class="cp-qr">
  <div class="container">
    <div class="cp-qr-wrap">
      <div class="cp-qr-eyebrow">
        <i class="fas fa-qrcode"></i>
        <span data-ru="Сканируйте на ходу" data-am="Սկանավորեք քայլելիս">${t('Сканируйте на ходу', 'Սկանավորեք քայլելիս')}</span>
      </div>
      <h2 data-ru="QR-коды для быстрой связи" data-am="QR-կոդեր արագ կապի համար">${t('QR-коды для быстрой связи', 'QR-կոդեր արագ կապի համար')}</h2>
      <p class="cp-qr-sub" data-ru="Откройте камеру телефона, наведите на нужный QR — и сразу попадёте в наш чат или соцсеть." data-am="Բացեք հեռախոսի տեսախցիկը, ուղղեք ցանկալի QR-ի վրա — և անմիջապես կհայտնվեք մեր չատում կամ սոցցանցում:">${t('Откройте камеру телефона, наведите на нужный QR — и сразу попадёте в наш чат или соцсеть.', 'Բացեք հեռախոսի տեսախցիկը, ուղղեք ցանկալի QR-ի վրա — և անմիջապես կհայտնվեք մեր չատում կամ սոցցանցում:')}</p>
      <div class="cp-qr-grid">
        <div class="cp-qr-item">
          <a href="${tgUrl}" target="_blank" rel="noopener" class="cp-qr-card">
            <img src="/static/img/qr/qr-telegram.webp" alt="Telegram QR" loading="lazy">
          </a>
          <span class="cp-qr-label" data-ru="Telegram" data-am="Telegram">Telegram</span>
        </div>
        <div class="cp-qr-item">
          <a href="${waUrl}" target="_blank" rel="noopener" class="cp-qr-card">
            <img src="/static/img/qr/qr-whatsapp.webp" alt="WhatsApp QR" loading="lazy">
          </a>
          <span class="cp-qr-label" data-ru="WhatsApp" data-am="WhatsApp">WhatsApp</span>
        </div>
        <div class="cp-qr-item">
          <a href="https://www.instagram.com/goo_to_top/" target="_blank" rel="noopener" class="cp-qr-card">
            <img src="/static/img/qr/qr-instagram.webp" alt="Instagram QR" loading="lazy">
          </a>
          <span class="cp-qr-label" data-ru="Instagram" data-am="Instagram">Instagram</span>
        </div>
        <div class="cp-qr-item">
          <a href="https://www.facebook.com/gototop.wb" target="_blank" rel="noopener" class="cp-qr-card">
            <img src="/static/img/qr/qr-facebook.webp" alt="Facebook QR" loading="lazy">
          </a>
          <span class="cp-qr-label" data-ru="Facebook" data-am="Facebook">Facebook</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== LEAD FORM (id="leadForm" → submitForm() in landing.js) ===== -->
<section class="cp-form">
  <div class="container">
    <div class="cp-form-header">
      <h2 data-ru="Оставьте заявку" data-am="Թողեք հայտ">${t('Оставьте заявку', 'Թողեք հայտ')}</h2>
      <p data-ru="Заполните форму — менеджер свяжется с вами в течение 5 минут в рабочее время и пришлёт расчёт." data-am="Լրացրեք ձևը — մենեջերը կկապվի ձեզ հետ 5 րոպեի ընթացքում աշխատանքային ժամերին և կուղարկի հաշվարկը:">${t('Заполните форму — менеджер свяжется с вами в течение 5 минут в рабочее время и пришлёт расчёт.', 'Լրացրեք ձևը — մենեջերը կկապվի ձեզ հետ 5 րոպեի ընթացքում աշխատանքային ժամերին և կուղարկի հաշվարկը:')}</p>
    </div>
    <div class="form-card">
      <form id="leadForm" onsubmit="submitForm(event)">
        <div class="form-group">
          <label data-ru="Ваше имя" data-am="Ձեր անունը">${t('Ваше имя', 'Ձեր անունը')}</label>
          <input type="text" id="formName" required placeholder="${t('Имя', 'Անուն')}" data-placeholder-ru="Имя" data-placeholder-am="Անուն">
        </div>
        <div class="form-group">
          <label data-ru="Телефон" data-am="Հեռախոս">${t('Телефон', 'Հեռախոս')}</label>
          <input type="tel" id="formPhone" required>
        </div>
        <div class="form-group">
          <label data-ru="Что продаёте на WB?" data-am="Ինչ եք վաճառում WB-ում?">${t('Что продаёте на WB?', 'Ինչ եք վաճառում WB-ում?')}</label>
          <input type="text" id="formProduct" placeholder="${t('Одежда, электроника...', 'Հագուստ, էլեկտրոնիկա...')}" data-placeholder-ru="Одежда, электроника..." data-placeholder-am="Հագուստ, էլեկտրոնիկա...">
        </div>
        <div class="form-group">
          <label data-ru="Какие услуги интересуют?" data-am="Ինչ ծառայություններ են հետաքրքրում?">${t('Какие услуги интересуют?', 'Ինչ ծառայություններ են հետաքրքրում?')}</label>
          <select id="formService">
            <option value="buyouts" data-ru="Выкупы" data-am="Գնումներ">${t('Выкупы', 'Գնումներ')}</option>
            <option value="reviews" data-ru="Отзывы" data-am="Կարծիքներ">${t('Отзывы', 'Կարծիքներ')}</option>
            <option value="photos" data-ru="Фотосессия" data-am="Լուսանկարահանում">${t('Фотосессия', 'Լուսանկարահանում')}</option>
            <option value="complex" data-ru="Комплекс услуг" data-am="Ծառայությունների փաթեթ" selected>${t('Комплекс услуг', 'Ծառայությունների փաթեթ')}</option>
          </select>
        </div>
        <div class="form-group">
          <label data-ru="Комментарий (необязательно)" data-am="Մեկնաբանություն (ոչ պարտադիր)">${t('Комментарий (необязательно)', 'Մեկնաբանություն (ոչ պարտադիր)')}</label>
          <textarea id="formMessage" placeholder="${t('Опишите ваш товар...', 'Նկարագրեք ձեր ապրանքը...')}" data-placeholder-ru="Опишите ваш товар..." data-placeholder-am="Նկարագրեք ձեր ապրանքը..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center">
          <i class="fas fa-paper-plane"></i>
          <span data-ru="Отправить заявку" data-am="Ուղարկել հայտը">${t('Отправить заявку', 'Ուղարկել հայտը')}</span>
        </button>
      </form>
    </div>
  </div>
</section>

<!-- ===== ADDRESS & HOURS ===== -->
<section class="cp-info">
  <div class="container">
    <div class="cp-info-grid">
      <div class="cp-info-card">
        <div class="cp-info-icon"><i class="fas fa-map-marker-alt"></i></div>
        <div class="cp-info-text">
          <h3 data-ru="Где мы находимся" data-am="Որտեղ ենք գտնվում">${t('Где мы находимся', 'Որտեղ ենք գտնվում')}</h3>
          <p><strong data-ru="Ереван, Армения" data-am="Երևան, Հայաստան">${t('Ереван, Армения', 'Երևան, Հայաստան')}</strong><span data-ru="Собственный склад и офис в Ереване. Точный адрес отправляем после согласования заказа в Telegram — встреча по предварительной записи." data-am="Սեփական պահեստ և գրասենյակ Երևանում: Ճշգրիտ հասցեն ուղարկում ենք պատվերի համաձայնեցումից հետո Telegram-ով — հանդիպումը նախնական գրանցումով:">${t('Собственный склад и офис в Ереване. Точный адрес отправляем после согласования заказа в Telegram — встреча по предварительной записи.', 'Սեփական պահեստ և գրասենյակ Երևանում: Ճշգրիտ հասցեն ուղարկում ենք պատվերի համաձայնեցումից հետո Telegram-ով — հանդիպումը նախնական գրանցումով:')}</span></p>
        </div>
      </div>
      <div class="cp-info-card">
        <div class="cp-info-icon"><i class="fas fa-clock"></i></div>
        <div class="cp-info-text">
          <h3 data-ru="Часы работы" data-am="Աշխատանքային ժամեր">${t('Часы работы', 'Աշխատանքային ժամեր')}</h3>
          <p><strong data-ru="Пн–Пт: 10:00–20:00 (UTC+4)" data-am="Երկ–Ուրբ: 10:00–20:00 (UTC+4)">${t('Пн–Пт: 10:00–20:00 (UTC+4)', 'Երկ–Ուրբ: 10:00–20:00 (UTC+4)')}</strong><span data-ru="Менеджеры на связи каждый день в Telegram и WhatsApp. Звонки и оформление заказов — по будням в указанное время." data-am="Մենեջերները կապի մեջ են ամեն օր Telegram-ով և WhatsApp-ով: Զանգերն ու պատվերների ձևակերպումը՝ աշխատանքային օրերին նշված ժամերին:">${t('Менеджеры на связи каждый день в Telegram и WhatsApp. Звонки и оформление заказов — по будням в указанное время.', 'Մենեջերները կապի մեջ են ամեն օր Telegram-ով և WhatsApp-ով: Զանգերն ու պատվերների ձևակերպումը՝ աշխատանքային օրերին նշված ժամերին:')}</span></p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ===== FINAL CTA STRIP ===== -->
<section class="cp-cta-strip">
  <div class="container">
    <div class="acs-card">
      <div class="acs-text">
        <h3 data-ru="Не нашли подходящий канал?" data-am="Չգտա՞ք ձեզ հարմար եղանակ:" data-edit-key="contacts__cta_strip" data-edit-idx="0">${tb('contacts__cta_strip', 0, 'Не нашли подходящий канал?', 'Չգտա՞ք ձեզ հարմար եղանակ:')}</h3>
        <p data-ru="Закажите обратный звонок — менеджер перезвонит в удобное вам время и поможет с любым вопросом." data-am="Պատվիրեք հետադարձ զանգ — մենեջերը կզանգահարի ձեզ հարմար ժամանակին և կօգնի ցանկացած հարցում:" data-edit-key="contacts__cta_strip" data-edit-idx="1">${tb('contacts__cta_strip', 1, 'Закажите обратный звонок — менеджер перезвонит в удобное вам время и поможет с любым вопросом.', 'Պատվիրեք հետադարձ զանգ — մենեջերը կզանգահարի ձեզ հարմար ժամանակին և կօգնի ցանկացած հարցում:')}</p>
      </div>
      <div class="acs-actions">
        <button type="button" class="btn btn-primary" onclick="openCallbackModal()">
          <i class="fas fa-phone"></i>
          <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք" data-edit-key="contacts__cta_strip" data-edit-idx="2">${tb('contacts__cta_strip', 2, 'Перезвоните мне', 'Հետ զանգահարեք')}</span>
        </button>
      </div>
    </div>
  </div>
</section>
`

  // SEO: LocalBusiness for Yerevan presence + BreadcrumbList.
  const jsonLd =
    buildLocalBusinessLd(siteOrigin) +
    buildBreadcrumbLd({ siteOrigin, isAM, page: 'contacts' })

  return renderPageShell({
    page: 'contacts',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'contacts-page',
    mainHtml,
    extraHead: extraHead + jsonLd,
    shellBlocks,
  })
}

// =====================================================================
// renderReferralPage — phase 2F "light" page for /referral.
// Standalone partner-program landing: hero → 3-step "how it works" →
// audience grid (4 cards mirrored from home #for-whom 4361-4393) →
// bonus tier cards (5% / 8% / up to 15%, all with "verify with manager"
// disclaimer) → 5-item FAQ accordion (re-uses .faq-item styles from
// /faq via local copy so toggleFaq() in landing.js works without
// changes) → CTA strip with Telegram / callback / contacts buttons.
// No __SITE_DATA injection: calculator and #refCodeInput are not used
// here, so we keep the page maximally edge-cacheable.
// =====================================================================
function renderReferralPage(opts: { lang: 'ru' | 'am', siteOrigin: string, pageBlocks?: Record<string, SubpageBlock>, shellBlocks?: Record<string, SubpageBlock> }): string {
  const { lang, siteOrigin, pageBlocks, shellBlocks } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru
  const tb = (blockKey: string, idx: number, fallbackRu: string, fallbackAm: string): string => {
    const block = pageBlocks?.[blockKey]
    if (!block || block.is_visible === 0) return isAM ? fallbackAm : fallbackRu
    const arr = isAM ? block.texts_am : block.texts_ru
    const v = arr?.[idx]
    return (typeof v === 'string' && v.trim()) ? v : (isAM ? fallbackAm : fallbackRu)
  }

  const seo = {
    title: t(
      'Реферальная программа — Go to Top | Бонусы партнёрам',
      'Հղման ծրագիր — Go to Top | Բոնուսներ գործընկերներին'
    ),
    description: t(
      'Присоединяйтесь к партнёрской программе Go to Top: получайте 5–15% с каждого приведённого клиента. Для менеджеров, агентств, блогеров, школ маркетплейсов',
      'Միացեք Go to Top-ի գործընկերային ծրագրին. ստացեք 5–15% յուրաքանչյուր բերված հաճախորդից. ապրանքագետներ, գործակալություններ, բլոգերներ, դպրոցներ'
    ),
    ogImage: `${siteOrigin}/static/img/og-image.png`,
  }

  const tgUrl = PLACEHOLDER_TG_URL
  // Pre-filled "get my promo code" message; openTgWithMessage()
  // handles encoding when the user follows the CTA.
  const tgPromoMsg = t(
    'Здравствуйте! Хочу получить промокод партнёрской программы Go to Top.',
    'Բարև Ձեզ։ Ցանկանում եմ ստանալ Go to Top գործընկերային ծրագրի պրոմո կոդը։'
  )
  const tgPromoUrl = `${tgUrl}?text=${encodeURIComponent(tgPromoMsg)}`

  // Bonus tiers — exact numbers come straight from the spec; every
  // card carries a "уточняйте у менеджера" footnote because the real
  // % can shift per partner contract.
  const bonusTiers: Array<{
    cls: string
    icon: string
    titleRu: string, titleAm: string
    pct: string
    descRu: string, descAm: string
    bulletsRu: string[], bulletsAm: string[]
  }> = [
    {
      cls: 'rp-tier-base',
      icon: 'fa-handshake',
      titleRu: 'Стандартный реферал',
      titleAm: 'Ստանդարտ ուղեկից',
      pct: '5%',
      descRu: 'Получайте процент с первой оплаты каждого приведённого клиента — даже если вы привели всего одного.',
      descAm: 'Ստացեք տոկոս յուրաքանչյուր ձեր կողմից բերված հաճախորդի առաջին վճարումից — նույնիսկ եթե բերել եք միայն մեկը։',
      bulletsRu: [
        'Без минимального порога — стартуете сразу',
        'Промокод действует бессрочно для ваших клиентов',
        'Выплаты на карту RUB / AMD',
      ],
      bulletsAm: [
        'Առանց նվազագույն շեմի — սկսում եք անմիջապես',
        'Պրոմո կոդը գործում է ձեր հաճախորդների համար անժամկետ',
        'Վճարումները քարտին RUB / AMD',
      ],
    },
    {
      cls: 'rp-tier-pro',
      icon: 'fa-rocket',
      titleRu: 'Партнёрский',
      titleAm: 'Գործընկերային',
      pct: '8%',
      descRu: 'Для активных партнёров: от 3 приведённых клиентов в месяц — повышенный процент со всех новых оплат.',
      descAm: 'Ակտիվ գործընկերների համար՝ ամիսը 3-ից ավելի բերված հաճախորդից բարձր տոկոս՝ բոլոր նոր վճարումներից։',
      bulletsRu: [
        'Персональные UTM-ссылки и баннеры',
        'Приоритетная поддержка в Telegram',
        'Помесячные отчёты и сверка',
      ],
      bulletsAm: [
        'Անհատական UTM-հղումներ և բաններներ',
        'Առաջնային աջակցություն Telegram-ով',
        'Ամսական հաշվետվություններ և սթիքավորում',
      ],
    },
    {
      cls: 'rp-tier-vip',
      icon: 'fa-crown',
      titleRu: 'Эксклюзивный',
      titleAm: 'Բացառիկ',
      pct: 'до 15%',
      descRu: 'Для агентств, школ и крупных авторов: от 10 клиентов в месяц — индивидуальные условия и персональный менеджер.',
      descAm: 'Գործակալությունների, դպրոցների և մեծ հեղինակների համար՝ ամիսը 10-ից ավելի հաճախորդից՝ անհատական պայմաններ և անձնական մենեջեր։',
      bulletsRu: [
        'Персональный менеджер и Slack/Telegram-чат',
        'White-label материалы и презентации',
        'Индивидуальная сетка комиссий',
      ],
      bulletsAm: [
        'Անձնական մենեջեր և Slack/Telegram-չատ',
        'White-label նյութեր և ներկայացումներ',
        'Հանձնաժողովների անհատական ցանց',
      ],
    },
  ]

  // 5 FAQ items — same structure as /faq so toggleFaq() in
  // landing.js works without any JS change.
  const faqItems: Array<{ qRu: string, qAm: string, aRu: string, aAm: string }> = [
    {
      qRu: 'Когда выплачиваются бонусы?',
      qAm: 'Ե՞րբ են վճարվում բոնուսները։',
      aRu: 'Бонус начисляется после того, как клиент оплатил услугу и работа стартовала. Выплаты партнёрам делаем раз в две недели — вы получаете подтверждение в Telegram и перевод на согласованную карту (RUB или AMD). Точный график согласовывается персональным менеджером после подписания партнёрского соглашения.',
      aAm: 'Բոնուսը հաշվարկվում է հաճախորդի կողմից ծառայության վճարումից և աշխատանքի մեկնարկից հետո։ Գործընկերներին վճարումները կատարում ենք երկու շաբաթը մեկ — դուք ստանում եք հաստատում Telegram-ով և փոխանցում համաձայնեցված քարտին (RUB կամ AMD)։ Ճշգրիտ ժամանակացույցը համաձայնեցվում է անձնական մենեջերի կողմից գործընկերային համաձայնագրի կնքումից հետո։',
    },
    {
      qRu: 'Можно ли использовать свой промокод для собственных заказов?',
      qAm: 'Կարո՞ղ եմ օգտագործել իմ սեփական պրոմո կոդն իմ պատվերների համար։',
      aRu: 'Нет — реферальный процент рассчитывается только на новых клиентов, которые впервые оплачивают наш сервис. Это защищает партнёрскую программу от само-выплат и сохраняет честную экономику для всех участников. Если вы — действующий клиент и хотите скидку на свой заказ, попросите у менеджера обычный промокод.',
      aAm: 'Ոչ — ուղեկից տոկոսը հաշվարկվում է միայն նոր հաճախորդների վրա, ովքեր առաջին անգամ վճարում են մեր ծառայության համար։ Սա պաշտպանում է գործընկերային ծրագիրը ինքնավճարումներից և պահպանում ազնիվ տնտեսությունը բոլոր մասնակիցների համար։ Եթե դուք գործող հաճախորդ եք և ցանկանում եք զեղչ ձեր պատվերի համար, խնդրեք մենեջերից սովորական պրոմո կոդ։',
    },
    {
      qRu: 'Сколько времени действует промокод?',
      qAm: 'Որքա՞ն ժամանակ է գործում պրոմո կոդը։',
      aRu: 'Сам промокод действует бессрочно — пока вы остаётесь партнёром программы. Бонус начисляется как с первой оплаты приведённого клиента, так и со всех его повторных пакетов в течение первых 12 месяцев сотрудничества. После этого условия пересматриваются персональным менеджером, обычно в сторону партнёра.',
      aAm: 'Ինքը պրոմո կոդն գործում է անժամկետ — քանի դեռ դուք մնում եք ծրագրի գործընկեր։ Բոնուսը հաշվարկվում է ինչպես բերված հաճախորդի առաջին վճարումից, այնպես էլ նրա բոլոր կրկնակի փաթեթներից համագործակցության առաջին 12 ամիսների ընթացքում։ Դրանից հետո պայմանները վերանայվում են անձնական մենեջերի կողմից, սովորաբար գործընկերի օգտին։',
    },
    {
      qRu: 'Каков минимальный порог для выплаты?',
      qAm: 'Ո՞րն է վճարման նվազագույն շեմը։',
      aRu: 'Минимальная сумма для выплаты — 10 000 ֏ AMD (или эквивалент в RUB). Если за период сумма меньше — она автоматически переносится на следующий цикл и не сгорает. Партнёры тарифа «Эксклюзивный» получают выплаты без минимального порога, по индивидуальному графику.',
      aAm: 'Վճարման նվազագույն գումարը՝ 10 000 ֏ AMD (կամ համարժեքը RUB-ով)։ Եթե ժամանակահատվածի համար գումարը ավելի քիչ է, այն ինքնաշխատ տեղափոխվում է հաջորդ ցիկլ և չի ոչնչանում։ «Բացառիկ» սակագնի գործընկերները ստանում են վճարումներ առանց նվազագույն շեմի, անհատական ժամանակացույցով։',
    },
    {
      qRu: 'Какие документы нужны, чтобы стать партнёром?',
      qAm: 'Ի՞նչ փաստաթղթեր են պետք գործընկեր դառնալու համար։',
      aRu: 'Достаточно одного сообщения в Telegram — менеджер выдаст промокод и партнёрскую ссылку в течение рабочего дня. Для тарифов «Партнёрский» и «Эксклюзивный» подписываем партнёрское соглашение (как с физлицом, ИП/ИЧП, так и с юр.лицом — RU или AM юрисдикция). Все документы готовим мы.',
      aAm: 'Բավական է մեկ հաղորդագրություն Telegram-ով — մենեջերը կտրամադրի պրոմո կոդ և գործընկերային հղում աշխատանքային օրվա ընթացքում։ «Գործընկերային» և «Բացառիկ» սակագների համար կնքում ենք գործընկերային համաձայնագիր (ինչպես ֆիզիկական անձի, ԱՁ/ԱՁՎ, այնպես էլ իրավաբանական անձի հետ — RU կամ AM իրավակարգում)։ Բոլոր փաստաթղթերը պատրաստում ենք մենք։',
    },
  ]

  // Page-only styles. Reuses --purple/--bg-card/--text/etc tokens declared
  // in renderPageShell. .faq-item / .faq-q / .faq-a mirror the /faq page
  // so toggleFaq() in landing.js keeps working unchanged.
  const extraHead = `<link rel="stylesheet" href="/static/css/page-referral.css?v=${CACHE_VERSION}">`

  // Render bonus tier cards. Pro tier gets a "Популярно" pill via
  // ::after / data-badge so we don't need extra DOM nodes.
  // Each tier's title / pct / label / desc carry stable data-edit-key+idx so
  // the inline-editor txt_ids don't drift when other content is added before
  // the tiers section. Prevents corrupted overrides like the prior
  // referral__txt_38/39/40 swap that put label text into the h3 of tier 3.
  const tiersHtml = bonusTiers.map((tier, tIdx) => {
    const badgeAttr = tier.cls === 'rp-tier-pro'
      ? ` data-badge="${t('Популярно', 'Հանրաճանաչ')}"`
      : ''
    const tierKey = `tier_${tIdx}`
    const bullets = (isAM ? tier.bulletsAm : tier.bulletsRu)
      .map((b, i) => `            <li><i class="fas fa-check-circle"></i><span data-ru="${tier.bulletsRu[i]}" data-am="${tier.bulletsAm[i]}" data-edit-key="${tierKey}_bullet" data-edit-idx="${i}">${b}</span></li>`)
      .join('\n')
    const titleNow = t(tier.titleRu, tier.titleAm)
    const descNow = t(tier.descRu, tier.descAm)
    return `      <div class="rp-tier ${tier.cls}"${badgeAttr}>
        <div class="rp-tier-icon"><i class="fas ${tier.icon}"></i></div>
        <h3 data-ru="${tier.titleRu}" data-am="${tier.titleAm}" data-edit-key="${tierKey}" data-edit-idx="0">${titleNow}</h3>
        <div>
          <div class="rp-tier-pct" data-ru="${tier.pct}" data-am="${tier.pct}" data-edit-key="${tierKey}" data-edit-idx="1">${tier.pct}</div>
          <div class="rp-tier-pct-label" data-ru="с первой оплаты клиента" data-am="հաճախորդի առաջին վճարումից" data-edit-key="${tierKey}" data-edit-idx="2">${t('с первой оплаты клиента', 'հաճախորդի առաջին վճարումից')}</div>
        </div>
        <p class="rp-tier-desc" data-ru="${tier.descRu}" data-am="${tier.descAm}" data-edit-key="${tierKey}" data-edit-idx="3">${descNow}</p>
        <ul class="rp-tier-list">
${bullets}
        </ul>
      </div>`
  }).join('\n')

  // Render FAQ accordion. First item gets `.active` so it opens by
  // default — toggleFaq() in landing.js handles the rest.
  const faqItemsHtml = faqItems.map((item, idx) => {
    const activeCls = idx === 0 ? ' active' : ''
    const qText = t(item.qRu, item.qAm)
    const aText = t(item.aRu, item.aAm)
    return `      <div class="faq-item${activeCls}">
        <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="${item.qRu}" data-am="${item.qAm}">${qText}</span><i class="fas fa-chevron-down"></i></div>
        <div class="faq-a"><p data-ru="${item.aRu}" data-am="${item.aAm}">${aText}</p></div>
      </div>`
  }).join('\n')

  const mainHtml = `
<!-- ===== REFERRAL HERO ===== -->
<section class="rp-hero">
  <div class="container">
    <div class="rh-inner">
      <div class="rp-back">
        <a href="${navHrefForLang(lang, '/services')}" class="rp-back-link">
          <i class="fas fa-arrow-left"></i>
          <span data-ru="Назад к услугам" data-am="Վերադառնալ ծառայություններին">${t('Назад к услугам', 'Վերադառնալ ծառայություններին')}</span>
        </a>
      </div>
      <div class="rh-eyebrow">
        <i class="fas fa-handshake"></i>
        <span data-ru="Партнёрская программа" data-am="Գործընկերային ծրագիր" data-edit-key="referral__hero" data-edit-idx="0">${tb('referral__hero', 0, 'Партнёрская программа', 'Գործընկերային ծրագիր')}</span>
      </div>
      <h1>
        <span data-ru="Реферальная программа" data-am="Հղման ծրագիր" data-edit-key="referral__hero" data-edit-idx="1">${tb('referral__hero', 1, 'Реферальная программа', 'Հղման ծրագիր')}</span>
        <span class="gr">${tb('referral__hero', 2, 'Go to Top', 'Go to Top')}</span>
      </h1>
      <p class="rh-desc" data-ru="Получайте бонусы за каждого приведённого клиента — от 5% до 15% с первой оплаты и индивидуальные условия для активных партнёров. Прозрачная сетка комиссий, выплаты в RUB или AMD." data-am="Ստացեք բոնուսներ յուրաքանչյուր ձեր կողմից բերված հաճախորդի համար՝ 5%-ից 15% առաջին վճարումից և անհատական պայմաններ ակտիվ գործընկերների համար։ Թափանցիկ հանձնաժողովների ցանց, վճարումներ RUB-ով կամ AMD-ով։" data-edit-key="referral__hero" data-edit-idx="3">${tb('referral__hero', 3, 'Получайте бонусы за каждого приведённого клиента — от 5% до 15% с первой оплаты и индивидуальные условия для активных партнёров. Прозрачная сетка комиссий, выплаты в RUB или AMD.', 'Ստացեք բոնուսներ յուրաքանչյուր ձեր կողմից բերված հաճախորդի համար՝ 5%-ից 15% առաջին վճարումից և անհատական պայմաններ ակտիվ գործընկերների համար։ Թափանցիկ հանձնաժողովների ցանց, վճարումներ RUB-ով կամ AMD-ով։')}</p>
      <div class="rh-cta">
        <a href="${tgPromoUrl}" target="_blank" rel="noopener" class="btn btn-tg btn-lg">
          <i class="fab fa-telegram"></i>
          <span data-ru="Стать партнёром — получить промокод" data-am="Դառնալ գործընկեր — ստանալ պրոմո կոդ">${t('Стать партнёром — получить промокод', 'Դառնալ գործընկեր — ստանալ պրոմո կոդ')}</span>
        </a>
        <button type="button" class="btn btn-outline btn-lg" onclick="openCallbackModal()">
          <i class="fas fa-phone"></i>
          <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք">${t('Перезвоните мне', 'Հետ զանգահարեք')}</span>
        </button>
        <a href="#referral-promo-detail" class="btn btn-outline btn-lg">
          <i class="fas fa-percent"></i>
          <span data-ru="Промокоды и условия" data-am="Պրոմոկոդներ և պայմաններ">${t('Промокоды и условия', 'Պրոմոկոդներ և պայմաններ')}</span>
        </a>
      </div>
    </div>
  </div>
</section>

<!-- ===== HOW IT WORKS — 3 steps ===== -->
<section class="rp-steps">
  <div class="container">
    <div class="rp-steps-header">
      <div class="rh-eyebrow">
        <i class="fas fa-list-ol"></i>
        <span data-ru="Как это работает" data-am="Ինչպես է աշխատում">${t('Как это работает', 'Ինչպես է աշխատում')}</span>
      </div>
      <h2>
        <span data-ru="Три шага" data-am="Երեք քայլ">${t('Три шага', 'Երեք քայլ')}</span>
        <span class="gr" data-ru="до первого бонуса" data-am="մինչ առաջին բոնուսը">${t('до первого бонуса', 'մինչ առաջին բոնուսը')}</span>
      </h2>
      <p data-ru="Никаких сложных интеграций — нужен только промокод и желание делиться сервисом, который реально работает." data-am="Ոչ մի բարդ ինտեգրացիա — պետք է միայն պրոմո կոդ և ցանկություն կիսվել իսկապես աշխատող ծառայությամբ։">${t('Никаких сложных интеграций — нужен только промокод и желание делиться сервисом, который реально работает.', 'Ոչ մի բարդ ինտեգրացիա — պետք է միայն պրոմո կոդ և ցանկություն կիսվել իսկապես աշխատող ծառայությամբ։')}</p>
    </div>
    <div class="rp-steps-grid">
      <div class="rp-step">
        <div class="rp-step-num">1</div>
        <h3 data-ru="Получите промокод" data-am="Ստացեք պրոմո կոդ" data-edit-key="referral__steps" data-edit-idx="0">${tb('referral__steps', 0, 'Получите промокод', 'Ստացեք պրոմո կոդ')}</h3>
        <p data-ru="Напишите менеджеру в Telegram — выдадим персональный промокод и партнёрскую ссылку в течение рабочего дня." data-am="Գրեք մենեջերին Telegram-ով — կտրամադրենք անհատական պրոմո կոդ և գործընկերային հղում աշխատանքային օրվա ընթացքում։" data-edit-key="referral__steps" data-edit-idx="1">${tb('referral__steps', 1, 'Напишите менеджеру в Telegram — выдадим персональный промокод и партнёрскую ссылку в течение рабочего дня.', 'Գրեք մենեջերին Telegram-ով — կտրամադրենք անհատական պրոմո կոդ և գործընկերային հղում աշխատանքային օրվա ընթացքում։')}</p>
      </div>
      <div class="rp-step">
        <div class="rp-step-num">2</div>
        <h3 data-ru="Делитесь с клиентами" data-am="Կիսվեք հաճախորդների հետ" data-edit-key="referral__steps" data-edit-idx="2">${tb('referral__steps', 2, 'Делитесь с клиентами', 'Կիսվեք հաճախորդների հետ')}</h3>
        <p data-ru="Отправляйте код в личных переписках, добавляйте в посты, сторис и видео — клиент вводит его в калькуляторе на главной." data-am="Ուղարկեք կոդը անձնական նամակագրություններում, ավելացրեք գրառումներում, ստորիներում և տեսանյութերում — հաճախորդը մուտքագրում է այն գլխավոր էջի հաշվիչում։" data-edit-key="referral__steps" data-edit-idx="3">${tb('referral__steps', 3, 'Отправляйте код в личных переписках, добавляйте в посты, сторис и видео — клиент вводит его в калькуляторе на главной.', 'Ուղարկեք կոդը անձնական նամակագրություններում, ավելացրեք գրառումներում, ստորիներում և տեսանյութերում — հաճախորդը մուտքագրում է այն գլխավոր էջի հաշվիչում։')}</p>
      </div>
      <div class="rp-step">
        <div class="rp-step-num">3</div>
        <h3 data-ru="Получайте бонус" data-am="Ստացեք բոնուս" data-edit-key="referral__steps" data-edit-idx="4">${tb('referral__steps', 4, 'Получайте бонус', 'Ստացեք բոնուս')}</h3>
        <p data-ru="Бонус начисляется с каждой оплаты приведённого клиента — выплаты раз в две недели на карту в RUB или AMD по согласованию." data-am="Բոնուսը հաշվարկվում է բերված հաճախորդի յուրաքանչյուր վճարումից — վճարումները երկու շաբաթը մեկ՝ քարտին RUB-ով կամ AMD-ով համաձայնության համաձայն։" data-edit-key="referral__steps" data-edit-idx="5">${tb('referral__steps', 5, 'Бонус начисляется с каждой оплаты приведённого клиента — выплаты раз в две недели на карту в RUB или AMD по согласованию.', 'Բոնուսը հաշվարկվում է բերված հաճախորդի յուրաքանչյուր վճարումից — վճարումները երկու շաբաթը մեկ՝ քարտին RUB-ով կամ AMD-ով համաձայնության համաձայն։')}</p>
      </div>
    </div>
  </div>
</section>

<!-- ===== AUDIENCE — 4 cards (mirrors home #for-whom 4361-4393) ===== -->
<section class="rp-audience">
  <div class="container">
    <div class="rp-audience-header">
      <div class="rh-eyebrow">
        <i class="fas fa-users"></i>
        <span data-ru="Кому подойдёт" data-am="Ում համար է հարմար">${t('Кому подойдёт', 'Ում համար է հարմար')}</span>
      </div>
      <h2>
        <span data-ru="Программа для тех," data-am="Ծրագիր նրանց համար,">${t('Программа для тех,', 'Ծրագիր նրանց համար,')}</span>
        <span class="gr" data-ru="у кого есть аудитория" data-am="ովքեր ունեն լսարան">${t('у кого есть аудитория', 'ովքեր ունեն լսարան')}</span>
      </h2>
      <p data-ru="Мы работаем с разными форматами партнёров — от отдельных менеджеров до агентств и образовательных проектов." data-am="Մենք աշխատում ենք գործընկերների տարբեր ձևաչափերի հետ՝ առանձին մենեջերներից մինչև գործակալություններ և կրթական նախագծեր։">${t('Мы работаем с разными форматами партнёров — от отдельных менеджеров до агентств и образовательных проектов.', 'Մենք աշխատում ենք գործընկերների տարբեր ձևաչափերի հետ՝ առանձին մենեջերներից մինչև գործակալություններ և կրթական նախագծեր։')}</p>
    </div>
    <div class="rp-aud-grid">
      <div class="rp-aud-card">
        <div class="rp-aud-icon"><i class="fas fa-handshake"></i></div>
        <h3 data-ru="Менеджер по маркетплейсам" data-am="Մարքեթփլեյս մենեջեր">${t('Менеджер по маркетплейсам', 'Մարքեթփլեյս մենեջեր')}</h3>
        <p data-ru="Имеете базу клиентов-поставщиков на Wildberries и Ozon — рекомендуйте наш сервис и зарабатывайте процент с каждого их заказа." data-am="Ունեք հաճախորդ-մատակարարների բազա Wildberries-ում և Ozon-ում — խորհուրդ տվեք մեր ծառայությունը և վաստակեք տոկոս նրանց յուրաքանչյուր պատվերից։">${t('Имеете базу клиентов-поставщиков на Wildberries и Ozon — рекомендуйте наш сервис и зарабатывайте процент с каждого их заказа.', 'Ունեք հաճախորդ-մատակարարների բազա Wildberries-ում և Ozon-ում — խորհուրդ տվեք մեր ծառայությունը և վաստակեք տոկոս նրանց յուրաքանչյուր պատվերից։')}</p>
      </div>
      <div class="rp-aud-card">
        <div class="rp-aud-icon"><i class="fas fa-building"></i></div>
        <h3 data-ru="Агентство или компания" data-am="Գործակալություն կամ ընկերություն">${t('Агентство или компания', 'Գործակալություն կամ ընկերություն')}</h3>
        <p data-ru="Работаете с поставщиками маркетплейсов — добавьте услуги выкупов и отзывов в свой портфель и увеличьте средний чек клиента." data-am="Աշխատում եք մարքեթփլեյսների մատակարարների հետ — ավելացրեք գնումների և կարծիքների ծառայությունները ձեր փաթեթին և ավելացրեք հաճախորդի միջին չեկը։">${t('Работаете с поставщиками маркетплейсов — добавьте услуги выкупов и отзывов в свой портфель и увеличьте средний чек клиента.', 'Աշխատում եք մարքեթփլեյսների մատակարարների հետ — ավելացրեք գնումների և կարծիքների ծառայությունները ձեր փաթեթին և ավելացրեք հաճախորդի միջին չեկը։')}</p>
      </div>
      <div class="rp-aud-card">
        <div class="rp-aud-icon"><i class="fas fa-globe"></i></div>
        <h3 data-ru="Блогер или владелец канала" data-am="Բլոգեր կամ ալիքի սեփականատեր">${t('Блогер или владелец канала', 'Բլոգեր կամ ալիքի սեփականատեր')}</h3>
        <p data-ru="Ведёте тематический блог, YouTube- или Telegram-канал о Wildberries — монетизируйте аудиторию через партнёрский промокод." data-am="Վարում եք թեմատիկ բլոգ, YouTube- կամ Telegram-ալիք Wildberries-ի մասին — դրամայնացրեք լսարանը գործընկերային պրոմո կոդով։">${t('Ведёте тематический блог, YouTube- или Telegram-канал о Wildberries — монетизируйте аудиторию через партнёрский промокод.', 'Վարում եք թեմատիկ բլոգ, YouTube- կամ Telegram-ալիք Wildberries-ի մասին — դրամայնացրեք լսարանը գործընկերային պրոմո կոդով։')}</p>
      </div>
      <div class="rp-aud-card">
        <div class="rp-aud-icon"><i class="fas fa-graduation-cap"></i></div>
        <h3 data-ru="Школа маркетплейсов" data-am="Մարքեթփլեյսների դպրոց">${t('Школа маркетплейсов', 'Մարքեթփլեյսների դպրոց')}</h3>
        <p data-ru="Обучаете работе с Wildberries — рекомендуйте наш сервис студентам как практический инструмент и получайте реферальное вознаграждение." data-am="Ուսուցանում եք Wildberries-ի հետ աշխատանքը — խորհուրդ տվեք մեր ծառայությունը ուսանողներին որպես գործնական գործիք և ստացեք ուղեկից վարձատրություն։">${t('Обучаете работе с Wildberries — рекомендуйте наш сервис студентам как практический инструмент и получайте реферальное вознаграждение.', 'Ուսուցանում եք Wildberries-ի հետ աշխատանքը — խորհուրդ տվեք մեր ծառայությունը ուսանողներին որպես գործնական գործիք և ստացեք ուղեկից վարձատրություն։')}</p>
      </div>
    </div>
  </div>
</section>

<!-- ===== BONUS TIERS ===== -->
<section class="rp-tiers" id="referral-promo-detail">
  <div class="container">
    <div class="rp-tiers-header">
      <div class="rh-eyebrow">
        <i class="fas fa-percent"></i>
        <span data-ru="Размер бонусов" data-am="Բոնուսների չափը">${t('Размер бонусов', 'Բոնուսների չափը')}</span>
      </div>
      <h2>
        <span data-ru="Три уровня" data-am="Երեք մակարդակ">${t('Три уровня', 'Երեք մակարդակ')}</span>
        <span class="gr" data-ru="партнёрства" data-am="գործընկերության">${t('партнёрства', 'գործընկերության')}</span>
      </h2>
      <p data-ru="Чем больше клиентов вы приводите — тем выше процент и доступ к индивидуальным условиям. Стартуйте с базового и переходите выше." data-am="Որքան շատ հաճախորդ եք բերում, այնքան բարձր է տոկոսը և անհատական պայմանների հասանելիությունը։ Սկսեք բազայինից և անցեք ավելի բարձր։">${t('Чем больше клиентов вы приводите — тем выше процент и доступ к индивидуальным условиям. Стартуйте с базового и переходите выше.', 'Որքան շատ հաճախորդ եք բերում, այնքան բարձր է տոկոսը և անհատական պայմանների հասանելիությունը։ Սկսեք բազայինից և անցեք ավելի բարձր։')}</p>
    </div>
    <div class="rp-tiers-grid">
${tiersHtml}
    </div>
    <div class="rp-tier-note">
      <i class="fas fa-info-circle"></i>
      <span data-ru="Точные проценты, периоды выплат и условия по тарифам «Партнёрский» и «Эксклюзивный» уточняйте у персонального менеджера — они фиксируются в партнёрском соглашении." data-am="Ճշգրիտ տոկոսները, վճարման ժամանակահատվածները և «Գործընկերային» ու «Բացառիկ» սակագների պայմանները ճշտեք անձնական մենեջերի մոտ — դրանք ամրագրվում են գործընկերային համաձայնագրում։">${t('Точные проценты, периоды выплат и условия по тарифам «Партнёрский» и «Эксклюзивный» уточняйте у персонального менеджера — они фиксируются в партнёрском соглашении.', 'Ճշգրիտ տոկոսները, վճարման ժամանակահատվածները և «Գործընկերային» ու «Բացառիկ» սակագների պայմանները ճշտեք անձնական մենեջերի մոտ — դրանք ամրագրվում են գործընկերային համաձայնագրում։')}</span>
    </div>
  </div>
</section>

<!-- ===== FAQ — 5 referral-specific questions ===== -->
<section class="rp-faq">
  <div class="container">
    <div class="rp-faq-header">
      <div class="rh-eyebrow">
        <i class="fas fa-question-circle"></i>
        <span data-ru="FAQ" data-am="ՀՏՀ">FAQ</span>
      </div>
      <h2>
        <span data-ru="Частые вопросы" data-am="Հաճախ տրվող">${t('Частые вопросы', 'Հաճախ տրվող')}</span>
        <span class="gr" data-ru="о программе" data-am="հարցեր ծրագրի մասին">${t('о программе', 'հարցեր ծրագրի մասին')}</span>
      </h2>
      <p data-ru="Ответы на ключевые вопросы партнёров: выплаты, документы, сроки и пороги. Не нашли свой — напишите менеджеру в Telegram." data-am="Պատասխաններ գործընկերների հիմնական հարցերին՝ վճարումներ, փաստաթղթեր, ժամկետներ և շեմեր։ Չգտա՞ք ձերը — գրեք մենեջերին Telegram-ով։">${t('Ответы на ключевые вопросы партнёров: выплаты, документы, сроки и пороги. Не нашли свой — напишите менеджеру в Telegram.', 'Պատասխաններ գործընկերների հիմնական հարցերին՝ վճարումներ, փաստաթղթեր, ժամկետներ և շեմեր։ Չգտա՞ք ձերը — գրեք մենեջերին Telegram-ով։')}</p>
    </div>
    <div class="faq-list">
${faqItemsHtml}
    </div>
  </div>
</section>

${renderSvcTriangleSection({ lang, current: 'referral' })}
<!-- ===== FINAL CTA STRIP ===== -->
<section class="rp-cta-strip">
  <div class="container">
    <div class="acs-card">
      <div class="acs-text">
        <h3 data-ru="Готовы стать партнёром?" data-am="Պատրա՞ստ եք դառնալ գործընկեր" data-edit-key="referral__cta_strip" data-edit-idx="0">${tb('referral__cta_strip', 0, 'Готовы стать партнёром?', 'Պատրա՞ստ եք դառնալ գործընկեր')}</h3>
        <p data-ru="Получите промокод за 5 минут, обсудите условия с менеджером или напишите нам на странице контактов." data-am="Ստացեք պրոմո կոդ 5 րոպեում, քննարկեք պայմանները մենեջերի հետ կամ գրեք մեզ կոնտակտների էջից։" data-edit-key="referral__cta_strip" data-edit-idx="1">${tb('referral__cta_strip', 1, 'Получите промокод за 5 минут, обсудите условия с менеджером или напишите нам на странице контактов.', 'Ստացեք պրոմո կոդ 5 րոպեում, քննարկեք պայմանները մենեջերի հետ կամ գրեք մեզ կոնտակտների էջից։')}</p>
      </div>
      <div class="acs-actions">
        <a href="${tgPromoUrl}" target="_blank" rel="noopener" class="btn btn-tg">
          <i class="fab fa-telegram"></i>
          <span data-ru="Получить код" data-am="Ստանալ կոդը" data-edit-key="referral__cta_strip" data-edit-idx="2">${tb('referral__cta_strip', 2, 'Получить код', 'Ստանալ կոդը')}</span>
        </a>
        <button type="button" class="btn btn-outline" onclick="openCallbackModal()">
          <i class="fas fa-phone"></i>
          <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք">${t('Перезвоните мне', 'Հետ զանգահարեք')}</span>
        </button>
        <a href="/contacts" class="btn btn-primary">
          <i class="fas fa-envelope"></i>
          <span data-ru="Контакты" data-am="Կոնտակտներ">${t('Контакты', 'Կոնտակտներ')}</span>
        </a>
      </div>
    </div>
  </div>
</section>
`

  // SEO: BreadcrumbList for referral landing.
  const jsonLd = buildBreadcrumbLd({ siteOrigin, isAM, page: 'referral' })

  return renderPageShell({
    page: 'referral',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'referral-page',
    mainHtml,
    extraHead: extraHead + jsonLd,
    shellBlocks,
  })
}

// =====================================================================
// renderNewHomePage — Phase 5 staging implementation of the future home
// page (will replace the old monolithic landing on '/' in Phase 6).
//
// Goal of this revision: pixel-1:1 with the legacy landing for the user-
// approved blocks. The HTML and CSS below are **literal copies** from
// `app.get('/')` rendering (lines ~4812-5158 + relevant <style> blocks),
// just hosted inside renderPageShell so navigation, footer, mobile nav
// and i18n stay consistent with all the other subpages.
//
// Sections (matching the screenshots provided by the owner):
//   1. Hero       — left text column + right photo with floating badge
//                   AND 4-cell QR grid under the photo.
//   2. Ticker     — empty .ticker-track filled by /static/landing.js.
//   3. WB banner  — pink/purple "WB официально отменил штрафы" card +
//                   right callout with rocket icon and "Узнать" CTA.
//   4. Stats bar  — 500 / 1000+ / 21 / 200+ counters.
//   5. Services   — 3 cards (выкупы / отзывы / активация ключевых),
//                   blue / green / purple CTA buttons respectively.
//   6. Why buyouts— h2 + 6 numbered .why-step boxes + highlight-result
//                   strip + warning-orange "Начать выкупы" CTA.
//
// All texts also gain data-ru/data-am so `switchLang()` in landing.js
// handles the RU↔AM toggle transparently.
// =====================================================================
export function renderNewHomePage(opts: {
  lang: 'ru' | 'am',
  siteOrigin: string,
  pageBlocks?: Record<string, SubpageBlock>,
  shellBlocks?: Record<string, SubpageBlock>,
  landingPackages?: Array<{
    id: number; slug: string; cover_url: string;
    title_ru: string; title_am: string;
    description_ru?: string; description_am?: string;
    price_text_ru?: string; price_text_am?: string;
    sort_order?: number;
  }>,
  customBlocks?: CustomBlock[],
}): string {
  const { lang, siteOrigin, pageBlocks, shellBlocks, landingPackages = [], customBlocks = [] } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru

  // Phase 4 — Local CMS-aware text helper. Reads from `pageBlocks` (the
  // home__* family populated via loadSubpageBlocks(db,'home') in the
  // route handler) and falls back to the hardcoded RU/AM pair whenever
  // the block is missing, hidden (is_visible=0) or the index is empty.
  const tb = (blockKey: string, idx: number, fallbackRu: string, fallbackAm: string): string => {
    if (!pageBlocks) return t(fallbackRu, fallbackAm)
    const blk = pageBlocks[blockKey]
    if (!blk || blk.is_visible === 0) return t(fallbackRu, fallbackAm)
    const arr = isAM ? blk.texts_am : blk.texts_ru
    if (!arr || !arr[idx] || !arr[idx].trim()) return t(fallbackRu, fallbackAm)
    return arr[idx]
  }

  const tgUrl = 'https://t.me/goo_to_top'

  const seo = {
    title: isAM
      ? 'Go to Top — Wildberries-ի առաջխաղացում Հայաստանում'
      : 'Go to Top — продвижение на Wildberries для армянских продавцов',
    description: isAM
      ? 'Իրական ինքնագնումներ կենդանի մարդկանց կողմից, անհատական քարտեր, սեփական պահեստ Երևանում, 0 արգելափակում 2021 թվականից։'
      : 'Реальные выкупы живыми людьми, индивидуальные карты, собственный склад в Ереване, 0 блокировок с 2021 года.',
  }

  // Server-side ticker items. Mirrors the JS array in landing.js but doubled
  // so the CSS animation has enough content to scroll smoothly without gaps.
  const tickerItems = [
    { i: 'fa-check-circle', ru: 'Реальные люди, не боты', am: 'Իրական մարդիկ, ոչ բոտեր' },
    { i: 'fa-shield-alt', ru: '0 блокировок за всё время', am: '0 արգելափակում ողջ ընթացքում' },
    { i: 'fa-warehouse', ru: 'Собственный склад в Ереване', am: 'Սեփական պահեստ Երևանում' },
    { i: 'fa-mobile-alt', ru: '1000+ аккаунтов', am: '1000+ հաշիվներ' },
    { i: 'fa-map-marker-alt', ru: 'Ереван, Армения', am: 'Երևան, Հայաստան' },
    { i: 'fa-star', ru: 'Профессиональные фото для отзывов', am: 'Մասնագիտական լուսանկարներ կարծիքների համար' },
    { i: 'fa-camera', ru: 'Фотосессии с моделями', am: 'Լուսանկարահանումներ մոդելներով' },
    { i: 'fa-truck', ru: 'Доставка на склады WB', am: 'Առաքում WB պահեստներ' },
  ]
  const tickerHtml = (tickerItems.concat(tickerItems)).map(it =>
    `<div class="ticker-item"><i class="fas ${it.i}"></i><span data-ru="${it.ru}" data-am="${it.am}">${t(it.ru, it.am)}</span></div>`
  ).join('')

  const mainHtml = `
<!-- ===== HERO ===== -->
<section class="hero" id="hero" data-section-id="hero" data-block-key="home__hero">
<div class="container">
<div class="hero-grid">
  <div class="hero-el-title">
    <div class="hero-badge">
      <i class="fas fa-circle" style="color:var(--success);font-size:0.5rem"></i>
      <span data-ru="Успешный опыт с 2021 года" data-am="Հաջողված փորձ 2021 թվականից" data-edit-key="home__hero" data-edit-idx="0">${tb('home__hero', 0, 'Успешный опыт с 2021 года', 'Հաջողված փորձ 2021 թվականից')}</span>
    </div>
    <h1>
      <span data-ru="Выведем ваш товар" data-am="Մենք կբարձրացնենք ձեր ապրանքը" data-edit-key="home__hero" data-edit-idx="1">${tb('home__hero', 1, 'Выведем ваш товар', 'Մենք կբարձրացնենք ձեր ապրանքը')}</span><br>
      <span class="gr" data-ru="в ТОП Wildberries" data-am="Wildberries-ի TOP" data-edit-key="home__hero" data-edit-idx="2">${tb('home__hero', 2, 'в ТОП Wildberries', 'Wildberries-ի TOP')}</span>
    </h1>
  </div>
  <div class="hero-el-texts">
    <p class="hero-desc" data-ru="Самовыкупы с аккаунтов реальных пользователей по вашим ключевым словам. С нами ваши товары становятся ТОПами продаж на Wildberries. Собственный склад и более 1000 реальных аккаунтов в Ереване." data-am="Իրական մարդկանց հաշիվներից ինքնագնումներ ձեր ցանկալի բանալի բառով: Մեզ հետ ձեր ապրանքները դառնում են Wildberries-ի TOP-ում վաճառվողներ: Սեփական պահեստ և ավելի քան 1000 իրական հաշիվ Երևանում:" data-edit-key="home__hero" data-edit-idx="3">${tb('home__hero', 3, 'Самовыкупы с аккаунтов реальных пользователей по вашим ключевым словам. С нами ваши товары становятся ТОПами продаж на Wildberries. Собственный склад и более 1000 реальных аккаунтов в Ереване.', 'Իրական մարդկանց հաշիվներից ինքնագնումներ ձեր ցանկալի բանալի բառով: Մեզ հետ ձեր ապրանքները դառնում են Wildberries-ի TOP-ում վաճառվողներ: Սեփական պահեստ և ավելի քան 1000 իրական հաշիվ Երևանում:')}</p>
  </div>
  <div class="hero-el-stats">
    <div class="hero-stats">
      <div class="stat"><div class="stat-num" data-count="847">0</div><div class="stat-label" data-ru="товаров в ТОП" data-am="ապրանքներ TOP-ում" data-edit-key="home__hero" data-edit-idx="4">${tb('home__hero', 4, 'товаров в ТОП', 'ապրանքներ TOP-ում')}</div></div>
      <div class="stat"><div class="stat-num" data-count="0">0</div><div class="stat-label" data-ru="блокировок" data-am="արգելափակում" data-edit-key="home__hero" data-edit-idx="5">${tb('home__hero', 5, 'блокировок', 'արգելափակում')}</div></div>
      <div class="stat"><div class="stat-num" data-count="1000">0</div><div class="stat-label" data-ru="аккаунтов" data-am="հաշիվներ" data-edit-key="home__hero" data-edit-idx="6">${tb('home__hero', 6, 'аккаунтов', 'հաշիվներ')}</div></div>
    </div>
  </div>
  <div class="hero-el-buttons">
    <div class="hero-buttons">
      <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-lg">
        <i class="fab fa-telegram"></i>
        <span data-ru="Написать в Telegram" data-am="Գրել Telegram-ով" data-edit-key="home__hero" data-edit-idx="8">${tb('home__hero', 8, 'Написать в Telegram', 'Գրել Telegram-ով')}</span>
      </a>
      <a href="/calculator" class="btn btn-outline btn-lg">
        <i class="fas fa-calculator"></i>
        <span data-ru="Рассчитать стоимость" data-am="Հաշվել արժեքը" data-edit-key="home__hero" data-edit-idx="7">${tb('home__hero', 7, 'Рассчитать стоимость', 'Հաշվել արժեքը')}</span>
      </a>
    </div>
  </div>
  <div class="hero-image">
    <div class="hero-photo-wrap">
      <img src="/static/img/founder.webp" alt="Go to Top" loading="eager" fetchpriority="high" decoding="async" onerror="this.onerror=null;this.src='/static/img/team-new.webp'">
      <div class="hero-badge-img">
        <i class="fas fa-shield-alt"></i>
        <span data-ru="Надежный метод продвижения" data-am="Ապահով առաջխաղացման մեթոդ">${t('Надежный метод продвижения', 'Ապահով առաջխաղացման մեթոդ')}</span>
      </div>
    </div>
    <div class="qr-codes-grid">
      <div class="qr-item">
        <a href="https://www.instagram.com/goo_to_top/" target="_blank" rel="noopener" class="qr-card">
          <img src="/static/img/qr/qr-instagram.webp" alt="Instagram QR">
        </a>
        <span data-ru="Instagram" data-am="Instagram">Instagram</span>
      </div>
      <div class="qr-item">
        <a href="${tgUrl}" target="_blank" rel="noopener" class="qr-card">
          <img src="/static/img/qr/qr-telegram.webp" alt="Telegram QR">
        </a>
        <span data-ru="Telegram" data-am="Telegram">Telegram</span>
      </div>
      <div class="qr-item">
        <a href="https://www.facebook.com/gototop.wb" target="_blank" rel="noopener" class="qr-card">
          <img src="/static/img/qr/qr-facebook.webp" alt="Facebook QR">
        </a>
        <span data-ru="Facebook" data-am="Facebook">Facebook</span>
      </div>
      <div class="qr-item">
        <a href="https://wa.me/37455226224" target="_blank" rel="noopener" class="qr-card">
          <img src="/static/img/qr/qr-whatsapp.webp" alt="WhatsApp QR">
        </a>
        <span data-ru="WhatsApp" data-am="WhatsApp">WhatsApp</span>
      </div>
    </div>
  </div>
</div>
</div>
</section>

<!-- ===== TICKER ===== -->
<div class="ticker" data-section-id="ticker">
<div class="ticker-track" id="tickerTrack">${tickerHtml}</div>
</div>

<!-- ===== WB BANNER ===== -->
<div class="wb-banner fade-up" data-section-id="wb-banner" data-block-key="home__wb_banner">
<div class="container">
<div class="wb-banner-inner">
  <div class="wb-banner-card">
    <i class="fas fa-gavel wb-icon"></i>
    <div class="wb-text" data-ru="WB официально отменил штрафы за выкупы!" data-am="WB-ն պաշտոնապես վերացրել է տուգանքները ինքնագնումների համար!" data-edit-key="home__wb_banner" data-edit-idx="0">${tb('home__wb_banner', 0, 'WB официально отменил штрафы за выкупы!', 'WB-ն պաշտոնապես վերացրել է տուգանքները ինքնագնումների համար!')}</div>
  </div>
  <div class="wb-banner-right">
    <span class="wb-r-icon">🚀</span>
    <div class="wb-r-text" data-ru="Повысь рейтинг магазина прямо сейчас" data-am="Բարձրացրեք խանութի վարկանիշը հիմա" data-edit-key="home__wb_banner" data-edit-idx="1">${tb('home__wb_banner', 1, 'Повысь рейтинг магазина прямо сейчас', 'Բարձրացրեք խանութի վարկանիշը հիմա')}</div>
    <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-primary"><span data-ru="Узнать" data-am="Իմանալ" data-edit-key="home__wb_banner" data-edit-idx="2">${tb('home__wb_banner', 2, 'Узнать', 'Իմանալ')}</span></a>
  </div>
</div>
</div>
</div>

<!-- ===== STATS BAR ===== -->
<div class="stats-bar fade-up" data-section-id="stats-bar" data-block-key="home__stats_bar">
<div class="container">
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-big" data-count-s="500">0</div>
      <div class="stat-desc" data-ru="поставщиков сотрудничают с нами" data-am="մատակարար համագործակցում է մեզ հետ" data-edit-key="home__stats_bar" data-edit-idx="0">${tb('home__stats_bar', 0, 'поставщиков сотрудничают с нами', 'մատակարար համագործակցում է մեզ հետ')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-big" data-count-s="1000">0+</div>
      <div class="stat-desc" data-ru="аккаунтов с индивидуальной картой" data-am="հաշիվներ անհատական քարտով" data-edit-key="home__stats_bar" data-edit-idx="1">${tb('home__stats_bar', 1, 'аккаунтов с индивидуальной картой', 'հաշիվներ անհատական քարտով')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-big" data-count-s="21">0</div>
      <div class="stat-desc" data-ru="день до выхода в ТОП" data-am="ապրանք TOP-ում օրական" data-edit-key="home__stats_bar" data-edit-idx="2">${tb('home__stats_bar', 2, 'день до выхода в ТОП', 'ապրանք TOP-ում օրական')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-big" data-count-s="200">0+</div>
      <div class="stat-desc" data-ru="выкупов каждый день" data-am="գնում ամեն օր" data-edit-key="home__stats_bar" data-edit-idx="3">${tb('home__stats_bar', 3, 'выкупов каждый день', 'գնում ամեն օր')}</div>
    </div>
  </div>
</div>
</div>

<!-- ===== SERVICES ===== -->
<section class="section" id="services" data-section-id="services" data-block-key="home__services">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-rocket"></i> <span data-ru="Наши услуги" data-am="Մեր ծառայությունները">${t('Наши услуги', 'Մեր ծառայությունները')}</span></div>
    <h2 class="section-title" data-ru="Полный спектр продвижения на WB" data-am="WB-ում առաջխաղացման լիարժեք սպեկտր">${t('Полный спектр продвижения на WB', 'WB-ում առաջխաղացման լիարժեք սպեկտր')}</h2>
    <p class="section-sub" data-ru="Выкупы живыми людьми, отзывы с реальными фото, профессиональные фотосессии — всё для вашего товара" data-am="Գնումներ իրական մարդկանցով, կարծիքներ իրական լուսանկարներով, մասնագիտական լուսանկարահանումներ — ամենը ձեր ապրանքի համար">${t('Выкупы живыми людьми, отзывы с реальными фото, профессиональные фотосессии — всё для вашего товара', 'Գնումներ իրական մարդկանցով, կարծիքներ իրական լուսանկարներով, մասնագիտական լուսանկարահանումներ — ամենը ձեր ապրանքի համար')}</p>
  </div>
  <div class="services-grid">
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-shopping-cart"></i></div>
      <h3 data-ru="Выкупы по ключевым запросам" data-am="Գնումներ բանալի հարցումներով" data-edit-key="home__services" data-edit-idx="0">${tb('home__services', 0, 'Выкупы по ключевым запросам', 'Գնումներ բանալի հարցումներով')}</h3>
      <p data-ru="Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану." data-am="Ձեր ապրանքը գնվում է իրական մարդկանցով։ Իրական հաշիվներից տարբեր ՊՎԶ-ներով ամբողջ Երևանում:" data-edit-key="home__services" data-edit-idx="1">${tb('home__services', 1, 'Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану.', 'Ձեր ապրանքը գնվում է իրական մարդկանցով։ Իրական հաշիվներից տարբեր ՊՎԶ-ներով ամբողջ Երևանում:')}</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Реальные аккаунты с историей покупок" data-am="Իրական հաշիվներ գնումների պատմությամբ">${t('Реальные аккаунты с историей покупок', 'Իրական հաշիվներ գնումների պատմությամբ')}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Географическое распределение" data-am="Աշխարհագրական բաշխում">${t('Географическое распределение', 'Աշխարհագրական բաշխում')}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Естественное поведение покупателей" data-am="Գնորդների բնական վարքագիծ">${t('Естественное поведение покупателей', 'Գնորդների բնական վարքագիծ')}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Забор товара из ПВЗ" data-am="Ապրանքի ստացում ՊՎԶ-ից">${t('Забор товара из ПВЗ', 'Ապրանքի ստացում ՊՎԶ-ից')}</span></li>
      </ul>
      <div style="margin-top:20px;text-align:center"><a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-tg" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-rocket"></i> <span data-ru="Повысить рейтинг" data-am="Բարձրացնել վարկանիշը" data-edit-key="home__services" data-edit-idx="2">${tb('home__services', 2, 'Повысить рейтинг', 'Բարձրացնել վարկանիշը')}</span></a></div>
    </div>
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-star"></i></div>
      <h3 data-ru="Отзывы и оценки" data-am="Կարծիքներ և գնահատականներ" data-edit-key="home__services" data-edit-idx="3">${tb('home__services', 3, 'Отзывы и оценки', 'Կարծիքներ և գնահատականներ')}</h3>
      <p data-ru="Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга." data-am="Մանրամասն կարծիքներ լուսանկարներով և տեսանյութով իրական հաշիվներից վարկանիշի բարձրացման համար:" data-edit-key="home__services" data-edit-idx="4">${tb('home__services', 4, 'Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга.', 'Մանրամասն կարծիքներ լուսանկարներով և տեսանյութով իրական հաշիվներից վարկանիշի բարձրացման համար:')}</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Текст отзыва + фото/видео" data-am="Կարծիքի տեքստ + լուսանկար/տեսանյութ">${t('Текст отзыва + фото/видео', 'Կարծիքի տեքստ + լուսանկար/տեսանյութ')}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Профессиональная фотосессия" data-am="Մասնագիտական լուսանկարահանում">${t('Профессиональная фотосессия', 'Մասնագիտական լուսանկարահանում')}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Разные локации и модели" data-am="Տարբեր վայրեր և մոդելներ">${t('Разные локации и модели', 'Տարբեր վայրեր և մոդելներ')}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="До 50% отзывов от выкупов" data-am="Մինչև 50% կարծիքներ գնումներից">${t('До 50% отзывов от выкупов', 'Մինչև 50% կարծիքներ գնումներից')}</span></li>
      </ul>
      <div style="margin-top:20px;text-align:center"><a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-success" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-rocket"></i> <span data-ru="Начать продвижение" data-am="Սկսել առաջխաղացումը" data-edit-key="home__services" data-edit-idx="5">${tb('home__services', 5, 'Начать продвижение', 'Սկսել առաջխաղացումը')}</span></a></div>
    </div>
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-key"></i></div>
      <h3 data-ru="Активация ключевых слов" data-am="Բանալի բառերի ակտիվացում" data-edit-key="home__services" data-edit-idx="6">${tb('home__services', 6, 'Активация ключевых слов', 'Բանալի բառերի ակտիվացում')}</h3>
      <p data-ru="Есть ключевое слово, по которому хотите показываться, но алгоритмы не связывают его с вашей карточкой? Мы знаем решение — делаем целевые выкупы, которые активируют товар в нужном кластере." data-am="Ունե՞ք բանալի բառ, որով ցանկանում եք, որ ձեր ապրանքը ցուցադրվի, բայց ալգորիթմները չեն կապում այն ձեր քարտին։ Մենք գիտենք լուծումը՝ կատարվում ենք նպատակային գնումներ, որոնք ակտիվացնում են ապրանքը ճիշտ կլաստերում։" data-edit-key="home__services" data-edit-idx="7">${tb('home__services', 7, 'Есть ключевое слово, по которому хотите показываться, но алгоритмы не связывают его с вашей карточкой? Мы знаем решение — делаем целевые выкупы, которые активируют товар в нужном кластере.', 'Ունե՞ք բանալի բառ, որով ցանկանում եք, որ ձեր ապրանքը ցուցադրվի, բայց ալգորիթմները չեն կապում այն ձեր քարտին։ Մենք գիտենք լուծումը՝ կատարվում ենք նպատակային գնումներ, որոնք ակտիվացնում են ապրանքը ճիշտ կլաստերում։')}</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Органический трафик — резкий рост" data-am="Օրգանիկ տրաֆիկի կտրուկ աճ">${t('Органический трафик — резкий рост', 'Օրգանիկ տրաֆիկի կտրուկ աճ')}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Укрепление позиций новыми ключевыми словами" data-am="Դիրքերի ամրապնդում նոր բանալի բառերով">${t('Укрепление позиций новыми ключевыми словами', 'Դիրքերի ամրապնդում նոր բանալի բառերով')}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Подключение к целевым и прибыльным запросам" data-am="Միացում թիրախային և եկամտաբեր հարցումներին">${t('Подключение к целевым и прибыльным запросам', 'Միացում թիրախային և եկամտաբեր հարցումներին')}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Стабильные позиции без рекламы" data-am="Կայուն դիրքեր առանց գովազդի">${t('Стабильные позиции без рекламы', 'Կայուն դիրքեր առանց գովազդի')}</span></li>
      </ul>
      <div style="margin-top:20px;text-align:center"><a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-primary" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-key"></i> <span data-ru="Активировать ключевые" data-am="Ակտիվացնել բանալիները" data-edit-key="home__services" data-edit-idx="8">${tb('home__services', 8, 'Активировать ключевые', 'Ակտիվացնել բանալիները')}</span></a></div>
    </div>
  </div>
</div>
</section>

<!-- ===== ПАКЕТЫ ЛЕНДИНГА (Phase 3) ===== -->
${landingPackages.length > 0 ? `
<section class="section nh-packages" id="packages" data-section-id="packages">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-cube"></i> <span data-ru="Пакеты" data-am="Փաթեթներ">${t('Пакеты', 'Փաթեթներ')}</span></div>
    <h2 class="section-title" data-ru="Готовые пакеты услуг" data-am="Պատրաստ ծառայությունների փաթեթներ">${isAM ? 'Պատրաստ <span class="gr">ծառայությունների փաթեթներ</span>' : 'Готовые <span class="gr">пакеты услуг</span>'}</h2>
    <p class="section-sub" data-ru="Выберите пакет, который подходит под вашу задачу — выкупы, отзывы или партнёрство" data-am="Ընտրեք ձեր նպատակին համապատասխան փաթեթը՝ հետագնումներ, կարծիքներ կամ գործընկերություն">${t('Выберите пакет, который подходит под вашу задачу — выкупы, отзывы или партнёрство', 'Ընտրեք ձեր նպատակին համապատասխան փաթեթը՝ հետագնումներ, կարծիքներ կամ գործընկերություն')}</p>
  </div>
  <div class="pkg-grid fade-up">
    ${landingPackages.slice(0, 6).map(p => {
      const titleRu = p.title_ru || ''
      const titleAm = p.title_am || titleRu
      const cover = p.cover_url || '/static/img/svc-buyouts.webp'
      const escTitle = (titleRu || '').replace(/"/g, '&quot;')
      return `<a class="pkg-card" href="/package/${encodeURIComponent(p.slug)}${isAM ? '?lang=am' : ''}">
        <div class="pkg-photo"><img src="${cover}" alt="${escTitle}" loading="lazy" decoding="async"></div>
        <div class="pkg-body">
          <h3 data-ru="${escTitle}" data-am="${titleAm.replace(/"/g, '&quot;')}">${t(titleRu, titleAm)}</h3>
          <span class="pkg-arrow"><span data-ru="Подробнее" data-am="Մանրամասն">${t('Подробнее', 'Մանրամասն')}</span> <i class="fas fa-arrow-right"></i></span>
        </div>
      </a>`
    }).join('')}
  </div>
</div>
</section>
` : ''}

<!-- ===== WHY BUYOUTS BY KEYWORDS ===== -->
<section class="section" id="why-buyouts" data-section-id="why-buyouts" data-block-key="home__why_buyouts">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-chart-line"></i> <span data-ru="Почему это работает" data-am="Ինչու է սա աշխատում.">${t('Почему это работает', 'Ինչու է սա աշխատում.')}</span></div>
    <h2 class="section-title" data-ru="Почему выкупы по ключевым запросам — самый эффективный способ продвижения" data-am="Ինչու է գնումները բանալի բառերով — ամենա արդյունավետը">${isAM ? 'Ինչու է գնումները բանալի բառերով — ամենա արդյունավետը' : 'Почему выкупы по ключевым запросам — <span class="gr">самый эффективный способ</span> продвижения'}</h2>
  </div>

  <div class="why-block fade-up">
    <h3><i class="fas fa-funnel-dollar"></i> <span data-ru="Мы не просто покупаем ваш товар — мы прокачиваем всю воронку" data-am="Մենք ոչ միայն գնում ենք — մենք բարձրացնում ենք բոլոր քայլերի կոնվերսիաները" data-edit-key="home__why_buyouts" data-edit-idx="0">${tb('home__why_buyouts', 0, 'Мы не просто покупаем ваш товар — мы прокачиваем всю воронку', 'Մենք ոչ միայն գնում ենք — մենք բարձրացնում ենք բոլոր քայլերի կոնվերսիաները')}</span></h3>
    <p data-ru="Каждый выкуп по ключевому запросу — это полноценное продвижение вашей карточки. Наши люди делают всё так, как это делает реальный покупатель. Вот что происходит при каждом выкупе:" data-am="Յուրաքանչյուր գնում բանալի բառով — լիարժեք առաջխաղացման մեթոդ.">${t('Каждый выкуп по ключевому запросу — это полноценное продвижение вашей карточки. Наши люди делают всё так, как это делает реальный покупатель. Вот что происходит при каждом выкупе:', 'Յուրաքանչյուր գնում բանալի բառով — լիարժեք առաջխաղացման մեթոդ.')}</p>
    <div class="why-steps">
      <div class="why-step"><div class="why-step-num">1</div><div><h4 data-ru="Поиск по ключевому запросу" data-am="Որոնում բանալի բառով" data-edit-key="home__why_buyouts" data-edit-idx="1">${tb('home__why_buyouts', 1, 'Поиск по ключевому запросу', 'Որոնում բանալի բառով')}</h4><p data-ru="Находим ваш товар именно так, как ищет реальный покупатель — через поисковую строку WB" data-am="Գտնում ենք ձեր ապրանքը ճիշտ այնպես, ինչպես որոնում է իրական գնորդը՝ WB-ի որոնման տողի միջոցով" data-edit-key="home__why_buyouts" data-edit-idx="2">${tb('home__why_buyouts', 2, 'Находим ваш товар именно так, как ищет реальный покупатель — через поисковую строку WB', 'Գտնում ենք ձեր ապրանքը ճիշտ այնպես, ինչպես որոնում է իրական գնորդը՝ WB-ի որոնման տողի միջոցով')}</p></div></div>
      <div class="why-step"><div class="why-step-num">2</div><div><h4 data-ru="Просмотр карточки" data-am="Քարտի դիտարկում" data-edit-key="home__why_buyouts" data-edit-idx="3">${tb('home__why_buyouts', 3, 'Просмотр карточки', 'Քարտի դիտարկում')}</h4><p data-ru="Полностью просматриваем фото и видео, листаем описание — повышаем конверсию из просмотра в переход" data-am="Լիարժեք ուսումնասիրում ենք ֆոտոները, վիդեոները, նկարագրությունը. Բարելավում ենք վարքագծային գործոնները և CTR ցուցանիշը" data-edit-key="home__why_buyouts" data-edit-idx="4">${tb('home__why_buyouts', 4, 'Полностью просматриваем фото и видео, листаем описание — повышаем конверсию из просмотра в переход', 'Լիարժեք ուսումնասիրում ենք ֆոտոները, վիդեոները, նկարագրությունը. Բարելավում ենք վարքագծային գործոնները և CTR ցուցանիշը')}</p></div></div>
      <div class="why-step"><div class="why-step-num">3</div><div><h4 data-ru="Работа с отзывами" data-am="Աշխատանք կարծիքների հետ" data-edit-key="home__why_buyouts" data-edit-idx="5">${tb('home__why_buyouts', 5, 'Работа с отзывами', 'Աշխատանք կարծիքների հետ')}</h4><p data-ru="Пролистываем отзывы, лайкаем положительные — это улучшает ранжирование лучших отзывов" data-am="Թերթում ենք կարծիքները և հավանում դրականները՝ Հաճախորդները 70% ժամանակը անցկացնում են կարծիքների բաժնում" data-edit-key="home__why_buyouts" data-edit-idx="6">${tb('home__why_buyouts', 6, 'Пролистываем отзывы, лайкаем положительные — это улучшает ранжирование лучших отзывов', 'Թերթում ենք կարծիքները և հավանում դրականները՝ Հաճախորդները 70% ժամանակը անցկացնում են կարծիքների բաժնում')}</p></div></div>
      <div class="why-step"><div class="why-step-num">4</div><div><h4 data-ru="Добавление конкурентов" data-am="Մրցակիցների ավելացում" data-edit-key="home__why_buyouts" data-edit-idx="7">${tb('home__why_buyouts', 7, 'Добавление конкурентов', 'Մրցակիցների ավելացում')}</h4><p data-ru="Добавляем в корзину товары конкурентов вместе с вашим — имитируем реальное поведение покупателя" data-am="Զամբյուղում ավելացնում ենք մրցակիցների ապրանքներ ձերի հետ միասին՝ կրկնօրինակելով իրական գնորդի վարքագիծը" data-edit-key="home__why_buyouts" data-edit-idx="8">${tb('home__why_buyouts', 8, 'Добавляем в корзину товары конкурентов вместе с вашим — имитируем реальное поведение покупателя', 'Զամբյուղում ավելացնում ենք մրցակիցների ապրանքներ ձերի հետ միասին՝ կրկնօրինակելով իրական գնորդի վարքագիծը')}</p></div></div>
      <div class="why-step"><div class="why-step-num">5</div><div><h4 data-ru="Удаление конкурентов из корзины" data-am="Մրցակիցների հեռացում զամբյուղից" data-edit-key="home__why_buyouts" data-edit-idx="9">${tb('home__why_buyouts', 9, 'Удаление конкурентов из корзины', 'Մրցակիցների հեռացում զամբյուղից')}</h4><p data-ru="В момент заказа удаляем конкурентов и оставляем только ваш товар — WB видит, что выбирают именно вас" data-am="Պատվիրելու պահին մենք հեռացնում ենք մրցակիցներին և թողնում միայն ձեր ապրանքը. WB-ն տեսնում է, որ մարդիկ ընտրում են ձեզ" data-edit-key="home__why_buyouts" data-edit-idx="10">${tb('home__why_buyouts', 10, 'В момент заказа удаляем конкурентов и оставляем только ваш товар — WB видит, что выбирают именно вас', 'Պատվիրելու պահին մենք հեռացնում ենք մրցակիցներին և թողնում միայն ձեր ապրանքը. WB-ն տեսնում է, որ մարդիկ ընտրում են ձեզ')}</p></div></div>
      <div class="why-step"><div class="why-step-num">6</div><div><h4 data-ru="Заказ и получение" data-am="Պատվեր և ստացում" data-edit-key="home__why_buyouts" data-edit-idx="11">${tb('home__why_buyouts', 11, 'Заказ и получение', 'Պատվեր և ստացում')}</h4><p data-ru="Оформляем заказ, забираем из ПВЗ, оставляем отзыв — полный цикл реального покупателя" data-am="Պատվիրում ենք ապրանքը, վերցնում ենք այն ստացման կետից և թողնում ենք կարծիք՝ իրական հաճախորդի ամբողջական ճանապարհ" data-edit-key="home__why_buyouts" data-edit-idx="12">${tb('home__why_buyouts', 12, 'Оформляем заказ, забираем из ПВЗ, оставляем отзыв — полный цикл реального покупателя', 'Պատվիրում ենք ապրանքը, վերցնում ենք այն ստացման կետից և թողնում ենք կարծիք՝ իրական հաճախորդի ամբողջական ճանապարհ')}</p></div></div>
    </div>
    <div class="highlight-result" data-ru="Результат: повышаются ВСЕ конверсии вашей карточки: CTR, переходы, добавления в корзину, заказы. Карточка закрепляется в ТОПе и начинает получать органический трафик. Чем выше позиция — тем больше органических продаж без дополнительных вложений." data-am="Արդյունքում՝ ձեր ապրանքը բարձրանում է 3-4-րդ էջերից և ամրապնդվում է TOP-ում 7-ից 14 օրերի ընթացքում՝ ձեր բանալի բառերով։ Ստանում եք բարձր վարկանիշ և կայուն օրգանիկ վաճառքներ։"><i class="fas fa-bolt"></i> ${tb('home__why_buyouts', 13, '<strong>Результат:</strong> повышаются <strong>ВСЕ конверсии</strong> вашей карточки: CTR, переходы, добавления в корзину, заказы. Карточка закрепляется в ТОПе и начинает получать <strong>органический трафик</strong>. Чем выше позиция — тем больше органических продаж без дополнительных вложений.', 'Արդյունքում՝ ձեր ապրանքը բարձրանում է 3-4-րդ էջերից և ամրապնդվում է TOP-ում 7-ից 14 օրերի ընթացքում՝ ձեր բանալի բառերով։ Ստանում եք բարձր վարկանիշ և կայուն օրգանիկ վաճառքներ։')}</div>
  </div>

  <div class="section-cta">
    <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-warning"><i class="fas fa-fire"></i> <span data-ru="Начать выкупы" data-am="Սկսել գնումները" data-edit-key="home__why_buyouts" data-edit-idx="14">${tb('home__why_buyouts', 14, 'Начать выкупы', 'Սկսել գնումները')}</span></a>
  </div>
</div>
</section>

<!-- ===== ДЛЯ КОГО ПОЛЕЗЕН НАШ СЕРВИС ===== -->
<section class="section nh-for-whom" id="for-whom" data-section-id="for-whom" data-block-key="home__for_whom">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-users"></i> <span data-ru="Для кого" data-am="Ում համար" data-edit-key="home__for_whom" data-edit-idx="0">${tb('home__for_whom', 0, 'Для кого', 'Ում համար')}</span></div>
    <h2 class="section-title" data-ru="Для кого полезен наш сервис" data-am="Ում համար է օգտակար մեր ծառայությունը">${isAM ? `${tb('home__for_whom', 1, 'Для кого полезен', 'Ում համար է օգտակար')} <span class="gr">${tb('home__for_whom', 2, 'наш сервис', 'մեր ծառայությունը')}</span>` : `${tb('home__for_whom', 1, 'Для кого полезен', 'Ում համար է օգտակար')} <span class="gr">${tb('home__for_whom', 2, 'наш сервис', 'մեր ծառայությունը')}</span>`}</h2>
    <p class="section-sub" data-ru="Мы работаем с разными форматами бизнеса — от отдельных менеджеров до крупных агентств" data-am="Մենք աշխատում ենք բիզնեսի տարբեր ձևաչափերի հետ՝ առանձին մենեջերներից մինչև խոշոր գործակալություններ" data-edit-key="home__for_whom" data-edit-idx="3">${tb('home__for_whom', 3, 'Мы работаем с разными форматами бизнеса — от отдельных менеджеров до крупных агентств', 'Մենք աշխատում ենք բիզնեսի տարբեր ձևաչափերի հետ՝ առանձին մենեջերներից մինչև խոշոր գործակալություններ')}</p>
  </div>
  <div class="fw-grid fade-up">
    <div class="fw-card">
      <div class="fw-photo"><img src="/static/img/for-whom-manager.webp" alt="Менеджер по маркетплейсам" loading="lazy" decoding="async"></div>
      <div class="fw-body">
        <h3 data-ru="Менеджер по маркетплейсам" data-am="Մարկետփլեյս մենեջեր" data-edit-key="home__for_whom" data-edit-idx="4">${tb('home__for_whom', 4, 'Менеджер по маркетплейсам', 'Մարկետփլեյս մենեջեր')}</h3>
        <p data-ru="Имеете большую базу клиентов-поставщиков на WB и Ozon — станьте нашим партнёром и зарабатывайте на каждом заказе" data-am="Ունեք մատակարարների մեծ բազա WB-ում և Ozon-ում — դարձեք մեր գործընկերը և վաստակեք յուրաքանչյուր պատվերից" data-edit-key="home__for_whom" data-edit-idx="5">${tb('home__for_whom', 5, 'Имеете большую базу клиентов-поставщиков на WB и Ozon — станьте нашим партнёром и зарабатывайте на каждом заказе', 'Ունեք մատակարարների մեծ բազա WB-ում և Ozon-ում — դարձեք մեր գործընկերը և վաստակեք յուրաքանչյուր պատվերից')}</p>
      </div>
    </div>
    <div class="fw-card">
      <div class="fw-photo"><img src="/static/img/for-whom-agency.webp" alt="Агентство или компания" loading="lazy" decoding="async"></div>
      <div class="fw-body">
        <h3 data-ru="Агентство или компания" data-am="Գործակալություն կամ ընկերություն" data-edit-key="home__for_whom" data-edit-idx="6">${tb('home__for_whom', 6, 'Агентство или компания', 'Գործակալություն կամ ընկերություն')}</h3>
        <p data-ru="Работаете с поставщиками маркетплейсов — добавьте услуги выкупов и отзывов в свой портфель и увеличьте доход" data-am="Աշխատում եք մարկետփլեյսների մատակարարների հետ՝ ավելացրեք գնումների և կարծիքների ծառայությունները ձեր փաթեթում և մեծացրեք եկամուտը" data-edit-key="home__for_whom" data-edit-idx="7">${tb('home__for_whom', 7, 'Работаете с поставщиками маркетплейсов — добавьте услуги выкупов и отзывов в свой портфель и увеличьте доход', 'Աշխատում եք մարկետփլեյսների մատակարարների հետ՝ ավելացրեք գնումների և կարծիքների ծառայությունները ձեր փաթեթում և մեծացրեք եկամուտը')}</p>
      </div>
    </div>
    <div class="fw-card">
      <div class="fw-photo"><img src="/static/img/for-whom-blogger.webp" alt="Владелец ресурса" loading="lazy" decoding="async"></div>
      <div class="fw-body">
        <h3 data-ru="Владелец ресурса" data-am="Ռեսուրսի սեփականատեր" data-edit-key="home__for_whom" data-edit-idx="8">${tb('home__for_whom', 8, 'Владелец ресурса', 'Ռեսուրսի սեփականատեր')}</h3>
        <p data-ru="Ведёте тематический блог, YouTube-канал или Telegram-канал о маркетплейсах — станьте партнёром и монетизируйте аудиторию" data-am="Վարում եք թեմատիկ բլոգ, YouTube-ալիք կամ Telegram-ալիք մարկետփլեյսների մասին՝ դարձեք գործընկեր և դրամայնացրեք լսարանը" data-edit-key="home__for_whom" data-edit-idx="9">${tb('home__for_whom', 9, 'Ведёте тематический блог, YouTube-канал или Telegram-канал о маркетплейсах — станьте партнёром и монетизируйте аудиторию', 'Վարում եք թեմատիկ բլոգ, YouTube-ալիք կամ Telegram-ալիք մարկետփլեյսների մասին՝ դարձեք գործընկեր և դրամայնացրեք լսարանը')}</p>
      </div>
    </div>
    <div class="fw-card">
      <div class="fw-photo"><img src="/static/img/for-whom-school.webp" alt="Онлайн-школа" loading="lazy" decoding="async"></div>
      <div class="fw-body">
        <h3 data-ru="Онлайн-школа" data-am="Օնլայն-դպրոց" data-edit-key="home__for_whom" data-edit-idx="10">${tb('home__for_whom', 10, 'Онлайн-школа', 'Օնլայն-դպրոց')}</h3>
        <p data-ru="Обучаете работе с маркетплейсами — рекомендуйте наш сервис студентам и получайте реферальное вознаграждение" data-am="Ուսուցանում եք մարկետփլեյսներում աշխատելը՝ խորհուրդ տվեք մեր ծառայությունը ուսանողներին և ստացեք ռեֆերալային պարգևատրում" data-edit-key="home__for_whom" data-edit-idx="11">${tb('home__for_whom', 11, 'Обучаете работе с маркетплейсами — рекомендуйте наш сервис студентам и получайте реферальное вознаграждение', 'Ուսուցանում եք մարկետփլեյսներում աշխատելը՝ խորհուրդ տվեք մեր ծառայությունը ուսանողներին և ստացեք ռեֆերալային պարգևատրում')}</p>
      </div>
    </div>
    <div class="fw-card">
      <div class="fw-photo"><img src="/static/img/for-whom-course.webp" alt="Интенсив или курс" loading="lazy" decoding="async"></div>
      <div class="fw-body">
        <h3 data-ru="Интенсив или курс" data-am="Ինտենսիվ կամ դասընթաց" data-edit-key="home__for_whom" data-edit-idx="12">${tb('home__for_whom', 12, 'Интенсив или курс', 'Ինտենսիվ կամ դասընթաց')}</h3>
        <p data-ru="Проводите обучение по маркетплейсам — включите наш сервис как практический инструмент и помогайте ученикам с реальными выкупами" data-am="Անցկացնում եք ուսուցում մարկետփլեյսների վերաբերյալ՝ ներառեք մեր ծառայությունը որպես գործնական գործիք և օգնեք ուսանողներին իրական գնումներով" data-edit-key="home__for_whom" data-edit-idx="13">${tb('home__for_whom', 13, 'Проводите обучение по маркетплейсам — включите наш сервис как практический инструмент и помогайте ученикам с реальными выкупами', 'Անցկացնում եք ուսուցում մարկետփլեյսների վերաբերյալ՝ ներառեք մեր ծառայությունը որպես գործնական գործիք և օգնեք ուսանողներին իրական գնումներով')}</p>
      </div>
    </div>
  </div>
  <div style="text-align:center;margin-top:36px" class="fade-up">
    <a href="/referral" class="btn btn-primary btn-lg">
      <i class="fas fa-comments"></i>
      <span data-ru="Обсудить партнёрство" data-am="Քննարկել գործընկերությունը">${t('Обсудить партнёрство', 'Քննարկել գործընկերությունը')}</span>
    </a>
  </div>
</div>
</section>

<!-- ===== CALCULATOR (mirrors /calculator and the long landing) =====
     Same calc-wrap structure landing.js looks for, so:
     • SSR ships a complete fallback list of services for all 6 tabs;
     • landing.js rebuilds groups + packages from window.__SITE_DATA on
       first paint (currency-aware tiered prices, admin-edited services);
     • the auto-injected lead form + "Скачать КП (PDF)" button (handled
       inside landing.js) finds #calculator + #calcTotal and appears on
       /home too — so the new home page now creates leads + PDFs exactly
       like the long landing page. -->
<section class="section section-dark" id="calculator" data-section-id="calculator">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-calculator"></i> <span data-ru="Калькулятор" data-am="Հաշվիչ">${t('Калькулятор', 'Հաշվիչ')}</span></div>
    <h2 class="section-title" data-ru="Рассчитайте стоимость услуг" data-am="Հաշվեք ծառայությունների արժեքը">${t('Рассчитайте стоимость услуг', 'Հաշվեք ծառայությունների արժեքը')}</h2>
    <p class="section-sub" data-ru="Выберите готовый пакет или соберите индивидуальный набор услуг — итог пересчитывается автоматически. Заказ можно оформить прямо отсюда." data-am="Ընտրեք պատրաստ փաթեթ կամ հավաքեք անհատական ծառայությունների խումբ — ընդհանուրը հաշվարկվում է ինքնաբերաբար։ Պատվիրեք ուղիղ այստեղից։">${t('Выберите готовый пакет или соберите индивидуальный набор услуг — итог пересчитывается автоматически. Заказ можно оформить прямо отсюда.', 'Ընտրեք պատրաստ փաթեթ կամ հավաքեք անհատական ծառայությունների խումբ — ընդհանուրը հաշվարկվում է ինքնաբերաբար։ Պատվիրեք ուղիղ այստեղից։')}</p>
  </div>
  <div class="calc-wrap fade-up">
    <div class="calc-packages" id="calcPackages" style="display:none"></div>
    <div class="calc-tabs">
      <div class="calc-tab active" onclick="showCalcTab('buyouts',this)" data-ru="Выкупы" data-am="Գնումներ">${t('Выкупы', 'Գնումներ')}</div>
      <div class="calc-tab" onclick="showCalcTab('reviews',this)" data-ru="Отзывы" data-am="Կարծիքներ">${t('Отзывы', 'Կարծիքներ')}</div>
      <div class="calc-tab" onclick="showCalcTab('photo',this)" data-ru="Фотосъёмка" data-am="Լուսանկարահանում">${t('Фотосъёмка', 'Լուսանկարահանում')}</div>
      <div class="calc-tab" onclick="showCalcTab('ff',this)" data-ru="ФФ" data-am="Ֆուլֆիլմենթ">${t('ФФ', 'Ֆուլֆիլմենթ')}</div>
      <div class="calc-tab" onclick="showCalcTab('logistics',this)" data-ru="Логистика" data-am="Լոգիստիկա">${t('Логистика', 'Լոգիստիկա')}</div>
      <div class="calc-tab" onclick="showCalcTab('other',this)" data-ru="Прочие услуги" data-am="Այլ ծառայություններ">${t('Прочие услуги', 'Այլ ծառայություններ')}</div>
    </div>
    <div class="calc-group active" id="cg-buyouts">
      <div class="calc-row" data-price="buyout" id="buyoutRow">
        <div class="calc-label" data-ru="Выкуп + забор из ПВЗ" data-am="Գնում + ստացում ՊՎԶ-ից">${t('Выкуп + забор из ПВЗ', 'Գնում + ստացում ՊՎԶ-ից')}</div>
        <div class="calc-price" id="buyoutPriceLabel">2 000 ֏</div>
        <div class="calc-input"><button onclick="ccBuyout(-1)">−</button><input type="number" id="buyoutQty" value="0" min="0" max="999" onchange="onBuyoutInput()" oninput="onBuyoutInput()"><button onclick="ccBuyout(1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Выкуп КГТ + забор из ПВЗ" data-am="Ծանրաքաշ ապրանքի գնում + ստացում ՊՎԶ-ից">${t('Выкуп КГТ + забор из ПВЗ', 'Ծանրաքաշ ապրանքի գնում + ստացում ՊՎԶ-ից')}</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>
    <div class="calc-group" id="cg-reviews">
      <div class="calc-row" data-price="300">
        <div class="calc-label" data-ru="Оценка" data-am="Գնահատական">${t('Оценка', 'Գնահատական')}</div>
        <div class="calc-price">300 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="500">
        <div class="calc-label" data-ru="Оценка + отзыв" data-am="Գնահատական + կարծիք">${t('Оценка + отзыв', 'Գնահատական + կարծիք')}</div>
        <div class="calc-price">500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="500">
        <div class="calc-label" data-ru="Вопрос к товару" data-am="Հարց ապրանքի վերաբերյալ">${t('Вопрос к товару', 'Հարց ապրանքի վերաբերյալ')}</div>
        <div class="calc-price">500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="250">
        <div class="calc-label" data-ru="Написание текста отзыва" data-am="Կարծիքի տեքստի գրում">${t('Написание текста отзыва', 'Կարծիքի տեքստի գրում')}</div>
        <div class="calc-price">250 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="100">
        <div class="calc-label" data-ru="Подписка на бренд / страницу" data-am="Բրենդի / էջի բաժանորդագրություն">${t('Подписка на бренд / страницу', 'Բրենդի / էջի բաժանորդագրություն')}</div>
        <div class="calc-price">100 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>
    <div class="calc-group" id="cg-photo">
      <div class="calc-row" data-price="3500">
        <div class="calc-label" data-ru="Фотосессия в гардеробной WB (жен. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (կին մոդել)">${t('Фотосессия в гардеробной WB (жен. модель)', 'Լուսանկարահանում WB հագուստապահարանում (կին մոդել)')}</div>
        <div class="calc-price">3 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="4500">
        <div class="calc-label" data-ru="Фотосессия в гардеробной WB (муж. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (տղամարդ մոդել)">${t('Фотосессия в гардеробной WB (муж. модель)', 'Լուսանկարահանում WB հագուստապահարանում (տղամարդ մոդել)')}</div>
        <div class="calc-price">4 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Предметная фотосъёмка (3 фото)" data-am="Առարկայական լուսանկարահանում (3 լուսանկար)">${t('Предметная фотосъёмка (3 фото)', 'Առարկայական լուսանկարահանում (3 լուսանկար)')}</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="5000">
        <div class="calc-label" data-ru="Предметная съёмка (крупное / техника, 3 фото)" data-am="Առարկայական լուսանկարահանում (խոշոր / տեխնիկա, 3 լուս.)">${t('Предметная съёмка (крупное / техника, 3 фото)', 'Առարկայական լուսանկարահանում (խոշոր / տեխնիկա, 3 լուս.)')}</div>
        <div class="calc-price">5 000 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Ребёнок модель (до 14 лет)" data-am="Երեխա մոդել (մինչև 14 տարեկան)">${t('Ребёнок модель (до 14 лет)', 'Երեխա մոդել (մինչև 14 տարեկան)')}</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="7000">
        <div class="calc-label" data-ru="Видеообзор товара" data-am="Ապրանքի վիդեոհոլովակ">${t('Видеообзор товара', 'Ապրանքի վիդեոհոլովակ')}</div>
        <div class="calc-price">7 000 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>
    <div class="calc-group" id="cg-ff">
      <div class="calc-row" data-price="100">
        <div class="calc-label" data-ru="Замена штрихкода" data-am="Շտրիխկոդի փոխարինում">${t('Замена штрихкода', 'Շտրիխկոդի փոխարինում')}</div>
        <div class="calc-price">100 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="200">
        <div class="calc-label" data-ru="Переупаковка (наша)" data-am="Վերափաթեթավորում (մեր փաթեթ)">${t('Переупаковка (наша)', 'Վերափաթեթավորում (մեր փաթեթ)')}</div>
        <div class="calc-price">200 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="150">
        <div class="calc-label" data-ru="Переупаковка (клиента)" data-am="Վերափաթեթավորում (հաճախորդի փաթեթ)">${t('Переупаковка (клиента)', 'Վերափաթեթավորում (հաճախորդի փաթեթ)')}</div>
        <div class="calc-price">150 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>
    <div class="calc-group" id="cg-logistics">
      <div class="calc-row" data-price="2000">
        <div class="calc-label" data-ru="Доставка на склад WB (1 коробка 60х40х40)" data-am="Առաքում WB պահեստ (1 տուփ 60x40x40)">${t('Доставка на склад WB (1 коробка 60х40х40)', 'Առաքում WB պահեստ (1 տուփ 60x40x40)')}</div>
        <div class="calc-price">2 000 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Доставка до вашего склада (1 коробка 60х40х40)" data-am="Առաքում ձեր պահեստ (1 տուփ 60x40x40)">${t('Доставка до вашего склада (1 коробка 60х40х40)', 'Առաքում ձեր պահեստ (1 տուփ 60x40x40)')}</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>
    <div class="calc-group" id="cg-other">
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Глажка одежды (одиночная вещь)" data-am="Հագուստի արդուկում (մեկ իր)">${t('Глажка одежды (одиночная вещь)', 'Հագուստի արդուկում (մեկ իր)')}</div>
        <div class="calc-price">1 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Глажка одежды (верхняя одежда)" data-am="Հագուստի արդուկում (վերնահագուստ)">${t('Глажка одежды (верхняя одежда)', 'Հագուստի արդուկում (վերնահագուստ)')}</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Забор из ПВЗ для съёмки" data-am="Վերցնում ՊՎԶ-ից">${t('Забор из ПВЗ для съёмки', 'Վերցնում ՊՎԶ-ից')}</div>
        <div class="calc-price">1 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Возврат в ПВЗ после съёмки" data-am="Վերադարձ ՊՎԶ լուսանկարահանումից հետո">${t('Возврат в ПВЗ после съёмки', 'Վերադարձ ՊՎԶ լուսանկարահանումից հետո')}</div>
        <div class="calc-price">1 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>
    <div class="calc-total">
      <div class="calc-total-label" data-ru="Итого:" data-am="Ընդամենը:">${t('Итого:', 'Ընդամենը:')}</div>
      <div class="calc-total-value" id="calcTotal" data-total="0">0 ֏</div>
    </div>
    <div id="calcRefWrap" style="margin-top:16px;padding:16px;background:rgba(139,92,246,0.05);border:1px solid var(--border);border-radius:var(--r-sm)">
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <label style="display:block;font-size:0.82rem;font-weight:600;color:var(--accent-light);margin-bottom:6px"><i class="fas fa-gift" style="margin-right:6px"></i><span data-ru="Есть промокод?" data-am="Պրոմոկոդ ունեք?">${t('Есть промокод?', 'Պրոմոկոդ ունեք?')}</span></label>
          <input type="text" id="refCodeInput" placeholder="PROMO2026" style="width:100%;padding:10px 14px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.92rem;font-family:inherit;text-transform:uppercase;outline:none;transition:var(--t)" onfocus="this.style.borderColor='var(--purple)'" onblur="this.style.borderColor='var(--border)'">
        </div>
        <button onclick="checkRefCode()" class="btn btn-outline" style="padding:10px 20px;font-size:0.88rem;white-space:nowrap"><i class="fas fa-check-circle" style="margin-right:6px"></i><span data-ru="Применить" data-am="Կիրառել">${t('Применить', 'Կիրառել')}</span></button>
      </div>
      <div id="refResult" style="display:none;margin-top:10px;padding:10px 14px;border-radius:8px;font-size:0.88rem;font-weight:500"></div>
    </div>
    <div class="calc-cta" style="display:none">
      <a href="https://wa.me/37455226224" id="calcTgBtn" class="btn btn-primary btn-lg" target="_blank">
        <i class="fab fa-whatsapp"></i>
        <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">${t('Заказать сейчас', 'Պատվիրել հիմա')}</span>
      </a>
    </div>
  </div>
</div>
</section>

<!-- ===== CONTACT CTA (above footer) ===== -->
<section class="section nh-contact-cta" data-section-id="contact-cta" data-block-key="home__contact_cta">
<div class="container">
  <div class="nh-contact-card">
    <div class="nh-contact-text">
      <div class="section-badge"><i class="fas fa-phone-volume"></i> <span data-ru="Свяжитесь с нами" data-am="Կապ հաստատեք մեզ հետ" data-edit-key="home__contact_cta" data-edit-idx="0">${tb('home__contact_cta', 0, 'Свяжитесь с нами', 'Կապ հաստատեք մեզ հետ')}</span></div>
      <h2 data-ru="Готовы вывести ваш товар в ТОП?" data-am="Պատրա՞ստ եք ապրանքը հասցնել WB-ի TOP" data-edit-key="home__contact_cta" data-edit-idx="1">${tb('home__contact_cta', 1, 'Готовы вывести ваш товар в ТОП?', 'Պատրա՞ստ եք ապրանքը հասցնել WB-ի TOP')}</h2>
      <p data-ru="Напишите нам в WhatsApp или закажите обратный звонок — менеджер ответит на все вопросы, подберёт стратегию и пакет под ваш бюджет." data-am="Գրեք մեզ WhatsApp-ով կամ պատվիրեք հետադարձ զանգ — մենեջերը կպատասխանի բոլոր հարցերին, կընտրի ստրատեգիան և փաթեթը՝ ձեր բյուջեի համար։" data-edit-key="home__contact_cta" data-edit-idx="2">${tb('home__contact_cta', 2, 'Напишите нам в WhatsApp или закажите обратный звонок — менеджер ответит на все вопросы, подберёт стратегию и пакет под ваш бюджет.', 'Գրեք մեզ WhatsApp-ով կամ պատվիրեք հետադարձ զանգ — մենեջերը կպատասխանի բոլոր հարցերին, կընտրի ստրատեգիան և փաթեթը՝ ձեր բյուջեի համար։')}</p>
    </div>
    <div class="nh-contact-actions">
      <a href="https://wa.me/37455226224" target="_blank" rel="noopener" class="btn nh-btn-whatsapp btn-lg">
        <i class="fab fa-whatsapp"></i>
        <span data-ru="Написать в WhatsApp" data-am="Գրել WhatsApp-ով" data-edit-key="home__contact_cta" data-edit-idx="3">${tb('home__contact_cta', 3, 'Написать в WhatsApp', 'Գրել WhatsApp-ով')}</span>
      </a>
      <a href="javascript:void(0)" onclick="openCallbackModal()" class="btn btn-outline btn-lg">
        <i class="fas fa-phone"></i>
        <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք" data-edit-key="home__contact_cta" data-edit-idx="4">${tb('home__contact_cta', 4, 'Перезвоните мне', 'Հետ զանգահարեք')}</span>
      </a>
      <a href="/contacts" class="btn btn-outline btn-lg">
        <i class="fas fa-envelope-open-text"></i>
        <span data-ru="Все контакты" data-am="Բոլոր կոնտակտները" data-edit-key="home__contact_cta" data-edit-idx="5">${tb('home__contact_cta', 5, 'Все контакты', 'Բոլոր կոնտակտները')}</span>
      </a>
    </div>
  </div>
</div>
</section>

<!-- ===== INLINE BULLETPROOF COUNTER TRIGGER =====
     The shared landing.js bundle has an IntersectionObserver + setTimeout
     fallback for the counter animation, but historically this has been
     flaky on /home (cached JS, deferred load races, browser throttling).
     This inline script guarantees that within 800ms of HTML parse, every
     [data-count]/[data-count-s] element animates regardless of whether the
     external script bundle has finished loading or not. Idempotent: skips
     elements already marked with data-counter-done="1". -->
<script>
(function(){
  function animate(el, target, suffix){
    if (el.dataset.counterDone === '1') return;
    el.dataset.counterDone = '1';
    if (!target) { el.textContent = '0' + suffix; return; }
    var dur = 1800, start = performance.now();
    function step(now){
      var p = Math.min((now - start) / dur, 1);
      var v = Math.floor(target * (1 - Math.pow(1 - p, 3)));
      el.textContent = v.toLocaleString('ru-RU') + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString('ru-RU') + suffix;
    }
    requestAnimationFrame(step);
  }
  function fire(){
    document.querySelectorAll('.stat-num[data-count]').forEach(function(el){
      animate(el, parseInt(el.dataset.count) || 0, '');
    });
    document.querySelectorAll('.stat-big[data-count-s]').forEach(function(el){
      animate(el, parseInt(el.dataset.countS) || 0, (el.textContent||'').indexOf('+') !== -1 ? '+' : '');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(fire, 100); });
  } else {
    setTimeout(fire, 100);
  }
  setTimeout(fire, 800);
})();
</script>
`

  // CSS — pixel-1:1 copy from the legacy `app.get('/')` <style> block,
  // but pruned down to only the rules used by the 6 sections above. Hosted
  // here as `extraHead` so renderPageShell injects it into <head>; it does
  // NOT collide with the legacy landing's CSS because the legacy page is
  // served from a different route (`/`) by a different render function.
  const extraHead = `
<link rel="stylesheet" href="/static/css/page-newhome.css?v=${CACHE_VERSION}">`


  // SEO: BreadcrumbList for the new home (only one node — itself).
  const jsonLd = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: isAM ? 'Գլխավոր' : 'Главная', item: `${siteOrigin}/` }
    ]
  })}</script>`

  // Phase 5.1 — splice custom blocks (added via inline editor) into mainHtml.
  // Each block has `position_after` = data-block-key value; we insert the
  // block's HTML right after the matching </section> or </div>. If the
  // anchor isn't found (or empty), we append the block at the very end.
  let mainHtmlWithCustom = mainHtml
  for (const cb of customBlocks) {
    const cbHtml = renderCustomBlock(cb, lang)
    const anchor = (cb.position_after || '').trim()
    if (anchor) {
      // Find the closing tag of the section/div with that data-block-key
      const re = new RegExp(`(<(?:section|div)[^>]*data-block-key="${anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[\\s\\S]*?</(?:section|div)>)`, 'i')
      const m = mainHtmlWithCustom.match(re)
      if (m) {
        mainHtmlWithCustom = mainHtmlWithCustom.replace(m[0], m[0] + '\n' + cbHtml)
        continue
      }
    }
    mainHtmlWithCustom = mainHtmlWithCustom + '\n' + cbHtml
  }

  return renderPageShell({
    page: 'home-new',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'home-page',
    mainHtml: mainHtmlWithCustom,
    extraHead: extraHead + jsonLd,
  })
}

// =====================================================================
// renderCalculatorPage — dedicated /calculator subpage
// ---------------------------------------------------------------------
// Lifts the calc-wrap markup that lives on /services into its own page
// so the top-nav "Калькулятор" link can route to a self-contained URL
// instead of jumping the user to the Services tab. The calculator
// behaviour is identical: client-side JS in landing.js populates the
// `#calcPackages` container from `db.packages` and runs the tab/qty/
// total wiring against `db.tabs` + `db.services`. The route handler
// (registered below) injects `window.__SITE_DATA` into <head> exactly
// like the /services and /buyouts handlers do.
// =====================================================================
export function renderCalculatorPage(opts: { lang: 'ru' | 'am', siteOrigin: string, pageBlocks?: Record<string, SubpageBlock>, shellBlocks?: Record<string, SubpageBlock> }): string {
  const { lang, siteOrigin, pageBlocks, shellBlocks } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru
  // Phase 4 — CMS-aware text helper for /calculator. Reads from
  // pageBlocks (calculator__* family populated by the route handler) and
  // falls back to the hardcoded RU/AM defaults whenever the block is
  // missing, hidden (is_visible=0) or the index is empty.
  const tb = (blockKey: string, idx: number, fallbackRu: string, fallbackAm: string): string => {
    const block = pageBlocks?.[blockKey]
    if (!block || block.is_visible === 0) return isAM ? fallbackAm : fallbackRu
    const arr = isAM ? block.texts_am : block.texts_ru
    const v = arr?.[idx]
    return (typeof v === 'string' && v.trim()) ? v : (isAM ? fallbackAm : fallbackRu)
  }
  const tgUrl = 'https://t.me/goo_to_top'

  const seo = {
    title: t(
      'Калькулятор стоимости — Go to Top | Wildberries',
      'Արժեքի հաշվիչ — Go to Top | Wildberries'
    ),
    description: t(
      'Рассчитайте стоимость продвижения на Wildberries: выкупы, отзывы, фотосессии, фулфилмент. Готовые пакеты и индивидуальный расчёт.',
      'Հաշվեք Wildberries-ում առաջխաղացման արժեքը՝ գնումներ, կարծիքներ, լուսանկարահանումներ, ֆուլֆիլմենթ։ Պատրաստ փաթեթներ և անհատական հաշվարկ։'
    ),
  }

  const mainHtml = `
<!-- ===== HERO ===== -->
<section class="calc-hero">
  <div class="container">
    <div class="calc-hero-inner">
      <div class="section-badge"><i class="fas fa-calculator"></i> <span data-ru="Калькулятор" data-am="Հաշվիչ" data-edit-key="calculator__hero" data-edit-idx="0">${tb('calculator__hero', 0, 'Калькулятор', 'Հաշվիչ')}</span></div>
      <h1 class="calc-hero-title" data-ru="Рассчитайте стоимость продвижения" data-am="Հաշվեք առաջխաղացման արժեքը" data-edit-key="calculator__hero" data-edit-idx="1">${tb('calculator__hero', 1, 'Рассчитайте стоимость продвижения', 'Հաշվեք առաջխաղացման արժեքը')} ${tb('calculator__hero', 2, '', '')}</h1>
      <p class="calc-hero-sub" data-ru="Выберите готовый пакет или соберите индивидуальный набор услуг — выкупы, отзывы, фотосессии и фулфилмент. Цены без скрытых комиссий, оплата в Telegram." data-am="Ընտրեք պատրաստ փաթեթ կամ հավաքեք անհատական ծառայությունների խումբ՝ գնումներ, կարծիքներ, լուսանկարահանումներ և ֆուլֆիլմենթ։ Գները՝ առանց թաքնված միջնորդավճարների, վճարումը՝ Telegram-ով։" data-edit-key="calculator__hero" data-edit-idx="3">${tb('calculator__hero', 3, 'Выберите готовый пакет или соберите индивидуальный набор услуг — выкупы, отзывы, фотосессии и фулфилмент. Цены без скрытых комиссий, оплата в Telegram.', 'Ընտրեք պատրաստ փաթեթ կամ հավաքեք անհատական ծառայությունների խումբ՝ գնումներ, կարծիքներ, լուսանկարահանումներ և ֆուլֆիլմենթ։ Գները՝ առանց թաքնված միջնորդավճարների, վճարումը՝ Telegram-ով։')}</p>
      <div class="calc-hero-features">
        <div class="calc-hero-f"><i class="fas fa-bolt"></i><span data-ru="Мгновенный расчёт" data-am="Ակնթարթային հաշվարկ" data-edit-key="calculator__hero" data-edit-idx="4">${tb('calculator__hero', 4, 'Мгновенный расчёт', 'Ակնթարթային հաշվարկ')}</span></div>
        <div class="calc-hero-f"><i class="fas fa-tag"></i><span data-ru="Готовые пакеты со скидкой" data-am="Պատրաստ փաթեթներ զեղչով" data-edit-key="calculator__hero" data-edit-idx="5">${tb('calculator__hero', 5, 'Готовые пакеты со скидкой', 'Պատրաստ փաթեթներ զեղչով')}</span></div>
        <div class="calc-hero-f"><i class="fas fa-shield-alt"></i><span data-ru="Без скрытых комиссий" data-am="Առանց թաքնված միջնորդավճարների" data-edit-key="calculator__hero" data-edit-idx="6">${tb('calculator__hero', 6, 'Без скрытых комиссий', 'Առանց թաքնված միջնորդավճարների')}</span></div>
        <div class="calc-hero-f"><i class="fas fa-percent"></i><span data-ru="Промокод снижает сумму" data-am="Պրոմոկոդը նվազեցնում է գումարը" data-edit-key="calculator__hero" data-edit-idx="7">${tb('calculator__hero', 7, 'Промокод снижает сумму', 'Պրոմոկոդը նվազեցնում է գումարը')}</span></div>
      </div>
    </div>
  </div>
</section>

<!-- ===== CALCULATOR (full) ===== -->
<section class="section section-dark" id="calculator" data-section-id="calculator">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-box-open"></i> <span data-ru="Готовые пакеты + индивидуальный расчёт" data-am="Պատրաստ փաթեթներ + անհատական հաշվարկ" data-edit-key="calculator__packages_header" data-edit-idx="0">${tb('calculator__packages_header', 0, 'Готовые пакеты + индивидуальный расчёт', 'Պատրաստ փաթեթներ + անհատական հաշվարկ')}</span></div>
      <h2 class="section-title" data-ru="Выберите пакет или соберите свой" data-am="Ընտրեք փաթեթ կամ հավաքեք ձերը">${t('Выберите пакет или соберите свой', 'Ընտրեք փաթեթ կամ հավաքեք ձերը')}</h2>
      <p class="section-sub" data-ru="Сверху — три готовых пакета с фиксированной скидкой. Ниже — конструктор: выберите вкладку, отметьте нужное количество, итоговая сумма пересчитывается автоматически." data-am="Վերևում՝ երեք պատրաստ փաթեթ՝ ֆիքսված զեղչով։ Ներքևում՝ կոնստրուկտոր. ընտրեք ներդիր, նշեք քանակ, ընդհանուր գումարը հաշվարկվում է ինքնաբերաբար։" data-edit-key="calculator__packages_header" data-edit-idx="1">${tb('calculator__packages_header', 1, 'Сверху — три готовых пакета с фиксированной скидкой. Ниже — конструктор: выберите вкладку, отметьте нужное количество, итоговая сумма пересчитывается автоматически.', 'Վերևում՝ երեք պատրաստ փաթեթ՝ ֆիքսված զեղչով։ Ներքևում՝ կոնստրուկտոր. ընտրեք ներդիր, նշեք քանակ, ընդհանուր գումարը հաշվարկվում է ինքնաբերաբար։')}</p>
    </div>
    <div class="calc-wrap">
      <div class="calc-packages" id="calcPackages" style="display:none"></div>
      <div class="calc-tabs">
        <div class="calc-tab active" onclick="showCalcTab('buyouts',this)" data-ru="Выкупы" data-am="Գնումներ">${t('Выкупы', 'Գնումներ')}</div>
        <div class="calc-tab" onclick="showCalcTab('reviews',this)" data-ru="Отзывы" data-am="Կարծիքներ">${t('Отзывы', 'Կարծիքներ')}</div>
        <div class="calc-tab" onclick="showCalcTab('photo',this)" data-ru="Фотосъёмка" data-am="Լուսանկարահանում">${t('Фотосъёмка', 'Լուսանկարահանում')}</div>
        <div class="calc-tab" onclick="showCalcTab('ff',this)" data-ru="ФФ" data-am="Ֆուլֆիլմենթ">${t('ФФ', 'Ֆուլֆիլմենթ')}</div>
        <div class="calc-tab" onclick="showCalcTab('logistics',this)" data-ru="Логистика" data-am="Լոգիստիկա">${t('Логистика', 'Լոգիստիկա')}</div>
        <div class="calc-tab" onclick="showCalcTab('other',this)" data-ru="Прочие услуги" data-am="Այլ ծառայություններ">${t('Прочие услуги', 'Այլ ծառայություններ')}</div>
      </div>
      <!-- SSR fallback rows mirror the long-landing (`/`) calculator so the
           calc shows a complete service list even before window.__SITE_DATA
           loads. landing.js rebuilds these groups from the DB on first paint
           when calculator_services rows exist (currency-aware tier prices,
           extra services), so admin edits to services/packages still flow
           through. The hardcoded list below guarantees we never render an
           empty tab even if the API is slow / DB is empty. -->
      <div class="calc-group active" id="cg-buyouts">
        <div class="calc-row" data-price="buyout" id="buyoutRow">
          <div class="calc-label" data-ru="Выкуп + забор из ПВЗ" data-am="Գնում + ստացում ՊՎԶ-ից">${t('Выкуп + забор из ПВЗ', 'Գնում + ստացում ՊՎԶ-ից')}</div>
          <div class="calc-price" id="buyoutPriceLabel">2 000 ֏</div>
          <div class="calc-input"><button onclick="ccBuyout(-1)">−</button><input type="number" id="buyoutQty" value="0" min="0" max="999" onchange="onBuyoutInput()" oninput="onBuyoutInput()"><button onclick="ccBuyout(1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Выкуп КГТ + забор из ПВЗ" data-am="Ծանրաքաշ ապրանքի գնում + ստացում ՊՎԶ-ից">${t('Выкуп КГТ + забор из ПВЗ', 'Ծանրաքաշ ապրանքի գնում + ստացում ՊՎԶ-ից')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>
      <div class="calc-group" id="cg-reviews">
        <div class="calc-row" data-price="300">
          <div class="calc-label" data-ru="Оценка" data-am="Գնահատական">${t('Оценка', 'Գնահատական')}</div>
          <div class="calc-price">300 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="500">
          <div class="calc-label" data-ru="Оценка + отзыв" data-am="Գնահատական + կարծիք">${t('Оценка + отзыв', 'Գնահատական + կարծիք')}</div>
          <div class="calc-price">500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="500">
          <div class="calc-label" data-ru="Вопрос к товару" data-am="Հարց ապրանքի վերաբերյալ">${t('Вопрос к товару', 'Հարց ապրանքի վերաբերյալ')}</div>
          <div class="calc-price">500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="250">
          <div class="calc-label" data-ru="Написание текста отзыва" data-am="Կարծիքի տեքստի գրում">${t('Написание текста отзыва', 'Կարծիքի տեքստի գրում')}</div>
          <div class="calc-price">250 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="100">
          <div class="calc-label" data-ru="Подписка на бренд / страницу" data-am="Բրենդի / էջի բաժանորդագրություն">${t('Подписка на бренд / страницу', 'Բրենդի / էջի բաժանորդագրություն')}</div>
          <div class="calc-price">100 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>
      <div class="calc-group" id="cg-photo">
        <div class="calc-row" data-price="3500">
          <div class="calc-label" data-ru="Фотосессия в гардеробной WB (жен. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (կին մոդել)">${t('Фотосессия в гардеробной WB (жен. модель)', 'Լուսանկարահանում WB հագուստապահարանում (կին մոդել)')}</div>
          <div class="calc-price">3 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="4500">
          <div class="calc-label" data-ru="Фотосессия в гардеробной WB (муж. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (տղամարդ մոդել)">${t('Фотосессия в гардеробной WB (муж. модель)', 'Լուսանկարահանում WB հագուստապահարանում (տղամարդ մոդել)')}</div>
          <div class="calc-price">4 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Предметная фотосъёмка (3 фото)" data-am="Առարկայական լուսանկարահանում (3 լուսանկար)">${t('Предметная фотосъёмка (3 фото)', 'Առարկայական լուսանկարահանում (3 լուսանկար)')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="5000">
          <div class="calc-label" data-ru="Предметная съёмка (крупное / техника, 3 фото)" data-am="Առարկայական լուսանկարահանում (խոշոր / տեխնիկա, 3 լուս.)">${t('Предметная съёмка (крупное / техника, 3 фото)', 'Առարկայական լուսանկարահանում (խոշոր / տեխնիկա, 3 լուս.)')}</div>
          <div class="calc-price">5 000 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Ребёнок модель (до 14 лет)" data-am="Երեխա մոդել (մինչև 14 տարեկան)">${t('Ребёнок модель (до 14 лет)', 'Երեխա մոդել (մինչև 14 տարեկան)')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="7000">
          <div class="calc-label" data-ru="Видеообзор товара" data-am="Ապրանքի վիդեոհոլովակ">${t('Видеообзор товара', 'Ապրանքի վիդեոհոլովակ')}</div>
          <div class="calc-price">7 000 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>
      <div class="calc-group" id="cg-ff">
        <div class="calc-row" data-price="100">
          <div class="calc-label" data-ru="Замена штрихкода" data-am="Շտրիխկոդի փոխարինում">${t('Замена штрихкода', 'Շտրիխկոդի փոխարինում')}</div>
          <div class="calc-price">100 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="200">
          <div class="calc-label" data-ru="Переупаковка (наша)" data-am="Վերափաթեթավորում (մեր փաթեթ)">${t('Переупаковка (наша)', 'Վերափաթեթավորում (մեր փաթեթ)')}</div>
          <div class="calc-price">200 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="150">
          <div class="calc-label" data-ru="Переупаковка (клиента)" data-am="Վերափաթեթավորում (հաճախորդի փաթեթ)">${t('Переупаковка (клиента)', 'Վերափաթեթավորում (հաճախորդի փաթեթ)')}</div>
          <div class="calc-price">150 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>
      <div class="calc-group" id="cg-logistics">
        <div class="calc-row" data-price="2000">
          <div class="calc-label" data-ru="Доставка на склад WB (1 коробка 60х40х40)" data-am="Առաքում WB պահեստ (1 տուփ 60x40x40)">${t('Доставка на склад WB (1 коробка 60х40х40)', 'Առաքում WB պահեստ (1 տուփ 60x40x40)')}</div>
          <div class="calc-price">2 000 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Доставка до вашего склада (1 коробка 60х40х40)" data-am="Առաքում ձեր պահեստ (1 տուփ 60x40x40)">${t('Доставка до вашего склада (1 коробка 60х40х40)', 'Առաքում ձեր պահեստ (1 տուփ 60x40x40)')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>
      <div class="calc-group" id="cg-other">
        <div class="calc-row" data-price="1500">
          <div class="calc-label" data-ru="Глажка одежды (одиночная вещь)" data-am="Հագուստի արդուկում (մեկ իր)">${t('Глажка одежды (одиночная вещь)', 'Հագուստի արդուկում (մեկ իր)')}</div>
          <div class="calc-price">1 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="2500">
          <div class="calc-label" data-ru="Глажка одежды (верхняя одежда)" data-am="Հագուստի արդուկում (վերնահագուստ)">${t('Глажка одежды (верхняя одежда)', 'Հագուստի արդուկում (վերնահագուստ)')}</div>
          <div class="calc-price">2 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="1500">
          <div class="calc-label" data-ru="Забор из ПВЗ для съёмки" data-am="Վերցնում ՊՎԶ-ից">${t('Забор из ПВЗ для съёмки', 'Վերցնում ՊՎԶ-ից')}</div>
          <div class="calc-price">1 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
        <div class="calc-row" data-price="1500">
          <div class="calc-label" data-ru="Возврат в ПВЗ после съёмки" data-am="Վերադարձ ՊՎԶ լուսանկարահանումից հետո">${t('Возврат в ПВЗ после съёмки', 'Վերադարձ ՊՎԶ լուսանկարահանումից հետո')}</div>
          <div class="calc-price">1 500 ֏</div>
          <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
        </div>
      </div>
      <div class="calc-total">
        <div class="calc-total-label" data-ru="Итого:" data-am="Ընդամենը:">${t('Итого:', 'Ընդամենը:')}</div>
        <div class="calc-total-value" id="calcTotal" data-total="0">0 ֏</div>
      </div>
      <div id="calcRefWrap" style="margin-top:16px;padding:16px;background:rgba(139,92,246,0.05);border:1px solid var(--border);border-radius:var(--r-sm)">
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <label style="display:block;font-size:0.82rem;font-weight:600;color:var(--accent-light);margin-bottom:6px"><i class="fas fa-gift" style="margin-right:6px"></i><span data-ru="Есть промокод?" data-am="Պրոմոկոդ ունեք?">${t('Есть промокод?', 'Պրոմոկոդ ունեք?')}</span></label>
            <input type="text" id="refCodeInput" placeholder="PROMO2026" style="width:100%;padding:10px 14px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.92rem;font-family:inherit;text-transform:uppercase;outline:none;transition:var(--t)" onfocus="this.style.borderColor='var(--purple)'" onblur="this.style.borderColor='var(--border)'">
          </div>
          <button onclick="checkRefCode()" class="btn btn-outline" style="padding:10px 20px;font-size:0.88rem;white-space:nowrap"><i class="fas fa-check-circle" style="margin-right:6px"></i><span data-ru="Применить" data-am="Կիրառել">${t('Применить', 'Կիրառել')}</span></button>
        </div>
        <div id="refResult" style="display:none;margin-top:10px;padding:10px 14px;border-radius:8px;font-size:0.88rem;font-weight:500"></div>
      </div>
      <div class="calc-cta" style="display:none">
        <a href="https://wa.me/37455226224" id="calcTgBtn" class="btn btn-primary btn-lg" target="_blank">
          <i class="fab fa-whatsapp"></i>
          <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">${t('Заказать сейчас', 'Պատվիրել հիմա')}</span>
        </a>
      </div>
    </div>
  </div>
</section>

<!-- ===== HOW TO USE ===== -->
<section class="section calc-how">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-route"></i> <span data-ru="Как пользоваться" data-am="Ինչպես օգտվել" data-edit-key="calculator__how_to" data-edit-idx="0">${tb('calculator__how_to', 0, 'Как пользоваться', 'Ինչպես օգտվել')}</span></div>
      <h2 class="section-title" data-ru="3 шага до точной сметы" data-am="3 քայլ ճշգրիտ նախահաշվին" data-edit-key="calculator__how_to" data-edit-idx="1">${tb('calculator__how_to', 1, '3 шага до точной сметы', '3 քայլ ճշգրիտ նախահաշվին')}</h2>
    </div>
    <div class="calc-how-grid">
      <div class="calc-how-card">
        <div class="calc-how-num">1</div>
        <h4 data-ru="Выберите готовый пакет" data-am="Ընտրեք պատրաստ փաթեթ" data-edit-key="calculator__how_to" data-edit-idx="2">${tb('calculator__how_to', 2, 'Выберите готовый пакет', 'Ընտրեք պատրաստ փաթեթ')}</h4>
        <p data-ru="Базовый, Продвинутый или Максимальный — фиксированная скидка до −32%, состав сразу подгрузится в калькулятор." data-am="Բազային, Առաջադեմ կամ Մաքսիմալ՝ ֆիքսված զեղչ մինչև −32%, կազմը անմիջապես կբեռնվի հաշվիչում։" data-edit-key="calculator__how_to" data-edit-idx="3">${tb('calculator__how_to', 3, 'Базовый, Продвинутый или Максимальный — фиксированная скидка до −32%, состав сразу подгрузится в калькулятор.', 'Բազային, Առաջադեմ կամ Մաքսիմալ՝ ֆիքսված զեղչ մինչև −32%, կազմը անմիջապես կբեռնվի հաշվիչում։')}</p>
      </div>
      <div class="calc-how-card">
        <div class="calc-how-num">2</div>
        <h4 data-ru="Или соберите вручную" data-am="Կամ հավաքեք ձեռքով" data-edit-key="calculator__how_to" data-edit-idx="4">${tb('calculator__how_to', 4, 'Или соберите вручную', 'Կամ հավաքեք ձեռքով')}</h4>
        <p data-ru="Переключайте вкладки, добавляйте выкупы, отзывы, фотосессии, ФФ и логистику — итог пересчитывается мгновенно." data-am="Փոխարկեք ներդիրները, ավելացրեք գնումներ, կարծիքներ, լուսանկարահանումներ, ՖՖ և լոգիստիկա՝ ընդհանուրը հաշվարկվում է ակնթարթորեն։" data-edit-key="calculator__how_to" data-edit-idx="5">${tb('calculator__how_to', 5, 'Переключайте вкладки, добавляйте выкупы, отзывы, фотосессии, ФФ и логистику — итог пересчитывается мгновенно.', 'Փոխարկեք ներդիրները, ավելացրեք գնումներ, կարծիքներ, լուսանկարահանումներ, ՖՖ և լոգիստիկա՝ ընդհանուրը հաշվարկվում է ակնթարթորեն։')}</p>
      </div>
      <div class="calc-how-card">
        <div class="calc-how-num">3</div>
        <h4 data-ru="Введите промокод и оформите" data-am="Մուտքագրեք պրոմոկոդը և ձևակերպեք" data-edit-key="calculator__how_to" data-edit-idx="6">${tb('calculator__how_to', 6, 'Введите промокод и оформите', 'Մուտքագրեք պրոմոկոդը և ձևակերպեք')}</h4>
        <p data-ru="Если у вас есть промокод партнёра — введите в поле ниже и получите дополнительную скидку. Заказ оформляется в WhatsApp одной кнопкой." data-am="Եթե ունեք գործընկերոջ պրոմոկոդ՝ մուտքագրեք ստորև և ստացեք լրացուցիչ զեղչ։ Պատվերը ձևակերպվում է WhatsApp-ով՝ մեկ կոճակով։" data-edit-key="calculator__how_to" data-edit-idx="7">${tb('calculator__how_to', 7, 'Если у вас есть промокод партнёра — введите в поле ниже и получите дополнительную скидку. Заказ оформляется в WhatsApp одной кнопкой.', 'Եթե ունեք գործընկերոջ պրոմոկոդ՝ մուտքագրեք ստորև և ստացեք լրացուցիչ զեղչ։ Պատվերը ձևակերպվում է WhatsApp-ով՝ մեկ կոճակով։')}</p>
      </div>
    </div>
  </div>
</section>

<!-- ===== CTA STRIP ===== -->
<section class="svc-cta-strip">
  <div class="container">
    <div class="acs-card">
      <div class="acs-text">
        <h3 data-ru="Не хотите считать сами?" data-am="Չե՞ք ուզում ինքներդ հաշվել" data-edit-key="calculator__cta_strip" data-edit-idx="0">${tb('calculator__cta_strip', 0, 'Не хотите считать сами?', 'Չե՞ք ուզում ինքներդ հաշվել')}</h3>
        <p data-ru="Напишите менеджеру в Telegram или WhatsApp — мы подберём пакет под ваш бюджет и нишу." data-am="Գրեք մենեջերին Telegram-ով կամ WhatsApp-ով՝ մենք կընտրենք փաթեթ ձեր բյուջեի և նիշայի համար։" data-edit-key="calculator__cta_strip" data-edit-idx="1">${tb('calculator__cta_strip', 1, 'Напишите менеджеру в Telegram или WhatsApp — мы подберём пакет под ваш бюджет и нишу.', 'Գրեք մենեջերին Telegram-ով կամ WhatsApp-ով՝ մենք կընտրենք փաթեթ ձեր բյուջեի և նիշայի համար։')}</p>
      </div>
      <div class="acs-actions">
        <a href="https://wa.me/37455226224" target="_blank" rel="noopener" class="btn nh-btn-whatsapp">
          <i class="fab fa-whatsapp"></i>
          <span data-ru="WhatsApp" data-am="WhatsApp" data-edit-key="calculator__cta_strip" data-edit-idx="2">${tb('calculator__cta_strip', 2, 'WhatsApp', 'WhatsApp')}</span>
        </a>
        <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-tg">
          <i class="fab fa-telegram"></i>
          <span data-ru="Telegram" data-am="Telegram" data-edit-key="calculator__cta_strip" data-edit-idx="3">${tb('calculator__cta_strip', 3, 'Telegram', 'Telegram')}</span>
        </a>
        <button type="button" class="btn btn-outline" onclick="openCallbackModal()">
          <i class="fas fa-phone"></i>
          <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք" data-edit-key="calculator__cta_strip" data-edit-idx="4">${tb('calculator__cta_strip', 4, 'Перезвоните мне', 'Հետ զանգահարեք')}</span>
        </button>
      </div>
    </div>
  </div>
</section>
`

  // Page-only CSS — minimal subset of /services calc styles plus the
  // /calculator-specific hero & how-to-use grid.
  const extraHead = `
<link rel="stylesheet" href="/static/css/page-calculator.css?v=${CACHE_VERSION}">`

  return renderPageShell({
    page: 'calculator',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'calculator-page',
    mainHtml,
    extraHead,
    shellBlocks,
  })
}

/**
 * Build a `<script>` blob that pre-populates `window.__PHOTO_BLOCKS` and
 * `window.__FOOTER` from D1 so landing.js can render synchronously without
 * waiting on `/api/photo-blocks` and `/api/footer`. Eliminates the post-load
 * "old photo flashes, new photo replaces it" flicker the user was seeing.
 *
 * The query failures are swallowed — landing.js still has a fetch fallback
 * for both endpoints, so the page degrades gracefully.
 */
async function buildInlineDynamicScript(db: D1Database): Promise<string> {
  let photoBlocksJson = '[]';
  let footerJson = 'null';
  try {
    const [pbRes, footerRes] = await Promise.all([
      db.prepare('SELECT * FROM photo_blocks WHERE is_visible = 1 ORDER BY sort_order').all().catch(() => ({ results: [] })),
      db.prepare('SELECT * FROM footer_settings LIMIT 1').first().catch(() => null),
    ]);
    photoBlocksJson = JSON.stringify((pbRes.results || []) as any[]).replace(/<\//g, '<\\/');
    if (footerRes) footerJson = JSON.stringify(footerRes).replace(/<\//g, '<\\/');
  } catch { /* keep defaults; landing.js will fetch as fallback */ }
  return `<script>window.__PHOTO_BLOCKS=${photoBlocksJson};window.__FOOTER=${footerJson};</script>`;
}

/**
 * Apply persisted inline-editor overrides + stamp deterministic editor ids
 * on the rendered HTML BEFORE it leaves the worker.
 *
 * Why this matters (the "black flash" + "old text flicker" fix):
 *
 *   The inline visual editor saves overrides keyed by `<page>__txt_<n>` ids
 *   that are computed by counting [data-ru]/[data-am]/[data-edit-key]
 *   elements in DOM order. Historically those ids were assigned client-side
 *   by editor.js on DOMContentLoaded; editor.js then fetched the override
 *   map and replaced each element's text. Net effect for visitors: the
 *   original (pre-override) text was painted first, then JS swapped it in
 *   for the override — a visible flicker, especially on subpages where the
 *   override map had to be fetched async (no `__GTT_OVERRIDES` inline).
 *
 *   The previous mitigation was to hide `<body>` until JS finished its
 *   first pass (the `gtt-loading` class). That replaced the flicker with a
 *   blank/dark page that lasted up to 1500 ms — what the owner reported as
 *   the "black screen between pages".
 *
 *   Doing the same work here at SSR time means the HTML that arrives at
 *   the browser already contains the final, post-override text exactly as
 *   the visitor should see it — no hidden body, no flicker, no "old →
 *   new" race. The client-side override pass becomes a harmless no-op for
 *   non-admin visitors, and for admins it still drives the live editor.
 *
 * Algorithm (mirrors editor.js's `assignTextIds()` byte-for-byte):
 *
 *   1. Walk every `[data-ru], [data-am], [data-edit-key]` element via
 *      HTMLRewriter, in source order.
 *   2. If the element has both `data-edit-key` and `data-edit-idx`, derive
 *      its txt_id as `<page>__<key>__<idx>` (deterministic — survives
 *      content reorder). Otherwise consume the next sequential counter
 *      and emit `<page>__txt_<n>`.
 *   3. Stamp the resulting txt_id onto the element as `data-edit-text` so
 *      editor.js doesn't have to re-derive it client-side.
 *   4. If the override map has an entry for that txt_id: update the
 *      data-ru / data-am / href attributes AND replace the element's
 *      visible inner content with the new text.
 *   5. Walk every `<img>` element to assign `data-edit-img` (hash of src
 *      path) and apply src overrides (stored in the `href` column).
 *
 * Caveats handled by callers, not here:
 *   - DB unavailable → return original HTML unchanged. editor.js still has
 *     its `/api/text-overrides/<page>` fetch fallback so admins can edit.
 *   - Empty override map → we still stamp data-edit-text so the inline
 *     editor activates without a client-side counter pass on first load.
 *   - Elements with inline `<i class="fa-…">` siblings inside a data-ru
 *     wrapper: HTMLRewriter's `setInnerContent` removes the icon when an
 *     override applies. This matches `setTextPreserveIcons` behaviour for
 *     elements without icons, and the inline editor only surfaces a plain-
 *     text input for these elements anyway, so admins always save the
 *     icon-stripped value (the icon was never part of the saved text).
 */
async function applyTextOverridesSSR(
  html: string,
  page: string,
  lang: 'ru' | 'am',
  db: D1Database
): Promise<string> {
  let overrides: Record<string, { ru: string; am: string; href: string }> = {};
  try {
    // Fetch page-specific overrides AND shared shell overrides (page='shell') so
    // edits to floating buttons / nav CTA made on any page propagate everywhere.
    const rows = await db.prepare(
      'SELECT txt_id, text_ru, text_am, href FROM site_text_overrides WHERE page = ? OR page = ?'
    ).bind(page, 'shell').all();
    for (const r of (rows.results || []) as any[]) {
      overrides[r.txt_id as string] = {
        ru: (r.text_ru as string) || '',
        am: (r.text_am as string) || '',
        href: (r.href as string) || ''
      };
    }
  } catch {
    return html; // DB unavailable — bail gracefully, editor.js still works.
  }

  // Inline the override map into <head> so editor.js's
  // `applyOverridesFromServer` can use it synchronously without an extra
  // network round-trip. After Phase 5.1.5 the SSR text/img replacement
  // below already paints the final state on first byte, but inlining the
  // map gives editor.js (a) zero-fetch hot-path on every page (was only
  // home_legacy before) and (b) a deterministic safety net for the
  // <img> replace flow — if the SSR hash lookup ever misses (e.g. cached
  // packages page where the cover_url drifted after upload), the client
  // still has the override map ready to patch on first frame instead of
  // waiting for /api/text-overrides/<page> to return.
  if (Object.keys(overrides).length) {
    const safeMap = JSON.stringify(overrides).replace(/<\//g, '<\\/');
    html = html.replace(
      '</head>',
      `<script>window.__GTT_OVERRIDES=${safeMap}</script>\n</head>`
    );
  }

  // Mirrors editor.js's `_imgSrcKey` exactly so SSR-stamped data-edit-img
  // ids match what the inline editor would have generated client-side.
  const imgSrcKey = (src: string): string => {
    let s = (src || '').trim();
    s = s.replace(/^https?:\/\/[^/?#]+/i, '').split('#')[0].replace(/\?.*/, '');
    if (!s) return '_empty';
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    const hex = ('00000000' + ((h >>> 0).toString(16))).slice(-8);
    const slug = s.replace(/[\s]+/g, '_').replace(/[^a-zA-Z0-9._~-]/g, '_').replace(/^_+/, '').slice(-80);
    return slug ? hex + '_' + slug : hex;
  };

  let txtCounter = 0;
  const response = new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=utf-8' }
  });

  const rewritten = new HTMLRewriter()
    .on('[data-ru], [data-am], [data-edit-key]', {
      element(el) {
        if (el.getAttribute('data-edit-text')) return; // already stamped

        const editKey = el.getAttribute('data-edit-key');
        const editIdx = el.getAttribute('data-edit-idx');
        const dataRu = el.getAttribute('data-ru');
        const dataAm = el.getAttribute('data-am');

        let txtId: string;
        // shell__* elements are CMS-managed via `site_blocks` (tb()/navHrefForLang
        // render them with the latest CMS state). We stamp `data-edit-text` so the
        // inline editor can target them, but we deliberately SKIP applying
        // `site_text_overrides` to these elements — historically the override path
        // accumulated stale rows (e.g. `shell__nav__5` → `/faq?lang=am`) that
        // overwrote fresh CMS edits on every reload, causing nav-label edits to
        // silently revert. CMS save (PUT /site-blocks/:id) is the single source
        // of truth for shell labels + hrefs.
        const isShellCms = editKey !== null && editKey.startsWith('shell__');
        if (editKey !== null && editIdx !== null) {
          if (isShellCms) {
            txtId = `${editKey}__${editIdx}`;
          } else {
            txtId = `${page}__${editKey}__${editIdx}`;
          }
        } else if (dataRu !== null || dataAm !== null) {
          txtId = `${page}__txt_${txtCounter++}`;
        } else {
          return;
        }

        el.setAttribute('data-edit-text', txtId);

        // CMS-managed shell elements are never overridden by site_text_overrides.
        if (isShellCms) return;

        const ov = overrides[txtId];
        if (!ov) return;

        // Always update both languages so landing.js's switchLang() picks
        // up the latest text on subsequent in-page language toggles too.
        if (ov.ru) el.setAttribute('data-ru', ov.ru);
        if (ov.am) el.setAttribute('data-am', ov.am);
        if (ov.href) {
          if (el.tagName === 'a') {
            el.setAttribute('href', ov.href);
          } else {
            // Element is not <a> itself (e.g. inner <span> inside <a href>).
            // Store the href as data-pending-href so client JS can apply it to parent <a>.
            el.setAttribute('data-pending-href', ov.href);
          }
        }

        const newText = lang === 'am' ? (ov.am || ov.ru) : (ov.ru || ov.am);
        if (newText) el.setInnerContent(newText);
      }
    })
    .on('img', {
      element(el) {
        if (el.getAttribute('data-edit-img')) return;
        const src = el.getAttribute('src') || '';
        const txtId = `${page}__img_h_${imgSrcKey(src)}`;
        el.setAttribute('data-edit-img', txtId);
        const ov = overrides[txtId];
        if (ov?.href) el.setAttribute('src', ov.href);
      }
    })
    .transform(response);

  return await rewritten.text();
}


export function register(app: Hono<{ Bindings: Bindings }>) {
  // Canonical public site: multi-page shell at /home. Legacy single-page HTML
  // is preserved at /landing-archive (bookmark / internal text reference).
  app.get('/', async (c) => {
    const reqUrl = new URL(c.req.url);
    const urlLang = reqUrl.searchParams.get('lang') || '';
    const cookieLang = readLangCookie(c);
    const isAm = urlLang === 'am' || urlLang === 'hy' || (urlLang === '' && cookieLang === 'am');
    const dest = new URL('/home', reqUrl.origin);
    if (isAm) dest.searchParams.set('lang', 'am');
    dest.hash = reqUrl.hash;
    return c.redirect(dest.toString(), 302);
  });

app.get('/landing-archive', async (c) => {
  // Browser: always revalidate (max-age=0), Edge: 600s via Cache API wrapper (index.tsx).
  // must-revalidate prevents stale content from being served after the TTL expires.
  // Admin writes auto-purge the edge cache so changes appear immediately.
  c.header('Cache-Control', 'public, max-age=0, s-maxage=600, must-revalidate');
  c.header('Vary', 'Accept-Encoding, Cookie');
  
  // Start site-data fetch in parallel with SSR (will be awaited at the end)
  const siteDataPromise = (async () => {
    try {
      const req = new Request(new URL('/api/site-data', c.req.url).toString());
      const resp = await app.fetch(req, c.env);
      return resp.ok ? await resp.text() : null;
    } catch { return null; }
  })();
  
  // Derive origin from request so meta tags match the actual domain (gototop.win / gototopwb.ru)
  const reqUrl = new URL(c.req.url);
  const siteOrigin = reqUrl.origin; // e.g. https://gototop.win or https://gototopwb.ru

  // Detect language early for all SSR needs (nav, OG tags, etc.)
  const reqPath = reqUrl.pathname;
  const pathLang = reqPath === '/am' ? 'am' : (reqPath === '/ru' ? 'ru' : '');
  const urlLang = pathLang || new URL(c.req.url).searchParams.get('lang') || '';
  const acceptLang = (c.req.header('Accept-Language') || '').toLowerCase();
  // Default language is Russian; Armenian if URL says so OR the visitor previously
  // selected AM (cookie set by landing.js on language switch). The cookie path lets
  // navigation between subpages keep the chosen language without a flash of RU first.
  const cookieLang = readLangCookie(c);
  const isArmenian = urlLang === 'am' || urlLang === 'hy' || (urlLang === '' && cookieLang === 'am');
  
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
    
    // ===== PARALLEL DB QUERIES =====
    // Fire ALL independent queries at once instead of sequentially.
    // D1 round-trip is ~150-300ms; running 10+ queries in parallel
    // reduces total DB time from ~2.5s to ~300ms (single round-trip).
    const [
      contentRes,
      photoBlocksRes,
      buttonBlocksRes,
      styleBlocksRes,
      footerRowRes,
      footerBlockRes,
      popupRowRes,
      seoRowRes,
      soRes,
      bfRes,
      ssrPkgsRes,
      ssrPkgItemsRes,
      ssrSettingsRes,
    ] = await Promise.all([
      db.prepare('SELECT section_key, content_json FROM site_content ORDER BY sort_order').all(),
      db.prepare("SELECT block_key, photo_url, custom_html FROM site_blocks WHERE block_key IN ('hero','about','guarantee') AND is_visible = 1").all(),
      db.prepare("SELECT block_key, buttons FROM site_blocks WHERE is_visible = 1 AND buttons IS NOT NULL AND buttons != '[]'").all(),
      db.prepare("SELECT block_key, text_styles, texts_ru, custom_html FROM site_blocks WHERE is_visible = 1").all(),
      db.prepare('SELECT * FROM footer_settings LIMIT 1').first().catch(() => null),
      db.prepare("SELECT social_links, custom_html FROM site_blocks WHERE block_key = 'footer' AND is_visible = 1 LIMIT 1").first().catch(() => null),
      db.prepare("SELECT texts_ru, texts_am, buttons FROM site_blocks WHERE block_key = 'popup' AND is_visible = 1 LIMIT 1").first().catch(() => null),
      db.prepare("SELECT texts_ru, texts_am, photo_url, custom_html FROM site_blocks WHERE block_key = 'seo_og' AND is_visible = 1 LIMIT 1").first().catch(() => null),
      db.prepare('SELECT * FROM section_order ORDER BY sort_order').all(),
      db.prepare("SELECT block_key, texts_ru, texts_am, custom_html FROM site_blocks WHERE is_visible = 1 ORDER BY sort_order").all(),
      db.prepare('SELECT * FROM calculator_packages WHERE is_active = 1 ORDER BY sort_order, id').all().catch(() => ({ results: [] })),
      db.prepare('SELECT pi.*, cs.name_ru as service_name_ru, cs.name_am as service_name_am FROM calculator_package_items pi LEFT JOIN calculator_services cs ON pi.service_id = cs.id').all().catch(() => ({ results: [] })),
      db.prepare("SELECT key, value FROM site_settings WHERE key LIKE 'packages_%'").all().catch(() => ({ results: [] })),
    ]);

    // ===== Process content (textMap) =====
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
    
    // ===== Process photo blocks =====
    // Collect upload IDs to verify they exist (uploads may have been lost during DB migration)
    const uploadUrlsToCheck: Array<{key: string, url: string, uploadId: string}> = [];
    for (const blk of (photoBlocksRes.results || [])) {
      let url = blk.photo_url as string || '';
      if (!url) {
        try { const opts = JSON.parse(blk.custom_html as string || '{}'); url = opts.photo_url || ''; } catch {}
      }
      if (url) {
        const uploadMatch = url.match(/\/api\/admin\/uploads\/(\d+)/);
        if (uploadMatch) {
          uploadUrlsToCheck.push({ key: blk.block_key as string, url, uploadId: uploadMatch[1] });
        } else {
          photoMap[blk.block_key as string] = url;
        }
      }
    }
    // Verify upload URLs exist in DB before using them (skip broken refs)
    if (uploadUrlsToCheck.length > 0) {
      const ids = uploadUrlsToCheck.map(u => u.uploadId);
      try {
        const existing = await db.prepare(
          `SELECT id FROM uploads WHERE id IN (${ids.map(() => '?').join(',')})`
        ).bind(...ids).all();
        const existingIds = new Set((existing.results || []).map((r: any) => String(r.id)));
        for (const item of uploadUrlsToCheck) {
          if (existingIds.has(item.uploadId)) {
            photoMap[item.key] = item.url;
          }
          // If upload doesn't exist, skip — default static image will be used
        }
      } catch {
        // If uploads table doesn't exist or query fails, skip all upload URLs
      }
    }
    
    // ===== Process button blocks =====
    for (const blk of (buttonBlocksRes.results || [])) {
      try {
        const btns = JSON.parse(blk.buttons as string || '[]');
        if (btns.length > 0) {
          buttonMap[blk.block_key as string] = btns;
        }
      } catch { /* skip invalid JSON */ }
    }
    
    // ===== Process style blocks (text_styles, element_order, photo_settings) =====
    for (const blk of (styleBlocksRes.results || [])) {
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
    
    // ===== Footer settings =====
    if (footerRowRes) {
      (globalThis as any).__footerSettings = footerRowRes;
    }
    
    // ===== Footer block socials =====
    if (footerBlockRes) {
      let fSocials: any[] = [];
      try { fSocials = JSON.parse(footerBlockRes.social_links as string || '[]'); } catch {}
      let fOpts: any = {};
      try { fOpts = JSON.parse(footerBlockRes.custom_html as string || '{}'); } catch {}
      (globalThis as any).__footerBlockSocials = fSocials;
      (globalThis as any).__footerBlockSocialSettings = fOpts.social_settings || {};
    }

    // ===== Popup block =====
    if (popupRowRes) {
      (globalThis as any).__popupBlock = popupRowRes;
    }
    
    // ===== SEO/OG block =====
    if (seoRowRes) {
      // Fallback: if photo_url column is empty, try custom_html JSON
      if (!seoRowRes.photo_url && seoRowRes.custom_html) {
        try {
          const opts = JSON.parse(seoRowRes.custom_html as string);
          if (opts.photo_url) (seoRowRes as any).photo_url = opts.photo_url;
        } catch {}
      }
      (globalThis as any).__seoOgBlock = seoRowRes;
    }

    // ===== Section order =====
    (globalThis as any).__sectionOrder = soRes.results || [];
    
    // ===== Block features for nav links =====
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
        nav_links: opts.nav_links || [],
        contact_cards: opts.contact_cards || [],
        buttons: buttonMap[blk.block_key as string] || []
      });
    }
    (globalThis as any).__blockFeatures = bfArr;

    // ===== Calculator packages for SSR =====
    try {
      const ssrItemsByPkg: Record<number, any[]> = {};
      for (const it of (ssrPkgItemsRes.results || [])) { const pid = it.package_id as number; if (!ssrItemsByPkg[pid]) ssrItemsByPkg[pid] = []; ssrItemsByPkg[pid].push(it); }
      const ssrPkgList = (ssrPkgsRes.results || []).map((p: any) => ({ ...p, items: ssrItemsByPkg[p.id] || [] }));
      const ssrSettings: Record<string, string> = {};
      for (const r of (ssrSettingsRes.results || [])) { ssrSettings[r.key as string] = r.value as string; }
      (globalThis as any).__ssrPackages = ssrPkgList;
      (globalThis as any).__ssrPkgSettings = ssrSettings;
    } catch { (globalThis as any).__ssrPackages = []; }
  } catch (e) {
    // If DB fails, serve original HTML without modifications
  }
  
  let pageHtml = /* raw HTML template follows */`<!DOCTYPE html>
<html lang="${isArmenian ? 'hy' : 'ru'}" class="server-injected">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#0F0A1A">
<meta name="color-scheme" content="dark">
<title>Go to Top — Продвижение на Wildberries | Առաջխաղացում Wildberries-ում</title>
<link rel="preload" href="/static/img/founder.webp" as="image" fetchpriority="high">
<link rel="preload" href="/static/img/logo-gototop.webp" as="image" fetchpriority="high">
<link rel="preload" as="style" href="/static/css/shell-home.css?v=${CACHE_VERSION}">
<meta name="description" content="Go to Top — продвижение карточек на Wildberries под ключ: выкупы живыми людьми и продающий контент. Собственный склад в Ереване.">
<meta property="og:title" content="Go to Top — Առաջխաղացում Wildberries-ում">
<meta property="og:description" content="Выкупы живыми людьми, отзывы с реальными фото, собственный склад в Ереване. Более 1000 аккаунтов.">
<meta property="og:type" content="website">
<link rel="canonical" href="https://gototopwb.ru${isArmenian ? '/am' : ''}">
<meta property="og:url" content="https://gototopwb.ru${isArmenian ? '/am' : ''}">
<meta property="og:image" content="${siteOrigin}/static/img/og-image-dark.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Go to Top - логотип">
<meta property="og:site_name" content="Go to Top">
<meta property="og:locale" content="ru_RU">
<meta property="og:locale:alternate" content="hy_AM">
<link rel="alternate" hreflang="ru" href="${siteOrigin}/">
<link rel="alternate" hreflang="hy" href="${siteOrigin}/am">
<link rel="alternate" hreflang="x-default" href="${siteOrigin}/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Go to Top — Առաջխաղացում Wildberries-ում">
<meta name="twitter:description" content="Выкупы живыми людьми, отзывы с реальными фото, собственный склад в Ереване. Более 1000 аккаунтов.">
<meta name="twitter:image" content="${siteOrigin}/static/img/og-image-dark.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="icon" type="image/x-icon" href="/static/img/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/static/img/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/static/img/apple-touch-icon.png">
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"></noscript>
<link rel="preload" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css"></noscript>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/intl-tel-input@25/build/css/intlTelInput.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/intl-tel-input@25/build/js/intlTelInput.min.js"></script>
<script type="speculationrules">{"prefetch":[{"source":"document","eagerness":"moderate","where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":["/admin*","/api/*"]}}]}}]}</script>
<link rel="stylesheet" href="/static/css/shell-home.css?v=${CACHE_VERSION}">
</head>
<body>

<!-- ===== HEADER ===== -->
<header class="header" id="header">
<div class="container">
<nav class="nav">
  <a href="#" class="logo">
    <img src="/static/img/logo-gototop.webp" alt="Go to Top">
    <span class="logo-text">Go to Top</span>
  </a>
  <ul class="nav-links" id="navLinks">
    <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/home')}" data-ru="Главная" data-am="Գլխավոր" data-edit-key="shell__nav" data-edit-idx="0">${isArmenian ? 'Գլխավոր' : 'Главная'}</a></li>
    <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/about')}" data-ru="О нас" data-am="Մեր մասին" data-edit-key="shell__nav" data-edit-idx="1">${isArmenian ? 'Մեր մասին' : 'О нас'}</a></li>
    <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/services')}" data-ru="Услуги" data-am="Ծառայություններ" data-edit-key="shell__nav" data-edit-idx="2">${isArmenian ? 'Ծառայություններ' : 'Услуги'}</a></li>
    <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/buyouts')}" data-ru="Выкупы" data-am="Հետագնումներ" data-edit-key="shell__nav" data-edit-idx="3">${isArmenian ? 'Հետագնումներ' : 'Выкупы'}</a></li>
    <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/calculator')}" data-ru="Калькулятор" data-am="Հաշվիչ" data-edit-key="shell__nav" data-edit-idx="4">${isArmenian ? 'Հաշվիչ' : 'Калькулятор'}</a></li>
    <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/faq')}" data-ru="FAQ" data-am="ՀՏՀ" data-edit-key="shell__nav" data-edit-idx="5">${isArmenian ? 'ՀՏՀ' : 'FAQ'}</a></li>
    <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/contacts')}" data-ru="Контакты" data-am="Կոնտակտներ" data-edit-key="shell__nav" data-edit-idx="6">${isArmenian ? 'Կոնտակտներ' : 'Контакты'}</a></li>
    <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/referral')}">${isArmenian ? 'Պրոմոկոդներ' : 'Промокоды'}</a></li>
    <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/blog')}" data-ru="Блог" data-am="Բլոգ" data-edit-key="shell__nav" data-edit-idx="7">${isArmenian ? 'Բլոգ' : 'Блог'}</a></li>
    <li class="nav-mobile-lang">
      <div class="lang-switch">
        <button class="lang-btn${isArmenian ? '' : ' active'}" data-lang="ru" onclick="switchLang('ru')"><span class="lang-flag"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect width="36" height="8" fill="#fff"/><rect y="8" width="36" height="8" fill="#0039A6"/><rect y="16" width="36" height="8" fill="#D52B1E"/></svg></span><span class="lang-text">RU</span></button>
        <button class="lang-btn${isArmenian ? ' active' : ''}" data-lang="am" onclick="switchLang('am')"><span class="lang-flag"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect width="36" height="8" fill="#D90012"/><rect y="8" width="36" height="8" fill="#0033A0"/><rect y="16" width="36" height="8" fill="#F2A800"/></svg></span><span class="lang-text">AM</span></button>
      </div>
    </li>
    <li class="nav-mobile-cta"><a href="javascript:void(0)" onclick="openCallbackModal()" class="btn btn-primary"><i class="fas fa-phone"></i> <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք" data-edit-key="shell__nav" data-edit-idx="8">${isArmenian ? 'Հետ զանգահարեք' : 'Перезвоните мне'}</span></a></li>
  </ul>
  <div class="nav-right">
    <div class="lang-switch">
      <button class="lang-btn${isArmenian ? '' : ' active'}" data-lang="ru" onclick="switchLang('ru')"><span class="lang-flag"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect width="36" height="8" fill="#fff"/><rect y="8" width="36" height="8" fill="#0039A6"/><rect y="16" width="36" height="8" fill="#D52B1E"/></svg></span><span class="lang-text">RU</span></button>
      <button class="lang-btn${isArmenian ? ' active' : ''}" data-lang="am" onclick="switchLang('am')"><span class="lang-flag"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect width="36" height="8" fill="#D90012"/><rect y="8" width="36" height="8" fill="#0033A0"/><rect y="16" width="36" height="8" fill="#F2A800"/></svg></span><span class="lang-text">AM</span></button>
    </div>
    <a href="javascript:void(0)" onclick="openCallbackModal()" class="nav-cta">
      <i class="fas fa-phone"></i>
      <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք">${isArmenian ? 'Հետ զանգահարեք' : 'Перезвоните мне'}</span>
    </a>
  </div>
  <button class="hamburger" id="hamburger" onclick="toggleMenu()">
    <span></span><span></span><span></span>
  </button>
</nav>
</div>
</header>

<!-- ===== HERO ===== -->
<section class="hero" id="hero" data-section-id="hero" data-block-key="home__hero">
<div class="container">
<div class="hero-grid">
  <div class="hero-el-title">
    <div class="hero-badge">
      <i class="fas fa-circle" style="color:var(--success);font-size:0.5rem"></i>
      <span data-ru="Успешный опыт с 2021 года" data-am="Հաջողված փորձ 2021 թվականից">${isArmenian ? 'Հաջողված փորձ 2021 թվականից' : 'Успешный опыт с 2021 года'}</span>
    </div>
    <h1>
      <span data-ru="Выведем ваш товар" data-am="Մենք կբարձրացնենք ձեր ապրանքը">${isArmenian ? 'Մենք կբարձրացնենք ձեր ապրանքը' : 'Выведем ваш товар'}</span><br>
      <span class="gr" data-ru="в ТОП Wildberries" data-am="Wildberries-ի TOP">${isArmenian ? 'Wildberries-ի TOP' : 'в ТОП Wildberries'}</span>
    </h1>
  </div>
  <div class="hero-el-texts">
    <p class="hero-desc" data-ru="Самовыкупы с аккаунтов реальных пользователей по вашим ключевым словам. С нами ваши товары становятся ТОПами продаж на Wildberries. Собственный склад и более 1000 реальных аккаунтов в Ереване." data-am="Իրական մարդկանց հաշիվներից ինքնագնումներ ձեր ցանկալի բանալի բառով: Մեզ հետ ձեր ապրանքները դառնում են Wildberries-ի TOP-ում վաճառվողներ: Սեփական պահեստ և ավելի քան 1000 իրական հաշիվ Երևանում:">
      Самовыкупы с аккаунтов реальных пользователей по вашим ключевым словам. С нами ваши товары становятся ТОПами продаж на Wildberries. Собственный склад и более 1000 реальных аккаунтов в Ереване.
    </p>
  </div>
  <div class="hero-el-stats">
    <div class="hero-stats">
      <div class="stat"><div class="stat-num" data-count="847">0</div><div class="stat-label" data-ru="товаров в ТОП" data-am="ապրանքներ TOP-ում">${isArmenian ? 'ապրանքներ TOP-ում' : 'товаров в ТОП'}</div></div>
      <div class="stat"><div class="stat-num" data-count="0">0</div><div class="stat-label" data-ru="блокировок" data-am="արգելափակում">${isArmenian ? 'արգելափակում' : 'блокировок'}</div></div>
      <div class="stat"><div class="stat-num" data-count="1000">0</div><div class="stat-label" data-ru="аккаунтов" data-am="հաշիվներ">${isArmenian ? 'հաշիվներ' : 'аккаунтов'}</div></div>
    </div>
  </div>
  <div class="hero-el-buttons">
    <div class="hero-buttons">
      <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary btn-lg">
        <i class="fab fa-telegram"></i>
        <span data-ru="Написать в Telegram" data-am="Գրել Telegram-ով">${isArmenian ? 'Գրել Telegram-ով' : 'Написать в Telegram'}</span>
      </a>
      <a href="#calculator" class="btn btn-outline btn-lg">
        <i class="fas fa-calculator"></i>
        <span data-ru="Рассчитать стоимость" data-am="Հաշվել արժեքը">${isArmenian ? 'Հաշվել արժեքը' : 'Рассчитать стоимость'}</span>
      </a>
    </div>
  </div>
  <div class="hero-image">
    <div class="hero-photo-wrap">
      <img src="/static/img/founder.webp" alt="Go to Top" loading="eager" fetchpriority="high" decoding="async">
      <div class="hero-badge-img">
        <i class="fas fa-shield-alt"></i>
        <span data-ru="Надежный метод продвижения" data-am="Ապահով առաջխաղացման մեթոդ">${isArmenian ? 'Ապահով առաջխաղացման մեթոդ' : 'Надежный метод продвижения'}</span>
      </div>
    </div>
    <div class="qr-codes-grid">
      <div class="qr-item">
        <a href="https://www.instagram.com/goo_to_top/" target="_blank" rel="noopener" class="qr-card">
          <img src="/static/img/qr/qr-instagram.webp" alt="Instagram QR">
        </a>
        <span data-ru="Instagram" data-am="Instagram">Instagram</span>
      </div>
      <div class="qr-item">
        <a href="https://t.me/goo_to_top" target="_blank" rel="noopener" class="qr-card">
          <img src="/static/img/qr/qr-telegram.webp" alt="Telegram QR">
        </a>
        <span data-ru="Telegram" data-am="Telegram">Telegram</span>
      </div>
      <div class="qr-item">
        <a href="https://www.facebook.com/gototop.wb" target="_blank" rel="noopener" class="qr-card">
          <img src="/static/img/qr/qr-facebook.webp" alt="Facebook QR">
        </a>
        <span data-ru="Facebook" data-am="Facebook">Facebook</span>
      </div>
      <div class="qr-item">
        <a href="https://wa.me/37455226224" target="_blank" rel="noopener" class="qr-card">
          <img src="/static/img/qr/qr-whatsapp.webp" alt="WhatsApp QR">
        </a>
        <span data-ru="WhatsApp" data-am="WhatsApp">WhatsApp</span>
      </div>
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
<div class="wb-banner fade-up" data-section-id="wb-banner" data-block-key="home__wb_banner">
<div class="container">
<div class="wb-banner-inner">
  <div class="wb-banner-card">
    <i class="fas fa-gavel wb-icon"></i>
    <div class="wb-text" data-ru="WB официально отменил штрафы за выкупы!" data-am="WB-ն պաշտոնապես վերացրել է տուգանքները ինքնագնումների համար!">${isArmenian ? 'WB-ն պաշտոնապես վերացրել է տուգանքները ինքնագնումների համար!' : 'WB официально отменил штрафы за выкупы!'}</div>
  </div>
  <div class="wb-banner-right">
    <span class="wb-r-icon">🚀</span>
    <div class="wb-r-text" data-ru="Повысь рейтинг магазина прямо сейчас" data-am="Բարձրացրեք խանութի վարկանիշը հիմա">${isArmenian ? 'Բարձրացրեք խանութի վարկանիշը հիմա' : 'Повысь рейтинг магазина прямо сейчас'}</div>
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><span data-ru="Узнать" data-am="Իմանալ">${isArmenian ? 'Իմանալ' : 'Узнать'}</span></a>
  </div>
</div>
</div>
</div>

<!-- ===== STATS BAR ===== -->
<div class="stats-bar fade-up" data-section-id="stats-bar" data-block-key="home__stats_bar">
<div class="container">
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-big" data-count-s="500">0</div>
      <div class="stat-desc" data-ru="поставщиков сотрудничают с нами" data-am="մատակարար համագործակցում է մեզ հետ">${isArmenian ? 'մատակարար համագործակցում է մեզ հետ' : 'поставщиков сотрудничают с нами'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-big" data-count-s="1000">0+</div>
      <div class="stat-desc" data-ru="аккаунтов с индивидуальной картой" data-am="հաշիվներ անհատական քարտով">${isArmenian ? 'հաշիվներ անհատական քարտով' : 'аккаунтов с индивидуальной картой'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-big" data-count-s="21">0</div>
      <div class="stat-desc" data-ru="день до выхода в ТОП" data-am="ապրանք TOP-ում օրական">${isArmenian ? 'ապրանք TOP-ում օրական' : 'день до выхода в ТОП'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-big" data-count-s="200">0+</div>
      <div class="stat-desc" data-ru="выкупов каждый день" data-am="գնում ամեն օր">${isArmenian ? 'գնում ամեն օր' : 'выкупов каждый день'}</div>
    </div>
  </div>
</div>
</div>



<!-- ===== SECTIONS PREVIEW (Phase 3B) ===== -->
<!-- 6 cards = entry points to every subpage. Replaces the legacy 3-card grid
     so every subpage gets a prominent visible link from the home page. -->
<section class="section svc-cards-section" id="svc-cards" data-section-id="svc-cards">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-th-large"></i> <span data-ru="Разделы сайта" data-am="Կայքի բաժիններ">${isArmenian ? 'Կայքի բաժիններ' : 'Разделы сайта'}</span></div>
    <h2 class="section-title" data-ru="Что мы делаем для вашего роста" data-am="Ինչ ենք անում ձեր աճի համար">${isArmenian ? 'Ինչ ենք անում ձեր աճի համար' : 'Что мы делаем для вашего роста'}</h2>
    <p class="section-sub" data-ru="6 разделов с подробной информацией — выберите тему, которая вам важна" data-am="6 բաժին մանրամասն տեղեկություններով — ընտրեք ձեզ համար կարևոր թեման">${isArmenian ? '6 բաժին մանրամասն տեղեկություններով — ընտրեք ձեզ համար կարևոր թեման' : '6 разделов с подробной информацией — выберите тему, которая вам важна'}</p>
  </div>
  <div class="svc-quick-grid fade-up">
    <a href="/services" class="svc-quick-card svc-card-icon">
      <div class="svc-card-icon-wrap"><i class="fas fa-hand-holding-usd"></i></div>
      <div class="svc-quick-body">
        <h3 data-ru="Услуги и цены" data-am="Ծառայություններ և գներ">${isArmenian ? 'Ծառայություններ և գներ' : 'Услуги и цены'}</h3>
        <p data-ru="Выкупы, отзывы с фото, фотосессии, фулфилмент. Калькулятор стоимости и пакеты под ваш товар." data-am="Հետագնումներ, լուսանկարներով կարծիքներ, լուսանկարահանումներ, ֆուլֆիլմենթ։ Կալկուլյատոր և փաթեթներ ձեր ապրանքի համար։">${isArmenian ? 'Հետագնումներ, լուսանկարներով կարծիքներ, լուսանկարահանումներ, ֆուլֆիլմենթ։ Կալկուլյատոր և փաթեթներ ձեր ապրանքի համար։' : 'Выкупы, отзывы с фото, фотосессии, фулфилмент. Калькулятор стоимости и пакеты под ваш товар.'}</p>
        <span class="svc-quick-cta" data-ru="Перейти →" data-am="Անցնել →">${isArmenian ? 'Անցնել →' : 'Перейти →'}</span>
      </div>
    </a>
    <a href="/buyouts" class="svc-quick-card svc-card-icon">
      <div class="svc-card-icon-wrap"><i class="fas fa-shopping-cart"></i></div>
      <div class="svc-quick-body">
        <h3 data-ru="Выкупы на Wildberries" data-am="Հետգնում Wildberries-ում">${isArmenian ? 'Հետգնում Wildberries-ում' : 'Выкупы на Wildberries'}</h3>
        <p data-ru="Как реальные выкупы по ключам поднимают карточки в ТОП. Бюджет, гарантии, честное сравнение методов." data-am="Ինչպես իրական հետագնումները բարձրացնում են քարտերը TOP-ում։ Բյուջե, երաշխիքներ, մեթոդների ազնիվ համեմատություն։">${isArmenian ? 'Ինչպես իրական հետագնումները բարձրացնում են քարտերը TOP-ում։ Բյուջե, երաշխիքներ, մեթոդների ազնիվ համեմատություն։' : 'Как реальные выкупы по ключам поднимают карточки в ТОП. Бюджет, гарантии, честное сравнение методов.'}</p>
        <span class="svc-quick-cta" data-ru="Перейти →" data-am="Անցնել →">${isArmenian ? 'Անցնել →' : 'Перейти →'}</span>
      </div>
    </a>
    <a href="/about" class="svc-quick-card svc-card-icon">
      <div class="svc-card-icon-wrap"><i class="fas fa-info-circle"></i></div>
      <div class="svc-quick-body">
        <h3 data-ru="О нас" data-am="Մեր մասին">${isArmenian ? 'Մեր մասին' : 'О нас'}</h3>
        <p data-ru="Команда Go to Top, собственный склад в Ереване, 1000+ аккаунтов, опыт Wildberries с 2021 года." data-am="Go to Top թիմը, սեփական պահեստ Երևանում, 1000+ հաշիվ, Wildberries-ի փորձ 2021 թվականից։">${isArmenian ? 'Go to Top թիմը, սեփական պահեստ Երևանում, 1000+ հաշիվ, Wildberries-ի փորձ 2021 թվականից։' : 'Команда Go to Top, собственный склад в Ереване, 1000+ аккаунтов, опыт Wildberries с 2021 года.'}</p>
        <span class="svc-quick-cta" data-ru="Перейти →" data-am="Անցնել →">${isArmenian ? 'Անցնել →' : 'Перейти →'}</span>
      </div>
    </a>
    <a href="/faq" class="svc-quick-card svc-card-icon">
      <div class="svc-card-icon-wrap"><i class="fas fa-question-circle"></i></div>
      <div class="svc-quick-body">
        <h3 data-ru="Частые вопросы" data-am="Հաճախ տրվող հարցեր">${isArmenian ? 'Հաճախ տրվող հարցեր' : 'Частые вопросы'}</h3>
        <p data-ru="12 ответов про оплату, гарантии, сроки, риски блокировки и работу с маркетплейсом изнутри." data-am="12 պատասխան վճարման, երաշխիքների, ժամկետների և մարքեթփլեյսի հետ աշխատանքի մասին։">${isArmenian ? '12 պատասխան վճարման, երաշխիքների, ժամկետների և մարքեթփլեյսի հետ աշխատանքի մասին։' : '12 ответов про оплату, гарантии, сроки, риски блокировки и работу с маркетплейсом изнутри.'}</p>
        <span class="svc-quick-cta" data-ru="Перейти →" data-am="Անցնել →">${isArmenian ? 'Անցնել →' : 'Перейти →'}</span>
      </div>
    </a>
    <a href="/contacts" class="svc-quick-card svc-card-icon">
      <div class="svc-card-icon-wrap"><i class="fas fa-envelope"></i></div>
      <div class="svc-quick-body">
        <h3 data-ru="Контакты" data-am="Կոնտակտներ">${isArmenian ? 'Կոնտակտներ' : 'Контакты'}</h3>
        <p data-ru="Telegram, WhatsApp, форма обратной связи. Адрес офиса в Ереване и часы работы — на связи 7 дней." data-am="Telegram, WhatsApp, հետադարձ կապի ձև։ Երևանի գրասենյակի հասցեն — հասանելի ենք 7 օր։">${isArmenian ? 'Telegram, WhatsApp, հետադարձ կապի ձև։ Երևանի գրասենյակի հասցեն — հասանելի ենք 7 օր։' : 'Telegram, WhatsApp, форма обратной связи. Адрес офиса в Ереване и часы работы — на связи 7 дней.'}</p>
        <span class="svc-quick-cta" data-ru="Перейти →" data-am="Անցնել →">${isArmenian ? 'Անցնել →' : 'Перейти →'}</span>
      </div>
    </a>
    <a href="/referral" class="svc-quick-card svc-card-icon">
      <div class="svc-card-icon-wrap"><i class="fas fa-gift"></i></div>
      <div class="svc-quick-body">
        <h3 data-ru="Партнёрская программа" data-am="Գործընկերային ծրագիր">${isArmenian ? 'Գործընկերային ծրագիր' : 'Партнёрская программа'}</h3>
        <p data-ru="Бонусы 5/8/15% за приведённых клиентов. Промокоды, выплаты, условия — всё прозрачно." data-am="Բոնուսներ 5/8/15% հրավիրված հաճախորդների համար։ Պրոմոկոդեր, վճարումներ, պայմաններ։">${isArmenian ? 'Բոնուսներ 5/8/15% հրավիրված հաճախորդների համար։ Պրոմոկոդեր, վճարումներ, պայմաններ։' : 'Бонусы 5/8/15% за приведённых клиентов. Промокоды, выплаты, условия — всё прозрачно.'}</p>
        <span class="svc-quick-cta" data-ru="Перейти →" data-am="Անցնել →">${isArmenian ? 'Անցնել →' : 'Перейти →'}</span>
      </div>
    </a>
  </div>
</div>
</section>

<!-- ===== ABOUT ===== -->
<section class="section" id="about" data-section-id="about">
<div class="container">
  <div class="about-grid fade-up">
    <div class="about-img">
      <img src="/static/img/about-hero2.webp" alt="Go to Top — О компании">
    </div>
    <div class="about-el-title">
      <div class="section-badge"><i class="fas fa-info-circle"></i> <span data-ru="О компании" data-am="Ընկերության մասին">${isArmenian ? 'Ընկերության մասին' : 'О компании'}</span></div>
      <h2 data-ru="Что такое" data-am="Ի՞նչ է Go to Top-ը">Что такое <span class="gr">Go to Top</span>?</h2>
    </div>
    <div class="about-el-texts">
      <p style="color:var(--text-sec);font-size:1rem;line-height:1.8;margin-bottom:20px" data-ru="«Go to Top» — сервис развития Вашего бизнеса на маркетплейсах с помощью комплексного продвижения и услуги выкупов по ключевым словам. Для долгосрочного закрепления товара в TOPе." data-am="«Go to Top» — ձեր բիզնեսի զարգացման ծառայություն մարքեթփլեյսներում՝ համալիր առաջխաղացման և բանալի բառերով գնումների միջոցով։ Ապրանքի երկարատև ամրապնդման համար TOP-ում։">${isArmenian ? '«Go to Top» — ձեր բիզնեսի զարգացման ծառայություն մարքեթփլեյսներում՝ համալիր առաջխաղացման և բանալի բառերով գնումների միջոցով։ Ապրանքի երկարատև ամրապնդման համար TOP-ում։' : '«Go to Top» — сервис развития Вашего бизнеса на маркетплейсах с помощью комплексного продвижения и услуги выкупов по ключевым словам. Для долгосрочного закрепления товара в TOPе.'}</p>
      <div style="background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.18);border-radius:14px;padding:20px 22px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
          <i class="fas fa-star" style="color:var(--purple);font-size:1rem"></i>
          <strong style="font-size:0.95rem;color:var(--text)" data-ru="Наши сильные стороны" data-am="Մեր ուժեղ կողմերը">${isArmenian ? 'Մեր ուժեղ կողմերը' : 'Наши сильные стороны'}</strong>
        </div>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-check-circle" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Собственный склад и офис в Ереване" data-am="Սեփական պահեստ և գրասենյակ Երևանում">${isArmenian ? 'Սեփական պահեստ և գրասենյակ Երևանում' : 'Собственный склад и офис в Ереване'}</span></li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-check-circle" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="1000+ реальных аккаунтов, 0 блокировок" data-am="1000+ իրական հաշիվ, 0 արգելափակում">${isArmenian ? '1000+ իրական հաշիվ, 0 արգելափակում' : '1000+ реальных аккаунтов, 0 блокировок'}</span></li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-check-circle" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Работаем с 2021 года — 847 товаров в ТОП" data-am="Աշխատում ենք 2021-ից — 847 ապրանք TOP-ում">${isArmenian ? 'Աշխատում ենք 2021-ից — 847 ապրանք TOP-ում' : 'Работаем с 2021 года — 847 товаров в ТОП'}</span></li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-check-circle" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Всё вручную, только по ключевым словам" data-am="Ամեն ինչ ձեռքով, միայն բանալի բառերով">${isArmenian ? 'Ամեն ինչ ձեռքով, միայն բանալի բառերով' : 'Всё вручную, только по ключевым словам'}</span></li>
        </ul>
      </div>
      <div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);border-radius:14px;padding:20px 22px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
          <i class="fas fa-gift" style="color:#10B981;font-size:1rem"></i>
          <strong style="font-size:0.95rem;color:var(--text)" data-ru="Что получает клиент" data-am="Ինչ է ստանում հաճախորդը">${isArmenian ? 'Ինչ է ստանում հաճախորդը' : 'Что получает клиент'}</strong>
        </div>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-chart-line" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Рост рейтинга товара на Wildberries" data-am="Ապրանքի վարկանիշի աճ Wildberries-ում">${isArmenian ? 'Ապրանքի վարկանիշի աճ Wildberries-ում' : 'Рост рейтинга товара на Wildberries'}</span></li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-chart-line" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Органический трафик и долгосрочный ТОП" data-am="Օրգանական տրաֆիկ և երկարատև TOP">${isArmenian ? 'Օրգանական տրաֆիկ և երկարատև TOP' : 'Органический трафик и долгосрочный ТОП'}</span></li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-chart-line" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Реальные отзывы с фото и видео" data-am="Իրական կարծիքներ լուսանկարներով և տեսանյութերով">${isArmenian ? 'Իրական կարծիքներ լուսանկարներով և տեսանյութերով' : 'Реальные отзывы с фото и видео'}</span></li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-chart-line" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Индивидуальный подход, без блокировок" data-am="Անհատական մոտեցում, առանց արգելափակումների">${isArmenian ? 'Անհատական մոտեցում, առանց արգելափակումների' : 'Индивидуальный подход, без блокировок'}</span></li>
        </ul>
      </div>
      <div class="about-highlight">
        <p data-ru="Наилучший результат Вы получите, воспользовавшись комплексом наших услуг!" data-am="Լավագույնի առդյունք կստանաք, ոգտվալեով մեռ ծառայություննեռի համալիռ փակետով!"><i class="fas fa-bolt" style="margin-right:8px"></i>${isArmenian ? 'Լավագույնի առդյունք կստանաք, ոգտվալեով մեռ ծառայություննեռի համալիռ փակետով!' : 'Наилучший результат Вы получите, воспользовавшись комплексом наших услуг!'}</p>
      </div>
    </div>
    <div class="about-el-buttons">
      <div class="section-cta">
        <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><i class="fas fa-shopping-cart"></i> <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">${isArmenian ? 'Պատվիրել հիմա' : 'Заказать сейчас'}</span></a>
      </div>
    </div>
  </div>
</div>
</section>

<!-- ===== SERVICES ===== -->
<section class="section" id="services" data-section-id="services" data-block-key="home__services">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-rocket"></i> <span data-ru="Наши услуги" data-am="Մեր ծառայությունները">${isArmenian ? 'Մեր ծառայությունները' : 'Наши услуги'}</span></div>
    <h2 class="section-title" data-ru="Полный спектр продвижения на WB" data-am="WB-ում առաջխաղացման լիարժեք սպեկտր">${isArmenian ? 'WB-ում առաջխաղացման լիարժեք սպեկտր' : 'Полный спектр продвижения на WB'}</h2>
    <p class="section-sub" data-ru="Выкупы живыми людьми, отзывы с реальными фото, профессиональные фотосессии — всё для вашего товара" data-am="Գնումներ իրական մարդկանցով, կարծիքներ իրական լուսանկարներով, մասնագիտական լուսանկարահանումներ — ամենը ձեր ապրանքի համար">${isArmenian ? 'Գնումներ իրական մարդկանցով, կարծիքներ իրական լուսանկարներով, մասնագիտական լուսանկարահանումներ — ամենը ձեր ապրանքի համար' : 'Выкупы живыми людьми, отзывы с реальными фото, профессиональные фотосессии — всё для вашего товара'}</p>
  </div>
  <div class="services-grid">
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-shopping-cart"></i></div>
      <h3 data-ru="Выкупы по ключевым запросам" data-am="Գնումներ բանալի հարցումներով">${isArmenian ? 'Գնումներ բանալի հարցումներով' : 'Выкупы по ключевым запросам'}</h3>
      <p data-ru="Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану." data-am="Ձեր ապրանքը գնվում է իրական մարդկանցով։ Իրական հաշիվներից տարբեր ՊՎԶ-ներով ամբողջ Երևանում:">${isArmenian ? 'Ձեր ապրանքը գնվում է իրական մարդկանցով։ Իրական հաշիվներից տարբեր ՊՎԶ-ներով ամբողջ Երևանում:' : 'Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану.'}</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Реальные аккаунты с историей покупок" data-am="Իրական հաշիվներ գնումների պատմությամբ">${isArmenian ? 'Իրական հաշիվներ գնումների պատմությամբ' : 'Реальные аккаунты с историей покупок'}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Географическое распределение" data-am="Աշխարհագրական բաշխում">${isArmenian ? 'Աշխարհագրական բաշխում' : 'Географическое распределение'}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Естественное поведение покупателей" data-am="Գնորդների բնական վարքագիծ">${isArmenian ? 'Գնորդների բնական վարքագիծ' : 'Естественное поведение покупателей'}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Забор товара из ПВЗ" data-am="Ապրանքի ստացում ՊՎԶ-ից">${isArmenian ? 'Ապրանքի ստացում ՊՎԶ-ից' : 'Забор товара из ПВЗ'}</span></li>
      </ul>
      <div style="margin-top:20px;text-align:center"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-tg" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-rocket"></i> <span data-ru="Повысить рейтинг" data-am="Բարձրացնել վարկանիշը">${isArmenian ? 'Բարձրացնել վարկանիշը' : 'Повысить рейтинг'}</span></a></div>
    </div>
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-star"></i></div>
      <h3 data-ru="Отзывы и оценки" data-am="Կարծիքներ և գնահատականներ">${isArmenian ? 'Կարծիքներ և գնահատականներ' : 'Отзывы и оценки'}</h3>
      <p data-ru="Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга." data-am="Մանրամասն կարծիքներ լուսանկարներով և տեսանյութով իրական հաշիվներից վարկանիշի բարձրացման համար:">${isArmenian ? 'Մանրամասն կարծիքներ լուսանկարներով և տեսանյութով իրական հաշիվներից վարկանիշի բարձրացման համար:' : 'Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга.'}</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Текст отзыва + фото/видео" data-am="Կարծիքի տեքստ + լուսանկար/տեսանյութ">${isArmenian ? 'Կարծիքի տեքստ + լուսանկար/տեսանյութ' : 'Текст отзыва + фото/видео'}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Профессиональная фотосессия" data-am="Մասնագիտական լուսանկարահանում">${isArmenian ? 'Մասնագիտական լուսանկարահանում' : 'Профессиональная фотосессия'}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Разные локации и модели" data-am="Տարբեր վայրեր և մոդելներ">${isArmenian ? 'Տարբեր վայրեր և մոդելներ' : 'Разные локации и модели'}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="До 50% отзывов от выкупов" data-am="Մինչև 50% կարծիքներ գնումներից">${isArmenian ? 'Մինչև 50% կարծիքներ գնումներից' : 'До 50% отзывов от выкупов'}</span></li>
      </ul>
      <div style="margin-top:20px;text-align:center"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-rocket"></i> <span data-ru="Начать продвижение" data-am="Սկսել առաջխաղացումը">${isArmenian ? 'Սկսել առաջխաղացումը' : 'Начать продвижение'}</span></a></div>
    </div>
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-key"></i></div>
      <h3 data-ru="Активация ключевых слов" data-am="Բանալի բառերի ակտիվացում">${isArmenian ? 'Բանալի բառերի ակտիվացում' : 'Активация ключевых слов'}</h3>
      <p data-ru="Есть ключевое слово, по которому хотите показываться, но алгоритмы не связывают его с вашей карточкой? Мы знаем решение — делаем целевые выкупы, которые активируют товар в нужном кластере." data-am="Ունե՞ք բանալի բառ, որով ցանկանում եք, որ ձեր ապրանքը ցուցադրվի, բայց ալգորիթմները չեն կապում այն ձեր քարտին։ Մենք գիտենք լուծումը՝ կատարվում ենք նպատակային գնումներ, որոնք ակտիվացնում են ապրանքը ճիշտ կլաստերում։">${isArmenian ? 'Ունե՞ք բանալի բառ, որով ցանկանում եք, որ ձեր ապրանքը ցուցադրվի, բայց ալգորիթմները չեն կապում այն ձեր քարտին։ Մենք գիտենք լուծումը՝ կատարվում ենք նպատակային գնումներ, որոնք ակտիվացնում են ապրանքը ճիշտ կլաստերում։' : 'Есть ключевое слово, по которому хотите показываться, но алгоритмы не связывают его с вашей карточкой? Мы знаем решение — делаем целевые выкупы, которые активируют товар в нужном кластере.'}</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Органический трафик — резкий рост" data-am="Օրգանիկ տրաֆիկի կտրուկ աճ">${isArmenian ? 'Օրգանիկ տրաֆիկի կտրուկ աճ' : 'Органический трафик — резкий рост'}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Укрепление позиций новыми ключевыми словами" data-am="Դիրքերի ամրապնդում նոր բանալի բառերով">${isArmenian ? 'Դիրքերի ամրապնդում նոր բանալի բառերով' : 'Укрепление позиций новыми ключевыми словами'}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Подключение к целевым и прибыльным запросам" data-am="Միացում թիրախային և եկամտաբեր հարցումներին">${isArmenian ? 'Միացում թիրախային և եկամտաբեր հարցումներին' : 'Подключение к целевым и прибыльным запросам'}</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Стабильные позиции без рекламы" data-am="Կայուն դիրքեր առանց գովազդի">${isArmenian ? 'Կայուն դիրքեր առանց գովազդի' : 'Стабильные позиции без рекламы'}</span></li>
      </ul>
      <div style="margin-top:20px;text-align:center"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-key"></i> <span data-ru="Активировать ключевые" data-am="Ակտիվացնել բանալիները">${isArmenian ? 'Ակտիվացնել բանալիները' : 'Активировать ключевые'}</span></a></div>
    </div>
  </div>
</div>
</section>


<!-- ===== BUYOUT DETAIL ===== -->
<section class="section" data-section-id="buyout-detail">
<div class="container">
  <div class="buyout-detail fade-up">
    <div class="buyout-detail-header">
      <div class="section-badge"><i class="fas fa-shopping-bag"></i> <span data-ru="Услуга выкупа" data-am="Գնումի ծառայություն">${isArmenian ? 'Գնումի ծառայություն' : 'Услуга выкупа'}</span></div>
      <h2 data-ru="Что включает в себя услуга выкупа" data-am="Ինչ է ներառում գնումի ծառայությունը">Что включает в себя <span class="gr">услуга выкупа</span></h2>
      <p data-ru="Индивидуальный подход к каждому клиенту. Выкупы только по ключевым запросам, каждый заказ оформляет реальный человек вручную." data-am="Անհատական մոտեցում յուրաքանչյուր հաճախորդի համար: Գնումներ միայն բանալի հարցումներով, յուրաքանչյուր պատվերը կատարում է իրական մարդ ձեռքով:">${isArmenian ? 'Անհատական մոտեցում յուրաքանչյուր հաճախորդի համար: Գնումներ միայն բանալի հարցումներով, յուրաքանչյուր պատվերը կատարում է իրական մարդ ձեռքով:' : 'Индивидуальный подход к каждому клиенту. Выкупы только по ключевым запросам, каждый заказ оформляет реальный человек вручную.'}</p>
    </div>
    <div class="buyout-grid">
      <div class="buyout-card">
        <h4 data-ru="Полное сопровождение" data-am="Լիարժեք ուղեկցում">${isArmenian ? 'Լիարժեք ուղեկցում' : 'Полное сопровождение'}</h4>
        <ul>
          <li data-ru="Консультация" data-am="Խորհրդատվություն">${isArmenian ? 'Խորհրդատվություն' : 'Консультация'}</li>
          <li data-ru="Создание чата с менеджером" data-am="Մենեջերի հետ չատի ստեղծում">${isArmenian ? 'Մենեջերի հետ չատի ստեղծում' : 'Создание чата с менеджером'}</li>
          <li data-ru="Согласование плана выкупов" data-am="Գնումների պլանի համաձայնեցում">${isArmenian ? 'Գնումների պլանի համաձայնեցում' : 'Согласование плана выкупов'}</li>
          <li data-ru="Выкупы по ключевым запросам" data-am="Գնումներ բանալի հարցումներով">${isArmenian ? 'Գնումներ բանալի հարցումներով' : 'Выкупы по ключевым запросам'}</li>
          <li data-ru="Забор товара из ПВЗ курьерами" data-am="Ապրանքի ստացում ՊՎԶ-ից մեր առաքիչների օգնությամբ">${isArmenian ? 'Ապրանքի ստացում ՊՎԶ-ից մեր առաքիչների օգնությամբ' : 'Забор товара из ПВЗ курьерами'}</li>
          <li data-ru="Возврат на склады маркетплейсов" data-am="Վերադարձ մարկետփլեյսների պահեստներ">${isArmenian ? 'Վերադարձ մարկետփլեյսների պահեստներ' : 'Возврат на склады маркетплейсов'}</li>
          <li data-ru="Публикация отзывов" data-am="Կարծիքների հրապարակում">${isArmenian ? 'Կարծիքների հրապարակում' : 'Публикация отзывов'}</li>
        </ul>
      </div>
      <div class="buyout-card">
        <h4 data-ru="Отчётность" data-am="Հաշվետվություն">${isArmenian ? 'Հաշվետվություն' : 'Отчётность'}</h4>
        <p data-ru="Формирование итоговой отчётности по каждому выкупу. Полная прозрачность на каждом этапе." data-am="Վերջնական հաշվետվության ձևավորում յուրաքանչյուր գնումի համար: Լիարժեք թափանցիկություն յուրաքանչյուր փուլում:">${isArmenian ? 'Վերջնական հաշվետվության ձևավորում յուրաքանչյուր գնումի համար: Լիարժեք թափանցիկություն յուրաքանչյուր փուլում:' : 'Формирование итоговой отчётности по каждому выкупу. Полная прозрачность на каждом этапе.'}</p>
        <div style="margin-top:16px;text-align:center"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-warning" style="font-size:0.82rem;padding:9px 18px"><i class="fas fa-fire"></i> <span data-ru="Начать выкупы сейчас" data-am="Սկսել գնումները">${isArmenian ? 'Սկսել գնումները' : 'Начать выкупы сейчас'}</span></a></div>
      </div>
      <div class="buyout-card">
        <h4 data-ru="Контроль" data-am="Վերահսկողություն">${isArmenian ? 'Վերահսկողություն' : 'Контроль'}</h4>
        <p data-ru="Сопровождение и контроль на всех этапах. Точное следование алгоритму для безопасности вашего кабинета." data-am="Ուղեկցում և վերահսկողություն բոլոր փուլերում: Ալգորիթմի ճիշտ հետևողականություն ձեր հաշվի անվտանգության համար:">${isArmenian ? 'Ուղեկցում և վերահսկողություն բոլոր փուլերում: Ալգորիթմի ճիշտ հետևողականություն ձեր հաշվի անվտանգության համար:' : 'Сопровождение и контроль на всех этапах. Точное следование алгоритму для безопасности вашего кабинета.'}</p>
        <div style="margin-top:16px;text-align:center"><a href="https://t.me/suport_admin_2" target="_blank" class="btn btn-tg" style="font-size:0.82rem;padding:9px 18px"><i class="fab fa-telegram"></i> <span data-ru="Получить индивидуальный расчёт" data-am="Ստանալ ինդիվիդուալ հաշվարկ">${isArmenian ? 'Ստանալ ինդիվիդուալ հաշվարկ' : 'Получить индивидуальный расчёт'}</span></a></div>
      </div>
    </div>
  </div>
</div>
</section>


<!-- ===== WHY BUYOUTS BY KEYWORDS ===== -->
<section class="section" id="why-buyouts" data-section-id="why-buyouts" data-block-key="home__why_buyouts">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-chart-line"></i> <span data-ru="Почему это работает" data-am="Ինչու է սա աշխատում.">${isArmenian ? 'Ինչու է սա աշխատում.' : 'Почему это работает'}</span></div>
    <h2 class="section-title" data-ru="Почему выкупы по ключевым запросам — самый эффективный способ продвижения" data-am="Ինչու է գնումները բանալի բառերով — ամենա արդյունավետը">Почему выкупы по ключевым запросам — <span class="gr">самый эффективный способ</span> продвижения</h2>
  </div>

  <div class="why-block fade-up">
    <h3><i class="fas fa-funnel-dollar"></i> <span data-ru="Мы не просто покупаем ваш товар — мы прокачиваем всю воронку" data-am="Մենք ոչ միայն գնում ենք — մենք բարձրացնում ենք բոլոր քայլերի կոնվերսիաները">${isArmenian ? 'Մենք ոչ միայն գնում ենք — մենք բարձրացնում ենք բոլոր քայլերի կոնվերսիաները' : 'Мы не просто покупаем ваш товар — мы прокачиваем всю воронку'}</span></h3>
    <p data-ru="Каждый выкуп по ключевому запросу — это полноценное продвижение вашей карточки. Наши люди делают всё так, как это делает реальный покупатель. Вот что происходит при каждом выкупе:" data-am="Յուրաքանչյուր գնում բանալի բառով — լիարժեք առաջխաղացման մեթոդ.">${isArmenian ? 'Յուրաքանչյուր գնում բանալի բառով — լիարժեք առաջխաղացման մեթոդ.' : 'Каждый выкуп по ключевому запросу — это полноценное продвижение вашей карточки. Наши люди делают всё так, как это делает реальный покупатель. Вот что происходит при каждом выкупе:'}</p>
    
    <div class="why-steps">
      <div class="why-step"><div class="why-step-num">1</div><div><h4 data-ru="Поиск по ключевому запросу" data-am="Վորոնում բանալի բառով">${isArmenian ? 'Վորոնում բանալի բառով' : 'Поиск по ключевому запросу'}</h4><p data-ru="Находим ваш товар именно так, как ищет реальный покупатель — через поисковую строку WB" data-am="Գտնում ենք ձեր ապրանքը։">Находим ваш товар именно так, как ищет реальный покупатель — через поисковую строку WB</p></div></div>
      <div class="why-step"><div class="why-step-num">2</div><div><h4 data-ru="Просмотр карточки" data-am="Քարտի դիտարկում">${isArmenian ? 'Քարտի դիտարկում' : 'Просмотр карточки'}</h4><p data-ru="Полностью просматриваем фото и видео, листаем описание — повышаем конверсию из просмотра в переход" data-am="Դիտարկվում ենք բոլոր լուսանկարները և հոլովակը։">Полностью просматриваем фото и видео, листаем описание — повышаем конверсию из просмотра в переход</p></div></div>
      <div class="why-step"><div class="why-step-num">3</div><div><h4 data-ru="Работа с отзывами" data-am="Աշխատանք կարծիքների հետ">${isArmenian ? 'Աշխատանք կարծիքների հետ' : 'Работа с отзывами'}</h4><p data-ru="Пролистываем отзывы, лайкаем положительные — это улучшает ранжирование лучших отзывов" data-am="Թերթում ենք կարծիքների բաժինը, լայքում ենք լավ կարծիքները">Пролистываем отзывы, лайкаем положительные — это улучшает ранжирование лучших отзывов</p></div></div>
      <div class="why-step"><div class="why-step-num">4</div><div><h4 data-ru="Добавление конкурентов" data-am="Մրցակիցների ավելացում">${isArmenian ? 'Մրցակիցների ավելացում' : 'Добавление конкурентов'}</h4><p data-ru="Добавляем в корзину товары конкурентов вместе с вашим — имитируем реальное поведение покупателя" data-am="Ավելացնում ենք մրցակիցներին զամբյուղ, մարդկային վարքագծի համար">Добавляем в корзину товары конкурентов вместе с вашим — имитируем реальное поведение покупателя</p></div></div>
      <div class="why-step"><div class="why-step-num">5</div><div><h4 data-ru="Удаление конкурентов из корзины" data-am="Մրցակիցների հեռացում զամբյուղից">${isArmenian ? 'Մրցակիցների հեռացում զամբյուղից' : 'Удаление конкурентов из корзины'}</h4><p data-ru="В момент заказа удаляем конкурентов и оставляем только ваш товар — WB видит, что выбирают именно вас" data-am="Պատվիրելու պահին, մենք հեռացնում ենք մրցակիցներին և թողնում միայն ձեր ապրանքը։ WB-ն տեսնում է, որ մարդիկ ընտրում են ձեզ։">В момент заказа удаляем конкурентов и оставляем только ваш товар — WB видит, что выбирают именно вас</p></div></div>
      <div class="why-step"><div class="why-step-num">6</div><div><h4 data-ru="Заказ и получение" data-am="Պատվեր և ստացում">${isArmenian ? 'Պատվեր և ստացում' : 'Заказ и получение'}</h4><p data-ru="Оформляем заказ, забираем из ПВЗ, оставляем отзыв — полный цикл реального покупателя" data-am="Պատվիրում ենք ապրանքը, վերցնում ենք այն ստացման կետից և թողնում ենք կարծիք՝ իրական հաճախորդի ամբողջական ճանապարհ">Оформляем заказ, забираем из ПВЗ, оставляем отзыв — полный цикл реального покупателя</p></div></div>
    </div>

    <div class="highlight-result" data-ru="В результате повышаются ВСЕ конверсии вашей карточки: CTR, переходы, добавления в корзину, заказы. Карточка закрепляется в ТОПе и начинает получать органический трафик. Чем выше позиция — тем больше органических продаж без дополнительных вложений." data-am="Արդյունքում, ձեր քարտի ԲՈԼՈՐ փոխակերպումները մեծանում են՝ CTR, զամբյուղում ավելացումներ և պատվերներ: Ձեր քարտը դառնում է որոնման ամենաբարձր վարկանիշ ունեցող արդյունք և սկսում է ստանալ օրգանական տրաֆիկ: Որքան բարձր է վարկանիշը, այնքան շատ օրգանական վաճառքներ դուք կապահովեք առանց որևէ լրացուցիչ ներդրման:"><i class="fas fa-bolt"></i> <strong>Результат:</strong> повышаются <strong>ВСЕ конверсии</strong> вашей карточки: CTR, переходы, добавления в корзину, заказы. Карточка закрепляется в ТОПе и начинает получать <strong>органический трафик</strong>. Чем выше позиция — тем больше органических продаж без дополнительных вложений.</div>
  </div>

  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-warning"><i class="fas fa-fire"></i> <span data-ru="Начать выкупы" data-am="Սկսել գնումները">${isArmenian ? 'Սկսել գնումները' : 'Начать выкупы'}</span></a>
  </div>
</div>
</section>


<!-- ===== 50K: BLOGGER VS BUYOUTS ===== -->
<section class="section" id="fifty-vs-fifty" data-section-id="fifty-vs-fifty">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-balance-scale-right"></i> <span data-ru="Сравнение бюджетов" data-am="Բյուջեների համեմատություն">${isArmenian ? 'Բյուջեների համեմատություն' : 'Сравнение бюджетов'}</span></div>
    <h2 class="section-title" data-ru="11 000 ₽ на блогера vs 11 000 ₽ на выкупы" data-am="50 000 ֏ բլոգեր vs 50 000 ֏ ինքնագնումներ">${isArmenian ? '50 000 ֏ բլոգեր vs 50 000 ֏ ինքնագնումներ' : '11 000 ₽ на блогера vs 11 000 ₽ на выкупы'}</h2>
  </div>

<div class="why-block fade-up">
    <h3><i class="fas fa-balance-scale-right"></i> <span data-ru="11 000 ₽ на блогера vs 11 000 ₽ на выкупы — что эффективнее?" data-am="50 000 ֏ բլոգեր vs 50 000 ֏ ինքնագնումներ — որն է ավելի արդյունավետ?">${isArmenian ? '50 000 ֏ բլոգեր vs 50 000 ֏ ինքնագնումներ — որն է ավելի արդյունավետ?' : '11 000 ₽ на блогера vs 11 000 ₽ на выкупы — что эффективнее?'}</span></h3>
    <div class="compare-box">
      <div class="compare-side bad">
        <h4><i class="fas fa-dice"></i> <span data-ru="Reels у блогера" data-am="Reels բլոգերի մոտ">${isArmenian ? 'Reels բլոգերի մոտ' : 'Reels у блогера'}</span></h4>
        <div class="price-tag" data-ru="11 000 ₽" data-am="50 000 ֏">${isArmenian ? '50 000 ֏' : '11 000 ₽'}</div>
        <p data-ru="1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это всегда риск без гарантий результата. Нету просмотров на Reels соответственно нету продаж на товары. Блогер не ключ к продажам. Инвестируйте в рекламу с умом!" data-am="Բլոգերի 1 տեսանյութը ռիսկ է։ Անկախ նրանից՝ այն կհավագի դիտումներ, թե ոչ՝ ոչ ոք չգիտի։ Եթե ոչ, գումարը կորած է։ Դա միշտ ռիսկ է՝ առանց երաշխավորված արդյունքի։ Չկան դիտումներ չկան նաև վաճառքներ։ Բլոգերը դա վաճառքի բանալի չէ։ Ներդրեք գումարը գովազդի մեջ մտածված։">1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это <strong>всегда риск</strong> без гарантий результата. Нету просмотров на Reels — соответственно нету продаж на товары. Блогер не ключ к продажам. <strong>Инвестируйте в рекламу с умом!</strong></p>
      </div>
      <div class="compare-side good">
        <h4><i class="fas fa-chart-line"></i> <span data-ru="25 выкупов по ключевым" data-am="25 ինքնագնում բանալի բառով">${isArmenian ? '25 ինքնագնում բանալի բառով' : '25 выкупов по ключевым'}</span></h4>
        <div class="price-tag" data-ru="11 000 ₽" data-am="50 000 ֏">${isArmenian ? '50 000 ֏' : '11 000 ₽'}</div>
        <p data-ru="25 выкупов по целевому запросу — это 100% проверенный способ продвижения. Ваш товар быстро поднимается в ТОП выдачи зависимо от изначальных позиций, закрепляется там и начинает привлекать органический трафик. Больше продаж. Больше гарантированной выручки." data-am="25 ինքնագնում բանալի բառով 100% ապացուցված առաջխաղացման մեթոդ է: Ձեր ապրանքը արագորեն բարձրանում է որոնման արդյունքների առաջատար դիրքեր, հաստատվում է և սկսում է գրացել օրգանիգ դիտումներ: Շատ դիտում ավելի շատ վաճառք: Երաշխավորված ավելի շատ եկամուտ: ">25 выкупов по целевому запросу — это <strong>100% проверенный способ</strong> продвижения. Ваш товар быстро поднимается в ТОП выдачи зависимо от изначальных позиций, закрепляется там и начинает привлекать <strong>органический трафик</strong>. Больше продаж. Больше гарантированной выручки.</p>
      </div>
    </div>
    <div class="highlight-result" data-ru="Факт: при выкупах по 1 ключевому запросу уже от 25 штук товар быстро продвигается в ТОП и закрепляется там надолго — за счёт улучшения всех поведенческих метрик. А органический трафик WB становится вашим основным источником продаж." data-am="25 հատ ինքնագնման դեպքոմ կախված ապրանքի սկզբնական դիրքից ապրանքն արագ առաջ է շարժվում դեպի վերև և այնտեղ դիրքավորվում է երկար ժամանակով՝ բոլոր վարքագծային չափորոշիչների բարելավման հաշվին։ Իսկ WB-ի օրգանիկ անվճար տրաֆիկը դառնում է ձեր վաճառքի հիմնական աղբյուրը:"><i class="fas fa-lightbulb"></i> <strong>Факт:</strong> при выкупах по 1 ключевому запросу уже от <strong>25 штук</strong> товар быстро продвигается в ТОП и закрепляется там надолго — за счёт улучшения всех поведенческих метрик. А органический трафик WB становится вашим основным источником продаж.</div>
  </div>

  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-warning"><i class="fas fa-fire"></i> <span data-ru="Начать выкупы по ключевикам" data-am="Սկսել գնումները բանալի բառերով">${isArmenian ? 'Սկսել գնումները բանալի բառերով' : 'Начать выкупы по ключевикам'}</span></a>
  </div>
</div>
</section>


<!-- ===== WB OFFICIAL ===== -->
<section class="section section-dark" id="wb-official" data-section-id="wb-official">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-gavel"></i> <span data-ru="Официально" data-am="Պաշտոնապես">${isArmenian ? 'Պաշտոնապես' : 'Официально'}</span></div>
    <h2 class="section-title" data-ru="Wildberries официально разрешил самовыкупы" data-am="Wildberries-ը պաշտոնապես թույլատրել է ինքնագնումները">Wildberries <span class="gr">официально разрешил</span> самовыкупы</h2>
  </div>

  <div class="why-block fade-up">
    <div class="wb-official-badge"><i class="fas fa-check-circle"></i> Подтверждено в оферте WB</div>
    
    <h3><i class="fas fa-shield-alt"></i> <span data-ru="Никаких штрафов. Никаких рисков." data-am="Ոչ մի տուգանք: Ոչ մի ռիսկ:">${isArmenian ? 'Ոչ մի տուգանք: Ոչ մի ռիսկ:' : 'Никаких штрафов. Никаких рисков.'}</span></h3>
    <p data-ru="Wildberries официально подтвердил в своей оферте, что самовыкупы не являются нарушением. За это не предусмотрены штрафы или блокировки кабинета. Тысячи успешных продавцов используют этот инструмент каждый день." data-am="Wildberries-ը պաշտոնապես հաստատել է իր օֆերտայում، որ ինքնագնումները խախտում չեն: Տուգանքներ կամ արգելափակումներ նախատեսված չեն: Հազարավոր հաջողակ վաճառողներ օգտագործում են այս գործիքը ամեն օր:">Wildberries официально подтвердил в своей оферте, что самовыкупы <strong>не являются нарушением</strong>. За это не предусмотрены штрафы или блокировки кабинета. Тысячи успешных продавцов используют этот инструмент каждый день.</p>
    
    <h3><i class="fas fa-arrow-up"></i> <span data-ru="WB вернул приоритет органической выдачи" data-am="WB-ն վերադարձրել է օրգանիկի առաջնահերթությունը:">${isArmenian ? 'WB-ն վերադարձրել է օրգանիկի առաջնահերթությունը:' : 'WB вернул приоритет органической выдачи'}</span></h3>
    <p data-ru="Wildberries подтвердил в обновлённой оферте: приоритет в поисковой выдаче получают товары с лучшими поведенческими метриками — конверсия, время на карточке, добавления в корзину, заказы. Именно это мы и прокачиваем при каждом выкупе." data-am="Wildberries-ը հաստատել է թարմացված օֆերտայում։ որոնման արդյունքներում առաջնահերթություն են ստանում լավագույն վարքագծային ցուցանիշներով ապրանքները։ Հենց դա է, ինչ մենք ապահովում ենք յուրաքանչյուր գնումի ընթացքում: Հիմա գլխավոր էջի թոփ 100-ի մեծ մասը օրգանիկ դիրքեր են, նախկին գովազդի փոխարեն։ Թարմացված օֆերտայում նշված է، որ որոնման արդյունքներում առաջնահերթություն ստանում են լավագույն վարքագծական ցուցանիշներով ապրանքները:">Wildberries подтвердил в обновлённой оферте: приоритет в поисковой выдаче получают товары с лучшими <strong>поведенческими метриками</strong> — конверсия, время на карточке, добавления в корзину, заказы. <strong>Именно это мы и прокачиваем при каждом выкупе.</strong> Сейчас на главной странице в топ-100 выдаче больше органической выдачи. Ранее всё было заполнено рекламными местами. В оферте WB подтверждает, что приоритет сейчас — в конверсиях карточки.</p>

    <div class="highlight-result" data-ru="Сейчас — лучшее время для продвижения вашего товара. Пока конкуренты сомневаются — вы уже можете занять ТОП выдачи, привлечь органический трафик и зарабатывать больше. Не ждите, пока конкуренты сделают это первыми." data-am="Այժմ լավագույն ժամանակն է ձեր ապրանքների առաջխաղացման համար: Մինչ մրցակիցները կասկածում են, դուք արդեն կարող եք վերցնել լավագույն դիրքերը TOP-ում, ներգրավել օրգանական թրաֆիկը և վաստակել ավել գումար։ Մի սպասեք, որ մրցակիցները դա անեն առաջինը:"><i class="fas fa-rocket"></i> <strong>Сейчас — лучшее время</strong> для продвижения вашего товара. Пока конкуренты сомневаются — вы уже можете занять ТОП выдачи, привлечь органический трафик и <strong>зарабатывать больше</strong>. Не ждите, пока конкуренты сделают это первыми.</div>

  </div>

  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success"><i class="fas fa-rocket"></i> <span data-ru="Занять ТОП прямо сейчас" data-am="Զբաղեցնել ՏՏՏ-ը հիմա">${isArmenian ? 'Զբաղեցնել ՏՏՏ-ը հիմա' : 'Занять ТОП прямо сейчас'}</span></a>
  </div>
</div>
</section>

<!-- ===== CALCULATOR ===== -->
<section class="section section-dark" id="calculator" data-section-id="calculator">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-calculator"></i> <span data-ru="Калькулятор" data-am="Հաշվիչ">${isArmenian ? 'Հաշվիչ' : 'Калькулятор'}</span></div>
    <h2 class="section-title" data-ru="Рассчитайте стоимость услуг" data-am="Հաշվեք ծառայությունների արժեքը">${isArmenian ? 'Հաշվեք ծառայությունների արժեքը' : 'Рассчитайте стоимость услуг'}</h2>
    <p class="section-sub" data-ru="Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram." data-am="Ընտրեք անհրաժեշտ ծառայությունները, նշեք քանակը և իմացեք գումարը: Պատվերը ձևակերպվում է Telegram-ով:">${isArmenian ? 'Ընտրեք անհրաժեշտ ծառայությունները, նշեք քանակը և իմացեք գումարը: Պատվերը ձևակերպվում է Telegram-ով:' : 'Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram.'}</p>
  </div>
  <div class="calc-wrap fade-up">
    <div class="calc-packages" id="calcPackages" style="display:none"></div>
    <div class="calc-tabs">
      <div class="calc-tab active" onclick="showCalcTab('buyouts',this)" data-ru="Выкупы" data-am="Գնումներ">${isArmenian ? 'Գնումներ' : 'Выкупы'}</div>
      <div class="calc-tab" onclick="showCalcTab('reviews',this)" data-ru="Отзывы" data-am="Կարծիքներ">${isArmenian ? 'Կարծիքներ' : 'Отзывы'}</div>
      <div class="calc-tab" onclick="showCalcTab('photo',this)" data-ru="Фотосъёмка" data-am="Լուսանկարահանում">${isArmenian ? 'Լուսանկարահանում' : 'Фотосъёмка'}</div>
      <div class="calc-tab" onclick="showCalcTab('ff',this)" data-ru="ФФ" data-am="Ֆուլֆիլմենթ">${isArmenian ? 'Ֆուլֆիլմենթ' : 'ФФ'}</div>
      <div class="calc-tab" onclick="showCalcTab('logistics',this)" data-ru="Логистика" data-am="Լոգիստիկա">${isArmenian ? 'Լոգիստիկա' : 'Логистика'}</div>
      <div class="calc-tab" onclick="showCalcTab('other',this)" data-ru="Прочие услуги" data-am="Այլ ծառայություններ">${isArmenian ? 'Այլ ծառայություններ' : 'Прочие услуги'}</div>
    </div>

    <!-- ===== ВЫКУПЫ ===== -->
    <div class="calc-group active" id="cg-buyouts">
      <div class="calc-row" data-price="buyout" id="buyoutRow">
        <div class="calc-label" data-ru="Выкуп + забор из ПВЗ" data-am="Գնում + ստացում ՊՎԶ-ից">${isArmenian ? 'Գնում + ստացում ՊՎԶ-ից' : 'Выкуп + забор из ПВЗ'}</div>
        <div class="calc-price" id="buyoutPriceLabel">2 000 ֏</div>
        <div class="calc-input"><button onclick="ccBuyout(-1)">−</button><input type="number" id="buyoutQty" value="0" min="0" max="999" onchange="onBuyoutInput()" oninput="onBuyoutInput()"><button onclick="ccBuyout(1)">+</button></div>
      </div>
      <!-- tier-info removed: dynamically generated from DB by JS -->
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Выкуп КГТ + забор из ПВЗ" data-am="Ծանրաքաշ ապրանքի գնում + ստացում ՊՎԶ-ից">${isArmenian ? 'Ծանրաքաշ ապրանքի գնում + ստացում ՊՎԶ-ից' : 'Выкуп КГТ + забор из ПВЗ'}</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ОТЗЫВЫ ===== -->
    <div class="calc-group" id="cg-reviews">
      <div class="calc-row" data-price="300">
        <div class="calc-label" data-ru="Оценка" data-am="Գնահատական">${isArmenian ? 'Գնահատական' : 'Оценка'}</div>
        <div class="calc-price">300 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="500">
        <div class="calc-label" data-ru="Оценка + отзыв" data-am="Գնահատական + կարծիք">${isArmenian ? 'Գնահատական + կարծիք' : 'Оценка + отзыв'}</div>
        <div class="calc-price">500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="500">
        <div class="calc-label" data-ru="Вопрос к товару" data-am="Հարց ապրանքի վերաբերյալ">${isArmenian ? 'Հարց ապրանքի վերաբերյալ' : 'Вопрос к товару'}</div>
        <div class="calc-price">500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="250">
        <div class="calc-label" data-ru="Написание текста отзыва" data-am="Կարծիքի տեքստի գրում">${isArmenian ? 'Կարծիքի տեքստի գրում' : 'Написание текста отзыва'}</div>
        <div class="calc-price">250 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="100">
        <div class="calc-label" data-ru="Подписка на бренд / страницу" data-am="Բրենդի / էջի բաժանորդագրություն">${isArmenian ? 'Բրենդի / էջի բաժանորդագրություն' : 'Подписка на бренд / страницу'}</div>
        <div class="calc-price">100 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ФОТОСЪЁМКА ===== -->
    <div class="calc-group" id="cg-photo">
      <div class="calc-row" data-price="3500">
        <div class="calc-label" data-ru="Фотосессия в гардеробной WB (жен. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (կին մոդել)">${isArmenian ? 'Լուսանկարահանում WB հագուստապահարանում (կին մոդել)' : 'Фотосессия в гардеробной WB (жен. модель)'}</div>
        <div class="calc-price">3 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="4500">
        <div class="calc-label" data-ru="Фотосессия в гардеробной WB (муж. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (տղամարդ մոդել)">${isArmenian ? 'Լուսանկարահանում WB հագուստապահարանում (տղամարդ մոդել)' : 'Фотосессия в гардеробной WB (муж. модель)'}</div>
        <div class="calc-price">4 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Предметная фотосъёмка (3 фото)" data-am="Առարկայական լուսանկարահանում (3 լուսանկար)">${isArmenian ? 'Առարկայական լուսանկարահանում (3 լուսանկար)' : 'Предметная фотосъёмка (3 фото)'}</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="5000">
        <div class="calc-label" data-ru="Предметная съёмка (крупное / техника, 3 фото)" data-am="Առարկայական լուսանկարահանում (խոշոր / տեխնիկա, 3 լուս.)">${isArmenian ? 'Առարկայական լուսանկարահանում (խոշոր / տեխնիկա, 3 լուս.)' : 'Предметная съёмка (крупное / техника, 3 фото)'}</div>
        <div class="calc-price">5 000 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Ребёнок модель (до 14 лет)" data-am="Երեխա մոդել (մինչև 14 տարեկան)">${isArmenian ? 'Երեխա մոդել (մինչև 14 տարեկան)' : 'Ребёнок модель (до 14 лет)'}</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="7000">
        <div class="calc-label" data-ru="Видеообзор товара" data-am="Ապրանքի վիդեոհոլովակ">${isArmenian ? 'Ապրանքի վիդեոհոլովակ' : 'Видеообзор товара'}</div>
        <div class="calc-price">7 000 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ФФ (Фулфилмент) ===== -->
    <div class="calc-group" id="cg-ff">
      <div class="calc-row" data-price="100">
        <div class="calc-label" data-ru="Замена штрихкода" data-am="Շտրիխկոդի փոխարինում">${isArmenian ? 'Շտրիխկոդի փոխարինում' : 'Замена штрихкода'}</div>
        <div class="calc-price">100 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="200">
        <div class="calc-label" data-ru="Переупаковка (наша)" data-am="Վերափաթեթավորում (մեր փաթեթ)">${isArmenian ? 'Վերափաթեթավորում (մեր փաթեթ)' : 'Переупаковка (наша)'}</div>
        <div class="calc-price">200 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="150">
        <div class="calc-label" data-ru="Переупаковка (клиента)" data-am="Վերափաթեթավորում (հաճախորդի փաթեթ)">${isArmenian ? 'Վերափաթեթավորում (հաճախորդի փաթեթ)' : 'Переупаковка (клиента)'}</div>
        <div class="calc-price">150 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ЛОГИСТИКА ===== -->
    <div class="calc-group" id="cg-logistics">
      <div class="calc-row" data-price="2000">
        <div class="calc-label" data-ru="Доставка на склад WB (1 коробка 60х40х40)" data-am="Առաքում WB պահեստ (1 տուփ 60x40x40)">${isArmenian ? 'Առաքում WB պահեստ (1 տուփ 60x40x40)' : 'Доставка на склад WB (1 коробка 60х40х40)'}</div>
        <div class="calc-price">2 000 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Доставка до вашего склада (1 коробка 60х40х40)" data-am="Առաքում ձեր պահեստ (1 տուփ 60x40x40)">${isArmenian ? 'Առաքում ձեր պահեստ (1 տուփ 60x40x40)' : 'Доставка до вашего склада (1 коробка 60х40х40)'}</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ПРОЧИЕ УСЛУГИ ===== -->
    <div class="calc-group" id="cg-other">
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Глажка одежды (одиночная вещь)" data-am="Հագուստի արդուկում (մեկ իր)">${isArmenian ? 'Հագուստի արդուկում (մեկ իր)' : 'Глажка одежды (одиночная вещь)'}</div>
        <div class="calc-price">1 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Глажка одежды (верхняя одежда)" data-am="Հագուստի արդուկում (վերնահագուստ)">${isArmenian ? 'Հագուստի արդուկում (վերնահագուստ)' : 'Глажка одежды (верхняя одежда)'}</div>
        <div class="calc-price">2 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Забор из ПВЗ для съёмки" data-am="Վերցնում ՊՎԶ-ից">${isArmenian ? 'Վերցնում ՊՎԶ-ից' : 'Забор из ПВЗ для съёмки'}</div>
        <div class="calc-price">1 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Возврат в ПВЗ после съёмки" data-am="Վերցնում ՊՎԶ-ից">${isArmenian ? 'Վերցնում ՊՎԶ-ից' : 'Возврат в ПВЗ после съёмки'}</div>
        <div class="calc-price">1 500 ֏</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>
    <div class="calc-total">
      <div class="calc-total-label" data-ru="Итого:" data-am="Ընդամենը:">${isArmenian ? 'Ընդամենը:' : 'Итого:'}</div>
      <div class="calc-total-value" id="calcTotal" data-total="0">0 ֏</div>
    </div>
    <!-- Referral code field -->
    <div id="calcRefWrap" style="margin-top:16px;padding:16px;background:rgba(139,92,246,0.05);border:1px solid var(--border);border-radius:var(--r-sm)">
      <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <label style="display:block;font-size:0.82rem;font-weight:600;color:var(--accent);margin-bottom:6px"><i class="fas fa-gift" style="margin-right:6px"></i><span data-ru="Есть промокод?" data-am="Պրոմոկոդ ունեք?">${isArmenian ? 'Պրոմոկոդ ունեք?' : 'Есть промокод?'}</span></label>
          <input type="text" id="refCodeInput" placeholder="PROMO2026" style="width:100%;padding:10px 14px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.92rem;font-family:inherit;text-transform:uppercase;outline:none;transition:var(--t)" onfocus="this.style.borderColor='var(--purple)'" onblur="this.style.borderColor='var(--border)'">
        </div>
        <button onclick="checkRefCode()" class="btn btn-outline" style="padding:10px 20px;font-size:0.88rem;white-space:nowrap"><i class="fas fa-check-circle" style="margin-right:6px"></i><span data-ru="Применить" data-am="Կիրառել">${isArmenian ? 'Կիրառել' : 'Применить'}</span></button>
      </div>
      <div id="refResult" style="display:none;margin-top:10px;padding:10px 14px;border-radius:8px;font-size:0.88rem;font-weight:500"></div>
    </div>
    <div class="calc-cta" style="display:none">
      <a href="https://wa.me/37455226224" id="calcTgBtn" class="btn btn-primary btn-lg" target="_blank">
        <i class="fab fa-whatsapp"></i>
        <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">${isArmenian ? 'Պատվիրել հիմա' : 'Заказать сейчас'}</span>
      </a>
    </div>
  </div>
</div>
</section>

<!-- ===== PROCESS ===== -->
<section class="section" id="process" data-section-id="process">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-route"></i> <span data-ru="Как мы работаем" data-am="Ինչպես ենք աշխատում">${isArmenian ? 'Ինչպես ենք աշխատում' : 'Как мы работаем'}</span></div>
    <h2 class="section-title" data-ru="5 шагов от заявки до ТОПа" data-am="5 քայլ մինչև TOP">${isArmenian ? '5 քայլ մինչև TOP' : '5 шагов от заявки до ТОПа'}</h2>
  </div>
  <div class="process-grid fade-up">
    <div class="step"><div class="step-line"></div><div class="step-num">1</div><h4 data-ru="Заявка" data-am="Հայտ">${isArmenian ? 'Հայտ' : 'Заявка'}</h4><p data-ru="Пишете в Telegram и описываете товар" data-am="Գրում եք Telegram-ով և նկարագրում ապրանքը">Пишете в Telegram и описываете товар</p></div>
    <div class="step"><div class="step-line"></div><div class="step-num">2</div><h4 data-ru="Анализ" data-am="Վերլուծություն">${isArmenian ? 'Վերլուծություն' : 'Анализ'}</h4><p data-ru="Анализируем нишу и создаём стратегию" data-am="Վերլուծում ենք ապրանքը և ստեղծում ստրատեգիա">Анализируем нишу и создаём стратегию</p></div>
    <div class="step"><div class="step-line"></div><div class="step-num">3</div><h4 data-ru="Запуск" data-am="Մեկնարկ">${isArmenian ? 'Մեկնարկ' : 'Запуск'}</h4><p data-ru="Начинаем выкупы в течение 24 часов" data-am="Սկսում ենք գնումները 24 ժամվա ընթացքում">Начинаем выкупы в течение 24 часов</p></div>
    <div class="step"><div class="step-line"></div><div class="step-num">4</div><h4 data-ru="Контроль" data-am="Վերահսկողություն">${isArmenian ? 'Վերահսկողություն' : 'Контроль'}</h4><p data-ru="Ежедневные отчёты о прогрессе" data-am="Ամենօրյա հաշվետվություններ ընթացքի մասին">Ежедневные отчёты о прогрессе</p></div>
    <div class="step"><div class="step-num">5</div><h4 data-ru="Результат" data-am="Արդյունք">${isArmenian ? 'Արդյունք' : 'Результат'}</h4><p data-ru="Ваш товар в ТОПе выдачи WB" data-am="Ձեր ապրանքը WB-ի TOP-ում է">Ваш товар в ТОПе выдачи WB</p></div>
  </div>
  <div class="section-cta">
    <a href="https://t.me/suport_admin_2" target="_blank" class="btn btn-tg"><i class="fab fa-telegram"></i> <span data-ru="Написать менеджеру" data-am="Գրել մենեջերին">${isArmenian ? 'Գրել մենեջերին' : 'Написать менеджеру'}</span></a>
  </div>
</div>
</section>

<!-- ===== WAREHOUSE ===== -->
<section class="section section-dark" id="warehouse" data-section-id="warehouse">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-warehouse"></i> <span data-ru="Наш склад" data-am="Մեր պահեստը">${isArmenian ? 'Մեր պահեստը' : 'Наш склад'}</span></div>
    <h2 class="section-title" data-ru="Всё организовано и по полочкам" data-am="Ամեն ինչ կազմակերպված է և կարգավորված">${isArmenian ? 'Ամեն ինչ կազմակերպված է և կարգավորված' : 'Всё организовано и по полочкам'}</h2>
  </div>
  <div class="wh-grid fade-up">
    <div class="wh-item" onclick="openLightbox(this)">
      <img src="/static/img/warehouse1.webp" alt="Организованное хранение товаров">
      <div class="wh-caption" data-ru="Организованное хранение" data-am="Կազմակերպված պահպանում">${isArmenian ? 'Կազմակերպված պահպանում' : 'Организованное хранение'}</div>
    </div>
    <div class="wh-item" onclick="openLightbox(this)">
      <img src="/static/img/warehouse2.webp" alt="Склад с товарами">
      <div class="wh-caption" data-ru="Система учёта" data-am="Հաշվառման համակարգ">${isArmenian ? 'Հաշվառման համակարգ' : 'Система учёта'}</div>
    </div>

  </div>
  <p class="section-sub fade-up" style="text-align:center;max-width:700px;margin:32px auto 0" data-ru="Собственный склад в Ереване. Забор ваших товаров с ПВЗ. Надежное хранение товара. Отгрузка Ваших товаров на склад WB СЦ Ереван" data-am="Սեփական պահեստ Երևանում: Ձեր ապրանքների ստացում ՊՎԶ-ից: Հուսալի պահպանում: Ձեր ապրանքների առաքում WB Երևան պահեստ">${isArmenian ? 'Սեփական պահեստ Երևանում: Ձեր ապրանքների ստացում ՊՎԶ-ից: Հուսալի պահպանում: Ձեր ապրանքների առաքում WB Երևան պահեստ' : 'Собственный склад в Ереване. Забор ваших товаров с ПВЗ. Надежное хранение товара. Отгрузка Ваших товаров на склад WB СЦ Ереван'}</p>
  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><i class="fas fa-shopping-cart"></i> <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">${isArmenian ? 'Պատվիրել հիմա' : 'Заказать сейчас'}</span></a>
  </div>
</div>
</section>

<!-- ===== GUARANTEE ===== -->
<section class="section" id="guarantee" data-section-id="guarantee">
<div class="container">
    <div class="guarantee-card fade-up">
    <div class="guarantee-el-photo">
    <img src="/static/img/team-office.webp" alt="Команда Go to Top">
    </div>
    <div class="guarantee-el-title">
      <div class="section-badge"><i class="fas fa-shield-alt"></i> <span data-ru="Гарантия безопасности" data-am="Անվտանգության երաշխիք">${isArmenian ? 'Անվտանգության երաշխիք' : 'Гарантия безопасности'}</span></div>
      <h2 data-ru="Всё организовано и по полочкам. Наша команда" data-am="Ամեն ինչ կազմակերպված է և կարգավորված։ Մեր թիմը">${isArmenian ? 'Ամեն ինչ կազմակերպված է և կարգավորված։ Մեր թիմը' : 'Всё организовано и по полочкам. Наша команда'}</h2>
    </div>
    <div class="guarantee-el-texts">
      <p data-ru="За всё время работы ни один кабинет клиента не получил блокировку. Каждый проект ведётся опытной командой с полным контролем на каждом этапе." data-am="Աշխատանքի ողջ ընթացքում ոչ մի հաճախորդի հաշիվ չի արգելափակվել: Երբ նախագիծը վարվում է փորձառու թիմի կողմից լիարժեք վերահսկողությամբ յուրաքանչյուր փուլում:">${isArmenian ? 'Աշխատանքի ողջ ընթացքում ոչ մի հաճախորդի հաշիվ չի արգելափակվել: Երբ նախագիծը վարվում է փորձառու թիմի կողմից լիարժեք վերահսկողությամբ յուրաքանչյուր փուլում:' : 'За всё время работы ни один кабинет клиента не получил блокировку. Каждый проект ведётся опытной командой с полным контролем на каждом этапе.'}</p>
      <ul class="g-list">
        <li><i class="fas fa-check-circle"></i> <span data-ru="Реальное поведение человека во время выкупа" data-am="Իրական մարդկային վարքագիծ գնում կատարելիս">${isArmenian ? 'Իրական մարդկային վարքագիծ գնում կատարելիս' : 'Реальное поведение человека во время выкупа'}</span></li>
        <li><i class="fas fa-check-circle"></i> <span data-ru="Реальные аккаунты с историей покупок" data-am="Իրական հաշիվներ գնումների պատմությամբ">${isArmenian ? 'Իրական հաշիվներ գնումների պատմությամբ' : 'Реальные аккаунты с историей покупок'}</span></li>
        <li><i class="fas fa-check-circle"></i> <span data-ru="Естественное распределение по географии" data-am="Բնական աշխարհագրական բաշխում">${isArmenian ? 'Բնական աշխարհագրական բաշխում' : 'Естественное распределение по географии'}</span></li>
      </ul>
      <div class="g-badge">
        <i class="fas fa-award"></i>
        <span data-ru="0 блокировок за всё время работы" data-am="0 արգելափակում աշխատանքի ողջ ընթացքում">${isArmenian ? '0 արգելափակում աշխատանքի ողջ ընթացքում' : '0 блокировок за всё время работы'}</span>
      </div>
    </div>
    <div class="guarantee-el-buttons">
      <div class="section-cta" style="margin-top:24px">
        <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success"><i class="fas fa-rocket"></i> <span data-ru="Начать продвижение" data-am="Սկսել առաջխաղացումը">${isArmenian ? 'Սկսել առաջխաղացումը' : 'Начать продвижение'}</span></a>
      </div>
    </div>
  </div>
</div>
</section>

<!-- ===== COMPARISON ===== -->
<section class="section section-dark" data-section-id="comparison">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-balance-scale"></i> <span data-ru="Сравнение" data-am="Համեմատություն">${isArmenian ? 'Համեմատություն' : 'Сравнение'}</span></div>
    <h2 class="section-title" data-ru="Go to Top vs Другие агентства" data-am="Go to Top vs Այլ գործակալություններ">${isArmenian ? 'Go to Top vs Այլ գործակալություններ' : 'Go to Top vs Другие агентства'}</h2>
  </div>
  <div class="fade-up"><div class="cmp-table-wrap">
  <table class="cmp-table">
    <thead><tr>
      <th data-ru="Критерий" data-am="Չափանիշ">${isArmenian ? 'Չափանիշ' : 'Критерий'}</th>
      <th>Go to Top</th>
      <th data-ru="Другие" data-am="Այլեր">${isArmenian ? 'Այլեր' : 'Другие'}</th>
    </tr></thead>
    <tbody>
      <tr><td data-ru="Реальные люди" data-am="Իրական մարդիկ">${isArmenian ? 'Իրական մարդիկ' : 'Реальные люди'}</td><td><i class="fas fa-check-circle chk"></i> <span data-ru="Да" data-am="Այո">Да</span></td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Часто боты" data-am="Հաճախ բոտեր">Часто боты</span></td></tr>
      <tr><td data-ru="Собственный склад" data-am="Սեփական պահեստ">${isArmenian ? 'Սեփական պահեստ' : 'Собственный склад'}</td><td><i class="fas fa-check-circle chk"></i> <span data-ru="Ереван" data-am="Երևան">Ереван</span></td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Нет" data-am="Ոչ">Нет</span></td></tr>
      <tr><td data-ru="Блокировки" data-am="Արգելափակումներ">${isArmenian ? 'Արգելափակումներ' : 'Блокировки'}</td><td><i class="fas fa-check-circle chk"></i> 0</td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Бывают" data-am="Լինում են">Бывают</span></td></tr>
      <tr><td data-ru="Фотосессия товаров" data-am="Ապրանքների լուսանկարահանում">${isArmenian ? 'Ապրանքների լուսանկարահանում' : 'Фотосессия товаров'}</td><td><i class="fas fa-check-circle chk"></i> <span data-ru="Свои модели" data-am="Սեփական մոդելներ">Свои модели</span></td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Нет" data-am="Ոչ">Нет</span></td></tr>
      <tr><td data-ru="Прозрачная отчётность" data-am="Թափանցիկ հաշվետվություն">${isArmenian ? 'Թափանցիկ հաշվետվություն' : 'Прозрачная отчётность'}</td><td><i class="fas fa-check-circle chk"></i> <span data-ru="Ежедневно" data-am="Ամենօր">Ежедневно</span></td><td><i class="fas fa-times-circle crs"></i> <span data-ru="Раз в неделю" data-am="Շաբաթը մեկ անգամ">Раз в неделю</span></td></tr>
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
    <div class="section-badge"><i class="fas fa-info-circle"></i> <span data-ru="Важно знать" data-am="Կարևոր է իմանալ">${isArmenian ? 'Կարևոր է իմանալ' : 'Важно знать'}</span></div>
    <h2 class="section-title" data-ru="Условия работы" data-am="Աշխատանքի պայմաններ">${isArmenian ? 'Աշխատանքի պայմաններ' : 'Условия работы'}</h2>
  </div>
  <div class="services-grid fade-up">
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-percent"></i></div>
      <h3 data-ru="Лимит отзывов" data-am="Կարծիքների սահմանափակում">${isArmenian ? 'Կարծիքների սահմանափակում' : 'Лимит отзывов'}</h3>
      <p data-ru="Публикуем отзывы не более чем на 50% выкупленных товаров — для безопасности вашего кабинета." data-am="Կարծիքներ հրապարակում ենք գնված ապրանքների ոչ ավելի քան 50%-ի վրա — ձեր հաշվի անվտանգության համար:">${isArmenian ? 'Կարծիքներ հրապարակում ենք գնված ապրանքների ոչ ավելի քան 50%-ի վրա — ձեր հաշվի անվտանգության համար:' : 'Публикуем отзывы не более чем на 50% выкупленных товаров — для безопасности вашего кабинета.'}</p>
    </div>
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-box-open"></i></div>
      <h3 data-ru="Крупногабаритный товар" data-am="Խոշոր չափսի ապրանք">${isArmenian ? 'Խոշոր չափսի ապրանք' : 'Крупногабаритный товар'}</h3>
      <p data-ru="Товар свыше 3 кг или одна сторона длиннее 55 см. Свыше 10 кг — стоимость рассчитывается индивидуально." data-am="3 կգ-ից ավելի կամ մի կողմ 55 սմ-ից ավելի: 10 կգ-ից ավելի ապրանքների համար — արժեքը հաշվարկվում է անհատական:">${isArmenian ? '3 կգ-ից ավելի կամ մի կողմ 55 սմ-ից ավելի: 10 կգ-ից ավելի ապրանքների համար — արժեքը հաշվարկվում է անհատական:' : 'Товар свыше 3 кг или одна сторона длиннее 55 см. Свыше 10 кг — стоимость рассчитывается индивидуально.'}</p>
    </div>
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-box"></i></div>
      <h3 data-ru="Защитные пломбы" data-am="Պաշտպանիչ կապարաններ">${isArmenian ? 'Պաշտպանիչ կապարաններ' : 'Защитные пломбы'}</h3>
      <p data-ru="Товары с защитными пломбами или заводской упаковкой после фотосессии не восстанавливаются." data-am="Պաշտպանիչ կապարաններով կամ գործարանային փաթեթավորմամբ ապրանքները լուսանկարահանումից հետո չեն վերականգնվում:">${isArmenian ? 'Պաշտպանիչ կապարաններով կամ գործարանային փաթեթավորմամբ ապրանքները լուսանկարահանումից հետո չեն վերականգնվում:' : 'Товары с защитными пломбами или заводской упаковкой после фотосессии не восстанавливаются.'}</p>
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
    <div class="section-badge"><i class="fas fa-star"></i> <span data-ru="Реальные кейсы" data-am="Իրական դեպքեր">${isArmenian ? 'Իրական դեպքեր' : 'Реальные кейсы'}</span></div>
    <h2 class="section-title" data-ru="Отзывы наших клиентов" data-am="Մեր հաճախորդների կարծիքները">${isArmenian ? 'Մեր հաճախորդների կարծիքները' : 'Отзывы наших клиентов'}</h2>
    <p class="section-sub" data-ru="Результаты говорят сами за себя — вот что получают наши клиенты" data-am="Արդյունքները խոսում են ինքնիրենք — ահա թե ինչ են ստանում մեր հաճախորդները">${isArmenian ? 'Արդյունքները խոսում են ինքնիրենք — ահա թե ինչ են ստանում մեր հաճախորդները' : 'Результаты говорят сами за себя — вот что получают наши клиенты'}</p>
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


<!-- ===== FOR WHOM ===== -->
<section class="section" id="for-whom" data-section-id="for-whom" data-block-key="home__for_whom">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-users"></i> <span data-ru="Для кого" data-am="Ում համար">${isArmenian ? 'Ում համար' : 'Для кого'}</span></div>
    <h2 class="section-title" data-ru="Для кого полезен наш сервис" data-am="Ում համար է օգտակար մեր ծառայությունը">Для кого полезен <span class="gr">наш сервис</span></h2>
    <p class="section-sub" data-ru="Мы работаем с разными форматами бизнеса — от отдельных менеджеров до крупных агентств" data-am="Մենք աշխատում ենք գործընկերների տարբեր ձևաչափերի հետ՝ առանձին մենեջերներից մինչև գործակալություններ և կրթական նախագծեր։">${isArmenian ? 'Մենք աշխատում ենք գործընկերների տարբեր ձևաչափերի հետ՝ առանձին մենեջերներից մինչև գործակալություններ և կրթական նախագծեր։' : 'Мы работаем с разными форматами бизнеса — от отдельных менеджеров до крупных агентств'}</p>
  </div>
  <div class="for-whom-grid fade-up">
    <div class="for-whom-card">
      <div class="for-whom-icon"><i class="fas fa-handshake"></i></div>
      <h3 data-ru="Менеджер по маркетплейсам" data-am="Մարքեթփլեյս մենեջեր">${isArmenian ? 'Մարքեթփլեյս մենեջեր' : 'Менеджер по маркетплейсам'}</h3>
      <p data-ru="Имеете большую базу клиентов-поставщиков на WB и Ozon — станьте нашим партнёром и зарабатывайте на каждом заказе" data-am="Ունեք մատակարարների մեծ բազա WB-ում և Ozon-ում — դարձեք մեր գործընկերը և վաստակեք յուրաքանչյուր պատվերից">${isArmenian ? 'Ունեք մատակարարների մեծ բազա WB-ում և Ozon-ում — դարձեք մեր գործընկերը և վաստակեք յուրաքանչյուր պատվերից' : 'Имеете большую базу клиентов-поставщиков на WB и Ozon — станьте нашим партнёром и зарабатывайте на каждом заказе'}</p>
    </div>
    <div class="for-whom-card">
      <div class="for-whom-icon"><i class="fas fa-building"></i></div>
      <h3 data-ru="Агентство или компания" data-am="Գործակալություն կամ ընկերություն">${isArmenian ? 'Գործակալություն կամ ընկերություն' : 'Агентство или компания'}</h3>
      <p data-ru="Работаете с поставщиками маркетплейсов — добавьте услуги выкупов и отзывов в свой портфель и увеличьте доход" data-am="Աշխատում եք մարքեթփլեյսների մատակարարների հետ — ավելացրեք գնումների և կարծիքների ծառայությունները ձեր փաթեթին և ավելացրեք հաճախորդի միջին չեկը։">${isArmenian ? 'Աշխատում եք մարքեթփլեյսների մատակարարների հետ — ավելացրեք գնումների և կարծիքների ծառայությունները ձեր փաթեթին և ավելացրեք հաճախորդի միջին չեկը։' : 'Работаете с поставщиками маркетплейсов — добавьте услуги выкупов и отзывов в свой портфель и увеличьте доход'}</p>
    </div>
    <div class="for-whom-card">
      <div class="for-whom-icon"><i class="fas fa-globe"></i></div>
      <h3 data-ru="Владелец ресурса" data-am="Ռեսուրսի սեփականատեր">${isArmenian ? 'Ռեսուրսի սեփականատեր' : 'Владелец ресурса'}</h3>
      <p data-ru="Ведёте тематический блог, YouTube-канал или телеграм-канал о маркетплейсах — станьте партнёром и монетизируйте аудиторию" data-am="Վարում եք թեմատիկ բլոգ, YouTube- կամ Telegram-ալիք Wildberries-ի մասին — դրամայնացրեք լսարանը գործընկերային պրոմո կոդով։">${isArmenian ? 'Վարում եք թեմատիկ բլոգ, YouTube- կամ Telegram-ալիք Wildberries-ի մասին — դրամայնացրեք լսարանը գործընկերային պրոմո կոդով։' : 'Ведёте тематический блог, YouTube-канал или телеграм-канал о маркетплейсах — станьте партнёром и монетизируйте аудиторию'}</p>
    </div>
    <div class="for-whom-card">
      <div class="for-whom-icon"><i class="fas fa-graduation-cap"></i></div>
      <h3 data-ru="Онлайн-школа" data-am="Օնլայն-դպրոց">${isArmenian ? 'Օնլայն-դպրոց' : 'Онлайн-школа'}</h3>
      <p data-ru="Обучаете работе с маркетплейсами — рекомендуйте наш сервис студентам и получайте реферальное вознаграждение" data-am="Ուսուցանում եք մարկետփլեյսներում աշխատելը՝ խորհուրդ տվեք մեր ծառայությունը ուսանողներին և ստացեք ռեֆերալային պարգևատրում">${isArmenian ? 'Ուսուցանում եք մարկետփլեյսներում աշխատելը՝ խորհուրդ տվեք մեր ծառայությունը ուսանողներին և ստացեք ռեֆերալային պարգևատրում' : 'Обучаете работе с маркетплейсами — рекомендуйте наш сервис студентам и получайте реферальное вознаграждение'}</p>
    </div>
    <div class="for-whom-card">
      <div class="for-whom-icon"><i class="fas fa-rocket"></i></div>
      <h3 data-ru="Интенсив или курс" data-am="Ինտենսիվ կամ դասընթաց">${isArmenian ? 'Ինտենսիվ կամ դասընթաց' : 'Интенсив или курс'}</h3>
      <p data-ru="Проводите обучение по маркетплейсам — включите наш сервис как практический инструмент и помогайте ученикам с реальными выкупами" data-am="Անցկացնում եք ուսուցում մարկետփլեյսների վերաբերյալ՝ ներառեք մեր ծառայությունը որպես գործնական գործիք և օգնեք ուսանողներին իրական գնումներով">${isArmenian ? 'Անցկացնում եք ուսուցում մարկետփլեյսների վերաբերյալ՝ ներառեք մեր ծառայությունը որպես գործնական գործիք և օգնեք ուսանողներին իրական գնումներով' : 'Проводите обучение по маркетплейсам — включите наш сервис как практический инструмент и помогайте ученикам с реальными выкупами'}</p>
    </div>
  </div>
  <div style="text-align:center;margin-top:40px" class="fade-up">
    <a href="#contact" class="btn btn-primary">
      <i class="fas fa-comments"></i>
      <span data-ru="Обсудить партнёрство" data-am="Քննարկել գործընկերությունը">${isArmenian ? 'Քննարկել գործընկերությունը' : 'Обсудить партнёрство'}</span>
    </a>
  </div>
</div>
</section>


<!-- ===== REVIEWS PROOF ===== -->
<section class="section section-dark" id="reviews-proof" data-section-id="reviews-proof">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-star"></i> <span data-ru="Социальное доказательство" data-am="Սոցիալական ապացույց">${isArmenian ? 'Սոցիալական ապացույց' : 'Социальное доказательство'}</span></div>
    <h2 class="section-title" data-ru="Вот такие отзывы — продают" data-am="Ահա այսպիսի կարծիքները՝ վաճառում են"><span data-ru="Вот такие отзывы — " data-am="Ах aylс karnіknерь — ">Вот такие отзывы — </span><span class="gr" data-ru="продают" data-am="вачаром">продают</span></h2>
    <p class="section-sub" data-ru="Реальные фото, подробные описания, живые эмоции — именно это убеждает следующего покупателя" data-am="Իրական լուսանկարներ, մանրամասն նկարագրություններ, կենդանի զգացմունքներ — հենց դա է համոզում հաջորդ գնորդին պատվիրել: Համեմատեք ինքներդ՝">${isArmenian ? 'Իրական լուսանկարներ, մանրամասն նկարագրություններ, կենդանի զգացմունքներ — հենց դա է համոզում հաջորդ գնորդին պատվիրել: Համեմատեք ինքներդ՝' : 'Реальные фото, подробные описания, живые эмоции — именно это убеждает следующего покупателя'}</p>
  </div>
  <div class="reviews-compare fade-up">
    <div class="review-proof-col good">
      <div class="review-proof-label good"><i class="fas fa-check-circle"></i> <span data-ru="ПРОДАЁТ" data-am="ՎԱՃԱՌՈՒՄ Է">${isArmenian ? 'ՎԱՃԱՌՈՒՄ Է' : 'ПРОДАЁТ'}</span></div>
      <div class="review-proof-img">
        <img src="/static/img/review-proof-good.webp" alt="Продающий отзыв" loading="lazy">
      </div>
      <div class="review-proof-text">
        <p data-ru="Фото в использовании, честный детальный текст, покупатель видит реальный опыт — доверие растёт" data-am="Լուսանկառ իռական ոգտագոռծման մել, ազնիվ մանռամասն տեկստե — վաստահությունը ալլում ե">${isArmenian ? 'Լուսանկառ իռական ոգտագոռծման մել, ազնիվ մանռամասն տեկստե — վաստահությունը ալլում ե' : 'Фото в использовании, честный детальный текст, покупатель видит реальный опыт — доверие растёт'}</p>
      </div>
    </div>
    <div class="review-proof-vs"><span>VS</span></div>
    <div class="review-proof-col bad">
      <div class="review-proof-label bad"><i class="fas fa-times-circle"></i> <span data-ru="НЕ ПРОДАЁТ" data-am="ՉԻ ՎԱՃԱՌՈՒՄ">${isArmenian ? 'ՉԻ ՎԱՃԱՌՈՒՄ' : 'НЕ ПРОДАЁТ'}</span></div>
      <div class="review-proof-img">
        <img src="/static/img/review-proof-good2.webp" alt="Непродающий отзыв" loading="lazy">
      </div>
      <div class="review-proof-text">
        <p data-ru="Пустые шаблонные оценки без текста и без фото — покупатель не видит ценности, не доверяет" data-am="դատառկ վառկանակառ առանծ տեկստի — գնոռդը ծի վաստահում">${isArmenian ? 'դատառկ վառկանակառ առանծ տեկստի — գնոռդը ծի վաստահում' : 'Пустые шаблонные оценки без текста и без фото — покупатель не видит ценности, не доверяет'}</p>
      </div>
    </div>
  </div>
  <div style="text-align:center;margin-top:40px" class="fade-up">
    <a href="#contact" class="btn btn-primary btn-lg">
      <i class="fas fa-star"></i>
      <span data-ru="Заказать продающие отзывы" data-am="Պատվիրել վաճառող կարծիքներ">${isArmenian ? 'Պատվիրել վաճառող կարծիքներ' : 'Заказать продающие отзывы'}</span>
    </a>
  </div>
</div>
</section>

<!-- ===== FAQ ===== -->
<section class="section section-dark" id="faq" data-section-id="faq">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-question-circle"></i> <span data-ru="FAQ" data-am="ՀՏՀ">${isArmenian ? 'ՀՏՀ' : 'FAQ'}</span></div>
    <h2 class="section-title" data-ru="Частые вопросы" data-am="Հաճախ տրվող հարցեր">${isArmenian ? 'Հաճախ տրվող հարցեր' : 'Частые вопросы'}</h2>
  </div>
  <div class="faq-list fade-up">
    <div class="faq-item active">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Могут ли заблокировать мой кабинет?" data-am="Կարող են արգելափակել իմ կաբինետը։">${isArmenian ? 'Կարող են արգելափակել իմ կաբինետը։' : 'Могут ли заблокировать мой кабинет?'}</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="За всё время нашей работы ни один кабинет клиента не получил блокировку. Мы используем реальные аккаунты с историей покупок, собственный склад и естественное распределение по географии." data-am="Մեր աշխատանքի ողջ ընթացքում ոց մի հաճախորդի կաբինետ չի արգելափակվել: Մենք օգտագործում ենք իրական հաշիվներ գնումների պատմությամբ, սեփական պահեստ և բնական աշխարհագրական բաշխում:">${isArmenian ? 'Մեր աշխատանքի ողջ ընթացքում ոց մի հաճախորդի կաբինետ չի արգելափակվել: Մենք օգտագործում ենք իրական հաշիվներ գնումների պատմությամբ, սեփական պահեստ և բնական աշխարհագրական բաշխում:' : 'За всё время нашей работы ни один кабинет клиента не получил блокировку. Мы используем реальные аккаунты с историей покупок, собственный склад и естественное распределение по географии.'}</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Как быстро начнётся продвижение?" data-am="Ինչքան արագ կսկսվի առաջխաղացումը։">${isArmenian ? 'Ինչքան արագ կսկսվի առաջխաղացումը։' : 'Как быстро начнётся продвижение?'}</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="В течение 24 часов после согласования стратегии и оплаты." data-am="24 ժամվա ընթացքում ստրատեգիայի համաձայնեցումից և վճարման հետո:">${isArmenian ? '24 ժամվա ընթացքում ստրատեգիայի համաձայնեցումից և վճարման հետո:' : 'В течение 24 часов после согласования стратегии и оплаты.'}</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Выкупы делают реальные люди или боты?" data-am="Գնումները կատարում են իրական մարդիկ թե։ բոտեր։">${isArmenian ? 'Գնումները կատարում են իրական մարդիկ թե։ բոտեր։' : 'Выкупы делают реальные люди или боты?'}</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Только реальные люди. У нас собственный склад с устройствами и реальными аккаунтами. Каждый выкуп делается вручную, никаких ботов." data-am="Միայն իրական մարդիկ: Մենք ունենք սեփական պահեստ սարքերով և իրական հաշիվներով: Եվ գնումները կատարվում են ձեռքով, ոչ մի բոտ:">Только реальные люди.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Почему не все выкупы получают отзывы?" data-am="Ինչու ոչ բոլոր գնումներն են ստանում կարծիքներ։">${isArmenian ? 'Ինչու ոչ բոլոր գնումներն են ստանում կարծիքներ։' : 'Почему не все выкупы получают отзывы?'}</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Для безопасности вашего кабинета мы публикуем отзывы не более чем на 50% выкупленных товаров. Это имитирует естественное поведение покупателей." data-am="Ձեր կաբինետի անվտանգության համար կարծիքները հրապարակում ենք գնված ապրանքների ոչ ավելի քան 50%-ի համար: Սա նմանակում է գնորդների բնական վարքագիցը:">Для безопасности вашего кабинета мы публикуем отзывы не более чем на 50% выкупленных товаров.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Можно ли заказать только отзывы без выкупов?" data-am="Հնարավոր է պատվիրել միայն կարծիքներ առանց գնումների։">${isArmenian ? 'Հնարավոր է պատվիրել միայն կարծիքներ առանց գնումների։' : 'Можно ли заказать только отзывы без выкупов?'}</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Да, мы можем выкупить товар для фото/видео отзыва и затем сделать возврат на ПВЗ. Стоимость уточняйте у менеджера." data-am="Այո, մենք կարող ենք գնել ապրանքը լուսանկար/տեսանյութ կարծիքի համար և հետո վերադարձնել ՊՎԶ: Արժեքը ճշտեք մենեջերի մոտ:">Да, мы можем выкупить товар для фото/видео отзыва и затем сделать возврат на ПВЗ.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Какие отчёты мы получаем?" data-am="Ինչ հաշվետվություններ ենք ստանում։">${isArmenian ? 'Ինչ հաշվետվություններ ենք ստանում։' : 'Какие отчёты мы получаем?'}</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Ежедневные отчёты: статус каждого выкупа, даты забора, статус отзывов. Полная прозрачность на каждом этапе." data-am="Ամենօրյա հաշվետվություններ՝ յուրաքանչյուր գնումի կարգավիճակ, վերցնման ամսաթվեր, կարծիքների կարգավիճակ: Լիարժեք թափանցիկություն յուրաքանչյուր փուլում:">${isArmenian ? 'Ամենօրյա հաշվետվություններ՝ յուրաքանչյուր գնումի կարգավիճակ, վերցնման ամսաթվեր, կարծիքների կարգավիճակ: Լիարժեք թափանցիկություն յուրաքանչյուր փուլում:' : 'Ежедневные отчёты: статус каждого выкупа, даты забора, статус отзывов. Полная прозрачность на каждом этапе.'}</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="В какой валюте идут цены?" data-am="Ինչ արժույթով են գները։">${isArmenian ? 'Ինչ արժույթով են գները։' : 'В какой валюте идут цены?'}</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Все цены указаны в российских рублях (₽ RUB). Оплата в рублях." data-am="Բոլոր գները նշված են հայկական դրամով (֏ AMD): Վճարումը դրամով:">${isArmenian ? 'Բոլոր գները նշված են հայկական դրամով (֏ AMD): Վճարումը դրամով:' : 'Все цены указаны в российских рублях (₽ RUB). Оплата в рублях.'}</p></div>
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
    <div class="section-badge"><i class="fas fa-paper-plane"></i> <span data-ru="Связаться с нами" data-am="Կապվել մեզ">${isArmenian ? 'Կապվել մեզ' : 'Связаться с нами'}</span></div>
    <h2 class="section-title" data-ru="Готовы начать продвижение?" data-am="Պատրաստ եք սկսել առաջխաղացումը։">${isArmenian ? 'Պատրաստ եք սկսել առաջխաղացումը։' : 'Готовы начать продвижение?'}</h2>
    <p class="section-sub" data-ru="Напишите нам в Telegram или оставьте заявку" data-am="Գրեք մեզ Telegram-ով կամ թողեք հայտ">${isArmenian ? 'Գրեք մեզ Telegram-ով կամ թողեք հայտ' : 'Напишите нам в Telegram или оставьте заявку'}</p>
  </div>
  <div class="contact-grid fade-up">
    <a href="https://t.me/goo_to_top" target="_blank" class="contact-card">
      <i class="fab fa-telegram"></i>
      <h4 data-ru="Администратор" data-am="Ադմինիստրատոր">${isArmenian ? 'Ադմինիստրատոր' : 'Администратор'}</h4>
      <p data-ru="Готов оплатить и приступить к продвижению? Пишите сюда." data-am="Պատրաստ եք վճարել և սկսել առաջխաղացումը։ Գրեք:">${isArmenian ? 'Պատրաստ եք վճարել և սկսել առաջխաղացումը։ Գրեք:' : 'Готов оплатить и приступить к продвижению? Пишите сюда.'}</p>
    </a>
    <a href="https://t.me/suport_admin_2" target="_blank" class="contact-card">
      <i class="fab fa-telegram"></i>
      <h4 data-ru="Менеджер" data-am="Մենեջեր">${isArmenian ? 'Մենեջեր' : 'Менеджер'}</h4>
      <p data-ru="Остались вопросы? Нужен детальный расчёт? Пишите сюда." data-am="Հարցեր ունեք։ Մանրամասն հաշվարկ է պետք։ Գրեք:">${isArmenian ? 'Հարցեր ունեք։ Մանրամասն հաշվարկ է պետք։ Գրեք:' : 'Остались вопросы? Нужен детальный расчёт? Пишите сюда.'}</p>
    </a>
  </div>
  <div class="form-card fade-up">
    <form id="leadForm" onsubmit="submitForm(event)">
      <div class="form-group"><label data-ru="Ваше имя" data-am="Ձեր անունը">${isArmenian ? 'Ձեր անունը' : 'Ваше имя'}</label><input type="text" id="formName" required placeholder="Имя" data-placeholder-ru="Имя" data-placeholder-am="Անուն"></div>
      <div class="form-group"><label data-ru="Телефон" data-am="Հեռախոս">${isArmenian ? 'Հեռախոս' : 'Телефон'}</label><input type="tel" id="formPhone" required></div>
      <div class="form-group"><label data-ru="Что продаёте на WB?" data-am="Ինչ եք վաճառում WB-ում։">${isArmenian ? 'Ինչ եք վաճառում WB-ում։' : 'Что продаёте на WB?'}</label><input type="text" id="formProduct" placeholder="Одежда, электроника..." data-placeholder-ru="Одежда, электроника..." data-placeholder-am="Հագուստ, էլեկտրոնիկա..."></div>
      <div class="form-group"><label data-ru="Какие услуги интересуют?" data-am="Ինչ ծառայություններ են հետաքրքրում։">${isArmenian ? 'Ինչ ծառայություններ են հետաքրքրում։' : 'Какие услуги интересуют?'}</label>
        <select id="formService">
          <option value="buyouts" data-ru="Выкупы" data-am="Գնումներ">${isArmenian ? 'Գնումներ' : 'Выкупы'}</option>
          <option value="reviews" data-ru="Отзывы" data-am="Կարծիքներ">${isArmenian ? 'Կարծիքներ' : 'Отзывы'}</option>
          <option value="photos" data-ru="Фотосессия" data-am="Լուսանկարահանում">${isArmenian ? 'Լուսանկարահանում' : 'Фотосессия'}</option>
          <option value="complex" data-ru="Комплекс услуг" data-am="Ծառայությունների փաթեթ" selected>${isArmenian ? 'Ծառայությունների փաթեթ' : 'Комплекс услуг'}</option>
        </select>
      </div>
      <div class="form-group"><label data-ru="Комментарий (необязательно)" data-am="Մեկնաբանություն (ոչ պարտադիր)">${isArmenian ? 'Մեկնաբանություն (ոչ պարտադիր)' : 'Комментарий (необязательно)'}</label><textarea id="formMessage" placeholder="Опишите ваш товар..." data-placeholder-ru="Опишите ваш товар..." data-placeholder-am="Նկարագրեք ձեր ապրանքը..."></textarea></div>
      <div class="form-group"><label data-ru="Удобное время звонка" data-am="Հարմարավետ ժամ զանգի համար"><span data-ru="Удобное время звонка" data-am="Харmar zangahаrelou zamanak">${isArmenian ? 'Հարմարավետ ժամ զանգի համար' : 'Удобное время звонка'}</span></label><input type="text" id="formCallTime" placeholder="Например: с 10 до 13 ч." class="form-input" data-placeholder-ru="Например: с 10 до 13 ч." data-placeholder-am="Оринак: 10-ит мincs 13h."></div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center">
        <i class="fas fa-paper-plane"></i>
        <span data-ru="Отправить заявку" data-am="Ուղարկել հայտը">${isArmenian ? 'Ուղարկել հայտը' : 'Отправить заявку'}</span>
      </button>
    </form>
  </div>
</div>
</section>

<!-- ===== FOOTER (mirrors renderPageShell — same items, same shell__footer ids) ===== -->
<footer class="footer">
<div class="container">
  <div class="footer-grid">
    <div class="footer-brand">
      <div class="logo"><img src="/static/img/logo-gototop.webp" alt="Go to Top" style="height:44px"><span class="logo-text">Go to Top</span></div>
      <p data-ru="Безопасное продвижение на Wildberries для армянских продавцов." data-am="Անվտանգ առաջխաղացում Wildberries-ում հայ վաճառողների համար։" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="0">${isArmenian ? 'Անվտանգ առաջխաղացում Wildberries-ում հայ վաճառողների համար։' : 'Безопасное продвижение на Wildberries для армянских продавцов.'}</p>
    </div>
    <div class="footer-col" id="footerNavCol">
      <h4 data-ru="Навигация" data-am="Նավիգացիա" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="1">${isArmenian ? 'Նավիգացիա' : 'Навигация'}</h4>
      <ul id="footerNavList">
        <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/services')}" data-ru="Услуги и цены" data-am="Ծառայություններ և գներ" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="2">${isArmenian ? 'Ծառայություններ և գներ' : 'Услуги и цены'}</a></li>
        <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/calculator')}" data-ru="Калькулятор" data-am="Հաշվիչ" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="3">${isArmenian ? 'Հաշվիչ' : 'Калькулятор'}</a></li>
        <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/#warehouse')}" data-ru="Наш склад" data-am="Մեր պահեստը" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="4">${isArmenian ? 'Մեր պահեստը' : 'Наш склад'}</a></li>
        <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/#guarantee')}" data-ru="Гарантии" data-am="Երաշխիքներ" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="5">${isArmenian ? 'Երաշխիքներ' : 'Гарантии'}</a></li>
        <li><a href="${navHrefForLang(isArmenian ? 'am' : 'ru', '/faq')}" data-ru="FAQ" data-am="ՀՏՀ" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="6">${isArmenian ? 'ՀՏՀ' : 'FAQ'}</a></li>
      </ul>
    </div>
    <div class="footer-col" id="footerContactCol">
      <h4 data-ru="Контакты" data-am="Կոնտակտներ" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="7">${isArmenian ? 'Կոնտակտներ' : 'Контакты'}</h4>
      <ul>
        <li><a href="${PLACEHOLDER_TG_URL}" target="_blank" rel="noopener"><i class="fab fa-telegram"></i> <span data-ru="Администратор" data-am="Ադմինիստրատոր" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="8">${isArmenian ? 'Ադմինիստրատոր' : 'Администратор'}</span></a></li>
        <li><a href="https://t.me/suport_admin_2" target="_blank" rel="noopener"><i class="fab fa-telegram"></i> <span data-ru="Менеджер" data-am="Մենեջեր" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="9">${isArmenian ? 'Մենեջեր' : 'Менеджер'}</span></a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Go to Top. <span data-ru="Все права защищены" data-am="Բոլոր իրավունքները պաշտպանված են" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="10">${isArmenian ? 'Բոլոր իրավունքները պաշտպանված են' : 'Все права защищены'}</span></span>
    <span data-ru="Ереван, Армения" data-am="Երևան, Հայաստան" data-no-rewrite="1" data-edit-key="shell__footer" data-edit-idx="11">${isArmenian ? 'Երևան, Հայաստան' : 'Ереван, Армения'}</span>
  </div>
</div>
</footer>

<!-- FLOATING TG BUTTON -->
<a href="https://wa.me/37455226224" target="_blank" class="tg-float">
  <i class="fab fa-whatsapp"></i>
  <span data-ru="Написать нам" data-am="Գրել հիմա" data-no-rewrite="1">${isArmenian ? 'Գրել հիմա' : 'Написать нам'}</span>
</a>

<!-- FLOATING CALC BUTTON -->
<a href="#calculator" class="calc-float" id="calcFloatBtn">
  <i class="fas fa-calculator"></i>
  <span data-ru="Калькулятор" data-am="Հաշվիչ" data-no-rewrite="1">Հաշվիչ</span>
</a>

<!-- CALLBACK MODAL -->
<div id="callbackModal" class="popup-overlay" onclick="if(event.target===this)closeCallbackModal()">
  <div class="popup-card" id="callbackCard">
    <button class="popup-close" onclick="closeCallbackModal()" aria-label="Закрыть">&times;</button>
    <div class="popup-icon"><i class="fas fa-phone-alt"></i></div>
    <h3 data-ru="Перезвоните мне" data-am="Հետ զանգահարեք">${isArmenian ? 'Հետ զանգահարեք' : 'Перезвоните мне'}</h3>
    <p class="popup-sub" data-ru="Оставьте заявку — мы свяжемся в удобное для вас время" data-am="Թողեք հայտ — կզանգահարենք ձեզ հարմար ժամանակ">${isArmenian ? 'Թողեք հայտ — կզանգահարենք ձեզ հարմար ժամանակ' : 'Оставьте заявку — мы свяжемся в удобное для вас время'}</p>
    <form id="callbackForm" onsubmit="submitCallbackForm(event)">
      <div class="pf-group">
        <label class="pf-label" data-ru="Ваше имя *" data-am="Ձեր անունը *">${isArmenian ? 'Ձեր անունը *' : 'Ваше имя *'}</label>
        <input type="text" id="cb_name" class="pf-input" placeholder="Иван Иванов" required>
      </div>
      <div class="pf-group">
        <label class="pf-label" data-ru="Номер телефона *" data-am="Հեռախոսահամար *">${isArmenian ? 'Հեռախոսահամար *' : 'Номер телефона *'}</label>
        <input type="tel" id="cb_phone" class="pf-input" placeholder="+7 (___) ___-__-__" required>
      </div>
      <div class="pf-group">
        <label class="pf-label" data-ru="Удобное время для звонка" data-am="Հարմարավետ ժամ զանգի համար">${isArmenian ? 'Հարմարավետ ժամ զանգի համար' : 'Удобное время для звонка'}</label>
        <input type="text" id="cb_time" class="pf-input" placeholder="Например: после 18:00">
      </div>
      <div class="pf-group">
        <label class="pf-label" data-ru="Ваш вопрос (необязательно)" data-am="Ձեր հարցը (ոչ պարտադիր)">${isArmenian ? 'Ձեր հարցը (ոչ պարտադիր)' : 'Ваш вопрос (необязательно)'}</label>
        <textarea id="cb_question" class="pf-input" rows="3" placeholder="Кратко опишите, что хотите обсудить..." style="resize:vertical;min-height:72px"></textarea>
      </div>
      <div id="callbackResult" style="display:none;padding:12px;border-radius:8px;margin-bottom:12px;font-size:0.88rem;text-align:center"></div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px">
        <i class="fas fa-paper-plane"></i>
        <span data-ru="Отправить заявку" data-am="Ուղարկել հայտը">${isArmenian ? 'Ուղարկել հայտը' : 'Отправить заявку'}</span>
      </button>
    </form>
  </div>
</div>

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
      <h3 data-ru="Повысь рейтинг магазина прямо сейчас!" data-am="Բարձրացրեք խանութի վարկանիշը հիմա!">${isArmenian ? 'Բարձրացրեք խանութի վարկանիշը հիմա!' : 'Повысь рейтинг магазина прямо сейчас!'}</h3>
      <p class="popup-sub" data-ru="Выкупы живыми людьми, отзывы с фото, профессиональные фотосессии. Узнайте сколько это стоит!" data-am="Անձնական մենեջերը կկապվի ձեզ և կպատրաստի անհատական հաշվարկ">Персональный менеджер свяжется с вами и подготовит индивидуальный расчёт</p>
      <form id="popupForm">
        <div class="pf-group">
          <label class="pf-label" data-ru="Ваше имя" data-am="Ձեր անունը" data-no-rewrite="1">${isArmenian ? 'Ձեր անունը' : 'Ваше имя'}</label>
          <input class="pf-input" type="text" id="popupName" required placeholder="Имя" data-placeholder-ru="Имя" data-placeholder-am="Անուն">
        </div>
        <div class="pf-row">
          <div class="pf-group">
            <label class="pf-label" data-ru="Сколько выкупов нужно?" data-am="Քանի գնում է պետք։">${isArmenian ? 'Քանի գնում է պետք։' : 'Сколько выкупов нужно?'}</label>
            <input class="pf-input" type="number" id="popupBuyouts" min="0" placeholder="Напр: 20" required data-placeholder-ru="Напр: 20" data-placeholder-am="Օրինակ: 20">
          </div>
          <div class="pf-group">
            <label class="pf-label" data-ru="Сколько отзывов нужно?" data-am="Քանի կարծիք է պետք։">${isArmenian ? 'Քանի կարծիք է պետք։' : 'Сколько отзывов нужно?'}</label>
            <input class="pf-input" type="number" id="popupReviews" min="0" placeholder="Напр: 10" required data-placeholder-ru="Напр: 10" data-placeholder-am="Օրինակ: 10">
          </div>
        </div>
        <div class="pf-group">
          <label class="pf-label" data-ru="Ваш номер телефона" data-am="Ձեր հեռախոսահամարը">${isArmenian ? 'Ձեր հեռախոսահամարը' : 'Ваш номер телефона'}</label>
          <input class="pf-input" type="tel" id="popupPhone" required>
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px">
          <i class="fas fa-paper-plane"></i>
          <span data-ru="Получить мою стратегию" data-am="Ստանալ իմ ռազմավարությունը">${isArmenian ? 'Ստանալ իմ ռազմավարությունը' : 'Получить мою стратегию'}</span>
        </button>
      </form>
    </div>
    <div class="popup-success" id="popupSuccess">
      <i class="fas fa-check-circle"></i>
      <h4 data-ru="Заявка отправлена!" data-am="Հայտը ուղարկված է!">${isArmenian ? 'Հայտը ուղարկված է!' : 'Заявка отправлена!'}</h4>
      <p data-ru="Менеджер свяжется с вами в ближайшее время" data-am="Մենեջերը կկապվի ձեզ մոտակա ժամանակից">${isArmenian ? 'Մենեջերը կկապվի ձեզ մոտակա ժամանակից' : 'Менеджер свяжется с вами в ближайшее время'}</p>
    </div>
  </div>
</div>

<!-- ===== INLINE BULLETPROOF COUNTER TRIGGER (long landing) =====
     Same guarantee as the shared shell: every [data-count]/[data-count-s]
     number animates within 80-2000ms even if IntersectionObserver / the
     section-revealed cascade / landing.js are slow. Idempotent. -->
<script>
(function(){
  function _animateLL(el, target, suffix){
    if (el.dataset.counterDone === '1') return;
    el.dataset.counterDone = '1';
    if (!target || target <= 0) { el.textContent = '0' + (suffix || ''); return; }
    var dur = 1800, start = performance.now();
    function step(now){
      var p = Math.min((now - start) / dur, 1);
      var v = Math.floor(target * (1 - Math.pow(1 - p, 3)));
      try { el.textContent = v.toLocaleString('ru-RU') + (suffix || ''); }
      catch(_){ el.textContent = v + (suffix || ''); }
      if (p < 1) requestAnimationFrame(step);
      else { try { el.textContent = target.toLocaleString('ru-RU') + (suffix || ''); }
            catch(_){ el.textContent = target + (suffix || ''); } }
    }
    requestAnimationFrame(step);
  }
  function _fireLL(){
    document.querySelectorAll('.stat-num[data-count], .ah-stat-num[data-count]').forEach(function(el){
      _animateLL(el, parseInt(el.getAttribute('data-count')) || 0, '');
    });
    document.querySelectorAll('.stat-big[data-count-s], .ah-stat-num[data-count-s]').forEach(function(el){
      var hasPlus = (el.textContent || '').indexOf('+') !== -1;
      _animateLL(el, parseInt(el.getAttribute('data-count-s')) || 0, hasPlus ? '+' : '');
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(_fireLL, 80); });
  } else { setTimeout(_fireLL, 80); }
  setTimeout(_fireLL, 600);
  setTimeout(_fireLL, 2000);
})();
</script>

<script src="/static/editor.js?v=${CACHE_VERSION}" defer></script>
<script src="/static/landing.js?v=${CACHE_VERSION}" defer></script>

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
  
  // Photo injection — DISABLED for design-locked sections (hero/about/guarantee).
  // These sections have static design images baked into the SSR template; allowing
  // override via site_blocks.photo_url proved fragile (admins occasionally uploaded
  // unrelated screenshots that then replaced the founder/team photos site-wide).
  // Custom photo replacement for these specific images now goes exclusively through
  // the inline visual editor (`site_text_overrides`), which keeps overrides scoped
  // to a specific <img> element via its data-edit-img id rather than a global
  // string replace on the page HTML.
  // NOTE: photoMap is still loaded above for compatibility but no longer applied
  // to founder.jpg / about-hero2.jpg / team-office.jpg.
  
  // Mark as server-injected and apply text replacements if we have changes.
  // (`server-injected` is now always set on the legacy home shell — see
  // template above — so this branch is effectively a no-op kept only as a
  // safety net for any future template variant that omits the class.)
  const hasTextChanges = Object.keys(textMap).length > 0;
  const hasButtonChanges = Object.keys(buttonMap).length > 0;
  const hasAnyServerChanges = hasTextChanges || hasButtonChanges || Object.keys(styleMap).length > 0 || Object.keys(orderMap).length > 0 || Object.keys(photoSettingsMap).length > 0;
  if (hasAnyServerChanges && !pageHtml.includes('class="server-injected"')) {
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
          // Set target: internal anchor links (#calculator etc.) should not open in new tab
          const btnHref = dbBtn.url || el.getAttribute('href') || '';
          if (btnHref.startsWith('#')) {
            // Use _self (not removeAttribute) — HTMLRewriter removeAttribute is unreliable
            // when the attribute doesn't exist yet or was set by a previous handler
            el.setAttribute('target', '_self');
          } else {
            el.setAttribute('target', '_blank');
          }
          
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
  
  // ===== SERVER-SIDE CONTACT CARD REPLACEMENT =====
  // Replace hardcoded Telegram contact card URLs with admin-configured URLs (WhatsApp etc.)
  // This prevents users from clicking Telegram links before client-side JS loads
  {
    const ssrBlockFeatures: any[] = (globalThis as any).__blockFeatures || [];
    const contactBf = ssrBlockFeatures.find((b: any) => b.key === 'contact');
    const contactCards: any[] = contactBf?.contact_cards || [];
    if (contactCards.length > 0) {
      // Replace first contact card (Администратор)
      if (contactCards[0]?.url) {
        const ccUrl = contactCards[0].url;
        const ccIsWa = ccUrl.includes('wa.me') || ccUrl.includes('whatsapp');
        const ccIcon = (contactCards[0].icon && contactCards[0].icon !== 'auto')
          ? contactCards[0].icon
          : (ccIsWa ? 'fab fa-whatsapp' : 'fab fa-telegram');
        pageHtml = pageHtml.replace(
          /<a href="https:\/\/t\.me\/goo_to_top" target="_blank" class="contact-card">\s*<i class="fab fa-telegram"><\/i>/,
          `<a href="${ccUrl}" target="_blank" class="contact-card">\n      <i class="${ccIcon}"></i>`
        );
      }
      // Replace second contact card (Менеджер)
      if (contactCards.length > 1 && contactCards[1]?.url) {
        const ccUrl2 = contactCards[1].url;
        const ccIsWa2 = ccUrl2.includes('wa.me') || ccUrl2.includes('whatsapp');
        const ccIcon2 = (contactCards[1].icon && contactCards[1].icon !== 'auto')
          ? contactCards[1].icon
          : (ccIsWa2 ? 'fab fa-whatsapp' : 'fab fa-telegram');
        pageHtml = pageHtml.replace(
          /<a href="https:\/\/t\.me\/suport_admin_2" target="_blank" class="contact-card">\s*<i class="fab fa-telegram"><\/i>/,
          `<a href="${ccUrl2}" target="_blank" class="contact-card">\n      <i class="${ccIcon2}"></i>`
        );
      }
    }
  }
  
  // ===== SERVER-SIDE FLOATING BUTTON REPLACEMENT =====
  // Replace hardcoded floating button URL with admin-configured one
  if (buttonMap['floating_tg'] && buttonMap['floating_tg'].length > 0) {
    const floatDbBtn = buttonMap['floating_tg'][0];
    if (floatDbBtn.url) {
      const floatIsWa = floatDbBtn.url.includes('wa.me') || floatDbBtn.url.includes('whatsapp');
      const floatIcon = (floatDbBtn.icon && floatDbBtn.icon !== 'auto') ? floatDbBtn.icon : (floatIsWa ? 'fab fa-whatsapp' : 'fab fa-telegram');
      const floatTextRu = floatDbBtn.text_ru || 'Написать нам';
      const floatTextAm = floatDbBtn.text_am || '\u0533\u0580\u0565\u056c \u0570\u056b\u0574\u0561';
      const floatText = isArmenian ? floatTextAm : floatTextRu;
      pageHtml = pageHtml.replace(
        /<a href="https:\/\/wa\.me\/37455226224" target="_blank" class="tg-float">\s*<i class="fab fa-whatsapp"><\/i>\s*<span[^>]*>[^<]*<\/span>/,
        `<a href="${floatDbBtn.url}" target="_blank" class="tg-float">\n  <i class="${floatIcon}"></i>\n  <span data-ru="${floatTextRu.replace(/"/g,'&quot;')}" data-am="${floatTextAm.replace(/"/g,'&quot;')}" data-no-rewrite="1">${floatText}</span>`
      );
    }
  }

  // ===== SERVER-SIDE NAV CTA REPLACEMENT =====
  // Replace desktop nav CTA URL with admin floating_tg button URL  
  if (buttonMap['floating_tg'] && buttonMap['floating_tg'].length > 0) {
    const navDbBtn = buttonMap['floating_tg'][0];
    if (navDbBtn.url) {
      const navIsWa = navDbBtn.url.includes('wa.me') || navDbBtn.url.includes('whatsapp');
      const navIcon = navIsWa ? 'fab fa-whatsapp' : 'fab fa-telegram';
      const navTextRu = navDbBtn.text_ru || '\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u043d\u0430\u043c';
      const navTextAm = navDbBtn.text_am || '\u0533\u0580\u0565\u056c \u0570\u056b\u0574\u0561';
      const navText = isArmenian ? navTextAm : navTextRu;
      pageHtml = pageHtml.replace(
        /<a href="https:\/\/wa\.me\/37455226224" target="_blank" class="nav-cta">\s*<i class="fab fa-whatsapp"><\/i>\s*<span[^>]*>[^<]*<\/span>\s*<\/a>/,
        `<a href="${navDbBtn.url}" target="_blank" class="nav-cta">\n      <i class="${navIcon}"></i>\n      <span data-ru="${navTextRu.replace(/"/g,'&quot;')}" data-am="${navTextAm.replace(/"/g,'&quot;')}">${navText}</span>\n    </a>`
      );
    }
  }
  // Replace calc button URL if calculator has buttons, or use floating_tg URL as fallback
  {
    const calcBtns = buttonMap['calculator'];
    const floatBtns = buttonMap['floating_tg'];
    let calcUrl = '';
    if (calcBtns && calcBtns.length > 0 && calcBtns[0].url) {
      calcUrl = calcBtns[0].url;
    } else if (floatBtns && floatBtns.length > 0 && floatBtns[0].url) {
      calcUrl = floatBtns[0].url;
    }
    if (calcUrl) {
      const calcIsWa = calcUrl.includes('wa.me') || calcUrl.includes('whatsapp');
      const calcIcon = calcIsWa ? 'fab fa-whatsapp' : 'fab fa-telegram';
      pageHtml = pageHtml.replace(
        /<a href="https:\/\/wa\.me\/37455226224" id="calcTgBtn"/,
        `<a href="${calcUrl}" id="calcTgBtn"`
      );
    }
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
    let ssrPkgs = (globalThis as any).__ssrPackages || [];
    // Hide packages without RUB pricing on /ru — RU customers should not see ֏-only packages.
    if (!isArmenian) {
      ssrPkgs = ssrPkgs.filter((p: any) => Number(p.package_price_rub) > 0);
    }
    if (ssrPkgs.length > 0) {
      // Currency symbol for SSR — bound to language, just like the client-side helper.
      const SSR_CUR = isArmenian ? '\u058f' : '\u20bd';
      // Pull through helpers: prefer RUB on /ru when set, otherwise AMD.
      const ssrPkgPrice = (p: any) => !isArmenian && Number(p.package_price_rub) > 0 ? Number(p.package_price_rub) : Number(p.package_price) || 0;
      const ssrPkgOrig = (p: any) => !isArmenian && Number(p.original_price_rub) > 0 ? Number(p.original_price_rub) : Number(p.original_price) || 0;
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
        otherSsrPkgs.sort((a: any, b: any) => (ssrPkgPrice(a) || 0) - (ssrPkgPrice(b) || 0));
      let sortedSsrPkgs: any[];
      if (goldSsrPkg) {
        const leftSsr = otherSsrPkgs.slice(0, Math.ceil(otherSsrPkgs.length / 2));
        const rightSsr = otherSsrPkgs.slice(Math.ceil(otherSsrPkgs.length / 2));
        sortedSsrPkgs = [...leftSsr, goldSsrPkg, ...rightSsr];
      } else {
        sortedSsrPkgs = otherSsrPkgs;
      }
      for (const pk of sortedSsrPkgs) {
        const pkPriceCur = ssrPkgPrice(pk);
        const pkOrigCur = ssrPkgOrig(pk);
        const disc = pkOrigCur > 0 ? Math.round((1 - pkPriceCur / pkOrigCur) * 100) : 0;
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
        if (pkOrigCur > 0 && pkOrigCur > pkPriceCur) {
          pkgHtml += '<span class="pkg-old-price">' + fmtN(pkOrigCur) + ' ' + SSR_CUR + '</span>';
        }
        pkgHtml += '<span class="pkg-new-price">' + fmtN(pkPriceCur) + ' ' + SSR_CUR + '</span>';
        if (disc > 0) pkgHtml += '<span class="pkg-discount">\u2212' + disc + '%</span>';
        pkgHtml += '</div>';
        if (pk.items && pk.items.length > 0) {
          pkgHtml += '<div class="pkg-items">';
          for (const pi of pk.items) {
            const piQty = pi.quantity || 1;
            let piExtra = '';
            if (pi.use_tiered && pi.price_type === 'tiered' && pi.price_tiers_json) {
              try {
                // Pick RU tiers when on /ru and they exist; otherwise AMD tiers.
                let piTiers: any[] = JSON.parse(pi.price_tiers_json as string);
                if (!isArmenian && pi.price_tiers_rub_json) {
                  try {
                    const rubT: any[] = JSON.parse(pi.price_tiers_rub_json as string);
                    if (Array.isArray(rubT) && rubT.length > 0 && rubT.some((t: any) => Number(t.price) > 0)) piTiers = rubT;
                  } catch {}
                }
                let piUnitP = 0;
                for (const t of piTiers) { if (piQty >= t.min && piQty <= t.max) { piUnitP = t.price; break; } }
                if (!piUnitP && piTiers.length) piUnitP = piTiers[piTiers.length - 1].price;
                piExtra = ' <span style="color:#a78bfa;font-size:0.72rem">(' + fmtN(piUnitP) + ' ' + SSR_CUR + '/\u0448\u0442)</span>';
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
        contactHtml += '        <li><a href="https://wa.me/37455226224" target="_blank"><i class="fab fa-whatsapp"></i> <span data-ru="\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440" data-am="\u0531\u0564\u0574\u056b\u0576\u056b\u057d\u057f\u0580\u0561\u057f\u0578\u0580" data-no-rewrite="1">\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440</span></a></li>\n';
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
    // The legacy `/` page now ships the SAME static nav as renderPageShell
    // subpages (Главная, О нас, Услуги, Выкупы, Калькулятор, FAQ, Контакты,
    // Промокоды, Блог + CTA), with `data-edit-key="shell__nav"` on every
    // item. Inline-editor text edits save under the shared `shell` namespace
    // (page='shell'), and applyTextOverridesSSR loads page=? OR page='shell'
    // on every subpage — so a single edit on `/` propagates to `/home`,
    // `/about`, etc. automatically. The previous DB-driven `nav` block
    // injection is intentionally NOT used here anymore: it replaced the
    // standard nav with social-link items (Instagram / Telegram bot / …)
    // which broke unification with the new visual.
  }
  
  // ===== 8. SERVER-SIDE SEO / OPEN GRAPH INJECTION =====
  const seoBlock = (globalThis as any).__seoOgBlock;
  delete (globalThis as any).__seoOgBlock;
  if (seoBlock) {
    let seoTextsRu: string[] = [];
    let seoTextsAm: string[] = [];
    try { seoTextsRu = JSON.parse(seoBlock.texts_ru || '[]'); } catch { seoTextsRu = []; }
    try { seoTextsAm = JSON.parse(seoBlock.texts_am || '[]'); } catch { seoTextsAm = []; }
    let seoImage = (seoBlock.photo_url || '').trim();
    // Validate internal upload URLs — if the upload doesn't exist in DB,
    // fall back to the default static OG image so Telegram/WhatsApp always show a logo.
    if (seoImage) {
      const uploadMatch = seoImage.match(/\/api\/admin\/uploads\/(\d+)/);
      if (uploadMatch) {
        try {
          const uploadId = uploadMatch[1];
          const uploadRow = await c.env.DB.prepare('SELECT id FROM uploads WHERE id = ?').bind(uploadId).first();
          if (!uploadRow) {
            // Upload missing (DB reset / migration) — use default static image
            seoImage = '/static/img/og-image-dark.png';
          }
        } catch {
          // DB error — fall back to static image
          seoImage = '/static/img/og-image-dark.png';
        }
      }
    }
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
      // Update og:url and canonical to include /am path (always use primary domain)
      pageHtml = pageHtml.replace(
        /<meta property="og:url" content="[^"]*">/,
        `<meta property="og:url" content="https://gototopwb.ru/am">`
      );
      pageHtml = pageHtml.replace(
        /<link rel="canonical" href="[^"]*">/,
        `<link rel="canonical" href="https://gototopwb.ru/am">`
      );
      // Set html lang
      pageHtml = pageHtml.replace(/<html lang="ru"/, '<html lang="hy"');
    }
  }
  
  // Clean up globals
  const soCount = (globalThis as any).__sectionOrderCount || 0;
  delete (globalThis as any).__sectionOrderCount;
  const reorderDebug = (globalThis as any).__reorderDebug || '';
  delete (globalThis as any).__reorderDebug;
  
  // Add marker so client-side JS knows server already handled reordering
  if (sectionOrder.length > 0) {
    pageHtml = pageHtml.replace(/<html lang="(ru|hy)"/, '<html lang="$1" data-server-ordered="1"');
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
      "let lang = localStorage.getItem('gtt_lang') || 'ru';",
      "let lang = 'am'; localStorage.setItem('gtt_lang','am');"
    );
  }

  // === SEO: Organization JSON-LD (Phase 3A.3) ===
  // Inject schema.org Organization so Google can show the knowledge-panel
  // entry (logo, contact, sameAs links). Inserted before __SITE_DATA below.
  const orgJsonLd = buildOrganizationLd(siteOrigin);
  pageHtml = pageHtml.replace('</head>', orgJsonLd + '\n</head>');

  // === Inline site-data (started in parallel at the beginning) ===
  // 5s timeout: if /api/site-data is slow, render without inlined data
  // (calculator falls back to a client-side fetch instead of hanging the page).
  // Escape `</` in the JSON to prevent any chance of breaking out of the
  // <script> block (defense-in-depth — JSON.stringify already escapes most things).
  // If injection fails, override Cache-Control to no-store so the broken-without-
  // calculator response never gets stuck in edge cache (Phase 3A.1 — fixes the
  // /buyouts AM stale cache where __SITE_DATA was missing).
  const siteDataJson = await Promise.race<string | null>([
    siteDataPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
  ]);
  if (siteDataJson) {
    const safeSiteData = siteDataJson.replace(/<\//g, '<\\/');
    pageHtml = pageHtml.replace('</head>', '<script>window.__SITE_DATA=' + safeSiteData + '</script>\n</head>');
  } else {
    c.header('Cache-Control', 'no-store, max-age=0');
  }

  // Inline dynamic data (photo_blocks + footer_settings) so landing.js renders
  // them synchronously on first paint instead of after a network round-trip.
  // Without this, photo blocks pop in 200-500ms after the initial layout and
  // create the visual flicker the user reported.
  try {
    const dynScript = await buildInlineDynamicScript(c.env.DB);
    pageHtml = pageHtml.replace('</head>', dynScript + '\n</head>');
  } catch { /* best-effort; landing.js will fall back to fetch */ }

  // Phase 5.1.4: Render custom blocks added via inline editor for the legacy
  // landing (page = "home_legacy"). All blocks are appended just before the
  // <footer> in document order. We previously tried to inject AT the chosen
  // anchor's position via regex, but the legacy landing nests its sections
  // under multiple wrappers; the regex matched the OPENING tag and inserted
  // INSIDE the anchor section, breaking layout. Until we have a reliable
  // anchor-aware injection strategy (e.g. SSR-time sentinels), use the safe
  // before-footer placement.
  try {
    const customBlocks = await loadCustomBlocks(c.env.DB, 'home_legacy')
    if (customBlocks.length) {
      const lang: 'ru' | 'am' = isArmenian ? 'am' : 'ru'
      const cbHtml = renderCustomBlocksHtml(customBlocks, lang)
      pageHtml = pageHtml.replace('<footer class="footer">', cbHtml + '\n<footer class="footer">')
    }
  } catch (_e) {
    // Don't break SSR if custom-blocks load fails
  }

  // Phase 5.1.5: Apply persisted inline-editor overrides to the rendered
  // HTML in-place so the body that arrives at the browser already shows
  // the latest text. This is what lets us drop the `gtt-loading` body
  // hider — there's nothing for editor.js to do on first paint anymore.
  // The HTMLRewriter pass also stamps deterministic `data-edit-text` ids
  // matching what editor.js's `assignTextIds()` would compute, AND inlines
  // `window.__GTT_OVERRIDES` into <head> for editor.js's edit-mode UI and
  // for any client-side fallback (e.g. dynamically injected images).
  pageHtml = await applyTextOverridesSSR(pageHtml, 'home_legacy', isArmenian ? 'am' : 'ru', c.env.DB);

  return c.html(pageHtml);
})

// ===== PHASE 5: NEW HOME (staging at /home) =====
// Subpage-styled rebuild of the home page. Will replace the legacy
// `/` handler in Phase 6 once content is approved by the owner. Uses
// the same renderPageShell as the other subpages so navigation, footer,
// counter logic and i18n are 100% consistent.
// __SITE_DATA injection mirrors /services and /buyouts so any future
// calculator block on this page can render without an extra DB round-trip.
app.get('/home', async (c) => {
  // Browsers must revalidate every refresh (max-age=0) so admin text/photo
  // edits never produce a "show old → flash new" delay; edge keeps the page
  // hot for ~10min via s-maxage so first-paint stays fast for new visitors.
  c.header('Cache-Control', 'public, max-age=0, s-maxage=600, must-revalidate');
  c.header('Vary', 'Accept-Encoding, Cookie');

  const reqUrl = new URL(c.req.url);
  const urlLang = reqUrl.searchParams.get('lang') || '';
  const cookieLang = readLangCookie(c);
  const lang: 'ru' | 'am' = (urlLang === 'am' || urlLang === 'hy') ? 'am'
                          : (urlLang === '' && cookieLang === 'am' ? 'am' : 'ru');
  const siteOrigin = reqUrl.origin;

  // Phase 4 — Load home__* page blocks + shell__* chrome blocks in
  // parallel via the standard loadSubpageBlocks/loadShellBlocks helpers.
  // Both fall back silently to {} on any DB error so the renderer's
  // hardcoded fallbacks always render the page identically.
  const [pageBlocks, shellBlocks, customBlocks] = await Promise.all([
    loadSubpageBlocks(c.env.DB, 'home'),
    loadShellBlocks(c.env.DB),
    loadCustomBlocks(c.env.DB, 'home'),
  ]);

  // Heavy page: prefetch /api/site-data in parallel so client JS doesn't
  // need a second round-trip. Same defensive pattern as /services.
  // Phase 3: site-data now also carries `landingPackages` for the new
  // marketing-tiles section — we extract it from the response below
  // (one DB round-trip instead of two).
  const siteDataPromise = (async () => {
    try {
      const req = new Request(new URL('/api/site-data', c.req.url).toString());
      const resp = await app.fetch(req, c.env);
      return resp.ok ? await resp.text() : null;
    } catch { return null; }
  })();
  const siteDataJson = await Promise.race<string | null>([
    siteDataPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
  ]);
  let landingPackages: any[] = [];
  if (siteDataJson) {
    try {
      const parsed = JSON.parse(siteDataJson);
      if (Array.isArray(parsed?.landingPackages)) {
        landingPackages = parsed.landingPackages;
      }
    } catch { /* malformed JSON — keep empty */ }
  }
  let pageHtml = renderNewHomePage({ lang, siteOrigin, pageBlocks, shellBlocks, landingPackages, customBlocks });
  if (siteDataJson) {
    const safeSiteData = siteDataJson.replace(/<\//g, '<\\/');
    pageHtml = pageHtml.replace(
      '</head>',
      '<script>window.__SITE_DATA=' + safeSiteData + '</script>\n</head>'
    );
  } else {
    c.header('Cache-Control', 'no-store, max-age=0');
  }
  try {
    const dynScript = await buildInlineDynamicScript(c.env.DB);
    pageHtml = pageHtml.replace('</head>', dynScript + '\n</head>');
  } catch { /* best-effort */ }
  // Phase 5.1.5: SSR-apply inline-editor overrides — see applyTextOverridesSSR
  // doc-comment for rationale. This is what removes the "old → new" flicker
  // and lets us drop the gtt-loading body hider.
  pageHtml = await applyTextOverridesSSR(pageHtml, 'home', lang, c.env.DB);
  return c.html(pageHtml);
});

// ===== /package/:slug — Phase 3 detail pages for landing packages =====
// Reads landing_packages by slug, fetches up to 4 other visible packages
// for the cross-link grid at the bottom, and renders via renderPackagePage.
// Returns a 404 HTML page if slug is missing or hidden.
app.get('/package/:slug', async (c) => {
  // Browsers must revalidate every refresh (max-age=0) so admin text/photo
  // edits never produce a "show old → flash new" delay; edge keeps the page
  // hot for ~10min via s-maxage so first-paint stays fast for new visitors.
  c.header('Cache-Control', 'public, max-age=0, s-maxage=600, must-revalidate');
  c.header('Vary', 'Accept-Encoding, Cookie');

  const reqUrl = new URL(c.req.url);
  const urlLang = reqUrl.searchParams.get('lang') || '';
  const cookieLang = readLangCookie(c);
  const lang: 'ru' | 'am' = (urlLang === 'am' || urlLang === 'hy') ? 'am'
                          : (urlLang === '' && cookieLang === 'am' ? 'am' : 'ru');
  const siteOrigin = reqUrl.origin;
  const slug = c.req.param('slug') || '';

  if (!/^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$/.test(slug)) {
    c.header('Cache-Control', 'no-store, max-age=0');
    return c.html('<!doctype html><meta charset="utf-8"><title>404</title><h1>Package not found</h1><p><a href="/home">Go home</a></p>', 404);
  }

  let pkg: any = null;
  let others: any[] = [];
  let pageBlocks: Record<string, SubpageBlock> = {};
  let shellBlocks: Record<string, SubpageBlock> = {};
  try {
    const db = c.env.DB;
    if (db) {
      await initDatabase(db);
      // Phase 4 — load package__* + shell__* in parallel with the
      // package row + cross-link rows so the detail page stays fast.
      const [pkgRow, blocksByPage, blocksByShell] = await Promise.all([
        db.prepare(
          'SELECT id, slug, title_ru, title_am, description_ru, description_am, price_text_ru, price_text_am, cover_url FROM landing_packages WHERE slug = ? AND is_visible = 1'
        ).bind(slug).first(),
        loadSubpageBlocks(db, 'package'),
        loadShellBlocks(db),
      ]);
      pkg = pkgRow;
      pageBlocks = blocksByPage;
      shellBlocks = blocksByShell;
      if (pkg) {
        const otherRes = await db.prepare(
          'SELECT id, slug, title_ru, title_am, cover_url FROM landing_packages WHERE is_visible = 1 AND id != ? ORDER BY sort_order, id LIMIT 4'
        ).bind(pkg.id).all<any>();
        others = otherRes.results || [];
      }
    }
  } catch { /* fall through to 404 */ }

  if (!pkg) {
    c.header('Cache-Control', 'no-store, max-age=0');
    return c.html(
      '<!doctype html><meta charset="utf-8"><title>404 — Package not found</title><h1>Package not found</h1><p><a href="/home">Back to home</a></p>',
      404
    );
  }

  let pageHtml = renderPackagePage({ lang, siteOrigin, pkg, otherPackages: others, pageBlocks, shellBlocks });
  try {
    const dynScript = await buildInlineDynamicScript(c.env.DB);
    pageHtml = pageHtml.replace('</head>', dynScript + '\n</head>');
  } catch { /* best-effort */ }
  // Use slug-scoped page key so each landing package has its own text/image
  // override namespace. Previously all `/package/*` URLs shared the `package`
  // namespace, which caused a text edit on /package/wb-buyouts to globally
  // override the h1/description of every other package detail page.
  pageHtml = await applyTextOverridesSSR(pageHtml, `package__${pkg.slug}`, lang, c.env.DB);
  return c.html(pageHtml);
});

// ===== /services/reviews — отдельная детальная страница «Отзывы под ключ» =====
app.get('/services/reviews', async (c) => {
  c.header('Cache-Control', 'public, max-age=0, s-maxage=600, must-revalidate');
  c.header('Vary', 'Accept-Encoding, Cookie');

  const reqUrl = new URL(c.req.url);
  const urlLang = reqUrl.searchParams.get('lang') || '';
  const cookieLang = readLangCookie(c);
  const lang: 'ru' | 'am' =
    urlLang === 'am' || urlLang === 'hy' ? 'am' : urlLang === '' && cookieLang === 'am' ? 'am' : 'ru';
  const siteOrigin = reqUrl.origin;

  const [pageBlocks, shellBlocks] = await Promise.all([
    loadSubpageBlocks(c.env.DB, 'reviews'),
    loadShellBlocks(c.env.DB),
  ]);

  let pageHtml = renderServiceReviewsPage({ lang, siteOrigin, pageBlocks, shellBlocks });
  try {
    const dynScript = await buildInlineDynamicScript(c.env.DB);
    pageHtml = pageHtml.replace('</head>', dynScript + '\n</head>');
  } catch { /* best-effort */ }
  pageHtml = await applyTextOverridesSSR(pageHtml, 'reviews', lang, c.env.DB);
  return c.html(pageHtml);
});

// ===== PLACEHOLDER PAGES (Phase 1) =====
// Pure-SSR placeholder routes for /about /buyouts /services /faq /contacts /referral.
// Phase 2 progressively replaces these with real content. /about (2A) and
// /services (2B) are already migrated; the rest still use the lightweight
// placeholder shell. All share the same header/footer/popup/bottom-nav and
// load /static/landing.js.
const PLACEHOLDER_PAGES: PlaceholderPage[] = ['about', 'buyouts', 'services', 'faq', 'contacts', 'referral'];
for (const page of PLACEHOLDER_PAGES) {
  app.get(`/${page}`, async (c) => {
    // Same cache header strategy as `/` — wrapped by edge cache in src/index.tsx.
    // Browsers must revalidate every refresh (max-age=0) so admin text/photo
    // edits never produce a "show old → flash new" delay; edge keeps the page
    // hot for ~10min via s-maxage so first-paint stays fast for new visitors.
    c.header('Cache-Control', 'public, max-age=0, s-maxage=600, must-revalidate');
    c.header('Vary', 'Accept-Encoding, Cookie');

    // Language detection mirrors `/`: URL path, ?lang= query, gtt_lang cookie,
    // then default RU.
    const reqUrl = new URL(c.req.url);
    const reqPath = reqUrl.pathname;
    const pathLang = reqPath === '/am' ? 'am' : (reqPath === '/ru' ? 'ru' : '');
    const urlLang = pathLang || reqUrl.searchParams.get('lang') || '';
    const acceptLang = (c.req.header('Accept-Language') || '').toLowerCase();
    void acceptLang; // reserved for future use, mirrors `/` route
    const cookieLang = readLangCookie(c);
    const lang: 'ru' | 'am' = (urlLang === 'am' || urlLang === 'hy') ? 'am'
                            : (urlLang === '' && cookieLang === 'am' ? 'am' : 'ru');
    const siteOrigin = reqUrl.origin;

    // Phase 3C: load subpage blocks from CMS for the requested page.
    // Phase 4: also load shell__* blocks (header / footer / modal /
    // floats / bottom nav) in parallel so renderPageShell can apply
    // CMS overrides. Failures fall back silently — render functions
    // have hardcoded fallbacks via the local `tb()` helpers.
    const [pageBlocks, shellBlocks] = await Promise.all([
      loadSubpageBlocks(c.env.DB, page),
      loadShellBlocks(c.env.DB),
    ]);

    // /about now has real content (phase 2A); the rest stay on the
    // placeholder shell until their respective phase-2 subtasks land.
    if (page === 'about') {
      let aboutHtml = renderAboutPage({ lang, siteOrigin, pageBlocks, shellBlocks });
      try {
        const dynScript = await buildInlineDynamicScript(c.env.DB);
        aboutHtml = aboutHtml.replace('</head>', dynScript + '\n</head>');
      } catch { /* best-effort */ }
      aboutHtml = await applyTextOverridesSSR(aboutHtml, 'about', lang, c.env.DB);
      return c.html(aboutHtml);
    }
    // /services (phase 2B): heavy page with the full calculator. Mirrors
    // the `/` route — kicks off a parallel /api/site-data fetch and inlines
    // the JSON as `window.__SITE_DATA` before `</head>` so the calculator
    // renders packages/tabs/prices without an extra client round-trip.
    if (page === 'services') {
      const siteDataPromise = (async () => {
        try {
          const req = new Request(new URL('/api/site-data', c.req.url).toString());
          const resp = await app.fetch(req, c.env);
          return resp.ok ? await resp.text() : null;
        } catch { return null; }
      })();
      let pageHtml = renderServicesPage({ lang, siteOrigin, pageBlocks, shellBlocks });
      // 5s timeout + `</` escape — same defensive pattern as the `/` route.
      // On fail: no-store so the calculator-less response doesn't poison cache.
      const siteDataJson = await Promise.race<string | null>([
        siteDataPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      ]);
      if (siteDataJson) {
        const safeSiteData = siteDataJson.replace(/<\//g, '<\\/');
        pageHtml = pageHtml.replace(
          '</head>',
          '<script>window.__SITE_DATA=' + safeSiteData + '</script>\n</head>'
        );
      } else {
        c.header('Cache-Control', 'no-store, max-age=0');
      }
      try {
        const dynScript = await buildInlineDynamicScript(c.env.DB);
        pageHtml = pageHtml.replace('</head>', dynScript + '\n</head>');
      } catch { /* best-effort */ }
      pageHtml = await applyTextOverridesSSR(pageHtml, 'services', lang, c.env.DB);
      return c.html(pageHtml);
    }
    // /buyouts (phase 2C): heavy page with topical Wildberries-buyouts
    // content + the full calculator. Same `__SITE_DATA` injection pattern
    // as `/services` so the calculator renders packages/tabs/prices
    // without an extra client round-trip.
    if (page === 'buyouts') {
      const siteDataPromise = (async () => {
        try {
          const req = new Request(new URL('/api/site-data', c.req.url).toString());
          const resp = await app.fetch(req, c.env);
          return resp.ok ? await resp.text() : null;
        } catch { return null; }
      })();
      let pageHtml = renderBuyoutsPage({ lang, siteOrigin, pageBlocks, shellBlocks });
      // 5s timeout + escape closing tags — same defensive pattern as the `/` route.
      // On fail: no-store so the calculator-less response doesn't poison cache.
      const siteDataJson = await Promise.race<string | null>([
        siteDataPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      ]);
      if (siteDataJson) {
        const safeSiteData = siteDataJson.replace(/<\//g, '<\\/');
        pageHtml = pageHtml.replace(
          '</head>',
          '<script>window.__SITE_DATA=' + safeSiteData + '</script>\n</head>'
        );
      } else {
        c.header('Cache-Control', 'no-store, max-age=0');
      }
      try {
        const dynScript = await buildInlineDynamicScript(c.env.DB);
        pageHtml = pageHtml.replace('</head>', dynScript + '\n</head>');
      } catch { /* best-effort */ }
      pageHtml = await applyTextOverridesSSR(pageHtml, 'buyouts', lang, c.env.DB);
      return c.html(pageHtml);
    }
    // /faq (phase 2D): light page — compact hero, 12-item bilingual
    // accordion (toggleFaq() lives in landing.js) and a small CTA strip.
    // No __SITE_DATA injection: the calculator is not used here, so we
    // skip the extra D1 round-trip and keep the page maximally cacheable.
    // SEO is amplified with a JSON-LD FAQPage block emitted via extraHead.
    // Inject inline photo_blocks/footer data once for all light subpages so
    // landing.js renders them synchronously without an extra round-trip,
    // and apply persisted text overrides server-side (Phase 5.1.5) so the
    // first paint already shows the latest text — no flicker.
    const _injectDyn = async (html: string): Promise<string> => {
      try {
        const dynScript = await buildInlineDynamicScript(c.env.DB);
        html = html.replace('</head>', dynScript + '\n</head>');
      } catch { /* keep html unchanged */ }
      return await applyTextOverridesSSR(html, page, lang, c.env.DB);
    };
    if (page === 'faq') {
      const html = renderFaqPage({ lang, siteOrigin, pageBlocks, shellBlocks });
      return c.html(await _injectDyn(html));
    }
    // /contacts (phase 2E): heavy page with channels grid (Telegram x2 +
    // WhatsApp), QR codes, lead form (#leadForm → submitForm() in
    // landing.js → POST /api/lead), address/hours and a final callback
    // CTA strip. No __SITE_DATA injection: the calculator isn't used
    // here, so we skip the extra D1 round-trip and stay edge-cacheable.
    if (page === 'contacts') {
      const html = renderContactsPage({ lang, siteOrigin, pageBlocks, shellBlocks });
      return c.html(await _injectDyn(html));
    }
    // /referral (phase 2F): light partner-program page — hero, 3 steps,
    // audience cards (mirrors home #for-whom), bonus tiers (5/8/15%),
    // referral-specific FAQ accordion (re-uses .faq-item via local CSS
    // copy so toggleFaq() in landing.js works) and a CTA strip. No
    // __SITE_DATA injection: the calculator and #refCodeInput are not
    // used here, so the page stays maximally edge-cacheable.
    if (page === 'referral') {
      const html = renderReferralPage({ lang, siteOrigin, pageBlocks, shellBlocks });
      return c.html(await _injectDyn(html));
    }
    return c.html(await _injectDyn(renderPlaceholderPage({ page, lang, siteOrigin, shellBlocks })));
  });
}

// ===== /calculator (Phase 5c) =====
// Standalone calculator page. Same `__SITE_DATA` injection pattern as
// /services/buyouts so window._calcPackages and the tab/qty/total wiring
// in landing.js initialise the calculator without an extra fetch.
app.get('/calculator', async (c) => {
  // Browsers must revalidate every refresh (max-age=0) so admin text/photo
  // edits never produce a "show old → flash new" delay; edge keeps the page
  // hot for ~10min via s-maxage so first-paint stays fast for new visitors.
  c.header('Cache-Control', 'public, max-age=0, s-maxage=600, must-revalidate');
  c.header('Vary', 'Accept-Encoding, Cookie');
  const reqUrl = new URL(c.req.url);
  const urlLang = reqUrl.searchParams.get('lang') || '';
  const cookieLang = readLangCookie(c);
  const lang: 'ru' | 'am' = (urlLang === 'am' || urlLang === 'hy') ? 'am'
                          : (urlLang === '' && cookieLang === 'am' ? 'am' : 'ru');
  const siteOrigin = reqUrl.origin;

  // Phase 4 — load calculator__* page blocks + shell__* chrome blocks
  // in parallel with the /api/site-data prefetch. All three failures
  // fall back silently so the page always renders via hardcoded copy.
  const siteDataPromise = (async () => {
    try {
      const req = new Request(new URL('/api/site-data', c.req.url).toString());
      const resp = await app.fetch(req, c.env);
      return resp.ok ? await resp.text() : null;
    } catch { return null; }
  })();
  const [pageBlocks, shellBlocks] = await Promise.all([
    loadSubpageBlocks(c.env.DB, 'calculator'),
    loadShellBlocks(c.env.DB),
  ]);

  let pageHtml = renderCalculatorPage({ lang, siteOrigin, pageBlocks, shellBlocks });
  const siteDataJson = await Promise.race<string | null>([
    siteDataPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
  ]);
  if (siteDataJson) {
    const safeSiteData = siteDataJson.replace(/<\//g, '<\\/');
    pageHtml = pageHtml.replace(
      '</head>',
      '<script>window.__SITE_DATA=' + safeSiteData + '</script>\n</head>'
    );
  } else {
    c.header('Cache-Control', 'no-store, max-age=0');
  }
  try {
    const dynScript = await buildInlineDynamicScript(c.env.DB);
    pageHtml = pageHtml.replace('</head>', dynScript + '\n</head>');
  } catch { /* best-effort */ }
  pageHtml = await applyTextOverridesSSR(pageHtml, 'calculator', lang, c.env.DB);
  return c.html(pageHtml);
})

// Language-specific routes: /am and /ru — same language resolution as /home
app.get('/am', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = '/home';
  url.searchParams.set('lang', 'am');
  const newReq = new Request(url.href, c.req.raw);
  return app.fetch(newReq, c.env, c.executionCtx);
})

app.get('/ru', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = '/home';
  url.searchParams.set('lang', 'ru');
  const newReq = new Request(url.href, c.req.raw);
  return app.fetch(newReq, c.env, c.executionCtx);
})
}
