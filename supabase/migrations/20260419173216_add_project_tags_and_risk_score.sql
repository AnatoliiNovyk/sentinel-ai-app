-- BACKWARD_COMPATIBLE: YES
-- REASON: Adds 	ags (text[] DEFAULT '{}') and isk_score (int DEFAULT 0) to projects.
-- ROLLBACK: ALTER TABLE projects DROP COLUMN IF EXISTS tags, DROP COLUMN IF EXISTS risk_score;
/*
  # Add tags and risk score to projects

  1. Changes
    - Add `tags` (text[]) to `projects` with default empty array for categorizing projects
    - Add `risk_score` (integer) to `projects` with default 0, representing a computed severity-weighted risk (0-100)

  2. Security
    - No policy changes required; existing RLS on `projects` already restricts access to owner (`auth.uid() = user_id`)

  3. Notes
    - `risk_score` is maintained by the application layer based on open vulnerabilities
    - `tags` enables lightweight grouping/filtering without a separate join table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'tags'
  ) THEN
    ALTER TABLE projects ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'risk_score'
  ) THEN
    ALTER TABLE projects ADD COLUMN risk_score integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS projects_tags_idx ON projects USING gin (tags);
