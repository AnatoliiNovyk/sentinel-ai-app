# Batch-315: Coverage — Activity.tsx

## Як було
- `src/pages/Activity.tsx`: 78.59% рядків, 73.25% гілок, **52.38% функцій**
- `src/pages/__tests__/Activity.test.tsx`: 10 тестів (5 describe-груп)
- Непокриті зони: AnomalyTab (anomaly cards, heatmap, top errors, errors by project), search filter, level filter pill, auto-refresh toggle, load more, project link navigation

## Що зроблено
Дописано **+17 нових тестів** у 3 нових describe-групах:

### Activity — anomaly tab (6 тестів)
- "No log data to analyze" коли нема логів
- "Detected Anomalies" heading відображається з логами
- "No anomalies detected" для малого набору без патернів
- "7-Day Hourly Activity Heatmap" рендериться
- "Errors by Project" коли є error-логи з project_id (покриває рядки 726-727, 731-752)
- "Top Error Patterns" при ≥5 однакових помилках

### Activity — search and filter interactions (5 тестів)
- Search input фільтрує лог-записи
- Клік stat card "Error" ре-триггерить fetch
- Level filter pill у filter panel змінює фільтр
- Auto-refresh toggle → "Paused"
- Повторний клік → "Live"
- Project filter dropdown показує опції проектів

### Activity — load more and navigation (3 тести)
- "Load more" кнопка при 51 результаті (PAGE_SIZE+1)
- Клік "Load more" тригерить додатковий fetch
- Клік project link → navigate('/projects?id=...')

## Що покращило
| Метрика | До | Після | Δ |
|---|---|---|---|
| Lines | 78.59% | **92.97%** | +14.38% |
| Branches | 73.25% | **86.42%** | +13.17% |
| Functions | 52.38% | **86.36%** | +33.98% |
| Statements | 78.59% | **92.97%** | +14.38% |

- Кількість тестів у файлі: **27** (було 10, +17)
- Commit: `9077089`
