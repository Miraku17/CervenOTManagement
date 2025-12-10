import type { NextApiResponse } from 'next';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { latitude, longitude, address, overtimeComment } = req.body;

  // Use authenticated user ID from middleware
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

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

    // Calculate total hours worked
    const timeIn = new Date(existingAttendance.time_in);
    const timeOut = new Date(now);
    const totalMilliseconds = timeOut.getTime() - timeIn.getTime();
    const totalHours = totalMilliseconds / (1000 * 60 * 60); // Convert to hours

    // Insert into overtime table if user submitted an overtime comment
    let overtime = null;
    if (overtimeComment) {
      // Check if user already has an overtime request for today
      const { data: existingOvertimeRequests, error: checkError } = await supabase
        .from('overtime')
        .select('id, attendance_id, attendance!inner(date, user_id)')
        .eq('attendance.user_id', userId)
        .eq('attendance.date', today);

      if (checkError) throw checkError;

      if (existingOvertimeRequests && existingOvertimeRequests.length > 0) {
        return res.status(400).json({
          error: 'You have already submitted an overtime request for today. Only one overtime request per day is allowed.'
        });
      }

      // Calculate approved overtime hours if total hours > 8
      let approvedHours = null;
      if (totalHours > 8) {
        approvedHours = Number((totalHours - 8).toFixed(2));
      }

      const { data: overtimeData, error: overtimeError } = await supabase
        .from('overtime')
        .insert([
          {
            attendance_id: existingAttendance.id,
            requested_by: userId,
            comment: overtimeComment,
            status: 'pending',
            approved_hours: approvedHours,
            requested_at: now.toISOString(),
            created_at: now.toISOString(),
            updated_at: now.toISOString()
          }
        ])
        .select()
        .single();

      if (overtimeError) throw overtimeError;

      overtime = overtimeData;
    }

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
      attendance,
      overtime: overtime || null
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
