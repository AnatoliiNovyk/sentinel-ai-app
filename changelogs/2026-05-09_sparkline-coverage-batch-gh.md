# Batch GH - Sparkline branch coverage

**Дата:** 2026-05-09  
**Компонент:** src/components/Sparkline.tsx  
**Тести:** src/components/__tests__/Sparkline.test.tsx

---

## Як було

- Було 10 тестів з фокусом на базовий рендер SVG, кольори та порожній масив.
- Частина гілок/обчислень залишалась без явної перевірки:
  - вибір `fillColor ?? color` для gradient stop;
  - обчислення координат при плоскому ряді (`max-min=0`, `range=1` fallback);
  - вплив `strokeWidth` на `pad` і стартову координату шляху.

---

## Що зроблено

- Додано 3 нові тести у src/components/__tests__/Sparkline.test.tsx:
  1. `uses fillColor for gradient stops when provided`;
  2. `does not produce NaN coordinates for flat data`;
  3. `applies strokeWidth as drawing pad in coordinates`.

- Focused vitest: `src/components/__tests__/Sparkline.test.tsx` -> **13/13 PASSED**.

---

## Що покращило/виправило/додало

- Закрито гілку `fillColor ?? color` для gradient-рендеру.
- Додано регресійний захист для edge-case з однаковими значеннями в серії.
- Зафіксовано очікувану геометрію лінії при кастомному `strokeWidth`.
- Кількість тестів для Sparkline: **10 -> 13**.
