# Batch 255: All three follow-ups implemented

## Як було
- Weekly SLO/SLA summary вже існував у ops-automation, але не мав видимого KPI-блоку у Dashboard.
- Для weekly breaches не було вбудованої issue/incident ескалації у GitHub.
- Chaos drill не покривав окремо dependency degradation сценарії у звіті.

## Що зроблено
- Оновлено [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx):
  - додано блок `Weekly SLO/SLA summary` у Dashboard;
  - обчислюються KPI за останні 7 днів: scans total/completed/failed, success/failure %, avg/p95 duration, SLA breach %;
  - додано статус threshold compliance (`Thresholds OK` / `Threshold breach`).
- Оновлено [.github/workflows/weekly-slo-sla-summary.yml](.github/workflows/weekly-slo-sla-summary.yml):
  - додано `permissions` для роботи з issue;
  - додано outputs з кроку summary (`thresholds_ok`, `breach_count`, `evidence_id`);
  - додано автоматичний tracker issue з коментарями для кожного breach;
  - при repeated breaches автоматично створюється/оновлюється incident issue.
- Оновлено [.github/workflows/chaos-ops-drill.yml](.github/workflows/chaos-ops-drill.yml):
  - додано `workflow_dispatch` input `run_dependency_degradation_checks`;
  - додано dependency degradation сценарії: `dns-resolution-failure`, `connection-refused`;
  - результати сценаріїв додаються до evidence report (`dependency_degradation`);
  - drill позначається failed, якщо dependency degradation сценарії не пройдені за очікуванням.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- Є видимий weekly executive reliability контроль прямо в продукті.
- Repeated weekly breaches більше не губляться: автоматично формується issue/incident слід.
- Chaos readiness покриває деградацію залежностей, а не лише загальний pass/fail контрактів.
