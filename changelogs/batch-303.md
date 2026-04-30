# Batch-303 Changelog

## Як було
- `rateLimitService.ts`: 68.62% stmts — функція `checkRateLimit` (lines 95–128) не мала жодного тесту; гілка `api_calls_per_second` в `recordUsage` (lines 60–61) теж не покрита.
- `PresenceContext.tsx`: 79.54% stmts — callback `.on('*', ...)` (lines 59–68), логіка повторного підключення (lines 53–54) і heartbeat-інтервал (lines 92–98) не тестувались.
- Загальне покриття: **78.11% stmts / 77.42% branch / 59.02% funcs / 78.11% lines**, 1406 тестів.

## Що зроблено

### `src/lib/__tests__/rateLimitService.test.ts`
- Додано `checkRateLimit` до імпорту.
- Новий тест у `recordUsage`: `uses api_calls_per_second reset window` — покриває гілку `api_calls_per_second` у `recordUsage`.
- Новий `describe('checkRateLimit', ...)` з 7 тестами:
  - `allowed:true` і коректний `remaining` при поточному < ліміту
  - `allowed:false` при поточному == ліміту
  - `remaining` затискується до 0 при перевищенні ліміту
  - `resetAt` для `reports_per_day`
  - `resetAt` для `chat_messages_per_hour`
  - `resetAt` для `api_calls_per_second`
  - Перевірка лімітів для `pro` плану

### `src/context/__tests__/PresenceContext.test.tsx`
- Додано `renderHook` до імпорту (для майбутнього).
- Новий тест: `unsubscribes old subscription when updatePresence is called again` — перевіряє lines 52–54.
- Новий тест: `updates activePresence when on("*") callback fires for matching context` — перехоплює callback через `mockOn.mockImplementation`, вручну запускає його з тестовими даними, перевіряє `getMembersViewing`.
- Новий тест: `on("*") callback does not update state for non-matching context` — перевіряє гілку `if (record.context_type !== contextType || ...)`.
- Новий тест: `heartbeat fires updatePresence after 30s when presenceRef is set` — використовує `vi.useFakeTimers()`, `rerender` зі зміненими `organizations` (щоб перезапустити useEffect), `vi.advanceTimersByTime(30000)`.

## Що покращило

| Файл | Було | Стало |
|------|------|-------|
| `rateLimitService.ts` stmts | 68.62% | ~97%+ |
| `PresenceContext.tsx` stmts | 79.54% | ~92%+ |
| **Загалом stmts** | 78.11% | **78.34%** |
| **Загалом branch** | 77.42% | **77.58%** |
| **Загалом funcs** | 59.02% | **59.13%** |
| **Тести** | 1406 | **1418** |

**Коміт:** `1558a35` — `batch-303: coverage — rateLimitService checkRateLimit + PresenceContext on-callback/heartbeat`
