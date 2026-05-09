# OTelCollector backoff test fix

**Дата:** 2026-05-09  
**Файл:** `src/lib/__tests__/otelCollector.test.ts`

---

## Як було

- Тест `implements exponential backoff on retries` очікував 3 виклики `fetchMock`
- Під час full `quality:check` тест падав, бо реальний лічильник викликів доходив до 4 через фоновий `setInterval` з інстанса, створеного у `beforeEach`

---

## Що зроблено

- Перед увімкненням fake timers у цьому тесті додано `await client.shutdown()`
- Це зупиняє фоновий flush timer перед перевіркою retry/backoff логіки
- Фокусований `vitest` для `otelCollector.test.ts` проходить: **26/26 PASSED**

---

## Що покращило/виправило/додало

- Прибрано нестабільність у тесті на exponential backoff
- Явно ізольовано retry-сценарій від фонового інтервалу
- `quality:check` тепер може пройти без цього флейка
