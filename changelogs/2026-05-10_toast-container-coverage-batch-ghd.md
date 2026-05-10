# Changelog — Batch GHD: ToastContainer Coverage Expansion

**Дата:** 2026-05-10  
**Компонент:** `src/components/ToastContainer.tsx`  
**Файл тестів:** `src/components/__tests__/ToastContainer.test.tsx`

---

## Як було

- 12 тестів у `ToastContainer.test.tsx`
- Непокриті гілки:
  - клас `bg-slate-900` на картці тосту
  - клас `pointer-events-none` на зовнішньому `aria-live` контейнері
  - точна кількість викликів `removeToast` (лише перевірка аргументу, без `toHaveBeenCalledTimes`)

---

## Що зроблено

Додано 3 нових тести:

1. **`each toast card has bg-slate-900 background class`**  
   Перевіряє, що картки тостів мають клас `bg-slate-900` (фоновий колір спільний для всіх типів).

2. **`outer aria-live container has pointer-events-none class`**  
   Перевіряє клас `pointer-events-none` на зовнішньому контейнері (тости не перехоплюють кліки через зовнішній wrapper).

3. **`calls removeToast exactly once when Dismiss is clicked`**  
   Перевіряє `toHaveBeenCalledTimes(1)` і `toHaveBeenCalledWith('toast-x')` — захист від подвійних викликів.

---

## Результат

- **Тести:** 12 → 15 (+3)
- **Focused run:** 15/15 ✓ (1.55s)
- **quality:check:** 2881/2881 passed (114 файлів) ✓
- **Build:** ✓ built in 1.74s
