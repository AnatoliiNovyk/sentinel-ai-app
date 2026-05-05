#!/usr/bin/env bash
# deploy-monitoring.sh
# Deploys the Sentinel AI monitoring stack to the VPS via SCP + SSH.
#
# Usage:
#   chmod +x deploy-monitoring.sh
#   ./deploy-monitoring.sh [VPS_HOST] [VPS_USER]
#
# Defaults: VPS_HOST=192.168.10.80  VPS_USER=adm_ukr
#
# Prerequisites on VPS: Docker + Docker Compose plugin (v2)
# Install Docker on fresh Ubuntu: https://docs.docker.com/engine/install/ubuntu/

set -euo pipefail

VPS_HOST="${1:-192.168.10.80}"
VPS_USER="${2:-adm_ukr}"
REMOTE_DIR="/opt/sentinel-monitoring"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Sentinel AI — Monitoring Stack Deploy ==="
echo "Target: ${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}"
echo ""

# ── 1. Ensure remote directory exists ──────────────────────────────────────
echo "[1/4] Creating remote directory..."
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" \
  "sudo mkdir -p ${REMOTE_DIR}/grafana-provisioning/datasources \
                 ${REMOTE_DIR}/grafana-provisioning/dashboards \
                 ${REMOTE_DIR}/grafana-dashboards && \
   sudo chown -R ${VPS_USER}:${VPS_USER} ${REMOTE_DIR}"

# ── 2. Copy monitoring files ───────────────────────────────────────────────
echo "[2/4] Uploading monitoring files..."
scp -o StrictHostKeyChecking=no \
  "${SCRIPT_DIR}/prometheus.yml" \
  "${SCRIPT_DIR}/alert.rules.yml" \
  "${SCRIPT_DIR}/alertmanager.yml" \
  "${SCRIPT_DIR}/docker-compose.monitoring.yml" \
  "${SCRIPT_DIR}/grafana-dashboard.json" \
  "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/"

scp -o StrictHostKeyChecking=no \
  "${SCRIPT_DIR}/grafana-provisioning/datasources/prometheus.yml" \
  "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/grafana-provisioning/datasources/"

scp -o StrictHostKeyChecking=no \
  "${SCRIPT_DIR}/grafana-provisioning/dashboards/dashboards.yml" \
  "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/grafana-provisioning/dashboards/"

# ── 3. Start / restart stack ───────────────────────────────────────────────
echo "[3/4] Starting monitoring stack..."
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" \
  "cd ${REMOTE_DIR} && \
   docker compose -f docker-compose.monitoring.yml pull --quiet && \
   docker compose -f docker-compose.monitoring.yml up -d --remove-orphans"

# ── 4. Health check ────────────────────────────────────────────────────────
echo "[4/4] Waiting for services (15s)..."
sleep 15

echo ""
echo "=== Service Status ==="
ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}" \
  "cd ${REMOTE_DIR} && docker compose -f docker-compose.monitoring.yml ps"

echo ""
echo "=== Endpoints ==="
echo "  Prometheus:   http://${VPS_HOST}:9091"
echo "  Alertmanager: http://${VPS_HOST}:9093"
echo "  Grafana:      http://${VPS_HOST}:3000  (admin / sentinel)"
echo "  Jaeger UI:    http://${VPS_HOST}:16686"
echo ""
echo "=== To enable OTel tracing: add to /opt/sentinel-agent/.env ==="
echo "  OTEL_ENABLED=true"
echo "  OTEL_EXPORTER_OTLP_ENDPOINT=http://${VPS_HOST}:4318"
echo ""
echo "Done."
