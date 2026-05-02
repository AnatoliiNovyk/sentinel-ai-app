# Batch 76 — Components Coverage (ConfirmDialog, SchedulesPanel, NotificationBell, CommandPalette)

**Commit:** `65ba565`
**Date:** 2026-05-01

---

## ConfirmDialog.tsx

### Як було
- Statements: 87.80% | Branches: 100% | Functions: 75% | Lines: 87.80%
- Непокриті рядки 44-53: `handleDialogKeyDown` — focus trap logic (Tab/Shift+Tab між кнопками Cancel/Delete)

### Що зроблено
- Додано `describe('ConfirmDialog — focus trap (Tab key)')` з 3 тестами:
  - Tab від останньої кнопки (Delete) → focus wrap до першої (Cancel)
  - Shift+Tab від першої кнопки (Cancel) → focus wrap до останньої (Delete)
  - Non-Tab key → нічого не відбувається

### Результат
- **Statements: 100% | Functions: 100% | Lines: 100%** (+12.2% stmts)

---

## SchedulesPanel.tsx

### Як було
- Statements: 90.98% | Branches: 85.41% | Functions: 57.14% | Lines: 90.98%
- Непокриті рядки 161-163: `onCreated` callback (закриття модалки + reload)
- Непокриті рядки 186-199: `save()` функція в `NewScheduleModal`
- Непокриті рядки 18-21: `cadenceLabel` з нестандартними значеннями

### Що зроблено
- Розширено `describe('SchedulesPanel — new schedule modal')` з 1 → 7 тестів:
  - Close/Cancel кнопки в модалці
  - Create Schedule — зберігає і закриває
  - Зміна cadence (кнопка "Every hour")
  - Зміна scanner через select
  - Зміна project через select
- Додано 3 тести для `cadenceLabel`: `Every 3h`, `Every 5d`, `37h`

### Результат
- **Statements: 100% | Functions: 100% | Lines: 100%** (+9% stmts)

---

## NotificationBell.tsx

### Як було
- Statements: 91.78% | Branches: 79.41% | Functions: 90.9% | Lines: 91.78%
- Непокриті рядки 78-82: UPDATE realtime handler
- Непокриті рядки 88-89: DELETE realtime handler
- Рядок 145: cleanup `removeEventListener` у `useEffect([open])`

### Що зроблено
- Додано `describe('NotificationBell — realtime channel callbacks')` з 5 тестами:
  - Реєстрація INSERT/UPDATE/DELETE handlers через `mockChannel.on.mock.calls`
  - UPDATE handler не кидає помилку при зміні notification
  - DELETE handler не кидає помилку при видаленні notification
  - INSERT handler з critical severity → flash animation (`animate-pulse`)
  - INSERT handler ігнорує дублікати (same id)

### Результат
- **Statements: 99.08% | Lines: 99.08%** (+7.3% stmts)

---

## CommandPalette.tsx

### Як було
- Statements: 96.87% | Branches: 89.47% | **Functions: 23.8%** | Lines: 96.87%
- 23.8% functions — критично низьке (нижче threshold 55%)
- Непокриті: `action` callbacks кожного із 15 navigation items, ArrowDown/Up updater functions

### Що зроблено
- Додано `describe('CommandPalette — item click navigation')` з 14+1 тестами:
  - `it.each(navigationItems)` — клік по кожному item → navigate до відповідного path
  - mouseEnter на item → оновлює активний index
- Додано ArrowDown, ArrowUp тести в keyboard describe:
  - ArrowDown → Enter → навігація до другого item
  - ArrowUp від 0 → залишається на 0
  - ArrowDown + ArrowUp → повертається до першого item

### Результат
- **Statements: 100% | Branches: 96.61% | Functions: 100% | Lines: 100%**

---

## Підсумок Batch 76

| Компонент | До (stmts) | Після (stmts) | До (funcs) | Після (funcs) |
|-----------|-----------|---------------|-----------|---------------|
| ConfirmDialog | 87.80% | 100% | 75% | 100% |
| SchedulesPanel | 90.98% | 100% | 57.14% | 100% |
| NotificationBell | 91.78% | 99.08% | 90.9% | 90.9% |
| CommandPalette | 96.87% | 100% | **23.8%** | **100%** |

**+49 нових тестів** (ConfirmDialog: +3, SchedulesPanel: +9, NotificationBell: +5, CommandPalette: +17 + Arrow: +3)
