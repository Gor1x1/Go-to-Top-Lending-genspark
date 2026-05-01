/**
 * Blog routes — SSR pages for /blog and /blog/:slug
 * Bilingual (RU/AM). Uses same design system as landing.ts.
 */
import { Hono } from 'hono'
import { initDatabase } from '../lib/db'

type Bindings = { DB: D1Database; MEDIA: R2Bucket }

// Shared CSS variables and base styles (same as landing)
const BASE_CSS = `
:root{--purple:#8B5CF6;--purple-deep:#7C3AED;--accent:#a78bfa;--accent-light:#c4b5fd;--success:#10B981;--bg:#0f0a1a;--bg-surface:#15111f;--bg-card:#1a1530;--text:#f1f0f5;--text-sec:#a09cb8;--text-muted:#6b6884;--border:rgba(139,92,246,0.12);--r:12px;--r-sm:8px;--r-lg:20px;--glow:0 8px 30px rgba(139,92,246,0.2);--t:all 0.3s ease}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;line-height:1.6;overflow-x:hidden}
a{text-decoration:none;color:inherit}
img{max-width:100%;height:auto}
.container{max-width:1200px;margin:0 auto;padding:0 24px;width:100%;box-sizing:border-box}
.header{position:fixed;top:0;left:0;right:0;z-index:1000;padding:12px 0;background:rgba(15,10,26,0.92);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);width:100%}
.nav{display:flex;align-items:center;justify-content:space-between;gap:12px}
.logo{display:flex;align-items:center;gap:10px;font-size:1.2rem;font-weight:800;background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo img{height:38px;width:auto;border-radius:6px}
.nav-links{display:flex;align-items:center;gap:4px;list-style:none;flex:1;justify-content:center;flex-wrap:nowrap}
.nav-links a{font-size:0.82rem;font-weight:500;color:var(--text-sec);padding:6px 10px;border-radius:6px;transition:var(--t);white-space:nowrap}
.nav-links a:hover,.nav-links a.active{color:var(--text);background:rgba(139,92,246,0.1)}
.nav-cta{padding:8px 18px;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white!important;border-radius:var(--r-sm);font-weight:600;font-size:0.85rem;transition:var(--t);display:flex;align-items:center;gap:6px;white-space:nowrap}
.nav-cta:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(139,92,246,0.4)}
.lang-switch{display:flex;background:var(--bg-card);border-radius:8px;overflow:hidden;border:1px solid var(--border)}
.lang-btn{padding:5px 10px;font-size:0.7rem;font-weight:600;cursor:pointer;background:transparent;border:none;color:var(--text-muted);display:flex;align-items:center;gap:4px;transition:var(--t)}
.lang-btn.active{background:var(--purple);color:white}
.nav-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
@media(max-width:900px){.nav-links{display:none}}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:var(--r-sm);font-weight:600;font-size:0.92rem;transition:var(--t);cursor:pointer;border:none}
.btn-primary{background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white;box-shadow:0 4px 15px rgba(139,92,246,0.3)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(139,92,246,0.5)}
.btn-outline{background:transparent;color:var(--text);border:1px solid var(--border)}
.btn-outline:hover{border-color:var(--purple)}
.section-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px}
.section-title{font-size:2rem;font-weight:800;line-height:1.2;margin-bottom:16px;letter-spacing:-0.02em}
.section-title .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.section-sub{font-size:1rem;color:var(--text-sec);max-width:640px;margin:0 auto;line-height:1.7}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:600}
.badge-purple{background:rgba(139,92,246,0.15);color:var(--accent)}
.badge-green{background:rgba(16,185,129,0.15);color:#34d399}
/* Blog-specific */
.blog-hero{padding:120px 0 60px;background:linear-gradient(180deg,rgba(139,92,246,0.06) 0%,transparent 100%)}
.blog-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:32px}
.blog-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;transition:all 0.3s ease;display:flex;flex-direction:column}
.blog-card:hover{border-color:rgba(139,92,246,0.35);transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,0.2)}
.blog-card-img{width:100%;height:180px;overflow:hidden}
.blog-card-img img{width:100%;height:100%;object-fit:cover;transition:transform 0.4s ease;display:block}
.blog-card:hover .blog-card-img img{transform:scale(1.05)}
.blog-card-body{padding:20px;flex:1;display:flex;flex-direction:column;gap:10px}
.blog-card-cat{font-size:0.72rem;font-weight:700;color:var(--purple);text-transform:uppercase;letter-spacing:0.5px}
.blog-card-title{font-size:1.05rem;font-weight:700;line-height:1.4;color:var(--text)}
.blog-card-preview{font-size:0.85rem;color:var(--text-sec);line-height:1.7;flex:1}
.blog-card-date{font-size:0.75rem;color:var(--text-muted)}
.blog-card-read{font-size:0.85rem;font-weight:600;color:var(--purple);margin-top:auto}
.blog-cats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px}
.blog-cat-btn{padding:8px 18px;border-radius:50px;font-size:0.82rem;font-weight:600;cursor:pointer;border:1px solid var(--border);background:var(--bg-card);color:var(--text-sec);transition:var(--t);text-decoration:none}
.blog-cat-btn:hover,.blog-cat-btn.active{background:var(--purple);color:white;border-color:var(--purple)}
.blog-empty{text-align:center;padding:60px 20px;color:var(--text-muted)}
.blog-empty i{font-size:3rem;margin-bottom:16px;display:block;color:var(--border)}
/* Article page */
.article-hero{padding:120px 0 40px}
.article-header{max-width:800px;margin:0 auto}
.article-cover{width:100%;max-height:480px;object-fit:cover;border-radius:var(--r-lg);margin-bottom:40px;border:1px solid var(--border)}
.article-body{max-width:800px;margin:0 auto;font-size:1rem;line-height:1.85;color:var(--text-sec)}
.article-body h2{font-size:1.5rem;font-weight:700;color:var(--text);margin:32px 0 16px}
.article-body h3{font-size:1.2rem;font-weight:700;color:var(--text);margin:24px 0 12px}
.article-body p{margin-bottom:16px}
.article-body ul,.article-body ol{padding-left:24px;margin-bottom:16px}
.article-body li{margin-bottom:8px}
.article-body blockquote{border-left:4px solid var(--purple);padding:16px 20px;background:rgba(139,92,246,0.05);border-radius:0 8px 8px 0;margin:24px 0;font-style:italic}
.article-body img{border-radius:var(--r);margin:16px 0;border:1px solid var(--border)}
.article-body a{color:var(--purple);text-decoration:underline}
.related-posts{margin-top:60px;padding-top:40px;border-top:1px solid var(--border)}
.related-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:24px}
.footer{background:var(--bg-surface);border-top:1px solid var(--border);padding:40px 0 24px;margin-top:60px}
.footer-inner{display:grid;grid-template-columns:1fr auto;gap:40px;align-items:center}
.footer-brand{font-size:1.1rem;font-weight:800;background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.footer-copy{font-size:0.8rem;color:var(--text-muted);margin-top:8px}
.footer-links{display:flex;gap:20px;flex-wrap:wrap}
.footer-links a{font-size:0.85rem;color:var(--text-sec);transition:var(--t)}
.footer-links a:hover{color:var(--purple)}
@media(max-width:768px){.blog-grid{grid-template-columns:1fr}.related-grid{grid-template-columns:1fr;gap:14px}.footer-inner{grid-template-columns:1fr}}
@media(max-width:480px){.blog-hero,.article-hero{padding:100px 0 30px}.section-title{font-size:1.5rem}}
`;

function sharedHead(title: string, desc: string, origin: string, slug?: string): string {
  const canonical = slug ? `${origin}/blog/${slug}` : `${origin}/blog`;
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="${slug ? 'article' : 'website'}">
<meta name="robots" content="index, follow">
<link rel="icon" type="image/x-icon" href="/static/img/favicon.ico">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css">
<style>${BASE_CSS}</style>
<script>var lang = localStorage.getItem('gtt_lang') || 'ru'; document.documentElement.lang = lang === 'am' ? 'hy' : 'ru';</script>
</head>
<body>`;
}

function sharedNav(isArmenian: boolean): string {
  return `<header class="header">
<div class="container">
<nav class="nav">
  <a href="/" class="logo">
    <img src="/static/img/logo-gototop.png" alt="Go to Top">
    <span>Go to Top</span>
  </a>
  <ul class="nav-links">
    <li><a href="/#about" data-ru="О нас" data-am="Մեր մасин">${isArmenian ? 'Մեր մасин' : 'О нас'}</a></li>
    <li><a href="/#services" data-ru="Услуги" data-am="Ծарayutyan">${isArmenian ? 'Ծарayutyan' : 'Услуги'}</a></li>
    <li><a href="/#calculator" data-ru="Калькулятор" data-am="Հашviч">${isArmenian ? 'Հашviч' : 'Калькулятор'}</a></li>
    <li><a href="/blog" class="active" data-ru="Блог" data-am="Բлок">Блог</a></li>
    <li><a href="/#contact" data-ru="Контакты" data-am="Контaktner">${isArmenian ? 'Контaktner' : 'Контакты'}</a></li>
  </ul>
  <div class="nav-right">
    <div class="lang-switch">
      <button class="lang-btn ${!isArmenian ? 'active' : ''}" onclick="switchLang('ru')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="18" height="12" style="border-radius:2px"><rect width="36" height="8" fill="#fff"/><rect y="8" width="36" height="8" fill="#0039A6"/><rect y="16" width="36" height="8" fill="#D52B1E"/></svg>
        RU
      </button>
      <button class="lang-btn ${isArmenian ? 'active' : ''}" onclick="switchLang('am')">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24" width="18" height="12" style="border-radius:2px"><rect width="36" height="8" fill="#D90012"/><rect y="8" width="36" height="8" fill="#0033A0"/><rect y="16" width="36" height="8" fill="#F2A800"/></svg>
        AM
      </button>
    </div>
    <a href="/#contact" class="nav-cta">
      <i class="fas fa-phone"></i>
      <span data-ru="Перезвоните мне" data-am="Позвaните мне">${isArmenian ? 'Կanxareq ints' : 'Перезвоните мне'}</span>
    </a>
  </div>
</nav>
</div>
</header>`;
}

function sharedFooter(): string {
  return `<footer class="footer">
<div class="container">
  <div class="footer-inner">
    <div>
      <div class="footer-brand">Go to Top</div>
      <div class="footer-copy">© ${new Date().getFullYear()} Go to Top. Все права защищены.</div>
      <div class="footer-copy" style="margin-top:4px">Продвижение на Wildberries и Ozon — выкупы, отзывы, реферальная программа</div>
    </div>
    <div class="footer-links">
      <a href="/">Главная</a>
      <a href="/#services">Услуги</a>
      <a href="/#calculator">Калькулятор</a>
      <a href="/blog">Блог</a>
      <a href="/#contact">Контакты</a>
      <a href="https://t.me/goo_to_top" target="_blank">Telegram</a>
    </div>
  </div>
</div>
</footer>
<script>
function switchLang(l) {
  localStorage.setItem('gtt_lang', l);
  document.documentElement.lang = l === 'am' ? 'hy' : 'ru';
  document.querySelectorAll('[data-' + l + ']').forEach(function(el) {
    el.textContent = el.getAttribute('data-' + l);
  });
  var btns = document.querySelectorAll('.lang-btn');
  btns.forEach(function(b) { b.classList.remove('active'); });
  var active = document.querySelector('.lang-btn[onclick*="' + l + '"]');
  if (active) active.classList.add('active');
  history.replaceState(null, '', l === 'am' ? '/am' : '/ru');
}
// On load, apply saved language
(function() {
  var l = localStorage.getItem('gtt_lang') || 'ru';
  if (l !== 'ru') switchLang(l);
})();
</script>`;
}

function escHtml(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

function renderPostCard(post: any, isArmenian: boolean): string {
  const title = isArmenian && post.title_am ? post.title_am : post.title_ru;
  const bodyText = isArmenian && post.body_am ? post.body_am : post.body_ru;
  const preview = (bodyText || '').replace(/<[^>]+>/g, '').substring(0, 120);
  const catName = isArmenian && post.category_name_am ? post.category_name_am : (post.category_name_ru || '');

  return `<a href="/blog/${escHtml(post.slug)}" class="blog-card" style="text-decoration:none">
  ${post.cover_url ? `<div class="blog-card-img"><img src="${escHtml(post.cover_url)}" alt="${escHtml(title)}" loading="lazy"></div>` : ''}
  <div class="blog-card-body">
    ${catName ? `<div class="blog-card-cat">${escHtml(catName)}</div>` : ''}
    <div class="blog-card-title">${escHtml(title)}</div>
    ${preview ? `<div class="blog-card-preview">${escHtml(preview)}${bodyText && bodyText.length > 120 ? '...' : ''}</div>` : ''}
    <div class="blog-card-date">${formatDate(post.created_at || '')}</div>
    <div class="blog-card-read">${isArmenian ? 'Կardat →' : 'Читать →'}</div>
  </div>
</a>`;
}

export function register(app: Hono<{ Bindings: Bindings }>) {
  // ===== BLOG INDEX =====
  app.get('/blog', async (c) => {
    c.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');

    const reqUrl = new URL(c.req.url);
    const origin = reqUrl.origin;
    const urlLang = reqUrl.searchParams.get('lang') || '';
    const isArmenian = urlLang === 'am' || urlLang === 'hy';
    const catFilter = reqUrl.searchParams.get('cat') || '';

    let posts: any[] = [];
    let categories: any[] = [];

    try {
      const db = c.env.DB;
      await initDatabase(db);

      const [postsRes, catsRes] = await Promise.all([
        db.prepare(`SELECT bp.*, bc.name_ru as category_name_ru, bc.name_am as category_name_am, bc.slug as category_slug
          FROM blog_posts bp
          LEFT JOIN blog_categories bc ON bp.category_id = bc.id
          WHERE bp.published = 1
          ORDER BY bp.sort_order, bp.created_at DESC`).all(),
        db.prepare('SELECT * FROM blog_categories ORDER BY sort_order, id').all()
      ]);

      posts = (postsRes.results || []) as any[];
      categories = (catsRes.results || []) as any[];

      if (catFilter) {
        posts = posts.filter((p: any) => p.category_slug === catFilter);
      }
    } catch { /* DB may not be ready */ }

    const title = isArmenian ? 'Բлог — Go to Top' : 'Блог — Go to Top | Продвижение на WB и Ozon';
    const desc = isArmenian
      ? 'Статьи об продвижении на маркетплейсах'
      : 'Полезные статьи о продвижении товаров на Wildberries и Ozon. Советы по выкупам, отзывам и росту продаж.';

    const html = sharedHead(title, desc, origin) +
      sharedNav(isArmenian) +
      `<main style="padding-top:72px">
<div class="blog-hero">
  <div class="container">
    <div style="text-align:center;margin-bottom:32px">
      <div class="section-badge"><i class="fas fa-book-open"></i> <span>${isArmenian ? 'Bok' : 'Блог'}</span></div>
      <h1 class="section-title">${isArmenian ? 'Ogt<span class="gr">ak statyas</span>' : 'Полезные <span class="gr">статьи</span>'}</h1>
      <p class="section-sub">${isArmenian ? 'Статьи о продвижении' : 'Всё о продвижении товаров на Wildberries и Ozon — от выкупов до SEO карточки'}</p>
    </div>
    ${categories.length > 0 ? `
    <div class="blog-cats">
      <a href="/blog" class="blog-cat-btn ${!catFilter ? 'active' : ''}">${isArmenian ? 'Bolor' : 'Все'}</a>
      ${categories.map((cat: any) => {
        const name = isArmenian && cat.name_am ? cat.name_am : cat.name_ru;
        return `<a href="/blog?cat=${escHtml(cat.slug)}" class="blog-cat-btn ${catFilter === cat.slug ? 'active' : ''}">${escHtml(name)}</a>`;
      }).join('')}
    </div>` : ''}
    ${posts.length > 0
      ? `<div class="blog-grid">${posts.map((p: any) => renderPostCard(p, isArmenian)).join('')}</div>`
      : `<div class="blog-empty"><i class="fas fa-book-open"></i><h3>${isArmenian ? 'Statyas cken' : 'Статьи скоро появятся'}</h3><p>${isArmenian ? 'Arij ckarday' : 'Заходите позже — мы пишем для вас'}</p></div>`
    }
  </div>
</div>
</main>` +
      sharedFooter() +
      `</body></html>`;

    return c.html(html);
  });

  // ===== BLOG POST =====
  app.get('/blog/:slug', async (c) => {
    c.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');

    const reqUrl = new URL(c.req.url);
    const origin = reqUrl.origin;
    const urlLang = reqUrl.searchParams.get('lang') || '';
    const isArmenian = urlLang === 'am' || urlLang === 'hy';
    const slug = c.req.param('slug');

    let post: any = null;
    let relatedPosts: any[] = [];

    try {
      const db = c.env.DB;
      await initDatabase(db);

      const [postRes, relatedRes] = await Promise.all([
        db.prepare(`SELECT bp.*, bc.name_ru as category_name_ru, bc.name_am as category_name_am, bc.slug as category_slug
          FROM blog_posts bp
          LEFT JOIN blog_categories bc ON bp.category_id = bc.id
          WHERE bp.slug = ? AND bp.published = 1`).bind(slug).first(),
        db.prepare(`SELECT bp.id, bp.slug, bp.title_ru, bp.title_am, bp.cover_url, bp.created_at,
          bc.name_ru as category_name_ru, bc.name_am as category_name_am
          FROM blog_posts bp
          LEFT JOIN blog_categories bc ON bp.category_id = bc.id
          WHERE bp.published = 1 AND bp.slug != ?
          ORDER BY bp.sort_order, bp.created_at DESC LIMIT 3`).bind(slug).all()
      ]);

      post = postRes;
      relatedPosts = (relatedRes.results || []) as any[];
    } catch { /* DB not ready */ }

    if (!post) {
      return c.html(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404 — Статья не найдена</title>
        <style>body{font-family:system-ui;background:#0f0a1a;color:#f1f0f5;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}</style></head>
        <body><div><h1 style="font-size:4rem;color:#8B5CF6">404</h1><p>Статья не найдена</p><a href="/blog" style="color:#8B5CF6">← Вернуться в блог</a></div></body></html>`, 404);
    }

    const title = isArmenian && post.title_am ? post.title_am : post.title_ru;
    const body = isArmenian && post.body_am ? post.body_am : post.body_ru;
    const catName = isArmenian && post.category_name_am ? post.category_name_am : (post.category_name_ru || '');

    const ogDesc = (body || '').replace(/<[^>]+>/g, '').substring(0, 160);
    const pageTitle = `${title} — Go to Top`;

    const html = sharedHead(pageTitle, ogDesc, origin, slug) +
      (post.cover_url ? `<meta property="og:image" content="${escHtml(post.cover_url)}">` : '') +
      sharedNav(isArmenian) +
      `<main style="padding-top:72px">
<div class="article-hero">
  <div class="container">
    <div class="article-header">
      <a href="/blog" style="display:inline-flex;align-items:center;gap:8px;color:var(--text-muted);font-size:0.88rem;margin-bottom:24px;transition:color 0.2s" onmouseover="this.style.color='var(--purple)'" onmouseout="this.style.color='var(--text-muted)'">
        <i class="fas fa-arrow-left"></i> ${isArmenian ? 'Verat blog' : 'Назад в блог'}
      </a>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        ${catName ? `<span class="badge badge-purple">${escHtml(catName)}</span>` : ''}
        <span style="font-size:0.8rem;color:var(--text-muted)">${formatDate(post.created_at || '')}</span>
      </div>
      <h1 style="font-size:clamp(1.6rem,4vw,2.4rem);font-weight:800;line-height:1.2;margin-bottom:20px">${escHtml(title)}</h1>
    </div>
    ${post.cover_url ? `<img src="${escHtml(post.cover_url)}" alt="${escHtml(title)}" class="article-cover" loading="eager">` : ''}
    <div class="article-body">
      ${body || `<p style="color:var(--text-muted)">${isArmenian ? 'Bnoagir cka' : 'Текст статьи скоро появится'}</p>`}
    </div>
    ${relatedPosts.length > 0 ? `
    <div class="related-posts">
      <h3 style="font-size:1.2rem;font-weight:700;margin-bottom:4px">${isArmenian ? 'Aylk statyas' : 'Другие статьи'}</h3>
      <div class="related-grid">
        ${relatedPosts.map((p: any) => renderPostCard(p, isArmenian)).join('')}
      </div>
    </div>` : ''}
    <div style="text-align:center;margin-top:48px">
      <a href="/#contact" class="btn btn-primary">
        <i class="fas fa-phone"></i>
        ${isArmenian ? 'Կanxareq ints' : 'Перезвоните мне'}
      </a>
    </div>
  </div>
</div>
</main>` +
      sharedFooter() +
      `</body></html>`;

    return c.html(html);
  });
}
