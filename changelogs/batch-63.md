# Batch 63 — ApiDocs, PublicReport, Landing tests

## Як було
- `src/pages/__tests__/ApiDocs.test.tsx` — відсутній
- `src/pages/__tests__/PublicReport.test.tsx` — відсутній
- `src/pages/__tests__/Landing.test.tsx` — відсутній
- Загальна кількість тестів: 895 (61 суїт)

## Що зроблено

### `src/pages/__tests__/ApiDocs.test.tsx` (7 тестів)
- Clipboard mock через `vi.hoisted()` + `Object.defineProperty(navigator, 'clipboard', ...)`
- Тести: заголовок "REST API & CLI", опис, banner про Personal Access Token, секції "Start a Scan" та "Sentinel CLI", badge "POST /scan-dispatch", кнопка "Copy cURL" → clipboard.writeText викликається → "Copied" feedback

### `src/pages/__tests__/PublicReport.test.tsx` (5 тестів)
- Supabase mock: `from → select → eq → eq → maybeSingle`
- Тести: loading state, "Report not available" (notfound), "revoked or never existed", branding + назва репорту (ok state), "Markdown" download button

### `src/pages/__tests__/Landing.test.tsx` (9 тестів)
- `react-router-dom` mock: `Link` → `<a href={to}>`
- Тести: brand "Sentinel AI", "Autonomous Security", "For Modern Infrastructure", "Start Free Trial", "Sign In", Features link (getAllByRole — "Features" і "View Features" обидва є), "Enterprise-Grade Security Pipeline", feature cards (Passive Reconnaissance, AI Remediation, CI/CD Integration), "Dark Web Monitoring"
- Фікс: `getAllByRole('link', { name: /Features/i })` замість `getByRole` (2 елементи: nav link + "View Features" hero button)

## Що покращило/виправило/додало
- +21 нових тест-кейсів
- Загальна кількість тестів: **916** (64 суїти)
- `npm run quality:check` ✅ (ESLint 0 warnings, typecheck OK, build OK)
