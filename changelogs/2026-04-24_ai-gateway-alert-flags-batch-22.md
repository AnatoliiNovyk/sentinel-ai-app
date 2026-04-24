Як було:
- Admin diagnostics endpoint already returned `telemetry`, `recent_events` і `event_rates`, але не надавав явних alert-прапорців для швидкої оцінки стану.
- Для інтерпретації ризику потрібно було вручну аналізувати числа у `event_rates`.

Що зроблено:
- Оновлено [supabase/functions/ai-gateway/handler.ts](supabase/functions/ai-gateway/handler.ts):
  - додано тип `GatewayAlerts`
  - додано конфігуровані пороги alerts (константи):
    - `ALERT_RATE_LIMITED_5M_MIN`
    - `ALERT_UNAUTHORIZED_5M_MIN`
    - `ALERT_INVALID_JSON_5M_MIN`
    - `ALERT_DEGRADED_MIN_TOTAL_15M`
    - `ALERT_DEGRADED_FALLBACK_RATIO_15M`
  - додано обчислення alerts через `getAiGatewayAlertsSnapshot(eventRates)`:
    - `high_rate_limited_5m`
    - `high_unauthorized_5m`
    - `high_invalid_json_5m`
    - `degraded_mode`
  - admin GET-відповідь розширено полем `alerts`
- Оновлено [src/lib/__tests__/ai-gateway-admin-metrics.test.ts](src/lib/__tests__/ai-gateway-admin-metrics.test.ts):
  - перевірка сценарію `false` (без перевищення порогів)
  - додано сценарій `true` для перевищення порогів (unauthorized, invalid_json, degraded_mode)
- Прогнано перевірки:
  - `npm run test:run` — PASS
  - `npm run quality:check` — PASS

Що покращило/виправило/додало:
- Додано швидкий сигнальний рівень (`alerts`) для оперативного виявлення аномалій у gateway.
- Зменшено когнітивне навантаження при аналізі діагностики: не лише raw metrics, а готові прапорці стану.
- Пороги винесено в константи для безпечного тюнінгу без зміни основної логіки обробки запитів.
