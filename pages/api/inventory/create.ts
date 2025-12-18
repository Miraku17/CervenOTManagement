import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { store_id, station_id, asset_id } = req.body;
  const userId = req.user?.id;

  if (!store_id || !asset_id) {
    return res.status(400).json({ error: 'Store and Asset are required' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Create the inventory item with foreign keys and audit fields
    const { data: insertedItem, error: insertError } = await supabaseAdmin
      .from('store_inventory')
      .insert([
        {
          store_id,
          station_id: station_id || null,
          asset_id,
          created_by: userId,
        },
      ])
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Fetch the complete record
    const { data: inventoryItem, error: fetchError } = await supabaseAdmin
      .from('store_inventory')
      .select('*')
      .eq('id', insertedItem.id)
      .single();

    if (fetchError) throw fetchError;

    // Automatically update the asset status to 'In Use'
    const { error: updateError } = await supabaseAdmin
      .from('asset_inventory')
      .update({
        status: 'In Use',
        updated_by: userId
      })
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
