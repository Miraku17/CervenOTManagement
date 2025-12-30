import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!supabase) {
    console.error('Supabase admin client not available');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { date, startTime, endTime, reason } = req.body;

  // Use authenticated user ID from middleware
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate required fields
  if (!date || !startTime || !endTime || !reason) {
    return res.status(400).json({ error: 'Please provide date, start time, end time, and reason.' });
  }

  try {
    const now = new Date();
    const requestedDate = date; // Already in yyyy-MM-dd format

    // Calculate total hours (handles overnight shifts)
    const calculateHours = (start: string, end: string): number => {
      const [startHour, startMin] = start.split(':').map(Number);
      const [endHour, endMin] = end.split(':').map(Number);

      let startMinutes = startHour * 60 + startMin;
      let endMinutes = endHour * 60 + endMin;

      // If end time is less than start time, it means overnight shift (next day)
      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60; // Add 24 hours in minutes
      }

      const diffMinutes = endMinutes - startMinutes;
      return Number((diffMinutes / 60).toFixed(2)); // Convert to hours with 2 decimals
    };

    const totalHours = calculateHours(startTime, endTime);

    // Check if user is Operations Manager for auto-approval
    const { data: userProfile, error: positionError } = await supabase
      .from('profiles')
      .select('position_id, positions(name)')
      .eq('id', userId)
      .single();

    if (positionError) {
      throw new Error('Failed to fetch user profile.');
    }

    const userPosition = userProfile?.positions && (userProfile.positions as any).name;
    const isOperationsManager = userPosition === 'Operations Manager';

    // Check if user already has an overtime request for this date
    const { data: existingOvertimeRequests, error: checkError } = await supabase
      .from('overtime_v2')
      .select('id, level1_status, level2_status, final_status')
      .eq('requested_by', userId)
      .eq('overtime_date', requestedDate);

    if (checkError) throw checkError;

    // Check if there are any pending or approved requests for this date
    if (existingOvertimeRequests && existingOvertimeRequests.length > 0) {
      const hasPendingOrApproved = existingOvertimeRequests.some(req => {
        // Check if request is still pending (no final status or final status is pending)
        const isPending = !req.final_status || req.final_status === 'pending';
        // Check if request is approved
        const isApproved = req.final_status === 'approved';

        return isPending || isApproved;
      });

      if (hasPendingOrApproved) {
        return res.status(400).json({
          error: 'You already have a pending or approved overtime request for this date. You can only submit a new request if all previous requests for this date were rejected.'
        });
      }
    }

    // Create the overtime request in overtime_v2
    const overtimeRequestData: any = {
      requested_by: userId,
      overtime_date: requestedDate,
      start_time: startTime,
      end_time: endTime,
      total_hours: totalHours,
      reason: reason,
      status: isOperationsManager ? 'approved' : 'pending',
      requested_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    // If auto-approving, set approval info for both levels
    if (isOperationsManager) {
      // Level 1 approval
      overtimeRequestData.level1_reviewer = userId;
      overtimeRequestData.level1_status = 'approved';
      overtimeRequestData.level1_reviewed_at = now.toISOString();
      overtimeRequestData.level1_comment = 'Auto-approved (Operations Manager)';
      // Level 2 approval
      overtimeRequestData.level2_reviewer = userId;
      overtimeRequestData.level2_status = 'approved';
      overtimeRequestData.level2_reviewed_at = now.toISOString();
      overtimeRequestData.level2_comment = 'Auto-approved (Operations Manager)';
      // Set final status and approval timestamp
      overtimeRequestData.final_status = 'approved';
      overtimeRequestData.approved_at = now.toISOString();
    }

    const { data: overtimeData, error: overtimeError } = await supabase
      .from('overtime_v2')
      .insert(overtimeRequestData)
      .select()
      .single();

    if (overtimeError) throw overtimeError;

    const message = isOperationsManager
      ? 'Overtime request submitted and automatically approved'
      : 'Overtime request submitted successfully';

    return res.status(200).json({
      message,
      overtime: overtimeData
    });

  } catch (error: any) {
    console.error('File overtime request error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to submit overtime request. Please try again.'
    });
  }
}

export default withAuth(handler);
