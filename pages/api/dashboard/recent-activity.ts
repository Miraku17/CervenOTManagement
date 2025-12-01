import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer as supabase } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { limit = '10' } = req.query;

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
        user_id,
        profiles!inner(first_name, last_name, email)
      `)
      .gte('date', startDateStr)
      .order('time_in', { ascending: false })
      .limit(parseInt(limit as string));

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

    // Format the response
    const formattedActivity = recentActivity?.map(record => {
      const profile = record.profiles as any;
      const timeIn = new Date(record.time_in);
      const timeOut = record.time_out ? new Date(record.time_out) : null;
      const activityDate = new Date(record.date);
      const overtime = overtimeMap.get(record.id);

      // Calculate duration
      let duration = null;
      if (record.total_minutes) {
        const hours = Math.floor(record.total_minutes / 60);
        const minutes = record.total_minutes % 60;
        duration = `${hours}h ${minutes}m`;
      }

      return {
        id: record.id,
        employeeName: `${profile.first_name} ${profile.last_name}`,
        email: profile.email,
        date: activityDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'Asia/Manila'
        }),
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
        avatarSeed: `${profile.first_name}+${profile.last_name}`,
        overtimeRequest: overtime ? {
          comment: overtime.comment,
          status: overtime.status,
          reviewer: overtime.reviewer
        } : null
      };
    }) || [];

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
