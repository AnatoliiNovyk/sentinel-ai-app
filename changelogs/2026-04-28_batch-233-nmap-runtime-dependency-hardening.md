# Batch 233: Nmap runtime dependency hardening

## Як було
- Smoke-перевірка падала з помилкою `Scan failed: nmap is not installed`.
- У VPS provisioning тягнулися Docker-образи, але системний binary `nmap` не гарантувався для фактичного `execFile('nmap', ...)` у агенті.
- Deploy workflow не перевіряв наявність `nmap` перед runtime readiness перевірками.

## Що зроблено
- У `sentinel-agent/setup-vps.sh` додано явну інсталяцію `nmap` (якщо відсутній).
- У `.github/workflows/deploy-agent.yml` додано крок `Ensuring scanner runtime dependencies`:
  - перевірка `command -v nmap`
  - `apt-get update` + `apt-get install -y nmap` при відсутності.

## Що покращило
- Усунуто клас помилок, коли агент стартує, але фактичні nmap-скани падають у runtime.
- Підвищено надійність post-deploy smoke та production scanning path.
- Provisioning і deploy тепер узгоджені з реальними виконуваними залежностями агента.
