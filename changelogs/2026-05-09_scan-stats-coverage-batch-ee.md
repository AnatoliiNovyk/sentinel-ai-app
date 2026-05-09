# Batch EE - ScanStats branch coverage

**Дата:** 2026-05-09  
**Компонент:** src/components/scans/ScanStats.tsx  
**Тести:** src/components/__tests__/ScanStats.test.tsx

---

## Як було

- Було 5 базових тестів на рендер лейблів і count-значень.
- Не були явно покриті гілки логіки прогрес-барів:
  - `barColor` (red/orange/yellow/blue).
  - `pct` округлення через `Math.round((count / total) * 100)`.
  - умовний рендер для `label !== 'Total'`.
  - установка ширини бару в `0%` при `total === 0`.

---

## Що зроблено

- Додано 4 нові тести у src/components/__tests__/ScanStats.test.tsx:
  1. Перевірка гілок `barColor` для `critical/high/medium/low`.
  2. Перевірка округлених відсотків (`33%`, `0%`) для non-total карток.
  3. Перевірка, що для картки `Total` рядок `% of total` не рендериться.
  4. Перевірка, що при `total=0` ширина всіх non-total progress bar дорівнює `0%`.

- Focused vitest: `src/components/__tests__/ScanStats.test.tsx` -> **9/9 PASSED**.

---

## Що покращило/виправило/додало

- Закрито branch-гілки в обчисленні кольору та відсотка прогрес-барів.
- Зафіксовано поведінку UI для edge-case `total=0`.
- Додано регресійний захист для умовного рендеру `Total` картки.
- Кількість тестів для ScanStats: **5 -> 9**.
