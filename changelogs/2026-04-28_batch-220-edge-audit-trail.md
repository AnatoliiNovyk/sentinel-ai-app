# Batch 220: Edge audit trail для scan lifecycle

## Як було
- Lifecycle події сканування були видимі в `agent_logs`, але не потрапляли системно в `audit_logs` з action/status контекстом.
- Через це compliance-аудит і вибірки по `audit_logs` не відображали повний цикл scan подій dispatch/result.

## Що зроблено
- У `supabase/functions/scan-dispatch/index.ts` додано non-blocking helper `insertAuditLog`.
- Додано audit події в dispatch flow:
  - `rate_limit_exceeded` (status: `failure`) при 429;
  - `scan_started` (status: `success`) після постановки job у чергу.
- У `scan-dispatch` catch-path додано `scan_failed` (status: `failure`) за наявності валідного scan context.
- У `supabase/functions/scan-result/index.ts` додано non-blocking helper `insertAuditLog`.
- Додано audit події в result flow:
  - `scan_failed` (status: `failure`) при `error_message`;
  - `scan_completed` (status: `success`) при успішному завершенні scan.
- Додано захист від некоректних вставок: audit пишеться лише коли доступні валідні `org_id` і `user_id` із scan context.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`: P1.2 позначено виконаним.

## Що покращило
- Підвищено прозорість і трасованість scan lifecycle у `audit_logs` для compliance/reporting сценаріїв.
- Збережено принцип non-blocking: помилки audit insert не ламають основний pipeline.
- Закрито ще один P1 крок без зміни публічного API контракту edge functions.
