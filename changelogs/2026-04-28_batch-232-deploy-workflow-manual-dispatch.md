# Batch 232: Manual deploy trigger via workflow_dispatch

## Як було
- `deploy-agent.yml` запускався тільки на `push` зі змінами в `sentinel-agent/**`.
- Зміни тільки в CI (`.github/workflows/...`) не тригерили деплой, що ускладнювало перевірку гарячих workflow-фіксів.

## Що зроблено
- Додано `workflow_dispatch` у `.github/workflows/deploy-agent.yml`.
- Тепер деплой можна запускати вручну з GitHub Actions UI/CLI без технічних no-op змін у `sentinel-agent/**`.

## Що покращило
- Прискорено операційний цикл перевірки CI/CD змін.
- Усунуто залежність від path-filter для ручного прогону критичних deploy сценаріїв.
