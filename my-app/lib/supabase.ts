import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://cxjdoypvbtnwylnlchgu.supabase.co';
const defaultAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4amRveXB2YnRud3lsbmxjaGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0OTA5MjksImV4cCI6MjEwMzA2NjkyOX0.eXwvGZ0vw-o3TfFBAkDWDY6glf1ykqBehhdNDqf3sBU';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || defaultUrl;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
