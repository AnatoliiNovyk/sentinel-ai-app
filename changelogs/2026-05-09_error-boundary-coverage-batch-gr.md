# Batch GR - ErrorBoundary Coverage Expansion (2026-05-09)

## Як було
- У `src/components/__tests__/ErrorBoundary.test.tsx` було 12 тестів.
- Не вистачало перевірок для іконок fallback-UI та класів контейнерів fallback-стану.
- Додані раніше перевірки мали нестабільний DOM-пошук і спричиняли падіння.

## Що зроблено
- Додано 3 таргетовані тести для `ErrorBoundary`:
  - перевірка рендеру іконки `AlertTriangle` у fallback-UI;
  - перевірка рендеру іконки `RefreshCw` в кнопці `Try again`;
  - перевірка класів стилізації зовнішнього й внутрішнього контейнерів fallback-стану.
- Виправлено DOM-асерти на стабільні селектори і безпечну навігацію по вузлах (`parentElement` + null-guards).
- Усунуто TypeScript nullability-проблеми в нових тестах.
- Проведено валідацію:
  - focused `vitest` для `ErrorBoundary`: 15/15;
  - full `quality:check`: 2845/2845, build успішний.

## Що покращило/виправило/додало
- Підвищено покриття гілок `ErrorBoundary` для fallback-UI.
- Прибрано нестабільність тестів через крихкі `closest(...)` ланцюжки.
- Збережено зелену якість проєкту після змін (lint/typecheck/tests/build).
