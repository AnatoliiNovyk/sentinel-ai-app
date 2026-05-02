# Batch 87 — Dashboard Coverage

## Як було
- `Dashboard.tsx` мав 97.76% statements.
- Непокритий великий debounce-блок SLA нотифікацій (рядки 171-198), бо callback з `setTimeout(1500)` не виконувався у тестах.
- Також лишались точкові непокриті рядки 602 і 1120.

## Що зроблено
- У `src/pages/__tests__/Dashboard.test.tsx` оновлено mock для `supabase.from('vulnerabilities')`, додано `update().eq().is()` ланцюг, щоб дебаунс-гілка могла виконати write-path.
- Додано новий тест:
- `executes debounced SLA notification writes for breached and at-risk findings`
- Сценарій створює 2 уразливості:
- overdue critical (SLA breach)
- at-risk high (SLA warning)
- Після рендеру виконується очікування `1700ms`, щоб реально відпрацював debounce callback і внутрішні async update/insert.

## Що покращило/виправило/додало
- Покриття `Dashboard.tsx` піднято з 97.76% до 99.84% statements.
- Підтверджено виконання критичного production-шляху SLA debounce-нотифікацій у тестах.
- Після змін: `Dashboard.tsx` = 99.84% statements, 90.51% branches, 85% funcs, 99.84% lines.
