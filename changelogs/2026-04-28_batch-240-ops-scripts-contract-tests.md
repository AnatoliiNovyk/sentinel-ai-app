# Batch 240: Ops scripts contract tests in CI

## Як було
- Нові ops-скрипти (`smoke`, `triage`, `daily report`) не мали стабільного автоматичного тест-контролю.
- Ризик регресії при зміні REST-схеми/полів залишався до моменту ручної перевірки.

## Що зроблено
- Додано `scripts/test-ops-scripts.cjs`:
  - піднімає локальний mock HTTP server;
  - проганяє `scripts/smoke-pipeline-safe.ps1` у controlled-failure + wait-for-completion;
  - проганяє `scripts/triage-stuck-scans.ps1` у `-ApplyCleanup` режимі;
  - проганяє `scripts/daily-queue-health-report.ps1`;
  - перевіряє ключові контрактні поля JSON-відповідей.
- Додано npm script: `test:ops:contracts` у `package.json`.
- Додано CI крок у `.github/workflows/ci.yml`:
  - `Run ops scripts contract tests` перед `quality:check`.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (P3 progress).

## Що покращило
- Ранній детект API/скрипт-регресій до release.
- Менший ризик поломки on-call tooling в production.
- Вища відтворюваність і стабільність операційних сценаріїв.
