# Batch EF - ToastContainer branch coverage

**Дата:** 2026-05-09  
**Компонент:** src/components/ToastContainer.tsx  
**Тести:** src/components/__tests__/ToastContainer.test.tsx

---

## Як було

- Було 6 базових тестів на рендер/dismiss.
- Не були явно покриті гілки мапінгів `STYLES`/`ICONS` для всіх 4 типів toast.
- Не було перевірки точкового `removeToast(id)` при кількох toast одночасно.
- Не було явної перевірки, що прогрес-рядок рендериться для кожного toast.

---

## Що зроблено

- Додано 3 нові branch/behavior тести:
  1. Перевірка стилів для всіх типів (`success/error/info/warning`) через класи бару/іконки.
  2. Перевірка, що при кліку на другу кнопку `Dismiss` викликається `removeToast('toast-2')`.
  3. Перевірка, що кількість progress-row контейнерів відповідає кількості toast.

- Focused vitest: `src/components/__tests__/ToastContainer.test.tsx` -> **9/9 PASSED**.

---

## Що покращило/виправило/додало

- Закрито branch-маршрути для style/icon мапінгів усіх toast-типів.
- Додано регресійний захист для правильного таргетингу dismiss події за `id`.
- Підтверджено консистентний рендер progress-row для кожного toast.
- Кількість тестів для ToastContainer: **6 -> 9**.
