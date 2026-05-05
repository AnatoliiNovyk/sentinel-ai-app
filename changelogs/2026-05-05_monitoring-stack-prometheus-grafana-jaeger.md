# Changelog: Monitoring Stack (Prometheus + Alertmanager + Grafana + Jaeger)

**Дата:** 2026-05-05
**Батч:** Phase 3 — Observability / Monitoring Stack

---

## Як було

- Агент експортував метрики на `:9090/metrics` (Prometheus format), але жодного tooling для їх збору не існувало
- Алерти були реалізовані як вбудований webhook у коді агента (`ALERT_WEBHOOK_URL`), без зовнішньої alerting системи
- Distributed tracing (OTel) вже є в коді, але без Jaeger/Tempo endpoint для прийому span-ів
- Немає централізованого dashboarda для операційного моніторингу

---

## Що зроблено

### Файли у `sentinel-agent/monitoring/`

#### `prometheus.yml`
- Scrape config: `job_name: sentinel-agent` → `192.168.10.80:9090/metrics` кожні 15s
- `external_labels`: `env=production`, `service=sentinel-ai`
- Підключений `alertmanager:9093`
- Підключений `rule_files: alert.rules.yml`

#### `alert.rules.yml` — 10 alerting rules у 5 групах

| Group | Alert | Severity |
|-------|-------|----------|
| availability | `SentinelAgentDown` | critical |
| jobs | `SentinelHighJobFailureRate` | warning |
| jobs | `SentinelNoJobsProcessed` | warning |
| jobs | `SentinelAllJobSlotsBusy` | warning |
| latency | `SentinelHighScanLatency` | warning |
| latency | `SentinelEndToEndLatencySLO` | critical |
| latency | `SentinelFrequentSLOAlerts` | warning |
| reporting | `SentinelHighReportFailures` | critical |
| reporting | `SentinelLowReportSuccessRate` | warning |
| watchdog | `SentinelFrequentStaleJobRecovery` | warning |
| logs | `SentinelLogCleanupStale` | warning |

Inhibit rule: якщо `SentinelAgentDown` — всі інші alerts для цього instance заглушуються.

#### `alertmanager.yml`
- Routing: `critical` → `webhook-critical` (repeat 1h), `warning` → `webhook-default` (repeat 4h)
- Receiver: `http://host.docker.internal:9091/alert` (сумісний з вбудованим webhook агента)
- Коментарі для Slack integration (розкоментувати + вставити webhook URL)

#### `docker-compose.monitoring.yml`
| Сервіс | Image | Port |
|--------|-------|------|
| prometheus | prom/prometheus:v2.51.2 | 9091 |
| alertmanager | prom/alertmanager:v0.27.0 | 9093 |
| grafana | grafana/grafana:10.4.2 | 3000 |
| jaeger | jaegertracing/all-in-one:1.56 | 16686 (UI), 4318 (OTLP HTTP) |

- Grafana credentials: `admin / sentinel`
- Jaeger: приймає OTLP HTTP на `:4318` — агент підключається через `OTEL_EXPORTER_OTLP_ENDPOINT=http://<host>:4318`
- Retention Prometheus: 30d

#### `grafana-dashboard.json`
Повний provisioned dashboard "Sentinel AI Agent" з панелями:
- **Agent Status**: Up/Down, Active Jobs, Jobs Processed, Jobs Failed, Report Failures, Stale Recovered
- **Job Throughput**: jobs/s (processed vs failed), Active Jobs vs max capacity
- **Latency**: Scan execution, End-to-end, Report duration, Claim (DB RPC) duration — avg та last
- **Reporting & SLO**: attempts/success/failures rate, SLO alerts fired/suppressed per hour
- **Log Retention**: cleanup runs, rows deleted, last run timestamp

Auto-refresh: 30s, default range: last 6h.

#### `grafana-provisioning/`
- `datasources/prometheus.yml` — автоматично додає Prometheus datasource
- `dashboards/dashboards.yml` — автоматично завантажує dashboard з файлу

---

## Що покращило / виправило / додало

- ✅ **Prometheus scraping**: метрики агента тепер збираються централізовано з retention 30d
- ✅ **10 alerting rules**: покривають availability, throughput, latency SLO, report reliability, watchdog та log retention
- ✅ **Alertmanager routing**: critical alerts повторюються кожну годину, warning — кожні 4h
- ✅ **Inhibit rule**: при падінні агента не надходить шквал похідних алертів
- ✅ **Grafana dashboard**: zero-config — автоматично провізіонується при запуску stack-у
- ✅ **Jaeger**: OTel spans з агента (при `OTEL_ENABLED=true`) можна переглядати у Jaeger UI `:16686`
- ✅ **Запуск одною командою**: `docker compose -f docker-compose.monitoring.yml up -d`
- ✅ **Slack-ready**: Alertmanager має закоментований Slack config — розкоментувати + вставити webhook

### Для підключення Jaeger до агента на VPS:
```bash
# В /opt/sentinel-agent/.env (на VPS):
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://<monitoring-host>:4318
```
