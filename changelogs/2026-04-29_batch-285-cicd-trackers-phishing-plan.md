# Batch-285 — CI/CD Critical Gates, Issue Tracker Templates, Phishing Drill Plan

**Date:** 2026-04-29

---

## Як було

- `src/pages/Integrations.tsx`: сторінка містила лише CI/CD YAML-сніпети (GitHub Actions, GitLab CI/CD, Jenkins, Bitbucket) без секції шаблонів для issue-трекерів.
- `src/pages/DarkWebMonitor.tsx`: сторінка OSINT Analyzer показувала результати сканів, розподіл ризиків та аналітику, але не мала жодного модуля для планування phishing-симуляцій.
- Тести Integrations і DarkWebMonitor не перевіряли нові секції.

---

## Що зроблено

### `src/pages/Integrations.tsx`
- Додано нову секцію **"Issue Tracker Templates"** під CI/CD блоком.
- Три картки з JSON-шаблонами для копіювання:
  - **Jira Issue Template** (`jira-issue.json`) — авто-створення тікетів з полями `summary`, `description`, `priority`, `labels`, `due_date`, `sla_hours`.
  - **Trello Card Template** (`trello-card.json`) — картка з чекліст-елементами для трекінгу вразливостей.
  - **ServiceNow Incident Template** (`servicenow-incident.json`) — інцидент з `short_description`, `urgency`, `category`, `work_notes`.
- Кожна картка має кнопку **Copy** з feedback "Copied" та відображення JSON у code block.
- Стан `copied` / `TemplateKey` типізований, функція `copy()` з `setTimeout` reset.

### `src/pages/DarkWebMonitor.tsx`
- Додано state `showPhishingDrill` (boolean, default `false`).
- Додано `copiedDrill` state для copy-feedback у drill scenarios.
- Додано `phishingScenarios` — масив з 3 сценаріїв (useMemo):
  - *Credential Harvesting Simulation* — фіктивні запити верифікації;
  - *Executive Impersonation Drill* — CEO-fraud симуляція;
  - *Password Reset Attack* — підроблена форма скидання пароля.
- Додано `latestRiskyResult` (useMemo) — знаходить перший результат з `breachCount > 0` або `riskLevel in [critical, high]`.
- Додано **Phishing Drill Plan** панель між Risk Distribution і Analysis Results:
  - Відображається лише коли `latestRiskyResult` присутній (є ризиковий результат скану).
  - Collapsible toggle кнопка з іконкою `AlertTriangle`.
  - Розгортання показує 3 картки сценаріїв з кнопкою **Copy** для кожного.
  - Контекст показує рівень ризику та кількість breaches поточного результату.

### Тести
- `src/pages/__tests__/Integrations.test.tsx`: новий describe-блок `'Integrations — Issue Tracker Templates'` (6 тестів):
  - Рендерить heading "Issue Tracker Templates".
  - Рендерить "Jira Issue Template", "Trello Card Template", /ServiceNow/i.
  - Перевіряє кількість Copy-кнопок (≥5).
  - Перевіряє `clipboard.writeText` при кліку на Jira Copy.
- `src/pages/__tests__/DarkWebMonitor.test.tsx`: новий describe-блок `'OsintAnalyzer — Phishing Drill Plan'` (4 тести):
  - Панель НЕ показується до першого скану.
  - Панель НЕ показується коли scan повернув 0 breaches і low risk.
  - Панель ПОКАЗУЄТЬСЯ коли scan повернув high-risk breach.
  - Панель розгортається при кліку на toggle.
  - `localStorage.clear()` у `beforeEach` для ізоляції між тестами.

---

## Що покращило / виправило / додало

- **Додано** готові шаблони для Jira / Trello / ServiceNow — команди можуть вставити JSON у webhook або API пайплайн.
- **Додано** Phishing Drill Plan — після виявлення витоків система пропонує 3 конкретні drill-сценарії з можливістю копіювання.
- **Покращено** тест-покриття: +10 нових тестів (6 Integrations + 4 DarkWebMonitor), всього 33/33 PASS.
- **Виправлено** потенційне забруднення між тестами через `localStorage` у DarkWebMonitor — додано `localStorage.clear()` у `beforeEach` обох describe-блоків.
- Build: ✅ (5.95s, no errors, no warnings).
