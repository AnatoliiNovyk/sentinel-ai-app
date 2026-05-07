# Batch O: compliance.service branch coverage

## Як було
- Для [src/api/compliance.service.ts](src/api/compliance.service.ts) branch coverage був 85.00%.
- Низка гілок fallback/error path залишалась непокритою (rules/events error fallback, remediation counters fallback, severity fallback, framework/dashboard fallback).

## Що зроблено
- Розширено тести у [src/api/__tests__/compliance.service.branches.test.ts](src/api/__tests__/compliance.service.branches.test.ts):
  - покрито fallback на `eventsError` у `getAlertMetrics`;
  - покрито fallback на `eventsError` у `getRemediationMetrics`;
  - покрито гілки з порожніми/undefined action counters та `unknown` action type;
  - покрито fallback на `remediationError` у `getSecurityPostureMetrics`;
  - покрито гілки default/unknown severity;
  - покрито `getFrameworkMetrics` для змішаних шляхів compliant/at-risk та fallback без metrics;
  - покрито `getDashboard` fallback для відсутніх `frameworks.metrics` і `score.score`.
- Прогони:
  - таргетовані тести compliance (`46 passed`),
  - таргетований coverage для compliance,
  - повний `npm run quality:check` (успішно).

## Що покращило/виправило/додало
- Branch coverage для [src/api/compliance.service.ts](src/api/compliance.service.ts) піднято до 100% у таргетованому coverage-прогоні.
- Підвищено надійність тестового контуру для edge/error сценаріїв без змін production-коду.
