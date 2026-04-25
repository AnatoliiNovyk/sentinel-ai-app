# Batch 72 — Coverage Report (vitest --coverage)

## Як було
- `npm run test:coverage` не існував.
- `@vitest/coverage-v8` не був встановлений.
- Неможливо було виміряти відсоток покриття коду тестами.
- CI не генерував coverage звіт.
- `coverage/` папка не була виключена з ESLint та Git.

## Що зроблено

### Встановлено залежність
- `@vitest/coverage-v8@2.1.9` (версія точно відповідає `vitest@2.1.9`).
- `@testing-library/dom` відновлено після peer-deps конфлікту.

### `vitest.config.ts` — coverage блок
- Provider: `v8`.
- Reporters: `text`, `html`, `lcov`.
- Output: `./coverage/`.
- Виключення: `node_modules`, тестові файли, `main.tsx`, конфіги, `supabase/`, `scratch/`.
- Пороги (thresholds): Statements ≥60%, Branches ≥50%, Functions ≥55%, Lines ≥60%.

### `package.json`
- Новий скрипт: `"test:coverage": "vitest run --coverage"`.

### `.github/workflows/ci.yml`
- Новий крок після `quality:check`: `npm run test:coverage`.
- Upload до Codecov через `codecov/codecov-action@v4` (`fail_ci_if_error: false`).

### `eslint.config.js`
- `coverage` додано до `ignores` (разом з `dist`) — ESLint не перевіряє згенеровані файли.

### `.gitignore`
- `coverage/` додано — згенерований HTML/lcov не комітиться в репозиторій.

## Що покращило / виправило / додало
- **Видимість покриття**: `npm run test:coverage` показує % Statements/Branches/Functions/Lines по кожному файлу.
- **Поточні результати**: All files — ~70% Statements, ~80% Branches, ~68% Functions.
- **Захист від деградації**: пороги у `vitest.config.ts` не дозволять coverage впасти нижче мінімуму.
- **CI автоматично** генерує звіт і завантажує до Codecov на кожен push/PR.
- `npm run quality:check` → exit 0 ✅ (77 suites, 1019 tests passed).
