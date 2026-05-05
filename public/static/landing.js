// Force page to start from top on every load (prevent iOS scroll restoration)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
/* ===== LANGUAGE ===== */
let lang = localStorage.getItem('gtt_lang') || 'ru';

/* ===== CURRENCY HELPERS =====
   Currency is bound to language: RU language → ₽, AM language → ֏.
   For each price source we prefer the explicit RUB column when it's > 0,
   otherwise we fall back to AMD so legacy rows keep working.
   The /api/site-data endpoint already returns price_rub & price_tiers_rub_json. */
function curSym() { return lang === 'ru' ? '\u20bd' : '\u058f'; }
function svcPrice(svc) {
  if (!svc) return 0;
  if (lang === 'ru') {
    var rub = Number(svc.price_rub) || 0;
    if (rub > 0) return rub;
  }
  return Number(svc.price) || 0;
}
function svcTiers(svc) {
  if (!svc) return [];
  if (lang === 'ru' && svc.price_tiers_rub_json) {
    try {
      var rt = JSON.parse(svc.price_tiers_rub_json);
      if (Array.isArray(rt) && rt.length > 0 && rt.some(function(t){ return Number(t.price) > 0; })) return rt;
    } catch(e) {}
  }
  try { return JSON.parse(svc.price_tiers_json || '[]'); } catch(e) { return []; }
}
function pkgPrice(p) {
  if (!p) return 0;
  if (lang === 'ru') {
    var rub = Number(p.package_price_rub) || 0;
    if (rub > 0) return rub;
  }
  return Number(p.package_price) || 0;
}
function pkgOrig(p) {
  if (!p) return 0;
  if (lang === 'ru') {
    var rub = Number(p.original_price_rub) || 0;
    if (rub > 0) return rub;
  }
  return Number(p.original_price) || 0;
}

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
/* Buyout pricing is hardcoded (not in DB) — duplicated for both currencies.
   RUB amounts are intentionally rounded to "nice" prices, not strict 0.222 conversions. */
function getBuyoutPrice(qty) {
  if (lang === 'ru') {
    if (qty <= 0) return 0;
    if (qty <= 20) return 450;
    if (qty <= 40) return 380;
    if (qty <= 60) return 330;
    return 280;
  }
  if (qty <= 0) return 0;
  if (qty <= 20) return 2000;
  if (qty <= 40) return 1700;
  if (qty <= 60) return 1500;
  return 1250;
}
function getBuyoutTotal(qty) {
  if (qty <= 0) return 0;
  if (lang === 'ru') {
    if (qty <= 20) return qty * 450;
    if (qty <= 40) return 20 * 450 + (qty - 20) * 380;
    if (qty <= 60) return 20 * 450 + 20 * 380 + (qty - 40) * 330;
    return 20 * 450 + 20 * 380 + 20 * 330 + (qty - 60) * 280;
  }
  if (qty <= 20) return qty * 2000;
  if (qty <= 40) return 20 * 2000 + (qty - 20) * 1700;
  if (qty <= 60) return 20 * 2000 + 20 * 1700 + (qty - 40) * 1500;
  return 20 * 2000 + 20 * 1700 + 20 * 1500 + (qty - 60) * 1250;
}
function _buyoutDefaultLabel() {
  return (lang === 'ru' ? '450 ' : '2 000 ') + curSym();
}
function _pcsWord() { return lang === 'am' ? '\u0570\u0561\u057f' : '\u0448\u0442'; }
function ccBuyout(delta) {
  const inp = document.getElementById('buyoutQty');
  let v = parseInt(inp.value || 0) + delta;
  if (v < 0) v = 0; if (v > 999) v = 999;
  inp.value = v;
  const price = getBuyoutPrice(v);
  document.getElementById('buyoutPriceLabel').textContent = v > 0 ? formatNum(price) + ' ' + curSym() + '/' + _pcsWord() : _buyoutDefaultLabel();
  recalc();
}
function onBuyoutInput() {
  const inp = document.getElementById('buyoutQty');
  let v = parseInt(inp.value || 0);
  if (isNaN(v) || v < 0) v = 0; if (v > 999) v = 999;
  inp.value = v;
  const price = getBuyoutPrice(v);
  document.getElementById('buyoutPriceLabel').textContent = v > 0 ? formatNum(price) + ' ' + curSym() + '/' + _pcsWord() : _buyoutDefaultLabel();
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
  if (buyoutQty > 0) { total += getBuyoutTotal(buyoutQty); items.push('Выкуп + забор: ' + buyoutQty + ' шт (' + getBuyoutPrice(buyoutQty) + ' ' + curSym() + '/шт)'); }
  document.querySelectorAll('.calc-row:not(#buyoutRow)').forEach(row => {
    const price = parseInt(row.dataset.price);
    const inp = row.querySelector('.calc-input input');
    const qty = parseInt(inp ? inp.value : 0);
    if (!isNaN(price) && qty > 0) { total += price * qty; items.push(row.querySelector('.calc-label').textContent + ': ' + qty); }
  });
  document.getElementById('calcTotal').textContent = total.toLocaleString('ru-RU') + ' ' + curSym();
  const msg = 'Здравствуйте! Хочу заказать:\\n' + items.join('\\n') + '\\n\\nИтого: ' + total.toLocaleString('ru-RU') + ' ' + curSym();
  var _calcBtn = document.getElementById('calcTgBtn');
  if (_calcBtn) {
    var _curHref = _calcBtn.getAttribute('href') || '';
    var _baseUrl = _curHref.split('?')[0] || 'https://wa.me/37455226224';
    var _isWaCalc = _baseUrl.includes('wa.me') || _baseUrl.includes('whatsapp');
    _calcBtn.href = _baseUrl + (_isWaCalc ? ((_baseUrl.includes('?') ? '&text=' : '?text=')) : '?text=') + encodeURIComponent(msg);
  }
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
  var imgEl = typeof elOrUrl === 'string' ? null : (elOrUrl.tagName === 'IMG' ? elOrUrl : elOrUrl.querySelector('img'));
  var src = typeof elOrUrl === 'string' ? elOrUrl : imgEl.src;
  // Collect photos only from the SAME carousel/gallery as the clicked image
  _lbPhotos = [];
  _lbIdx = 0;
  // Find the closest carousel or photo block container
  var parentCarousel = imgEl ? imgEl.closest('.rv-track') : null;
  var parentPbGallery = imgEl ? imgEl.closest('.pb-grid, .pb-gallery, [class*="photo-block"]') : null;
  
  if (parentCarousel) {
    // Photos from same carousel only
    var slides = parentCarousel.querySelectorAll('.rv-slide img');
    for (var si = 0; si < slides.length; si++) {
      _lbPhotos.push(slides[si].src);
      if (slides[si].src === src) _lbIdx = si;
    }
  } else if (parentPbGallery) {
    // Photos from same photo block only
    var pbImgs = parentPbGallery.querySelectorAll('img');
    for (var pi = 0; pi < pbImgs.length; pi++) {
      _lbPhotos.push(pbImgs[pi].src);
      if (pbImgs[pi].src === src) _lbIdx = pi;
    }
  } else {
    // Fallback: try to find in any parent section
    var parentSection = imgEl ? imgEl.closest('section, [data-section-id]') : null;
    if (parentSection) {
      var sectionImgs = parentSection.querySelectorAll('.rv-slide img, .pb-card img, .pb-grid img');
      for (var xi = 0; xi < sectionImgs.length; xi++) {
        _lbPhotos.push(sectionImgs[xi].src);
        if (sectionImgs[xi].src === src) _lbIdx = xi;
      }
    }
  }
  // Last fallback: single photo
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
var _popupResizeHandler = null;
var _popupTouchHandler = null;

function _setPopupHeight() {
  var ov = document.getElementById('popupOverlay');
  if (!ov || ov.style.display === 'none') return;
  // window.innerHeight gives the VISIBLE viewport (excludes browser chrome on Android/iOS)
  var vh = window.innerHeight;
  ov.style.setProperty('height', vh + 'px', 'important');
  var card = ov.querySelector('.popup-card');
  if (card && window.innerWidth <= 640) {
    var maxH = Math.floor(vh * 0.78);
    card.style.setProperty('max-height', maxH + 'px', 'important');
  }
}

function showPopup() {
  if (_popupShown) return;
  _popupShown = true;
  var ov = document.getElementById('popupOverlay');
  if (!ov) { console.log('[Popup] No overlay element found, retrying...'); _popupShown = false; setTimeout(showPopup, 1000); return; }
  var card = ov.querySelector('.popup-card');
  if (!card) { console.log('[Popup] No card element found'); return; }
  var isMobile = window.innerWidth <= 640;
  var vh = window.innerHeight;
  
  // 1) Lock body scroll FIRST — critical for iOS Safari
  //    position:fixed prevents background scroll; top:-scrollY preserves position
  document.body.dataset.popupScrollY = String(window.scrollY);
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = '-' + window.scrollY + 'px';
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  
  // 2) Reset any previous state completely
  card.removeAttribute('style');
  ov.removeAttribute('style');
  
  // 3) FORCE show overlay with inline styles to override ANY CSS/cache/extension
  ov.className = 'popup-overlay show';
  ov.style.setProperty('display', 'flex', 'important');
  ov.style.setProperty('position', 'fixed', 'important');
  ov.style.setProperty('top', '0', 'important');
  ov.style.setProperty('left', '0', 'important');
  ov.style.setProperty('width', '100%', 'important');
  ov.style.setProperty('height', vh + 'px', 'important');
  ov.style.setProperty('background', 'rgba(0,0,0,0.85)', 'important');
  ov.style.setProperty('z-index', '100000', 'important');
  ov.style.setProperty('overflow', 'hidden', 'important');
  ov.style.setProperty('overscroll-behavior', 'contain', 'important');
  ov.style.setProperty('touch-action', 'none', 'important');
  ov.style.setProperty('visibility', 'visible', 'important');
  ov.style.setProperty('opacity', '1', 'important');
  
  if (isMobile) {
    ov.style.setProperty('justify-content', 'flex-end', 'important');
    ov.style.setProperty('align-items', 'flex-end', 'important');
    ov.style.setProperty('padding', '0', 'important');
    var maxH = Math.floor(vh * 0.78);
    card.style.cssText = 'max-width:100% !important;width:100% !important;margin:0 !important;border-radius:20px 20px 0 0 !important;max-height:' + maxH + 'px !important;overflow-y:auto !important;padding:20px 16px !important;padding-bottom:calc(16px + env(safe-area-inset-bottom, 0px)) !important;opacity:1 !important;visibility:visible !important;display:block !important;animation:slideUpMobile 0.4s ease forwards !important;-webkit-overflow-scrolling:touch !important;overscroll-behavior:contain !important;';
  } else {
    ov.style.setProperty('justify-content', 'center', 'important');
    ov.style.setProperty('align-items', 'center', 'important');
    ov.style.setProperty('padding', '20px', 'important');
    card.style.cssText = 'opacity:1 !important;visibility:visible !important;display:block !important;';
  }
  
  // 4) Ensure form is visible (reset from previous success state)
  var formWrap = document.getElementById('popupFormWrap');
  var successWrap = document.getElementById('popupSuccess');
  if (formWrap) formWrap.style.display = 'block';
  if (successWrap) successWrap.style.display = 'none';
  
  // 5) Update height on resize/orientation change (handles keyboard open/close too)
  _popupResizeHandler = function() { _setPopupHeight(); };
  window.addEventListener('resize', _popupResizeHandler);
  
  // 6) Prevent touch-scroll on overlay (but allow scrolling inside the card)
  _popupTouchHandler = function(e) {
    // Allow scrolling inside the popup card
    var target = e.target;
    while (target && target !== ov) {
      if (target === card) return; // allow card scroll
      target = target.parentElement;
    }
    e.preventDefault();
  };
  ov.addEventListener('touchmove', _popupTouchHandler, { passive: false });
  
  console.log('[Popup] Shown on ' + (isMobile ? 'mobile' : 'desktop') + ', vh=' + vh + ', w=' + window.innerWidth);
}

function hidePopup() {
  var ov = document.getElementById('popupOverlay');
  if (ov) {
    ov.classList.remove('show');
    ov.style.cssText = 'display:none !important;visibility:hidden !important;opacity:0 !important;';
    if (_popupTouchHandler) {
      ov.removeEventListener('touchmove', _popupTouchHandler);
      _popupTouchHandler = null;
    }
  }
  // Remove resize listener
  if (_popupResizeHandler) {
    window.removeEventListener('resize', _popupResizeHandler);
    _popupResizeHandler = null;
  }
  // Restore body scroll — reverse the iOS Safari scroll-lock
  var scrollY = parseInt(document.body.dataset.popupScrollY || '0', 10);
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
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

/* ===== CALLBACK MODAL ===== */
function openCallbackModal() {
  var modal = document.getElementById('callbackModal');
  if (!modal) return;
  document.body.style.overflow = 'hidden';
  modal.className = 'popup-overlay show';
  var result = document.getElementById('callbackResult');
  if (result) { result.style.display = 'none'; result.textContent = ''; }
  var form = document.getElementById('callbackForm');
  if (form) form.reset();
}
function closeCallbackModal() {
  var modal = document.getElementById('callbackModal');
  if (!modal) return;
  modal.className = 'popup-overlay';
  document.body.style.overflow = '';
}
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeCallbackModal();
});
function submitCallbackForm(e) {
  e.preventDefault();
  var name = (document.getElementById('cb_name') || {}).value || '';
  var phone = (document.getElementById('cb_phone') || {}).value || '';
  var time = (document.getElementById('cb_time') || {}).value || '';
  var question = (document.getElementById('cb_question') || {}).value || '';
  var result = document.getElementById('callbackResult');
  var btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...'; }
  var msg = 'Запрос на звонок\\nИмя: ' + name + '\\nТелефон: ' + phone;
  if (time) msg += '\\nУдобное время: ' + time;
  if (question) msg += '\\nВопрос: ' + question;
  fetch('/api/public/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, phone: phone, message: msg, source: 'callback_modal' })
  }).then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function() {
      if (result) {
        result.style.display = 'block';
        result.style.background = 'rgba(16,185,129,0.1)';
        result.style.border = '1px solid rgba(16,185,129,0.3)';
        result.style.color = '#6ee7b7';
        result.textContent = '✓ Заявка принята! Мы перезвоним вам в ближайшее время.';
      }
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Отправлено'; }
      setTimeout(closeCallbackModal, 3000);
    })
    .catch(function() {
      if (result) {
        result.style.display = 'block';
        result.style.background = 'rgba(239,68,68,0.1)';
        result.style.border = '1px solid rgba(239,68,68,0.3)';
        result.style.color = '#fca5a5';
        result.textContent = 'Ошибка. Напишите нам в Telegram: @goo_to_top';
      }
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить заявку'; }
    });
}

/* ===== INTL-TEL-INPUT INIT =====
   The library is loaded via <script defer>, so it's available only after
   DOMContentLoaded. The PDF form input (#pdfClientPhone) is created
   synchronously by an IIFE later in this script, so by the time
   DOMContentLoaded fires all three inputs exist in the DOM. */
var ITI_OPTS = {
  initialCountry: 'am',
  preferredCountries: ['am','ru','ge','by','kz','ua','us'],
  separateDialCode: true,
  utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@25/build/js/utils.js'
};
function _initPhoneIti(inputId, key) {
  var inp = document.getElementById(inputId);
  if (!inp || !window.intlTelInput) return null;
  try {
    var iti = window.intlTelInput(inp, ITI_OPTS);
    window['_iti_' + key] = iti;
    return iti;
  } catch (e) { console.warn('[ITI] init failed for #' + inputId, e); return null; }
}
function _initAllPhoneItis() {
  _initPhoneIti('formPhone', 'lead');
  _initPhoneIti('popupPhone', 'popup');
  _initPhoneIti('pdfClientPhone', 'pdf');
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initAllPhoneItis);
} else {
  _initAllPhoneItis();
}

/* Form submit */
document.getElementById('popupForm').addEventListener('submit', function(e) {
  e.preventDefault();
  var popupName = (document.getElementById('popupName') || {}).value || '';
  var buyouts = document.getElementById('popupBuyouts').value;
  var reviews = document.getElementById('popupReviews').value;
  /* Phone with country selector — use intl-tel-input to get E.164 number */
  var popupPhoneInput = document.getElementById('popupPhone');
  var iti = window._iti_popup;
  var contact = '';
  if (iti && typeof iti.isValidNumber === 'function') {
    if (!iti.isValidNumber()) {
      var msg = lang === 'am' ? 'Մուտքագրեք ճիշտ հեռախոսահամար' : 'Введите корректный номер телефона';
      popupPhoneInput.style.borderColor = '#EF4444';
      popupPhoneInput.focus();
      var prev = this.querySelector('.pf-phone-error');
      if (prev) prev.remove();
      var err = document.createElement('div');
      err.className = 'pf-phone-error';
      err.style.cssText = 'color:#EF4444;font-size:0.82rem;margin-top:6px';
      err.textContent = msg;
      popupPhoneInput.parentElement.appendChild(err);
      return;
    }
    contact = iti.getNumber();
  } else {
    contact = (popupPhoneInput.value || '').trim();
    if (contact.replace(/\D/g, '').length < 7) {
      popupPhoneInput.style.borderColor = '#EF4444';
      popupPhoneInput.focus();
      return;
    }
  }
  popupPhoneInput.style.borderColor = '';
  var prevErr = this.querySelector('.pf-phone-error');
  if (prevErr) prevErr.remove();
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
    body: JSON.stringify({name:popupName, buyouts:buyouts, reviews:reviews, contact:contact, lang:lang, currency: (lang === 'ru' ? 'rub' : 'amd'), notes:autoNotes, ts: new Date().toISOString()})
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
  /* Phone with country selector — validate via intl-tel-input and send as E.164 */
  var phoneInput = document.getElementById('formPhone');
  var iti = window._iti_lead;
  var contact = '';
  if (iti && typeof iti.isValidNumber === 'function') {
    if (!iti.isValidNumber()) {
      var msg = lang === 'am' ? 'Մուտքագրեք ճիշտ հեռախոսահամար' : 'Введите корректный номер телефона';
      phoneInput.style.borderColor = '#EF4444';
      phoneInput.focus();
      var prev = e.target.querySelector('.lead-phone-error');
      if (prev) prev.remove();
      var err = document.createElement('div');
      err.className = 'lead-phone-error';
      err.style.cssText = 'color:#EF4444;font-size:0.82rem;margin-top:6px';
      err.textContent = msg;
      phoneInput.parentElement.appendChild(err);
      return;
    }
    contact = iti.getNumber();
  } else {
    contact = (phoneInput.value || '').trim();
    if (contact.replace(/\D/g, '').length < 7) {
      phoneInput.style.borderColor = '#EF4444';
      phoneInput.focus();
      return;
    }
  }
  phoneInput.style.borderColor = '';
  var prevErr = e.target.querySelector('.lead-phone-error');
  if (prevErr) prevErr.remove();
  var product = document.getElementById('formProduct').value;
  var service = document.getElementById('formService');
  var serviceText = service.options[service.selectedIndex].textContent;
  var message = document.getElementById('formMessage').value;

  var btn = e.target.querySelector('button[type=submit]');
  var orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + (lang === 'am' ? 'Սպասեք...' : 'Отправка...');

  fetch('/api/lead', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name:name, contact:contact, product:product, service: service.value, message:message, lang:lang, currency: (lang === 'ru' ? 'rub' : 'amd'), ts: new Date().toISOString()}) })
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

/* ===== COUNTER FALLBACK =====
   If IntersectionObserver fails (e.g. server-injected reveal, lazy load issues),
   force counters to animate after page load to guarantee numbers are never stuck at 0. */
function forceRunCounters() {
  document.querySelectorAll('.stat-num[data-count]').forEach(function(el) {
    if (el.dataset.counterDone === '1') return;
    var target = parseInt(el.dataset.count) || 0;
    el.dataset.counterDone = '1';
    if (target === 0) { el.textContent = '0'; return; }
    var dur = 1800; var start = performance.now();
    function anim(now) {
      var p = Math.min((now - start) / dur, 1);
      el.textContent = Math.floor(target * (1 - Math.pow(1 - p, 3))).toLocaleString('ru-RU');
      if (p < 1) requestAnimationFrame(anim);
      else el.textContent = target.toLocaleString('ru-RU');
    }
    requestAnimationFrame(anim);
  });
  document.querySelectorAll('.stat-big[data-count-s]').forEach(function(el) {
    if (el.dataset.counterDone === '1') return;
    var target = parseInt(el.dataset.countS) || 0;
    el.dataset.counterDone = '1';
    if (target === 0) return;
    var hasPlus = el.textContent.includes('+');
    var dur = 1800; var start = performance.now();
    function animS(now) {
      var p = Math.min((now - start) / dur, 1);
      var val = Math.floor(target * (1 - Math.pow(1 - p, 3)));
      el.textContent = val.toLocaleString('ru-RU') + (hasPlus ? '+' : '');
      if (p < 1) requestAnimationFrame(animS);
      else el.textContent = target.toLocaleString('ru-RU') + (hasPlus ? '+' : '');
    }
    requestAnimationFrame(animS);
  });
}
/* Run counters as early as possible: immediately + on multiple events for robustness. */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { setTimeout(forceRunCounters, 50); });
} else {
  setTimeout(forceRunCounters, 50);
}
window.addEventListener('load', function() { setTimeout(forceRunCounters, 200); });
setTimeout(forceRunCounters, 1500);

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
    document.getElementById('price_' + svcId).textContent = v > 0 ? formatNum(price) + ' ' + curSym() + '/' + _pcsWord() : formatNum(tiers[0].price) + ' ' + curSym();
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
        items.push(labelText + ': ' + qty + ' ' + pcsWord + ' (' + formatNum(getTierPrice(tiers, qty)) + ' ' + curSym() + '/' + pcsWord + ')');
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
    totalHtml += '<div style="font-size:0.78rem;color:#f59e0b;margin-bottom:2px;overflow-wrap:break-word;word-break:break-word;white-space:normal"><i class="fas fa-box-open" style="margin-right:4px"></i>' + (lang==='am'?(selectedPkg.name_am||selectedPkg.name_ru):selectedPkg.name_ru) + ': ' + formatNum(packageAmount) + ' ' + curSym() + '</div>';
  }
  if (totalDiscountAmount > 0 && subtotalBeforeDiscount > 0) {
    calcTotalEl.innerHTML = totalHtml + '<div class="calc-total-prices">' +
      '<span class="calc-old-price">' + formatNum(subtotalBeforeDiscount) + ' ' + curSym() + '</span>' +
      '<span>' + formatNum(total) + ' ' + curSym() + '</span>' +
      '</div>' +
      '<div class="calc-discount-line"><i class="fas fa-gift" style="margin-right:4px"></i>' +
      (lang === 'am' ? String.fromCharCode(0x0536,0x0565,0x0572,0x0573) + ': -' : '\u0421\u043a\u0438\u0434\u043a\u0430: -') + formatNum(totalDiscountAmount) + ' ' + curSym() + ' (-' + _refDiscount + '%)</div>';
  } else if (totalHtml) {
    calcTotalEl.innerHTML = totalHtml + '<span>' + formatNum(total) + ' ' + curSym() + '</span>';
  } else {
    calcTotalEl.textContent = formatNum(total) + ' ' + curSym();
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
          (lang === 'am' ? String.fromCharCode(0x0536,0x0565,0x0572,0x0573,0x20,0x056e,0x0561,0x057c,0x0561,0x0575,0x0578,0x0582,0x0569,0x0575,0x0578,0x0582,0x0576,0x0576,0x0565,0x0580,0x056b,0x3a,0x20,0x2d) : '\u0421\u043a\u0438\u0434\u043a\u0430 \u043d\u0430 \u0443\u0441\u043b\u0443\u0433\u0438: -') + formatNum(discountAmount) + ' ' + curSym() + '</span>';
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
        promoMsg += (lang === 'am' ? _amDiscount + '-' : '\u0421\u043a\u0438\u0434\u043a\u0430: -') + formatNum(totalDiscountAmount) + ' ' + curSym() + ' (-' + _refDiscount + '%)';
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
  var tgUrl = (window._tgData && window._tgData.calc_order_msg && window._tgData.calc_order_msg.telegram_url) || '';
  // PRIORITY: blockFeatures URL for calculator > telegram_messages URL
  if (window._bfUrlByLabel) {
    var calcBfLabel = document.getElementById('calcTgBtn');
    if (calcBfLabel) {
      var calcSpan = calcBfLabel.querySelector('span[data-ru]');
      if (calcSpan) {
        var calcLabel = calcSpan.getAttribute('data-ru');
        if (calcLabel && window._bfUrlByLabel[calcLabel.trim()]) {
          tgUrl = window._bfUrlByLabel[calcLabel.trim()].url;
        }
      }
    }
  }
  if (!tgUrl) tgUrl = 'https://wa.me/37455226224';
  var greeting = lang === 'am' ? 'Ողջույն! Ուզում եմ պատվիրել:' : 'Здравствуйте! Хочу заказать:';
  var totalLabel = lang === 'am' ? 'Ընդամենը:' : 'Итого:';
  var msg = greeting + '\\n' + items.join('\\n');
  if (discountAmount > 0) {
    var refCode = document.getElementById('refCodeInput') ? document.getElementById('refCodeInput').value : '';
    msg += '\\n\\n' + (lang === 'am' ? 'Պրոմոկոդ: ' : 'Промокод: ') + refCode + ' (-' + _refDiscount + '%, -' + formatNum(discountAmount) + ' ' + curSym() + ')';
  }
  msg += '\\n\\n' + totalLabel + ' ' + formatNum(total) + ' ' + curSym();
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
      // Collect telegram entries for this section in order
      var secEntries = [];
      for (var tk2 in window._tgData) {
        if (tk2.indexOf(bfKey + '_') === 0) {
          secEntries.push(window._tgData[tk2]);
        }
      }
      for (var bi = 0; bi < bfBtns.length; bi++) {
        var bfBtn = bfBtns[bi];
        if (bfBtn.text_ru && !tgByLabel[bfBtn.text_ru.trim()]) {
          // Match by position within section
          var tmMatch = secEntries[bi] || secEntries[0];
          if (tmMatch) {
            tgByLabel[bfBtn.text_ru.trim()] = tmMatch;
            if (bfBtn.text_am) tgByLabel[bfBtn.text_am.trim()] = tmMatch;
          }
        }
      }
    }
  }
  // Match all links with t.me/ or wa.me/ or whatsapp
  // PRIORITY: blockFeatures URL (admin panel) > telegram_messages URL
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
    // PRIORITY: blockFeatures data > telegram_messages data
    var bfEntry = window._bfUrlByLabel ? window._bfUrlByLabel[buttonText] : null;
    var mUrl = (bfEntry && bfEntry.url) ? bfEntry.url : (tgMsg ? tgMsg.telegram_url || '' : '');
    if (!mUrl) return;
    // Message: blockFeatures message_ru/am is the SINGLE source of truth
    // telegram_messages.message_template is only used as fallback if blockFeatures has no entry
    var msgTemplate = '';
    if (bfEntry) {
      msgTemplate = (lang === 'am' && bfEntry.message_am) ? bfEntry.message_am : (bfEntry.message_ru || '');
    } else if (tgMsg) {
      msgTemplate = (lang === 'am' && tgMsg.message_template_am) ? tgMsg.message_template_am : (tgMsg.message_template_ru || '');
    }
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

// Override switchLang to always use latest data-ru/data-am and update Telegram links.
// Currency is bound to language (RU → ₽, AM → ֏). The calculator/package DOM is
// rebuilt from db on first load (loadSiteData IIFE) and bakes the chosen currency
// into data-price / data-tiers / .calc-price text. Cleanly re-rendering all that
// from JS on the fly would duplicate ~200 lines of render logic, so on a real
// language change we just navigate to the corresponding /ru or /am URL — the SSR
// layer already pre-renders the right currency, and the page comes up identical
// minus the flipped prices.
switchLang = function(l) {
  var newPath = l === 'am' ? '/am' : '/ru';
  if (window.location.pathname !== newPath) {
    localStorage.setItem('gtt_lang', l);
    window.location.assign(newPath + window.location.hash);
    return;
  }
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
  updateTelegramLinks();
  try {
    var bp = document.getElementById('buyoutPriceLabel');
    if (bp) {
      var bpQty = parseInt((document.getElementById('buyoutQty') || {}).value || '0') || 0;
      bp.textContent = bpQty > 0 ? formatNum(getBuyoutPrice(bpQty)) + ' ' + curSym() + '/' + _pcsWord() : _buyoutDefaultLabel();
    }
  } catch(e) {}
  try { if (typeof recalcDynamic === 'function') recalcDynamic(); } catch(e) {}
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
          // Skip calculator section — its texts are managed by blockFeatures, not textMap
          // (matches server-side HTMLRewriter behavior that skips data-section-id="calculator")
          if (el.closest('[data-section-id="calculator"]')) return;
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
          // Skip calculator section — its texts are managed by blockFeatures, not textMap
          if (el.closest('[data-section-id="calculator"]')) return;
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
            // Pull tiers and unit price through currency helpers so RU sees ₽-tiers/₽-prices.
            var tiers = svcTiers(svc);
            var hasTiers = svc.price_type === 'tiered' && tiers && tiers.length > 0;
            var unitPrice = svcPrice(svc);
            
            if (hasTiers) {
              var svcId = 'tiered_' + svc.id;
              // Embed the currency-correct tiers in the data attribute so getTierPrice/Total uses them.
              var tiersAttr = JSON.stringify(tiers).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
              gh += '<div class="calc-row" data-price="tiered" data-tiers="'+tiersAttr+'" data-svc-id="'+svc.id+'" id="row_'+svcId+'">';
              gh += '<div class="calc-label" data-ru="'+escCalc(svc.name_ru)+'" data-am="'+escCalc(svc.name_am)+'">' + (lang==='am' ? svc.name_am : svc.name_ru) + '</div>';
              gh += '<div class="calc-price" id="price_'+svcId+'">'+formatNum(tiers[0].price)+' ' + curSym() + '</div>';
              gh += '<div class="calc-input"><button onclick="ccTiered(&apos;'+svcId+'&apos;,-1)">−</button><input type="number" id="qty_'+svcId+'" value="0" min="0" max="999" onchange="onTieredInput(&apos;'+svcId+'&apos;)"><button onclick="ccTiered(&apos;'+svcId+'&apos;,1)">+</button></div>';
              gh += '</div>';
              gh += '<div class="buyout-tier-info"><strong data-ru="Чем больше — тем дешевле:" data-am="Որքան շատ — այնքան էժան:">'+( lang==='am' ? 'Որքան շատ — այնքան էժան:' : 'Чем больше — тем дешевле:')+'</strong><br>';
              gh += '<span>' + tiers.map(function(t) { 
                var range = t.max >= 999 ? t.min+'+' : t.min+'-'+t.max;
                return range + ' → ' + formatNum(t.price) + ' ' + curSym(); 
              }).join(' &nbsp;|&nbsp; ') + '</span></div>';
            } else {
              gh += '<div class="calc-row" data-price="'+unitPrice+'" data-svc-id="'+svc.id+'">';
              gh += '<div class="calc-label" data-ru="'+escCalc(svc.name_ru)+'" data-am="'+escCalc(svc.name_am)+'">'+(lang==='am' ? svc.name_am : svc.name_ru)+'</div>';
              gh += '<div class="calc-price">'+formatNum(unitPrice)+' ' + curSym() + '</div>';
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
        // Sort: cheaper packages left, gold center, expensive right.
        // On RU language we drop packages that have no RUB price set so customers don't see ֏ prices on /ru.
        var allPkgs = db.packages.slice();
        if (lang === 'ru') {
          allPkgs = allPkgs.filter(function(p) { return Number(p.package_price_rub) > 0; });
        }
        var sortedPkgs = allPkgs;
        var _goldPkg = null;
        var _otherPkgs = [];
        for (var _gi = 0; _gi < sortedPkgs.length; _gi++) {
          var _gc = sortedPkgs[_gi].crown_tier || (sortedPkgs[_gi].is_popular ? 'gold' : '');
          if (_gc === 'gold' && !_goldPkg) { _goldPkg = sortedPkgs[_gi]; }
          else { _otherPkgs.push(sortedPkgs[_gi]); }
        }
        _otherPkgs.sort(function(a, b) { return (pkgPrice(a) || 0) - (pkgPrice(b) || 0); });
        if (_goldPkg) {
          // cheaper left, gold center, expensive right
          var _left = _otherPkgs.slice(0, Math.ceil(_otherPkgs.length / 2));
          var _right = _otherPkgs.slice(Math.ceil(_otherPkgs.length / 2));
          sortedPkgs = _left.concat([_goldPkg]).concat(_right);
        } else {
          sortedPkgs = _otherPkgs;
        }
        // Nothing to render (e.g. RU lang with no RUB-priced packages yet)
        // — gracefully hide container instead of showing an empty grid.
        var _renderPkgsAtAll = sortedPkgs.length > 0;
        for (var pki = 0; pki < sortedPkgs.length; pki++) {
          var pk = sortedPkgs[pki];
          var pkPriceCur = pkgPrice(pk);
          var pkOrigCur = pkgOrig(pk);
          var pkDisc = pkOrigCur > 0 ? Math.round((1 - pkPriceCur / pkOrigCur) * 100) : 0;
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
          if (pkOrigCur > 0 && pkOrigCur > pkPriceCur) {
            ph += '<span class="pkg-old-price">' + formatNum(pkOrigCur) + ' ' + curSym() + '</span>';
          }
          ph += '<span class="pkg-new-price">' + formatNum(pkPriceCur) + ' ' + curSym() + '</span>';
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
                  // Pick RU-tiers when on /ru and they exist; otherwise AMD tiers.
                  var piTiers = svcTiers({ price_type: 'tiered', price_tiers_json: pi2.price_tiers_json, price_tiers_rub_json: pi2.price_tiers_rub_json });
                  var piUnitP = getTierPrice(piTiers, piQty);
                  piExtraRu = ' <span style="color:#a78bfa;font-size:0.72rem">(' + formatNum(piUnitP) + ' ' + curSym() + '/\u0448\u0442)</span>';
                  piExtraAm = ' <span style="color:#a78bfa;font-size:0.72rem">(' + formatNum(piUnitP) + ' ' + curSym() + '/\u0570\u0561\u057f)</span>';
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
        if (_renderPkgsAtAll) {
          pkgsContainer.innerHTML = ph;
          pkgsContainer.style.display = '';
        } else {
          // Hide entirely on RU when no packages have RUB pricing yet.
          pkgsContainer.innerHTML = '';
          pkgsContainer.style.display = 'none';
        }
        console.log('[DB] Packages rendered:', sortedPkgs.length, '/', db.packages.length, 'lang=' + lang);
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
    
    // ===== 3. APPLY TELEGRAM/MESSENGER LINKS DYNAMICALLY =====
    // PRIORITY: blockFeatures URL > telegram_messages URL > hardcoded fallback
    // blockFeatures stores the CURRENT admin-configured URLs (e.g. WhatsApp)
    // telegram_messages stores OLD data and is only used for message templates
    
    // Build blockFeatures URL lookup: button_label_ru -> { url, sectionKey }
    window._bfUrlByLabel = {};
    if (hasBlockFeatures) {
      db.blockFeatures.forEach(function(bf) {
        if (!bf.buttons || bf.buttons.length === 0) return;
        bf.buttons.forEach(function(btn) {
          if (btn.text_ru && btn.url) {
            window._bfUrlByLabel[btn.text_ru.trim()] = { url: btn.url, key: bf.key, message_ru: btn.message_ru || '', message_am: btn.message_am || '' };
          }
          if (btn.text_am && btn.url) {
            window._bfUrlByLabel[btn.text_am.trim()] = { url: btn.url, key: bf.key, message_ru: btn.message_ru || '', message_am: btn.message_am || '' };
          }
        });
      });
    }
    
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
      if (hasBlockFeatures) {
        db.blockFeatures.forEach(function(bfTg) {
          if (!bfTg.buttons || bfTg.buttons.length === 0) return;
          var sKey = bfTg.key;
          // Collect telegram entries for this section, sorted by key (preserves original button order)
          var sectionTgEntries = [];
          for (var tk in db.telegram) {
            if (tk.indexOf(sKey + '_') === 0) {
              sectionTgEntries.push(db.telegram[tk]);
            }
          }
          bfTg.buttons.forEach(function(btn, idx) {
            if (!btn.text_ru) return;
            var newLabel = btn.text_ru.trim();
            if (tgByLabel[newLabel]) return;
            // Match by position: button[idx] maps to sectionTgEntries[idx]
            var tm = sectionTgEntries[idx] || sectionTgEntries[0];
            if (tm) {
              tgByLabel[newLabel] = tm;
              if (btn.text_am) tgByLabel[btn.text_am.trim()] = tm;
            }
          });
        });
      }
      
      // Find all <a> tags pointing to t.me/ or wa.me/ and update their href
      // SINGLE SOURCE: blockFeatures message_ru/am controls auto-messages
      document.querySelectorAll('a[href*="t.me/"], a[href*="wa.me/"], a[href*="whatsapp"]').forEach(function(a) {
        if (a.id === 'calcTgBtn') return;
        var spanWithDataRu = a.querySelector('span[data-ru]');
        var buttonText = spanWithDataRu ? spanWithDataRu.getAttribute('data-ru') : null;
        if (!buttonText && a.hasAttribute('data-ru')) { buttonText = a.getAttribute('data-ru'); }
        if (!buttonText) { var h4 = a.querySelector('h4[data-ru]'); if (h4) buttonText = h4.getAttribute('data-ru'); }
        if (!buttonText) return;
        buttonText = buttonText.trim();
        var tgMsg = tgByLabel[buttonText];
        // PRIORITY: blockFeatures data > telegram_messages data
        var bfEntry = window._bfUrlByLabel[buttonText];
        var mUrl = (bfEntry && bfEntry.url) ? bfEntry.url : (tgMsg ? tgMsg.telegram_url || '' : '');
        if (!mUrl) return;
        // Message: blockFeatures message_ru/am is the SINGLE source of truth
        var msgTemplate = '';
        if (bfEntry) {
          msgTemplate = (lang === 'am' && bfEntry.message_am) ? bfEntry.message_am : (bfEntry.message_ru || '');
        } else if (tgMsg) {
          msgTemplate = (lang === 'am' && tgMsg.message_template_am) ? tgMsg.message_template_am : (tgMsg.message_template_ru || '');
        }
        var isWa = mUrl.includes('wa.me') || mUrl.includes('whatsapp');
        if (msgTemplate) {
          a.href = isWa ? (mUrl + (mUrl.includes('?') ? '&text=' : '?text=') + encodeURIComponent(msgTemplate)) : (mUrl + '?text=' + encodeURIComponent(msgTemplate));
        } else {
          a.href = mUrl;
        }
        updateMessengerIcon(a, mUrl);
        if (spanWithDataRu) {
          if (!serverInjected) {
            var newLabelRu = tgMsg.button_label_ru;
            var newLabelAm = tgMsg.button_label_am;
            if (newLabelRu) spanWithDataRu.setAttribute('data-ru', newLabelRu);
            if (newLabelAm) spanWithDataRu.setAttribute('data-am', newLabelAm);
            var currentLangText = spanWithDataRu.getAttribute('data-' + lang);
            if (currentLangText && spanWithDataRu.tagName !== 'INPUT') spanWithDataRu.textContent = currentLangText;
          } else {
            if (tgMsg.button_label_am && !spanWithDataRu.getAttribute('data-am')) {
              spanWithDataRu.setAttribute('data-am', tgMsg.button_label_am);
            }
          }
        }
      });
      
      // Also update the contact form submit handler & popup form to use DB telegram URLs
      if (db.telegram.contact_form_msg) {
        window._tgContactUrl = db.telegram.contact_form_msg.telegram_url || '';
        window._tgContactTemplate = db.telegram.contact_form_msg.message_template_ru || '';
      }
      if (db.telegram.popup_form_msg) {
        window._tgPopupUrl = db.telegram.popup_form_msg.telegram_url || '';
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
                if (dbBtnNew.url && dbBtnNew.url.charAt(0) === '#') { newBtn.removeAttribute('target'); } else { newBtn.setAttribute('target', '_blank'); }
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
                if (dbBtn2.url && dbBtn2.url.charAt(0) === '#') { eBtn.removeAttribute('target'); } else { eBtn.setAttribute('target', '_blank'); }
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
    
    // Final safety: re-apply language to any newly-created/modified elements
    // When __SITE_DATA is inlined, loadSiteData runs synchronously in <head>
    // BEFORE <body> is parsed — bottom nav, footer etc. don't exist in DOM yet.
    // Defer switchLang until the full DOM is available.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { switchLang(lang); });
    } else {
      switchLang(lang);
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
      '<input type="text" id="pdfClientName" placeholder="' + (lang==='am' ? 'Անուն *' : 'Имя *') + '" data-placeholder-ru="Имя *" data-placeholder-am="Անուն *" style="padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:0.9rem;outline:none;width:100%">' +
      '<input type="tel" id="pdfClientPhone" placeholder="' + (lang==='am' ? 'Հեռախոս *' : 'Телефон *') + '" data-placeholder-ru="Телефон *" data-placeholder-am="Հեռախոս *" style="padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text);font-size:0.9rem;outline:none;width:100%">' +
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
    var iti = window._iti_pdf;
    var clientPhone = '';
    var phoneValid = false;
    if (iti && typeof iti.isValidNumber === 'function') {
      phoneValid = iti.isValidNumber();
      clientPhone = phoneValid ? iti.getNumber() : (phoneInput.value || '').trim();
    } else {
      clientPhone = (phoneInput.value || '').trim();
      phoneValid = clientPhone.replace(/\D/g, '').length >= 7;
    }

    if (!clientName || !phoneValid) {
      errDiv.style.display = 'block';
      if (!clientName && !phoneValid) {
        errDiv.textContent = lang === 'am' ? 'Լրացրեք անունը և ճիշտ հեռախոսահամար' : 'Укажите имя и корректный номер телефона';
      } else if (!clientName) {
        errDiv.textContent = lang === 'am' ? 'Լրացրեք անունը' : 'Укажите имя';
      } else {
        errDiv.textContent = lang === 'am' ? 'Մուտքագրեք ճիշտ հեռախոսահամար' : 'Введите корректный номер телефона';
      }
      if (!clientName) nameInput.style.borderColor = '#EF4444';
      if (!phoneValid) phoneInput.style.borderColor = '#EF4444';
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
      body: JSON.stringify({ items: items, total: parseInt(totalVal)||0, lang: lang, currency: (lang === 'ru' ? 'rub' : 'amd'), clientName: clientName, clientContact: clientPhone, referralCode: refCode, package: pkgData })
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
