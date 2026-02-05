import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { employeeId } = req.body;

  if (!employeeId) {
    return res.status(400).json({ error: 'Employee ID is required.' });
  }

  try {
    // Check if user has permission to manage employee status
    const hasPermission = await userHasPermission(req.user?.id || '', 'manage_employee_status');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to block employees'
      });
    }
    // 1. Update profile status to 'disabled' (terminated) instead of deleting
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ status: 'disabled' })
      .eq('id', employeeId);

    if (profileError) {
      console.error('Profile terminate error:', profileError);
      throw new Error(`Failed to terminate profile: ${profileError.message}`);
    }

    // 2. Ban the user in Supabase Auth (prevents login)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(employeeId, {
      ban_duration: '876600h' // ~100 years
    });

    if (authError) {
      console.error('Auth ban error:', authError);
      throw new Error(`Failed to terminate user authentication: ${authError.message}`);
    }

    return res.status(200).json({
      message: 'Employee terminated successfully',
      employeeId
    });

  } catch (error: any) {
    console.error('Terminate-employee error:', error.message);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred while terminating employee.'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
