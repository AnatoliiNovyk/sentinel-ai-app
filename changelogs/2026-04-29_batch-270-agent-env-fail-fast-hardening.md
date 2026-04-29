# Batch 270: sentinel-agent env fail-fast hardening

## Як було
- `sentinel-agent` міг падати в рантаймі з неінформативною помилкою Supabase SDK: `supabaseUrl is required`.
- У runtime зі зібраного `dist` файл `.env` міг не підхопитись стабільно залежно від робочої директорії запуску.

## Що зроблено
- Оновлено [sentinel-agent/src/index.ts](sentinel-agent/src/index.ts):
  - додано завантаження `.env` як зі стандартного cwd, так і з шляху відносно `dist` (`../.env`);
  - додано `getRequiredEnv(name)` для fail-fast валідації обов'язкових змінних;
  - обов'язковими явно перевіряються `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AGENT_SECRET` до ініціалізації `createClient`.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- При відсутній конфігурації агент падає одразу з чітким повідомленням, що саме не налаштовано.
- Зменшено ризик непрозорих прод-інцидентів і часу на діагностику.
- Прибрано клас помилок, де Supabase SDK віддає загальне `supabaseUrl is required` без контексту.
