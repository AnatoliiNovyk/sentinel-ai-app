# 2026-05-07 — Remediation Service Coverage Batch C

## Як було
- `src/api/remediation.service.ts` залишався найслабшим API-сервісом після Batch B.
- Бракувало покриття гілок CRUD/history/stats:
  - DB error branches у `getWorkflows`, `getWorkflowsForRule`, `deleteWorkflow`, `getExecutionHistory`, `getExecutionStats`
  - not-found branch у `getWorkflow`, `updateWorkflow`
  - empty stats branch у `getExecutionStats`

## Що зроблено
- Додано новий test suite: `src/api/__tests__/remediation.service.crud.test.ts` (10 тестів)
  - success та error гілки для `getWorkflows`
  - not-found гілки для `getWorkflow` та `updateWorkflow`
  - error гілки для `getWorkflowsForRule` і `deleteWorkflow`
  - success/error гілки для `getExecutionHistory`
  - empty/error гілки для `getExecutionStats`
- Додано стабільний thenable-мок query builder для коректної симуляції Supabase chain + await.

## Що покращило / виправило / додало
- Coverage приріст:
  - `remediation.service.ts`: **66.86% -> 83.43% statements**, **65.42% -> 83.17% branches**
  - `All files`: **94.19% -> 95.11% statements**, **89.46% -> 90.25% branches**
- Якість після змін:
  - `quality:check`: **110/110** files passed
  - **2605/2605** tests passed
