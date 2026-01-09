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

async function checkTicketStatus() {
  console.log('Checking ticket statuses...\n');

  // Get total count
  const { count: totalCount } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true });

  console.log(`Total tickets: ${totalCount}`);

  // Get unique statuses
  const { data: allTickets } = await supabase
    .from('tickets')
    .select('status, sev');

  const statusCounts = new Map<string, number>();
  const sevCounts = new Map<string, number>();

  allTickets?.forEach(ticket => {
    const status = ticket.status?.toLowerCase() || 'unknown';
    const sev = ticket.sev?.toUpperCase() || 'unknown';

    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    sevCounts.set(sev, (sevCounts.get(sev) || 0) + 1);
  });

  console.log('\n=== Status Breakdown ===');
  Array.from(statusCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      console.log(`${status}: ${count}`);
    });

  console.log('\n=== Severity Breakdown ===');
  Array.from(sevCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([sev, count]) => {
      console.log(`${sev}: ${count}`);
    });

  // Check unresolved tickets
  const isUnresolved = (status: string) => !['closed', 'resolved'].includes(status?.toLowerCase());

  let unresolvedCount = 0;
  const unresolvedBySev = new Map<string, number>();

  allTickets?.forEach(ticket => {
    const status = ticket.status?.toLowerCase() || 'unknown';
    if (isUnresolved(status)) {
      unresolvedCount++;
      const sev = ticket.sev?.toUpperCase() || 'unknown';
      unresolvedBySev.set(sev, (unresolvedBySev.get(sev) || 0) + 1);
    }
  });

  console.log(`\n=== Unresolved Tickets ===`);
  console.log(`Total unresolved: ${unresolvedCount}`);
  console.log('\nUnresolved by severity:');
  Array.from(unresolvedBySev.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([sev, count]) => {
      console.log(`${sev}: ${count}`);
    });
}

checkTicketStatus();
