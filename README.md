# Go to Top — CRM + Landing + Admin Panel

## Обзор проекта
- **Название**: Go to Top — Продвижение на Wildberries (Армения)
- **Цель**: Полноценная CRM-система + лендинг + калькулятор услуг + PDF-генерация счетов + бизнес-аналитика
- **Платформа**: Cloudflare Pages + D1 (SQLite на edge)
- **Языки**: Русский (RU) + Армянский (AM), частично English

---

## 🌐 URLs

| Ресурс | URL |
|--------|-----|
| **Продакшн сайт (лендинг)** | https://gototop-lending.pages.dev |
| **Админ-панель** | https://gototop-lending.pages.dev/admin |
| **PDF-счет (пример)** | https://gototop-lending.pages.dev/pdf/1 |
| **GitHub** | https://github.com/Gor1x1/Go-to-Top-Lending-genspark |
| **Cloudflare Dashboard** | https://dash.cloudflare.com → Pages → gototop-lending |

> **Примечание**: Cloudflare Pages проект называется `gototop-lending`, но в `wrangler.jsonc` name = `gototop-wb` (это legacy-имя Workers).

---

## 🔐 Доступ к админ-панели

| Поле | Значение |
|------|----------|
| **URL** | `/admin` |
| **Логин** | `admin` |
| **Пароль** | `gototop2026` |
| **Аутентификация** | JWT (SHA-256 HMAC, Web Crypto API) |
| **Срок токена** | 7 дней |

> ⚠️ **Смените пароль при первом входе!** Настройки → Смена пароля

---

## 🏗️ Архитектура и стек технологий

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Pages (Edge)                       │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Hono (TS)   │───▶│  D1 (SQLite) │    │  Static Assets   │  │
│  │  Backend API │    │  35+ таблиц  │    │  /public/static/ │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│         │                                                       │
│  ┌──────┴──────────────────────────────────────────────────┐   │
│  │  Routes: /, /admin, /pdf/:id, /api/*                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

| Компонент | Технология |
|-----------|-----------|
| **Backend** | Hono 4.x (TypeScript) на Cloudflare Workers |
| **Frontend (лендинг)** | Vanilla HTML/CSS/JS + TailwindCSS (CDN) |
| **Admin panel** | SPA на чистом JS (single-page, `src/admin/panel.ts`) |
| **Database** | Cloudflare D1 (`gototop-production-eu`) |
| **Auth** | JWT + SHA-256 HMAC (Web Crypto API) |
| **Build** | Vite + @hono/vite-build |
| **Deploy** | Wrangler CLI → Cloudflare Pages |
| **Уведомления** | Telegram Bot API |

---

## 📁 Структура проекта

```
webapp/
├── src/
│   ├── index.tsx              # Главный entry point — все публичные роуты
│   │                          # (лендинг, калькулятор, PDF, lead-формы, tracking)
│   ├── api/
│   │   └── admin.ts           # Все API-эндпоинты админки (~3900 строк)
│   │                          # (CRUD контента, калькулятора, лидов, аналитики,
│   │                          #  кредитов, сотрудников, расходов, налогов и т.д.)
│   ├── admin/
│   │   └── panel.ts           # SPA-код админ-панели (~8500 строк)
│   │                          # (весь UI, логика, рендер, валидация)
│   ├── lib/
│   │   ├── db.ts              # Инициализация D1 БД, все CREATE TABLE + миграции
│   │   └── auth.ts            # JWT авторизация, хеширование паролей
│   ├── renderer.tsx           # Hono HTML renderer (если нужен)
│   └── seed-data.ts           # Начальные данные для лендинга
├── public/
│   └── static/
│       └── style.css          # Дополнительные CSS-стили
├── migrations/
│   └── 0001_initial_schema.sql # SQL-миграция (структура)
├── seed.sql                   # Тестовые данные для локальной разработки
├── seed-production.sql        # Данные для продакшна
├── ecosystem.config.cjs       # PM2 конфигурация (для sandbox dev)
├── wrangler.jsonc             # Cloudflare Workers конфигурация
├── vite.config.ts             # Vite build конфигурация
├── tsconfig.json              # TypeScript конфигурация
├── package.json               # Зависимости и скрипты
└── .gitignore                 # Игнорируемые файлы
```

---

## 🗄️ База данных (Cloudflare D1)

**Database name**: `gototop-production-eu`  
**Database ID**: `f49b080f-516f-4ed0-84e9-0efdea1e8a2a`

### Основные таблицы (35+):

| Таблица | Описание |
|---------|----------|
| `users` | Пользователи (admin, сотрудники) |
| `user_permissions` | Права доступа сотрудников |
| `site_content` | Контент сайта (тексты на RU/AM по секциям) |
| `site_blocks` | Блоки сайта (порядок, видимость) |
| `calculator_tabs` | Вкладки калькулятора |
| `calculator_services` | Услуги (цены, тарифные шкалы, порядок) |
| `telegram_messages` | Шаблоны Telegram-сообщений |
| `telegram_bot_config` | Настройки Telegram бота |
| `custom_scripts` | Скрипты аналитики (head/body) |
| `leads` | Лиды/заявки (клиенты, суммы, статусы) |
| `lead_comments` | Комментарии к лидам |
| `lead_articles` | Артикулы WB привязанные к лидам |
| `referral_codes` | Промокоды (скидки, лимиты, статистика) |
| `referral_free_services` | Бесплатные услуги по промокодам |
| `pdf_templates` | Шаблон PDF-счёта (мультиязычный) |
| `slot_counter` | Счётчик свободных мест |
| `section_order` | Порядок секций на лендинге |
| `footer_settings` | Настройки футера |
| `photo_blocks` | Блоки с фотографиями |
| `page_views` | Аналитика просмотров |
| `activity_log` | Лог действий |
| `activity_sessions` | Сессии активности сотрудников |
| `expenses` | Расходы (регулярные и разовые) |
| `expense_categories` | Категории расходов |
| `expense_frequency_types` | Типы частоты расходов |
| `loans` | Кредиты/займы |
| `loan_payments` | Платежи по кредитам |
| `dividends` | Дивиденды |
| `other_income_expenses` | Прочие доходы/расходы |
| `period_snapshots` | Снепшоты периодов (P&L) |
| `company_roles` | Должности сотрудников |
| `employee_bonuses` | Бонусы сотрудников |
| `employee_vacations` | Отпуска |
| `site_settings` | Общие настройки сайта |
| `tax_payments` | Налоговые платежи |
| `tax_rules` | Правила налогообложения |
| `assets` | Основные средства |
| `uploads` | Загруженные файлы |

---

## 🔗 API Endpoints

### Публичные (без авторизации)

| Method | Path | Описание |
|--------|------|----------|
| GET | `/` | Лендинг (полная HTML страница) |
| GET | `/admin` | Админ-панель (SPA) |
| GET | `/pdf/:id` | PDF-счёт по ID лида |
| GET | `/api/site-data` | Все данные для рендера сайта (контент, калькулятор, telegram) |
| GET | `/api/health` | Health check |
| GET | `/api/slots` | Текущий счётчик свободных мест |
| GET | `/api/footer` | Данные футера |
| GET | `/api/photo-blocks` | Фотоблоки |
| POST | `/api/lead` | Отправка лид-формы |
| POST | `/api/popup-lead` | Отправка popup-лида |
| POST | `/api/button-lead` | Отправка лида по кнопке |
| POST | `/api/generate-pdf` | Генерация PDF-счёта (возвращает URL) |
| POST | `/api/track` | Трекинг просмотров страниц |
| POST | `/api/referral/check` | Проверка промокода |

### Админ API (требует JWT в header `Authorization: Bearer <token>`)

Все эндпоинты ниже имеют префикс `/api/admin/`

| Method | Path | Описание |
|--------|------|----------|
| POST | `/login` | Логин (возвращает JWT) |
| POST | `/refresh-token` | Обновление JWT |
| POST | `/change-password` | Смена пароля |
| POST | `/init-db` | Инициализация/миграция БД |
| GET | `/bulk-data` | Все данные админки одним запросом |
| **Контент** | | |
| GET/PUT | `/content/:key` | CRUD контента сайта по ключу |
| POST | `/content` | Создать новый контент |
| DELETE | `/content/:key` | Удалить контент |
| **Калькулятор** | | |
| GET/POST | `/calc-tabs` | Вкладки калькулятора |
| PUT/DELETE | `/calc-tabs/:id` | Управление вкладкой |
| GET/POST | `/calc-services` | Услуги калькулятора |
| PUT/DELETE | `/calc-services/:id` | Управление услугой |
| PUT | `/calc-services-reorder` | Изменение порядка услуг (drag & drop) |
| **Telegram** | | |
| CRUD | `/telegram` | Шаблоны Telegram-сообщений |
| CRUD | `/telegram-bot` | Настройки Telegram бота |
| **Лиды** | | |
| GET | `/leads?limit=N` | Список лидов |
| GET | `/leads/export` | Экспорт лидов |
| GET | `/leads/analytics` | Аналитика лидов |
| POST | `/leads` | Создать лид вручную |
| PUT/DELETE | `/leads/:id` | Управление лидом |
| GET/POST | `/leads/:id/comments` | Комментарии к лиду |
| DELETE | `/leads/comments/:commentId` | Удалить комментарий |
| **Промокоды** | | |
| CRUD | `/referrals` | Промокоды |
| GET | `/referral-codes/check` | Проверка промокода |
| GET/POST/DELETE | `/referrals/:id/services` | Бесплатные услуги по промокоду |
| **Финансы** | | |
| GET | `/business-analytics?from=&to=` | Бизнес-аналитика (P&L, KPI, LTV) |
| CRUD | `/loans` | Кредиты |
| POST | `/loans/:id/payments` | Платежи по кредитам |
| CRUD | `/dividends` | Дивиденды |
| CRUD | `/other-income-expenses` | Прочие доходы/расходы |
| CRUD | `/expenses` | Расходы |
| GET/PUT | `/loan-settings` | Настройки кредитного модуля |
| **Сотрудники** | | |
| CRUD | `/users` (через bulk-data) | Пользователи |
| CRUD | `/users/:id/vacations` | Отпуска |
| GET | `/users/:id/earnings/:month` | Зарплата сотрудника за месяц |
| POST | `/activity/heartbeat` | Heartbeat активности |
| GET | `/activity/online` | Онлайн-статус сотрудников |
| **Налоги** | | |
| CRUD | `/tax-payments` | Налоговые платежи |
| CRUD | `/tax-rules` | Правила налогообложения |
| POST | `/tax-rules/generate/:periodKey` | Авто-генерация налогов за период |
| GET | `/tax-summary/:periodKey` | Сводка налогов за период |
| GET | `/pnl/:periodKey` | P&L отчёт за период |
| **Прочее** | | |
| GET/PUT | `/pdf-template` | Шаблон PDF-счёта |
| CRUD | `/slot-counter` | Счётчик слотов |
| CRUD | `/footer` | Настройки футера |
| CRUD | `/photo-blocks` | Фотоблоки |
| CRUD | `/scripts` | Кастомные скрипты |
| GET/PUT | `/section-order` | Порядок секций |
| CRUD | `/assets` | Основные средства |
| GET/PUT | `/settings` | Общие настройки |

---

## 🧮 Функционал

### Лендинг
- Мультиязычный (RU/AM) с переключателем
- Калькулятор услуг с тарифными шкалами (tiered pricing)
- Popup-форма (появляется через 5 сек)
- Интеграция Telegram/WhatsApp — прямая отправка заявки
- Счётчик свободных мест (реальный FOMO)
- Адаптивный дизайн (mobile-first)
- Анимации при скролле, счётчики
- Lightbox для изображений
- FAQ-блок

### PDF-генерация
- Генерация коммерческого предложения из калькулятора
- Мультиязычные шаблоны (RU/AM/EN)
- Промокоды и скидки
- Кастомизируемые поля через админку
- Скачивание через `window.print()` (с агрессивным скрытием плагинов)
- Автоматическое уведомление в Telegram при генерации

### Админ-панель (разделы)
1. 📊 **Дашборд** — KPI, конверсия, средний чек, ROI, ROMI, LTV, CAC
2. 📝 **Тексты сайта** — редактирование всех текстов на RU + AM (20+ секций)
3. 🧮 **Калькулятор** — вкладки, услуги, цены, тарифные шкалы (drag & drop)
4. 💬 **Telegram** — сообщения, бот, шаблоны (2 языка)
5. 📋 **Лиды** — CRM (статусы, комментарии, фильтры, экспорт)
6. 🎁 **Промокоды** — скидки, бесплатные услуги, лимиты использования
7. 💰 **Финансы** — P&L, расходы, доходы, кредиты, дивиденды, налоги
8. 👥 **Сотрудники** — роли, зарплаты, бонусы, отпуска, онлайн-статус
9. 📄 **PDF-шаблон** — настройка всех полей PDF-счёта
10. ⚙️ **Настройки** — общие, скрипты, футер, слоты

### Бизнес-аналитика
- Средний чек, маржинальность, ROI, ROMI
- LTV (формула: avg check × frequency × lifespan)
- CAC (стоимость привлечения клиента)
- Конверсия, % отказов
- Промо-аналитика (ТОП-5 промокодов, ROI промо)
- Кредитная нагрузка (долг/выручка, долг/прибыль)
- P&L отчёты по периодам

---

## 🚀 Как запустить локально

### Требования
- Node.js 18+
- npm

### Установка

```bash
git clone https://github.com/Gor1x1/Go-to-Top-Lending-genspark.git
cd Go-to-Top-Lending-genspark
npm install
```

### Локальная разработка

```bash
# 1. Сборка
npm run build

# 2. Запуск с локальной D1
npx wrangler pages dev dist --d1=gototop-production --local --ip 0.0.0.0 --port 3000

# Или через PM2 (рекомендуется)
pm2 start ecosystem.config.cjs
```

**Сайт**: http://localhost:3000  
**Админка**: http://localhost:3000/admin

### Через Vite (hot reload, без D1)

```bash
npm run dev
# Откроется http://localhost:5173
```

> ⚠️ `npm run dev` работает через Vite dev server БЕЗ D1 базы. Для полного функционала используйте `wrangler pages dev`.

---

## 📦 Deploy на Cloudflare Pages

### Первый деплой

```bash
# 1. Авторизация
export CLOUDFLARE_API_TOKEN=ваш_токен
npx wrangler whoami

# 2. Создание проекта (уже создан как gototop-lending)
npx wrangler pages project create gototop-lending --production-branch main

# 3. Создание D1 базы (уже создана)
npx wrangler d1 create gototop-production
# Скопировать database_id в wrangler.jsonc

# 4. Сборка и деплой
npm run build
npx wrangler pages deploy dist --project-name gototop-lending
```

### Обновление (повторный деплой)

```bash
npm run build
npx wrangler pages deploy dist --project-name gototop-lending
```

### Работа с D1 в продакшне

```bash
# Выполнить SQL
npx wrangler d1 execute gototop-production --command="SELECT COUNT(*) FROM leads"

# Применить миграции
npx wrangler d1 migrations apply gototop-production

# Сид данных
npx wrangler d1 execute gototop-production --file=./seed-production.sql
```

---

## ⚙️ Конфигурация

### wrangler.jsonc
```jsonc
{
  "name": "gototop-wb",
  "compatibility_date": "2026-02-15",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [{
    "binding": "DB",
    "database_name": "gototop-production",
    "database_id": "8b74a4aa-4685-48c4-9e99-eaa7d8aae3e2"
  }]
}
```

### Переменные окружения
Для локальной разработки создайте `.dev.vars`:
```
# Не требуется — все секреты захардкожены в коде
# (Telegram token, admin password, JWT secret)
# В будущем перенести в Cloudflare Secrets:
# ADMIN_PASSWORD=gototop2026
# JWT_SECRET=gtt-admin-jwt-secret-2026
# TELEGRAM_BOT_TOKEN=ваш_токен
```

---

## 🔧 Важные особенности для разработчика

### 1. Инициализация БД
При каждом запросе вызывается `initDatabase(db)` из `src/lib/db.ts`. Функция:
- Создаёт все таблицы (`CREATE TABLE IF NOT EXISTS`)
- Выполняет миграции (`ALTER TABLE ADD COLUMN` в try/catch)
- Создаёт дефолтного админа

> 💡 Если нужно добавить новый столбец — добавляй `ALTER TABLE` в конец `initDatabase()` в отдельном `try/catch`.

### 2. Тарифные шкалы (tiered pricing)
- Хранятся в `calculator_services.price_tiers_json` как JSON
- Формат: `[{"min":1,"max":20,"price":500},{"min":21,"max":40,"price":425}]`
- При рендере в HTML: кавычки экранируются как `&quot;` в `data-tiers` атрибуте
- Модель: flat-rate (вся qty × цена из подходящего тира), НЕ progressive

### 3. PDF-генерация
- POST `/api/generate-pdf` → создаёт лид в БД → возвращает `{ leadId, url }`
- GET `/pdf/:id` → рендерит полный HTML из лида + шаблона из БД
- `cleanAndPrint()` — перед печатью удаляет плагины/расширения браузера
- CSS `@media print` — скрывает всё кроме `#pc` контейнера

### 4. Админ-панель
- Один огромный SPA файл: `src/admin/panel.ts` (~8500 строк)
- Загрузка данных: `GET /api/admin/bulk-data` → все данные одним запросом
- Рендер: чистый JS (document.getElementById, innerHTML)
- Навигация: хеши (#) для переключения секций

### 5. Авторизация
- JWT с HMAC SHA-256 через Web Crypto API (без node:crypto)
- Middleware `authMiddleware` проверяет токен на каждом /api/admin/* запросе
- Refresh token: POST `/api/admin/refresh-token`
- Пароль и JWT_SECRET захардкожены в `src/lib/auth.ts` (⚠️ перенести в secrets!)

### 6. Cloudflare Workers ограничения
- ❌ Нет `fs`, `path`, `child_process` и других Node.js API
- ❌ Нет file system — всё хранится в D1
- ❌ CPU limit: 10ms free / 30ms paid
- ✅ Web APIs: fetch, crypto.subtle, TextEncoder, etc.
- ✅ Cloudflare D1 для данных

---

## ⚠️ Известные TODO / Технический долг

1. **Секреты** — перенести `ADMIN_PASSWORD`, `JWT_SECRET` из кода в Cloudflare Secrets
2. **Размер файлов** — `panel.ts` (8500 строк) и `index.tsx` (3600 строк) нужно разбить
3. **Типизация** — добавить TypeScript типы для D1 моделей
4. **Тесты** — нет unit/integration тестов
5. **Rate limiting** — нет защиты от brute-force на /login
6. **CORS** — настроить строже для production
7. **Кеш** — добавить кеширование `/api/site-data`
8. **Image upload** — загруженные изображения хранятся как base64/URL, нет R2

---

## 🤖 Cursor: субагенты (AI)

Субагенты — это Markdown-промпты в **[`.cursor/agents/`](.cursor/agents/)**. Cursor подхватывает их как кастомных агентов (см. [документацию](https://cursor.com/docs/subagents)). **`documenter`** при изменениях должен обновлять таблицу ниже, чтобы она совпадала с файлами в папке.

### Как начинать сообщение в чате (оптимальный вариант)

1. Включи режим **Agent** (не Ask), если нужны правки файлов.
2. Используй **явную цепочку** и требование **итераций до PASS**:
   - *«Задача: … Цепочка: [при необходимости `codebase-explorer`] → `planner` → [реализаторы, напр. `implementer`] → `reviewer` → `test-runner` → `documenter`. Если reviewer или test-runner даст FAIL — верни нумерованный список дефектов тому же агенту, пусть исправит; повторяй до PASS.»*
3. **Финансы / бизнес-аналитика / KPI:** добавь **`finance-modeler` → `finance-auditor`** до и после кода (аудитор проверяет спеку и согласованность с CRM).
4. **Сложный план с параллельными агентами:** *«Сначала `workflow-auditor` проверь план.»*
5. **Обновить README и реестр субагентов:** *«`documenter`: обнови README — обзор, что сделано, таблицу субагентов в этом разделе.»*
6. **Экономия токенов:** в плане у каждой подзадачи — только **файлы + короткие пункты действий**; исполнители не дублируют длинный контекст (подробности в **[`planner.md`](.cursor/agents/planner.md)** → *Token economy & lean handoffs*).

### Таблица субагентов

| Файл | Когда вызывать | Правит код |
|------|----------------|------------|
| [`planner.md`](.cursor/agents/planner.md) | Разбить задачу, назначить исполнителей | Нет |
| [`codebase-explorer.md`](.cursor/agents/codebase-explorer.md) | «Где в коде…», карта файлов (read-only) | Нет |
| [`workflow-auditor.md`](.cursor/agents/workflow-auditor.md) | Проверить план: владельцы файлов, цепочка до reviewer/test-runner | Нет |
| [`finance-modeler.md`](.cursor/agents/finance-modeler.md) | Формулы, KPI, связь таблиц D1 → P&L/аналитика (спека) | Нет |
| [`finance-auditor.md`](.cursor/agents/finance-auditor.md) | Проверка расчётов и связности CRM/аналитики | Нет |
| [`implementer.md`](.cursor/agents/implementer.md) | Backend API, D1, `index.tsx`, `public-api`, `pdf` (бэкенд-часть) | Да |
| [`frontend-implementer.md`](.cursor/agents/frontend-implementer.md) | Админка `panel.ts` | Да |
| [`landing-implementer.md`](.cursor/agents/landing-implementer.md) | Лендинг `landing.ts` | Да |
| [`pdf-implementer.md`](.cursor/agents/pdf-implementer.md) | Только `pdf.ts` | Да |
| [`schema-implementer.md`](.cursor/agents/schema-implementer.md) | `db.ts`, миграции, seed SQL | Да |
| [`platform-engineer.md`](.cursor/agents/platform-engineer.md) | Vite, Wrangler, `tsconfig`, npm scripts | Да |
| [`reviewer.md`](.cursor/agents/reviewer.md) | Код-ревью перед сборкой | Нет |
| [`test-runner.md`](.cursor/agents/test-runner.md) | `npm run build`, регрессии в `dist/_worker.js` | Нет |
| [`documenter.md`](.cursor/agents/documenter.md) | README, FIX_LOG, комментарии | Да (только доки/комменты) |

### Политика качества

Все субагенты настроены на уровень **principal / staff**: явные краевые случаи, без «магии» в деньгах и безопасности. **Гейт:** `reviewer` **PASS** и `test-runner` **PASS**; при **FAIL** — правки у исходного исполнителя до зелёного статуса.

### Финансы: обязательные сценарии в спеках

Для задач с деньгами/KPI субагенты **`finance-modeler`** и **`finance-auditor`** включают минимум: **MS-1** закрытие месяца / снапшоты, **MS-2** кредит полностью погашен, **MS-3** нулевые расходы в периоде (и общие краевые случаи). Дополнительные сценарии владелец добавляет в ту же матрицу. В CRM заложены данные для **кассового потока и периодных (начислений/snapshot) показателей** там, где модуль это поддерживает. Длинные фин. методологии в README **не обязательны** — по желанию владельца, обычно **`FIX_LOG`** / кратко.

---

## 📝 Git-flow

```bash
# Клонирование
git clone https://github.com/Gor1x1/Go-to-Top-Lending-genspark.git

# Новая фича
git checkout -b feature/название
# ... code ...
git add .
git commit -m "feat: описание"
git push origin feature/название

# Деплой в прод (main branch)
git checkout main
git merge feature/название
npm run build
npx wrangler pages deploy dist --project-name gototop-lending
```

---

## 📊 Текущий статус

- **Платформа**: Cloudflare Pages + D1
- **Статус**: ✅ Активен
- **Версия**: v0.5.0
- **Последнее обновление**: 2026-03-01
- **Cloudflare Project**: `gototop-lending`
- **D1 Database**: `gototop-production-eu` (ID: `f49b080f-516f-4ed0-84e9-0efdea1e8a2a`)
