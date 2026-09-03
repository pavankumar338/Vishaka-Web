import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cxjdoypvbtnwylnlchgu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4amRveXB2YnRud3lsbmxjaGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0OTA5MjksImV4cCI6MjEwMzA2NjkyOX0.eXwvGZ0vw-o3TfFBAkDWDY6glf1ykqBehhdNDqf3sBU'
);

async function testLogs() {
  const { data: logs, error } = await supabase.from('check_in_logs').select('participant_id, logged_at');
  console.log('check_in_logs:', logs);
  const checkedInIds = new Set((logs || []).map(l => l.participant_id));
  console.log('Checked in participant IDs:', Array.from(checkedInIds));
}

testLogs();
