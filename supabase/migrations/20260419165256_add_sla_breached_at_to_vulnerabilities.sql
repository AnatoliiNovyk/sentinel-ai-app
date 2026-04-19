/*
  # Add SLA breach tracking to vulnerabilities

  1. Changes
    - Add `sla_breached_at` column (timestamptz, nullable) to `vulnerabilities` table
      - Records the first time a finding crossed its SLA budget
      - Allows idempotent notification creation (set once, notify once)
  2. Security
    - No policy changes; existing RLS on vulnerabilities already restricts by user_id
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vulnerabilities' AND column_name = 'sla_breached_at'
  ) THEN
    ALTER TABLE vulnerabilities ADD COLUMN sla_breached_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS vulnerabilities_sla_breached_at_idx
  ON vulnerabilities(user_id, sla_breached_at);
