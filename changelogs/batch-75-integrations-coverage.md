# Batch 75 — Integrations.tsx Coverage Improvement

## Що було
- Integrations.test.tsx: 52 тести, coverage **28.9%** stmts — критично низьке
- Причина: `export default Integrations` — лише CI/CD-компонент (~366 рядків)
- ~800 рядків коду в `IntegrationsLegacy`, `ServiceCard`, `WebhookRow`, `WebhookCreator`, `HealthDashboard` — не покрити через відсутність exports

## Що зроблено
1. `Integrations.tsx`: `IntegrationsLegacy` отримала `export` (замінено `// eslint-disable-next-line` comment на `// exported for test coverage`)
2. Оновлено import в тесті: додано `{ IntegrationsLegacy }`, `act`, `afterEach`
3. Додано **64 нові тести** у 10 describe-блоках:
   - `IntegrationsLegacy — basic render` (7 тестів)
   - `IntegrationsLegacy — tab navigation` (5 тестів)
   - `IntegrationsLegacy — ServiceCard expand/collapse` (8 тестів)
   - `IntegrationsLegacy — ServiceCard test connection` (3 тести)
   - `IntegrationsLegacy — loaded connected service from localStorage` (5 тестів)
   - `IntegrationsLegacy — WebhookCreator open/close` (9 тестів)
   - `IntegrationsLegacy — WebhookRow interactions` (12 тестів)
   - `IntegrationsLegacy — WebhookRow disabled webhook` (4 тести)
   - `IntegrationsLegacy — WebhookRow event filter` (5 тестів)
   - `IntegrationsLegacy — HealthDashboard calculations` (5 тестів)
   - `IntegrationsLegacy — webhook example payload` (1 тест)

## Результат
- Integrations.test.tsx: **116 тестів** (+64), всі pass
- Coverage Integrations.tsx: **97.89%** stmts (+69pp!!) / **93.89%** branches (+0.14pp) / **87.8%** funcs (+62.8pp)
- Commit: `5f96c06` — pushed to main
