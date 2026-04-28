# Batch 231: Harden deploy health checks (retry + diagnostics)

## Як було
- Після `systemctl restart sentinel-agent` workflow одразу виконував `curl` на `/health` та `/metrics`.
- Якщо процес ще не встиг підняти HTTP endpoint, deploy падав з `curl: (7) Failed to connect` навіть коли service вже стартував.

## Що зроблено
- У `.github/workflows/deploy-agent.yml` додано retry-loop до 20 секунд для `/health`.
- Додано retry-loop до 20 секунд для `/metrics`.
- При невдачі readiness перевірок workflow тепер виводить `journalctl -u sentinel-agent -n 120` для швидкої діагностики.
- Перевірку метрик розширено: окрім stale counters, додається перевірка latency gauge `sentinel_end_to_end_duration_ms_avg`.

## Що покращило
- Знижено false-negative падіння deploy через race condition після restart.
- Прискорено root-cause аналіз інцидентів у CI логах (service journal доступний одразу в run output).
- Підтверджується наявність як watchdog, так і latency observability метрик після релізу.
