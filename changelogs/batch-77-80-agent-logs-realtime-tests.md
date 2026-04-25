# Batch 77–80: Agent Logs, Realtime, Dashboard Live Feed, Unit Tests

---

## Batch-77 — Agent Live Logs (commit `e150c3f`)

### Як було
- Агент виконував сканування, але жодних логів не зберігав.
- UI не показував поточний стан роботи агента.

### Що зроблено
- Додано міграцію `supabase/migrations/20260425120000_create_agent_logs.sql`:
  - Таблиця `agent_logs` (id, job_id, scan_id, project_id, level, message, created_at)
  - RLS: SELECT для власника проєкту, INSERT для service role
  - `ALTER PUBLICATION supabase_realtime ADD TABLE agent_logs`
- Додано тип `AgentLog` в `src/lib/supabase.ts`
- Додано `writeLog()` в `sentinel-agent/src/index.ts` — fire-and-forget запис в `agent_logs` на кожному етапі `runJob()`
- Створено компонент `src/components/AgentLogsPanel.tsx`:
  - Термінал-стиль, dark bg, font-mono, h-64
  - Initial load: SELECT 200 записів, Realtime subscription на INSERT
  - Кольорова розмітка: info=slate, success=emerald, error=red, warn=amber
  - Auto-scroll до останнього рядка
- `AgentLogsPanel` інтегровано в `ProjectDetail.tsx` (вкладка Scans, вгорі)

### Що покращило
- Видимість роботи агента в реальному часі без refresh сторінки.
- Логи зберігаються в БД і доступні після перезавантаження.

---

## Batch-78 — Dashboard Live Scan Jobs (commit `f92cf38`)

### Як було
- Dashboard читав тільки таблицю `scans`.
- "Active scans" KPI рахував лише `scans.status = running/queued`, не бачив `scan_jobs`.
- Не було відображення jobs що очікують або виконуються агентом.

### Що зроблено
- `src/pages/Dashboard.tsx`:
  - Додано `liveJobs` state
  - `fetchAll()` тепер також запитує `scan_jobs` (status in `pending,running`, limit 20)
  - Realtime channel `dashboard-changes` розширено: підписка на `scan_jobs` таблицю
  - `activeScans = liveJobs.length + scans(running/queued)`
  - Новий блок **"Live scans"** над "Recent scans":
    - З'являється тільки якщо є активні jobs
    - Синя пульсуюча точка + scanner name + target + status badge
  - Додано `Zap` іконку (lucide-react)

### Що покращило
- Dashboard відображає реальні активні сканування з черги агента.
- KPI "Active scans" тепер коректний.

---

## Batch-79 — ProjectDetail Realtime (commit `836e1cc`)

### Як було
- `ProjectDetail` завантажував дані один раз при mount через `load()`.
- Після завершення сканування агентом — потрібен ручний refresh сторінки.

### Що зроблено
- `src/pages/ProjectDetail.tsx`:
  - `useEffect` замінено: тепер крім `load()` створює Supabase Realtime channel `project-detail-{id}`
  - 3 підписки: `scans` (filter by project_id), `vulnerabilities`, `scan_jobs` (filter by project_id)
  - Кожна зміна викликає `load()` → автоматичне оновлення UI
  - Cleanup: `supabase.removeChannel(channel)` при unmount

### Що покращило
- Автоматичне оновлення вкладок Overview/Findings/Scans при завершенні сканування.
- Вразливості з'являються без refresh.

---

## Batch-80 — NucleiParser Unit Tests (commit `b2a1433`)

### Як було
- Логіка парсингу nuclei JSONL жила виключно в `sentinel-agent/src/index.ts`.
- Не покрита жодними тестами.

### Що зроблено
- Створено `src/lib/nucleiParser.ts`:
  - Чисті функції без зовнішніх залежностей: `nucleiSeverityMap()`, `parseNucleiOutput()`
  - Типи: `NucleiFinding` з полями title, description, severity, asset, remediation, status
  - Дзеркало логіки з `sentinel-agent/src/index.ts`
- Створено `src/lib/__tests__/nucleiParser.test.ts`:
  - **26 тестів**, всі зелені
  - `nucleiSeverityMap`: 12 кейсів (всі severity + uppercase + unknown + empty)
  - `parseNucleiOutput`: 14 кейсів — empty output, whitespace, non-JSON lines, malformed JSON, severity, fallbacks (name/template-id/Unknown), asset, description, remediation з/без reference, multi-line JSONL, status/remediation_type

### Що покращило
- Парсер nuclei JSONL захищений регресійними тестами.
- Логіку тепер можна переиспользовати у фронтенді.

---

## Batch-81 — Самоперевірка (цей файл)

### Аудит результатів
| Перевірка | Статус |
|-----------|--------|
| TODO/FIXME в src/ | ✅ Тільки легітимні `@ts-expect-error` в тестах |
| TODO/FIXME в sentinel-agent/ | ✅ Чисто |
| RLS на `agent_logs` | ✅ SELECT by project owner + INSERT for service role |
| `agent_logs` в Realtime publication | ✅ В міграції (потребує ручного застосування в Supabase SQL Editor) |
| TypeScript errors після Batch-78 | ✅ `tsc --noEmit` — 0 помилок |
| Vitest — nucleiParser | ✅ 26/26 |
| Відкриті security issues | ✅ Немає нових |

### ⚠️ Pending дія користувача
Міграція `supabase/migrations/20260425120000_create_agent_logs.sql` потребує ручного запуску:
→ https://supabase.com/dashboard/project/ysnlccidbtqqburuflkz/sql/new
