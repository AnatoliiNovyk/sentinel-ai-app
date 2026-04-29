# Batch 260: Orphan running scans recovery

## Як було
- У проді виник інцидент: скани зависали в `running`, хоча активних `pending/running` jobs вже не було.
- Існуючий recovery playbook фокусувався на stale `running` jobs, тому orphaned scans могли залишатись без автовідновлення.

## Що зроблено
- Оновлено [scripts/recovery-playbook.ps1](scripts/recovery-playbook.ps1):
  - додано `Get-OrphanRunningScans` (пошук `running` scans старше cutoff без активних jobs);
  - додано `Resolve-OrphanRunningScans` (у `ApplyCleanup` режимі переводить orphan scans у `failed` з `completed_at`);
  - додано orphan-метрики у summary (`before/after/cleaned_count`, samples, failed cleanup details);
  - оновлено recovery outcome та severity логіку з урахуванням orphan scans;
  - додано fail-guard, якщо orphan scans не зменшились після cleanup.
- Оновлено [scripts/test-ops-scripts.cjs](scripts/test-ops-scripts.cjs):
  - адаптовано існуючий recovery test під нову orphan-логіку;
  - додано окремий контрактний тест `testRecoveryPlaybookOrphanScanCleanup`.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- Закрито клас інцидентів із завислими orphaned running scans.
- Recovery playbook тепер відновлює не лише stale jobs, а й стан scans, що втратили активний job.
- Підсилено reliability та операційну відновлюваність scan pipeline.
