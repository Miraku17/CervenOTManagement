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

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Delete managers first (if cascade delete is not set up)
    const { error: managersError } = await supabaseAdmin
      .from('store_managers')
      .delete()
      .eq('store_id', id);

    if (managersError) {
      console.error('Error deleting managers:', managersError);
      // Continue anyway as the store deletion might cascade
    }

    // Delete the store
    const { error } = await supabaseAdmin
      .from('stores')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return res.status(200).json({ message: 'Store deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting store:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete store' });
  }
}

export default withAuth(handler, { requireRole: 'admin', requirePosition: 'Operations Manager' });
