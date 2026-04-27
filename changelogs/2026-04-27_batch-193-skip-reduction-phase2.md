Як було:
- Після phase1 залишались 2 skipped кейси: Dashboard навігація та Projects delete flow.
- Projects delete тест флейкав через неоднонозначний пошук кнопки `Delete project` (кнопка на картці і кнопка в confirm-діалозі мали однакову назву).

Що зроблено:
- У src/pages/__tests__/Projects.test.tsx:
  - розскіпано delete тест;
  - додано `within` з @testing-library/react;
  - підтвердження видалення тепер шукається всередині `role="dialog"`, що прибирає конфлікт з кнопкою на картці.
- У src/pages/__tests__/Dashboard.test.tsx:
  - збережено `it.skip` для навігаційного кейсу як тимчасовий техборг;
  - усунуто залежність цього тесту від `waitForDashboardLoaded()` в тілі кейсу для подальших спроб стабілізації.

Що покращило/виправило/додало:
- Кількість skipped у цільових файлах зменшена з 2 до 1.
- Таргетований прогін Dashboard/Projects/Reports стабільний: 3 files passed, 27 passed, 1 skipped.
- Delete-flow у Projects тепер перевіряється активним тестом без неоднозначного селектора.
