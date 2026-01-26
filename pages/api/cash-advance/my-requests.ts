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

    // Fetch user's own cash advance requests (excluding soft-deleted)
    const { data: cashAdvances, error, count } = await supabaseAdmin
      .from('cash_advances')
      .select(`
        *,
        approved_by_user:approved_by (
          id,
          first_name,
          last_name
        ),
        level1_reviewer_profile:level1_approved_by (
          id,
          first_name,
          last_name
        ),
        level2_reviewer_profile:level2_approved_by (
          id,
          first_name,
          last_name
        )
      `, { count: 'exact' })
      .eq('requested_by', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      console.error('Error fetching cash advances:', error);
      throw error;
    }

    return res.status(200).json({
      cashAdvances: cashAdvances || [],
      pagination: {
        total: count || 0,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error: unknown) {
    console.error('Get my cash advances error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch cash advance requests';
    return res.status(500).json({
      error: errorMessage,
    });
  }
}

export default withAuth(handler);
