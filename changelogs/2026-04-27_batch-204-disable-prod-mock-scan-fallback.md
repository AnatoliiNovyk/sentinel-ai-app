# Batch 204: Вимкнення MOCK fallback на проді

## Як було
- При недоступному `scan-dispatch` система могла автоматично падати в DEMO/MOCK режим і створювати симульовані скани.
- У `ScansService` новий скан одразу позначався як `REAL/running` ще до підтвердження реального dispatch.
- Повідомлення помилки для edge-failure натякало на автоматичний перехід у mock.

## Що зроблено
- У `src/lib/scanDispatch.ts` fallback у mock обмежено:
  - дозволено тільки в `DEV` або при явному `VITE_ALLOW_MOCK_SCAN_FALLBACK=true`.
  - в іншому разі скан позначається як `failed/UNKNOWN` і повертається помилка `SCAN_EDGE_FN_ERROR`.
- У `src/api/scans.service.ts` змінено pipeline створення скану:
  - первинний insert тепер `queued/UNKNOWN`;
  - `REAL/running` виставляється лише після успішного `scan-dispatch` invoke;
  - при помилці invoke скан переводиться в `failed/UNKNOWN`.
- У `src/lib/errors.ts` оновлено user-facing текст для `SCAN_EDGE_FN_ERROR` на нейтральний про недоступність реального агента.

## Що покращило/виправило/додало
- Прод більше не підсовує симульовані результати як fallback за замовчуванням.
- Статуси сканів тепер чесно відображають реальний стан dispatch.
- Менше шансів бачити небажаний DEMO MODE у production-потоці через автоматичну симуляцію.
