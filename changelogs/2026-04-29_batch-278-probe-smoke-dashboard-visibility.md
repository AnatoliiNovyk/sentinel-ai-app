# Batch 278 — Probe Smoke Dashboard Visibility

## Як було
- `agent_health_probe` smoke перевірка виконувалася в GitHub Actions, але її останній результат не відображався напряму в Dashboard.
- Операційна команда бачила стан лише через Actions run/artifact.

## Що зроблено
- У workflow `.github/workflows/agent-health-probe-smoke.yml` додано крок `Persist probe status to audit log`.
  - Крок читає результат `reports/agent-health-probe-smoke.json` (або фолбек при відсутності звіту).
  - Знаходить `org_id/user_id` через `projects`.
  - Пише запис у `audit_logs` з `action=agent_health_probe_smoke` і metadata (status/reachable/http_status/request_id/probed_url/error/generated_at).
- У `src/pages/Dashboard.tsx`:
  - Додано стан `probeSmokeStatus`.
  - Додано запит до `audit_logs` за останнім записом `agent_health_probe_smoke`.
  - Додано новий UI-блок `Agent probe smoke` з індикатором `OK/Fail/Unknown` та полями Reachable/HTTP/Request ID/Last run.
- У `src/pages/__tests__/Dashboard.test.tsx`:
  - Додано тести на рендер блоку probe smoke.
  - Додано тести на fallback-стан `Unknown`.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що це покращило
- Статус gateway probe тепер видно одразу у Dashboard без переходу в GitHub Actions.
- Додано єдине operational джерело стану через `audit_logs`.
- Полегшено triage інцидентів (видно останній HTTP, request-id, час запуску).
