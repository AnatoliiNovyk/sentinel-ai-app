# Batch 46 — Phase 1: BUG-008 + BUG-011

**Дата**: 2025  
**Тести**: 368 → 401 ✅ (exit code 0)

---

## BUG-008: Migration backward compatibility headers

### Як було
Всі 15 SQL-міграцій у `supabase/migrations/` не мали документації про зворотну сумісність — неможливо було швидко визначити, чи є міграція безпечною для roll-back.

### Що зроблено
Додано SQL-коментарі на початку кожного файлу міграції:
```sql
-- BACKWARD_COMPATIBLE: YES|CONDITIONAL|N/A
-- REASON: ...
-- ROLLBACK: ...
```

### Результат
- Всі 15 файлів задокументовано
- `YES` — безпечні (ADD COLUMN, CREATE TABLE, INDEX)
- `CONDITIONAL` — потребують уваги (RLS policy changes)
- `N/A` — seed/setup дані

---

## BUG-011a: Audit service unit tests

### Як було
`src/api/audit.service.ts` не мав unit тестів — retry логіка, fire-and-forget, anomaly detection не перевірялися.

### Що зроблено
Створено `src/api/__tests__/audit.service.unit.test.ts`:
- `log()` — успішний запис з першої спроби
- `log()` — retry при transient error (vi.advanceTimersByTimeAsync)
- `log()` — всі спроби вичерпано, не кидає exception
- `logFailure()` / `logSecurityEvent()` — делегування
- `queryLogs()` з org_id фільтром
- `getSummary()` підрахунок за категоріями
- `detectAnomalies()` — rate-limited users, CB events, auth failures

### Результат
+26 нових тестів у audit service

---

## BUG-011b: Logger unit tests

### Як було
`src/lib/logger.ts` не мав тестів. Спочатку тести писалися з `JSON.parse()`, але vitest запускається з `import.meta.env.DEV=true` → logger виводить human-readable формат, не JSON.

### Що зроблено
Створено `src/lib/__tests__/logger.test.ts` з коректними перевірками:
- Перевірка виклику правильного `console.*` методу (log/warn/error/debug)
- Перевірка вмісту output через `.join(' ').contains(...)` замість `JSON.parse()`
- Обробка об'єктів даних через `JSON.stringify(arg).includes(...)` для nested checks
- Покриття: createLogger(), root singleton, multiple loggers, no-throw guarantees

### Результат
+7 нових тестів у logger  
Загальний підсумок: **401 тестів, 0 помилок, ESLint 0 warnings, build success**
