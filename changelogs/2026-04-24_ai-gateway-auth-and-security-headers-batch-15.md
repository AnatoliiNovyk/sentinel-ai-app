Як було:
- AI gateway вже мала payload/rate-limit hardening і endpoint-level тести, але не перевіряла обов'язкову наявність `Authorization: Bearer ...` для POST-запитів.
- У JSON-відповідях не було централізованого набору security headers.

Що зроблено:
- Оновлено [supabase/functions/ai-gateway/contract.ts](supabase/functions/ai-gateway/contract.ts):
  - додано новий код помилки `UNAUTHORIZED` у `GatewayErrorCode`.
- Оновлено [supabase/functions/ai-gateway/handler.ts](supabase/functions/ai-gateway/handler.ts):
  - додано `securityHeaders` для всіх JSON-відповідей:
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: no-referrer`
    - `X-Frame-Options: DENY`
    - `Cache-Control: no-store`
  - додано guard `hasValidBearerAuth(...)`.
  - для POST без валідного Bearer токена повертається safe error `401`:
    - `code: UNAUTHORIZED`
    - `message: Authorization Bearer token is required.`
- Оновлено endpoint-тести [src/lib/__tests__/ai-gateway-handler.test.ts](src/lib/__tests__/ai-gateway-handler.test.ts):
  - додано 401 кейс для відсутнього Authorization
  - додано 401 кейс для не-Bearer схеми
  - додано перевірку security headers у JSON-відповіді
  - оновлено існуючі POST-тести з додаванням Bearer-заголовка
- Прогнано перевірки:
  - `npm run test:run` — PASS (37 тестів, 10 файлів)
  - `npm run quality:check` — PASS

Що покращило/виправило/додало:
- Підсилено захист endpoint від неавторизованих POST-запитів через обов'язковий Bearer guard.
- Додано базові response security headers для зниження ризиків browser-side misuse.
- Закріплено нову поведінку endpoint-level тестами, щоб уникнути регресій у майбутніх змінах.
