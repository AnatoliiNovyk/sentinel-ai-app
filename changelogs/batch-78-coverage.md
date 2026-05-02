# Batch 78 — Coverage: VulnerabilityList, darkWebMonitor

**Дата**: 2025-06-01  
**Коміт**: 530736f

---

## Як було

| Файл | Stmts | Branch | Funcs |
|------|-------|--------|-------|
| `VulnerabilityList.tsx` | 100% | 77.77% | **40%** |
| `darkWebMonitor.ts` | **80.98%** | 90.66% | 87.5% |

---

## Що зроблено

### `VulnerabilityList.test.tsx`
Додано describe **"VulnerabilityList — severity filter pills"** (6 нових тестів):
- Показує pills тільки для severity що мають count > 0
- Клік на critical pill → фільтрує тільки critical vulns
- Повторний клік на ту ж pill → скидає до "all"
- Клік "All" → скидає фільтр
- При активному фільтрі → показує "N result(s)" лічильник
- Клік X (Clear search) → очищає пошук, всі vulns повертаються

### `darkWebMonitor.test.ts`
Додано `vi`, `afterEach` до imports.  
Додано describe **"DarkWebMonitorClient — HIBP API path"** (5 нових тестів):
- Мокує `VITE_HIBP_API_KEY` через `vi.stubEnv` + `vi.resetModules()` + dynamic import
- Мокує `global.fetch` через `vi.stubGlobal`
- **"uses HaveIBeenPwned v3 source"** — fetch повертає breach → sources=['HaveIBeenPwned v3']
- **"returns empty when HIBP returns 404"** — 404 = чисто, breachCount=0
- **"returns failure when fetch throws"** — catch branch (lines 398-399)
- **"maps exotic DataClasses"** — `Credit/Debit Cards`→`Credit cards`, `Social security numbers`→`SSNs`, `Auth Tokens`→`Session tokens`, невідомий клас→`PII`; HTML stripping у description
- **"HIBP non-ok non-404 throws"** — 500 error → failure result

**Ключова помилка що була виправлена**: Result type використовує `.data`, НЕ `.value`. Помилка `TypeError: Cannot read properties of undefined (reading 'sources')` виникала саме через `result.value.sources`.

---

## Що покращило / виправило / додало

| Файл | Stmts before | Stmts after | Funcs before | Funcs after |
|------|-------------|------------|--------------|------------|
| `VulnerabilityList.tsx` | 100% | 100% | **40%** | **100%** |
| `darkWebMonitor.ts` | **80.98%** | **100%** | 87.5% | **100%** |

- Покриті HIBP API гілки: `hibpBreachToEntry`, `fetchHibpBreaches`, HIBP path в `scan()`, catch block
- Тестів додано: 6 + 5 = **11 нових тестів**
- `passiveRecon.ts` (0% stmts) пропущено — файл містить лише `export {}`, код відсутній

---

**Наступні цілі (Batch 79)**:
- `connectionPool.ts` — 90.22% stmts (lines 148-254, 260-268) 
- `supplyChain.ts` — 97.37% stmts
- `agentTools.ts` — 97.2% stmts  
- `compliance.ts` — 97.93% stmts
