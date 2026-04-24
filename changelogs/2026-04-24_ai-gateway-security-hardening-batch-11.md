Як було:
- Edge function [supabase/functions/ai-gateway/index.ts](supabase/functions/ai-gateway/index.ts) приймала body без строгої runtime-валідації структури payload.
- Для помилок використовувались різні формати відповіді, включно з поверненням `raw` вмісту AI при невалідному JSON у kill-chain гілці.
- Покриття тестами для контракту запиту/помилок gateway було відсутнє.

Що зроблено:
- Додано новий контрактний модуль [supabase/functions/ai-gateway/contract.ts](supabase/functions/ai-gateway/contract.ts):
  - типи `ChatMessage`, `GatewayAction`, `GatewayErrorCode`, `ParsedGatewayRequest`
  - строгий runtime parser `parseGatewayRequest(...)`
  - уніфікований builder помилок `gatewayError(...)`
  - обмеження/ліміти для вхідних даних (ролі, непорожні повідомлення, довжина, масив vulnerabilities тощо)
- Оновлено [supabase/functions/ai-gateway/index.ts](supabase/functions/ai-gateway/index.ts):
  - додано безпечний `jsonResponse(...)`
  - обробка невалидного JSON (`INVALID_JSON`, 400)
  - відхилення невалидного payload через єдиний формат `{ error: { code, message } }`
  - методи ≠ POST повертають `METHOD_NOT_ALLOWED`
  - для kill-chain помилки JSON від AI повертається safe error `AI_INVALID_JSON` (502) без `raw`
  - у `catch` повертається safe error `INTERNAL_ERROR` без витоку деталей
- Додано unit-тести [src/lib/__tests__/ai-gateway-contract.test.ts](src/lib/__tests__/ai-gateway-contract.test.ts):
  - valid chat payload
  - invalid role
  - valid kill-chain payload
  - invalid vulnerabilities
  - формат unified safe error
- Прогнано перевірки:
  - `npm run test:run` — PASS (24 тести, 8 файлів)
  - `npm run quality:check` — PASS

Що покращило/виправило/додало:
- Підвищено security/reliability edge endpoint через явну валідацію вхідних payload.
- Уніфіковано помилки API і прибрано ризик витоку внутрішніх/сирих даних у відповіді клієнту.
- Додано регресійне тест-покриття для контракту gateway, що зменшує ризик повторного ламання API-інтерфейсу.
