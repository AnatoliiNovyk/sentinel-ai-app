Як було
- `src/components/ErrorBoundary.tsx` мав неповне тестове покриття для recovery/reset-поведінки, базового формату логування без context і прямого static branch.
- У `src/components/__tests__/ErrorBoundary.test.tsx` були базові сценарії, але бракувало окремих перевірок на ці гілки.

Що зроблено
- Додано тест на recovery-path: після натискання `Try again` boundary відновлює children, якщо child більше не кидає помилку.
- Додано тест на логування без context з префіксом `[ErrorBoundary]`.
- Додано тест, що custom fallback отримує `Error` і `reset` callback як аргументи.
- Додано тест прямого static branch: `getDerivedStateFromError` повертає `{ error }`.

Що покращило
- Розширено branch coverage для `ErrorBoundary` у critical error-handling гілках.
- Підвищено надійність перевірки recovery і fallback API контракту.
- Batch X виконано без змін production-коду, лише тести.
