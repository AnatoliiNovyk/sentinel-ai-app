# Batch 234: Smoke script completion polling

## Як було
- `scripts/smoke-pipeline-safe.ps1` підтверджував лише `dispatch` + початкові логи.
- Для реального end-to-end потрібен був ручний polling статусу scan/job.
- Ручний polling ламався через запит неіснуючого поля `scans.error_message`.

## Що зроблено
- Додано нові параметри:
  - `-WaitForCompletion`
  - `-TimeoutSeconds` (default `180`)
  - `-PollIntervalSeconds` (default `3`)
- Додано вбудований polling `scans` до термінального стану: `completed | failed | error`.
- Додано фінальний збір `scan_jobs` і оновлених `agent_logs` після polling.
- В output JSON додано:
  - `wait_for_completion`
  - `final_scan_status`
  - `final_scan`
  - `jobs`
- Виправлено схему polling-запиту: прибрано неіснуюче поле `error_message` з `scans` select.

## Що покращило
- Smoke тепер дає справжній end-to-end результат без ручних дій.
- Зменшено ризик хибних висновків із проміжного стану `queued/running`.
- Прибрано повторювану помилку REST-запиту по `scans.error_message`.
