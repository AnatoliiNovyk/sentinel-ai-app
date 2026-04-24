Як було:
- Тестовий baseline існував, але покриття було мінімальне (базові перевірки для error mapping).
- Критичні потоки `Result`-контракту, scan dispatch mode (`REAL`/`MOCK`) і AI polling майже не були зафіксовані unit-тестами.

Що зроблено:
- Додано нові unit-тести:
  - src/lib/__tests__/result-contract.test.ts
  - src/lib/__tests__/scanDispatch.test.ts
  - src/api/ai.service.test.ts
- Покриті сценарії:
  - `success()` / `failure()` контракт і структура помилки.
  - `dispatchScan` для випадків:
    - помилка вставки scan row (`SCAN_DB_INSERT_FAILED`),
    - fallback у mock mode (`MOCK`),
    - успішний edge-dispatch (`REAL`).
  - `AiService` для випадків:
    - RPC fail (`AI_RPC_FAILED`),
    - RPC success,
    - успішний polling результату,
    - timeout polling (`AI_PROCESSING_TIMEOUT`, fake timers).
- Перевірки після змін:
  - `npm run test:run` — успішно (4 files, 11 tests).
  - `npm run lint -- --max-warnings=0` — успішно (0 errors, 0 warnings).

Що покращило/виправило/додало:
- Значно посилено гарантії від регресій у найкритичніших стабілізаційних потоках (error contract + scan mode + ai polling).
- Підвищено надійність зміни режимів `REAL/MOCK` через автоматизовану перевірку поведінки.
- Закладено основу для наступного батчу тестів (scheduler dispatch та UI integration сценарії).
