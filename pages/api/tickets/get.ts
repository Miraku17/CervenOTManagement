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

    // Check for restricted positions
    const userPosition = req.user.position?.toLowerCase() || '';
    const restrictedPositions = ['asset', 'asset lead', 'asset associate'];
    if (restrictedPositions.includes(userPosition)) {
      return res.status(403).json({ error: 'Forbidden: Access denied for your position' });
    }

    // Build the query
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

    // If user is not admin, filter by tickets they are servicing
    if (req.user.role !== 'admin') {
      query = query.eq('serviced_by', req.user.id);
    }

    const { data: tickets, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.status(200).json({ tickets });
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch tickets' });
  }
}

export default withAuth(handler);
