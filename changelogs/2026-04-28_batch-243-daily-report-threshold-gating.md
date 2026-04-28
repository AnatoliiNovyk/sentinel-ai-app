# Batch 243: Daily report threshold gating

## Як було
- Daily health report генерував зведення і надсилав webhook, але не мав чіткого порогового fail-mode.
- Workflow не дозволяв гнучко керувати порогами через `workflow_dispatch` inputs.

## Що зроблено
- Оновлено `scripts/daily-queue-health-report.ps1`:
  - додано параметри:
    - `MaxStaleRunningJobs`
    - `MaxErrorJobRatePercent`
    - `FailOnThresholdBreach`
  - додано розрахунок `error_job_rate_percent`;
  - додано `thresholds_ok` і `threshold_breaches` у JSON output;
  - при `-FailOnThresholdBreach` скрипт завершується помилкою, якщо пороги перевищені.
- Оновлено `.github/workflows/daily-scan-health-report.yml`:
  - додано `workflow_dispatch` inputs для порогів і fail-mode;
  - runtime-парсинг inputs з дефолтами;
  - додано логування `thresholds_ok` / breach count.
- Оновлено `scripts/test-ops-scripts.cjs`:
  - перевірка нових полів у daily report;
  - окремий тест сценарію, де breach очікувано фейлить скрипт.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (P3 progress).

## Що покращило
- Daily report може працювати як автоматичний health gate за конкретними порогами.
- Зменшено ризик непомічених деградацій backlog/error-rate.
- Додано тестове підтвердження fail-mode поведінки для CI-надійності.
