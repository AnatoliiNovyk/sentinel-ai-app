# Batch-300 Changelog

## Як було
- `toastContext.test.tsx`: 2 describe-блоки (useToasts + error boundaries), 6 тестів, без покриття `useToast()` хелперів
- `commentService.test.ts`: 9 тестів, без покриття `subscribeToComments`
- `remediationService.test.ts`: базові тести, без покриття 13 категорій шаблонів (ssrf, iam, s3, tls, secrets, container, csrf, path-traversal, auth, network, log4shell, webserver, outdated-package)
- `scanMock.test.ts`: 1 тест у `runMockScan` (тільки null case), без покриття lines 191-209 (topSeverity + notifications insert)

## Що зроблено
- `toastContext.test.tsx`: додано `describe('useToast helpers')` з 4 тестами — success/error/info/warning (рендерять combined hook, перевіряють toast у useToasts)
- `commentService.test.ts`: додано `describe('subscribeToComments')` з 2 async тестами — повертає unsubscribe function, викликає unsubscribe()
- `remediationService.test.ts`: додано 13 тестів категорій — кожен передає title/cve_id що відповідає категорії, перевіряє `steps.length > 0`
- `scanMock.test.ts`: рефакторинг mock — замінено inline `vi.fn()` у `vi.mock` на зовнішній `mockFrom`, додано тест "completes scan and returns scan id" з `vi.useFakeTimers()`, `Math.random` spy та `vi.runAllTimersAsync()`
- Commit: `4a3ff80` — pushed to origin/main

## Що покращило
- Кількість тестів: 1357 → 1377 (+20 тестів)
- Coverage для `toastContext.tsx` (useToast helpers branch), `commentService.ts` (subscribeToComments), `remediationService.ts` (всі шаблони), `scanMock.ts` (lines 191-209 — topSeverity + notifications.insert)
- Всі 99 test files pass, 1377/1377 passed
