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
        created_by,
        updated_by,
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
      .is('deleted_at', null) // Only fetch non-deleted assets
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch user details separately for created_by and updated_by
    const assetsWithUsers = await Promise.all(
      (assets || []).map(async (asset) => {
        let created_by_user = null;
        let updated_by_user = null;

        if (asset.created_by) {
          const { data: creator } = await supabaseAdmin
            .from('profiles')
            .select('id, first_name, last_name, email')
            .eq('id', asset.created_by)
            .single();
          created_by_user = creator;
        }

        if (asset.updated_by) {
          const { data: updater } = await supabaseAdmin
            .from('profiles')
            .select('id, first_name, last_name, email')
            .eq('id', asset.updated_by)
            .single();
          updated_by_user = updater;
        }

        return {
          ...asset,
          created_by_user,
          updated_by_user,
        };
      })
    );

    return res.status(200).json({
      assets: assetsWithUsers || [],
      count: assetsWithUsers?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching assets:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch assets' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });