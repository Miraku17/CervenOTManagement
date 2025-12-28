import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!supabase) {
    console.error('Supabase admin client not available');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { id, startTime, endTime, reason } = req.body;

  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!id || !startTime || !endTime || !reason) {
    return res.status(400).json({ error: 'Please provide id, start time, end time, and reason.' });
  }

  try {
    // First, verify the request exists and belongs to the user
    const { data: existingRequest, error: fetchError } = await supabase
      .from('overtime_v2')
      .select('*')
      .eq('id', id)
      .eq('requested_by', userId)
      .single();

    if (fetchError || !existingRequest) {
      return res.status(404).json({ error: 'Overtime request not found.' });
    }

    // Check if the request is still pending (level1_status is null or pending)
    if (existingRequest.level1_status && existingRequest.level1_status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot update overtime request. It has already been reviewed.'
      });
    }

    const now = new Date();

    // Update the overtime request
    const { data: updatedData, error: updateError } = await supabase
      .from('overtime_v2')
      .update({
        start_time: startTime,
        end_time: endTime,
        reason: reason,
        updated_at: now.toISOString()
      })
      .eq('id', id)
      .eq('requested_by', userId)
      .select()
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({
      message: 'Overtime request updated successfully',
      overtime: updatedData
    });

  } catch (error: any) {
    console.error('Update overtime request error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to update overtime request. Please try again.'
    });
  }
}

export default withAuth(handler);
