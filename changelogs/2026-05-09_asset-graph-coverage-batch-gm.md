# Batch GM - AssetGraph branch coverage

**Дата:** 2026-05-09  
**Компонент:** src/components/AssetGraph.tsx  
**Тести:** src/components/__tests__/AssetGraph.test.tsx

---

## Як було

- Було 11 тестів на empty-state, базовий рендер topology, агрегати severity і базові іконки.
- Частина гілок залишалась без прямого покриття:
  - облік `medium` severity поза лічильниками Critical/High/Low-Safe;
  - критична glow-візуалізація (`circle.animate-pulse` з `filter=url(#glow)`);
  - tooltip-рядок asset node з aggregated count;
  - іконкові гілки `Cloud` (`infra/cloud`) і `FileCode` (`git/repo/code`).

---

## Що зроблено

- Додано 4 тести у src/components/__tests__/AssetGraph.test.tsx:
  1. medium severity не потрапляє у Critical/High/Low-Safe counters;
  2. критичний asset рендерить glow circle;
  3. tooltip показує `asset · N finding(s) · severity` з агрегованим count;
  4. рендеряться icon-гілки `lucide-cloud` і `lucide-file-code`.

- Focused vitest: `src/components/__tests__/AssetGraph.test.tsx` -> **15/15 PASSED**.

---

## Що покращило/виправило/додало

- Закрито branch-логіку severity aggregation для `medium` сценарію.
- Додано регресійний захист критичного візуального стану node.
- Зафіксовано очікуваний формат asset tooltip із кількістю findings.
- Закрито додаткові гілки `AssetIcon` для cloud/repo-патернів.
- Кількість тестів для AssetGraph: **11 -> 15**.
