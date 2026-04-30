# Batch-299 — Coverage: PresenceContext, AuthContext, agentTools

## Як було

- `src/context/PresenceContext.tsx`: покриття **4.54%** (глобальний мок в setup.ts блокував весь файл, жодних тестів)
- `src/context/AuthContext.tsx`: покриття **53.75%** (лінії 28-39 — onAuthStateChange callback, лінії 52-87 — user effect з fetch profile/orgs — не тестувались)
- `src/lib/agentTools.ts`: покриття **60.83%** (toolListProjects, toolListScans, list_findings case в runAgent — не тестувались)
- Загальна кількість тестів: **1345**

## Що зроблено

### `src/context/__tests__/PresenceContext.test.tsx` (НОВИЙ ФАЙЛ)
- `vi.unmock('../PresenceContext')` — скасовує глобальний мок з setup.ts
- `describe('usePresence')` (1 тест): throws без PresenceProvider
- `describe('PresenceProvider')` (4 тести):
  - renders children
  - `getMembersViewing` повертає порожній масив для невідомого контексту
  - `updatePresence` нічого не робить коли user = null
  - `updatePresence` викликає supabase upsert коли user/profile/orgs заповнені

### `src/context/__tests__/AuthContext.test.tsx`
- Додано 3 тести до блоку `AuthProvider`:
  - `sets user when auth callback fires with a session` — перевіряє що user встановлюється коли callback спрацьовує з SIGNED_IN
  - `clears profile and organizations on SIGNED_OUT event` — перевіряє очищення при SIGNED_OUT (лінії 36-38)
  - `fetches existing profile when user is set via auth callback` — повний цикл fetch profile + organizations (лінії 52-87)

### `src/lib/__tests__/agentTools.integration.test.ts`
- Оновлено supabase mock: додано chain для `scans` таблиці (`select → order → limit`)
- Додано 4 нових describe:
  - `list_projects`: перевірка "No projects" відповіді
  - `list_scans`: перевірка "No scans" відповіді
  - `list_findings`: перевірка "0 findings" відповіді
  - `run_scan`: перевірка поведінки без orgId

## Що покращило/виправило/додало

- +12 нових тестів (1345 → **1357**)
- Покриття `PresenceContext.tsx`: 4.54% → ~80%+
- Покриття `AuthContext.tsx`: 53.75% → ~85%+
- Покриття `agentTools.ts`: 60.83% → ~75%+
- Commit: `5fa0435` — pushed to `main`
