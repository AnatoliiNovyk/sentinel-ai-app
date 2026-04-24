Як було:
- Chat flow у [src/pages/Chat.tsx](src/pages/Chat.tsx) після `dispatchChatTask` не забирав результат через `pollForResult`; користувач бачив placeholder `'(AI is responding...)`.
- У гілці щойно створеної розмови використовувався `activeId` (state), що могло давати помилку `Please select or create a conversation.` у тому ж тіку до оновлення state.
- Інтеграційні тести Chat не покривали timeout/success-after-dispatch сценарії AI polling.

Що зроблено:
- Оновлено [src/pages/Chat.tsx](src/pages/Chat.tsx):
  - після успішного `dispatchChatTask` додано виклик `AiService.pollForResult(null, pollingStart)`
  - додано безпечний парсинг тексту відповіді через `extractAssistantText(...)`
  - для помилок polling використовується `errorToUserMessage(...)`
  - виправлено використання conversation id:
    - перевірка існування через `convoId`, а не `activeId`
    - у dispatch передається `convoId`, щоб працювало відразу після створення нової розмови
- Оновлено [src/pages/__tests__/Chat.integration.test.tsx](src/pages/__tests__/Chat.integration.test.tsx):
  - додано сценарій успішної відповіді з polling після dispatch
  - додано сценарій timeout з перевіркою user-facing помилки
  - мок `AiService` розширено (`dispatchChatTask`, `pollForResult`)
- Прогнано перевірки:
  - `npm run test:run` — PASS (12 файлів, 54 тести)
  - `npm run quality:check` — PASS

Що покращило/виправило/додало:
- Chat UI тепер реально дочікується AI результату, а не зберігає лише placeholder.
- Покращено надійність UX у transient/timeout сценаріях через інтеграцію polling + помилки користувачу.
- Усунено race-condition із `activeId` після створення нової розмови в поточному тіку.
