import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { differenceInDays, parseISO } from 'date-fns';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server misconfiguration: Missing admin privileges.' });
  }

  // Use authenticated user's ID instead of body parameter
  const userId = req.user?.id;
  const { type, startDate, endDate, reason } = req.body;

  if (!userId || !type || !startDate || !endDate || !reason) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    // 1. Calculate duration
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const duration = differenceInDays(end, start) + 1;

    if (duration <= 0) {
      return res.status(400).json({ error: 'End date must be after start date.' });
    }

    // Check if user is Operations Manager for auto-approval
    const { data: userProfile, error: positionError } = await supabaseAdmin
      .from('profiles')
      .select('leave_credits, position_id, positions(name)')
      .eq('id', userId)
      .single();

    if (positionError) {
      throw new Error('Failed to fetch user profile.');
    }

    const userPosition = userProfile?.positions && (userProfile.positions as any).name;
    const isOperationsManager = userPosition === 'Operations Manager';

    // 2. Check Leave Credits (skip for Leave Without Pay and Operations Managers)
    if (type !== 'Leave Without Pay' && type !== 'Holiday Leave' && !isOperationsManager) {
      const currentCredits = userProfile.leave_credits || 0;
      if (currentCredits < duration) {
        return res.status(400).json({
          error: `Insufficient leave credits. You have ${currentCredits} credits but requested ${duration} days. You can leave without pay.`
        });
      }
    }

    // 3. Check for Overlapping Approved Requests
    // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
    const { data: overlappingRequests, error: overlapError } = await supabaseAdmin
      .from('leave_requests')
      .select('id')
      .eq('employee_id', userId)
      .eq('status', 'approved')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (overlapError) {
      throw new Error('Failed to check overlapping requests.');
    }

    if (overlappingRequests && overlappingRequests.length > 0) {
      return res.status(400).json({ 
        error: 'You already have an approved leave request that overlaps with these dates.' 
      });
    }

    // 4. Insert Request (auto-approve for Operations Managers)
    const now = new Date().toISOString();
    const requestData: any = {
      employee_id: userId,
      leave_type: type,
      start_date: startDate,
      end_date: endDate,
      reason: reason,
      status: isOperationsManager ? 'approved' : 'pending',
    };

    // If auto-approving, set reviewer info
    if (isOperationsManager) {
      requestData.reviewer_id = userId; // Self-approved
      requestData.reviewed_at = now;
      requestData.reviewer_comment = 'Auto-approved (Operations Manager)';
    }

    const { data, error } = await supabaseAdmin
      .from('leave_requests')
      .insert(requestData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // If auto-approved and not Leave Without Pay, deduct credits immediately
    if (isOperationsManager && type !== 'Leave Without Pay' && type !== 'Holiday Leave') {
      const currentCredits = userProfile.leave_credits || 0;
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ leave_credits: currentCredits - duration })
        .eq('id', userId);

      if (updateError) {
        console.error('Error deducting leave credits:', updateError);
        // Don't fail the request if credit deduction fails, just log it
      }
    }

    const message = isOperationsManager
      ? 'Leave request submitted and automatically approved'
      : 'Leave request submitted successfully';

    return res.status(201).json({ message, data });
  } catch (error: any) {
    console.error('Error creating leave request:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit leave request.' });
  }
}

export default withAuth(handler);