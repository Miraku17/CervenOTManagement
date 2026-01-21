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
    const storeIdFilter = (req.query.store_id as string) || '';
    const brandFilter = (req.query.brand as string) || '';

    // Fetch stats in parallel for better performance
    const [totalItemsResult, uniqueCategoriesResult, uniqueStoresResult] = await Promise.all([
      // Total items count
      supabaseAdmin
        .from('store_inventory')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null),
      // Unique categories count
      supabaseAdmin
        .from('categories')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null),
      // Unique stores count (stores with inventory items)
      supabaseAdmin
        .from('store_inventory')
        .select('store_id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .not('store_id', 'is', null)
    ]);

    // Get actual unique store count with a more efficient query
    const { data: uniqueStoreData } = await supabaseAdmin
      .rpc('count_unique_stores_with_inventory');

    // Fallback if RPC doesn't exist
    let uniqueStores = 0;
    if (uniqueStoreData !== null && uniqueStoreData !== undefined) {
      uniqueStores = uniqueStoreData;
    } else {
      // Fallback: use a simple distinct query
      const { data: storeIds } = await supabaseAdmin
        .from('store_inventory')
        .select('store_id')
        .is('deleted_at', null)
        .not('store_id', 'is', null)
        .limit(10000);

      if (storeIds) {
        const uniqueSet = new Set(storeIds.map(s => s.store_id));
        uniqueStores = uniqueSet.size;
      }
    }

    const stats = {
      totalItems: totalItemsResult.count || 0,
      uniqueCategories: uniqueCategoriesResult.count || 0,
      uniqueStores,
    };

    // Build the main query with filters applied at database level
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
        ),
        created_by_user:created_by (
          id,
          first_name,
          last_name,
          email
        ),
        updated_by_user:updated_by (
          id,
          first_name,
          last_name,
          email
        )
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Apply store_id filter directly
    if (storeIdFilter) {
      query = query.eq('store_id', storeIdFilter);
    }

    // For text search on related tables, we need to use or() with ilike
    // But Supabase doesn't support ilike on joined tables directly
    // So we'll use a different approach - filter by IDs

    // Get category ID if filter is set
    if (categoryFilter) {
      const { data: categoryData } = await supabaseAdmin
        .from('categories')
        .select('id')
        .eq('name', categoryFilter)
        .single();

      if (categoryData) {
        query = query.eq('category_id', categoryData.id);
      } else {
        // No matching category, return empty
        return res.status(200).json({
          items: [],
          stats,
          pagination: { currentPage: page, pageSize: limit, totalCount: 0, totalPages: 0 },
          filterOptions: { categories: [], stores: [], brands: [] },
          hasEditAccess: hasEditAccess || hasManageStoreInventory,
          isEditOnly: hasEditAccess && !hasManageStoreInventory,
        });
      }
    }

    // Get store ID if filter is set (store filter is by store_code)
    if (storeFilter) {
      const { data: storeData } = await supabaseAdmin
        .from('stores')
        .select('id')
        .eq('store_code', storeFilter)
        .single();

      if (storeData) {
        query = query.eq('store_id', storeData.id);
      } else {
        return res.status(200).json({
          items: [],
          stats,
          pagination: { currentPage: page, pageSize: limit, totalCount: 0, totalPages: 0 },
          filterOptions: { categories: [], stores: [], brands: [] },
          hasEditAccess: hasEditAccess || hasManageStoreInventory,
          isEditOnly: hasEditAccess && !hasManageStoreInventory,
        });
      }
    }

    // Get brand ID if filter is set
    if (brandFilter) {
      const { data: brandData } = await supabaseAdmin
        .from('brands')
        .select('id')
        .eq('name', brandFilter)
        .single();

      if (brandData) {
        query = query.eq('brand_id', brandData.id);
      } else {
        return res.status(200).json({
          items: [],
          stats,
          pagination: { currentPage: page, pageSize: limit, totalCount: 0, totalPages: 0 },
          filterOptions: { categories: [], stores: [], brands: [] },
          hasEditAccess: hasEditAccess || hasManageStoreInventory,
          isEditOnly: hasEditAccess && !hasManageStoreInventory,
        });
      }
    }

    // Handle text search - need to search across multiple fields
    if (searchTerm) {
      // Get matching IDs from related tables
      const [categoryIds, brandIds, modelIds, storeIds, stationIds] = await Promise.all([
        supabaseAdmin
          .from('categories')
          .select('id')
          .ilike('name', `%${searchTerm}%`)
          .then(r => r.data?.map(c => c.id) || []),
        supabaseAdmin
          .from('brands')
          .select('id')
          .ilike('name', `%${searchTerm}%`)
          .then(r => r.data?.map(b => b.id) || []),
        supabaseAdmin
          .from('models')
          .select('id')
          .ilike('name', `%${searchTerm}%`)
          .then(r => r.data?.map(m => m.id) || []),
        supabaseAdmin
          .from('stores')
          .select('id')
          .or(`store_name.ilike.%${searchTerm}%,store_code.ilike.%${searchTerm}%`)
          .then(r => r.data?.map(s => s.id) || []),
        supabaseAdmin
          .from('stations')
          .select('id')
          .ilike('name', `%${searchTerm}%`)
          .then(r => r.data?.map(s => s.id) || []),
      ]);

      // Build OR conditions for the search
      const orConditions: string[] = [];

      // Search in serial_number directly
      orConditions.push(`serial_number.ilike.%${searchTerm}%`);

      // Add ID-based filters for related tables
      if (categoryIds.length > 0) {
        orConditions.push(`category_id.in.(${categoryIds.join(',')})`);
      }
      if (brandIds.length > 0) {
        orConditions.push(`brand_id.in.(${brandIds.join(',')})`);
      }
      if (modelIds.length > 0) {
        orConditions.push(`model_id.in.(${modelIds.join(',')})`);
      }
      if (storeIds.length > 0) {
        orConditions.push(`store_id.in.(${storeIds.join(',')})`);
      }
      if (stationIds.length > 0) {
        orConditions.push(`station_id.in.(${stationIds.join(',')})`);
      }

      if (orConditions.length > 0) {
        query = query.or(orConditions.join(','));
      }
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: inventoryItems, error: fetchError, count: totalCount } = await query.range(from, to);

    if (fetchError) throw fetchError;

    // Fetch filter options efficiently (only distinct values)
    const [categoriesResult, storesResult, brandsResult] = await Promise.all([
      supabaseAdmin
        .from('store_inventory')
        .select('categories:category_id(name)')
        .is('deleted_at', null)
        .not('category_id', 'is', null)
        .limit(1000),
      supabaseAdmin
        .from('store_inventory')
        .select('stores:store_id(store_code)')
        .is('deleted_at', null)
        .not('store_id', 'is', null)
        .limit(1000),
      supabaseAdmin
        .from('store_inventory')
        .select('brands:brand_id(name)')
        .is('deleted_at', null)
        .not('brand_id', 'is', null)
        .limit(1000),
    ]);

    const categories = Array.from(
      new Set(
        (categoriesResult.data || [])
          .map((item: any) => {
            const cat = Array.isArray(item.categories) ? item.categories[0] : item.categories;
            return cat?.name;
          })
          .filter(Boolean)
      )
    ).sort() as string[];

    const stores = Array.from(
      new Set(
        (storesResult.data || [])
          .map((item: any) => {
            const store = Array.isArray(item.stores) ? item.stores[0] : item.stores;
            return store?.store_code;
          })
          .filter(Boolean)
      )
    ).sort() as string[];

    const brands = Array.from(
      new Set(
        (brandsResult.data || [])
          .map((item: any) => {
            const brand = Array.isArray(item.brands) ? item.brands[0] : item.brands;
            return brand?.name;
          })
          .filter(Boolean)
      )
    ).sort() as string[];

    return res.status(200).json({
      items: inventoryItems || [],
      stats,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
      filterOptions: {
        categories,
        stores,
        brands,
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
