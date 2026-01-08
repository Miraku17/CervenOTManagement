import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasPermission = await userHasPermission(userId, 'manage_tickets');
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to view ticket import logs.'
      });
    }

    // Get import log ID from query if provided
    const { logId } = req.query;

    if (logId) {
      // Fetch specific log with errors
      const { data: log, error: logError } = await supabaseAdmin
        .from('import_logs')
        .select(`
          *,
          imported_by_user:imported_by(first_name, last_name, email)
        `)
        .eq('id', logId)
        .eq('import_type', 'tickets')
        .single();

      if (logError) throw logError;

      // Fetch errors for this log
      const { data: errors, error: errorsError } = await supabaseAdmin
        .from('import_errors')
        .select('*')
        .eq('import_log_id', logId)
        .order('row_number', { ascending: true });

      if (errorsError) throw errorsError;

      return res.status(200).json({
        log,
        errors: errors || [],
      });
    } else {
      // Fetch all ticket import logs
      const { data: logs, error: logsError } = await supabaseAdmin
        .from('import_logs')
        .select(`
          *,
          imported_by_user:imported_by(first_name, last_name, email)
        `)
        .eq('import_type', 'tickets')
        .order('started_at', { ascending: false })
        .limit(50);

      if (logsError) throw logsError;

      return res.status(200).json({
        logs: logs || [],
      });
    }
  } catch (error: any) {
    console.error('Error fetching import logs:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch import logs' });
  }
}

export default withAuth(handler);
