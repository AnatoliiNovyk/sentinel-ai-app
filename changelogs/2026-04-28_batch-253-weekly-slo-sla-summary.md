# Batch 253: Weekly SLO/SLA summary automation

## Як було
- Були daily/chaos/recovery automation та evidence integrity, але не було окремого weekly executive KPI summary по SLO/SLA для reliability оцінки.

## Що зроблено
- Додано `scripts/weekly-slo-sla-summary.ps1`:
  - збирає weekly метрики зі `scans`;
  - рахує success/failure rates, avg/p95 duration, SLA breach rate;
  - застосовує threshold policy (`MinSuccessRatePercent`, `MaxFailureRatePercent`, `MaxSlaBreachRatePercent`);
  - формує evidence envelope (`schema_version`, `report_type`, `evidence_id`, `integrity.payload_hash`, `run_context`);
  - optional webhook summary.
- Додано `.github/workflows/weekly-slo-sla-summary.yml`:
  - scheduled weekly + manual dispatch inputs;
  - генерація `reports/weekly-slo-sla-summary.json`;
  - integrity verification через `scripts/verify-evidence-integrity.cjs`;
  - upload artifact.
- Оновлено `scripts/verify-evidence-integrity.cjs`:
  - додано підтримку `weekly_slo_sla_summary`.
- Оновлено `scripts/test-ops-scripts.cjs`:
  - додано `testWeeklySloSlaSummaryScript`;
  - додано coverage для verifier weekly report type.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що покращило
- З'явився регулярний executive рівень видимості reliability KPI.
- Weekly SLO/SLA evidence автоматично перевіряється на integrity.
- Підсилено governance для прийняття рішень на основі трендів стабільності.
