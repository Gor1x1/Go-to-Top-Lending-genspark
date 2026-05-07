# 🔧 Лог исправлений CRM "Go to Top"
**Дата:** 2026-03-15
**Ветка:** fix/audit-bugs
**Деплой:** ✅ Production (gototop.win)

---

## Исправленные баги

### ✅ BUG-001: Expense multiplier_monthly в auto-close-month
**Файл:** `src/api/routes/admin-crm-extended.ts`
**Что было:** Снапшоты записывали полную сумму годовых расходов вместо месячной
**Что стало:** Добавлен JOIN к expense_frequency_types, расходы умножаются на multiplier_monthly

### ✅ BUG-002: YTD через итерацию по месяцам
**Файл:** `src/api/routes/admin-finance.ts`
**Что было:** YTD = текущий месяц × количество месяцев (неточно при изменениях ЗП)
**Что стало:** YTD итерирует по каждому месяцу fiscal year и суммирует реальные значения

### ✅ BUG-004: Revenue reconciliation в auto-close
**Файл:** `src/api/routes/admin-crm-extended.ts`
**Что было:** Снапшот мог расходиться с SUM(total_amount)
**Что стало:** Добавлена сверка с ground truth и коррекция services

### ✅ BUG-005: Salary-summary фильтр по hire_date/end_date
**Файл:** `src/api/routes/admin-crm-extended.ts`
**Что было:** Считались ВСЕ активные ЗП, даже если сотрудник ещё не начал
**Что стало:** Фильтрация по hire_date <= end_of_month AND end_date >= start_of_month

### ✅ BUG-006: Скидка применяется только к услугам
**Файл:** `src/api/routes/admin-site-blocks.ts`
**Что было:** Math.max(0, subtotal + package - discount) — скидка могла "съесть" артикулы
**Что стало:** servicesAfterDiscount = Math.max(0, services - discount) + articles + packages

### ✅ BUG-007: Комиссии — revenue_with_commissions
**Файл:** `src/api/routes/admin-finance.ts`
**Что было:** Комиссии показывались отдельно, не включены в выручку
**Что стало:** Добавлено поле revenue_with_commissions в P&L output

### ✅ BUG-008: Кредитные платежи — факт vs план
**Файл:** `src/api/routes/admin-finance.ts`
**Что было:** MAX(actual, plan) — всегда использовал большее значение
**Что стало:** Если есть фактические платежи → используются они, иначе план

### ✅ BUG-009: Дивиденды — налог при amount=0
**Файл:** `src/api/routes/admin-finance.ts`
**Что было:** tax_amount принудительно 0 если amount=0
**Что стало:** tax_amount всегда учитывается (для корректирующих записей)

### ✅ Доп: Expense multiplier в salary-summary
**Файл:** `src/api/routes/admin-crm-extended.ts`
**Что было:** Расходы в salary-summary без multiplier_monthly
**Что стало:** JOIN к frequency_types, расходы × multiplier

---

## Верификация P&L каскада (Март 2026)

| Строка | Значение | Статус |
|--------|---------|--------|
| Выручка | 6,129,897 ֏ | ✅ |
| COGS | 253,249 ֏ | ✅ |
| Валовая | 5,876,648 ֏ | ✅ |
| OPEX | 1,327,318 ֏ | ✅ |
| EBIT | 4,549,330 ֏ | ✅ |
| EBITDA | 4,593,186 ֏ | ✅ |
| EBT | 4,446,380 ֏ | ✅ |
| Налоги | 293,995 ֏ | ✅ |
| Net Profit | 4,152,385 ֏ | ✅ |
| После кредитов | 3,795,385 ֏ | ✅ |
| Нераспределённая | 3,637,885 ֏ | ✅ |

**ВСЕ РАСЧЁТЫ СХОДЯТСЯ** ✅

---

## Phase 3C — CMS-интеграция подстраниц (2026-05-07)

**Контекст:** финальная фаза мульти-страничной миграции (Phase 1 — 6 подстраниц, Phase 2 — реальный контент, Phase 3A — polish, Phase 3B — 6 карточек на главной, **Phase 3C — CMS**).

### Подход
**Soft enforcement** через префикс `<page>__<key>` в `block_key`. Без schema-миграции: existing UNIQUE на `block_key` гарантирует уникальность; колонка `page` заполняется попутно.

### Изменения по файлам
- **`src/api/routes/admin-site-blocks.ts`** — новый эндпоинт `POST /site-blocks/seed-subpages` (idempotent, `INSERT OR IGNORE`); 15 TIER-1 блоков для 6 подстраниц; защита `import-from-site` от удаления подстраничных блоков.
- **`src/routes/landing.ts`** — экспортирован helper `loadSubpageBlocks(db, pagePrefix)` + interface `SubpageBlock`; 6 render-функций (`about/services/buyouts/faq/contacts/referral`) расширены опциональным `pageBlocks?`; локальный `tb(blockKey, idx, fallbackRu, fallbackAm)` с авто-фолбэком; FAQ items override через `faq__items` (12 пар Q+A); HTML-эскейп CMS-контента в FAQ-аккордеоне (защита от admin-stored XSS).
- **`src/routes/public-api.ts`** — фильтр подстраничных блоков из `/api/site-data` через SQL `LIKE … ESCAPE '\\'` + JS belt-and-suspenders.
- **`src/admin/sections/panel-site-blocks.ts`** и **`src/admin/panel.ts`** — чипсы-фильтр страниц (Все/Главная/Услуги/Выкупы/О нас/FAQ/Контакты/Партнёрка) с counts; бейджи страницы на карточках; спец-редактор `faq__items` (12 пар Q+A с +/−); кнопка «Создать блоки подстраниц» → `seedSubpageBlocks()`.

### Acceptance criteria — все ✅
- Build passes (`npm run build`, `dist/_worker.js` ≈ 2 161 KB)
- Маркеры в бандле: `seed-subpages`, `faq__items`, все `<page>__hero` ключи, `seedSubpageBlocks`, `sbPageFilter`, `SUBPAGE_LABELS`, `ESCAPE` clauses
- Регрессии не задеты: `__SITE_DATA` (калькулятор), `HTMLRewriter`, `data-section-id`, `FAQPage`/`BreadcrumbList` JSON-LD, `telegram_messages`, `calculator_packages`/`calculator_services`
- Seed-значения **точно совпадают** с фолбэками в `landing.ts` (нет визуального диффа после seed)
- FAQ-аккордеон HTML-эскейпит CMS-input

### Edge cases
- `loadSubpageBlocks` возвращает `{}` на любую ошибку БД → render отдаёт фолбэк.
- `INSERT OR IGNORE` гарантирует idempotency seed (повторный вызов = `inserted: 0`).
- Home-блоки (без `__`) не затрагиваются — все существующие фичи (HTMLRewriter, calculator) работают как раньше.
- `about__story` отложен (MVP: 15 блоков вместо 16; admin может добавить вручную через "+ Новый блок").

### Деплой
- `CACHE_VERSION` bump'нут `v16 → v17` (`src/lib/cache-config.ts`) для сброса edge-кеша `CACHEABLE_PATHS` после деплоя.

---

## Phase 4 — единая навигация на подстраницах (2026-05-07)

**Контекст / решение пользователя:** старый лендинг (`/`, `/am`, `/ru`) пока остаётся как есть; на 6 подстраницах (`/about`, `/services`, `/buyouts`, `/faq`, `/contacts`, `/referral`) делаем «полноценный сайт» с единой навигацией, ведущей на сами подстраницы (а не якоря главной). После завершения Phase 5/6 главная будет переключена на новую версию в стиле подстраниц, старый лендинг — отключён.

**Изменения в `src/routes/landing.ts` (renderPageShell):**
1. **Top nav (8 пунктов, все ведут на подстраницы):** О нас → `/about`, Услуги → `/services`, Выкупы → `/buyouts`, Калькулятор → `/services#calculator`, FAQ → `/faq`, Контакты → `/contacts`, Бонусы → `/referral`, Блог → `/blog`. Каждый пункт текущей страницы получает серверный `class="active" aria-current="page"`.
2. **CSS:** добавлено правило `.nav-links a.active` (фиолетовый текст + полупрозрачный фиолетовый фон, font-weight 600), визуально выделяет открытую страницу.
3. **Bottom nav (mobile):** «Выкупы» переставлены ВПЕРЁД калькулятора чтобы порядок совпадал с верхней (О нас → Услуги → Выкупы → Калькулятор), AM-перевод исправлен на `Հետագնումներ` (множественное, было `Հետգնում`); в «More»-меню добавлен Блог. В сумме bottom — 4 видимых + 5 в меню «Ещё», полностью покрывает top nav + Главная.

**Старая ситуация (что заменено):** хардкод в renderPageShell на строках 391-400 содержал 8 пунктов вида `href="/#about"`, `/#services`, `/#warehouse`, `/#guarantee` и т.д. Все они уводили клиента ОБРАТНО на главную и скроллили к anchor'у — и это, в сочетании с багом click-handler'a (см. hotfix-2), создавало впечатление «навигация не работает / два разных сайта».

**Acceptance:**
- `npm run build` — OK (`dist/_worker.js` ≈ 2 162 KB)
- v20 присутствует в бандле
- Dev-сервер `localhost:8788` рендерит корректно: `/about`, `/services`, `/buyouts`, `/faq`, `/contacts`, `/referral` каждая отдаёт `class="active" aria-current="page"` ровно на своём пункте
- Cache bump `v19 → v20` в `src/lib/cache-config.ts`

**Что осталось (Phase 5/6 — будущие коммиты):**
- Phase 5: извлечь все RU+AM тексты со старого лендинга в структурированный формат + создать новую `/` в стиле подстраниц со всеми блоками главной (hero / about / services / calculator / guarantees / FAQ / contacts).
- Phase 6: переключить роутинг на новую главную; ретайр старый лендинг (либо оставить под алиасом `/legacy`).

---

## Phase 3C-hotfix-2 — клики по навигации не работали на подстраницах (2026-05-07)

**Симптом (репорт пользователя):** на `/buyouts` (и на любой другой подстранице) пункты header-навигации (`Մեր մասին`, `Ծառայություններ`, `Հաշվիչ`, `Բլոգ` и т.п.) не реагируют на клик — браузер никуда не уходит, переходить пользователь может только вручную через адресную строку.

**Корневая причина:** обработчик кликов по `.nav-links a` в `public/static/landing.js` (строки ~282–301) безусловно вызывал `e.preventDefault()` для всех ссылок, у которых нет `target="_blank"` или префикса `http`, а затем смотрел только на `href.startsWith('#')` (одностраничные якоря) для smooth-скролла. На подстраницах все пункты nav имеют вид `href="/#about"`, `/#services`, `/blog` — то есть начинаются с `/`, а не с `#`. В итоге `preventDefault()` блокировал переход, а условие smooth-скролла не срабатывало → клик «уходил в никуда».

**Файл:** `public/static/landing.js`

**Что исправлено:** обработчик переписан так, что `preventDefault()` теперь вызывается **только** для одностраничных якорей (`href.startsWith('#')`). Внешние ссылки (`target="_blank"` или `http`) и cross-page ссылки (`/`, `/about`, `/services`, `/#about`, `/blog`, `/contacts`, `/referral`, `/faq`, `/buyouts`) теперь корректно отдаются браузеру для нормальной навигации, мобильное меню при этом закрывается через `closeMenu()`.

**Acceptance:**
- `node -c public/static/landing.js` — OK
- `npm run build` — OK (`dist/_worker.js` ≈ 2 161 KB), `v19` присутствует в бандле
- Внутри handler-функции `Cross-page links` упоминается ровно 1 раз → дубль не попал
- Ни одна другая часть навигации (smooth-scroll внутри home, dynamic CMS-driven nav rebuild на home, footer-nav rebuild) не задета — у них собственные обработчики на `a[href^="#"]`

**Cache bump:** `CACHE_VERSION` `v18 → v19` (`src/lib/cache-config.ts`).

---

## Phase 3C-hotfix — счётчики на /buyouts (2026-05-07)

**Симптом:** на live `/buyouts` счётчики hero-секции (500, 1 000+, 21, 200+) застревают в начальном состоянии `0 / 0+ / 0 / 0+`. На главной аналогичные `.stat-big[data-count-s]` работают, потому что страница помечается `<html class="server-injected">` и блоки получают `.section-revealed` мгновенно. На подстраницах этого класса нет → CSS `.stats-bar{opacity:0}` держит контейнер невидимым, а `forceRunCounters()` хоть и стартует, но реально завершить анимацию мог не успеть до того, как пользователь делал скриншот / уходил со страницы (а в редких race-кейсах rAF на уже невидимом элементе вообще не отрабатывал).

**Файл:** `public/static/landing.js`

**Что сделано (две страховки + bump кеша):**
1. **`immediateReveal()`** теперь умеет работать и для подстраниц: если у `<main>` есть `data-page` ≠ `home`, мы сразу же ставим `section-revealed` на `div.wb-banner`, `div.stats-bar`, `div.ticker`, `div.slot-counter-bar`. Это снимает зависимость от завершения `loadSiteData` и от 8-секундного safety-fallback'a — hero и stat-bar становятся видимы с первого кадра рендера.
2. **«Ultimate counter fallback»** — новый `setTimeout(..., 3000)` после `forceRunCounters`: если через 3 секунды у любого `.stat-num[data-count]` или `.stat-big[data-count-s]` числовая часть всё ещё `'0'` при положительном `target`, мы форсированно подставляем финальное число (`target.toLocaleString('ru-RU') + '+'?`), сохраняя плюс из исходного `textContent`. Анимации не будет, но «нолика» — точно тоже.
3. `CACHE_VERSION` поднят `v17 → v18` чтобы Cloudflare edge не отдавал старую страницу с кешем.

**Acceptance:**
- `node -c public/static/landing.js` — OK
- `npm run build` — OK (`dist/_worker.js` ≈ 2 161 KB)
- В бандле виден `v18` (1 occurrence в `CACHE_VERSION`); в `landing.js` — `ULTIMATE COUNTER FALLBACK` (1) и `isSubpage` (4).
- Никаких изменений в `index.tsx`, `admin/*`, `db.ts`, `pdf.ts`. Поведение главной не задето: ветка `isServerInjected` без изменений.
