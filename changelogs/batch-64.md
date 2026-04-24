# Batch 64 — Auth, NotFound, ProjectDetail tests

## Як було
- 916 тестів, 64 суїти
- Сторінки `Auth`, `NotFound`, `ProjectDetail` не мали тест-файлів

## Що зроблено

### Нові тест-файли

**`src/pages/__tests__/NotFound.test.tsx`** — 5 тестів
- Renders "404" heading
- Renders description text ("The page you are looking for...")
- Renders "has been neutralized or does not exist"
- Renders "Return to Base" link
- "Return to Base" link href = "/"

**`src/pages/__tests__/Auth.test.tsx`** — 10 тестів
- "Welcome back" heading (signin mode)
- Email input (via placeholder `you@company.com`)
- Password input (via placeholder `Minimum 6 characters`)
- "Sign in" submit button
- Sentinel AI brand text
- Error message shown on auth failure
- `signIn` called with email+password on form submit
- Clicking "Create one" switches to signup → "Create your account"
- Signup shows Full name field (placeholder `Jane Doe`)
- Signup shows "Create account" button

**`src/pages/__tests__/ProjectDetail.test.tsx`** — 9 тестів
- Project name rendered as heading
- "Back to projects" button exists
- Clicking "Back to projects" calls `onBack`
- "External" environment badge
- "Cloud" environment badge
- "Run scan" button
- Tab nav: overview, findings, scans, reports
- Clicking "findings" tab mounts FindingsTab
- Project description rendered

### Виправлення під час розробки
- Auth: `getByLabelText` → `getByPlaceholderText` (поля не мають `id` → `htmlFor` зв'язку)
- ProjectDetail: прибрано невикористані `mockScansEq` / `mockReportsEq` (ESLint `no-unused-vars`)

## Що покращило / виправило / додало
- **+24 тести** (916 → 940)
- **+3 суїти** (64 → 67)
- Покриття: всі сторінки крім `AppLayout` тепер мають тести
- `quality:check` проходить: ESLint 0 warnings, typecheck OK, 940/940, build OK
