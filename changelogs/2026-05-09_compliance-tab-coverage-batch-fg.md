# Batch FG - ComplianceTab branch coverage

**Дата:** 2026-05-09  
**Компонент:** src/components/ComplianceTab.tsx  
**Тести:** src/components/__tests__/ComplianceTab.test.tsx

---

## Як було

- Було 6 тестів на базові сценарії loading/error/success та refresh.
- Частина branch-гілок лишалась без явних перевірок:
  - fallback-помилки, коли response без `error` або без `dashboard` payload;
  - візуальні статуси framework (`compliant`, `at-risk`, `non-compliant`);
  - форматовані значення метрик (`toFixed`, одиниці `h/ms`);
  - гілка `total === 0` у `VulnSeverityBar` (width 0%).

---

## Що зроблено

- Додано 5 нових тестів у src/components/__tests__/ComplianceTab.test.tsx:
  1. fallback-помилка при `success:false` без `error`;
  2. fallback-помилка при `success:true` і `dashboard:null`;
  3. перевірка рендеру статусів `compliant / at-risk / non-compliant`;
  4. перевірка форматованих метрик (`80.6%`, `50.0%`, `37h`, `512ms`);
  5. перевірка `0%`-ширин барів при нульовому vulnerability distribution total.

- Focused vitest: `src/components/__tests__/ComplianceTab.test.tsx` -> **11/11 PASSED**.

---

## Що покращило/виправило/додало

- Закрито гілки fallback-логіки в обробці response без повних даних.
- Додано регресійний захист для framework status badge сценаріїв.
- Зафіксовано формат числових метрик і одиниць виміру.
- Покрито edge-case `total=0` у severity bar обчисленні.
- Кількість тестів для ComplianceTab: **6 -> 11**.
