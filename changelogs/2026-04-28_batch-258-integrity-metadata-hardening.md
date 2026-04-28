# Batch 258: Integrity metadata hardening in evidence verifier

## Як було
- Verifier вже перевіряв payload hash match, schema version і evidence_id, але не мав strict валідації формату `integrity.payload_hash`.
- Не вистачало окремого негативного покриття для `integrity.algorithm` та `unsupported report_type`.

## Що зроблено
- Оновлено [scripts/verify-evidence-integrity.cjs](scripts/verify-evidence-integrity.cjs):
  - додано `validateIntegrityMetadata(report)`;
  - strict-валідація `integrity.algorithm === "sha256"`;
  - strict-валідація `integrity.payload_hash` як `^[a-f0-9]{64}$`.
- Оновлено [scripts/test-ops-scripts.cjs](scripts/test-ops-scripts.cjs):
  - негативний кейс `invalid integrity algorithm` (`md5`);
  - негативний кейс `invalid integrity.payload_hash format`;
  - негативний кейс `unsupported report_type`.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- Підвищено строгость і передбачуваність перевірки evidence envelope.
- Знижено ризик прийняття malformed integrity metadata.
- Додано регресійний захист від несанкціонованих/невідомих report types.
