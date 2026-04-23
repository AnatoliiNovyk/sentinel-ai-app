Як було:
- Проєкт був у green-стані за lint/build/tests, але виводився сервісний warning від @typescript-eslint про непідтримувану версію TypeScript (локально 5.6.3).

Що зроблено:
- У кореневому package.json зафіксовано TypeScript на сумісну версію: 5.5.4.
- Оновлено lockfile через npm install.
- Повторно виконано повний цикл перевірок:
  - npm run lint -- --max-warnings=0
  - npm run build
  - npm run test:run

Що покращило/виправило/додало:
- Зник warning сумісності TypeScript від @typescript-eslint.
- Збережено стабільний стан якості: 0 lint warnings/errors, успішний build, тести проходять.
- Версії інструментів узгоджені й детерміновані для повторюваних запусків у CI/local.
