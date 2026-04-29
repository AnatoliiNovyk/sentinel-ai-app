# Batch 281 — Probe Audit Persistence Fail-Safe

## Як було
- Persist крок у `agent-health-probe-smoke` workflow був великим inline PowerShell-блоком.
- Потенційні transient помилки вставки в `audit_logs` могли ламати крок і ускладнювали тестування сценаріїв деградації.

## Що зроблено
- Додано окремий скрипт `scripts/persist-agent-probe-audit.cjs` для persistence статусу probe smoke в `audit_logs`.
- Оновлено workflow `.github/workflows/agent-health-probe-smoke.yml`:
  - inline persistence логіку замінено на виклик нового Node-скрипта;
  - додано `continue-on-error: true` для fail-safe поведінки persistence кроку.
- Розширено контрактні тести у `scripts/test-ops-scripts.cjs`:
  - `success` сценарій (audit insert успішний);
  - `audit insert fail` сценарій (скрипт повертає warning/fail-safe, не падає);
  - `missing project context` сценарій (коректний skip без insert).
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що це покращило
- Persistence в `audit_logs` стала стійкішою до тимчасових помилок.
- Workflow більше не блокується через ізольовані проблеми persistence.
- Логіка стала тестованою із чітким покриттям критичних operational сценаріїв.
