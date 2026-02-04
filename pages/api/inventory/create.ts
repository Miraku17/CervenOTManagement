import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const {
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
  const { data: editAccess } = await supabaseAdmin
    .from('store_inventory_edit_access')
    .select('can_edit')
    .eq('profile_id', userId)
    .maybeSingle();

  const hasEditAccess = editAccess?.can_edit === true;

  // Check if user has manage_store_inventory permission
  const hasManagePermission = await userHasPermission(userId, 'manage_store_inventory');

  // Field Engineers CANNOT create items (only view and update)
  if (userPosition === 'Field Engineer') {
    return res.status(403).json({
      error: 'Forbidden: Field Engineers can only view and update inventory items, not create new ones'
    });
  }

  // User must have either manage permission or edit access
  if (!hasManagePermission && !hasEditAccess) {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to create store inventory items'
    });
  }

  if (!store_id) {
    return res.status(400).json({ error: 'Store is required' });
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

  if (!status || !['temporary', 'permanent'].includes(status)) {
    return res.status(400).json({ error: 'Status must be either "temporary" or "permanent"' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    // Check if asset exists in asset_inventory, create if it doesn't
    if (serial_number) {
      const { data: existingAsset } = await supabaseAdmin
        .from('asset_inventory')
        .select('id, status')
        .ilike('serial_number', serial_number.trim())
        .maybeSingle();

      if (existingAsset) {
        // Asset exists - update store_id to link it to this store
        await supabaseAdmin
          .from('asset_inventory')
          .update({
            store_id: store_id,
            status: 'Available',
            updated_by: userId,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAsset.id);

        console.log(`Linked asset ${existingAsset.id} (Serial: ${serial_number}) to store ${store_id} with status "Available"`);
      } else {
        // Asset doesn't exist - create it automatically
        const { data: newAsset, error: createAssetError } = await supabaseAdmin
          .from('asset_inventory')
          .insert({
            category_id,
            brand_id,
            model_id,
            serial_number: serial_number.trim(),
            under_warranty: under_warranty || false,
            warranty_date: warranty_date || null,
            status: 'Available', // Set to "Available" since it's in store inventory
            store_id: store_id, // Link to the store
            created_by: userId,
          })
          .select('id')
          .single();

        if (createAssetError) {
          console.error('Error auto-creating asset:', createAssetError);
          throw new Error(`Failed to create asset in inventory: ${createAssetError.message}`);
        }

        console.log(`Auto-created asset ${newAsset?.id} (Serial: ${serial_number}) linked to store ${store_id} with status "Available"`);
      }
    }

    // Create the inventory item with foreign keys and audit fields
    const { data: insertedItem, error: insertError } = await supabaseAdmin
      .from('store_inventory')
      .insert([
        {
          store_id,
          station_id,
          category_id,
          brand_id,
          model_id,
          serial_number,
          under_warranty: under_warranty || false,
          warranty_date: warranty_date || null,
          status: status,
          created_by: userId,
        },
      ])
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Fetch the complete record
    const { data: inventoryItem, error: fetchError } = await supabaseAdmin
      .from('store_inventory')
      .select('*')
      .eq('id', insertedItem.id)
      .single();

    if (fetchError) throw fetchError;

    return res.status(200).json({
      message: 'Inventory item created successfully',
      item: inventoryItem,
    });
  } catch (error: any) {
    console.error('Error creating inventory item:', error);
    return res.status(500).json({ error: error.message || 'Failed to create inventory item' });
  }
}

export default withAuth(handler);
