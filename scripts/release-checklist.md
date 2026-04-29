# Sentinel AI — Release Security & Schema Checklist

Run this checklist **before every production deployment**.  
Reference: Audit FINDING-005 (rate limiting baseline) and FINDING-003 (error contract).

---

## 1. Pre-flight

- [ ] All feature branches merged and conflicts resolved
- [ ] `main` branch CI passes (all 78 test files, 1079+ tests green)
- [ ] `npm run build` succeeds without errors or TS warnings
- [ ] Version bumped in `package.json` (semver)

---

## 2. Environment Variables

Verify all required env vars are configured in the production environment  
(Vercel Dashboard → Project → Settings → Environment Variables):

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ Yes | Must be production Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Row-level-security anon key |
| `VITE_ALLOW_MOCK_SCAN_FALLBACK` | ⛔ Must be `false` or unset | Never `true` in production |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes (Edge Functions only) | Do NOT expose to browser |

- [ ] `VITE_ALLOW_MOCK_SCAN_FALLBACK` is **not** set to `true`
- [ ] No secrets committed to git (`grep -r "service_role" src/`)
- [ ] `.env.local` and `.env.production` are in `.gitignore`

---

## 3. Supabase Schema

- [ ] All pending migrations applied: `supabase db push` or confirm via Dashboard → Database → Migrations
- [ ] RLS policies enabled on all user-data tables (`scans`, `vulnerabilities`, `projects`, `notifications`, `scan_schedules`, `reports`)
- [ ] No publicly writable tables without auth (run: `select tablename, rowsecurity from pg_tables where schemaname='public'`)
- [ ] Edge Functions deployed: `supabase functions deploy ai-gateway scan-dispatch scan-result report-generate`
- [ ] Database backup taken before migration

---

## 4. Security Baseline

- [ ] Supabase rate limits configured (Dashboard → Auth → Rate Limits):
  - Sign-up: ≤ 10/hour per IP
  - OTP/Magic link: ≤ 5/hour per email
- [ ] CORS origins restricted in Edge Functions (no wildcard `*` in production)
- [ ] API keys rotated if compromised or last rotation > 90 days
- [ ] `Content-Security-Policy` header set in `vercel.json`
- [ ] No `console.log` with sensitive data in production bundle (`npm run build 2>&1 | grep -i "secret\|password\|token"`)

---

## 5. Feature Flags

- [ ] Mock scan fallback disabled (`VITE_ALLOW_MOCK_SCAN_FALLBACK=false`)
- [ ] Verify SARIF/report exports do NOT include `_mockData: true` in production scans
- [ ] AI Gateway pointing to production model endpoint, not dev/stub

---

## 6. Post-Deploy Validation

- [ ] Open production URL — landing page loads without JS errors
- [ ] Auth flow works: sign-up, sign-in, sign-out
- [ ] Create a test project and run a scan — verify scan completes (REAL mode, not MOCK)
- [ ] Download SARIF report — verify no `_mockData` field in output
- [ ] Check Supabase Dashboard → Logs for any 5xx errors
- [ ] Notifications are delivered for completed scans

---

## 7. Rollback Plan

If critical issues are detected post-deploy:

1. Vercel: **Instant rollback** → Dashboard → Deployments → previous deployment → Promote
2. Database: Restore from pre-migration backup (Supabase Dashboard → Database → Backups)
3. Edge Functions: `supabase functions deploy <fn-name>` with the previous version tag
4. Notify team via Slack/email with incident summary

---

_Last updated: 2026-04-29 | Batch-288_
