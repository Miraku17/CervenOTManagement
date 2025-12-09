import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/services/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Fetch assets with all related data via joins
    const { data: assets, error } = await supabase
      .from('asset_inventory')
      .select(`
        id,
        serial_number,
        under_warranty,
        warranty_date,
        created_at,
        updated_at,
        categories:category_id (
          id,
          name
        ),
        brands:brand_id (
          id,
          name
        ),
        models:model_id (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      items: assets || [],
      count: assets?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching assets:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch assets' });
  }
}
