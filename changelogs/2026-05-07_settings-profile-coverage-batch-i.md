# Batch I — SettingsProfile branch coverage

## Як було
- `SettingsProfile.tsx`: 94.87% statements / 83.82% branches / 100.00% functions / 100.00% lines.
- Глобальне покриття після Batch H: 97.52% statements / 92.68% branches / 97.95% functions / 98.24% lines.
- У профільному блоці Settings були неперевірені fallback-гілки для `profile=null`, `user=null`, partial `sentinelNotifPrefs`, `company ?? ''` та проміжного стану кнопки збереження.

## Що зроблено
- Розширено [src/pages/__tests__/Settings.test.tsx](src/pages/__tests__/Settings.test.tsx) без змін прод-коду.
- Додано керований `mockAuthState` для вузьких сценаріїв `user=null` і `profile=null`, не ламаючи наявні тести.
- Додано тести для:
  - fallback-мерджу `sentinelNotifPrefs`, коли в `localStorage` немає `channels`;
  - порожніх profile inputs і відсутності `Unsaved changes`, коли `profile` відсутній;
  - раннього виходу із save-flow, коли `user` відсутній;
  - нормалізації `company: null` у порожній рядок без false-positive unsaved state;
  - проміжного стану кнопки `Saving...` під час pending update.

## Що покращило / виправило / додало
- `SettingsProfile.tsx`: **94.87% -> 97.43% statements**, **83.82% -> 95.58% branches**, `100.00% functions`, `100.00% lines`.
- Загальне покриття проєкту: **97.52% -> 97.65% statements**, **92.68% -> 93.26% branches**, `97.95% functions`, **98.24% -> 98.28% lines**.
- Ізольований прогін [src/pages/__tests__/Settings.test.tsx](src/pages/__tests__/Settings.test.tsx): `94/94` tests passed.
- Повний quality gate та повний coverage-прогін пройдені успішно.