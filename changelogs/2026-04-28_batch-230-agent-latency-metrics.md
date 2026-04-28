# Batch 230: Latency metrics для scan pipeline в агенті

## Як було
- У `/metrics` були базові counters (attempts/retries/failures), але не було latency-сигналів по ключових етапах pipeline.
- Через це складно оцінити, де саме росте затримка: claim, execution чи report.

## Що зроблено
- У `sentinel-agent/src/index.ts` додано збір тривалостей і агрегатів для:
  - `claim_next_job` RPC
  - scan execution
  - result reporting (`scan-result` callback)
  - end-to-end job processing
- `reportResult` переведено на структурований результат (`ReportResultOutcome`) з `durationMs` та `attempts`.
- Додано helper `recordDurationMetric(...)` для уніфікованого оновлення `last/sum/samples`.
- Розширено `/metrics` endpoint (Prometheus format) новими gauge-метриками:
  - `sentinel_claim_duration_ms_last`
  - `sentinel_claim_duration_ms_avg`
  - `sentinel_execute_duration_ms_last`
  - `sentinel_execute_duration_ms_avg`
  - `sentinel_report_duration_ms_last`
  - `sentinel_report_duration_ms_avg`
  - `sentinel_end_to_end_duration_ms_last`
  - `sentinel_end_to_end_duration_ms_avg`
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (P2 progress).

## Що покращило
- З’явилися прямі latency SLI-сигнали по всьому шляху scan pipeline.
- Спрощено пошук вузьких місць (queue claim vs scanner execution vs result callback).
- Створено основу для SLO/MTTR порогів і подальших alert policy.
