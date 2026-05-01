# Batch 71 — Reports.test.tsx: coverage 96.83% → 99.88% statements

## Як було
- 51 тест, statements **96.83%**, branches **84.21%**, functions **87.71%**
- Непокриті рядки: 648-681 (markdownToHtml `##`/`###`/paragraph branches), 693-695 (inlineMd), 830 (saveTemplate early return), 884 (vulns query)

## Що зроблено

### Зміни в `Reports.test.tsx` (commit `974edc1`):

1. **Збагачено контент report у export-тестах**  
   Раніше: `'# Test\n\n- item one\n- item two'`  
   Тепер: `'# Test\n\n## Section\n\n### Subsection\n\nPlain paragraph here.\n\n- item one\n- item two\n\n1. ordered item\n\n**bold** and \`code\`'`  
   → Покриває `## ` heading (676-678), `### ` heading (679-681), plain paragraph/flushList (693-695)

2. **Додано `mockScansOrder` в `vi.hoisted()`**  
   + оновлено `vi.mock` для таблиці `scans` щоб використовувати `mockScansOrder`

3. **Новий тест: `local generation queries vulnerabilities when scans exist`**  
   → `mockScansOrder` повертає 1 скан → `scanIds.length > 0` → vulns query виконується (рядок 884)

4. **Новий тест: `copies share URL to clipboard when "Copy" clicked`**  
   → `navigator.clipboard.writeText` стабується → покриває `copy()` функцію (рядки 477-481)

5. **Новий тест: `printPdf writes to window when open returns a mock window`**  
   → `window.open` стабується з mock-об'єктом → покриває `w.document.write(html)` (рядки 520-526)

6. **Новий тест: `shows "No reports match your filters" when search yields no matches`**  
   → пошук без результатів → покриває рядки 333-338 + кнопку "Clear filters" у empty state

## Що покращило
- **Statements: 96.83% → 99.88%** (+3.05%)
- **Branches: 84.21% → 88.01%** (+3.8%)
- **Functions: 87.71% → 89.47%** (+1.76%)
- Тести: 51 → **55 тестів**, всі прохідні
- Єдиний залишок: рядок 830 (`if (!templateName.trim()) return;`) — недосяжний через UI (кнопка disabled)
- Commit: `974edc1`, pushed до `main`
