# Batch-340: AttackSurfaceMap.tsx Test Improvements

## Що було
- AttackSurfaceMap.test.tsx: 43 tests (всі проходять)
- Проблема: 1 тест падав — `SVG has correct viewBox dimensions` — `document.querySelector('svg')` знаходив SVG іконку (24x24) замість головного SVG графа (900x600)

## Що зроблено
1. Додано `waitForElementToBeRemoved` import з `@testing-library/react`
2. Тест `SVG has correct viewBox dimensions` переписано:
   - Тепер окремо чекає `waitForElementToBeRemoved` на спінер завантаження
   - Потім шукає `document.querySelector('svg[height="600"]')` — головний SVG має висоту 600px, іконки 24px
   - Перевіряє `viewBox="0 0 900 600"` як атрибут (не як query)
3. Таким чином тест став специфічнішим і не залежить від порядку DOM елементів

## Покращення
- Всі 43 тести проходять стабільно
- Тепер тест правильно очікує на головний SVG графу, а не будь-який SVG елемент
- Додано import `waitForElementToBeRemoved` для коректного очікування видалення спінера

## Мітка
- commit: `2af7e44`
- Branch: main
- Files: src/pages/__tests__/AttackSurfaceMap.test.tsx
