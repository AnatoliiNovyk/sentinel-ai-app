# Batch E — Alert Service Evaluation Coverage

**Дата:** 2026-05-07  
**Файл:** `src/api/__tests__/alert.service.evaluation.test.ts`  
**Коміт:** наступний після b18bf43

---

## Як було

- `alert.service.ts`: **82.07% stmts / 72.61% branches / 92.85% functions / 81.9% lines**
- Непокриті гілки: `createRule` validation (пусте ім'я, невалідний тип), `getRule` success/not-found, `getRules` DB error, `evaluateSeverity` empty/no-match, `evaluatePattern` кожна умова окремо (no-cve-id, cvePattern mismatch, assetPattern mismatch, descriptionPattern mismatch, no patterns), `getHighestSeverity` empty array + unknown severity, `evaluateRulesForVulnerability` fail/no-match/throw, `updateRule`/`deleteRule` throw paths
- Глобально: **95.92% stmts / 91.32% branches**

---

## Що зроблено

Створено `src/api/__tests__/alert.service.evaluation.test.ts` з **20 тестами**:

1. `createRule` — порожнє ім'я повертає "Missing required fields"
2. `createRule` — невалідний `rule_type` повертає "Invalid rule_type"
3. `createRule` — unexpected throw повертає `success: false`
4. `getRules` — DB помилка повертає `success: false`
5. `getRule` — успішне повернення rule з DB
6. `getRule` — відсутній рядок без помилки → "Rule not found"
7. `evaluateSeverity` — severity не збігається → `false`
8. `evaluateSeverity` — порожній масив → `false`
9. `evaluatePattern` — жодних patterns → `true`
10. `evaluatePattern` — cvePattern не збігається → `false`
11. `evaluatePattern` — cve_id відсутній і cvePattern задано → `false`
12. `evaluatePattern` — assetPattern не збігається → `false`
13. `evaluatePattern` — descriptionPattern не збігається → `false`
14. `getHighestSeverity` — порожній масив → `'info'`
15. `getHighestSeverity` — unknown severity (score=0) → `'info'`
16. `evaluateRulesForVulnerability` — `getRules` failed → `[]`
17. `evaluateRulesForVulnerability` — правило не збігається → `[]`
18. `evaluateRulesForVulnerability` — `getRules` throws → `[]`
19. `updateRule` — unexpected throw → `success: false`
20. `deleteRule` — unexpected throw → `success: false`

---

## Що покращило / виправило / додало

| Метрика | До | Після |
|---|---|---|
| `alert.service.ts` stmts | 82.07% | **98.11%** |
| `alert.service.ts` branches | 72.61% | **95.23%** |
| `alert.service.ts` functions | 92.85% | **100%** |
| `alert.service.ts` lines | 81.9% | **98.09%** |
| All files stmts | 95.92% | **96.47%** |
| All files branches | 91.32% | **92.11%** |
| Test count | 2615 | **2635** |
| Test files | 111 | **112** |
