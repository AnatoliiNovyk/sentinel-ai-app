# Batch-312: Reports.tsx coverage improvement

## Як було
- `Reports.tsx` — **71.36%** ліній, **32.72%** функцій, **81.08%** гілок
- Непокриті ділянки: sort controls, single-report delete confirmation, bulk delete confirmation, ReportView shared-report panel (Revoke/Rotate), export buttons (DOCX/CSV/Print), GenerateModal template management
- Загальна кількість тестів: **1521**

## Що зроблено
- Оновлено mock `supabase.from('reports').delete()` — додано `.eq()` для підтримки single-report delete
- Додано **+28 нових тестів** у `src/pages/__tests__/Reports.test.tsx` у 5 нових describe-групах:

| Група | Тести |
|---|---|
| Reports — sort controls | 5 |
| Reports — delete report confirmation dialog | 3 |
| Reports — bulk delete confirmation | 3 |
| Reports — ReportView shared report panel | 4 |
| Reports — ReportView export and print | 5 |
| Reports — GenerateModal template management | 4 |

- Виправлено ambiguous selectors для `ConfirmDialog` (кнопки Cancel/Delete мають по дві копії: іконка + текст)

## Що покращило / виправило / додало
- `Reports.tsx` ліній: **71.36% → 88.49%** (+17.13 п.п.)
- `Reports.tsx` функцій: **32.72% → 71.92%** (+39.2 п.п.)
- `Reports.tsx` гілок: **81.08% → 87.74%** (+6.66 п.п.)
- Загальна кількість тестів: **1521 → 1545** (+24 ефективних)
- Commit: `71801ec` — pushed to main

## Наступні кандидати (Batch-313+)
- **Auth.tsx**: 75.73% (lines 21-30, 40, 119-152 — sign up branch)
- **Scheduler.tsx**: 77.09% (lines 437-441, 465, 477)
- **Activity.tsx**: 78.59% (lines 726-727, 731-752)
