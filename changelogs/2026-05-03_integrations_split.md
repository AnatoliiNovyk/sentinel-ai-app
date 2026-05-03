# Integrations.tsx Split — 2026-05-03

## Як було
- `src/pages/Integrations.tsx` містив 1395 рядків коду (God object).
- Усе в одному файлі: сервіси, вебхуки, CI/CD шаблони, логіка стану.

## Що зроблено
- Створено директорію `src/pages/integrations/`.
- Винесено компоненти:
  - `IntegrationsForm.tsx` — сервіси та `ServiceCard`.
  - `IntegrationsList.tsx` — вебхуки (`WebhookRow`, `WebhookCreator`, `HealthDashboard`).
  - `IntegrationsCloud.tsx` — CI/CD та шаблони (`CiCdTab`).
- Оновлено `Integrations.tsx` — тепер містить лише головний компонент `IntegrationsLegacy` з імпортами з модулів.

## Що покращило
- **Підтримка коду**: кожен файл має чітку відповідальність (~200-400 рядків).
- **Читабельність**: легше знаходити потрібний функціонал.
- **Тестування**: модулі можна тестувати ізольовано.
- **Архітектура**: відповідає патерну, застосованому для `Dashboard.tsx`.
