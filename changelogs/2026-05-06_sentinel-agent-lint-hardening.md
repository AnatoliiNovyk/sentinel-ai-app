# Sentinel Agent Lint Hardening (2026-05-06)

## Як було
- Повний lint репозиторію падав на sentinel-agent.
- У sentinel-agent були `require()` імпорти, що порушували правило `@typescript-eslint/no-require-imports`.
- Було використано regex з control-символом (`\x1b`), що порушував `no-control-regex`.
- Збірка `sentinel-agent/dist` потрапляла під lint і давала додаткові помилки по правилах TypeScript у JS-артефактах.

## Що зроблено
- Оновлено [eslint.config.js](eslint.config.js):
  - `ignores` розширено до `**/dist/**`, щоб вкладені build-артефакти не лінтилися.
- Оновлено [sentinel-agent/src/index.ts](sentinel-agent/src/index.ts):
  - `initOpenTelemetry` переведено на `async` і `require()` замінено на `await import(...)`.
  - Виклик ініціалізації змінено на `void initOpenTelemetry();`.
  - ANSI-cleanup regex переписано без literal control-char через `new RegExp(String.raw`\\u001b\\[[0-9;]*[mGKHF]`, 'g')`.
- Прогнано повний lint: `eslint . --max-warnings=0`.

## Що покращило / виправило / додало
- Виправлено падіння lint у sentinel-agent.
- Прибрано порушення TypeScript ESLint щодо `require()` імпортів.
- Прибрано порушення `no-control-regex`.
- Знижено шум від згенерованих `dist`-файлів у перевірках якості.
