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

    const { data: assets, error } = await supabaseAdmin
      .from('asset_inventory')
      .select(`
        id,
        serial_number,
        status,
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
      assets: assets || [],
      count: assets?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching assets:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch assets' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });