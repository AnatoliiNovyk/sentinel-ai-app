# Batch 221: Fix міграції audit_logs policy

## Як було
- Міграція `20260428113000_create_audit_logs_table.sql` падала на `supabase db push`.
- Причина: policy `Users can read own org audit logs` посилалась на `profiles.org_id`, але такого поля в схемі немає.

## Що зроблено
- Оновлено policy читання в `supabase/migrations/20260428113000_create_audit_logs_table.sql`.
- Замість невалідного join через `profiles` використано RBAC-зв'язок через `team_members`:
  - доступ за `user_id = auth.uid()`;
  - або через membership `team_members.org_id = audit_logs.org_id` і `team_members.user_id = auth.uid()`.
- Повторно застосовано `supabase db push` — міграція проходить успішно.

## Що покращило
- Відновлено застосовність міграції в проді без ручних SQL-патчів.
- RLS-політика audit_logs тепер відповідає фактичній RBAC-моделі проєкту.
- Створено базу для стабільного запису/читання lifecycle audit trail.
