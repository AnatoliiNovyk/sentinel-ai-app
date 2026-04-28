# Batch 227: Автовідновлення stale running через watchdog

## Як було
- `scan_jobs` і `scans` могли залишатись у `running` необмежено довго після аварійного/неповного завершення.
- Для відновлення потрібен був ручний cleanup у проді.

## Що зроблено
- У `sentinel-agent/src/index.ts` додано watchdog-конфіг:
  - `STALE_RUNNING_JOB_TIMEOUT_MINUTES` (default `180`)
  - `STALE_WATCHDOG_INTERVAL_MS` (default `60000`)
- Додано функцію `recoverStaleRunningJobs()`:
  - знаходить `scan_jobs` у `running`, старші за TTL;
  - переводить їх у `error` з `error_message` і `completed_at`;
  - для відповідних `scan_id` переводить `scans` у `failed`, якщо активних `running` job більше немає.
- Інтегровано watchdog у main loop (періодичний non-blocking запуск).
- Розширено runtime metrics:
  - `staleJobsRecoveredTotal`
  - `staleScansRecoveredTotal`
- Додано ці метрики у `/metrics` endpoint (Prometheus format).
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (P2 progress).

## Що покращило
- Автоматично прибираються «завислі» `running` стани без ручного втручання.
- Знижено ризик повторного блокування черги при інцидентах.
- Покращено операційну прозорість через окремі recovery-метрики.
