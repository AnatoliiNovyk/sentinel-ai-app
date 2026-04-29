# Batch 275 — Browserslist PR Routing Hardening

## Як було
- Workflow оновлення Browserslist DB вже створював maintenance PR.
- Не було explicit auto-assign на відповідального.
- Логіка anti-duplicate була неочевидною з опису workflow.

## Що зроблено
- У `.github/workflows/browserslist-db-maintenance.yml` додано `issues: write` permission.
- Додано `assignees: ${{ github.repository_owner }}` для auto-assign maintenance PR.
- Опис PR доповнено явною приміткою про anti-duplicate guard через fixed branch `chore/browserslist-db-refresh`.
- Оновлено `EXECUTION_CHECKLIST_2026-04-28.md` новим пунктом батчу.

## Що це покращило
- Maintenance PR автоматично маршрутизується на відповідального без ручних дій.
- Поведінка щодо недопущення дублювання PR стала явною й прозорою.
- Підтримка Browserslist DB лишається регулярною та контрольованою через review-процес.
