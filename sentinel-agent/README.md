# Sentinel AI — Scan Agent

The scan agent is a lightweight Node.js process that runs on your VPS/server and executes scan jobs dispatched from the Sentinel AI frontend.

## Quick Deploy

### 1. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → `service_role` key (**keep secret**) |
| `SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API → `anon` / `public` key |
| `AGENT_SECRET` | Generate: `openssl rand -hex 32` — must match the value set in the frontend Settings page |

> **Security:** Never commit `.env` to version control. The `service_role` key bypasses Row Level Security — treat it like a root password.

### 2. Start with Docker Compose (recommended)

```bash
docker compose up -d
```

The agent will restart automatically on failure or server reboot (`restart: unless-stopped`).

### 3. Verify the agent is running

```bash
docker compose logs -f agent
```

You should see:

```
Sentinel AI agent started. Polling for jobs...
```

In the Sentinel AI frontend, go to **Settings → Agent** and enter your server's health endpoint URL (e.g. `http://YOUR_VPS_IP:9090/health`), then click **Check**.

---

## Manual (without Docker)

```bash
npm ci
npm run build
node dist/index.js
```

Requires Node.js ≥ 20.

---

## Troubleshooting

### `Error: supabaseUrl is required`

The agent cannot find the `.env` file or the `SUPABASE_URL` variable is empty.

**Fix:**
1. Ensure `.env` exists in the `sentinel-agent/` directory (not in the project root).
2. Verify `SUPABASE_URL` is set to your full Supabase project URL (e.g. `https://xxxx.supabase.co`).
3. If running via Docker Compose, the `.env` file must be in the same directory as `docker-compose.yml`.
4. Restart the container: `docker compose restart agent`.

### Agent shows "Offline" in Settings

- Confirm the agent process is running: `docker compose ps`
- Confirm port 9090 is open in your server's firewall
- If your Sentinel AI frontend is served over HTTPS, a plain HTTP agent URL will be blocked by the browser (Mixed Content policy). Use the Supabase gateway relay shown in Settings instead.
