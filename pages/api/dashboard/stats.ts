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

  try {
    const today = new Date().toISOString().split('T')[0];

    // Get today's attendance
    const { data: todayAttendance, error: todayError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', today);

    if (todayError) throw todayError;

    // Get total employees
    const { count: totalEmployees, error: employeeError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'employee');

    if (employeeError) throw employeeError;

    // Calculate today's stats
    const clockedInCount = todayAttendance?.length || 0;
    const activeNow = todayAttendance?.filter(a => !a.time_out).length || 0;

    // Get this week's total hours
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const weekStart = startOfWeek.toISOString().split('T')[0];

    const { data: weekAttendance, error: weekError } = await supabase
      .from('attendance')
      .select('total_minutes')
      .gte('date', weekStart)
      .not('time_out', 'is', null);

    if (weekError) throw weekError;

    const totalMinutes = weekAttendance?.reduce((sum, record) => sum + (record.total_minutes || 0), 0) || 0;
    const totalHours = Math.round(totalMinutes / 60);

    // Count overtime requests this week
    const { data: overtimeData, error: overtimeError } = await supabase
      .from('attendance')
      .select('id')
      .gte('date', weekStart)
      .eq('is_overtime_requested', true);

    if (overtimeError) throw overtimeError;

    const overtimeRequests = overtimeData?.length || 0;

    return res.status(200).json({
      stats: {
        totalEmployees: totalEmployees || 0,
        clockedInToday: clockedInCount,
        activeNow: activeNow,
        overtimeRequests: overtimeRequests,
        weeklyHours: totalHours,
      }
    });

  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    return res.status(500).json({
      error: 'Failed to fetch dashboard statistics'
    });
  }
}
