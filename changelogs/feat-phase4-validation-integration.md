# Feat: Phase 4 Validation Integration

**Дата**: 2026-05-05  
**Файли**: `src/pages/DarkWebMonitor.tsx`, `src/lib/agentTools.ts`

---

## Як було

`DarkWebMonitor.tsx` та `agentTools.ts` мали **дубльовану inline-валідацію** запитів:
- Перевірка довжини: `> 253` символів
- Перевірка одного regex-патерну: `[<>'"`;]|(\.\.)|(\/\/)|(select\s+\*|drop\s+table|insert\s+into)`

У `src/lib/validation.ts` вже існувала функція `validateDarkWebQuery()` з **7 injection-патернами**
(SQL, template injection `${}`, backtick injection, XSS `<script>`, `javascript:`, LDAP `\*(`, `\(`),
але ніде не використовувалась.

---

## Що зроблено

### 1. `DarkWebMonitor.tsx`
Додано імпорт:
```typescript
import { validateDarkWebQuery } from '../lib/validation';
```

Замінено 3 блоки inline-перевірок одним викликом:
```typescript
// Було (3 окремих if):
if (!trimmed) { setValidationError('...'); return; }
if (trimmed.length > 253) { setValidationError('...'); return; }
if (/[<>'"`;]|.../.test(trimmed)) { setValidationError('...'); return; }

// Стало:
const validation = validateDarkWebQuery(trimmed);
if (!validation.valid) { setValidationError(validation.error ?? 'Invalid query.'); return; }
```

### 2. `agentTools.ts`
Додано імпорт:
```typescript
import { validateDarkWebQuery } from './validation';
```

Замінено 3 блоки inline-перевірок одним викликом:
```typescript
// Було:
if (!query) { return { ..., summary: 'Please provide...' }; }
if (query.length > 253) { return { ..., summary: 'Query is too long...' }; }
if (/.../.test(query)) { return { ..., summary: 'Query contains invalid...' }; }

// Стало:
const validation = validateDarkWebQuery(query);
if (!validation.valid) { return { name: 'dark_web_scan', ok: false, summary: validation.error ?? 'Invalid query.' }; }
```

---

## Що покращило / виправило

- **Безпека**: 7 injection-патернів замість 1 (додано: template `${}`, backtick, `javascript:`, LDAP patterns)
- **Уніфікація**: єдине джерело правди — `ValidationLimits.QUERY_MAX_LENGTH` (500) замість хардкодованого 253
- **DRY**: логіка валідації більше не дублюється між UI і агентом
- **Бандл**: `validation.ts` виноситься в окремий чанк `validation-*.js` (5.66 kB)
- **Перевірено**: `npm run build` — успішно (1594 modules, 1.86s)
