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

  if (!supabaseAdmin) {
    throw new Error("Database connection not available");
  }

  try {
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
