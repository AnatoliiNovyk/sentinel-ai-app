# Batch 66 — aiRedTeam, scanMock, scheduler tests

## Як було
- 954 тести, 68 суїтів
- `aiRedTeam.ts`, `scanMock.ts`, `scheduler.ts` не мали тест-файлів
- `passiveRecon.ts` — лише `export {}`, нічого тестувати

## Що зроблено

### Нові тест-файли

**`src/lib/__tests__/aiRedTeam.test.ts`** — 5 тестів
- Returns empty array when vulns list is empty
- Returns empty array when no authenticated user
- Returns empty array when job insert fails
- Returns empty array after polling timeout (status never "completed") — `vi.useFakeTimers()`
- Returns parsed JSON when job completes and vuln description is valid

**`src/lib/__tests__/scanMock.test.ts`** — 8 тестів (AVAILABLE_SCANNERS + runMockScan)
- Contains at least 10 scanners
- Every scanner has id, label, description
- Contains "nmap" scanner
- Contains "prowler" with cloud="aws"
- Contains "tfsec" with category="iac"
- Contains "trivy" container scanner
- No duplicate scanner ids
- Returns null when supabase returns no data

**`src/lib/__tests__/scheduler.test.ts`** — 5 тестів
- Returns 0 when no due schedules
- Returns 0 when supabase returns null data
- Fires one scan for one due schedule and returns 1
- Uses empty string as target when project has no target
- Counts only successfully dispatched scans

### Виправлення під час розробки
- `scanMock.test.ts`: прибрано `as ReturnType<typeof supabase.from>` каст — TypeScript TS2352 incompatible types error

## Що покращило / виправило / додало
- **+18 тестів** (954 → 972)
- **+3 суїти** (68 → 71)
- Всі lib-файли тепер покриті тестами (крім `passiveRecon.ts` — порожній файл, та `supabase.ts` — тільки типи/клієнт)
- `quality:check` проходить: ESLint 0 warnings, typecheck OK, 972/972, build OK
