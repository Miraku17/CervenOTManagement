import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { formatInTimeZone } from 'date-fns-tz';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { date } = req.query;

  // Use authenticated user's ID - but allow admin to query other users
  let userId = req.user?.id;
  const queryUserId = req.query.userId as string;

  // If admin is querying for another user, allow it
  if (queryUserId && req.user?.role === 'admin') {
    userId = queryUserId;
  }

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (!date || typeof date !== 'string') {
    return res.status(400).json({ error: 'Date is required' });
  }

  try {
    // Fetch all attendance records for the specific user and date
    const { data: attendanceRecords, error } = await supabase
      .from('attendance')
      .select('*')
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
        sessionCount: 0,
        message: 'No attendance record found for this date'
      });
    }

    // Fetch daily summary if available
    const { data: dailySummary } = await supabase
      .from('attendance_daily_summary')
      .select('total_minutes_final')
      .eq('user_id', userId)
      .eq('work_date', date)
      .single();

    // Fetch overtime requests for all attendance records
    const attendanceIds = attendanceRecords.map(a => a.id);
    const { data: overtimeData } = await supabase
      .from('overtime')
      .select('id, attendance_id, comment, status')
      .in('attendance_id', attendanceIds);

    // Create overtime map
    const overtimeMap = new Map(
      overtimeData?.map(ot => [
        ot.attendance_id,
        {
          id: ot.id,
          comment: ot.comment,
          status: ot.status
        }
      ]) || []
    );

    // Format times for datetime-local input in Philippine timezone
    const PHILIPPINE_TZ = 'Asia/Manila';
    const formatForInput = (isoTime: string | null) => {
      if (!isoTime) return null;
      // Convert UTC to Philippine time and format for datetime-local input
      return formatInTimeZone(new Date(isoTime), PHILIPPINE_TZ, "yyyy-MM-dd'T'HH:mm");
    };

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
        time_in: formatForInput(record.time_in),
        time_out: formatForInput(record.time_out),
        total_minutes: record.total_minutes,
        overtimeRequest: overtime || null
      };
    });

    // Use daily summary final minutes if available
    if (dailySummary && typeof dailySummary.total_minutes_final === 'number') {
        totalMinutes = dailySummary.total_minutes_final;
    }

    return res.status(200).json({
      sessions: formattedSessions,
      totalHours: totalMinutes > 0 ? (totalMinutes / 60).toFixed(2) : null,
      status: hasActiveSession ? 'In Progress' : 'Completed',
      sessionCount: formattedSessions.length
    });

  } catch (error: any) {
    console.error('Get raw attendance error:', error);
    return res.status(500).json({
      error: 'Failed to fetch attendance'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });