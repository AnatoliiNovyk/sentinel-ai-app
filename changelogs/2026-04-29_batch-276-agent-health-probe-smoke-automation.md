# Batch 276 — Agent Health Probe Smoke Automation

## Як було
- Gateway-шлях `agent_health_probe` був реалізований і протестований локально, але не мав окремої регулярної E2E smoke-автоматизації в GitHub Actions.
- Регресії auth/reachability могли проявлятися пізніше, вже після змін у суміжних пайплайнах.

## Що зроблено
- Додано новий ops-скрипт `scripts/agent-health-probe-smoke.ps1`.
  - Викликає `POST /functions/v1/ai-gateway` з `action=agent_health_probe`.
  - Підтримує URL з `AGENT_HEALTH_URL` або через `-ProbeUrl`.
  - Підтримує fail-fast режим `-RequireReachable`.
  - Повертає стандартизований JSON-звіт smoke-перевірки.
- Додано workflow `.github/workflows/agent-health-probe-smoke.yml`.
  - Scheduled запуск щогодини.
  - Manual запуск через `workflow_dispatch` з параметрами `probe_url` і `require_reachable`.
  - Публікує artifact `agent-health-probe-smoke.json`.
- Додано контрактний тест для нового скрипта у `scripts/test-ops-scripts.cjs`.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що це покращило
- З'явився регулярний E2E контроль саме gateway probe-шляху.
- Прискорено виявлення інцидентів типу `401`, unreachable endpoint, або некоректного payload/headers.
- Smoke-перевірка стала відтворюваною як у cron, так і вручну.
