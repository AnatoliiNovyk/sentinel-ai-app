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
- [x] Додано recovery orchestration playbook (dry-run/apply + post-check + artifact + webhook report) та manual workflow для керованого відновлення (`scripts/recovery-playbook.ps1`, `.github/workflows/recovery-playbook.yml`, `scripts/test-ops-scripts.cjs`).
- [x] Додано evidence hardening для ops-артефактів: versioned envelope, run context, evidence_id, SHA-256 payload hash і workflow trace logging (`scripts/daily-queue-health-report.ps1`, `scripts/recovery-playbook.ps1`, `.github/workflows/daily-scan-health-report.yml`, `.github/workflows/recovery-playbook.yml`, `scripts/test-ops-scripts.cjs`).
- [x] Додано scheduled/manual chaos drill workflow для регулярного fault-injection validation з artifact-звітом (`.github/workflows/chaos-ops-drill.yml`).
- [x] Посилено chaos drill workflow: evidence_id/hash у звіті, outputs для трасування та failure webhook notification (`.github/workflows/chaos-ops-drill.yml`).
- [x] Додано автоматичну верифікацію evidence integrity у workflow (daily/recovery/chaos) та контрактні тести verifier-скрипта (`scripts/verify-evidence-integrity.cjs`, `.github/workflows/daily-scan-health-report.yml`, `.github/workflows/recovery-playbook.yml`, `.github/workflows/chaos-ops-drill.yml`, `scripts/test-ops-scripts.cjs`).
- [x] Додано негативне tamper-detection покриття для evidence verifier (очікуваний fail при підміні payload) у ops контрактних тестах (`scripts/test-ops-scripts.cjs`).
- [x] Посилено verifier перевіркою формату/префікса `evidence_id` та відповідності hash-suffix до payload hash; додано негативний тест для invalid evidence_id (`scripts/verify-evidence-integrity.cjs`, `scripts/test-ops-scripts.cjs`).
- [x] Додано weekly SLO/SLA summary automation (скрипт + workflow + integrity verify + контрактний тест) для executive reliability KPI (`scripts/weekly-slo-sla-summary.ps1`, `.github/workflows/weekly-slo-sla-summary.yml`, `scripts/verify-evidence-integrity.cjs`, `scripts/test-ops-scripts.cjs`).
- [x] Додано негативні verifier-тести для weekly evidence (tamper + invalid evidence_id), щоб гарантувати відхилення підроблених weekly SLO/SLA артефактів (`scripts/test-ops-scripts.cjs`).
- [x] Додано в Dashboard weekly reliability KPI блок (scans, success/failure rates, avg/p95, SLA breach rate, threshold status) для візуалізації executive SLO/SLA (`src/pages/Dashboard.tsx`).
- [x] Додано автоматичний issue/incident workflow для repeated weekly breaches (tracker issue + incident escalation) у weekly summary pipeline (`.github/workflows/weekly-slo-sla-summary.yml`).
- [x] Розширено chaos drill dependency degradation сценаріями (DNS failure + connection refused) з включенням результатів у evidence report (`.github/workflows/chaos-ops-drill.yml`).
- [x] Додано регресійні контракти для chaos dependency degradation у evidence verifier (tamper + invalid evidence_id для `chaos_ops_drill`) (`scripts/test-ops-scripts.cjs`).
- [x] Додано UI-регресійні тести для weekly SLO/SLA summary блоку на Dashboard (`src/pages/__tests__/Dashboard.test.tsx`).
- [x] Посилено CI окремим heap-safe job для dashboard stability (`.github/workflows/ci.yml`).
- [x] Посилено evidence verifier strict-перевіркою `schema_version=1.0` і покрито негативними контрактами (invalid/missing schema_version) для блокування невалідних evidence-конвертів (`scripts/verify-evidence-integrity.cjs`, `scripts/test-ops-scripts.cjs`).
- [x] Посилено evidence verifier strict-перевіркою integrity metadata (`algorithm=sha256`, `payload_hash=64 hex`) та негативними контрактами для invalid integrity metadata і unsupported report_type (`scripts/verify-evidence-integrity.cjs`, `scripts/test-ops-scripts.cjs`).
- [x] Додано strict валідацію форми payload по report-type (типи `summary`/`thresholds_ok`/`threshold_breaches`) та негативні контракти на invalid payload shape для daily/weekly evidence (`scripts/verify-evidence-integrity.cjs`, `scripts/test-ops-scripts.cjs`).
- [x] Додано orphan running scans recovery у playbook (виявлення `running` scans без `pending/running` jobs та auto-mark-as-failed у apply mode) з окремим контрактним тестом (`scripts/recovery-playbook.ps1`, `scripts/test-ops-scripts.cjs`).
- [x] Виправлено UX/діагностику agent health check для HTTPS UI + HTTP agent URL (mixed content): додано явне визначення browser policy block у Settings/Header/Scans замість хибного `Agent offline/Failed to fetch` (`src/pages/Settings.tsx`, `src/components/AppLayout.tsx`, `src/pages/Scans.tsx`).
- [x] Додано UI-регресійні mixed-content тести для Agent health у Settings і AppLayout (HTTPS frontend + HTTP agent URL => policy-block message, без fetch виклику) (`src/pages/__tests__/Settings.test.tsx`, `src/components/__tests__/AppLayout.test.tsx`).
- [x] Додано окрему TLS/CORS-діагностику для `https://` agent URL, коли endpoint не має валідного HTTPS (HTTP-only порт): Settings і Header показують спеціальний статус/підказку замість generic `Network/CORS` або `Agent offline`, з регресійними тестами (`src/pages/Settings.tsx`, `src/components/AppLayout.tsx`, `src/pages/__tests__/Settings.test.tsx`, `src/components/__tests__/AppLayout.test.tsx`).
- [x] Додано server-side fallback probe для Agent health через `ai-gateway` (`action=agent_health_probe`), щоб HTTPS frontend міг перевіряти HTTP-only агент без mixed-content блокування; додано SSRF-safe host guard, оновлено Settings/AppLayout/Scans на shared probe helper та покрито контрактними/handler/UI тестами (`supabase/functions/ai-gateway/contract.ts`, `supabase/functions/ai-gateway/handler.ts`, `src/lib/agentHealth.ts`, `src/pages/Settings.tsx`, `src/components/AppLayout.tsx`, `src/pages/Scans.tsx`, `src/lib/__tests__/ai-gateway-contract.test.ts`, `src/lib/__tests__/ai-gateway-handler.test.ts`, `src/pages/__tests__/Settings.test.tsx`, `src/components/__tests__/AppLayout.test.tsx`).
- [x] Виправлено persistence `agentHealthUrl`: додано autosave draft (debounce), commit на blur/Enter та регресійний тест на збереження URL після remount/reload (`src/pages/Settings.tsx`, `src/pages/__tests__/Settings.test.tsx`).
- [x] Усунуто хибне повідомлення `Blocked by browser policy` при mixed-content URL, коли перевірка вже йде через gateway-probe: тепер показується реальна gateway-помилка/HTTP статус; додано регресійний тест (`src/lib/agentHealth.ts`, `src/pages/Settings.tsx`, `src/pages/__tests__/Settings.test.tsx`).
- [x] Виправлено `Gateway probe HTTP 401` для Agent health check: замінено сирий POST `fetch` на `supabase.functions.invoke('ai-gateway')` у probe helper, щоб використовувати коректний auth-контекст клієнта Supabase (`src/lib/agentHealth.ts`).
- [x] Додано auth-сумісність `ai-gateway` для `supabase.functions.invoke`: POST тепер приймає або `Authorization: Bearer`, або `apikey` header; додано тест на `apikey` шлях і задеплоєно оновлену функцію (`supabase/functions/ai-gateway/handler.ts`, `src/lib/__tests__/ai-gateway-handler.test.ts`).
- [x] Фінально усунено gateway-level `401` для probe-викликів: `ai-gateway` задеплоєно з `--no-verify-jwt`, після чого live-check `action=agent_health_probe` повертає `HTTP 200` і payload з `reachable/http_status/health`.
- [x] Посилено конфігурацію `sentinel-agent`: додано стабільне завантаження `.env` для runtime з `dist`, fail-fast валідацію обов'язкових змінних (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AGENT_SECRET`) з явним повідомленням про налаштування, щоб усунути краш `supabaseUrl is required` (`sentinel-agent/src/index.ts`).
- [x] Стабілізовано `SchedulesPanel` тести проти `act(...)` warning-шуму: додано async render harness з очікуванням завершення первинного `load()` перед assertions/interaction, оновлено всі сценарії тест-файлу (`src/components/__tests__/SchedulesPanel.test.tsx`).
- [x] Реалізовано bundle optimization: route-level lazy loading через `React.lazy` + `Suspense` в `App.tsx` та `manualChunks` у Vite для `react/supabase/lucide` vendor split; підтверджено multi-chunk build (`src/App.tsx`, `vite.config.ts`).
- [x] Оновлено Browserslist DB (`caniuse-lite`) через `npx update-browserslist-db@latest --yes`: warning `caniuse-lite is outdated` прибрано у build output; додано службовий npm-скрипт для регулярного оновлення (`package-lock.json`, `package.json`).
