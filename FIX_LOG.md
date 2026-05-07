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
