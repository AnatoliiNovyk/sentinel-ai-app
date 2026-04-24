# Technical Audit: Duplicate TS-JS Cleanup (Batch 29-30)

## Overview
This document provides technical reference for the TS/JS duplicate cleanup work performed in batches 29-30.

## Cleanup Summary

### Statistics
- **Total .js duplicates removed**: 74 files
- **Distribution by area**:
  - `src/lib/`: 26 files (utility functions, services, mocks)
  - `src/pages/`: 22 files (page components)
  - `src/components/`: 14 files (UI components)
  - `src/api/`: 4 files (API services)
  - `src/context/`: 2 files (React context hooks)
  - `supabase/functions/`: 3 files (edge function handlers)
  - `src/__tests__/`: 1 file (test setup)

### Removed File Categories

#### src/lib/ (26 files)
- agentTools.js, aiGateway.js, aiMock.js, aiRedTeam.js
- compliance.js, cveEnrichment.js, errors.js, evidencePackage.js
- exporters.js, passiveRecon.js, reportBuilder.js, riskScore.js
- scanDispatch.js, scanMock.js, scheduler.js, supabase.js, threatIntel.js
- AI gateway test mocks and supporting utilities

#### src/pages/ (22 files)
- ApiDocs.js, AttackSurfaceMap.js, Auth.js, Chat.js, Compliance.js
- Dashboard.js, DarkWebMonitor.js, Integrations.js, KillChain.js
- Landing.js, NotFound.js, PassiveRecon.js, ProjectDetail.js
- Projects.js, PublicReport.js, Reports.js, Scans.js
- Scheduler.js, Settings.js, SupplyChain.js
- (Full page route implementations)

#### src/components/ (14 files)
- AppLayout.js, AssetGraph.js, ExecutionConsole.js, FindingsTab.js
- NotificationBell.js, RemediationModal.js, ReportViewer.js, ScanDiff.js
- SchedulesPanel.js, Sparkline.js
- scans/ScanHeader.js, scans/ScanStats.js, scans/VulnerabilityCard.js, scans/VulnerabilityList.js

#### supabase/functions/ai-gateway/ (3 files)
- contract.js, handler.js, rateLimit.js

#### Integration Tests (2 files)
- src/pages/__tests__/Chat.integration.test.js
- src/pages/__tests__/Scans.integration.test.js

## Root Cause Analysis

### Why Duplicates Existed
1. **Build toolchain artifact**: Vite was emitting transpiled .js files into the src directory during certain build modes or through watch processes.
2. **Legacy build configuration**: Project may have once required .js files for certain Node versions or bundler compatibility.
3. **Incomplete migration**: When switching from .js to .ts/.tsx, generated files were not cleaned up systematically.

### Why This Caused Problems
1. **Module resolution ambiguity**: 
   - Node/Vite could resolve either `foo.ts` OR `foo.js` based on extension resolution order.
   - Tests running under Vitest sometimes resolved the stale .js version instead of the current .ts source.
   
2. **Silent regressions**:
   - Changes to .ts files were not reflected in tests if test runner picked up the .js version.
   - Example: Batch 29 added progress callback to `ai.service.ts`, but tests ran against `ai.service.js` (which didn't have the callback).

3. **False passes**:
   - Quality gate sometimes passed because generated .js files were still present and compatible.
   - After deletion, tests forced evaluation of current .ts sources, revealing real bugs.

## Preventive Measures

### New Guard Script
**Location**: `scripts/check-no-ts-js-duplicates.cjs`

**What it does**:
```bash
npm run check:no-js-duplicates
```
- Scans `src/` and `supabase/functions/` recursively.
- For each `.js` file, checks if a sibling `.ts` or `.tsx` exists.
- If any duplicates found, exits with code 1 and lists them.
- Returns 0 (pass) if all clear.

**Integration**:
- Added as first step in `quality:check` pipeline (package.json).
- Runs before lint, typecheck, tests, and build.
- Blocks CI/CD if duplicates slip in.

**Example Output** (if duplicates detected):
```
Found JS duplicates with TS/TSX siblings:
- src/api/ai.service.js
- src/pages/Chat.js
Total: 2
npm ERR! code ELIFECYCLE
```

## Testing Coverage

### Validation of Cleanup
- `npm run test:run` — 60 tests passed (subset earlier failed due to .js resolution).
- `npm run quality:check` — Full lint + typecheck + tests + build PASS.
- `npm run check:no-js-duplicates` — Confirmed 0 duplicates remain.

### Test Resilience
Tests now reliably resolve `.ts` sources because:
1. Vite/Vitest config honors TypeScript file first.
2. No competing .js files to cause ambiguity.
3. Source-of-truth is always the TypeScript file.

## Recommendations for Developers

### When Adding New Files
1. Always use `.ts` or `.tsx` — never `.js` in `src/` or `supabase/functions/`.
2. If you generate a `.js` file (e.g., during debugging), delete it before committing.
3. Run `npm run check:no-js-duplicates` locally before pushing.

### In CI/CD
- `quality:check` gate automatically prevents re-introducing duplicates.
- If gate fails on this check, delete the offending `.js` files and retry.

### For Build/Bundler Scripts
- Ensure build outputs go to `dist/` or `build/` — never `src/`.
- Verify `.gitignore` includes generated artifacts.

## Key Commits
- Batch 30: Removed 74 .js files + added guard script.
- Batch 29: UX stabilization after identifying .js resolution issue.

## Related Files
- `.gitignore` — should exclude `dist/`, `build/`, `*.js` (if ever generated in src).
- `vite.config.ts` — module resolution order.
- `tsconfig.json` — compilation targets.
- `package.json` — build and quality check scripts.

## Future Improvements
1. **Automated cleanup**: Add a pre-commit hook that auto-removes .js dups if found.
2. **Watch mode safeguard**: Disable Vite watch .js emission in development.
3. **Linter rule**: ESLint could flag `.js` imports from `src/` (only .ts/.tsx allowed).
