Як було:
- Dashboard тести масово залежали від `waitForDashboardLoaded()` з очікуванням тексту `No scans yet`.
- Останній навігаційний кейс (`Launch AI audit`) лишався в `skip` через флейкове підвисання при розскіпі.

Що зроблено:
- У src/pages/__tests__/Dashboard.test.tsx прибрано helper `waitForDashboardLoaded()` і його виклики з layout/KPI/SLA тестів.
- Кожен тест тепер очікує свій цільовий UI-елемент напряму (`findByText/findByRole` або `waitFor` по релевантному асерту).
- Навігаційний кейс залишено в `it.skip` (тимчасовий техборг), але спрощено його тіло до синхронного `getByRole` + click + assertion.

Що покращило/виправило/додало:
- Зменшено крихкість Dashboard suite: тести більше не прив’язані до проміжного placeholder-стану `No scans yet`.
- Підтверджено стабільний таргетований прогін: 3 files passed, 27 passed, 1 skipped.
- Зафіксовано діагностичний результат phase3: джерело флейку локалізовано до nav-кейсу при знятті skip.
