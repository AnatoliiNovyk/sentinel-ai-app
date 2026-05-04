# Fix: scans.service.ts — реальний dispatch path із agent check та mock fallback

**Дата:** 2026-05-04

## Як було

`ScansService.dispatchScan` у `src/api/scans.service.ts` завжди:
1. Створював рядок `scans` зі статусом `queued`
2. Одразу викликав Supabase edge function `scan-dispatch`
3. При будь-якій помилці edge function → встановлював `status: 'failed'`
4. Не перевіряв доступність sentinel-agent перед dispatch
5. Не мав fallback у mock-режим

Оскільки `Scans.tsx → handleStartScan` викликає **саме цю функцію** (а не `dispatchScan` з `src/lib/scanDispatch.ts`), попередній "фікс" в `scanDispatch.ts` не мав жодного ефекту на реальний flow.

Результат: усі скани завершувалися з `FAILED`, бо агент не запущений, edge function повертала 500, і код відразу ставив failed.

## Що зроблено

**`src/api/scans.service.ts`:**

1. Додано import `runMockScan` з `../lib/scanMock`
2. Додано константи `ALLOW_MOCK_FALLBACK` та `AGENT_HEALTH_URL_ENV`
3. Додано функцію `checkAgentReachable()` — 3-секундний HTTP probe до агента
4. Переписано `dispatchScan()` з трьома чіткими гілками:
   - **Agent offline + mock дозволено** → одразу `runMockScan()`, без створення orphan рядка в БД
   - **Agent offline + mock заборонено** → throw з clear повідомленням (без створення рядка)
   - **Agent online** → реальний dispatch; якщо edge fn впала і mock дозволено → видалити рядок і зробити mock; якщо mock заборонено → `status: 'failed'`

## Що покращило / виправило / додало

- **Виправлено:** скани більше не отримують `FAILED` при офлайн-агенті, якщо `VITE_ALLOW_MOCK_SCAN_FALLBACK=true`
- **Виправлено:** orphan-рядки `status: queued/failed` більше не створюються без реального скану
- **Виправлено:** застосовано fix у **правильному файлі** (не в `scanDispatch.ts`, який UI не викликає)
- **Додано:** чітке повідомлення про помилку, якщо mock вимкнено і агент недоступний
- **Додано:** подвійний fallback — спочатку edge fn, потім mock при online-агенті з проблемним edge fn
