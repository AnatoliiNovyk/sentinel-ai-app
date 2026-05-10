# Changelog: ConfirmDialog Branch Coverage (Batch GHH)

## Як було
- `src/components/__tests__/ConfirmDialog.test.tsx` містив **15 тестів**.
- Не покрито: атрибут `aria-labelledby`, stopPropagation при кліку всередині dialog, CSS клас `bg-red-600` на кнопці підтвердження.

## Що зроблено
Додано **3 нові тести** у новому describe блоці `ConfirmDialog — additional coverage`:
1. `dialog has aria-labelledby="confirm-dialog-title" attribute` — перевіряє ARIA-атрибут зв'язку заголовку з діалогом.
2. `clicking inside dialog does not call onCancel (stopPropagation)` — перевіряє що клік всередині dialog не бульбашкує до backdrop.
3. `confirm button has bg-red-600 class` — перевіряє червону CSS-стилізацію кнопки підтвердження.

## Що покращило / виправило / додало
- Тестів: 15 → **18** (+3)
- Нові describe-блок: `ConfirmDialog — additional coverage`
- `quality:check`: **2893/2893** (було 2890)
- Commit: `0ab819d`
