# Batch-163 — Compliance: global control search, priority action items, inline-style fixes

## Як було
- `Compliance.tsx` — повнофункціональна сторінка з вкладками фреймворків, але без пошуку контролів і без зведення проблемних контролів.
- `filteredSoc2Rows` — не існувало, `soc2Rows` рендерились напряму.
- `FrameworkBar`, `Soc2Card`, `NistCard`, `CisRowItem` — використовували `style={{ width: `${score}%` }}` (заборонений паттерн).

## Що зроблено
1. **Global control search** — новий `controlSearch` state + пошуковий інпут між табами фреймворків і контентом; фільтрує `soc2Rows`, `nistRows`, `sortedCisRows`, `filteredMitreRows` одночасно по id/label; показує лічильник знайдених контролів.
2. **Priority Action Items panel** — `worstControls` useMemo: збирає всі контроли з 4 фреймворків, фільтрує score < 80, сортує за score asc, бере топ-5; відображає у amber-стилізованій панелі з рейтингом, framework badge, id, label, score bar і кількістю відкритих вразливостей.
3. **Empty state messages** — кожна секція (SOC2/NIST/CIS/MITRE) відображає "No controls match search" при пустих результатах.
4. **Виправлено inline `style={{ width }}`** — у 4 sub-components (`FrameworkBar`, `Soc2Card`, `NistCard`, `CisRowItem`) замінено на `ref={(el) => { if (el) el.style.width = \`${score}%\`; }}`.
5. **Додано іконки**: `Search`, `X`, `Trophy` з `lucide-react`.

## Що покращило/виправило/додало
- Комплаєнс-команда може швидко знайти конкретний контроль без ручного пошуку по 4 вкладках.
- "Priority Action Items" відразу показує де найбільший ризик — дозволяє фокусувати ресурси на low-hanging fruit.
- Виправлено порушення правила заборони inline-стилів для width/height.

## Commit
`32abb0cc` — pushed to `origin/main`
