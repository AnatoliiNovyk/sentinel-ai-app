Як було:
- У Windows-середовищі користувач періодично запускав raw `npx vitest run ...`, що призводило до worker OOM.
- Хоча heap-safe npm скрипти вже існували, не було окремого wrapper-інструмента, який стандартизує безпечний запуск і зменшує ризик випадкового raw запуску.

Що зроблено:
- Додано новий PowerShell helper: `scripts/test-safe.ps1`.
  - Підтримує `-Suite dashboard|trio|full`.
  - Делегує виконання на відповідні heap-safe npm скрипти.
  - Повертає коректний exit code при падінні.
- У package.json додано wrapper-скрипти:
  - `test:safe`
  - `test:safe:dashboard`
  - `test:safe:trio`
  - `test:safe:full`
- У README.md (Test Stability Commands) додано документування `test:safe:*` команд.

Що покращило/виправило/додало:
- Уніфіковано безпечний шлях запуску тестів для Windows-команди.
- Зменшено ризик повторного запуску нестабільних raw `npx vitest run ...` команд.
- Перевірено локально:
  - `npm run test:safe:dashboard` -> 1 file, 10 tests passed;
  - `npm run test:safe:trio` -> 3 files, 28 tests passed.
