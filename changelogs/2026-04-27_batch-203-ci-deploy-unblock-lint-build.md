# Batch 203: Розблокування CI для деплою

## Як було
- Деплой блокувався червоним quality gate: `eslint` падав на error/warning, а `build` падав на некоректні імпорти `useAuth`.
- Додатково були локальні accessibility/React hooks/unused/no-explicit-any порушення у кількох сторінках і компонентах.

## Що зроблено
- Виправлено accessibility-атрибути для icon-only кнопок/селектів у `Projects` і `Reports`.
- Усунено build-блокери імпортів `useAuth` у `PresenceContext` і `CommentThread`.
- Закрито lint-помилки по `unused imports/vars`, `no-explicit-any`, `no-unused-expressions`, `react-hooks/rules-of-hooks`, `exhaustive-deps` у релевантних файлах.
- Вирівняно hook-залежності та знято warning-и, щоб пройти `--max-warnings=0`.

## Що покращило/виправило/додало
- `npm run lint -- --max-warnings=0` проходить успішно.
- `npm run build` проходить успішно.
- Знято ключовий CI-блокер, який заважав прод-деплою через quality gate.
- Покращено доступність і стабільність фронтенд-коду без зміни бізнес-логіки продукту.
