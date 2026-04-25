# Batch 76 — Nuclei сканер в sentinel-agent

## Як було

`runJob` підтримував тільки два типи сканерів:
- `ai_task` / `ai-agent` → Ollama
- будь-що інше → nmap

Nuclei (CVE/vulnerability сканер) не підтримувався. Docker image `projectdiscovery/nuclei` вже був на VPS з setup-vps.sh, але використовувався.

## Що зроблено

### `sentinel-agent/src/index.ts`

**`nucleiSeverityMap(raw)`** — конвертує рядок severity з nuclei (`critical`, `high`, `medium`, `low`, решта → `info`) у тип `Finding['severity']`.

**`parseNucleiOutput(output, target)`** — парсинг JSONL-виводу nuclei (один JSON-об'єкт на рядок):
- витягує `info.name`, `info.severity`, `info.description`, `matched-at`, `info.reference[0]`
- конвертує кожен матч у `Finding` з правильним severity і remediation
- malformed рядки ігноруються (try/catch per line)
- якщо матчів нема — повертає informational finding

**`runNuclei(target)`** — реальний виклик через `execFileAsync`:
- `nuclei -u <target> -j -silent -nc -severity critical,high,medium,low -timeout 10`
- `-j` → JSONL output для парсингу
- `-severity critical,high,medium,low` → пропускає info-рівень щоб зменшити шум
- timeout 8 хв, maxBuffer 20MB
- при `ENOENT` — чітке повідомлення про встановлення

**`runJob` оновлено:**
- `scanner === 'nuclei'` або `'nuclei-scan'` → `runNuclei()`
- `scanner === 'ai_task'` / `'ai-agent'` → Ollama (без змін)
- все інше → `runNmap()` (fallback)

Константа `NMAP_TIMEOUT_MS` розширена до `NUCLEI_TIMEOUT_MS = 8 * 60 * 1000`.

## Що покращило / виправило / додало

- **CVE/vulnerability сканування**: при `scanner: 'nuclei'` в `scan_jobs` агент запускає реальний nuclei з 10000+ шаблонами
- **Структуровані знахідки**: nuclei JSONL → Finding з name/severity/description/reference з шаблону
- **Розширюваність**: патерн `scanner` switch дозволяє легко додавати нові сканери
