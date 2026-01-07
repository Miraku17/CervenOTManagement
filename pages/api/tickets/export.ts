import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Check if user has permission to export ticket data
  const hasPermission = await userHasPermission(req.user?.id || '', 'view_ticket_overview');

  if (!hasPermission) {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to export ticket data'
    });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Get date range from query params
    const { startDate, endDate } = req.query;

    // Build query with all ticket details
    let query = supabaseAdmin
      .from('tickets')
      .select(`
        *,
        stores (
          store_name,
          store_code
        ),
        stations (
          name
        ),
        reported_by_user:reported_by (
          first_name,
          last_name
        ),
        serviced_by_user:serviced_by (
          first_name,
          last_name
        ),
        manager_on_duty:store_managers (
          manager_name
        )
      `);

    // Apply date filters if provided
    if (startDate && typeof startDate === 'string') {
      query = query.gte('date_reported', startDate);
    }
    if (endDate && typeof endDate === 'string') {
      query = query.lte('date_reported', endDate);
    }

    const { data: tickets, error } = await query.order('date_reported', { ascending: false });

    if (error) {
      throw error;
    }

    if (!tickets || tickets.length === 0) {
      return res.status(200).json({ tickets: [] });
    }

    return res.status(200).json({ tickets });

  } catch (error: any) {
    console.error('Error exporting ticket data:', error);
    return res.status(500).json({ error: error.message || 'Failed to export ticket data' });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
