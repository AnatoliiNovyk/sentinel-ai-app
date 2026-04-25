# Batch-84: Webhook alerting for critical/high findings

## Як було
- Проект не мав механізму сповіщення зовнішніх систем про знайдені вразливості.
- Таблиця `projects` не мала поля для webhook URL.
- Агент після сканування лише записував результати в Supabase.

## Що зроблено

### 1. Міграція БД
- `supabase/migrations/20260425140000_add_webhook_url_to_projects.sql`
- Додано колонку `webhook_url text` (nullable) до таблиці `projects`
- Застосовано через `supabase db push --linked --include-all --yes`

### 2. sentinel-agent/src/index.ts
- Додано функцію `sendWebhookAlert(projectId, target, findings)`
- Фільтрує `critical` + `high` findings
- Завантажує `webhook_url` з Supabase для проєкту
- Виконує `POST` на webhook URL з payload:
  ```json
  { "event": "critical_findings", "project_id", "project_name", "target",
    "findings_count", "findings": [{ "title", "severity", "asset" }], "timestamp" }
  ```
- Timeout: 10 секунд; помилка лише виводиться в `console.warn` (не ламає агента)
- Викликається після `reportResult()` в `runJob()`

### 3. src/lib/supabase.ts
- Тип `Project` розширено: `webhook_url?: string | null`

### 4. src/pages/ProjectDetail.tsx
- Імпорт `Zap` з lucide-react
- Новий компонент `WebhookPanel` — в OverviewTab, після "Latest scan"
  - Input поле для URL (placeholder: Slack webhook)
  - Кнопка Save → UPDATE `projects.webhook_url`
  - Підказка щодо payload формату
- `OverviewTab` отримує `project` prop для передачі в `WebhookPanel`

## Що покращило/виправило/додало
- **Нова можливість**: Slack, Discord, або будь-який HTTP webhook — автоматичний POST при critical/high findings
- Webhook URL зберігається в БД, редагується в UI без перезапуску
- Агент залишається стійким — помилки webhook не переривають обробку сканів

## Git
- Commit: `d9c6e6c` — Batch-84: webhook alerting for critical/high findings
- Push: main → github.com/AnatoliiNovyk/sentinel-ai-app
