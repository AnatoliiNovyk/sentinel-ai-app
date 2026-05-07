# Batch N: connectionPool edge-case branch coverage

## Як було
- `src/lib/connectionPool.ts`: branch coverage 90.32%.
- Непокриті гілки: LRU/edge paths (зокрема around line 80, line 102, line 240).
- `src/lib/__tests__/connectionPool.test.ts` мав 30 тестів.

## Що зроблено
- Додано 3 edge-case тести у `src/lib/__tests__/connectionPool.test.ts`:
  - `checkinConnection` для неіснуючого id (graceful no-op path).
  - LRU eviction сценарій при заповненому cache.
  - Кешування в порожній cache (empty-cache path).
- Виправлено структуру кінця тестового файла (коректне закриття describe/it блоків).
- Прогнано ізольований запуск з coverage:
  - `npx vitest run src/lib/__tests__/connectionPool.test.ts --coverage`

## Що покращило/виправило/додало
- `src/lib/connectionPool.ts`:
  - Statements: 98.64%
  - Branches: **93.54%** (було 90.32%, +3.22pp)
  - Functions: 94.44%
  - Lines: 98.63%
- `src/lib/__tests__/connectionPool.test.ts`:
  - Було: 30 тестів
  - Стало: 33 тести
- Покрито критичні edge branches для eviction/no-op cache paths без змін production-коду.
