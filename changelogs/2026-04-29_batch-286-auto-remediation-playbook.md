# Batch-286 — Auto-Remediation Dry-Run Playbook + EXECUTION_CHECKLIST update

**Дата:** 2026-04-29  
**Commit:** (pending)

---

## Як було

- `RemediationModal` показував тільки steps для конкретного типу remediation (terraform/aws-cli/bash/manual).
- Не було жодного preview auto-remediation команд для network-level блокування або OS-патчингу.
- `EXECUTION_CHECKLIST_2026-04-28.md` не містив запису про batch-285.

---

## Що зроблено

### 1. `EXECUTION_CHECKLIST_2026-04-28.md`
- Додано секцію `## Batch-285 (2026-04-29)` із усіма 5 пунктами (CI/CD gates, Issue Tracker Templates, Phishing Drill Plan, тести, commit).

### 2. `src/components/RemediationModal.tsx`
- Додано функцію `getAutoPlaybook(vuln)`, що генерує preview-команди на основі поля `asset` та `cve_id`:
  - iptables block (INPUT + FORWARD)
  - ufw deny
  - AWS CLI revoke-security-group-ingress
  - apt/yum patch (якщо є `cve_id`)
- Додано collapsible панель **"Auto-Remediation Playbook"** з міткою `DRY RUN`:
  - Розкривається по кліку на заголовок
  - Показує preview note "Review and test in staging"
  - Кожен запис має Copy кнопку з `amber` accent
- Нові іконки: `Zap`, `ChevronDown`

### 3. `src/components/__tests__/RemediationModal.test.tsx`
- Додано `describe('RemediationModal — Auto-Remediation Playbook')` з 5 тестами:
  1. Рендериться кнопка toggle з міткою DRY RUN
  2. Entries не відображаються до expand
  3. Після кліку — 3 network-block entries видимі
  4. CVE patch entries видимі якщо є `cve_id`
  5. Preview warning note видимий після expand

---

## Що покращило / виправило / додало

- **Нова фіча:** Auto-Remediation Dry-Run Playbook — безпечна preview-only auto-remediation для рекомендації колеги (Recommendation 1). Команди генеруються автоматично з asset/CVE context, але виконуються виключно вручну після review.
- **Документація:** EXECUTION_CHECKLIST оновлено — batch-285 тепер задокументовано.
- **Тести:** +5 нових тестів; RemediationModal: 15 → 20 тестів; 53/53 в batch-286 файлах PASS.
- **Білд:** ✅ 5.22s, без помилок.
