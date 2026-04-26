# Batch-151 — Advanced Dashboard Analytics

**Commit:** `6600378`  
**File:** `src/pages/Dashboard.tsx`

---

## Як було

Dashboard містив: KPI-картки зі Sparkline, banner критичних знахідок, 14-денний area-trend chart відкритих/закритих, панель ризику по проектах, SLA Watch, live/recent scans, Team panel, таблицю top open findings.  
Відсутня будь-яка analytics-секція з velocity, SLA compliance, MTTR.

## Що зроблено

Додано нову секцію **"Analytics"** між bottom row і top open findings, що містить 4 нові віджети:

### 1. Scan Velocity Chart
- SVG bar chart (14 днів), stacked bars: Completed (emerald) + Failed (red)
- Допоміжна функція `buildScanVelocity(scans, days)`
- Summary pills нижче: Total scans / Completed / Failed

### 2. SLA Compliance Gauge
- SVG donut gauge з динамічним відсотком (0–100%)
- Колір: зелений (≥80%), жовтий (≥50%), червоний (<50%)
- Лічильники On track / Breached / Total
- `slaGauge` computed через `useMemo` з `slaRows`

### 3. Risk Score Trend Chart
- SVG area line chart (30 днів), фіолетовий колір
- `buildRiskTrend()` — симулює накопичений ризик-score на кожен день (з ваговими коефіцієнтами: critical=10, high=5, medium=2, low=1), нормалізує до 0–100
- Trend indicator (↑/↓/—) з delta від першого до останнього дня

### 4. MTTR + Severity Distribution (в одній колонці)
- **MTTR**: середній час ремедіації (днів) по resolved-знахідках
- **Severity distribution**: горизонтальні прогрес-бари для critical/high/medium/low/info з % та кількістю

## Що покращило / виправило / додало

- Dashboard отримав actionable analytics без нових залежностей (тільки вбудований SVG)
- Всі нові компоненти слідують існуючим патернам (SVG, useMemo, ref-based dynamic width)
- Виправлено залишковий `style={{ width }}` у `SlaGroup` — замінено на ref-based підхід
- 0 ESLint помилок після реалізації
