# Batch 213: Fix `Unsupported JWT algorithm ES256` in scan-dispatch

## Як було
- При старті скану бекенд повертав помилку `Unsupported JWT algorithm ES256`.
- Це ламало `scan-dispatch`, бо edge function викликала `auth.getUser()` через `SUPABASE_ANON_KEY` + forwarded `Authorization` header.

## Що зроблено
- У [supabase/functions/scan-dispatch/index.ts](supabase/functions/scan-dispatch/index.ts):
  - прибрано залежність від `supabase.auth.getUser()` у цій функції;
  - джерело `user_id`/`org_id` переведено на вже створений запис `scans` (через service role select by `scan_id`);
  - додано перевірку `scan_id/project_id mismatch`;
  - rate-limit тепер застосовується до `scan.user_id`;
  - вставка `scan_jobs` і update `scans` використовують `scan.user_id` та `scan.org_id`.

## Що покращило/виправило/додало
- Усунуто фейл старту скану через JWT algorithm mismatch (`ES256`) у dispatch edge function.
- Збережено коректну прив'язку job до власника скану та org-контексту.
- Якість перевірено: lint/build проходять успішно.
