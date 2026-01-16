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

    // Calculate stats from total inventory (always constant, ignores filters)
    const { count: totalItems } = await supabaseAdmin
      .from('store_inventory')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    // Get unique categories count (Total available categories)
    const { count: uniqueCategories } = await supabaseAdmin
      .from('categories')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    // Get unique stores count (only stores that have inventory items)
    // Use pagination to ensure we get all items
    const uniqueStoreIds = new Set<string>();
    let storeIdPage = 0;
    let hasMoreStoreIds = true;
    const STORE_PAGE_SIZE = 1000;

    while (hasMoreStoreIds) {
      const { data: storeInventoryItems } = await supabaseAdmin
        .from('store_inventory')
        .select('store_id')
        .is('deleted_at', null)
        .range(storeIdPage * STORE_PAGE_SIZE, (storeIdPage + 1) * STORE_PAGE_SIZE - 1);

      if (storeInventoryItems && storeInventoryItems.length > 0) {
        storeInventoryItems.forEach(item => {
          if (item.store_id) {
            uniqueStoreIds.add(item.store_id);
          }
        });

        if (storeInventoryItems.length < STORE_PAGE_SIZE) {
          hasMoreStoreIds = false;
        } else {
          storeIdPage++;
        }
      } else {
        hasMoreStoreIds = false;
      }
    }

    const uniqueStores = uniqueStoreIds.size;

    const stats = {
      totalItems: totalItems || 0,
      uniqueCategories,
      uniqueStores,
    };

    // Build filtered query - fetch all items in batches to avoid the 1000 row limit
    // We need to fetch all data because filtering happens in memory (nested relations)
    let allFilteredItems: any[] = [];
    let fetchError = null;
    let rangeStart = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
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
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Filter by store_id directly in query (more efficient)
      if (storeIdFilter) {
        query = query.eq('store_id', storeIdFilter);
      }

      const { data, error } = await query.range(rangeStart, rangeStart + batchSize - 1);

      if (error) {
        fetchError = error;
        break;
      }

      if (data && data.length > 0) {
        allFilteredItems = [...allFilteredItems, ...data];
        rangeStart += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

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

    // Extract filter options from all items
    const categories = Array.from(
      new Set(
        allFilteredItems
          .map((item: any) => {
            const categoryName = Array.isArray(item.categories)
              ? item.categories[0]?.name
              : item.categories?.name;
            return categoryName;
          })
          .filter(Boolean)
      )
    ).sort();

    const stores = Array.from(
      new Set(
        allFilteredItems
          .map((item: any) => {
            const storeName = Array.isArray(item.stores)
              ? item.stores[0]?.store_name
              : item.stores?.store_name;
            return storeName;
          })
          .filter(Boolean)
      )
    ).sort();

    const brands = Array.from(
      new Set(
        allFilteredItems
          .map((item: any) => {
            const brandName = Array.isArray(item.brands)
              ? item.brands[0]?.name
              : item.brands?.name;
            return brandName;
          })
          .filter(Boolean)
      )
    ).sort();

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
