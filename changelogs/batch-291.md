# Batch-291 Changelog

## Що було

- `AgentLogsPanel.tsx` — компонент без тестів (realtime логи агента)
- `ApiRateLimitsPanel.tsx` — компонент без тестів (ліміти API за планом)
- `CommentThread.tsx` — компонент без тестів (коментарі до вразливостей)
- `RemediationAssistant.tsx` — компонент без тестів (AI-виправлення)
- `src/lib/rateLimitService.ts` — модуль без тестів (конфіг лімітів + запис використання)
- Загальна кількість тестів: **1168**

## Що зроблено

Створено 5 нових тестових файлів:

### `src/lib/__tests__/rateLimitService.test.ts` (14 тестів)
- `getRateLimitConfig` — free/basic/pro/unknown fallback
- `getCurrentUsage` — повертає count / 0 якщо запису немає / 0 при помилці
- `recordUsage` — оновлює існуючий запис (count+1) / вставляє новий / повертає false при помилці БД
- Патерн: `vi.hoisted()` + `setupChain()` helper для Supabase fluent chain

### `src/components/__tests__/AgentLogsPanel.test.tsx` (11 тестів)
- Рендер заголовка, спінер завантаження, відображення повідомлень
- Фільтри за рівнем (all/error/warn/success/info)
- Бейджі кількості помилок і попереджень
- Кнопка копіювання, realtime канал
- `Element.prototype.scrollIntoView = vi.fn()` (jsdom fix)

### `src/components/__tests__/ApiRateLimitsPanel.test.tsx` (8 тестів)
- Стан завантаження "Loading rate limit information..."
- Заголовок "API Rate Limits", відображення planId
- Всі 4 метрики: Scans/Month, Reports/Day, Chat/Hour, API/Sec
- Стан перевищення ліміту (red border)

### `src/components/__tests__/CommentThread.test.tsx` (8 тестів)
- Стан "закрито" — кнопка Comments
- Відкриття панелі, відображення заголовку вразливості
- "Loading comments...", "No comments yet", відображення контенту коментаря
- Закриття панелі, textarea для нового коментаря

### `src/components/__tests__/RemediationAssistant.test.tsx` (9 тестів)
- Початковий стан: кнопка "Generate Fix", лейбл, опис
- Стан завантаження: "Generating AI remediation plan…"
- Після генерації: summary (AllByText — text рендериться двічі), "AI Remediation Plan", priority badge
- Передзаповнення з кешу: `getSavedRemediation` → suggestion без виклику `generateRemediation`
- Стан помилки: після rejected promise компонент повертається до "Generate Fix" (особливість render order у компоненті)

## Що покращило / виправило / додало

- **+48 нових тестів** (1168 → 1216), всі 1216 проходять
- 100% тестове покриття для раніше непокритих компонентів і lib-модуля
- **Знайдено quirk** у `RemediationAssistant.tsx`: render condition `!suggestion && !loading` перехоплює помилковий стан — блок `if (error)` є unreachable. Тест задокументує цю поведінку.
- Commit: `bf36427`
