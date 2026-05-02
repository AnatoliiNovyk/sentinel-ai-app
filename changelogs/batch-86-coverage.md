# Batch 86 — Activity Coverage

## Як було
- Файл Activity.tsx мав непокриті гілки/ділянки для:
- Групування дат: `Yesterday` і fallback-формат дати (weekday + month + day)
- Стану завантаження у вкладці anomalies (`Analyzing anomalies…`)
- Realtime INSERT callback у підписці Supabase
- Heatmap гілки для info-only клітинки (без error/warn)
- До змін: `Activity.tsx` = 98.66% statements, після частини правок 99.83% statements (рядок 677 лишався)

## Що зроблено
- Додано нові тести у src/pages/__tests__/Activity.test.tsx:
- `groups logs created yesterday under "Yesterday" label`
- `groups logs older than yesterday under weekday+date label`
- `shows "Analyzing anomalies…" when switching to anomalies tab while loading`
- `prepends new log from realtime INSERT channel callback`
- `renders anomalies heatmap for info-only logs (no error/warn)`
- Виправлено структуру тест-файлу після вставок (прибрано обірвані/зайві фрагменти, що ламали esbuild transform)

## Що покращило/виправило/додало
- Покриття `Activity.tsx` доведено до 100% statements.
- Підтверджено коректну роботу:
- date grouping для `Yesterday` та старіших дат
- loading UI у anomalies
- realtime оновлення списку логів через Supabase канал
- heatmap для info-only сценарію
- Підсумок coverage запуску:
- `Activity.tsx`: 100% statements, 90.67% branches, 86.36% funcs, 100% lines
