# Batch 268: ai-gateway apikey auth compatibility (final 401 hotfix)

## Як було
- Після попередніх виправлень UI перестав показувати mixed-content false-positive, але gateway probe все ще міг падати з `HTTP 401`.
- Причина: в `ai-gateway` для POST приймався лише `Authorization: Bearer`, тоді як `supabase.functions.invoke` в окремих сценаріях опирається на `apikey` header.

## Що зроблено
- Оновлено [supabase/functions/ai-gateway/handler.ts](supabase/functions/ai-gateway/handler.ts):
  - додано `hasValidApiKeyHeader`;
  - введено `hasValidClientAuth` (`Bearer` OR `apikey`);
  - POST auth-гейт тепер приймає обидва шляхи.
- Оновлено тести [src/lib/__tests__/ai-gateway-handler.test.ts](src/lib/__tests__/ai-gateway-handler.test.ts):
  - оновлено очікуваний текст `UNAUTHORIZED` повідомлення;
  - додано позитивний тест для POST з `apikey` без `Authorization`.
- Прогнано валідацію:
  - targeted tests (handler/contract/settings) — PASS;
  - lint — PASS;
  - build — PASS.
- Виконано деплой: `supabase functions deploy ai-gateway` — PASS.

## Що покращило
- Прибрано джерело `Gateway probe HTTP 401` для реального прод-сценарію invoke.
- Agent health check через gateway став сумісним з auth-механікою Supabase клієнта.
- Фінальний hotfix закріплено тестами і задеплоєно.
