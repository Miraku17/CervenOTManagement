import type { NextApiResponse } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { withAuth, AuthenticatedRequest } from "@/lib/apiAuth";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", ["DELETE"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Inventory item ID is required" });
  }

  if (!supabaseAdmin) {
    throw new Error("Database connection not available");
  }

  try {
    // First, fetch the item to get the asset_id before deleting
    const { data: itemToDelete, error: fetchError } = await supabaseAdmin
      .from('store_inventory')
      .select('asset_id')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Delete the inventory item
    const { error: deleteError } = await supabaseAdmin
      .from("store_inventory")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    // Automatically update the asset status back to 'Available'
    if (itemToDelete?.asset_id) {
      const { error: updateError } = await supabaseAdmin
        .from('asset_inventory')
        .update({ status: 'Available' })
        .eq('id', itemToDelete.asset_id);
      
      if (updateError) {
        console.warn('Failed to revert asset status to Available:', updateError);
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

export default withAuth(handler, { requireRole: ["admin", "employee"] });
