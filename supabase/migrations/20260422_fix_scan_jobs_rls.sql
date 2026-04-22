-- Fix RLS for scan_jobs to allow authenticated users to create and manage their jobs
-- This resolves the 403 Forbidden errors in Chat and AI Remediation

-- 1. Enable Insert for authenticated users
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'scan_jobs' AND policyname = 'Users can insert own scan jobs'
    ) THEN
        CREATE POLICY "Users can insert own scan jobs"
          ON scan_jobs FOR INSERT TO authenticated 
          WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 2. Enable Update for authenticated users (to allow status management if needed)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'scan_jobs' AND policyname = 'Users can update own scan jobs'
    ) THEN
        CREATE POLICY "Users can update own scan jobs"
          ON scan_jobs FOR UPDATE TO authenticated 
          USING (auth.uid() = user_id);
    END IF;
END $$;

-- 3. Ensure Delete is also possible for cleanup
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'scan_jobs' AND policyname = 'Users can delete own scan jobs'
    ) THEN
        CREATE POLICY "Users can delete own scan jobs"
          ON scan_jobs FOR DELETE TO authenticated 
          USING (auth.uid() = user_id);
    END IF;
END $$;
