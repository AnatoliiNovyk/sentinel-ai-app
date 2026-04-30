# Batch-309 — Coverage: Projects.tsx

## Як було
- `Projects.tsx` покриття: **66.94%** statements (рядки 164-494, 582-699 без покриття)
- Існуючі тести (9 тестів): лише empty state, базовий рендер карток, навігація до ProjectDetail, видалення, відкриття модалки
- Компоненти KanbanBoard, ProjectModal (форма), stat cards, search/filter bar, tag filter, sort, view mode toggle — без тестів
- Загальне покриття: **79.55%** statements, 1 467 тестів

## Що зроблено
Розширено `src/pages/__tests__/Projects.test.tsx` (443 рядки, +39 тестів):

### Нові групи тестів:
1. **Stat cards** — рендер карток Total Projects, High/Critical Risk, Avg Risk Score, By Environment при різних risk_score (80, 55)
2. **Search and filter** — фільтрація за пошуком, Clear X button, count indicator, env filter (Cloud), risk filter buttons, no-match state, Clear filters button, сортування (name, oldest, risk_desc, risk_asc)
3. **Tag filter** — рендер тег-чіпів, фільтрація по тегу, скидання до All tags, toggle off
4. **View mode and kanban** — перемикання в kanban вид, 3 колонки (To Do / In Progress / Done), проекти в потрібних колонках, навігація до ProjectDetail з kanban картки, кнопка Delete в kanban, drag start/end, повернення в grid
5. **Export CSV** — кнопка Export CSV видима при наявності проектів, виклик URL.createObjectURL при кліку
6. **ProjectModal form** — submit з успіхом (insert викликається), submit з DB error, закриття Cancel / X / Escape / backdrop click, переключення environment
7. **relTime branches** — "just now" (<1 хв), "Xm ago" (<1 год), "Xh ago" (<24 год), "Xd ago" (<30 днів), locale date (≥30 днів)

### Технічні зміни мок-об'єктів:
- Додано `mockUpdateEq` та `mockUpdate` у `vi.hoisted()` блок
- Додано `update: mockUpdate` в supabase mock (для `updateStatus` в kanban)

## Що покращило
- `Projects.tsx`: **66.94% → 96.03%** statements (+29 п.п.)
- Загальне покриття: **79.55% → 80.36%** (+0.81 п.п.)
- Тести: **1 467 → 1 506** (+39 тестів)
- Всі 1 506 тестів проходять
- Commit: `0bd84e9` → `main`
