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

    const userId = req.user?.id || '';

    // Check if user has manage_store_inventory permission
    let hasManageStoreInventory = await userHasPermission(userId, 'manage_store_inventory');
    let hasEditAccess = false;

    // If no manage permission, check for edit-only access
    if (!hasManageStoreInventory) {
      const { data: editAccess } = await supabaseAdmin
        .from('store_inventory_edit_access')
        .select('can_edit')
        .eq('profile_id', userId)
        .maybeSingle();
      hasEditAccess = editAccess?.can_edit === true;
    }

    // If user has neither manage nor edit access, deny
    if (!hasManageStoreInventory && !hasEditAccess) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to access store inventory'
      });
    }

    // Get pagination and search parameters from query
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const searchTerm = (req.query.search as string) || '';
    
    // Filter parameters
    const categoryFilter = (req.query.category as string) || '';
    const storeFilter = (req.query.store as string) || '';
    const brandFilter = (req.query.brand as string) || '';
    const serialStatusFilter = (req.query.serial_status as string) || 'all'; // 'all', 'with', 'without'

    // Calculate stats from total inventory (always constant, ignores filters)
    const { count: totalItems } = await supabaseAdmin
      .from('store_inventory')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    // Get unique categories count
    const { data: categoriesData } = await supabaseAdmin
      .from('store_inventory')
      .select('category_id')
      .is('deleted_at', null)
      .not('category_id', 'is', null);

    const uniqueCategories = new Set(categoriesData?.map((item: any) => item.category_id)).size;

    // Get unique stores count
    const { data: storesData } = await supabaseAdmin
      .from('store_inventory')
      .select('store_id')
      .is('deleted_at', null)
      .not('store_id', 'is', null);

    const uniqueStores = new Set(storesData?.map((item: any) => item.store_id)).size;

    const stats = {
      totalItems: totalItems || 0,
      uniqueCategories,
      uniqueStores,
    };

    // Build filtered query
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
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(0, 99999); // Override Supabase's default 1000 row limit

    // Apply filters at database level where possible
    // Note: Supabase doesn't support filtering on nested relations directly,
    // so we need to filter in memory for some fields

    // Fetch filtered items
    const { data: allFilteredItems, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    // Apply additional filters in memory (for nested relation fields)
    let filteredItems = allFilteredItems || [];

    if (categoryFilter) {
      filteredItems = filteredItems.filter((item: any) => {
        const categoryName = Array.isArray(item.categories) ? item.categories[0]?.name : item.categories?.name;
        return categoryName === categoryFilter;
      });
    }
    if (storeFilter) {
      filteredItems = filteredItems.filter((item: any) => {
        const storeName = Array.isArray(item.stores) ? item.stores[0]?.store_name : item.stores?.store_name;
        return storeName === storeFilter;
      });
    }
    if (brandFilter) {
      filteredItems = filteredItems.filter((item: any) => {
        const brandName = Array.isArray(item.brands) ? item.brands[0]?.name : item.brands?.name;
        return brandName === brandFilter;
      });
    }

    if (serialStatusFilter === 'with') {
      filteredItems = filteredItems.filter((item: any) => !!item.serial_number);
    } else if (serialStatusFilter === 'without') {
      filteredItems = filteredItems.filter((item: any) => !item.serial_number);
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredItems = filteredItems.filter((item: any) => {
        const categoryName = Array.isArray(item.categories) ? item.categories[0]?.name : item.categories?.name;
        const brandName = Array.isArray(item.brands) ? item.brands[0]?.name : item.brands?.name;
        const modelName = Array.isArray(item.models) ? item.models[0]?.name : item.models?.name;
        const storeName = Array.isArray(item.stores) ? item.stores[0]?.store_name : item.stores?.store_name;
        const storeCode = Array.isArray(item.stores) ? item.stores[0]?.store_code : item.stores?.store_code;
        const stationName = Array.isArray(item.stations) ? item.stations[0]?.name : item.stations?.name;

        return (
          item.serial_number?.toLowerCase().includes(searchLower) ||
          categoryName?.toLowerCase().includes(searchLower) ||
          brandName?.toLowerCase().includes(searchLower) ||
          modelName?.toLowerCase().includes(searchLower) ||
          storeName?.toLowerCase().includes(searchLower) ||
          storeCode?.toLowerCase().includes(searchLower) ||
          stationName?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply pagination
    const totalCount = filteredItems.length;
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginatedItems = filteredItems.slice(from, to);

    // Fetch user details for the paginated items
    const inventoryItems = await Promise.all(
      (paginatedItems || []).map(async (item) => {
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

    return res.status(200).json({
      items: inventoryItems || [],
      stats,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
      hasEditAccess: hasEditAccess || hasManageStoreInventory,
      isEditOnly: hasEditAccess && !hasManageStoreInventory,
    });
  } catch (error: any) {
    console.error('Error fetching inventory:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch inventory' });
  }
}

export default withAuth(handler);
