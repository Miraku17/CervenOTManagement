import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check permissions
    const hasManageAssets = await userHasPermission(userId, 'manage_assets');

    // Check edit access
    let hasEditAccess = false;
    if (!hasManageAssets) {
      const { data: editAccess } = await supabaseAdmin
        .from('assets_edit_access')
        .select('can_edit')
        .eq('profile_id', userId)
        .single();
      hasEditAccess = editAccess?.can_edit === true;
    }

    if (!hasManageAssets && !hasEditAccess) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view assets' });
    }

    // Get pagination and search parameters from query
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const searchTerm = (req.query.search as string) || '';
    const statusFilter = (req.query.status as string) || '';
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Get stats (count all assets, not just current page)
    const { data: allAssets, error: statsError } = await supabaseAdmin
      .from('asset_inventory')
      .select('serial_number, category_id')
      .is('deleted_at', null);

    if (statsError) throw statsError;

    const stats = {
      totalAssets: allAssets?.length || 0,
      withSerialNumber: allAssets?.filter(a => a.serial_number).length || 0,
      uniqueCategories: new Set(allAssets?.map(a => a.category_id).filter(Boolean)).size || 0,
    };

    // Fetch all assets with joined data (we'll filter in memory for search)
    const { data: allAssetsWithDetails, error: fetchError } = await supabaseAdmin
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
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;

    // Filter assets based on search term (search across all fields) and status
    let filteredAssets = allAssetsWithDetails || [];
    
    // Apply status filter
    if (statusFilter && statusFilter !== 'All') {
      filteredAssets = filteredAssets.filter((asset: any) => asset.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredAssets = filteredAssets.filter((asset: any) => {
        return (
          asset.serial_number?.toLowerCase().includes(searchLower) ||
          asset.categories?.name?.toLowerCase().includes(searchLower) ||
          asset.brands?.name?.toLowerCase().includes(searchLower) ||
          asset.models?.name?.toLowerCase().includes(searchLower) ||
          asset.status?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply pagination to filtered results
    const totalCount = filteredAssets.length;
    const assets = filteredAssets.slice(from, to + 1);

    // Fetch user details separately for created_by and updated_by
    const assetsWithUsers = await Promise.all(
      (assets || []).map(async (asset) => {
        let created_by_user = null;
        let updated_by_user = null;

        if (asset.created_by && supabaseAdmin) {
          const { data: creator } = await supabaseAdmin
            .from('profiles')
            .select('id, first_name, last_name, email')
            .eq('id', asset.created_by)
            .single();
          created_by_user = creator;
        }

        if (asset.updated_by && supabaseAdmin) {
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
      stats,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching assets:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch assets' });
  }
}

export default withAuth(handler);