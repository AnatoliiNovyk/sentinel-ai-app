# Batch 70 — Activity.test.tsx: mock fix + coverage improvement

## Як було
- `Activity.test.tsx` мав 27 тестів, але 2 з них падали з `TypeError: q.eq is not a function`
- Покриття: statements **92.97%**, branches **86.42%**, functions **86.36%**, lines **92.97%**
- Непокриті рядки: 497, 524-532, 675, 677
- Причина: мок Supabase `range()` повертав звичайний `Promise`, а `Activity.tsx` робить умовне ланцюгування `.eq()` після `range()` — `Promise.prototype.eq` не існує

## Що зроблено

### Fix 1: Chainable mock для `range()` (commit `55512e2`)
- `mockRange` змінено з `vi.fn().mockResolvedValue(...)` → `vi.fn().mockReturnValue(...)` (синхронне)
- Мок `range()` в Supabase stub тепер повертає chainable thenable об'єкт:
  ```typescript
  range: (...args) => {
    const result = mockRange(...args);
    const chain = {
      eq: (..._) => chain,
      then: (resolve, reject?) => Promise.resolve(result).then(resolve, reject),
      catch: (fn) => Promise.resolve(result).catch(fn),
      finally: (fn) => Promise.resolve(result).finally(fn),
    };
    return chain;
  }
  ```
- Всі 7 `mockRange.mockResolvedValue(...)` у тестах замінено на `mockRange.mockReturnValue(...)`

### Fix 2: Нові тести для непокритих рядків (commit `addbc9e`)
Додано 3 нові тести в блоці `Activity — anomaly edge cases`:
1. **Error spike** (рядок 497) — 20 помилок в одну годину + 9 базових годин з 1 помилкою → спрацьовує `cnt > mean+2σ` умова
2. **Elevated warning rate** (рядки 524-532) — 10+ логів за 6 годин де 60% є `warn` → спрацьовує high warn rate аномалія
3. **Heatmap render** (рядки 675, 677) — логи з error і warn рівнями → heatmap відображається з кольоровими клітинками

## Що покращило
- Всі 2 падаючих тести виправлено — тепер **30 тестів, всі прохідні**
- Покриття statements: **92.97% → 98.16%** (+5.19%)
- Покриття branches: **86.42% → 88.69%** (+2.27%)
- Commits: `55512e2` (mock fix), `addbc9e` (нові тести), pushed до `main`
