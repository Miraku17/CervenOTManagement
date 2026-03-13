import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { startDate, endDate, status, type, position } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date are required' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client not available' });
  }

  try {
    // Check if user has manage_cash_flow permission
    const hasPermission = await userHasPermission(req.user?.id || '', 'manage_cash_flow');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to export cash advance requests'
      });
    }

    // Get current user's position to check if they can view confidential cash advances
    const { data: currentUserProfile } = await supabaseAdmin
      .from('profiles')
      .select('position_id, positions:position_id (name)')
      .eq('id', req.user?.id || '')
      .single();

    const currentUserPosition = (currentUserProfile?.positions as any)?.name || '';
    const isManagingDirector = currentUserPosition.toLowerCase().includes('managing director');
    const isOperationsManager = currentUserPosition === 'Operations Manager';
    const isHR = currentUserPosition === 'HR';
    const isAccounting = currentUserPosition === 'Accounting';

    console.log('Cash Advance Export - User position:', currentUserPosition, 'Is Managing Director:', isManagingDirector);

    // Get confidential position IDs to filter requests
    // MD, Operations Manager, Accounting: sees all
    // HR: sees all except Managing Director and Operations Manager
    // Others: cannot see HR, Accounting, Operations Manager requests
    let confidentialUserIds: string[] = [];
    let positionsToExclude: string[] = [];

    if (isManagingDirector || isOperationsManager || isAccounting) {
      positionsToExclude = [];
    } else if (isHR) {
      positionsToExclude = ['Managing Director', 'Operations Manager'];
    } else {
      positionsToExclude = ['HR', 'Accounting', 'Operations Manager'];
    }

    if (positionsToExclude.length > 0) {
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
        console.log('Cash Advance Export - Confidential user IDs to exclude:', confidentialUserIds);
      }
    }

    // Build query
    let query = supabaseAdmin
      .from('cash_advances')
      .select(`
        *,
        requester:profiles!cash_advances_requested_by_fkey(
          id,
          first_name,
          last_name,
          email,
          employee_id
        ),
        approved_by_user:profiles!cash_advances_approved_by_fkey(
          id,
          first_name,
          last_name
        )
      `)
      .gte('date_requested', startDate)
      .lte('date_requested', endDate)
      .is('deleted_at', null) // Exclude soft-deleted records
      .order('date_requested', { ascending: true });

    // Apply optional filters
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
          return res.status(200).json({ data: [], meta: { startDate, endDate, totalRecords: 0 } });
        }
      }
    }

    // Filter out confidential cash advances based on user's position
    if (confidentialUserIds.length > 0) {
      query = query.filter('requested_by', 'not.in', `(${confidentialUserIds.join(',')})`);
      console.log('Cash Advance Export - Applied filter to exclude confidential requests:', positionsToExclude);
    }

    const { data: cashAdvances, error } = await query;

    if (error) {
      console.error('Error fetching cash advances for export:', error);
      throw error;
    }

    // Sort by surname (last_name) alphabetically, then by first_name
    const sortedData = (cashAdvances || []).sort((a, b) => {
      const lastNameA = a.requester?.last_name || '';
      const lastNameB = b.requester?.last_name || '';
      const lastNameCompare = lastNameA.localeCompare(lastNameB);
      if (lastNameCompare !== 0) return lastNameCompare;

      const firstNameA = a.requester?.first_name || '';
      const firstNameB = b.requester?.first_name || '';
      return firstNameA.localeCompare(firstNameB);
    });

    return res.status(200).json({
      data: sortedData,
      meta: {
        startDate,
        endDate,
        totalRecords: sortedData.length,
      }
    });

  } catch (error: unknown) {
    console.error('Error exporting cash advance requests:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
