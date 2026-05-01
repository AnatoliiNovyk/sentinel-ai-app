# Batch 63 — AttackSurfaceMap.tsx: Tooltip IIFEs + Physics Simulation Coverage

## Як було
- `src/pages/__tests__/AttackSurfaceMap.test.tsx`: 53 тести, functions **68.42%**
- Непокриті рядки: 532–545 (IIFE проекту з vulnsByProject), 551–567 (IIFE vuln severity badge), 103–145 (функція `simulate`), 225–229 (функція `run` у physics useEffect)
- Мок `riskBand` повертав рядок `'low'`, але компонент викликав `.label` → `undefined risk level` в DOM

## Що зроблено
1. **Виправлено мок `riskBand`**: змінено `mockReturnValue('low')` → `mockReturnValue({ label: 'Low', color: 'text-sky-400' })`
2. **Додано describe `AttackSurfaceMap — project tooltip vuln breakdown`** (3 тести):
   - Клік по SVG-вузлу проекту → перевірка `Risk score` та `risk level` в tooltip
   - Клік по проекту з вулнами → тригер IIFE `vulnsByProject` breakdown
   - Ітерація SVG `<g>` елементів — пошук vuln node для severity badge
3. **Додано describe `AttackSurfaceMap — vuln node tooltip severity badge`** (2 тести):
   - Рендер без краша при кількох vuln nodes
   - Цикл кліків по SVG groups
4. **Додано describe `AttackSurfaceMap — physics simulation`** (1 тест):
   - `requestAnimationFrame` мок викликає `cb` обмежену кількість разів (2) → покриває `run` (225–229) і `simulate` (103–145)

## Що покращило / виправило / додало
- Functions: **68.42% → 84.21%** (+15.79%)
- Statements/Lines: **83.81% → 99.59%** (+15.78%)
- Branches: **80.70% → 81.18%**
- Загальна кількість тестів: **53 → 59** (+6)
- Commit: `c00f584`
