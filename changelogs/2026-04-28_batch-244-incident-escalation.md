# Batch 244: Automated incident escalation for daily threshold breaches

## Як було
- Daily health report виявляв breach і міг фейлити workflow, але не мав окремого контрольованого механізму ескалації інциденту.
- Не було контрактних тестів для сценаріїв ескалації/пропуску.

## Що зроблено
- Додано новий скрипт `scripts/escalate-daily-health-breach.ps1`:
  - читає `reports/daily-scan-health-report.json`;
  - при `thresholds_ok=false` формує escalation payload;
  - відправляє webhook з retry/backoff (`MaxAttempts`, `InitialBackoffSeconds`);
  - підтримує `EscalationSeverity` і fallback URL із env (`ESCALATION_ALERT_WEBHOOK_URL` -> `OPERATIONAL_ALERT_WEBHOOK_URL`).
- Оновлено `.github/workflows/daily-scan-health-report.yml`:
  - додано inputs: `escalate_on_breach`, `escalation_severity`, `escalation_webhook_url`;
  - репорт-крок тепер публікує outputs (`thresholds_ok`, `should_fail`, `escalate_on_breach`);
  - додано окремий escalation step, який спрацьовує при breach;
  - додано окремий fail-gate step (`Fail on threshold breach`), щоб ескалація могла відпрацювати перед фінальним фейлом.
- Розширено `scripts/test-ops-scripts.cjs`:
  - тест `testDailyBreachEscalationScript` (breach => webhook викликається, статус `escalated`);
  - тест `testDailyBreachEscalationSkippedWhenHealthy` (healthy => статус `skipped`, webhook не викликається).
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що покращило
- Інциденти по деградаціях тепер автоматично ескалюються, а не лише логуються/фейлять workflow.
- Процес ескалації має явну політику і тестове покриття.
- Зменшено ризик тихих порушень SLO без оперативної реакції.
