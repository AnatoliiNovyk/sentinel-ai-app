# Batch 263: Agent HTTPS/TLS/CORS diagnostics hardening

## Як було
- При перевірці `https://95.67.75.146:9090/health` UI показував загальну помилку `Network/CORS error` або `Agent offline`.
- Це маскувало реальну причину: порт `9090` на агенті працює як HTTP-only і не обслуговує TLS/HTTPS.

## Що зроблено
- Оновлено [src/pages/Settings.tsx](src/pages/Settings.tsx):
  - для `https://` agent URL з `Failed to fetch` тепер повертається спеціальне повідомлення:
    `HTTPS endpoint check failed (TLS/CORS)...` з порадою налаштувати HTTPS reverse-proxy + валідний TLS сертифікат.
- Оновлено [src/components/AppLayout.tsx](src/components/AppLayout.tsx):
  - додано окремий стан `tlsOrCorsHint`;
  - у header показується `Agent HTTPS check failed (TLS/CORS)` замість generic `Agent offline`.
- Додано регресійні тести:
  - [src/pages/__tests__/Settings.test.tsx](src/pages/__tests__/Settings.test.tsx) — HTTPS URL + fetch failure => TLS/CORS guidance;
  - [src/components/__tests__/AppLayout.test.tsx](src/components/__tests__/AppLayout.test.tsx) — HTTPS URL + fetch failure => TLS/CORS статус у header.
- Оновлено [EXECUTION_CHECKLIST_2026-04-28.md](EXECUTION_CHECKLIST_2026-04-28.md).

## Що покращило
- UI тепер правильно пояснює тип помилки для HTTPS endpoint, коли агент фактично не має TLS.
- Зменшено false-діагностику `offline/CORS`, швидше root-cause triage.
- Регресія закріплена тестами, щоб поведінка не повернулась у майбутніх змінах.
