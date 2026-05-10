# Batch GHF - Sparkline coverage

## Як було
- У файлі Sparkline.test.tsx було 13 тестів.
- Не вистачало перевірок для fallback fillColor, атрибута strokeWidth лінії та кастомного viewBox.

## Що зроблено
- Додано 3 тести у Sparkline.test.tsx:
1. uses color as gradient stop-color when fillColor is not provided
2. applies custom strokeWidth to the line path
3. uses custom width and height in viewBox

## Що покращило
- Краще покрито рендеринг SVG-атрибутів та fallback-логіку градієнта.
- Підтверджено коректність пропів відображення для ширини/висоти та товщини лінії.

## Перевірки
- Focused: Sparkline.test.tsx 16/16 passed.
- quality:check: 2887/2887 passed.
- build: passed.
