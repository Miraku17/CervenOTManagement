import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id, store_id, station_id, asset_id } = req.body;

  if (!id || !store_id || !asset_id) {
    return res.status(400).json({ error: 'ID, store, and Asset are required' });
  }

  try {

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    
    const { data: inventoryItem, error: updateError } = await supabaseAdmin
      .from('store_inventory')
      .update({
        store_id,
        station_id: station_id || null,
        asset_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

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
