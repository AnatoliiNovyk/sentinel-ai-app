# Batch 295 — Coverage functions: поріг 55% досягнуто

## Як було
- `functions` coverage: **54.98%**
- CI failing: `Coverage for functions (54.98%) does not meet global threshold (55%)`
- `riskScore.ts`: 50% functions (лише `computeScoreFromCounts` + `riskBand` покрито)

## Що зроблено
- Додано `vi.mock('../supabase', ...)` в `src/lib/__tests__/riskScore.test.ts`
- Додано 2 нові тести для `recomputeRiskScoreFromScanId`:
  - `'calls recomputeProjectRiskScore when scan has project_id'`
  - `'does nothing when scan has no project_id'`
- Імпортовано `recomputeRiskScoreFromScanId`, `recomputeProjectRiskScore` в тест-файл

## Що покращило
- `riskScore.ts` functions: 50% → 100% (4/4 функцій покрито)
- Загальний `functions` coverage: **54.98% → 55.2%**
- CI threshold `functions: 55` тепер проходить ✅
- Всі 26 тестів у riskScore.test.ts проходять ✅
