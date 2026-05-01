# Batch-341: Scans.test.tsx - Comprehensive Test Suite

## Що було
Створено новий файл `src/pages/__tests__/Scans.test.tsx` з 31 тестом для компонента `Scans.tsx` (735 рядків).

## Що зроблено
- **31 тест** для Scans.tsx, покривають:
  - ScanStatusBadge (4 тести)
  - Loading state (2 тести)
  - Empty states (4 тести)
  - Filters & search (6 тестів)
  - Scan list rendering (3 тести)
  - Scan summary strip (4 тести)
  - AI generation (3 тести)
  - New scan modal (6 тестів) — open/close, scanner type, target input, dispatch
  - Detail modal (3 тести)
  - Mock mode warning (2 тести)

## Що покращило/виправило/додало
- **Виправлено**: selector кнопки `name: /new scan/i` → `name: /start a new scan/i` (ScanHeader button з aria-label="Start a new scan")
- **Виправлено**: `probeAgentHealth` mock reset у `beforeEach` mock mode warning describe block — тепер кожен тест починається з чистого стану
- **Виправлено**: Added project selection у тестах dispatchScan — `handleStartScan` requires `selectedProjectId` для знаходження проекту
- **Додано**: `mockDispatchScan.mockClear()` у `beforeEach` new scan modal describe block для ізоляції тестів
- **Додано**: Wait for modal animation з `setTimeout(300ms)` у scanner/target render тестах

## Мetrics
- Scans.tsx coverage: **94.92% lines**, 75.9% branches, 83.33% functions
- Scans.tsx uncovered: lines 96, 114, 126, 158, 200-203, 254-255, 296-297, 310-311, 360

## Комміт
- `9d6d10b` - test(BATCH-341): Scans.tsx - 31 tests covering new scan modal, filters, AI generation, mock mode warning