# Batch 274 — Browserslist Maintenance Workflow

## Як було
- Оновлення `caniuse-lite` виконувалось вручну.
- Після деякого часу warning про застарілий Browserslist DB міг знову з'являтися в CI/build.

## Що зроблено
- Додано новий workflow `.github/workflows/browserslist-db-maintenance.yml`.
- Налаштовано запуск:
  - щотижня за cron;
  - вручну через `workflow_dispatch`.
- Workflow виконує:
  - `npm ci`;
  - `npm run browserslist:update-db`;
  - автоматичне створення PR через `peter-evans/create-pull-request` при наявності змін.
- Додано відповідний пункт у `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що це покращило
- Регуляризовано оновлення Browserslist DB без ручних дій.
- Зменшено ризик повторної появи warning `caniuse-lite is outdated`.
- Підтримка lockfile/metadata відбувається через прозорий PR-процес з рев’ю.
