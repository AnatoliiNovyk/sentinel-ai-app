# Batch 67 — AuthContext provider + useAuth hook tests

## Як було
- 972 тести, 71 суїт
- `src/context/AuthContext.tsx` + `src/context/useAuth.ts` не мали тест-файлів

## Що зроблено

**`src/context/__tests__/AuthContext.test.tsx`** — 8 тестів

### useAuth hook
- Throws error when used outside AuthProvider

### AuthProvider component
- Renders children
- signIn calls supabase.auth.signInWithPassword
- signIn returns { error: null } on success
- signIn returns error message on failure
- signUp calls supabase.auth.signUp with full_name in options
- signUp returns { error: null } on success
- signOut calls supabase.auth.signOut

**Мокування**: `vi.hoisted()` з усіма mock-функціями для supabase.auth та supabase.from()

## Що покращило / виправило / додало
- **+8 тестів** (972 → 980)
- **+1 суїт** (71 → 72)
- Весь context/useAuth покритий тестами
- Всі основні auth операції (signIn, signUp, signOut) тестовані
- quality:check: ESLint 0 warnings, typecheck OK, 980/980 tests, build OK
