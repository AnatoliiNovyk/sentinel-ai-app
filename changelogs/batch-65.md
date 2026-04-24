# Batch 65 — AppLayout tests

## Як було
- 940 тестів, 67 суїтів
- Компонент `AppLayout` не мав тест-файлу

## Що зроблено

### Новий тест-файл

**`src/components/__tests__/AppLayout.test.tsx`** — 14 тестів

**AppLayout — sidebar (9 тестів)**
- Renders "Sentinel AI" brand
- Renders Dashboard nav link
- Renders AI Assistant nav link
- Renders Projects nav link
- Renders Settings nav link
- Renders user full name ("Jane Doe")
- Renders user email ("jane@test.com")
- Renders user initials ("JD")
- Calls `signOut` when sign out button clicked

**AppLayout — header (4 тести)**
- Renders NotificationBell
- Page title "Dashboard" present for "/" path (sidebar + header = 2+ instances)
- Page title "AI Assistant" present for "/chat" path (sidebar + header = 2+ instances)
- Renders Outlet content area

**AppLayout — Scans link (1 тест)**
- Scans nav link href="/scans"

### Виправлення під час розробки
- "Dashboard" / "AI Assistant" — обидва присутні в sidebar nav і в header одночасно → виправлено через `getAllByText(...).length >= 2`

## Що покращило / виправило / додало
- **+14 тестів** (940 → 954)
- **+1 суїт** (67 → 68)
- Покриття: `AppLayout` тепер покрито (sidebar, header, навігація, user info, signOut)
- `quality:check` проходить: ESLint 0 warnings, typecheck OK, 954/954, build OK
