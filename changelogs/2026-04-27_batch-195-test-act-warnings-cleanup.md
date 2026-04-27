Як було:
- У таргетованих прогонках Projects/Reports з'являлися React warnings `An update ... was not wrapped in act(...)`.
- Основний патерн: частина empty-state тестів завершувалась раніше, ніж добігав асинхронний `load()` у компоненті.

Що зроблено:
- У src/pages/__tests__/Projects.test.tsx:
  - в тесті `renders "Projects" heading` додано очікування `No projects yet` після первинного асерту заголовка;
  - тест `shows "New project" button` зроблено async і додано очікування `No projects yet` перед перевіркою кнопок.
- У src/pages/__tests__/Reports.test.tsx:
  - тест `renders "Reports" heading` зроблено async і додано очікування `No reports yet`.

Що покращило/виправило/додало:
- Прибрано `act(...)` warnings у targeted run для Projects/Reports.
- Збережено стабільність: Projects/Reports — 18/18 passed; Dashboard+Projects+Reports — 28/28 passed.
- Без змін продакшн-логіки, лише тестова синхронізація асинхронного lifecycle.
