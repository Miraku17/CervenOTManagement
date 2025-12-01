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
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return res.status(200).json({
        attendance: null,
        message: 'No attendance record found'
      });
    }

    // Format times for datetime-local input (Supabase already applies +0800 timezone)
    const formatForInput = (isoTime: string | null) => {
      if (!isoTime) return null;
      // Just convert to format YYYY-MM-DDTHH:mm (Supabase already has correct timezone)
      return isoTime.slice(0, 16);
    };

    const formattedData = {
      ...data,
      time_in_formatted: formatForInput(data.time_in),
      time_out_formatted: formatForInput(data.time_out),
    };

    return res.status(200).json({
      attendance: formattedData
    });

  } catch (error: any) {
    console.error('Get raw attendance error:', error);
    return res.status(500).json({
      error: 'Failed to fetch attendance'
    });
  }
}
