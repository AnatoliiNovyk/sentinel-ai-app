# Batch 229: DB safety-net RPC для stale running cleanup

## Як було
- Автовідновлення stale `running` вже було в агенті (watchdog), але не існувало незалежного fallback на рівні БД.
- При недоступності агента cleanup потребував ручних REST/SQL дій.

## Що зроблено
- Додано нову міграцію: `supabase/migrations/20260428193000_add_cleanup_stale_running_jobs_rpc.sql`.
- Створено RPC-функцію `public.cleanup_stale_running_jobs(timeout_minutes integer DEFAULT 180)`:
  - знаходить `scan_jobs` у `running`, старші за TTL;
  - переводить їх у `error` з `error_message` та `completed_at`;
  - переводить пов’язані `scans` у `failed`, якщо активних `running` jobs більше немає.
- Функція повертає JSON-підсумок (`jobs_updated`, `scans_updated`, `cutoff`, `timeout_minutes`).
- Обмежено доступ: `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE ... TO service_role`.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (P2 progress).

## Що покращило
- З’явився DB-level safety-net для stale `running`, незалежний від стану агента.
- Скорочено час відновлення після інцидентів, коли агент тимчасово недоступний.
- Підвищено операційну керованість cleanup-процесу через детермінований RPC.
