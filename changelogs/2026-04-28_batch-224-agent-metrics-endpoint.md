# Batch 224: Runtime metrics endpoint для агента

## Як було
- Агент мав health endpoint, але без окремого машинозчитуваного потоку runtime-метрик.
- Для оцінки стабільності доставки результатів бракувало counters для attempts/retries/failures.

## Що зроблено
- У `sentinel-agent/src/index.ts` додано in-memory метрики:
  - `reportAttemptsTotal`
  - `reportRetriesTotal`
  - `reportSuccessTotal`
  - `reportFailuresTotal`
  - `jobClaimErrorsTotal`
- Інтегровано інкременти метрик у ключових точках:
  - спроби/ретраї/успіхи/фейли `reportResult`
  - помилки `claim_next_job` у `fetchPendingJob`
- Додано endpoint `GET /metrics` у форматі Prometheus exposition.
- Розширено `GET /health` полем `metrics` для швидкої JSON-діагностики.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (P2 progress).

## Що покращило
- З'явились базові SLI-сигнали для надійності pipeline доставки результатів.
- Полегшена інтеграція з Prometheus/Grafana або зовнішнім скрапером.
- Прискорено пошук деградацій при зростанні навантаження без зміни бізнес-логіки сканування.
