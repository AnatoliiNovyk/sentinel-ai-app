# Batch GK - ScanDiff branch coverage

**Дата:** 2026-05-09  
**Компонент:** src/components/ScanDiff.tsx  
**Тести:** src/components/__tests__/ScanDiff.test.tsx

---

## Як було

- Було 17 тестів на базову класифікацію `new/fixed/persisted`, тренди, пошук і export.
- Частина branch-сценаріїв не мала прямої перевірки:
  - стан `No findings to diff.` при двох completed scans і пустому diff;
  - toggle-логіка status stat-card (`same card click` -> повернення до `all`);
  - кейс case-insensitive fingerprint порівняння для persisted.

---

## Що зроблено

- Додано 4 тести у src/components/__tests__/ScanDiff.test.tsx:
  1. persisted-класифікація при різному регістрі title (`SQL Injection` vs `sql injection`);
  2. `No findings to diff.` коли diff порожній, але 2 scans існують;
  3. toggle status stat-card: повторний клік по `New` скидає фільтр до `all`;
  4. додаткові перевірки лічильників `0 New / 0 Fixed / 1 Persisted` для persisted-case.

- Під час батчу виправлено некоректне початкове припущення про `trim()` для внутрішніх пробілів у fingerprint-тесті.
- Focused vitest: `src/components/__tests__/ScanDiff.test.tsx` -> **21/21 PASSED**.

---

## Що покращило/виправило/додало

- Закрито гілку empty diff state для completed scans без записів.
- Додано регресійний захист toggle-гілки `diffStatus === val ? 'all' : val`.
- Підтверджено case-insensitive поведінку fingerprint-порівняння.
- Кількість тестів для ScanDiff: **17 -> 21**.
