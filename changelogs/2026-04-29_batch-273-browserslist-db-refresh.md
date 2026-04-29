# Batch 273: Browserslist DB refresh (caniuse-lite)

## Як було
- У build output з'являвся warning:
  `Browserslist: caniuse-lite is outdated. Please run npx update-browserslist-db@latest`.

## Що зроблено
- Виконано оновлення Browserslist DB:
  - `npx update-browserslist-db@latest --yes`
  - результат: `caniuse-lite has been successfully updated`, `No target browser changes`.
- Оновлено залежності lockfile: [package-lock.json](package-lock.json).
- Додано сервісний npm-скрипт у [package.json](package.json):
  - `browserslist:update-db` для регулярного відновлення локальної бази браузерів.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- Прибрано warning про застарілий `caniuse-lite` у збірці.
- Процедура оновлення стандартизована та легко повторюється для команди/CI.
