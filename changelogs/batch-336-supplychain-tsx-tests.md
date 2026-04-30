# Batch-336: SupplyChain.tsx Coverage Improvement

## Як було
- `src/pages/SupplyChain.tsx`: 20 тестів в 4 describe-блоках
- Coverage: Lines **91.9%**, Branches **86.53%**, Functions **75%**
- Uncovered: drag/drop handlers, catch-блок з throw, sort comparator з 2+ елементами, "no vulns" шлях, user audit, JSON array validation

## Що зроблено
Додано **+18 тестів** у 6 нових `describe`-блоках до `src/pages/__tests__/SupplyChain.test.tsx`:

1. **Виправлено toastContext mock** — додано `success`, `error`, `warning`, `info` методи (раніше тільки `showToast`)
2. **Виправлено useAuth mock** — перенесено у `vi.hoisted` → можна перевизначати per-test
3. **Виправлено AuditService mock** — додано `logSecurityEvent` + реальний `AuditAction.SBOM_ANALYSIS`
4. **drag and drop** (3 тести): `onDragOver`, `onDragLeave`, `onDrop` з файлом → selector `[class*="border-dashed"]`
5. **no vulnerabilities** (3 тести): "Clean" label, "0%", Export CSV не показується
6. **with authenticated user** (1 тест): `AuditService.logSecurityEvent` викликається після скану
7. **sort with multiple vulnerable deps** (4 тести): `risk_desc`, `risk_asc`, `A→Z`, `vulns_desc` — тепер 2+ елементи → sort comparator виконується
8. **scan throws exception** (1 тест): `mockRejectedValue(new Error('Network timeout'))` → catch блок → error message
9. **JSON array validation** (1 тест): `[1,2,3]` → "root must be a JSON object"

## Що покращило
- **Lines**: 91.9% → **99.76%** (+7.86%)
- **Branches**: 86.53% → **89.13%** (+2.6%)
- **Functions**: 75% → **94.11%** (+19.11%)
- Commit: `cf06604`, pushed to `main`
- Changelogs для batch-334 і batch-335 також включені в цей коміт
