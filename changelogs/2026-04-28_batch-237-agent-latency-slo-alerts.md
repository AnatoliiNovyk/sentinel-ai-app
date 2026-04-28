# Batch 237: Agent latency SLO alerts

## Як було
- В агенті були latency-метрики (`claim/execute/report/end-to-end`), але не було автоматичних operational alert-ів при деградації середніх значень.
- Діагностика деградації вимагала ручного перегляду `/metrics`.

## Що зроблено
- У `sentinel-agent/src/index.ts` додано конфігурацію SLO через env:
  - `OPERATIONAL_ALERT_WEBHOOK_URL`
  - `SLO_CLAIM_AVG_MS_THRESHOLD`
  - `SLO_EXECUTE_AVG_MS_THRESHOLD`
  - `SLO_REPORT_AVG_MS_THRESHOLD`
  - `SLO_END_TO_END_AVG_MS_THRESHOLD`
  - `SLO_MIN_SAMPLE_COUNT`
  - `SLO_ALERT_COOLDOWN_MS`
- Додано `maybeSendLatencySloAlert()`:
  - оцінює average latency по 4 етапах;
  - тригерить alert тільки після `SLO_MIN_SAMPLE_COUNT`;
  - агрегує порушення в один payload `agent_latency_slo_breach`;
  - відправляє в `OPERATIONAL_ALERT_WEBHOOK_URL`;
  - застосовує cooldown для захисту від alert-spam.
- Перевірку SLO інтегровано у watchdog cadence в main loop.
- Розширено `/metrics` новими сигналами:
  - `sentinel_slo_alerts_total`
  - `sentinel_slo_alerts_suppressed_total`
  - `sentinel_slo_alert_last_timestamp_seconds`
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (P3 progress).

## Що покращило
- Деградація latency тепер детектиться автоматично, без ручного моніторингу.
- Зменшено час виявлення проблем queue/scan pipeline.
- Захист від noisy alert-ів завдяки min-samples і cooldown.
