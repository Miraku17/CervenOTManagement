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

  try {
    // Check if user has permission to view stores
    const [canViewStores, canManageStores, canManageTickets, canManageInventory] = await Promise.all([
      userHasPermission(userId, 'view_stores'),
      userHasPermission(userId, 'manage_stores'),
      userHasPermission(userId, 'manage_tickets'),
      userHasPermission(userId, 'manage_store_inventory'),
    ]);

    if (!canViewStores && !canManageStores && !canManageTickets && !canManageInventory) {
      return res.status(403).json({ error: 'You do not have permission to view stores' });
    }

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const search = (req.query.q as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 50); // Max 50 results

    // Build the query
    let query = supabaseAdmin
      .from('stores')
      .select('id, store_name, store_code')
      .is('deleted_at', null)
      .order('store_name', { ascending: true })
      .limit(limit);

    // Apply search filter if provided
    if (search.trim()) {
      query = query.or(`store_name.ilike.%${search}%,store_code.ilike.%${search}%`);
    }

    const { data: stores, error } = await query;

    if (error) {
      throw error;
    }

    return res.status(200).json({ stores: stores || [] });
  } catch (error: any) {
    console.error('Error searching stores:', error);
    return res.status(500).json({ error: error.message || 'Failed to search stores' });
  }
}

export default withAuth(handler);
