import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id, action, adminId, reviewerComment } = req.body;

  if (!id || !action || !adminId) {
    return res.status(400).json({ error: 'Missing required fields (id, action, adminId).' });
  }

  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject".' });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const now = new Date().toISOString();

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client not available' });
  }

  try {
    // Check if user has manage_cash_flow permission
    const hasPermission = await userHasPermission(req.user?.id || '', 'manage_cash_flow');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to approve/reject cash advance requests'
      });
    }

    // 1. Fetch the cash advance request first
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('cash_advances')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      throw new Error('Cash advance request not found.');
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is already processed.' });
    }

    // 2. Update the cash advance request status
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      approved_by: adminId,
      date_approved: now,
    };

    if (reviewerComment) {
      updatePayload.rejection_reason = reviewerComment;
    }

    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('cash_advances')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({ message: `Cash advance request ${newStatus}`, data: updatedRequest });

  } catch (error: unknown) {
    console.error('Error updating cash advance request:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
