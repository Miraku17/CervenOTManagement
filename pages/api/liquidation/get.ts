import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

interface LiquidationQueryParams {
  page?: string;
  limit?: string;
  status?: string;
}

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

    // Check if user has manage_liquidation or approve_liquidations permission
    const canManage = await userHasPermission(userId, 'manage_liquidation');
    const canApprove = await userHasPermission(userId, 'approve_liquidations');

    if (!canManage && !canApprove) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to view liquidations',
      });
    }

    // Get current user's position to check if they can view HR and Accounting liquidations
    const { data: currentUserProfile } = await supabaseAdmin
      .from('profiles')
      .select(`
        position_id,
        positions:position_id (name)
      `)
      .eq('id', userId)
      .single();

    const currentUserPosition = (currentUserProfile?.positions as any)?.name || '';
    // Only Managing Director can view HR and Accounting liquidations
    const isManagingDirector = currentUserPosition.toLowerCase().includes('managing director');

    console.log('Liquidation Get - User position:', currentUserPosition, 'Is Managing Director:', isManagingDirector);

    // Get confidential position IDs to filter requests (HR and Accounting)
    let confidentialUserIds: string[] = [];
    if (!isManagingDirector) {
      // Get HR and Accounting position IDs
      const { data: confidentialPositions } = await supabaseAdmin
        .from('positions')
        .select('id')
        .or('name.eq.HR,name.eq.Accounting');

      if (confidentialPositions && confidentialPositions.length > 0) {
        const positionIds = confidentialPositions.map(p => p.id);

        // Get all user IDs with these positions
        const { data: confidentialUsers } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .in('position_id', positionIds);

        confidentialUserIds = (confidentialUsers || []).map(u => u.id);
        console.log('Liquidation Get - Confidential user IDs to exclude:', confidentialUserIds);
      }
    }

    // Get query parameters
    const { page = '1', limit = '20', status }: LiquidationQueryParams = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build query - fetch liquidations without profiles join
    let query = supabaseAdmin
      .from('liquidations')
      .select(
        `
        *,
        cash_advances (
          id,
          amount,
          date_requested,
          type
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
          remarks,
          liquidation_item_attachments:liquidation_attachments!liquidation_item_id (
            id,
            file_name,
            file_path,
            file_type,
            file_size,
            created_at,
            liquidation_item_id
          )
        ),
        liquidation_attachments!liquidation_id (
          id,
          file_name,
          file_path,
          file_type,
          file_size,
          created_at,
          liquidation_item_id
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Filter out HR and Accounting liquidations if user is not Managing Director
    if (!isManagingDirector && confidentialUserIds.length > 0) {
      // Exclude liquidations requested by HR and Accounting
      query = query.filter('user_id', 'not.in', `(${confidentialUserIds.join(',')})`);
      console.log('Liquidation Get - Applied filter to exclude confidential requests (HR, Accounting)');
    }

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data: liquidations, error, count } = await query;

    if (error) {
      console.error('Error fetching liquidations:', error);
      throw error;
    }

    // Fetch profiles for the user_ids and all approver fields (since they reference auth.users, not profiles)
    const userIds = [...new Set(liquidations?.map((l) => l.user_id).filter(Boolean) || [])];
    const approverIds = [...new Set(liquidations?.map((l) => l.approved_by).filter(Boolean) || [])];
    const level1ApproverIds = [...new Set(liquidations?.map((l) => l.level1_approved_by).filter(Boolean) || [])];
    const level2ApproverIds = [...new Set(liquidations?.map((l) => l.level2_approved_by).filter(Boolean) || [])];
    const allProfileIds = [...new Set([...userIds, ...approverIds, ...level1ApproverIds, ...level2ApproverIds])];

    let profilesMap: Record<string, any> = {};
    if (allProfileIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          email,
          employee_id,
          position_id,
          positions:position_id (
            name
          )
        `)
        .in('id', allProfileIds);

      if (profiles) {
        profilesMap = profiles.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Attach profiles to liquidations
    const liquidationsWithProfiles = liquidations?.map((liq) => ({
      ...liq,
      profiles: liq.user_id ? profilesMap[liq.user_id] || null : null,
      approver: liq.approved_by ? profilesMap[liq.approved_by] || null : null,
      level1_approver: liq.level1_approved_by ? profilesMap[liq.level1_approved_by] || null : null,
      level2_approver: liq.level2_approved_by ? profilesMap[liq.level2_approved_by] || null : null,
    })) || [];

    return res.status(200).json({
      liquidations: liquidationsWithProfiles,
      pagination: {
        total: count || 0,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error: unknown) {
    console.error('Get liquidations error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch liquidations';
    return res.status(500).json({
      error: errorMessage,
    });
  }
}

export default withAuth(handler);
