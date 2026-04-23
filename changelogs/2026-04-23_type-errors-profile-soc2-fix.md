# Зміни від 2026-04-23: Type errors fix (Profile + Soc2Row)

## Як було
- TypeScript падав на TS2339 у декількох модулях через відсутні поля в типах:
  - `Profile.company`, `Profile.plan`, `Profile.sla_config`
  - `Soc2Row.openCount`, `Soc2Row.criticalCount`
- Після розширення типу `Profile` виникли TS2345 у `Settings` через optional-поля без fallback.

## Що зроблено
- Оновлено тип `Profile` у `src/lib/supabase.ts`:
  - додано `company?: string`
  - додано `plan?: string`
  - додано `sla_config?: Partial<SlaConfig>`
- Оновлено тип `Soc2Row` у `src/lib/compliance.ts`:
  - додано `openCount: number`
  - додано `criticalCount: number`
- Оновлено `computeCompliance` у `src/lib/compliance.ts` для заповнення нових полів `Soc2Row`.
- Виправлено ініціалізацію стану в `src/pages/Settings.tsx`:
  - `setCompany(profile.company ?? '')`
  - `setPlan(profile.plan ?? 'free')`

## Що покращило/виправило/додало
- Усунено ключові TS2339-помилки по профілю та SOC2-рядках.
- Вирівняно типізацію між доменною логікою комплаєнсу та evidence-export шаром.
- Усунено побічні TS2345 у налаштуваннях профілю після розширення типів.
