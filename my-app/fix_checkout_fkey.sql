-- ============================================================
-- FIX: check_out_logs foreign key mismatch
-- The check_out_logs table has a foreign key constraint that
-- is either rejecting valid participant IDs, or the column 
-- type doesn't match participants.id
--
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Step 1: Drop the bad foreign key constraint
ALTER TABLE "public"."check_out_logs"
DROP CONSTRAINT IF EXISTS "check_out_logs_participant_id_fkey";

-- Step 2: Change the column type to TEXT to match check_in_logs
-- (Only run this if the column is uuid, not if it's already text)
ALTER TABLE "public"."check_out_logs"
ALTER COLUMN "participant_id" TYPE text;

-- Step 3: Also make sure RLS allows inserts (add if missing)
ALTER TABLE "public"."check_out_logs" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'check_out_logs' AND policyname = 'Allow read check_out_logs'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow read check_out_logs" ON "public"."check_out_logs" FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'check_out_logs' AND policyname = 'Allow insert check_out_logs'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow insert check_out_logs" ON "public"."check_out_logs" FOR INSERT WITH CHECK (true)';
  END IF;
END $$;

-- Step 4: Verify the column type
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'check_out_logs';
