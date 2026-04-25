# Batch 75 — GitHub Actions автодеплой sentinel-agent на VPS

## Як було

При кожній зміні в `sentinel-agent/` потрібно було вручну:
1. `git push` локально
2. SSH на VPS
3. `git pull`, `cp src/ package.json tsconfig.json`, `rm -rf node_modules`, `npm install`, `npm run build`, `systemctl restart`

Сьогодні (batch-74) ця ручна процедура зайняла ~20 хвилин через помилки з `package.json` і правами доступу.

## Що зроблено

### `.github/workflows/deploy-agent.yml` (новий файл)
- Тригер: `push` до гілки `main` при змінах у `sentinel-agent/**`
- Runner: `ubuntu-latest`
- Використовує `appleboy/ssh-action@v1.0.3` для SSH-підключення до VPS
- Кроки на VPS:
  1. `git config safe.directory` + `git pull` в `/opt/sentinel-agent-repo`
  2. Синхронізація `src/`, `package.json`, `tsconfig.json` в `/opt/sentinel-agent`
  3. `rm -rf node_modules && npm install`
  4. `npm run build`
  5. `systemctl restart sentinel-agent`
  6. `systemctl status` для підтвердження

## Що потрібно налаштувати (один раз)

Додати в GitHub → Settings → Secrets and variables → Actions:
- `VPS_HOST` — IP адреса VPS
- `VPS_USER` — `adm_ukr`
- `VPS_SSH_KEY` — вміст приватного SSH ключа (`~/.ssh/id_rsa` або аналог)

## Що покращило / виправило / додало

- **Автодеплой**: після `git push` зміни в `sentinel-agent/` автоматично деплояться на VPS без жодних ручних дій.
- **Тільки при змінах агента**: workflow не запускається при змінах фронтенду (`src/`, `supabase/` тощо) — економія CI хвилин.
- **Ідентична процедура**: workflow виконує точно ті ж команди що і `setup-vps.sh` — ніяких розбіжностей.
