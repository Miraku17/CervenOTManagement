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
    const userPosition = req.user?.position;

    // Check if user has manage_store_inventory permission
    const hasManageStoreInventory = await userHasPermission(userId, 'manage_store_inventory');
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

    // Field Engineers need explicit edit access
    if (userPosition === 'Field Engineer' && !hasEditAccess && !hasManageStoreInventory) {
      return res.status(403).json({ error: 'Forbidden: Access denied for Field Engineers without edit permission' });
    }

    // If user has neither manage nor edit access, deny
    if (!hasManageStoreInventory && !hasEditAccess) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to access store inventory'
      });
    }

    // Fetch ALL store inventory items (including soft-deleted) using pagination
    let allItems: any[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: items, error } = await supabaseAdmin
        .from('store_inventory')
        .select(`
          id,
          created_at,
          updated_at,
          deleted_at,
          created_by,
          updated_by,
          deleted_by,
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
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      if (items && items.length > 0) {
        allItems = [...allItems, ...items];
        if (items.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    // Collect all unique user IDs
    const userIds = new Set<string>();
    allItems.forEach(item => {
      if (item.created_by) userIds.add(item.created_by);
      if (item.updated_by) userIds.add(item.updated_by);
      if (item.deleted_by) userIds.add(item.deleted_by);
    });

    // Fetch user profiles in batch
    const profilesMap = new Map();
    if (userIds.size > 0 && supabaseAdmin) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', Array.from(userIds));
      
      if (!profilesError && profiles) {
        profiles.forEach(profile => {
          profilesMap.set(profile.id, profile);
        });
      }
    }

    // Attach user details
    const inventoryItems = allItems.map((item) => ({
      ...item,
      created_by_user: item.created_by ? profilesMap.get(item.created_by) || null : null,
      updated_by_user: item.updated_by ? profilesMap.get(item.updated_by) || null : null,
      deleted_by_user: item.deleted_by ? profilesMap.get(item.deleted_by) || null : null,
    }));

    return res.status(200).json({
      items: inventoryItems || [],
      count: inventoryItems?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching all inventory:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch all inventory' });
  }
}

export default withAuth(handler);
