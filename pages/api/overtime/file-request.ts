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

    // Check if user already has an overtime request for this date
    const { data: existingOvertimeRequests, error: checkError } = await supabase
      .from('overtime_v2')
      .select('id')
      .eq('requested_by', userId)
      .eq('overtime_date', requestedDate);

    if (checkError) throw checkError;

    if (existingOvertimeRequests && existingOvertimeRequests.length > 0) {
      return res.status(400).json({
        error: 'You have already submitted an overtime request for this date. Only one overtime request per day is allowed.'
      });
    }

    // Create the overtime request in overtime_v2
    // Note: total_hours is a computed column in the database
    const { data: overtimeData, error: overtimeError } = await supabase
      .from('overtime_v2')
      .insert({
        requested_by: userId,
        overtime_date: requestedDate,
        start_time: startTime,
        end_time: endTime,
        reason: reason,
        status: 'pending',
        requested_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .select()
      .single();

    if (overtimeError) throw overtimeError;

    return res.status(200).json({
      message: 'Overtime request submitted successfully',
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
