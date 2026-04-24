-- BACKWARD_COMPATIBLE: YES
-- REASON: Adds JSONB column sla_config with default value. Old profiles retain default.
-- ROLLBACK: ALTER TABLE profiles DROP COLUMN IF EXISTS sla_config;
/*
  # Add configurable SLA budgets per user

  1. Changes
    - Add `sla_config` (jsonb) to `profiles` with sensible defaults:
      critical=3 days, high=7 days, medium=30 days, low=90 days.
    - Allows each user to define their own SLA windows used by the Dashboard
      SLA watch panel and the automatic breach notification logic.
  2. Security
    - No policy changes; existing RLS on profiles already restricts to the
      authenticated user (`auth.uid() = id`).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'sla_config'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN sla_config jsonb NOT NULL
      DEFAULT '{"critical":3,"high":7,"medium":30,"low":90}'::jsonb;
  END IF;
END $$;
