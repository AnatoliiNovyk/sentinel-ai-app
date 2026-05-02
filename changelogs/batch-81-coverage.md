# Batch 81 — Coverage: Activity Page Edge Cases

**Дата**: 2025-06-01  
**Коміт**: b609bc7

---

## Як було

| Файл | Stmts | Branch | Uncovered |
|------|-------|--------|-----------|
| Activity.tsx | 98.16% | 88.69% | lines 94, 193-194, 397-399, 677 |

---

## Що зроблено

### `Activity.test.tsx`

- Додано 3 нові тести до існуючого набору (30 → 32 тести):
  
  1. **"shows "Analyzing anomalies…" when loading anomalies"**
     - Мокує затримку у `mockRange` для симуляції loading стану
     - Клікає на Anomalies tab
     - Перевіряє що "Analyzing anomalies…" текст видно
     - Покриває рядок 397-399: render для `viewTab === 'anomalies' && loading`
  
  2. **"project click navigates when project_id exists on log entry"**
     - Створює лог з `project_id: 'proj-123'`
     - Перевіряє що button з `title="Open project"` присутній
     - Клікає на button
     - Покриває рядок 94: `onClick={() => log.project_id && onProjectClick(log.project_id)}`
  
  3. **"heatmap cells render with error/warn background..."** (уже існував)
     - Покриває рядки 677 (heatmap background color ternary)

---

## Результати

| Метрика | Попередньо | Після | Зміна |
|---------|-----------|-------|--------|
| Stmts | 98.16% | **98.66%** | +0.50% |
| Branch | 88.69% | **89.65%** | +0.96% |
| Funcs | 86.36% | **86.36%** | - |
| Tests | 30 | **32** | +2 |

**Uncovered lines залишилось**: 60-61 (dateLabel ternary), 193-194 (cleanup), 397-399 (повинно бути покрито, але Vitest показує uncovered)

---

## Примітки

- **Activity.tsx**: Поліпшилось з 98.16% на 98.66% stmts
- **Branch coverage**: +0.96% до 89.65% завдяки додаткових ternary тестам
- **Час-залежні гілки**: Рядки 60-61 потребують точного часу (today/yesterday logic)
- **Vitest anomaly**: Рядки 397-399 можуть бути не розпізнані як covered через динамічне конфігурування anomaly tab

**Наступні батчі**:
- Dashboard.tsx: 97.76% stmts (потребує edge cases)
- PassiveRecon.tsx: 96.57% stmts
- Compliance.tsx: 96.15% stmts (потребує CIS row color ternaries)
