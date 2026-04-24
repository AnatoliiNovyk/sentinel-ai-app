Як було:
- AI gateway вже мала структурну валідацію payload, rate limit і body-size guard.
- Водночас вхідний текст та дані vulnerabilities майже не нормалізувались перед складанням prompt.
- Не було окремого guard на надмірний розмір serialized vulnerabilities саме для prompt-джерела.

Що зроблено:
- Оновлено [supabase/functions/ai-gateway/contract.ts](supabase/functions/ai-gateway/contract.ts):
  - додано санітизацію тексту `sanitizeText(...)` (видалення службових control-символів + trim)
  - додано рекурсивну санітизацію `sanitizeForPrompt(...)` для vulnerabilities (обрізання глибини/масивів/ключів/рядків)
  - додано ліміт `MAX_PROMPT_SOURCE_CHARS` для serialized vulnerabilities
  - для `messages` тепер зберігається нормалізований `content`
  - для `project` у kill-chain гілці використовується нормалізоване значення
  - при надмірному serialized vulnerabilities повертається `INVALID_REQUEST` з safe повідомленням
- Оновлено тести в [src/lib/__tests__/ai-gateway-contract.test.ts](src/lib/__tests__/ai-gateway-contract.test.ts):
  - перевірка нормалізації chat content
  - перевірка нормалізації `project`
  - перевірка reject для надмірного vulnerabilities prompt-source
- Виправлено lint-сумісність санітизації (без `no-control-regex` порушень).
- Прогнано перевірки:
  - `npm run quality:check` — PASS (lint/typecheck/tests/build)

Що покращило/виправило/додало:
- Зменшено ризик ін'єкцій/шуму в prompt через неочищені control-символи та неструктуровані об'єкти.
- Додано додатковий запобіжник від prompt-overflow на етапі формування kill-chain запиту.
- Підтверджено стабільність змін через тестове покриття і повний quality gate.
