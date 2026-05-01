# Batch 60 — Scans.tsx Coverage

## Як було
- `src/pages/__tests__/Scans.test.tsx` мав 31 тест і крихкий кейс для `Demo Mode`, який падав через неоднозначний текстовий матч.
- У `src/pages/Scans.tsx` лишались невкритими гілки навколо dismiss-дій, форматування помилок dispatch, refresh та `relativeTime`.
- File-scoped coverage для `Scans.tsx` був нижче цільового рівня для поточного циклу.

## Що зроблено
- Виправлено тест для mock warning: замість неоднозначного `getByText(/Demo Mode/i)` використано перевірку через кнопку `Dismiss mock warning` і текст попередження.
- Додано тест на dismiss mock warning toast.
- Додано тест на структуровану помилку dispatch (`error_description`) з перевіркою рендеру та dismiss error.
- Додано тест на fallback-повідомлення `Unexpected scan dispatch error` для нерозбірної помилки.
- Додано тест на `Refresh scans`, який перевіряє повторний виклик завантаження сканів.
- Додано тест на гілки `relativeTime` для `Just now` і `Yesterday`.

## Що покращило / виправило / додало
- `src/pages/__tests__/Scans.test.tsx`: `36/36` passing.
- `src/pages/Scans.tsx`: `83.33%` functions, `75.33%` branches, `81.42%` lines/statements.
- Закрито кілька helper/UI-гілок без змін у production-коді.
- Батч стабілізував тестовий файл і вивів `Scans.tsx` вище порогу `80%` за функціями.
