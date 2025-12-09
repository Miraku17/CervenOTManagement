import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { formatInTimeZone } from 'date-fns-tz';

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
    // Fetch all attendance records for the specific user and date
    const { data: attendanceRecords, error } = await supabase
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
      .order('time_in', { ascending: true });

    if (error) {
      throw error;
    }

    // If no records found
    if (!attendanceRecords || attendanceRecords.length === 0) {
      return res.status(200).json({
        sessions: [],
        totalHours: null,
        status: 'No Record',
        message: 'No attendance record found for this date'
      });
    }

    // Fetch overtime requests for all attendance records
    const attendanceIds = attendanceRecords.map(a => a.id);
    const { data: overtimeData } = await supabase
      .from('overtime')
      .select('*')
      .in('attendance_id', attendanceIds);

    // Fetch reviewer profiles if any
    const reviewerIds = overtimeData?.filter(ot => ot.reviewer).map(ot => ot.reviewer) || [];
    let reviewersMap = new Map();
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', reviewerIds);
      reviewersMap = new Map(reviewers?.map(r => [r.id, r]) || []);
    }

    // Create overtime map
    const overtimeMap = new Map(
      overtimeData?.map(ot => [
        ot.attendance_id,
        {
          id: ot.id,
          comment: ot.comment,
          status: ot.status,
          requestedAt: ot.requested_at,
          approvedAt: ot.approved_at,
          approvedHours: ot.approved_hours,
          reviewer: ot.reviewer ? reviewersMap.get(ot.reviewer) : null
        }
      ]) || []
    );

    // Format the response with Philippine timezone
    const PHILIPPINE_TZ = 'Asia/Manila';
    let totalMinutes = 0;
    let hasActiveSession = false;

    const formattedSessions = attendanceRecords.map(record => {
      const overtime = overtimeMap.get(record.id);
      const isActive = !record.time_out;

      if (isActive) {
        hasActiveSession = true;
      }

      if (record.total_minutes) {
        totalMinutes += record.total_minutes;
      }

      return {
        id: record.id,
        timeIn: record.time_in ? formatInTimeZone(new Date(record.time_in), PHILIPPINE_TZ, 'hh:mm a') : null,
        timeOut: record.time_out ? formatInTimeZone(new Date(record.time_out), PHILIPPINE_TZ, 'hh:mm a') : null,
        duration: record.total_minutes ? (record.total_minutes / 60).toFixed(2) : null,
        status: record.time_out ? 'Completed' : 'Active',
        clockInLocation: {
          lat: record.clock_in_lat,
          lng: record.clock_in_lng,
          address: record.clock_in_address
        },
        clockOutLocation: record.time_out ? {
          lat: record.clock_out_lat,
          lng: record.clock_out_lng,
          address: record.clock_out_address
        } : null,
        overtimeRequest: overtime || null
      };
    });

    return res.status(200).json({
      date: date,
      sessions: formattedSessions,
      totalHours: totalMinutes > 0 ? (totalMinutes / 60).toFixed(2) : null,
      status: hasActiveSession ? 'In Progress' : 'Completed',
      sessionCount: formattedSessions.length
    });

  } catch (error: any) {
    console.error('Fetch user attendance error:', error);
    return res.status(500).json({
      error: 'Failed to fetch attendance details'
    });
  }
}
