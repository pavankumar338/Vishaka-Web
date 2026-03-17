-- ============================================================
-- FIX: RLS Policies for check_in_logs and check_out_logs
-- Run this SQL in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Enable RLS on both log tables (if not already enabled)
ALTER TABLE "public"."check_in_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."check_out_logs" ENABLE ROW LEVEL SECURITY;

-- 2. Allow SELECT (read) on check_in_logs for all users
CREATE POLICY "Allow read check_in_logs"
ON "public"."check_in_logs"
FOR SELECT USING (true);

-- 3. Allow INSERT on check_in_logs for all users
CREATE POLICY "Allow insert check_in_logs"
ON "public"."check_in_logs"
FOR INSERT WITH CHECK (true);

-- 4. Allow SELECT (read) on check_out_logs for all users
CREATE POLICY "Allow read check_out_logs"
ON "public"."check_out_logs"
FOR SELECT USING (true);

-- 5. Allow INSERT on check_out_logs for all users
CREATE POLICY "Allow insert check_out_logs"
ON "public"."check_out_logs"
FOR INSERT WITH CHECK (true);

-- ============================================================
-- ALTERNATIVE: If you want to DISABLE RLS entirely for these tables
-- (simpler, but less secure — okay for internal admin tools)
-- ============================================================
-- ALTER TABLE "public"."check_in_logs" DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "public"."check_out_logs" DISABLE ROW LEVEL SECURITY;
