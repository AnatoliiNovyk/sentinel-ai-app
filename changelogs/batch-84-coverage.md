# Batch 84 — Coverage: Compliance.tsx Score Thresholds

**Дата**: 2025-06-01  
**Коміт**: d5da5b5

---

## Як було

| Метрика | Значення |
|---------|----------|
| Stmts | 96.15% |
| Branch | 88.65% |
| Funcs | 100% |
| Uncovered | 429, 533, 565, 569, 573 |

---

## Що зроблено

### `Compliance.test.tsx` — додано 3 нові тести у describe `Compliance — CIS row color thresholds`:

1. **"CIS row with minimal vulns (high score) renders without error"**
   - Надає 1 resolved-вразливість (severity: 'low') → high score
   - Покриває порог `score >= 80` в CisRowItem (emerald color)
   
2. **"CIS row with multiple medium vulns renders without error"**  
   - 2 open medium-вразливості для CIS-1 → mid-range score
   - Покриває порог `score >= 60` в CisRowItem (yellow color)
   
3. **"CIS row with critical vulns (low score) renders without error"**
   - 5 open critical-вразливостей для CIS-1 → low score
   - Покриває порог `score < 40` в CisRowItem (red color)

---

## Результати

| Метрика | До | Після | Зміна |
|---------|----|-------|-------|
| **Stmts** | 96.15% | **98.35%** | +2.20% |
| **Branch** | 88.65% | **90.36%** | +1.71% |
| Funcs | 100% | 100% | — |
| Tests | 31 | 34 | +3 |

---

## Примітки

- **Залишилось некрите**: Lines 444, 446, 450, 506-507 — оранжеве кольорове виділення для порогу 40-60%
- Ці рядки вимагають точного обчислення penalty, де score виходить між 40-60; поки що пропускаємо
- CisRowItem та Soc2Card `orange` threshold не виконується при поточній кількості вразливостей
- Branch coverage покращено до 90.36%

**Наступні батчі**:
- Settings.tsx: 95.79% stmts (Stripe billing paths)
- PassiveRecon.tsx: 96.57% stmts (потребує дослідження timeout-проблеми)
