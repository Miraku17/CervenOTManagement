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

    // Get pagination params
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Build the base query for counting
    let countQuery = supabaseAdmin
      .from('tickets')
      .select('*', { count: 'exact', head: true });

    // If user is not admin, filter by tickets they are servicing
    if (req.user.role !== 'admin') {
      countQuery = countQuery.eq('serviced_by', req.user.id);
    }

    // Get total count
    const { count: total, error: countError } = await countQuery;

    if (countError) {
      throw countError;
    }

    // Build the query for data
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
      `)
      .range(from, to)
      .order('created_at', { ascending: false });

    // If user is not admin, filter by tickets they are servicing
    if (req.user.role !== 'admin') {
      query = query.eq('serviced_by', req.user.id);
    }

    const { data: tickets, error } = await query;

    if (error) {
      throw error;
    }

    return res.status(200).json({
      tickets,
      pagination: {
        total: total || 0,
        page,
        limit,
        totalPages: Math.ceil((total || 0) / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch tickets' });
  }
}

export default withAuth(handler);
