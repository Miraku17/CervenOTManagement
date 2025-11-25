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

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    // Get current session with calculated duration
    const { data, error } = await supabase.rpc('get_current_session', {
      p_user_id: userId,
      p_date: today
    });

    if (error) {
      // If RPC doesn't exist, fall back to regular query
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select(`
          user_id,
          time_in,
          time_out,
          clock_in_lat,
          clock_in_lng,
          clock_in_address,
          clock_out_lat,
          clock_out_lng,
          clock_out_address
        `)
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (attendanceError && attendanceError.code !== 'PGRST116') {
        throw attendanceError;
      }

      if (!attendanceData) {
        return res.status(200).json({
          session: null,
          message: 'No active session found'
        });
      }

      // Calculate duration manually
      const timeIn = new Date(attendanceData.time_in);
      const timeOut = attendanceData.time_out ? new Date(attendanceData.time_out) : new Date();
      const durationMinutes = Math.floor((timeOut.getTime() - timeIn.getTime()) / 60000);

      return res.status(200).json({
        session: {
          user_id: attendanceData.user_id,
          clock_in: attendanceData.time_in,
          session_end: attendanceData.time_out || new Date().toISOString(),
          duration_minutes: durationMinutes,
          has_clocked_out: !!attendanceData.time_out,
          clock_in_location: {
            lat: attendanceData.clock_in_lat,
            lng: attendanceData.clock_in_lng,
            address: attendanceData.clock_in_address
          },
          clock_out_location: attendanceData.time_out ? {
            lat: attendanceData.clock_out_lat,
            lng: attendanceData.clock_out_lng,
            address: attendanceData.clock_out_address
          } : null
        }
      });
    }

    return res.status(200).json({
      session: data
    });

  } catch (error: any) {
    console.error('Get current session error:', error);
    return res.status(500).json({
      error: 'Failed to fetch current session'
    });
  }
}
