# Зміни від 2026-04-23: Phase 0 Core (Error Contract + REAL/MOCK Mode)

## Як було
- Потоки `scan` та `ai` повертали помилки неуніфіковано (throw/null/silent fallback).
- У UI не було явного індикатора режиму виконання скану (REAL або MOCK).
- У БД не було формалізованих полів для трекінгу режиму сканування.

## Що зроблено
- Додано єдиний контракт помилок: `src/lib/errors.ts` (`ErrorCode`, `ApiError`, `Result<T>`, `success/failure`, `errorToUserMessage`).
- Оновлено `src/lib/scanDispatch.ts` на `Result`-повернення та явну фіксацію режиму `REAL/MOCK`.
- Оновлено `src/lib/scanMock.ts` — mock-скани тепер зберігаються з `is_mock=true` і `detected_mode='MOCK'`.
- Оновлено `src/api/ai.service.ts` — методи AI повертають `Result`, а не кидають винятки.
- Оновлено `src/pages/Scans.tsx`, `src/pages/ProjectDetail.tsx`, `src/pages/Chat.tsx` для роботи з новим error-contract.
- Додано mode-бейдж у `src/components/scans/ScanHeader.tsx` та прокинуто mode зі сторінки сканів.
- Оновлено `src/api/scans.service.ts` для запису `detected_mode='REAL'` і `is_mock=false` при створенні scan row.
- Додано міграцію `supabase/migrations/20260423191500_add_scan_mode_columns.sql` з колонками `is_mock` та `detected_mode`.
- Вирівняно accessibility-атрибути (`aria-label`, `title`) у змінених UI-компонентах, щоб не створювати нові lint-проблеми.

## Що покращило/виправило/додало
- Додано прозорий і типобезпечний механізм обробки помилок для критичних потоків.
- Додано видимість режиму сканування в UI, що знижує ризик хибної інтерпретації mock-результатів.
- Підвищено керованість fallback-сценаріїв через структуровані коди помилок і user-friendly повідомлення.
- Закладено основу для наступного батчу (test harness + автотести) без зміни публічної UX-поведінки.
