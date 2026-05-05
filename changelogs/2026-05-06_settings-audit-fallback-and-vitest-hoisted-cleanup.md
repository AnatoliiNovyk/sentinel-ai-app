# Changelog: Settings audit fallback + Vitest hoisted cleanup

## Як було
- У налаштуваннях уже був fallback для audit-логування, але не було явного тесту, що save-flow не ламається при помилці `AuditService.logSecurityEvent`.
- У тесті ProjectDetail був вкладений виклик `vi.hoisted(...)` всередині `describe`, що давав попередження Vitest і може стати помилкою в майбутніх версіях.
- Повний `quality:check` зупинявся на `typecheck`, і це ускладнювало перевірку регресій після поточних змін.

## Що зроблено
- Додано імпорт `AuditService` і новий тест в [src/pages/__tests__/Settings.test.tsx](src/pages/__tests__/Settings.test.tsx):
  - сценарій: `AuditService.logSecurityEvent` відхиляється;
  - перевірка: оновлення профілю викликається, кнопка переходить у `Saved!`, `console.warn` спрацьовує.
- Прибрано вкладений `vi.hoisted(...)` із [src/pages/__tests__/ProjectDetail.test.tsx](src/pages/__tests__/ProjectDetail.test.tsx), бо він був зайвим і не використовувався.
- Запущено перевірки:
  - таргетні тести для Settings + ProjectDetail: **127/127 passed**;
  - повний тест-прогін: **106/106 files, 2557/2557 tests passed**;
  - build: **успішно**;
  - lint: **успішно** (в рамках `quality:check`).

## Що покращило / виправило / додало
- Посилено тестове покриття критичного сценарію відмови audit-логування без деградації UX save-flow.
- Усунуто потенційний майбутній збій Vitest через некоректне місце `vi.hoisted`.
- Підтверджено відсутність регресій у runtime (тести + build).
- Зафіксовано, що поточний блокер повного `quality:check` — **pre-existing typecheck-помилки** в API-тестах, не пов'язані з цим батчем.
