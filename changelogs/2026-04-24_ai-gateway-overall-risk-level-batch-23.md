Як було:
- Admin diagnostics endpoint already мав `telemetry`, `recent_events`, `event_rates` і `alerts`, але не мав єдиного інтегрального індикатора ризику.
- Для оцінки загального стану потрібно було вручну інтерпретувати кілька полів одночасно.

Що зроблено:
- Оновлено [supabase/functions/ai-gateway/handler.ts](supabase/functions/ai-gateway/handler.ts):
  - додано тип `GatewayRiskLevel` (`low | medium | high`)
  - додано helper `getAiGatewayOverallRiskLevel(alerts, eventRates)`
  - додано поріг `MEDIUM_RISK_MIN_TOTAL_EVENTS_15M`
  - у admin GET-відповідь додано поле `overall_risk_level`
- Логіка `overall_risk_level`:
  - `high`: якщо `degraded_mode` або `high_rate_limited_5m`
  - `medium`: якщо `high_unauthorized_5m` або `high_invalid_json_5m`, або велика загальна інтенсивність подій за 15м
  - `low`: в інших випадках
- Оновлено [src/lib/__tests__/ai-gateway-admin-metrics.test.ts](src/lib/__tests__/ai-gateway-admin-metrics.test.ts):
  - у базовому сценарії перевіряється `overall_risk_level = low`
  - у сценарії перевищення порогів перевіряється `overall_risk_level = high`
- Прогнано перевірки:
  - `npm run quality:check` — PASS (vitest: 12 файлів, 50 тестів)

Що покращило/виправило/додало:
- Додано інтегральний ризик-індикатор для швидкого operational triage.
- Зменшено час на ручну інтерпретацію diagnostics payload.
- Збережено low-risk підхід: зміни обмежені admin diagnostics без впливу на основний POST flow.
