Як було:
- Gateway уже мала auth/payload/rate-limit hardening і security headers, але не підтримувала стабільну кореляцію запитів через `X-Request-Id`.
- Логи помилок писались без уніфікованого request context і без маскування потенційно чутливих токенів/ключів у тексті помилок.

Що зроблено:
- Оновлено [supabase/functions/ai-gateway/handler.ts](supabase/functions/ai-gateway/handler.ts):
  - додано `REQUEST_ID_HEADER = X-Request-Id`
  - додано генерацію request id (`buildRequestId`) і резолв вхідного (`resolveRequestId`):
    - якщо `x-request-id` валідний за форматом, він пробрасывається далі
    - якщо невалідний/відсутній, генерується новий
  - додано `X-Request-Id` у всі відповіді (JSON і OPTIONS)
  - додано safe logging helpers:
    - `safeErrorDetails(...)` для маскування Bearer/token/apikey/authorization значень
    - `logWithRequestId(...)` для уніфікованих логів із кореляційним id
  - замінено прямі `console.error(...)` у провайдер fallback flow і unhandled catch на `logWithRequestId(...)`
- Оновлено endpoint-тести [src/lib/__tests__/ai-gateway-handler.test.ts](src/lib/__tests__/ai-gateway-handler.test.ts):
  - додано перевірки `X-Request-Id` у guard-відповідях (405/401/413/429/400)
  - додано тест на проброс валідного `x-request-id`
  - додано тест на автогенерацію `x-request-id` для невалідного вхідного значення
- Прогнано перевірки:
  - `npm run test:run` — PASS (39 тестів, 10 файлів)
  - `npm run quality:check` — PASS

Що покращило/виправило/додало:
- Додано кореляцію запитів у gateway для кращого трасування інцидентів і діагностики.
- Знижено ризик випадкового витоку чутливих значень у логах через базове маскування.
- Закріплено нову поведінку endpoint-level тестами і підтверджено green quality state.
