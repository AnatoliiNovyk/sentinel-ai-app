# Fix: ProjectDetail test suite — ScansService.dispatchScan migration

## Як було
- `ProjectDetail.test.tsx` мокував `'../../lib/scanDispatch'` і перевіряв виклик `dispatchScan(userId, projectId, scanner, target)` — старий API
- 2 тести падали після рефакторингу `ProjectDetail.tsx`

## Що зроблено
1. Додано статичний `import { ScansService } from '../../api/scans.service'`
2. Додано `vi.mock('../../api/scans.service', ...)` — мок `ScansService.dispatchScan`
3. Додано `vi.mock('../../lib/agentHealth', ...)` — мок `probeAgentHealth` (повертає `{ reachable: false }`)
4. Тести переписані з `await import(...)` → `vi.mocked(ScansService.dispatchScan)`
5. Assertion виправлено: `('proj-1', 'nmap', 'example.com', 'org-1', false)` — `false` бо `probeAgentHealth` вже виконався до кліку

## Що виправило / покращило
- `ProjectDetail — quickScan > calls dispatchScan`: ✅ (був FAIL)
- `ProjectDetail — ScansTab > handleRescan calls dispatchScan`: ✅ (залишився)
- Загальна статистика: `83 failed → 82 failed`, `2473 passed → 2476 passed`
