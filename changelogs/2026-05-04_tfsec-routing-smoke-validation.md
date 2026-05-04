# 2026-05-04 — Smoke валідація Tfsec роутингу після VPS-деплою

## Як було
- До деплою фікса case-insensitive назви сканера (`Tfsec`/`Amass`/`Prowler`) могли оброблятися некоректно.
- Була потреба підтвердити не лише health агента, а й фактичний роутинг job у правильний executor.

## Що зроблено
- Створено контрольний scan через Supabase API:
  - `scan_id`: `a5f5339c-0704-40e3-9f85-ea9daebef1a2`
  - `job_id`: `7498be01-cd56-43d6-b82d-d4308f993fcf`
  - `scanner`: `Tfsec`
  - `target`: `/opt/sentinel-agent-repo/sentinel-agent`
- Перевірено підсумковий стан:
  - `scans.status = failed`
  - `scan_jobs.status = error`
  - `scan_jobs.error_message = tfsec is not installed...`
- Перевірено agent logs для цього scan:
  - `▶️ Starting Tfsec scan ...`
  - `🏗️ Running tfsec IaC analysis...`
  - `❌ Scan failed: tfsec is not installed...`
- Перевірено `/health` після виконання: агент живий, `jobsProcessed` інкрементується.

## Що покращило/виправило/додало
- Підтверджено, що після деплою назва `Tfsec` маршрутизується саме в `runTfsec`, а не у fallback-гілку іншого сканера.
- Отримано технічне підтвердження на прод-рантаймі через `agent_logs`, а не лише через UI.
- Виявлено наступний операційний крок: встановити `tfsec` на VPS для успішного завершення Tfsec-сканів.
