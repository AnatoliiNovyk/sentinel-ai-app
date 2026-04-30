# Batch-335: evidencePackage Coverage → 100%

## Як було
- `src/lib/evidencePackage.ts`: 30 тестів
- Coverage: Lines **92.74%**, Branches **61.11%**, Functions **75%**
- Uncovered: `printReportAsPDF` (lines 162-233), `||''` fallback branches (75-77), ternary empty branches (139-141), `??'⚪'` fallback

## Що зроблено
Додано **+4 тести** до `src/lib/__tests__/evidencePackage.test.ts`:

1. **printReportAsPDF — happy path**: мокується `window.open`, перевіряється що `document.write` і `document.close` викликаються
2. **printReportAsPDF — null window** (popup blocked): `window.open` повертає null → не кидає помилку
3. **unknown severity fallback**: `severity: 'unknown'` → `?? '⚪'` branch в `sev()` helper
4. **null cve_id/mitre_tactic/cis_control**: `|| ''` branches (рядки 75-77) + ternary `''` branches (139-141) → CVE/MITRE/CIS рядки не з'являються у markdown

## Що покращило
- **Lines**: 92.74% → **100%** (+7.26%)
- **Branches**: 61.11% → **100%** (+38.89%)
- **Functions**: 75% → **100%** (+25%)
- Commit: `3f32ee4`, pushed to `main`
