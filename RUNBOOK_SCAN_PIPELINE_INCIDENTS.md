# Runbook: Scan Pipeline Incident Response

## Scope

Цей runbook описує оперативні дії для інцидентів у scan pipeline:
- stuck scans/jobs (`queued`, `pending`, `running`)
- деградація latency (`claim/execute/report/end-to-end`)
- масові помилки репортингу результатів

## Sources of Truth

- Agent health/metrics: `http://<agent-host>:9090/health`, `http://<agent-host>:9090/metrics`
- Supabase таблиці: `scans`, `scan_jobs`, `agent_logs`
- Recovery RPC: `public.cleanup_stale_running_jobs(timeout_minutes)`
- CI smoke gate: `.github/workflows/ci.yml` (`smoke-e2e-release`)

## Triage Flow (15 хв)

1. Перевірити доступність агента
- `systemctl status sentinel-agent --no-pager`
- `journalctl -u sentinel-agent -n 120 --no-pager`
- `curl -fsS http://127.0.0.1:9090/health`
- `curl -fsS http://127.0.0.1:9090/metrics`

2. Перевірити queue backlog
- кількість `scans` у `running`/`queued`
- кількість `scan_jobs` у `pending`/`running`
- наявність повторюваних `error_message` в `scan_jobs`

3. Перевірити latency/SLO сигнали
- `sentinel_claim_duration_ms_avg`
- `sentinel_execute_duration_ms_avg`
- `sentinel_report_duration_ms_avg`
- `sentinel_end_to_end_duration_ms_avg`
- `sentinel_slo_alerts_total`, `sentinel_slo_alerts_suppressed_total`

4. Визначити тип інциденту
- Agent down/unreachable
- Queue stuck without progress
- External dependency errors (nmap/nuclei/network)
- Report callback degradation

## Recovery Playbooks

### A) Agent unreachable

1. Перезапустити сервіс: `sudo systemctl restart sentinel-agent`
2. Перевірити health/metrics readiness
3. Якщо не стартує: перевірити `node_modules`, `.env`, permissions, journal stacktrace

### B) Stuck running jobs/scans

1. Запустити dry-run triage:
- `powershell -ExecutionPolicy Bypass -File scripts/triage-stuck-scans.ps1 -TimeoutMinutes 15 -MaxScans 50`

2. Якщо є stale записи, застосувати cleanup RPC:
- `powershell -ExecutionPolicy Bypass -File scripts/triage-stuck-scans.ps1 -TimeoutMinutes 15 -MaxScans 50 -ApplyCleanup`

3. Повторно перевірити статуси через 1-2 хв

### C) Latency SLO breach

1. Перевірити `sentinel_*_duration_ms_avg` і sample count
2. Перевірити `claim_next_job` / DB latency / edge function latency
3. Якщо breach стабільний:
- масштабувати/стабілізувати агент
- зменшити навантаження (тимчасово)
- перевірити rate-limit або upstream network issues

### D) Report callback failures

1. Перевірити `sentinel_report_failures_total`, `sentinel_report_retries_total`
2. Перевірити доступність `scan-result` function
3. Перевірити `AGENT_SECRET`, service role key, timeout/network

## Verification Checklist (Exit Criteria)

- Agent `/health` = `status: ok`
- Немає зростаючого backlog у `pending/running` без прогресу
- `cleanup_stale_running_jobs` повертає `jobs_updated=0` при повторному запуску
- `smoke-pipeline-safe.ps1 -WaitForCompletion` проходить до термінального стану
- Немає нових повторюваних критичних помилок у `agent_logs`

## Prevention / Hardening

- Тримати `OPERATIONAL_ALERT_WEBHOOK_URL` увімкненим
- Перевіряти `SLO_*` пороги щотижня
- Не вимикати post-deploy runtime checks у deploy workflow
- Виконувати регулярний smoke після ключових релізів
