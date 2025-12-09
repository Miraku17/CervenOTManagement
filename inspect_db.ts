
import { supabaseServer } from './lib/supabase-server';

async function inspectTable() {
  const { data, error } = await supabaseServer
    .from('attendance_daily_summary')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error selecting:', error);
  } else {
    console.log('Sample data:', data);
  }
}

inspectTable();
