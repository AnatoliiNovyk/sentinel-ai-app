# Changelog: OpenTelemetry Distributed Tracing

**Дата:** 2026-05-05  
**Файли змінено:** `sentinel-agent/src/index.ts`, `sentinel-agent/package.json`, `sentinel-agent/.env.example`, `supabase/migrations/20260505140000_add_trace_id_to_agent_logs.sql`

---

## Як було

- `runJob()` виконував сканери без будь-якого трасування
- Таблиця `agent_logs` не мала полів для кореляції з distributed tracing
- Неможливо відстежити шлях виконання job-а через observability-платформу (Jaeger, Grafana Tempo тощо)
- Логи та помилки не були прив'язані до конкретного trace/span

---

## Що зроблено

### 1. npm пакети
Додано 3 нові dependency у `sentinel-agent/package.json`:
- `@opentelemetry/api` — публічний API для трасування
- `@opentelemetry/sdk-node` — Node.js SDK (NodeSDK, BatchSpanProcessor)
- `@opentelemetry/exporter-trace-otlp-http` — OTLP HTTP-екпортер (Jaeger/Grafana Tempo)

Встановлено локально + на VPS (`npm install --production`).

### 2. SQL міграція (`20260505140000_add_trace_id_to_agent_logs.sql`)
```sql
ALTER TABLE public.agent_logs
  ADD COLUMN IF NOT EXISTS trace_id text,
  ADD COLUMN IF NOT EXISTS span_id text;

CREATE INDEX IF NOT EXISTS idx_agent_logs_trace_id
  ON agent_logs(trace_id) WHERE trace_id IS NOT NULL;
```
Застосовано через `supabase db push --linked --yes`.

### 3. `initOpenTelemetry()` в `sentinel-agent/src/index.ts`
- Opt-in через `OTEL_ENABLED=true` env-змінну
- Динамічно завантажує `NodeSDK` та `OTLPTraceExporter`
- OTLP endpoint: `OTEL_EXPORTER_OTLP_ENDPOINT` (default: `http://localhost:4318`)
- Service name: `OTEL_SERVICE_NAME` (default: `sentinel-agent`)
- Graceful fallback якщо OTel вимкнено (no-op tracer)
- Викликається перед `main()`

### 4. Трасування кожного job у `runJob()`
```typescript
await otelTracer.startActiveSpan(`scan.${job.scanner}`, {
  kind: SpanKind.INTERNAL,
  attributes: {
    'job.id': job.id,
    'job.scanner': job.scanner,
    'job.target': job.target,
    'job.scan_id': job.scan_id,
    'job.project': job.project_id,
  }
}, async (span) => {
  // ... сканування
  span.setAttribute('job.findings_total', findings.length);
  span.setAttribute('job.findings_real', realFindings);
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
});
```
- `span.recordException(err)` + `SpanStatusCode.ERROR` у catch
- `span.end()` у finally (завжди)

### 5. `writeLog()` з trace correlation
- Приймає опціональні `traceId?` та `spanId?`
- Зберігає у `agent_logs.trace_id` / `agent_logs.span_id`

### 6. `.env.example` оновлено
```
OTEL_ENABLED=false
OTEL_SERVICE_NAME=sentinel-agent
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

---

## Що покращило / виправило / додало

- **Distributed tracing**: кожен scan job тепер генерує trace/span — можна переглядати у Jaeger, Grafana Tempo, Zipkin або будь-якому OTLP-сумісному бекенді
- **Кореляція логів**: логи в `agent_logs` прив'язані до `trace_id` → можна фільтрувати всі події конкретного job-а за одним ID
- **Observability-ready**: при увімкненні `OTEL_ENABLED=true` + налаштуванні `OTEL_EXPORTER_OTLP_ENDPOINT` агент починає надсилати tracing дані без перезапуску коду
- **Zero-overhead когда disabled**: при `OTEL_ENABLED=false` використовується no-op tracer, overhead = 0
- **Error tracking**: виключення автоматично записуються в span через `span.recordException()` та позначаються статусом `ERROR`
- **VPS**: сервіс `active`, запускається успішно, лог: `ℹ️ OpenTelemetry disabled (set OTEL_ENABLED=true to enable)` + `🚀 Agent loop started`
