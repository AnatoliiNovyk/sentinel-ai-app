# Batch 242: Workflow hardening (concurrency + manual inputs)

## Як було
- Scheduled workflows не мали явного `concurrency`/`timeout-minutes`, що могло призводити до overlap запусків або зависань.
- `scheduled-stale-cleanup` не мав параметризованого `workflow_dispatch` для ручного безпечного запуску з різними порогами.

## Що зроблено
- Оновлено `.github/workflows/scheduled-stale-cleanup.yml`:
  - додано `workflow_dispatch.inputs`:
    - `timeout_minutes`
    - `min_stale_jobs_to_cleanup`
    - `max_jobs_inspect`
    - `apply_cleanup`
  - додано `timeout-minutes: 15`;
  - додано `concurrency` group `scheduled-stale-cleanup`;
  - runtime крок тепер читає inputs з fallback defaults і умовно додає `-ApplyCleanup`.
- Оновлено `.github/workflows/daily-scan-health-report.yml`:
  - додано `timeout-minutes: 15`;
  - додано `concurrency` group `daily-scan-health-report`.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (P3 progress).

## Що покращило
- Усунуто ризик overlap-запусків scheduled jobs.
- Знижено ризик “вічних” ранiв через timeout guard.
- Ручний stale cleanup став гнучким і безпечним через параметризовані пороги/режим apply.
