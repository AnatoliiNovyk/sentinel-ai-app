Як було:
- Локальний сценарій `quality:check` уже існував і працював, але в CI не було окремого workflow, який примусово запускає цей quality gate для кожного PR/push.

Що зроблено:
- Додано новий GitHub Actions workflow:
  - .github/workflows/quality-gate.yml
- Workflow запускається на:
  - push (main/master)
  - pull_request (main/master)
  - workflow_dispatch
- Pipeline workflow:
  - checkout
  - setup-node (Node 20, npm cache)
  - npm ci
  - npm run quality:check
- Після змін локально повторно прогнано `npm run quality:check`.

Що покращило/виправило/додало:
- Quality gate тепер автоматично контролюється в CI, а не лише локально.
- Зменшено ризик потрапляння регресій у main через пропущені ручні перевірки.
- Підтверджено, що репозиторій лишається green після додавання workflow.
