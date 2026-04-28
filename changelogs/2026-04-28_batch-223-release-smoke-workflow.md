# Batch 223: Smoke e2e check у release workflow

## Як було
- Smoke перевірка pipeline виконувалась вручну з локального оточення.
- У release/CI не було автоматичного e2e gate, який валідовує `dispatch -> result -> lifecycle logs`.

## Що зроблено
- Оновлено workflow `/.github/workflows/ci.yml`.
- Додано job `smoke-e2e-release` для гілки `main` з умовою на наявність секретів:
  - `SENTINEL_SUPABASE_URL`
  - `SENTINEL_SERVICE_ROLE_KEY`
  - `SENTINEL_AGENT_SECRET`
- Job формує тимчасовий `sentinel-agent/.env` у CI та запускає:
  - `scripts/smoke-pipeline-safe.ps1 -ControlledFailure`
- Додані fail-fast перевірки:
  - `dispatch_http == 200`
  - `result_http == 200`
  - `log_count >= 3`
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md`: P1.4 позначено виконаним.

## Що покращило
- Smoke e2e став частиною автоматичного release gate.
- Регресії pipeline виявляються до постачання змін у прод-флоу.
- Зменшено залежність від ручних перевірок та людського фактору.
