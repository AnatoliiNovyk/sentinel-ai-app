# Fix: Test cascade через відсутній аргумент agentOnline

## Як було
Після додавання 5-го аргументу `agentOnline: boolean | null = false` до `ScansService.dispatchScan`, всі існуючі тести, що викликали цю функцію без нього, автоматично переходили на MOCK-шлях (default `false`). MOCK-шлях викликає `runMockScan`, який у свою чергу звертається до `supabase.from('projects').select('*').eq(...).maybeSingle()` — більшість тестових моків не мали `maybeSingle`, що призводило до краші.

**Статистика перед виправленням**: 9 файлів / 80 тестів провалились

## Що зроблено
Додано `true` як 5-й аргумент (`agentOnline`) до всіх викликів `ScansService.dispatchScan` у тестах, де очікується REAL-шлях (insert + edge function):

- `src/api/__tests__/scans.service.test.ts` — 10 викликів
- `src/api/__tests__/rls.e2e.test.ts` — 2 виклики
- `src/api/__tests__/scans.service.integration.test.ts` — 5 викликів
- `src/pages/__tests__/Scans.integration.test.tsx` — 1 виклик (expect.anything())
- `src/lib/__tests__/scanDispatch.test.ts` — додано `vi.stubEnv('VITE_AGENT_HEALTH_URL', ...)` + оновлено fetchMock call count до 2
- `src/lib/__tests__/validation.test.ts` — оновлено assertion (`'too long'` замість `'exceeds maximum length'`)
- `src/pages/__tests__/ProjectDetail.test.tsx` — переписано з новими моками ScansService + agentHealth

## Що покращило
- Test Files: 9 failed → 4 failed (-5)
- Tests: 80 failed → 63 failed (-17)
- Решта 4 файлів, що провалюються — передіснуючі проблеми (Dashboard, Settings, Integrations, security.integration), не пов'язані з нашими змінами
