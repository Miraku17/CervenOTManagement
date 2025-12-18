import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Store ID is required.' });
  }

  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Soft delete the store
    const { error } = await supabaseAdmin
      .from('stores')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', id)
      .is('deleted_at', null); // Only soft delete if not already deleted

    if (error) {
      throw error;
    }

    return res.status(200).json({ message: 'Store deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting store:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete store' });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
