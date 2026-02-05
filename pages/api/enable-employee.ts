import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
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
        error: 'Forbidden: You do not have permission to enable employees'
      });
    }
    // 1. Update profile status to 'active'
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', employeeId);

    if (profileError) {
      console.error('Profile enable error:', profileError);
      throw new Error(`Failed to enable profile: ${profileError.message}`);
    }

    // 2. Unban the user in Supabase Auth (allows login)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(employeeId, {
      ban_duration: 'none'
    });

    if (authError) {
      console.error('Auth unban error:', authError);
      throw new Error(`Failed to enable user authentication: ${authError.message}`);
    }

    return res.status(200).json({
      message: 'Employee enabled successfully',
      employeeId
    });

  } catch (error: any) {
    console.error('Enable-employee error:', error.message);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred while enabling employee.'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
