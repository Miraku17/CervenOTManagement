import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const {
    id,
    store_id,
    station_id,
    category_id,
    brand_id,
    model_id,
    serial_number,
    under_warranty,
    warranty_date,
    status
  } = req.body;
  const userId = req.user?.id || '';
  const userPosition = req.user?.position;

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  // Check if user has edit-only access from store_inventory_edit_access table
  const { data: editAccess, error: editAccessError } = await supabaseAdmin
    .from('store_inventory_edit_access')
    .select('can_edit')
    .eq('profile_id', userId)
    .maybeSingle();

  const hasEditAccess = editAccess?.can_edit === true;

  // Check if user has manage_store_inventory permission
  const hasManagePermission = await userHasPermission(userId, 'manage_store_inventory');

  // Field Engineers need explicit edit access
  if (userPosition === 'Field Engineer' && !hasEditAccess && !hasManagePermission) {
    return res.status(403).json({ error: 'Forbidden: Read-only access for Field Engineers without edit permission' });
  }

  // User must have either manage permission or edit access
  if (!hasManagePermission && !hasEditAccess) {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to update store inventory items'
    });
  }

  if (!id || !store_id) {
    return res.status(400).json({ error: 'ID and store are required' });
  }

  if (!station_id) {
    return res.status(400).json({ error: 'Station is required' });
  }

  if (!serial_number) {
    return res.status(400).json({ error: 'Serial number is required' });
  }

  if (!category_id || !brand_id || !model_id) {
    return res.status(400).json({ error: 'Category, Brand, and Model are required' });
  }

  if (status && !['temporary', 'permanent'].includes(status)) {
    return res.status(400).json({ error: 'Status must be either "temporary" or "permanent"' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const updateData: any = {
      store_id,
      station_id,
      category_id,
      brand_id,
      model_id,
      serial_number,
      under_warranty: under_warranty || false,
      warranty_date: warranty_date || null,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };

    // Only update status if provided
    if (status) {
      updateData.status = status;
    }

    const { error: updateError } = await supabaseAdmin
      .from('store_inventory')
      .update(updateData)
      .eq('id', id);

    if (updateError) throw updateError;

    // Fetch the complete record
    const { data: inventoryItem, error: fetchError } = await supabaseAdmin
      .from('store_inventory')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    return res.status(200).json({
      message: 'Inventory item updated successfully',
      item: inventoryItem,
    });
  } catch (error: any) {
    console.error('Error updating inventory item:', error);
    return res.status(500).json({ error: error.message || 'Failed to update inventory item' });
  }
}

export default withAuth(handler);
