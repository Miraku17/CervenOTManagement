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

    // Check if user has manage_cash_flow permission
    const hasCashFlowPermission = await userHasPermission(userId, 'manage_cash_flow');

    if (!hasCashFlowPermission) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view cash flow requests' });
    }

    // Get query parameters
    const { status, type, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build query
    let query = supabaseAdmin
      .from('cash_advances')
      .select(`
        *,
        requester:requested_by (
          id,
          first_name,
          last_name,
          email,
          employee_id
        ),
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
      .is('deleted_at', null) // Exclude soft-deleted records
      .order('created_at', { ascending: false });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (type && type !== 'all') {
      query = query.eq('type', type);
    }

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data: cashAdvances, error, count } = await query;

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
  } catch (error: any) {
    console.error('Get cash advances error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch cash advance requests',
    });
  }
}

export default withAuth(handler);
