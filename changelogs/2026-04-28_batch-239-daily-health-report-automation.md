# Batch 239: Daily health report automation

## Як було
- Не було автоматичного денного звіту по стану scan pipeline.
- Операційні метрики (scans/jobs/stale/errors) збирались вручну під час інцидентів.

## Що зроблено
- Додано скрипт `scripts/daily-queue-health-report.ps1`:
  - збирає дані за вікно `HoursBack` з `scans`/`scan_jobs`;
  - рахує статуси, середню тривалість завершених scan, stale running jobs, top error messages;
  - підтримує webhook-відправку через `-SendWebhook`.
- Додано workflow `.github/workflows/daily-scan-health-report.yml`:
  - schedule: щоденно (`cron: 0 5 * * *`) + `workflow_dispatch`;
  - генерує JSON-звіт і публікує безпечний artifact `reports/daily-scan-health-report.json`.
- Усунуто ризик витоку секретів: `.env` не завантажується в artifacts.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (P3 progress).

## Що покращило
- З’явився регулярний операційний сигнал здоров’я пайплайну без ручних дій.
- Прискорено виявлення деградацій backlog/stale/error трендів.
- Підвищено безпеку CI-артефактів (без секретів).
