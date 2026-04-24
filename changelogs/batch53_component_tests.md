# Changelog — Batch 53: Component Tests (Sparkline + ScanDiff)

## Що було
- Тести тільки для lib/api; компоненти без покриття
- 662 тести, 39 тест-сьютів

## Що зроблено
- Створено `src/components/__tests__/Sparkline.test.tsx` — 10 тестів
  - Рендер SVG; null на порожніх даних; розміри за замовчуванням та кастомні; area/line path; два кола (dot + halo); кастомний колір stroke; одна точка без краху
- Створено `src/components/__tests__/ScanDiff.test.tsx` — 13 тестів
  - Empty state: 0/1 скан, non-completed скани
  - Класифікація: new/fixed/persisted знахідки
  - Summary pills: коректні лічильники (1 New / 1 Fixed / 1 Persisted)
  - Trend: "+2 new risks" / "2 fewer risks" / "No change"
  - Rendering: заголовок "Scan Diff", severity badge

## Що покращило
- **662 → 684 тести** (+22 нових), 39 → 41 тест-сьют
- `npm run quality:check` — exit code 0, всі 684 тести пройшли
