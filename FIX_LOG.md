# 🔧 Лог исправлений CRM "Go to Top"
**Дата:** 2026-03-15
**Ветка:** fix/audit-bugs
**Деплой:** ✅ Production (gototop.win)

---

## Phase 5c — нав-фиксы + страница /calculator + контактный блок (2026-05-07)

**Кэш:** CACHE_VERSION `v22 → v24` (бамп позволяет очистить edge-cache на /home, /calculator, /blog).
**Файлы:** `src/routes/landing.ts`, `src/routes/blog.ts`, `src/index.tsx`, `src/lib/cache-config.ts`, `public/static/landing.js` (cache-busting только).

### 1) Счётчики на /home всё ещё стояли на 0
- К URL `/static/landing.js` теперь приклеивается `?v=${CACHE_VERSION}` — браузер берёт свежий бандл при каждом бампе версии (раньше Cloudflare/браузер мог отдавать кэш).
- В `renderNewHomePage` добавлен инлайн-`<script>` запасной триггер: проходит по всем `.stat-num[data-count]` и `.stat-big[data-count-s]` и анимирует их на `requestAnimationFrame` через 100ms и 800ms после парса HTML, независимо от того, успел ли загрузиться внешний `landing.js`. Идемпотентен — `data-counter-done="1"` метит уже отработанные элементы.

### 2) В навигации не было ссылки «Главная»
- В `renderPageShell` (топ-нав + bottom-nav-more) добавлена позиция «Главная» с `href="/home"` и автоподсветкой `class="active"`, когда текущая страница — `home-new` (т.е. URL `/home`).
- Бонусы переехали из топ-нава в bottom-nav-more, чтобы топ-нав влез без переноса (8 пунктов: Главная / О нас / Услуги / Выкупы / Калькулятор / FAQ / Контакты / Блог).

### 3) Кнопка «Калькулятор» в навигации перебрасывала на /services
- В `landing.ts` создана функция `renderCalculatorPage` и зарегистрирован отдельный маршрут `app.get('/calculator')` с тем же `__SITE_DATA`-инжекшном, что и `/services` и `/buyouts`. Калькулятор работает идентично, но теперь это самостоятельная страница с собственным URL и активным пунктом нав-меню.
- Из `src/index.tsx` (PAGE_SECTIONS map) удалён legacy-редирект `/calculator → /#calculator` — он перехватывал запросы раньше нашего нового маршрута.
- Все ссылки в нав-меню/bottom-nav/Hero CTA обновлены: `/services#calculator → /calculator`.
- В `CACHEABLE_PATHS` добавлен `/calculator`, чтобы edge-кэш Cloudflare обслуживал страницу.

### 4) /calculator теперь красивая, с пакетами и тематическими блоками
Страница состоит из:
- **Hero** — бейдж «Калькулятор», заголовок «Рассчитайте стоимость продвижения», описание + 4 фичи-чипса (мгновенный расчёт / готовые пакеты / без скрытых комиссий / промокод).
- **Секция «Готовые пакеты + индивидуальный расчёт»** — заголовок и подзаголовок, ниже `.calc-wrap`, в котором первым идёт `.calc-packages` (пакеты `Базовый` / `Продвинутый` / `Максимальный` подгружаются клиентом из `window.__SITE_DATA.packages` — те же данные, что в `/services` и в админке).
- **Сам калькулятор** — табы (Выкупы / Отзывы / Фотосъёмка / ФФ / Логистика / Прочие), `.calc-total`, поле промокода `#refCodeInput`, CTA на WhatsApp. Логика 1:1 как на `/services`, потому что использует тот же `landing.js`.
- **Секция «Как пользоваться»** — три карточки (выбрать пакет / собрать вручную / ввести промокод).
- **CTA-strip** — три кнопки: WhatsApp / Telegram / «Перезвоните мне».

Армянский перевод всех текстов прописан в data-am, SEO title/description тоже двуязычны.

### 5) /home: блок «Свяжитесь с нами» сверху футера (WhatsApp-вариант блока с /services)
- В `renderNewHomePage` после секции «Why this works» добавлена секция `.nh-contact-cta` с двумя колонками: текст слева (бейдж «Свяжитесь с нами» / заголовок «Готовы вывести ваш товар в ТОП?» / текст про WhatsApp и обратный звонок) и три кнопки справа: зелёный WhatsApp, «Перезвоните мне», «Все контакты».
- В `extraHead` добавлены стили `.nh-contact-cta`, `.nh-contact-card`, `.nh-btn-whatsapp` (зелёный градиент 25D366 → 128C7E).

### 6) /blog: навигация перестала ломаться (мешанина армянских/латинских символов)
- Файл `src/routes/blog.ts` полностью переписан: убран собственный `sharedHead` / `sharedNav` / `sharedFooter` со сломанными транслитерациями (`Bok`, `Ogt`, `statyas`, `Կanxareq ints` и т.д.).
- `/blog` и `/blog/:slug` теперь рендерятся через единый `renderPageShell` (импортирован из `landing.ts`), значит шапка / футер / язык-свитчер / попап-обратного-звонка / bottom-nav идентичны всем остальным подстраницам сайта.
- Все армянские строки переписаны корректно: `Բլոգ`, `Հոդվածներ`, `Կարդալ →`, `Վերադառնալ բլոգ`, `Հետ զանգահարեք` и т.д.
- Активный пункт «Блог» в нав-меню подсвечивается на обоих маршрутах.

### Acceptance
- `/home` → счётчики анимируются на загрузке; нав имеет «Главная» (active); ссылка «Калькулятор» ведёт на `/calculator`; над футером — блок WhatsApp-контактов.
- `/calculator` → отдельная страница (не редирект), показывает Hero + Готовые пакеты + калькулятор + «Как пользоваться» + CTA.
- `/blog` (RU и AM) → нав без транслитераций, активный пункт «Блог» подсвечен.
- Сборка `npm run build` прошла, `dist/_worker.js` собран, локальные curl-проверки — все три страницы 200 OK с ожидаемым содержимым.

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

## Phase 5 — staging новой главной на /home-new (2026-05-07)

**Контекст:** старый лендинг `/` остаётся неприкосновенным. Параллельно собираем новую главную в стиле подстраниц на `/home-new` для проверки. После одобрения Phase 6 переключит роутинг — `/` начнёт отдавать новый рендер, старый монолит уходит в `/legacy` (или удаляется).

**Архитектура `renderNewHomePage`:**
- Использует `renderPageShell` с `page: 'home-new'` (тип расширен в `renderPageShell`); единая шапка/подвал/нижняя нав/JS как у других подстраниц.
- 7 секций: hero (eyebrow + 2-line gradient h1 + 3 stat counters + 2 CTA + photo+badge), ticker (12 пар bilingual badges), stats-bar (4 крупных счётчика), services-short (3 карточки услуг с буллетами + CTA), guarantee (текст + 3 буллета + 0-блокировок-бейдж + warehouse-фото), team-qrs (4 social-карточки 4-колоночная сетка), faq-short (top-3 вопроса в существующем `.faq-item`-стиле + ссылка на `/faq`).
- Все тексты идут через `tb('home_<key>', idx, fallbackRu, fallbackAm)` хелпер: сначала смотрит CMS-блок с ключом `home_<key>`, иначе hardcoded fallback из старого лендинга. Это значит, что админ позже сможет редактировать тексты главной через Site Blocks.
- CSS изолирован под префиксом `.nh-*`, не задевает классы старого лендинга.
- `__SITE_DATA` injection как у `/services` и `/buyouts` (даже если калькулятор сейчас не на главной — задел для будущего).
- BreadcrumbList JSON-LD с одним node (Главная).

**Тексты извлечены автоматически:** через codebase-explorer субагента из `src/routes/landing.ts` (~4410-5275), `src/seed-data.ts` (`SEED_CONTENT_SECTIONS`), `src/api/routes/admin-site-blocks.ts` (импорт из site_content). Все RU + AM пары верифицированы.

**Acceptance:**
- `npm run build` — OK (`dist/_worker.js` 2 162 KB → 2 194 KB, +32 KB на новую функцию)
- v21 присутствует в бандле
- Dev-сервер: `GET /home-new` → 200 OK, рендерит все 7 секций, RU и AM версии корректны
- `<title>` в RU: "Go to Top — продвижение на Wildberries для армянских продавцов"
- Изображения: hero `/static/img/team-new.jpg`, warehouse `/static/img/warehouse1.jpg`, QR-коды `/static/img/qr/qr-*.png` — все существующие пути

**Cache bump:** `v20 → v21` в `src/lib/cache-config.ts`.

---

## Phase 5b — переделана новая главная под скриншоты + переезд на /home (2026-05-07)

**Проблема:** владелец проверил `/home-new` и сказал, что подтянулись неправильные блоки — в первом блоке вместо ожидаемых "фото справа + 4 QR-кода под фото" и единого визуала со старым лендингом получилась смешанная композиция (фото отдельно, QR-секция отдельно ниже). Также не нравились 3 одинаковых фиолетовых кнопки в карточках услуг и отсутствие секции "Почему это работает" с 6 шагами.

**Запрос:** скопировать с точностью все блоки из 3 присланных скриншотов и переименовать `/home-new` → `/home`.

**Что сделано:**
- Полностью переписан `renderNewHomePage` в `src/routes/landing.ts` — старая `.nh-*` реализация удалена (~330 строк), на её место помещён 1:1 копировальный перенос разметки и CSS из легаси `app.get('/')` (lines 4812–5158 + соответствующие `<style>` блоки).
- 6 секций под скриншоты в нужном порядке:
  1. **Hero** — `.hero-grid` CSS-Grid с `title/photo/texts/stats/buttons` areas; слева eyebrow, h1, описание, 3 hero-stats (847/0/1000), 2 CTA; справа `.hero-photo-wrap` с фото + `.hero-badge-img` и под фото `.qr-codes-grid` с 4 QR-карточками (Instagram/Telegram/Facebook/WhatsApp).
  2. **Ticker** — `.ticker-track` уже SSR-заполнен 8×2 пунктами с FA-иконками и data-ru/data-am (синхронно с `landing.js`).
  3. **WB banner** — pink/purple `.wb-banner-card` слева ("WB официально отменил штрафы за выкупы!") + правый `.wb-banner-right` с rocket-emoji и кнопкой "Узнать".
  4. **Stats-bar** — 4 крупных счётчика 500/1000+/21/200+ (`data-count-s` хвост, обрабатывается `forceRunCounters()` в `landing.js`).
  5. **Services** — 3 карточки `.svc-card` с разными CTA: 1) `btn-tg` (синяя) "Повысить рейтинг", 2) `btn-success` (зелёная) "Начать продвижение", 3) `btn-primary` (фиолетовая) "Активировать ключевые".
  6. **Why-buyouts** — `.why-block` контейнер с h3, описанием и 6 пронумерованными `.why-step` карточками (auto-fit grid), внизу `.highlight-result` с "Результат: повышаются ВСЕ конверсии…" и финальная `.section-cta` с warning-кнопкой "Начать выкупы".
- Удалены устаревшие секции, которых нет на скриншотах: guarantee (warehouse photo), team-qrs (отдельная секция), faq-short — QR-карточки теперь только в hero, FAQ доступен через хедер-навигацию `/faq`.
- CSS-блок переписан — теперь использует точные классы старого лендинга (`.hero`, `.hero-grid`, `.hero-badge`, `.hero-image`, `.qr-codes-grid`, `.qr-card`, `.ticker`, `.wb-banner`, `.stats-bar`, `.services-grid`, `.svc-card`, `.svc-features`, `.why-block`, `.why-steps`, `.why-step-num`, `.highlight-result`, `.btn-tg`, `.btn-success`, `.btn-warning`) с точно теми же значениями (цвета, отступы, медиа-запросы), что в `app.get('/')`. CSS поставляется через `extraHead` в `renderPageShell`, не пересекается с легаси-лендингом потому что тот рендерится из другого роута (`/`).
- Роут переименован: `app.get('/home-new', …)` → `app.get('/home', …)`. Тип `page: 'home-new'` сохранён внутри `renderPageShell` для типобезопасности, но `path` теперь маппится на `/home`.
- `bodyClass: 'home-new-page'` → `'home-page'`.
- `/home` добавлен в `CACHEABLE_PATHS` в `src/lib/cache-config.ts`.

**Acceptance:**
- `npm run build` — OK, бандл `dist/_worker.js` собирается без ошибок (~2 206 KB).
- `GET /home` → 200 OK, AM/RU варианты оба корректны, рендерится `<title>`, hero с photo+QR, ticker, wb-banner, stats-bar, services с 3 разноцветными кнопками, why-buyouts с 6 шагами.
- `GET /home-new` → 404 (старый путь убран).
- В HTML: 22 references на hero-photo-wrap/qr-codes-grid/qr-card, 4 на ticker, 7 на stats-bar, 14 на wb-banner, 6 на 3 разные btn-варианта услуг, 11 на why-step-num.
- AM проверка: армянские заголовки шагов ("Որոնում բանալի բառով", "Քարտի դիտարկում", "Աշխատանք կարծիքների հետ", "Մրցակիցների ավելացում", "Մրցակիցների հեռացում", "Պատվեր և ստացում") и кнопок ("Բարձրացնել վարկանիշը", "Սկսել առաջխաղացումը", "Ակտիվացնել բանալիները") совпадают со скриншотами 1:1.
- Highlight-result строка для AM: "Արդյունքում՝ ձեր ապրանքը բարձրանում է 3-4-րդ էջերից և ամրապնդվում է TOP-ում 7-ից 14 օրերի ընթացքում՝ ձեր բանալի բառերով…" — точная строка со скриншота 3.
- `tb()` хелпер сохранён (с `void tb` чтобы не было unused-предупреждения) — позже можно подключить CMS-overrides без рефакторинга.

**Cache bump:** `v21 → v22`.

**Что осталось (Phase 6 — после финального одобрения `/home` владельцем):**
- Переключить `app.get('/')` чтобы он вызывал `renderNewHomePage` вместо старого монолитного рендера.
- Старый лендинг переместить в `/legacy` (или удалить, если не нужен).
- Обновить sitemap/robots, JSON-LD canonical URLs.

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
