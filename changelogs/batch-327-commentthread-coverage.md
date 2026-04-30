# Batch-327 Changelog — CommentThread Coverage

## Як було
- `src/components/CommentThread.tsx` — низьке покриття:
  - Lines: 62.56%, Branches: 64%, Functions: 25%
- Тест-файл містив лише 9 тестів (133 рядки) — лише collapsed/opened стани та loading

## Що зроблено
- Додано `act` до імпортів
- Додано 20 нових тестів у 5 нових describe-блоках:
  1. **adding a comment** — Send disabled/enabled, addComment виклик, очищення input, Enter key
  2. **editing a comment** — edit/delete кнопки видні, click edit показує textarea, Save викликає updateComment, Cancel ховає textarea
  3. **deleting a comment** — deleteComment виклик, скасування через confirm false
  4. **replies** — рендер reply, Reply кнопка, "Replying to comment..." індикатор, toggle cancel, ✕ кнопка, reply count badge
  5. **timeAgo display** — "just now" та "5m ago" відображення

## Що покращило
- Lines: **62.56% → 97.04%** (+34.48%)
- Branches: **64% → 92.3%** (+28.3%)
- Functions: **25% → 94.11%** (+69.11%)
- Загальна кількість тестів: 9 → **29** (+20)
- Commit: `978cb11`
