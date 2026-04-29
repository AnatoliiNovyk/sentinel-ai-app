# Changelog — Batch-288

**Дата:** 2026-04-29  
**Commit:** `71488a9`  
**Тести:** 1083/1083 PASS (78 файлів, +4 нових тести)

---

## Що було до цього

- `toSarif()` у `src/lib/exporters.ts` генерував однаковий вивід для реальних і mock-сканів — не було жодного маркування DEMO-даних у SARIF-файлах.
- Відсутній checklist безпеки/схеми перед деплоєм (audit FINDING-005).
- Відсутня захист від помилкового прийняття mock-даних за реальні у зовнішніх системах (SIEM, JIRA, GitHub Code Scanning).

---

## Що зроблено

### 1. Mock SARIF Watermark (`src/lib/exporters.ts`)
- Додано перевірку `scan.is_mock === true` у функції `toSarif()`.
- Якщо скан є mock: SARIF-документ отримує top-level `properties._mockData: true` + `properties._notice: 'DEMO DATA - NOT FOR PRODUCTION USE'`.
- Invocation properties також отримують `_mockData: true` + `_notice`.
- Для реальних сканів (is_mock = false або undefined) — жодних змін у структурі.

### 2. Release Security Checklist (`scripts/release-checklist.md`)
- Створено новий файл `scripts/release-checklist.md` — Pre-release Self-Check Checklist.
- 7 розділів: Pre-flight, Environment Variables, Supabase Schema, Security Baseline, Feature Flags, Post-Deploy Validation, Rollback Plan.
- Закриває audit FINDING-005 (rate limiting baseline / release readiness).
- Покриває: required env vars, VITE_ALLOW_MOCK_SCAN_FALLBACK перевірку, RLS on all tables, Edge Function deploy, secret rotation, CORS, CSP.

### 3. Нові тести (`src/lib/__tests__/exporters.test.ts`)
- Додано `describe('toSarif — mock watermark')` з 4 тестами:
  1. `_mockData` і `_notice` присутні на рівні документа при `is_mock: true`
  2. Invocation properties також містять `_mockData` при `is_mock: true`
  3. Відсутність `_mockData` при `is_mock: false`
  4. Відсутність `_mockData` при `is_mock: undefined`

### 4. EXECUTION_CHECKLIST оновлено
- Додано записи Batch-286, Batch-287, Batch-288 у `EXECUTION_CHECKLIST_2026-04-28.md`.

---

## Що покращило / виправило / додало

- **Безпека:** Mock-сканування тепер явно маркуються у SARIF-виводі — неможливо випадково завантажити DEMO-дані в продакшн SIEM/tracker.
- **Операційна зрілість:** Release Security Checklist закриває gap у pre-deploy process (audit FINDING-005).
- **Тестове покриття:** 1083 тестів (+4) — всі проходять.
- **Документація:** EXECUTION_CHECKLIST відображає усі батчі 285–288.
