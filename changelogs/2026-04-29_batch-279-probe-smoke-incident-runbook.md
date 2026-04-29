# Batch 279 — Probe Smoke Incident Runbook

## Як було
- У runbook були загальні сценарії для scan pipeline, але не було окремого чіткого playbook для інцидентів `agent_health_probe` smoke.
- Частина triage знань існувала в історії батчів, але не була зведена в операційний документ.

## Що зроблено
- Розширено `RUNBOOK_SCAN_PIPELINE_INCIDENTS.md`:
  - додано джерела truth для probe smoke (workflow + Dashboard card + audit_logs);
  - додано окремий інцидентний тип `Gateway probe smoke failures`;
  - додано playbook `E)` для випадків `401`, `reachable=false`, timeout;
  - зафіксовано manual smoke-recheck через `workflow_dispatch`;
  - додано чіткі exit criteria для закриття інциденту.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що це покращило
- Скорочено час triage для інцидентів probe-шляху.
- Уніфіковано recovery дії для 401/timeout/unreachable.
- Операційна команда має єдину процедуру з перевірюваними критеріями завершення.
