Як було:
- Після попереднього батчу залишалось 27 помилок TypeScript (переважно TS6133/TS6196: невикористані імпорти, змінні, параметри).
- `npm run typecheck` падав на 12 файлах (components, lib, pages).

Що зроблено:
- Прибрано невикористані імпорти/змінні у файлах:
  - src/components/ExecutionConsole.tsx
  - src/components/scans/VulnerabilityCard.tsx
  - src/lib/agentTools.ts
  - src/pages/ApiDocs.tsx
  - src/pages/AttackSurfaceMap.tsx
  - src/pages/DarkWebMonitor.tsx
  - src/pages/Dashboard.tsx
  - src/pages/Integrations.tsx
  - src/pages/KillChain.tsx
  - src/pages/Projects.tsx
  - src/pages/Settings.tsx
  - src/pages/SupplyChain.tsx
- В `src/lib/agentTools.ts` змінено невикористаний параметр `userId` на `_userId`.
- Видалено мертві допоміжні заготовки в `AttackSurfaceMap` (невикористані `Map`/типи).
- Повторно виконано перевірки:
  - `npm run typecheck -- --pretty false`
  - `npm run lint`

Що покращило/виправило/додало:
- `typecheck` повністю зелений (0 TypeScript-помилок).
- Код чистіший від мертвих декларацій і технічного шуму.
- Залишився окремий шар задач по ESLint (зараз 33 errors, 17 warnings), який можна закрити наступним батчем.