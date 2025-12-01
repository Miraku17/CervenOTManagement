import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer as supabase } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { startDate, endDate, userId } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date are required' });
  }

  try {
    let query = supabase
      .from('attendance')
      .select('*, profiles(first_name, last_name, email)')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({ data });

  } catch (error: any) {
    console.error('Export attendance error:', error);
    return res.status(500).json({
      error: 'Failed to fetch attendance records'
    });
  }
}
