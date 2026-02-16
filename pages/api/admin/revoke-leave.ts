import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { differenceInDays, parseISO } from 'date-fns';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id, adminId, reviewerComment } = req.body;

  if (!id || !adminId) {
    return res.status(400).json({ error: 'Missing required fields (id, adminId).' });
  }

  const now = new Date().toISOString();

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client not available' });
  }

  try {
    // Check if user has approve_leave permission
    const hasPermission = await userHasPermission(req.user?.id || '', 'approve_leave');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to revoke leave requests'
      });
    }

    // 1. Fetch the leave request with employee profile
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('leave_requests')
      .select(`
        *,
        employee:profiles!leave_requests_employee_id_fkey(
          id,
          first_name,
          last_name,
          email,
          leave_credits
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      throw new Error('Leave request not found.');
    }

    // Validate that the request is currently approved
    if (request.status !== 'approved') {
      return res.status(400).json({
        error: 'Only approved leave requests can be revoked.'
      });
    }

    // 2. Calculate leave duration
    const duration = differenceInDays(parseISO(request.end_date), parseISO(request.start_date)) + 1;

    // 3. Restore leave credits (skip for Leave Without Pay)
    if (request.leave_type !== 'Leave Without Pay' && request.leave_type !== 'Holiday Leave') {
      const currentCredits = request.employee?.leave_credits || 0;

      // Restore credits by adding duration back
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update({ leave_credits: currentCredits + duration })
        .eq('id', request.employee_id);

      if (updateProfileError) throw updateProfileError;
    }

    // 4. Update the leave request status to 'revoked'
    const updatePayload: any = {
      status: 'revoked',
      reviewer_id: adminId,
      reviewed_at: now,
      reviewer_comment: reviewerComment || 'Leave revoked',
    };

    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('leave_requests')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        employee:profiles!leave_requests_employee_id_fkey(
          id,
          first_name,
          last_name,
          email
        ),
        reviewer:profiles!leave_requests_reviewer_id_fkey(
          first_name,
          last_name
        )
      `)
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      message: 'Leave request revoked successfully',
      data: updatedRequest
    });

  } catch (error: any) {
    console.error('Error revoking leave request:', error);
    return res.status(500).json({ error: error.message || 'An unexpected error occurred.' });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
