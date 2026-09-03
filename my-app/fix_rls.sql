-- Run this in your Supabase SQL Editor to allow status updates from the Scanner
-- 1. Drop existing policy if any
DROP POLICY IF EXISTS "Enable updates for all participants" ON "public"."participants";
DROP POLICY IF EXISTS "Allow update participants" ON "public"."participants";

-- 2. Create full update policy for anon users
CREATE POLICY "Allow update participants"
ON "public"."participants"
FOR UPDATE
USING (true)
WITH CHECK (true);

-- 3. Ensure SELECT and INSERT policies exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'participants' AND policyname = 'Allow select participants'
    ) THEN
        CREATE POLICY "Allow select participants" ON "public"."participants" FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'participants' AND policyname = 'Allow insert participants'
    ) THEN
        CREATE POLICY "Allow insert participants" ON "public"."participants" FOR INSERT WITH CHECK (true);
    END IF;
END $$;

