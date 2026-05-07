# Batch K — SettingsSubscription Branch Coverage

**Дата:** 2026-05-07
**Файли змінено:** `src/pages/__tests__/Settings.test.tsx`

---

## Як було

- `SettingsSubscription.tsx` branch coverage: **85.71%**
- Загальний branch coverage: **93.47%**
- Кількість тестів Settings.test.tsx: **94**
- Непокриті BRDA-гілки:
  - `if (profile)` false path (profile = null)
  - `plan === 'enterprise'` true branch в кольорі overview-картки
  - `planLabel` fallback для невідомого plan id (`?.label ?? plan` при PLANS.find() = undefined)
  - `handleUpgrade` early return для `selectedPlan.id === 'free'`
  - `p.badge && (...)` truthy path (badge "Most Popular" для pro plan)
  - upgrade buttons для non-active plans
  - `user && profile` conditional для `ApiRateLimitsPanel`

---

## Що зроблено

Додано 4 нові `describe`-блоки до `src/pages/__tests__/Settings.test.tsx`:

### 1. `Settings — SettingsSubscription profile null branch`
- Тест: рендер без краша коли `profile = null` (через `mockAuthState.profileOverride = null`)
- Покриває: `if (profile)` false path у `useEffect` (лінія 142, block=7, branch=1)

### 2. `Settings — SettingsSubscription enterprise plan active`
- Тест 1: enterprise як active план → "Current plan ✓" відображається
- Тест 2: `plan = 'unknown_plan_xyz'` → `planLabel` fallback на raw рядок (лінія 149, block=9, branch=1)
- Покриває: enterprise кольорова гілка overview картки (лінія 156), fallback ternary

### 3. `Settings — SettingsSubscription handleUpgrade early return for free`
- Тест: коли pro є активним планом → на картці free з'являється кнопка Upgrade → клік → `handleUpgrade` повертається негайно без `window.open`
- Покриває: `if (selectedPlan.id === 'free') return` true branch (лінія 183, block=14, branch=0)

### 4. `Settings — SettingsSubscription plan badge and button variants`
- Тест 1: badge "Most Popular" відображається для pro plan (лінія 318, block=27, branch=0)
- Тест 2: кнопки Upgrade видно коли enterprise є активним (лінія 336, non-active button path)
- Тест 3: `ApiRateLimitsPanel` не рендериться коли `user = null` (user && profile guard)

---

## Що покращило

| Метрика | До | Після |
|---------|-----|-------|
| SettingsSubscription.tsx branches | 85.71% | **90.47%** |
| Total branch coverage | 93.47% | **93.59%** |
| Settings.test.tsx тести | 94 | **101** (+7) |

- Всі 2697 тестів у suite проходять ✅
- `npm run quality:check` пройшов ✅ (lint + typecheck + tests + build)
