# Changelog: ConfirmDialog branch coverage (Batch GS)

## Як було
`src/components/__tests__/ConfirmDialog.test.tsx` містив **12 тестів** у трьох describe-блоках:
- `ConfirmDialog — rendering` (4 тести)
- `ConfirmDialog — interactions` (5 тестів)
- `ConfirmDialog — focus trap (Tab key)` (3 тести)

Не були покриті:
- Клік по X-іконці (`aria-label="Cancel"`) в заголовку діалогу
- Наявність `aria-modal="true"` атрибуту на елементі `role="dialog"`
- Наявність SVG іконки `AlertTriangle` у заголовку

## Що зроблено
Додано новий `describe('ConfirmDialog — accessibility and icons')` з **3 новими тестами**:

1. `closes dialog via X icon button (aria-label="Cancel")` — перевіряє що клік по X-кнопці заголовку викликає `onCancel`
2. `dialog has aria-modal="true" attribute` — перевіряє ARIA-атрибут доступності на `role="dialog"` елементі
3. `renders AlertTriangle icon in dialog header` — перевіряє наявність `svg.lucide-alert-triangle` у DOM

## Що покращило / виправило / додало
- **Кількість тестів**: 12 → **15** (`+3`)
- **Загальний лічильник**: 2845 → **2848** тестів
- **Покриття**: додані гілки для X-кнопки закриття, ARIA атрибутів та іконки попередження
- **Quality gate**: 2848/2848 passed, exit 0, build OK
