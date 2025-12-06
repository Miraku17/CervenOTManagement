import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/services/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { category_id, brand_id, model_id, serial_number } = req.body;

  if (!category_id || !brand_id) {
    return res.status(400).json({ error: 'Category and brand are required' });
  }

  try {
    const { data: asset, error } = await supabase
      .from('asset_inventory')
      .insert([
        {
          category_id,
          brand_id,
          model_id: model_id || null,
          serial_number: serial_number || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      message: 'Asset created successfully',
      asset,
    });
  } catch (error: any) {
    console.error('Error creating asset:', error);
    return res.status(500).json({ error: error.message || 'Failed to create asset' });
  }
}
