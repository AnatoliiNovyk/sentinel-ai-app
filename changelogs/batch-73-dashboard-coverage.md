# Batch 73 — Dashboard.tsx Coverage Improvement

## Як було
- `Dashboard.tsx` statements coverage: **92.6%**, branches: **85.08%**, functions: **82.5%**
- 31 тест (всі проходили до batch 73)
- Непокриті: live jobs panel (659-680), team members panel (750-785), probe error state (441), risk filter buttons (598-602), SLA debounce (171-198), scan durations/avgDuration/p95 (223-236), sort fallback (1120)

## Що зроблено
1. **Виправлено ReferenceError** — `vi.hoisted()` повертав `mockScanJobRows` і `mockTeamRows`, але деструктуризація на рядку 8 не була оновлена. Додано обидві змінні до деструктуруючого присвоєння.
2. **Виправлено тексти в тестах**:
   - "Risk posture" → "Project risk" (реальний заголовок секції)
   - "Avg duration (min)" → "Avg min" (реальний label в `SummaryPill`)
3. **Виправлено SLA debounce тести** — прибрано `vi.useFakeTimers()` що блокував всі проміси; замінено на реальні таймери з `await new Promise(r => setTimeout(r, 100))`
4. **Додано 11 нових тестів** у 7 describe-блоках:
   - `Dashboard — live scan jobs panel`
   - `Dashboard — team members panel`
   - `Dashboard — probe smoke error state`
   - `Dashboard — risk filter buttons`
   - `Dashboard — weekly SLO with scan durations`
   - `Dashboard — findings newest sort`
   - `Dashboard — SLA breach debounce effect`

## Що покращило
- `Dashboard.tsx` statements: **92.6% → 97.76%** (+5.16pp)
- Branches: **85.08% → 90.81%** (+5.73pp)
- Тестів: 31 → **42** (+11)
- Коміт: `6b13a10`
