# 2026-05-06 — Settings coverage + OTel deflake

## Як було
- Покриття для settings-підсторінок мало помітні прогалини:
  - pages/settings: 86.74% statements, 78.36% branches
  - SettingsSecurity.tsx: 81.29% statements, 74.83% branches
  - SettingsProfile.tsx: 92.3% statements, 83.82% branches
- Full quality:check періодично падав на таймінг-залежному тесті
  src/lib/__tests__/otelCollector.test.ts (exponential backoff assertion через Date.now різниці).

## Що зроблено
- Додано нові branch-coverage тести в src/pages/__tests__/Settings.test.tsx:
  - formatRelativeMinutes: гілки just now / future / Xm ago / Xh ago / n-a
  - localStorage edge-cases: invalid JSON fallback + valid JSON restore
  - saveAgentUrl: whitespace URL не тригерить probe
  - company input interaction: явна перевірка onChange стану
- Виправлено флейк у src/lib/__tests__/otelCollector.test.ts:
  - переведено перевірку backoff на fake timers (vi.useFakeTimers + advanceTimersByTimeAsync)
  - замінено нестабільну wall-clock перевірку на детермінований assert count retry-викликів
- Прогнано перевірки:
  - npx vitest run src/pages/__tests__/Settings.test.tsx → 70/70 passed
  - npm run quality:check → 106/106 files passed, 2567/2567 tests passed
  - npx vitest run --coverage

## Що покращило / виправило / додало
- Підвищено coverage у settings-зоні:
  - pages/settings: 90.9% statements, 81.56% branches
  - SettingsSecurity.tsx: 87.05% statements, 80.13% branches
  - SettingsProfile.tsx: 94.87% statements, 83.82% branches, lines 100%
- Прибрано таймінг-флейк у otelCollector full-suite прогонах.
- Підтверджено стабільний quality gate після змін.