# Batch 225: Adaptive polling backoff для queue claim

## Як було
- Агент опитував чергу з фіксованим інтервалом 3с навіть при серії помилок `claim_next_job`.
- Під деградацією БД/мережі це створювало зайве повторне навантаження.

## Що зроблено
- У `sentinel-agent/src/index.ts` замінено фіксований polling на adaptive strategy:
  - `BASE_POLL_INTERVAL_MS = 3000`
  - `MAX_POLL_INTERVAL_MS = 30000`
- Додано exponential backoff при послідовних loop/claim помилках.
- Додано jitter (±20%) через helper `withJitter`, щоб уникати синхронізованих burst-запитів.
- `fetchPendingJob` тепер кидає помилку при фейлі `claim_next_job`, щоб backoff керувався в main loop централізовано.
- При стабілізації цикл автоматично повертається до базового інтервалу.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (P2 progress).

## Що покращило
- Зменшено pressure на БД/мережу під час інцидентів.
- Підвищено стійкість агентного polling loop при тимчасових збоях.
- Зменшено ризик «thundering herd» ефекту через jitter.
