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

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasAccess = await userHasPermission(req.user.id, 'manage_courier_transactions');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view courier transactions' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const searchTerm = req.query.search as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    const applyFilters = (q: any) => {
      if (searchTerm) {
        q = q.or(
          `ticket_number.ilike.%${searchTerm}%,reference_number.ilike.%${searchTerm}%,part_name.ilike.%${searchTerm}%,courier.ilike.%${searchTerm}%,pick_up_from.ilike.%${searchTerm}%,deliver_to.ilike.%${searchTerm}%`
        );
      }
      if (startDate) q = q.gte('transaction_date', startDate);
      if (endDate) q = q.lte('transaction_date', endDate);
      return q;
    };

    // Count query
    let countQuery = supabaseAdmin
      .from('courier_transactions')
      .select('*', { count: 'exact', head: true });
    countQuery = applyFilters(countQuery);

    const { count: total, error: countError } = await countQuery;
    if (countError) throw countError;

    // Data query
    let query = supabaseAdmin
      .from('courier_transactions')
      .select(`
        id,
        transaction_date,
        ticket_id,
        ticket_number,
        pick_up_from,
        deliver_to,
        part_name,
        courier,
        reference_number,
        amount,
        store_id,
        invoice_path,
        invoice_file_name,
        created_by,
        created_at,
        updated_at,
        stores:store_id (
          id,
          store_name,
          store_code
        ),
        created_by_user:created_by (
          first_name,
          last_name
        )
      `);
    query = applyFilters(query);
    query = query
      .order('transaction_date', { ascending: sortOrder === 'asc' })
      .order('created_at', { ascending: sortOrder === 'asc' })
      .range(from, to);

    const { data: transactions, error } = await query;
    if (error) throw error;

    return res.status(200).json({
      transactions,
      pagination: {
        total: total || 0,
        page,
        limit,
        totalPages: Math.ceil((total || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching courier transactions:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch courier transactions' });
  }
}

export default withAuth(handler);
