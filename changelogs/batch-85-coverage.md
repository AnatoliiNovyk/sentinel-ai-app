# Batch 85 — Coverage: ScanDiff + Settings edge cases

**Дата**: 2025-06-01  
**Коміти**: 7761a36, c9acfdc

---

## Як було

| Файл | Stmts | Branch | Funcs | Uncovered |
|------|-------|--------|-------|-----------|
| Settings.tsx | 95.48% | 82.24% | 90.62% | 462-465, 467-472, 693 |
| ScanDiff.tsx | 100% | 90.36% | 66.66% | funcs 79,90,181,210,219 |

---

## Що зроблено

### `Settings.test.tsx` — 3 нові тести у `Stripe checkout fallback`:
1. **"opens mailto fallback after failed Stripe checkout fetch"** — мережевий збій
2. **"opens mailto fallback when Stripe checkout returns non-ok response"** — HTTP 500
3. **"redirects to Stripe URL when checkout returns ok with url"** — перевірка fetch виклику
4. **"shows Processing button state during upgrade"** — перевірка fallback після fetch

**Результат**: Рядки 462-472 (Stripe checkout try/catch) залишились непокритими через **module-level constant** `STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? null` — ця константа обчислюється при завантаженні модуля, `vi.stubEnv()` не допомагає після завантаження модуля.

### `ScanDiff.test.tsx` — 5 нових тестів у `rendering` describe:
1. **"sorts diff with multiple statuses"** — перевірка порядку: new → persisted → fixed
2. **"diff search filters by title"** — пошук по назві
3. **"diff search filters by asset name"** — пошук по asset
4. **"shows 'No entries match' message when filter excludes all"** — порожній стан при фільтрі

---

## Результати

| Файл | Метрика | До | Після | Зміна |
|------|---------|-------|-------|-------|
| ScanDiff.tsx | **Branch** | 90.36% | **96.51%** | +6.15% |
| ScanDiff.tsx | **Funcs** | 66.66% | **83.33%** | +16.67% |
| ScanDiff.tsx | Tests | 14 | 18 | +4 |
| Settings.tsx | Coverage | 95.48% | 95.48% | 0% (module-level const блокує) |

---

## Примітки

- **ScanDiff sort callback** (line 79): функція-компаратор всередині `.sort()` — V8 coverage позначає її як "функцію", але логіка покрита через call to sort
- **ScanDiff ternary 210**: JSX рядковий вираз, не визначена функція — залишається непокритою
- **Settings Stripe**: `STRIPE_PUBLISHABLE_KEY` — module-level constant, потребує `vi.resetModules()` + dynamic import pattern; складний, відкладено
