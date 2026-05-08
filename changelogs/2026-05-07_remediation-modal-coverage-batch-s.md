# Batch S: RemediationModal branch coverage

## Як було
- `src/components/RemediationModal.tsx` у таргетованому прогоні мав branch coverage **91.30%**.
- Непокриті гілки лишалися у варіантах `hcl`, `kubernetes`, falsy `remediation_type`, manual-with-code, fallback `code || remediation`, а також у fallback-логіці auto-playbook для hostname/blank/null asset.

## Що зроблено
- Розширено тести у `src/components/__tests__/RemediationModal.test.tsx`:
  - `hcl` використовує Terraform meta badge;
  - falsy `remediation_type` падає у manual fallback;
  - unknown severity рендериться без помилки fallback-класу;
  - manual remediation з `remediation_code` показує `Apply the code change`;
  - `aws-cli` fallback бере `remediation`, якщо `remediation_code` порожній;
  - `kubernetes` fallback бере `kubectl apply -f remediation.yaml`, якщо `remediation_code` порожній;
  - `bash` fallback бере `remediation`, якщо `remediation_code` порожній;
  - auto-playbook коректно обробляє hostname з `:port` і `/cidr`;
  - auto-playbook fallback до `TARGET` для порожнього та `null` asset.
- Стабілізовано `src/pages/__tests__/Scans.integration.test.tsx`:
  - додано mock для `probeAgentHealth`, щоб інтеграційний тест не залежав від фонового async probe стану;
  - оновлено очікування `dispatchScan` до детермінованого `agentReachable=false` у цьому сценарії.
- Прогін валідації:
  - `npx vitest run src/components/__tests__/RemediationModal.test.tsx --coverage --coverage.include=src/components/RemediationModal.tsx`
  - `npx vitest run src/pages/__tests__/Scans.integration.test.tsx`
  - `npm run quality:check`

## Що покращило/виправило/додало
- `src/components/RemediationModal.tsx` у таргетованому прогоні:
  - Statements: **100%**
  - Branches: **100%**
  - Functions: **100%**
  - Lines: **100%**
- Додано 10 цільових тестів без змін production-коду.
- Закрито fallback та edge-сценарії для remediation type і auto-playbook generation.
- Усунуто флейковість/розсинхрон інтеграційного тесту Scans, який блокував quality gate.
