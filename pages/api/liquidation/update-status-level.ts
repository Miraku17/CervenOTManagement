import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';
import { sendLiquidationLevel1ApprovedEmail, sendLiquidationStatusEmail } from '@/lib/email';

interface UpdateStatusLevelRequest {
  id: string;
  action: 'approve' | 'reject';
  level: 1 | 2;
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

    const { id, action, level, adminId, reviewerComment }: UpdateStatusLevelRequest = req.body;

    if (!id || !action || !level || !adminId) {
      return res.status(400).json({ error: 'Missing required fields (id, action, level, adminId)' });
    }

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject".' });
    }

    if (level !== 1 && level !== 2) {
      return res.status(400).json({ error: 'Invalid level. Must be 1 or 2.' });
    }

    // Check if user has the appropriate permission for this level
    const permissionKey = level === 1 ? 'approve_liquidations_level1' : 'approve_liquidations_level2';
    const hasPermission = await userHasPermission(userId, permissionKey);

    if (!hasPermission) {
      return res.status(403).json({
        error: `Forbidden: You do not have permission to approve/reject liquidations at Level ${level}`,
      });
    }

    // Fetch the liquidation
    const { data: liquidation, error: fetchError } = await supabaseAdmin
      .from('liquidations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !liquidation) {
      console.error('Error fetching liquidation:', fetchError);
      return res.status(404).json({ error: 'Liquidation not found' });
    }

    // Validate status based on level
    if (level === 1) {
      // Level 1 approval requires status to be 'pending'
      if (liquidation.status !== 'pending') {
        return res.status(400).json({
          error: `Liquidation cannot be processed at Level 1. Current status: ${liquidation.status}`
        });
      }
    } else if (level === 2) {
      // Level 2 approval requires status to be 'level1_approved'
      if (liquidation.status !== 'level1_approved') {
        return res.status(400).json({
          error: `Liquidation must be approved at Level 1 first. Current status: ${liquidation.status}`
        });
      }
    }

    // Fetch the requester's profile to check their position
    const { data: requesterProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, position_id')
      .eq('id', liquidation.user_id)
      .single();

    // Check if this is a confidential liquidation (HR or Accounting)
    const requesterPositionId = requesterProfile?.position_id;
    if (requesterPositionId) {
      // Get HR and Accounting position IDs
      const { data: confidentialPositions } = await supabaseAdmin
        .from('positions')
        .select('id')
        .or('name.eq.HR,name.eq.Accounting');

      const confidentialPositionIds = (confidentialPositions || []).map(p => p.id);

      if (confidentialPositionIds.includes(requesterPositionId)) {
        // This is a confidential request - only Managing Director can approve at Level 2
        if (level === 2) {
          const { data: currentUserProfile } = await supabaseAdmin
            .from('profiles')
            .select('position_id, positions:position_id (name)')
            .eq('id', userId)
            .single();

          const currentUserPosition = (currentUserProfile?.positions as any)?.name || '';
          const isManagingDirector = currentUserPosition.toLowerCase().includes('managing director');

          if (!isManagingDirector) {
            return res.status(403).json({
              error: 'Forbidden: HR and Accounting liquidations can only be approved at Level 2 by Managing Director'
            });
          }
        }
      }
    }

    const now = new Date().toISOString();
    let updatePayload: Record<string, unknown> = {};
    let newStatus = liquidation.status;

    if (action === 'approve') {
      if (level === 1) {
        // Level 1 approval
        updatePayload = {
          status: 'level1_approved',
          level1_approved_by: adminId,
          level1_approved_at: now,
        };
        if (reviewerComment) {
          updatePayload.level1_reviewer_comment = reviewerComment;
        }
        newStatus = 'level1_approved';
      } else if (level === 2) {
        // Level 2 approval (final)
        updatePayload = {
          status: 'approved',
          level2_approved_by: adminId,
          level2_approved_at: now,
          // Also update old fields for backward compatibility
          approved_by: adminId,
          approved_at: now,
        };
        if (reviewerComment) {
          updatePayload.level2_reviewer_comment = reviewerComment;
          updatePayload.reviewer_comment = reviewerComment;
        }
        newStatus = 'approved';
      }
    } else if (action === 'reject') {
      // Rejection can happen at any level
      const commentField = level === 1 ? 'level1_reviewer_comment' : 'level2_reviewer_comment';
      const approvedByField = level === 1 ? 'level1_approved_by' : 'level2_approved_by';
      const approvedAtField = level === 1 ? 'level1_approved_at' : 'level2_approved_at';

      updatePayload = {
        status: 'rejected',
        [approvedByField]: adminId,
        [approvedAtField]: now,
        // Also update old fields for backward compatibility
        approved_by: adminId,
        approved_at: now,
      };
      if (reviewerComment) {
        updatePayload[commentField] = reviewerComment;
        updatePayload.reviewer_comment = reviewerComment;
      }
      newStatus = 'rejected';
    }

    // Update the liquidation
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

    // Send email notifications
    try {
      // Get current user's name for email
      const { data: currentUserProfile } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .single();

      const reviewerName = currentUserProfile
        ? `${currentUserProfile.first_name} ${currentUserProfile.last_name}`
        : 'Unknown';

      if (action === 'approve' && level === 1) {
        // Level 1 approved - notify Level 2 approvers
        await sendLiquidationLevel1ApprovedEmail({
          requesterName: requesterProfile
            ? `${(requesterProfile as any).first_name || ''} ${(requesterProfile as any).last_name || ''}`
            : 'Unknown',
          level1ApproverName: reviewerName,
          cashAdvanceAmount: liquidation.cash_advance_id ? 0 : 0, // We don't have this in the liquidation object
          totalExpenses: liquidation.total_amount || 0,
          liquidationDate: liquidation.liquidation_date,
          requestId: liquidation.id,
        });

        // Also notify requester
        if (requesterProfile && (requesterProfile as any).email) {
          await sendLiquidationStatusEmail({
            requesterName: `${(requesterProfile as any).first_name || ''} ${(requesterProfile as any).last_name || ''}`,
            requesterEmail: (requesterProfile as any).email,
            status: 'approved',
            level: 1,
            reviewerName,
            reviewerComment: reviewerComment,
            cashAdvanceAmount: 0,
            totalExpenses: liquidation.total_amount || 0,
            liquidationDate: liquidation.liquidation_date,
          });
        }
      } else if (action === 'approve' && level === 2) {
        // Level 2 approved (final) - notify requester
        if (requesterProfile && (requesterProfile as any).email) {
          await sendLiquidationStatusEmail({
            requesterName: `${(requesterProfile as any).first_name || ''} ${(requesterProfile as any).last_name || ''}`,
            requesterEmail: (requesterProfile as any).email,
            status: 'approved',
            level: 2,
            reviewerName,
            reviewerComment: reviewerComment,
            cashAdvanceAmount: 0,
            totalExpenses: liquidation.total_amount || 0,
            liquidationDate: liquidation.liquidation_date,
          });
        }
      } else if (action === 'reject') {
        // Rejected at any level - notify requester
        if (requesterProfile && (requesterProfile as any).email) {
          await sendLiquidationStatusEmail({
            requesterName: `${(requesterProfile as any).first_name || ''} ${(requesterProfile as any).last_name || ''}`,
            requesterEmail: (requesterProfile as any).email,
            status: 'rejected',
            level,
            reviewerName,
            reviewerComment: reviewerComment,
            cashAdvanceAmount: 0,
            totalExpenses: liquidation.total_amount || 0,
            liquidationDate: liquidation.liquidation_date,
          });
        }
      }
    } catch (emailError) {
      console.error('Error sending email notifications:', emailError);
      // Don't fail the request if email fails
    }

    return res.status(200).json({
      message: `Liquidation ${action}d at Level ${level} successfully`,
      liquidation: updatedLiquidation,
    });
  } catch (error: unknown) {
    console.error('Update liquidation status error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update liquidation status';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler);
