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
  const { buyouts, reviews, contact } = body

  // Send to Admin TG (8545134351)
  const adminBotMsg = `New lead from Go to Top:\nBuyouts: ${buyouts}\nReviews: ${reviews}\nContact: ${contact}`
  // Send to Manager TG (7974769968)
  const managerBotMsg = adminBotMsg

  console.log('Popup lead:', body)
  // Note: To actually send to Telegram, you need a bot token configured as a secret
  // For now we log and return success
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
<title>Go to Top — Продвижение на Wildberries | Առաջխաdelays Wildberries-ում</title>
<meta name="description" content="Go to Top — безопасное продвижение товаров на Wildberries в Армении. Реальные выкупы, живые люди, собственный склад в Ереване.">
<meta property="og:title" content="Go to Top — Продвижение на Wildberries">
<meta property="og:description" content="Реальные выкупы живыми людьми. Собственный склад в Ереване.">
<meta property="og:type" content="website">
<meta property="og:image" content="/static/img/logo.png">
<link rel="icon" type="image/png" href="/static/img/logo.png">
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

/* HEADER */
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

/* HERO */
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

/* TICKER */
.ticker{padding:20px 0;background:var(--bg-surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border);overflow:hidden}
.ticker-track{display:flex;animation:ticker 40s linear infinite;white-space:nowrap}
.ticker-item{display:flex;align-items:center;gap:10px;padding:0 40px;font-size:0.88rem;color:var(--text-sec);flex-shrink:0}
.ticker-item i{color:var(--purple)}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}

/* SECTIONS */
.section{padding:80px 0}
.section-dark{background:var(--bg-surface)}
.section-header{text-align:center;margin-bottom:56px}
.section-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:50px;font-size:0.78rem;font-weight:600;color:var(--accent);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px}
.section-title{font-size:2.2rem;font-weight:800;line-height:1.2;margin-bottom:16px;letter-spacing:-0.02em}
.section-sub{font-size:1rem;color:var(--text-sec);max-width:640px;margin:0 auto;line-height:1.7}

/* SERVICES */
.services-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;margin-bottom:40px}
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

/* PRICING TABLE */
.pricing-table{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-top:40px}
.pricing-table table{width:100%;border-collapse:collapse}
.pricing-table th{background:rgba(139,92,246,0.1);padding:14px 20px;text-align:left;font-weight:600;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.5px;color:var(--accent);border-bottom:1px solid var(--border)}
.pricing-table td{padding:12px 20px;border-bottom:1px solid var(--border);font-size:0.88rem;color:var(--text-sec)}
.pricing-table tr:last-child td{border-bottom:none}
.pricing-table tr:hover td{background:rgba(139,92,246,0.03)}
.pv{font-weight:700;color:var(--text)}
.pricing-note{margin-top:20px;padding:16px 24px;background:rgba(139,92,246,0.05);border:1px solid var(--border);border-radius:var(--r-sm);font-size:0.85rem;color:var(--text-sec);line-height:1.7}
.pricing-note i{color:var(--warning);margin-right:8px}

/* CALCULATOR */
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
.calc-input span{width:40px;text-align:center;font-weight:600;font-size:1rem}
.calc-total{display:flex;justify-content:space-between;align-items:center;padding:24px 0;margin-top:16px;border-top:2px solid var(--purple)}
.calc-total-label{font-size:1.1rem;font-weight:600}
.calc-total-value{font-size:1.8rem;font-weight:800;color:var(--purple)}
.calc-cta{margin-top:24px;text-align:center}
.buyout-tier-info{margin-top:8px;padding:12px 16px;background:rgba(139,92,246,0.05);border:1px solid var(--border);border-radius:var(--r-sm);font-size:0.82rem;color:var(--text-sec);line-height:1.6}
.buyout-tier-info strong{color:var(--accent)}

/* PROCESS */
.process-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;position:relative}
.step{text-align:center;position:relative}
.step-num{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.1rem;margin:0 auto 16px;position:relative;z-index:2}
.step-line{position:absolute;top:24px;left:50%;right:-50%;height:2px;background:var(--border);z-index:1}
.step:last-child .step-line{display:none}
.step h4{font-size:0.92rem;font-weight:600;margin-bottom:8px}
.step p{font-size:0.78rem;color:var(--text-muted);line-height:1.5}

/* WAREHOUSE */
.wh-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.wh-item{position:relative;border-radius:var(--r);overflow:hidden;border:1px solid var(--border);cursor:pointer;transition:var(--t)}
.wh-item:hover{transform:scale(1.02);border-color:rgba(139,92,246,0.3)}
.wh-item img{width:100%;height:250px;object-fit:cover;transition:var(--t)}
.wh-item:hover img{transform:scale(1.05)}
.wh-caption{position:absolute;bottom:0;left:0;right:0;padding:12px 16px;background:linear-gradient(transparent,rgba(0,0,0,0.8));font-size:0.85rem;font-weight:500}

/* GUARANTEE */
.guarantee-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.guarantee-card img{border-radius:var(--r);width:100%;height:400px;object-fit:cover;object-position:center top;border:1px solid var(--border)}
.guarantee-card h2{font-size:1.9rem;font-weight:800;margin-bottom:16px}
.guarantee-card>div p{color:var(--text-sec);margin-bottom:16px;line-height:1.8}
.g-list{list-style:none;margin:20px 0}
.g-list li{display:flex;align-items:flex-start;gap:12px;padding:8px 0;font-size:0.92rem}
.g-list li i{color:var(--success);margin-top:4px}
.g-badge{display:inline-flex;align-items:center;gap:10px;padding:12px 20px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:var(--r-sm);color:var(--success);font-weight:600;margin-top:16px}

/* COMPARISON */
.cmp-table{width:100%;border-collapse:collapse;background:var(--bg-card);border-radius:var(--r);overflow:hidden;border:1px solid var(--border)}
.cmp-table th{padding:16px 20px;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.5px;font-weight:600}
.cmp-table th:first-child{text-align:left;color:var(--text-muted)}
.cmp-table th:nth-child(2){background:rgba(139,92,246,0.1);color:var(--purple)}
.cmp-table th:nth-child(3){color:var(--text-muted)}
.cmp-table td{padding:14px 20px;border-top:1px solid var(--border);font-size:0.88rem;color:var(--text-sec)}
.cmp-table td:nth-child(2){background:rgba(139,92,246,0.03);font-weight:500;color:var(--text)}
.chk{color:var(--success)}.crs{color:var(--danger)}

/* FAQ */
.faq-list{max-width:800px;margin:0 auto}
.faq-item{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);margin-bottom:12px;overflow:hidden;transition:var(--t)}
.faq-item.active{border-color:rgba(139,92,246,0.3)}
.faq-q{padding:20px 24px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;font-weight:600;font-size:0.92rem}
.faq-q i{color:var(--purple);transition:var(--t);font-size:0.78rem}
.faq-item.active .faq-q i{transform:rotate(180deg)}
.faq-a{padding:0 24px;max-height:0;overflow:hidden;transition:max-height 0.4s ease,padding 0.4s ease}
.faq-item.active .faq-a{max-height:500px;padding:0 24px 20px}
.faq-a p{color:var(--text-sec);font-size:0.88rem;line-height:1.8}

/* FORM */
.form-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-lg);padding:48px;max-width:600px;margin:0 auto}
.form-group{margin-bottom:20px}
.form-group label{display:block;font-size:0.82rem;font-weight:600;margin-bottom:8px;color:var(--text-sec)}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:12px 16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--r-sm);color:var(--text);font-size:0.92rem;font-family:inherit;transition:var(--t)}
.form-group input:focus,.form-group textarea:focus,.form-group select:focus{outline:none;border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.15)}
.form-group textarea{resize:vertical;min-height:100px}
.form-group select option{background:var(--bg-card)}

/* CONTACT */
.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:600px;margin:0 auto 32px}
.contact-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:24px;text-align:center;transition:var(--t)}
.contact-card:hover{border-color:rgba(139,92,246,0.3);transform:translateY(-2px)}
.contact-card i.fab{font-size:2rem;color:var(--purple);margin-bottom:12px}
.contact-card h4{font-size:1rem;font-weight:600;margin-bottom:4px}
.contact-card p{font-size:0.82rem;color:var(--text-muted);line-height:1.5}

/* FOOTER */
.footer{padding:48px 0 24px;border-top:1px solid var(--border)}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px;margin-bottom:40px}
.footer-brand p{color:var(--text-muted);font-size:0.88rem;margin-top:12px;line-height:1.7}
.footer-col h4{font-size:0.82rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:16px}
.footer-col ul{list-style:none}
.footer-col li{margin-bottom:10px}
.footer-col a{color:var(--text-sec);font-size:0.88rem;transition:var(--t)}
.footer-col a:hover{color:var(--purple)}
.footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:24px;border-top:1px solid var(--border);font-size:0.78rem;color:var(--text-muted)}

/* FLOATING TG */
.tg-float{position:fixed;bottom:24px;right:24px;z-index:999;display:flex;align-items:center;gap:12px;padding:14px 24px;background:linear-gradient(135deg,var(--purple),var(--purple-deep));color:white;border-radius:50px;box-shadow:0 8px 30px rgba(139,92,246,0.4);transition:var(--t);font-weight:600;font-size:0.88rem}
.tg-float:hover{transform:translateY(-3px) scale(1.03);box-shadow:0 12px 40px rgba(139,92,246,0.5)}
.tg-float i{font-size:1.2rem}

/* LIGHTBOX */
.lightbox{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:9999;align-items:center;justify-content:center;padding:40px;cursor:pointer}
.lightbox.show{display:flex}
.lightbox img{max-width:90%;max-height:90vh;border-radius:var(--r);object-fit:contain}

/* TIMED POPUP (5 sec) */
.popup-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:10000;align-items:center;justify-content:center;padding:24px}
.popup-overlay.show{display:flex}
.popup-card{background:linear-gradient(145deg,#1E1535,#271B45);border:2px solid rgba(139,92,246,0.4);border-radius:var(--r-lg);padding:40px;text-align:center;max-width:480px;width:100%;position:relative;animation:popIn 0.4s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 0 60px rgba(139,92,246,0.3),0 20px 60px rgba(0,0,0,0.5)}
@keyframes popIn{from{transform:scale(0.8) translateY(20px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
.popup-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:1.4rem;cursor:pointer;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:var(--t)}
.popup-close:hover{background:rgba(239,68,68,0.3);color:#EF4444}
.popup-card h3{font-size:1.5rem;font-weight:800;margin-bottom:8px;background:linear-gradient(135deg,#fff,var(--accent-light));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.popup-card>p{color:var(--text-sec);margin-bottom:24px;font-size:0.92rem}
.popup-form .form-group{margin-bottom:14px;text-align:left}
.popup-form .form-group label{font-size:0.8rem;font-weight:600;color:var(--accent)}
.popup-form .form-group input{padding:12px 16px;font-size:0.9rem;background:rgba(15,10,26,0.6);border:1px solid rgba(139,92,246,0.25);border-radius:var(--r-sm);color:#fff;width:100%;font-family:inherit;transition:var(--t)}
.popup-form .form-group input:focus{outline:none;border-color:var(--purple);box-shadow:0 0 0 3px rgba(139,92,246,0.2)}
.popup-form .form-group input::placeholder{color:var(--text-muted)}
.popup-form .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.popup-success{display:none;text-align:center;padding:20px 0}
.popup-success i{font-size:3rem;color:var(--success);margin-bottom:12px}
.popup-success h4{font-size:1.2rem;margin-bottom:8px;color:#fff}
.popup-success p{color:var(--text-sec);font-size:0.88rem}

/* ANIMATIONS */
.fade-up{opacity:0;transform:translateY(30px);transition:opacity 0.7s ease,transform 0.7s ease}
.fade-up.visible{opacity:1;transform:translateY(0)}

/* RESPONSIVE */
@media(max-width:1024px){
  .hero h1{font-size:2.4rem}
  .hero-grid{grid-template-columns:1fr;gap:40px}
  .hero-image{max-width:500px}
  .process-grid{grid-template-columns:repeat(3,1fr)}
  .step:nth-child(n+4){margin-top:16px}
  .guarantee-card{grid-template-columns:1fr;gap:32px}
  .footer-grid{grid-template-columns:1fr 1fr}
}
@media(max-width:768px){
  .nav-links{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,10,26,0.98);flex-direction:column;justify-content:center;align-items:center;gap:32px;padding:20px;z-index:1001}
  .nav-links.active{display:flex}
  .nav-links a{font-size:1.2rem}
  .hamburger{display:flex}
  .nav-right .nav-cta{display:none}
  .hero{padding:110px 0 60px}
  .hero h1{font-size:1.9rem}
  .hero-stats{flex-wrap:wrap;gap:20px}
  .hero-buttons{flex-direction:column}
  .hero-image img{height:300px}
  .section-title{font-size:1.7rem}
  .services-grid{grid-template-columns:1fr}
  .wh-grid{grid-template-columns:1fr}
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
  .pricing-table{overflow-x:auto}
  .pricing-table table{min-width:500px}
  .tg-float span{display:none}
  .tg-float{padding:16px;border-radius:50%}
  .popup-form .form-row{grid-template-columns:1fr}
}
@media(max-width:480px){
  .hero h1{font-size:1.6rem}
  .section{padding:56px 0}
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
    <img src="/static/img/logo.png" alt="Go to Top">
    <span class="logo-text">Go to Top</span>
  </a>
  <ul class="nav-links" id="navLinks">
    <li><a href="#services" data-ru="Услуги" data-am="Ծառայություններ">Услуги</a></li>
    <li><a href="#calculator" data-ru="Калькулятор" data-am="Հաdelays">Калькулятор</a></li>
    <li><a href="#warehouse" data-ru="Склад" data-am="Պահեստ">Склад</a></li>
    <li><a href="#guarantee" data-ru="Гарантии" data-am="Երdelays">Гарантии</a></li>
    <li><a href="#faq" data-ru="FAQ" data-am="ՀՏdelays">FAQ</a></li>
    <li><a href="#contact" data-ru="Контакты" data-am="Կdelays">Контакты</a></li>
  </ul>
  <div class="nav-right">
    <div class="lang-switch">
      <button class="lang-btn active" data-lang="ru" onclick="switchLang('ru')">RU</button>
      <button class="lang-btn" data-lang="am" onclick="switchLang('am')">AM</button>
    </div>
    <a href="https://t.me/goo_to_top" target="_blank" class="nav-cta">
      <i class="fab fa-telegram"></i>
      <span data-ru="Написать нам" data-am="Գrelays">Написать нам</span>
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
      <span data-ru="Работаем в Армении" data-am="Աdelays">Работаем в Армении</span>
    </div>
    <h1>
      <span data-ru="Выведем ваш товар" data-am="Ձdelays">Выведем ваш товар</span><br>
      <span class="gr" data-ru="в ТОП Wildberries" data-am="Wildberries-ի ТОdelays">в ТОП Wildberries</span>
    </h1>
    <p class="hero-desc" data-ru="Реальные выкупы живыми людьми быстро и надолго закрепляют позицию в топе, разные ПВЗ по всему Еревану, забор товара с ПВЗ и хранение в собственном складе в Ереване." data-am="Իdelays">
      Реальные выкупы живыми людьми быстро и надолго закрепляют позицию в топе, разные ПВЗ по всему Еревану, забор товара с ПВЗ и хранение в собственном складе в Ереване.
    </p>
    <div class="hero-stats">
      <div class="stat"><div class="stat-num" data-count="847">0</div><div class="stat-label" data-ru="товаров в ТОП" data-am="ապdelays">товаров в ТОП</div></div>
      <div class="stat"><div class="stat-num" data-count="0">0</div><div class="stat-label" data-ru="блокировок" data-am="delaysdelays">блокировок</div></div>
      <div class="stat"><div class="stat-num" data-count="1000">0</div><div class="stat-label" data-ru="аккаунтов" data-am="delaysdelays">аккаунтов</div></div>
    </div>
    <div class="hero-buttons">
      <a href="https://t.me/goo_to_top" target="_blank" class="btn btn-primary btn-lg">
        <i class="fab fa-telegram"></i>
        <span data-ru="Написать в Telegram" data-am="Գdelays Telegram-delays">Написать в Telegram</span>
      </a>
      <a href="#calculator" class="btn btn-outline btn-lg">
        <i class="fas fa-calculator"></i>
        <span data-ru="Рассчитать стоимость" data-am="Հdelays">Рассчитать стоимость</span>
      </a>
    </div>
  </div>
  <div class="hero-image">
    <img src="/static/img/founder.jpg" alt="Go to Top — основатель">
    <div class="hero-badge-img">
      <i class="fas fa-shield-alt"></i>
      <span data-ru="Собственный склад в Ереване" data-am="Սdelays">Собственный склад в Ереване</span>
    </div>
  </div>
</div>
</div>
</section>

<!-- ===== TICKER ===== -->
<div class="ticker">
<div class="ticker-track" id="tickerTrack"></div>
</div>

<!-- ===== SERVICES ===== -->
<section class="section" id="services">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-rocket"></i> <span data-ru="Наши услуги" data-am="Մdelays">Наши услуги</span></div>
    <h2 class="section-title" data-ru="Полный спектр продвижения на WB" data-am="WB-delays">Полный спектр продвижения на WB</h2>
    <p class="section-sub" data-ru="Выкупы живыми людьми, отзывы с реальными фото, профессиональные фотосессии — всё для вашего товара" data-am="Գdelays">Выкупы живыми людьми, отзывы с реальными фото, профессиональные фотосессии — всё для вашего товара</p>
  </div>
  <div class="services-grid">
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-shopping-cart"></i></div>
      <h3 data-ru="Выкупы по ключевым запросам" data-am="Գdelays">Выкупы по ключевым запросам</h3>
      <p data-ru="Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану." data-am="Ձdelays">Ваш товар выкупается реальными людьми с реальных аккаунтов в разные ПВЗ по всему Еревану.</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Реальные аккаунты с историей покупок" data-am="Իdelays">Реальные аккаунты с историей покупок</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Географическое распределение" data-am="Աdelays">Географическое распределение</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Естественное поведение покupателей" data-am="Գdelays">Естественное поведение покупателей</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Забор товара из ПВЗ" data-am="Ապdelays">Забор товара из ПВЗ</span></li>
      </ul>
    </div>
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-star"></i></div>
      <h3 data-ru="Отзывы и оценки" data-am="Կdelays">Отзывы и оценки</h3>
      <p data-ru="Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга." data-am="Մdelays">Развёрнутые отзывы с фото и видео от реальных аккаунтов для повышения рейтинга.</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Текст отзыва + фото/видео" data-am="Կdelays">Текст отзыва + фото/видео</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Профессиональная фотосессия" data-am="Պdelays">Профессиональная фотосессия</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Разные локации и модели" data-am="Տdelays">Разные локации и модели</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="До 50% отзывов от выкупов" data-am="Գdelays">До 50% отзывов от выкупов</span></li>
      </ul>
    </div>
    <div class="svc-card fade-up">
      <div class="svc-icon"><i class="fas fa-camera"></i></div>
      <h3 data-ru="Фото и видеосъёмка" data-am="Լdelays">Фото и видеосъёмка</h3>
      <p data-ru="Профессиональная съёмка товаров с моделями для карточек WB и отзывов." data-am=" Delays">Профессиональная съёмка товаров с моделями для карточек WB и отзывов.</p>
      <ul class="svc-features">
        <li><i class="fas fa-check"></i> <span data-ru="Женские и мужские модели" data-am="Կdelays">Женские и мужские модели</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Предметная съёмка" data-am="Առdelays">Предметная съёмка</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Видеообзоры товаров" data-am=" Delays">Видеообзоры товаров</span></li>
        <li><i class="fas fa-check"></i> <span data-ru="Ребёнок модель (до 14 лет)" data-am="Ecraft">Ребёнок модель (до 14 лет)</span></li>
      </ul>
    </div>
  </div>


</div>
</section>

<!-- ===== CALCULATOR ===== -->
<section class="section section-dark" id="calculator">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-calculator"></i> <span data-ru="Калькулятор" data-am="Հdelays">Калькулятор</span></div>
    <h2 class="section-title" data-ru="Рассчитайте стоимость услуг" data-am="Delaysdelays">Рассчитайте стоимость услуг</h2>
    <p class="section-sub" data-ru="Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram." data-am="Delaysdelays">Выберите нужные услуги, укажите количество и узнайте сумму. Заказ оформляется в Telegram.</p>
  </div>
  <div class="calc-wrap fade-up">
    <!-- CALC TABS -->
    <div class="calc-tabs">
      <div class="calc-tab active" onclick="showCalcTab('buyouts',this)" data-ru="Выкупы" data-am="Գdelays">Выкупы</div>
      <div class="calc-tab" onclick="showCalcTab('reviews',this)" data-ru="Отзывы" data-am="Delaysdelays">Отзывы</div>
      <div class="calc-tab" onclick="showCalcTab('photo',this)" data-ru="Фотосъёмка" data-am="Delaysdelays">Фотосъёмка</div>
      <div class="calc-tab" onclick="showCalcTab('logistics',this)" data-ru="Логистика" data-am="Delaysdelays">Логистика</div>
    </div>

    <!-- BUYOUTS GROUP — tiered pricing -->
    <div class="calc-group active" id="cg-buyouts">
      <div class="calc-row" data-price="buyout" id="buyoutRow">
        <div class="calc-label" data-ru="Выкуп + забор из ПВЗ" data-am="Delaysdelays">Выкуп + забор из ПВЗ</div>
        <div class="calc-price" id="buyoutPriceLabel">֏2 000</div>
        <div class="calc-input"><button onclick="ccBuyout(-1)">−</button><span id="buyoutQty">0</span><button onclick="ccBuyout(1)">+</button></div>
      </div>
      <div class="buyout-tier-info">
        <strong data-ru="Чем больше выкупов — тем дешевле:" data-am="Delaysdelays">Чем больше выкупов — тем дешевле:</strong><br>
        1-20 шт → ֏2 000 &nbsp;|&nbsp; 21-40 шт → ֏1 700 &nbsp;|&nbsp; 41-60 шт → ֏1 500 &nbsp;|&nbsp; 60+ шт → ֏1 250
      </div>
      <div class="calc-row" data-price="100">
        <div class="calc-label" data-ru="Подписка на бренд / страницу" data-am="Delaysdelays">Подписка на бренд / страницу</div>
        <div class="calc-price">֏100</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- REVIEWS GROUP -->
    <div class="calc-group" id="cg-reviews">
      <div class="calc-row" data-price="300">
        <div class="calc-label" data-ru="Оценка" data-am="Գdelays">Оценка</div>
        <div class="calc-price">֏300</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="500">
        <div class="calc-label" data-ru="Оценка + отзыв" data-am="Delaysdelays">Оценка + отзыв</div>
        <div class="calc-price">֏500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="500">
        <div class="calc-label" data-ru="Вопрос к товару" data-am="Delaysdelays">Вопрос к товару</div>
        <div class="calc-price">֏500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="250">
        <div class="calc-label" data-ru="Написание текста отзыва" data-am="Delaysdelays">Написание текста отзыва</div>
        <div class="calc-price">֏250</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- PHOTO GROUP -->
    <div class="calc-group" id="cg-photo">
      <div class="calc-row" data-price="3500">
        <div class="calc-label" data-ru="Фотосессия в гардеробной WB (жен. модель)" data-am="Delaysdelays">Фотосессия в гардеробной WB (жен. модель)</div>
        <div class="calc-price">֏3 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="4500">
        <div class="calc-label" data-ru="Фотосессия в гардеробной WB (муж. модель)" data-am="Delaysdelays">Фотосессия в гардеробной WB (муж. модель)</div>
        <div class="calc-price">֏4 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Предметная фотосъёмка (3 фото)" data-am="Delaysdelays">Предметная фотосъёмка (3 фото)</div>
        <div class="calc-price">֏2 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="5000">
        <div class="calc-label" data-ru="Предметная съёмка (крупное / техника, 3 фото)" data-am="Delaysdelays">Предметная съёмка (крупное / техника, 3 фото)</div>
        <div class="calc-price">֏5 000</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Ребёнок модель (до 14 лет)" data-am="Delaysdelays">Ребёнок модель (до 14 лет)</div>
        <div class="calc-price">֏2 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="7000">
        <div class="calc-label" data-ru="Видеообзор товара" data-am="Delaysdelays">Видеообзор товара</div>
        <div class="calc-price">֏7 000</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <!-- LOGISTICS GROUP -->
    <div class="calc-group" id="cg-logistics">
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Глажка одежды (одиночная вещь)" data-am="Delaysdelays">Глажка одежды (одиночная вещь)</div>
        <div class="calc-price">֏1 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2500">
        <div class="calc-label" data-ru="Глажка одежды (верхняя одежда)" data-am="Delaysdelays">Глажка одежды (верхняя одежда)</div>
        <div class="calc-price">֏2 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Забор из ПВЗ для съёмки" data-am="Delaysdelays">Забор из ПВЗ для съёмки</div>
        <div class="calc-price">֏1 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="1500">
        <div class="calc-label" data-ru="Возврат в ПВЗ после съёмки" data-am="Delaysdelays">Возврат в ПВЗ после съёмки</div>
        <div class="calc-price">֏1 500</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="100">
        <div class="calc-label" data-ru="Замена штрихкода" data-am="Delaysdelays">Замена штрихкода</div>
        <div class="calc-price">֏100</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="200">
        <div class="calc-label" data-ru="Переупаковка (наша)" data-am="Delaysdelays">Переупаковка (наша)</div>
        <div class="calc-price">֏200</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="150">
        <div class="calc-label" data-ru="Переупаковка (клиента)" data-am="Delaysdelays">Переупаковка (клиента)</div>
        <div class="calc-price">֏150</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
      <div class="calc-row" data-price="2000">
        <div class="calc-label" data-ru="Доставка на склад WB (коробка)" data-am="Delaysdelays">Доставка на склад WB (коробка)</div>
        <div class="calc-price">֏2 000</div>
        <div class="calc-input"><button onclick="cc(this,-1)">−</button><span>0</span><button onclick="cc(this,1)">+</button></div>
      </div>
    </div>

    <div class="calc-total">
      <div class="calc-total-label" data-ru="Итого:" data-am="Ընdelays:">Итого:</div>
      <div class="calc-total-value" id="calcTotal">֏0</div>
    </div>
    <div class="calc-cta">
      <a href="https://t.me/goo_to_top" id="calcTgBtn" class="btn btn-primary btn-lg" target="_blank">
        <i class="fab fa-telegram"></i>
        <span data-ru="Заказать в Telegram" data-am="Delaysdelays">Заказать в Telegram</span>
      </a>
    </div>
  </div>
</div>
</section>

<!-- ===== PROCESS ===== -->
<section class="section" id="process">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-route"></i> <span data-ru="Как мы работаем" data-am="Delaysdelays">Как мы работаем</span></div>
    <h2 class="section-title" data-ru="5 шагов от заявки до ТОПа" data-am="Delaysdelays">5 шагов от заявки до ТОПа</h2>
  </div>
  <div class="process-grid fade-up">
    <div class="step">
      <div class="step-line"></div>
      <div class="step-num">1</div>
      <h4 data-ru="Заявка" data-am="Delaysdelays">Заявка</h4>
      <p data-ru="Пишете в Telegram и описываете товар" data-am="Delaysdelays">Пишете в Telegram и описываете товар</p>
    </div>
    <div class="step">
      <div class="step-line"></div>
      <div class="step-num">2</div>
      <h4 data-ru="Анализ" data-am="Delaysdelays">Анализ</h4>
      <p data-ru="Анализируем нишу и создаём стратегию" data-am="Delaysdelays">Анализируем нишу и создаём стратегию</p>
    </div>
    <div class="step">
      <div class="step-line"></div>
      <div class="step-num">3</div>
      <h4 data-ru="Запуск" data-am="Delaysdelays">Запуск</h4>
      <p data-ru="Начинаем выкупы в течение 24 часов" data-am="Delaysdelays">Начинаем выкупы в течение 24 часов</p>
    </div>
    <div class="step">
      <div class="step-line"></div>
      <div class="step-num">4</div>
      <h4 data-ru="Контроль" data-am="Delaysdelays">Контроль</h4>
      <p data-ru="Ежедневные отчёты о прогрессе" data-am="Delaysdelays">Ежедневные отчёты о прогрессе</p>
    </div>
    <div class="step">
      <div class="step-num">5</div>
      <h4 data-ru="Результат" data-am="Delaysdelays">Результат</h4>
      <p data-ru="Ваш товар в ТОПе выдачи WB" data-am="Delaysdelays">Ваш товар в ТОПе выдачи WB</p>
    </div>
  </div>
</div>
</section>

<!-- ===== WAREHOUSE ===== -->
<section class="section section-dark" id="warehouse">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-warehouse"></i> <span data-ru="Наш склад" data-am="Delaysdelays">Наш склад</span></div>
    <h2 class="section-title" data-ru="Всё организовано и по полочкам" data-am="Delaysdelays">Всё организовано и по полочкам</h2>
    <p class="section-sub" data-ru="Собственный склад в Ереване. Забор ваших товаров с ПВЗ. Надежное хранение товара. Отгрузка Ваших товаров на склад WB СЦ Ереван" data-am="Delaysdelays">Собственный склад в Ереване. Забор ваших товаров с ПВЗ. Надежное хранение товара. Отгрузка Ваших товаров на склад WB СЦ Ереван</p>
  </div>
  <div class="wh-grid fade-up">
    <div class="wh-item" onclick="openLightbox(this)">
      <img src="/static/img/warehouse1.jpg" alt="Организованное хранение товаров">
      <div class="wh-caption" data-ru="Организованное хранение" data-am="Delaysdelays">Организованное хранение</div>
    </div>
    <div class="wh-item" onclick="openLightbox(this)">
      <img src="/static/img/warehouse2.jpg" alt="Склад с товарами">
      <div class="wh-caption" data-ru="Система учёта" data-am="Delaysdelays">Система учёта</div>
    </div>
    <div class="wh-item" onclick="openLightbox(this)">
      <img src="/static/img/team.jpg" alt="Команда Go to Top">
      <div class="wh-caption" data-ru="Наша команда" data-am="Delaysdelays">Наша команда</div>
    </div>
  </div>
</div>
</section>

<!-- ===== GUARANTEE ===== -->
<section class="section" id="guarantee">
<div class="container">
  <div class="guarantee-card fade-up">
    <div>
      <img src="/static/img/founder.jpg" alt="Go to Top — команда профессионалов">
    </div>
    <div>
      <div class="section-badge"><i class="fas fa-shield-alt"></i> <span data-ru="Гарантия безопасности" data-am="Delaysdelays">Гарантия безопасности</span></div>
      <h2 data-ru="Команда профессионалов на вашей стороне" data-am="Delaysdelays">Команда профессионалов на вашей стороне</h2>
      <p data-ru="За всё время работы ни один кабинет клиента не получил блокировку. Каждый проект ведётся опытной командой с полным контролем на каждом этапе." data-am="Delaysdelays">За всё время работы ни один кабинет клиента не получил блокировку. Каждый проект ведётся опытной командой с полным контролем на каждом этапе.</p>
      <ul class="g-list">
        <li><i class="fas fa-check-circle"></i> <span data-ru="Реальные товары с собственного склада" data-am="Delaysdelays">Реальные товары с собственного склада</span></li>
        <li><i class="fas fa-check-circle"></i> <span data-ru="Реальные аккаунты с историей покупок" data-am="Delaysdelays">Реальные аккаунты с историей покупок</span></li>
        <li><i class="fas fa-check-circle"></i> <span data-ru="Естественное распределение по географии" data-am="Delaysdelays">Естественное распределение по географии</span></li>
      </ul>
      <div class="g-badge">
        <i class="fas fa-award"></i>
        <span data-ru="0 блокировок за всё время работы" data-am="Delaysdelays">0 блокировок за всё время работы</span>
      </div>
    </div>
  </div>
</div>
</section>

<!-- ===== COMPARISON ===== -->
<section class="section section-dark">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-balance-scale"></i> <span data-ru="Сравнение" data-am="Delaysdelays">Сравнение</span></div>
    <h2 class="section-title" data-ru="Go to Top vs Другие агентства" data-am="Delaysdelays">Go to Top vs Другие агентства</h2>
  </div>
  <div class="fade-up" style="overflow-x:auto">
  <table class="cmp-table">
    <thead><tr>
      <th data-ru="Критерий" data-am="Delaysdelays">Критерий</th>
      <th>Go to Top</th>
      <th data-ru="Другие" data-am="Delaysdelays">Другие</th>
    </tr></thead>
    <tbody>
      <tr>
        <td data-ru="Реальные люди" data-am="Delaysdelays">Реальные люди</td>
        <td><i class="fas fa-check-circle chk"></i> <span data-ru="Да" data-am="Delaysdelays">Да</span></td>
        <td><i class="fas fa-times-circle crs"></i> <span data-ru="Часто боты" data-am="Delaysdelays">Часто боты</span></td>
      </tr>
      <tr>
        <td data-ru="Собственный склад" data-am="Delaysdelays">Собственный склад</td>
        <td><i class="fas fa-check-circle chk"></i> <span data-ru="Ереван" data-am="Delaysdelays">Ереван</span></td>
        <td><i class="fas fa-times-circle crs"></i> <span data-ru="Нет" data-am="Delaysdelays">Нет</span></td>
      </tr>
      <tr>
        <td data-ru="Блокировки" data-am="Delaysdelays">Блокировки</td>
        <td><i class="fas fa-check-circle chk"></i> 0</td>
        <td><i class="fas fa-times-circle crs"></i> <span data-ru="Бывают" data-am="Delaysdelays">Бывают</span></td>
      </tr>
      <tr>
        <td data-ru="Фотосессия товаров" data-am="Delaysdelays">Фотосессия товаров</td>
        <td><i class="fas fa-check-circle chk"></i> <span data-ru="Свои модели" data-am="Delaysdelays">Свои модели</span></td>
        <td><i class="fas fa-times-circle crs"></i> <span data-ru="Нет" data-am="Delaysdelays">Нет</span></td>
      </tr>
      <tr>
        <td data-ru="Прозрачная отчётность" data-am="Delaysdelays">Прозрачная отчётность</td>
        <td><i class="fas fa-check-circle chk"></i> <span data-ru="Ежедневно" data-am="Delaysdelays">Ежедневно</span></td>
        <td><i class="fas fa-times-circle crs"></i> <span data-ru="Раз в неделю" data-am="Delaysdelays">Раз в неделю</span></td>
      </tr>
    </tbody>
  </table>
  </div>
</div>
</section>

<!-- ===== IMPORTANT NOTES ===== -->
<section class="section">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-info-circle"></i> <span data-ru="Важно знать" data-am="Delaysdelays">Важно знать</span></div>
    <h2 class="section-title" data-ru="Условия работы" data-am="Delaysdelays">Условия работы</h2>
  </div>
  <div class="services-grid fade-up">
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-percent"></i></div>
      <h3 data-ru="Лимит отзывов" data-am="Delaysdelays">Лимит отзывов</h3>
      <p data-ru="Публикуем отзывы не более чем на 50% выкупленных товаров — для безопасности вашего кабинета." data-am="Delaysdelays">Публикуем отзывы не более чем на 50% выкупленных товаров — для безопасности вашего кабинета.</p>
    </div>
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-box-open"></i></div>
      <h3 data-ru="Крупногабаритный товар" data-am="Delaysdelays">Крупногабаритный товар</h3>
      <p data-ru="Товар свыше 3 кг или одна сторона длиннее 55 см. Свыше 10 кг — стоимость индивидуально." data-am="Delaysdelays">Товар свыше 3 кг или одна сторона длиннее 55 см. Свыше 10 кг — стоимость индивидуально.</p>
    </div>
    <div class="svc-card">
      <div class="svc-icon"><i class="fas fa-box"></i></div>
      <h3 data-ru="Защитные пломбы" data-am="Delaysdelays">Защитные пломбы</h3>
      <p data-ru="Товары с защитными пломбами или заводской упаковкой после фотосессии не восстанавливаются." data-am="Delaysdelays">Товары с защитными пломбами или заводской упаковкой после фотосессии не восстанавливаются.</p>
    </div>
  </div>
</div>
</section>

<!-- ===== FAQ ===== -->
<section class="section section-dark" id="faq">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-question-circle"></i> <span data-ru="FAQ" data-am="ՀՏdelays">FAQ</span></div>
    <h2 class="section-title" data-ru="Частые вопросы" data-am="Delaysdelays">Частые вопросы</h2>
  </div>
  <div class="faq-list fade-up">
    <div class="faq-item active">
      <div class="faq-q" onclick="toggleFaq(this)">
        <span data-ru="Могут ли заблокировать мой кабинет?" data-am="Delaysdelays">Могут ли заблокировать мой кабинет?</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="faq-a"><p data-ru="За всё время нашей работы ни один кабинет клиента не получил блокировку. Мы используем реальные аккаунты с историей покупок, собственный склад и естественное распределение по географии." data-am="Delaysdelays">За всё время нашей работы ни один кабинет клиента не получил блокировку. Мы используем реальные аккаунты с историей покупок, собственный склад и естественное распределение по географии.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)">
        <span data-ru="Как быстро начнётся продвижение?" data-am="Delaysdelays">Как быстро начнётся продвижение?</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="faq-a"><p data-ru="В течение 24 часов после согласования стратегии и оплаты. Пишете нам → анализируем нишу → согласовываем план → запускаем выкупы." data-am="Delaysdelays">В течение 24 часов после согласования стратегии и оплаты. Пишете нам → анализируем нишу → согласовываем план → запускаем выкупы.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)">
        <span data-ru="Выкупы делают реальные люди или боты?" data-am="Delaysdelays">Выкупы делают реальные люди или боты?</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="faq-a"><p data-ru="Только реальные люди. У нас собственный склад с устройствами и реальными аккаунтами. Каждый выкуп делается вручную, никаких ботов." data-am="Delaysdelays">Только реальные люди. У нас собственный склад с устройствами и реальными аккаунтами. Каждый выкуп делается вручную, никаких ботов.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)">
        <span data-ru="Почему не все выкупы получают отзывы?" data-am="Delaysdelays">Почему не все выкупы получают отзывы?</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="faq-a"><p data-ru="Для безопасности вашего кабинета мы публикуем отзывы не более чем на 50% выкупленных товаров. Это имитирует естественное поведение покупателей." data-am="Delaysdelays">Для безопасности вашего кабинета мы публикуем отзывы не более чем на 50% выкупленных товаров. Это имитирует естественное поведение покупателей.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)">
        <span data-ru="Можно ли заказать только отзывы без выкупов?" data-am="Delaysdelays">Можно ли заказать только отзывы без выкупов?</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="faq-a"><p data-ru="Да, мы можем выкупить товар для фото/видео отзыва и затем сделать возврат на ПВЗ. Стоимость уточняйте у менеджера." data-am="Delaysdelays">Да, мы можем выкупить товар для фото/видео отзыва и затем сделать возврат на ПВЗ. Стоимость уточняйте у менеджера.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)">
        <span data-ru="Какие отчёты мы получаем?" data-am="Delaysdelays">Какие отчёты мы получаем?</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="faq-a"><p data-ru="Ежедневные отчёты: статус каждого выкупа, даты забора, статус отзывов. Полная прозрачность на каждом этапе." data-am="Delaysdelays">Ежедневные отчёты: статус каждого выкупа, даты забора, статус отзывов. Полная прозрачность на каждом этапе.</p></div>
    </div>
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)">
        <span data-ru="В какой валюте идут цены?" data-am="Delaysdelays">В какой валюте идут цены?</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="faq-a"><p data-ru="Все цены указаны в армянских драмах (֏ AMD). Оплата в драмах." data-am="Delaysdelays">Все цены указаны в армянских драмах (֏ AMD). Оплата в драмах.</p></div>
    </div>
  </div>
</div>
</section>

<!-- ===== CONTACT FORM ===== -->
<section class="section" id="contact">
<div class="container">
  <div class="section-header fade-up">
    <div class="section-badge"><i class="fas fa-paper-plane"></i> <span data-ru="Связаться с нами" data-am="Delaysdelays">Связаться с нами</span></div>
    <h2 class="section-title" data-ru="Готовы начать продвижение?" data-am="Delaysdelays">Готовы начать продвижение?</h2>
    <p class="section-sub" data-ru="Напишите нам в Telegram или оставьте заявку" data-am="Delaysdelays">Напишите нам в Telegram или оставьте заявку</p>
  </div>

  <div class="contact-grid fade-up">
    <a href="https://t.me/goo_to_top" target="_blank" class="contact-card">
      <i class="fab fa-telegram"></i>
      <h4 data-ru="Администратор" data-am="Delaysdelays">Администратор</h4>
      <p data-ru="Готов оплатить и приступить к продвижению? Пишите сюда." data-am="Delaysdelays">Готов оплатить и приступить к продвижению? Пишите сюда.</p>
    </a>
    <a href="https://t.me/suport_admin_2" target="_blank" class="contact-card">
      <i class="fab fa-telegram"></i>
      <h4 data-ru="Менеджер" data-am="Delaysdelays">Менеджер</h4>
      <p data-ru="Остались вопросы? Нужен детальный расчёт? Пишите сюда." data-am="Delaysdelays">Остались вопросы? Нужен детальный расчёт? Пишите сюда.</p>
    </a>
  </div>

  <div class="form-card fade-up">
    <form id="leadForm" onsubmit="submitForm(event)">
      <div class="form-group">
        <label data-ru="Ваше имя" data-am="Delaysdelays">Ваше имя</label>
        <input type="text" id="formName" required placeholder="Имя / Անուն">
      </div>
      <div class="form-group">
        <label data-ru="Telegram / Телефон" data-am="Delaysdelays">Telegram / Телефон</label>
        <input type="text" id="formContact" required placeholder="@username / +374...">
      </div>
      <div class="form-group">
        <label data-ru="Что продаёте на WB?" data-am="Delaysdelays">Что продаёте на WB?</label>
        <input type="text" id="formProduct" placeholder="Одежда, электроника... / Հdelays, delaysdelays...">
      </div>
      <div class="form-group">
        <label data-ru="Какие услуги интересуют?" data-am="Delaysdelays">Какие услуги интересуют?</label>
        <select id="formService">
          <option value="buyouts" data-ru="Выкупы" data-am="Delaysdelays">Выкупы</option>
          <option value="reviews" data-ru="Отзывы" data-am="Delaysdelays">Отзывы</option>
          <option value="photos" data-ru="Фотосессия" data-am="Delaysdelays">Фотосессия</option>
          <option value="complex" data-ru="Комплекс услуг" data-am="Delaysdelays" selected>Комплекс услуг</option>
        </select>
      </div>
      <div class="form-group">
        <label data-ru="Комментарий (необязательно)" data-am="Delaysdelays">Комментарий (необязательно)</label>
        <textarea id="formMessage" placeholder="Опишите ваш товар... / Նdelaysdelays..."></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center">
        <i class="fab fa-telegram"></i>
        <span data-ru="Отправить заявку" data-am="Delaysdelays">Отправить заявку</span>
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
      <div class="logo">
        <img src="/static/img/logo.png" alt="Go to Top" style="height:44px">
        <span class="logo-text">Go to Top</span>
      </div>
      <p data-ru="Безопасное продвижение товаров на Wildberries в Армении. Реальные выкупы живыми людьми с собственного склада в Ереване." data-am="Delaysdelays">Безопасное продвижение товаров на Wildberries в Армении. Реальные выкупы живыми людьми с собственного склада в Ереване.</p>
    </div>
    <div class="footer-col">
      <h4 data-ru="Навигация" data-am="Delaysdelays">Навигация</h4>
      <ul>
        <li><a href="#services" data-ru="Услуги и цены" data-am="Delaysdelays">Услуги и цены</a></li>
        <li><a href="#calculator" data-ru="Калькулятор" data-am="Delaysdelays">Калькулятор</a></li>
        <li><a href="#warehouse" data-ru="Наш склад" data-am="Delaysdelays">Наш склад</a></li>
        <li><a href="#guarantee" data-ru="Гарантии" data-am="Delaysdelays">Гарантии</a></li>
        <li><a href="#faq" data-ru="FAQ" data-am="Delaysdelays">FAQ</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4 data-ru="Контакты" data-am="Delaysdelays">Контакты</h4>
      <ul>
        <li><a href="https://t.me/goo_to_top" target="_blank"><i class="fab fa-telegram"></i> <span data-ru="Администратор" data-am="Delaysdelays">Администратор</span></a></li>
        <li><a href="https://t.me/suport_admin_2" target="_blank"><i class="fab fa-telegram"></i> <span data-ru="Менеджер" data-am="Delaysdelays">Менеджер</span></a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Go to Top. <span data-ru="Все права защищены" data-am="Delaysdelays">Все права защищены</span></span>
    <span data-ru="Ереван, Армения" data-am="Delaysdelays">Ереван, Армения</span>
  </div>
</div>
</footer>

<!-- FLOATING TG BUTTON -->
<a href="https://t.me/goo_to_top" target="_blank" class="tg-float">
  <i class="fab fa-telegram"></i>
  <span data-ru="Написать нам" data-am="Delaysdelays">Написать нам</span>
</a>

<!-- LIGHTBOX -->
<div class="lightbox" id="lightbox" onclick="closeLightbox()">
  <img id="lightboxImg" src="" alt="">
</div>

<!-- TIMED POPUP (5 sec) -->
<div class="popup-overlay" id="timedPopup">
  <div class="popup-card">
    <button class="popup-close" onclick="closeTimedPopup()">&times;</button>
    <div id="popupFormWrap">
      <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--purple),var(--purple-deep));display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:1.6rem;color:white"><i class="fas fa-calculator"></i></div>
      <h3 data-ru="Получите бесплатный расчёт!" data-am="Ստացեք անվճար հաշվարկ!">Получите бесплатный расчёт!</h3>
      <p data-ru="Персональный менеджер свяжется с вами и подготовит индивидуальный расчёт" data-am="Անձնական մենdelays-ը կկaperвер ձdelaysz հdelays deliverdelays">Персональный менеджер свяжется с вами и подготовит индивидуальный расчёт</p>
      <form class="popup-form" id="popupForm" onsubmit="submitPopupForm(event)">
        <div class="form-row">
          <div class="form-group">
            <label data-ru="Сколько выкупов нужно?" data-am="Քանի՞ գնdelays է անcessary">Сколько выкупов нужно?</label>
            <input type="number" id="popupBuyouts" min="0" placeholder="Например: 20" required>
          </div>
          <div class="form-group">
            <label data-ru="Сколько отзывов нужно?" data-am="Քdelays՞ delays է delaysdelays">Сколько отзывов нужно?</label>
            <input type="number" id="popupReviews" min="0" placeholder="Например: 10" required>
          </div>
        </div>
        <div class="form-group">
          <label data-ru="Ваш Telegram или телефон" data-am="Ваш Telegram или телефон">Ваш Telegram или телефон</label>
          <input type="text" id="popupContact" required placeholder="@username или +374...">
        </div>
        <button type="submit" class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px">
          <i class="fab fa-telegram"></i>
          <span data-ru="Получить расчёт в Telegram" data-am="Ստdelays delays Telegram-delays">Получить расчёт в Telegram</span>
        </button>
      </form>
    </div>
    <div class="popup-success" id="popupSuccess">
      <i class="fas fa-check-circle"></i>
      <h4 data-ru="Заявка отправлена!" data-am="Հdelays delays է!">Заявка отправлена!</h4>
      <p data-ru="Менеджер свяжется с вами в ближайшее время" data-am="Մdelays delayskdelay delaysdelays мdelays">Менеджер свяжется с вами в ближайшее время</p>
    </div>
  </div>
</div>

<script>
/* ===== LANGUAGE SYSTEM ===== */
let lang = 'ru';
const AM = {
  // NAV
  'Услуги': 'Ծdelaysdelays',
  'Калькулятор': 'Delaysdelays',
  'Склад': 'Delaysdelays',
  'Гарантии': 'Delaysdelays',
  'FAQ': 'ՀՏdelays',
  'Контакты': 'Կdelays',
  'Написать нам': 'Delaysdelays',
  // HERO
  'Работаем в Армении': 'Delaysdelays',
  'Выведем ваш товар': 'Delaysdelays',
  'в ТОП Wildberries': 'Wildberries-ի ТОdelays',
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
  document.getElementById('navLinks').classList.toggle('active');
  document.getElementById('hamburger').classList.toggle('active');
}
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    document.getElementById('navLinks').classList.remove('active');
    document.getElementById('hamburger').classList.remove('active');
  });
});

/* ===== TICKER ===== */
(function initTicker() {
  const items = [
    {icon:"fa-check-circle", ru:"Реальные люди, не боты", am:"Իрakan մdelays, ոdelays бdelaysdelays"},
    {icon:"fa-shield-alt", ru:"0 блокировок за всё время", am:"0 delaysdelays ongdelay delaysdelays"},
    {icon:"fa-warehouse", ru:"Собственный склад в Ереване", am:"Сdelays pahest Erevandelays"},
    {icon:"fa-mobile-alt", ru:"1000+ аккаунтов", am:"1000+ delaysdelays"},
    {icon:"fa-map-marker-alt", ru:"Ереван, Армения", am:"Erevan, Delaysdelays"},
    {icon:"fa-star", ru:"Профессиональные фото для отзывов", am:"Delaysdelays"},
    {icon:"fa-camera", ru:"Фотосессии с моделями", am:"Delaysdelays"},
    {icon:"fa-truck", ru:"Доставка на склады WB", am:"Delaysdelays"}
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

/* Tiered buyout pricing */
function getBuyoutPrice(qty) {
  if (qty <= 0) return 0;
  if (qty <= 20) return 2000;
  if (qty <= 40) return 1700;
  if (qty <= 60) return 1500;
  return 1250;
}

function getBuyoutTotal(qty) {
  if (qty <= 0) return 0;
  let total = 0;
  // Calculate tier by tier
  if (qty <= 20) {
    total = qty * 2000;
  } else if (qty <= 40) {
    total = 20 * 2000 + (qty - 20) * 1700;
  } else if (qty <= 60) {
    total = 20 * 2000 + 20 * 1700 + (qty - 40) * 1500;
  } else {
    total = 20 * 2000 + 20 * 1700 + 20 * 1500 + (qty - 60) * 1250;
  }
  return total;
}

function ccBuyout(delta) {
  const sp = document.getElementById('buyoutQty');
  let v = parseInt(sp.textContent) + delta;
  if (v < 0) v = 0;
  if (v > 999) v = 999;
  sp.textContent = v;
  // Update price label
  const price = getBuyoutPrice(v);
  document.getElementById('buyoutPriceLabel').textContent = v > 0 ? '֏' + price.toLocaleString('ru-RU') + '/шт' : '֏2 000';
  recalc();
}

function cc(btn, delta) {
  const row = btn.closest('.calc-row');
  const sp = row.querySelector('.calc-input span');
  let v = parseInt(sp.textContent) + delta;
  if (v < 0) v = 0;
  if (v > 999) v = 999;
  sp.textContent = v;
  recalc();
}

function recalc() {
  let total = 0;
  const items = [];

  // Buyout total (tiered)
  const buyoutQty = parseInt(document.getElementById('buyoutQty').textContent);
  if (buyoutQty > 0) {
    total += getBuyoutTotal(buyoutQty);
    items.push('Выкуп + забор: ' + buyoutQty + ' шт (' + getBuyoutPrice(buyoutQty) + '֏/шт)');
  }

  // Other rows (fixed price)
  document.querySelectorAll('.calc-row:not(#buyoutRow)').forEach(row => {
    const price = parseInt(row.dataset.price);
    const qty = parseInt(row.querySelector('.calc-input span').textContent);
    if (!isNaN(price) && qty > 0) {
      total += price * qty;
      items.push(row.querySelector('.calc-label').textContent + ': ' + qty);
    }
  });

  document.getElementById('calcTotal').textContent = '֏' + total.toLocaleString('ru-RU');
  const msg = (lang === 'am' ? 'Delaysdelays! Delaysdelays delaysdelays\\n' : 'Здравствуйте! Хочу заказать:\\n') + items.join('\\n') + '\\n\\n' + (lang === 'am' ? 'Delaysdelays: ' : 'Итого: ') + '֏' + total.toLocaleString('ru-RU');
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
function openLightbox(el) {
  document.getElementById('lightboxImg').src = el.querySelector('img').src;
  document.getElementById('lightbox').classList.add('show');
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('show'); }

/* ===== TIMED POPUP (5 sec) ===== */
let timedPopupShown = false;
setTimeout(() => {
  if (!timedPopupShown && !sessionStorage.getItem('timedPopupShown')) {
    timedPopupShown = true;
    document.getElementById('timedPopup').classList.add('show');
  }
}, 5000);

function closeTimedPopup() {
  document.getElementById('timedPopup').classList.remove('show');
  sessionStorage.setItem('timedPopupShown', 'true');
}
document.getElementById('timedPopup').addEventListener('click', (e) => {
  if (e.target === document.getElementById('timedPopup')) closeTimedPopup();
});

function submitPopupForm(e) {
  e.preventDefault();
  const buyouts = document.getElementById('popupBuyouts').value;
  const reviews = document.getElementById('popupReviews').value;
  const contact = document.getElementById('popupContact').value;

  // Send to API
  fetch('/api/popup-lead', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({buyouts, reviews, contact, lang, timestamp: new Date().toISOString()})
  }).catch(() => {});

  // Also send via TG deep link to manager
  const msg = 'Заявка с сайта Go to Top:\\n\\nВыкупов: ' + buyouts + '\\nОтзывов: ' + reviews + '\\nКонтакт: ' + contact;
  window.open('https://t.me/suport_admin_2?text=' + encodeURIComponent(msg), '_blank');

  // Show success
  document.getElementById('popupFormWrap').style.display = 'none';
  document.getElementById('popupSuccess').style.display = 'block';
  setTimeout(() => closeTimedPopup(), 3000);
}

/* ===== FORM SUBMIT ===== */
function submitForm(e) {
  e.preventDefault();
  const name = document.getElementById('formName').value;
  const contact = document.getElementById('formContact').value;
  const product = document.getElementById('formProduct').value;
  const service = document.getElementById('formService');
  const serviceText = service.options[service.selectedIndex].textContent;
  const message = document.getElementById('formMessage').value;

  let msg = lang === 'am' ? 'Delaysdelays! Delaysdelays Go to Top delaysdelays:\\n\\n' : 'Здравствуйте! Заявка с сайта Go to Top:\\n\\n';
  msg += 'Имя: ' + name + '\\n';
  msg += 'Контакт: ' + contact + '\\n';
  if (product) msg += 'Товар: ' + product + '\\n';
  msg += 'Услуга: ' + serviceText + '\\n';
  if (message) msg += 'Комментарий: ' + message;

  fetch('/api/lead', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({name, contact, product, service: service.value, message, lang, timestamp: new Date().toISOString()})
  }).catch(() => {});

  window.open('https://t.me/suport_admin_2?text=' + encodeURIComponent(msg), '_blank');

  const btn = e.target.querySelector('button[type=submit]');
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-check"></i> ' + (lang === 'am' ? 'Delaysdelays!' : 'Отправлено!');
  btn.style.background = 'var(--success)';
  setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 3000);
  e.target.reset();
}

/* ===== SCROLL ANIMATIONS ===== */
const obs = new IntersectionObserver((entries) => {
  entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); obs.unobserve(entry.target); } });
}, {threshold:0.1, rootMargin:'0px 0px -50px 0px'});
document.querySelectorAll('.fade-up').forEach(el => obs.observe(el));

/* ===== COUNTER ANIMATION ===== */
const cObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = parseInt(el.dataset.count);
      const dur = 2000;
      const start = performance.now();
      function anim(now) {
        const p = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(target * ease).toLocaleString('ru-RU');
        if (p < 1) requestAnimationFrame(anim);
        else el.textContent = target === 0 ? '0' : target.toLocaleString('ru-RU');
      }
      requestAnimationFrame(anim);
      cObs.unobserve(el);
    }
  });
}, {threshold:0.5});
document.querySelectorAll('.stat-num[data-count]').forEach(el => cObs.observe(el));

/* ===== SMOOTH SCROLL ===== */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (href === '#') return;
    const t = document.querySelector(href);
    if (t) { e.preventDefault(); window.scrollTo({top: t.offsetTop - 80, behavior:'smooth'}); }
  });
});

console.log('Go to Top — site loaded v2');
</script>
</body>
</html>`)
})

export default app
