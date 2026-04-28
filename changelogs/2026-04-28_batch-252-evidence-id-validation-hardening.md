# Batch 252: Evidence ID validation hardening

## Як було
- Evidence verifier перевіряв integrity hash payload, але не валідував структуру `evidence_id` і відповідність його hash-суфікса реальному payload hash.

## Що зроблено
- Оновлено `scripts/verify-evidence-integrity.cjs`:
  - додано strict validation `evidence_id` по report-type префіксах;
  - додано regex-формат `prefix-YYYYMMDDTHHMMSSZ-<12hex>`;
  - додано перевірку відповідності останніх 12 hex у `evidence_id` до `payload_hash`.
- Оновлено `scripts/test-ops-scripts.cjs`:
  - адаптовано позитивні fixtures до нового формату `evidence_id`;
  - додано негативний сценарій `invalid evidence_id` з очікуваним fail (`evidence_id hash suffix mismatch`).
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що покращило
- Підвищено цілісність audit trace: `evidence_id` тепер криптографічно прив'язаний до payload.
- Знижено ризик підміни ідентифікаторів evidence при збереженні валідного payload hash.
