/*
  # Track SLA pre-breach warnings

  1. Changes
    - Add `sla_warned_at` (timestamptz, nullable) to `vulnerabilities`.
      Stamped once when a finding first crosses the "at risk" threshold
      (configurable percentage of the SLA window, defaulting to 75%).
      Used to avoid firing duplicate early-warning notifications.
  2. Security
    - No policy changes; existing RLS on vulnerabilities already enforces
      per-user ownership via `auth.uid() = user_id`.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vulnerabilities' AND column_name = 'sla_warned_at'
  ) THEN
    ALTER TABLE vulnerabilities ADD COLUMN sla_warned_at timestamptz;
  END IF;
END $$;
