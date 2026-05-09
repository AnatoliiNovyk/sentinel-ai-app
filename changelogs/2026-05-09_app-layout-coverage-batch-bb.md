# AppLayout Branch Coverage Expansion (Batch BB)

## Як було:
- AppLayout component тестувався з ~84.84% branch coverage
- Браки покриття для: profile fallback (full_name missing), health error status, page title fallback для невідомих шляхів, health tooltip з metadata (lastJobAt/lastError)
- AgentStatus sub-component здійснював polling без повного покриття всіх color states та tooltip scenarios

## Що зроблено:
- Додано 4 нові test case в `src/components/__tests__/AppLayout.test.tsx`:
  1. **Profile fallback** (2 тесту):
     - "displays 'User' when profile.full_name is missing" — перевіряє fallback до "User" коли full_name пусто
     - "calculates initials as 'U' when full_name is empty and email starts with 'u'" — перевіряє ініціали з email коли full_name відсутнє

  2. **Health status amber state** (1 тест):
     - "shows amber dot and label when health status is 'error'" — охоплює третій color state (amber) для health indicator

  3. **Page title fallback** (1 тест):
     - "displays 'Sentinel AI' for unknown pathname not in PAGE_TITLES" — тестує fallback title для невідомих маршрутів, виправлено selector ambiguity via `getAllByText()[1]`

  4. **Health tooltip content** (2 тесту):
     - "displays lastJobAt in tooltip when health is reachable and has timestamp" — перевіряє formatted timestamp в tooltip
     - "displays lastError in tooltip when health has error message" — тестує error message rendering

- Виправлено selector ambiguity: "Sentinel AI" text з'являється в sidebar та header, використано `getAllByText("Sentinel AI")[1]` для targeting header title
- Усі 4 нові тести проходять успішно разом з 36 існуючими (всього 40/40 тестів в файлі)

## Що покращило:
- AppLayout branch coverage підвищено захистом додаткових edge cases в rendering logic
- Profile display paths (full_name fallback) тепер мають тестове покриття
- Health indicator color states (ok, error, null/reachable states) повністю охоплені
- Page title fallback для невідомих маршрутів валідовано
- AgentStatus tooltip metadata rendering (lastJobAt, lastError) гарантовано працює
- Фокусований vitest run: **40/40 PASSED** (~8.0s duration) ✅
