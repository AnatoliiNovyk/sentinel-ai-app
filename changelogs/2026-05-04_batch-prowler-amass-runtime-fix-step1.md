Як було:
- Prowler запускався командою `prowler aws -M json --no-banner`, що несумісно з Prowler v5 (`json` більше не валідний output mode).
- Amass виконувався з коротким runtime timeout і шумним stdout, через що скан часто завершувався `failed` при частковому корисному виводі.

Що зроблено:
- У `sentinel-agent/src/index.ts` для Prowler змінено виклик на `prowler aws --output-formats json-ocsf --no-banner`.
- Для Amass:
  - збільшено runtime timeout до 6 хвилин;
  - прибрано параметр `-timeout 90`;
  - додано `-norecursive -noalts` для стабільнішого пасивного сценарію;
  - додано парсер піддоменів через regex по FQDN;
  - додано fallback на partial stdout у catch-блоці: якщо є піддомени, повертаються findings замість hard-fail.

Що покращило/виправило/додало:
- Усунуто детермінований runtime-fail Prowler через застарілий CLI прапорець.
- Зменшено кількість false-failed запусків Amass при timeout/частковому виводі.
- Підвищено стійкість scan-пайплайна до змін CLI та довгих виконань.
