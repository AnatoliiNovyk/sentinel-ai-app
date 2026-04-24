Як було:
- Admin GET endpoint уже повертав counters telemetry, але не давав огляд останніх подій для швидкого аналізу тренду.
- Було складніше зрозуміти послідовність нещодавніх guard/fallback інцидентів без перегляду логів.

Що зроблено:
- Оновлено [supabase/functions/ai-gateway/handler.ts](supabase/functions/ai-gateway/handler.ts):
  - додано типи подій telemetry (`TelemetryEventType`, `TelemetryRecentEvent`)
  - додано in-memory bounded буфер `telemetryRecentEvents` на 50 останніх записів
  - додано мапінг metric -> event_type та запис події в `incrementTelemetry(...)`
  - подія містить лише безпечні поля:
    - `timestamp`
    - `request_id`
    - `event_type`
    - `status_code` (коли застосовно)
  - додано експорт `getAiGatewayRecentEventsSnapshot(limit)`
  - додано очищення історії у `resetAiGatewayTelemetryForTests()`
  - admin GET-відповідь розширено полем `recent_events`, обмеженим останніми 20 записами
- Оновлено [src/lib/__tests__/ai-gateway-admin-metrics.test.ts](src/lib/__tests__/ai-gateway-admin-metrics.test.ts):
  - перевірка наявності `recent_events` у admin-відповіді
  - перевірка структури першої події (`event_type`, `status_code`)
  - перевірка відсутності чутливих рядків у серіалізованій історії
- Оновлено [src/lib/__tests__/ai-gateway-telemetry.test.ts](src/lib/__tests__/ai-gateway-telemetry.test.ts):
  - тест bounded history: зберігаються тільки останні 50 подій у snapshot helper
  - перевірка безпечного складу recent events (без authorization/token/payload)
- Прогнано перевірки:
  - `npm run quality:check` — PASS (lint + typecheck + tests + build)

Що покращило/виправило/додало:
- Додано короткострокову історію подій для швидкої діагностики трендів у gateway.
- Збережено безпечний підхід: у recent events немає payload-даних та секретів.
- Посилено observability без додавання зовнішніх залежностей або зміни основного POST-потоку.
