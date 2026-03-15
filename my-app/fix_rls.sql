-- Run this in your Supabase SQL Editor to allow status updates from the Scanner
-- Enables UPDATE operations for all users on the participants table
CREATE POLICY "Enable updates for all participants"
ON "public"."participants"
FOR UPDATE USING (
  true
);

-- Note: Ensure Row Level Security (RLS) is enabled and you have SELECT and INSERT policies too.
-- If you haven't enabled RLS, run:
-- ALTER TABLE "public"."participants" ENABLE ROW LEVEL SECURITY;
