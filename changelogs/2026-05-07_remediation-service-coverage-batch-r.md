# Batch R: remediation.service branch coverage

## Як було
- `src/api/remediation.service.ts` мав branch coverage **90.65%**.
- Непокриті гілки були в CRUD-помилках/успіхах, sequential continue path, fallback помилках executeAction, default includeFindings та edge у stats-підрахунках.

## Що зроблено
- Розширено тести у `src/api/__tests__/remediation.service.crud.test.ts`:
  - `getWorkflow` error branch з `error.message`;
  - success branch для `getWorkflowsForRule`;
  - `updateWorkflow` error branch з `error.message`;
  - success branch для `deleteWorkflow`;
  - `getExecutionStats` для `data=null`;
  - `getExecutionStats` коли `execution_time_ms` відсутній (fallback до 0).
- Розширено тести у `src/api/__tests__/remediation.service.workflow.test.ts`:
  - sequential execution продовжується після першого failure, коли `stopOnFirstFailure=false`.
- Розширено тести у `src/api/__tests__/remediation.service.actions.test.ts`:
  - `executeAction` fallback до generic error message коли exception без `message`;
  - `executeNotifyTeam` default branch для `includeFindings=false`.
- Прогони:
  - `npx vitest run src/api/__tests__/remediation.service.test.ts src/api/__tests__/remediation.service.actions.test.ts src/api/__tests__/remediation.service.crud.test.ts src/api/__tests__/remediation.service.workflow.test.ts --coverage`
  - `npm run quality:check`

## Що покращило/виправило/додало
- `src/api/remediation.service.ts`:
  - Branches: **97.19%** (було 90.65%, **+6.54pp**)
  - Stmts: 91.12%
  - Funcs: 100%
  - Lines: 90.85%
- Додано цільові branch тести без змін production-коду.
- Підвищено стабільність покриття для ключових error/fallback сценаріїв сервісу ремедіації.
