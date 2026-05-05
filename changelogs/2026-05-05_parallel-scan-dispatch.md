# Changelog: Parallel Scan Dispatch

**Дата:** 2026-05-05  
**Батч:** Phase 3 — Parallel scan dispatch

---

## Як було

- Агент виконував задачі **послідовно**: один job повністю завершувався перш ніж fetchPendingJob() запускав наступний
- `runJob()` викликався через `await` — весь event loop блокувався на час сканування (до 20+ хв для Prowler)
- Якщо в черзі стояли Prowler + Amass + Nmap — вони виконувалися по черзі, загальний час = сума всіх

## Що зроблено

1. **`AGENT_MAX_CONCURRENT_JOBS`** — нова константа з `parseInt(process.env.AGENT_MAX_CONCURRENT_JOBS ?? '2', 10)`, default = 2
2. **Паралельний main loop** — замість `await runJob(job)` тепер:
   - цикл `while (health.activeJobs < AGENT_MAX_CONCURRENT_JOBS)` заповнює всі вільні слоти
   - `runJob(job).finally(() => { health.activeJobs-- })` — fire-and-forget з відстеженням лічильника
3. **`health.activeJobs`** — нове поле для realtime відстеження активних jobs
4. **`health.maxConcurrentJobs`** — відображається у `/health` endpoint
5. **Prometheus метрики** — додано `sentinel_active_jobs` (gauge) і `sentinel_max_concurrent_jobs` (gauge) у `/metrics`
6. **`.env` на VPS** — можна задати `AGENT_MAX_CONCURRENT_JOBS=3` для збільшення паралелізму

## Що покращило / виправило / додало

- ✅ Nmap + Amass тепер виконуються **паралельно** якщо обидва в черзі — час зменшується вдвічі
- ✅ Агент більше не блокується на довгих Prowler сканах (20 хв) — в цей час може взяти Nmap job
- ✅ `activeJobs` видно у `/health` endpoint для моніторингу
- ✅ Prometheus відображає поточне навантаження агента
- ✅ Гнучке налаштування через env (без перекомпіляції)
- ⚠️ RAM-aware: за замовчуванням 2 concurrent (VPS має ~3.8GB RAM, Prowler споживає ~2.8GB)
