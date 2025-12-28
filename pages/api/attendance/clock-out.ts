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

  const { latitude, longitude, address } = req.body;

  // Use authenticated user ID from middleware
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();

    // Find the most recent active attendance record (not just today's)
    const { data: existingAttendance, error: findError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .is('time_out', null)
      .order('time_in', { ascending: false })
      .limit(1)
      .single();

    if (findError) {
      if (findError.code === 'PGRST116') {
        return res.status(400).json({ error: 'No active clock-in found. Please clock in first.' });
      }
      throw findError;
    }

    if (!existingAttendance) {
      return res.status(400).json({ error: 'No active clock-in found. Please clock in first.' });
    }

    // Update attendance record with clock-out data
    const { data: attendance, error: updateError } = await supabase
      .from('attendance')
      .update({
        time_out: now.toISOString(),
        clock_out_lat: latitude || null,
        clock_out_lng: longitude || null,
        clock_out_address: address || null,
        updated_at: now.toISOString(),
      })
      .eq('id', existingAttendance.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update user's last_activity in profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ last_activity: now.toISOString() })
      .eq('id', userId);

    if (profileError) {
      console.error('Failed to update last_activity:', profileError);
    }

    return res.status(200).json({
      message: 'Clocked out successfully',
      attendance
    });

  } catch (error: any) {
    console.error('Clock-out error:', error);

    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      return res.status(400).json({
        error: 'You have already clocked out for this session'
      });
    }

    return res.status(500).json({
      error: 'Failed to clock out. Please try again.'
    });
  }
}

export default withAuth(handler);
