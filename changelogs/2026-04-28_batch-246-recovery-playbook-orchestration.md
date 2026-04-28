# Batch 246: Recovery playbook orchestration

## Як було
- Для recovery були окремі утиліти triage/cleanup, але не було єдиного оркестратора з фіксованою послідовністю кроків, post-check і стандартизованим audit output.
- Не було окремого manual workflow для керованого запуску safe-remediation playbook з артефактом.

## Що зроблено
- Додано `scripts/recovery-playbook.ps1`:
  - режими `dry-run` / `apply` (`-ApplyCleanup`);
  - кроки: stale detection -> affected scans snapshot -> optional cleanup RPC -> post-cleanup verification;
  - стандартизований JSON-аудит (`summary`, samples, cleanup status, outcome);
  - optional webhook report (`-SendWebhook`) з fallback на `OPERATIONAL_ALERT_WEBHOOK_URL`;
  - fail-policy для apply-режиму при RPC error або відсутності зниження stale jobs.
- Додано manual workflow `.github/workflows/recovery-playbook.yml`:
  - `workflow_dispatch` inputs (`timeout_minutes`, `max_scans`, `apply_cleanup`, `send_webhook`);
  - запуск playbook-скрипта;
  - публікація `reports/recovery-playbook-report.json` як артефакту.
- Розширено `scripts/test-ops-scripts.cjs`:
  - контрактний тест recovery playbook сценарію (stale before -> cleanup -> stale after=0 + webhook).
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що покращило
- Recovery став керованим і відтворюваним через єдиний playbook.
- З'явився повний audit trail для кожного recovery run.
- Зменшено операційний ризик ручних помилок під час інцидентів за рахунок стандартизованої послідовності кроків і post-check.
