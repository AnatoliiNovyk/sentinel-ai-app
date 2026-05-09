# Batch GN - ApiRateLimitsPanel branch coverage

**Дата:** 2026-05-09  
**Компонент:** src/components/ApiRateLimitsPanel.tsx  
**Тести:** src/components/__tests__/ApiRateLimitsPanel.test.tsx

---

## Як було

- Було 12 тестів на loading-state, базовий рендер метрик, warning/exceeded і upgrade CTA.
- Непрямо покритими лишались сценарії:
  - cap відсотка до 100% при usage > limit;
  - явний exceeded message в карточці метрики;
  - fallback `usage[m.key] ?? 0` при undefined usage.

---

## Що зроблено

- Додано 3 тести у src/components/__tests__/ApiRateLimitsPanel.test.tsx:
  1. перевірка cap відсотка (`Math.min(100, ...)`) -> відображення `100%` при over-limit usage;
  2. перевірка exceeded message: `Limit exceeded. Upgrade to increase limits.`;
  3. перевірка fallback на `0` при undefined usage для метрики.

- Стабілізовано флейковий тест у src/pages/__tests__/Scans.test.tsx:
  - у кейсі dismiss mock warning додано явне очікування появи попередження перед пошуком кнопки dismiss.

- Focused vitest: `src/components/__tests__/ApiRateLimitsPanel.test.tsx` -> **15/15 PASSED**.

---

## Що покращило/виправило/додало

- Закрито branch-логіку upper-cap для usage percentage.
- Додано регресійний захист для exceeded warning block.
- Закрито fallback-гілку `usage ?? 0` для edge-case відповідей сервісу.
- Прибрано флейкове падіння тесту dismiss mock warning у full quality gate.
- Кількість тестів для ApiRateLimitsPanel: **12 -> 15**.
