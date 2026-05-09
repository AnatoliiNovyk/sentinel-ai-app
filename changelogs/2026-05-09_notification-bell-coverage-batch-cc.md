# NotificationBell Branch Coverage Expansion (Batch CC)

## Як було:
- NotificationBell component тестувався з ~82-85% branch coverage (28 тестів)
- Браки покриття для: `iconFor()` default case (unknown type), `SEVERITY_STYLES` fallback для невідомих severity, success/info severity badges
- Функціональність с c8 ignore comments не мала тестового покриття

## Що зроблено:
- Додано 4 нові test case в `src/components/__tests__/NotificationBell.test.tsx`:
  1. **iconFor fallback** (1 тест):
     - "renders default Bell icon for unknown notification type (iconFor fallback)" — перевіряє, що невідомий тип повертає Bell icon без помилок

  2. **SEVERITY_STYLES fallback** (1 тест):
     - "renders notification with unknown severity using fallback (SEVERITY_STYLES fallback)" — тестує fallback для невідомої severity

  3. **Success severity badge** (1 тест):
     - "shows success severity badge in header" — охоплює success severity в header badge panel

  4. **Info severity badge** (1 тест):
     - "shows info severity badge in header" — охоплює info severity в header badge panel

- Усі 4 нові тести успішно проходять разом з 28 існуючими (всього 32/32 тестів)
- Нова описова test suite: "NotificationBell — branch coverage (c8 ignore paths)" для явної організації покриття

## Що покращило:
- NotificationBell branch coverage підвищено захистом `iconFor()` fallback за невідомих типів
- Unknown severity handling тестується (fallback to info styles)
- Success/info severity badges тепер мають явне тестове покриття
- Всі c8 ignore коментарі мають асоційовані test case
- Фокусований vitest run: **32/32 PASSED** (~0.68s duration) ✅
- Zero regressions у існуючих 28 тестів
