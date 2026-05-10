# Batch GHB — CommentThread: розширення покриття тестами

## Як було
- `src/components/__tests__/CommentThread.test.tsx`: 29 тестів
- Не покриті гілки: `timeAgo` для годин (`hr < 24`), `timeAgo` для дат (> 24h → `toLocaleDateString()`), `handleUpdateComment` з порожнім editText (ранній вихід)

## Що зроблено
Додано 3 нові тести:
1. **`shows hours ago for comment from 3 hours ago`** (у `CommentThread — timeAgo display`) — передає час 3 години тому, перевіряє `/3h ago/i`
2. **`shows locale date string for comment older than 24 hours`** (у `CommentThread — timeAgo display`) — передає час 2 дні тому, перевіряє `new Date(twoDaysAgo).toLocaleDateString()`
3. **`does not call updateComment when edit text is blank`** (у `CommentThread — edit guard`) — відкриває редагування, очищує textarea, натискає Save; перевіряє що `mockUpdateComment` не викликано

## Що покращило/виправило/додало
- CommentThread: 29 → 32 тести
- Покрито 3 раніше непокритих гілки: timeAgo hours, timeAgo date, handleUpdateComment early return
- Загальний результат: **2875/2875 тестів пройшло** (2872 → 2875)
- Production build: ✓ built in 1.77s
