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
