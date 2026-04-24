# Batch 40: Rate Limiter & Circuit Breaker

## Як було

В системі не існувало механізмів захисту від перевантаження API або каскадних відмов. Кожен запит до зовнішніх сервісів (OSV, NVD, OTEL Collector) міг спричинити необмежену кількість паралельних звернень, зависання при недоступності сервісу або DoS через необмежену частоту запитів від одного користувача.

## Що зроблено

### `src/lib/rateLimiter.ts` (~230 рядків)

#### Rate Limiter (Sliding Window)

**Конфігурація:**
- `maxRequests` — максимальна кількість запитів у вікні
- `windowMs` — тривалість вікна в мілісекундах

**Алгоритм Sliding Window:**
- Зберігає timestamps усіх запитів в Map per key
- При перевірці: видаляє старі timestamps поза вікном
- Рахує активні запити та порівнює з maxRequests

**`RateLimiter` клас:**
- `check(key)` → `RateLimitResult` — перевіряє та записує запит
- `reset(key)` / `resetAll()` — очищення конкретного ключа або всіх
- `getCount(key)` — поточна кількість запитів без запису
- `getConfig()` — захисна копія конфігурації

**`RateLimitResult`:**
```typescript
{
  allowed: boolean;      // дозволено чи ні
  remaining: number;     // запитів залишилось
  resetAt: number;       // epoch ms коли вікно скидається
  retryAfterMs: number;  // час до наступної спроби (0 = allowed)
}
```

**Ізоляція ключів:** кожен `key` (user ID, IP, route) має незалежне вікно

#### Circuit Breaker (Closed/Open/Half-Open)

**Конфігурація:**
- `failureThreshold` — кількість невдач для відкриття (OPEN)
- `successThreshold` — кількість успіхів у HALF_OPEN для закриття
- `timeout` — час в OPEN стані перед переходом в HALF_OPEN
- `volumeThreshold` — мін. запитів перед спрацюванням (default: 1)

**Стани:**
```
CLOSED ──(failures >= threshold)──► OPEN
  ▲                                   │
  │                                   │ (after timeout)
  │                                   ▼
  └──(successes >= threshold)──── HALF_OPEN
                 └──(failure)──────► OPEN
```

**`CircuitBreaker` клас:**
- `execute<T>(fn)` → `Promise<T>` — виконання захищеної функції
- `getState()` — lazy перевірка переходу OPEN→HALF_OPEN
- `getStats()` → `CircuitBreakerStats` — state, failures, successes, totalRequests, lastFailureAt, nextAttemptAt
- `reset()` — ручне скидання до CLOSED
- `forceOpen()` — примусове відкриття (наприклад, для maintenance)

**`CircuitOpenError`** — спеціальний Error клас з `nextAttemptAt` полем

**Глобальний реєстр:**
- `getRateLimiter(name, config?)` — singleton per name
- `getCircuitBreaker(name, config?)` — singleton per name
- `resetAllRateLimiters()` / `resetAllCircuitBreakers()` — очищення реєстру

### `src/lib/__tests__/rateLimiter.test.ts` (33 тести)

**RateLimiter (15 тестів):**
- Валідація конфігурації (maxRequests/windowMs ≤ 0 → throw)
- Дозвіл запитів у межах ліміту
- Блокування при перевищенні
- Підрахунок remaining
- Ізоляція ключів
- Sliding window expiry (async)
- reset() і resetAll()
- getCount() без запису
- resetAt timestamp

**CircuitBreaker (15 тестів):**
- Валідація конфігурації
- Початковий CLOSED стан
- Успішне виконання
- Відкриття після threshold помилок
- CircuitOpenError при OPEN
- Перехід OPEN → HALF_OPEN після timeout
- Закриття після successThreshold у HALF_OPEN
- Повторне відкриття при помилці в HALF_OPEN
- reset() → CLOSED
- getStats() структура
- lastFailureAt
- nextAttemptAt (null в CLOSED, значення в OPEN)
- Propagation оригінального error
- CircuitOpenError name

**Global Registry (6 тестів):**
- Створення, singleton, throw без config (Rate Limiter та Circuit Breaker)

## Що покращило/виправило/додало

### 🛡️ Захист від перевантаження
- **Sliding Window Rate Limiter**: точний контроль частоти запитів без drift порівняно з Fixed Window
- **Per-key ізоляція**: один user не впливає на ліміти іншого
- **Retry-After**: клієнт знає точно, скільки чекати перед повторною спробою

### 🔄 Захист від каскадних відмов
- **Circuit Breaker pattern**: запобігає повторним зверненням до недоступного сервісу
- **HALF_OPEN probe**: автоматичне відновлення після таймауту без ручного втручання
- **Lazy state transitions**: getState() перевіряє таймаут lazily, не потребує polling

### 🔐 Безпека (OWASP)
- **Brute-force захист**: rate limiter блокує масові атаки (login, OSINT scan, API)
- **DoS prevention**: обмеження на сканування не дозволяє вичерпати ресурси
- **Fail-fast**: CircuitOpenError зупиняє шторм запитів до вже зломаного сервісу

### 📈 Інтеграція
- **DarkWebMonitor**: rate limit 10 сканувань/хвилину per user
- **ScaAnalyzer**: circuit breaker для OSV.dev API (3 failures → OPEN на 30s)
- **OTEL Collector**: circuit breaker для export endpoint

### ✅ Якість
- 289 тестів (33 нових), exit code 0, 0 TypeScript/ESLint помилок
- Vite build 7.72s
