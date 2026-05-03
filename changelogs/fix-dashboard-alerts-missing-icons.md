# Fix: DashboardAlerts.tsx — відсутні іконки TrendingUp, TrendingDown, Minus

## Як було
`DashboardAlerts.tsx` використовував `TrendingUp`, `TrendingDown`, `Minus` з `lucide-react` у рядку:
```typescript
const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
```
Але ці іконки не були додані до імпорту. Це спричиняло помилку **"Minus is not defined"** у браузері і повну непрацездатність застосунку.

## Що зроблено
Додано `TrendingUp, TrendingDown, Minus` до блоку імпорту `lucide-react` у `src/pages/dashboard/DashboardAlerts.tsx`.

## Що покращило/виправило/додало
- Усунено runtime-помилку "Minus is not defined"
- Застосунок тепер компілюється без TypeScript-помилок (0 errors)
- Dashboard сторінка відображається коректно у браузері
