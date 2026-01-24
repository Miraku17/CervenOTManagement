import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing required field: id' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client not available' });
  }

  try {
    // Check if user has manage_liquidation permission
    const hasPermission = await userHasPermission(req.user?.id || '', 'manage_liquidation');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to delete liquidation requests'
      });
    }

    // Check if the liquidation exists
    const { data: liquidation, error: fetchError } = await supabaseAdmin
      .from('liquidations')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !liquidation) {
      return res.status(404).json({ error: 'Liquidation not found' });
    }

    // Delete related liquidation_items first
    const { error: itemsDeleteError } = await supabaseAdmin
      .from('liquidation_items')
      .delete()
      .eq('liquidation_id', id);

    if (itemsDeleteError) {
      console.error('Error deleting liquidation items:', itemsDeleteError);
    }

    // Delete related liquidation_attachments
    const { error: attachmentsDeleteError } = await supabaseAdmin
      .from('liquidation_attachments')
      .delete()
      .eq('liquidation_id', id);

    if (attachmentsDeleteError) {
      console.error('Error deleting liquidation attachments:', attachmentsDeleteError);
    }

    // Delete the liquidation
    const { error: deleteError } = await supabaseAdmin
      .from('liquidations')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return res.status(200).json({ message: 'Liquidation deleted successfully' });

  } catch (error: unknown) {
    console.error('Error deleting liquidation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
