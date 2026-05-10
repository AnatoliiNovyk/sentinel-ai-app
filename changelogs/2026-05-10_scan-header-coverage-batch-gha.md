# Batch GHA — ScanHeader: розширення покриття тестами

## Як було
- `src/components/__tests__/ScanHeader.test.tsx`: 15 тестів у 4 describe-блоках
- Не покриті гілки: точний плейсхолдер з кількістю проектів, виклик onSelectProject з порожнім рядком, MOCK-режим з agentReachable=null

## Що зроблено
Додано 3 нові тести:
1. **`calls onSelectProject with empty string when default "All projects" option is selected`** (у `ScanHeader — interactions`) — тестує виклик `onSelectProject('')` при виборі дефолтного варіанту після раніше вибраного проекту
2. **`renders exact placeholder text "All projects (2)" with two projects`** (у `ScanHeader — additional coverage`) — перевіряє точний текст плейсхолдера з числом 2 при 2 проектах у списку
3. **`shows "Selected Scan: Historical" in MOCK mode when agentReachable is null (default)`** (у `ScanHeader — additional coverage`) — перевіряє поведінку при `currentMode="MOCK"` та `agentReachable={null}`: демо-банер відсутній, показується "Selected Scan: Historical"

## Що покращило/виправило/додало
- ScanHeader: 15 → 18 тестів
- Покрито 3 раніше непокритих гілки: точний текст плейсхолдера, скидання вибору проекту, MOCK + agentReachable=null
- Загальний результат: **2872/2872 тестів пройшло** (2869 → 2872)
- Production build: ✓
