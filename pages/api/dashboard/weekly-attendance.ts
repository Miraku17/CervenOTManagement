import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer as supabase } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Get last 7 days
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekData = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = days[date.getDay()];

      // Get attendance for this day
      const { data: attendance, error } = await supabase
        .from('attendance')
        .select('time_in')
        .eq('date', dateStr);

      if (error) throw error;

      // Count on-time and late
      const onTimeCount = attendance?.filter(a => {
        if (!a.time_in) return false;
        const clockInTime = new Date(a.time_in);
        const clockInHour = clockInTime.getHours();
        const clockInMinutes = clockInTime.getMinutes();
        return clockInHour < 9 || (clockInHour === 9 && clockInMinutes === 0);
      }).length || 0;

      const lateCount = (attendance?.length || 0) - onTimeCount;

      weekData.push({
        name: dayName,
        present: onTimeCount,
        late: lateCount,
        date: dateStr
      });
    }

    return res.status(200).json({
      weeklyData: weekData
    });

  } catch (error: any) {
    console.error('Weekly attendance error:', error);
    return res.status(500).json({
      error: 'Failed to fetch weekly attendance'
    });
  }
}
