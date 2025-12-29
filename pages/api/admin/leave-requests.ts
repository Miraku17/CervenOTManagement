import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client not available' });
  }

  try {
    // Check if user has required position
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('position_id, positions(name)')
      .eq('id', req.user?.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    const userPosition = userProfile?.positions && (userProfile.positions as any).name;

    if (userPosition !== 'Operations Manager') {
      return res.status(403).json({
        error: 'Forbidden: Only Operations Manager can access leave requests'
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
