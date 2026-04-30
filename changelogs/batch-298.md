# Batch-298 — Coverage: exporters + riskScore

## Як було

- `src/lib/exporters.ts`: покриття **61.53%** (некрита ділянка lines 17–291 — `summarize`, `toCsvExport`, `toJsonExport`, `downloadFile` взагалі не імпортувались у тестах)
- `src/lib/riskScore.ts`: покриття **79.54%** (лінії 22–30 — цикл підрахунку вулнів у `recomputeProjectRiskScore` не тестувався безпосередньо, лише через `recomputeRiskScoreFromScanId`)
- Загальна кількість тестів: **1325**

## Що зроблено

### `src/lib/__tests__/exporters.test.ts`
- Розширено import: додано `summarize`, `toCsvExport`, `toJsonExport`, `downloadFile`
- Додано **`describe('summarize')`** (2 тести): порожній масив → all-zero; підрахунок по severity
- Додано **`describe('toCsvExport')`** (5 тестів): header row, кількість рядків, escaping подвійних лапок, нормалізація newlines → пробіл, порожній масив
- Додано **`describe('toJsonExport')`** (6 тестів): валідний JSON, metadata проекту, metadata скану, включення findings, triage_summary по статусах, exported_at timestamp
- Додано **`describe('downloadFile')`** (1 тест): `URL.createObjectURL` / `URL.revokeObjectURL` / `el.click()` через `vi.stubGlobal` + `vi.spyOn`

### `src/lib/__tests__/riskScore.test.ts`
- Розширено import: додано `recomputeProjectRiskScore`
- Додано **`describe('recomputeProjectRiskScore')`** (6 тестів):
  - повертає 0 без сканів
  - рахує open вулни та обчислює score (1 critical + 1 high = 37)
  - пропускає `resolved` вулни
  - пропускає `false_positive` вулни
  - пропускає `accepted` вулни
  - записує обчислений score назад у таблицю `projects`

## Що покращило/виправило/додало

- +20 нових тестів (1325 → **1345**)
- Покриття `exporters.ts` піде від 61.53% до ~90%+
- Покриття `riskScore.ts` піде від 79.54% до ~95%+
- Commit: `50d1e73` — pushed to `main`
