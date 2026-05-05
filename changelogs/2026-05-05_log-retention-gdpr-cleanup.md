# Changelog: GDPR/SOC2 Log Retention (Data Cleanup)

**Дата:** 2026-05-05  
**Батч:** Phase 3 — Data retention / GDPR compliance

---

## Як було

- `agent_logs` та `audit_logs` накопичувалися необмежено — немає автоматичного видалення
- Відсутня будь-яка GDPR/SOC2 data retention policy в системі
- Ні функції БД, ні механізму в агенті для очищення старих записів

## Що зроблено

1. **SQL міграція** `20260505120000_add_log_retention_cleanup.sql` — нова PostgreSQL функція:
   - `public.cleanup_old_logs(retention_days int DEFAULT 90)`
   - Видаляє рядки з `agent_logs` та `audit_logs` старіші за `retention_days`
   - `SECURITY DEFINER` — виконується з правами creator
   - `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO service_role` — виклик тільки через service role
   - Повертає JSON: `{ retention_days, cutoff, agent_logs_deleted, audit_logs_deleted, total_deleted }`

2. **Агент** `sentinel-agent/src/index.ts`:
   - Нові константи: `LOG_RETENTION_DAYS` (default 90), `LOG_CLEANUP_INTERVAL_MS` (default 24h)
   - Watchdog loop: раз на 24 год викликає `supabase.rpc('cleanup_old_logs', { retention_days })`
   - Логування результату: якщо `total_deleted > 0` — виводить детальний звіт
   - Graceful error: збій cleanup не крашить агент — тільки `console.warn`

3. **Prometheus метрики** (у `/metrics`):
   - `sentinel_log_cleanup_runs_total` — лічильник запусків cleanup
   - `sentinel_log_cleanup_last_deleted_total` — кількість видалених рядків за останній запуск
   - `sentinel_log_cleanup_last_run_timestamp_seconds` — Unix timestamp останнього запуску

4. **Міграція застосована** до remote Supabase (перевірено: `cleanup_old_logs(90)` → `OK`, `total_deleted=0`)

## Що покращило / виправило / додало

- ✅ GDPR compliance: персональні дані в логах автоматично видаляються через 90 днів
- ✅ SOC2: є задокументований retention policy з автоматичним виконанням
- ✅ БД не буде необмежено рости від `agent_logs` (кожен scan пише 3-5 рядків)
- ✅ Налаштовується без перекомпіляції: `LOG_RETENTION_DAYS=30` в `.env`
- ✅ Prometheus дозволяє alerting якщо cleanup не запускався > 25 год
