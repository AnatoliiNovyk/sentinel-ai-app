# Batch GI - Skeleton branch coverage

**Дата:** 2026-05-09  
**Компонент:** src/components/Skeleton.tsx  
**Тести:** src/components/__tests__/Skeleton.test.tsx

---

## Як було

- Було 13 тестів на базовий рендер SkeletonBlock, CardGrid, List і Sidebar.
- Не вистачало явних перевірок для edge-case із `count=0`.
- Для `SkeletonList` і `SkeletonSidebar` не було окремих перевірок a11y-атрибутів контейнера (`aria-label`, `aria-busy`).

---

## Що зроблено

- Додано 6 нових тести у src/components/__tests__/Skeleton.test.tsx:
  1. `SkeletonCardGrid` рендерить 0 карток при `count=0`;
  2. `SkeletonList` має `aria-label="Loading…"` і `aria-busy="true"`;
  3. `SkeletonList` рендерить 0 елементів при `count=0`;
  4. `SkeletonSidebar` має `aria-label="Loading…"` і `aria-busy="true"`;
  5. `SkeletonSidebar` рендерить 0 елементів при `count=0`;
  6. Збережено існуючі перевірки базових layout-гілок без змін прод-коду.

- Focused vitest: `src/components/__tests__/Skeleton.test.tsx` -> **19/19 PASSED**.

---

## Що покращило/виправило/додало

- Закрито edge-case гілки для нульових `count` у всіх skeleton-списках/гридах.
- Посилено регресійний захист для a11y стану завантаження.
- Кількість тестів для Skeleton: **13 -> 19**.
