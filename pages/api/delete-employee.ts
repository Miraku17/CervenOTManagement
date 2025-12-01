import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    // 1. Delete the profile from the 'profiles' table first
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', employeeId);

    if (profileError) {
      console.error('Profile deletion error:', profileError);
      throw new Error(`Failed to delete profile: ${profileError.message}`);
    }

    // 2. Delete the user from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(employeeId);

    if (authError) {
      console.error('Auth deletion error:', authError);
      throw new Error(`Failed to delete user from authentication: ${authError.message}`);
    }

    return res.status(200).json({
      message: 'Employee deleted successfully',
      employeeId
    });

  } catch (error: any) {
    console.error('Delete-employee error:', error.message);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred while deleting employee.'
    });
  }
}
