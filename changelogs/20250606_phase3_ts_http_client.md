# Phase 3 Strategic — TypeScript Strict Mode + Centralized HTTP Client + Versioned localStorage

## Як було

- 38 TypeScript помилок при `tsc --noEmit` у strict-mode (`noUnusedLocals`, `noUnusedParameters`)
- Сирі виклики `fetch()` розкидані по 9 різних файлах без єдиного контракту
- Відсутній таймаут за замовчуванням — запити могли висіти нескінченно
- Відсутня централізована обробка HTTP помилок (кожен файл робив `if (!res.ok)` по-різному або ігнорував)
- Тест `aiGateway.test.ts` перевіряв `headers` як `Record<string, string>`, що не сумісно з `Headers` об'єктом
- localStorage використовував сирий JSON без версіонування — стара версія даних тихо корумпує стан при оновленні схеми
- Покриття гілок: 89.5%

## Що зроблено

### 1. Виправлено всі TypeScript помилки (commit `5d806c8`)

- `src/lib/supabase.ts` — додано optional поля `Vulnerability.cve?`, `cvss?`, `project_id?`, `Scan.target?`; `remediation_code: string | null`
- `src/lib/compliance.ts` — `MitreRow.score: number` (обов'язкове поле) + обчислення у `mitreRows`
- `tsconfig.app.json` — `"lib": ["ES2020", "ES2022", "DOM", "DOM.Iterable"]` для `.at()` методу
- Виправлено типи та невикористані змінні у 12+ тестових файлах
- Оновлено Supabase `.channel()` API в тестах (замість старого `.from().on()`)

### 2. Централізований HTTP клієнт (commit `a3edad1`)

**Новий файл `src/lib/httpClient.ts`:**
- `HttpError` клас з `.status` полем
- `httpFetch(url, options)` — додає таймаут 30s, auth token, Content-Type автоматично; кидає `HttpError` для non-2xx
- `httpPost<T>(url, body, options)` — зручна обгортка для POST з JSON парсингом
- `HttpClientOptions` — інтерфейс з `timeoutMs?`, `token?`

**Мігровано 9 файлів:**
| Файл | Зміна |
|------|-------|
| `src/lib/aiGateway.ts` | `httpPost` + `HttpError` замість сирого `fetch` |
| `src/lib/scanDispatch.ts` | `httpPost` + додано відсутній `import supabase` |
| `src/lib/otelCollector.ts` | `httpFetch` (без зберігання response) |
| `src/lib/darkWebMonitor.ts` | `httpFetch` + HIBP 404 через `HttpError` |
| `src/lib/cveEnrichment.ts` | `httpFetch` + прибрано ручний `if (!res.ok)` |
| `src/lib/supplyChain.ts` | `httpPost` + прибрано ручний `if (!res.ok)` |
| `src/pages/Reports.tsx` | `httpPost` для Edge Function виклику |
| `src/pages/Settings.tsx` | `httpPost` для Stripe checkout |
| `src/lib/__tests__/aiGateway.test.ts` | Фікс перевірки headers через `Headers` об'єкт |

### 3. localStorage Schema Versioning (commit `58cf614`)

**Новий файл `src/lib/storage.ts`:**
- `loadVersioned<T>(key, version, fallback)` — читає `{ _v: version, data: T }` з localStorage; поветає fallback якщо версія не співпадає
- `saveVersioned<T>(key, version, data)` — пише `{ _v: version, data: T }` до localStorage; ігнорує quota errors

**Мігровано 4 сторінки (+ тести):**
| Модуль | Ключ | Версія |
|--------|------|--------|
| `src/pages/Integrations.tsx` | `sentinel_service_configs`, `sentinel_webhooks` | `v1` |
| `src/pages/Reports.tsx` | `report_templates` | `v1` |
| `src/pages/PassiveRecon.tsx` | `reconHistory` | `v1` |
| `src/pages/DarkWebMonitor.tsx` | `osintScanHistory` | `v1` |

**Оновлено 4 тест-файли:**
- Додано helper функції `seedVersioned()` і `readVersioned()`
- Всі 118 тестів Integrations, 56 Reports, 2 PassiveRecon, 2 DarkWebMonitor проходять

## Що покращило / виправило / додало

- **Безпека**: таймаут 30s за замовчуванням запобігає зависанню запитів
- **Надійність**: єдиний контракт обробки помилок (HttpError) замість 9 різних підходів
- **Підтримуваність**: додавання нового middleware (логування, retry) тепер в одному місці
- **Еволюція даних**: версіонування localStorage запобігає корупції даних при оновленні схеми
- **TypeScript**: 0 помилок `tsc --noEmit` у strict-mode ✅
- **Тести**: 2401/2401 проходять після всіх змін ✅
- **Покриття гілок**: 89.5% → 93.44% (+3.94%) 📈

## Наступні кроки

- **Branch coverage 93.44% → 95%+**: Потребує +1.56% — 5-10 мікротестів на error paths
- **God objects рефакторинг**: Dashboard (1545 LOC), Integrations (1395 LOC), Settings (1156 LOC) — високий ризик, велика робота

