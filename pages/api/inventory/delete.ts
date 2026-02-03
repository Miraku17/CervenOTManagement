import type { NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { withAuth, AuthenticatedRequest } from "@/lib/apiAuth";
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", ["DELETE"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id } = req.body;
  const userId = req.user?.id || '';
  const userPosition = req.user?.position;

  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Database connection not available" });
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

  // Field Engineers need explicit edit access (but still can't delete)
  if (userPosition === 'Field Engineer' && !hasEditAccess && !hasManagePermission) {
    return res.status(403).json({ error: 'Forbidden: Read-only access for Field Engineers without edit permission' });
  }

  // Edit-only users cannot delete items (only manage permission can delete)
  if (hasEditAccess && !hasManagePermission) {
    return res.status(403).json({
      error: 'Forbidden: Edit-only users cannot delete inventory items'
    });
  }

  // User must have manage permission to delete
  if (!hasManagePermission) {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to delete store inventory items'
    });
  }

  if (!id) {
    return res.status(400).json({ error: "Inventory item ID is required" });
  }

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    // First, get the serial number of the item being deleted
    const { data: itemToDelete } = await supabaseAdmin
      .from("store_inventory")
      .select('serial_number')
      .eq("id", id)
      .is('deleted_at', null)
      .single();

    const serialNumber = itemToDelete?.serial_number;

    // Soft delete: Update with deleted_at and deleted_by
    const { error: deleteError } = await supabaseAdmin
      .from("store_inventory")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq("id", id)
      .is('deleted_at', null); // Only soft delete if not already deleted

    if (deleteError) throw deleteError;

    // Check if this serial number is still being used in other store inventory items
    if (serialNumber) {
      const { data: otherUsages, error: countError } = await supabaseAdmin
        .from("store_inventory")
        .select('id')
        .ilike('serial_number', serialNumber.trim())
        .is('deleted_at', null);

      if (!countError && (!otherUsages || otherUsages.length === 0)) {
        // No other store inventory items using this serial number
        // Update asset status back to "Available" only if it's currently "In Use"
        const { data: asset } = await supabaseAdmin
          .from('asset_inventory')
          .select('id, status')
          .ilike('serial_number', serialNumber.trim())
          .maybeSingle();

        if (asset && asset.status === 'In Use') {
          // Only change back to "Available" if it was "In Use"
          // If it's "Broken", "Under Repair", etc., keep that status
          await supabaseAdmin
            .from('asset_inventory')
            .update({
              status: 'Available',
              updated_by: userId,
              updated_at: new Date().toISOString()
            })
            .eq('id', asset.id);

          console.log(`Updated asset ${asset.id} (Serial: ${serialNumber}) status back to "Available"`);
        }
      }
    }

    return res.status(200).json({
      message: "Inventory item deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting inventory item:", error);
    return res
      .status(500)
      .json({ error: error.message || "Failed to delete inventory item" });
  }
}

export default withAuth(handler);
