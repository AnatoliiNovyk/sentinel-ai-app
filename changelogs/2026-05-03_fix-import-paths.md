# Fix Import Paths in Split Files

## Як було
- Файли в `src/pages/settings/` використовували `../context/useAuth`, `../lib/supabase`, `../api/audit.service`
- Файли в `src/pages/integrations/` використовували `../lib/storage`
- Це призводило до помилки: "Failed to resolve import" (Vite не міг знайти файли)

## Що зроблено
Виправлено шляхи імпорту в:
- `src/pages/settings/SettingsProfile.tsx`: `../` → `../../`
- `src/pages/settings/SettingsSecurity.tsx`: `../` → `../../`
- `src/pages/settings/SettingsSubscription.tsx`: `../` → `../../`
- `src/pages/integrations/IntegrationsForm.tsx`: `../lib/storage` → `../../lib/storage`
- `src/pages/integrations/IntegrationsList.tsx`: `../lib/storage` → `../../lib/storage`

## Що покращило/виправило
- Виправлено помилку завантаження сторінки Settings (http://localhost:5173/settings)
- Виправлено помилку завантаження сторінки Integrations
- Тепер Vite правильно резолвить всі імпорти
- Розбиті файли тепер коректно працюють
