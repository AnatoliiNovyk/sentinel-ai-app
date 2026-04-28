# Batch 218: Ротація AGENT_SECRET + верифікація pipeline

## Як було
- Після попередніх діагностичних запусків існував ризик компрометації `AGENT_SECRET`.
- Потрібно було виконати безпечну ротацію секрета без зупинки scan pipeline.

## Що зроблено
- Згенеровано новий `AGENT_SECRET` (48+ символів) без виводу значення у консоль.
- Оновлено `AGENT_SECRET` у `sentinel-agent/.env`.
- Оновлено `AGENT_SECRET` у кореневому `.env` (якщо присутній).
- Синхронізовано секрет у Supabase (`supabase secrets set AGENT_SECRET <value>`).
- Перерозгорнуто edge functions:
  - `scan-dispatch`
  - `scan-result`
- Виконано post-rotation smoke:
  - `dispatch_http = 200`
  - `result_http = 200`
  - lifecycle logs записуються (`log_count = 5`).

## Що покращило
- Знижено ризик використання старого скомпрометованого `AGENT_SECRET`.
- Підтверджено, що після ротації авторизація агента та scan lifecycle працюють коректно.
- Збережено безперервність роботи production scan pipeline після зміни секретів.
