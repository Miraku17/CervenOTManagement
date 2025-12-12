import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { store_id, station_id, asset_id } = req.body;

  if (!store_id || !asset_id) {
    return res.status(400).json({ error: 'Store and Asset are required' });
  }

  try {

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }
    
    // Create the inventory item with foreign keys
    const { data: inventoryItem, error: insertError } = await supabaseAdmin
      .from('store_inventory')
      .insert([
        {
          store_id,
          station_id: station_id || null,
          asset_id,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    // Automatically update the asset status to 'In Use'
    const { error: updateError } = await supabaseAdmin
      .from('asset_inventory')
      .update({ status: 'In Use' })
      .eq('id', asset_id);

    if (updateError) {
      console.warn('Failed to update asset status to In Use:', updateError);
      // We don't throw here to avoid failing the main creation, but it's worth noting.
    }

    return res.status(200).json({
      message: 'Inventory item created successfully',
      item: inventoryItem,
    });
  } catch (error: any) {
    console.error('Error creating inventory item:', error);
    return res.status(500).json({ error: error.message || 'Failed to create inventory item' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
