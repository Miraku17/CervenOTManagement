import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Check if user has view_stores permission (all except HR and Accounting)
  const hasPermission = await userHasPermission(userId, 'view_stores');
  if (!hasPermission) {
    return res.status(403).json({ error: 'You do not have permission to view stores' });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Parse pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';

    // Calculate offset
    const offset = (page - 1) * limit;

    // Build the query for counting total
    let countQuery = supabaseAdmin
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null);

    // Build the query for fetching stores
    let storesQuery = supabaseAdmin
      .from('stores')
      .select('*')
      .is('deleted_at', null)
      .order('store_code', { ascending: true });

    // Apply search filter if provided
    if (search) {
      const searchFilter = `store_name.ilike.%${search}%,store_code.ilike.%${search}%,city.ilike.%${search}%,location.ilike.%${search}%,group.ilike.%${search}%`;
      countQuery = countQuery.or(searchFilter);
      storesQuery = storesQuery.or(searchFilter);
    }

    // Apply pagination (unless limit is very large, meaning "show all")
    if (limit < 999999) {
      storesQuery = storesQuery.range(offset, offset + limit - 1);
    }

    // Execute both queries
    const [countResult, storesResult] = await Promise.all([
      countQuery,
      storesQuery
    ]);

    if (countResult.error) {
      throw countResult.error;
    }

    if (storesResult.error) {
      throw storesResult.error;
    }

    const stores = storesResult.data || [];
    const total = countResult.count || 0;

    // Fetch all managers for the returned stores
    const storeIds = stores.map(s => s.id);
    let managers: { store_id: string; manager_name: string }[] = [];

    if (storeIds.length > 0) {
      const { data: managersData, error: managersError } = await supabaseAdmin
        .from('store_managers')
        .select('store_id, manager_name')
        .in('store_id', storeIds);

      if (managersError) {
        throw managersError;
      }
      managers = managersData || [];
    }

    // Map managers to their stores
    const storesWithManagers = stores.map(store => {
      const storeManagers = managers
        .filter(m => m.store_id === store.id)
        .map(m => m.manager_name);

      return {
        ...store,
        managers: storeManagers,
      };
    });

    return res.status(200).json({
      stores: storesWithManagers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching stores:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch stores' });
  }
}

export default withAuth(handler);
