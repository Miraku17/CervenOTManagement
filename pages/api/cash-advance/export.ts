import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { startDate, endDate, status, type } = req.query;

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
