# Batch 280 — Dashboard Probe Test Hardening

## Як було
- Тести Dashboard перевіряли probe smoke блок переважно у fallback-режимі (`Unknown`) без автентифікованого сценарію з реальними даними `audit_logs`.
- Через це існував ризик «псевдо-зеленого» тесту без перевірки фактичного рендеру operational статусу.

## Що зроблено
- У `src/pages/Dashboard.tsx` уточнено flow probe query:
  - спочатку застосовуються фільтри `action + org/user`,
  - потім `order(...).limit(1)`.
- У `src/pages/__tests__/Dashboard.test.tsx`:
  - додано гнучкий hoisted mock auth state;
  - додано mock chain для `audit_logs` query;
  - додано тест authenticated-сценарію з probe metadata (`status=ok`, `reachable=true`, `http_status=200`, `request_id`, `probed_url`);
  - збережено перевірку fallback `Unknown` для порожніх даних.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що це покращило
- Тестове покриття тепер перевіряє реальний operational рендер probe-даних, а не лише порожній стан.
- Зменшено ризик регресій у Dashboard card `Agent probe smoke`.
- Підвищено надійність CI сигналу для UI-видимості probe smoke.
