# Fix Vitest Configuration

## Як було
- Vitest config мав `'**/__tests__/**'` в `coverage.exclude`
- `include` патерн `'src/**/*.{test,spec}.{ts,tsx}'` не знаходив тести в папках `__tests__`
- Тести не виконувалися ("No test files found")

## Що зроблено
- Видалено `'**/__tests__/**'` з масиву `coverage.exclude`
- Додано `'src/**/__tests__/*.{test,spec}.{ts,tsx}'` до `include`
- Оновлено `vitest.config.ts`

## Що покращило/виправило
- Тепер Vitest бачить всі тести в папках `__tests__`
- Виправлено конфігурацію для правильного пошуку тестів
- Підготовлено до запуску тестів після виправлення терміналу
