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

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get query parameters
    const { page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Fetch user's own liquidations
    const { data: liquidations, error, count } = await supabaseAdmin
      .from('liquidations')
      .select(
        `
        *,
        cash_advances (
          id,
          amount,
          date_requested
        ),
        stores (
          id,
          store_code,
          store_name
        ),
        tickets (
          id,
          rcc_reference_number
        ),
        liquidation_items (
          id,
          from_destination,
          to_destination,
          jeep,
          bus,
          fx_van,
          gas,
          toll,
          meals,
          lodging,
          others,
          total,
          remarks
        ),
        liquidation_attachments (
          id,
          file_name,
          file_path,
          file_type,
          file_size,
          created_at
        )
      `,
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      console.error('Error fetching liquidations:', error);
      throw error;
    }

    return res.status(200).json({
      liquidations: liquidations || [],
      pagination: {
        total: count || 0,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error: unknown) {
    console.error('Get my liquidations error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch liquidations';
    return res.status(500).json({
      error: errorMessage,
    });
  }
}

export default withAuth(handler);
