# Batch 88 — Compliance Coverage до 100%

## Як було
- `Compliance.tsx` мав 98.35% statements.
- Непокриті гілки залишались у порогах кольорів (`40-59` для framework/SOC2) і в сортуванні CIS (`score_asc`, `name`).
- `Settings.test.tsx` мав технічний шум у cleanup/mock-поведінці Stripe-блоку (не впливав на coverage, але створював нестабільність під час ітерацій).

## Що зроблено
- У `src/pages/__tests__/Compliance.test.tsx` додано 2 тести:
- `applies orange threshold styles for framework and SOC2 rows in 40-59 range`
- `executes CIS sort branches for score ascending and A→Z label sort`
- Ці сценарії спеціально створюють дані, де:
- SOC2 переходить у orange-діапазон для карток та framework bar
- comparator у CIS реально виконує `score_asc` і `label.localeCompare`
- У `src/pages/__tests__/Settings.test.tsx` зроблено мікро-стабілізацію тестів:
- додано `supabase.auth.getSession` у mock
- cleanup Stripe-блоку переведено на `clearAllMocks + unstub env/globals` для передбачуваного стану між тестами

## Що покращило/виправило/додало
- `Compliance.tsx` піднято до **100% statements / 100% lines / 100% funcs**.
- Branch coverage `Compliance.tsx` покращено до **93.24%**.
- Закриті раніше непокриті ділянки:
- orange threshold стилі для framework/SOC2
- гілки сортування CIS (`score_asc`, `name`)
- Обидва змінені тест-файли проходять разом: `97 passed`.
