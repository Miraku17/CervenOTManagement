import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user has import_schedule permission (same as schedule import)
    const hasPermission = await userHasPermission(userId, 'import_schedule');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to delete holidays' });
    }

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Holiday ID is required' });
    }

    // Soft delete by setting deleted_at timestamp
    const { error } = await supabaseAdmin
      .from('holidays')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      throw error;
    }

    return res.status(200).json({ message: 'Holiday deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting holiday:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete holiday' });
  }
}

export default withAuth(handler);
