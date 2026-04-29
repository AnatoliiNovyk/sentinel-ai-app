# Batch 261: Agent mixed-content health-check fix

## Як було
- Агент `/health` був доступний напряму у браузері, але в UI показувалось `Agent unreachable: Failed to fetch` і `Agent offline`.
- На HTTPS фронтенді запит до HTTP agent URL блокується browser policy (mixed content), що маскувалось під загальну помилку мережі.

## Що зроблено
- Оновлено [src/pages/Settings.tsx](src/pages/Settings.tsx):
  - додано детекцію mixed-content (`https` page -> `http` agent URL);
  - замість `Failed to fetch` показується чітке повідомлення про policy block і потребу HTTPS/reverse proxy;
  - нормалізовано збереження agent URL (`trim`).
- Оновлено [src/components/AppLayout.tsx](src/components/AppLayout.tsx):
  - додано mixed-content детекцію в polling;
  - статус у хедері тепер показує `Agent check blocked (HTTPS -> HTTP)` замість хибного `Agent offline`.
- Оновлено [src/pages/Scans.tsx](src/pages/Scans.tsx):
  - при mixed-content блокуванні reachability встановлюється в `null` (unknown), щоб не тригерити хибні offline/demo-сигнали.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- Користувач бачить коректну причину проблеми, а не хибний network failure.
- Знижено кількість false-positive `agent offline` станів у UI.
- Прискорено діагностику інцидентів агент-доступності (чітка вказівка на mixed content/HTTPS вимогу).
