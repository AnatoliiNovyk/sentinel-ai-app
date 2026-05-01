# Batch 74 — Settings.tsx Coverage Improvement

## Що було
- Settings.test.tsx: 53 тести, coverage **95.16%** stmts / **80.58%** branches / **87.5%** funcs
- `useAuth()` мок використовував локальну константу `_profile` з `plan: 'free'` — неможливо перемикати plan між тестами
- Непокриті гілки: Manage billing button для paid plan, openBillingPortal fallback

## Що зроблено
1. Рефакторинг `vi.hoisted()` — додано `mockAuthProfile` як мутабельний об'єкт до hoisted-scope
2. `vi.mock('../../context/useAuth')` оновлено — повертає `mockAuthProfile` динамічно замість hardcoded `_profile`
3. Додано **describe: Settings — paid plan billing portal**:
   - renders Manage billing button when plan is pro
   - clicking Manage billing opens window.open with mailto fallback
   - renders Manage billing button when plan is basic
   - does not render Manage billing button when plan is free
4. Додано **describe: Settings — Stripe checkout fallback**:
   - opens mailto fallback after failed Stripe checkout fetch (Network error)
   - opens mailto fallback when Stripe checkout returns non-ok response

## Результат
- Settings.test.tsx: **59 тестів** (+6), всі pass
- Coverage Settings.tsx: **95.79%** stmts (+0.63pp) / **82.01%** branches (+1.43pp) / **90.62%** funcs (+3.12pp)
- Commit: `5f95c31` — pushed to main
