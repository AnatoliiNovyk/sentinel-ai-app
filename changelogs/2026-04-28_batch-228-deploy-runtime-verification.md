# Batch 228: Post-deploy runtime verification у VPS workflow

## Як було
- Deploy workflow перезапускав `sentinel-agent`, але не перевіряв runtime endpoint-и після рестарту.
- Через це можна було отримати "успішний деплой" без автоматичного підтвердження health/metrics.

## Що зроблено
- Оновлено `/.github/workflows/deploy-agent.yml`.
- Після `systemctl restart sentinel-agent` додано автоматичні перевірки на VPS:
  - `curl http://127.0.0.1:9090/health`
  - `curl http://127.0.0.1:9090/metrics` з перевіркою на наявність:
    - `sentinel_stale_jobs_recovered_total`
    - `sentinel_stale_scans_recovered_total`
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` (P2 progress).

## Що покращило
- Кожен deploy тепер підтверджує не тільки старт сервісу, а і фактичну доступність runtime endpoint-ів.
- Знижено ризик "хибно зеленого" деплою без живого агента або без потрібних метрик watchdog.
- Прискорено операційну діагностику після релізу.
