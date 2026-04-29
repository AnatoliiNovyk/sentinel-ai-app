# Batch-290 Changelog

## Що було

- Тести для компонентів: ConfirmDialog, Skeleton, ToastContainer, PresenceAvatars, CommandPalette — відсутні
- Тести для lib-модулів: commentService.ts, remediationService.ts — відсутні
- Загальна кількість тестів: 1111

## Що зроблено

### Нові тест-файли (7 штук):

**Компоненти:**
- `src/components/__tests__/ConfirmDialog.test.tsx` (9 тестів)
  - Рендер при `open=false/true`, confirmLabel за замовчуванням і кастомний
  - Натискання Cancel/Confirm, клік на overlay, Escape → onCancel, Enter → onConfirm
- `src/components/__tests__/Skeleton.test.tsx` (8 тестів)
  - `SkeletonBlock`: animate-pulse, className prop, aria-hidden="true"
  - `SkeletonCardGrid`: default/custom count, aria-busy="true"
  - `SkeletonList`, `SkeletonSidebar`: default/custom count
- `src/components/__tests__/ToastContainer.test.tsx` (6 тестів)
  - Нічого не рендерить без тостів, aria-live="polite" контейнер
  - Відображення тексту тосту, кілька тостів, Dismiss кнопка → removeToast
- `src/components/__tests__/PresenceAvatars.test.tsx` (5 тестів)
  - null при 0 користувачах, "{count} viewing", ініціали аватарів, кількість аватарів, передача contextType/contextId
- `src/components/__tests__/CommandPalette.test.tsx` (9 тестів)
  - Рендер при open=false/true, пошуковий input, список пунктів
  - Фільтрація по тексту/ключових словах, "No results", Escape → onClose, Enter → navigate+close, клік на backdrop

**Lib-модулі:**
- `src/lib/__tests__/commentService.test.ts` (10 тестів)
  - `getComments`: повертає [] при помилці, повертає коментарі з replies
  - `addComment`: успіх/помилка/parentId
  - `updateComment`: оновлення/помилка
  - `deleteComment`: успіх/помилка
- `src/lib/__tests__/remediationService.test.ts` (8 тестів)
  - `generateRemediation`: sql-injection, xss, rce категорії; generic fallback; cache hit
  - `clearRemediationCache`: очищення конкретного запису; очищення всього кешу

### Виправлення у тест-механіці:
- `vi.hoisted()` для remediationService mock (уникнення TDZ)
- `Element.prototype.scrollIntoView = vi.fn()` для CommandPalette (jsdom не реалізує scrollIntoView)
- Fluent mock chain з окремими terminal mocks для кожної операції (commentService)
- `getByText('Cancel')` замість `getByRole('button', { name: /cancel/i })` (ConfirmDialog має дві Cancel кнопки)
- Реальний jsdom localStorage замість `vi.stubGlobal` (remediationService)

## Що покращило / виправило / додало

- **+57 нових тестів**: 1111 → 1168 (100% pass)
- Повне покриття тестами 5 раніше непокритих компонентів
- Повне покриття тестами 2 раніше непокритих lib-модулів
- Комміт: `7ef3f40`
