/**
 * Landing page HTML generation — main page route with full SSR
 * This is the largest module: generates complete HTML with embedded CSS/JS
 */
import { Hono } from 'hono'
import { html } from 'hono/html'
import { initDatabase } from '../lib/db'
import { SEED_CONTENT_SECTIONS, SEED_CALC_TABS, SEED_CALC_SERVICES, SEED_TG_MESSAGES } from '../seed-data'

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

// =====================================================================
// renderPageShell
// ---------------------------------------------------------------------
// Shared SSR skeleton for all secondary pages: builds full <html> doc
// with head (meta/SEO/OG/hreflang/CSS), header, footer, popups, bottom-
// nav and the /static/landing.js bundle. Page-specific markup is passed
// as `mainHtml` and rendered inside <main class="${bodyClass}" data-page="${page}">.
//
// Currently consumed by renderPlaceholderPage; phase 2 will route /about,
// /buyouts, /services, /faq, /contacts, /referral content here too. The
// `'home'` literal is reserved for a future migration of `app.get('/')`.
// =====================================================================
function renderPageShell(opts: {
  page: PlaceholderPage | 'home',
  lang: 'ru' | 'am',
  siteOrigin: string,
  seo: { title: string, description: string, ogImage?: string },
  bodyClass?: string,
  mainHtml: string,
  extraHead?: string,
}): string {
  const { page, lang, siteOrigin, seo, mainHtml } = opts
  const bodyClass = opts.bodyClass || ''
  const extraHead = opts.extraHead || ''
  const path = page === 'home' ? '/' : `/${page}`
  const isAM = lang === 'am'
  const htmlLang = isAM ? 'hy' : 'ru'
  const ogLocale = isAM ? 'hy_AM' : 'ru_RU'
  const ogLocaleAlt = isAM ? 'ru_RU' : 'hy_AM'
  const ogImage = seo.ogImage || `${siteOrigin}/static/img/og-image-dark.png`
  const canonical = `${siteOrigin}${path}`
  const hrefRu = `${siteOrigin}${path}`
  // /am prefix only exists for the home page; secondary pages use ?lang=am
  // until phase 2 introduces /am/{page} routes.
  const hrefAm = path === '/' ? `${siteOrigin}/am` : `${siteOrigin}${path}?lang=am`

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
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
<link rel="icon" type="image/x-icon" href="/static/img/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/static/img/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/static/img/apple-touch-icon.png">
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
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);line-height:1.7;overflow-x:hidden;width:100%;max-width:100vw;min-height:100vh;min-height:100dvh}
*,*::before,*::after{box-sizing:border-box}
.container{max-width:1440px;margin:0 auto;padding:0 24px;width:100%}
a{text-decoration:none;color:inherit}
img{max-width:100%;height:auto}
/* Header */
.header{position:fixed;top:0;left:0;right:0;z-index:1000;padding:12px 0;transition:var(--t);background:rgba(15,10,26,0.8);backdrop-filter:blur(20px);border-bottom:1px solid transparent}
.header.scrolled{border-bottom:1px solid var(--border);background:rgba(15,10,26,0.95)}
.nav{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:nowrap}
.logo{display:flex;align-items:center;gap:12px}
.logo img{height:44px;width:auto;border-radius:8px}
.logo-text{font-size:1.3rem;font-weight:800;background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;white-space:nowrap}
.nav-links{display:flex;align-items:center;gap:4px;list-style:none;flex:1;justify-content:center;flex-wrap:nowrap;overflow:hidden}
.nav-links a{font-size:clamp(0.65rem,0.78vw,0.85rem);font-weight:500;color:var(--text-sec);transition:var(--t);white-space:nowrap;padding:5px 7px;border-radius:6px}
.nav-links a:hover{color:var(--text)}
.nav-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
.lang-switch{display:flex;background:var(--bg-card);border-radius:8px;overflow:hidden;border:1px solid var(--border)}
.lang-btn{padding:5px 10px;font-size:1.1rem;cursor:pointer;background:transparent;border:none;color:var(--text-muted);display:flex;align-items:center;gap:4px}
.lang-btn.active{background:var(--purple);color:white}
.lang-btn .lang-text{font-size:0.7rem;font-weight:600;letter-spacing:0.5px}
.nav-cta{padding:8px 16px;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white!important;border-radius:var(--r-sm);font-weight:600;font-size:clamp(0.72rem,0.8vw,0.88rem);transition:var(--t);display:flex;align-items:center;gap:6px;white-space:nowrap}
.nav-cta:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(139,92,246,0.4)}
.hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;padding:8px}
.hamburger span{width:24px;height:2px;background:var(--text);border-radius:2px;transition:var(--t)}
@media(max-width:1100px){.nav-links{gap:1px}.nav-links a{font-size:0.72rem;padding:4px 5px}.logo-text{font-size:1rem}}
@media(max-width:1000px){.logo-text{display:none}.lang-btn{padding:5px 10px;font-size:0.72rem}}
@media(max-width:900px){.nav-links{display:none}.hamburger{display:flex}.nav-right .nav-cta{display:none}}
/* Buttons */
.btn{display:inline-flex;align-items:center;gap:10px;padding:14px 28px;border-radius:var(--r-sm);font-weight:600;font-size:0.95rem;transition:var(--t);cursor:pointer;border:none}
.btn-primary{background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white;box-shadow:0 4px 15px rgba(139,92,246,0.3)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(139,92,246,0.5)}
.btn-outline{background:transparent;color:var(--text);border:1px solid var(--border)}
.btn-outline:hover{border-color:var(--purple);background:rgba(139,92,246,0.05)}
.btn-tg{background:linear-gradient(135deg,#0088cc,#0077b5);color:white;box-shadow:0 4px 15px rgba(0,136,204,0.3)}
.btn-tg:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,136,204,0.5)}
/* Placeholder body */
.placeholder-page{padding:140px 0 80px;min-height:60vh;display:flex;align-items:center}
.placeholder-card{max-width:720px;margin:0 auto;text-align:center;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px 32px;box-shadow:0 12px 40px rgba(0,0,0,0.25)}
.placeholder-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:18px;text-transform:uppercase;letter-spacing:0.5px}
.placeholder-card h1{font-size:clamp(1.8rem,4vw,2.6rem);font-weight:800;line-height:1.2;margin-bottom:16px;letter-spacing:-0.02em}
.placeholder-card h1 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.placeholder-card p{font-size:1.02rem;color:var(--text-sec);margin-bottom:32px;line-height:1.7}
.placeholder-cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:24px}
.placeholder-cta .btn{padding:12px 22px;font-size:0.92rem}
.placeholder-back{display:inline-flex;align-items:center;gap:8px;color:var(--text-muted);font-size:0.88rem;font-weight:500;transition:var(--t)}
.placeholder-back:hover{color:var(--purple)}
@media(max-width:600px){.placeholder-page{padding:110px 0 60px}.placeholder-card{padding:32px 20px}.placeholder-cta{flex-direction:column}.placeholder-cta .btn{width:100%;justify-content:center}}
/* Footer */
.footer{padding:60px 0 28px;border-top:1px solid var(--border);background:var(--bg-surface)}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px;margin-bottom:40px}
.footer-brand .logo{margin-bottom:16px}
.footer-brand p{color:var(--text-muted);font-size:0.88rem;line-height:1.8}
.footer-col h4{font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--purple);margin-bottom:20px;position:relative;padding-bottom:10px}
.footer-col h4::after{content:'';position:absolute;bottom:0;left:0;width:24px;height:2px;background:var(--purple);border-radius:2px}
.footer-col ul{list-style:none}
.footer-col li{margin-bottom:12px}
.footer-col a{color:var(--text-sec);font-size:0.88rem;transition:var(--t);display:inline-flex;align-items:center;gap:8px}
.footer-col a:hover{color:var(--purple);transform:translateX(4px)}
.footer-col a i{font-size:1rem;width:20px;text-align:center}
.footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:24px;border-top:1px solid var(--border);font-size:0.78rem;color:var(--text-muted)}
@media(max-width:900px){.footer-grid{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.footer-grid{grid-template-columns:1fr}.footer-bottom{flex-direction:column;gap:8px;text-align:center}}
/* Floating buttons */
.tg-float{position:fixed;bottom:86px;right:24px;z-index:999;display:flex;align-items:center;gap:12px;padding:14px 24px;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white;border-radius:50px;box-shadow:0 8px 30px rgba(139,92,246,0.4);transition:var(--t);font-weight:600;font-size:0.88rem}
.tg-float:hover{transform:translateY(-3px) scale(1.03)}
.calc-float{position:fixed;bottom:24px;right:24px;z-index:999;display:flex;align-items:center;gap:10px;padding:14px 22px;background:linear-gradient(135deg,#10B981,#059669);color:white;border-radius:50px;box-shadow:0 8px 30px rgba(16,185,129,0.4);transition:var(--t);font-weight:600;font-size:0.88rem}
.calc-float:hover{transform:translateY(-3px) scale(1.03)}
@media(max-width:900px){.tg-float,.calc-float{display:none!important}}
/* Popup overlay (callback modal) */
.popup-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100dvh;background:rgba(0,0,0,0.85);z-index:100000;justify-content:center;align-items:center;padding:20px;overflow:hidden}
.popup-overlay.show{display:flex!important;visibility:visible!important;opacity:1!important}
.popup-card{background:linear-gradient(145deg,#2a1a4e,#3d2470);border:2px solid rgba(167,139,250,0.6);border-radius:20px;padding:32px;text-align:center;max-width:460px;width:100%;position:relative;z-index:100001;box-shadow:0 0 80px rgba(139,92,246,0.4),0 25px 60px rgba(0,0,0,0.5);max-height:85dvh;overflow-y:auto;animation:popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards}
@keyframes popIn{0%{transform:scale(0.7) translateY(30px);opacity:0}100%{transform:scale(1) translateY(0);opacity:1}}
@media(max-width:640px){.popup-overlay{align-items:flex-end;padding:0}.popup-card{border-radius:20px 20px 0 0;max-width:100%;padding:20px 16px}}
.popup-card .popup-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:#fff;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}
.popup-card .popup-close:hover{background:rgba(239,68,68,0.5)}
.popup-card .popup-icon{width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--purple-deep));display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:#fff;margin:0 auto 14px}
.popup-card h3{font-size:1.4rem;font-weight:800;margin-bottom:8px;color:#fff}
.popup-card .popup-sub{color:#c4b5fd;margin-bottom:20px;font-size:0.9rem;line-height:1.5}
.popup-card .pf-group{margin-bottom:14px;text-align:left}
.popup-card .pf-label{display:block;font-size:0.8rem;font-weight:600;color:#c4b5fd;margin-bottom:6px}
.popup-card .pf-input{width:100%;padding:12px 14px;background:rgba(15,10,26,0.6);border:1px solid rgba(167,139,250,0.3);border-radius:10px;color:#fff;font-size:0.95rem;font-family:inherit}
.popup-card .pf-input:focus{outline:none;border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.25)}
.popup-card .pf-input::placeholder{color:rgba(165,160,184,0.6)}
.popup-card .pf-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.btn-lg{padding:16px 32px;font-size:1.05rem}
/* Bottom nav (mobile) */
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:9999;background:rgba(15,10,26,0.96);backdrop-filter:blur(20px);border-top:1px solid var(--border);padding:6px 8px;padding-bottom:max(6px,env(safe-area-inset-bottom))}
.bottom-nav-items{display:flex;justify-content:space-around;align-items:stretch;gap:2px}
.bottom-nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px;border-radius:8px;text-decoration:none;color:var(--text-muted);font-size:0.72rem;font-weight:500;flex:1;min-width:0;cursor:pointer;background:none;border:none}
.bottom-nav-item.active,.bottom-nav-item:hover{color:var(--purple)}
.bottom-nav-item i{font-size:1.15rem;width:24px;height:24px;display:flex;align-items:center;justify-content:center}
.bottom-nav-item span{font-size:0.6rem;text-align:center;line-height:1.15;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.bottom-nav-more{position:relative}
.bottom-nav-more-menu{display:none;position:absolute;bottom:100%;right:0;margin-bottom:8px;background:rgba(15,10,26,0.98);backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:12px;padding:8px;min-width:200px}
.bottom-nav-more-menu.active{display:block}
.bottom-nav-more-menu a{display:flex;align-items:center;gap:10px;padding:10px 14px;color:var(--text);font-size:0.88rem;font-weight:500;border-radius:8px}
.bottom-nav-more-menu a:hover{background:rgba(139,92,246,0.15);color:var(--purple)}
@media(max-width:900px){.bottom-nav{display:block}body{padding-bottom:72px}}
</style>
${extraHead}
</head>
<body>

<!-- ===== HEADER (shared with /) ===== -->
<header class="header" id="header">
<div class="container">
<nav class="nav">
  <a href="/" class="logo">
    <img src="/static/img/logo-gototop.png" alt="Go to Top">
    <span class="logo-text">Go to Top</span>
  </a>
  <ul class="nav-links" id="navLinks">
    <li><a href="/#about" data-ru="О нас" data-am="Մեր մասին">О нас</a></li>
    <li><a href="/#services" data-ru="Услуги" data-am="Ծառայություններ">Услуги</a></li>
    <li><a href="/#calculator" data-ru="Калькулятор" data-am="Հաշվիչ">Калькулятор</a></li>
    <li><a href="/#warehouse" data-ru="Склад" data-am="Պահեստ">Склад</a></li>
    <li><a href="/#guarantee" data-ru="Гарантии" data-am="Երաշխիքներ">Гарантии</a></li>
    <li><a href="/#faq" data-ru="FAQ" data-am="ՀՏՀ">FAQ</a></li>
    <li><a href="/#contact" data-ru="Контакты" data-am="Կոնտակտներ">Контакты</a></li>
    <li><a href="/blog" data-ru="Блог" data-am="Բլոգ">Блог</a></li>
  </ul>
  <div class="nav-right">
    <div class="lang-switch">
      <button class="lang-btn${isAM ? '' : ' active'}" data-lang="ru" onclick="switchLang('ru')"><span class="lang-flag"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect width="36" height="8" fill="#fff"/><rect y="8" width="36" height="8" fill="#0039A6"/><rect y="16" width="36" height="8" fill="#D52B1E"/></svg></span><span class="lang-text">RU</span></button>
      <button class="lang-btn${isAM ? ' active' : ''}" data-lang="am" onclick="switchLang('am')"><span class="lang-flag"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect width="36" height="8" fill="#D90012"/><rect y="8" width="36" height="8" fill="#0033A0"/><rect y="16" width="36" height="8" fill="#F2A800"/></svg></span><span class="lang-text">AM</span></button>
    </div>
    <a href="javascript:void(0)" onclick="openCallbackModal()" class="nav-cta">
      <i class="fas fa-phone"></i>
      <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք">Перезвоните мне</span>
    </a>
  </div>
  <button class="hamburger" id="hamburger" onclick="toggleMenu()">
    <span></span><span></span><span></span>
  </button>
</nav>
</div>
</header>

<!-- ===== PAGE MAIN ===== -->
<main class="${bodyClass}" data-page="${page}">
${mainHtml}
</main>

<!-- ===== FOOTER (shared with /) ===== -->
<footer class="footer">
<div class="container">
  <div class="footer-grid">
    <div class="footer-brand">
      <div class="logo"><img src="/static/img/logo-gototop.png" alt="Go to Top" style="height:44px"><span class="logo-text">Go to Top</span></div>
      <p data-ru="Безопасное продвижение на Wildberries для армянских продавцов." data-am="Անվտանգ առաջխաղացում Wildberries-ում հայ վաճառողների համար։" data-no-rewrite="1">${isAM ? 'Անվտանգ առաջխաղացում Wildberries-ում հայ վաճառողների համար։' : 'Безопасное продвижение на Wildberries для армянских продавцов.'}</p>
    </div>
    <div class="footer-col">
      <h4 data-ru="Навигация" data-am="Նավիգացիա" data-no-rewrite="1">${isAM ? 'Նավիգացիա' : 'Навигация'}</h4>
      <ul>
        <li><a href="/#services" data-ru="Услуги и цены" data-am="Ծառայություններ և գներ" data-no-rewrite="1">${isAM ? 'Ծառայություններ և գներ' : 'Услуги и цены'}</a></li>
        <li><a href="/#calculator" data-ru="Калькулятор" data-am="Հաշվիչ" data-no-rewrite="1">${isAM ? 'Հաշվիչ' : 'Калькулятор'}</a></li>
        <li><a href="/#warehouse" data-ru="Наш склад" data-am="Մեր պահեստը" data-no-rewrite="1">${isAM ? 'Մեր պահեստը' : 'Наш склад'}</a></li>
        <li><a href="/#guarantee" data-ru="Гарантии" data-am="Երաշխիքներ" data-no-rewrite="1">${isAM ? 'Երաշխիքներ' : 'Гарантии'}</a></li>
        <li><a href="/faq" data-ru="FAQ" data-am="ՀՏՀ" data-no-rewrite="1">FAQ</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4 data-ru="Контакты" data-am="Կոնտակտներ" data-no-rewrite="1">${isAM ? 'Կոնտակտներ' : 'Контакты'}</h4>
      <ul>
        <li><a href="${PLACEHOLDER_TG_URL}" target="_blank" rel="noopener"><i class="fab fa-telegram"></i> <span data-ru="Администратор" data-am="Ադմինիստրատոր" data-no-rewrite="1">${isAM ? 'Ադմինիստրատոր' : 'Администратор'}</span></a></li>
        <li><a href="https://t.me/suport_admin_2" target="_blank" rel="noopener"><i class="fab fa-telegram"></i> <span data-ru="Менеджер" data-am="Մենեջեր" data-no-rewrite="1">${isAM ? 'Մենեջեր' : 'Менеджер'}</span></a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Go to Top. <span data-ru="Все права защищены" data-am="Բոլոր իրավունքները պաշտպանված են" data-no-rewrite="1">${isAM ? 'Բոլոր իրավունքները պաշտպանված են' : 'Все права защищены'}</span></span>
    <span data-ru="Ереван, Армения" data-am="Երևան, Հայաստան" data-no-rewrite="1">${isAM ? 'Երևան, Հայաստան' : 'Ереван, Армения'}</span>
  </div>
</div>
</footer>

<!-- FLOATING TG BUTTON -->
<a href="https://wa.me/37455226224" target="_blank" rel="noopener" class="tg-float">
  <i class="fab fa-whatsapp"></i>
  <span data-ru="Написать нам" data-am="Գրել հիմա" data-no-rewrite="1">${isAM ? 'Գրել հիմա' : 'Написать нам'}</span>
</a>

<!-- FLOATING CALC BUTTON -->
<a href="/#calculator" class="calc-float" id="calcFloatBtn">
  <i class="fas fa-calculator"></i>
  <span data-ru="Калькулятор" data-am="Հաշվիչ" data-no-rewrite="1">${isAM ? 'Հաշվիչ' : 'Калькулятор'}</span>
</a>

<!-- CALLBACK MODAL (shared with /) -->
<div id="callbackModal" class="popup-overlay" onclick="if(event.target===this)closeCallbackModal()">
  <div class="popup-card" id="callbackCard">
    <button class="popup-close" onclick="closeCallbackModal()" aria-label="Закрыть">&times;</button>
    <div class="popup-icon"><i class="fas fa-phone-alt"></i></div>
    <h3 data-ru="Перезвоните мне" data-am="Հետ զանգահարեք">${isAM ? 'Հետ զանգահարեք' : 'Перезвоните мне'}</h3>
    <p class="popup-sub" data-ru="Оставьте заявку — мы свяжемся в удобное для вас время" data-am="Թողեք հայտ — կզանգահարենք ձեզ հարմար ժամանակ">${isAM ? 'Թողեք հայտ — կզանգահարենք ձեզ հարմար ժամանակ' : 'Оставьте заявку — мы свяжемся в удобное для вас время'}</p>
    <form id="callbackForm" onsubmit="submitCallbackForm(event)">
      <div class="pf-group">
        <label class="pf-label" data-ru="Ваше имя *" data-am="Ձեր անունը *">${isAM ? 'Ձեր անունը *' : 'Ваше имя *'}</label>
        <input type="text" id="cb_name" class="pf-input" placeholder="Иван Иванов" required>
      </div>
      <div class="pf-group">
        <label class="pf-label" data-ru="Номер телефона *" data-am="Հեռախոսահամար *">${isAM ? 'Հեռախոսահամար *' : 'Номер телефона *'}</label>
        <input type="tel" id="cb_phone" class="pf-input" placeholder="+7 (___) ___-__-__" required>
      </div>
      <div class="pf-group">
        <label class="pf-label" data-ru="Удобное время для звонка" data-am="Հարմարավետ ժամ զանգի համար">${isAM ? 'Հարմարավետ ժամ զանգի համար' : 'Удобное время для звонка'}</label>
        <input type="text" id="cb_time" class="pf-input" placeholder="Например: после 18:00">
      </div>
      <div class="pf-group">
        <label class="pf-label" data-ru="Ваш вопрос (необязательно)" data-am="Ձեր հարցը (ոչ պարտադիր)">${isAM ? 'Ձեր հարցը (ոչ պարտադիր)' : 'Ваш вопрос (необязательно)'}</label>
        <textarea id="cb_question" class="pf-input" rows="3" placeholder="Кратко опишите, что хотите обсудить..." style="resize:vertical;min-height:72px"></textarea>
      </div>
      <div id="callbackResult" style="display:none;padding:12px;border-radius:8px;margin-bottom:12px;font-size:0.88rem;text-align:center"></div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px">
        <i class="fas fa-paper-plane"></i>
        <span data-ru="Отправить заявку" data-am="Ուղարկել հայտը">${isAM ? 'Ուղարկել հայտը' : 'Отправить заявку'}</span>
      </button>
    </form>
  </div>
</div>

<script src="/static/landing.js" defer></script>

<!-- Bottom Navigation Bar (mobile) -->
<nav class="bottom-nav" id="bottomNav">
<div class="bottom-nav-items">
  <a href="/#about" class="bottom-nav-item"><i class="fas fa-info-circle"></i><span data-ru="О нас" data-am="Մեր մասին">${isAM ? 'Մեր մասին' : 'О нас'}</span></a>
  <a href="/#services" class="bottom-nav-item"><i class="fas fa-hand-holding"></i><span data-ru="Услуги" data-am="Ծառայություններ">${isAM ? 'Ծառայություններ' : 'Услуги'}</span></a>
  <a href="/#calculator" class="bottom-nav-item"><i class="fas fa-calculator"></i><span data-ru="Калькулятор" data-am="Հաշվիչ">${isAM ? 'Հաշվիչ' : 'Калькулятор'}</span></a>
  <a href="/#guarantee" class="bottom-nav-item"><i class="fas fa-shield-alt"></i><span data-ru="Гарантии" data-am="Երաշխիքներ">${isAM ? 'Երաշխիքներ' : 'Гарантии'}</span></a>
  <button class="bottom-nav-item bottom-nav-more" id="bottomNavMore" onclick="toggleBottomMore()"><i class="fas fa-ellipsis-h"></i><span data-ru="Ещё" data-am="Ավելին">${isAM ? 'Ավելին' : 'Ещё'}</span>
    <div class="bottom-nav-more-menu" id="bottomMoreMenu">
      <a href="/#warehouse"><i class="fas fa-warehouse"></i><span data-ru="Склад" data-am="Պահեստ">${isAM ? 'Պահեստ' : 'Склад'}</span></a>
      <a href="/faq"><i class="fas fa-question-circle"></i><span data-ru="FAQ" data-am="ՀՏՀ">FAQ</span></a>
      <a href="/contacts"><i class="fas fa-envelope"></i><span data-ru="Контакты" data-am="Կոնտակտներ">${isAM ? 'Կոնտակտներ' : 'Контакты'}</span></a>
    </div>
  </button>
</div>
</nav>

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
}): string {
  const { page, lang, siteOrigin } = opts
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
        <a href="/#calculator" class="btn btn-primary">
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
      <a href="/" class="placeholder-back">
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
  })
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
function renderAboutPage(opts: { lang: 'ru' | 'am', siteOrigin: string }): string {
  const { lang, siteOrigin } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru

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
  const extraHead = `<style>
.about-page{padding-top:88px}
.about-hero{padding:24px 0 56px}
.about-hero .ah-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:48px;align-items:center}
.about-hero .ah-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:18px;text-transform:uppercase;letter-spacing:0.5px}
.about-hero h1{font-size:clamp(1.9rem,3.6vw,2.9rem);font-weight:800;line-height:1.15;margin-bottom:18px;letter-spacing:-0.02em}
.about-hero h1 .gr,.about-section h2 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.about-hero .ah-desc{font-size:1.02rem;color:var(--text-sec);margin-bottom:24px;line-height:1.7;max-width:560px}
.about-hero .ah-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px;max-width:520px}
.about-hero .ah-stat{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:16px 14px;text-align:center}
.about-hero .ah-stat-num{font-size:1.5rem;font-weight:800;background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1}
.about-hero .ah-stat-label{font-size:0.72rem;color:var(--text-muted);margin-top:6px;line-height:1.3}
.about-hero .ah-cta{display:flex;gap:12px;flex-wrap:wrap}
.about-hero .ah-image{display:flex;justify-content:center}
.about-hero .ah-image img{width:100%;max-width:520px;border-radius:var(--r-lg);box-shadow:0 20px 60px rgba(0,0,0,0.45),0 0 60px rgba(139,92,246,0.18);object-fit:cover}
.about-section{padding:56px 0}
.about-section .as-grid{display:grid;grid-template-columns:1fr 1.05fr;gap:48px;align-items:center}
.about-section.flip .as-image{order:2}
.about-section .as-image img{width:100%;border-radius:var(--r-lg);box-shadow:0 16px 40px rgba(0,0,0,0.35);object-fit:cover}
.about-section .as-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.74rem;font-weight:600;color:var(--accent);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px}
.about-section h2{font-size:clamp(1.6rem,2.8vw,2.1rem);font-weight:800;line-height:1.2;margin-bottom:16px;letter-spacing:-0.02em}
.about-section .as-text p{color:var(--text-sec);font-size:0.98rem;line-height:1.75;margin-bottom:16px}
.about-section .as-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}
.about-section .as-list li{display:flex;gap:10px;align-items:flex-start;font-size:0.92rem;color:var(--text-sec)}
.about-section .as-list li i{color:#10B981;margin-top:4px;flex-shrink:0}
.about-section .as-card{background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.18);border-radius:14px;padding:18px 20px;margin-bottom:14px}
.about-section .as-card.green{background:rgba(16,185,129,0.05);border-color:rgba(16,185,129,0.2)}
.about-section .as-card .as-card-title{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:0.95rem;font-weight:700;color:var(--text)}
.about-section .as-card.green .as-card-title i{color:#10B981}
.about-section .as-card-title i{color:var(--purple)}
.about-section .as-badge-flag{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:50px;color:#10B981;font-size:0.85rem;font-weight:600;margin-top:14px}
.about-cta-strip{padding:24px 0 64px}
.about-cta-strip .acs-card{background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(139,92,246,0.04));border:1px solid rgba(139,92,246,0.25);border-radius:var(--r-lg);padding:28px 32px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;box-shadow:0 12px 40px rgba(0,0,0,0.18)}
.about-cta-strip .acs-text h3{font-size:1.4rem;font-weight:800;margin-bottom:6px}
.about-cta-strip .acs-text p{color:var(--text-sec);font-size:0.92rem;margin:0;max-width:380px}
.about-cta-strip .acs-actions{display:flex;gap:12px;flex-wrap:wrap}
.about-cta-strip .acs-actions .btn{padding:12px 20px;font-size:0.9rem}
@media(max-width:900px){
  .about-page{padding-top:80px}
  .about-hero{padding:16px 0 40px}
  .about-hero .ah-grid,.about-section .as-grid{grid-template-columns:1fr;gap:28px}
  .about-section.flip .as-image{order:0}
  .about-section{padding:40px 0}
  .about-cta-strip .acs-card{padding:24px 20px;flex-direction:column;align-items:flex-start}
  .about-cta-strip .acs-actions{width:100%}
  .about-cta-strip .acs-actions .btn{flex:1;justify-content:center;min-width:140px}
}
@media(max-width:600px){
  .about-hero .ah-stat-num{font-size:1.2rem}
  .about-hero .ah-stat-label{font-size:0.66rem}
  .about-cta-strip .acs-actions{flex-direction:column}
  .about-cta-strip .acs-actions .btn{width:100%}
}
</style>`

  const mainHtml = `
<!-- ===== ABOUT HERO ===== -->
<section class="about-hero">
  <div class="container">
    <div class="ah-grid">
      <div class="ah-text">
        <div class="ah-eyebrow">
          <i class="fas fa-info-circle"></i>
          <span data-ru="О компании" data-am="Ընկերության մասին">${t('О компании', 'Ընկերության մասին')}</span>
        </div>
        <h1>
          <span data-ru="О компании" data-am="Go to Top-ի մասին">${t('О компании', 'Go to Top-ի մասին')}</span>
          <span class="gr" data-ru="Go to Top" data-am="Go to Top">Go to Top</span>
        </h1>
        <p class="ah-desc" data-ru="Маркетплейс-агентство из Еревана: продвигаем карточки на Wildberries вживую под ключ — выкупы реальными людьми, отзывы с фото, фотосессии и работа по ключевым запросам. Собственный склад, 1000+ аккаунтов и команда с опытом WB с 2021 года." data-am="Մարքեթփլեյս գործակալություն Երևանից՝ Wildberries-ի քարտերի ամբողջական առաջխաղացում իրական մարդկանցով։ Գնումներ, լուսանկարներով կարծիքներ, լուսանկարահանումներ և բանալի բառերով աշխատանք։ Սեփական պահեստ, 1000+ հաշիվ և թիմ՝ WB-ի փորձով 2021 թվականից։">${t('Маркетплейс-агентство из Еревана: продвигаем карточки на Wildberries вживую под ключ — выкупы реальными людьми, отзывы с фото, фотосессии и работа по ключевым запросам. Собственный склад, 1000+ аккаунтов и команда с опытом WB с 2021 года.', 'Մարքեթփլեյս գործակալություն Երևանից՝ Wildberries-ի քարտերի ամբողջական առաջխաղացում իրական մարդկանցով։ Գնումներ, լուսանկարներով կարծիքներ, լուսանկարահանումներ և բանալի բառերով աշխատանք։ Սեփական պահեստ, 1000+ հաշիվ և թիմ՝ WB-ի փորձով 2021 թվականից։')}</p>
        <div class="ah-stats">
          <div class="ah-stat">
            <div class="ah-stat-num">847</div>
            <div class="ah-stat-label" data-ru="товаров в ТОП" data-am="ապրանք TOP-ում">${t('товаров в ТОП', 'ապրանք TOP-ում')}</div>
          </div>
          <div class="ah-stat">
            <div class="ah-stat-num">1000+</div>
            <div class="ah-stat-label" data-ru="реальных аккаунтов" data-am="իրական հաշիվ">${t('реальных аккаунтов', 'իրական հաշիվ')}</div>
          </div>
          <div class="ah-stat">
            <div class="ah-stat-num">0</div>
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
        <img src="/static/img/founder.jpg" alt="${t('Основатель Go to Top', 'Go to Top-ի հիմնադիրը')}" loading="eager" fetchpriority="high" decoding="async">
      </div>
    </div>
  </div>
</section>

<!-- ===== WHO WE ARE ===== -->
<section class="about-section">
  <div class="container">
    <div class="as-grid">
      <div class="as-image">
        <img src="/static/img/about-hero2.jpg" alt="${t('Go to Top — о компании', 'Go to Top — ընկերության մասին')}" loading="lazy">
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
        <img src="/static/img/team-office.jpg" alt="${t('Команда Go to Top', 'Go to Top թիմը')}" loading="lazy">
      </div>
    </div>
  </div>
</section>

<!-- ===== LIGHT CTA STRIP ===== -->
<section class="about-cta-strip">
  <div class="container">
    <div class="acs-card">
      <div class="acs-text">
        <h3 data-ru="Готовы начать?" data-am="Պատրա՞ստ եք սկսել">${t('Готовы начать?', 'Պատրա՞ստ եք սկսել')}</h3>
        <p data-ru="Откройте калькулятор, напишите в Telegram или закажите обратный звонок — мы подберём пакет под вашу задачу." data-am="Բացեք հաշվիչը, գրեք Telegram-ով կամ պատվիրեք հետադարձ զանգ — մենք կընտրենք փաթեթ ձեր խնդրի համար։">${t('Откройте калькулятор, напишите в Telegram или закажите обратный звонок — мы подберём пакет под вашу задачу.', 'Բացեք հաշվիչը, գրեք Telegram-ով կամ պատվիրեք հետադարձ զանգ — մենք կընտրենք փաթեթ ձեր խնդրի համար։')}</p>
      </div>
      <div class="acs-actions">
        <a href="/#calculator" class="btn btn-primary">
          <i class="fas fa-calculator"></i>
          <span data-ru="Открыть калькулятор" data-am="Բացել հաշվիչը">${t('Открыть калькулятор', 'Բացել հաշվիչը')}</span>
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

  return renderPageShell({
    page: 'about',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'about-page',
    mainHtml,
    extraHead,
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
function renderServicesPage(opts: { lang: 'ru' | 'am', siteOrigin: string }): string {
  const { lang, siteOrigin } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru

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
  const extraHead = `<style>
.services-page{padding-top:88px}
.svc-hero{padding:24px 0 48px}
.svc-hero .sh-inner{max-width:880px;margin:0 auto;text-align:center}
.svc-hero .sh-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:18px;text-transform:uppercase;letter-spacing:0.5px}
.svc-hero h1{font-size:clamp(1.9rem,3.6vw,2.9rem);font-weight:800;line-height:1.15;margin-bottom:16px;letter-spacing:-0.02em}
.svc-hero h1 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.svc-hero .sh-desc{font-size:1.02rem;color:var(--text-sec);margin:0 auto 24px;line-height:1.7;max-width:680px}
.svc-hero .sh-cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
/* Section primitives (subset from home) */
.section{padding:48px 0;overflow:visible}
.section-dark{background:var(--bg-surface)}
.section-header{text-align:center;margin-bottom:36px}
.section-header h2 .gr,.section-title .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.section-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px}
.section-title{font-size:clamp(1.5rem,2.6vw,2rem);font-weight:800;line-height:1.2;margin-bottom:12px;letter-spacing:-0.02em}
.section-sub{font-size:1rem;color:var(--text-sec);max-width:680px;margin:0 auto;line-height:1.7}
.section-cta{display:flex;gap:14px;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:28px}
.section-cta .btn{font-size:0.9rem;padding:12px 24px}
.btn-success{background:linear-gradient(135deg,#10B981,#059669);color:white;box-shadow:0 4px 15px rgba(16,185,129,0.3)}
.btn-success:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(16,185,129,0.5)}
.btn-warning{background:linear-gradient(135deg,#F59E0B,#D97706);color:white;box-shadow:0 4px 15px rgba(245,158,11,0.3)}
.btn-warning:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(245,158,11,0.5)}
/* Quick service cards */
.svc-quick-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.svc-quick-card{display:flex;flex-direction:column;border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--border);background:var(--bg-card);transition:all 0.3s ease;text-decoration:none;color:var(--text)}
.svc-quick-card:hover{border-color:rgba(139,92,246,0.4);transform:translateY(-6px);box-shadow:0 20px 40px rgba(0,0,0,0.2)}
.svc-quick-img{width:100%;height:200px;overflow:hidden;position:relative}
.svc-quick-img img{width:100%;height:100%;object-fit:cover;transition:transform 0.4s ease}
.svc-quick-card:hover .svc-quick-img img{transform:scale(1.05)}
.svc-quick-body{padding:24px;flex:1;display:flex;flex-direction:column}
.svc-quick-icon{width:44px;height:44px;border-radius:12px;background:rgba(139,92,246,0.1);display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:var(--purple);margin-bottom:12px}
.svc-quick-card h3{font-size:1.1rem;font-weight:700;margin-bottom:10px;line-height:1.3}
.svc-quick-card p{font-size:0.88rem;color:var(--text-sec);line-height:1.7;flex:1;margin-bottom:16px}
.svc-quick-cta{font-size:0.88rem;font-weight:700;color:var(--purple);display:flex;align-items:center;gap:6px}
.svc-quick-card:hover .svc-quick-cta{gap:10px}
/* Detail services grid */
.services-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:28px}
.svc-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:32px;transition:var(--t);position:relative;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);display:flex;flex-direction:column}
.svc-card:hover{border-color:rgba(139,92,246,0.3);transform:translateY(-4px);box-shadow:var(--glow)}
.svc-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--purple),var(--accent));opacity:1}
.svc-icon{width:56px;height:56px;border-radius:14px;background:rgba(139,92,246,0.1);display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:var(--purple);margin-bottom:20px}
.svc-card h3{font-size:1.2rem;font-weight:700;margin-bottom:10px}
.svc-card > p{color:var(--text-sec);font-size:0.92rem;line-height:1.7;margin-bottom:16px}
.svc-features{list-style:none;flex:1;padding:0}
.svc-features li{display:flex;align-items:flex-start;gap:10px;padding:5px 0;font-size:0.88rem;color:var(--text-sec)}
.svc-features li i{color:var(--success);margin-top:4px;font-size:0.78rem}
/* Calculator */
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
.calc-pkg-card.selected::after{content:'\\2713';position:absolute;top:14px;left:14px;width:22px;height:22px;background:#f59e0b;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;z-index:10}
.calc-pkg-card .pkg-tier-badge{position:absolute;top:0;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#f59e0b,#f97316);color:#000;font-size:0.72rem;padding:4px 14px;border-radius:0 0 12px 12px;font-weight:700;letter-spacing:0.3px;white-space:nowrap;z-index:5;box-shadow:0 2px 8px rgba(245,158,11,0.3)}
.calc-pkg-card.pkg-crown-gold{border:2px solid rgba(255,215,0,0.3);border-top:4px solid #FFD700;box-shadow:0 0 8px rgba(255,215,0,0.08),0 4px 12px rgba(255,215,0,0.04);z-index:3;padding:24px 22px;background:linear-gradient(145deg,var(--bg-surface),rgba(255,215,0,0.03));transform:scale(1.03)}
.calc-pkg-card.pkg-crown-silver{border:2px solid rgba(192,192,192,0.3);border-top:3px solid #C0C0C0;z-index:2}
.calc-pkg-card.pkg-crown-bronze{border:2px solid rgba(205,127,50,0.25);border-top:3px solid #CD7F32;z-index:1}
.calc-pkg-card .pkg-name{font-weight:700;font-size:1rem;margin-bottom:6px;margin-top:18px;line-height:1.3}
.calc-pkg-card .pkg-desc{font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;line-height:1.5;flex-grow:1}
.calc-pkg-card .pkg-prices{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.calc-pkg-card .pkg-old-price{text-decoration:line-through;color:var(--text-muted);font-size:0.85rem}
.calc-pkg-card .pkg-new-price{font-weight:800;font-size:1.25rem;color:#f59e0b}
.calc-pkg-card .pkg-discount{background:linear-gradient(135deg,#059669,#10B981);color:white;font-size:0.7rem;padding:3px 8px;border-radius:10px;font-weight:700}
.calc-pkg-card .pkg-items{font-size:0.78rem;color:var(--text-muted);line-height:1.8;border-top:1px solid var(--border);padding-top:10px;margin-top:auto}
.calc-pkg-card .pkg-items div{margin-bottom:2px;line-height:1.7}
.calc-pkg-card .pkg-items div i{color:#22c55e;font-size:0.65rem;margin-right:5px;vertical-align:middle}
.calc-row{display:grid;grid-template-columns:1fr auto auto;gap:16px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)}
.calc-row:last-of-type{border-bottom:none}
.calc-label{font-size:0.92rem;font-weight:500}
.calc-price{font-size:0.82rem;color:var(--text-muted);white-space:nowrap}
.calc-input{display:flex;align-items:center;gap:8px}
.calc-input button{width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:0.95rem;cursor:pointer;transition:var(--t);display:flex;align-items:center;justify-content:center}
.calc-input button:hover{border-color:var(--purple);background:rgba(139,92,246,0.1)}
.calc-input input[type="number"]{width:48px;text-align:center;font-weight:600;font-size:1rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 3px;-moz-appearance:textfield;outline:none}
.calc-input input[type="number"]:focus{border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.15)}
.calc-input input[type="number"]::-webkit-outer-spin-button,.calc-input input[type="number"]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.calc-total{display:flex;justify-content:space-between;align-items:flex-start;padding:24px 0;margin-top:16px;border-top:2px solid var(--purple);gap:12px;flex-wrap:wrap}
.calc-total-label{font-size:1.1rem;font-weight:600;flex-shrink:0;white-space:nowrap}
.calc-total-value{font-size:1.8rem;font-weight:800;color:var(--purple);white-space:normal;text-align:right;min-width:0;overflow-wrap:break-word}
.calc-old-price{font-size:1rem;font-weight:600;color:var(--text-sec);text-decoration:line-through;opacity:0.7;margin-right:6px}
.calc-discount-line{font-size:0.82rem;color:var(--success);font-weight:600;margin-top:2px}
.calc-total-prices{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.calc-cta{margin-top:24px;text-align:center}
.buyout-tier-info{margin-top:8px;padding:12px 16px;background:rgba(139,92,246,0.05);border:1px solid var(--border);border-radius:var(--r-sm);font-size:0.82rem;color:var(--text-sec);line-height:1.6}
.buyout-tier-info strong{color:var(--accent)}
/* Process steps */
.process-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;position:relative}
.step{text-align:center;position:relative}
.step-num{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.1rem;margin:0 auto 16px;position:relative;z-index:2}
.step-line{position:absolute;top:24px;left:50%;right:-50%;height:2px;background:var(--border);z-index:1}
.step:last-child .step-line{display:none}
.step h4{font-size:0.92rem;font-weight:600;margin-bottom:8px}
.step p{font-size:0.78rem;color:var(--text-muted);line-height:1.5}
/* CTA strip (re-used styling pattern from /about) */
.svc-cta-strip{padding:24px 0 64px}
.svc-cta-strip .acs-card{background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(139,92,246,0.04));border:1px solid rgba(139,92,246,0.25);border-radius:var(--r-lg);padding:28px 32px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;box-shadow:0 12px 40px rgba(0,0,0,0.18)}
.svc-cta-strip .acs-text h3{font-size:1.4rem;font-weight:800;margin-bottom:6px}
.svc-cta-strip .acs-text p{color:var(--text-sec);font-size:0.92rem;margin:0;max-width:380px}
.svc-cta-strip .acs-actions{display:flex;gap:12px;flex-wrap:wrap}
.svc-cta-strip .acs-actions .btn{padding:12px 20px;font-size:0.9rem}
@media(max-width:900px){
  .services-page{padding-top:80px}
  .svc-quick-grid{grid-template-columns:1fr;gap:16px}
  .svc-quick-img{height:160px}
  .process-grid{grid-template-columns:repeat(3,1fr)}
  .calc-wrap{padding:24px}
  .svc-cta-strip .acs-card{padding:24px 20px;flex-direction:column;align-items:flex-start}
  .svc-cta-strip .acs-actions{width:100%}
  .svc-cta-strip .acs-actions .btn{flex:1;justify-content:center;min-width:140px}
}
@media(max-width:768px){
  .calc-packages{padding:16px 0;overflow:visible;position:relative}
  .calc-packages-grid{display:flex;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;gap:12px;padding:12px 16px;justify-content:flex-start}
  .calc-packages-grid::-webkit-scrollbar{display:none}
  .calc-pkg-card{flex:0 0 72vw;max-width:72vw;min-width:0;padding:18px 16px;border-radius:14px;scroll-snap-align:center}
  .calc-pkg-card.pkg-crown-gold{transform:none;flex:0 0 72vw;max-width:72vw}
  .services-grid{grid-template-columns:1fr;gap:20px}
}
@media(max-width:600px){
  .process-grid{grid-template-columns:1fr 1fr}
  .svc-cta-strip .acs-actions{flex-direction:column}
  .svc-cta-strip .acs-actions .btn{width:100%}
}
@media(max-width:480px){
  .svc-quick-img{height:140px}
  .svc-quick-body{padding:16px}
  .svc-card{padding:20px}
  .calc-wrap{padding:14px}
  .calc-tab{padding:5px 10px;font-size:0.72rem}
}
</style>`

  const tgUrl = PLACEHOLDER_TG_URL
  const managerTgUrl = 'https://t.me/suport_admin_2'

  const mainHtml = `
<!-- ===== SERVICES HERO ===== -->
<section class="svc-hero">
  <div class="container">
    <div class="sh-inner">
      <div class="sh-eyebrow">
        <i class="fas fa-th-large"></i>
        <span data-ru="Наши услуги" data-am="Մեր ծառայությունները">${t('Наши услуги', 'Մեր ծառայությունները')}</span>
      </div>
      <h1>
        <span data-ru="Услуги" data-am="Ծառայություններ">${t('Услуги', 'Ծառայություններ')}</span>
        <span class="gr" data-ru="для Wildberries" data-am="Wildberries-ի համար">${t('для Wildberries', 'Wildberries-ի համար')}</span>
      </h1>
      <p class="sh-desc" data-ru="Выкупы реальными людьми, отзывы с фото и работа по ключевым запросам — полный пакет продвижения карточек на Wildberries. Рассчитайте стоимость в калькуляторе или соберите готовый пакет." data-am="Իրական մարդկանցով գնումներ, լուսանկարներով կարծիքներ և բանալի բառերով աշխատանք — Wildberries-ի քարտերի առաջխաղացման ամբողջական փաթեթ։ Հաշվեք արժեքը հաշվիչում կամ ընտրեք պատրաստի փաթեթ։">${t('Выкупы реальными людьми, отзывы с фото и работа по ключевым запросам — полный пакет продвижения карточек на Wildberries. Рассчитайте стоимость в калькуляторе или соберите готовый пакет.', 'Իրական մարդկանցով գնումներ, լուսանկարներով կարծիքներ և բանալի բառերով աշխատանք — Wildberries-ի քարտերի առաջխաղացման ամբողջական փաթեթ։ Հաշվեք արժեքը հաշվիչում կամ ընտրեք պատրաստի փաթեթ։')}</p>
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
      <a href="#services-detail" class="svc-quick-card">
        <div class="svc-quick-img">
          <img src="/static/img/svc-buyouts.png" alt="${t('Выкупы по ключам', 'Գնումներ բանալի բառերով')}" loading="lazy">
        </div>
        <div class="svc-quick-body">
          <div class="svc-quick-icon"><i class="fas fa-shopping-cart"></i></div>
          <h3 data-ru="Выкупы по ключам и рекламе" data-am="Գնումներ բանալի բառերով և գովազդով">${t('Выкупы по ключам и рекламе', 'Գնումներ բանալի բառերով և գովազդով')}</h3>
          <p data-ru="Реальные покупки с живых аккаунтов по нужным ключевым словам — ваш товар поднимается в выдаче WB" data-am="Իրական գնումներ կենդանի հաշիվներից ձեր անհրաժեշտ բանալի բառերով — ձեր ապրանքը բարձրանում է WB որոնման մեջ">${t('Реальные покупки с живых аккаунтов по нужным ключевым словам — ваш товар поднимается в выдаче WB', 'Իրական գնումներ կենդանի հաշիվներից ձեր անհրաժեշտ բանալի բառերով — ձեր ապրանքը բարձրանում է WB որոնման մեջ')}</p>
          <span class="svc-quick-cta"><span data-ru="Подробнее" data-am="Մանրամասն">${t('Подробнее', 'Մանրամասն')}</span> →</span>
        </div>
      </a>
      <a href="#services-detail" class="svc-quick-card">
        <div class="svc-quick-img">
          <img src="/static/img/svc-reviews.png" alt="${t('Отзывы под ключ', 'Կարծիքներ բանալիով')}" loading="lazy">
        </div>
        <div class="svc-quick-body">
          <div class="svc-quick-icon"><i class="fas fa-star"></i></div>
          <h3 data-ru="Отзывы под ключ" data-am="Կարծիքներ բանալիով">${t('Отзывы под ключ', 'Կարծիքներ բանալիով')}</h3>
          <p data-ru="Реальные отзывы с фото и видео от живых покупателей — рейтинг карточки растёт, доверие клиентов увеличивается" data-am="Իրական կարծիքներ լուսանկարներով և տեսանյութերով կենդանի հաճախորդներից — քարտի վարկանիշը աճում է, հաճախորդների վստահությունը մեծանում">${t('Реальные отзывы с фото и видео от живых покупателей — рейтинг карточки растёт, доверие клиентов увеличивается', 'Իրական կարծիքներ լուսանկարներով և տեսանյութերով կենդանի հաճախորդներից — քարտի վարկանիշը աճում է, հաճախորդների վստահությունը մեծանում')}</p>
          <span class="svc-quick-cta"><span data-ru="Подробнее" data-am="Մանրամասն">${t('Подробнее', 'Մանրամասն')}</span> →</span>
        </div>
      </a>
      <a href="/referral" class="svc-quick-card">
        <div class="svc-quick-img">
          <img src="/static/img/svc-referral.png" alt="${t('Реферальная программа', 'Ուղեկից ծրագիր')}" loading="lazy">
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
      <div class="svc-card">
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
        <h3 data-ru="Готовы заказать?" data-am="Պատրա՞ստ եք պատվիրել">${t('Готовы заказать?', 'Պատրա՞ստ եք պատվիրել')}</h3>
        <p data-ru="Напишите в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов." data-am="Գրեք Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։">${t('Напишите в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов.', 'Գրեք Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։')}</p>
      </div>
      <div class="acs-actions">
        <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-tg">
          <i class="fab fa-telegram"></i>
          <span data-ru="Telegram" data-am="Telegram">Telegram</span>
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

  return renderPageShell({
    page: 'services',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'services-page',
    mainHtml,
    extraHead,
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
function renderBuyoutsPage(opts: { lang: 'ru' | 'am', siteOrigin: string }): string {
  const { lang, siteOrigin } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru

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
  const extraHead = `<style>
.buyouts-page{padding-top:88px}
/* Hero */
.bp-hero{padding:24px 0 48px}
.bp-hero .bh-inner{max-width:880px;margin:0 auto;text-align:center}
.bp-hero .bh-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:18px;text-transform:uppercase;letter-spacing:0.5px}
.bp-hero h1{font-size:clamp(1.9rem,3.6vw,2.9rem);font-weight:800;line-height:1.15;margin-bottom:16px;letter-spacing:-0.02em}
.bp-hero h1 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.bp-hero .bh-desc{font-size:1.02rem;color:var(--text-sec);margin:0 auto 24px;line-height:1.7;max-width:680px}
.bp-hero .bh-cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
/* Section primitives (subset from home) */
.section{padding:48px 0;overflow:visible}
.section-dark{background:var(--bg-surface)}
.section-header{text-align:center;margin-bottom:36px}
.section-header h2 .gr,.section-title .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.section-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px}
.section-title{font-size:clamp(1.5rem,2.6vw,2rem);font-weight:800;line-height:1.2;margin-bottom:12px;letter-spacing:-0.02em}
.section-sub{font-size:1rem;color:var(--text-sec);max-width:680px;margin:0 auto;line-height:1.7}
.section-cta{display:flex;gap:14px;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:28px}
.section-cta .btn{font-size:0.9rem;padding:12px 24px}
.btn-success{background:linear-gradient(135deg,#10B981,#059669);color:white;box-shadow:0 4px 15px rgba(16,185,129,0.3)}
.btn-success:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(16,185,129,0.5)}
.btn-warning{background:linear-gradient(135deg,#F59E0B,#D97706);color:white;box-shadow:0 4px 15px rgba(245,158,11,0.3)}
.btn-warning:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(245,158,11,0.5)}
/* WB warning banner (top of page) */
.wb-banner{padding:0 0 24px}
.wb-banner-inner{display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap}
.wb-banner-card{display:flex;align-items:center;gap:16px;padding:16px 28px;background:linear-gradient(135deg,#ff3366,var(--purple));border-radius:var(--r);flex:1;min-width:280px;position:relative;overflow:hidden}
.wb-banner-card::after{content:"!";position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:3.5rem;font-weight:900;color:rgba(255,255,255,0.15)}
.wb-banner-card .wb-icon{font-size:1.6rem;color:#fff}
.wb-banner-card .wb-text{font-weight:800;font-size:1rem;color:#fff;line-height:1.3;text-transform:uppercase}
.wb-banner-right{display:flex;align-items:center;gap:16px;padding:16px 28px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);flex:1;min-width:280px}
.wb-banner-right .wb-r-icon{font-size:1.4rem}
.wb-banner-right .wb-r-text{font-weight:700;font-size:0.92rem;line-height:1.4}
.wb-banner-right .btn{margin-left:auto;white-space:nowrap;font-size:0.82rem;padding:10px 20px}
/* Stats bar */
.stats-bar{padding:60px 0;background:var(--bg-surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:32px;text-align:center}
.stat-card .stat-big{font-size:2.8rem;font-weight:900;color:var(--purple);line-height:1}
.stat-card .stat-desc{font-size:0.88rem;color:var(--text-sec);margin-top:6px;font-weight:500}
/* Buyout detail */
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
/* Why-block + compare-box */
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
/* Calculator (subset from home / services) */
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
.calc-pkg-card.selected::after{content:'\\2713';position:absolute;top:14px;left:14px;width:22px;height:22px;background:#f59e0b;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;z-index:10}
.calc-pkg-card .pkg-tier-badge{position:absolute;top:0;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#f59e0b,#f97316);color:#000;font-size:0.72rem;padding:4px 14px;border-radius:0 0 12px 12px;font-weight:700;letter-spacing:0.3px;white-space:nowrap;z-index:5;box-shadow:0 2px 8px rgba(245,158,11,0.3)}
.calc-pkg-card.pkg-crown-gold{border:2px solid rgba(255,215,0,0.3);border-top:4px solid #FFD700;box-shadow:0 0 8px rgba(255,215,0,0.08),0 4px 12px rgba(255,215,0,0.04);z-index:3;padding:24px 22px;background:linear-gradient(145deg,var(--bg-surface),rgba(255,215,0,0.03));transform:scale(1.03)}
.calc-pkg-card.pkg-crown-silver{border:2px solid rgba(192,192,192,0.3);border-top:3px solid #C0C0C0;z-index:2}
.calc-pkg-card.pkg-crown-bronze{border:2px solid rgba(205,127,50,0.25);border-top:3px solid #CD7F32;z-index:1}
.calc-pkg-card .pkg-name{font-weight:700;font-size:1rem;margin-bottom:6px;margin-top:18px;line-height:1.3}
.calc-pkg-card .pkg-desc{font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;line-height:1.5;flex-grow:1}
.calc-pkg-card .pkg-prices{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.calc-pkg-card .pkg-old-price{text-decoration:line-through;color:var(--text-muted);font-size:0.85rem}
.calc-pkg-card .pkg-new-price{font-weight:800;font-size:1.25rem;color:#f59e0b}
.calc-pkg-card .pkg-discount{background:linear-gradient(135deg,#059669,#10B981);color:white;font-size:0.7rem;padding:3px 8px;border-radius:10px;font-weight:700}
.calc-pkg-card .pkg-items{font-size:0.78rem;color:var(--text-muted);line-height:1.8;border-top:1px solid var(--border);padding-top:10px;margin-top:auto}
.calc-pkg-card .pkg-items div{margin-bottom:2px;line-height:1.7}
.calc-pkg-card .pkg-items div i{color:#22c55e;font-size:0.65rem;margin-right:5px;vertical-align:middle}
.calc-row{display:grid;grid-template-columns:1fr auto auto;gap:16px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)}
.calc-row:last-of-type{border-bottom:none}
.calc-label{font-size:0.92rem;font-weight:500}
.calc-price{font-size:0.82rem;color:var(--text-muted);white-space:nowrap}
.calc-input{display:flex;align-items:center;gap:8px}
.calc-input button{width:30px;height:30px;border-radius:6px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:0.95rem;cursor:pointer;transition:var(--t);display:flex;align-items:center;justify-content:center}
.calc-input button:hover{border-color:var(--purple);background:rgba(139,92,246,0.1)}
.calc-input input[type="number"]{width:48px;text-align:center;font-weight:600;font-size:1rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 3px;-moz-appearance:textfield;outline:none}
.calc-input input[type="number"]:focus{border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.15)}
.calc-input input[type="number"]::-webkit-outer-spin-button,.calc-input input[type="number"]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.calc-total{display:flex;justify-content:space-between;align-items:flex-start;padding:24px 0;margin-top:16px;border-top:2px solid var(--purple);gap:12px;flex-wrap:wrap}
.calc-total-label{font-size:1.1rem;font-weight:600;flex-shrink:0;white-space:nowrap}
.calc-total-value{font-size:1.8rem;font-weight:800;color:var(--purple);white-space:normal;text-align:right;min-width:0;overflow-wrap:break-word}
.calc-old-price{font-size:1rem;font-weight:600;color:var(--text-sec);text-decoration:line-through;opacity:0.7;margin-right:6px}
.calc-discount-line{font-size:0.82rem;color:var(--success);font-weight:600;margin-top:2px}
.calc-total-prices{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.calc-cta{margin-top:24px;text-align:center}
.buyout-tier-info{margin-top:8px;padding:12px 16px;background:rgba(139,92,246,0.05);border:1px solid var(--border);border-radius:var(--r-sm);font-size:0.82rem;color:var(--text-sec);line-height:1.6}
.buyout-tier-info strong{color:var(--accent)}
/* Final CTA strip (re-uses /services pattern) */
.bp-cta-strip{padding:24px 0 64px}
.bp-cta-strip .acs-card{background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(139,92,246,0.04));border:1px solid rgba(139,92,246,0.25);border-radius:var(--r-lg);padding:28px 32px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;box-shadow:0 12px 40px rgba(0,0,0,0.18)}
.bp-cta-strip .acs-text h3{font-size:1.4rem;font-weight:800;margin-bottom:6px}
.bp-cta-strip .acs-text p{color:var(--text-sec);font-size:0.92rem;margin:0;max-width:380px}
.bp-cta-strip .acs-actions{display:flex;gap:12px;flex-wrap:wrap}
.bp-cta-strip .acs-actions .btn{padding:12px 20px;font-size:0.9rem}
@media(max-width:1024px){
  .buyout-grid{grid-template-columns:1fr 1fr}
  .stats-grid{grid-template-columns:repeat(2,1fr)}
  .wb-banner-inner{flex-direction:column}
}
@media(max-width:900px){
  .buyouts-page{padding-top:80px}
  .calc-wrap{padding:24px}
  .bp-cta-strip .acs-card{padding:24px 20px;flex-direction:column;align-items:flex-start}
  .bp-cta-strip .acs-actions{width:100%}
  .bp-cta-strip .acs-actions .btn{flex:1;justify-content:center;min-width:140px}
}
@media(max-width:768px){
  .compare-box{grid-template-columns:1fr}
  .why-steps{grid-template-columns:1fr}
  .buyout-grid{grid-template-columns:1fr}
  .stats-grid{grid-template-columns:repeat(2,1fr);gap:20px}
  .wb-banner-inner{flex-direction:column;gap:16px;text-align:center}
  .wb-banner-right{flex-direction:column;gap:8px;min-width:0}
  .wb-banner-right .btn{width:100%;margin-left:0}
  .buyout-detail{padding:24px}
  .why-block{padding:24px}
  .calc-row{grid-template-columns:1fr auto;gap:4px 8px}
  .calc-row .calc-input{grid-column:1/-1;justify-content:flex-start}
  .calc-packages{padding:16px 0;overflow:visible;position:relative}
  .calc-packages-grid{display:flex;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory;gap:12px;padding:12px 16px;justify-content:flex-start}
  .calc-packages-grid::-webkit-scrollbar{display:none}
  .calc-pkg-card{flex:0 0 72vw;max-width:72vw;min-width:0;padding:18px 16px;border-radius:14px;scroll-snap-align:center}
  .calc-pkg-card.pkg-crown-gold{transform:none;flex:0 0 72vw;max-width:72vw}
}
@media(max-width:600px){
  .bp-cta-strip .acs-actions{flex-direction:column}
  .bp-cta-strip .acs-actions .btn{width:100%}
  .stat-card .stat-big{font-size:2.2rem}
  .wb-banner-card,.wb-banner-right{min-width:0;padding:12px 16px}
  .buyout-detail-header h2{font-size:1.5rem}
}
@media(max-width:480px){
  .calc-wrap{padding:14px}
  .calc-tab{padding:5px 10px;font-size:0.72rem}
  .why-block{padding:20px}
  .buyout-detail{padding:20px}
  .buyout-card{padding:20px}
}
/* Force correct order: content blocks BEFORE CTA buttons in why-buyouts &
   fifty-vs-fifty (mirror of home-page rules so layout matches `/`). */
section#why-buyouts .container{display:flex;flex-direction:column}
section#why-buyouts .section-header{order:0!important}
section#why-buyouts .why-block{order:1!important}
section#why-buyouts .section-cta{order:2!important}
section#why-buyouts .why-block > *{order:0!important}
section#why-buyouts .why-block .highlight-result{order:99!important}
section#fifty-vs-fifty .container{display:flex;flex-direction:column}
section#fifty-vs-fifty .section-header{order:0!important}
section#fifty-vs-fifty .why-block{order:1!important}
section#fifty-vs-fifty .section-cta{order:2!important}
section#fifty-vs-fifty .why-block > *{order:0!important}
section#fifty-vs-fifty .why-block .highlight-result{order:99!important}
</style>`

  const tgUrl = PLACEHOLDER_TG_URL
  const managerTgUrl = 'https://t.me/suport_admin_2'

  const mainHtml = `
<!-- ===== BUYOUTS HERO ===== -->
<section class="bp-hero">
  <div class="container">
    <div class="bh-inner">
      <div class="bh-eyebrow">
        <i class="fas fa-shopping-bag"></i>
        <span data-ru="Услуга выкупа" data-am="Գնումի ծառայություն">${t('Услуга выкупа', 'Գնումի ծառայություն')}</span>
      </div>
      <h1>
        <span data-ru="Выкупы на" data-am="Հետագնումներ">${t('Выкупы на', 'Հետագնումներ')}</span>
        <span class="gr">Wildberries</span>
      </h1>
      <p class="bh-desc" data-ru="Реальные выкупы живыми покупателями по нужным ключевым запросам — ваш товар поднимается в ТОП выдачи WB, закрепляется там и начинает получать органический трафик. Собственный склад и 200+ выкупов в день в Ереване." data-am="Իրական հետագնումներ կենդանի գնորդների կողմից անհրաժեշտ բանալի բառերով — ձեր ապրանքը բարձրանում է WB-ի TOP-ում, ամրապնդվում է այնտեղ և սկսում է ստանալ օրգանական տրաֆիկ։ Սեփական պահեստ և 200+ հետագնում օրական Երևանում։">${t('Реальные выкупы живыми покупателями по нужным ключевым запросам — ваш товар поднимается в ТОП выдачи WB, закрепляется там и начинает получать органический трафик. Собственный склад и 200+ выкупов в день в Ереване.', 'Իրական հետագնումներ կենդանի գնորդների կողմից անհրաժեշտ բանալի բառերով — ձեր ապրանքը բարձրանում է WB-ի TOP-ում, ամրապնդվում է այնտեղ և սկսում է ստանալ օրգանական տրաֆիկ։ Սեփական պահեստ և 200+ հետագնում օրական Երևանում։')}</p>
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
<div class="wb-banner" data-section-id="wb-banner">
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
<div class="stats-bar" data-section-id="stats-bar">
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
<section class="section" id="why-buyouts" data-section-id="why-buyouts">
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

<!-- ===== БЮДЖЕТ: 11 000 ₽ блогер vs выкупы ===== -->
<section class="section section-dark" id="fifty-vs-fifty" data-section-id="fifty-vs-fifty">
  <div class="container">
    <div class="section-header">
      <div class="section-badge"><i class="fas fa-balance-scale-right"></i> <span data-ru="Сравнение бюджетов" data-am="Բյուջեների համեմատություն">${t('Сравнение бюджетов', 'Բյուջեների համեմատություն')}</span></div>
      <h2 class="section-title" data-ru="11 000 ₽ на блогера vs 11 000 ₽ на выкупы" data-am="11 000 ₽ բլոգերին vs 11 000 ₽ գնումներին">${t('11 000 ₽ на блогера vs 11 000 ₽ на выкупы', '11 000 ₽ բլոգերին vs 11 000 ₽ գնումներին')}</h2>
    </div>

    <div class="why-block">
      <h3><i class="fas fa-balance-scale-right"></i> <span data-ru="11 000 ₽ на блогера vs 11 000 ₽ на выкупы — что эффективнее?" data-am="11 000 ₽ բլոգերին vs 11 000 ₽ գնումներին — որն է ավելի արդյունավետ?">${t('11 000 ₽ на блогера vs 11 000 ₽ на выкупы — что эффективнее?', '11 000 ₽ բլոգերին vs 11 000 ₽ գնումներին — որն է ավելի արդյունավետ?')}</span></h3>
      <div class="compare-box">
        <div class="compare-side bad">
          <h4><i class="fas fa-dice"></i> <span data-ru="Reels у блогера" data-am="Reels բլոգերի մոտ">${t('Reels у блогера', 'Reels բլոգերի մոտ')}</span></h4>
          <div class="price-tag">11 000 ₽</div>
          <p data-ru="1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это всегда риск без гарантий результата." data-am="1 տեսանյութ բլոգերի մոտ — դա վիճակախաղ է: Կհայտնվի՞ առաջարկություններում, թե ոչ — ոչ ոք չգիտի: Եթե չթռչի — գումարը կորած է: Դա միշտ ռիսկ է առանց արդյունքի երաշխիքների:">${t('1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это <strong>всегда риск</strong> без гарантий результата.', '1 տեսանյութ բլոգերի մոտ — դա վիճակախաղ է: Կհայտնվի՞ առաջարկություններում, թե ոչ — ոչ ոք չգիտի: Եթե չթռչի — գումարը կորած է: Դա <strong>միշտ ռիսկ է</strong> առանց արդյունքի երաշխիքների:')}</p>
        </div>
        <div class="compare-side good">
          <h4><i class="fas fa-chart-line"></i> <span data-ru="25 выкупов по ключевым" data-am="25 գնում բանալի բառերով">${t('25 выкупов по ключевым', '25 գնում բանալի բառերով')}</span></h4>
          <div class="price-tag">11 000 ₽</div>
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

<!-- ===== FINAL CTA STRIP ===== -->
<section class="bp-cta-strip">
  <div class="container">
    <div class="acs-card">
      <div class="acs-text">
        <h3 data-ru="Готовы начать выкупы?" data-am="Պատրա՞ստ եք սկսել գնումները">${t('Готовы начать выкупы?', 'Պատրա՞ստ եք սկսել գնումները')}</h3>
        <p data-ru="Напишите в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов." data-am="Գրեք Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։">${t('Напишите в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов.', 'Գրեք Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։')}</p>
      </div>
      <div class="acs-actions">
        <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-tg">
          <i class="fab fa-telegram"></i>
          <span>Telegram</span>
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

  return renderPageShell({
    page: 'buyouts',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'buyouts-page',
    mainHtml,
    extraHead,
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
function renderFaqPage(opts: { lang: 'ru' | 'am', siteOrigin: string }): string {
  const { lang, siteOrigin } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru

  // 12 FAQ items: 7 carried over from the home #faq section + 5 new
  // entries covering payment, guarantees, lead times, paperwork and the
  // legal status of self-buyouts on Wildberries.
  const faqItems: Array<{ qRu: string, qAm: string, aRu: string, aAm: string }> = [
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
  const extraHead = `<style>
.faq-page{padding-top:88px}
/* Hero */
.fp-hero{padding:24px 0 40px}
.fp-hero .fh-inner{max-width:780px;margin:0 auto;text-align:center}
.fp-hero .fh-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:18px;text-transform:uppercase;letter-spacing:0.5px}
.fp-hero h1{font-size:clamp(1.8rem,3.4vw,2.6rem);font-weight:800;line-height:1.18;margin-bottom:14px;letter-spacing:-0.02em}
.fp-hero h1 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.fp-hero .fh-desc{font-size:1rem;color:var(--text-sec);margin:0 auto;line-height:1.7;max-width:640px}
/* FAQ list */
.fp-faq{padding:24px 0 56px}
.faq-list{max-width:820px;margin:0 auto}
.faq-item{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);margin-bottom:12px;overflow:hidden;transition:var(--t)}
.faq-item.active{border-color:rgba(139,92,246,0.3)}
.faq-q{padding:20px 24px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;font-weight:600;font-size:0.95rem;line-height:1.4}
.faq-q span{flex:1}
.faq-q i{color:var(--purple);transition:var(--t);font-size:0.78rem;flex-shrink:0}
.faq-item.active .faq-q i{transform:rotate(180deg)}
.faq-a{padding:0 24px;max-height:0;overflow:hidden;transition:max-height 0.4s ease,padding 0.4s ease}
.faq-item.active .faq-a{max-height:600px;padding:0 24px 20px}
.faq-a p{color:var(--text-sec);font-size:0.92rem;line-height:1.75}
/* Final CTA strip — light variant, mirrors /buyouts pattern */
.fp-cta-strip{padding:8px 0 64px}
.fp-cta-strip .acs-card{background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(139,92,246,0.04));border:1px solid rgba(139,92,246,0.25);border-radius:var(--r-lg);padding:28px 32px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;box-shadow:0 12px 40px rgba(0,0,0,0.18)}
.fp-cta-strip .acs-text h3{font-size:1.4rem;font-weight:800;margin-bottom:6px}
.fp-cta-strip .acs-text p{color:var(--text-sec);font-size:0.92rem;margin:0;max-width:380px}
.fp-cta-strip .acs-actions{display:flex;gap:12px;flex-wrap:wrap}
.fp-cta-strip .acs-actions .btn{padding:12px 20px;font-size:0.9rem}
@media(max-width:900px){
  .faq-page{padding-top:80px}
  .fp-cta-strip .acs-card{padding:24px 20px;flex-direction:column;align-items:flex-start}
  .fp-cta-strip .acs-actions{width:100%}
  .fp-cta-strip .acs-actions .btn{flex:1;justify-content:center;min-width:140px}
}
@media(max-width:600px){
  .fp-cta-strip .acs-actions{flex-direction:column}
  .fp-cta-strip .acs-actions .btn{width:100%}
  .faq-q{padding:16px 18px;font-size:0.9rem}
  .faq-item.active .faq-a{padding:0 18px 18px}
}
</style>
<script type="application/ld+json">${faqJsonLdSafe}</script>`

  const tgUrl = PLACEHOLDER_TG_URL

  // Render accordion. First item gets `.active` so the answer is open by
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
<!-- ===== FAQ HERO ===== -->
<section class="fp-hero">
  <div class="container">
    <div class="fh-inner">
      <div class="fh-eyebrow">
        <i class="fas fa-question-circle"></i>
        <span data-ru="FAQ" data-am="ՀՏՀ">FAQ</span>
      </div>
      <h1>
        <span data-ru="Часто задаваемые" data-am="Հաճախ տրվող">${t('Часто задаваемые', 'Հաճախ տրվող')}</span>
        <span class="gr" data-ru="вопросы" data-am="հարցեր">${t('вопросы', 'հարցեր')}</span>
      </h1>
      <p class="fh-desc" data-ru="Ответы на ключевые вопросы по выкупам Wildberries: безопасность кабинета, сроки, оплата, документы и легальность. Не нашли ответ — напишите нам в Telegram." data-am="Պատասխաններ Wildberries-ի հետագնումների վերաբերյալ հիմնական հարցերին՝ կաբինետի անվտանգություն, ժամկետներ, վճարում, փաստաթղթեր և օրինականություն: Չգտա՞ք պատասխանը — գրեք մեզ Telegram-ով:">${t('Ответы на ключевые вопросы по выкупам Wildberries: безопасность кабинета, сроки, оплата, документы и легальность. Не нашли ответ — напишите нам в Telegram.', 'Պատասխաններ Wildberries-ի հետագնումների վերաբերյալ հիմնական հարցերին՝ կաբինետի անվտանգություն, ժամկետներ, վճարում, փաստաթղթեր և օրինականություն: Չգտա՞ք պատասխանը — գրեք մեզ Telegram-ով:')}</p>
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
        <h3 data-ru="Не нашли ответ?" data-am="Չգտա՞ք պատասխանը:">${t('Не нашли ответ?', 'Չգտա՞ք պատասխանը:')}</h3>
        <p data-ru="Напишите нам в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов." data-am="Գրեք մեզ Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։">${t('Напишите нам в Telegram, оставьте заявку на обратный звонок или перейдите в раздел контактов.', 'Գրեք մեզ Telegram-ով, թողեք հետադարձ զանգի հայտ կամ անցեք կոնտակտների բաժին։')}</p>
      </div>
      <div class="acs-actions">
        <a href="${tgUrl}" target="_blank" rel="noopener" class="btn btn-tg">
          <i class="fab fa-telegram"></i>
          <span>Telegram</span>
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

  return renderPageShell({
    page: 'faq',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'faq-page',
    mainHtml,
    extraHead,
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
function renderContactsPage(opts: { lang: 'ru' | 'am', siteOrigin: string }): string {
  const { lang, siteOrigin } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru

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
  const waLabel = '+374 55 22 62 24'

  // Page-only styles. Reuses --purple/--bg-card/--text/etc tokens declared
  // in renderPageShell. .form-card / .form-group are scoped here so they
  // don't conflict with the home-page form (which lives in a different
  // CSS context). intl-tel-input CSS+JS are loaded so #formPhone gets a
  // country selector; submitForm() in landing.js falls back to plain
  // validation when the lib isn't ready.
  const extraHead = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/intl-tel-input@25/build/css/intlTelInput.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/intl-tel-input@25/build/js/intlTelInput.min.js"></script>
<style>
.contacts-page{padding-top:88px}
/* Hero */
.cp-hero{padding:24px 0 36px}
.cp-hero .ch-inner{max-width:780px;margin:0 auto;text-align:center}
.cp-hero .ch-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:18px;text-transform:uppercase;letter-spacing:0.5px}
.cp-hero h1{font-size:clamp(1.8rem,3.4vw,2.6rem);font-weight:800;line-height:1.18;margin-bottom:14px;letter-spacing:-0.02em}
.cp-hero h1 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.cp-hero .ch-desc{font-size:1rem;color:var(--text-sec);margin:0 auto;line-height:1.7;max-width:640px}
/* Channels grid */
.cp-channels{padding:24px 0 32px}
.cp-channels-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:1080px;margin:0 auto}
.cp-channel{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:28px 24px;display:flex;flex-direction:column;align-items:flex-start;gap:14px;transition:var(--t)}
.cp-channel:hover{border-color:rgba(139,92,246,0.35);transform:translateY(-3px);box-shadow:0 14px 40px rgba(0,0,0,0.3)}
.cp-channel-icon{width:54px;height:54px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:#fff}
.cp-ch-tg .cp-channel-icon{background:linear-gradient(135deg,#0088cc,#0077b5)}
.cp-ch-wa .cp-channel-icon{background:linear-gradient(135deg,#25D366,#128C7E)}
.cp-channel h3{font-size:1.12rem;font-weight:700;margin:0;line-height:1.3}
.cp-channel-handle{font-family:'Inter',monospace;font-size:0.92rem;font-weight:600;color:var(--accent);background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.18);padding:6px 12px;border-radius:8px;letter-spacing:0.2px}
.cp-channel-desc{color:var(--text-sec);font-size:0.9rem;line-height:1.6;margin:0}
.cp-channel-cta{margin-top:auto;display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border-radius:var(--r-sm);font-weight:600;font-size:0.9rem;width:100%;justify-content:center;color:#fff;transition:var(--t)}
.cp-ch-tg .cp-channel-cta{background:linear-gradient(135deg,#0088cc,#0077b5);box-shadow:0 4px 15px rgba(0,136,204,0.3)}
.cp-ch-wa .cp-channel-cta{background:linear-gradient(135deg,#25D366,#128C7E);box-shadow:0 4px 15px rgba(37,211,102,0.3)}
.cp-channel-cta:hover{transform:translateY(-1px);filter:brightness(1.05)}
/* QR section */
.cp-qr{padding:24px 0 40px}
.cp-qr-wrap{max-width:1000px;margin:0 auto;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:32px 28px;text-align:center}
.cp-qr-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:0.78rem;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px}
.cp-qr-wrap h2{font-size:clamp(1.2rem,2vw,1.6rem);font-weight:800;margin-bottom:6px}
.cp-qr-wrap p.cp-qr-sub{color:var(--text-sec);font-size:0.92rem;line-height:1.6;margin:0 auto 24px;max-width:520px}
.cp-qr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.cp-qr-card{display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px;background:rgba(139,92,246,0.05);border:1px solid rgba(139,92,246,0.15);border-radius:14px;transition:var(--t);text-decoration:none;color:var(--text)}
.cp-qr-card:hover{border-color:var(--purple);background:rgba(139,92,246,0.1);transform:translateY(-2px)}
.cp-qr-card img{width:120px;height:120px;object-fit:contain;border-radius:10px;background:#fff;padding:6px}
.cp-qr-card span{font-size:0.78rem;font-weight:600;color:var(--text-sec);text-align:center}
/* Lead form */
.cp-form{padding:24px 0 40px}
.cp-form-header{text-align:center;max-width:640px;margin:0 auto 24px}
.cp-form-header h2{font-size:clamp(1.4rem,2.4vw,1.9rem);font-weight:800;margin-bottom:8px}
.cp-form-header p{color:var(--text-sec);font-size:0.95rem;line-height:1.6;margin:0}
.form-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:36px;max-width:600px;margin:0 auto}
.form-group{margin-bottom:18px}
.form-group label{display:block;font-size:0.82rem;font-weight:600;margin-bottom:8px;color:var(--text-sec)}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:12px 16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:1rem;font-family:inherit;transition:var(--t)}
.form-group input:focus,.form-group textarea:focus,.form-group select:focus{outline:none;border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.15)}
.form-group textarea{resize:vertical;min-height:96px}
.form-group select option{background:var(--bg-card)}
/* intl-tel-input wrapper width */
.form-group .iti{width:100%}
.form-group .iti input.iti__tel-input{width:100%}
/* Address & hours */
.cp-info{padding:8px 0 40px}
.cp-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:1000px;margin:0 auto}
.cp-info-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:28px 24px;display:flex;gap:18px;align-items:flex-start}
.cp-info-icon{width:54px;height:54px;border-radius:14px;background:linear-gradient(135deg,rgba(139,92,246,0.18),rgba(139,92,246,0.06));border:1px solid rgba(139,92,246,0.25);display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:var(--purple);flex-shrink:0}
.cp-info-text h3{font-size:1.05rem;font-weight:700;margin-bottom:6px}
.cp-info-text p{color:var(--text-sec);font-size:0.92rem;line-height:1.65;margin:0}
.cp-info-text strong{color:var(--text);display:block;margin-bottom:4px}
/* Final CTA strip — same shape as buyouts/faq */
.cp-cta-strip{padding:8px 0 64px}
.cp-cta-strip .acs-card{background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(139,92,246,0.04));border:1px solid rgba(139,92,246,0.25);border-radius:var(--r-lg);padding:28px 32px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;box-shadow:0 12px 40px rgba(0,0,0,0.18)}
.cp-cta-strip .acs-text h3{font-size:1.4rem;font-weight:800;margin-bottom:6px}
.cp-cta-strip .acs-text p{color:var(--text-sec);font-size:0.92rem;margin:0;max-width:380px}
.cp-cta-strip .acs-actions{display:flex;gap:12px;flex-wrap:wrap}
.cp-cta-strip .acs-actions .btn{padding:12px 20px;font-size:0.9rem}
@media(max-width:900px){
  .contacts-page{padding-top:80px}
  .cp-channels-grid{grid-template-columns:1fr;gap:16px}
  .cp-info-grid{grid-template-columns:1fr}
  .cp-cta-strip .acs-card{padding:24px 20px;flex-direction:column;align-items:flex-start}
  .cp-cta-strip .acs-actions{width:100%}
  .cp-cta-strip .acs-actions .btn{flex:1;justify-content:center;min-width:140px}
}
@media(max-width:600px){
  .cp-qr-grid{grid-template-columns:repeat(2,1fr);gap:12px}
  .cp-qr-card img{width:96px;height:96px}
  .cp-qr-wrap{padding:24px 18px}
  .form-card{padding:24px 20px}
  .cp-info-card{padding:22px 18px;gap:14px}
  .cp-cta-strip .acs-actions{flex-direction:column}
  .cp-cta-strip .acs-actions .btn{width:100%}
}
</style>`

  const mainHtml = `
<!-- ===== CONTACTS HERO ===== -->
<section class="cp-hero">
  <div class="container">
    <div class="ch-inner">
      <div class="ch-eyebrow">
        <i class="fas fa-headset"></i>
        <span data-ru="Контакты" data-am="Կապ">${t('Контакты', 'Կապ')}</span>
      </div>
      <h1>
        <span data-ru="Свяжитесь" data-am="Կապվեք">${t('Свяжитесь', 'Կապվեք')}</span>
        <span class="gr" data-ru="с нами" data-am="մեզ հետ">${t('с нами', 'մեզ հետ')}</span>
      </h1>
      <p class="ch-desc" data-ru="Выберите удобный канал — Telegram, WhatsApp, форма заявки или обратный звонок. Менеджер отвечает в среднем за 5 минут в рабочее время." data-am="Ընտրեք ձեզ հարմար եղանակը՝ Telegram, WhatsApp, հայտի ձև կամ հետադարձ զանգ: Մենեջերը պատասխանում է միջինը 5 րոպեի ընթացքում աշխատանքային ժամերին:">${t('Выберите удобный канал — Telegram, WhatsApp, форма заявки или обратный звонок. Менеджер отвечает в среднем за 5 минут в рабочее время.', 'Ընտրեք ձեզ հարմար եղանակը՝ Telegram, WhatsApp, հայտի ձև կամ հետադարձ զանգ: Մենեջերը պատասխանում է միջինը 5 րոպեի ընթացքում աշխատանքային ժամերին:')}</p>
    </div>
  </div>
</section>

<!-- ===== CHANNELS GRID ===== -->
<section class="cp-channels">
  <div class="container">
    <div class="cp-channels-grid">
      <div class="cp-channel cp-ch-tg">
        <div class="cp-channel-icon"><i class="fab fa-telegram"></i></div>
        <h3 data-ru="Telegram — администратор" data-am="Telegram — ադմինիստրատոր">${t('Telegram — администратор', 'Telegram — ադմինիստրատոր')}</h3>
        <span class="cp-channel-handle" data-no-rewrite="1">@goo_to_top</span>
        <p class="cp-channel-desc" data-ru="Готовы оплатить и стартовать? Менеджер ответит в течение 5 минут в рабочее время." data-am="Պատրաստ եք վճարել և սկսել: Մենեջերը կպատասխանի 5 րոպեի ընթացքում աշխատանքային ժամերին:">${t('Готовы оплатить и стартовать? Менеджер ответит в течение 5 минут в рабочее время.', 'Պատրաստ եք վճարել և սկսել: Մենեջերը կպատասխանի 5 րոպեի ընթացքում աշխատանքային ժամերին:')}</p>
        <a href="${tgUrl}" target="_blank" rel="noopener" class="cp-channel-cta">
          <i class="fab fa-telegram"></i>
          <span data-ru="Написать в Telegram" data-am="Գրել Telegram-ով">${t('Написать в Telegram', 'Գրել Telegram-ով')}</span>
        </a>
      </div>
      <div class="cp-channel cp-ch-tg">
        <div class="cp-channel-icon"><i class="fab fa-telegram"></i></div>
        <h3 data-ru="Telegram — поддержка" data-am="Telegram — աջակցություն">${t('Telegram — поддержка', 'Telegram — աջակցություն')}</h3>
        <span class="cp-channel-handle" data-no-rewrite="1">@suport_admin_2</span>
        <p class="cp-channel-desc" data-ru="Нужен детальный расчёт или консультация по продвижению? Пишите сюда — отвечает старший менеджер." data-am="Պետք է մանրամասն հաշվարկ կամ խորհրդատվություն: Գրեք այստեղ — պատասխանում է ավագ մենեջերը:">${t('Нужен детальный расчёт или консультация по продвижению? Пишите сюда — отвечает старший менеджер.', 'Պետք է մանրամասն հաշվարկ կամ խորհրդատվություն: Գրեք այստեղ — պատասխանում է ավագ մենեջերը:')}</p>
        <a href="${tgSupportUrl}" target="_blank" rel="noopener" class="cp-channel-cta">
          <i class="fab fa-telegram"></i>
          <span data-ru="Написать в поддержку" data-am="Գրել աջակցությանը">${t('Написать в поддержку', 'Գրել աջակցությանը')}</span>
        </a>
      </div>
      <div class="cp-channel cp-ch-wa">
        <div class="cp-channel-icon"><i class="fab fa-whatsapp"></i></div>
        <h3 data-ru="WhatsApp" data-am="WhatsApp">WhatsApp</h3>
        <span class="cp-channel-handle" data-no-rewrite="1">${waLabel}</span>
        <p class="cp-channel-desc" data-ru="Удобно с телефона? Напишите в WhatsApp — отвечаем так же быстро, как в Telegram." data-am="Հարմա՞ր է հեռախոսից: Գրեք WhatsApp-ով — պատասխանում ենք նույնքան արագ, որքան Telegram-ով:">${t('Удобно с телефона? Напишите в WhatsApp — отвечаем так же быстро, как в Telegram.', 'Հարմա՞ր է հեռախոսից: Գրեք WhatsApp-ով — պատասխանում ենք նույնքան արագ, որքան Telegram-ով:')}</p>
        <a href="${waUrl}" target="_blank" rel="noopener" class="cp-channel-cta">
          <i class="fab fa-whatsapp"></i>
          <span data-ru="Написать в WhatsApp" data-am="Գրել WhatsApp-ով">${t('Написать в WhatsApp', 'Գրել WhatsApp-ով')}</span>
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
        <a href="${tgUrl}" target="_blank" rel="noopener" class="cp-qr-card">
          <img src="/static/img/qr/qr-telegram.png" alt="Telegram QR" loading="lazy">
          <span data-ru="Telegram чат" data-am="Telegram չատ">${t('Telegram чат', 'Telegram չատ')}</span>
        </a>
        <a href="${waUrl}" target="_blank" rel="noopener" class="cp-qr-card">
          <img src="/static/img/qr/qr-whatsapp.png" alt="WhatsApp QR" loading="lazy">
          <span data-ru="WhatsApp" data-am="WhatsApp">WhatsApp</span>
        </a>
        <a href="https://www.instagram.com/goo_to_top/" target="_blank" rel="noopener" class="cp-qr-card">
          <img src="/static/img/qr/qr-instagram.png" alt="Instagram QR" loading="lazy">
          <span data-ru="Наш Instagram" data-am="Մեր Instagram">${t('Наш Instagram', 'Մեր Instagram')}</span>
        </a>
        <a href="https://www.facebook.com/gototop.wb" target="_blank" rel="noopener" class="cp-qr-card">
          <img src="/static/img/qr/qr-facebook.png" alt="Facebook QR" loading="lazy">
          <span data-ru="Наш Facebook" data-am="Մեր Facebook">${t('Наш Facebook', 'Մեր Facebook')}</span>
        </a>
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
        <h3 data-ru="Не нашли подходящий канал?" data-am="Չգտա՞ք ձեզ հարմար եղանակ:">${t('Не нашли подходящий канал?', 'Չգտա՞ք ձեզ հարմար եղանակ:')}</h3>
        <p data-ru="Закажите обратный звонок — менеджер перезвонит в удобное вам время и поможет с любым вопросом." data-am="Պատվիրեք հետադարձ զանգ — մենեջերը կզանգահարի ձեզ հարմար ժամանակին և կօգնի ցանկացած հարցում:">${t('Закажите обратный звонок — менеджер перезвонит в удобное вам время и поможет с любым вопросом.', 'Պատվիրեք հետադարձ զանգ — մենեջերը կզանգահարի ձեզ հարմար ժամանակին և կօգնի ցանկացած հարցում:')}</p>
      </div>
      <div class="acs-actions">
        <button type="button" class="btn btn-primary" onclick="openCallbackModal()">
          <i class="fas fa-phone"></i>
          <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք">${t('Перезвоните мне', 'Հետ զանգահարեք')}</span>
        </button>
      </div>
    </div>
  </div>
</section>
`

  return renderPageShell({
    page: 'contacts',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'contacts-page',
    mainHtml,
    extraHead,
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
function renderReferralPage(opts: { lang: 'ru' | 'am', siteOrigin: string }): string {
  const { lang, siteOrigin } = opts
  const isAM = lang === 'am'
  const t = (ru: string, am: string) => isAM ? am : ru

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
  const extraHead = `<style>
.referral-page{padding-top:88px}
/* Hero */
.rp-hero{padding:24px 0 40px}
.rp-hero .rh-inner{max-width:820px;margin:0 auto;text-align:center}
.rp-hero .rh-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:18px;text-transform:uppercase;letter-spacing:0.5px}
.rp-hero h1{font-size:clamp(1.9rem,3.6vw,2.8rem);font-weight:800;line-height:1.16;margin-bottom:14px;letter-spacing:-0.02em}
.rp-hero h1 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.rp-hero .rh-desc{font-size:1.02rem;color:var(--text-sec);margin:0 auto 24px;line-height:1.7;max-width:680px}
.rp-hero .rh-cta{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.rp-hero .rh-cta .btn{padding:13px 22px;font-size:0.95rem}
/* How it works — 3 numbered steps */
.rp-steps{padding:32px 0}
.rp-steps-header{text-align:center;max-width:700px;margin:0 auto 32px}
.rp-steps-header .rh-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px}
.rp-steps-header h2{font-size:clamp(1.5rem,2.8vw,2.1rem);font-weight:800;margin-bottom:10px;letter-spacing:-0.02em}
.rp-steps-header h2 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.rp-steps-header p{color:var(--text-sec);font-size:0.95rem;line-height:1.7;margin:0}
.rp-steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:1080px;margin:0 auto}
.rp-step{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:28px 24px;display:flex;flex-direction:column;gap:12px;position:relative;transition:var(--t)}
.rp-step:hover{border-color:rgba(139,92,246,0.35);transform:translateY(-3px);box-shadow:0 12px 30px rgba(0,0,0,0.2)}
.rp-step-num{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,var(--purple),var(--purple-deep));display:flex;align-items:center;justify-content:center;font-size:1.05rem;font-weight:800;color:#fff;box-shadow:0 6px 18px rgba(139,92,246,0.35)}
.rp-step h3{font-size:1.08rem;font-weight:700;line-height:1.3;margin:0}
.rp-step p{color:var(--text-sec);font-size:0.92rem;line-height:1.7;margin:0}
/* Audience grid (mirrors home #for-whom) */
.rp-audience{padding:48px 0}
.rp-audience-header{text-align:center;max-width:700px;margin:0 auto 28px}
.rp-audience-header .rh-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px}
.rp-audience-header h2{font-size:clamp(1.5rem,2.8vw,2.1rem);font-weight:800;margin-bottom:10px;letter-spacing:-0.02em}
.rp-audience-header h2 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.rp-audience-header p{color:var(--text-sec);font-size:0.95rem;line-height:1.7;margin:0}
.rp-aud-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;max-width:1200px;margin:0 auto}
.rp-aud-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:24px 22px;display:flex;flex-direction:column;gap:12px;transition:var(--t)}
.rp-aud-card:hover{border-color:rgba(139,92,246,0.35);transform:translateY(-3px);box-shadow:0 10px 28px rgba(0,0,0,0.2)}
.rp-aud-icon{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,rgba(139,92,246,0.18),rgba(139,92,246,0.06));border:1px solid rgba(139,92,246,0.22);display:flex;align-items:center;justify-content:center;font-size:1.25rem;color:var(--purple)}
.rp-aud-card h3{font-size:1rem;font-weight:700;line-height:1.3;margin:0}
.rp-aud-card p{color:var(--text-sec);font-size:0.88rem;line-height:1.7;margin:0}
/* Bonus tiers */
.rp-tiers{padding:32px 0 48px}
.rp-tiers-header{text-align:center;max-width:720px;margin:0 auto 32px}
.rp-tiers-header .rh-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px}
.rp-tiers-header h2{font-size:clamp(1.5rem,2.8vw,2.1rem);font-weight:800;margin-bottom:10px;letter-spacing:-0.02em}
.rp-tiers-header h2 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.rp-tiers-header p{color:var(--text-sec);font-size:0.95rem;line-height:1.7;margin:0}
.rp-tiers-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:1100px;margin:0 auto}
.rp-tier{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:32px 26px;display:flex;flex-direction:column;gap:14px;position:relative;transition:var(--t)}
.rp-tier:hover{transform:translateY(-4px);box-shadow:0 14px 36px rgba(0,0,0,0.25)}
.rp-tier-pro{border-color:rgba(139,92,246,0.45);background:linear-gradient(180deg,rgba(139,92,246,0.08),rgba(139,92,246,0.02))}
.rp-tier-pro::after{content:attr(data-badge);position:absolute;top:-12px;right:20px;padding:4px 12px;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:#fff;font-size:0.68rem;font-weight:700;border-radius:50px;letter-spacing:0.5px;text-transform:uppercase}
.rp-tier-vip{border-color:rgba(245,158,11,0.4);background:linear-gradient(180deg,rgba(245,158,11,0.07),rgba(245,158,11,0.02))}
.rp-tier-vip .rp-tier-icon{background:linear-gradient(135deg,rgba(245,158,11,0.22),rgba(245,158,11,0.08));border-color:rgba(245,158,11,0.3);color:#F59E0B}
.rp-tier-vip .rp-tier-pct{background:linear-gradient(135deg,#F59E0B,#FBBF24);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.rp-tier-icon{width:54px;height:54px;border-radius:14px;background:linear-gradient(135deg,rgba(139,92,246,0.18),rgba(139,92,246,0.06));border:1px solid rgba(139,92,246,0.22);display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:var(--purple)}
.rp-tier h3{font-size:1.15rem;font-weight:700;margin:0;line-height:1.3}
.rp-tier-pct{font-size:2.4rem;font-weight:900;line-height:1;background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-0.02em}
.rp-tier-pct-label{font-size:0.78rem;font-weight:600;color:var(--text-muted);margin-top:-6px;letter-spacing:0.3px}
.rp-tier-desc{color:var(--text-sec);font-size:0.92rem;line-height:1.7;margin:0}
.rp-tier-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
.rp-tier-list li{display:flex;gap:10px;align-items:flex-start;font-size:0.88rem;color:var(--text-sec);line-height:1.55}
.rp-tier-list li i{color:#10B981;margin-top:4px;flex-shrink:0;font-size:0.85rem}
.rp-tier-note{font-size:0.74rem;color:var(--text-muted);text-align:center;margin:18px auto 0;max-width:640px;line-height:1.6}
.rp-tier-note i{margin-right:6px;color:var(--accent)}
/* FAQ — copies /faq accordion so toggleFaq() works unchanged */
.rp-faq{padding:32px 0 48px}
.rp-faq-header{text-align:center;max-width:700px;margin:0 auto 28px}
.rp-faq-header .rh-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px}
.rp-faq-header h2{font-size:clamp(1.5rem,2.8vw,2.1rem);font-weight:800;margin-bottom:10px;letter-spacing:-0.02em}
.rp-faq-header h2 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.rp-faq-header p{color:var(--text-sec);font-size:0.95rem;line-height:1.7;margin:0}
.faq-list{max-width:820px;margin:0 auto}
.faq-item{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);margin-bottom:12px;overflow:hidden;transition:var(--t)}
.faq-item.active{border-color:rgba(139,92,246,0.3)}
.faq-q{padding:20px 24px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;font-weight:600;font-size:0.95rem;line-height:1.4}
.faq-q span{flex:1}
.faq-q i{color:var(--purple);transition:var(--t);font-size:0.78rem;flex-shrink:0}
.faq-item.active .faq-q i{transform:rotate(180deg)}
.faq-a{padding:0 24px;max-height:0;overflow:hidden;transition:max-height 0.4s ease,padding 0.4s ease}
.faq-item.active .faq-a{max-height:600px;padding:0 24px 20px}
.faq-a p{color:var(--text-sec);font-size:0.92rem;line-height:1.75}
/* Final CTA strip — same shape as faq/contacts */
.rp-cta-strip{padding:8px 0 64px}
.rp-cta-strip .acs-card{background:linear-gradient(135deg,rgba(139,92,246,0.12),rgba(139,92,246,0.04));border:1px solid rgba(139,92,246,0.25);border-radius:var(--r-lg);padding:28px 32px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;box-shadow:0 12px 40px rgba(0,0,0,0.18)}
.rp-cta-strip .acs-text h3{font-size:1.4rem;font-weight:800;margin-bottom:6px}
.rp-cta-strip .acs-text p{color:var(--text-sec);font-size:0.92rem;margin:0;max-width:380px}
.rp-cta-strip .acs-actions{display:flex;gap:12px;flex-wrap:wrap}
.rp-cta-strip .acs-actions .btn{padding:12px 20px;font-size:0.9rem}
@media(max-width:1000px){
  .rp-aud-grid{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:900px){
  .referral-page{padding-top:80px}
  .rp-steps-grid{grid-template-columns:1fr;gap:14px}
  .rp-tiers-grid{grid-template-columns:1fr;gap:16px}
  .rp-cta-strip .acs-card{padding:24px 20px;flex-direction:column;align-items:flex-start}
  .rp-cta-strip .acs-actions{width:100%}
  .rp-cta-strip .acs-actions .btn{flex:1;justify-content:center;min-width:140px}
}
@media(max-width:600px){
  .rp-aud-grid{grid-template-columns:1fr;gap:12px}
  .rp-aud-card{padding:20px 18px}
  .rp-tier{padding:26px 20px}
  .rp-tier-pct{font-size:2rem}
  .rp-cta-strip .acs-actions{flex-direction:column}
  .rp-cta-strip .acs-actions .btn{width:100%}
  .faq-q{padding:16px 18px;font-size:0.9rem}
  .faq-item.active .faq-a{padding:0 18px 18px}
}
</style>`

  // Render bonus tier cards. Pro tier gets a "Популярно" pill via
  // ::after / data-badge so we don't need extra DOM nodes.
  const tiersHtml = bonusTiers.map((tier) => {
    const badgeAttr = tier.cls === 'rp-tier-pro'
      ? ` data-badge="${t('Популярно', 'Հանրաճանաչ')}"`
      : ''
    const bullets = (isAM ? tier.bulletsAm : tier.bulletsRu)
      .map((b, i) => `            <li><i class="fas fa-check-circle"></i><span data-ru="${tier.bulletsRu[i]}" data-am="${tier.bulletsAm[i]}">${b}</span></li>`)
      .join('\n')
    const titleNow = t(tier.titleRu, tier.titleAm)
    const descNow = t(tier.descRu, tier.descAm)
    return `      <div class="rp-tier ${tier.cls}"${badgeAttr}>
        <div class="rp-tier-icon"><i class="fas ${tier.icon}"></i></div>
        <h3 data-ru="${tier.titleRu}" data-am="${tier.titleAm}">${titleNow}</h3>
        <div>
          <div class="rp-tier-pct">${tier.pct}</div>
          <div class="rp-tier-pct-label" data-ru="с первой оплаты клиента" data-am="հաճախորդի առաջին վճարումից">${t('с первой оплаты клиента', 'հաճախորդի առաջին վճարումից')}</div>
        </div>
        <p class="rp-tier-desc" data-ru="${tier.descRu}" data-am="${tier.descAm}">${descNow}</p>
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
      <div class="rh-eyebrow">
        <i class="fas fa-handshake"></i>
        <span data-ru="Партнёрская программа" data-am="Գործընկերային ծրագիր">${t('Партнёрская программа', 'Գործընկերային ծրագիր')}</span>
      </div>
      <h1>
        <span data-ru="Реферальная программа" data-am="Հղման ծրագիր">${t('Реферальная программа', 'Հղման ծրագիր')}</span>
        <span class="gr">Go to Top</span>
      </h1>
      <p class="rh-desc" data-ru="Получайте бонусы за каждого приведённого клиента — от 5% до 15% с первой оплаты и индивидуальные условия для активных партнёров. Прозрачная сетка комиссий, выплаты в RUB или AMD." data-am="Ստացեք բոնուսներ յուրաքանչյուր ձեր կողմից բերված հաճախորդի համար՝ 5%-ից 15% առաջին վճարումից և անհատական պայմաններ ակտիվ գործընկերների համար։ Թափանցիկ հանձնաժողովների ցանց, վճարումներ RUB-ով կամ AMD-ով։">${t('Получайте бонусы за каждого приведённого клиента — от 5% до 15% с первой оплаты и индивидуальные условия для активных партнёров. Прозрачная сетка комиссий, выплаты в RUB или AMD.', 'Ստացեք բոնուսներ յուրաքանչյուր ձեր կողմից բերված հաճախորդի համար՝ 5%-ից 15% առաջին վճարումից և անհատական պայմաններ ակտիվ գործընկերների համար։ Թափանցիկ հանձնաժողովների ցանց, վճարումներ RUB-ով կամ AMD-ով։')}</p>
      <div class="rh-cta">
        <a href="${tgPromoUrl}" target="_blank" rel="noopener" class="btn btn-tg btn-lg">
          <i class="fab fa-telegram"></i>
          <span data-ru="Стать партнёром — получить промокод" data-am="Դառնալ գործընկեր — ստանալ պրոմո կոդ">${t('Стать партнёром — получить промокод', 'Դառնալ գործընկեր — ստանալ պրոմո կոդ')}</span>
        </a>
        <button type="button" class="btn btn-outline btn-lg" onclick="openCallbackModal()">
          <i class="fas fa-phone"></i>
          <span data-ru="Перезвоните мне" data-am="Հետ զանգահարեք">${t('Перезвоните мне', 'Հետ զանգահարեք')}</span>
        </button>
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
        <h3 data-ru="Получите промокод" data-am="Ստացեք պրոմո կոդ">${t('Получите промокод', 'Ստացեք պրոմո կոդ')}</h3>
        <p data-ru="Напишите менеджеру в Telegram — выдадим персональный промокод и партнёрскую ссылку в течение рабочего дня." data-am="Գրեք մենեջերին Telegram-ով — կտրամադրենք անհատական պրոմո կոդ և գործընկերային հղում աշխատանքային օրվա ընթացքում։">${t('Напишите менеджеру в Telegram — выдадим персональный промокод и партнёрскую ссылку в течение рабочего дня.', 'Գրեք մենեջերին Telegram-ով — կտրամադրենք անհատական պրոմո կոդ և գործընկերային հղում աշխատանքային օրվա ընթացքում։')}</p>
      </div>
      <div class="rp-step">
        <div class="rp-step-num">2</div>
        <h3 data-ru="Делитесь с клиентами" data-am="Կիսվեք հաճախորդների հետ">${t('Делитесь с клиентами', 'Կիսվեք հաճախորդների հետ')}</h3>
        <p data-ru="Отправляйте код в личных переписках, добавляйте в посты, сторис и видео — клиент вводит его в калькуляторе на главной." data-am="Ուղարկեք կոդը անձնական նամակագրություններում, ավելացրեք գրառումներում, ստորիներում և տեսանյութերում — հաճախորդը մուտքագրում է այն գլխավոր էջի հաշվիչում։">${t('Отправляйте код в личных переписках, добавляйте в посты, сторис и видео — клиент вводит его в калькуляторе на главной.', 'Ուղարկեք կոդը անձնական նամակագրություններում, ավելացրեք գրառումներում, ստորիներում և տեսանյութերում — հաճախորդը մուտքագրում է այն գլխավոր էջի հաշվիչում։')}</p>
      </div>
      <div class="rp-step">
        <div class="rp-step-num">3</div>
        <h3 data-ru="Получайте бонус" data-am="Ստացեք բոնուս">${t('Получайте бонус', 'Ստացեք բոնուս')}</h3>
        <p data-ru="Бонус начисляется с каждой оплаты приведённого клиента — выплаты раз в две недели на карту в RUB или AMD по согласованию." data-am="Բոնուսը հաշվարկվում է բերված հաճախորդի յուրաքանչյուր վճարումից — վճարումները երկու շաբաթը մեկ՝ քարտին RUB-ով կամ AMD-ով համաձայնության համաձայն։">${t('Бонус начисляется с каждой оплаты приведённого клиента — выплаты раз в две недели на карту в RUB или AMD по согласованию.', 'Բոնուսը հաշվարկվում է բերված հաճախորդի յուրաքանչյուր վճարումից — վճարումները երկու շաբաթը մեկ՝ քարտին RUB-ով կամ AMD-ով համաձայնության համաձայն։')}</p>
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
<section class="rp-tiers">
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

<!-- ===== FINAL CTA STRIP ===== -->
<section class="rp-cta-strip">
  <div class="container">
    <div class="acs-card">
      <div class="acs-text">
        <h3 data-ru="Готовы стать партнёром?" data-am="Պատրա՞ստ եք դառնալ գործընկեր">${t('Готовы стать партнёром?', 'Պատրա՞ստ եք դառնալ գործընկեր')}</h3>
        <p data-ru="Получите промокод за 5 минут, обсудите условия с менеджером или напишите нам на странице контактов." data-am="Ստացեք պրոմո կոդ 5 րոպեում, քննարկեք պայմանները մենեջերի հետ կամ գրեք մեզ կոնտակտների էջից։">${t('Получите промокод за 5 минут, обсудите условия с менеджером или напишите нам на странице контактов.', 'Ստացեք պրոմո կոդ 5 րոպեում, քննարկեք պայմանները մենեջերի հետ կամ գրեք մեզ կոնտակտների էջից։')}</p>
      </div>
      <div class="acs-actions">
        <a href="${tgPromoUrl}" target="_blank" rel="noopener" class="btn btn-tg">
          <i class="fab fa-telegram"></i>
          <span data-ru="Получить код" data-am="Ստանալ կոդը">${t('Получить код', 'Ստանալ կոդը')}</span>
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

  return renderPageShell({
    page: 'referral',
    lang,
    siteOrigin,
    seo,
    bodyClass: 'referral-page',
    mainHtml,
    extraHead,
  })
}

export function register(app: Hono<{ Bindings: Bindings }>) {
app.get('/', async (c) => {
  // Browser: 30s fresh, Edge: 600s via Cache API wrapper (index.tsx).
  // stale-while-revalidate=600 means the browser can show a stale page
  // for up to 10 min while revalidating in the background — eliminates white-screen waits.
  c.header('Cache-Control', 'public, max-age=30, s-maxage=600, stale-while-revalidate=600');
  
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
  // Default language is Russian; Armenian only if explicitly requested via URL
  const isArmenian = urlLang === 'am' || urlLang === 'hy';
  
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
<link rel="icon" type="image/x-icon" href="/static/img/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/static/img/favicon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/static/img/apple-touch-icon.png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="preload" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css"></noscript>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/intl-tel-input@25/build/css/intlTelInput.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/intl-tel-input@25/build/js/intlTelInput.min.js"></script>
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
.container{max-width:1440px;margin:0 auto;padding:0 24px;overflow-x:hidden;width:100%;box-sizing:border-box}
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
.hero-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);grid-template-areas:"title photo" "texts photo" "stats photo" "buttons photo";gap:0 60px;align-items:start}
.hero-el-title{grid-area:title}
.hero-el-texts{grid-area:texts}
.hero-el-stats{grid-area:stats;margin-bottom:36px}
.hero-el-buttons{grid-area:buttons}
.hero-image{grid-area:photo;align-self:start;display:flex;flex-direction:column;gap:16px}
.hero-photo-wrap{position:relative;width:100%}
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
.hero-image img,.hero-photo-wrap img{border-radius:var(--r-lg);width:100%;height:auto;aspect-ratio:3/4;max-height:520px;object-fit:cover;object-position:center;border:1px solid var(--border);display:block}
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
.calc-pkg-card .pkg-items div{margin-bottom:2px;line-height:1.7}
.calc-pkg-card .pkg-items div i{color:#22c55e;font-size:0.65rem;margin-right:5px;vertical-align:middle}
.calc-pkg-card .pkg-items div span{white-space:nowrap}
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
.calc-total{display:flex;justify-content:space-between;align-items:flex-start;padding:24px 0;margin-top:16px;border-top:2px solid var(--purple);gap:12px;flex-wrap:wrap}
.calc-total-label{font-size:1.1rem;font-weight:600;flex-shrink:0;white-space:nowrap}
.calc-total-value{font-size:1.8rem;font-weight:800;color:var(--purple);white-space:normal;text-align:right;min-width:0;overflow-wrap:break-word}
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
/* ===== INTL-TEL-INPUT (phone country selector) — dark-theme overrides ===== */
.iti{width:100%;display:block}
.iti__tel-input{width:100%}
.iti--separate-dial-code .iti__selected-flag{background:rgba(139,92,246,0.12);border-radius:var(--r-sm) 0 0 var(--r-sm)}
.iti--separate-dial-code .iti__selected-dial-code{color:var(--text);font-weight:600}
.iti__country-list{background:var(--bg-card);border:1px solid var(--border);color:var(--text);max-height:260px;box-shadow:0 8px 24px rgba(0,0,0,0.4)}
.iti__country.iti__highlight,.iti__country:hover{background:var(--bg-hover)}
.iti__country .iti__country-name{color:var(--text)}
.iti__country .iti__dial-code{color:var(--text-sec)}
.iti__divider{border-bottom-color:var(--border)}
.iti__search-input{background:var(--bg-surface);color:var(--text);border-color:var(--border)}
.iti__arrow{border-top-color:var(--text-sec)}
.iti__arrow--up{border-bottom-color:var(--text-sec)}
.popup-card .pf-group .iti{width:100%}
.popup-card .pf-group .iti .pf-input{width:100%}
#pdfFormWrap .iti{width:100%}
#pdfFormWrap .iti input[type="tel"]{width:100%}
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
  height:100dvh;
  background:rgba(0,0,0,0.85);
  z-index:100000;
  justify-content:center;align-items:center;
  padding:20px;
  overflow:hidden;
  overscroll-behavior:contain;
  touch-action:none;
  -webkit-overflow-scrolling:touch;
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
  padding:32px;
  text-align:center;
  max-width:460px;width:100%;
  position:relative;
  z-index:100001;
  box-shadow:0 0 80px rgba(139,92,246,0.4),0 25px 60px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.1);
  animation:popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards;
  opacity:1;
  transform:scale(1);
  max-height:85vh;
  max-height:85dvh;
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  overscroll-behavior:contain;
}
@keyframes popIn{0%{transform:scale(0.7) translateY(30px);opacity:0}100%{transform:scale(1) translateY(0);opacity:1}}
@keyframes slideUpMobile{0%{transform:translateY(100%)}100%{transform:translateY(0)}}
@media(max-width:640px){
  .popup-overlay{align-items:flex-end;padding:0}
  .popup-card{
    border-radius:20px 20px 0 0;
    max-width:100%;width:100%;
    animation:slideUpMobile 0.4s ease forwards;
    padding:20px 16px;
    padding-bottom:calc(16px + env(safe-area-inset-bottom, 0px));
    max-height:78vh;
    max-height:78dvh;
    overflow-y:auto;
    -webkit-overflow-scrolling:touch;
    overscroll-behavior:contain;
    margin:0;
  }
  .popup-card h3{font-size:1.1rem;margin-bottom:4px}
  .popup-card .popup-icon{width:44px;height:44px;font-size:1.1rem;margin-bottom:8px}
  .popup-card .popup-sub{font-size:0.78rem;margin-bottom:12px;line-height:1.35}
  .popup-card .pf-group{margin-bottom:8px}
  .popup-card .pf-label{font-size:0.72rem;margin-bottom:3px}
  .popup-card .pf-input{padding:9px 11px;font-size:0.88rem}
  .popup-card .pf-row{grid-template-columns:1fr 1fr;gap:10px}
  .popup-card .btn-lg{padding:12px 20px;font-size:0.9rem;margin-top:8px !important}
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
  .container{padding:0 16px}
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
  .calc-row{grid-template-columns:1fr auto;gap:4px 8px}.calc-row .calc-input{grid-column:1/-1;justify-content:flex-start}
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
  .hero-image{order:4;max-width:100%;margin:0 auto;width:100%;display:flex;flex-direction:column;gap:12px}
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
/* === QR CODES === */
.qr-codes-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.qr-card{display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px;background:rgba(139,92,246,0.05);border:1px solid rgba(139,92,246,0.15);border-radius:12px;transition:all 0.2s;text-decoration:none;color:var(--text)}
.qr-card:hover{border-color:var(--purple);background:rgba(139,92,246,0.1);transform:translateY(-2px)}
.qr-card img{width:80px;height:80px;object-fit:contain;border-radius:8px}
.qr-card span{font-size:0.7rem;font-weight:600;color:var(--text-sec);text-align:center}
@media(max-width:768px){.qr-codes-grid{grid-template-columns:repeat(4,1fr);gap:8px}.qr-card img{width:56px;height:56px}.qr-card span{font-size:0.6rem}.qr-card{padding:8px}}
@media(max-width:480px){.qr-codes-grid{grid-template-columns:repeat(2,1fr)}}
/* === SERVICE QUICK CARDS === */
.svc-cards-section{padding-top:60px}
.svc-quick-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.svc-quick-card{display:flex;flex-direction:column;border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--border);background:var(--bg-card);transition:all 0.3s ease;text-decoration:none;color:var(--text)}
.svc-quick-card:hover{border-color:rgba(139,92,246,0.4);transform:translateY(-6px);box-shadow:0 20px 40px rgba(0,0,0,0.2)}
.svc-quick-img{width:100%;height:200px;overflow:hidden;position:relative}
.svc-quick-img img{width:100%;height:100%;object-fit:cover;transition:transform 0.4s ease}
.svc-quick-card:hover .svc-quick-img img{transform:scale(1.05)}
.svc-quick-body{padding:24px;flex:1;display:flex;flex-direction:column}
.svc-quick-icon{width:44px;height:44px;border-radius:12px;background:rgba(139,92,246,0.1);display:flex;align-items:center;justify-content:center;font-size:1.2rem;color:var(--purple);margin-bottom:12px}
.svc-quick-card h3{font-size:1.1rem;font-weight:700;margin-bottom:10px;line-height:1.3}
.svc-quick-card p{font-size:0.88rem;color:var(--text-sec);line-height:1.7;flex:1;margin-bottom:16px}
.svc-quick-cta{font-size:0.88rem;font-weight:700;color:var(--purple);display:flex;align-items:center;gap:6px}
.svc-quick-card:hover .svc-quick-cta{gap:10px}
@media(max-width:768px){.svc-quick-grid{grid-template-columns:1fr;gap:16px}.svc-quick-img{height:160px}}
@media(max-width:480px){.svc-quick-img{height:140px}.svc-quick-body{padding:16px}}
/* === REVIEWS PROOF === */
.reviews-compare{display:grid;grid-template-columns:1fr auto 1fr;gap:32px;align-items:start;margin-top:32px}
.review-proof-col{display:flex;flex-direction:column;border-radius:var(--r-lg);overflow:hidden;border:2px solid var(--border)}
.review-proof-col.good{border-color:rgba(16,185,129,0.4)}
.review-proof-col.bad{border-color:rgba(239,68,68,0.3)}
.review-proof-label{padding:14px 20px;font-size:1rem;font-weight:800;letter-spacing:0.5px;display:flex;align-items:center;gap:8px}
.review-proof-label.good{background:rgba(16,185,129,0.15);color:#10B981}
.review-proof-label.bad{background:rgba(239,68,68,0.12);color:#ef4444}
.review-proof-img{width:100%}
.review-proof-img img{width:100%;height:auto;display:block}
.review-proof-text{padding:16px 20px;font-size:0.88rem;color:var(--text-sec);line-height:1.7}
.review-proof-vs{display:flex;align-items:center;justify-content:center;padding:0 8px}
.review-proof-vs span{width:52px;height:52px;border-radius:50%;background:rgba(139,92,246,0.1);border:2px solid rgba(139,92,246,0.3);display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:800;color:var(--purple);flex-shrink:0}
@media(max-width:768px){.reviews-compare{grid-template-columns:1fr;gap:20px}.review-proof-vs{display:none}}
/* === FOR WHOM === */
.for-whom-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:32px}
.for-whom-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:28px;transition:all 0.3s ease;display:flex;flex-direction:column;gap:12px}
.for-whom-card:hover{border-color:rgba(139,92,246,0.35);transform:translateY(-4px);box-shadow:0 12px 30px rgba(0,0,0,0.15)}
.for-whom-icon{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(139,92,246,0.05));display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:var(--purple);flex-shrink:0}
.for-whom-card h3{font-size:1rem;font-weight:700;line-height:1.3}
.for-whom-card p{font-size:0.87rem;color:var(--text-sec);line-height:1.7;margin:0}
@media(max-width:900px){.for-whom-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.for-whom-grid{grid-template-columns:1fr;gap:14px}.for-whom-card{padding:20px}}
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
    <li><a href="/blog" data-ru="Блог" data-am="Բlog">Блог</a></li>
    <li class="nav-mobile-cta"><a href="#contact" class="btn btn-primary"><i class="fas fa-phone"></i> <span data-ru="Пեрезвоните мне" data-am="զանգահարեք ինծ" data-no-rewrite="1">Пեрեзвоните мне</span></a></li>
  </ul>
  <div class="nav-right">
    <div class="lang-switch">
      <button class="lang-btn" data-lang="ru" onclick="switchLang('ru')"><span class="lang-flag"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect width="36" height="8" fill="#fff"/><rect y="8" width="36" height="8" fill="#0039A6"/><rect y="16" width="36" height="8" fill="#D52B1E"/></svg></span><span class="lang-text">RU</span></button>
      <button class="lang-btn active" data-lang="am" onclick="switchLang('am')"><span class="lang-flag"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="20" height="14" style="border-radius:2px;vertical-align:middle"><rect width="36" height="8" fill="#D90012"/><rect y="8" width="36" height="8" fill="#0033A0"/><rect y="16" width="36" height="8" fill="#F2A800"/></svg></span><span class="lang-text">AM</span></button>
    </div>
    <a href="javascript:void(0)" onclick="openCallbackModal()" class="nav-cta">
      <i class="fas fa-phone"></i>
      <span data-ru="Перезвоните мне" data-am="Հետ զangahарек">Перезвоните мне</span>
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
    <div class="hero-photo-wrap">
      <img src="/static/img/founder.jpg" alt="Go to Top" loading="eager" fetchpriority="high" decoding="async">
      <div class="hero-badge-img">
        <i class="fas fa-shield-alt"></i>
        <span data-ru="Надежный метод продвижения" data-am="Ապահով առաջխաղացման մեթոդ">Надежный метод продвижения</span>
      </div>
    </div>
    <div class="qr-codes-grid">
      <a href="https://www.instagram.com/goo_to_top/" target="_blank" rel="noopener" class="qr-card">
        <img src="/static/img/qr/qr-instagram.png" alt="Instagram QR">
        <span data-ru="Наш Instagram" data-am="Մեր Instagram">Наш Instagram</span>
      </a>
      <a href="https://t.me/goo_to_top" target="_blank" rel="noopener" class="qr-card">
        <img src="/static/img/qr/qr-telegram.png" alt="Telegram QR">
        <span data-ru="Telegram чат" data-am="Telegram чат">Telegram чат</span>
      </a>
      <a href="https://www.facebook.com/gototop.wb" target="_blank" rel="noopener" class="qr-card">
        <img src="/static/img/qr/qr-facebook.png" alt="Facebook QR">
        <span data-ru="Наш Facebook" data-am="Մեր Facebook">Наш Facebook</span>
      </a>
      <a href="https://wa.me/37455226224" target="_blank" rel="noopener" class="qr-card">
        <img src="/static/img/qr/qr-whatsapp.png" alt="WhatsApp QR">
        <span data-ru="WhatsApp" data-am="WhatsApp">WhatsApp</span>
      </a>
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



<!-- ===== SERVICES CARDS (clickable quick-access) ===== -->
<section class="section svc-cards-section" id="svc-cards" data-section-id="svc-cards">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-th-large"></i> <span data-ru="Наши услуги" data-am="Մեր ծառայությունները">Наши услуги</span></div>
    <h2 class="section-title" data-ru="Что мы делаем для вашего роста" data-am="Ինչ ենք անում ձեր աճի համար">Что мы делаем для вашего роста</h2>
  </div>
  <div class="svc-quick-grid fade-up">
    <a href="#services" class="svc-quick-card">
      <div class="svc-quick-img">
        <img src="/static/img/svc-buyouts.png" alt="Выкупы по ключам" loading="lazy">
      </div>
      <div class="svc-quick-body">
        <div class="svc-quick-icon"><i class="fas fa-shopping-cart"></i></div>
        <h3 data-ru="Выкупы по ключам и рекламе" data-am="Գնումներ ըստ բանալիների">Выкупы по ключам и рекламе</h3>
        <p data-ru="Реальные покупки с живых аккаунтов по нужным ключевым словам — ваш товар поднимается в выдаче WB" data-am="Իրական գнумнер кендани hashivnerits dzer banali barrov">Реальные покупки с живых аккаунтов по нужным ключевым словам — ваш товар поднимается в выдаче WB</p>
        <span class="svc-quick-cta" data-ru="Подробнее →" data-am="Ավելին →">Подробнее →</span>
      </div>
    </a>
    <a href="#client-reviews" class="svc-quick-card">
      <div class="svc-quick-img">
        <img src="/static/img/svc-reviews.png" alt="Отзывы под ключ" loading="lazy">
      </div>
      <div class="svc-quick-body">
        <div class="svc-quick-icon"><i class="fas fa-star"></i></div>
        <h3 data-ru="Отзывы под ключ" data-am="Կарніqner shrjantsik">Отзывы под ключ</h3>
        <p data-ru="Реальные отзывы с фото и видео от живых покупателей — рейтинг карточки растёт, доверие клиентов увеличивается" data-am="Иракан karniknер lusankarneriov — barjracnum e kart varkanishine">Реальные отзывы с фото и видео от живых покупателей — рейтинг карточки растёт, доверие клиентов увеличивается</p>
        <span class="svc-quick-cta" data-ru="Подробнее →" data-am="Ավелин →">Подробнее →</span>
      </div>
    </a>
    <a href="/referral" class="svc-quick-card">
      <div class="svc-quick-img">
        <img src="/static/img/svc-referral.png" alt="Реферальная программа" loading="lazy">
      </div>
      <div class="svc-quick-body">
        <div class="svc-quick-icon"><i class="fas fa-users"></i></div>
        <h3 data-ru="Реферальная программа" data-am="Ռeferayin dzragir">Реферальная программа</h3>
        <p data-ru="Рекомендуйте нас коллегам и зарабатывайте. Партнёрская программа для агентств, менеджеров и владельцев ресурсов" data-am="Khоrgurd tveq mez ev vastaekeq">Рекомендуйте нас коллегам и зарабатывайте. Партнёрская программа для агентств, менеджеров и владельцев ресурсов</p>
        <span class="svc-quick-cta" data-ru="Подробнее →" data-am="Ավелин →">Подробнее →</span>
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
      <img src="/static/img/about-hero2.jpg" alt="Go to Top — О компании">
    </div>
    <div class="about-el-title">
      <div class="section-badge"><i class="fas fa-info-circle"></i> <span data-ru="О компании" data-am="Ընկերության մասին">О компании</span></div>
      <h2 data-ru="Что такое" data-am="Ի՞նչ է Go to Top-ը">Что такое <span class="gr">Go to Top</span>?</h2>
    </div>
    <div class="about-el-texts">
      <p style="color:var(--text-sec);font-size:1rem;line-height:1.8;margin-bottom:20px" data-ru="«Go to Top» — сервис развития Вашего бизнеса на маркетплейсах с помощью комплексного продвижения и услуги выкупов по ключевым словам. Для долгосрочного закрепления товара в TOPе." data-am="«Go to Top» — ձեр բիզնեси ząрgацмаn ծarrayutHyun марketplayssnerum՝ inqnaGnumneri мIjocov ааrajxaGhacМаn меThod Е TOP-uм ЕркаrаZhамКет ДirqаvОrveЛu Hамар:">«Go to Top» — сервис развития Вашего бизнеса на маркетплейсах с помощью комплексного продвижения и услуги выкупов по ключевым словам. Для долгосрочного закрепления товара в TOPе.</p>
      <div style="background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.18);border-radius:14px;padding:20px 22px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
          <i class="fas fa-star" style="color:var(--purple);font-size:1rem"></i>
          <strong style="font-size:0.95rem;color:var(--text)" data-ru="Наши сильные стороны" data-am="Մեր ուժеq կողmerumom">Наши сильные стороны</strong>
        </div>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-check-circle" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Собственный склад и офис в Ереване" data-am="Սефакан пахест ев грасенйак Ереванум">Собственный склад и офис в Ереване</span></li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-check-circle" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="1000+ реальных аккаунтов, 0 блокировок" data-am="1000+ иракан хашивнер, 0 арgelaphakum">1000+ реальных аккаунтов, 0 блокировок</span></li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-check-circle" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Работаем с 2021 года — 847 товаров в ТОП" data-am="Аsхатum енq 2021-иц — 847 апранк ТОП-ум">Работаем с 2021 года — 847 товаров в ТОП</span></li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-check-circle" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Всё вручную, только по ключевым словам" data-am="Амен инч дзеrrqov, мiyayn banalи bararer">Всё вручную, только по ключевым словам</span></li>
        </ul>
      </div>
      <div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);border-radius:14px;padding:20px 22px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
          <i class="fas fa-gift" style="color:#10B981;font-size:1rem"></i>
          <strong style="font-size:0.95rem;color:var(--text)" data-ru="Что получает клиент" data-am="Инч е стануm хахордуtyunна">Что получает клиент</strong>
        </div>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-chart-line" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Рост рейтинга товара на Wildberries" data-am="Апранки варкаniши бардращum WB-uм">Рост рейтинга товара на Wildberries</span></li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-chart-line" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Органический трафик и долгосрочный ТОП" data-am="Органик тrафик ев еркараzhамкет ТОП">Органический трафик и долгосрочный ТОП</span></li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-chart-line" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Реальные отзывы с фото и видео" data-am="Иракан гнахатаканнер люsанкаров ев тесанyuthov">Реальные отзывы с фото и видео</span></li>
          <li style="display:flex;align-items:flex-start;gap:10px;font-size:0.9rem;color:var(--text-sec)"><i class="fas fa-chart-line" style="color:#10B981;margin-top:3px;flex-shrink:0"></i><span data-ru="Индивидуальный подход, без блокировок" data-am="Анжнаhатар могечum, аrgelaphakumneri кар">Индивидуальный подход, без блокировок</span></li>
        </ul>
      </div>
      <div class="about-highlight">
        <p data-ru="Наилучший результат Вы получите, воспользовавшись комплексом наших услуг!" data-am="Лавагуйн ардюнка кstанаq оgтvelов мер tsarrayutyunneri pакете!"><i class="fas fa-bolt" style="margin-right:8px"></i>Наилучший результат Вы получите, воспользовавшись комплексом наших услуг!</p>
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
      <p data-ru="Есть ключевое слово, по которому хотите показываться, но алгоритмы не связывают его с вашей карточкой? Мы знаем решение — делаем целевые выкупы, которые активируют товар в нужном кластере." data-am="Ունե՞ք բանալի բառ, որով ցանկանում եք, որ ձեր ապրանքը ցուցադրվի, բայց ալգորիթմները չեն կապում այն ձեր քարտին։ Մենք գիտենք լուծումը՝ կատարվում ենք նպատակային գնումներ, որոնք ակտիվացնում են ապրանքը ճիշտ կլաստերում։">Есть ключевое слово, по которому хотите показываться, но алгоритмы не связывают его с вашей карточкой? Мы знаем решение — делаем целевые выкупы, которые активируют товар в нужном кластере.</p>
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
    <h2 class="section-title" data-ru="11 000 ₽ на блогера vs 11 000 ₽ на выкупы" data-am="50 000 ֏ բլոգեր vs 50 000 ֏ ինքնագնումներ">11 000 ₽ на блогера vs 11 000 ₽ на выкупы</h2>
  </div>

<div class="why-block fade-up">
    <h3><i class="fas fa-balance-scale-right"></i> <span data-ru="11 000 ₽ на блогера vs 11 000 ₽ на выкупы — что эффективнее?" data-am="50 000 ֏ բլոգեր vs 50 000 ֏ ինքնագնումներ — որն է ավելի արդյունավետ?">11 000 ₽ на блогера vs 11 000 ₽ на выкупы — что эффективнее?</span></h3>
    <div class="compare-box">
      <div class="compare-side bad">
        <h4><i class="fas fa-dice"></i> <span data-ru="Reels у блогера" data-am="Reels բլոգերի մոտ">Reels у блогера</span></h4>
        <div class="price-tag" data-ru="11 000 ₽" data-am="50 000 ֏">11 000 ₽</div>
        <p data-ru="1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это всегда риск без гарантий результата. Нету просмотров на Reels соответственно нету продаж на товары. Блогер не ключ к продажам. Инвестируйте в рекламу с умом!" data-am="Բլոգերի 1 տեսանյութը ռիսկ է։ Անկախ նրանից՝ այն կհավագի դիտումներ, թե ոչ՝ ոչ ոք չգիտի։ Եթե ոչ, գումարը կորած է։ Դա միշտ ռիսկ է՝ առանց երաշխավորված արդյունքի։ Չկան դիտումներ չկան նաև վաճառքներ։ Բլոգերը դա վաճառքի բանալի չէ։ Ներդրեք գումարը գովազդի մեջ մտածված։">1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это <strong>всегда риск</strong> без гарантий результата. Нету просмотров на Reels — соответственно нету продаж на товары. Блогер не ключ к продажам. <strong>Инвестируйте в рекламу с умом!</strong></p>
      </div>
      <div class="compare-side good">
        <h4><i class="fas fa-chart-line"></i> <span data-ru="25 выкупов по ключевым" data-am="25 ինքնագնում բանալի բառով">25 выкупов по ключевым</span></h4>
        <div class="price-tag" data-ru="11 000 ₽" data-am="50 000 ֏">11 000 ₽</div>
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
      <a href="https://wa.me/37455226224" id="calcTgBtn" class="btn btn-primary btn-lg" target="_blank">
        <i class="fab fa-whatsapp"></i>
        <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">Заказать сейчас</span>
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


<!-- ===== FOR WHOM ===== -->
<section class="section" id="for-whom" data-section-id="for-whom">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-users"></i> <span data-ru="Для кого" data-am="Ум hамар">Для кого</span></div>
    <h2 class="section-title" data-ru="Для кого полезен наш сервис" data-am="Ум hамар е огтакар мер царрайутjуне">Для кого полезен <span class="gr">наш сервис</span></h2>
    <p class="section-sub" data-ru="Мы работаем с разными форматами бизнеса — от отдельных менеджеров до крупных агентств" data-am="Менк аботум енк тарбер бизнес форматнери хет">Мы работаем с разными форматами бизнеса — от отдельных менеджеров до крупных агентств</p>
  </div>
  <div class="for-whom-grid fade-up">
    <div class="for-whom-card">
      <div class="for-whom-icon"><i class="fas fa-handshake"></i></div>
      <h3 data-ru="Менеджер по маркетплейсам" data-am="Маркетплейс менеджер">Менеджер по маркетплейсам</h3>
      <p data-ru="Имеете большую базу клиентов-поставщиков на WB и Ozon — станьте нашим партнёром и зарабатывайте на каждом заказе" data-am="Унеck hаchakhordнеri база — дарчеck мер горцунакер">Имеете большую базу клиентов-поставщиков на WB и Ozon — станьте нашим партнёром и зарабатывайте на каждом заказе</p>
    </div>
    <div class="for-whom-card">
      <div class="for-whom-icon"><i class="fas fa-building"></i></div>
      <h3 data-ru="Агентство или компания" data-am="Гоptsаkалутjун кам ынкерутjун">Агентство или компания</h3>
      <p data-ru="Работаете с поставщиками маркетплейсов — добавьте услуги выкупов и отзывов в свой портфель и увеличьте доход" data-am="Абатум еk матаkarerneri хет — аvelацрек царрайутjуннер">Работаете с поставщиками маркетплейсов — добавьте услуги выкупов и отзывов в свой портфель и увеличьте доход</p>
    </div>
    <div class="for-whom-card">
      <div class="for-whom-icon"><i class="fas fa-globe"></i></div>
      <h3 data-ru="Владелец ресурса" data-am="Ресурси тером">Владелец ресурса</h3>
      <p data-ru="Ведёте тематический блог, YouTube-канал или телеграм-канал о маркетплейсах — станьте партнёром и монетизируйте аудиторию" data-am="Унеck тематик ресурс — дарчеck partner">Ведёте тематический блог, YouTube-канал или телеграм-канал о маркетплейсах — станьте партнёром и монетизируйте аудиторию</p>
    </div>
    <div class="for-whom-card">
      <div class="for-whom-icon"><i class="fas fa-graduation-cap"></i></div>
      <h3 data-ru="Онлайн-школа" data-am="Онlayn-dpрoc">Онлайн-школа</h3>
      <p data-ru="Обучаете работе с маркетплейсами — рекомендуйте наш сервис студентам и получайте реферальное вознаграждение" data-am="Дасавандум еk marketplace-нери — хоrhурдеk мез студентнерин">Обучаете работе с маркетплейсами — рекомендуйте наш сервис студентам и получайте реферальное вознаграждение</p>
    </div>
    <div class="for-whom-card">
      <div class="for-whom-icon"><i class="fas fa-rocket"></i></div>
      <h3 data-ru="Интенсив или курс" data-am="Интенсив кам курс">Интенсив или курс</h3>
      <p data-ru="Проводите обучение по маркетплейсам — включите наш сервис как практический инструмент и помогайте ученикам с реальными выкупами" data-am="Анцкацнум еk ументs marketplace-нери — ненгарчек мер царрайутjуне">Проводите обучение по маркетплейсам — включите наш сервис как практический инструмент и помогайте ученикам с реальными выкупами</p>
    </div>
  </div>
  <div style="text-align:center;margin-top:40px" class="fade-up">
    <a href="#contact" class="btn btn-primary">
      <i class="fas fa-comments"></i>
      <span data-ru="Обсудить партнёрство" data-am="Камнаркел gortsunakutyun">Обсудить партнёрство</span>
    </a>
  </div>
</div>
</section>


<!-- ===== REVIEWS PROOF ===== -->
<section class="section section-dark" id="reviews-proof" data-section-id="reviews-proof">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-star"></i> <span data-ru="Социальное доказательство" data-am="Սоциальное доказательство">Социальное доказательство</span></div>
    <h2 class="section-title" data-ru="Вот такие отзывы — продают" data-am="Ахавс айс карнікнерь — вачаром"><span data-ru="Вот такие отзывы — " data-am="Ах aylс karnіknерь — ">Вот такие отзывы — </span><span class="gr" data-ru="продают" data-am="вачаром">продают</span></h2>
    <p class="section-sub" data-ru="Реальные фото, подробные описания, живые эмоции — именно это убеждает следующего покупателя" data-am="Иракан лусанкарнер, манрамасн нкарагрутjуннер — hенц да е hamozum">Реальные фото, подробные описания, живые эмоции — именно это убеждает следующего покупателя</p>
  </div>
  <div class="reviews-compare fade-up">
    <div class="review-proof-col good">
      <div class="review-proof-label good"><i class="fas fa-check-circle"></i> <span data-ru="ПРОДАЁТ" data-am="ВАЧАРОМ Е">ПРОДАЁТ</span></div>
      <div class="review-proof-img">
        <img src="/static/img/review-proof-good.png" alt="Продающий отзыв" loading="lazy">
      </div>
      <div class="review-proof-text">
        <p data-ru="Фото в использовании, честный детальный текст, покупатель видит реальный опыт — доверие растёт" data-am="Lусанкар, азнив манрамасн тексте — вастахутjуне ajcum е">Фото в использовании, честный детальный текст, покупатель видит реальный опыт — доверие растёт</p>
      </div>
    </div>
    <div class="review-proof-vs"><span>VS</span></div>
    <div class="review-proof-col bad">
      <div class="review-proof-label bad"><i class="fas fa-times-circle"></i> <span data-ru="НЕ ПРОДАЁТ" data-am="ЧИ ВАЧАРОМ">НЕ ПРОДАЁТ</span></div>
      <div class="review-proof-img">
        <img src="/static/img/review-proof-good2.png" alt="Непродающий отзыв" loading="lazy">
      </div>
      <div class="review-proof-text">
        <p data-ru="Пустые шаблонные оценки без текста и без фото — покупатель не видит ценности, не доверяет" data-am="Датарк варканіш аранц тексти — гнорде архек чи тесnum">Пустые шаблонные оценки без текста и без фото — покупатель не видит ценности, не доверяет</p>
      </div>
    </div>
  </div>
  <div style="text-align:center;margin-top:40px" class="fade-up">
    <a href="#contact" class="btn btn-primary btn-lg">
      <i class="fas fa-star"></i>
      <span data-ru="Заказать продающие отзывы" data-am="Патвирел карникнер">Заказать продающие отзывы</span>
    </a>
  </div>
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
      <div class="faq-a"><p data-ru="Все цены указаны в российских рублях (₽ RUB). Оплата в рублях." data-am="Բոլոր գները նշված են հայկական դրամով (֏ AMD): Վճարումը դրամով:">Все цены указаны в российских рублях (₽ RUB). Оплата в рублях.</p></div>
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
      <div class="form-group"><label data-ru="Телефон" data-am="Հեռախոս">Телефон</label><input type="tel" id="formPhone" required></div>
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
      <div class="form-group"><label data-ru="Удобное время звонка" data-am="Հ армар зангахарелу заманак"><span data-ru="Удобное время звонка" data-am="Харmar zangahаrelou zamanak">Удобное время звонка</span></label><input type="text" id="formCallTime" placeholder="Например: с 10 до 13 ч." class="form-input" data-placeholder-ru="Например: с 10 до 13 ч." data-placeholder-am="Оринак: 10-ит мincs 13h."></div>
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
<a href="https://wa.me/37455226224" target="_blank" class="tg-float">
  <i class="fab fa-whatsapp"></i>
  <span data-ru="Написать нам" data-am="Գրել հիմա" data-no-rewrite="1">Написать нам</span>
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
    <h3 data-ru="Перезвоните мне" data-am="Հetav zankhаrek inj">Перезвоните мне</h3>
    <p class="popup-sub" data-ru="Оставьте заявку — мы свяжемся в удобное для вас время" data-am="Թողեք հայտ — կزankhараenq ձеzh nakhentрутvadz ժamanak">Оставьте заявку — мы свяжемся в удобное для вас время</p>
    <form id="callbackForm" onsubmit="submitCallbackForm(event)">
      <div class="pf-group">
        <label class="pf-label" data-ru="Ваше имя *" data-am="Ձеz անunа *">Ваше имя *</label>
        <input type="text" id="cb_name" class="pf-input" placeholder="Иван Иванов" required>
      </div>
      <div class="pf-group">
        <label class="pf-label" data-ru="Номер телефона *" data-am="Телефoni hamar *">Номер телефона *</label>
        <input type="tel" id="cb_phone" class="pf-input" placeholder="+7 (___) ___-__-__" required>
      </div>
      <div class="pf-group">
        <label class="pf-label" data-ru="Удобное время для звонка" data-am="Harchнaкаlі zam для zvanku">Удобное время для звонка</label>
        <input type="text" id="cb_time" class="pf-input" placeholder="Например: после 18:00">
      </div>
      <div class="pf-group">
        <label class="pf-label" data-ru="Ваш вопрос (необязательно)" data-am="Ваш хорurdum (ам ober)">Ваш вопрос (необязательно)</label>
        <textarea id="cb_question" class="pf-input" rows="3" placeholder="Кратко опишите, что хотите обсудить..." style="resize:vertical;min-height:72px"></textarea>
      </div>
      <div id="callbackResult" style="display:none;padding:12px;border-radius:8px;margin-bottom:12px;font-size:0.88rem;text-align:center"></div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px">
        <i class="fas fa-paper-plane"></i>
        <span data-ru="Отправить заявку" data-am="Ուղарkел hайт">Отправить заявку</span>
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
          <label class="pf-label" data-ru="Ваш номер телефона" data-am="Ձեր հեռախոսահամարը">Ваш номер телефона</label>
          <input class="pf-input" type="tel" id="popupPhone" required>
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px">
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

<script src="/static/landing.js" defer></script>

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
        const mobCtaUrl = floatBtn?.url || 'https://wa.me/37455226224';
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

  // === Inline site-data (started in parallel at the beginning) ===
  // 3s timeout: if /api/site-data is slow, render without inlined data
  // (calculator falls back to a client-side fetch instead of hanging the page).
  // Escape `</` in the JSON to prevent any chance of breaking out of the
  // <script> block (defense-in-depth — JSON.stringify already escapes most things).
  const siteDataJson = await Promise.race<string | null>([
    siteDataPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
  ]);
  if (siteDataJson) {
    const safeSiteData = siteDataJson.replace(/<\//g, '<\\/');
    pageHtml = pageHtml.replace('</head>', '<script>window.__SITE_DATA=' + safeSiteData + '</script>\n</head>');
  }

  return c.html(pageHtml);
})

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
    c.header('Cache-Control', 'public, max-age=30, s-maxage=600, stale-while-revalidate=600');

    // Language detection mirrors `/`: URL path, ?lang= query, then default RU.
    const reqUrl = new URL(c.req.url);
    const reqPath = reqUrl.pathname;
    const pathLang = reqPath === '/am' ? 'am' : (reqPath === '/ru' ? 'ru' : '');
    const urlLang = pathLang || reqUrl.searchParams.get('lang') || '';
    const acceptLang = (c.req.header('Accept-Language') || '').toLowerCase();
    void acceptLang; // reserved for future use, mirrors `/` route
    const lang: 'ru' | 'am' = (urlLang === 'am' || urlLang === 'hy') ? 'am' : 'ru';
    const siteOrigin = reqUrl.origin;

    // /about now has real content (phase 2A); the rest stay on the
    // placeholder shell until their respective phase-2 subtasks land.
    if (page === 'about') {
      return c.html(renderAboutPage({ lang, siteOrigin }));
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
      let pageHtml = renderServicesPage({ lang, siteOrigin });
      // 3s timeout + `</` escape — same defensive pattern as the `/` route.
      const siteDataJson = await Promise.race<string | null>([
        siteDataPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
      ]);
      if (siteDataJson) {
        const safeSiteData = siteDataJson.replace(/<\//g, '<\\/');
        pageHtml = pageHtml.replace(
          '</head>',
          '<script>window.__SITE_DATA=' + safeSiteData + '</script>\n</head>'
        );
      }
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
      let pageHtml = renderBuyoutsPage({ lang, siteOrigin });
      // 3s timeout + `</` escape — same defensive pattern as the `/` route.
      const siteDataJson = await Promise.race<string | null>([
        siteDataPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
      ]);
      if (siteDataJson) {
        const safeSiteData = siteDataJson.replace(/<\//g, '<\\/');
        pageHtml = pageHtml.replace(
          '</head>',
          '<script>window.__SITE_DATA=' + safeSiteData + '</script>\n</head>'
        );
      }
      return c.html(pageHtml);
    }
    // /faq (phase 2D): light page — compact hero, 12-item bilingual
    // accordion (toggleFaq() lives in landing.js) and a small CTA strip.
    // No __SITE_DATA injection: the calculator is not used here, so we
    // skip the extra D1 round-trip and keep the page maximally cacheable.
    // SEO is amplified with a JSON-LD FAQPage block emitted via extraHead.
    if (page === 'faq') {
      return c.html(renderFaqPage({ lang, siteOrigin }));
    }
    // /contacts (phase 2E): heavy page with channels grid (Telegram x2 +
    // WhatsApp), QR codes, lead form (#leadForm → submitForm() in
    // landing.js → POST /api/lead), address/hours and a final callback
    // CTA strip. No __SITE_DATA injection: the calculator isn't used
    // here, so we skip the extra D1 round-trip and stay edge-cacheable.
    if (page === 'contacts') {
      return c.html(renderContactsPage({ lang, siteOrigin }));
    }
    // /referral (phase 2F): light partner-program page — hero, 3 steps,
    // audience cards (mirrors home #for-whom), bonus tiers (5/8/15%),
    // referral-specific FAQ accordion (re-uses .faq-item via local CSS
    // copy so toggleFaq() in landing.js works) and a CTA strip. No
    // __SITE_DATA injection: the calculator and #refCodeInput are not
    // used here, so the page stays maximally edge-cacheable.
    if (page === 'referral') {
      return c.html(renderReferralPage({ lang, siteOrigin }));
    }
    return c.html(renderPlaceholderPage({ page, lang, siteOrigin }));
  });
}

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
