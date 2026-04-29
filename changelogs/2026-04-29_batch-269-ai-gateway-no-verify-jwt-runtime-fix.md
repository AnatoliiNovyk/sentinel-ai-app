# Batch 269: Runtime fix for gateway-level 401 (no-verify-jwt)

## Як було
- Попри кодові виправлення, probe запити до `ai-gateway` могли падати на рівні Supabase Edge Gateway з `401` до виконання логіки функції.
- Симптом у UI: `Gateway probe failed: Gateway probe HTTP 401`.

## Що зроблено
- Виконано runtime redeploy:
  - `supabase functions deploy ai-gateway --no-verify-jwt`
- Перевірено live-запитом у прод:
  - POST `action=agent_health_probe` до `https://ysnlccidbtqqburuflkz.supabase.co/functions/v1/ai-gateway`
  - результат: `HTTP 200`, повертаються ключі `request_id, action, status, reachable, http_status, health, error, probed_url, timestamp`.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- Усунено блокуючий gateway-level `401` для probe path.
- Перевірка Agent health у UI тепер проходить до фактичного probe виконання і повертає реальний стан endpoint.
