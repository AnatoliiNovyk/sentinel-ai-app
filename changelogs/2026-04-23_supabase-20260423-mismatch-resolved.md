# Зміни від 2026-04-23: Вирішення розсинхрону міграції 20260423

## Як було
- Після застосування міграцій виник orphan-запис `20260423` у remote migration history.
- Через це `supabase db push --dry-run` падав з помилкою: `Remote migration versions not found in local migrations directory`.
- Міграційний журнал був у неузгодженому стані (одночасно локальний та remote запис для різних версій 20260423*).

## Що зроблено
- Виконано repair orphan-версії: `supabase migration repair --status reverted 20260423`.
- Перевірено узгодженість через `supabase migration list`.
- Запущено `supabase db push --dry-run` і `supabase db push`.
- Підтверджено, що база у стані `Remote database is up to date`.

## Що покращило/виправило/додало
- Прибрано блокер міграційного пайплайна Supabase.
- Відновлено нормальну роботу `db push` без ручних обхідних маневрів.
- Зафіксовано стабільний стан migration history для подальших релізів.
