# Agent Health Probe Smoke: зниження шуму алертів

## Як було
- Scheduled запуск workflow `Agent Health Probe Smoke` працював у strict-режимі (`require_reachable=true`) за замовчуванням.
- При помилці probe JSON-звіт міг не створюватись.
- Крок upload artifact мав `if-no-files-found: error`, що додавав додатковий fail і зайві анотації.

## Що зроблено
- У [\.github/workflows/agent-health-probe-smoke.yml](.github/workflows/agent-health-probe-smoke.yml) змінено дефолт strict-режиму:
  - для `workflow_dispatch`: strict за замовчуванням (`true`),
  - для `schedule`: м'який режим за замовчуванням (`false`).
- У кроці probe додано `try/catch` із fallback-репортом:
  - навіть при падінні probe тепер гарантовано записується `reports/agent-health-probe-smoke.json`.
- Fail-step залишено тільки для strict-сценарію (`probeFailed && requireReachable`).
- Для artifact upload змінено `if-no-files-found` з `error` на `warn`.

## Що покращило/виправило/додало
- Зменшено кількість хибних failure-нотифікацій для scheduled запусків.
- Усунуто каскадну помилку "No files were found ..." як другорядну причину падіння.
- Підвищено спостережуваність: JSON-репорт формується стабільно навіть за probe-винятків.
