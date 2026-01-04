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

    // Fetch stores (exclude soft-deleted)
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .is('deleted_at', null)
      .order('store_code', { ascending: true });

    if (storesError) {
      throw storesError;
    }

    // Fetch all managers
    const { data: managers, error: managersError } = await supabaseAdmin
      .from('store_managers')
      .select('store_id, manager_name');

    if (managersError) {
      throw managersError;
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

    return res.status(200).json({ stores: storesWithManagers });
  } catch (error: any) {
    console.error('Error fetching stores:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch stores' });
  }
}

export default withAuth(handler);
