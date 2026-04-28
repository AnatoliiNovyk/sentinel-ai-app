# Batch 251: Evidence tamper-detection test coverage

## Як було
- Evidence verifier перевіряв hash у happy-path, але в контрактних тестах не було явного негативного сценарію підміни payload.

## Що зроблено
- Оновлено `scripts/test-ops-scripts.cjs`:
  - додано helper `runNodeExpectFail` для очікуваних failure сценаріїв;
  - у `testEvidenceIntegrityVerifier` додано tampered report випадок (`daily-tampered.json`), де payload змінено без оновлення hash;
  - додано assert на повідомлення `Integrity mismatch`.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що покращило
- Підтверджено, що verifier реально детектить компрометацію/дрейф evidence payload.
- Знижено ризик помилкового відчуття безпеки від перевірки лише позитивних сценаріїв.
