# Batch-305 Changelog

## Як було
- `agentHealth.ts`: 92.22% stmts — catch блоки `isMixedContentAgentUrl` і `isHttpsAgentUrl`, gateway fallback message, `res.json()` throws path не покриті.
- `scans.service.ts`: 88.88% stmts — `context.json()` і `context.text()` шляхи, включаючи catch блоки коли вони throws, не покриті.
- `audit.service.ts`: 94.48% stmts — `queryLogs` фільтри `status`, `startDate`, `endDate`, db error path не покриті.
- Загальне покриття: **78.71% stmts / 77.78% branch**, 1434 тестів.

## Що зроблено

### `src/lib/__tests__/agentHealth.test.ts` (+5 нових тестів)
- `isMixedContentAgentUrl` → `'http://[::1'` (unclosed IPv6 bracket) → catch block line 16-17 ✓
- `isHttpsAgentUrl` → `'http://[::1'` → catch block lines 25-26 ✓
- `probeAgentHealth` → `json()` throws on response → `health = null` lines 85-86 ✓
- `probeAgentHealth` → gateway error з `message: ''` → fallback `'Gateway probe request failed.'` line 38 ✓
- (Раніше доданий тест `'sets health to null when response json() throws'` вже в файлі)

### `src/api/__tests__/scans.service.test.ts` (+5 нових тестів)
- `context.json()` повертає `{error: ...}` → `payload.error` шлях lines 13-16 ✓
- `context.json()` повертає `{message: ...}` → `payload.message` шлях lines 16-17 ✓
- `context.text()` повертає текст → `text.trim()` шлях lines 21-25 ✓
- `context.json()` throws → catch block line 19 ✓
- `context.text()` throws → catch block line 27 ✓

### `src/api/__tests__/audit.service.unit.test.ts` (+3 нових тести)
- `queryLogs` з `endDate` → `lte('created_at', ...)` lines 205-206 ✓
- `queryLogs` з `status: 'failure'` → `eq('status', ...)` lines 197-198 ✓
- `queryLogs` з `startDate` → `gte('created_at', ...)` lines 201-202 ✓
- `queryLogs` db error → `throw error` lines 215-216 ✓

## Що покращило

| Файл | Було | Стало |
|------|------|-------|
| `agentHealth.ts` stmts | 92.22% | **100%** |
| `scans.service.ts` stmts | 88.88% | **100%** |
| `audit.service.ts` stmts | 94.48% | **97.42%** |
| **Загалом stmts** | 78.71% | **78.84%** |
| **Загалом branch** | 77.78% | **78.25%** |
| **Тести** | 1434 | **1447** |

**Коміт:** `84f1b57` — `batch-305: coverage — agentHealth 100%, scans.service 100%, audit.service 97.42%`
