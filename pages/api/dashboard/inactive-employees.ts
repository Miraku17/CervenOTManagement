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

    // Get all users (role = 'employee' or 'admin')
    const { data: allEmployees, error: employeesError } = await supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        last_name,
        email,
        employee_id,
        positions(name)
      `)
      .in('role', ['employee', 'admin'])
      .order('first_name', { ascending: true });

    if (employeesError) throw employeesError;

    // Get active employees (clocked in today without time_out)
    const { data: activeAttendance, error: activeError } = await supabase
      .from('attendance')
      .select('user_id')
      .eq('date', today)
      .is('time_out', null);

    if (activeError) throw activeError;

    // Get set of active user IDs
    const activeUserIds = new Set(activeAttendance?.map(a => a.user_id) || []);

    // Filter for inactive employees (not in active list)
    const inactiveEmployees = allEmployees
      ?.filter(employee => !activeUserIds.has(employee.id))
      .map(async (employee) => {
        // Get their last clock out time
        const { data: lastAttendance } = await supabase!
          .from('attendance')
          .select('time_out')
          .eq('user_id', employee.id)
          .not('time_out', 'is', null)
          .order('time_out', { ascending: false })
          .limit(1)
          .single();

        const lastClockOut = lastAttendance?.time_out
          ? new Date(lastAttendance.time_out).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
              timeZone: 'Asia/Manila'
            })
          : null;

        return {
          id: employee.id,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          firstName: employee.first_name,
          lastName: employee.last_name,
          email: employee.email,
          employeeId: employee.employee_id,
          position: (employee.positions as any)?.name || 'N/A',
          avatarSeed: `${employee.first_name}+${employee.last_name}`,
          lastClockOut,
          lastClockOutRaw: lastAttendance?.time_out || null
        };
      }) || [];

    // Wait for all async operations to complete
    const resolvedInactiveEmployees = await Promise.all(inactiveEmployees);

    return res.status(200).json({
      inactiveEmployees: resolvedInactiveEmployees,
      count: resolvedInactiveEmployees.length
    });

  } catch (error: any) {
    console.error('Inactive employees error:', error);
    return res.status(500).json({
      error: 'Failed to fetch inactive employees'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
