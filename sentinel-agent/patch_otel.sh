#!/bin/bash
ENV=/opt/sentinel-agent/.env
grep -q '^OTEL_ENABLED=' "$ENV" && sed -i 's/^OTEL_ENABLED=.*/OTEL_ENABLED=true/' "$ENV" || echo 'OTEL_ENABLED=true' >> "$ENV"
grep -q '^OTEL_EXPORTER_OTLP_ENDPOINT=' "$ENV" && sed -i 's|^OTEL_EXPORTER_OTLP_ENDPOINT=.*|OTEL_EXPORTER_OTLP_ENDPOINT=http://192.168.10.80:4318|' "$ENV" || echo 'OTEL_EXPORTER_OTLP_ENDPOINT=http://192.168.10.80:4318' >> "$ENV"
grep -q '^OTEL_SERVICE_NAME=' "$ENV" && sed -i 's/^OTEL_SERVICE_NAME=.*/OTEL_SERVICE_NAME=sentinel-agent/' "$ENV" || echo 'OTEL_SERVICE_NAME=sentinel-agent' >> "$ENV"
systemctl restart sentinel-agent
sleep 3
echo "---STATUS---"
systemctl is-active sentinel-agent
echo "---OTEL ENV---"
grep '^OTEL_' "$ENV"
echo "---LOG---"
journalctl -u sentinel-agent --no-pager -n 8 2>/dev/null
