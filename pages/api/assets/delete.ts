import type { NextApiResponse } from 'next';
import { supabase } from '@/services/supabase';
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
    const { error } = await supabase
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

export default withAuth(handler, { requireRole: 'admin' });
