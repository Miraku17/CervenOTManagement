import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

// Returns all courier transactions matching the optional filters as JSON;
// the client builds the styled Excel workbook (same pattern as other exports).
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
      return res.status(403).json({ error: 'Forbidden: You do not have permission to export courier transactions' });
    }

    const searchTerm = req.query.search as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Page through all rows to bypass the 1000 row limit
    let allTransactions: any[] = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    let to = PAGE_SIZE - 1;
    let moreData = true;

    while (moreData) {
      let query = supabaseAdmin
        .from('courier_transactions')
        .select(`
          id,
          transaction_date,
          ticket_number,
          pick_up_from,
          deliver_to,
          part_name,
          courier,
          reference_number,
          amount,
          invoice_file_name,
          created_at,
          stores:store_id (
            store_name,
            store_code
          ),
          created_by_user:created_by (
            first_name,
            last_name
          )
        `)
        .order('transaction_date', { ascending: false })
        .range(from, to);

      if (searchTerm) {
        query = query.or(
          `ticket_number.ilike.%${searchTerm}%,reference_number.ilike.%${searchTerm}%,part_name.ilike.%${searchTerm}%,courier.ilike.%${searchTerm}%,pick_up_from.ilike.%${searchTerm}%,deliver_to.ilike.%${searchTerm}%`
        );
      }
      if (startDate) query = query.gte('transaction_date', startDate);
      if (endDate) query = query.lte('transaction_date', endDate);

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        allTransactions = allTransactions.concat(data);
        if (data.length < PAGE_SIZE) {
          moreData = false;
        } else {
          from += PAGE_SIZE;
          to += PAGE_SIZE;
        }
      } else {
        moreData = false;
      }
    }

    return res.status(200).json({ transactions: allTransactions });
  } catch (error: any) {
    console.error('Error exporting courier transactions:', error);
    return res.status(500).json({ error: error.message || 'Failed to export courier transactions' });
  }
}

export default withAuth(handler);
