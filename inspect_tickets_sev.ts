
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manual env loading
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    });
  }
} catch (e) {
  console.error('Failed to load .env.local', e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function inspectTickets() {
  console.log('Fetching tickets...');
  const { data, error } = await supabase
    .from('tickets')
    .select('id, sev, status')
    .limit(50);

  if (error) {
    console.error('Error fetching tickets:', error);
    return;
  }

  console.log('Sample tickets data:');
  data.forEach(ticket => {
    console.log(`ID: ${ticket.id}, Sev: '${ticket.sev}', Status: '${ticket.status}'`);
  });

  // Check specific counts for SEV2
  const { count, error: countError } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .ilike('sev', '%sev2%');
    
  if (countError) {
     console.error('Error counting SEV2:', countError);
  } else {
      console.log(`\nTotal tickets with 'sev' containing 'sev2' (case-insensitive): ${count}`);
  }
}

inspectTickets();
