# Batch H — App routing coverage

## Як було
- `App.tsx`: 76.78% statements / 100.00% branches / 100.00% functions / 76.78% lines
- Глобальне покриття після Batch G: 97.09% statements / 92.68% branches / 96.39% functions / 98.24% lines
- У `src/__tests__/App.test.tsx` були перевірені лише частина authenticated routes, тому більшість `Route`-елементів у shell лишались непрохідними.

## Що зроблено
- Розширено [src/__tests__/App.test.tsx](src/__tests__/App.test.tsx) новими authenticated route тестами для: `projects`, `scans`, `compliance`, `scheduler`, `attack-map`, `dark-web`, `recon`, `supply-chain`, `kill-chain`, `integrations`, `api`, `settings`, `landing`.
- Додано окремі сценарії для redirect з `/auth` у авторизованому стані та для private not-found маршруту.
- Весь батч виконано без змін прод-коду: тільки тестове покриття та перевірка quality gate.

## Що покращило / виправило / додало
- `App.tsx`: **76.78% -> 100.00% statements**, **100.00% -> 100.00% branches**, **100.00% -> 100.00% functions**, **76.78% -> 100.00% lines**.
- Загальне покриття проекту: **97.09% -> 97.52% statements**, **92.68% -> 92.68% branches**, **96.39% -> 97.95% functions**, **98.24% -> 98.24% lines**.
- Піднято coverage саме в маршрутизаційному shell, де кожен `Route`-елемент тепер має прямий тестовий прохід.