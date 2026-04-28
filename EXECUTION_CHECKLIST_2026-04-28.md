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
- [x] Додано latency-метрики `claim/execute/report/end-to-end` у `/metrics` агента (`sentinel-agent/src/index.ts`).
- [x] Додано гарантію інсталяції `nmap` у provisioning/deploy, щоб уникати runtime помилки `nmap is not installed` (`sentinel-agent/setup-vps.sh`, `.github/workflows/deploy-agent.yml`).

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

## P3 прогрес
- [x] Release smoke CI gate переведено на режим очікування термінального статусу scan (`-WaitForCompletion`) з fail-fast при `queued/pending/running` (`.github/workflows/ci.yml`).
- [x] Додано SLO-алерти на latency-метрики агента (`claim/execute/report/end-to-end`) через `OPERATIONAL_ALERT_WEBHOOK_URL` з cooldown та min-samples (`sentinel-agent/src/index.ts`).
- [x] Додано incident runbook і triage/recovery скрипт для stuck scans/jobs (`RUNBOOK_SCAN_PIPELINE_INCIDENTS.md`, `scripts/triage-stuck-scans.ps1`).
- [x] Додано щоденний automated health-report workflow + скрипт з опційною відправкою у webhook (`.github/workflows/daily-scan-health-report.yml`, `scripts/daily-queue-health-report.ps1`).
- [x] Додано контрактні тести для ops-скриптів з mock HTTP і підключено їх у CI (`scripts/test-ops-scripts.cjs`, `.github/workflows/ci.yml`).
- [x] Додано scheduled safe cleanup workflow для stale `running` jobs з порогом і webhook-звітом (`scripts/scheduled-stale-cleanup.ps1`, `.github/workflows/scheduled-stale-cleanup.yml`).
- [x] Посилено scheduled workflows: додано `concurrency`/`timeout-minutes` і ручні параметри `workflow_dispatch` для stale cleanup (`.github/workflows/scheduled-stale-cleanup.yml`, `.github/workflows/daily-scan-health-report.yml`).
- [x] Додано threshold-based gating у daily health-report (max stale jobs + max error rate) з optional fail-mode та workflow inputs (`scripts/daily-queue-health-report.ps1`, `.github/workflows/daily-scan-health-report.yml`).
- [x] Додано automated incident escalation для daily threshold breaches з retry/backoff, severity та workflow-політикою fail/escalate (`scripts/escalate-daily-health-breach.ps1`, `.github/workflows/daily-scan-health-report.yml`, `scripts/test-ops-scripts.cjs`).
- [x] Додано trend-based gating для spike error-rate (порівняння current day vs baseline попередніх днів) з порогом і fail-політикою (`scripts/daily-queue-health-report.ps1`, `.github/workflows/daily-scan-health-report.yml`, `scripts/test-ops-scripts.cjs`).
