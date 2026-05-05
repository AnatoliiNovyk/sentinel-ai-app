Як було:
- Sentinel agent завершувався по SIGTERM без очікування завершення OTel shutdown, через що spans могли втрачатися до flush у Jaeger.
- На VPS systemd unit для agent не мав явного TimeoutStopSec.
- Monitoring compose на VPS ще містив стару версію файлу з obsolete `version:`.
- Стан пароля Grafana був неочевидний.

Що зроблено:
- У sentinel-agent/src/index.ts змінено shutdown handler для OTel: агент чекає `sdk.shutdown()`, після чого завершується через `process.exit(0)`; додано fallback timeout на 5 секунд.
- Агент перебілджено та задеплоєно на VPS.
- На VPS оновлено systemd unit для sentinel-agent і додано `TimeoutStopSec=15`.
- На VPS синхронізовано `docker-compose.monitoring.yml` без `version:` і повторно застосовано monitoring stack.
- Виконано E2E перевірку: новий trace успішно з'явився в Jaeger для сервісу `sentinel-agent`.
- Перевірено Grafana auth: актуальний логін уже `admin/sentinel`.

Що покращило/виправило/додало:
- Traces агента більше не губляться при штатному завершенні процесу.
- Jaeger тепер приймає і відображає бойові trace spans від sentinel-agent.
- Конфіг systemd став безпечнішим для graceful shutdown.
- Monitoring compose на VPS синхронізований з локальним файлом без застарілого `version:`.
- Підтверджено робочі креденшали Grafana: `admin/sentinel`.