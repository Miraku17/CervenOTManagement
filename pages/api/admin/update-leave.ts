import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { differenceInDays, parseISO } from 'date-fns';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

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
    // Check if user has required position
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('position_id, positions(name)')
      .eq('id', req.user?.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    const userPosition = userProfile?.positions && (userProfile.positions as any).name;
    const allowedPositions = ['Operations Manager', 'Technical Support Lead', 'Technical Support Engineer'];

    if (!allowedPositions.includes(userPosition)) {
      return res.status(403).json({
        error: 'Forbidden: Only Operations Manager, Technical Support Lead, and Technical Support Engineer can update leave requests'
      });
    }

    // 1. Fetch the leave request first to get employee_id and duration
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !request) {
      throw new Error('Leave request not found.');
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is already processed.' });
    }

    // 2. If approving, deduct leave credits (skip for Leave Without Pay)
    if (newStatus === 'approved' && request.leave_type !== 'Leave Without Pay') {
      const duration = differenceInDays(parseISO(request.end_date), parseISO(request.start_date)) + 1;

      // Fetch current credits
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('leave_credits')
        .eq('id', request.employee_id)
        .single();

      if (profileError) throw profileError;

      const currentCredits = profile.leave_credits || 0;

      // Deduct credits
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update({ leave_credits: currentCredits - duration })
        .eq('id', request.employee_id);

      if (updateProfileError) throw updateProfileError;
    }

    // 3. Update the leave request status
    const updatePayload: any = {
      status: newStatus,
      reviewer_id: adminId,
      reviewed_at: now,
    };

    if (reviewerComment) {
      updatePayload.reviewer_comment = reviewerComment;
    }

    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('leave_requests')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({ message: `Leave request ${newStatus}`, data: updatedRequest });

  } catch (error: any) {
    console.error('Error updating leave request:', error);
    return res.status(500).json({ error: error.message || 'An unexpected error occurred.' });
  }
}

export default withAuth(handler, { requireRole: 'admin' });