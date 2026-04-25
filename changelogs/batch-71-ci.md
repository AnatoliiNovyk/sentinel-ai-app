# Batch 71 — GitHub Actions CI/CD pipeline

## Як було
- Репозиторій не мав жодного автоматичного CI/CD pipeline.
- `npm run quality:check` запускався лише вручну локально.
- Зламані тести або помилки типів могли потрапити в `main` непоміченими.

## Що зроблено

### `.github/workflows/ci.yml`
- GitHub Actions workflow з назвою **"CI"**.
- Тригери: `push` та `pull_request` до гілки `main`.
- Runner: `ubuntu-latest`.
- Кроки:
  1. `actions/checkout@v4` — checkout репозиторію.
  2. `actions/setup-node@v4` — Node.js 20 з кешуванням `npm`.
  3. `npm ci` — детермінована інсталяція залежностей.
  4. `npm run quality:check` — повний quality gate (lint + typecheck + 1019 тестів + build).

### `README.md`
- Додано CI status badge: `[![CI](https://github.com/AnatoliiNovyk/sentinel-ai-app/actions/workflows/ci.yml/badge.svg)](...)`.

## Що покращило / виправило / додало
- **Автоматичний захист `main`** — кожен push та PR проходить повний quality gate.
- **Видимість статусу** — CI badge в README показує поточний стан pipeline.
- **1019 тестів** тепер запускаються автоматично на кожну зміну в репозиторії.
- Унеможливлює merge коду що не проходить lint/typecheck/тести/build.
