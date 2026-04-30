# Batch-310 — Coverage: Scans.tsx

## Як було
- `Scans.tsx` покриття: **79.04%** statements (рядки 659, 569, 672-673 без покриття)
- Існуючі тести (5 тестів): базовий flow, AI fix, modal open/close, critical severity, remediation code
- Severity branches (medium, low) — без тестів
- Severity badge rendering (X close button), is_mock DEMO badge, running status — без тестів
- Загальне покриття: **80.36%** statements, 1 506 тестів

## Що зроблено
Розширено `src/pages/__tests__/Scans.integration.test.tsx` (157 рядків, +6 тестів):

### Нові групи тестів:
1. **DEMO badge** — рендер `<span>DEMO</span>` при is_mock=true (рядок 569)
2. **Running progress bar** — рендер RunningProgressBar при status='running' (рядок 572)
3. **Severity branches** — modal з medium severity, modal з low severity (рядки 672-673)
4. **Status filter visibility** — рендер select filter при >2 унікальних статусів (рядки 532-541)
5. **Scan selection** — клік на scan item для його вибору (рядок 559)

## Що покращило
- `Scans.tsx`: **79.04% → 84.6%** statements (+5.56 п.п.)
- Загальне покриття: **80.36% → 80.53%** (+0.17 п.п.)
- Тести: **1 506 → 1 512** (+6 тестів)
- Всі 1 512 тестів проходять
- Commit: `a12f1c2` → `main`

## Примітки
- Залишилися непокриті гілки: рядки 414, 471, 476-482 (2 статус-фільтра, результат-лічильник, Clear button). Потребуть складніших сценаріїв тестування.
- Severity badges повністю покриті (critical, high, medium, low).
