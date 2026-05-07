# Batch P: SettingsSecurity branch coverage

## Як було
- `src/pages/settings/SettingsSecurity.tsx` мав branch coverage **86.75%**.
- Непокритими лишались edge-гілки в обробці probe-помилок, не-Enter key path, ранній return збереження без user, clamp retention bounds, та частина станів кнопки збереження.

## Що зроблено
- Розширено тести у `src/pages/__tests__/Settings.test.tsx` (новий блок `Batch P`):
  - direct HTTP error -> mixed-content browser-policy message;
  - reject з `AbortError` -> timeout message;
  - `statusCode` без `error` -> HTTP status branch;
  - `keyDown` не-Enter -> health check не викликається;
  - `save` при `user=null` -> early return (без update);
  - in-flight save -> відображення `Saving security...` і перехід у `Security saved!`;
  - clamp retention input: `1 -> 7`, `99999 -> 3650`.
- Прогони:
  - `npx vitest run src/pages/__tests__/Settings.test.tsx`
  - `npm run quality:check`
  - `npx vitest run --coverage`

## Що покращило/виправило/додало
- `src/pages/settings/SettingsSecurity.tsx`:
  - Branches: **92.71%** (було 86.75%, **+5.96pp**)
  - Stmts: 97.12%
  - Funcs: 97.05%
  - Lines: 98.36%
- `src/pages/__tests__/Settings.test.tsx`:
  - Було: 101 тест (на момент Batch K)
  - Стало: 108 тестів
- Підвищено стійкість тестового покриття для security edge-сценаріїв без змін production-коду.
