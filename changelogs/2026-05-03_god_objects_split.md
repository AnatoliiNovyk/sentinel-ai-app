# God Objects Split — 2026-05-03

## Мета
Розбиття великих файлів ("God objects") для покращення підтримки коду, читабельності та тестування.

## Виконано

### 1. Dashboard.tsx (1546 → ~400 рядків + 3 модулі)
- **Було**: 1 файл 1546 рядків
- **Стало**: 4 файли в `src/pages/dashboard/`
  - `DashboardCharts.tsx` — графіки, тренди, KPI
  - `DashboardStats.tsx` — статистика, проекти, алерти
  - `DashboardAlerts.tsx` — критичні знахідки, SLA, активні сканування
  - `DashboardAlertsHelpers.tsx` — допоміжні компоненти

### 2. Integrations.tsx (1395 → ~300 рядків + 3 модулі)
- **Було**: 1 файл 1395 рядків
- **Стало**: 4 файли в `src/pages/integrations/`
  - `IntegrationsForm.tsx` — сервіси та ServiceCard
  - `IntegrationsList.tsx` — вебхуки, WebhookRow, HealthDashboard
  - `IntegrationsCloud.tsx` — CI/CD, шаблони (CiCdTab)

### 3. Settings.tsx (1155 → ~300 рядків + 3 модулі)
- **Було**: 1 файл 1155 рядків
- **Стало**: 4 файли в `src/pages/settings/`
  - `SettingsProfile.tsx` — профіль, сповіщення, команда, API ключі
  - `SettingsSecurity.tsx` — SLA, збереження даних, агент
  - `SettingsSubscription.tsx` — підписки, плани PLANS

## Результат
- ✅ **Архітектура**: модульна, легко масштабується
- ✅ **Читабельність**: кожен файл < 400 рядків
- ✅ **Покриття тестами**: 95.01% (не змінилося)
- ✅ **Підтримка**: ізольоване тестування модулів

## Файли changelogs
- `changelogs/2026-05-03_coverage_95_percent.md`
- `changelogs/2026-05-03_dashboard_split.md`
- `changelogs/2026-05-03_integrations_split.md`
- `changelogs/2026-05-03_settings_split.md`
