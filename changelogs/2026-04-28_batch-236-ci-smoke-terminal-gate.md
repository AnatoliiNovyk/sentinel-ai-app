# Batch 236: CI smoke terminal-status gate

## Як було
- `smoke-e2e-release` у `.github/workflows/ci.yml` перевіряв dispatch/result/log_count, але не гарантував, що scan дійшов до термінального стану.
- Через це release gate міг проходити навіть при потенційно завислих `queued/running` станах.

## Що зроблено
- Оновлено крок `Run smoke pipeline check` у `.github/workflows/ci.yml`:
  - запуск `scripts/smoke-pipeline-safe.ps1` з `-ControlledFailure -WaitForCompletion -TimeoutSeconds 240 -PollIntervalSeconds 4`;
  - додано перевірку `wait_for_completion=true`;
  - додано перевірку, що `final_scan_status` належить до термінальних станів (`completed|failed|error`);
  - для controlled-failure сценарію зафіксовано очікування `final_scan_status='failed'`;
  - додано fail-fast, якщо після завершення залишилися активні jobs (`queued|pending|running`).
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (новий пункт P3).

## Що покращило
- Release smoke став справжнім gate по термінальному стану, а не лише по факту dispatch/callback.
- Зменшено ризик випуску при latent проблемах черги або stuck-job поведінці.
- Підвищено діагностичність фейлів: у логи виводяться `final_scan_status` та кількість jobs.
