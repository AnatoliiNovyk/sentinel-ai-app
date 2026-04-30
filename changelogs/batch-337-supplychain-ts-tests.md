# Batch-337: supplyChain.ts Coverage Improvement

## Як було
- `src/lib/supplyChain.ts`: 50 тестів
- Coverage: Lines **90.37%**, Branches **75%**, Functions **100%**
- Uncovered: `extractSeverity` numeric/LOW/MODERATE branches, `resolveLicense` fallbacks (BSD/ISC/LGPL/unknown), `parsePackageLock` з `dependencies` замість `packages`, `buildScaRecommendations` з high+license branches, `mapOsvVuln` без summary/details

## Що зроблено
Додано **+24 тести** у 3 нових блоках до `src/lib/__tests__/supplyChain.test.ts`:

### resolveLicense (11 нових тестів):
- BSD-2-Clause, ISC, UNLICENSED (exact match)
- LGPL-2.1 (exact match) + 'Some-LGPL-License' (includes branch)
- 'Custom-GPL-License' (GPL without 3 → GPL-2.0 branch)
- 'apache-something' (APACHE includes branch)
- 'some-mit-variant' (MIT includes branch)
- 'Proprietary-Custom-v2' → unknown fallback

### parsePackageLock (2 нових тести):
- `raw.dependencies` fallback (npm lock v1 без `packages`)
- empty object → порожній масив

### ScaAnalyzer — extractSeverity + mapOsvVuln + recommendations (11 нових тестів):
- HIGH, LOW, MODERATE severity scores
- Numeric CVSS: 9.5 → critical, 7.5 → high, 5.0 → medium, 2.0 → low
- Unrecognized string score → unknown
- Vuln без summary/details → defaults ('Known vulnerability', '')
- References truncated до 3
- Non-ok HTTP → empty vulns
- High vulns → 'high-severity' recommendation
- Critical vulns → 'Immediately patch' + 'Pin affected packages' recommendations

## Що покращило
- **Lines**: 90.37% → **97.37%** (+7%)
- **Branches**: 75% → **83.54%** (+8.54%)
- **Functions**: 100% → **100%**
- Commit: `1316783`, pushed to `main`
