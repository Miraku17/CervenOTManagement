import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { fromZonedTime } from 'date-fns-tz';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { attendanceId, timeIn, timeOut, overtimeComment } = req.body;

  if (!attendanceId) {
    return res.status(400).json({ error: 'Attendance ID is required' });
  }

  if (!timeIn) {
    return res.status(400).json({ error: 'Time In is required' });
  }

  try {
    // Convert PHT to UTC (correct for timestamptz)
    const timeInUTC = fromZonedTime(timeIn, "Asia/Manila").toISOString();
    const timeOutUTC = timeOut ? fromZonedTime(timeOut, "Asia/Manila").toISOString() : null;

    // Calculate updated total minutes if both times exist
    let updatedTotalMinutes = null;
    if (timeOutUTC) {
      const diffMs = new Date(timeOutUTC).getTime() - new Date(timeInUTC).getTime();
      updatedTotalMinutes = Math.floor(diffMs / 60000); 
    }

    // Update the attendance record
    const { data, error } = await supabase
      .from('attendance')
      .update({
        time_in: timeInUTC,
        time_out: timeOutUTC,
        updated_total_minutes: updatedTotalMinutes,
        is_overtime_requested: overtimeComment ? true : false,
        overtime_comment: overtimeComment || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attendanceId)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      message: 'Attendance updated successfully',
      attendance: data
    });

  } catch (error: any) {
    console.error('Update attendance error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to update attendance'
    });
  }
}
