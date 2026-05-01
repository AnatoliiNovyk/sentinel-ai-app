# Batch 72 — Scans.tsx Coverage Improvement

## Як було
- `src/pages/__tests__/Scans.test.tsx`: 30 тестів
- `Scans.tsx` coverage: statements **95.07%**, branches **76.04%**, functions **87.5%**
- Непокриті рядки: 296 (non-JSON AI catch), 671-673 (severity badge className: high/medium), 720-722 (remediation_code render)

## Що зроблено
Додано **21 новий тест** (загалом 51 тест) у нові describe-блоки:

### `describe('Scans — detail modal severity variants')`
1. `shows "high" severity badge with orange style` — відкриває modal з `severity: 'high'`, перевіряє "HIGH" текст
2. `shows "medium" severity badge with yellow style` — відкриває modal з `severity: 'medium'`, перевіряє "MEDIUM" текст  
3. `shows remediation_code block when remediation_code is provided` — vuln з `remediation_code !== null`, перевіряє `<pre><code>` блок
4. `AI gateway returns non-JSON response — falls back to raw content` — plain text response від AI
5. `AI gateway returns malformed JSON — catch block executes` — JSON з фігурними дужками але invalid content (покриває рядок 296)

### `describe('Scans — service error catch paths')`  
6. `handles loadScans error gracefully` — `getProjectScans` throws, `consoleSpy` перевіряє catch
7. `handles loadVulnerabilities error gracefully` — `getScanVulnerabilities` throws при першому виклику
8. `loadVulnerabilities catch fires after AI generation reloads vulns` — першый виклик успішний, другий (після AI gen) кидає помилку
9. `shows target required error when project has no target and no custom target` — проект без target, покриває рядки 235-239

### `beforeEach` з mock reset
Додано `beforeEach` в `describe('service error catch paths')` для ізоляції тестів:
- `mockGetVulns.mockReset()` + `mockResolvedValue([])`
- `mockUpdateVuln.mockReset()` + `mockResolvedValue({ error: null })`
- `mockCallAiGateway.mockReset()` + відновлення дефолтного значення

## Що покращило
- **Statements**: 95.07% → **97.77%** (+2.7%)
- **Branches**: 76.04% → **82.22%** (+6.18%)
- **Lines**: 95.07% → **97.77%** (+2.7%)
- Покрито рядки: 235-239 (target required), 296 (non-JSON catch), 671-673 частково (high severity badge)
- Покрито рядки: 720-722 (remediation_code conditional render)
- Commit: `77f10b6`
