# Batch 245: Trend-based gating for daily health report

## Як було
- Daily thresholds оцінювали лише абсолютні метрики за вікно (`stale jobs`, `error job rate`).
- Не було автоматичного контролю стрибка error-rate відносно попереднього тренду.

## Що зроблено
- Оновлено `scripts/daily-queue-health-report.ps1`:
  - додано параметри `TrendDays` і `MaxErrorRateTrendSpikePercent`;
  - додано трендову модель: денний `error_job_rate_percent` за останні `TrendDays`;
  - додано baseline average (усі попередні дні) vs current day;
  - додано breach типу `error_rate_trend_spike_percent`, якщо spike перевищує поріг;
  - трендові поля додано в `summary.trend`.
- Оновлено `.github/workflows/daily-scan-health-report.yml`:
  - додано `workflow_dispatch` inputs для trend-порогів;
  - значення передаються в `daily-queue-health-report.ps1`.
- Оновлено `scripts/test-ops-scripts.cjs`:
  - додано асерти на трендові поля у daily report;
  - додано тест fail-сценарію при trend spike breach.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`.

## Що покращило
- Гейтинг враховує не лише абсолютне значення помилок, а й раптову деградацію відносно базового тренду.
- Зменшено ризик пропуску інцидентів, коли абсолютні пороги ще не перевищено, але динаміка вже аномальна.
- Додано контрактне підтвердження стабільності trend-based логіки.
