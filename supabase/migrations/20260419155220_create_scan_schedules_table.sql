/*
  # Create scan_schedules table

  1. New Tables
    - `scan_schedules`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK to profiles)
      - `project_id` (uuid, FK to projects)
      - `scanner` (text) - scanner id such as nmap, prowler, tfsec, amass
      - `cadence_hours` (integer) - interval between runs in hours (e.g. 24 for daily, 168 for weekly)
      - `enabled` (boolean, default true)
      - `last_run_at` (timestamptz, nullable)
      - `next_run_at` (timestamptz, default now())
      - `created_at` (timestamptz, default now())

  2. Indexes
    - Composite index on (user_id, enabled, next_run_at) for efficient due-schedule lookup

  3. Security
    - Enable RLS on `scan_schedules`
    - SELECT policy: authenticated users can read only their own schedules
    - INSERT policy: authenticated users can create schedules they own
    - UPDATE policy: authenticated users can modify only their own schedules
    - DELETE policy: authenticated users can remove only their own schedules
*/

CREATE TABLE IF NOT EXISTS scan_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scanner text NOT NULL DEFAULT 'nmap',
  cadence_hours integer NOT NULL DEFAULT 24,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_schedules_due
  ON scan_schedules (user_id, enabled, next_run_at);

ALTER TABLE scan_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedules"
  ON scan_schedules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedules"
  ON scan_schedules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules"
  ON scan_schedules FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedules"
  ON scan_schedules FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
