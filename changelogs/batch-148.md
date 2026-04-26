## Batch-148: API Rate Limiting UI — Quota Tracking & Usage Dashboard

**Commit:** `3cba420`

### Що було
- Не було видимості по API лімітам та поточному usage
- Користувачі не знали скільки scans/reports/api-calls мають ліміт
- Немає контролю над rate limiting на базі плану (Free/Basic/Pro/Enterprise)

### Що зроблено

#### 1. **Database Types & Constants** (`src/lib/supabase.ts`)
- Новий тип `ApiRateLimit` з метриками:
  - `scans_per_month` (10/100/∞/∞)
  - `reports_per_day` (5/50/∞/∞)
  - `chat_messages_per_hour` (20/100/∞/∞)
  - `api_calls_per_second` (1/5/20/100)
- `DEFAULT_RATE_LIMITS` по плану (Free/Basic/Pro/Enterprise)
- Тип `ApiUsage` для трекування поточного usage

#### 2. **Rate Limit Service** (`src/lib/rateLimitService.ts`)
- Функції для управління rate limits:
  - `getRateLimitConfig(planId)` — отримати ліміти для плану
  - `getCurrentUsage(userId, metric)` — перевірити поточне usage
  - `recordUsage(userId, metric)` — залогувати нову операцію
  - `checkRateLimit(userId, planId, metric)` — повна перевірка з allowed/remaining/limit/resetAt
- Автоматичний розрахунок `reset_at` часу (monthly/daily/hourly/per-second)
- Витягування з Supabase та трекування usage records

#### 3. **API Rate Limits Panel** (`src/components/ApiRateLimitsPanel.tsx`)
- React компонент з 4 метриками в grid layout
- Для кожної метрики:
  - Прогрес-бар з градієнтом (blue/emerald/purple/amber)
  - Процент usage (0-100%)
  - Поточне / максимальне значення
  - Статус: здоров'я / warning (>75%) / exceeded
  - Кольорові індикатори (red для exceeded, amber для warning)
- Info box з інформацією про reset times (monthly/daily/hourly)
- CTA для upgrade при достиганні лімітів
- Loading skeleton під час завантаження даних

#### 4. **Settings Integration** (`src/pages/Settings.tsx`)
- Додано `ApiRateLimitsPanel` компонент до Settings сторінки
- Розташовано між Billing Plans та SLA Config
- Передається `userId` та `planId` для персоналізованого display
- Додані `title` атрибути на toggle buttons (2FA, Dark Mode)

#### 5. **Database Schema** (`supabase/SETUP.sql`)
- Таблиця `api_usage` з полями:
  - user_id, metric, count, reset_at
  - UNIQUE на (user_id, org_id, context_type, context_id)
  - CHECK constraint на metric типи
  - RLS policies для read/insert/update власних records
- Indexes на (user_id, metric) та reset_at для швидкості

### Що покращило

✅ **Quota Visibility** — користувачі бачать свій usage в реальному часі  
✅ **Plan-based Limits** — різні ліміти для Free/Basic/Pro/Enterprise  
✅ **Smart Reset Times** — monthly/daily/hourly/per-second розрахунки  
✅ **Visual Indicators** — прогрес-бари, кольорові статуси, warning/exceeded states  
✅ **Upgrade CTA** — натхнення до upgrade при наближенні до лімітів  
✅ **Accessibility** — aria-labels, titles на buttons, semantic HTML  

### Files Modified
1. `src/lib/supabase.ts` — додані типи ApiRateLimit, ApiUsage, DEFAULT_RATE_LIMITS
2. `src/lib/rateLimitService.ts` — новий файл з rate limit logic
3. `src/components/ApiRateLimitsPanel.tsx` — новий UI компонент
4. `src/pages/Settings.tsx` — інтеграція ApiRateLimitsPanel, fixes для accessibility
5. `supabase/SETUP.sql` — таблиця api_usage з RLS та indexes

**Total Changes:** 5 files, 430 insertions
