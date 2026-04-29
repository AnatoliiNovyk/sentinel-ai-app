# Batch 277 — Maintenance Auto-Merge and Probe Failure Alerting

## Як було
- Workflow оновлення Browserslist DB створював maintenance PR, але auto-merge не вмикався автоматично.
- У workflow `agent-health-probe-smoke` не було явної escalation-нотифікації у webhook при падінні перевірки.

## Що зроблено
- У `.github/workflows/browserslist-db-maintenance.yml`:
  - додано `id: create_pr` для кроку створення PR;
  - додано крок `Enable Pull Request Auto-Merge` через `peter-evans/enable-pull-request-automerge@v3`;
  - auto-merge вмикається лише коли PR реально створено (`pull-request-number` не порожній).
- У `.github/workflows/agent-health-probe-smoke.yml`:
  - додано підготовку `OPERATIONAL_ALERT_WEBHOOK_URL` у env;
  - додано крок `Escalate probe failure` з умовою `if: failure() && secrets.OPERATIONAL_ALERT_WEBHOOK_URL != ''`;
  - крок відправляє structured JSON payload з контекстом run і probe-результатом у webhook.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що це покращило
- Maintenance PR для Browserslist тепер проходить повний автоматичний цикл до merge (за умови зелених required checks).
- Інциденти падіння `agent_health_probe` smoke перевірки отримують миттєву ескалацію в operational webhook.
- Зменшено ручне навантаження і прискорено реакцію на регресії доступності/auth.
