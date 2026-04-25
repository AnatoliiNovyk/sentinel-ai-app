# Batch 69 — App.tsx routing тести

## Як було
- `src/App.tsx` (головний routing компонент) не мав жодного тесту.
- Маршрутизація між сторінками та логіка redirect не була покрита.
- Загальний стан: 1000 тестів, 75 suite-файлів.

## Що зроблено
Створено `src/__tests__/App.test.tsx` з 9 тестами:

### Loading state (2 тести)
- Показує loading spinner при `isLoading=true`.
- Не рендерить content при завантаженні.

### Share token routing (2 тести)
- Визначає share token у `window.location.search` та рендерить `PublicReport`.
- Публічний звіт доступний без автентифікації.

### Unauthenticated routing (3 тести)
- Рендерить `Landing` сторінку на `/landing`.
- Рендерить `Auth` сторінку на `/auth`.
- Рендерить `PublicReport` на `/report/:id/public`.

### Authenticated routing (2 тести)
- Рендерить `Dashboard` на `/dashboard` для авторизованого користувача.
- Рендерить `AppLayout` wrapper для захищених роутів.

## Технічні рішення
- **`vi.hoisted()`** для `useAuth` mock — забезпечує підняття до топу файлу.
- **`window.history.pushState()`** для навігації в jsdom перед рендером.
- **`vi.stubGlobal('location', ...)`** + `vi.unstubAllGlobals()` для share token тестів.
- Всі 18+ сторінок замінено stub компонентами щоб уникнути transitive залежностей.

## Що покращило / виправило / додало
- **+9 тестів** (1000 → 1009): покриття App.tsx routing логіки.
- 76 suite-файлів.
- `npm run quality:check` → exit 0.
