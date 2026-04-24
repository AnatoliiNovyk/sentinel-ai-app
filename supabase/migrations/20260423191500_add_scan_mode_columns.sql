-- BACKWARD_COMPATIBLE: YES
-- REASON: Adds is_mock (bool DEFAULT false) and detected_mode (text DEFAULT 'UNKNOWN') to scans.
-- ROLLBACK: ALTER TABLE scans DROP COLUMN IF EXISTS is_mock, DROP COLUMN IF EXISTS detected_mode;
-- Track whether a scan is executed by real backend pipeline or local mock fallback.
alter table if exists public.scans
  add column if not exists is_mock boolean not null default false;

alter table if exists public.scans
  add column if not exists detected_mode text not null default 'UNKNOWN';

-- Normalize existing rows to UNKNOWN when mode was not tracked.
update public.scans
set detected_mode = 'UNKNOWN'
where detected_mode is null or detected_mode = '';

-- Optional guardrail for allowed values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scans_detected_mode_check'
  ) then
    alter table public.scans
      add constraint scans_detected_mode_check
      check (detected_mode in ('REAL', 'MOCK', 'UNKNOWN'));
  end if;
end$$;
