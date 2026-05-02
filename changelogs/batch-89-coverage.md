# Batch 89 — DarkWebMonitor Coverage

## Як було
- `DarkWebMonitor.tsx` мав 97.99% statements.
- Непокритими лишались гілки:
- порожній submit (trimmed input) з повідомленням валідації
- `catch` fallback для не-`Error` винятку (`Unknown error during scan`)

## Що зроблено
- У `src/pages/__tests__/DarkWebMonitor.test.tsx` додано 2 тести:
- `shows validation error when Enter is pressed on empty input`
- `shows fallback error when scan throws non-Error value`
- Перший тест викликає `analyze()` через `Enter` на порожньому input, щоб пройти ранній guard.
- Другий тест моком змушує `scan` кидати рядок, щоб пройти fallback-гілку `catch`.

## Що покращило/виправило/додало
- `DarkWebMonitor.tsx` піднято з **97.99%** до **98.99% statements**.
- Ризикові edge-case сценарії тепер перевірені:
- submit без валідного значення
- неочікуваний тип помилки зі сканера
- `DarkWebMonitor.test.tsx`: 40/40 passing.
