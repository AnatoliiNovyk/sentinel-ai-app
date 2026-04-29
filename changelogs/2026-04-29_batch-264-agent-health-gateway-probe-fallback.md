# Batch 264: Agent health gateway-probe fallback for HTTPS frontend

## Як було
- На HTTPS фронтенді прямий check до HTTP агента блокується браузером (mixed content).
- Перевірка через `https://...:9090/health` теж падала, бо порт агента HTTP-only і не має TLS.
- У результаті health check лишався недоступним для реального online стану з UI.

## Що зроблено
- Розширено контракт ai-gateway:
  - додано `action=agent_health_probe` з валідацією `url` (`http/https`, без credentials).
  - файл: [supabase/functions/ai-gateway/contract.ts](supabase/functions/ai-gateway/contract.ts)
- Розширено handler ai-gateway:
  - додано server-side probe заданого health URL з timeout;
  - додано SSRF-safe guard (блок localhost/private/link-local/meta адрес);
  - повертається уніфікована відповідь `reachable/http_status/health/error`.
  - файл: [supabase/functions/ai-gateway/handler.ts](supabase/functions/ai-gateway/handler.ts)
- Додано shared frontend helper:
  - [src/lib/agentHealth.ts](src/lib/agentHealth.ts)
  - логіка: direct check -> fallback до `ai-gateway` probe; для mixed-content одразу gateway probe.
- Інтегровано helper у UI:
  - [src/pages/Settings.tsx](src/pages/Settings.tsx)
  - [src/components/AppLayout.tsx](src/components/AppLayout.tsx)
  - [src/pages/Scans.tsx](src/pages/Scans.tsx)
- Додано/оновлено тести:
  - [src/lib/__tests__/ai-gateway-contract.test.ts](src/lib/__tests__/ai-gateway-contract.test.ts)
  - [src/lib/__tests__/ai-gateway-handler.test.ts](src/lib/__tests__/ai-gateway-handler.test.ts)
  - [src/pages/__tests__/Settings.test.tsx](src/pages/__tests__/Settings.test.tsx)
  - [src/components/__tests__/AppLayout.test.tsx](src/components/__tests__/AppLayout.test.tsx)
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- Agent health check почав працювати в HTTPS UI навіть для HTTP-only агента (через server-side probe).
- Знято залежність від браузерних mixed-content обмежень для діагностики доступності агента.
- Зменшено ризик SSRF у probe endpoint за рахунок host guard.
- Поведінка закріплена тестами на рівні контракту, handler і UI.
