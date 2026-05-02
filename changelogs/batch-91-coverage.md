# Changelog: Batch 91 — Coverage Improvement

## Як було
- `AttackSurfaceMap.tsx`: 99.59% statements (lines 32-33 uncovered — `return '#4ade80'` у `RISK_COLOR`)
- `Notifications.tsx`: 98.16% statements (lines 535-542 uncovered — кнопка "Load more")
- `Projects.tsx`: 98.84% statements (lines 122, 367-369, 466-468 uncovered)

## Що зроблено

### `src/pages/__tests__/AttackSurfaceMap.test.tsx`
- Додано `describe('AttackSurfaceMap — RISK_COLOR low score branch')` з тестом для проєктів з `risk_score < 20`
- Два проєкти (risk_score: 10, risk_score: 5) активують гілку `return '#4ade80'` у функції `RISK_COLOR`
- Кількість тестів: 59 → 60

### `src/pages/__tests__/Notifications.test.tsx`
- Додано `describe('Notifications — load more pagination')` з тестом масиву 51 нотифікації
- Тест перевіряє появу та зникнення кнопки "Load more" після кліку (PAGE_SIZE = 50)
- Кількість тестів: 39 → 40

### `src/pages/__tests__/Projects.test.tsx`
- Рефакторинг моку `useAuth`: перенесено до `vi.hoisted` зі стабільними посиланнями для запобігання зайвих рере-рендерів
- Додано `describe('Projects — kanban delete triggers confirm dialog')`: клік delete у kanban картці → `onDelete` callback → `setConfirmId`/`setConfirmName` (lines 367-369)
- Додано `describe('Projects — ProjectModal warns when user is null')`: submit форми з `user = null` → рання перевірка `!user` спрацьовує, `insert` не викликається (lines 466-468)
- Кількість тестів: 52 → 54

## Що покращило/виправило/додало

| Файл | До | Після |
|------|----|-------|
| `AttackSurfaceMap.tsx` | 99.59% stmts | **100% stmts** |
| `Notifications.tsx` | 98.16% stmts | **100% stmts** |
| `Projects.tsx` | 98.84% stmts | **99.83% stmts** |

- Commit: `fb61f13` (main branch)
- Всього нових тестів: +3 (по 1 на кожен файл)
- Залишок непокритих рядків у Projects.tsx: line 122 (`return 0` — unreachable fallback у sort)
