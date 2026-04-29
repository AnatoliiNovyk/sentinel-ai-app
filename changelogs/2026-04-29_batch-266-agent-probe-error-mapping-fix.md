# Batch 266: Agent probe error mapping fix (mixed-content)

## Як було
- Для `http://...` agent URL на HTTPS фронтенді, навіть після додавання gateway-probe fallback, UI інколи все одно показував
  `Blocked by browser policy...`.
- Це вводило в оману, бо фактично запит уже виконувався через server-side gateway і причина помилки була іншою.

## Що зроблено
- Оновлено [src/lib/agentHealth.ts](src/lib/agentHealth.ts):
  - `probeViaGateway` тепер повертає структуровану помилку (а не `null`) для non-OK / network failure / missing env.
  - для mixed-content сценарію повертається результат gateway probe (успіх або реальна помилка), без фальшивого fallback `Blocked by browser policy`.
- Оновлено [src/pages/Settings.tsx](src/pages/Settings.tsx):
  - якщо `probe.via === gateway`, UI показує `Gateway probe failed: ...` або `Gateway probe HTTP ...`;
  - загальна mixed-content підказка лишається тільки для direct path.
- Додано регресійний тест у [src/pages/__tests__/Settings.test.tsx](src/pages/__tests__/Settings.test.tsx):
  - перевіряє, що при gateway error для `http://` URL UI НЕ показує `Blocked by browser policy`, а показує `Gateway probe failed`.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- Діагностика стала коректною: користувач бачить реальну причину збою gateway-probe.
- Прибрано хибні mixed-content повідомлення у сценаріях, де браузерне блокування вже обійдено server-side fallback.
- Зменшено шум і пришвидшено root-cause triage.
