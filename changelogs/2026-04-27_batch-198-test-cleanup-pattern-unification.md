Як було:
- У `Projects.test.tsx` та `Reports.test.tsx` не було явного уніфікованого `afterEach` для `cleanup()` і `vi.clearAllMocks()`.
- Очищення стану між тестами покладалось на неявну поведінку середовища, що ускладнювало стабілізацію при довгих серіях прогонів.

Що зроблено:
- У src/pages/__tests__/Projects.test.tsx:
  - додано імпорти `cleanup` і `afterEach`;
  - додано глобальний для файлу `afterEach(() => { cleanup(); vi.clearAllMocks(); })`.
- У src/pages/__tests__/Reports.test.tsx:
  - додано імпорти `cleanup` і `afterEach`;
  - додано аналогічний `afterEach(() => { cleanup(); vi.clearAllMocks(); })`.

Що покращило/виправило/додало:
- Уніфіковано lifecycle очищення тестів між Dashboard/Projects/Reports.
- Зменшено ризик міжтестового протікання моків і DOM-стану в targeted stability прогонах.
- Перевірка після змін успішна: `npm run test:trio:stable` -> 3 files passed, 28 tests passed.
