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

    // Fetch stores
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });

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
