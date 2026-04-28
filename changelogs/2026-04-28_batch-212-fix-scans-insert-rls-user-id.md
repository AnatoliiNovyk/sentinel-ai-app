# Batch 212: Fix RLS block on scan start (user_id in insert)

## Як було
- При старті скану UI показував: `new row violates row-level security policy for table "scans"`.
- Причина: політика вставки на `scans` вимагає `auth.uid() = user_id`, але у frontend insert `user_id` не передавався.

## Що зроблено
- У [src/api/scans.service.ts](src/api/scans.service.ts):
  - перед вставкою додано `supabase.auth.getUser()`;
  - в payload вставки `scans` додано `user_id: authData.user.id`;
  - додано явну помилку для неавторизованого стану (`Authentication required to start scan...`).

## Що покращило/виправило/додало
- Старт скану більше не має впиратися в RLS-помилку через відсутній `user_id`.
- Повідомлення про auth-проблему стало явним і діагностичним.
- Якість перевірена: lint/build проходять успішно.
