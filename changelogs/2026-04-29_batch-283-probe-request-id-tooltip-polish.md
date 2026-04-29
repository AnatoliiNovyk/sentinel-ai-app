# Batch 283 — Probe Request ID Tooltip Polish

## Як було
- У probe smoke UI відображався скорочений `request_id`, але не скрізь було зручно отримати повне значення для triage.

## Що зроблено
- У `src/components/AppLayout.tsx`:
  - розширено стан probe smoke полем `requestId`;
  - tooltip global badge тепер містить повний `request_id` (коли доступний).
- У `src/pages/Dashboard.tsx`:
  - `Request ID` pill тепер має `title` з повним `request_id`.
- У тестах:
  - `src/components/__tests__/AppLayout.test.tsx`: додано перевірку tooltip з `request_id` для `Probe OK` badge.
  - `src/pages/__tests__/Dashboard.test.tsx`: додано перевірку `title` з повним `request_id` у `Request ID` pill.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що це покращило
- Оператор швидше копіює/звіряє повний `request_id` для зв'язки з логами та webhook payload.
- Зменшено ручні кроки під час incident triage.
