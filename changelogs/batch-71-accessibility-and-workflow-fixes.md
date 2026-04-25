# Batch 71 — Accessibility & Workflow Fixes

## Як було
- `.github/workflows/ci.yml` та `quality-gate.yml` містили `on:` ключ, який YAML 1.1 парсить як булевий `true` → false positive error від GitHub Actions extension у VS Code
- `.github/workflows/sentinel-scan.yml` мав один крок `upload-sarif` з multiline списком файлів — `github/codeql-action/upload-sarif@v3` не підтримує цей формат → error "Invalid action input 'sarif_file'"
- `FindingsTab.tsx` — `<select>` без `aria-label` → axe/forms violation
- `ReportViewer.tsx` — `<button>` (close) без `aria-label` → axe/name-role-value violation
- `SchedulesPanel.tsx` — `<button>` (close) та два `<select>` (Project, Scanner) без `aria-label`
- `Projects.tsx` — `<button>` (close) без `aria-label`
- `Reports.tsx` — два `<button>` (close), один `<input>` (share URL), один `<select>` (Project) без `aria-label`
- `Scheduler.tsx` — два `<select>` (Project, Scanner) без `aria-label`

## Що зроблено
1. `ci.yml` та `quality-gate.yml`: замінено `on:` → `"on":` (YAML quoted key)
2. `sentinel-scan.yml`: розбито один крок upload на два окремих — для tfsec SARIF та для trivy SARIF, кожен з умовою `hashFiles(...)` і своєю категорією
3. Всі `<button>` з лише іконкою — додано `aria-label="Close"` (або відповідний)
4. Всі `<select>` без видимого label — додано `aria-label` з описом поля
5. `<input readOnly>` в Reports share dialog — додано `aria-label="Share URL"`

## Що покращило
- Усунуто всі axe accessibility violations (severity: error) від Microsoft Edge Tools
- Усунуто YAML linter false positives у VS Code для двох workflow файлів
- Виправлено реальний баг GitHub Actions: multiline `sarif_file` → два коректних upload кроки
- `quality:check` — exit 0, 77 суітів, 1019 тестів passed
