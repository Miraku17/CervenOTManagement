import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

interface UpdateStatusRequest {
  id: string;
  action: 'approve' | 'reject';
  adminId: string;
  reviewerComment?: string;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user has approve_liquidations permission
    const hasPermission = await userHasPermission(userId, 'approve_liquidations');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to approve/reject liquidations',
      });
    }

    const { id, action, adminId, reviewerComment }: UpdateStatusRequest = req.body;

    if (!id || !action || !adminId) {
      return res.status(400).json({ error: 'Missing required fields (id, action, adminId)' });
    }

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject".' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const now = new Date().toISOString();

    // Fetch the liquidation first
    const { data: liquidation, error: fetchError } = await supabaseAdmin
      .from('liquidations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !liquidation) {
      return res.status(404).json({ error: 'Liquidation not found' });
    }

    if (liquidation.status !== 'pending') {
      return res.status(400).json({ error: 'Liquidation has already been processed' });
    }

    // Update the liquidation status
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      approved_by: adminId,
      approved_at: now,
    };

    if (reviewerComment) {
      updatePayload.reviewer_comment = reviewerComment;
    }

    const { data: updatedLiquidation, error: updateError } = await supabaseAdmin
      .from('liquidations')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating liquidation:', updateError);
      throw updateError;
    }

    return res.status(200).json({
      message: `Liquidation ${newStatus} successfully`,
      liquidation: updatedLiquidation,
    });
  } catch (error: unknown) {
    console.error('Update liquidation status error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update liquidation status';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
