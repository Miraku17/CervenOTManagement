import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { category_id, brand_id, model_id, serial_number, under_warranty, warranty_date, status, store_id, ticket_id } = req.body;

  // Get user ID from the authenticated request
  let userId = req.user?.id;

  // Debug logging
  console.log('Auth user:', req.user);
  console.log('User ID:', userId);

  if (!category_id || !brand_id) {
    return res.status(400).json({ error: 'Category and brand are required' });
  }

  if (!userId) {
    console.error('No user ID found in request');
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Block edit-only users from creating assets
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  const { data: editAccess } = await supabaseAdmin
    .from('assets_edit_access')
    .select('can_edit')
    .eq('profile_id', userId)
    .single();

  const hasEditOnlyAccess = editAccess?.can_edit === true;

  if (hasEditOnlyAccess) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to create assets' });
  }

  try {

      if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Validate status
    const allowedStatuses = ['Available', 'In Use', 'Under Repair', 'Broken', 'Retired'];
    const assetStatus = status && allowedStatuses.includes(status) ? status : 'Available';

    const insertData = {
      category_id,
      brand_id,
      model_id: model_id || null,
      serial_number: serial_number || null,
      under_warranty: under_warranty || false,
      warranty_date: warranty_date || null,
      status: assetStatus,
      store_id: store_id || null,
      ticket_id: ticket_id || null,
      created_by: userId,
    };

    console.log('Inserting asset with data:', insertData);

    const { data: insertedAsset, error } = await supabaseAdmin
      .from('asset_inventory')
      .insert([insertData])
      .select('id')
      .single();

    if (error) {
      console.error('Insert error:', error);
      throw error;
    }

    console.log('Asset inserted with ID:', insertedAsset?.id);

    // Fetch the complete asset record including audit fields
    const { data: asset, error: fetchError } = await supabaseAdmin
      .from('asset_inventory')
      .select('*')
      .eq('id', insertedAsset.id)
      .single();

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      throw fetchError;
    }

    console.log('Asset created with full data:', asset);

    return res.status(201).json({
      message: 'Asset created successfully',
      asset,
    });
  } catch (error: any) {
    console.error('Error creating asset:', error);
    return res.status(500).json({ error: error.message || 'Failed to create asset' });
  }
}

export default withAuth(handler, { requirePermission: 'manage_assets' });
