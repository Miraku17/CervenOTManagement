import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Fetch import logs for store inventory with user profile info
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('import_logs')
      .select(`
        *,
        profiles!imported_by (
          first_name,
          last_name,
          email
        )
      `)
      .eq('import_type', 'store_inventory')
      .order('created_at', { ascending: false });

    if (logsError) {
      console.error('Error fetching import logs:', logsError);
      return res.status(500).json({ error: 'Failed to fetch import logs' });
    }

    // For each log, fetch its errors
    const logsWithErrors = await Promise.all(
      (logs || []).map(async (log) => {
        if (!supabaseAdmin) {
          return { ...log, errors: [] };
        }

        const { data: errors, error: errorsError } = await supabaseAdmin
          .from('import_errors')
          .select('*')
          .eq('import_log_id', log.id)
          .order('row_number', { ascending: true });

        if (errorsError) {
          console.error('Error fetching import errors:', errorsError);
          return { ...log, errors: [] };
        }

        return { ...log, errors: errors || [] };
      })
    );

    return res.status(200).json({ logs: logsWithErrors });
  } catch (error: any) {
    console.error('Error in import logs API:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export default withAuth(handler);
