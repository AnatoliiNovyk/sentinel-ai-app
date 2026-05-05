# Changelog: Prowler / Amass / AWS Creds / Timeout Fix

**Дата:** 2026-05-05  
**Батч:** Prowler+Amass stabilization

---

## Як було

- `runProwler()` використовував застарілий аргумент `-M json`, який не підтримується Prowler v5 → сканування падало з помилкою
- При відсутності AWS credentials (`NoCredentialsError`) job переходив у статус `error` та крашився
- Таймаут `execFile` був захардкоджений: 5 хвилин — недостатньо для реального сканування AWS
- `runAmass()` включав ANSI escape-коди (прогрес-бар) у текст повідомлення про помилку в БД
- У `.env.example` не було змінних для AWS credentials та `PROWLER_TIMEOUT_MS`

## Що зроблено

1. **Prowler CLI args** — змінено з `-M json` на `--output-formats json-ocsf --no-banner --no-color --ignore-exit-code-3 --only-logs`
2. **NoCredentialsError** — замість краша повертає `info`-finding: `"No AWS credentials configured"`
3. **PROWLER_TIMEOUT_MS** — таймаут читається з env (`parseInt(process.env.PROWLER_TIMEOUT_MS ?? '1200000')`), default = 20 хв
4. **Partial stdout capture** — при ненульовому exit-коді намагається розпарсити JSON з stdout (partial findings)
5. **Amass ANSI cleanup** — ANSI escape-коди стрипуються з `stderr` перед записом в `error_message`
6. **`.env.example`** — додано `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `PROWLER_TIMEOUT_MS`
7. **VPS `.env`** — вручну встановлено AWS credentials на сервері `192.168.10.80`

## Що покращило / виправило / додало

- ✅ Prowler сканування тепер успішно завершується (підтверджено: job `0273cfc0`, ~8 хв, `status=done`)
- ✅ Відсутність AWS credentials більше не крашить job — повертає зрозумілий info-finding
- ✅ Довгі AWS scans (> 5 хв) не перериваються таймаутом
- ✅ `error_message` в БД більше не містить сміттєвих ANSI символів
- ✅ Документація `.env.example` актуальна для нових розгортань
