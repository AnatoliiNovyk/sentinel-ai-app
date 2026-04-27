Як було:
- У ручних багаторазових прогонках Vitest періодично виникав `Worker exited unexpectedly` / Node heap OOM у старих або довгоживучих процесах.
- Стандартні команди запуску не піднімали memory ceiling для Node runtime.

Що зроблено:
- У package.json додано heap-safe скрипти запуску тестів:
  - `test:trio:stable` — запускає Dashboard/Projects/Reports через `node --max-old-space-size=6144`.
  - `test:full:stability:heap` — запускає full stability-run через `node --max-old-space-size=6144`.
- Перевірено новий скрипт `npm run test:trio:stable`.

Що покращило/виправило/додало:
- Отримано стабільний запуск `3 files / 28 tests passed` через heap-safe entrypoint.
- Знижено ризик OOM/worker-exit при ручних регресійних прогонах у Windows середовищі.
- Без змін у production-коді; тільки операційна стабілізація тестового контуру.
