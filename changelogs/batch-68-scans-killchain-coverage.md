# Changelog — Batch 68: Scans + KillChain Coverage

## Як було
- `Scans.tsx` — functions: 83.33%, statements: 81.58%
- `KillChain.tsx` — functions: 77.77%, statements: 100%
- KillChain.test.tsx — 23 тестів

## Що зроблено

### Scans.test.tsx (commit a2f3123)
- Додано describe-блок "Scans — detail modal open/close" (4 тести):
  - Відкриття модального вікна через кнопку "View Details"
  - Закриття через кнопку X
  - Перевірка відсутності тексту ремедіації
  - CVE відображається як "N/A"
- Додано describe-блок "Scans — CSV export trigger" (1 тест):
  - Mock `document.createElement('a')` + `URL.createObjectURL`/`revokeObjectURL`
- Додано describe-блок "Scans — AI generation error" (1 тест):
  - `mockCallAiGateway.mockRejectedValueOnce` — обробка помилки AI

### KillChain.test.tsx (commit 0f1f244)
- Додано describe-блок "KillChain — export and clipboard" (3 тести):
  - Export Markdown → `downloadFile` викликається з `.md` + `text/markdown`
  - Export CSV → `downloadFile` викликається з `.csv` + `text/csv`
  - Copy to Clipboard → `navigator.clipboard.writeText` викликається
- Додано describe-блок "KillChain — clear filters via sort button" (1 тест):
  - Клік на "Phase order" → з'являється кнопка "Clear filters" → клік → зникає

## Що покращило / виправило / додало

### Scans.tsx
- Functions: **83.33% → 87.5%**
- Statements: **81.58% → 95.07%**
- Тестів: 36 → 42

### KillChain.tsx
- Тестів: 23 → 27
- Statements: **100%** (без змін)
- Functions: **77.77%** (V8 artifact — `useCallback` функції не реєструються V8 як окремі)

### Технічні уроки
- Кнопки в KillChain.tsx мають `title` атрибути ("Download Markdown", "Download CSV", "Copy as Markdown") замість текстового вмісту — тести повинні використовувати `getByTitle()` замість `getByRole(..., { name: /pattern/ })`
- Sort-кнопка для clear filters — "Phase order", а не "Phase"
