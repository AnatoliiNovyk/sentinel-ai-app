# Batch-304 Changelog

## Як було
- `agentTools.ts`: 83.91% stmts — rate limit exceeded path, query length > 253, breachCount > 0 ternary не покриті.
- `scans.service.ts`: 75.21% stmts — auth error (user=null), `getFunctionErrorMessage` з object-record error не покриті.
- `audit.service.ts`: 76.83% stmts — `exportLogs` і `cleanupOldLogs` методи не мали тестів.
- Загальне покриття: **78.38% stmts / 77.57% branch / 59.13% funcs**, 1418 тестів.

## Що зроблено

### `src/lib/__tests__/agentTools.integration.test.ts`
- Додано `vi.mock('../rateLimiter', ...)` з дефолтним `allowed: true`.
- Додано імпорт `getRateLimiter` для per-test override.
- Новий `describe('Dark Web Monitor — injection & rate limit', ...)` з 3 тестами:
  - `returns "too long" error when extracted query exceeds 253 chars` — використовує "dark web leak check " + "a".repeat(300) щоб `extractQueryFromText` повернув 300-символьний рядок і спрацював `query.length > 253`.
  - `returns rate limit exceeded when limiter denies request` — mockReturnValueOnce `{allowed:false, retryAfterMs:5000}`.
  - `returns breach details when breachCount > 0` — mock повертає `{breachCount:2, breaches:[...]}`, перевіряє що `content` містить "2 breach" і "HaveIBeenPwned".
- Новий `describe('unrecognized intent', ...)`: `returns null for completely unrecognized input`.

### `src/api/__tests__/scans.service.test.ts`
- Додано 4 нові тести в `describe('ScansService.dispatchScan', ...)`:
  - `throws authentication error when getUser fails` — `user: null` + error.
  - `throws authentication error when user is null` — `user: null`, error: null.
  - `throws with error details when insert error has message field` — object error `{message: 'Constraint violation'}`.
  - `returns generic error message when insert error has no readable fields` — пустий об'єкт помилки.

### `src/api/__tests__/audit.service.unit.test.ts`
- Додано `deleteMock = vi.fn()` та `delete: deleteMock` у supabase mock.
- Новий `describe('exportLogs', ...)` з 4 тестами:
  - CSV з header row і значеннями
  - Optional fields як empty strings
  - Тільки header коли logs=[]
  - Escaping double-quotes в CSV values
- Новий `describe('cleanupOldLogs', ...)` з 4 тестами:
  - `status 204 → 0`
  - `status 200 → 1`
  - Throws коли delete повертає error
  - Default retention 90 днів (перевіряє cutoff date)

## Що покращило

| Файл | Було | Стало |
|------|------|-------|
| `agentTools.ts` stmts | 83.91% | 87.41% |
| `scans.service.ts` stmts | 75.21% | 88.88% |
| `audit.service.ts` stmts | 76.83% | 94.48% |
| **Загалом stmts** | 78.38% | **78.71%** |
| **Загалом branch** | 77.57% | **77.78%** |
| **Загалом funcs** | 59.13% | **59.56%** |
| **Тести** | 1418 | **1434** |

**Коміт:** `6ca08a9` — `batch-304: coverage — agentTools rate-limit/breach/length, scans.service auth-error, audit.service exportLogs/cleanupOldLogs`
