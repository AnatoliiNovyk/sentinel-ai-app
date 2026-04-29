# Batch 265: Agent URL persistence fix after page reload

## Як було
- Після зміни Agent URL у Settings (наприклад на `http://95.67.75.146:9090/health`) і перезавантаження сторінки значення могло повертатися до попереднього.
- Збереження URL фактично залежало від явної дії перевірки, що створювало втрату останнього введеного значення.

## Що зроблено
- Оновлено [src/pages/Settings.tsx](src/pages/Settings.tsx):
  - додано `commitAgentUrl` для надійного збереження в `localStorage`;
  - додано autosave draft з debounce (`300ms`) при зміні поля URL;
  - додано commit на `blur` поля;
  - додано commit+check на `Enter`.
- Додано регресійний тест у [src/pages/__tests__/Settings.test.tsx](src/pages/__tests__/Settings.test.tsx):
  - перевірка, що URL зберігається в `localStorage` після blur;
  - перевірка, що після remount/reload значення відновлюється в полі.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- Значення Agent URL більше не губиться після перезавантаження сторінки.
- Знижується кількість ручних повторних введень URL і помилок конфігурації.
- Поведінка зафіксована тестом, щоб не допустити регресію.
