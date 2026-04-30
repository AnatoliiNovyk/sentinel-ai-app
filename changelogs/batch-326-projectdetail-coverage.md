# Batch-326 Changelog — ProjectDetail Coverage

## Як було
- `src/pages/ProjectDetail.tsx` — найгірше покриття в кодовій базі:
  - Lines: 40.11%, Branches: 46.37%, Functions: 20.68%
- Тест-файл `ProjectDetail.test.tsx` містив лише 9 базових тестів (191 рядок)

## Що зроблено
- Додано mock для `AgentLogsPanel` у тест-файлі
- Оновлено `vi.hoisted()` блок: додано `mockScansOrder`, `mockReportsOrder`, `mockProjectsUpdate`
- Переписано supabase mock для повної підтримки: scans/reports order functions, projects update
- Додано 34 нових тести у 7 нових describe-блоках:
  1. **tab switching** — topology, scans (empty state), reports (empty state), activity
  2. **quickScan** — виклик dispatchScan, alert при помилці
  3. **quickReport buttons** — стан disabled без scans, enabled з scans
  4. **Export dropdown** — відкриття, CSV/JSON/All Project Data
  5. **ScansTab with data** — список сканів, re-run, фільтр статусу, search, handleRescan
  6. **ReportsTab with data** — список репортів, фільтр за kind, відкриття/закриття ReportViewer
  7. **OverviewTab with vulns** — stats, top findings, SOC2 Readiness, topology link
  8. **ActivityTab** — scan та notification items
  9. **WebhookPanel** — рендер, save, підтвердження "✓ Saved"

## Що покращило
- Lines: **40.11% → 85.86%** (+45.75%)
- Branches: **46.37% → 74.86%** (+28.49%)
- Functions: **20.68% → 69.44%** (+48.76%)
- Загальна кількість тестів: 9 → **43** (+34)
- Commit: `4a70fe7`
