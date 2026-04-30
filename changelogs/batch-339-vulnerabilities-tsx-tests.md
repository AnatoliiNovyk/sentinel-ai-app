# Batch-339: Vulnerabilities.tsx — coverage improvement

## Як було
- `src/pages/__tests__/Vulnerabilities.test.tsx`: ~13 тестів у 4 describe-блоках
- Coverage: Lines **79.55%**, Branches **67.18%**, Functions **23.68%**
- Відсутні тести: bulk actions (Resolve/Accept/False positive), сортування, пошук, фільтри, export, VulnRow деталі, Refresh

## Що зроблено
1. **Додано `waitFor, act`** в імпорти
2. **Bulk actions (5 нових тестів)**:
   - Resolve → bulkUpdate('resolved') → supabase.update().in()
   - Accept risk → bulkUpdate('accepted')
   - False positive → bulkUpdate('false_positive')
   - BulkBar close button → clearSel()
   - Select all / Deselect all toggle
3. **Sort and search (9 нових тестів)**:
   - Newest, Oldest, A→Z, Project sort buttons
   - Search input filters by text
   - Clear filters button resets search
   - Status filter "Open" button
   - Has CVE checkbox
   - SLA breached checkbox
4. **Export (3 нові тести)**:
   - Відкриття dropdown Export
   - Click CSV → downloadFile з .csv
   - Click JSON → downloadFile з .json
5. **Row features (2 нові тести)**:
   - SLA breached badge видно для vuln з sla_breached_at
   - CVE link visible для vuln з cve_id
   - Project name appears when scans link to projects
6. **Refresh (1 новий тест)**:
   - Refresh button re-fetches data

## Що покращило
- Тести: **13 → 29** (+16 нових)
- Coverage `Vulnerabilities.tsx`:
  - Lines: **79.55% → 95.36%** (+15.81%)
  - Branches: **67.18% → 78.1%** (+10.92%)
  - Functions: **23.68% → 65.78%** (+42.1%)
- Залишаються непокриті:
  - Lines 714-721: pagination "Load more" (потребує >25 vulns)
  - Lines 736-741: bulk loading overlay (потребує затримку при bulk update)
  - Деякі branch-шляхи в сортуванні (project sort, CVSS score colors)

## Commit
`268d060` pushed to main
