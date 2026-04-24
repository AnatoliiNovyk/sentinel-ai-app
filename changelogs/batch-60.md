# Changelog — Batch 60

## Що було
- 816 тестів (53 суіти) після Batch 59
- Відсутні тести для сторінок Integrations та KillChain

## Що зроблено
- Створено `src/pages/__tests__/Integrations.test.tsx` (12 тестів)
- Створено `src/pages/__tests__/KillChain.test.tsx` (9 тестів)
- Виправлено: `getAllByText(/Active Scanning/i)` (regex) замість точного збігу — текст рендериться як "MITRE TACTIC: Active Scanning" всередині span-елемента

## Результат
- 837 тестів, 55 суітів — усі проходять
- `npm run quality:check` → exit code 0
- Build успішний (10.03s)
