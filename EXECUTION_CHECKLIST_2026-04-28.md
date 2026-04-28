# Execution Checklist — 2026-04-28

## Підготовка
- [x] Визначено P0 scope для стабілізації scan pipeline.
- [x] Перевірено цільові файли edge functions.
- [x] Підтверджено наявність `agent_logs` у схемі.

## P0 імплементація
- [x] Додано helper `insertAgentLog` у `supabase/functions/scan-dispatch/index.ts`.
- [x] Додано lifecycle-логи в dispatch flow (`accepted`, `rate-limited`, `queued`, `failed`).
- [x] Додано helper `insertAgentLog` у `supabase/functions/scan-result/index.ts`.
- [x] Додано lifecycle-логи в result flow (`received`, `scan failed`, `chat completed`, `scan completed`).
- [x] Переконанося, що logging не блокує основний flow.

## P1 імплементація
- [x] Додано retry/backoff policy для transient error path у результатах агента (`sentinel-agent/src/index.ts`).
- [x] Додано audit trail подій scan lifecycle у `audit_logs` через `AuditService`.
- [x] Введено базові operational алерти (Slack/Teams webhook) по `scan_failed`/rate-limit spikes.
- [x] Додано smoke e2e чек у release workflow для запуску одного реального скану.

## P2 прогрес
- [x] Додано базові runtime-метрики агента та endpoint `/metrics` для observability (`sentinel-agent/src/index.ts`).
- [x] Додано adaptive polling backoff із jitter для `claim_next_job` помилок (`sentinel-agent/src/index.ts`).
- [x] Додано stale-running watchdog з auto-recovery для `scan_jobs`/`scans` (`sentinel-agent/src/index.ts`).
- [x] Додано post-deploy runtime перевірку `/health` + `/metrics` у VPS workflow (`.github/workflows/deploy-agent.yml`).
- [x] Додано DB-level safety-net RPC `cleanup_stale_running_jobs(timeout_minutes)` для stale `running` (`supabase/migrations/20260428193000_add_cleanup_stale_running_jobs_rpc.sql`).

## Валідація
- [x] Запустити `npm run lint -- --max-warnings=0`.
- [x] Запустити `npm run build`.

## Деплой
- [x] Deploy `scan-dispatch`.
- [x] Deploy `scan-result`.

## Пост-деплой smoke
- [x] Запустити `Launch Scan` у проді та перевірити відсутність регресій.
- [x] Підтвердити появу lifecycle-log записів у `agent_logs`.

## Артефакти
- [x] Додано changelog поточного батчу у `changelogs/`.
