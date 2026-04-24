Як було:
- Admin GET endpoint у gateway повертав `request_id` і `telemetry`, але не містив базового health-контексту для швидкої сервісної діагностики.
- Не було явної верифікації `status/uptime/timestamp/version` у тестах admin-режиму.

Що зроблено:
- Оновлено [supabase/functions/ai-gateway/handler.ts](supabase/functions/ai-gateway/handler.ts):
  - додано `GATEWAY_STARTED_AT_MS` для розрахунку uptime
  - додано helper `getGatewayVersion()` (читає `AI_GATEWAY_VERSION`, fallback: `unknown`)
  - розширено admin GET-відповідь новими полями:
    - `status: "ok"`
    - `uptime_ms`
    - `timestamp` (ISO)
    - `version`
  - захист доступу через `x-gateway-admin-key` + `AI_GATEWAY_ADMIN_KEY` залишився без змін
- Оновлено [src/lib/__tests__/ai-gateway-admin-metrics.test.ts](src/lib/__tests__/ai-gateway-admin-metrics.test.ts):
  - додано перевірку health-полів у 200-відповіді
  - додано перевірку `version` через мок `AI_GATEWAY_VERSION`
  - підтверджено, що `request_id` і `telemetry` як і раніше присутні
- Прогнано перевірки:
  - `npm run test:run` — PASS (48 тестів, 12 файлів)
  - `npm run quality:check` — PASS

Що покращило/виправило/додало:
- Додано легкий health-контекст у службову admin-відповідь gateway без розширення surface area публічного API.
- Покращено оперативну діагностику (uptime/timestamp/version) для експлуатації та support.
- Закріплено нову поведінку тестами і збережено green quality state.
