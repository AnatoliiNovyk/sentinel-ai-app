# Batch-331: Coverage — AttackSurfaceMap.tsx

## Як було
- `src/pages/__tests__/AttackSurfaceMap.test.tsx`: 10 тестів
- Coverage `AttackSurfaceMap.tsx`: lines **71.31%**, branches **54.28%**, functions **26.31%**

## Що зроблено
Додано 14 нових тестів у 5 нових describe-блоків:

### Нові describe-блоки
1. **`stats with data`** — 4 тести: critical count (виключає resolved), high count, Medium count, Exposed Assets count (унікальні не-resolved assets)
2. **`search filter`** — 2 тести: search input присутній, введення тексту показує badge "N visible"
3. **`node filter buttons`** — 3 тести: кнопки "All nodes"/"Findings" присутні, клік "Projects" не кидає помилку, клік "Findings" показує badge
4. **`export buttons`** — 3 тести: CSV/JSON кнопки видно коли nodes > 1, клік CSV/JSON викликає `downloadFile` з правильним розширенням та MIME-type
5. **`severity filter`** — 2 тести: кнопки sev-фільтру присутні, клік "critical" не кидає

### Технічні рішення
- Додано `vi.mock('../../lib/exporters', ...)` з `mockDownloadFile` через `vi.hoisted()`
- Визначена спільна функція `waitForLoaded()` на рівні модуля (чекає зникнення "Building attack surface map..." тексту)
- Статистики перевіряються через `nextElementSibling` від label-елементу (минаючи проблему `closest('div')` для сиблінгів)
- Уникнуто `getByText('Projects')` при наявності дублів (stat card + filter button)

## Що покращило
- Lines: **71.31% → 79.71%** (+8.4%)
- Branches: **54.28% → 78.34%** (+24.1%)
- Functions: **26.31% → 52.63%** (+26.3%)
- Загальна кількість тестів: 10 → 24 (+14)
- Commit: `fe9366d`, pushed to main
