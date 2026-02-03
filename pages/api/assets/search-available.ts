import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { q, limit = 50 } = req.query;

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Search for available assets only
    let query = supabaseAdmin
      .from('asset_inventory')
      .select(`
        id,
        serial_number,
        status,
        under_warranty,
        warranty_date,
        categories:category_id (id, name),
        brands:brand_id (id, name),
        models:model_id (id, name)
      `)
      .eq('status', 'Available')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    // If search query provided, filter by serial number, category, brand, or model
    if (q && typeof q === 'string' && q.trim()) {
      const searchTerm = q.trim().toLowerCase();

      // Get all available assets first, then filter in memory for related fields
      const { data: allAssets, error } = await query;

      if (error) throw error;

      // Filter assets based on search term matching serial number, category, brand, or model
      const filteredAssets = allAssets?.filter((asset: any) => {
        const serialMatch = asset.serial_number?.toLowerCase().includes(searchTerm);
        const categoryMatch = asset.categories?.name?.toLowerCase().includes(searchTerm);
        const brandMatch = asset.brands?.name?.toLowerCase().includes(searchTerm);
        const modelMatch = asset.models?.name?.toLowerCase().includes(searchTerm);

        return serialMatch || categoryMatch || brandMatch || modelMatch;
      }) || [];

      return res.status(200).json({
        assets: filteredAssets.slice(0, parseInt(limit as string)),
      });
    }

    const { data: assets, error } = await query;

    if (error) throw error;

    return res.status(200).json({
      assets: assets || [],
    });
  } catch (error: any) {
    console.error('Error searching available assets:', error);
    return res.status(500).json({ error: error.message || 'Failed to search available assets' });
  }
}

export default withAuth(handler, { requirePermission: 'manage_store_inventory' });
