# Batch 61 — Dashboard.tsx Coverage

## Як було
- `src/pages/__tests__/Dashboard.test.tsx` мав `27` тестів.
- `src/pages/Dashboard.tsx` мав `75%` function coverage при file-scoped прогоні.
- Невкритими лишались гілки в блоці `Top open findings`: empty search state, clear/reset контролів, рендер project/CVE link.

## Що зроблено
- Додано тест `shows empty search state and clears findings filters`:
  - перевіряє search по findings,
  - рендер `No findings match the search.`,
  - роботу кнопки `Clear` і повернення списку.
- Додано тест `renders project name and CVE link in top open findings`:
  - перевіряє рендер project name,
  - перевіряє наявність CVE-посилання на NVD,
  - покриває зміну сортування через `A→Z` та появу `Clear`.
- Уточнено асерти для дублікатних текстів/лінків через `getAllByText` / `getAllByRole`, щоб тести відповідали фактичному рендеру в кількох секціях dashboard.

## Що покращило / виправило / додало
- `src/pages/__tests__/Dashboard.test.tsx`: `29/29` passing.
- `src/pages/Dashboard.tsx`: `82.5%` functions, `84%` branches, `92.37%` lines/statements.
- `Dashboard.tsx` піднято вище порогу `80%` functions без змін production-коду.
