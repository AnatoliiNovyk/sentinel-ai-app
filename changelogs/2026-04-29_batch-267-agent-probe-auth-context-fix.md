# Batch 267: Agent probe auth-context fix (remove gateway 401)

## Як було
- У Settings для `http://95.67.75.146:9090/health` з'являлась помилка:
  `Agent unreachable: Gateway probe failed: Gateway probe HTTP 401`.
- Причина: server-side probe у frontend helper викликав `ai-gateway` через сирий `fetch` на `/functions/v1/ai-gateway`, що могло не передавати коректний auth-контекст так, як очікує Supabase Edge runtime.

## Що зроблено
- Оновлено [src/lib/agentHealth.ts](src/lib/agentHealth.ts):
  - замінено raw `fetch` на `supabase.functions.invoke('ai-gateway', { body: { action: 'agent_health_probe', url } })`;
  - probe тепер використовує стандартний auth flow клієнта Supabase і уніфіковану обробку помилок invoke.

## Що покращило
- Прибрано джерело 401-помилки від gateway-виклику в health probe.
- Підвищено сумісність з прод auth/session контекстом Supabase.
- Поведінка agent health check стала стабільнішою для HTTPS UI + HTTP агент endpoint.
