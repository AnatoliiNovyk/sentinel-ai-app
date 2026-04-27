Як було:
- Прямий запуск `npx vitest run src/pages/__tests__/Dashboard.test.tsx ...` періодично падав з Node heap OOM (`Worker exited unexpectedly`).
- Для dashboard-only сценарію не було окремої heap-safe команди, тому часто використовувався нестабільний raw `npx` шлях.

Що зроблено:
- У package.json додано новий скрипт:
  - `test:dashboard:stable` = запуск Dashboard suite через `node --max-old-space-size=6144` + vitest entrypoint.
- У README.md (секція Test Stability Commands) додано документування `test:dashboard:stable`.

Що покращило/виправило/додало:
- З'явився стандартизований безпечний запуск для одиночного Dashboard suite без raw `npx` команди.
- Перевірено локально:
  - `npm run test:dashboard:stable` -> 1 file, 10 tests passed;
  - `npm run test:trio:stable` -> 3 files, 28 tests passed.
- Знижено ризик повторного OOM у звичному сценарії локальної діагностики Dashboard тестів.
