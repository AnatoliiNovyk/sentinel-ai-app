# Batch 271: SchedulesPanel test stabilization (act-warning reduction)

## Як було
- Тести `SchedulesPanel` потенційно генерували `act(...)` warning-шум через асинхронний `load()` у `useEffect`, коли assertions виконувались відразу після `render`.
- Це підвищувало флакі-поведінку і засмічувало CI-лог.

## Що зроблено
- Оновлено [src/components/__tests__/SchedulesPanel.test.tsx](src/components/__tests__/SchedulesPanel.test.tsx):
  - додано `renderPanel(projects)` helper;
  - helper завжди чекає завершення первинного fetch-ланцюга (`mockOrder` викликано) після `render`;
  - тести переведено на `await renderPanel(...)` перед assertions і взаємодіями.

## Що покращило
- Зменшено шум `act(...)` warnings у тестах `SchedulesPanel`.
- Тести стали стабільніші для CI/локального запуску.
- Єдина точка входу для async render унеможливлює race condition у майбутніх змінах.
