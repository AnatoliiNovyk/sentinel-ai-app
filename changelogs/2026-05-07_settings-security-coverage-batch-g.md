# Batch G — SettingsSecurity branch coverage

## Як було
- `SettingsSecurity.tsx`: 87.05% stmts / 80.13% branches / 94.11% functions
- Total all files: 96.80% stmts / 92.44% branches / 96.27% functions / 97.91% lines

## Що зроблено
Розширено `src/pages/__tests__/Settings.test.tsx` — додано ~12 нових тестів у 6 нових describe-блоків:

1. **hasChanges and unsaved changes banner** (3 тести)
   - Показ "Unsaved changes" при зміні fullName / company
   - "Saved!" після успішного security save

2. **agent health display** (3 тести)
   - Agent online з `lastJobAt` + `lastError` (non-null branches)
   - Agent online без `lastJobAt`/`lastError` (null branches)
   - Gateway probe error: показ повідомлення `via=gateway`

3. **probeSmoke status variants** (3 тести)
   - "Fail" badge для `status=error`
   - "OK" badge для `status=ok`
   - "no" для `reachable=false`

4. **retention preset buttons** (2 тести)
   - 365-day preset → "1yr" кнопка отримує активний клас
   - Зміна retention input безпосередньо через `fireEvent.change`

5. **Enter key submits agent URL** (1 тест)
   - `keyDown Enter` в полі URL тригерить `probeAgentHealth`

## Що покращило / виправило / додало
- `SettingsSecurity.tsx`: **87.05% → 93.52% stmts** (+6.47%), **80.13% → 84.10% branches** (+3.97%)
- All files total: **96.80% → 97.09% stmts / 92.44% → 92.68% branches**
- Загальна кількість тестів: 2652 → 2664 (+12)
- Test files: 112 → 113 passed
- Quality gate: 113/113 files, 2664/2664 tests — all passed
