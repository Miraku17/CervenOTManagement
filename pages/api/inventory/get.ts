import type { NextApiResponse } from 'next';
import { supabase } from '@/services/supabase';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Fetch inventory items with all related data via joins
    const { data: inventoryItems, error } = await supabase
      .from('store_inventory')
      .select(`
        id,
        serial_number,
        under_warranty,
        warranty_date,
        created_at,
        updated_at,
        stores:store_id (
          id,
          store_name,
          store_code
        ),
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
        ),
        stations:station_id (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      items: inventoryItems || [],
      count: inventoryItems?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching inventory:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch inventory' });
  }
}

export default withAuth(handler);
