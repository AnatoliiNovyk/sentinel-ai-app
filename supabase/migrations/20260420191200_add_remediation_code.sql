/*
  # Add remediation code to vulnerabilities

  1. Changes
    - Add `remediation_code` (text) to `vulnerabilities` table
    - Add `remediation_type` (text) to `vulnerabilities` table (e.g. 'terraform', 'bash', 'kubernetes')
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vulnerabilities' AND column_name = 'remediation_code'
  ) THEN
    ALTER TABLE vulnerabilities ADD COLUMN remediation_code text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vulnerabilities' AND column_name = 'remediation_type'
  ) THEN
    ALTER TABLE vulnerabilities ADD COLUMN remediation_type text NOT NULL DEFAULT 'manual';
  END IF;
END $$;
