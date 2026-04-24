Як було:
- Після попереднього hardening gateway уже мала safe-error формат і валідацію структури payload, але не було захисту від flood/abuse на edge-рівні.
- Не було раннього обмеження розміру request body до обробки payload.

Що зроблено:
- Розширено контракт у [supabase/functions/ai-gateway/contract.ts](supabase/functions/ai-gateway/contract.ts):
  - додано коди помилок `RATE_LIMITED` і `PAYLOAD_TOO_LARGE`
  - додано константу `MAX_REQUEST_BODY_BYTES`
  - додано helper `isPayloadTooLarge(...)`
- Додано модуль rate limit у [supabase/functions/ai-gateway/rateLimit.ts](supabase/functions/ai-gateway/rateLimit.ts):
  - in-memory ковзне вікно (default: 30 запитів / 60 секунд)
  - визначення client key з `x-forwarded-for` / `x-real-ip` / `cf-connecting-ip`
  - обчислення `retryAfterSeconds` для заголовка `Retry-After`
- Оновлено [supabase/functions/ai-gateway/index.ts](supabase/functions/ai-gateway/index.ts):
  - перевірка rate limit перед обробкою тіла запиту
  - повернення 429 з safe error і `Retry-After`
  - рання перевірка розміру тіла запиту та повернення 413 (`PAYLOAD_TOO_LARGE`)
  - уніфікований jsonResponse з підтримкою додаткових заголовків
- Додано тестове покриття:
  - [src/lib/__tests__/ai-gateway-rate-limit.test.ts](src/lib/__tests__/ai-gateway-rate-limit.test.ts)
  - оновлено [src/lib/__tests__/ai-gateway-contract.test.ts](src/lib/__tests__/ai-gateway-contract.test.ts) (перевірка payload size helper)
- Прогнано перевірки:
  - `npm run test:run` — PASS (28 тестів, 9 файлів)
  - `npm run quality:check` — PASS

Що покращило/виправило/додало:
- Додано базовий захист від flood/abuse для AI gateway на edge-рівні.
- Зменшено ризик DoS через надмірно великі payload до етапу AI обробки.
- Збережено уніфікований safe-error контракт і підтверджено стабільність через тести та quality gate.
