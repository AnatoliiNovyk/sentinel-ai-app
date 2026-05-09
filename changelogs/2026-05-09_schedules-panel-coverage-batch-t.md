# Batch T: SchedulesPanel branch coverage

## Як було
- У `src/components/SchedulesPanel.tsx` залишались edge-гілки, не покриті тестами:
  - fallback назви проєкту (`project?.name ?? 'project'`),
  - overdue badge умова (`enabled && next_run_at < now`),
  - гілка `Resume` для paused schedule,
  - auth early-return у `load()` при `!user`,
  - перевірка payload вставки при створенні нового розкладу.

## Що зроблено
- Розширено `src/components/__tests__/SchedulesPanel.test.tsx`:
  - додано контрольований `authState` mock для сценаріїв `user`/`no user`;
  - додано тести на fallback `on project` коли project не знайдено;
  - додано тести на overdue badge:
    - показується для enabled + past next run;
    - не показується для paused + past next run;
  - додано тест для кнопки `Resume` і перевірки `update({ enabled: true })`;
  - додано перевірку `insert(...)` payload при `Create schedule`;
  - додано auth edge тест: при `user = null` `load()` повертається рано і панель лишається у loading state.
- Прогони:
  - `npx vitest run src/components/__tests__/SchedulesPanel.test.tsx`
  - `npm run quality:check`

## Що покращило/виправило/додало
- Стабілізовано покриття гілок для ключових умов у `SchedulesPanel` без змін production-коду.
- Підвищено надійність тестів для сценаріїв планувальника: fallback, overdue, pause/resume, auth edge.
- Локальний тестовий файл: **24/24 PASS**.
- Повний quality gate: **PASS**.
