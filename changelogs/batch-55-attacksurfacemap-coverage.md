# Batch 55 — AttackSurfaceMap coverage improvement

## Як було
- `src/pages/__tests__/AttackSurfaceMap.test.tsx`: 43 тести, файл закінчувався незавершеним (dangling) describe-блоком на рядку ~560
- `src/pages/AttackSurfaceMap.tsx`: покриття 79.71% рядків, 52.63% функцій
- Непокриті зони: рядки 385–487 (SVG-нотатки, вузли), 516–568 (Legend, Tooltip)

## Що зроблено
- Завершено незавершений `describe('AttackSurfaceMap — physics simulation edge cases')` у файлі тестів
- Видалено orphaned-код (дублікат фрагмент beforeEach без контексту), що спричиняв синтаксичну помилку компіляції
- Додано нові describe-блоки з 10 додатковими тестами:
  - **Physics simulation edge cases**: `renders correctly with multiple projects`, `shows CSV and JSON export buttons when nodes exist`
  - **Legend**: `shows all four risk legend labels`, `shows "Legend" heading label`
  - **Export CSV and JSON**: `CSV export calls downloadFile with .csv`, `JSON export calls downloadFile with .json`
  - **Severity filter buttons**: `severity filter buttons are present`, `clicking critical severity filter does not crash`, `clicking "All sev." resets severity filter`
  - **Tooltip via SVG node click**: `SVG project node text is present after load`, `clicking SVG project node opens tooltip`, `tooltip close button dismisses tooltip`

## Що покращило / виправило / додало
- Файл тестів тепер повністю коректний (не має синтаксичних помилок)
- Кількість тестів: **43 → 53** (+10 нових)
- Покриття `AttackSurfaceMap.tsx`:
  - Рядки: 79.71% → **83.81%**
  - Функції: 52.63% → **68.42%**
  - Гілки: 78.61% → **80.7%**
- Всього тестів у проєкті: **2017 passed** (100 test files)
- Commit: `d53d459` — pushed to main
