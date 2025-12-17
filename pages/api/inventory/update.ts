import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id, store_id, station_id, asset_id } = req.body;
  const userId = req.user?.id;

  if (!id || !store_id || !asset_id) {
    return res.status(400).json({ error: 'ID, store, and Asset are required' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }


    const { error: updateError } = await supabaseAdmin
      .from('store_inventory')
      .update({
        store_id,
        station_id: station_id || null,
        asset_id,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Fetch the complete record
    const { data: inventoryItem, error: fetchError } = await supabaseAdmin
      .from('store_inventory')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    return res.status(200).json({
      message: 'Inventory item updated successfully',
      item: inventoryItem,
    });
  } catch (error: any) {
    console.error('Error updating inventory item:', error);
    return res.status(500).json({ error: error.message || 'Failed to update inventory item' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
