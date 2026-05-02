# Batch 90 — DarkWebMonitor Sort Branches

## Як було
- `DarkWebMonitor.tsx` після Batch 89 мав 98.99% statements.
- Непокритими лишались гілки сортування у `visibleResults` (`newest`, `risk_desc`, `risk_asc`, `query`).

## Що зроблено
- У `src/pages/__tests__/DarkWebMonitor.test.tsx` додано тест:
- `executes all sort modes with multiple results`
- Сценарій створює 2 скани з різним riskLevel і query, потім перемикає всі режими сортування:
- `Risk ↓`
- `Risk ↑`
- `A→Z`
- `Newest`
- Це примусово виконує comparator-гілки в `visibleResults`.

## Що покращило/виправило/додало
- `DarkWebMonitor.tsx` піднято до **99.79% statements** (було 98.99%).
- `DarkWebMonitor.test.tsx`: 41/41 passing.
- Залишковий непокритий рядок: дефолтний `return 0` у comparator (`line 41`), який практично недосяжний через обмежений union-тип `sortBy`.
