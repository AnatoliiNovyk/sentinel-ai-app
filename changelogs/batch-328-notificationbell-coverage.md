# Batch-328: NotificationBell coverage improvement

## Як було
- `src/components/__tests__/NotificationBell.test.tsx`: 11 тестів
- Coverage: Lines **78.08%**, Branches **71.11%**, Functions **36.36%**
- Покривались лише: closed state (badge, 9+), open popover (empty/titles/markAllRead enabled/disabled)

## Що зроблено
Додано 11 нових тестів у 5 нових describe-блоках:

### `NotificationBell — markAllRead`
- Клік "Mark all read" викликає `supabase.update`
- Після `markAllRead` кнопка стає `disabled` (unread=0)

### `NotificationBell — onItemClick`
- Клік на непрочитане: викликає `update` + navigate `/scans`
- `link=dashboard` → navigate `/`
- Невалідний `link` → navigate не викликається
- Вже прочитане → `update` не викликається

### `NotificationBell — dismiss`
- Клік на X видаляє сповіщення з DOM
- Клік на X викликає `supabase.delete`

### `NotificationBell — iconFor and severity badges`
- Критичний severity badge у header
- Warning severity badge у header
- Тип `report_ready` рендериться
- Тип `critical_finding` рендериться

### `NotificationBell — popover close on outside click`
- `mouseDown` поза popover закриває панель

## Що покращило
- Lines: **78.08% → 91.78%** (+13.7 pp)
- Branches: **71.11% → 79.41%** (+8.3 pp)
- Functions: **36.36% → 90.9%** (+54.5 pp)
- Commit: `4064419`, pushed to main
