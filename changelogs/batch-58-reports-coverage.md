# Batch 58 — Reports.tsx Coverage Improvement

## Як було
- `src/pages/__tests__/Reports.test.tsx`: 44 тести
- Functions coverage: **71.92%**
- Lines: **88.49%**

## Що зроблено
- Розширено supabase mock: додано таблиці `scans`, `vulnerabilities`, `notifications`, `insert` для `reports`
- Додано `mockGetSession` для `supabase.auth.getSession` (потрібно для `generateViaEdgeFunction`)
- Додано **7 нових тестів** (44 → 51) у новому describe "GenerateModal generate flow":
  - `generate` через успішний edge function виклик (мок `fetch` → 200 OK)
  - `generate` через провал edge function → fallback до `generateLocally`
  - `toggleField` — клік на поле звіту вмикає/вимикає checkbox
  - `useAi` — toggle "Enhance narrative with AI" checkbox
  - Переключення типу на Technical — оновлює набір полів
  - Cancel button закриває модальне вікно
  - Close (X) button закриває модальне вікно

## Що покращило
| Метрика | До | Після | Приріст |
|---|---|---|---|
| Tests | 44 | 51 | +7 |
| Functions | 71.92% | **87.71%** | **+15.79%** |
| Lines | 88.49% | **96.83%** | +8.34% |
| Statements | 88.49% | 96.83% | +8.34% |
| Branches | 87.19% | 84.21% | -2.98% (niche branch paths) |

**Commit**: fc74987  
**Push**: ✅ main
