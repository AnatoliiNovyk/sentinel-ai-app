Як було:
- Polling policy у src/api/ai.service.ts мала захардкожені значення (attempts/base/max/jitter) без можливості керування через конфіг.
- Не було тестового покриття на сценарії: кастомні env-значення, невалідні env-значення, нормалізація max delay.

Що зроблено:
- Оновлено src/api/ai.service.ts:
  - додано тип PollingPolicy
  - додано DEFAULT_POLLING_POLICY
  - додано валідацію/парсинг env-параметрів:
    - VITE_AI_POLL_MAX_ATTEMPTS
    - VITE_AI_POLL_BASE_DELAY_MS
    - VITE_AI_POLL_MAX_DELAY_MS
    - VITE_AI_POLL_JITTER_RATIO
  - додано getPollingPolicy() з безпечними fallback на дефолти
  - додано нормалізацію maxDelayMs >= baseDelayMs
  - pollForResult тепер використовує policy, отриманий з getPollingPolicy()
- Оновлено src/api/ai.service.test.ts:
  - додано тести на дефолтні значення policy
  - додано тести на валідні кастомні env-значення
  - додано тести на невалідні env-значення (fallback на дефолти)
  - додано тест на нормалізацію maxDelayMs >= baseDelayMs
  - додано cleanup env через vi.unstubAllEnvs() у afterEach
- Під час quality gate виявлено та усунуто додатковий lint-блокер:
  - прибрано невалідні eslint-disable директиви у:
    - src/pages/Dashboard.js
    - src/pages/Scheduler.js
- Прогнано перевірки:
  - npm run quality:check — PASS
  - vitest: 12 файлів, 58 тестів — PASS

Що покращило/виправило/додало:
- Polling policy стала керованою через env-конфіг без змін коду.
- Додано надійну валідацію параметрів policy з безпечними fallback-значеннями.
- Підвищено стабільність CI за рахунок усунення lint-блокера.
