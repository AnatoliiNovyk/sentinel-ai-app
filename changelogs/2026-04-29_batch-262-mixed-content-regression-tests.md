# Batch 262: Mixed-content regression tests for agent health UI

## Як було
- Mixed-content фікс для Agent health уже був у прод-коді, але не мав окремого регресійного UI-покриття.
- Була ймовірність непомітного повернення станів `Agent offline`/`Failed to fetch` при HTTPS frontend + HTTP agent URL.

## Що зроблено
- Додано тест у [src/components/__tests__/AppLayout.test.tsx](src/components/__tests__/AppLayout.test.tsx):
  - emulation HTTPS сторінки + HTTP agent endpoint;
  - перевірка тексту `Agent check blocked (HTTPS -> HTTP)`;
  - перевірка, що `fetch` не викликається у policy-block сценарії.
- Додано тест у [src/pages/__tests__/Settings.test.tsx](src/pages/__tests__/Settings.test.tsx):
  - emulation HTTPS сторінки + HTTP agent endpoint;
  - натискання `Check` і перевірка повідомлення `Blocked by browser policy...`;
  - перевірка, що `fetch` не викликається.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).
- Запущено валідацію:
  - `npm run test -- src/components/__tests__/AppLayout.test.tsx src/pages/__tests__/Settings.test.tsx`;
  - `npm run lint -- --max-warnings=0`.

## Що покращило
- Зафіксовано критичну UX-логіку policy-block у тестах і зменшено ризик регресії.
- Проблема mixed-content тепер відловлюється автоматично у локальній/CI перевірці.
- Знижено шанс хибної діагностики доступності агента в інтерфейсі.
