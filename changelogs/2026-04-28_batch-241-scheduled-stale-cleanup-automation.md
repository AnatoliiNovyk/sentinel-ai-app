# Batch 241: Scheduled stale cleanup automation

## Як було
- Cleanup stale `running` станів виконувався вручну (через triage скрипт/RPC), без регулярного автоматичного циклу.
- Це підвищувало ризик довгого життя завислих jobs між ручними перевірками.

## Що зроблено
- Додано новий скрипт `scripts/scheduled-stale-cleanup.ps1`:
  - перевіряє stale `running` jobs за `TimeoutMinutes`;
  - застосовує threshold `MinStaleJobsToCleanup` перед cleanup;
  - у режимі `-ApplyCleanup` викликає RPC `cleanup_stale_running_jobs`;
  - підтримує webhook-звіт (`-SendWebhook`) і повертає структурований JSON summary.
- Додано workflow `.github/workflows/scheduled-stale-cleanup.yml`:
  - schedule кожні 30 хв + manual `workflow_dispatch`;
  - запускає safe cleanup з порогом;
  - зберігає безпечний JSON artifact `reports/scheduled-stale-cleanup.json`.
- Розширено контрактні тести `scripts/test-ops-scripts.cjs` перевіркою нового cleanup-скрипта (mock RPC + webhook).
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (P3 progress).

## Що покращило
- Зменшено ризик накопичення stale `running` записів між ручними втручаннями.
- Cleanup став детермінованим і контрольованим через поріг + JSON-аудит trail.
- Підвищено надійність через автоматичну перевірку контрактів нового скрипта в тестовому контурі.
