# Fix: Scan FAILED bug in ProjectDetail

**Дата**: 2026-05-05  
**Файл**: `src/pages/ProjectDetail.tsx`

---

## Як було

`ProjectDetail.tsx` ініціював скани через старий `dispatchScan` з `src/lib/scanDispatch.ts`.
Ця функція виконувала власну перевірку `isAgentReachable()` та при офлайн-агенті
перевіряла змінну `ALLOW_MOCK_FALLBACK`:

```typescript
const ALLOW_MOCK_FALLBACK = import.meta.env.DEV || import.meta.env.VITE_ALLOW_MOCK_SCAN_FALLBACK === 'true';
```

У продакшені без `VITE_ALLOW_MOCK_SCAN_FALLBACK=true` → `ALLOW_MOCK_FALLBACK = false`  
→ агент офлайн + fallback вимкнено → скан отримував статус `failed` замість mock-режиму.

При цьому `Scans.tsx` вже правильно використовував `ScansService.dispatchScan` з передачею
зовнішнього `agentReachable` стану, який при `!agentOnline` запускав mock безпосередньо.

---

## Що зроблено

### 1. Замінено імпорт (`ProjectDetail.tsx`, рядок ~31)
```typescript
// Було:
import { dispatchScan } from '../lib/scanDispatch';

// Стало:
import { ScansService } from '../api/scans.service';
import { probeAgentHealth } from '../lib/agentHealth';
```

### 2. Додано `agentReachable` state + health polling (такий самий патерн як у `Scans.tsx`)
```typescript
const [agentReachable, setAgentReachable] = useState<boolean | null>(null);
const DEFAULT_AGENT_HEALTH_URL = ... ?? 'http://95.67.75.146:9090/health';

useEffect(() => {
  // probeAgentHealth кожні 30 секунд
  checkAgent();
  const id = setInterval(checkAgent, 30_000);
  return () => { active = false; clearInterval(id); };
}, [DEFAULT_AGENT_HEALTH_URL]);
```

### 3. Оновлено `quickScan()` — кнопка "Run scan" на overview
```typescript
// Було:
const result = await dispatchScan(user.id, project.id, defaultScanner, project.target ?? '');
if (!result.ok) { alert(errorToUserMessage(result.error)); return; }

// Стало:
await ScansService.dispatchScan(project.id, defaultScanner, project.target ?? '', project.org_id, agentReachable);
```

### 4. Оновлено `onRescan` handler — кнопка "Re-run" в ScansTab
```typescript
// Було:
if (!user) return;
const result = await dispatchScan(user.id, project.id, scanner, project.target ?? '');
if (!result.ok) alert(errorToUserMessage(result.error));

// Стало:
try {
  await ScansService.dispatchScan(project.id, scanner, project.target ?? '', project.org_id, agentReachable);
  await load();
} catch (err) { alert(errorToUserMessage(err)); }
```

---

## Що виправило / покращило

- **Виправлено**: скани більше не отримують статус `failed` при офлайн-агенті в продакшені
- **Виправлено**: `ProjectDetail.tsx` тепер використовує той самий патерн, що й `Scans.tsx`  
- **Покращено**: автоматичне health-polling кожні 30s — UI знає стан агента в реальному часі
- **Покращено**: якщо агент недоступний → скан запускається в mock-режимі автоматично
- **Перевірено**: `npm run build` — успішно (1591 modules, 2.03s)
