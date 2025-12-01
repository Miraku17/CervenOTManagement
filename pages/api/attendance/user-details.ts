import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer as supabase } from '@/lib/supabase-server';

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

    // Fetch overtime request for this attendance record if exists
    const { data: overtimeData } = await supabase
      .from('overtime')
      .select('*')
      .eq('attendance_id', data.id)
      .single();

    // If overtime exists, fetch reviewer profile
    let reviewerProfile = null;
    if (overtimeData?.reviewer) {
      const { data: reviewer } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', overtimeData.reviewer)
        .single();
      reviewerProfile = reviewer;
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
      } : null,
      overtimeRequest: overtimeData ? {
        id: overtimeData.id,
        comment: overtimeData.comment,
        status: overtimeData.status,
        requestedAt: overtimeData.requested_at,
        approvedAt: overtimeData.approved_at,
        approvedHours: overtimeData.approved_hours,
        reviewer: reviewerProfile,
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
