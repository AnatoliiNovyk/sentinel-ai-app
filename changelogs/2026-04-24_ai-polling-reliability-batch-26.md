Як було:
- Polling у [src/api/ai.service.ts](src/api/ai.service.ts) працював з фіксованою затримкою 3000мс і без відмінності між transient та non-retryable збоями.
- Будь-які query помилки фактично зводились до загального timeout-сценарію.

Що зроблено:
- Оновлено [src/api/ai.service.ts](src/api/ai.service.ts):
  - додано retry policy для polling:
    - `POLL_MAX_ATTEMPTS = 40`
    - exponential backoff з верхньою межею (`POLL_MAX_DELAY_MS`)
    - jitter (`POLL_JITTER_RATIO`) для зменшення синхронних колізій
  - додано класифікацію помилок polling:
    - retryable (повторюємо)
    - non-retryable (падаємо одразу)
  - для non-retryable повертається `AI_POLLING_FAILED`
  - для вичерпання retry з transient помилками зберігається `AI_PROCESSING_TIMEOUT` з контекстом `attempts`
- Оновлено [src/lib/errors.ts](src/lib/errors.ts):
  - додано новий код `AI_POLLING_FAILED`
  - додано user-facing message для `AI_POLLING_FAILED`
- Оновлено [src/api/ai.service.test.ts](src/api/ai.service.test.ts):
  - адаптовано query mock під `{ data, error }`
  - timeout test переведено на стабільний `runAllTimersAsync`
  - додано тест `success-after-retry` (transient error -> success)
  - додано тест `non-retryable` (миттєвий fail з `AI_POLLING_FAILED`)
- Прогнано перевірки:
  - `npm run test:run` — PASS (12 файлів, 52 тести)
  - `npm run quality:check` — PASS

Що покращило/виправило/додало:
- Polling став стійкішим до короткочасних збоїв БД/мережі.
- Зменшено ризик синхронних піків навантаження через backoff+jitter.
- З’явилось чітке розділення timeout-сценаріїв і non-retryable помилок, що спрощує діагностику та triage.
