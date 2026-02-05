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
    // Check if user has manage_cash_flow permission
    const hasPermission = await userHasPermission(req.user?.id || '', 'manage_cash_flow');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to delete cash advance requests'
      });
    }

    // Check if the cash advance request exists and is not already deleted
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('cash_advances')
      .select('id, deleted_at, requester:requested_by (position_id)')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      return res.status(404).json({ error: 'Cash advance request not found' });
    }

    if (request.deleted_at) {
      return res.status(400).json({ error: 'Cash advance request is already deleted' });
    }

    // Check if this is an Operations Manager's cash advance (confidential)
    const requesterPositionId = (request.requester as any)?.position_id;
    if (requesterPositionId) {
      // Get Operations Manager position ID
      const { data: opsManagerPosition } = await supabaseAdmin
        .from('positions')
        .select('id')
        .eq('name', 'Operations Manager')
        .single();

      if (opsManagerPosition && requesterPositionId === opsManagerPosition.id) {
        // Check if current user is HR or Accounting
        const { data: currentUserProfile } = await supabaseAdmin
          .from('profiles')
          .select('position_id, positions:position_id (name)')
          .eq('id', req.user?.id || '')
          .single();

        const currentUserPosition = (currentUserProfile?.positions as any)?.name || '';
        const canViewConfidential = currentUserPosition.toLowerCase().includes('hr') ||
                                     currentUserPosition.toLowerCase().includes('accounting') ||
                                     currentUserPosition.toLowerCase().includes('operations manager') ||
                                     currentUserPosition.toLowerCase().includes('managing director');
        if (!canViewConfidential) {
          return res.status(403).json({
            error: 'Forbidden: Operations Manager cash advances are confidential and can only be deleted by HR, Accounting, or Managing Director'
          });
        }
      }
    }

    // Soft delete the cash advance request
    const { error: deleteError } = await supabaseAdmin
      .from('cash_advances')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: req.user?.id,
      })
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return res.status(200).json({ message: 'Cash advance request deleted successfully' });

  } catch (error: unknown) {
    console.error('Error deleting cash advance request:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
