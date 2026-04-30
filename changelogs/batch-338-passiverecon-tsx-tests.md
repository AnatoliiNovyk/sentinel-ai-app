# Batch-338: PassiveRecon.tsx — coverage improvement

## Як було
- `src/pages/__tests__/PassiveRecon.test.tsx`: 30 тестів у 3 describe-блоках
- Coverage: Lines **94.39%**, Branches **87.09%**, Functions **83.33%**
- `useAuth` mock: статичний фіксований об'єкт, не можна перевизначати на рівні тесту
- Відсутні тести: running-стан, clear-all-history, user=null guard

## Що зроблено
1. **`vi.hoisted()` для `mockUseAuth`** — перенесли mock до `vi.hoisted()`, щоб можна було перевизначати значення для окремих тестів (наприклад, `user: null`)
2. **Новий тест "Clear all history"** — виконується 2 скани поспіль на одному рендерованому компоненті → `history.length > 1` → з'являється кнопка "Clear all history" → натиснення очищає всю историю (покриває рядки 367-374)
3. **Новий describe "running state display"** — тест перевіряє текст "Scanning ports..." під час проміжного стану `status === 'running'` (після першого `setTimeout(2000ms)`) — покриває рядки 232-239
4. **Новий describe "no user (unauthenticated)"** — `mockUseAuth.mockReturnValue({ user: null })` → сканування не запускається (`handleScan` повертається одразу через guard `!user`) — покриває умовну гілку в рядку 103
5. **`afterEach` import** — додано `afterEach` у список імпортів

## Що покращило / виправило / додало
- Тести: **27** (було ~30 — але додано 4 нові тести + 1 що переписали `beforeEach`)
  - Насправді: **+4 нові тести** у 2 нових describe-блоках
- Coverage `PassiveRecon.tsx`:
  - Lines: **94.39% → 96.57%** (+2.18%)
  - Branches: **87.09% → 89.69%** (+2.6%)
  - Functions: **83.33% → 91.66%** (+8.33%)
- Залишаються непокриті:
  - Lines 306-308: `{error && ...}` — потребує catch-шляху в handleScan (setTimeout не кидає помилок у реальних умовах)
  - Lines 345-347: `{highCount > 0 && critCount === 0 && ...}` — мертвий код з поточним MOCK_PORTS (завжди є критичні порти)

## Commit
`1c2db1b` pushed to main
