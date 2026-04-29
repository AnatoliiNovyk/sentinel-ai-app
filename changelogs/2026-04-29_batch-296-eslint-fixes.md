# Changelog — Batch-296 (2026-04-29)

**Commit:** 72ae146  
**Branch:** main

---

## eslint.config.js (MODIFIED)

### Як було
Не було явного правила `@typescript-eslint/no-unused-vars` з дозволом для `_`-префіксованих імен. За замовчуванням typescript-eslint flagging `_table`, `_` та подібні навіть якщо вони навмисно ігноруються.

### Що зроблено
Додано явне правило:
```js
'@typescript-eslint/no-unused-vars': ['error', {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
}],
```

### Що покращило
Стандартна конвенція `_` для навмисно невикористаних змінних тепер підтримується без помилок.

---

## src/components/__tests__/ErrorBoundary.test.tsx (MODIFIED)

### Як було
- Імпорт `Component` та `ReactNode` з `'react'` — обидва не використовувались у тестах
- `CustomBomb` функція оголошена (рядок 23) але жоден тест її не викликав
- `// eslint-disable-line no-unreachable` — eslint-disable для правила, яке не порушувалось (warning: unused directive)

### Що зроблено
- Видалено `import { Component, type ReactNode } from 'react'`
- Видалено `CustomBomb` функцію разом з `// eslint-disable-line no-unreachable`

### Що покращило
3 ESLint errors + 1 warning усунуто; тестовий файл чистіший.

---

## src/lib/__tests__/riskScore.test.ts (MODIFIED)

### Як було
`recomputeProjectRiskScore` імпортувався в рядку 6 але жодного разу не використовувався у тестах.

### Що зроблено
Видалено `recomputeProjectRiskScore` з деструктуруючого імпорту.

### Що покращило
1 ESLint error усунуто.

---

## src/pages/__tests__/Notifications.test.tsx (MODIFIED)

### Як було
`_table: string` параметр у mock-функції `from` не використовувався, ESLint flagging його як unused.

### Що зроблено
Перейменовано `_table` → `_` (стандартний placeholder для навмисно ігнорованого параметра).

### Що покращило
1 ESLint error усунуто.

---

## src/pages/__tests__/Reports.test.tsx (MODIFIED)

### Як було
`mockUpdateEq` оголошувався у `vi.hoisted()` але жоден тест його не використовував (немає mock суперечностей у Reports).

### Що зроблено
Видалено `mockUpdateEq` з деструктуруючого оголошення та з об'єкту `vi.hoisted()`.

### Що покращило
1 ESLint error усунуто.

---

## src/pages/Integrations.tsx (MODIFIED)

### Як було
У GitLab CI YAML шаблоні (template literal) 3 рази використовувався `\$` для екранування `$`. Всередині JS template literal `$` без `{` не потребує екранування.

### Що зроблено
Замінено `\$` → `$` у 3 рядках (CRITICAL= та двох посиланнях на змінну).

### Що покращило
3 `no-useless-escape` ESLint errors усунуто.

---

## Підсумок

| Файл | Виправлено |
|------|-----------|
| eslint.config.js | додано `argsIgnorePattern: '^_'` |
| ErrorBoundary.test.tsx | -2 unused imports, -1 unused function, -1 unused disable |
| riskScore.test.ts | -1 unused import |
| Notifications.test.tsx | `_table` → `_` |
| Reports.test.tsx | -1 unused mock var |
| Integrations.tsx | `\$` → `$` ×3 |
| **ESLint errors** | **0 (було 9)** |
| Тести | 1315/1315 passed |
