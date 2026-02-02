import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Security Check: Verify user has permission to manage employee credentials
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const hasPermission = await userHasPermission(req.user.id, 'manage_employee_credentials');
  if (!hasPermission) {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to update passwords.'
    });
  }

  const { userId, newPassword } = req.body;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (!newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'New password is required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    // Use Supabase Admin API to update user password
    const { data, error } = await supabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) {
      console.error('Error updating password:', error);
      throw error;
    }

    return res.status(200).json({
      message: 'Password updated successfully',
      user: data.user
    });

  } catch (error: any) {
    console.error('Update password error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to update password'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
