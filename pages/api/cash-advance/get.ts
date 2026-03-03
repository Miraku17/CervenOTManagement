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

    // Get current user's position to check if they can view Operations Manager cash advances
    const { data: currentUserProfile } = await supabaseAdmin
      .from('profiles')
      .select(`
        position_id,
        positions:position_id (name)
      `)
      .eq('id', userId)
      .single();

    const currentUserPosition = (currentUserProfile?.positions as any)?.name || '';
    const isManagingDirector = currentUserPosition.toLowerCase().includes('managing director');
    const isOperationsManager = currentUserPosition === 'Operations Manager';

    console.log('Cash Advance Get - User position:', currentUserPosition, 'Is Managing Director:', isManagingDirector);

    // Get confidential position IDs to filter requests
    // MD and Operations Manager: sees all (HR, Accounting, Operations Manager)
    // Others: sees none of the above
    let confidentialUserIds: string[] = [];
    if (!isManagingDirector && !isOperationsManager) {
      const positionsToExclude = ['HR', 'Accounting', 'Operations Manager'];

      const orFilter = positionsToExclude.map(n => `name.eq.${n}`).join(',');
      const { data: confidentialPositions } = await supabaseAdmin
        .from('positions')
        .select('id')
        .or(orFilter);

      if (confidentialPositions && confidentialPositions.length > 0) {
        const positionIds = confidentialPositions.map(p => p.id);

        const { data: confidentialUsers } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .in('position_id', positionIds);

        confidentialUserIds = (confidentialUsers || []).map(u => u.id);
        console.log('Cash Advance Get - Confidential user IDs to exclude:', confidentialUserIds);
      }
    }

    // Get query parameters
    const { status, type, position, page = '1', limit = '20' } = req.query;
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
          employee_id,
          position_id,
          positions:position_id (
            name
          )
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

    // Filter by position
    if (position && position !== 'all') {
      const { data: positionData } = await supabaseAdmin
        .from('positions')
        .select('id')
        .eq('name', position)
        .single();

      if (positionData) {
        const { data: positionUsers } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('position_id', positionData.id);

        if (positionUsers && positionUsers.length > 0) {
          const userIds = positionUsers.map(u => u.id);
          query = query.in('requested_by', userIds);
        } else {
          // No users with this position - return empty
          return res.status(200).json({
            cashAdvances: [],
            pagination: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 },
          });
        }
      }
    }

    // Filter out HR, Accounting, and Operations Manager cash advances if user is not Managing Director
    if (!isManagingDirector && confidentialUserIds.length > 0) {
      // Exclude cash advances requested by HR, Accounting, and Operations Managers
      query = query.filter('requested_by', 'not.in', `(${confidentialUserIds.join(',')})`);
      console.log('Cash Advance Get - Applied filter to exclude confidential requests (HR, Accounting, Ops Manager)');
    }

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data: cashAdvances, error, count } = await query;

    console.log('Cash Advance Get - Query result count:', count, 'Error:', error?.message || 'none');

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
