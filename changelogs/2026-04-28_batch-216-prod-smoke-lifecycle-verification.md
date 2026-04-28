# Batch 216: Прод-smoke верифікація scan pipeline і lifecycle логів

## Як було
- Після деплою lifecycle logging у `scan-dispatch`/`scan-result` потрібно було підтвердити, що в проді логування реально працює на живому сценарії.
- Початкові smoke-спроби були нестабільні через невалідний payload (`detected_mode`) і несумісні параметри в PowerShell.

## Що зроблено
- Проведено коректний прод-smoke сценарій end-to-end:
  1. Створено тестовий запис `scans` з валідними полями (`status='queued'`, `detected_mode='UNKNOWN'`).
  2. Викликано `scan-dispatch` з валідним payload.
  3. Викликано `scan-result` з контрольованим `error_message`.
  4. Зчитано `agent_logs` по `scan_id`.
- Оновлено execution checklist:
  - у `EXECUTION_CHECKLIST_2026-04-28.md` позначено завершення пост-деплой smoke та перевірки lifecycle логів.

## Що покращило
- Підтверджено, що lifecycle logging у проді працює не лише теоретично, а на реальному виконанні pipeline.
- Доведено наявність нових подій у `agent_logs` для scan lifecycle (включно з failure path), що зменшує MTTR для подальших інцидентів.
