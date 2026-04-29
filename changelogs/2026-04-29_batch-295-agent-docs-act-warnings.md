# Changelog — Batch-295 (2026-04-29)

**Commit:** 24cec9e  
**Branch:** main

---

## sentinel-agent/README.md (CREATED)

### Як було
Папка `sentinel-agent/` містила лише технічні файли (Dockerfile, docker-compose.yml, package.json тощо) без жодної документації щодо розгортання.

### Що зроблено
Створено повний deployment guide для sentinel-agent з розділами:
- **Quick Deploy (Docker)**: покрокова інструкція від `.env.example` → `.env` → `docker-compose up`
- **Manual Deploy (без Docker)**: встановлення залежностей та запуск Node.js
- **Troubleshooting**: вирішення `Error: supabaseUrl is required`, перевірка `SUPABASE_SERVICE_ROLE_KEY`, debug agent offline в Settings

### Що покращило
Тепер ops-команда / девелопери мають чіткі інструкції щодо деплою агента без необхідності шукати інформацію по окремих файлах.

---

## src/pages/__tests__/Settings.test.tsx (MODIFIED)

### Як було
33 тести в 8 describe-блоках. Більшість describe-блоків викликали `render(<Settings />)` всередині кожного `it()` без обгортки в `act()`. Компонент Settings містить async `useEffect` (supabase-запити), що спричиняли warning:
```
Warning: An update to Settings inside a test was not wrapped in act(...)
```

### Що зроблено
- Для 5 describe-блоків зі синхронними тестами (`layout`, `Profile section`, `Plans`, `SLA section`, `Team Members`): перенесено `render()` у `beforeEach(async () => { await act(async () => { render(<Settings />); }); })`, прибрано render() з кожного `it()`
- Для `Settings — Save`: переписано `beforeEach` з async рендером
- Для `Settings — Agent mixed content`: замінено всі bare `render(<Settings />)` на `await act(async () => { render(<Settings />); })`; тест "persists agent URL after blur and restores it after remount" рефакторований з деструктуруванням `unmount` через `let unmount!: () => void`

### Що покращило
act() warnings повністю усунуто для всіх 34 тестів у цих двох файлах. 1315/1315 тестів проходять.

---

## src/components/__tests__/ApiRateLimitsPanel.test.tsx (MODIFIED)

### Як було
Тест `shows "Loading rate limit information..." while fetching` викликав `render(...)` синхронно. `mockGetCurrentUsage.mockResolvedValue(0)` резолвило як microtask після завершення синхронного тесту, що викликало:
```
Warning: An update to ApiRateLimitsPanel inside a test was not wrapped in act(...)
```

### Що зроблено
Тест стало async, рендер обгорнуто в `await act(async () => { render(...); })` — це дозволяє async ефектам завершитись до перевірки.

### Що покращило
Warning від ApiRateLimitsPanel усунуто. Тест все ще коректно перевіряє loading-стан, бо `mockGetRateLimitConfig` так і не резолвиться.

---

## Підсумок

| Крок | Результат |
|------|-----------|
| A: caniuse-lite update | вже актуальна (1.0.30001791), змін не потрібно |
| B: sentinel-agent/README.md | ✅ створено |
| C: act() warnings fix | ✅ усунуто |
| Тестів | 1315/1315 passed |
| Pre-existing unhandled rejections | 3 (існували до Batch-295, не наша відповідальність) |
