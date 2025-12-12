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
    return res.status(400).json({ error: 'Inventory item ID is required' });
  }

  try {
    const { error: deleteError } = await supabaseAdmin
      .from('store_inventory')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return res.status(200).json({
      message: 'Inventory item deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting inventory item:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete inventory item' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
