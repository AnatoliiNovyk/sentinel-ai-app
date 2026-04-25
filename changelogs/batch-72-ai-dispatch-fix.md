# Batch 72 — AI Dispatch Fix

## Як було

- `src/pages/Chat.tsx` викликав `AiService.dispatchChatTask()` → `pollForResult()` для отримання відповіді AI
- `src/pages/Scans.tsx` викликав `AiService.generateFix()` → `pollForResult()` для генерації AI-фіксу по вразливості
- Обидві функції зверталися до PostgreSQL RPC `dispatch_ai_task` через `supabase.rpc()`
- Ця функція **не існує в базі даних** (відсутня в `SETUP.sql` та міграціях)
- Результат: runtime-помилка **"AI task dispatch failed"** при кожному зверненні до AI в обох сторінках
- Тести `Chat.integration.test.tsx` і `Scans.integration.test.tsx` мокали `AiService` — тести проходили, але реальна функціональність була зламана

## Що зроблено

### `src/pages/Chat.tsx`
- Видалено імпорти: `AiService`, `errorToUserMessage`, `ScansService`, `Project`
- Видалено невикористану функцію `extractAssistantText`
- Видалено state `projects/setProjects` (більше не потрібен)
- Спрощено `useEffect` для завантаження даних (прибрано `Promise.all` з `getProjects`)
- Додано імпорт `callAiGateway, type ChatMessage` з `../lib/aiGateway`
- Додано state `activeProvider` (динамічний badge провайдера)
- Замінено блок `dispatch + poll` на:
  1. Спроба `runAgent()` (локальні інструменти — nmap, DB-запити)
  2. Fallback → `callAiGateway(history)` з останніми 10 повідомленнями
- `providerMeta` тепер динамічний: `PROVIDER_META[activeProvider] ?? PROVIDER_META.mock`

### `src/pages/Scans.tsx`
- Видалено імпорти: `AiService`, `errorToUserMessage`, `useAuth`
- Видалено `const { user } = useAuth()` (більше не потрібен)
- Додано імпорти: `callAiGateway` з `../lib/aiGateway`, `supabase` з `../api/client`
- Додано state `aiGenError` для inline error toast (замість `alert()`)
- Повністю переписано `handleAiGeneration`:
  1. Формує prompt з деталями вразливості (title, description, cve_id, severity, asset)
  2. Викликає `callAiGateway([{ role: 'user', content: prompt }])`
  3. Парсить JSON відповідь `{ explanation, remediation, code }`
  4. Зберігає результат через `supabase.from('vulnerabilities').update(...).eq('id', v.id)`
  5. Перезавантажує список через `loadVulnerabilities(v.scan_id)`
- Додано inline error banner (червоний, з кнопкою dismiss)

### Тести
- `src/pages/__tests__/Chat.integration.test.tsx` — повністю переписано під нову логіку:
  - Видалено моки `AiService`, `ScansService`, `ErrorCode`
  - Додано мок `callAiGateway` з `../../lib/aiGateway`
  - 4 нові тести: agent path, gateway fallback, gateway error, thinking label
- `src/pages/__tests__/Scans.integration.test.tsx` — оновлено:
  - Видалено мок `AiService`
  - Додано моки `callAiGateway` та `supabase` (vulnerabilities update)
  - Виправлено тест "dispatches new scan": очікування через `waitFor(() => screen.getByText('open-new-scan'))` замість `waitFor(getProjects)`

## Що покращило / виправило / додало

- ✅ **Виправлено**: Chat більше не кидає "AI task dispatch failed" — відповідає через `callAiGateway` з fallback на mock
- ✅ **Виправлено**: AI-генерація фіксів у Scans працює — результат зберігається напряму в БД
- ✅ **Покращено**: Chat показує динамічний badge провайдера (Gemini / Claude / GPT-4o / Local AI)
- ✅ **Покращено**: Scans показує inline error замість `alert()`
- ✅ **Quality gate**: 77 test files, 1019 tests passed, exit 0
