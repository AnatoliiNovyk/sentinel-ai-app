# Batch 93 — ProjectDetail.tsx 100% покриття

## Як було
- `ProjectDetail.tsx` — 97.47% statements/lines
- Непокриті рядки: 124-125, 130-133, 183-184, 237-242, 245-251, 563
- 62 тести

## Що зроблено
1. Виявлено, що `vi.mock('../../lib/exporters')` мав неправильний шлях (`../lib/exporters`) → виправлено
2. Додано `mockDownloadFile` в спільний `vi.hoisted` блок
3. Додано тести в `Export dropdown` describe:
   - `clicking Findings as CSV with vulns` — з реальними даними сканів та вулн (рядки 183-184)
   - `clicking All Project Data with vulns and scans` — (рядки 237-242, 245-251)
4. Додано новий describe `ProjectDetail — remaining uncovered lines`:
   - `load() catch block` — мок кидає помилку, перевіряємо console.error (рядки 124-125)
   - `handleClickOutside` — відкриваємо dropdown і клікаємо по document.body (рядки 130-133)
   - `trend === 0 renders "No change" message` — два скани з однаковою кількістю вулн (рядок 563)
5. Видалено дублюючі describe блоки з `vi.hoisted` для downloadFile

## Що покращило
- `ProjectDetail.tsx`: 97.47% → **100% statements та lines**
- Тести: 62 → **67 тестів**
- Commit: `69bea1a`
