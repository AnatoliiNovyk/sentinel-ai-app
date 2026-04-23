# Зміни від 2026-04-23: Phase 0 Test Harness (Vitest + RTL)

## Як було
- У проєкті не було стандартизованого тестового каркасу для швидкого запуску unit/smoke тестів.
- Відсутні команди `test`, `test:run`, `test:ui` у scripts.
- Не було базового setup-файлу для RTL matcher-ів.

## Що зроблено
- Додано тестові scripts у `package.json`: `test`, `test:run`, `test:ui`.
- Додано dev-залежності для тестування (`vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`).
- Створено конфігурацію `vitest.config.ts` (jsdom environment, globals, setup file, include pattern).
- Створено `src/__tests__/setup.ts` для ініціалізації `@testing-library/jest-dom/vitest`.
- Додано базовий unit/smoke тест `src/lib/__tests__/errors.test.ts` для `errorToUserMessage`.
- Прогнано `npm run test:run`: тести проходять (1 file, 2 tests).

## Що покращило/виправило/додало
- Додано робочий baseline для тестування без зміни бізнес-логіки.
- Створено точку входу для розширення тестів на scan/ai/scheduler потоки.
- Зменшено ризик регресій у новому error-contract через початкові автоматизовані перевірки.
