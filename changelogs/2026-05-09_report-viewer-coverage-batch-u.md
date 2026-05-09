Як було
- `src/components/ReportViewer.tsx` мав незакриті branch-path у взаємодіях клавіатури, backdrop-click та share-link reset.
- `src/components/__tests__/ReportViewer.test.tsx` уже покривав основний happy-path, але не бив по кількох негативних гілках.

Що зроблено
- Додано тести на non-Escape keydown і клік усередині контенту модалки без закриття.
- Додано тест на reset стану `Link copied!` після таймера для вже існуючого public link.
- Додано окремий тест для раннього виходу з `handleShare`, коли `sharing` уже `true`, через локальний dynamic-import mock React state.
- Підчищено `act(...)` warning у share-guard тесті.

Що покращило
- Піднято branch coverage для `ReportViewer` і добито критичні негативні гілки взаємодій.
- Тести стали стабільнішими та чистішими по React state updates.
- Batch U залишається тестовим, без змін production-коду.
