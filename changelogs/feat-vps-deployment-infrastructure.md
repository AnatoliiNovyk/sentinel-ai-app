# Feat: VPS Deployment Infrastructure (Track 2)

**Дата**: 2026-05-05  
**Файли**: `sentinel-agent/nginx.conf` (new), `sentinel-agent/setup-vps.sh` (updated), `.github/workflows/deploy-agent.yml` (updated)

---

## Як було

- `setup-vps.sh` встановлював агент як systemd service, але **не налаштовував nginx/SSL**
- Агент був доступний лише на `http://VPS_IP:9090` — браузери блокували його як mixed-content при доступі з HTTPS фронтенду (Vercel)
- `deploy-agent.yml` існував, але: не мав `concurrency` guard (можливі паралельні деплої), використовував `npm install` замість `npm ci`, не мав pre-deploy build validation, не перезавантажував nginx після деплою

---

## Що зроблено

### 1. `sentinel-agent/nginx.conf` (новий файл, 110 рядків)
SSL reverse proxy шаблон для nginx:
- HTTP → HTTPS redirect з підтримкою Let's Encrypt ACME challenge
- TLS 1.2/1.3, сучасні ciphers, HSTS (1 рік)
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- **CORS**: дозволяє запити з `*.vercel.app` та `localhost` (preflight підтримка)
- Proxy pass до `localhost:9090` для `/health`, `/metrics`, всіх інших endpoints
- Довгі timeout'и (300s) для scan-запитів

### 2. `sentinel-agent/setup-vps.sh` (доповнено)
Додано три нові блоки після systemd:

**UFW Firewall**:
```bash
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP / Let's Encrypt
ufw allow 443/tcp  # HTTPS
# Порт 9090 навмисно закритий ззовні — nginx проксіює
```

**nginx встановлення + конфіг**:
- `apt install nginx`
- Копіювання `nginx.conf` → `/etc/nginx/sites-available/sentinel-agent`
- `sed -i "s/AGENT_DOMAIN/$AGENT_DOMAIN/g"` — підстановка домену
- Видалення дефолтного сайту

**Certbot / Let's Encrypt**:
- `apt install certbot python3-certbot-nginx`
- `certbot --nginx --non-interactive --agree-tos --redirect`
- Автоматичний отримання SSL сертифікату

### 3. `.github/workflows/deploy-agent.yml` (оновлено)
- `concurrency: group: deploy-agent, cancel-in-progress: false` — захист від паралельних деплоїв
- `timeout-minutes: 15` — обмеження часу
- Доданий pre-deploy крок: `npm ci && npm run build` на GitHub runner (fail fast до SSH)
- `npm ci --omit=dev` замість `npm install` — детермінований install
- `systemctl reload nginx` після деплою — підхоплює оновлений `nginx.conf`

---

## Що покращило / додало

- **Безпека**: порт 9090 закритий ззовні, трафік тільки через nginx+SSL
- **Mixed-content виправлено**: фронтенд на Vercel (HTTPS) тепер може звертатись до агента через `https://agent.domain.com/health`
- **Надійність CI/CD**: паралельні деплої заблоковані, build перевіряється до SSH
- **Автоматичний SSL**: Let's Encrypt via certbot з авторедиректом HTTP→HTTPS
- **Перевірено**: `npm run build` — ✅ 1594 modules, 1.81s
