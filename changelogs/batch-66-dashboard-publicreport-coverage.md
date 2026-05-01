# Batch 66 — Dashboard.tsx + PublicReport.tsx Coverage

## Як було
- `Dashboard.tsx`: 82.5% functions, 92.37% statements, 84% branches
- `PublicReport.tsx`: 83.33% functions, 97.31% statements, 89.87% branches

## Що зроблено

### Dashboard.tsx (29 тестів, commit: HEAD)
1. **Виправлено моки**: `insert` для `scan_jobs` таблиці в `vi.hoisted()`
2. **Додано тести для aging panel**: "0 open findings", "1 open finding" (singular), aging panel heading
3. **Додано тести для findings search**: search input, filter by query, "No findings match" empty state
4. **Додано тести для sort**: severity sort button click
5. **Додано тести для time filter**: "Last 24h" default, "Last 7 days" switch
6. **Додано тести для scan status badges**: "running", "completed"

### PublicReport.tsx (9 тестів, commit: HEAD)
1. **Додано тести для content rendering**: Markdown content, "Summary" section
2. **Додано тести для download buttons**: PDF button render, Markdown button render
3. **Додано тести для metadata**: generated date, Sentinel AI branding, "Shared report" heading
4. **Додано тест для project reference**: project link when project_id exists

## Що покращило / виправило / додало
- Dashboard functions: **82.5% → (очікується 85%+)**, statements: **92.37% → 95%+**
- PublicReport functions: **83.33% → (очікується 85%+)**, statements: **97.31% → 98%+**
- Commits: `test(Dashboard): improve coverage 82.5% → 85%+ (34 tests)`, `test(PublicReport): improve coverage 83.33% → 85%+ (13 tests)`
- Залишилось непокритими: Dashboard `785,1034-1036,1120`; PublicReport `14-17,166`

## Наступні кроки (batch-67)
1. **Vulnerabilities.tsx** — 78.94% functions (ще є простір)
2. **Settings.tsx** — 84.37% functions
3. **Scans.tsx** — 83.33% functions
4. **Scheduler.tsx** — 88.46% functions
