Як було:
- AI gateway уже мала security hardening (auth/rate-limit/payload guard/request-id/safe logs), але не мала явних lightweight telemetry counters для guard/fallback подій.
- Не було окремого тестового покриття, яке підтверджує інкремент кожної ключової метрики.

Що зроблено:
- Оновлено [supabase/functions/ai-gateway/handler.ts](supabase/functions/ai-gateway/handler.ts):
  - додано тип метрик `TelemetryMetric` і in-memory лічильники `telemetryMetrics`
  - додано інкремент у ключових гілках:
    - `unauthorized_count`
    - `invalid_json_count`
    - `payload_too_large_count`
    - `rate_limited_count`
    - `provider_fallback_count`
    - `ai_invalid_json_count`
  - додано safe telemetry logging через наявний request-id контекст (`logWithRequestId`)
  - експортовано утиліти для тестів:
    - `getAiGatewayTelemetrySnapshot()`
    - `resetAiGatewayTelemetryForTests()`
- Додано новий тестовий файл [src/lib/__tests__/ai-gateway-telemetry.test.ts](src/lib/__tests__/ai-gateway-telemetry.test.ts):
  - перевірка інкременту для guard-сценаріїв: unauthorized / invalid JSON / payload too large / rate limited
  - перевірка інкременту `provider_fallback_count` у штатному mock fallback flow
  - перевірка інкременту `ai_invalid_json_count` для kill-chain сценарію з невалідним AI JSON
- Прогнано перевірки:
  - `npm run test:run` — PASS (45 тестів, 11 файлів)
  - `npm run quality:check` — PASS

Що покращило/виправило/додало:
- Додано базову observability на рівні edge endpoint без введення зовнішніх залежностей.
- Стало простіше виявляти патерни зловживань/помилок за категоріями guard/fallback подій.
- Поведінка telemetry закріплена тестами, що знижує ризик регресій при подальшому hardening.
