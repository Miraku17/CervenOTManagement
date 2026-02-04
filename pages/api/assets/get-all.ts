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

    // Fetch ALL assets (including soft-deleted) using pagination
    let allAssets: any[] = [];
    const PAGE_SIZE = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
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
          deleted_at,
          created_by,
          updated_by,
          deleted_by,
          store_id,
          ticket_id,
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
        .order('updated_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      if (assets && assets.length > 0) {
        allAssets = [...allAssets, ...assets];
        if (assets.length < PAGE_SIZE) {
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
    allAssets.forEach(asset => {
      if (asset.created_by) userIds.add(asset.created_by);
      if (asset.updated_by) userIds.add(asset.updated_by);
      if (asset.deleted_by) userIds.add(asset.deleted_by);
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

    // Collect all store IDs and ticket IDs for batch fetching
    const storeIds = allAssets
      .map(asset => asset.store_id)
      .filter(Boolean);

    const ticketIds = allAssets
      .map(asset => asset.ticket_id)
      .filter(Boolean);

    // Fetch stores data in batch
    const storesMap = new Map();
    if (storeIds.length > 0 && supabaseAdmin) {
      const { data: storeData, error: storeError } = await supabaseAdmin
        .from('stores')
        .select(`
          id,
          store_name,
          store_code
        `)
        .in('id', storeIds)
        .is('deleted_at', null);

      if (!storeError && storeData) {
        storeData.forEach(store => {
          storesMap.set(store.id, {
            store_name: store.store_name,
            store_code: store.store_code,
            station_name: null
          });
        });
      }
    }

    // Fetch ticket data in batch
    const ticketsMap = new Map();
    if (ticketIds.length > 0 && supabaseAdmin) {
      const { data: ticketData, error: ticketError } = await supabaseAdmin
        .from('tickets')
        .select(`
          id,
          rcc_reference_number,
          status,
          request_type,
          severity:sev
        `)
        .in('id', ticketIds);

      if (!ticketError && ticketData) {
        ticketData.forEach(ticket => {
          ticketsMap.set(ticket.id, {
            id: ticket.id,
            rcc_reference_number: ticket.rcc_reference_number,
            status: ticket.status,
            request_type: ticket.request_type,
            severity: ticket.severity
          });
        });
      }
    }

    // Attach user details, store info, and ticket info
    const assetsWithUsers = allAssets.map((asset) => ({
      ...asset,
      created_by_user: asset.created_by ? profilesMap.get(asset.created_by) || null : null,
      updated_by_user: asset.updated_by ? profilesMap.get(asset.updated_by) || null : null,
      deleted_by_user: asset.deleted_by ? profilesMap.get(asset.deleted_by) || null : null,
      store_info: asset.store_id ? storesMap.get(asset.store_id) || null : null,
      ticket_info: asset.ticket_id ? ticketsMap.get(asset.ticket_id) || null : null,
    }));

    return res.status(200).json({
      assets: assetsWithUsers || [],
      count: assetsWithUsers?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching all assets:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch all assets' });
  }
}

export default withAuth(handler, { requirePermission: 'manage_assets' });
