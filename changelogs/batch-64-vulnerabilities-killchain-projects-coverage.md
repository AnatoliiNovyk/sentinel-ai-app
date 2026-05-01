# Batch 64 — Vulnerabilities.tsx + KillChain.tsx + Projects.tsx Coverage

## Як було
- `Vulnerabilities.tsx`: 73.68% functions, 97.25% statements
- `KillChain.tsx`: 77.77% functions, 88.54% branches, 100% statements
- `Projects.tsx`: 79.48% functions, 96.03% statements

## Що зроблено

### Vulnerabilities.tsx (51 тестів)
1. **Додано `mockVulnUpdateIn`** до `vi.hoisted()` — дає контроль часу відповіді bulk update
2. **Export mousedown handler** (рядки 397-398): тест "click outside export dropdown closes it"
3. **doExport з вибраними елементами**: тест де спочатку обираємо vuln, потім export CSV
4. **bulkLoading overlay** (рядки 736-741): тест із відкладеним resolve promise — overlay видно під час очікування
5. **Keyboard Ctrl+F**: тест пошуку через `fireEvent.keyDown(window, { key: 'f', ctrlKey: true })`
6. **Project sort** (рядок 355): тест клікання кнопки "Project" сортування
7. **VulnRow note** (рядок 191): тест з `note` полем у вулнах
8. **Low CVSS branch** (рядок 201): тест з `cvss: 2.1` — гілка `text-slate-400`

### KillChain.tsx (23 тести)
1. **Розширено mocks**: `mockScansEq` і `mockVulnsIn` у `vi.hoisted()` + `beforeEach` reset
2. **Null scans data** (рядок 133 `|| []`): `mockScansEq` повертає `{ data: null }`
3. **Null vulns data** (рядок 141 `|| []`): `mockVulnsIn` повертає `{ data: null }`
4. **Singular result text** (рядок 333): пошук що матчить рівно 1 крок → "1 result" без 's'

### Projects.tsx (52 тести)
1. **No completed projects** (рядок 645): тест з проектами тільки 'todo'/'in_progress' — порожня done-колонка
2. **handleDragOver** (рядки 611-613): тест з mock `dataTransfer` через `Object.defineProperty`
3. **handleDrop** (рядки 616-621): тест dragStart → dragOver → drop на колонку

## Що покращило / виправило / додало
- Vulnerabilities functions: **73.68% → 78.94%** (+5.26%), statements: **97.25% → 99.82%**
- KillChain branches: **88.54% → 90.72%**
- Projects functions: **79.48% → 89.74%** (+10.26%), statements: **96.03% → 98.84%**
- Commits: `0f376ef`, `6ec010c`, `2da5d69`
