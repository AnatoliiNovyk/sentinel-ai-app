# Changelog: batch-44-phase0-quickwins

**Дата:** 2026-04-24  
**Гілка:** main  
**Тести:** 355 / 355 ✅ (exit code 0)

---

## QW-001 + BUG-001 — Mock Mode UX (FINDING-007)

### Як було
- У `ScanHeader.tsx` баж режиму (REAL / MOCK / UNKNOWN) відображався лише кольором тексту — без іконки.
- `Scans.tsx` не сигналізував користувачу, коли активний скан виконується у DEMO-режимі.
- У бічній панелі зі списком сканів не було позначки, що конкретний скан — mock.

### Що зроблено
**`src/components/scans/ScanHeader.tsx`**:
- Доданий імпорт `AlertTriangle`, `CheckCircle2`, `HelpCircle` з lucide-react.
- REAL → іконка `CheckCircle2` + `Mode: REAL`.
- MOCK → іконка `AlertTriangle` + текст `⚠ DEMO MODE` (яскравіший border/background).
- UNKNOWN → іконка `HelpCircle`.

**`src/pages/Scans.tsx`**:
- Доданий імпорт `AlertTriangle` з lucide-react.
- Новий стан `showMockWarning: boolean`.
- `useEffect` на `currentScanMode` — коли значення `'MOCK'`, встановлює `showMockWarning(true)`.
- Dismissible amber-toast над заголовком: пояснює, що результати симульовані. Кнопка X закриває.
- У кожному елементі списку сканів: маленька мітка `DEMO` поруч зі статусом, якщо `scan.is_mock === true`.

### Що покращило
- Користувач отримує явний візуальний сигнал про DEMO-режим без необхідності перевіряти деталі скану.
- Зменшує ризик прийняття рішень на основі симульованих результатів.

---

## QW-003 — DB Performance Indexes (FINDING-009)

### Як було
- Відсутні індекси на часто використовуваних полях фільтрації/сортування.
- Запити `vulnerabilities(scan_id, severity)`, `scans(project_id ORDER BY created_at)`, `notifications(user_id, is_read)` виконували full table scan.

### Що зроблено
**Новий файл: `supabase/migrations/20260424000000_add_performance_indexes.sql`**
- `idx_vuln_scan_id` — vulnerabilities.scan_id
- `idx_vuln_scan_severity` — vulnerabilities(scan_id, severity)
- `idx_scans_project_created` — scans(project_id, created_at DESC)
- `idx_scans_org_id` — scans.org_id
- `idx_audit_logs_org_action` — audit_logs(org_id, action)
- `idx_audit_logs_org_timestamp` — audit_logs(org_id, timestamp DESC)
- `idx_scan_jobs_status_org` — scan_jobs(status, org_id)
- `idx_notifications_user_read` — notifications(user_id, is_read, created_at DESC)
- Всі `CREATE INDEX IF NOT EXISTS` — безпечна повторна застосовність.

### Що покращило
- Зменшує latency dashboard-запитів при зростанні даних.
- Індекс на `notifications(user_id, is_read)` прискорює лічильник непрочитаних у `NotificationBell`.

---

## BUG-003 — Rate Limiting на scan-dispatch Edge Function (FINDING-004)

### Як було
- `supabase/functions/scan-dispatch/index.ts` не мав жодного rate limiting.
- Автентифікований користувач міг запускати необмежену кількість сканів підряд → DoS на VPS-агент та scan_jobs таблицю.

### Що зроблено
**`supabase/functions/scan-dispatch/index.ts`**:
- Додано inline sliding-window rate limiter (за зразком `ai-gateway/rateLimit.ts`).
- Ліміт: **10 сканів / 60 секунд** на `user.id`.
- При перевищенні → HTTP 429 з тілом `{ error, retryAfterSeconds }` та заголовком `Retry-After`.
- In-memory Map<string, number[]> — зберігає timestamps по user_id, автоматично прибирає старі записи.

### Що покращило
- Захист від DoS-атак (OWASP A05: Security Misconfiguration).
- Захист від випадкового зациклення або помилки у клієнтському коді, що робить нескінченний dispatch.
