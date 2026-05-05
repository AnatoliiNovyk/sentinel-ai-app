# Changelog: Quality Gate Typecheck Closure

## Як було
- Скрипт [package.json](package.json) `quality:check` падав на `typecheck` через 26 помилок у кількох зонах:
  - API сервіси: [src/api/compliance.service.ts](src/api/compliance.service.ts), [src/api/remediation.service.ts](src/api/remediation.service.ts)
  - UI/сторінки: [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx), [src/pages/ProjectDetail.tsx](src/pages/ProjectDetail.tsx), [src/pages/settings/SettingsSubscription.tsx](src/pages/settings/SettingsSubscription.tsx), [src/pages/dashboard/DashboardCharts.tsx](src/pages/dashboard/DashboardCharts.tsx)
  - Тести: [src/components/__tests__/RemediationModal.test.tsx](src/components/__tests__/RemediationModal.test.tsx), [src/pages/__tests__/Integrations.test.tsx](src/pages/__tests__/Integrations.test.tsx), [src/pages/__tests__/ProjectDetail.test.tsx](src/pages/__tests__/ProjectDetail.test.tsx), а також раніше виправлені API тести.

## Що зроблено
- Виправлено mock-ланцюжки в API тестах без `this`-контексту (через локальний `chain`-об’єкт).
- Узгоджено типи в тестах і фікстурах:
  - додано відсутній імпорт `AlertAction`;
  - усунено невикористані змінні/параметри;
  - додано явну типізацію для `readVersioned(...)` у Integrations тестах;
  - виправлено очікуваний тип повернення `ScansService.dispatchScan` у ProjectDetail тестах;
  - додано `afterEach` імпорт у RemediationModal тесті.
- Виправлено сервісні TS неузгодженості:
  - [src/api/compliance.service.ts](src/api/compliance.service.ts): null-safe fallback для `score.score`, виправлення/позначення невикористаних параметрів;
  - [src/api/remediation.service.ts](src/api/remediation.service.ts): сумісність camelCase типів з DB snake_case полями через безпечний runtime-fallback (`workflowAny`), прибрано невалідні поля/літерали.
- Виправлено UI TS-помилки:
  - [src/pages/settings/SettingsSubscription.tsx](src/pages/settings/SettingsSubscription.tsx): додано відсутній імпорт `supabase`;
  - [src/pages/ProjectDetail.tsx](src/pages/ProjectDetail.tsx): коректне приведення `unknown` помилки для `errorToUserMessage`;
  - [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx): узгоджено тип `teamMembers` та нормалізацію `auth`;
  - [src/pages/dashboard/DashboardCharts.tsx](src/pages/dashboard/DashboardCharts.tsx): усунено невикористаний параметр/змінну.

## Що покращило / виправило / додало
- `typecheck` тепер проходить без помилок.
- `quality:check` проходить повністю (duplicates + lint + typecheck + test + build).
- Зменшено ризик флейків і типових регресій у тестах через явну типізацію і стабільні моки.
- Підтримуваність сервісів покращена за рахунок узгодження типів між доменними моделями і DB-полями.
