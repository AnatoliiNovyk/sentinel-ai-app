# Batch 217: Hardening smoke script (без інтерактивного prompt)

## Як було
- Під час запуску `scripts/smoke-pipeline-safe.ps1` у Windows PowerShell з'являвся інтерактивний warning `Script Execution Risk` від `Invoke-WebRequest`.
- Через це smoke-перевірка могла зависати в CI/автоматизованому запуску й вимагала ручного вводу.

## Що зроблено
- У [scripts/smoke-pipeline-safe.ps1](scripts/smoke-pipeline-safe.ps1) додано `-UseBasicParsing` в helper `Invoke-JsonRequest` для `Invoke-WebRequest`.
- Повторно виконано smoke-команду:
  - `powershell -ExecutionPolicy Bypass -File scripts/smoke-pipeline-safe.ps1 -ControlledFailure`
- Підтверджено неінтерактивний запуск і валідний JSON-результат.

## Що покращило
- Smoke-скрипт став стабільно автоматизованим для Windows PowerShell (без ручних підтверджень).
- Підвищено надійність операційних smoke-перевірок у release-потоці.
