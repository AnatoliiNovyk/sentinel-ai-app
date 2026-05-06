# 2026-05-06 — Alert Service Coverage Batch B

## Як було
- `src/api/alert.service.ts` мав низьке покриття (~32% statements) з багатьма непокритими гілками:
  - CRUD error paths (`createRule`, `updateRule`, `deleteRule`)
  - branch logic у `getRules(projectId)`
  - cooldown/rate-limit filtering у `evaluateRulesForVulnerability`
  - error branches у `triggerAlert` і `resetDailyTriggerCounters`
  - helper branch paths (`evaluateCondition`, `getHighestSeverity`, `isValidRuleType`)

## Що зроблено
- Додано новий branch-focused suite: `src/api/__tests__/alert.service.branches.test.ts` (9 тестів), який покриває:
  - `createRule` DB insert error
  - `updateRule` not-found branch
  - `deleteRule` DB error branch
  - `getRules` project filter branch (`eq('project_id', ...)`)
  - cooldown/rate-limit skip logic + positive match у `evaluateRulesForVulnerability`
  - `evaluateCondition` для severity/pattern/frequency/custom/default
  - `triggerAlert` catch branch on update failure
  - helper branches: `getHighestSeverity`, `isValidRuleType`
  - `resetDailyTriggerCounters` catch branch
- Виправлено type-shape у тестових даних для коректного TS compile.

## Що покращило / виправило / додало
- Coverage приріст:
  - `alert.service.ts`: **32.07% → 82.07% statements**, **29.76% → 72.61% branches**
  - `All files`: **92.47% → 94.19% statements**, **87.98% → 89.46% branches**
- Підтверджено стабільність:
  - `quality:check`: **109/109** test files passed
  - **2595/2595** tests passed
