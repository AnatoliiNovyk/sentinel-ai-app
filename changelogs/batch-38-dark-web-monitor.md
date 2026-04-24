# Batch 38: Dark Web Monitor Library

## Як було

Сторінка `DarkWebMonitor.tsx` (OSINT Analyzer) існувала як UI-компонент зі статичними mock-даними без реальної бізнес-логіки. Пошук повертав однакові hardcoded витоки для будь-якого запиту, що містить "admin". Не існувало lib-модуля, risk scoring, кешування, метрик або детектування типу запиту.

## Що зроблено

### `src/lib/darkWebMonitor.ts` (~290 рядків)

**Типи даних:**
- `BreachEntry` — структура витоку: id, source, breachDate, dataClasses, severity, recordCount, verified, description
- `LeakScanResult` — повний результат сканування: query, queryType, breachCount, breaches, riskScore, riskLevel, hasActiveCredentials, recommendedActions, sources
- `DwmMetrics` — метрики клієнта: totalScans, cacheHits, cacheMisses, breachesFound, cleanScans

**Ключові функції:**
- `detectQueryType(query)` — автоматичне визначення типу запиту (email / domain / ip / username) через regex
- `simulateBreachLookup(query)` — детерміністичне визначення витоків через hash функцію (testable, 0–3 витоків залежно від хешу)
- `computeRiskScore(breaches)` — зважений розрахунок ризику (critical=40, high=25 + бонуси за verified, Passwords, SSNs)
- `riskLevelFromScore(score)` — конвертація числового score в рівень (none/low/medium/high/critical)
- `buildRecommendations(breaches)` — генерація конкретних дій залежно від типів витоків (Passwords, Credit cards, SSNs, API keys, PII)

**`DarkWebMonitorClient` клас:**
- `scan(query)` → `Result<LeakScanResult>` — головний метод з валідацією (порожній/задовгий запит), кешуванням (TTL 10хв), метриками
- `computeRisk(breaches)` — pure функція для ручного розрахунку ризику
- `clearCache()`, `getCacheSize()`, `getMetrics()` — управління кешем та моніторинг
- Глобальний singleton: `getGlobalDarkWebMonitor()`, `resetGlobalDarkWebMonitor()`

**Банк витоків (6 записів):**
- DataBreach-2023 (14M записів, критичний, credentials)
- Corp-Leak-Q1-2022 (2.5M записів, PII + телефони)
- Log4Shell-Exploit-2021 (450K, session tokens + API keys)
- Credential-Stuffing-2024 (8.2M, email + passwords)
- DarkMarket-Dump-2023 (320K, credit cards + SSNs)
- SaaS-Token-Leak-2024 (95K, API keys + OAuth tokens)

### `src/lib/__tests__/darkWebMonitor.test.ts` (27 тестів)

- detectQueryType: 4 тести (email, domain, IP, username)
- DarkWebMonitorClient: 19 тестів (валідація, типи запитів, risk level, детермінізм, структура BreachEntry, кеш TTL, метрики, computeRisk)
- Global singleton: 3 тести

## Що покращило/виправило/додало

### 🔍 Функціональність
- **Автоматичне визначення типу**: email / domain / IP / username детектуються автоматично
- **Детермінізм**: однаковий запит → однаковий результат (тестабельно через hash)
- **Risk scoring**: зважений алгоритм з урахуванням типів даних та верифікації витоку
- **Рекомендації**: персоналізовані дії залежно від типу викраденого (паролі vs. credit cards vs. SSNs)

### 📊 Спостережуваність
- **Метрики**: totalScans, cacheHits, cacheMisses, breachesFound, cleanScans
- **Кешування**: TTL 10 хвилин, зменшує повторні обчислення
- **Singleton**: єдиний глобальний клієнт для всього застосунку

### 📈 Якість
- 207 тестів (27 нових), exit code 0, 0 TypeScript/ESLint помилок
