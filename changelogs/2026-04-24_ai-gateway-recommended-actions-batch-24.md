Як було:
- Admin diagnostics endpoint already повертав `alerts` і `overall_risk_level`, але не давав конкретних операційних дій для швидкого реагування.
- Для triage потрібно було вручну мапити сигналізатори на можливі кроки реагування.

Що зроблено:
- Оновлено [supabase/functions/ai-gateway/handler.ts](supabase/functions/ai-gateway/handler.ts):
  - додано тип `RecommendedAction`
  - додано константу `MAX_RECOMMENDED_ACTIONS = 5`
  - реалізовано `getAiGatewayRecommendedActions(alerts, overallRiskLevel)`
  - admin GET response розширено полем `recommended_actions`
- Логіка рекомендацій:
  - на `high_rate_limited_5m`: посилити rate-limits і перевірити burst джерела
  - на `high_unauthorized_5m`: аудит неавторизованих клієнтів/ротація секретів
  - на `high_invalid_json_5m`: перевірка client serialization/schema upstream
  - на `degraded_mode`: перевірка стану AI provider/failover policy
  - на `low` ризику без інших сигналів: baseline monitoring action
  - на `medium/high` ризику: додаткові escalation/review дії
  - загальна кількість обмежена до 5
- Оновлено [src/lib/__tests__/ai-gateway-admin-metrics.test.ts](src/lib/__tests__/ai-gateway-admin-metrics.test.ts):
  - low-risk сценарій: перевірка baseline recommendation
  - high-risk сценарій: перевірка набору релевантних action ids і ліміту <= 5
- Прогнано перевірки:
  - `npm run test:run` — PASS (12 файлів, 50 тестів)
  - `npm run quality:check` — PASS

Що покращило/виправило/додало:
- Додано actionable diagnostics для швидшого runbook-driven реагування.
- Зменшено час від виявлення проблеми до конкретних кроків стабілізації gateway.
- Збережено low-risk архітектуру: зміни обмежені admin diagnostics, основний POST flow не змінено.
