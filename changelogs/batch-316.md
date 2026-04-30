# Batch-316 Changelog — SupplyChain.tsx Coverage

## Як було
- `src/pages/__tests__/SupplyChain.test.tsx` — 164 рядки, 13 тестів
- `SupplyChain.tsx` coverage: **80.95% lines | 76.4% branches | 43.75% functions**
- Непокриті рядки: 426-428 (результат пошуку "No packages match"), 476-489 ("Verified Safe" секція)

## Що зроблено
Додано **+11 нових тестів** у 2 нові `describe`-групи:

### `SupplyChain — file validation errors` (3 тести)
- `shows error for oversized file` — файл > 5MB через `Object.defineProperty` на `size`
- `shows error for invalid JSON content` — не-JSON вміст файлу
- `shows error for invalid package structure` — JSON без `name`/`dependencies`/`packages`

### `SupplyChain — results with safe deps` (8 тестів)
- `shows "Verified Safe" section` — пакети без вразливостей відображаються у секції "Verified Safe" (покриває рядки 476-489)
- `clicking "Scan another file" resets results` — скидання до початкового стану
- `clicking "Export CSV" calls downloadFile` — перевірка виклику exporters.downloadFile
- `search input shows "No packages match"` — покриває рядки 426-428
- `sort "A→Z" button reorders results` — сортування за іменем
- `sort "Vulns ↓" button reorders results` — сортування за кількістю вразливостей
- `type filter "Production" filters to prod deps` — тип-фільтр
- `shows Dependency Risk Score bar` — risk score IIFE секція

## Що покращило
- **Lines**: 80.95% → **91.9%** (+10.95%)
- **Branches**: 76.4% → **86.53%** (+10.13%)
- **Functions**: 43.75% → **75%** (+31.25%)
- Тестів у файлі: 13 → **21** (+8 unique tests після deduplicate)
- Commit: `6b8ffde`
