import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }
    
    // Build the query
    let query = supabaseAdmin
      .from('store_inventory')
      .select(`
        id,
        created_at,
        updated_at,
        stores:store_id (
          id,
          store_name,
          store_code
        ),
        stations:station_id (
          id,
          name
        ),
        assets:asset_id (
          id,
          serial_number,
          status,
          under_warranty,
          warranty_date,
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
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters if provided
    const { store_id, station_id } = req.query;
    if (store_id) {
      query = query.eq('store_id', store_id);
    }
    if (station_id) {
      query = query.eq('station_id', station_id);
    }

    const { data: inventoryItems, error } = await query;

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

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
