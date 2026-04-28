# Batch 256: Regression hardening for reliability changes

## Як було
- Нові reliability зміни (weekly incident automation + dependency degradation + dashboard KPI) були імплементовані, але регресійне покриття для частини сценаріїв залишалось недостатнім.
- У CI не було окремого стабільного job саме для Dashboard suite після додавання weekly KPI блоку.

## Що зроблено
- Оновлено [scripts/test-ops-scripts.cjs](scripts/test-ops-scripts.cjs):
  - розширено `chaos_ops_drill` fixture полем `dependency_degradation`;
  - додано негативний tamper-кейс для `dependency_degradation`;
  - додано негативний кейс для некоректного `evidence_id` у `chaos_ops_drill`.
- Оновлено [src/pages/__tests__/Dashboard.test.tsx](src/pages/__tests__/Dashboard.test.tsx):
  - додано перевірку рендеру секції `Weekly SLO/SLA summary`;
  - додано перевірки KPI-лейблів (`Success %`, `Failure %`, `SLA breach %`) та threshold state.
- Оновлено [.github/workflows/ci.yml](.github/workflows/ci.yml):
  - додано окремий job `Test Dashboard Stability` з запуском `npm run test:dashboard:stable`.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- Знижено ризик непомічених регресій у chaos evidence integrity після додавання dependency degradation.
- Dashboard weekly KPI блок тепер покритий окремими UI-регресійними тестами.
- CI раніше відловлює нестабільність Dashboard suite через виділений heap-safe gate.
