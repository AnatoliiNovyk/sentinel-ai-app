# Batch 73 — Self-Review Fixes

## Як було

Після batch-72 самоперевірка виявила 6 проблем:

1. **Chat.tsx — `setSending(false)` поза `finally`**: якщо `supabase.insert('ai_messages')` кидав виняток, UI назавжди зависав у стані відправки
2. **Chat.tsx — зайвий `clearInterval` в `else`**: `clearInterval(phaseTimer)` викликався двічі (в `else`-гілці та в `finally`)
3. **Scans.tsx — `alert()` в `handleStartScan`**: після batch-72 `handleAiGeneration` використовував `setAiGenError`, але `handleStartScan` залишив `alert()` — непослідовно
4. **Scans.tsx — результат `supabase.update()` не перевірявся**: при помилці update UI показував "успіх"
5. **Scans.integration.test.tsx — мертвий мок `useAuth`**: `useAuth` вже прибраний зі `Scans.tsx`, але мок залишився
6. **Scans.integration.test.tsx — слабкі assertions**: тест перевіряв лише кількість викликів `getScanVulnerabilities`, не перевіряв зміст prompt і payload update

## Що зроблено

### `src/pages/Chat.tsx`
- Прибрано зайвий `clearInterval(phaseTimer)` з `else`-гілки (залишено тільки в `finally`)
- `setSending(false)` перенесено в окремий `try/finally` блок навколо `supabase.insert('ai_messages')` — гарантує виклик навіть при помилці DB

### `src/pages/Scans.tsx`
- `alert('Failed to start scan: ...')` → `setAiGenError('Failed to start scan: ...')` в `handleStartScan`
- Додано перевірку результату `supabase.update()`: `const { error: updateError } = await ...` → `if (updateError) throw new Error(updateError.message)`

### `src/pages/__tests__/Scans.integration.test.tsx`
- Видалено мертвий `vi.mock('../../context/useAuth', ...)` (компонент більше не імпортує `useAuth`)
- Посилено тест "runs AI generation flow":
  - Додано `expect(mockCallAiGateway).toHaveBeenCalledWith([expect.objectContaining({ content: expect.stringContaining('Outdated package') })])` — перевіряє що prompt містить назву вразливості
  - Додано `expect(mockVulnUpdate).toHaveBeenCalledWith(expect.objectContaining({ description: 'Fix it', remediation: 'Update package', remediation_code: 'npm update' }))` — перевіряє що правильні дані передаються в update

## Що покращило / виправило / додало

- ✅ **Виправлено**: UI більше не зависає якщо `supabase.insert(ai_messages)` кидає виняток
- ✅ **Виправлено**: `alert()` повністю прибрано зі Scans — вся обробка помилок через inline toast
- ✅ **Виправлено**: помилка DB при `update vulnerabilities` тепер пробрасується і відображається користувачу
- ✅ **Покращено**: тест AI generation flow тепер перевіряє контракт (prompt + payload), а не просто лічильники
- ✅ **Покращено**: прибраний мертвий мок не вводить в оману при читанні тестів
- ✅ **Quality gate**: 77 test files, 1019 tests passed, exit 0
