# Phase 3 Strategic — TypeScript Strict Mode + Centralized HTTP Client

## Як було

- 38 TypeScript помилок при `tsc --noEmit` у strict-mode (`noUnusedLocals`, `noUnusedParameters`)
- Сирі виклики `fetch()` розкидані по 9 різних файлах без єдиного контракту
- Відсутній таймаут за замовчуванням — запити могли висіти нескінченно
- Відсутня централізована обробка HTTP помилок (кожен файл робив `if (!res.ok)` по-різному або ігнорував)
- Тест `aiGateway.test.ts` перевіряв `headers` як `Record<string, string>`, що не сумісно з `Headers` об'єктом

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

## Що покращило / виправило / додало

- **Безпека**: таймаут 30s за замовчуванням запобігає зависанню запитів
- **Надійність**: єдиний контракт обробки помилок (HttpError) замість 9 різних підходів
- **Підтримуваність**: додавання нового middleware (логування, retry) тепер в одному місці
- **TypeScript**: 0 помилок `tsc --noEmit` у strict-mode
- **Тести**: 2401/2401 проходять після всіх змін
