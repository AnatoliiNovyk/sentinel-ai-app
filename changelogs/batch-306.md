# Batch-306 — Coverage improvements

## Як було
- `ai.service.ts`: 77.83% statements — метод `dispatchChatTask` і catch-блок `pollForResult` не мали тестів
- `aiRedTeam.ts`: 95.55% — catch-блок після `JSON.parse` (рядки 69-70) не був покритий
- `exporters.ts`: 95.95% — гілки `scoreToSeverity` (high/medium/low/info) та fallback-ланцюг description не були покриті
- `supplyChain.ts`: 89.79% — catch-блок `parseSbom` (рядки 391-392) не був покритий
- Загальне покриття: 78.84% statements, 78.25% branches, 59.56% functions
- Тестів: 1447

## Що зроблено
### `src/api/ai.service.test.ts` (+7 тестів)
- `'returns AI_RPC_FAILED when dispatchChatTask rpc fails'` — supabase.rpc повертає помилку
- `'returns AI_RPC_FAILED when dispatchChatTask returns null data with no error'` — дані null без помилки
- `'returns success when dispatchChatTask rpc succeeds'` — успішний виклик
- `'pollForResult fails immediately when thrown exception has non-retryable code'` — код `42501` → негайна відмова
- `'pollForResult recovers from thrown exception with error code (catch-retry path)'` — ETIMEDOUT → retry → success
- `'pollForResult reports undefined errorCode when thrown exception has no code'` — помилка без коду

### `src/lib/__tests__/aiRedTeam.test.ts` (+1 тест)
- `'returns empty array when vuln description is invalid JSON'` — невалідний JSON → catch → повернення `[]`

### `src/lib/__tests__/exporters.test.ts` (+7 тестів)
- `scoreToSeverity` branches: high (7.5), medium (5.0), low (2.5), info (0.3)
- Description fallback: `fullDescription.text` коли немає `message.text`
- Description fallback: `shortDescription.text` коли немає `message.text` і немає `fullDescription`

### `src/lib/__tests__/supplyChain.test.ts` (+1 тест)
- `'returns failure when parseSbom throws (malicious getter)'` — об'єкт з getter що кидає → catch → `failure(UNKNOWN_ERROR, 'Failed to parse SBOM/manifest input.')`

## Що покращило/виправило/додало
- `ai.service.ts`: **77.83% → 99.48%** statements, **100%** functions
- `aiRedTeam.ts`: **95.55% → 100%** (all metrics)
- `exporters.ts`: **95.95% → 99.59%** statements, **100%** functions
- `supplyChain.ts`: **89.79% → 90.37%** statements, **100%** functions
- Загальне покриття: **78.84% → 79.16%** statements, **78.25% → 78.59%** branches
- Тестів: **1447 → 1461** (+14)
- Commit: `2ca04a5`
