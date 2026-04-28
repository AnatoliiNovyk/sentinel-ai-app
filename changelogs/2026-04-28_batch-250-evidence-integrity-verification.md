# Batch 250: Evidence integrity verification automation

## Як було
- Ops reports містили hash integrity, але не було окремого автоматичного кроку в CI/workflow, який би перевіряв цілісність артефакту перед/після публікації.

## Що зроблено
- Додано `scripts/verify-evidence-integrity.cjs`:
  - перевіряє `integrity.algorithm=sha256` і `payload_hash`;
  - підтримує `daily_scan_health_report`, `scan_pipeline_recovery_playbook`, `chaos_ops_drill`;
  - фейлить процес при mismatch hash.
- Оновлено workflows:
  - `.github/workflows/daily-scan-health-report.yml` -> `Verify evidence integrity` step;
  - `.github/workflows/recovery-playbook.yml` -> `Verify evidence integrity` step;
  - `.github/workflows/chaos-ops-drill.yml` -> `Verify evidence integrity` step.
- Оновлено `scripts/test-ops-scripts.cjs`:
  - додано `testEvidenceIntegrityVerifier` для 3 типів звітів.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що покращило
- Пайплайни тепер виявляють пошкодження/дрейф evidence payload автоматично.
- Підвищено довіру до audit-артефактів для інцидентних розслідувань.
- Зменшено ризик тихих проблем з форматом або integrity hash.
