Як було:
- Контрактні та utility-тести для gateway уже існували, але не було окремого endpoint-level тестування HTTP-обробника на guard-статуси та unified safe-error формат.
- Логіка endpoint була зосереджена в entrypoint-файлі, що ускладнювало цільове тестування handler-поведінки.

Що зроблено:
- Винесено обробник у тестований модуль [supabase/functions/ai-gateway/handler.ts](supabase/functions/ai-gateway/handler.ts):
  - експортовано `handleAiGatewayRequest(...)`
  - збережено чинну поведінку CORS, валідації, rate-limit, payload-size guard та provider fallback
  - додано безпечне читання env через `globalThis` для сумісного тест-рану
- Оновлено entrypoint [supabase/functions/ai-gateway/index.ts](supabase/functions/ai-gateway/index.ts):
  - тепер лише піднімає `Deno.serve(handleAiGatewayRequest)`
- Додано endpoint-level тести [src/lib/__tests__/ai-gateway-handler.test.ts](src/lib/__tests__/ai-gateway-handler.test.ts):
  - 405 для non-POST + перевірка safe-error payload
  - 400 для invalid JSON + перевірка safe-error payload
  - 413 для oversized payload + перевірка safe-error payload
  - 429 для rate limit exceeded + перевірка `Retry-After` і safe-error payload
- Прогнано перевірки:
  - `npm run test:run` — PASS (34 тести, 10 файлів)
  - `npm run quality:check` — PASS

Що покращило/виправило/додало:
- Додано пряме регресійне покриття HTTP-контракту gateway на рівні endpoint guards.
- Зменшено ризик непомітного ламання форматів помилок/статус-кодів у майбутніх змінах.
- Підвищено підтримуваність edge-функції через розділення entrypoint і тестованого handler-модуля.
