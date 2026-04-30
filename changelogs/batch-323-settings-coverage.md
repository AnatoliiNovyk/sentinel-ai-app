# Batch-323 Changelog — Settings.tsx Coverage

## Як було
- `Settings.tsx` lines: 91.07%, branches: 67.13%, functions: **40.62%**
- Тести у `Settings.test.tsx`: ~16 тестів (layout, profile, plans, SLA basics, team, save, agent)

## Що зроблено
Додано **29 нових тестів** у `src/pages/__tests__/Settings.test.tsx`:

### Нові describe-блоки:
- `Settings — Security & Preferences toggles` — Two-Factor toggle on/off, Dark Mode toggle on/off
- `Settings — Notification Preferences` — email/inApp/webhook channel toggles, minSeverity (Medium/High/Critical), digest (Daily/Weekly)
- `Settings — Data Retention presets` — клік по 30d пресету, зміна retention input
- `Settings — Team Members management` — invalid email error, duplicate email error, remove member
- `Settings — Webhook section` — введення URL, show/hide toggle
- `Settings — handleUpgrade paths` — Enterprise (Contact sales), Basic (mailto fallback)

## Що покращило/виправило/додало
- **Lines**: 91.07% → **93.59%**
- **Branches**: 67.13% → **75.48%** (+8.35pp)
- **Functions**: 40.62% → **78.12%** (+37.5pp) ← найбільший приріст
- **Commit**: 608e306
