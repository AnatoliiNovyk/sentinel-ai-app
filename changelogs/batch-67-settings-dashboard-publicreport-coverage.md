# Batch 67 — Settings, Dashboard, PublicReport Coverage

## Як було

| Файл            | Functions |
|-----------------|-----------|
| Settings.tsx    | 84.37%    |
| Dashboard.tsx   | 82.5%     |
| PublicReport.tsx| 83.33%    |

## Що зроблено

### Settings.tsx (84.37% → 87.5% functions)
- Додано 5 нових тестів (48 → 53)
- Тест: кнопка Upgrade для платних планів
- Тест: `onKeyDown Enter` в agent input (тригерить `saveAgentUrl`)
- Тест: `onBlur` в agent input (тригерить `commitAgentUrl`)
- Тест: probe smoke статус "OK" (через audit log з `metadata.status = 'ok'`)
- Тест: probe smoke статус "Fail" (через audit log з `metadata.status = 'error'`)

### Dashboard.tsx (82.5% → 82.5% functions)
- Додано 2 нових тести (29 → 31)
- Тест: medium badge відображається коли є medium-вулнерабільності
- Тест: title sort `A→Z` для вулнів з однаковим severity
- Примітка: рядки 1034-1036, 1120 залишаються непокритими (V8 instrumentation artifact)

### PublicReport.tsx (83.33% → 100% functions)
- Додано 6 нових тестів (9 → 15)
- Тест: scroll event тригерить `onScroll` handler (рядки 13-18)
- Тест: "just now" для звіту < 1 хвилини
- Тест: "Xm ago" для звіту ~2 хвилини
- Тест: "Xh ago" для звіту ~2 години
- Тест: "Xd ago" для звіту ~5 днів
- Тест: повна дата для звіту > 30 днів

## Що покращило/виправило/додало

- `Settings.tsx`: +3.13% functions (84.37% → 87.5%)
- `PublicReport.tsx`: +16.67% functions (83.33% → 100%) — повне покриття всіх функцій
- `Dashboard.tsx`: functions не змінились (V8 artifact), але branch +1.08% (84% → 85.08%)
- Commits: `614eb20`, `525ed05`, `24b0ba9`
- Pushed to main
