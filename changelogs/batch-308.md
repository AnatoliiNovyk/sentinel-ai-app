# Batch-308 — Coverage improvements

## Як було
- `otelCollector.ts`: 97.56% — lines 83-84 (`recordMetrics` auto-flush) і 94-95 (`recordSpans` auto-flush) не були покриті (існуючі тести викликали тільки singular методи `recordMetric`/`recordSpan`)
- `Scans.tsx`: 78.57% — lines 672-673 (critical severity CSS-branch в detail modal) і 720-722 (`remediation_code` блок) не були покриті
- Загальне покриття: 79.52% statements
- Тестів: 1464

## Що зроблено
### `src/lib/__tests__/otelCollector.test.ts` (+2 тести)
- `'auto-flushes when recordMetrics batch size reached'` — `client.recordMetrics(array[10])` → batch size досягнуто → `flush()` викликається → lines 83-84 покриті
- `'auto-flushes when recordSpans batch size reached'` — `client.recordSpans(array[10])` → batch size досягнуто → `flush()` викликається → lines 94-95 покриті

### `src/pages/__tests__/Scans.integration.test.tsx` (+1 тест)
- `'renders detail modal with critical severity and remediation code'` — mock вразливість з `severity: 'critical'` та `remediation_code` → клік `view-details` → modal показує `CRITICAL` (lines 672-673) і код remediation (lines 720-722)

## Що покращило/виправило/додало
- `otelCollector.ts`: **97.56% → 100% statements** (повне покриття!)
- `Scans.tsx`: **78.57% → 79.04%** statements
- Загальне покриття: **79.52% → 79.55%** statements
- Тестів: **1464 → 1467** (+3)
- Commit: `db682db`
