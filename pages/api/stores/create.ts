import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Check if user has manage_stores permission (Operations Manager, Tech Support Lead, Tech Support Engineer)
  const hasPermission = await userHasPermission(userId, 'manage_stores');
  if (!hasPermission) {
    return res.status(403).json({ error: 'You do not have permission to create stores' });
  }

  const { store_name, store_code, store_type, contact_no, mobile_number, store_address, city, location, group, status, managers } = req.body;

  if (!store_name || !store_code) {
    return res.status(400).json({ error: 'Store name and store code are required.' });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const storeData = {
      store_name,
      store_code,
      store_type,
      contact_no,
      mobile_number: mobile_number || null,
      store_address: store_address || null,
      city,
      location,
      group,
      status: status || 'active',
    };

    // store_code is unique across all rows, including soft-deleted ones
    const { data: existingStore, error: lookupError } = await supabaseAdmin
      .from('stores')
      .select('id, deleted_at')
      .eq('store_code', store_code)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (existingStore && !existingStore.deleted_at) {
      return res.status(409).json({ error: `A store with code "${store_code}" already exists.` });
    }

    let store;

    if (existingStore) {
      // Restore the soft-deleted store with the new details
      const { data: restoredStore, error: restoreError } = await supabaseAdmin
        .from('stores')
        .update({ ...storeData, deleted_at: null, deleted_by: null })
        .eq('id', existingStore.id)
        .select()
        .single();

      if (restoreError) {
        throw restoreError;
      }
      store = restoredStore;

      // Drop the old managers so only the ones from this form remain
      const { error: deleteManagersError } = await supabaseAdmin
        .from('store_managers')
        .delete()
        .eq('store_id', store.id);

      if (deleteManagersError) {
        throw new Error(`Failed to clear old managers: ${deleteManagersError.message}`);
      }
    } else {
      // Create the store without managers
      const { data: newStore, error: storeError } = await supabaseAdmin
        .from('stores')
        .insert([storeData])
        .select()
        .single();

      if (storeError) {
        if (storeError.code === '23505') {
          return res.status(409).json({ error: `A store with code "${store_code}" already exists.` });
        }
        throw storeError;
      }
      store = newStore;
    }

    // Insert managers into store_managers table if provided
    console.log('Managers received:', managers);
    console.log('Store ID:', store.id);

    if (managers && Array.isArray(managers) && managers.length > 0) {
      const managerRecords = managers.map((manager_name: string) => ({
        store_id: store.id,
        manager_name: manager_name.trim(),
      }));

      console.log('Manager records to insert:', managerRecords);

      const { data: insertedManagers, error: managersError } = await supabaseAdmin
        .from('store_managers')
        .insert(managerRecords)
        .select();

      if (managersError) {
        console.error('Error inserting managers:', managersError);
        console.error('Full error details:', JSON.stringify(managersError, null, 2));
        // Throw the error so user knows managers weren't saved
        throw new Error(`Failed to save managers: ${managersError.message}`);
      }

      console.log('Managers inserted successfully:', insertedManagers);
    } else {
      console.log('No managers to insert');
    }

    return res.status(201).json({ store });
  } catch (error: any) {
    console.error('Error creating store:', error);
    return res.status(500).json({ error: error.message || 'Failed to create store' });
  }
}

export default withAuth(handler);
