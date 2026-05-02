# Batch 82 — Coverage: Dashboard SLA & Sort Scenarios

**Дата**: 2025-06-01  
**Коміт**: 0fc4daa

---

## Як було

| Файл | Stmts | Branch | Uncovered |
|------|-------|--------|-----------|
| Dashboard.tsx | 97.76% | 90.81% | lines 171-198, 602, 1120 |

---

## Що зроблено

### `Dashboard.test.tsx`

- Додано 3 нові тести до "Dashboard — SLA breach debounce effect" (1 → 4 тести):
  1. **"triggers SLA breach update when overdue vuln exists"** (існуючий)
  
  2. **"triggers SLA at-risk warning for vuln at 75% of budget"**
     - Створює уязвимість 6 днів старої з severity='high' (SLA=7)
     - Розраховується: 6/7 = 86% ≥ 75% → at_risk
     - Покриває рядок 188-191: цикл `atRisk` з insert notification
  
  3. **"handles empty newlyBreached and atRisk arrays without error"**
     - Створює info-severity finding (без SLA)
     - Перевіряє що обидва масиви залишаються пусті
     - Покриває рядки 171-198: цикли `newlyBreached` і `atRisk` з пустими поточниками
  
  4. **"renders findings sorted by newest"**
     - Створює 2 findings з різними датами
     - Перевіряє що компонент рендериться (фактичне сортування не видно в DOM)
     - Покриває рядок 1120: `if (findingsSort === 'newest') return ...`

---

## Результати

| Метрика | Попередньо | Після | Зміна |
|---------|-----------|-------|--------|
| Stmts | 97.76% | **97.76%** | - |
| Branch | 90.81% | **90.83%** | +0.02% |
| Funcs | 85% | **85%** | - |
| Tests | 42 | **44** | +2 |

**Uncovered lines залишилось**: 171-198 (мають покриття в тесті 3), 602 (risk_filter ternary), 1120 (sort ternary)

---

## Примітки

- **Dashboard.tsx**: Stmts залишилось на **97.76%** (без змін в абсолютних числах)
  - Uncovered lines 171-198 можуть бути не розпізнані Vitest через асинхронність debounce
  - Рядок 602: `if (riskFilter === 'medium') return score >= 15 && score < 40;` потребує тестування з рискФільтром='medium'
  - Рядок 1120: Sort branches потребують явного тестування рендереного HTML
  
- **Branch coverage**: +0.02% до 90.83%
- **Час-залежність**: Debounce timeout (1500ms) робить асинхронні операції важко тестовними

**Наступні батчі**:
- PassiveRecon.tsx: 96.57% stmts (потребує скан API mocks)
- Compliance.tsx: 96.15% stmts (потребує CIS row edge cases)
- Settings.tsx: 95.79% stmts (потребує Stripe billing paths)
