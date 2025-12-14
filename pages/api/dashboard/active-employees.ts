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

  try {
    const today = new Date().toISOString().split('T')[0];

    // Get active employees (clocked in today without time_out)
    const { data: activeAttendance, error } = await supabase
      .from('attendance')
      .select(`
        id,
        time_in,
        clock_in_address,
        clock_in_lat,
        clock_in_lng,
        user_id,
        profiles!inner(
          first_name,
          last_name,
          email,
          employee_id,
          positions(name)
        )
      `)
      .eq('date', today)
      .is('time_out', null)
      .order('time_in', { ascending: false });

    if (error) throw error;

    // Format the data
    const activeEmployees = activeAttendance?.map(record => {
      const profile = record.profiles as any;
      const timeIn = new Date(record.time_in);

      // Calculate how long they've been working
      const now = new Date();
      const diffMs = now.getTime() - timeIn.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const workingDuration = `${diffHours}h ${diffMinutes}m`;

      return {
        id: record.id,
        userId: record.user_id,
        employeeName: `${profile.first_name} ${profile.last_name}`,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: profile.email,
        employeeId: profile.employee_id,
        position: profile.positions?.name || 'N/A',
        avatarSeed: `${profile.first_name}+${profile.last_name}`,
        timeIn: timeIn.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Manila'
        }),
        timeInRaw: record.time_in,
        clockInAddress: record.clock_in_address || 'No address',
        workingDuration,
        latitude: record.clock_in_lat,
        longitude: record.clock_in_lng
      };
    }) || [];

    return res.status(200).json({
      activeEmployees,
      count: activeEmployees.length
    });

  } catch (error: any) {
    console.error('Active employees error:', error);
    return res.status(500).json({
      error: 'Failed to fetch active employees'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
