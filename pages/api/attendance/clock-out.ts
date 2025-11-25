import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or anon key');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { userId, latitude, longitude, address, overtimeComment } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Find today's active attendance record
    const { data: existingAttendance, error: findError } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .is('time_out', null)
      .single();

    if (findError) {
      if (findError.code === 'PGRST116') {
        return res.status(400).json({ error: 'No active clock-in found for today' });
      }
      throw findError;
    }

    if (!existingAttendance) {
      return res.status(400).json({ error: 'No active clock-in found for today' });
    }

    // Update attendance record with clock-out data
    const { data: attendance, error: updateError } = await supabase
      .from('attendance')
      .update({
        time_out: now.toISOString(),
        clock_out_lat: latitude || null,
        clock_out_lng: longitude || null,
        clock_out_address: address || null,
        is_overtime_requested: !!overtimeComment,
        overtime_comment: overtimeComment || null,
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
      // Don't throw - this is not critical for clock-out
    }

    return res.status(200).json({
      message: 'Clocked out successfully',
      attendance
    });

  } catch (error: any) {
    console.error('Clock-out error:', error);

    // Handle specific database errors
    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      return res.status(400).json({
        error: 'You have already clocked out for this session'
      });
    }

    // Generic error
    return res.status(500).json({
      error: 'Failed to clock out. Please try again.'
    });
  }
}
