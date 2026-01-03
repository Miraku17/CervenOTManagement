import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client not available' });
  }

  try {
    // Check if user has view_leave permission
    const hasPermission = await userHasPermission(req.user?.id || '', 'view_leave');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to view leave requests'
      });
    }

    const { data, error } = await supabaseAdmin
      .from('leave_requests')
      .select(`
        *,
        employee:employee_id (
          id,
          first_name,
          last_name,
          email
        ),
        reviewer:reviewer_id (
          first_name,
          last_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.status(200).json({ data });
  } catch (error: any) {
    console.error('Error fetching leave requests:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch leave requests' });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
