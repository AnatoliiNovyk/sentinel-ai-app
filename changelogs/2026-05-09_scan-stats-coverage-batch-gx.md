# Changelog — Batch GX: ScanStats тест-покриття

## Як було
- `src/components/__tests__/ScanStats.test.tsx` містив **13 тестів**
- Не були перевірені: відсутність картки "Info", CSS-класи `border-*` на кожній картці, конкретні значення medium/low

## Що зроблено
Додано **3 нові тести** до `describe('ScanStats')`:

1. **`does not render a separate "Info" severity card`** — перевіряє, що `stats.info` приймається як prop, але не рендерить окрему картку з текстом "Info"
2. **`applies correct border class to each severity card`** — перевіряє CSS-класи `border-red-500/20`, `border-orange-500/20`, `border-yellow-500/20`, `border-blue-500/20`, `border-slate-700` на відповідних картках
3. **`displays correct medium and low counts`** — перевіряє, що значення `12` і `5` відображаються для medium і low severity

## Результат
- Кількість тестів: **13 → 16**
- Фокусний запуск: **16/16** пройшли
- `npm run quality:check`: **2863/2863 тестів**, EXIT:0, білд OK
