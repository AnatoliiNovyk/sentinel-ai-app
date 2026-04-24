Як було:
- Після попереднього батчу були покриті `Result`-контракт, `scanDispatch` базові сценарії та `AiService`, але scheduler-потік (`dispatchDueSchedules`) лишався без окремої автоматичної перевірки.

Що зроблено:
- Додано новий unit-тест файл:
  - src/lib/__tests__/schedulerDispatch.test.ts
- Покрито ключові сценарії `dispatchDueSchedules`:
  - помилка запиту due schedules -> повернення `0`;
  - відсутність due schedules -> повернення `0` без dispatch;
  - optimistic-lock помилка на update -> schedule пропускається;
  - змішаний сценарій із 2 due schedules, де враховуються лише успішні dispatch-и.
- Для тестів використано контрольовані мок-ланцюги Supabase query builder + mock `runMockScan`.

Що покращило/виправило/додало:
- Зменшено ризик регресій у scheduler-оркестрації та конкурентних сценаріях (optimistic lock).
- Посилено гарантії правильного підрахунку фактично запущених задач.
- Після змін quality gate лишився зеленим:
  - `npm run test:run` -> 5 files, 15 tests, all passed;
  - `npm run lint -- --max-warnings=0` -> passed.
