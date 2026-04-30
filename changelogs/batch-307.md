# Batch-307 — Coverage improvements

## Як було
- `otelCollector.ts`: 93.9% — lines 197-199 (silent catch у flush timer) та 239-242 (throw при non-ok HTTP) не були покриті
- `Scans.tsx`: 67.3% — detail modal (lines 647-729) не мав тестів (onViewDetails не викликався)
- Загальне покриття: 79.16% statements, 78.59% branches
- Тестів: 1461

## Що зроблено
### `src/lib/__tests__/otelCollector.test.ts` (+2 тести)
- `'throws and fails when collector returns non-ok HTTP status'` — fetch повертає `{ ok: false, status: 500, statusText: 'Internal Server Error' }`, що спричиняє throw в `exportToCollector` → рядки 239-242 покриті
- `'silently ignores flush errors triggered by background flush timer'` — короткий flushInterval (50ms), fetch відхиляється, 120ms затримка → interval спрацьовує → `.catch(() => {})` виконується без помилок → рядки 197-199 покриті

### `src/pages/__tests__/Scans.integration.test.tsx` (+1 тест, оновлено mock)
- Оновлено mock `VulnerabilityList` — додано `onViewDetails` prop і кнопку `view-details`
- Додано поля `status: 'open'`, `created_at` до mock вразливості (необхідні для рендеру detail modal)
- `'opens and closes vulnerability detail modal'` — клік на `view-details` → `setSelectedVuln` → modal рендериться з назвою вразливості → клік `Close vulnerability details` → modal закривається

## Що покращило/виправило/додало
- `otelCollector.ts`: **93.9% → 97.56%** statements, **100%** functions
- `Scans.tsx`: **67.3% → 78.57%** statements
- Загальне покриття: **79.16% → 79.52%** statements
- Тестів: **1461 → 1464** (+3)
- Commit: `bd49793`
