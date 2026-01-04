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

    // Create the store without managers
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .insert([
        {
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
        },
      ])
      .select()
      .single();

    if (storeError) {
      throw storeError;
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
