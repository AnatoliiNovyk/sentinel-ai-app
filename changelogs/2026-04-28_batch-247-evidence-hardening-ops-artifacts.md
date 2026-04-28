# Batch 247: Evidence hardening for ops artifacts

## Як було
- Ops reports формували корисний JSON, але без уніфікованого evidence-envelope для аудиту.
- Не було обов'язкових полів `evidence_id` та hash-integrity для перевірки цілісності payload.

## Що зроблено
- Оновлено `scripts/daily-queue-health-report.ps1`:
  - додано versioned envelope (`schema_version`, `report_type`);
  - додано `evidence_id`;
  - додано `run_context` з параметрами запуску;
  - додано `integrity.payload_hash` (SHA-256);
  - `evidence_id` передається в webhook payload.
- Оновлено `scripts/recovery-playbook.ps1`:
  - додано аналогічний evidence-envelope та SHA-256 hash;
  - `evidence_id` передається в webhook payload.
- Оновлено workflow-логи:
  - `.github/workflows/daily-scan-health-report.yml` тепер друкує `evidence_id` і hash;
  - `.github/workflows/recovery-playbook.yml` теж друкує `evidence_id` і hash.
- Оновлено `scripts/test-ops-scripts.cjs`:
  - додано перевірки полів envelope/hash для daily report і recovery playbook.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що покращило
- Артефакти стали придатними для формального audit trail (versioning + traceability).
- Додана перевірювана цілісність payload через SHA-256 hash.
- Легше зіставляти webhook події з конкретним артефактом через `evidence_id`.
