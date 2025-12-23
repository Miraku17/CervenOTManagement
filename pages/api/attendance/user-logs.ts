import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!supabase) {
    console.error('Supabase admin client not initialized');
    return res.status(500).json({ error: 'Internal Server Error' });
  }

  if (!req.user?.id) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const userId = req.user.id;

  try {
    // First, fetch user's position to check if they're a Field Engineer
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('position_id, positions(name)')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    const isFieldEngineer = userProfile?.positions && (userProfile.positions as any).name === 'Field Engineer';

    // Fetch all completed attendance records for the user
    const { data: attendanceRecords, error } = await supabase
      .from('attendance')
      .select(`
        id,
        user_id,
        date,
        time_in,
        time_out,
        total_minutes,
        clock_in_lat,
        clock_in_lng,
        clock_in_address,
        clock_out_lat,
        clock_out_lng,
        clock_out_address
      `)
      .eq('user_id', userId)
      .not('time_out', 'is', null) // Only completed sessions
      .order('date', { ascending: false });

    if (error) {
      throw error;
    }

    // Apply lunch deduction logic and format records
    const formattedRecords = attendanceRecords?.map(record => {
      let adjustedMinutes = record.total_minutes || 0;

      // Apply lunch deduction for Field Engineers only
      const FIVE_HOURS_IN_MINUTES = 300;
      const ONE_HOUR_IN_MINUTES = 60;

      if (isFieldEngineer && adjustedMinutes > FIVE_HOURS_IN_MINUTES) {
        adjustedMinutes = adjustedMinutes - ONE_HOUR_IN_MINUTES;
      }

      return {
        id: record.id,
        date: record.date,
        time_in: record.time_in,
        time_out: record.time_out,
        total_minutes: record.total_minutes, // Raw minutes
        adjusted_minutes: adjustedMinutes, // With lunch deduction applied
        clock_in_address: record.clock_in_address,
        clock_out_address: record.clock_out_address,
      };
    }) || [];

    return res.status(200).json({
      records: formattedRecords,
      isFieldEngineer
    });

  } catch (error: any) {
    console.error('Fetch user attendance logs error:', error);
    return res.status(500).json({
      error: 'Failed to fetch attendance logs'
    });
  }
}

export default withAuth(handler);
