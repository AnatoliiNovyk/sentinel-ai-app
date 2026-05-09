# Batch GO - ScanStats branch coverage

**Дата:** 2026-05-09  
**Компонент:** src/components/scans/ScanStats.tsx  
**Тести:** src/components/__tests__/ScanStats.test.tsx

---

## Як було

- Було 9 тестів на базовий рендер, labels, counts, progress bars і color branches.
- Непрямо покритими лишались сценарії:
  - явна перевірка, що Total card **не має** progress bar/percentage;
  - style.width встановлено коректно для різних процентних значень;
  - grid layout колони (2 md:5) структура;
  - icon-іконки для всіх severity рівнів.

---

## Що зроблено

- Додано 4 нові тести у src/components/__tests__/ScanStats.test.tsx:
  1. Total card не має progress bar і percentage text (4 cards з %, 0 для Total);
  2. style.width встановлено правильно для різних pct (10%, 20%, 30%, 20%);
  3. grid layout з className grid-cols-2 та md:grid-cols-5, 5 cards;
  4. 5 severity-іконок рендериться з правильними text-color класами.

- Focused vitest: `src/components/__tests__/ScanStats.test.tsx` -> **13/13 PASSED**.

---

## Що покращило/виправило/додало

- Закрито conditional branch для Total card (label !== 'Total').
- Закрито style.width dynamic assignment для прогресс-барів.
- Закрито grid responsive layout (grid-cols-2/md:grid-cols-5).
- Закрито icon rendering для всіх severity рівнів (red/orange/yellow/blue/slate).
- Кількість тестів для ScanStats: **9 -> 13**.
