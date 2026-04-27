Як було:
- У проєкті вже були heap-safe test скрипти, але команда все ще могла легко запускати raw `npx vitest run ...` і ловити OOM/worker crashes.
- У README не було достатньо жорсткого попередження про заборону raw запусків для проблемних suite.

Що зроблено:
- Додано `scripts/warn-safe-tests.cjs` з явним попередженням про використання `test:safe:*` команд.
- Оновлено package.json:
  - `test` і `test:run` тепер спочатку показують warning hook (`node scripts/warn-safe-tests.cjs`), потім запускають Vitest.
- Оновлено README.md у секції Test Stability Commands:
  - додано прямий текст: не використовувати raw `npx vitest run ...` для Dashboard/Trio;
  - вказано використовувати `test:safe:*`.

Що покращило/виправило/додало:
- Команда отримує явний guard-сигнал перед стандартними тест-запусками.
- Знижено ймовірність випадкового повернення до нестабільного raw запуску на Windows.
- Перевірено: `npm run test:safe:dashboard` проходить успішно (1 file, 10 tests passed).
