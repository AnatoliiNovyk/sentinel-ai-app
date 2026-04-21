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

# ─── Pull scanner Docker images ───────────────────────────────────────────────
echo "Pulling scanner images (this takes a few minutes)..."
docker pull instrumentisto/nmap &
docker pull caffix/amass &
docker pull aquasec/tfsec &
docker pull projectdiscovery/nuclei &
docker pull bridgecrew/checkov &
docker pull aquasec/trivy &
docker pull aquasec/kube-bench &
wait
echo "✅ Scanner images ready"

# ─── Clone / update agent code ────────────────────────────────────────────────
if [ -d "/opt/sentinel-agent" ]; then
  echo "Updating agent code..."
  cd /opt/sentinel-agent
  git pull
else
  echo "Cloning agent code..."
  git clone https://github.com/AnatoliiNovyk/sentinel-ai-app.git /opt/sentinel-agent-repo
  cp -r /opt/sentinel-agent-repo/sentinel-agent /opt/sentinel-agent
fi

cd /opt/sentinel-agent
npm ci --omit=dev
npm run build 2>/dev/null || npx tsc 2>/dev/null || true

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

echo ""
echo "✅ Sentinel Agent installed!"
echo ""
echo "Next steps:"
echo "  1. Edit /opt/sentinel-agent/.env with your Supabase credentials"
echo "  2. Set AGENT_SECRET to the same value as in Supabase Edge Function secrets"
echo "  3. Start the agent: systemctl start sentinel-agent"
echo "  4. Check logs: journalctl -u sentinel-agent -f"
