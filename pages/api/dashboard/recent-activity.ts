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
        is_overtime_requested,
        overtime_comment,
        user_id,
        profiles!inner(first_name, last_name, email)
      `)
      .gte('date', startDateStr)
      .order('time_in', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) throw error;

    // Format the response
    const formattedActivity = recentActivity?.map(record => {
      const profile = record.profiles as any;
      const timeIn = new Date(record.time_in);
      const timeOut = record.time_out ? new Date(record.time_out) : null;
      const activityDate = new Date(record.date);

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
          day: 'numeric'
        }),
        timeIn: timeIn.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        timeOut: timeOut ? timeOut.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) : null,
        duration: duration,
        status: record.time_out ? 'Completed' : 'Active',
        isOvertime: record.is_overtime_requested,
        overtimeComment: record.overtime_comment || null,
        avatarSeed: `${profile.first_name}+${profile.last_name}`
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
