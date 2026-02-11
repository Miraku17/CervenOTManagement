import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id, type, amount, purpose, date_requested, status } = req.body;

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
        error: 'Forbidden: You do not have permission to edit cash advance requests'
      });
    }

    // Check if the cash advance request exists and is not deleted
    const { data: existingRequest, error: fetchError } = await supabaseAdmin
      .from('cash_advances')
      .select('*, requester:requested_by (position_id)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingRequest) {
      return res.status(404).json({ error: 'Cash advance request not found' });
    }

    // Check if this is an Operations Manager's cash advance (confidential)
    const requesterPositionId = (existingRequest.requester as any)?.position_id;
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
            error: 'Forbidden: Operations Manager cash advances are confidential and can only be edited by HR, Accounting, or Managing Director'
          });
        }
      }
    }

    // Build the update payload with only provided fields
    const updatePayload: Record<string, unknown> = {};

    if (type !== undefined) {
      if (type !== 'personal' && type !== 'support' && type !== 'reimbursement') {
        return res.status(400).json({ error: 'Invalid type. Must be "personal", "support", or "reimbursement".' });
      }
      updatePayload.type = type;
    }

    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      // For reimbursement type, amount can be 0 or empty
      const finalType = type !== undefined ? type : existingRequest.type;
      if (finalType !== 'reimbursement' && (isNaN(parsedAmount) || parsedAmount <= 0)) {
        return res.status(400).json({ error: 'Amount must be a positive number.' });
      }
      updatePayload.amount = isNaN(parsedAmount) ? 0 : parsedAmount;
    }

    if (purpose !== undefined) {
      updatePayload.purpose = purpose || null;
    }

    if (date_requested !== undefined) {
      updatePayload.date_requested = date_requested;
    }

    if (status !== undefined) {
      if (status !== 'pending' && status !== 'approved' && status !== 'rejected') {
        return res.status(400).json({ error: 'Invalid status. Must be "pending", "approved", or "rejected".' });
      }
      updatePayload.status = status;

      // If changing to approved/rejected, set date_approved if not already set
      if ((status === 'approved' || status === 'rejected') && !existingRequest.date_approved) {
        updatePayload.date_approved = new Date().toISOString();
        updatePayload.approved_by = req.user?.id;
      }

      // If changing back to pending, clear approval info
      if (status === 'pending') {
        updatePayload.date_approved = null;
        updatePayload.approved_by = null;
        updatePayload.rejection_reason = null;
      }
    }

    // Check if there's anything to update
    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update.' });
    }

    // Update the cash advance request
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('cash_advances')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        requester:profiles!cash_advances_requested_by_fkey(
          id,
          first_name,
          last_name,
          email,
          employee_id
        ),
        approved_by_user:profiles!cash_advances_approved_by_fkey(
          id,
          first_name,
          last_name
        )
      `)
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      message: 'Cash advance request updated successfully',
      data: updatedRequest
    });

  } catch (error: unknown) {
    console.error('Error updating cash advance request:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
