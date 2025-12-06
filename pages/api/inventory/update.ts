import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/services/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id, store_id, category_id, brand_id, model_id, serial_number, station_id } = req.body;

  if (!id || !store_id || !category_id || !brand_id) {
    return res.status(400).json({ error: 'ID, store, category, and brand are required' });
  }

  try {
    const { data: inventoryItem, error: updateError } = await supabase
      .from('store_inventory')
      .update({
        store_id,
        category_id,
        brand_id,
        model_id: model_id || null,
        serial_number: serial_number || null,
        station_id: station_id || null,
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
