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
        created_by,
        updated_by,
        serial_number,
        under_warranty,
        warranty_date,
        status,
        stores:store_id (
          id,
          store_name,
          store_code
        ),
        stations:station_id (
          id,
          name
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
        )
      `)
      .is('deleted_at', null) // Only fetch non-deleted items
      .order('created_at', { ascending: false });

    // Apply filters if provided
    const { store_id, station_id } = req.query;
    if (store_id) {
      query = query.eq('store_id', store_id);
    }
    if (station_id) {
      query = query.eq('station_id', station_id);
    }

    const { data: items, error } = await query;

    if (error) throw error;

    // Fetch user details for created_by and updated_by
    const inventoryItems = await Promise.all(
      (items || []).map(async (item) => {
        let created_by_user = null;
        let updated_by_user = null;

        if (item.created_by && supabaseAdmin) {
          const { data: creator } = await supabaseAdmin
            .from('profiles')
            .select('id, first_name, last_name, email')
            .eq('id', item.created_by)
            .single();
          created_by_user = creator;
        }

        if (item.updated_by && supabaseAdmin) {
          const { data: updater } = await supabaseAdmin
            .from('profiles')
            .select('id, first_name, last_name, email')
            .eq('id', item.updated_by)
            .single();
          updated_by_user = updater;
        }

        return {
          ...item,
          created_by_user,
          updated_by_user,
        };
      })
    );

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
