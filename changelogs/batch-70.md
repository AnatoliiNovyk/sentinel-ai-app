# Batch 70 — aiGateway unit тести

## Як було
- `src/lib/aiGateway.ts` (`callAiGateway()` функція) не мала жодного unit-тесту.
- Логіка виклику Supabase edge function та fallback до локального mock не перевірялась.
- Загальний стан: 1009 тестів, 76 suite-файлів.

## Що зроблено
Створено `src/lib/__tests__/aiGateway.test.ts` з 10 тестами (в 2 describe блоках):

### successful edge function response (6 тестів)
- Повертає `content` і `provider` з edge function.
- `isMock=false` коли provider не є "mock".
- `isMock=true` коли edge function повертає provider "mock".
- Викликає `fetch` з методом POST та коректними заголовками.
- Передає `messages` у тілі запиту.
- Відсутній provider defaults до "mock".

### fallback to local mock (4 тести)
- Повертається до локального mock при non-OK HTTP статусі (503).
- Повертається до локального mock при network error (`fetch` кидає).
- Використовує останнє `user` повідомлення для mock fallback.
- Обробляє порожній масив `messages` без помилок.

## Технічні рішення
- **`vi.mock('../aiMock', ...)`** для `generateAIResponse`.
- **`vi.stubEnv()`** для `VITE_SUPABASE_URL` і `VITE_SUPABASE_ANON_KEY`.
- **`vi.stubGlobal('fetch', mockFetch)`** для перехоплення HTTP запитів.
- Mock vars у `beforeEach` через `vi.clearAllMocks()`.

## Що покращило / виправило / додало
- **+10 тестів** (1009 → 1019): покриття `callAiGateway()` від нуля.
- 77 suite-файлів.
- Досягнуто ~100% покриття всіх файлів з реальною бізнес-логікою.
- `npm run quality:check` → exit 0 (77 suites, 1019 tests passed).
