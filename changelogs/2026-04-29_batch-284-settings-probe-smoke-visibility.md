# Batch 284 - Settings Probe Smoke Visibility

## Як було
- У `Settings` був live health check агента (`Check`) та блок `Agent online`, але не було read-only видимості останнього регулярного smoke probe з `audit_logs`.
- Оператор бачив probe smoke в `Dashboard`/header, але не в сторінці налаштувань агента.
- `Settings` тести не перевіряли hydrated/fallback стани probe smoke в `Agent Configuration`.

## Що зроблено
- Додано в `Settings` новий read-only блок `Latest probe smoke` у секції `Agent Configuration`.
- Реалізовано завантаження останнього запису `agent_health_probe_smoke` з `audit_logs` (фільтр за `action` і `user_id`, сортування за `created_at desc`, `limit 1`).
- Додано state-модель probe smoke (`status`, `reachable`, `httpStatus`, `requestId`, `generatedAt`) і форматування relative-time (`just now`, `Xm ago`, `Xh ago`, `Xd ago`).
- У UI додано badge `OK/Fail/Unknown` та поля: `Reachable`, `HTTP`, `Request ID` (із tooltip повного значення), `Last run` (relative-time + локальний timestamp у tooltip).
- Оновлено `Settings` тести:
  - fallback сценарій (`Unknown`) без даних,
  - hydrated сценарій із `audit_logs` (`OK`, `yes`, `200`, request id tooltip).

## Що покращило/виправило/додало
- Додано операційну видимість probe smoke без переходу в інші сторінки.
- Покращено triage у `Settings` завдяки request id tooltip і зрозумілому статусу останнього smoke run.
- Підсилено регресійний захист для `Settings` через окремі тести probe smoke блоку.
