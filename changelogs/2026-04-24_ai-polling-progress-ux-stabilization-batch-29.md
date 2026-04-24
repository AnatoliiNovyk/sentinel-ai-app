# Batch 29: AI Polling Progress UX Stabilization

## Як було
- Новий UX-потік статусів polling (`Dispatching`, `Polling`, `Retrying`) був доданий у TypeScript-версії, але 2 тести падали.
- Причина виявилась комбінованою: у workspace є дублікати JS-файлів поруч із TS/TSX, і рантайм/тести резолвили застарілі JS-версії без нової логіки callback/status.
- Додатково був typecheck-блокер у deferred-promise патерні тесту (`TS2349`).

## Що зроблено
- Синхронізовано TS і JS реалізації для polling progress:
- `src/api/ai.service.js`: додано optional callback `onProgress` у `pollForResult`, події `querying`/`retrying`, передачу `attempt/maxAttempts/nextDelayMs/errorCode`.
- `src/pages/Chat.js`: додано стабільні UX-лейбли `Dispatching AI task`, `Polling AI result`, `Retrying after transient error`; передача callback у `AiService.pollForResult`; зупинка циклу фаз через `clearInterval(phaseTimer)` перед dispatch/poll.
- Підтягнуто дзеркальні зміни у TS/TSX-версіях:
- `src/pages/Chat.tsx`.
- Стабілізовано тести:
- `src/api/ai.service.test.ts`: детермінований сценарій callback/retry.
- `src/pages/__tests__/Chat.integration.test.tsx`: стабільний deferred-promise сценарій і виправлення типізації resolver без nullable optional-call.
- Проведено повний прогін `npm run quality:check`.

## Що покращило / виправило / додало
- Виправлено регресію, коли прогрес polling не відображався через застарілий JS-рантайм.
- UI chat тепер коректно показує проміжні стани під час dispatch/poll/retry без перетирання фазовим таймером.
- Тести на retry UX і callback polling стали стабільними.
- Проєкт повернуто в green-стан quality gate: lint + typecheck + tests + build PASS.
