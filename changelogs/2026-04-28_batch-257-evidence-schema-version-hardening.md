# Batch 257: Evidence schema_version hardening

## Як було
- `verify-evidence-integrity.cjs` перевіряв hash, `evidence_id` та `report_type`, але не вимагав strict `schema_version`.
- Це дозволяло потенційно приймати артефакти з неочікуваною або відсутньою версією схеми.

## Що зроблено
- Оновлено [scripts/verify-evidence-integrity.cjs](scripts/verify-evidence-integrity.cjs):
  - додано strict перевірку `schema_version === "1.0"`;
  - додано explicit валідацію наявності/типу `report_type` перед обробкою payload.
- Оновлено [scripts/test-ops-scripts.cjs](scripts/test-ops-scripts.cjs):
  - додано негативний кейс `invalid schema_version` (`2.0`) для weekly report;
  - додано негативний кейс `missing schema_version` для daily report;
  - обидва кейси перевіряють очікуваний fail verifier.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- Посилено governance evidence-конвертів: verifier приймає лише підтримувану схему.
- Знижено ризик silent acceptance невалідних/нестандартних артефактів.
- Підвищено передбачуваність еволюції формату evidence при майбутніх schema upgrades.
