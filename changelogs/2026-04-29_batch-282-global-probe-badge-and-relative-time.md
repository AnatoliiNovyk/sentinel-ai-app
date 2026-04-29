# Batch 282 — Global Probe Badge and Relative Time

## Як було
- Статус `agent_health_probe_smoke` був видимий лише у Dashboard.
- У Dashboard `Last run` показувався як локальний час без швидкої інтерпретації давності.

## Що зроблено
- У `src/components/AppLayout.tsx`:
  - додано завантаження останнього `agent_health_probe_smoke` з `audit_logs`;
  - додано компактний global badge у хедері: `Probe OK / Probe Fail / Probe n/a`;
  - додано relative-time формат (`Xm ago`, `Xh ago`, `Xd ago`) для probe status.
- У `src/pages/Dashboard.tsx`:
  - `Last run` у probe smoke блоці переведено на relative-time формат.
- У `src/components/__tests__/AppLayout.test.tsx`:
  - додано мок `supabase` для `audit_logs` query;
  - додано тест рендеру global probe badge при `status=ok`.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що це покращило
- Оператор бачить probe smoke стан глобально у хедері на будь-якій сторінці.
- Час останнього probe читається швидше через relative-time.
- Додано тестове покриття для нового global badge сценарію.
