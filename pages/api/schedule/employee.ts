import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {

      if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }


    const { month, year, userId: requestedUserId } = req.query;

    // Get authenticated user's ID
    const authenticatedUserId = req.user?.id;

    if (!authenticatedUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user has permission to view other employees' schedules
    const allowedPositions = ['Operations Manager', 'Technical Support Lead', 'Technical Support Engineer'];

    // Fetch the authenticated user's profile to check their position
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('position_id, positions(name)')
      .eq('id', authenticatedUserId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    const positionName = (profile?.positions as any)?.name;
    const canViewOtherSchedules = positionName && allowedPositions.includes(positionName);

    // Determine which user's schedule to fetch
    let userId: string;
    if (requestedUserId && typeof requestedUserId === 'string' && canViewOtherSchedules) {
      // Admin/Manager viewing another employee's schedule
      userId = requestedUserId;
    } else {
      // Regular user or no userId specified - show own schedule
      userId = authenticatedUserId;
    }

    // Build date range filter if month and year are provided
    let query = supabaseAdmin
      .from('working_schedules')
      .select('*')
      .eq('employee_id', userId)
      .order('date', { ascending: true });

    // If month and year are provided, filter by that month
    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      // Fix: Construct endDate manually to avoid timezone shifts from toISOString()
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching working schedules:', error);
      return res.status(500).json({ error: 'Failed to fetch working schedules' });
    }

    return res.status(200).json({ schedules: data || [] });
  } catch (error: any) {
    console.error('Error in employee schedule API:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export default withAuth(handler);
