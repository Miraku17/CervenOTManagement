import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

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
    // 1. Update profile status to 'disabled' instead of deleting
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ status: 'disabled' })
      .eq('id', employeeId);

    if (profileError) {
      console.error('Profile disable error:', profileError);
      throw new Error(`Failed to disable profile: ${profileError.message}`);
    }

    // 2. Ban the user in Supabase Auth (prevents login)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(employeeId, {
      ban_duration: '876600h' // ~100 years
    });

    if (authError) {
      console.error('Auth ban error:', authError);
      throw new Error(`Failed to disable user authentication: ${authError.message}`);
    }

    return res.status(200).json({
      message: 'Employee disabled successfully',
      employeeId
    });

  } catch (error: any) {
    console.error('Disable-employee error:', error.message);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred while disabling employee.'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
