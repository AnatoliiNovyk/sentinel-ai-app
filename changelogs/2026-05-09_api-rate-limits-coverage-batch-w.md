Як було
- `src/components/ApiRateLimitsPanel.tsx` мав недостатньо покриті branch-path для warning-стану, умовного Upgrade CTA і перевірки викликів usage по всіх метриках.
- `src/components/__tests__/ApiRateLimitsPanel.test.tsx` закривав базовий рендер, loading і exceeded-сценарій, але не добирав ці гілки.

Що зроблено
- Додано тест на warning-path: usage >75% і <100% з повідомленням `Nearing limit`.
- Додано тест на виклики `getCurrentUsage` для всіх 4 metric keys з конкретним `userId`.
- Додано тести на Upgrade CTA для `free` і `basic`.
- Додано тест на приховування Upgrade CTA для планів поза `free/basic` (наприклад `pro`).
- Стабілізовано перевірку кількості викликів через дельту call-count, щоб уникнути флейку від накопичених мок-викликів.

Що покращило
- Розширено branch coverage для `ApiRateLimitsPanel` у critical UI-гілках usage/warning/CTA.
- Тести стали стійкішими до міжтестового стану моків.
- Batch W виконаний без змін production-коду.
