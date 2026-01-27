import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';
import { sendCashAdvanceLevel2Email, sendCashAdvanceStatusEmail } from '@/lib/email';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id, action, adminId, reviewerComment, level } = req.body;

  if (!id || !action || !adminId) {
    return res.status(400).json({ error: 'Missing required fields (id, action, adminId).' });
  }

  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject".' });
  }

  // Validate level parameter - defaults to level1 for backward compatibility
  const approvalLevel = level || 'level1';
  if (approvalLevel !== 'level1' && approvalLevel !== 'level2') {
    return res.status(400).json({ error: 'Invalid level. Must be "level1" or "level2".' });
  }

  const now = new Date().toISOString();

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client not available' });
  }

  try {
    // Check level-specific permissions only (no fallback to manage_cash_flow)
    const permissionToCheck = approvalLevel === 'level1'
      ? 'approve_cash_advance_level1'
      : 'approve_cash_advance_level2';

    const hasLevelPermission = await userHasPermission(req.user?.id || '', permissionToCheck);

    if (!hasLevelPermission) {
      return res.status(403).json({
        error: `Forbidden: You do not have permission to ${approvalLevel === 'level1' ? 'Level 1' : 'Level 2'} approve/reject cash advance requests`
      });
    }

    // 1. Fetch the cash advance request with requester info
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('cash_advances')
      .select(`
        *,
        requester:requested_by (
          id,
          first_name,
          last_name,
          email,
          position_id
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      throw new Error('Cash advance request not found.');
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
                                     currentUserPosition.toLowerCase().includes('operations manager');
        if (!canViewConfidential) {
          return res.status(403).json({
            error: 'Forbidden: Operations Manager cash advances are confidential and can only be processed by HR or Accounting'
          });
        }
      }
    }

    // Fetch reviewer (admin) profile for email
    const { data: reviewerProfile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', adminId)
      .single();

    // Check if request is already fully processed
    if (request.status === 'approved' || request.status === 'rejected') {
      return res.status(400).json({ error: 'Request is already fully processed.' });
    }

    // 2. Build update payload based on approval level
    const updatePayload: Record<string, unknown> = {};

    if (approvalLevel === 'level1') {
      // Level 1 approval/rejection
      if (request.level1_status === 'approved' || request.level1_status === 'rejected') {
        return res.status(400).json({ error: 'Level 1 review is already completed.' });
      }

      updatePayload.level1_status = action === 'approve' ? 'approved' : 'rejected';
      updatePayload.level1_approved_by = adminId;
      updatePayload.level1_date_approved = now;
      if (reviewerComment) {
        updatePayload.level1_comment = reviewerComment;
      }

      if (action === 'reject') {
        // Level 1 rejection sets final status to rejected
        updatePayload.status = 'rejected';
        updatePayload.approved_by = adminId;
        updatePayload.date_approved = now;
        updatePayload.rejection_reason = reviewerComment || 'Rejected at Level 1';
      } else {
        // Level 1 approval - set level2 to pending
        updatePayload.level2_status = 'pending';
      }
    } else {
      // Level 2 approval/rejection
      if (request.level1_status !== 'approved') {
        return res.status(400).json({ error: 'Cannot process Level 2 until Level 1 is approved.' });
      }

      if (request.level2_status === 'approved' || request.level2_status === 'rejected') {
        return res.status(400).json({ error: 'Level 2 review is already completed.' });
      }

      updatePayload.level2_status = action === 'approve' ? 'approved' : 'rejected';
      updatePayload.level2_approved_by = adminId;
      updatePayload.level2_date_approved = now;
      if (reviewerComment) {
        updatePayload.level2_comment = reviewerComment;
      }

      // Level 2 sets the final status
      updatePayload.status = action === 'approve' ? 'approved' : 'rejected';
      updatePayload.approved_by = adminId;
      updatePayload.date_approved = now;
      if (action === 'reject' && reviewerComment) {
        updatePayload.rejection_reason = reviewerComment;
      }
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

    // Send email notifications (don't block the response)
    const requester = request.requester as { first_name: string; last_name: string; email: string } | null;
    const reviewerName = reviewerProfile
      ? `${reviewerProfile.first_name || ''} ${reviewerProfile.last_name || ''}`.trim()
      : undefined;

    if (requester) {
      const requesterName = `${requester.first_name || ''} ${requester.last_name || ''}`.trim() || 'Unknown';
      const requesterEmail = requester.email;

      if (approvalLevel === 'level1' && action === 'approve') {
        // Level 1 approved - notify Level 2 approvers
        sendCashAdvanceLevel2Email({
          requesterName,
          requesterEmail,
          type: request.type,
          amount: request.amount,
          date: request.date_requested,
          purpose: request.purpose || undefined,
          requestId: request.id,
          level: 'level2',
          previousApprover: reviewerName,
          previousApprovalDate: now,
        }).catch((err) => {
          console.error('Failed to send Level 2 approver email notification:', err);
        });
      }

      // Send status email to requester when final status is set
      if (updatedRequest.status === 'approved' || updatedRequest.status === 'rejected') {
        sendCashAdvanceStatusEmail({
          requesterName,
          requesterEmail,
          type: request.type,
          amount: request.amount,
          date: request.date_requested,
          purpose: request.purpose || undefined,
          requestId: request.id,
          status: updatedRequest.status,
          rejectedAtLevel: updatedRequest.status === 'rejected' ? approvalLevel : undefined,
          reviewerName,
          reviewerComment: reviewerComment || undefined,
        }).catch((err) => {
          console.error('Failed to send status email to requester:', err);
        });
      }
    }

    const levelLabel = approvalLevel === 'level1' ? 'Level 1' : 'Level 2';
    const actionLabel = action === 'approve' ? 'approved' : 'rejected';
    return res.status(200).json({
      message: `Cash advance request ${levelLabel} ${actionLabel}`,
      data: updatedRequest
    });

  } catch (error: unknown) {
    console.error('Error updating cash advance request:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
