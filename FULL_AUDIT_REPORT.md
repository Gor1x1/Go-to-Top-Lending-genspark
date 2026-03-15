# 🔍 ПОЛНЫЙ АУДИТ CRM "GO TO TOP"
## Математическая логика, расчёты, баги

**Дата аудита:** 2026-03-15
**Ревизор:** Genspark Claw (мульти-агентный анализ)
**Кодовая база:** ~45,000 строк TypeScript (Cloudflare Workers + D1 SQLite)

---

## 📊 ОБЩАЯ АРХИТЕКТУРА БИЗНЕСА

**Go to Top** — сервис выкупа товаров с Wildberries в Армении.
Выручка состоит из:
- **Услуги** (SEO, реклама, выкупы как сервис) — основной доход
- **Артикулы WB** (товары на выкуп) — транзитные деньги клиента
- **Пакеты** (комплексные предложения)
- **Скидки** (только на услуги, по промокодам)
- **Комиссии** за способы оплаты (добавляются к сумме)

P&L Каскад:
```
Выручка (услуги + артикулы + пакеты)
 - COGS (коммерческие расходы)
= Валовая прибыль
 - OPEX (ЗП + маркетинг + амортизация)
= EBIT
+ Прочие доходы - Прочие расходы - Проценты по кредитам
= EBT
 - Налоги
= Чистая прибыль
 - Кредитные платежи
= Прибыль после кредитов
 - Дивиденды
= Нераспределённая прибыль
```

---

## 🚨 КРИТИЧЕСКИЕ БАГИ (CRITICAL)

### BUG-001: Expense multiplier_monthly НЕ учитывается в auto-close-month
**Файл:** `src/api/routes/admin-crm-extended.ts` (auto-close-month)
**Серьёзность:** CRITICAL

**Проблема:** В P&L (`admin-finance.ts`, `computePnlForPeriod`) расходы считаются с множителем:
```sql
e.amount * COALESCE(eft.multiplier_monthly, 1) -- правильно
```
Но в auto-close-month тот же запрос:
```sql
SUM(CASE WHEN ec.is_marketing = 0 THEN e.amount ELSE 0 END) -- БЕЗ множителя!
```

**Пример:**
- Расход "Аренда" = 100,000 ֏, частота "ежемесячно" (multiplier=1) → P&L: 100,000, snapshot: 100,000 ✅
- Расход "Хостинг" = 1,200,000 ֏, частота "ежегодно" (multiplier=0.0833) → P&L: 100,000, snapshot: **1,200,000** ❌

**Влияние:** Снапшоты закрытых месяцев будут содержать завышенные расходы для годовых/квартальных платежей.

**Исправление:**
```sql
-- В auto-close-month добавить multiplier_monthly
LEFT JOIN expense_frequency_types eft ON e.frequency_type_id = eft.id
...
SUM(CASE WHEN ec.is_marketing = 0 THEN e.amount * COALESCE(eft.multiplier_monthly, 1) ELSE 0 END) as commercial,
SUM(CASE WHEN ec.is_marketing = 1 THEN e.amount * COALESCE(eft.multiplier_monthly, 1) ELSE 0 END) as marketing
```

---

### BUG-002: YTD расчёт ЗП и расходов — умножение текущего месяца на количество месяцев
**Файл:** `src/api/routes/admin-finance.ts` (pnl endpoint, YTD section)
**Серьёзность:** CRITICAL

**Проблема:**
```typescript
const ytdCogs = current.cogs * monthsInFiscalYear;
const ytdSalary = current.salary_total * monthsInFiscalYear;
const ytdMarketing = current.marketing * monthsInFiscalYear;
```

Это предполагает, что ЗП и расходы были ОДИНАКОВЫМИ все месяцы. Но:
- Если в январе ЗП=500,000 а в марте повысили до 700,000 → YTD покажет 700,000 × 3 = 2,100,000 вместо 500+600+700 = 1,700,000
- Если расход добавлен с февраля → YTD посчитает его за все месяцы

**Влияние:** YTD (year-to-date) показатели ВСЕГДА неточные при изменении ЗП/расходов.

**Исправление:** Считать YTD через цикл по каждому месяцу fiscal year или агрегировать из закрытых снапшотов.

---

### BUG-003: Tax auto-calculation — побочный эффект записи в GET endpoint
**Файл:** `src/api/routes/admin-finance.ts` (computePnlForPeriod)
**Серьёзность:** CRITICAL

**Проблема:** Функция `computePnlForPeriod` (вызывается из GET /pnl/:periodKey):
1. Автогенерирует tax_payments из tax_rules (INSERT)
2. Обновляет суммы автоналогов (UPDATE tax_payments SET amount)
3. Создаёт таблицу tax_rules если нет (CREATE TABLE)

Это **побочные эффекты в GET запросе** — каждое открытие P&L модифицирует базу данных.

**Влияние:**
- При параллельных запросах — race condition на INSERT
- Каждое открытие страницы меняет данные
- Нарушение принципа идемпотентности GET

**Рекомендация:** Вынести генерацию и пересчёт в отдельный POST endpoint, а GET только читает.

---

### BUG-004: Revenue в auto-close НЕ учитывает total_amount как ground truth
**Файл:** `src/api/routes/admin-crm-extended.ts` (auto-close-month)
**Серьёзность:** CRITICAL

**Проблема:** Auto-close считает выручку по-своему:
```
revServices = grossSvc - revDiscounts  (из calc_data.items)
revArticles = SUM(lead_articles.total_price)
revPackages = SUM(calc_data.package.package_price)
```

А P&L в живом режиме использует `SUM(total_amount)` как ground truth и корректирует breakdown:
```typescript
const breakdownSum = revenueServices + revenueArticles + revenuePackages;
if (Math.abs(breakdownSum - liveRevenue) > 1) {
  revenueServices += (liveRevenue - breakdownSum); // reconciliation
}
```

Auto-close НЕ делает такой reconciliation → snapshot.total_turnover может отличаться от SUM(total_amount).

**Пример:** Если у лида вручную изменили total_amount но не обновили calc_data → snapshot будет неверным.

---

## ⚠️ ВЫСОКИЕ БАГИ (HIGH)

### BUG-005: salary-summary endpoint НЕ фильтрует по hire_date/end_date
**Файл:** `src/api/routes/admin-crm-extended.ts` (salary-summary/:month)
**Серьёзность:** HIGH

**Проблема:**
```sql
-- salary-summary (без фильтрации по датам):
SELECT COALESCE(SUM(salary), 0) FROM users WHERE is_active = 1 AND salary > 0

-- P&L (с фильтрацией):
WHERE u.is_active=1 AND (u.hire_date = '' OR u.hire_date IS NULL OR u.hire_date <= ?)
  AND (u.end_date = '' OR u.end_date IS NULL OR u.end_date >= ?)
```

Salary-summary считает ВСЕ активные ЗП, даже если сотрудник ещё не начал работу или уже уволен в этом месяце.

**Влияние:** Раздел "Затраты и ЗП" покажет неверную сумму ЗП.

---

### BUG-006: Discount может стать отрицательным в recalc
**Файл:** `src/api/routes/admin-leads.ts` (leads/:id/recalc)
**Серьёзность:** HIGH

**Проблема:** При recalc:
```typescript
discountAmount = Math.round(servicesSubtotal * discountPercent / 100)
```
Если `servicesSubtotal = 0` (все услуги удалены), а промокод остался → `discountAmount = 0`, но:
```typescript
totalAmount = servicesSubtotal - discountAmount + articlesTotal + packagePrice;
```
Если servicesSubtotal < discountAmount (промокод дороже услуг после удаления части) → отрицательная выручка по услугам.

**Исправление:** `Math.max(0, servicesSubtotal - discountAmount)`

---

### BUG-007: Commission НЕ входит в P&L revenue
**Файл:** `src/api/routes/admin-finance.ts`
**Серьёзность:** HIGH

**Проблема:** Комиссия за способ оплаты (`commission_amount`) хранится отдельно от `total_amount`:
```typescript
// В leads.total_amount = services + articles + packages - discounts (БЕЗ комиссии)
// commission_amount — отдельное поле
```

P&L использует `SUM(total_amount)` для revenue → комиссия НЕ включена в выручку.
При этом комиссия — это реальные деньги, которые платит клиент.

P&L показывает `commissions_total` и `commissions_by_method` как информационные поля, но НЕ включает их в каскад.

**Влияние:** Выручка в P&L занижена на сумму комиссий.

---

### BUG-008: effectiveLoanPayments использует MAX(actual, plan) — спорная логика
**Файл:** `src/api/routes/admin-finance.ts`
**Серьёзность:** HIGH

**Проблема:**
```typescript
const effectiveLoanPayments = Math.max(totalLoanPaymentsPeriod, totalLoanMonthlyPlan);
```

Если фактические платежи за месяц = 0 (ещё не платили), то берётся plan. Но если платили часть (50% плана) → берётся план, а не факт. Это двойной учёт.

**Пример:**
- План: 100,000 ֏/мес
- Фактически заплатили: 30,000 ֏
- effectiveLoanPayments = MAX(30000, 100000) = **100,000** → но реально списано только 30,000

---

### BUG-009: Dividend totalDividends считает tax_amount=0 если amount=0
**Файл:** `src/api/routes/admin-finance.ts`
**Серьёзность:** HIGH

**Проблема:**
```typescript
const totalDividends = (divs.results || []).reduce((s, d) => {
  const amt = Number(d.amount) || 0;
  const tax = amt > 0 ? (Number(d.tax_amount) || 0) : 0; // ← если amount=0, tax принудительно 0
  return s + amt + tax;
}, 0);
```

Если нужно записать корректирующий дивиденд с amount=0 и tax_amount>0 (например, ошибочно начисленный налог) — он будет проигнорирован.

---

## 🔶 СРЕДНИЕ БАГИ (MEDIUM)

### BUG-010: Frontend analytics vs Backend P&L — разные формулы выручки
**Файл:** `src/admin/sections/panel-analytics.ts` vs `src/api/routes/admin-finance.ts`
**Серьёзность:** MEDIUM

Frontend `recalcFinancials()` считает выручку через `calc_data.items` для каждого лида.
Backend P&L для live-месяца использует `SUM(total_amount)` + reconciliation.

Если calc_data не обновлено после ручного изменения → frontend покажет одну сумму, а P&L — другую.

---

### BUG-011: Expense period_key сравнение — неточное
**Файл:** `src/api/routes/admin-finance.ts`
**Серьёзность:** MEDIUM

```sql
AND (e.start_date IS NULL OR e.start_date = '' OR e.start_date <= ?)  -- periodKey + '-31'
AND (e.end_date IS NULL OR e.end_date = '' OR e.end_date >= ?)       -- periodKey + '-01'
```

Проблема: `periodKey + '-31'` для февраля = `2026-02-31`, что как строка работает, но семантически неверно. В SQLite это сработает, но неаккуратно.

---

### BUG-012: addSelectedServicesToLead не пересчитывает скидку
**Файл:** `src/admin/sections/panel-leads.ts` (addSelectedServicesToLead)
**Серьёзность:** MEDIUM

При добавлении услуг через калькулятор:
```javascript
var newTotal = 0;
for (var j = 0; j < calcData.items.length; j++) { newTotal += Number(calcData.items[j].subtotal || 0); }
calcData.total = newTotal;
// Отправляет: { calc_data, total_amount: newTotal }
```

Скидка по промокоду НЕ вычитается при пересчёте → total_amount будет БЕЗ скидки.
Потом при saveLeadAll вызывается recalc который ВСЁ пересчитает, но промежуточное состояние неверно.

---

### BUG-013: Annuity PMT не учитывает уже выплаченную часть
**Файл:** `src/api/routes/admin-finance.ts` (loans POST)
**Серьёзность:** MEDIUM

```typescript
monthlyPayment = principal * r * Math.pow(1+r,n) / (Math.pow(1+r,n) - 1);
```

Формула аннуитета правильная, но при создании кредита с `remaining_balance < principal` (частично выплачен) — PMT не пересчитывается от остатка. Это нормально если PMT по договору фиксирован, но может запутать.

---

### BUG-014: Division by zero не защищены во всех местах
**Файлы:** множественные
**Серьёзность:** MEDIUM

- `avg_check = leadsDone > 0 ? ... : 0` ✅ (защищён)
- `gross_margin: revenue > 0 ? ... : 0` ✅ (защищён)
- Frontend: `(stats.done.c / (stats.done.c + stats.rejected.c) * 100)` — если оба 0 → NaN
- `breakEvenMonths: monthlyNet > 0 ? totalInvestment / monthlyNet : Infinity` — Infinity в JSON

---

### BUG-015: Fiscal year YTD revenue — неполный учёт открытых месяцев
**Файл:** `src/api/routes/admin-finance.ts`
**Серьёзность:** MEDIUM

YTD revenue берёт из снапшотов (`period_snapshots`), но добавляет live revenue только для ТЕКУЩЕГО месяца:
```typescript
if (!currentSnap || !currentSnap.is_locked) {
  ytdRevenue += current.revenue;
}
```

Если есть ПРОШЛЫЕ месяцы которые тоже не закрыты (не locked) — их revenue НЕ попадёт в YTD (они не в снапшотах и не "текущий" месяц).

---

## 🔷 НИЗКИЕ БАГИ (LOW)

### BUG-016: ALTER TABLE в runtime (employee_bonuses.bonus_type)
**Файл:** `src/api/routes/admin-crm-extended.ts`
```typescript
try { await db.prepare("ALTER TABLE employee_bonuses ADD COLUMN bonus_type TEXT DEFAULT 'bonus'").run(); } catch {}
```
Каждый POST на бонусы пытается ALTER TABLE. Безвредно (catch), но неэффективно.

### BUG-017: Округление — разные стратегии
- Backend: `Math.round(x * 100) / 100` (2 знака)
- Frontend: `Number(x).toLocaleString('ru-RU')` (без контроля знаков)
- Tax calculation: `Math.round(base * rate / 100 * 100) / 100` — двойное умножение на 100
  
Может давать расхождение в 1 ֏ между фронтом и бэком.

### BUG-018: loan_payments.period_key не всегда заполняется
Поле есть, но не используется в агрегациях P&L (используется payment_date).

### BUG-019: Удаление expense_category обнуляет category_id, но не пересчитывает is_marketing
Если удалить маркетинговую категорию → расходы станут NULL → не попадут ни в commercial ни в marketing.

---

## 📋 СВОДКА

| Уровень | Количество | Описание |
|---------|-----------|----------|
| 🚨 CRITICAL | 4 | Неверные расчёты в снапшотах, YTD, побочные эффекты |
| ⚠️ HIGH | 5 | Неполный учёт ЗП, комиссий, кредитов |
| 🔶 MEDIUM | 6 | Несогласованность frontend/backend, edge cases |
| 🔷 LOW | 4 | Неэффективный код, мелкие несоответствия |
| **ИТОГО** | **19** | |

---

## 🔧 ПРИОРИТЕТ ИСПРАВЛЕНИЙ

1. **BUG-001** — Expense multiplier в auto-close (1 SQL запрос)
2. **BUG-004** — Revenue reconciliation в auto-close
3. **BUG-005** — hire_date/end_date в salary-summary
4. **BUG-006** — Math.max(0) для скидок в recalc
5. **BUG-002** — YTD через итерацию по месяцам (сложнее)
6. **BUG-012** — Пересчёт скидки при добавлении услуг
7. **BUG-007** — Комиссии в P&L revenue
8. **BUG-003** — Вынести записи из GET (рефакторинг)

Готов начать исправления — скажи, и я пойду по приоритету.
