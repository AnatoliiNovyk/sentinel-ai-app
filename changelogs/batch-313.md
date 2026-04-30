# Batch-313: Auth.tsx coverage improvement

## Як було
- `Auth.tsx` — **75.73%** ліній, **66.66%** функцій, **75%** гілок
- Непокриті ділянки: sign up branch (рядки 21-30, 40, 119-152), password strength logic, visibility toggle, navigation back
- Загальна кількість тестів: **1545**

## Що зроблено
- Додано **+14 нових тестів** у `src/pages/__tests__/Auth.test.tsx` у 3 нових describe-групах:

| Група | Тести |
|---|---|
| Auth — Sign Up mode (доповнення) | 9 |
| Auth — password visibility toggle | 2 |
| Auth — navigation | 2 |

Покриті гілки:
- `signUp()` з fullName — успіх та помилка
- `getPasswordStrength()` — всі три рівні: weak / fair / strong
- Чек-індикатори: "At least 8 characters", "Uppercase letter", "Number"
- Toggle показу паролю (Eye/EyeOff)
- `navigate('/landing')` при кліку "Back"
- Security badges (AES-256 / Zero-knowledge / SOC 2)
- Перемикання signup → signin через "Sign in" link

## Що покращило / виправило / додало
- `Auth.tsx` ліній: **75.73% → 100%** (+24.27 п.п.)
- `Auth.tsx` функцій: **66.66% → 100%** (+33.34 п.п.)
- `Auth.tsx` гілок: **75% → 98.55%** (+23.55 п.п.)
- Загальна кількість тестів: **1545 → 1558** (+13)
- Commit: `2ac4917` — pushed to main

## Наступні кандидати (Batch-314+)
- **Scheduler.tsx**: 77.09% (lines 437-441, 465, 477)
- **Activity.tsx**: 78.59% (lines 726-727, 731-752)
- **SupplyChain.tsx**: 80.95% (lines 426-428, 476-489)
