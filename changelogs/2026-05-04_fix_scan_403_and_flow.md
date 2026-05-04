# Changelog: Виправлення повного ланцюжка сканів (403 + hanging)

**Дата:** 2026-05-04  
**Статус:** ✅ ПРОТЕСТОВАНО — scan `8a7f2c59` завершено за 13 сек зі статусом `completed`

---

## Як було (проблема)

- Всі скани (nmap, tfsec, prowler, amass) зависали або завершувались зі статусом `FAILED`
- Sentinel-agent запускав інструменти, отримував результати, але при відправці POST на edge function `scan-result` отримував **HTTP 403 Forbidden**
- `scan-result` відхиляв всі запити від агента, бо `AGENT_SECRET` не було задано в Supabase ENV, і стара `verifyAgent()` завжди повертала `false`
- Агент вичерпував 4 retry спроби і здавався; `scan_jobs` зависав в `running`, потім watchdog маркував як `failed` після 180 хвилин
- В Activity Log були повідомлення "Report delivery failed" і "403"

**Причина:** `verifyAgent()` перевіряла тільки `X-Agent-Secret` header (через `Deno.env.get("AGENT_SECRET")`). Але `AGENT_SECRET` не було задано в Supabase Edge Function ENV vars → функція завжди відповідала 403.

---

## Що зроблено

### 1. `supabase/functions/scan-result/index.ts` — виправлено авторизацію

**Раніше:**
```typescript
function verifyAgent(req: Request): boolean {
  const agentSecret = Deno.env.get("AGENT_SECRET");
  if (!agentSecret) return false; // ПРОБЛЕМА: завжди false якщо env не задано
  return req.headers.get("X-Agent-Secret") === agentSecret;
}
```

**Тепер:**
```typescript
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, seg] = token.split(".");
    if (!seg) return null;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(seg.length / 4) * 4, "=");
    return JSON.parse(atob(b64));
  } catch { return null; }
}

function verifyAgent(req: Request): boolean {
  const agentSecret = Deno.env.get("AGENT_SECRET");
  if (agentSecret) {
    if (req.headers.get("X-Agent-Secret") === agentSecret) return true;
  }
  const auth = req.headers.get("Authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    const payload = decodeJwtPayload(auth.slice(7));
    if (payload?.role === "service_role") return true; // агент завжди надсилає service_role JWT
  }
  return false;
}
```

Агент завжди надсилав `Authorization: Bearer <SERVICE_ROLE_KEY>`. JWT payload service_role ключа містить `role: "service_role"`. Тепер функція декодує JWT payload і перевіряє роль — без необхідності задавати `AGENT_SECRET`.

### 2. Розгорнуто edge function
- `npx supabase functions deploy scan-result --project-ref ysnlccidbtqqburuflkz`
- Commit: `5950c15`

### 3. Примусово завершено застряглі running скани
- 3 скани вичерпали retry до задеплою фіксу
- `scan_jobs` → `error`, `scans` → `failed` (через REST API)
- Jobs: `058b0c2a`, `39902e29`, `2eea01c4`

---

## Що покращило / виправило / додало

- ✅ Скани тепер РЕАЛЬНО ЗАВЕРШУЮТЬСЯ зі статусом `completed`
- ✅ Findings зберігаються в БД (vulnerability records)
- ✅ Activity Log показує успішне виконання (без "403" або "Report delivery failed")
- ✅ Весь ланцюжок перевірено end-to-end: dispatch → agent (nmap) → result delivery → completed
- ✅ Тест: scan `8a7f2c59` на `scanme.nmap.org` — 13 секунд, 4 findings (1 high, 1 medium, 2 info)
- ✅ Безпека не порушена: запити без авторизації досі повертають 403

---

## Залишкові задачі (не критично для nmap)

| Задача | Статус |
|---|---|
| Оновити VPS агент (git pull + docker rebuild) | ⚠️ Потрібен SSH доступ до 95.67.75.146 |
| tfsec/prowler/amass handlers в агенті | ✅ Код в git (commit `27659e8`), не задеплоєно |
| nmap timeout 5min→1min | ✅ Код в git, не задеплоєно |

nmap скани ПОВНІСТЮ ПРАЦЮЮТЬ без оновлення VPS агента.
