Як було:
- Heap-safe скрипти для Vitest вже були додані в package.json, але не були явно задокументовані в README.
- У CI не було окремого dedicated job для критичного stability-trio запуску.

Що зроблено:
- Оновлено .github/workflows/ci.yml:
  - додано новий job `test-stability-trio` з кроками checkout/setup/install;
  - job запускає `npm run test:trio:stable`.
- Оновлено README.md:
  - додано секцію `Test Stability Commands`;
  - задокументовано `test:trio:stable` і `test:full:stability:heap`;
  - зафіксовано, що CI запускає `test:trio:stable` як окремий stability job.

Що покращило/виправило/додало:
- Команда отримала явний і стандартизований шлях запуску стабільних тестів локально та в CI.
- Зменшено ризик повернення до нестабільних ручних команд, які раніше провокували OOM/worker exits.
- Поліпшено прозорість quality-процесу для PR та main-branch запусків.
