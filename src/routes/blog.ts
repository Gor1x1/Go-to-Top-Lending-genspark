/**
 * Blog routes — SSR pages for /blog and /blog/:slug
 * Bilingual (RU/AM). Uses the unified `renderPageShell` from landing.ts so
 * the navigation, footer, language switcher, callback popup and bottom-nav
 * are 100% consistent with all other subpages (no more transliterated
 * Armenian fragments in the header).
 */
import { Hono } from 'hono'
import { initDatabase } from '../lib/db'
import { renderPageShell } from './landing'

type Bindings = { DB: D1Database; MEDIA: R2Bucket }

// Blog-specific styles only. Header/nav/footer styles come from renderPageShell.
const BLOG_CSS = `
<style>
.blog-hero{padding:140px 0 40px;background:linear-gradient(180deg,rgba(139,92,246,0.06) 0%,transparent 100%)}
.blog-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:28px;margin-top:32px}
.blog-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;transition:all 0.3s ease;display:flex;flex-direction:column;text-decoration:none;color:var(--text)}
.blog-card:hover{border-color:rgba(139,92,246,0.35);transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,0.2)}
.blog-card-img{width:100%;height:180px;overflow:hidden;background:var(--bg-surface)}
.blog-card-img img{width:100%;height:100%;object-fit:cover;transition:transform 0.4s ease;display:block}
.blog-card:hover .blog-card-img img{transform:scale(1.05)}
.blog-card-body{padding:20px;flex:1;display:flex;flex-direction:column;gap:10px}
.blog-card-cat{font-size:0.72rem;font-weight:700;color:var(--purple);text-transform:uppercase;letter-spacing:0.5px}
.blog-card-title{font-size:1.05rem;font-weight:700;line-height:1.4;color:var(--text)}
.blog-card-preview{font-size:0.85rem;color:var(--text-sec);line-height:1.7;flex:1}
.blog-card-date{font-size:0.75rem;color:var(--text-muted)}
.blog-card-read{font-size:0.85rem;font-weight:600;color:var(--purple);margin-top:auto}
.blog-cats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px;justify-content:center}
.blog-cat-btn{padding:8px 18px;border-radius:50px;font-size:0.82rem;font-weight:600;cursor:pointer;border:1px solid var(--border);background:var(--bg-card);color:var(--text-sec);transition:var(--t);text-decoration:none}
.blog-cat-btn:hover,.blog-cat-btn.active{background:var(--purple);color:white;border-color:var(--purple)}
.blog-empty{text-align:center;padding:60px 20px;color:var(--text-muted)}
.blog-empty i{font-size:3rem;margin-bottom:16px;display:block;color:var(--border)}
.blog-empty h3{font-size:1.2rem;font-weight:700;color:var(--text);margin-bottom:8px}
.blog-section-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent-light);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px}
.blog-h1{font-size:clamp(1.8rem,3.4vw,2.4rem);font-weight:800;line-height:1.2;margin-bottom:16px;letter-spacing:-0.02em}
.blog-h1 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.blog-sub{font-size:1rem;color:var(--text-sec);max-width:640px;margin:0 auto 32px;line-height:1.7}
/* Article page */
.article-hero{padding:140px 0 40px}
.article-header{max-width:800px;margin:0 auto}
.article-back{display:inline-flex;align-items:center;gap:8px;color:var(--text-muted);font-size:0.88rem;margin-bottom:24px;transition:color 0.2s;text-decoration:none}
.article-back:hover{color:var(--purple)}
.article-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px}
.article-meta-cat{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:0.72rem;font-weight:600;background:rgba(139,92,246,0.15);color:var(--accent-light)}
.article-meta-date{font-size:0.8rem;color:var(--text-muted)}
.article-title{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:800;line-height:1.2;margin-bottom:20px}
.article-cover{width:100%;max-height:480px;object-fit:cover;border-radius:var(--r-lg);margin:0 auto 40px;border:1px solid var(--border);display:block;max-width:1024px}
.article-body{max-width:800px;margin:0 auto;font-size:1rem;line-height:1.85;color:var(--text-sec)}
.article-body h2{font-size:1.5rem;font-weight:700;color:var(--text);margin:32px 0 16px}
.article-body h3{font-size:1.2rem;font-weight:700;color:var(--text);margin:24px 0 12px}
.article-body p{margin-bottom:16px}
.article-body ul,.article-body ol{padding-left:24px;margin-bottom:16px}
.article-body li{margin-bottom:8px}
.article-body blockquote{border-left:4px solid var(--purple);padding:16px 20px;background:rgba(139,92,246,0.05);border-radius:0 8px 8px 0;margin:24px 0;font-style:italic}
.article-body img{border-radius:var(--r);margin:16px 0;border:1px solid var(--border);max-width:100%}
.article-body a{color:var(--purple);text-decoration:underline}
.related-posts{margin-top:60px;padding-top:40px;border-top:1px solid var(--border);max-width:1024px;margin-left:auto;margin-right:auto}
.related-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:24px}
.article-cta{text-align:center;margin:48px auto 0;max-width:800px}
@media(max-width:480px){.blog-hero,.article-hero{padding:120px 0 30px}}
</style>`;

function escHtml(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDate(dateStr: string, isAM: boolean): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(isAM ? 'hy-AM' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}

function renderPostCard(post: any, isAM: boolean): string {
  const title = isAM && post.title_am ? post.title_am : post.title_ru;
  const bodyText = isAM && post.body_am ? post.body_am : post.body_ru;
  const preview = (bodyText || '').replace(/<[^>]+>/g, '').substring(0, 120);
  const catName = isAM && post.category_name_am ? post.category_name_am : (post.category_name_ru || '');
  const readLabel = isAM ? 'Կարդալ →' : 'Читать →';

  return `<a href="/blog/${escHtml(post.slug)}${isAM ? '?lang=am' : ''}" class="blog-card">
  ${post.cover_url ? `<div class="blog-card-img"><img src="${escHtml(post.cover_url)}" alt="${escHtml(title)}" loading="lazy"></div>` : ''}
  <div class="blog-card-body">
    ${catName ? `<div class="blog-card-cat">${escHtml(catName)}</div>` : ''}
    <div class="blog-card-title">${escHtml(title)}</div>
    ${preview ? `<div class="blog-card-preview">${escHtml(preview)}${bodyText && bodyText.length > 120 ? '...' : ''}</div>` : ''}
    <div class="blog-card-date">${formatDate(post.created_at || '', isAM)}</div>
    <div class="blog-card-read">${readLabel}</div>
  </div>
</a>`;
}

export function register(app: Hono<{ Bindings: Bindings }>) {
  // ===== BLOG INDEX =====
  app.get('/blog', async (c) => {
    c.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');

    const reqUrl = new URL(c.req.url);
    const siteOrigin = reqUrl.origin;
    const urlLang = reqUrl.searchParams.get('lang') || '';
    const isAM = urlLang === 'am' || urlLang === 'hy';
    const lang: 'ru' | 'am' = isAM ? 'am' : 'ru';
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

    const seo = {
      title: isAM ? 'Բլոգ — Go to Top' : 'Блог — Go to Top | Продвижение на WB и Ozon',
      description: isAM
        ? 'Օգտակար հոդվածներ Wildberries-ում և Ozon-ում ապրանքների առաջխաղացման մասին։'
        : 'Полезные статьи о продвижении товаров на Wildberries и Ozon. Советы по выкупам, отзывам и росту продаж.',
    };

    const heroTitleRu = `Полезные <span class="gr">статьи</span>`;
    const heroTitleAm = `Օգտակար <span class="gr">հոդվածներ</span>`;
    const heroSubRu = 'Всё о продвижении товаров на Wildberries и Ozon — от выкупов до SEO карточки';
    const heroSubAm = 'Ամեն ինչ Wildberries-ում և Ozon-ում ապրանքների առաջխաղացման մասին — գնումներից մինչև քարտի SEO';
    const allCatRu = 'Все';
    const allCatAm = 'Բոլորը';
    const emptyTitle = isAM ? 'Հոդվածները շուտով կհայտնվեն' : 'Статьи скоро появятся';
    const emptySub = isAM ? 'Այցելեք ավելի ուշ — մենք գրում ենք ձեզ համար' : 'Заходите позже — мы пишем для вас';

    const mainHtml = `
<section class="blog-hero">
  <div class="container">
    <div style="text-align:center">
      <div class="blog-section-badge"><i class="fas fa-book-open"></i> <span data-ru="Блог" data-am="Բլոգ">${isAM ? 'Բլոգ' : 'Блог'}</span></div>
      <h1 class="blog-h1" data-ru="${heroTitleRu.replace(/"/g,'&quot;')}" data-am="${heroTitleAm.replace(/"/g,'&quot;')}">${isAM ? heroTitleAm : heroTitleRu}</h1>
      <p class="blog-sub" data-ru="${heroSubRu.replace(/"/g,'&quot;')}" data-am="${heroSubAm.replace(/"/g,'&quot;')}">${isAM ? heroSubAm : heroSubRu}</p>
    </div>
    ${categories.length > 0 ? `
    <div class="blog-cats">
      <a href="/blog${isAM ? '?lang=am' : ''}" class="blog-cat-btn ${!catFilter ? 'active' : ''}" data-ru="${allCatRu}" data-am="${allCatAm}">${isAM ? allCatAm : allCatRu}</a>
      ${categories.map((cat: any) => {
        const nameRu = cat.name_ru || '';
        const nameAm = cat.name_am || cat.name_ru || '';
        const langSuffix = isAM ? `${reqUrl.search.includes('cat=') ? '&' : '?'}lang=am` : '';
        const href = `/blog?cat=${escHtml(cat.slug)}${isAM ? '&lang=am' : ''}`;
        return `<a href="${href}" class="blog-cat-btn ${catFilter === cat.slug ? 'active' : ''}" data-ru="${escHtml(nameRu)}" data-am="${escHtml(nameAm)}">${escHtml(isAM ? nameAm : nameRu)}</a>`;
      }).join('')}
    </div>` : ''}
    ${posts.length > 0
      ? `<div class="blog-grid">${posts.map((p: any) => renderPostCard(p, isAM)).join('')}</div>`
      : `<div class="blog-empty"><i class="fas fa-book-open"></i><h3>${emptyTitle}</h3><p>${emptySub}</p></div>`
    }
  </div>
</section>
`;

    return c.html(renderPageShell({
      page: 'blog',
      lang,
      siteOrigin,
      seo,
      bodyClass: 'blog-page',
      mainHtml,
      extraHead: BLOG_CSS,
    }));
  });

  // ===== BLOG POST =====
  app.get('/blog/:slug', async (c) => {
    c.header('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');

    const reqUrl = new URL(c.req.url);
    const siteOrigin = reqUrl.origin;
    const urlLang = reqUrl.searchParams.get('lang') || '';
    const isAM = urlLang === 'am' || urlLang === 'hy';
    const lang: 'ru' | 'am' = isAM ? 'am' : 'ru';
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
      const notFoundTitle = isAM ? '404 — Հոդվածը չի գտնվել' : '404 — Статья не найдена';
      const backLabel = isAM ? '← Վերադառնալ բլոգ' : '← Вернуться в блог';
      return c.html(`<!DOCTYPE html><html lang="${isAM ? 'hy' : 'ru'}"><head><meta charset="UTF-8"><title>${notFoundTitle}</title>
        <style>body{font-family:system-ui;background:#0f0a1a;color:#f1f0f5;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}</style></head>
        <body><div><h1 style="font-size:4rem;color:#8B5CF6">404</h1><p>${notFoundTitle}</p><a href="/blog${isAM ? '?lang=am' : ''}" style="color:#8B5CF6">${backLabel}</a></div></body></html>`, 404);
    }

    const title = isAM && post.title_am ? post.title_am : post.title_ru;
    const body = isAM && post.body_am ? post.body_am : post.body_ru;
    const catName = isAM && post.category_name_am ? post.category_name_am : (post.category_name_ru || '');

    const ogDesc = (body || '').replace(/<[^>]+>/g, '').substring(0, 160);

    const seo = {
      title: `${title} — Go to Top`,
      description: ogDesc,
      ogImage: post.cover_url || undefined,
    };

    const backLabel = isAM ? 'Վերադառնալ բլոգ' : 'Назад в блог';
    const relatedLabel = isAM ? 'Այլ հոդվածներ' : 'Другие статьи';
    const ctaLabel = isAM ? 'Հետ զանգահարեք' : 'Перезвоните мне';
    const noContent = isAM ? 'Տեքստը շուտով կհայտնվի' : 'Текст статьи скоро появится';

    const mainHtml = `
<section class="article-hero">
  <div class="container">
    <div class="article-header">
      <a href="/blog${isAM ? '?lang=am' : ''}" class="article-back">
        <i class="fas fa-arrow-left"></i> ${backLabel}
      </a>
      <div class="article-meta">
        ${catName ? `<span class="article-meta-cat">${escHtml(catName)}</span>` : ''}
        <span class="article-meta-date">${formatDate(post.created_at || '', isAM)}</span>
      </div>
      <h1 class="article-title">${escHtml(title)}</h1>
    </div>
    ${post.cover_url ? `<img src="${escHtml(post.cover_url)}" alt="${escHtml(title)}" class="article-cover" loading="eager">` : ''}
    <div class="article-body">
      ${body || `<p style="color:var(--text-muted)">${noContent}</p>`}
    </div>
    ${relatedPosts.length > 0 ? `
    <div class="related-posts">
      <h3 style="font-size:1.2rem;font-weight:700;margin-bottom:4px">${relatedLabel}</h3>
      <div class="related-grid">
        ${relatedPosts.map((p: any) => renderPostCard(p, isAM)).join('')}
      </div>
    </div>` : ''}
    <div class="article-cta">
      <a href="javascript:void(0)" onclick="openCallbackModal()" class="btn btn-primary">
        <i class="fas fa-phone"></i>
        ${ctaLabel}
      </a>
    </div>
  </div>
</section>
`;

    return c.html(renderPageShell({
      page: 'blog',
      lang,
      siteOrigin,
      seo,
      bodyClass: 'blog-post-page',
      mainHtml,
      extraHead: BLOG_CSS,
    }));
  });
}
