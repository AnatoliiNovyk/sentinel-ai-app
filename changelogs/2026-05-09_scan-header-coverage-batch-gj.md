# Batch GJ - ScanHeader branch coverage

**Дата:** 2026-05-09  
**Компонент:** src/components/scans/ScanHeader.tsx  
**Тести:** src/components/__tests__/ScanHeader.test.tsx

---

## Як було

- Було 11 тестів на базовий рендер, mode badge та основні взаємодії.
- Частина гілок залишалась без прямої перевірки:
  - гілка `MOCK` без demo badge, коли агент доступний;
  - гілка subtitle для `selectedProjectId`, який існує в списку;
  - fallback subtitle для `selectedProjectId`, якого немає у списку;
  - варіант з порожнім списком проєктів (`All projects (0)`).

---

## Що зроблено

- Додано 4 тести у src/components/__tests__/ScanHeader.test.tsx:
  1. `MOCK + agentReachable=true` показує `Selected Scan: Historical` і не показує `DEMO MODE`;
  2. при валідному `selectedProjectId` відображається контекст `Showing scans for` + назва проєкту;
  3. при невалідному `selectedProjectId` використовується fallback subtitle;
  4. при `projects=[]` відображається `All projects (0)`.

- Після першого прогону виправлено неоднозначний assertion по `Alpha` (`getByText` -> `getAllByText` з count-перевіркою).
- Focused vitest: `src/components/__tests__/ScanHeader.test.tsx` -> **15/15 PASSED**.

---

## Що покращило/виправило/додало

- Закрито гілки mode badge для `MOCK` без demo fallback.
- Закрито гілки subtitle для знайденого/незнайденого `selectedProjectId`.
- Додано edge-case для порожнього списку проєктів.
- Кількість тестів для ScanHeader: **11 -> 15**.
