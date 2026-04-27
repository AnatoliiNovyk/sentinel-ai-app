Як було:
- У тестах залишались 3 skipped кейси: 1 у Dashboard та 2 у Projects.
- Частина розскіпаних кейсів у Projects вже була стабільна, але delete-кейс залишався флейковим.

Що зроблено:
- У src/pages/__tests__/Dashboard.test.tsx перевірено спробу розскіпу навігаційного кейсу; через повторне підвисання залишено як skip для стабільності suite.
- У src/pages/__tests__/Projects.test.tsx розскіпано та стабілізовано кейс environment badge (пошук через findAllByText(/cloud/i)).
- У src/pages/__tests__/Projects.test.tsx delete-кейс тимчасово залишено skip після перевірки флейкової поведінки confirm-flow.

Що покращило/виправило/додало:
- Загальна кількість skipped у цільових файлах зменшена з 3 до 2.
- Targeted-прогін Dashboard/Projects/Reports стабільний: 3 files passed, 26 passed, 2 skipped.
- Зафіксовано безпечний проміжний стан для наступного етапу (Batch-193 phase2) з фокусом на остаточне усунення 2 skipped.
