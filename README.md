# Go to Top — Landing + Admin Panel

## Project Overview
- **Name**: Go to Top — Продвижение на Wildberries
- **Goal**: Лендинг + админ-панель для сервиса выкупов и продвижения на WB
- **Version**: v0.2.0

## URLs
- **Production**: https://gototop-wb.pages.dev
- **Admin Panel**: https://gototop-wb.pages.dev/admin
- **GitHub**: https://github.com/Gor1x1/Go-to-Top-Lending-genspark

## Admin Panel (v0.2.0)
**Доступ**: https://gototop-wb.pages.dev/admin
- **Login**: admin / gototop2026 (сменить при первом входе!)

### Разделы админки:
1. **📝 Тексты сайта** — редактирование всех 249 текстов на RU + AM (20 секций)
2. **🧮 Калькулятор** — управление вкладками (6 шт) и услугами (22 шт): добавление, удаление, изменение цен
3. **💬 Telegram сообщения** — настройка текстов для каждой кнопки (24 шт), URL и шаблонов на 2 языках
4. **📜 Скрипты** — добавление аналитики, пикселей, meta тегов (head/body)
5. **⚙️ Настройки** — смена пароля

### Как начать:
1. Открыть /admin → войти admin / gototop2026
2. Нажать "Загрузить тексты с сайта" в разделе "Тексты сайта"
3. Редактировать нужные тексты и нажимать "Сохранить секцию"

## Data Architecture
- **Database**: Cloudflare D1 (gototop-production)
- **Tables**: users, site_content, calculator_tabs, calculator_services, telegram_messages, custom_scripts
- **Auth**: JWT (SHA-256 HMAC via Web Crypto API)
- **Content Storage**: JSON per section in D1

## Tech Stack
- **Backend**: Hono (TypeScript) on Cloudflare Pages
- **Frontend**: Vanilla HTML/CSS/JS + TailwindCSS (CDN)
- **Database**: Cloudflare D1 (SQLite at edge)
- **Auth**: JWT + SHA-256 (Web Crypto API)
- **Admin UI**: SPA (single-page application) on pure JS

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | / | Landing page |
| GET | /admin | Admin panel |
| GET | /api/health | Health check |
| POST | /api/lead | Lead form submission |
| POST | /api/popup-lead | Popup form submission |
| POST | /api/admin/login | Admin login (returns JWT) |
| POST | /api/admin/change-password | Change password |
| GET/PUT | /api/admin/content/:key | Site content CRUD |
| GET/POST/PUT/DELETE | /api/admin/calc-tabs | Calculator tabs CRUD |
| GET/POST/PUT/DELETE | /api/admin/calc-services | Calculator services CRUD |
| GET/POST/PUT/DELETE | /api/admin/telegram | Telegram messages CRUD |
| GET/POST/PUT/DELETE | /api/admin/scripts | Custom scripts CRUD |
| GET | /api/admin/stats | Dashboard statistics |
| POST | /api/admin/seed-from-site | Import current texts to DB |

## Current Features ✅
- Полноценный лендинг с 2 языками (RU/AM)
- Калькулятор услуг с тарифами
- Popup форма (5 сек)
- Интеграция с Telegram
- Адаптивный дизайн
- Анимации (scroll, counters)
- **NEW: Админ-панель для управления всем контентом**
- **NEW: D1 база данных**
- **NEW: JWT аутентификация**
- **NEW: Управление Telegram-сообщениями на 2 языках**
- **NEW: Система пользовательских скриптов**

## Planned (Phase 2)
- Кабинет сотрудника (просмотр заявок, управление клиентами)
- Кабинет клиента (статус выкупов)
- Динамический рендеринг лендинга из D1

## Deployment
- **Platform**: Cloudflare Pages + D1
- **Status**: ✅ Active
- **Last Updated**: 2026-02-17
