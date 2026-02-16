import { Hono } from 'hono'
import { html } from 'hono/html'

const app = new Hono()

// API endpoint for lead form submission
app.post('/api/lead', async (c) => {
  const body = await c.req.json()
  console.log('New lead:', body)
  return c.json({ success: true, message: 'Lead received' })
})

// API endpoint for popup form -> Telegram bot
app.post('/api/popup-lead', async (c) => {
  const body = await c.req.json()
  console.log('Popup lead:', body)
  return c.json({ success: true, message: 'Lead received' })
})

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/', (c) => {
  return c.html(html`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Go to Top — Продвижение на Wildberries и Ozon | Առաջխաղացում Wildberries-ի և Ozon-ի վրա</title>
<meta name="description" content="Go to Top — продвижение карточек на Wildberries и Ozon под ключ: выкупы живыми людьми и продающий контент. Собственный склад в Ереване.">
<meta property="og:title" content="Go to Top — Продвижение на Wildberries и Ozon">
<meta property="og:description" content="Выкупы живыми людьми, отзывы с реальными фото, профессиональные фотосессии. Собственный склад в Ереване.">
<meta property="og:type" content="website">
<meta property="og:image" content="/static/img/logo-gototop.png">
<link rel="icon" type="image/png" href="/static/img/logo-gototop.png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css">
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
html{scroll-behavior:smooth;font-size:16px}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);line-height:1.7;overflow-x:hidden}
.container{max-width:1200px;margin:0 auto;padding:0 24px}
a{text-decoration:none;color:inherit}
img{max-width:100%;height:auto}
.header{position:fixed;top:0;left:0;right:0;z-index:1000;padding:12px 0;transition:var(--t);background:rgba(15,10,26,0.8);backdrop-filter:blur(20px);border-bottom:1px solid transparent}
.header.scrolled{border-bottom:1px solid var(--border);background:rgba(15,10,26,0.95)}
.nav{display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{display:flex;align-items:center;gap:12px}
.logo img{height:44px;width:auto;border-radius:8px}
.logo-text{font-size:1.3rem;font-weight:800;background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-links{display:flex;align-items:center;gap:24px;list-style:none}
.nav-links a{font-size:0.88rem;font-weight:500;color:var(--text-sec);transition:var(--t)}
.nav-links a:hover{color:var(--text)}
.nav-right{display:flex;align-items:center;gap:12px}
.lang-switch{display:flex;background:var(--bg-card);border-radius:8px;overflow:hidden;border:1px solid var(--border)}
.lang-btn{padding:6px 14px;font-size:0.78rem;font-weight:600;cursor:pointer;transition:var(--t);background:transparent;border:none;color:var(--text-muted)}
.lang-btn.active{background:var(--purple);color:white}
.nav-cta{padding:10px 22px;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white!important;border-radius:var(--r-sm);font-weight:600;font-size:0.88rem;transition:var(--t);display:flex;align-items:center;gap:8px}
.nav-cta:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(139,92,246,0.4)}
.hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;padding:8px}
.hamburger span{width:24px;height:2px;background:var(--text);transition:var(--t);border-radius:2px}
.hamburger.active span:nth-child(1){transform:rotate(45deg) translate(5px,5px)}
.hamburger.active span:nth-child(2){opacity:0}
.hamburger.active span:nth-child(3){transform:rotate(-45deg) translate(5px,-5px)}
.nav-mobile-cta{display:none}
.hero{padding:140px 0 80px;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-50%;right:-30%;width:80%;height:150%;background:radial-gradient(ellipse,rgba(139,92,246,0.08) 0%,transparent 70%);pointer-events:none}
.hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center}
.hero-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 18px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.85rem;font-weight:500;color:var(--accent);margin-bottom:24px}
.hero h1{font-size:3rem;font-weight:800;line-height:1.15;margin-bottom:20px;letter-spacing:-0.02em}
.hero h1 .gr{background:linear-gradient(135deg,var(--purple),var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero-desc{font-size:1.05rem;color:var(--text-sec);margin-bottom:32px;max-width:520px;line-height:1.8}
.hero-stats{display:flex;gap:32px;margin-bottom:36px}
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
.hero-image img{border-radius:var(--r-lg);width:100%;height:480px;object-fit:cover;object-position:center;border:1px solid var(--border)}
.hero-badge-img{position:absolute;bottom:20px;left:20px;background:rgba(15,10,26,0.9);backdrop-filter:blur(10px);padding:12px 18px;border-radius:var(--r-sm);display:flex;align-items:center;gap:10px;border:1px solid var(--border)}
.hero-badge-img i{color:var(--success);font-size:1.1rem}
.hero-badge-img span{font-size:0.85rem;font-weight:500}
.ticker{padding:20px 0;background:var(--bg-surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border);overflow:hidden}
.ticker-track{display:flex;animation:ticker 40s linear infinite;white-space:nowrap}
.ticker-item{display:flex;align-items:center;gap:10px;padding:0 40px;font-size:0.88rem;color:var(--text-sec);flex-shrink:0}
.ticker-item i{color:var(--purple)}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.section{padding:56px 0}
.section-dark{background:var(--bg-surface)}
.section-header{text-align:center;margin-bottom:56px}
.section-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px}
.section-title{font-size:2.2rem;font-weight:800;line-height:1.2;margin-bottom:16px;letter-spacing:-0.02em}
.section-sub{font-size:1rem;color:var(--text-sec);max-width:640px;margin:0 auto;line-height:1.7}
.services-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;margin-bottom:16px}
.svc-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:32px;transition:var(--t);position:relative;overflow:hidden}
.svc-card:hover{border-color:rgba(139,92,246,0.3);transform:translateY(-4px);box-shadow:var(--glow)}
.svc-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--purple),var(--accent));opacity:0;transition:var(--t)}
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
.calc-row{display:grid;grid-template-columns:1fr auto auto;gap:16px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)}
.calc-row:last-of-type{border-bottom:none}
.calc-label{font-size:0.92rem;font-weight:500}
.calc-price{font-size:0.82rem;color:var(--text-muted);white-space:nowrap}
.calc-input{display:flex;align-items:center;gap:8px}
.calc-input button{width:36px;height:36px;border-radius:8px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:1.1rem;cursor:pointer;transition:var(--t);display:flex;align-items:center;justify-content:center}
.calc-input button:hover{border-color:var(--purple);background:rgba(139,92,246,0.1)}
.calc-input input[type="number"]{width:56px;text-align:center;font-weight:600;font-size:1rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:6px 4px;-moz-appearance:textfield;outline:none;transition:var(--t)}
.calc-input input[type="number"]:focus{border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.15)}
.calc-input input[type="number"]::-webkit-outer-spin-button,.calc-input input[type="number"]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.calc-total{display:flex;justify-content:space-between;align-items:center;padding:24px 0;margin-top:16px;border-top:2px solid var(--purple)}
.calc-total-label{font-size:1.1rem;font-weight:600}
.calc-total-value{font-size:1.8rem;font-weight:800;color:var(--purple)}
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
.guarantee-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.guarantee-card img{border-radius:var(--r);width:100%;height:auto;object-fit:contain;border:1px solid var(--border)}


.guarantee-card h2{font-size:1.9rem;font-weight:800;margin-bottom:16px}
.guarantee-card>div p{color:var(--text-sec);margin-bottom:16px;line-height:1.8}
.g-list{list-style:none;margin:20px 0}
.g-list li{display:flex;align-items:flex-start;gap:12px;padding:8px 0;font-size:0.92rem}
.g-list li i{color:var(--success);margin-top:4px}
.g-badge{display:inline-flex;align-items:center;gap:10px;padding:12px 20px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:var(--r-sm);color:var(--success);font-weight:600;margin-top:16px}
.cmp-table{width:100%;border-collapse:collapse;background:var(--bg-card);border-radius:var(--r);overflow:hidden;border:1px solid var(--border)}
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
.form-group input,.form-group textarea,.form-group select{width:100%;padding:12px 16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:0.92rem;font-family:inherit;transition:var(--t)}
.form-group input:focus,.form-group textarea:focus,.form-group select:focus{outline:none;border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.15)}
.form-group textarea{resize:vertical;min-height:100px}
.form-group select option{background:var(--bg-card)}
.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:600px;margin:0 auto 32px}
.contact-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:24px;text-align:center;transition:var(--t)}
.contact-card:hover{border-color:rgba(139,92,246,0.3);transform:translateY(-2px)}
.contact-card i.fab{font-size:2rem;color:var(--purple);margin-bottom:12px}
.contact-card h4{font-size:1rem;font-weight:600;margin-bottom:4px}
.contact-card p{font-size:0.82rem;color:var(--text-muted);line-height:1.5}
.footer{padding:48px 0 24px;border-top:1px solid var(--border)}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px;margin-bottom:40px}
.footer-brand p{color:var(--text-muted);font-size:0.88rem;margin-top:12px;line-height:1.7}
.footer-col h4{font-size:0.82rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:16px}
.footer-col ul{list-style:none}
.footer-col li{margin-bottom:10px}
.footer-col a{color:var(--text-sec);font-size:0.88rem;transition:var(--t)}
.footer-col a:hover{color:var(--purple)}
.footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:24px;border-top:1px solid var(--border);font-size:0.78rem;color:var(--text-muted)}
.tg-float{position:fixed;bottom:24px;right:24px;z-index:999;display:flex;align-items:center;gap:12px;padding:14px 24px;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white;border-radius:50px;box-shadow:0 8px 30px rgba(139,92,246,0.4);transition:var(--t);font-weight:600;font-size:0.88rem}
.tg-float:hover{transform:translateY(-3px) scale(1.03);box-shadow:0 12px 40px rgba(139,92,246,0.5)}
.tg-float i{font-size:1.2rem}
.lightbox{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:9999;align-items:center;justify-content:center;padding:40px;cursor:pointer}
.lightbox.show{display:flex}
.lightbox img{max-width:90%;max-height:90vh;border-radius:var(--r);object-fit:contain}

/* ===== CTA BUTTONS AFTER SECTIONS ===== */
.section-cta{display:flex;gap:14px;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:28px;padding-top:24px;border-top:1px solid var(--border)}
.section-cta .btn{font-size:0.9rem;padding:12px 24px}
.section-cta .btn i{margin-right:6px}
.btn-success{background:linear-gradient(135deg,#10B981,#059669);color:white;box-shadow:0 4px 15px rgba(16,185,129,0.3)}
.btn-success:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(16,185,129,0.5)}
.btn-warning{background:linear-gradient(135deg,#F59E0B,#D97706);color:white;box-shadow:0 4px 15px rgba(245,158,11,0.3)}
.btn-warning:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(245,158,11,0.5)}
.btn-tg{background:linear-gradient(135deg,#0088cc,#0077b5);color:white;box-shadow:0 4px 15px rgba(0,136,204,0.3)}
.btn-tg:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(0,136,204,0.5)}

/* ===== POPUP - GUARANTEED VISIBLE ===== */
.popup-overlay{
  display:none;
  position:fixed;top:0;left:0;right:0;bottom:0;
  width:100%;height:100%;
  background:rgba(0,0,0,0.85);
  z-index:100000;
  justify-content:center;align-items:center;
  padding:20px;
  overflow-y:auto;
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
  border-radius:10px;color:#fff;font-size:0.92rem;
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

/* ===== WB BANNER ===== */
.wb-banner{padding:20px 0;background:var(--bg-surface);border-bottom:1px solid var(--border)}
.wb-banner-inner{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:center}
.wb-banner-left{display:flex;align-items:center;gap:16px;padding:20px 28px;background:linear-gradient(135deg,#ff3366,#8B5CF6);border-radius:var(--r);position:relative;overflow:hidden}
.wb-banner-left .wb-logo{font-weight:900;font-size:1.3rem;color:#fff}
.wb-banner-left .wb-text{font-weight:800;font-size:1.1rem;color:#fff;text-transform:uppercase;line-height:1.3}
.wb-banner-left .wb-excl{position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:3rem;font-weight:900;color:rgba(255,255,255,0.3)}
.wb-banner-right{display:flex;align-items:center;gap:16px;padding:16px 28px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r)}
.wb-banner-right .wb-r-icon{font-size:1.4rem}
.wb-banner-right .wb-r-text{font-weight:700;font-size:0.92rem;text-transform:uppercase;line-height:1.4}
.wb-banner-right .btn{margin-left:auto;white-space:nowrap;font-size:0.82rem;padding:10px 20px}

/* ===== ABOUT SECTION ===== */
.about-grid{display:grid;grid-template-columns:1fr 1.5fr;gap:48px;align-items:center}
.about-img{position:relative;border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--border)}
.about-img img{width:100%;height:auto;display:block}
.about-text h2{font-size:2rem;font-weight:800;margin-bottom:20px;line-height:1.3}
.about-text h2 .gr{background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.about-text p{color:var(--text-sec);font-size:1rem;line-height:1.8;margin-bottom:16px}

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
.buyout-card ul{list-style:none;margin-top:12px}
.buyout-card ul li{padding:4px 0;font-size:0.88rem;color:var(--text-sec)}
.buyout-card ul li::before{content:"•";color:var(--purple);margin-right:8px}
.buyout-cta{text-align:right;margin-top:24px}

/* ===== STATS BAR ===== */
.stats-bar{padding:60px 0;background:var(--bg-surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:32px;text-align:center}
.stat-card .stat-big{font-size:2.8rem;font-weight:900;color:var(--purple);line-height:1}
.stat-card .stat-desc{font-size:0.88rem;color:var(--text-sec);margin-top:6px;font-weight:500}


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
.about-grid{display:grid;grid-template-columns:1fr 1.5fr;gap:48px;align-items:center}
.about-img{position:relative;border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--border)}
.about-img img{width:100%;height:auto;display:block}
.about-text h2{font-size:2rem;font-weight:800;margin-bottom:20px;line-height:1.3}
.about-text h2 .gr{background:linear-gradient(135deg,var(--purple),var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.about-text p{color:var(--text-sec);font-size:1rem;line-height:1.8;margin-bottom:16px}
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
.buyout-card ul{list-style:none;margin-top:12px}
.buyout-card ul li{padding:4px 0;font-size:0.88rem;color:var(--text-sec)}
.buyout-card ul li::before{content:"\2022";color:var(--purple);margin-right:8px}
.buyout-cta{text-align:right;margin-top:24px}

/* ===== REVIEWS DETAIL ===== */
.reviews-detail{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px;margin-top:32px}
.reviews-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin-top:32px}
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
  .hero-image{max-width:500px}
  .process-grid{grid-template-columns:repeat(3,1fr)}
  .step:nth-child(n+4){margin-top:16px}
  .guarantee-card{grid-template-columns:1fr;gap:32px}
  .footer-grid{grid-template-columns:1fr 1fr}
  .wb-banner-inner{flex-direction:column}
  .about-grid{grid-template-columns:1fr}
  .buyout-grid{grid-template-columns:1fr 1fr}
  .stats-grid{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:768px){
  .nav-links{display:none;position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100vh;background:rgba(15,10,26,0.98);flex-direction:column;justify-content:center;align-items:center;gap:28px;padding:80px 20px 20px;z-index:10000;overflow-y:auto}
  .nav-links.active{display:flex !important}
  .nav-links li{list-style:none;width:100%;text-align:center}
  .nav-links a{font-size:1.3rem;display:block;padding:14px 20px;color:#fff;border-radius:12px;transition:background 0.2s;font-weight:600}
  .nav-links a:hover,.nav-links a:active{background:rgba(139,92,246,0.2)}
  .nav-mobile-cta{display:list-item;list-style:none;margin-top:16px;width:100%;text-align:center}
  .nav-mobile-cta .btn{display:inline-flex;align-items:center;gap:8px;padding:14px 32px;font-size:1.1rem;border-radius:12px;font-weight:700}
  .hamburger{display:flex;z-index:10001;position:relative}
  .nav-right .nav-cta{display:none}
  .hero{padding:110px 0 60px}
  .hero h1{font-size:1.9rem}
  .hero-stats{flex-wrap:wrap;gap:20px}
  .hero-buttons{flex-direction:column}
  .hero-image img{height:300px}
  .section-title{font-size:1.7rem}
  .services-grid{grid-template-columns:1fr}
  .wh-grid{grid-template-columns:1fr}
  .buyout-grid{grid-template-columns:1fr}
  .stats-grid{grid-template-columns:repeat(2,1fr);gap:20px}
  .process-grid{grid-template-columns:1fr 1fr}
  .cmp-table{font-size:0.78rem}
  .cmp-table td,.cmp-table th{padding:10px 12px}
  .calc-row{grid-template-columns:1fr;gap:8px}
  .calc-wrap{padding:24px}
  .calc-tabs{gap:6px}
  .contact-grid{grid-template-columns:1fr}
  .form-card{padding:28px}
  .footer-grid{grid-template-columns:1fr}
  .footer-bottom{flex-direction:column;gap:8px;text-align:center}
  .tg-float span{display:none}
  .tg-float{padding:16px;border-radius:50%}
  .popup-card .pf-row{grid-template-columns:1fr}
}
@media(max-width:480px){
  .hero h1{font-size:1.6rem}
  .section{padding:44px 0}
  .section-title{font-size:1.4rem}
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
    <li class="nav-mobile-cta"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><i class="fab fa-telegram"></i> Написать нам</a></li>
  </ul>
  <div class="nav-right">
    <div class="lang-switch">
      <button class="lang-btn active" data-lang="ru" onclick="switchLang('ru')">RU</button>
      <button class="lang-btn" data-lang="am" onclick="switchLang('am')">AM</button>
    </div>
    <a href="https://t.me/goo_to_top" target="_blank" class="nav-cta">
      <i class="fab fa-telegram"></i>
      <span data-ru="Написать нам" data-am="Գրել մեզ">Написать нам</span>
    </a>
  </div>
  <button class="hamburger" id="hamburger" onclick="toggleMenu()">
    <span></span><span></span><span></span>
  </button>
</nav>
</div>
</header>

<!-- ===== HERO ===== -->
<section class="hero" id="hero">
<div class="container">
<div class="hero-grid">
  <div>
    <div class="hero-badge">
      <i class="fas fa-circle" style="color:var(--success);font-size:0.5rem"></i>
      <span data-ru="Успешный опыт с 2021 года" data-am="Հաջողված փորձ 2021 թվականից">Успешный опыт с 2021 года</span>
    </div>
    <h1>
      <span data-ru="Выведем ваш товар" data-am="Մենք կբարձրացնենք ձեր ապրանքը">Выведем ваш товар</span><br>
      <span class="gr" data-ru="в ТОП Wildberries" data-am="Wildberries-ի TOP">в ТОП Wildberries</span>
    </h1>
    <p class="hero-desc" data-ru="Выкупы живыми людьми и продающий контент. С нами ваши товары становятся ТОПами продаж. Собственный склад и более 1000 реальных аккаунтов в Ереване." data-am="Կենդանի մարդկանց գնումներ և վաճառող բովանդակություն: Մեզ հետ ձեր ապրանքները դառնում են TOP վաճառվողներ: Սեփական պահեստ և ավելի քան 1000 իրական հաշիվ Երևանում:">
      Выкупы живыми людьми и продающий контент. С нами ваши товары становятся ТОПами продаж. Собственный склад и более 1000 реальных аккаунтов в Ереване.
    </p>
    <div class="hero-stats">
      <div class="stat"><div class="stat-num" data-count="847">0</div><div class="stat-label" data-ru="товаров в ТОП" data-am="ապրանքներ TOP-ում">товаров в ТОП</div></div>
      <div class="stat"><div class="stat-num" data-count="0">0</div><div class="stat-label" data-ru="блокировок" data-am="արգելափակում">блокировок</div></div>
      <div class="stat"><div class="stat-num" data-count="1000">0</div><div class="stat-label" data-ru="аккаунтов" data-am="հաշիվներ">аккаунтов</div></div>
    </div>
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
    <img src="/static/img/founder.jpg" alt="Go to Top">
    <div class="hero-badge-img">
      <i class="fas fa-shield-alt"></i>
      <span data-ru="Собственный склад в Ереване" data-am="Սեփական պահեստ Երևանում">Собственный склад в Ереване</span>
    </div>
  </div>
</div>
</div>
</section>

<!-- ===== TICKER ===== -->
<div class="ticker">
<div class="ticker-track" id="tickerTrack"></div>
</div>


<!-- ===== WB BANNER ===== -->
<div class="wb-banner fade-up">
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
<div class="stats-bar fade-up">
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
      <div class="stat-desc" data-ru="день до выхода в ТОП" data-am="օր մինչև TOP դուրս գալ">день до выхода в ТОП</div>
    </div>
    <div class="stat-card">
      <div class="stat-big" data-count-s="200">0+</div>
      <div class="stat-desc" data-ru="выкупов каждый день" data-am="գնում ամեն օր">выкупов каждый день</div>
    </div>
  </div>
</div>
</div>

<!-- ===== ABOUT ===== -->
<section class="section" id="about">
<div class="container">
  <div class="about-grid fade-up">
    <div class="about-img">
      <img src="/static/img/about-hero2.jpg" alt="Go to Top — Business Growth">
    </div>
    <div class="about-text">
      <div class="section-badge"><i class="fas fa-info-circle"></i> <span data-ru="О компании" data-am="Ընկերության մասին">О компании</span></div>
      <h2 data-ru="Что такое" data-am="Ի՞նչ է">Что такое <span class="gr">Go to Top</span>?</h2>
      <p data-ru="«Go to Top» — сервис развития Вашего бизнеса на маркетплейсах с помощью комплексного продвижения и услуги выкупов по ключевым словам." data-am="«Go to Top» — ձեր բիզնեսի զարգացման ծառայություն մարկետփլեյսներում՝ համապարփակ առաջխաղացման և գնումների ծառայության միջոցով:">«Go to Top» — сервис развития Вашего бизнеса на маркетплейсах с помощью комплексного продвижения и услуги выкупов по ключевым словам.</p>
      <p data-ru="Наша команда профессионалов с 2021 года работает на результат. У нас собственные склады и офисы в Ереване. Используем для выкупов Вашего товара только реальные аккаунты людей и производим всё вручную." data-am="Մեր մասնագետների թիմը 2021 թվականից աշխատում է արդյունքի համար: Մենք ունենք սեփական պահեստներ և գրասենյակներ Երևանում: Գնումների համար օգտագործում ենք միայն իրական մարդկանց հաշիվներ և ամեն ինչ անում ենք ձեռքով:">Наша команда профессионалов с 2021 года работает на результат. У нас собственные склады и офисы в Ереване. Используем для выкупов Вашего товара только реальные аккаунты людей и производим всё вручную.</p>
      <div class="about-highlight">
        <p data-ru="Наилучший результат Вы получите, воспользовавшись комплексом наших услуг!" data-am="Լավագույն արդյունքը կստանաք օգտվելով մեր ծառայությունների փաթեթը!"><i class="fas fa-bolt" style="margin-right:8px"></i>Наилучший результат Вы получите, воспользовавшись комплексом наших услуг!</p>
      </div>
      <div class="section-cta">
        <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><i class="fas fa-shopping-cart"></i> <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">Заказать сейчас</span></a>
      </div>
    </div>
  </div>
</div>
</section>

<!-- ===== SERVICES ===== -->
<section class="section" id="services">
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
      <p data-ru="Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану." data-am="Ձեր ապրանքը գնվում է իրական մարդկանցով իրական հաշիվներից տարբեր ՊՎԶ-ներ ամբողջ Երևանում:">Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану.</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Реальные аккаунты с историей покупок" data-am="Իրական հաշիվներ գնումների պատմությամբ">Реальные аккаунты с историей покупок</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Географическое распределение" data-am="Աշխարհագրական բաշխում">Географическое распределение</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Естественное поведение покупателей" data-am="Գնորդների բնական վարքագիծ">Естественное поведение покупателей</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Забор товара из ПВЗ" data-am="Ապրանքի վերցնում ՊՎԶ-ից">Забор товара из ПВЗ</span></li>
      </ul>
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
      <div class="svc-icon"><i class="fas fa-camera"></i></div>
      <h3 data-ru="Фото и видеосъёмка" data-am="Լուսանկարահանում և տեսանկարահանում">Фото и видеосъёмка</h3>
      <p data-ru="Профессиональная съёмка товаров с моделями для карточек WB и отзывов." data-am="Մասնագիտական ապրանքների լուսանկարահանում մոդելներով WB քարտերի և կարծիքների համար:">Профессиональная съёмка товаров с моделями для карточек WB и отзывов.</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Женские и мужские модели" data-am="Կանացի և տղամարդկանցի մոդելներ">Женские и мужские модели</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Предметная съёмка" data-am="Առարկայական լուսանկարահանում">Предметная съёмка</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Видеообзоры товаров" data-am="Ապրանքների տեսանյութներ">Видеообзоры товаров</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Ребёнок модель (до 14 лет)" data-am="Երեխա մոդել (մինչև 14 տարեկան)">Ребёнок модель (до 14 лет)</span></li>
      </ul>
      <div style="margin-top:20px;text-align:center"><a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary" style="font-size:0.85rem;padding:10px 20px"><i class="fas fa-camera"></i> <span data-ru="Заказать съёмку" data-am="Պատվիրել լուսանկար">Заказать съёмку</span></a></div>
    </div>
  </div>
</div>
</section>


<!-- ===== BUYOUT DETAIL ===== -->
<section class="section">
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
        <p data-ru="Сопровождение и контроль на всех этапах. Точное следование алгоритму для безопасности вашего кабинета." data-am="Ուղեկցում և վերահսկողություն բոլոր փուլերում: Ալգորիթմի ճիշտ հետևողականությա և ձեր կաբինետի անվտանգության համար:">Сопровождение и контроль на всех этапах. Точное следование алгоритму для безопасности вашего кабинета.</p>
        <div style="margin-top:16px;text-align:center"><a href="https://t.me/suport_admin_2" target="_blank" class="btn btn-tg" style="font-size:0.82rem;padding:9px 18px"><i class="fab fa-telegram"></i> <span data-ru="Получить индивидуальный расчёт" data-am="Ստանալ ինդիվիդուալ հաշվարկ">Получить индивидуальный расчёт</span></a></div>
      </div>
    </div>
  </div>
</div>
</section>


<!-- ===== WHY BUYOUTS BY KEYWORDS ===== -->
<section class="section" id="why-buyouts">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-chart-line"></i> <span data-ru="Почему это работает" data-am="Ինչու է սա աշխատում.">Почему это работает</span></div>
    <h2 class="section-title" data-ru="Почему выкупы по ключевым запросам — самый эффективный способ продвижения" data-am="Ինչու է գնումները բանալի բառերով — ամենա արդյունավետը.">Почему выкупы по ключевым запросам — <span class="gr">самый эффективный способ</span> продвижения</h2>
  </div>

  <div class="why-block fade-up">
    <h3><i class="fas fa-funnel-dollar"></i> <span data-ru="Мы не просто покупаем ваш товар — мы прокачиваем всю воронку" data-am="Մենք վոչ միայն գնում ենք — մենք բարձրացնում ենք բոլոր քայլերի կոնվերսիաները">Мы не просто покупаем ваш товар — мы прокачиваем всю воронку</span></h3>
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

  <div class="why-block fade-up">
    <h3><i class="fas fa-balance-scale-right"></i> <span data-ru="50 000 ֏ на блогера vs 50 000 ֏ на выкупы — что эффективнее?" data-am="50 000 բլոգեր vs 50 000 ինքնագնումներ — որն է ավելի արդյունավետ?">50 000 ֏ на блогера vs 50 000 ֏ на выкупы — что эффективнее?</span></h3>
    <div class="compare-box">
      <div class="compare-side bad">
        <h4><i class="fas fa-dice"></i> Reels у блогера</h4>
        <div class="price-tag">֏50 000</div>
        <p data-ru="1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это всегда риск без гарантий результата." data-am="Բլոգերի 1 տեսանյութը ռիսկ է։ Անկախ նրանից՝ այն կհավագի դիտումներ, թե ոչ՝ ոչ ոք չգիտի։ Եթե ոչ, գումարը կորած է։ Դա միշտ ռիսկ է՝ առանց երաշխավորված արդյունքի։">1 видеоролик у блогера — это лотерея. Попадёт в рекомендации или нет — никто не знает. Если не залетит — деньги потеряны. Это <strong>всегда риск</strong> без гарантий результата.</p>
      </div>
      <div class="compare-side good">
        <h4><i class="fas fa-chart-line"></i> 25 выкупов по ключевым</h4>
        <div class="price-tag">֏50 000</div>
        <p data-ru="25 выкупов по целевому запросу — это 100% проверенный способ продвижения. Ваш товар быстро поднимается в ТОП выдачи, закрепляется там и начинает привлекать органический трафик. Больше продаж. Больше выручки. Гарантированно." data-am="25 գնումը նպատակային հարցմով  99% ապացուցված առաջխաղացման մեթոդ է: Ձեր ապրանքը արագորեն բարձրանում է որոնման արդյունքների առաջատար դիրքեր, հաստատվում է և սկսում է գրացել օրգանիգ դիտումներ: Շատ դիտում ավելի շատ վաճառք: Ավելի շատ եկամուտ: Երաշխավորված:">25 выкупов по целевому запросу — это <strong>100% проверенный способ</strong> продвижения. Ваш товар быстро поднимается в ТОП выдачи, закрепляется там и начинает привлекать <strong>органический трафик</strong>. Больше продаж. Больше выручки. <strong>Гарантированно.</strong></p>
      </div>
    </div>
    <div class="highlight-result"><i class="fas fa-lightbulb"></i> <strong>Факт:</strong> при выкупах по 1 ключевому запросу уже от <strong>25 штук</strong> товар быстро продвигается в ТОП и закрепляется там надолго — за счёт улучшения всех поведенческих метрик. А органический трафик WB становится вашим основным источником продаж.</div>
  </div>

  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-warning"><i class="fas fa-fire"></i> <span data-ru="Начать выкупы по ключевым" data-am="Սկսել գնումները բանալի բառերով">Начать выкупы по ключевым</span></a>
  </div>
</div>
</section>

<!-- ===== WB OFFICIAL ===== -->
<section class="section section-dark" id="wb-official">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-gavel"></i> <span data-ru="Официально" data-am="Պաշտոնապես">Официально</span></div>
    <h2 class="section-title" data-ru="Wildberries официально разрешил самовыкупы" data-am="Wildberries-ը պաշտոնապես թույլատրել է ինքնագնումները">Wildberries <span class="gr">официально разрешил</span> самовыкупы</h2>
  </div>

  <div class="why-block fade-up">
    <div class="wb-official-badge"><i class="fas fa-check-circle"></i> Подтверждено в оферте WB</div>
    
    <h3><i class="fas fa-shield-alt"></i> <span data-ru="Никаких штрафов. Никаких рисков." data-am="Ոչ մի տուգանք: Ոչ մի ռիսկ:">Никаких штрафов. Никаких рисков.</span></h3>
    <p data-ru="Wildberries официально подтвердил в своей оферте, что самовыкупы не являются нарушением. За это не предусмотрены штрафы или блокировки кабинета. Тысячи успешных продавцов используют этот инструмент каждый день." data-am="Wildberries-ը պաշտոնապես հաստատել է իր օֆերտայում, որ ինքնագնումները խախտում չեն: Տուգանքներ կամ արգելափակումներ նախատեսված չեն: Հազարավոր հաջողակ վաճառողներ օգտագործում են այս գործիքը ամեն օր:">Wildberries официально подтвердил в своей оферте, что самовыкупы <strong>не являются нарушением</strong>. За это не предусмотрены штрафы или блокировки кабинета. Тысячи успешных продавцов используют этот инструмент каждый день.</p>
    
    <h3><i class="fas fa-arrow-up"></i> <span data-ru="WB вернул приоритет органической выдачи" data-am="WB-ն վերադարձրել է օրգանիկ արտադրանքի առաջնահերթությունը">WB вернул приоритет органической выдачи</span></h3>
    <p data-ru="Wildberries подтвердил в обновлённой оферте: приоритет в поисковой выдаче получают товары с лучшими поведенческими метриками — конверсия, время на карточке, добавления в корзину, заказы. Именно это мы и прокачиваем при каждом выкупе." data-am="Wildberries-ը հաստատել է թարմացված օֆերտայում։ որոնման արդյունքներում առաջնահերթություն են ստանում լավագույն վարքագծային ցուցանիշներով ապրանքները։ Հենց դա է, ինչ մենք ապահովում ենք յուրաքանչյուր գնումի ընթացքում:">Wildberries подтвердил в обновлённой оферте: приоритет в поисковой выдаче получают товары с лучшими <strong>поведенческими метриками</strong> — конверсия, время на карточке, добавления в корзину, заказы. <strong>Именно это мы и прокачиваем при каждом выкупе.</strong></p>

    <div class="highlight-result"><i class="fas fa-rocket"></i> <strong>Сейчас — лучшее время</strong> для продвижения вашего товара. Пока конкуренты сомневаются — вы уже можете занять ТОП выдачи, привлечь органический трафик и <strong>зарабатывать больше</strong>. Не ждите, пока конкуренты сделают это первыми.</div>
  </div>

  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success"><i class="fas fa-rocket"></i> <span data-ru="Занять ТОП прямо сейчас" data-am="Զբաղեցնել TOP-ը հիմա">Занять ТОП прямо сейчас</span></a>
  </div>
</div>
</section>

<!-- ===== CALCULATOR ===== -->
<section class="section section-dark" id="calculator">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-calculator"></i> <span data-ru="Калькулятор" data-am="Հաշվիչ">Калькулятор</span></div>
    <h2 class="section-title" data-ru="Рассчитайте стоимость услуг" data-am="Հաշվեք ծառայությունների արժեքը">Рассчитайте стоимость услуг</h2>
    <p class="section-sub" data-ru="Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram." data-am="Ընտրեք անհրաժեշտ ծառայությունները, նշեք քանակը և իմացեք գումարը: Պատվերը ձևակերպվում է Telegram-ով:">Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram.</p>
  </div>
  <div class="calc-wrap fade-up">
    <div class="calc-tabs">
      <div class="calc-tab active" onclick="showCalcTab('buyouts',this)" data-ru="Выкупы" data-am="Գնումներ">Выкупы</div>
      <div class="calc-tab" onclick="showCalcTab('reviews',this)" data-ru="Отзывы" data-am="Կարծիքներ">Отзывы</div>
      <div class="calc-tab" onclick="showCalcTab('photo',this)" data-ru="Фотосъёмка" data-am="Լուսանկարահանում">Фотосъёмка</div>
      <div class="calc-tab" onclick="showCalcTab('ff',this)" data-ru="ФФ" data-am="ՖՖ">ФФ</div>
      <div class="calc-tab" onclick="showCalcTab('logistics',this)" data-ru="Логистика" data-am="Լոգիստիկա">Логистика</div>
      <div class="calc-tab" onclick="showCalcTab('other',this)" data-ru="Прочие услуги" data-am="Այլ ծառայություններ">Прочие услуги</div>
    </div>

    <!-- ===== ВЫКУПЫ ===== -->
    <div class="calc-group active" id="cg-buyouts">
      <div class="calc-row" data-price="buyout" id="buyoutRow">
        <div class="calc-label" data-ru="Выкуп + забор из ПВЗ" data-am="Գնում + վերցնում ՊՎԶ-ից">Выкуп + забор из ПВЗ</div>
        <div class="calc-price" id="buyoutPriceLabel">֏2 000</div>
        <div class="calc-input"><button onclick="ccBuyout(-1)">−</button><input type="number" id="buyoutQty" value="0" min="0" max="999" onchange="onBuyoutInput()" oninput="onBuyoutInput()"><button onclick="ccBuyout(1)">+</button></div>
      </div>
      <div class="buyout-tier-info">
        <strong data-ru="Чем больше выкупов — тем дешевле:" data-am="Որքան շատ գնումներ — այնքան էժան:">Чем больше выкупов — тем дешевле:</strong><br>
        1-20 шт → ֏2 000 &nbsp;|&nbsp; 21-40 шт → ֏1 700 &nbsp;|&nbsp; 41-60 шт → ֏1 500 &nbsp;|&nbsp; 60+ шт → ֏1 250
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Выкуп КГТ + забор из ПВЗ" data-am="ԽԳՏ գնում + վերցնում ՊՎԶ-ից">Выкуп КГТ + забор из ПВЗ</div>
        <div class="calc-price">֏2 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ОТЗЫВЫ ===== -->
    <div class="calc-group" id="cg-reviews">
      <div class="calc-row" data-price="300">
        <div class="calc-label" data-ru="Оценка" data-am="Գնահատական">Оценка</div>
        <div class="calc-price">֏300</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="500">
        <div class="calc-label" data-ru="Оценка + отзыв" data-am="Գնահատական + կարծիք">Оценка + отзыв</div>
        <div class="calc-price">֏500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="500">
        <div class="calc-label" data-ru="Вопрос к товару" data-am="Հարց ապրանքի վերաբերյալ">Вопрос к товару</div>
        <div class="calc-price">֏500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="250">
        <div class="calc-label" data-ru="Написание текста отзыва" data-am="Կարծիքի տեքստի գրում">Написание текста отзыва</div>
        <div class="calc-price">֏250</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="100">
        <div class="calc-label" data-ru="Подписка на бренд / страницу" data-am="Բրենդի / էջի բաժանորդագրություն">Подписка на бренд / страницу</div>
        <div class="calc-price">֏100</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ФОТОСЪЁМКА ===== -->
    <div class="calc-group" id="cg-photo">
      <div class="calc-row" data-price="3500">
        <div class="calc-label" data-ru="Фотосессия в гардеробной WB (жен. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (կին մոդել)">Фотосессия в гардеробной WB (жен. модель)</div>
        <div class="calc-price">֏3 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="4500">
        <div class="calc-label" data-ru="Фотосессия в гардеробной WB (муж. модель)" data-am="Լուսանկարահանում WB հագուստապահարանում (տղամարդ մոդել)">Фотосессия в гардеробной WB (муж. модель)</div>
        <div class="calc-price">֏4 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Предметная фотосъёмка (3 фото)" data-am="Առարկայական լուսանկարահանում (3 լուսանկար)">Предметная фотосъёмка (3 фото)</div>
        <div class="calc-price">֏2 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="5000">
        <div class="calc-label" data-ru="Предметная съёмка (крупное / техника, 3 фото)" data-am="Առարկայական լուսանկարահանում (խոշոր / տեխնիկա, 3 լուս.)">Предметная съёмка (крупное / техника, 3 фото)</div>
        <div class="calc-price">֏5 000</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Ребёнок модель (до 14 лет)" data-am="Երեխա մոդել (մինչև 14 տարեկան)">Ребёнок модель (до 14 лет)</div>
        <div class="calc-price">֏2 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="7000">
        <div class="calc-label" data-ru="Видеообзор товара" data-am="Ապրանքի տեսանկար">Видеообзор товара</div>
        <div class="calc-price">֏7 000</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ФФ (Фулфилмент) ===== -->
    <div class="calc-group" id="cg-ff">
      <div class="calc-row" data-price="100">
        <div class="calc-label" data-ru="Замена штрихкода" data-am="Շտրիխկոդի փոխարինում">Замена штрихкода</div>
        <div class="calc-price">֏100</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="200">
        <div class="calc-label" data-ru="Переупаковка (наша)" data-am="Վերափաթեթավորում (մեր)">Переупаковка (наша)</div>
        <div class="calc-price">֏200</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="150">
        <div class="calc-label" data-ru="Переупаковка (клиента)" data-am="Վերափաթեթավորում (հաճախորդի)">Переупаковка (клиента)</div>
        <div class="calc-price">֏150</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ЛОГИСТИКА ===== -->
    <div class="calc-group" id="cg-logistics">
      <div class="calc-row" data-price="2000">
        <div class="calc-label" data-ru="Доставка на склад WB (1 коробка 60х40х40)" data-am="Առաքում WB պահեստ (1 տուփ 60x40x40)">Доставка на склад WB (1 коробка 60х40х40)</div>
        <div class="calc-price">֏2 000</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Доставка до вашего склада (1 коробка 60х40х40)" data-am="Առաքում ձեր պահեստ (1 տուփ 60x40x40)">Доставка до вашего склада (1 коробка 60х40х40)</div>
        <div class="calc-price">֏2 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- ===== ПРОЧИЕ УСЛУГИ ===== -->
    <div class="calc-group" id="cg-other">
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Глажка одежды (одиночная вещь)" data-am="Հագուստի արդուկում (մեկ իր)">Глажка одежды (одиночная вещь)</div>
        <div class="calc-price">֏1 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Глажка одежды (верхняя одежда)" data-am="Հագուստի արդուկում (վերնահագուստ)">Глажка одежды (верхняя одежда)</div>
        <div class="calc-price">֏2 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Забор из ПВЗ для съёмки" data-am="Վերցնում ՊՎԶ-ից">Забор из ПВЗ для съёмки</div>
        <div class="calc-price">֏1 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Возврат в ПВЗ после съёмки" data-am="Վերցնում ՊՎԶ-ից">Возврат в ПВЗ после съёмки</div>
        <div class="calc-price">֏1 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><input type="number" value="0" min="0" max="999" onchange="recalc()" oninput="recalc()"><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>
    <div class="calc-total">
      <div class="calc-total-label" data-ru="Итого:" data-am="Ընդամենը:">Итого:</div>
      <div class="calc-total-value" id="calcTotal">֏0</div>
    </div>
    <div class="calc-cta">
      <a href="https://t.me/goo_to_top" id="calcTgBtn" class="btn btn-primary btn-lg" target="_blank">
        <i class="fab fa-telegram"></i>
        <span data-ru="Заказать в Telegram" data-am="Պատվիրել Telegram-ով">Заказать в Telegram</span>
      </a>
    </div>
  </div>
</div>
</section>

<!-- ===== PROCESS ===== -->
<section class="section" id="process">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-route"></i> <span data-ru="Как мы работаем" data-am="Ինչպես ենք աշխատում">Как мы работаем</span></div>
    <h2 class="section-title" data-ru="5 шагов от заявки до ТОПа" data-am="5 քայլ հայտից մինչև ՏՕՊ">5 шагов от заявки до ТОПа</h2>
  </div>
  <div class="process-grid fade-up">
    <div class="step"><div class="step-line"></div><div class="step-num">1</div><h4 data-ru="Заявка" data-am="Հայտ">Заявка</h4><p data-ru="Пишете в Telegram и описываете товар" data-am="Գրում եք Telegram-ով և նկարագրում ապրանքը">Пишете в Telegram и описываете товар</p></div>
    <div class="step"><div class="step-line"></div><div class="step-num">2</div><h4 data-ru="Анализ" data-am="Վերլուծություն">Анализ</h4><p data-ru="Анализируем нишу и создаём стратегию" data-am="Վերլուծում ենք նիշը և ստեղծում ստրատեգիա">Анализируем нишу и создаём стратегию</p></div>
    <div class="step"><div class="step-line"></div><div class="step-num">3</div><h4 data-ru="Запуск" data-am="Մեկնարկ">Запуск</h4><p data-ru="Начинаем выкупы в течение 24 часов" data-am="Սկսում ենք գնումները 24 ժամվա ընթացքում">Начинаем выкупы в течение 24 часов</p></div>
    <div class="step"><div class="step-line"></div><div class="step-num">4</div><h4 data-ru="Контроль" data-am="Վերահսկողություն">Контроль</h4><p data-ru="Ежедневные отчёты о прогрессе" data-am="Ամենօրյա հաշվետվություններ ընթացքի մասին">Ежедневные отчёты о прогрессе</p></div>
    <div class="step"><div class="step-num">5</div><h4 data-ru="Результат" data-am="Արդյունք">Результат</h4><p data-ru="Ваш товар в ТОПе выдачи WB" data-am="Ձեր ապրանքը WB-ի ՏՕՊ-ում է">Ваш товар в ТОПе выдачи WB</p></div>
  </div>
  <div class="section-cta">
    <a href="https://t.me/suport_admin_2" target="_blank" class="btn btn-tg"><i class="fab fa-telegram"></i> <span data-ru="Написать менеджеру" data-am="Գրել մենեջերին">Написать менеджеру</span></a>
  </div>
</div>
</section>

<!-- ===== WAREHOUSE ===== -->
<section class="section section-dark" id="warehouse">
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
  <p class="section-sub fade-up" style="text-align:center;max-width:700px;margin:32px auto 0" data-ru="Собственный склад в Ереване. Забор ваших товаров с ПВЗ. Надежное хранение товара. Отгрузка Ваших товаров на склад WB СЦ Ереван" data-am="Սեփական պահեստ Երևանում: Ձեր ապրանքների վերցնում ՊՎԶ-ից: Հուսալի պահպանում: Ձեր ապրանքների առաքում WB ՍԿ Երևան պահեստ">Собственный склад в Ереване. Забор ваших товаров с ПВЗ. Надежное хранение товара. Отгрузка Ваших товаров на склад WB СЦ Ереван</p>
  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary"><i class="fas fa-shopping-cart"></i> <span data-ru="Заказать сейчас" data-am="Պատվիրել հիմա">Заказать сейчас</span></a>
  </div>
</div>
</section>

<!-- ===== GUARANTEE ===== -->
<section class="section" id="guarantee">
<div class="container">
    <div class="guarantee-card fade-up">
    <img src="/static/img/team-new.jpg" alt="Команда Go to Top">
    <div>
      <div class="section-badge"><i class="fas fa-shield-alt"></i> <span data-ru="Гарантия безопасности" data-am="Անվտանգության երաշխիք">Гарантия безопасности</span></div>
      <h2 data-ru="Всё организовано и по полочкам. Наша команда" data-am="Ամեն ինչ կազմակերպված է և կարգավորված։ Մեր թիմը">Всё организовано и по полочкам. Наша команда</h2>
      <p data-ru="За всё время работы ни один кабинет клиента не получил блокировку. Каждый проект ведётся опытной командой с полным контролем на каждом этапе." data-am="Աշխատանքի ողջ ընթացքում ոց մի հաճախորդի կաբինետ չի արգելափակվել: Երբ նախագիծ վարում է փորձառու թիմի կողմից լիարժեք վերահսկողությամբ յուրաքանչյուր փուլում:">За всё время работы ни один кабинет клиента не получил блокировку. Каждый проект ведётся опытной командой с полным контролем на каждом этапе.</p>
      <ul class="g-list">
        <li><i class="fas fa-check-circle"></i> <span data-ru="Реальные товары с собственного склада" data-am="Իրական ապրանքներ սեփական պահեստից">Реальные товары с собственного склада</span></li>
        <li><i class="fas fa-check-circle"></i> <span data-ru="Реальные аккаунты с историей покупок" data-am="Իրական հաշիվներ գնումների պատմությամբ">Реальные аккаунты с историей покупок</span></li>
        <li><i class="fas fa-check-circle"></i> <span data-ru="Естественное распределение по географии" data-am="Բնական աշխարհագրական բաշխում">Естественное распределение по географии</span></li>
      </ul>
      <div class="g-badge">
        <i class="fas fa-award"></i>
        <span data-ru="0 блокировок за всё время работы" data-am="0 արգելափակում աշխատանքի ողջ ընթացքում">0 блокировок за всё время работы</span>
      </div>
      <div class="section-cta" style="margin-top:24px">
        <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success"><i class="fas fa-rocket"></i> <span data-ru="Начать продвижение" data-am="Սկսել առաջխաղացումը">Начать продвижение</span></a>
      </div>
    </div>
  </div>
</div>
</section>

<!-- ===== COMPARISON ===== -->
<section class="section section-dark">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-balance-scale"></i> <span data-ru="Сравнение" data-am="Համեմատություն">Сравнение</span></div>
    <h2 class="section-title" data-ru="Go to Top vs Другие агентства" data-am="Go to Top vs Այլ գործակալություններ">Go to Top vs Другие агентства</h2>
  </div>
  <div class="fade-up" style="overflow-x:auto">
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
  </div>
  <div class="section-cta">
    <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-success"><i class="fas fa-rocket"></i> <span data-ru="Убедитесь сами — начните сейчас" data-am="Սկսել գնումները հիմա">Начать выкупы сейчас</span></a>
  </div>
</div>
</section>

<!-- ===== IMPORTANT NOTES ===== -->
<section class="section">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-info-circle"></i> <span data-ru="Важно знать" data-am="Կարևոր է իմանալ">Важно знать</span></div>
    <h2 class="section-title" data-ru="Условия работы" data-am="Աշխատանքի պայմաններ">Условия работы</h2>
  </div>
  <div class="services-grid fade-up">
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-percent"></i></div>
      <h3 data-ru="Лимит отзывов" data-am="Կարծիքների սահմանափակում">Лимит отзывов</h3>
      <p data-ru="Публикуем отзывы не более чем на 50% выкупленных товаров — для безопасности вашего кабинета." data-am="Կարծիքներ հրապարակում ենք գնված ապրանքների ոչ ավելի քան 50%-ի վրա — ձեր կաբինետի անվտանգության համար:">Публикуем отзывы не более чем на 50% выкупленных товаров — для безопасности вашего кабинета.</p>
    </div>
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-box-open"></i></div>
      <h3 data-ru="Крупногабаритный товар" data-am="Խոշորաչափ ապրանք">Крупногабаритный товар</h3>
      <p data-ru="Товар свыше 3 кг или одна сторона длиннее 55 см. Свыше 10 кг — стоимость индивидуально." data-am="Ապրանք 3 կգ-ից ավելի կամ մի կողմ 55 սմ-ից ավելի: 10 կգ-ից ավելի — արժեքը անհատական:">Товар свыше 3 кг или одна сторона длиннее 55 см. Свыше 10 кг — стоимость индивидуально.</p>
    </div>
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-box"></i></div>
      <h3 data-ru="Защитные пломбы" data-am="Պաշտպանիչ կապարաններ">Защитные пломбы</h3>
      <p data-ru="Товары с защитными пломбами или заводской упаковкой после фотосессии не восстанавливаются." data-am="Պաշտպանիչ կապարաններով կամ գործարանային փաթեթավորմամբ ապրանքները լուսանկարահանման հետո չեն վերականգնվում:">Товары с защитными пломбами или заводской упаковкой после фотосессии не восстанавливаются.</p>
    </div>
  </div>
  <div class="section-cta">
    <a href="https://t.me/suport_admin_2" target="_blank" class="btn btn-tg"><i class="fab fa-telegram"></i> <span data-ru="Уточнить условия" data-am="Գրել մենեջերին">Написать менеджеру</span></a>
  </div>
</div>
</section>

<!-- ===== FAQ ===== -->
<section class="section section-dark" id="faq">
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
      <div class="faq-a"><p data-ru="Только реальные люди. У нас собственный склад с устройствами и реальными аккаунтами. Каждый выкуп делается вручную, никаких ботов." data-am="Միայն իրական մարդիկ: Մենք ունենք սեփական պահեստ սարքերով և իրական հաշիվներով: Երբ գնում կատարվում է ձեռքով, ոչ մի բոտ:">Только реальные люди.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)"><span data-ru="Почему не все выкупы получают отзывы?" data-am="Ինչու ոչ բոլոր գնումներն են ստանում կարծիքներ։">Почему не все выкупы получают отзывы?</span><i class="fas fa-chevron-down"></i></div>
      <div class="faq-a"><p data-ru="Для безопасности вашего кабинета мы публикуем отзывы не более чем на 50% выкупленных товаров. Это имитирует естественное поведение покупателей." data-am="Ձեր կաբինետի անվտանգության համար կարծիքներ հրապարակում ենք գնված ապրանքների ոչ ավելի քան 50%-ի: Սա նմանակում է գնորդների բնական վարքագիցը:">Для безопасности вашего кабинета мы публикуем отзывы не более чем на 50% выкупленных товаров.</p></div>
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
<section class="section" id="contact">
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
      <div class="form-group"><label data-ru="Ваше имя" data-am="Ձեր անունը">Ваше имя</label><input type="text" id="formName" required placeholder="Имя / Անուն"></div>
      <div class="form-group"><label data-ru="Telegram / Телефон" data-am="Telegram / Հեռախոս">Telegram / Телефон</label><input type="text" id="formContact" required placeholder="@username / +374..."></div>
      <div class="form-group"><label data-ru="Что продаёте на WB?" data-am="Ինչ եք վաճառում WB-ում։">Что продаёте на WB?</label><input type="text" id="formProduct" placeholder="Одежда, электроника..."></div>
      <div class="form-group"><label data-ru="Какие услуги интересуют?" data-am="Ինչ ծառայություններ են հետաքրքրում։">Какие услуги интересуют?</label>
        <select id="formService">
          <option value="buyouts" data-ru="Выкупы" data-am="Գնումներ">Выкупы</option>
          <option value="reviews" data-ru="Отзывы" data-am="Կարծիքներ">Отзывы</option>
          <option value="photos" data-ru="Фотосессия" data-am="Լուսանկարահանում">Фотосессия</option>
          <option value="complex" data-ru="Комплекс услуг" data-am="Ծառայությունների փաթեթ" selected>Комплекс услуг</option>
        </select>
      </div>
      <div class="form-group"><label data-ru="Комментарий (необязательно)" data-am="Մեկնաբանություն (ոչ պարտադիր)">Комментарий (необязательно)</label><textarea id="formMessage" placeholder="Опишите ваш товар..."></textarea></div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center">
        <i class="fab fa-telegram"></i>
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
      <p data-ru="Безопасное продвижение товаров на Wildberries в Армении. Реальные выкупы живыми людьми с собственного склада в Ереване." data-am="Ապահով ապրանքների առաջխաղացում Wildberries-ում Հայաստանում: Իրական գնումներ իրական մարդկանցով սեփական պահեստից Երևանում:">Безопасное продвижение товаров на Wildberries в Армении. Реальные выкупы живыми людьми с собственного склада в Ереване.</p>
    </div>
    <div class="footer-col">
      <h4 data-ru="Навигация" data-am="Նավիգացիա">Навигация</h4>
      <ul>
        <li><a href="#services" data-ru="Услуги и цены" data-am="Ծառայություններ և գներ">Услуги и цены</a></li>
        <li><a href="#calculator" data-ru="Калькулятор" data-am="Հաշվիչ">Калькулятор</a></li>
        <li><a href="#warehouse" data-ru="Наш склад" data-am="Մեր պահեստը">Наш склад</a></li>
        <li><a href="#guarantee" data-ru="Гарантии" data-am="Երաշխիքներ">Гарантии</a></li>
        <li><a href="#faq" data-ru="FAQ" data-am="ՀՏՀ">FAQ</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4 data-ru="Контакты" data-am="Կոնտակտներ">Контакты</h4>
      <ul>
        <li><a href="https://t.me/goo_to_top" target="_blank"><i class="fab fa-telegram"></i> <span data-ru="Администратор" data-am="Ադմինիստրատոր">Администратор</span></a></li>
        <li><a href="https://t.me/suport_admin_2" target="_blank"><i class="fab fa-telegram"></i> <span data-ru="Менеджер" data-am="Մենեջեր">Менеджер</span></a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Go to Top. <span data-ru="Все права защищены" data-am="Բոլոր իրավունքները պաշտպանված են">Все права защищены</span></span>
    <span data-ru="Ереван, Армения" data-am="Երևան, Հայաստան">Ереван, Армения</span>
  </div>
</div>
</footer>

<!-- FLOATING TG BUTTON -->
<a href="https://t.me/goo_to_top" target="_blank" class="tg-float">
  <i class="fab fa-telegram"></i>
  <span data-ru="Написать нам" data-am="Գրել մեզ">Написать нам</span>
</a>

<!-- LIGHTBOX -->
<div class="lightbox" id="lightbox" onclick="closeLightbox()">
  <img id="lightboxImg" src="" alt="">
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
        <div class="pf-row">
          <div class="pf-group">
            <label class="pf-label" data-ru="Сколько выкупов нужно?" data-am="Քանի գնում է պետք։">Сколько выкупов нужно?</label>
            <input class="pf-input" type="number" id="popupBuyouts" min="0" placeholder="Напр: 20" required>
          </div>
          <div class="pf-group">
            <label class="pf-label" data-ru="Сколько отзывов нужно?" data-am="Քանի կարծիք է պետք։">Сколько отзывов нужно?</label>
            <input class="pf-input" type="number" id="popupReviews" min="0" placeholder="Напр: 10" required>
          </div>
        </div>
        <div class="pf-group">
          <label class="pf-label" data-ru="Ваш Telegram или телефон" data-am="Ձեր Telegram-ը կամ հեռախոսը">Ваш Telegram или телефон</label>
          <input class="pf-input" type="text" id="popupContact" required placeholder="@username или +374...">
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:12px">
          <i class="fab fa-telegram"></i>
          <span data-ru="Получить расчёт в Telegram" data-am="Ստանալ հաշվարկ Telegram-ով">Получить расчёт в Telegram</span>
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
/* ===== LANGUAGE ===== */
let lang = 'ru';
const AM = {
  "Услуги":"Ծառայություններ","Калькулятор":"Հաշվիչ","Склад":"Պահեստ","Гарантии":"Երաշխիքներ","FAQ":"ՀՏՀ","Контакты":"Կոնտակտներ","Написать нам":"Գրել մեզ",
  "Работаем в Армении":"Աշխատում ենք Հայաստանում","Выведեм ваш товар":"Կբարձրացնենք ձեր ապրանքը","в ТОП Wildberries":"Wildberries-ի TOP",
  "Рассчитать стоимость":"Հաշվել արժեքը"
};
function switchLang(l) {
  lang = l;
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === l));
  document.querySelectorAll('[data-' + l + ']').forEach(el => {
    const t = el.getAttribute('data-' + l);
    if (t && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') el.textContent = t;
  });
  document.documentElement.lang = l === 'am' ? 'hy' : 'ru';
}

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

document.querySelectorAll('.nav-links a').forEach(function(a) {
  a.addEventListener('click', function(e) {
    e.preventDefault();
    closeMenu();
    var href = this.getAttribute('href');
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
  document.getElementById('buyoutPriceLabel').textContent = v > 0 ? '֏' + price.toLocaleString('ru-RU') + '/шт' : '֏2 000';
  recalc();
}
function onBuyoutInput() {
  const inp = document.getElementById('buyoutQty');
  let v = parseInt(inp.value || 0);
  if (isNaN(v) || v < 0) v = 0; if (v > 999) v = 999;
  inp.value = v;
  const price = getBuyoutPrice(v);
  document.getElementById('buyoutPriceLabel').textContent = v > 0 ? '֏' + price.toLocaleString('ru-RU') + '/шт' : '֏2 000';
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
  if (buyoutQty > 0) { total += getBuyoutTotal(buyoutQty); items.push('Выкуп + забор: ' + buyoutQty + ' шт (' + getBuyoutPrice(buyoutQty) + '֏/шт)'); }
  document.querySelectorAll('.calc-row:not(#buyoutRow)').forEach(row => {
    const price = parseInt(row.dataset.price);
    const inp = row.querySelector('.calc-input input');
    const qty = parseInt(inp ? inp.value : 0);
    if (!isNaN(price) && qty > 0) { total += price * qty; items.push(row.querySelector('.calc-label').textContent + ': ' + qty); }
  });
  document.getElementById('calcTotal').textContent = '֏' + total.toLocaleString('ru-RU');
  const msg = 'Здравствуйте! Хочу заказать:\\n' + items.join('\\n') + '\\n\\nИтого: ֏' + total.toLocaleString('ru-RU');
  document.getElementById('calcTgBtn').href = 'https://t.me/goo_to_top?text=' + encodeURIComponent(msg);
}

/* ===== FAQ ===== */
function toggleFaq(el) {
  const item = el.closest('.faq-item');
  const was = item.classList.contains('active');
  document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
  if (!was) item.classList.add('active');
}

/* ===== LIGHTBOX ===== */
function openLightbox(el) { document.getElementById('lightboxImg').src = el.querySelector('img').src; document.getElementById('lightbox').classList.add('show'); }
function closeLightbox() { document.getElementById('lightbox').classList.remove('show'); }

/* ===== TIMED POPUP (5 sec) — ROBUST ===== */
var popupEl = document.getElementById('popupOverlay');
var popupDismissed = false;

function showPopup() {
  if (popupDismissed) return;
  if (sessionStorage.getItem('popupDone')) return;
  if (!popupEl) return;
  /* Force display and visibility for all browsers/screens */
  popupEl.style.display = 'flex';
  popupEl.style.visibility = 'visible';
  popupEl.style.opacity = '1';
  popupEl.classList.add('show');
  /* Ensure popup card is visible */
  var card = popupEl.querySelector('.popup-card');
  if (card) {
    card.style.opacity = '1';
    card.style.visibility = 'visible';
    card.style.transform = 'scale(1) translateY(0)';
  }
  document.body.style.overflow = 'hidden';
  console.log('Popup shown');
}

function hidePopup() {
  popupDismissed = true;
  popupEl.classList.remove('show');
  popupEl.style.display = 'none';
  popupEl.style.visibility = 'hidden';
  document.body.style.overflow = '';
  sessionStorage.setItem('popupDone', '1');
}

/* Close button */
document.getElementById('popupCloseBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  hidePopup();
});

/* Click overlay to close */
popupEl.addEventListener('click', function(e) {
  if (e.target === popupEl) hidePopup();
});

/* Show after 5 seconds */
setTimeout(showPopup, 5000);

/* Form submit */
document.getElementById('popupForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var buyouts = document.getElementById('popupBuyouts').value;
  var reviews = document.getElementById('popupReviews').value;
  var contact = document.getElementById('popupContact').value;
  fetch('/api/popup-lead', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({buyouts:buyouts, reviews:reviews, contact:contact, lang:lang, ts: new Date().toISOString()})
  }).catch(function(){});
  var msg = 'Заявка с сайта Go to Top:\\n\\nВыкупов: ' + buyouts + '\\nОтзывов: ' + reviews + '\\nКонтакт: ' + contact;
  window.open('https://t.me/suport_admin_2?text=' + encodeURIComponent(msg), '_blank');
  document.getElementById('popupFormWrap').style.display = 'none';
  document.getElementById('popupSuccess').style.display = 'block';
  setTimeout(hidePopup, 3000);
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
  var msg = 'Здравствуйте! Заявка с сайта Go to Top:\\n\\n';
  msg += 'Имя: ' + name + '\\nКонтакт: ' + contact + '\\n';
  if (product) msg += 'Товар: ' + product + '\\n';
  msg += 'Услуга: ' + serviceText + '\\n';
  if (message) msg += 'Комментарий: ' + message;
  fetch('/api/lead', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name:name, contact:contact, product:product, service: service.value, message:message, lang:lang, ts: new Date().toISOString()}) }).catch(function(){});
  window.open('https://t.me/suport_admin_2?text=' + encodeURIComponent(msg), '_blank');
  var btn = e.target.querySelector('button[type=submit]');
  var orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-check"></i> Отправлено!';
  btn.style.background = 'var(--success)';
  setTimeout(function() { btn.innerHTML = orig; btn.style.background = ''; }, 3000);
  e.target.reset();
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
</script>
</body>
</html>`)
})

export default app
