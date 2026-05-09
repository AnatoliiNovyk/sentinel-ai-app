# Changelog: ComplianceTab branch coverage (Batch GT)

## Як було
`src/components/__tests__/ComplianceTab.test.tsx` містив **11 тестів** і вже покривав базовий рендер, loading/error стани та частину метрик комплаєнсу.

Не були покриті:
- Блок `Recommendation` і текст рекомендації
- Відображення component sub-scores (`Remediation`, `Security`, `Alerting`)
- Лічильники контролів у таблиці framework'ів (`compliant/total`)

## Що зроблено
Додано **3 нові тести**:

1. `renders recommendation text in card` — перевіряє заголовок `Recommendation` і текст `Focus on SOC2 controls to improve score.`
2. `renders component sub-scores (Remediation, Security, Alerting)` — перевіряє назви секцій і значення `72`, `68`, `80`
3. `renders controls count (compliant/total) in frameworks table` — перевіряє значення `17/20`, `10/18`, `5/16`

## Що покращило / виправило / додало
- **Кількість тестів**: 11 → **14** (`+3`)
- **Загальний лічильник**: 2848 → **2851** тестів
- **Покриття**: додані гілки для recommendation card, sub-scores та framework controls counts
- **Quality gate**: 2851/2851 passed, exit 0, build OK