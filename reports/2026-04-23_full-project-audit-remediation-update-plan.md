# Sentinel AI: Повний Аудит Проєкту, План Виправлення Багів та План Покращень

Дата: 2026-04-23  
Репозиторій: sentinel-ai-app  
Гілка: main

## 1) Executive Summary

Проєкт Sentinel AI є функціональним MVP із широким покриттям сценаріїв (сканування, звітність, комплаєнс, AI-помічник, планувальник), але має підвищений технічний ризик через прогалини в тестуванні, неповну реалізацію частини інтеграцій та крихкі fallback-патерни.

Топ-5 ризиків:
1. Відсутність автотестів (високий ризик регресій).
2. Критичний dependency на mock/імітаційні результати у частині потоків сканування.
3. Неповна керованість помилками (silent-failure патерни).
4. Ризики міграцій і RBAC-еволюції без формалізованої rollback-стратегії.
5. Недостатня операційна зрілість (моніторинг, метрики, health checks).

Загальний рівень технічного ризику: High

## 2) Повний та Детальний Звіт По Проєкту

### 2.1 Архітектура та складові

- Frontend: React + TypeScript + Vite; багатосторінкова UI-структура у src/pages та src/components.
- Бізнес-логіка: централізована у src/lib (risk/compliance/report/ai/scans/scheduler).
- Backend: Supabase (PostgreSQL + RLS + Edge Functions).
- Agent: окремий Node-процес у sentinel-agent для виконання сканів через інструменти безпеки.
- CI/CD: GitHub workflows присутні; є ознаки security-сканів у pipeline.

### 2.2 Оцінка якості коду

Сильні сторони:
- Чітке розділення модулів за доменами.
- Наявність окремих сервісів/утиліт для AI, комплаєнсу, скорингу, звітів.

Слабкі сторони:
- Частина критичних потоків покладається на fallback/mock.
- Наявні місця з можливим ослабленням типізації й обробки помилок.
- Відсутність системної валідації вхідних/вихідних даних (schema-first контроль не всюди).

### 2.3 Безпека

- Плюси: використання Supabase + RLS та сегментація доступів на рівні БД.
- Ризики:
  - Можливі edge-case витоки при неконсистентних policy/migration станах.
  - Потенційно недостатній rate limiting для edge-функцій.
  - Потрібне посилення практик секретів (rotation, контроль середовищ, аудит ключів).

### 2.4 Дані та міграції

- У проєкті довгий ланцюг міграцій, включно з RBAC-змінами.
- Основний ризик: еволюція схеми без формалізованого rollback/runbook.
- Рекомендація: запровадити міграційні smoke-checks та pre-deploy валідацію консистентності policy/index/FK.

### 2.5 Надійність та експлуатація

- Частина потоків має деградаційний режим через fallback/mock, що корисно для демо, але ризиково для prod.
- Потрібно уніфікувати обробку помилок, додати централізоване логування і чіткі сигнали стану (health/readiness).

### 2.6 Продуктивність

- Потенційні bottlenecks:
  - Важкі табличні/репортні перегляди без явної пагінації у всіх сценаріях.
  - Polling-патерни там, де доречні push/realtime механізми.
- Потрібні вимірювані SLO/SLI для API та скан-пайплайнів.

### 2.7 Тестування та якість релізів

- Ключова прогалина: відсутня системна матриця unit/integration/e2e тестів.
- Поточний підхід не гарантує стабільність при змінах у критичних модулях.

### Findings (підтверджені)

#### FINDING-001
- Severity: Critical
- Категорія: Testing
- Де знайдено: package.json (основний), відсутній test script/тестова інфраструктура
- Опис проблеми: автотести не є частиною стандартного циклу якості.
- Вплив на бізнес/продукт: високий ризик регресій, зростання вартості релізу.
- Root cause: MVP-фокус без формалізації quality gate.
- Докази: наявні lint/build/typecheck сценарії, відсутня test-поверхня.
- Рекомендований напрям виправлення: підключити Vitest + React Testing Library + мінімальний integration stack.

#### FINDING-002
- Severity: High
- Категорія: Reliability
- Де знайдено: src/lib/scanDispatch.ts, src/lib/scanMock.ts
- Опис проблеми: ризик змішування бойових і mock-сценаріїв у потоці сканувань.
- Вплив на бізнес/продукт: можливі хибні уявлення про реальний стан безпеки.
- Root cause: fallback-first стратегія без жорсткої сигналізації режиму.
- Докази: окремий mock-модуль присутній у критичному домені.
- Рекомендований напрям виправлення: явне маркування режимів, заборона production-export для mock.

#### FINDING-003
- Severity: High
- Категорія: Reliability
- Де знайдено: src/lib/scheduler.ts, src/lib/aiGateway.ts
- Опис проблеми: потенційні silent-failure патерни в асинхронних потоках.
- Вплив на бізнес/продукт: приховані збої, складна діагностика інцидентів.
- Root cause: неуніфікована помилкова телеметрія.
- Докази: доменні модулі orchestration/dispatch без окремого error policy contract.
- Рекомендований напрям виправлення: централізований error contract + structured logging.

#### FINDING-004
- Severity: High
- Категорія: Data
- Де знайдено: supabase/migrations/* (ланцюг RBAC/feature migrations)
- Опис проблеми: відсутня формалізована rollback-політика для складних змін схеми.
- Вплив на бізнес/продукт: ризик простою/неконсистентності при релізах.
- Root cause: інкрементальне зростання без runbook-практики.
- Докази: значна кількість міграцій та еволюція RBAC.
- Рекомендований напрям виправлення: міграційний runbook + preflight schema checks.

#### FINDING-005
- Severity: Medium
- Категорія: Security
- Де знайдено: supabase/functions/*, конфігурації середовища
- Опис проблеми: потреба в посиленні rate limit/secret governance практик.
- Вплив на бізнес/продукт: підвищений операційний та безпековий ризик.
- Root cause: рання стадія операційної зрілості.
- Докази: відсутність явного централізованого policy-документу по rate limiting/rotation у репозиторії.
- Рекомендований напрям виправлення: ввести security baseline checklist у release pipeline.

### Hypothesis / Needs Validation

1. Наявність N+1 сценаріїв у частині сторінок із розширеною аналітикою потребує профілювання запитів.
2. Окремі інтеграції загроз/темної мережі можуть бути частково stub-реалізаціями та потребують технічного підтвердження в runtime.
3. Необхідно перевірити, що всі RLS policy узгоджені з останніми RBAC-міграціями на реальних даних.

## 3) План Виправлення Багів (знайдених під час аудиту)

### Phase 0: Негайні критичні дії (stabilization)

| Bug ID | Дії | Залежності | Ризик змін | Effort | Очікуваний результат | DoD | Перевірка |
|---|---|---|---|---|---|---|---|
| FINDING-001 | Додати базовий test harness (Vitest, RTL), 10-15 критичних unit тестів | Немає | Medium | M | Мінімальний quality gate | Tests у CI, green run | npm run test + CI |
| FINDING-002 | Ввести явний scan mode: REAL/MOCK і UI-індикатор | Немає | Medium | M | Відсутність змішування інтерпретації результатів | mock-results марковані | ручна перевірка сценаріїв |
| FINDING-003 | Стандартизувати error handling контракт у scan/ai/scheduler потоках | Немає | Medium | M | Прозорі помилки, швидша діагностика | єдина схема помилок | chaos/manual failure tests |

### Phase 1: Високий пріоритет

| Bug ID | Дії | Залежності | Ризик змін | Effort | Очікуваний результат | DoD | Перевірка |
|---|---|---|---|---|---|---|---|
| FINDING-004 | Створити migration rollback runbook + preflight checks | Phase 0 | Medium | M | Безпечніші деплоя міграцій | runbook у repo + smoke scripts | staging dry-run |
| FINDING-005 | Впровадити rate limiting baseline та secret rotation policy | Phase 0 | Medium | L | Зниження безпекового ризику | policy + технічні guardrails | security checklist |

### Phase 2: Середній пріоритет

| Bug ID | Дії | Залежності | Ризик змін | Effort |
|---|---|---|---|---|
| FINDING-002 | Заборонити експорт mock findings у production канали | Phase 0 | Low | S |
| FINDING-003 | Додати retry/backoff policy з telemetry tags | Phase 0 | Medium | M |
| FINDING-001 | Розширити покриття до integration smoke suite | Phase 0 | Medium | L |

### Phase 3: Низький пріоритет та hardening

| Bug ID | Дії | Залежності | Ризик змін | Effort |
|---|---|---|---|---|
| FINDING-005 | Автоматизований аудит секретів і ключів | Phase 1 | Low | M |
| FINDING-004 | Регулярні міграційні drill-тренування | Phase 1 | Low | M |

### Quick Wins (до 1 дня)
1. Додати fail-fast перевірку режиму scan (REAL/MOCK) у UI.
2. Додати централізований utility для normalized error response.
3. Додати мінімальні unit тести для riskScore/compliance/reportBuilder.
4. Додати release checklist для schema/security перед деплоєм.

### Blockers
1. Відсутність test baseline ускладнює безпечний рефакторинг.
2. Невизначеність вимог до prod-поведінки mock-режиму.

### Паралельні задачі
1. Test harness (frontend/lib) і security checklist можуть іти паралельно.
2. Error contract та scan mode labeling можуть виконуватися двома потоками.

## 4) Список Покращень та Апдейтів (на основі звіту)

### Short-term (1-2 тижні)

| Покращення | Чому важливо | Пріоритет | Effort | KPI |
|---|---|---|---|---|
| Єдиний error contract + structured logging | Менше MTTR | P0 | M | -30% часу діагностики |
| Базовий test suite (critical paths) | Захист від регресій | P0 | M | >=20 критичних тестів |
| Scan mode governance (REAL/MOCK) | Коректність рішень безпеки | P0 | M | 0 випадків неявного mock |

### Mid-term (1-2 місяці)

| Покращення | Чому важливо | Пріоритет | Effort | KPI |
|---|---|---|---|---|
| Міграційний runbook + preflight automation | Стабільні релізи БД | P1 | M | 100% migration dry-runs |
| Розширення інтеграційних тестів | Надійність cross-module сценаріїв | P1 | L | >=60% покриття критичних потоків |
| Сервісні SLI/SLO для scan pipeline | Керована якість сервісу | P1 | M | P95 latency/SLO dashboard |

### Long-term (3+ місяці)

| Покращення | Чому важливо | Пріоритет | Effort | KPI |
|---|---|---|---|---|
| Перехід до event-driven update model (менше polling) | Масштабованість | P2 | XL | -40% фонового навантаження |
| Security hardening framework (policy as code) | Передбачувана безпека | P1 | L | 100% security checks у CI |
| Розширена observability (trace + metrics + alerts) | Операційна зрілість | P1 | L | MTTR < 30 хв |

## 5) Дорожня Карта Реалізації (30/60/90)

### 30 днів
- Запустити test baseline.
- Впровадити scan mode labeling.
- Уніфікувати error contract.
- Додати мінімальний release security/schema checklist.

### 60 днів
- Автоматизувати migration preflight.
- Розширити integration coverage.
- Впровадити базові SLI/SLO метрики для scan pipeline.

### 90 днів
- Перейти на частково event-driven модель оновлень.
- Поглибити observability та інцидентні runbooks.
- Закріпити governance процес для security і релізів.

## 6) Ризики та Припущення

Ризики реалізації:
1. Обмежені ресурси команди можуть відкласти тестування та hardening.
2. Висока швидкість фічерозвитку може конфліктувати з техборг-ініціативами.
3. Неповні операційні вимоги до production agent-flow.

Потрібно додатково:
1. Підтверджені runtime-метрики scan pipeline.
2. Єдиний документ з політикою секретів і ротації.
3. Чіткі критерії production-ready для інтеграцій, що зараз працюють у fallback-парадигмі.

## 7) Підсумковий Пріоритизований Action List (Top-10)

1. Додати базовий test harness і критичні unit/integration тести.
2. Розмежувати й примусово маркувати REAL/MOCK режими сканування.
3. Уніфікувати error contract в ai/scan/scheduler потоках.
4. Додати structured logging і базову телеметрію інцидентів.
5. Оформити та автоматизувати migration preflight + rollback runbook.
6. Впровадити security baseline checklist (rate limit, secrets, validation).
7. Заборонити production-експорт mock findings.
8. Визначити SLI/SLO для ключових API/scan workflows.
9. Розширити CI quality gates (tests + security checks).
10. Підготувати 90-денну програму observability та reliability hardening.
