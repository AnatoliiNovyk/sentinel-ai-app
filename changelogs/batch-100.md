# Changelog — Batch 100 (commit cfacc2c)

## Як було
- `All files` coverage показував **96.28%** statements через включення технічних/нон-продакшн файлів у метрики
- Включені зайві файли:
  - `src/lib/passiveRecon.ts` — заглушка (export {}), не production-код
  - `src/lib/__benchmarks__/*.bench.ts` — 3 бенчмарк-файли
  - `e2e/smoke.spec.ts` — end-to-end тест Playwright
  - `playwright.config.ts` — конфіг Playwright

## Що зроблено
- Додано 4 нові записи до `coverage.exclude` у `vitest.config.ts`:
  ```ts
  'e2e/**',
  'playwright.config.ts',
  'src/lib/__benchmarks__/**',
  'src/lib/passiveRecon.ts',
  ```

## Що покращило / виправило / додало
- `All files | statements` досяг **100%**
- `All files | lines` досяг **100%**
- 101 test files, 2401 tests — усі passed
- Branches: 89.49%, Functions: 93.89% (нижче 100% — очікувано, goal був statements)
- Завершено ціль кампанії: **100% statements coverage** для всіх production-файлів
