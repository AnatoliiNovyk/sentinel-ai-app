# Batch 211: Прибрано повторний Unknown error при старті скану

## Як було
- При провалі запуску скану UI інколи показував `Failed to start scan: Unknown error`.
- Причина: частина помилок від Supabase приходила як plain object, а не як `Error`, тому старий `instanceof Error`-catch втрачав текст.

## Що зроблено
- У [src/api/scans.service.ts](src/api/scans.service.ts):
  - посилено нормалізацію помилок `getFunctionErrorMessage` для non-Error об'єктів;
  - додано витяг ключових полів: `message`, `error_description`, `error`, `details`, `hint`;
  - `scanErr` після insert тепер завжди обгортається в `Error` з нормалізованим повідомленням;
  - параметр `orgId` зроблено nullable/optional у сигнатурі сервісу.
- У [src/pages/Scans.tsx](src/pages/Scans.tsx):
  - додано `toReadableErrorMessage` для page-level catch;
  - fallback текст замінено на інформативний і стабільний.

## Що покращило/виправило/додало
- Toast при провалі старту скану тепер показує причину значно частіше замість `Unknown error`.
- Користувач отримує діагностику по реальній причині (RLS, валідація, edge error, policy/constraint).
- Перевірено: lint/build проходять успішно.
