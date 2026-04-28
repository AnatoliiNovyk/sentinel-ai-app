# Batch 238: Incident runbook + stuck scans triage script

## Як було
- Операційні дії при інцидентах scan pipeline виконувались переважно ad-hoc командами.
- Для stuck `running`/`pending` станів не було єдиного утилітарного скрипта з dry-run/cleanup режимами.

## Що зроблено
- Додано новий runbook:
  - `RUNBOOK_SCAN_PIPELINE_INCIDENTS.md`
  - включає triage flow, playbooks (agent unreachable, stuck jobs, SLO breach, report callback issues), exit criteria та prevention.
- Додано новий скрипт:
  - `scripts/triage-stuck-scans.ps1`
  - за замовчуванням працює в безпечному режимі (dry-run);
  - визначає stale `running` jobs за `TimeoutMinutes`;
  - показує список affected scans;
  - опційно запускає recovery RPC `cleanup_stale_running_jobs` через `-ApplyCleanup`.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (P3 progress).

## Що покращило
- Інциденти стали відтворюваними та стандартизованими для on-call.
- Зменшено MTTR завдяки швидкому dry-run/cleanup циклу без ручного SQL.
- Знижено ризик помилкових recovery-дій через явний `-ApplyCleanup` режим.
