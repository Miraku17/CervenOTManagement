import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase URL or service role key');
}

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    // Supabase automatically applies +0800 timezone, so just use the values directly
    const timeInISO = timeIn;
    const timeOutISO = timeOut || null;

    // Calculate updated total minutes if both times are present
    let updatedTotalMinutes = null;
    if (timeOutISO) {
      const diffMs = new Date(timeOutISO).getTime() - new Date(timeInISO).getTime();
      updatedTotalMinutes = Math.floor(diffMs / 60000); // Convert to minutes
    }

    // Update the attendance record
    const { data, error } = await supabase
      .from('attendance')
      .update({
        time_in: timeInISO,
        time_out: timeOutISO,
        updated_total_minutes: updatedTotalMinutes,
        is_overtime_requested: !!overtimeComment,
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
