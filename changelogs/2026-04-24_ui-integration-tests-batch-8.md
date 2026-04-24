Як було:
- Після unit-батчів були покриті доменні сервіси, але ключові UI user-flow для `Scans` і `Chat` не мали інтеграційних перевірок із моками сервісів.

Що зроблено:
- Додано інтеграційні тести для сторінки сканувань:
  - src/pages/__tests__/Scans.integration.test.tsx
  - Перевірено: початкове завантаження даних, відображення mode, запуск нового скану з fallback target, AI-fix flow + перезавантаження вразливостей.
- Додано інтеграційний тест для чату:
  - src/pages/__tests__/Chat.integration.test.tsx
  - Перевірено: suggestion click -> створення conversation -> user/assistant message pipeline через `runAgent`.
- Усунено тестові флейки:
  - виправлено hoisting моків через `vi.hoisted`;
  - стабілізовано mock `useAuth` (щоб уникнути effect-loop по `user`);
  - додано `scrollTo` stub для jsdom;
  - уточнено assertion для дублікатного тексту в UI.

Що покращило/виправило/додало:
- Додано інтеграційний safety-net для основних користувацьких сценаріїв UI (Scans/Chat) без зміни прод-логіки.
- Зменшено ризик регресій у dispatch/AI-потоках на рівні сторінок.
- Після змін quality gate залишається green:
  - `npm run test:run` -> 7 files, 19 tests, all passed;
  - `npm run lint -- --max-warnings=0` -> passed.
