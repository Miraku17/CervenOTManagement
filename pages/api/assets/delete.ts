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
    return res.status(400).json({ error: 'Asset ID is required' });
  }

  try {

      if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    
    // First, delete any references in store_inventory (Manual Cascade)
    const { error: storeDeleteError } = await supabaseAdmin
      .from('store_inventory')
      .delete()
      .eq('asset_id', id);

    if (storeDeleteError) {
      console.error('Error deleting associated store inventory items:', storeDeleteError);
      throw new Error('Failed to clean up store inventory associations');
    }

    // Then delete the asset itself
    const { error } = await supabaseAdmin
      .from('asset_inventory')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({ message: 'Asset deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting asset:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete asset' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
