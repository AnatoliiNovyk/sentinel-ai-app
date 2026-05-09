# Batch Z: AssetGraph branch coverage

## Як було
- Тести AssetGraph покривали базовий рендер SVG, empty-state, легенду та базову дедуплікацію активів.
- Не було окремої перевірки гілки агрегації severity по унікальному активу (коли в одного asset кілька findings з різними рівнями).
- Не було цільової перевірки гілок вибору іконок для різних патернів назви asset (db/s3/ec2/api/fallback).

## Що зроблено
- Оновлено [src/components/__tests__/AssetGraph.test.tsx](src/components/__tests__/AssetGraph.test.tsx):
  - додано тест агрегації карток статистики за правилом "найвища severity на asset";
  - додано тест для гілок `AssetIcon` з патернами `db`, `s3/bucket`, `ec2/node`, `api/gw` та fallback;
  - зафіксовано асерт для `Critical` через адресний вибір першого збігу (`getAllByText(...)[0]`), щоб уникнути конфлікту з однойменним елементом у легенді.
- Валідація:
  - focused: `npx vitest run src/components/__tests__/AssetGraph.test.tsx` -> `11 passed`;
  - повний quality gate: `npm run quality:check` -> `EXIT:0`.

## Що покращило
- Закрито додаткові branch-гілки логіки агрегації та icon mapping у AssetGraph без змін production-коду.
- Підвищено надійність перевірок для критичного сценарію дедуплікації активів із різною severity.
- Зменшено ризик регресій у візуальному відображенні типів активів (іконки за патерном назви).
