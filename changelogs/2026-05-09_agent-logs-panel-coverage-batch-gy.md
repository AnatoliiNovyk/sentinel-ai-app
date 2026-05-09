# Changelog — Batch GY: AgentLogsPanel coverage expansion

## Як було
- `src/components/__tests__/AgentLogsPanel.test.tsx` містив **22 тести** у 5 describe-блоках.
- Не були покриті: текст "Loading logs..." під час завантаження, фільтр за рівнем `warn`, та відображення "0 lines" при порожньому результаті fetch.

## Що зроблено
Додано новий describe-блок `AgentLogsPanel — additional coverage` з **3 новими тестами**:

1. **`shows "Loading logs..." text during initial fetch`** — перевіряє, що при незавершеному fetch відображається текст `"Loading logs..."` (раніше тест завантаження перевіряв лише CSS-клас спінера `.animate-spin`).

2. **`shows "0 lines" when fetch returns empty array`** — перевіряє гілку плюралізації `logs.length !== 1 ? 's' : ''` при 0 логах → рядок `"0 lines"` у заголовку.

3. **`filters to warn logs when warn pill clicked`** — перевіряє функціональність фільтра `warn`: після кліку на кнопку `warn` відображаються лише warn-логи, info-логи зникають. Аналогічний тест до наявних error/info/success фільтрів.

## Результат
- Тестів у файлі: **22 → 25**
- Focused run: **25/25 passed** ✓
- `npm run quality:check`: **2866/2866 passed**, build OK ✓
- Всі нові тести пройшли без змін коду компонента
