# Batch AA: FindingsTab branch coverage

## Як було
- Набір тестів FindingsTab вже був широким, але залишались неявно перевірені гілки в сценаріях breakdown/масових дій.
- Не було окремого тесту на fallback-ключ asset `"(unknown)"`, коли `asset` порожній.
- У bulk action bar були перевірки для `Resolve`, `False positive`, `In progress`, але не було окремого сценарію для `Accept risk` і явного сценарію кнопки очищення вибору.

## Що зроблено
- Оновлено [src/components/__tests__/FindingsTab.test.tsx](src/components/__tests__/FindingsTab.test.tsx):
  - додано тест `uses "(unknown)" asset bucket when asset is empty`;
  - додано тест `calls bulkChangeStatus with accepted risk`;
  - додано тест `clears selection via bulk clear button`.
- Валідація:
  - focused: `npx vitest run src/components/__tests__/FindingsTab.test.tsx` -> `53 passed`;
  - full quality gate: `npm run quality:check` -> `EXIT:0`.

## Що покращило
- Закрито додаткові branch-гілки в логіці розбиття по активах та bulk-діях.
- Підсилено регресійний захист для UX-сценаріїв triage: fallback asset та керування вибіркою.
- Збережено підхід без змін production-коду: лише тестовий пакет і контроль якості.
