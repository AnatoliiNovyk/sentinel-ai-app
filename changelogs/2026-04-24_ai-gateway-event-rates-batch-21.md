Як було:
- Admin diagnostics endpoint already returned `telemetry` counters and `recent_events`, але не давав агрегованого зрізу інтенсивності подій за часовими вікнами.
- Для оцінки тренду доводилося вручну аналізувати recent events.

Що зроблено:
- Оновлено [supabase/functions/ai-gateway/handler.ts](supabase/functions/ai-gateway/handler.ts):
  - додано тип `TelemetryEventRateWindow`
  - додано константу вікон агрегації `5m` і `15m`
  - реалізовано `getAiGatewayEventRatesSnapshot(nowMs)`:
    - `window_5m` і `window_15m`
    - `total`
    - `per_minute`
    - `by_type` по кожному `event_type`
  - розширено admin GET-відповідь полем `event_rates`
- Оновлено [src/lib/__tests__/ai-gateway-admin-metrics.test.ts](src/lib/__tests__/ai-gateway-admin-metrics.test.ts):
  - додано перевірки `event_rates.window_5m/window_15m`
  - додано перевірки, що unauthorized події агрегуються у `by_type`
- Прогнано перевірки:
  - `npm run test:run` — PASS (49 тестів, 12 файлів)
  - `npm run quality:check` — PASS

Що покращило/виправило/додало:
- Додано швидкий агрегований view інтенсивності подій для оперативної діагностики gateway.
- Зменшено потребу в ручному аналізі історії `recent_events` для виявлення трендів.
- Збережено low-risk підхід: без зміни бізнес-логіки POST flow, лише розширення service diagnostics.
