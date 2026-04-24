# Batch 39: Supply Chain Security — SBOM Parsing & SCA Risk Engine

## Як було

Сторінка `SupplyChain.tsx` мала базову інтеграцію з OSV.dev API безпосередньо в компоненті. Логіка парсингу, risk scoring та license analysis були перемішані з UI-кодом. Підтримувалися лише `package.json` і `package-lock.json`. Не існувало SBOM підтримки, ліцензійного аналізу, тестового покриття або модульної архітектури.

## Що зроблено

### `src/lib/supplyChain.ts` (~340 рядків)

**Типи даних:**
- `Dependency` — залежність: name, version, type (prod/dev/peer/optional), ecosystem
- `ScaVulnerability` — вразливість: id, summary, severity, fixedIn, cvssScore, references
- `LicenseInfo` — ліцензія: name, spdxId, risk (permissive/restrictive/unknown), isOsiApproved, note
- `DependencyRisk` — ризик залежності: vulnerabilities, license, riskScore, riskLevel, isOutdated, directlyExposed
- `SbomScanResult` — повний результат: format, totalDependencies, criticalCount, highCount, overallRiskScore, risks, licenseIssues, recommendations

**SBOM Парсери (4 формати):**
- `parsePackageJson(raw)` — npm package.json (prod + dev + peer + optional deps)
- `parsePackageLock(raw)` — npm package-lock.json v2/v3 (packages та dependencies sections)
- `parseCycloneDx(raw)` — CycloneDX JSON (spec 1.4+, компоненти з версіями та ліцензіями)
- `parseSpdx(raw)` — SPDX JSON (spec 2.3+, packages з versionInfo та licenseConcluded)
- `detectSbomFormat(json)` — автоматичне визначення формату
- `parseSbom(json)` — уніфікований entry-point

**Ліцензійна база (`LICENSE_DB`):**
- MIT, Apache-2.0, BSD-2/3-Clause, ISC → permissive (OSI approved)
- GPL-2.0, GPL-3.0, AGPL, LGPL-2.1 → restrictive з попередженнями
- UNLICENSED → unknown risk (порушення copyright)
- `resolveLicense(spdxId)` — розпізнавання за ID або частковим збігом

**Risk Scoring:**
- `computeDependencyRiskScore(vulns)` — зважений score (critical=35, high=20, medium=10, low=3), cap=100
- `riskLevelFromScore(score)` — none/low/medium/high/critical
- `computeOverallRisk(risks)` — 60% max + 40% avg для загального ризику проєкту

**`ScaAnalyzer` клас:**
- `scan(jsonInput)` → `Result<SbomScanResult>` — повне сканування SBOM
- `fetchVulnerabilities(dep)` — OSV.dev API запит (з AbortSignal timeout 8s)
- Кешування per `dep@version` (уникає дублікатних API запитів)
- `getMetrics()` — totalScans, totalDependenciesAnalyzed, vulnerabilitiesFound, cacheHits
- Глобальний singleton: `getGlobalScaAnalyzer()`, `resetGlobalScaAnalyzer()`

### `src/lib/__tests__/supplyChain.test.ts` (49 тестів)

- detectSbomFormat: 6 тестів (npm-pj, npm-lock, cyclonedx, spdx, unknown)
- parsePackageJson: 5 тестів (prod, dev, peer/optional, fallback, empty)
- parsePackageLock: 3 тести (packages section, dev flag, node_modules prefix)
- parseCycloneDx: 3 тести (components, no-name skip, empty)
- parseSpdx: 2 тести (packages, no-name skip)
- parseSbom: 2 тести (auto-detect, unknown)
- resolveLicense: 5 тестів (MIT, GPL, null, Apache, AGPL)
- computeDependencyRiskScore: 4 тести (empty, critical, cap at 100, accumulation)
- riskLevelFromScore: 5 тестів (none, low, medium, high, critical)
- ScaAnalyzer: 12 тестів (unknown format, empty, package.json scan, CycloneDX, vulns tracking, cache, error handling, directlyExposed, timestamp)
- Global singleton: 3 тести

## Що покращило/виправило/додало

### 📦 Підтримка форматів
- **4 формати SBOM**: npm package.json, package-lock.json, CycloneDX, SPDX
- **Автоматичне визначення**: `detectSbomFormat()` ідентифікує формат без ручного вибору
- **Готовність до enterprise**: CycloneDX і SPDX є стандартами CISA/NIST для SBOM

### ⚖️ Ліцензійний аналіз
- **Copyleft детекція**: GPL, AGPL автоматично позначаються як restrictive з юридичними попередженнями
- **OSI compliance**: відстеження OSI-approved ліцензій
- **AGPL SaaS ризик**: спеціальна нотатка про ризик для SaaS-продуктів

### 🔍 Vulnerability Scanning
- **OSV.dev інтеграція**: реальний API без API-ключа
- **Severity extraction**: підтримка текстового (CRITICAL/HIGH) та числового CVSS scoring
- **Fix tracking**: автоматичне визначення fixedIn версії з affected ranges
- **Timeout**: AbortSignal 8s захищає від зависання при API помилках

### 📈 Якість
- 256 тестів (49 нових), exit code 0, 0 TypeScript/ESLint помилок
