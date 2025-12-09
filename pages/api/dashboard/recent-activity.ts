import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer as supabase } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { limit = '20' } = req.query;

  try {
    // Get last 7 days of attendance with user profiles
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get recent attendance with user profiles
    const { data: recentActivity, error } = await supabase
      .from('attendance')
      .select(`
        id,
        time_in,
        time_out,
        date,
        total_minutes,
        clock_in_address,
        clock_out_address,
        clock_in_lat,
        clock_in_lng,
        clock_out_lat,
        clock_out_lng,
        user_id,
        profiles!inner(first_name, last_name, email)
      `)
      .gte('date', startDateStr)
      .order('date', { ascending: false })
      .order('time_in', { ascending: false });

    if (error) throw error;

    // Get attendance IDs to fetch overtime requests
    const attendanceIds = recentActivity?.map(a => a.id) || [];

    // Fetch overtime requests for these attendance records
    const { data: overtimeData } = await supabase
      .from('overtime')
      .select('attendance_id, comment, status, reviewer')
      .in('attendance_id', attendanceIds);

    // Fetch reviewer profiles if any
    const reviewerIds = overtimeData?.filter(ot => ot.reviewer).map(ot => ot.reviewer) || [];
    let reviewersMap = new Map();
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', reviewerIds);
      reviewersMap = new Map(reviewers?.map(r => [r.id, r]) || []);
    }

    // Create overtime map
    const overtimeMap = new Map(
      overtimeData?.map(ot => [
        ot.attendance_id,
        {
          comment: ot.comment,
          status: ot.status,
          reviewer: ot.reviewer ? reviewersMap.get(ot.reviewer) : null
        }
      ]) || []
    );

    // Group by user_id and date
    const groupedActivity = new Map<string, any>();

    recentActivity?.forEach(record => {
      const profile = record.profiles as any;
      const key = `${record.user_id}_${record.date}`;

      if (!groupedActivity.has(key)) {
        groupedActivity.set(key, {
          user_id: record.user_id,
          date: record.date,
          employeeName: `${profile.first_name} ${profile.last_name}`,
          email: profile.email,
          avatarSeed: `${profile.first_name}+${profile.last_name}`,
          logs: []
        });
      }

      const group = groupedActivity.get(key);
      const timeIn = new Date(record.time_in);
      const timeOut = record.time_out ? new Date(record.time_out) : null;
      const overtime = overtimeMap.get(record.id);

      // Calculate duration for this session
      let duration = null;
      if (record.total_minutes) {
        const hours = Math.floor(record.total_minutes / 60);
        const minutes = record.total_minutes % 60;
        duration = `${hours}h ${minutes}m`;
      }

      group.logs.push({
        id: record.id,
        timeInRaw: record.time_in, // Store raw timestamp for sorting
        timeIn: timeIn.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Manila'
        }),
        timeOut: timeOut ? timeOut.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Manila'
        }) : null,
        clockInAddress: record.clock_in_address || null,
        clockOutAddress: record.clock_out_address || null,
        duration: duration,
        status: record.time_out ? 'Completed' : 'Active',
        overtimeRequest: overtime ? {
          comment: overtime.comment,
          status: overtime.status,
          reviewer: overtime.reviewer
        } : null
      });
    });

    // Format the grouped data
    const formattedActivity = Array.from(groupedActivity.values()).map(group => {
      const activityDate = new Date(group.date);

      // Sort logs by time_in (ascending) so Session 1 is the earliest
      group.logs.sort((a: any, b: any) => new Date(a.timeInRaw).getTime() - new Date(b.timeInRaw).getTime());

      // Calculate total duration for the day
      let totalMinutes = 0;
      group.logs.forEach((log: any) => {
        if (log.duration) {
          const parts = log.duration.split(' ');
          const hours = parseInt(parts[0]) || 0;
          const minutes = parseInt(parts[1]) || 0;
          totalMinutes += hours * 60 + minutes;
        }
      });

      const totalHours = Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;
      const totalDuration = totalMinutes > 0 ? `${totalHours}h ${remainingMinutes}m` : null;

      // Check if any log has active status
      const hasActiveSession = group.logs.some((log: any) => log.status === 'Active');

      // Remove timeInRaw from logs before returning (was only needed for sorting)
      const cleanedLogs = group.logs.map((log: any) => {
        const { timeInRaw, ...rest } = log;
        return rest;
      });

      return {
        id: `${group.user_id}_${group.date}`,
        employeeName: group.employeeName,
        email: group.email,
        date: activityDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'Asia/Manila'
        }),
        avatarSeed: group.avatarSeed,
        totalDuration: totalDuration,
        status: hasActiveSession ? 'Active' : 'Completed',
        sessionCount: group.logs.length,
        logs: cleanedLogs
      };
    }).slice(0, parseInt(limit as string));

    return res.status(200).json({
      activity: formattedActivity
    });

  } catch (error: any) {
    console.error('Recent activity error:', error);
    return res.status(500).json({
      error: 'Failed to fetch recent activity'
    });
  }
}
