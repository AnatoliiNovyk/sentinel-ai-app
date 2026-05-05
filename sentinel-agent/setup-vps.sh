#!/bin/bash
# Sentinel AI — VPS Setup Script
# Run this on a fresh Ubuntu 24.04 VPS (Hetzner CX21 recommended)
# Usage: curl -fsSL https://raw.githubusercontent.com/YOUR/repo/main/sentinel-agent/setup-vps.sh | bash

set -e
echo "🛡️  Setting up Sentinel AI Scanner Agent..."

# ─── System update ────────────────────────────────────────────────────────────
apt-get update -qq && apt-get upgrade -y -qq

# ─── Install Docker ───────────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# ─── Install Node.js 20 ───────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs -qq
fi

# ─── Install scanner runtime dependencies ─────────────────────────────────────
if ! command -v nmap &> /dev/null; then
  echo "Installing nmap..."
  apt-get install -y nmap -qq
fi

# ─── Pull scanner Docker images ───────────────────────────────────────────────
echo "Pulling scanner images (this takes a few minutes)..."
docker pull instrumentisto/nmap &
docker pull caffix/amass &
docker pull aquasec/tfsec &
docker pull projectdiscovery/nuclei &
docker pull bridgecrew/checkov &
docker pull aquasec/trivy &
docker pull aquasec/kube-bench &
docker pull opensecurity/mobile-security-framework-mobsf &
wait
echo "✅ Scanner images ready"

# ─── Clone / update agent code ────────────────────────────────────────────────
if [ -d "/opt/sentinel-agent-repo" ]; then
  echo "Updating agent code..."
  git config --global --add safe.directory /opt/sentinel-agent-repo
  cd /opt/sentinel-agent-repo && git pull
else
  echo "Cloning agent code..."
  git clone https://github.com/AnatoliiNovyk/sentinel-ai-app.git /opt/sentinel-agent-repo
fi

# Sync src/ and package.json from repo to agent directory
mkdir -p /opt/sentinel-agent
cp -r /opt/sentinel-agent-repo/sentinel-agent/src /opt/sentinel-agent/
cp /opt/sentinel-agent-repo/sentinel-agent/package.json /opt/sentinel-agent/package.json
cp /opt/sentinel-agent-repo/sentinel-agent/tsconfig.json /opt/sentinel-agent/tsconfig.json

cd /opt/sentinel-agent
rm -rf node_modules
npm install
npm run build

# ─── Configure environment ────────────────────────────────────────────────────
if [ ! -f "/opt/sentinel-agent/.env" ]; then
  cp .env.example .env
  echo ""
  echo "⚠️  Edit /opt/sentinel-agent/.env with your credentials:"
  echo "   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, AGENT_SECRET"
  echo ""
fi

# ─── Create systemd service ───────────────────────────────────────────────────
cat > /etc/systemd/system/sentinel-agent.service << 'EOF'
[Unit]
Description=Sentinel AI Scanner Agent
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/sentinel-agent
EnvironmentFile=/opt/sentinel-agent/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sentinel-agent

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sentinel-agent

# ─── UFW Firewall ─────────────────────────────────────────────────────────────
if command -v ufw &> /dev/null; then
  echo "Configuring UFW firewall..."
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp   comment 'SSH'
  ufw allow 80/tcp   comment 'HTTP (Let\'s Encrypt + redirect)'
  ufw allow 443/tcp  comment 'HTTPS (nginx → agent)'
  # Port 9090 intentionally NOT opened — nginx proxies it internally
  ufw --force enable
  echo "✅ UFW configured (22/80/443 open; 9090 internal only)"
fi

# ─── Install nginx ────────────────────────────────────────────────────────────
if ! command -v nginx &> /dev/null; then
  echo "Installing nginx..."
  apt-get install -y nginx -qq
  systemctl enable nginx
fi

# ─── Prompt for agent domain ──────────────────────────────────────────────────
echo ""
read -rp "Enter the domain for the agent (e.g. agent.yourdomain.com): " AGENT_DOMAIN

if [ -n "$AGENT_DOMAIN" ]; then
  # Copy and configure nginx site
  NGINX_CONF="/etc/nginx/sites-available/sentinel-agent"
  cp /opt/sentinel-agent-repo/sentinel-agent/nginx.conf "$NGINX_CONF"
  sed -i "s/AGENT_DOMAIN/$AGENT_DOMAIN/g" "$NGINX_CONF"

  # Enable the site
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/sentinel-agent
  rm -f /etc/nginx/sites-enabled/default

  # Create ACME challenge directory
  mkdir -p /var/www/certbot

  # Test nginx config (HTTP only first, before SSL)
  nginx -t && systemctl reload nginx

  # ─── Certbot / Let's Encrypt SSL ─────────────────────────────────────────
  if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx -qq
  fi

  read -rp "Enter email for Let's Encrypt notifications: " LE_EMAIL
  if [ -n "$LE_EMAIL" ]; then
    certbot --nginx \
      --non-interactive \
      --agree-tos \
      --email "$LE_EMAIL" \
      --domains "$AGENT_DOMAIN" \
      --redirect
    echo "✅ SSL certificate obtained for $AGENT_DOMAIN"
  else
    echo "⚠️  Skipped SSL setup. Run manually: certbot --nginx -d $AGENT_DOMAIN"
  fi

  echo "✅ nginx configured for $AGENT_DOMAIN"
  echo "   Agent will be accessible at: https://$AGENT_DOMAIN/health"
else
  echo "⚠️  Skipped nginx/SSL setup. Agent runs on http://localhost:9090 only."
  echo "   Set VITE_AGENT_HEALTH_URL=http://<VPS_IP>:9090/health in your frontend .env"
  echo "   NOTE: browsers may block HTTP from HTTPS pages (mixed content)."
fi

echo ""
echo "✅ Sentinel Agent installed!"
echo ""
echo "Next steps:"
echo "  1. Edit /opt/sentinel-agent/.env with your Supabase credentials"
echo "  2. Set AGENT_SECRET to the same value as in Supabase Edge Function secrets"
echo "  3. Start the agent: systemctl start sentinel-agent"
echo "  4. Check logs:      journalctl -u sentinel-agent -f"
if [ -n "$AGENT_DOMAIN" ]; then
echo "  5. Set in frontend: VITE_AGENT_HEALTH_URL=https://$AGENT_DOMAIN/health"
fi
