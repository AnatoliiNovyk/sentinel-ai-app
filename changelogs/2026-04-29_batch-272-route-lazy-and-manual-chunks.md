# Batch 272: Route lazy-loading and Vite manual chunks

## Як було
- Білд мав великий монолітний JS-бандл і попередження щодо продуктивності.
- Усі сторінки імпортувалися eager-режимом через `App.tsx`, що збільшувало стартовий payload.
- У `vite.config.ts` не було кастомної chunk-стратегії.

## Що зроблено
- Оновлено [src/App.tsx](src/App.tsx):
  - сторінки переведено на `React.lazy(() => import(...))`;
  - додано `Suspense` fallback (`RouteFallback`) для route-level завантаження;
  - lazy-завантаження застосоване як для auth/public, так і для protected route tree.
- Оновлено [vite.config.ts](vite.config.ts):
  - додано `build.rollupOptions.output.manualChunks`;
  - виділено окремі vendor chunks для `react/react-router`, `@supabase/supabase-js`, `lucide-react` та misc.

## Що покращило
- Зменшено початковий JS payload за рахунок lazy-route імпортів.
- Білд тепер формує більш контрольовані чанки, які краще кешуються браузером.
- Підтверджено розбиття в output: `vendor-react`, `vendor-misc`, page chunks (`Projects`, `Dashboard`, `Settings`, `Scans` тощо).
