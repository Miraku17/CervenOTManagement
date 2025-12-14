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

  // Use authenticated user ID from middleware instead of accepting it from request body
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Check for existing active session to prevent double clock-in
    const { data: activeSession, error: checkError } = await supabase
      .from('attendance')
      .select('id, time_in')
      .eq('user_id', userId)
      .is('time_out', null)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking active session:', checkError);
      return res.status(500).json({ error: 'Failed to check attendance status' });
    }

    if (activeSession) {
      return res.status(400).json({
        error: 'You are already clocked in. Please clock out of your current session first.'
      });
    }

    // Create new attendance record (allows multiple clock-ins per day)
    const { data: attendance, error: insertError } = await supabase
      .from('attendance')
      .insert({
        user_id: userId,
        date: today,
        time_in: now.toISOString(),
        clock_in_lat: latitude || null,
        clock_in_lng: longitude || null,
        clock_in_address: address || null,
        // is_overtime_requested: false,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update user's last_activity in profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ last_activity: now.toISOString() })
      .eq('id', userId);

    if (profileError) {
      console.error('Failed to update last_activity:', profileError);
      // Don't throw - this is not critical for clock-in
    }

    return res.status(201).json({
      message: 'Clocked in successfully',
      attendance
    });

  } catch (error: any) {
    console.error('Clock-in error:', error);

    return res.status(500).json({
      error: 'Failed to clock in. Please try again.'
    });
  }
}

export default withAuth(handler);
