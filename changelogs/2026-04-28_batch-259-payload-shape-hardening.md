# Batch 259: Payload shape hardening in evidence verifier

## Як було
- Verifier вже перевіряв `schema_version`, integrity metadata, `report_type` та `evidence_id`.
- Але не було strict-перевірки типів полів payload для daily/weekly report (наприклад, `thresholds_ok`, `threshold_breaches`).

## Що зроблено
- Оновлено [scripts/verify-evidence-integrity.cjs](scripts/verify-evidence-integrity.cjs):
  - додано `validateReportPayloadShape(report)`;
  - для `daily_scan_health_report` і `weekly_slo_sla_summary`:
    - `summary` має бути object;
    - `thresholds_ok` має бути boolean;
    - `threshold_breaches` має бути array;
  - для `scan_pipeline_recovery_playbook`:
    - `summary` має бути object.
- Оновлено [scripts/test-ops-scripts.cjs](scripts/test-ops-scripts.cjs):
  - додано негативний кейс на некоректний тип `thresholds_ok`;
  - додано негативний кейс на некоректний тип `threshold_breaches`.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- Verifier блокує структурно невалідні evidence payload навіть якщо hash формально узгоджений.
- Знижено ризик silent acceptance malformed report-структур.
- Підсилено стабільність контракту між генераторами звітів і verifier.
