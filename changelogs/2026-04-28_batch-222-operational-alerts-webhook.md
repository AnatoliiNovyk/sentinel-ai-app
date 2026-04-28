# Batch 222: Operational alerts webhook для lifecycle збоїв

## Як було
- Події `scan_failed` та `rate_limit_exceeded` логувались локально (agent_logs/audit_logs), але не мали зовнішнього push-сигналу в канал реагування.
- Через це не було оперативного оповіщення без ручного моніторингу панелі.

## Що зроблено
- У `supabase/functions/scan-dispatch/index.ts` додано non-blocking webhook helper `sendOperationalAlert`.
- Додано алерти в dispatch flow:
  - `rate_limit_exceeded` при 429;
  - `scan_dispatch_failed` у catch-path.
- У `supabase/functions/scan-result/index.ts` додано non-blocking webhook helper `sendOperationalAlert`.
- Додано алерт `scan_failed` при обробці `error_message`.
- Джерело webhook URL: env `OPERATIONAL_ALERT_WEBHOOK_URL`.
- Поведінка безпечна: при відсутньому URL або помилці відправки основний pipeline не блокується.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`: P1.3 позначено виконаним.

## Що покращило
- З'явився базовий зовнішній канал оповіщення для критичних operational подій.
- Скорочено час реакції на `scan_failed`/rate-limit інциденти.
- Не змінено публічний контракт edge API і не додано блокуючих залежностей у flow.
