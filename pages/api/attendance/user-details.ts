import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or anon key');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { userId, date } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (!date || typeof date !== 'string') {
    return res.status(400).json({ error: 'Date is required' });
  }

  try {
    // Fetch attendance record for the specific user and date
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        id,
        user_id,
        date,
        time_in,
        time_out,
        total_minutes,
        is_overtime_requested,
        overtime_comment,
        clock_in_lat,
        clock_in_lng,
        clock_in_address,
        clock_out_lat,
        clock_out_lng,
        clock_out_address
      `)
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // If no record found
    if (!data) {
      return res.status(200).json({
        attendance: null,
        message: 'No attendance record found for this date'
      });
    }

    // Format the response
    const formattedAttendance = {
      id: data.id,
      userId: data.user_id,
      date: data.date,
      timeIn: data.time_in ? new Date(data.time_in).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) : null,
      timeOut: data.time_out ? new Date(data.time_out).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) : null,
      totalHours: data.total_minutes ? (data.total_minutes / 60).toFixed(2) : null,
      totalMinutes: data.total_minutes,
      isOvertimeRequested: data.is_overtime_requested,
      overtimeComment: data.overtime_comment,
      status: data.time_out ? 'Present' : 'In Progress',
      clockInLocation: {
        lat: data.clock_in_lat,
        lng: data.clock_in_lng,
        address: data.clock_in_address
      },
      clockOutLocation: data.time_out ? {
        lat: data.clock_out_lat,
        lng: data.clock_out_lng,
        address: data.clock_out_address
      } : null
    };

    return res.status(200).json({
      attendance: formattedAttendance
    });

  } catch (error: any) {
    console.error('Fetch user attendance error:', error);
    return res.status(500).json({
      error: 'Failed to fetch attendance details'
    });
  }
}
