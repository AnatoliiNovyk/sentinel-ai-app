Як було:
- Після попереднього батчу лишалося 17 warnings (переважно `react-hooks/exhaustive-deps`) і 1 warning `react-refresh/only-export-components` у контексті авторизації.
- Lint без errors, але не повністю clean.

Що зроблено:
- Закрито `exhaustive-deps` у цільових файлах через стабілізацію callback/deps:
  - src/components/ExecutionConsole.tsx
  - src/components/FindingsTab.tsx
  - src/components/NotificationBell.tsx
  - src/components/ScanDiff.tsx
  - src/components/SchedulesPanel.tsx
  - src/pages/AttackSurfaceMap.tsx
  - src/pages/Chat.tsx
  - src/pages/ProjectDetail.tsx
  - src/pages/Projects.tsx
  - src/pages/Reports.tsx
  - src/pages/Scans.tsx
- Вирішено `react-refresh/only-export-components`:
  - винесено hook у окремий файл `src/context/useAuth.ts`
  - оновлено імпорти `useAuth` у застосунку та сторінках
  - `AuthContext` лишився компонентно-орієнтованим експортом.
- Усунуто побічний `no-unused-vars` у `src/pages/Scans.tsx` після рефактору.

Що покращило/виправило/додало:
- Lint приведено до повністю clean-стану (0 errors, 0 warnings).
- Залежності хуків стали детермінованими, менше ризику неочікуваних повторних ефектів.
- Архітектура auth-контексту стала більш сумісною з Fast Refresh (розділено provider і hook).
