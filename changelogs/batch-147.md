## Batch-147: Real-time Collaboration — Presence Avatars & Finding Comments

**Commit:** `3b3ca2b`

### Що було
- Findings/vulnerabilities мали лише статус та notes для командної роботи
- Не було видимості, хто з команди наразі переглядає знахідку
- Немає централізованого місця для командної дискусії на темі конкретної уразливості

### Що зроблено

#### 1. **Presence Tracking Context** (`src/context/PresenceContext.tsx`)
- Новий `PresenceProvider` для трекування, хто де переглядає
- `usePresence()` hook з методами:
  - `updatePresence(contextType, contextId)` — оновлювати свою локацію
  - `getMembersViewing()` — отримати інших користувачів, які переглядають те саме
- Автоматичний heartbeat кожні 30 секунд для оновлення `last_seen_at`
- Фільтрація застарілих presence записів (>5 хвилин)

#### 2. **Database Types** (`src/lib/supabase.ts`)
- Новий тип `Presence` — user_id, org_id, context_type (project/scan/report/finding), context_id, cursor data
- Новий тип `FindingComment` — vulnerability_id, user_id, content, parent_id (для репліс), timestamps

#### 3. **Comment Service** (`src/lib/commentService.ts`)
- Функції: `getComments()`, `addComment()`, `updateComment()`, `deleteComment()`
- Real-time subscription `subscribeToComments()` для live updates
- Підтримка reply-to threads через `parent_id`

#### 4. **UI Components**

**PresenceAvatars** (`src/components/PresenceAvatars.tsx`)
- Показує аватари (перші букви user_id) усіх, хто наразі переглядає знахідку
- 8 кольорів для розрізнення користувачів
- Hover tooltip з user ID
- Отримує `contextType` і `contextId` як props

**CommentThread** (`src/components/CommentThread.tsx`)
- Floating comment panel (bottom-right) з:
  - Списком всіх коментарів + replies (nested)
  - Можливістю додавати коментарі (Enter або Send кнопка)
  - Reply-to для потокової дискусії
  - Edit/Delete для власних коментарів
  - Real-time updates при зміні коментарів
- Компактна версія: `<CommentThread/>` button з кількістю коментарів

#### 5. **FindingsTab Integration** (`src/components/FindingsTab.tsx`)
- Імпорт `PresenceAvatars` та `CommentThread`
- Додан `useEffect` у `FindingRow` для tracking presence при розгортанні знахідки
- Секція presence avatars + comment button під analyst note
- Автоматично оновлює presence при `expanded={true}`

#### 6. **App Provider Hierarchy** (`src/App.tsx`)
- Wrap entire app з `PresenceProvider` (після `AuthProvider`, перед `BrowserRouter`)
- Presence доступна глобально в усіх компонентах

#### 7. **Database Schema** (`supabase/SETUP.sql`)
- Таблиця `presence` з RLS policies (read org presence, update own)
- Таблиця `finding_comments` з RLS policies (read org comments, insert/update/delete own)
- Indexes на context, user, vulnerability, created_at для швидкості
- UNIQUE constraint на (user_id, org_id, context_type, context_id) для presence

### Що покращило

✅ **Team Awareness** — видно хто з команди переглядає знахідку в реальному часі  
✅ **Threaded Discussions** — коментарі з replies для організованої дискусії на findings  
✅ **Real-time Sync** — Supabase subscriptions для live comment updates  
✅ **Accessibility** — aria-labels, titles на всіх buttons, sr-only labels  
✅ **Scalable Architecture** — presence heartbeat + stale record filtering для продуктивності  

### Files Modified
1. `src/context/PresenceContext.tsx` — новий файл
2. `src/components/PresenceAvatars.tsx` — новий файл
3. `src/components/CommentThread.tsx` — новий файл
4. `src/lib/commentService.ts` — новий файл
5. `src/lib/supabase.ts` — додані типи Presence, FindingComment
6. `src/components/FindingsTab.tsx` — інтеграція presence + comments
7. `src/App.tsx` — додан PresenceProvider
8. `supabase/SETUP.sql` — додані таблиці presence, finding_comments

**Total Changes:** 8 files, 641 insertions
