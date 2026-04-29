# Changelog: Roadmap Items 2–6

## Item 2: Input Validation у SupplyChain + agentTools

### Як було
- `toolDarkWebScan` в `src/lib/agentTools.ts`: лише перевіряв порожній рядок
- `handleFile` в `src/pages/SupplyChain.tsx`: перевіряв лише розширення файлу, потім одразу `JSON.parse(text)` без try/catch і без обмеження розміру

### Що зроблено
- `toolDarkWebScan`: додано обмеження довжини (max 253 символи) + перевірку injection-патернів (`<>'"`;`, `..`, `//`, SQL-keywords); використано локальну змінну `query = args.query.trim()`
- `handleFile`: додано обмеження розміру файлу (> 5 MB → помилка), try/catch навколо `JSON.parse` з зрозумілим повідомленням, структурна валідація JSON (повинен бути об'єкт з ключем `name`, `dependencies`, `devDependencies`, або `packages`)

### Що покращило
- Захист від path traversal, SQL injection та XSS у полях запиту агента
- Захист від DoS через надмірно великі JSON файли в SupplyChain
- Зрозумілі повідомлення про помилки для користувача

---

## Item 3: Audit Logging у безпекових операціях

### Як було
- `AuditService` існував але не викликався у DarkWebMonitor, SupplyChain та Settings

### Що зроблено
- `src/pages/DarkWebMonitor.tsx`: імпортовано `AuditService`, `AuditAction`, `useAuth`; після успішного сканування — `logSecurityEvent(DARK_WEB_SCAN, ...)`
- `src/pages/SupplyChain.tsx`: аналогічно — `logSecurityEvent(SBOM_ANALYSIS, ...)` після сканування
- `src/pages/Settings.tsx`: `logSecurityEvent(PROJECT_UPDATED, 'profile', ...)` після збереження налаштувань

### Що покращило
- Всі security-sensitive операції тепер логуються в audit trail
- Підтримка compliance (GDPR, SOC2) — відстеження хто і коли виконував небезпечні операції

---

## Item 4: E2E тести з Playwright

### Як було
- Жодних E2E тестів

### Що зроблено
- Встановлено `@playwright/test` як dev dependency
- Створено `playwright.config.ts` з налаштуванням Chrome, baseURL, автозапуску dev server
- Створено `e2e/smoke.spec.ts` з 8 тестами: Landing page (2), Auth page (4), Public report (1), 404 (1)
- Додано скрипти `test:e2e` та `test:e2e:ui` у `package.json`

### Що покращило
- Smoke tests запобігають регресіям у критичних user flows (auth, landing, public report)
- E2E testів можна запускати локально (`npm run test:e2e`) або в CI

---

## Item 5: Dark Web реальна інтеграція (HIBP)

### Як було
- `DarkWebMonitorClient.scan()` завжди використовував детерміновану симуляцію

### Що зроблено
- `src/lib/darkWebMonitor.ts`: додано підтримку `VITE_HIBP_API_KEY` env var
- Якщо ключ є І query є email → fetch до `https://haveibeenpwned.com/api/v3/breachedaccount/{email}`
- Конвертер `hibpBreachToEntry()` → маппінг HIBP data classes на внутрішній формат `BreachEntry`
- HTML-теги очищаються з description через regex
- Fallback на симуляцію коли ключ не заданий або query не є email
- Поле `sources` показує `['HaveIBeenPwned v3']` при реальному запиті

### Що покращило
- Реальні дані про витоки паролів для email-запитів (коли є API ключ)
- Зворотна сумісність — без ключа все працює як раніше

---

## Item 6: Anomaly Detection Dashboard

### Статус
- **Вже реалізований** в `src/pages/Activity.tsx`:
  - `detectAnomalies()`: 4 алгоритми (error spike ≥ 2σ, recurring errors ≥ 5, high warn rate > 40%, no success in 2h)
  - `buildHourlyHeatmap()`: 7-денна hourly теплова карта
  - `AnomalyTab`: повний UI з картками аномалій, heatmap, top error bar chart
  - Доступно через `/activity` → вкладка "Anomalies" у nav sidebar
