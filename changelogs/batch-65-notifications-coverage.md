# Batch 65 — Notifications.tsx Coverage

## Як було
- `Notifications.tsx`: 83.33% functions, 88.78% statements, 85.6% branches

## Що зроблено

### Notifications.tsx (30 тестів, commit: HEAD)
1. **Додано тести для `timeAgo`**: "just now", "1h ago", "1d ago" гілки
2. **Додано тест для відсутнього `link`**: перевірка що кнопка "Go to related page" не рендериться
3. **Додано тест `markAllRead`**: клік "Mark all read" → `supabase.update().eq().is()` ланцюжок
4. **Додано тест `deleteAllRead`**: клік "Clear read" → `supabase.delete().eq().is()` ланцюжок
5. **Додано тест `refresh button`**: клік Refresh → `fetchAll(true)` (silent)
6. **Додано тест `export CSV`**: мок `document.createElement` + `URL.createObjectURL`/`revokeObjectURL`

### Виправлення моків
- `vi.hoisted()` мок для `supabase`: `update` → `eq` → `is` тепер правильно ланцюжок
- `delete` → `eq` → `is` / `not` моки для bulk delete
- `export CSV` мок: `vi.spyOn(document, 'createElement')` + `global.URL` моки

## Що покращило / виправило / додало
- Notifications functions: **83.33% → 88.88%** (+5.55%), statements: **88.78% → 96.79%**
- Commits: `test(Notifications): improve coverage 83.33% → 88.88% (30 tests)`
- Покрито: `timeAgo` гілки, `markAllRead`, `deleteAllRead`, `exportCsv`, `refresh`, `no-link` гілки
- Залишилось непокритими: `41-42,52-55,535-542` (defensive code + `groupByDate` helper)
