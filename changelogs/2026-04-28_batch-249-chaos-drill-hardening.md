# Batch 249: Chaos drill hardening

## Як було
- Chaos drill workflow запускав fault-injection тести та створював JSON-артефакт, але без evidence-id/hash та без автоматичного failure webhook alert.

## Що зроблено
- Оновлено `.github/workflows/chaos-ops-drill.yml`:
  - додано input `send_webhook_on_failure`;
  - додано evidence hardening у звіт: `evidence_id`, `integrity.payload_hash` (SHA-256);
  - додано step outputs (`evidence_id`, `drill_success`, `send_webhook_on_failure`);
  - додано окремий step `Notify drill failure`, який при `failure()` надсилає critical webhook з `evidence_id`.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що покращило
- Краща трасованість chaos запусків через evidence-id/hash.
- Деградація chaos readiness тепер автоматично ескалюється у webhook.
- Покращено операційну реакцію на падіння fault-injection drill.
