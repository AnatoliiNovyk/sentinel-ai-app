# Batch-292 Changelog

## Що було

- `src/lib/agentHealth.ts` — без тестів (`isMixedContentAgentUrl`, `isHttpsAgentUrl`, `probeAgentHealth`)
- `src/lib/useSearchShortcut.ts` — без тестів (хук: `/` → focus, `Escape` → clear+blur)
- `src/lib/useStickyHeader.ts` — без тестів (хук: `IntersectionObserver` → `stuck`)
- Загальна кількість тестів: **1216**

## Що зроблено

Створено 3 нових тестових файли:

### `src/lib/__tests__/agentHealth.test.ts` (14 тестів)
- `isMixedContentAgentUrl` — https-page + http-agent → true; http-page + http-agent → false; https+https → false; invalid URL → false
- `isHttpsAgentUrl` — https → true; http → false; invalid → false
- `probeAgentHealth` — direct fetch success/fail; gateway fallback після network error; direct error якщо gateway теж недоступний
- `probeAgentHealth` forced gateway (mixed content) — виклик supabase functions.invoke; error від gateway; виняток при invoke

### `src/lib/__tests__/useSearchShortcut.test.ts` (5 тестів)
- `/` фокусує input коли активний елемент не є input/textarea/select
- `/` не фокусує, якщо вже всередині іншого input
- `Escape` викликає `onClear` і блурить input коли він активний
- `Escape` не викликає `onClear` якщо input не активний
- Cleanup: `removeEventListener` викликається при unmount

### `src/lib/__tests__/useStickyHeader.test.ts` (5 тестів)
- Початковий стан `stuck=false`
- `observe` викликається з sentinel-елементом
- Callback з `isIntersecting=false` → `stuck=true`
- Callback з `isIntersecting=true` після stuck → `stuck=false`
- `disconnect` викликається при unmount
- **Техніка**: компонент-обгортка `StickyTestComponent` замість `renderHook` — бо `renderHook` не монтує реальний DOM-елемент і `sentinelRef.current` залишається null

## Що покращило / виправило / додало

- **+24 нових тести** (1216 → 1240), всі 1240 проходять
- Повне тестування `window.location`-чутливої логіки через `Object.defineProperty` (agentHealth)
- Виявлено та вирішено проблему з `renderHook` + IntersectionObserver: потрібен wrapper-компонент для монтування ref у реальний DOM
- Commit: `6687ce1`
