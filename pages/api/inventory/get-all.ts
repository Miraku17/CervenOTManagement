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

    // Fetch ALL store inventory items (including soft-deleted)
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
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch user details for created_by, updated_by, and deleted_by
    const inventoryItems = await Promise.all(
      (items || []).map(async (item) => {
        let created_by_user = null;
        let updated_by_user = null;
        let deleted_by_user = null;

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

        if (item.deleted_by && supabaseAdmin) {
          const { data: deleter } = await supabaseAdmin
            .from('profiles')
            .select('id, first_name, last_name, email')
            .eq('id', item.deleted_by)
            .single();
          deleted_by_user = deleter;
        }

        return {
          ...item,
          created_by_user,
          updated_by_user,
          deleted_by_user,
        };
      })
    );

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
