# Batch 210: Option 2 — DEMO бейдж лише коли агент офлайн

## Як було
- У хедері Scans бейдж для `MOCK`-скану відображався завжди, навіть коли агент онлайн.
- Це створювало відчуття помилки/тривоги при нормальному стані агента.

## Що зроблено
- У [src/components/scans/ScanHeader.tsx](src/components/scans/ScanHeader.tsx):
  - додано `agentReachable` у пропси;
  - DEMO-індикація (`DEMO MODE`) тепер показується тільки якщо `currentMode === 'MOCK'` і `agentReachable === false`;
  - коли `MOCK`, але агент онлайн — показується нейтральний текст `Selected Scan: Historical` без DEMO-аларму.
- У [src/pages/Scans.tsx](src/pages/Scans.tsx):
  - передано `agentReachable` у `ScanHeader`.

## Що покращило/виправило/додало
- При онлайн-агенті прибрано зайву DEMO-тривожність у хедері Scans.
- Залишено коректну індикацію історичного характеру вибраного скану без конфлікту зі статусом агента.
- Перевірено якість: lint/build успішні.
