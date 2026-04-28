# Batch 235: Runtime recovery for stuck smoke scan

## Як було
- Smoke e2e прогін створив scan `ecb86b40-4dc2-48d5-8c00-3b07b566fcab`, який залишився в `running`.
- Пов'язані job-и перевищили поріг очікування та не перейшли у фінальний стан автоматично в межах тестового вікна.

## Що зроблено
- Проведено діагностику через Supabase REST API для `scans`, `scan_jobs`, `agent_logs`.
- Виконано DB safety-net RPC `cleanup_stale_running_jobs(timeout_minutes=5)`.
- Після RPC виконано повторну верифікацію станів `scan` і `scan_jobs`.

## Що покращило
- Завислий smoke-run переведено в узгоджений стан без ручного SQL.
- Підтверджено працездатність аварійного recovery-механізму в production-контурі.
- Зменшено ризик накопичення stale `running` записів у черзі.
