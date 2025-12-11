import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { workDate, startDate, endDate } = req.query;

  // Use authenticated user's ID instead of query parameter
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    if (startDate && endDate) {
        // Fetch range
        if (typeof startDate !== 'string' || typeof endDate !== 'string') {
             return res.status(400).json({ error: 'Start and End dates must be strings' });
        }
        
        const { data, error } = await supabase
          .from('attendance_daily_summary')
          .select('id, user_id, work_date, total_minutes_raw, total_minutes_final')
          .eq('user_id', userId)
          .gte('work_date', startDate)
          .lte('work_date', endDate);

        if (error) throw error;
        return res.status(200).json({ summaries: data || [] });

    } else if (workDate) {
        // Fetch single date
        if (typeof workDate !== 'string') {
            return res.status(400).json({ error: 'Work Date must be a string' });
        }

        const { data, error } = await supabase
          .from('attendance_daily_summary')
          .select('id, user_id, work_date, total_minutes_raw, total_minutes_final')
          .eq('user_id', userId)
          .eq('work_date', workDate)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        return res.status(200).json({ summary: data || null });
    } else {
        return res.status(400).json({ error: 'Either workDate or startDate/endDate is required' });
    }

  } catch (error: any) {
    console.error('Error fetching daily attendance summary:', error);
    return res.status(500).json({ error: 'Failed to fetch daily attendance summary' });
  }
}

export default withAuth(handler);