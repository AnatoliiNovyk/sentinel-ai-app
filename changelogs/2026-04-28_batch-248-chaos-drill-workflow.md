# Batch 248: Chaos drill workflow (fault-injection validation)

## Як було
- Контрактні fault-injection сценарії існували, але не було окремого scheduled/manual chaos workflow для регулярної перевірки операційної готовності.

## Що зроблено
- Додано `.github/workflows/chaos-ops-drill.yml`:
  - weekly cron запуск (`15 4 * * 1`) + `workflow_dispatch`;
  - input `run_contract_suite` для керованого запуску;
  - виконується fault-injection suite (`node scripts/test-ops-scripts.cjs`);
  - формується версіонований JSON-звіт `reports/chaos-ops-drill.json`;
  - артефакт завжди завантажується (`if: always()`).

## Що покращило
- З'явився регулярний chaos-контроль readiness алертів/recovery.
- Кожен drill має артефакт, придатний для аудиту й ретроспектив.
- Зменшено ризик «мовчазної» деградації інцидентної автоматизації.
