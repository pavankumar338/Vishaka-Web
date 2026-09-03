import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cxjdoypvbtnwylnlchgu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4amRveXB2YnRud3lsbmxjaGd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0OTA5MjksImV4cCI6MjEwMzA2NjkyOX0.eXwvGZ0vw-o3TfFBAkDWDY6glf1ykqBehhdNDqf3sBU'
);

async function test() {
  console.log('--- Fetching participants summary ---');
  const { data: pList, error: pErr } = await supabase.from('participants').select('participant_id, status, participant_name, created_at').limit(1000);
  if (pErr) console.error('participants error:', pErr);
  else {
    console.log('Total participants fetched:', pList.length);
    const statuses = {};
    pList.forEach(p => {
      statuses[p.status] = (statuses[p.status] || 0) + 1;
    });
    console.log('Status counts:', statuses);
  }

  console.log('--- Fetching check_in_logs ---');
  const { data: logs, error: lErr } = await supabase.from('check_in_logs').select('*').limit(20);
  if (lErr) console.error('check_in_logs error:', lErr);
  else {
    console.log('Total check_in_logs count:', logs?.length, logs);
  }

  // Test updating the status of 1 participant
  if (pList && pList.length > 0) {
    const testP = pList[0];
    console.log('Testing update on:', testP.participant_id);
    const { data: upd, error: uErr } = await supabase
      .from('participants')
      .update({ status: testP.status || 'registered' })
      .eq('participant_id', testP.participant_id)
      .select();
    console.log('Update result:', { upd, error: uErr });
  }
}

test();
