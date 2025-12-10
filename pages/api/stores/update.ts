import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    res.setHeader('Allow', ['PUT', 'PATCH']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id, store_name, store_code, store_type, contact_no, city, location, group, managers } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Store ID is required.' });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Update the store without managers
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .update({
        store_name,
        store_code,
        store_type,
        contact_no,
        city,
        location,
        group,
      })
      .eq('id', id)
      .select()
      .single();

    if (storeError) {
      throw storeError;
    }

    // Delete existing managers for this store
    const { error: deleteError } = await supabaseAdmin
      .from('store_managers')
      .delete()
      .eq('store_id', id);

    if (deleteError) {
      console.error('Error deleting existing managers:', deleteError);
    }

    // Insert new managers if provided
    if (managers && Array.isArray(managers) && managers.length > 0) {
      const managerRecords = managers.map((manager_name: string) => ({
        store_id: id,
        manager_name: manager_name.trim(),
      }));

      const { error: managersError } = await supabaseAdmin
        .from('store_managers')
        .insert(managerRecords);

      if (managersError) {
        console.error('Error inserting managers:', managersError);
      }
    }

    return res.status(200).json({ store });
  } catch (error: any) {
    console.error('Error updating store:', error);
    return res.status(500).json({ error: error.message || 'Failed to update store' });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
