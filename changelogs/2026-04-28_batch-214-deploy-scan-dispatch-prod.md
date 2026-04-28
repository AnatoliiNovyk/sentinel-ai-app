# Batch 214: Прод-деплой scan-dispatch edge function

## Як було
- Локально фікс `scan-dispatch` був внесений, але на проді (`sentinelia.online`) могла працювати стара версія функції.
- Через це помилка запуску скану могла повторюватися попри локальні правки.

## Що зроблено
- Перевірено Supabase CLI: `supabase --version` -> встановлено (2.67.1).
- Перевірено прив'язку проєкту: `supabase projects list` -> активний проєкт `sentinel-ai-db` (`ysnlccidbtqqburuflkz`).
- Виконано деплой edge function у хмару: `supabase functions deploy scan-dispatch`.

## Що покращило/виправило/додало
- Прод-середовище отримало актуальний код `scan-dispatch`.
- Локальні фікси перестали бути "тільки в репо" і застосовані для реального домену.
- Попередження про Docker не блокувало cloud deploy і не вплинуло на результат.
