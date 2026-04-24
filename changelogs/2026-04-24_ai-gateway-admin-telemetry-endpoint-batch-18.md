Як було:
- У gateway вже були telemetry counters, але не було окремого безпечного endpoint-режиму для читання telemetry snapshot.
- Для діагностики доводилося покладатися на логи, що ускладнювало оперативну перевірку стану лічильників.

Що зроблено:
- Оновлено [supabase/functions/ai-gateway/handler.ts](supabase/functions/ai-gateway/handler.ts):
  - додано admin header `x-gateway-admin-key`
  - додано GET режим для metrics snapshot з перевіркою env-ключа `AI_GATEWAY_ADMIN_KEY`
  - при невалідному/відсутньому ключі повертається safe error `401` (`UNAUTHORIZED`)
  - при валідному ключі повертається JSON зі структурою:
    - `request_id`
    - `telemetry` (snapshot поточних counters)
  - збережено незмінну поведінку стандартного POST flow
- Оновлено [src/lib/__tests__/ai-gateway-handler.test.ts](src/lib/__tests__/ai-gateway-handler.test.ts):
  - метод для 405-кейсу змінено з GET на PUT (бо GET тепер має службовий режим)
- Додано нові тести [src/lib/__tests__/ai-gateway-admin-metrics.test.ts](src/lib/__tests__/ai-gateway-admin-metrics.test.ts):
  - 401 без валідного admin key
  - 200 з валідним admin key + перевірка telemetry snapshot
  - перевірка, що стандартний POST flow лишився робочим
- Прогнано перевірки:
  - `npm run test:run` — PASS (48 тестів, 12 файлів)
  - `npm run quality:check` — PASS

Що покращило/виправило/додало:
- Додано контрольований сервісний доступ до telemetry без потреби парсити логи.
- Збережено безпечний доступ через окремий admin key і safe error responses.
- Підвищено операційну спостережуваність gateway без впливу на основний користувацький POST-потік.
