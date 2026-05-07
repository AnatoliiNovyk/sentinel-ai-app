# Batch Q: SettingsSubscription branch coverage

## Як було
- `src/pages/settings/SettingsSubscription.tsx` мав branch coverage **90.47%**.
- Непокритими залишались env-залежні гілки:
  - Stripe checkout path з валідним publishable key + price id,
  - fallback після checkout без `url`,
  - processing state під час in-flight upgrade,
  - billing portal path з налаштованим `VITE_STRIPE_PORTAL_URL`,
  - `ApiRateLimitsPanel` з fallback `profile.plan ?? 'free'`.

## Що зроблено
- Додано новий таргетований файл тестів [src/pages/__tests__/SettingsSubscription.env.test.tsx](src/pages/__tests__/SettingsSubscription.env.test.tsx).
- У тестах використано `stubEnv` + `resetModules` + динамічний import, щоб перевіряти гілки, які обчислюються на module-eval:
  - відкриття налаштованого Stripe billing portal URL;
  - рендер `ApiRateLimitsPanel` з fallback planId=`free`;
  - mailto fallback коли checkout успішний, але не повертає `url`;
  - `Processing...` state під час pending checkout request.
- Прогони:
  - `npx vitest run src/pages/__tests__/SettingsSubscription.env.test.tsx`
  - `npx vitest run src/pages/__tests__/Settings.test.tsx src/pages/__tests__/SettingsSubscription.env.test.tsx --coverage`
  - `npm run quality:check`

## Що покращило/виправило/додало
- `src/pages/settings/SettingsSubscription.tsx`:
  - Branches: **100%** (було 90.47%, **+9.53pp**)
  - Stmts: 100%
  - Funcs: 100%
  - Lines: 100%
- Додано вузькі env-oriented тести без змін production-коду.
- Закрито remaining subscription checkout/billing branches, які не покривались звичайними UI тестами.
