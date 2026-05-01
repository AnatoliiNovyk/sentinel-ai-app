# Batch 69 — DarkWebMonitor + Scheduler Coverage

## DarkWebMonitor

### Як було
- `useToast` mock в тестах повертав тільки `{ showToast: vi.fn() }`
- `toast.info()` та `toast.error()` були `undefined` → кидали помилку в `analyze()`
- Виконання переходило в `catch` блок → `AuditService.logSecurityEvent` ніколи не викликався
- Statements: 96.58%, Functions: 85.71%

### Що зроблено
- Оновлено mock `toastContext` у `DarkWebMonitor.test.tsx`:
  ```typescript
  useToast: () => ({ showToast: vi.fn(), info: vi.fn(), error: vi.fn(), success: vi.fn(), warn: vi.fn() })
  ```
- Всі 38 тестів проходять

### Результат
- Statements: **96.58% → 97.99%**
- Lines: **96.58% → 97.99%**

---

## Scheduler

### Як було
- 26 тестів, statements 97.73%
- Непокриті лінії: 158-159 (else в `runNow`), 437-441 (empty search state), 465 (overdue span)
- **Критичний баг**: `projectName()` використовувалась в `useMemo` ПЕРЕД своїм визначенням — пошук кидав TDZ помилку і не працював в реальному застосунку

### Що зроблено
1. **Фікс бага TDZ**: перенесено `projectName` і `scannerLabel` вгору перед `useMemo` в `Scheduler.tsx`
2. Додано тест: `dispatchScan` повертає помилку → `toast.error` викликається (лінії 158-159)
3. Додано тест: пошук з рядком без збігів → показується "No schedules match the search" (лінії 437-441)
4. Додано тест: `next_run_at` в минулому → показується "(overdue)" (лінія 465)

### Результат
- Tests: **26 → 29**
- Statements: **97.73% → 99.77%**
- Lines: **97.73% → 99.77%**
- Виправлено реальний баг — пошук розкладів тепер працює коректно

---

## Commits
- `50bdc39` — DarkWebMonitor toast mock fix
- `17ed2ca` — Scheduler TDZ fix + new tests
