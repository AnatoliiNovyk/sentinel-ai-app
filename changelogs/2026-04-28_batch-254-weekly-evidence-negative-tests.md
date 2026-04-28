# Batch 254: Weekly evidence negative verifier tests

## Як було
- Для verifier вже були негативні перевірки tamper/invalid `evidence_id`, але акцентовано переважно на daily report.
- Для weekly SLO/SLA report не було явного негативного покриття на підміну payload та фальшивий hash-suffix у `evidence_id`.

## Що зроблено
- Оновлено [scripts/test-ops-scripts.cjs](scripts/test-ops-scripts.cjs):
  - додано tamper-тест для `weekly_slo_sla_summary` (підміна `summary.success_rate_percent`);
  - додано негативний тест для некоректного `evidence_id` weekly report (`weekly-slo-sla-...-aaaaaaaaaaaa`);
  - в обох кейсах очікується fail verifier з відповідною помилкою.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- Підсилено гарантії evidence integrity саме для weekly executive KPI артефактів.
- Знижено ризик прийняття підроблених weekly звітів у CI/ops процесі.
