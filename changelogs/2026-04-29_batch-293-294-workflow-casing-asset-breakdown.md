# Changelog: Batch-293 + Batch-294 (2026-04-29)

## Commit: `924a201`

---

## Batch-293 — Workflow secrets guard + tsconfig casing

### Як було
- `.github/workflows/chaos-ops-drill.yml` та `agent-health-probe-smoke.yml`: step-level `if:` містив `secrets.*` — VS Code linter видавав `Unrecognized named-value: 'secrets'`.
- `tsconfig.app.json`: не мав `"forceConsistentCasingInFileNames"`.

### Що зроблено
- Видалено `secrets.*` із step-level `if:` умов в обох workflow; натомість додано PowerShell runtime guard `if (-not $env:...) { exit 0 }` на початку run-блоку.
- Додано `"forceConsistentCasingInFileNames": true` у `tsconfig.app.json` (секція Linting).

### Що покращило
- Усунено хибне лінтер-попередження у workflow-файлах.
- TypeScript тепер гарантує консистентне написання шляхів імпортів незалежно від ОС.

---

## Batch-294 — Asset Breakdown Panel у FindingsTab

### Як було
- `FindingsTab.tsx` показував вразливості у плоскому списку без жодного групування за активом (хостом/сервісом).
- Не було можливості швидко побачити, які активи мають найбільше проблем.

### Що зроблено
- Додано `assetPanelOpen` state та `assetBreakdown` useMemo у `FindingsTab.tsx`.
- `assetBreakdown` групує `filtered` вразливості за полем `asset`, підраховує кількість по severity, сортує за спаданням загальної кількості, повертає топ-5.
- Додано collapsible секцію **"Findings by asset"** (між bulk action bar і списком вразливостей):
  - Toggle-кнопка з іконкою Server та aria-label для доступності.
  - Для кожного активу: назва + progress bar (відносний, від максимуму) + severity-badges (critical/high/medium/low) з title-атрибутом.
- Додано `Server` до імпортів lucide-react.
- Додано 5 нових тестів у `FindingsTab.test.tsx`.

### Що покращило / додало
- Security-команди тепер бачать одразу, які хости/сервіси найвразливіші.
- Панель collapsible — не заважає тим, хто не потребує цього view.
- Тести: 1315/1315 pass (було 1310), 98/98 файлів.
