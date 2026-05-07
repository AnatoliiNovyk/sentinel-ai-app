# Batch J — DashboardStats coverage

## Як було
- DashboardStats.tsx: 93.40% statements / 91.86% branches / 96.96% functions / 97.14% lines.
- Глобальне покриття після Batch I: 97.65% statements / 93.26% branches / 97.95% functions / 98.28% lines.

## Що зроблено
- Розширено лише тестовий файл [src/pages/__tests__/Dashboard.test.tsx](src/pages/__tests__/Dashboard.test.tsx) без змін прод-коду.
- Додано direct-тести для DashboardStats експорту:
  - ProjectHealthSection: fallback-гілка для неочікуваного riskFilter (рядок з return true).
  - TopRiskyProjects: сценарій з двома проектами для гарантованого проходу sort callback.
  - AgentProbeSection: гілки formatRelativeMinutes для invalid timestamp, just now, Xm ago, Xh ago.
- Збережено поточну структуру suite, додано тільки адресні coverage-сценарії.

## Що покращило / виправило / додало
- DashboardStats.tsx: **93.40% -> 100.00% statements**, **91.86% -> 95.93% branches**, **96.96% -> 100.00% functions**, **97.14% -> 100.00% lines**.
- Загальне покриття проєкту: **97.65% -> 97.84% statements**, **93.26% -> 93.47% branches**, **97.95% -> 98.07% functions**, **98.28% -> 98.36% lines**.
- Ізольований прогін [src/pages/__tests__/Dashboard.test.tsx](src/pages/__tests__/Dashboard.test.tsx): 51/51 passed.
- Повний quality gate і повний coverage-прогін пройдені успішно.