# 2026-05-04 — Встановлення tfsec на VPS і успішний Tfsec smoke

## Як було
- Після деплою агента роутинг `Tfsec` вже працював коректно, але скан завершувався помилкою.
- Причина в `scan_jobs.error_message`: `tfsec is not installed...`.

## Що зроблено
- На VPS (`192.168.10.80`) встановлено `tfsec` під `sudo`.
- Підтверджено встановлення: `tfsec --version` -> `v1.28.14`.
- Запущено новий контрольний Tfsec scan через `scan-dispatch`:
  - `scan_id`: `388b351f-0ef4-40b8-806e-66e138019880`
  - `job_id`: `c395169f-cbf3-44b9-8ed6-6ae87db04f94`
- Перевірено підсумковий стан:
  - `scans.status = completed`
  - `scan_jobs.status = done`
  - `scan_jobs.error_message = null`
  - знайдено `1` запис у `vulnerabilities`.

## Що покращило/виправило/додало
- Усунуто операційну причину падіння Tfsec-сканів на VPS (відсутній бінарник).
- Підтверджено повний end-to-end цикл для `Tfsec`: dispatch -> execution -> report -> completed.
- Система тепер обробляє `Tfsec` не лише коректно за роутингом, а й успішно виконує сам скан.
