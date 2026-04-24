Як було:
- Після додавання `quality:check` виявилися приховані TypeScript-регресії, які не проявлялись у попередніх точкових прогонах.
- `npm run quality:check` падав на етапі `typecheck` з 18 помилками у 4 файлах.

Що зроблено:
- Виправлено типізацію аргументів у `run_scan` гілці агента:
  - src/lib/agentTools.ts
  - додано безпечний normalizer `toRunScanArgs` для `Record<string, unknown>`.
- Виправлено типи SARIF rule-парсингу:
  - src/lib/exporters.ts
  - введено `SarifRule` та безпечний fallback для property access.
- Виправлено unknown-доступ у kill chain UI:
  - src/pages/KillChain.tsx
  - введено `KillChainStep` і typed state.
- Виправлено nullable-score в OSV парсері:
  - src/pages/SupplyChain.tsx
  - `score` переведено на безпечне значення за замовчуванням.
- Повторно запущено повний quality gate:
  - `npm run quality:check`.

Що покращило/виправило/додало:
- Усі етапи quality gate проходять стабільно (`lint`, `typecheck`, `tests`, `build`).
- Прибрано потенційно небезпечні звернення до `unknown`/nullable полів.
- Підтверджено, що новий release hardening script працює як єдиний валідатор готовності змін.
