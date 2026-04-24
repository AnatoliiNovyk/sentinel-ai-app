# Changelog: batch-45-phase0-reliability

**Дата:** 2026-04-24  
**Гілка:** main  
**Тести:** 355 / 355 ✅ (exit code 0)

---

## BUG-002 — Audit Service Retry Logic (FINDING-001)

### Як було
- `AuditService.log()` робив один INSERT, при помилці лише виводив `console.error` — запис у audit_logs втрачався назавжди.
- `logSecurityEvent()` ковтав всі помилки через `.catch(() => {})` — жодного сигналу при збої.

### Що зроблено
**`src/api/audit.service.ts`**:
- Додано `withRetry<T>(fn, maxAttempts=3, baseDelayMs=1000)` — private хелпер з exponential backoff:  
  спроба 0 → негайно, спроба 1 → 1 сек, спроба 2 → 2 сек. Загальне максимальне очікування ~3 сек.
- `log()` тепер загортає INSERT у `withRetry()`. Після 3 невдалих спроб — `console.error` (без throw, щоб не ламати основний флоу).
- `logSecurityEvent()` у `.catch()` тепер викликає `console.warn` з ім'ям `action` — видимо в логах при вичерпанні спроб.

### Що покращило
- Security-критичні події (login, rate_limit, circuit_breaker) зберігатимуться навіть при короткочасних мережевих збоях.
- Видимість збоїв аудиту у production-логах без впливу на UX.

---

## BUG-004 — Agent Circuit Breaker (FINDING-008)

### Як було
- `sentinel-agent/src/index.ts`: `consultOllama()` і `reportResult()` не мали circuit breaker.
- При недоступності Ollama або `scan-result` edge function — агент продовжував гамерити запитами кожні 3 сек, генеруючи лог-флуд без відновлення.

### Що зроблено
**`sentinel-agent/src/index.ts`**:
- Додано клас `CircuitBreaker` (CLOSED / OPEN / HALF_OPEN state machine):
  - Threshold: N послідовних збоїв → переходить у OPEN.
  - Recovery: через `recoveryMs` переходить у HALF_OPEN (пробний запит).
  - Якщо пробний запит успішний → CLOSED; якщо провалився → знову OPEN.
- `ollamaCB = new CircuitBreaker('ollama', failureThreshold=3, recoveryMs=60s)` — швидке відкриття при недоступному Ollama.
- `reportCB = new CircuitBreaker('scan-result', failureThreshold=5, recoveryMs=30s)` — захист edge function від DDoS retry.
- `consultOllama()` загорнутий в `ollamaCB.call()`.
- `reportResult()` загорнутий в `reportCB.call()`.
- При відкритому circuit breaker — повідомлення в консоль з таймером відновлення.

### Що покращило
- Агент перестає спамити запитами при збої downstream-сервісів.
- Автоматичне відновлення без ручного рестарту.
- Видимі logs: `[CircuitBreaker:ollama] OPEN — 3 failures, recovery in 60s`.
