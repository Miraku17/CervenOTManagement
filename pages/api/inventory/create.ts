import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/services/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { store_id, category_id, brand_id, model_id, serial_number, station_id } = req.body;

  if (!store_id || !category_id || !brand_id) {
    return res.status(400).json({ error: 'Store, category, and brand are required' });
  }

  try {
    // Create the inventory item with foreign keys
    const { data: inventoryItem, error: insertError } = await supabase
      .from('store_inventory')
      .insert([
        {
          store_id,
          category_id,
          brand_id,
          model_id: model_id || null,
          serial_number: serial_number || null,
          station_id: station_id || null,
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(200).json({
      message: 'Inventory item created successfully',
      item: inventoryItem,
    });
  } catch (error: any) {
    console.error('Error creating inventory item:', error);
    return res.status(500).json({ error: error.message || 'Failed to create inventory item' });
  }
}
