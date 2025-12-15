import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { formatInTimeZone } from 'date-fns-tz';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Security Check: Verify user has "Operations Manager" position
  if (!req.user || !req.user.id) {
     return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: callerProfile, error: callerError } = await supabase
    .from('profiles')
    .select('positions(name)')
    .eq('id', req.user.id)
    .single();

  const callerPosition = callerProfile?.positions ? (callerProfile.positions as any).name : null;

  if (callerError || callerPosition !== 'Operations Manager') {
    return res.status(403).json({ 
      error: 'Forbidden: Only Operations Managers can view stale sessions.' 
    });
  }

  try {
    // Use Philippine timezone for date calculation to ensure consistency
    const PHILIPPINE_TZ = 'Asia/Manila';
    const today = formatInTimeZone(new Date(), PHILIPPINE_TZ, 'yyyy-MM-dd');

    // Fetch all active sessions where date is NOT today
    const { data: staleSessions, error } = await supabase
      .from('attendance')
      .select(`
        id,
        date,
        time_in,
        user_id,
        profiles!inner (
          first_name,
          last_name,
          email,
          employee_id,
          positions (
            name
          )
        )
      `)
      .is('time_out', null)
      .lt('date', today) // Less than today
      .order('date', { ascending: true });

    if (error) throw error;

    // Format data for frontend
    const formattedSessions = staleSessions.map((session: any) => ({
      id: session.id,
      userId: session.user_id,
      employeeName: `${session.profiles.first_name} ${session.profiles.last_name}`,
      employeeId: session.profiles.employee_id,
      email: session.profiles.email,
      position: session.profiles.positions?.name || 'N/A',
      date: session.date,
      timeIn: session.time_in,
      durationHours: ((Date.now() - new Date(session.time_in).getTime()) / (1000 * 60 * 60)).toFixed(1)
    }));

    return res.status(200).json({ sessions: formattedSessions });

  } catch (error: any) {
    console.error('Error fetching stale sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch stale sessions' });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
