import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id, category_id, brand_id, model_id, serial_number, under_warranty, warranty_date, status } = req.body;
  let userId = req.user?.id;

  // Debug logging
  console.log('Update - Auth user:', req.user);
  console.log('Update - User ID:', userId);

  if (!id || !category_id || !brand_id) {
    return res.status(400).json({ error: 'ID, category, and brand are required' });
  }

  if (!userId) {
    console.error('Update - No user ID found in request');
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  try {
    // Check if user has edit-only access from assets_edit_access table
    const { data: editAccess } = await supabaseAdmin
      .from('assets_edit_access')
      .select('can_edit')
      .eq('profile_id', userId)
      .single();

    const hasEditAccess = editAccess?.can_edit === true;

    // Check if user has position-based access or edit access from table
    const userPosition = req.user?.position?.toLowerCase();
    const hasPositionAccess = userPosition === 'asset' || userPosition === 'assets' || userPosition === 'operations manager';

    if (!hasPositionAccess && !hasEditAccess) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to update assets' });
    }

    const updateData = {
      category_id,
      brand_id,
      model_id: model_id || null,
      serial_number: serial_number || null,
      under_warranty: under_warranty !== undefined ? under_warranty : false,
      warranty_date: warranty_date || null,
      status: status || undefined, // Only update if provided
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };

    console.log('Updating asset with data:', updateData);

    const { error: updateError } = await supabaseAdmin
      .from('asset_inventory')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw updateError;
    }

    console.log('Asset updated, fetching complete record...');

    // Fetch the complete asset record including audit fields
    const { data: asset, error: fetchError } = await supabaseAdmin
      .from('asset_inventory')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      throw fetchError;
    }

    console.log('Asset updated with full data:', asset);

    return res.status(200).json({
      message: 'Asset updated successfully',
      asset,
    });
  } catch (error: any) {
    console.error('Error updating asset:', error);
    return res.status(500).json({ error: error.message || 'Failed to update asset' });
  }
}

export default withAuth(handler);
