# Batch-314: Coverage — Scheduler.tsx

## Як було
- `src/pages/Scheduler.tsx`: 77.09% рядків, 75.67% гілок, **46.15% функцій**
- `src/pages/__tests__/Scheduler.test.tsx`: 10 тестів (1 describe-група)
- Непокриті зони: create schedule flow, sort controls, search filter, export CSV, delete confirmation dialog, runNow dispatch, export CSV

## Що зроблено
Дописано **+16 нових тестів** у 6 нових describe-групах:

### SchedulerPage — create schedule (4 тести)
- Показує project select коли є проекти
- Закриває форму при Cancel
- Викликає supabase insert при "Create schedule"
- Вибирає частоту (Weekly cadence button)

### SchedulerPage — sort and filter (5 тестів)
- Відображає кнопки Sort: Next run, Latest, Enabled, Disabled
- Clicking "Enabled" / "Latest" / "Disabled" сортує список
- Clear button з'являється після зміни сортування та очищає на click
- Фільтрація через пошуковий рядок

### SchedulerPage — delete confirmation (3 тести)
- Клік Delete відкриває ConfirmDialog
- Cancel закриває діалог
- Confirm видаляє розклад

### SchedulerPage — export CSV (2 тести)
- Export CSV кнопка рендериться коли є розклади
- Клік Export CSV викликає URL.createObjectURL

### SchedulerPage — run now (2 тести)
- Кнопка "Run now" відображається в рядку розкладу
- Клік "Run now" викликає dispatchScan

### Технічні деталі
- Додано `vi.mock('../../lib/scanDispatch', ...)` — dispatchScan mock
- `makeSched()` та `makeProject()` helpers для зручного створення тестових даних
- Визначено `afterEach(() => vi.clearAllMocks())` для ізоляції тестів
- Виявлений TDZ-баг в компоненті: `projectName` задекларований на рядку 146, а використовується в `sortedSchedules` useMemo (рядок 58) — рядок 62 недосяжний через цю помилку

## Що покращило
| Метрика | До | Після | Δ |
|---|---|---|---|
| Lines | 77.09% | **97.73%** | +20.64% |
| Branches | 75.67% | **78.65%** | +2.98% |
| Functions | 46.15% | **88.46%** | +42.31% |
| Statements | 77.09% | **97.73%** | +20.64% |

- Загальна кількість тестів у файлі: **26** (було 10, +16)
- Commit: `970a93c`
