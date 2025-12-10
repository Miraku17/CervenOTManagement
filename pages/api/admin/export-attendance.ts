import type { NextApiResponse } from 'next';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
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

    const { data: attendanceData, error } = await query;

    if (error) throw error;

    // Get attendance IDs to fetch overtime requests
    const attendanceIds = attendanceData?.map(a => a.id) || [];

    // Fetch overtime requests for these attendance records
    const { data: overtimeData } = await supabase
      .from('overtime')
      .select('attendance_id, comment, status, approved_hours, reviewer, requested_at, approved_at')
      .in('attendance_id', attendanceIds);

    // Fetch reviewer profiles if any
    const reviewerIds = overtimeData?.filter(ot => ot.reviewer).map(ot => ot.reviewer) || [];
    let reviewersMap = new Map();
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', reviewerIds);
      reviewersMap = new Map(reviewers?.map(r => [r.id, r]) || []);
    }

    // Create overtime map
    const overtimeMap = new Map(
      overtimeData?.map(ot => [
        ot.attendance_id,
        {
          comment: ot.comment,
          status: ot.status,
          approved_hours: ot.approved_hours,
          requested_at: ot.requested_at,
          approved_at: ot.approved_at,
          reviewer: ot.reviewer ? reviewersMap.get(ot.reviewer) : null
        }
      ]) || []
    );

    // Merge overtime data with attendance data
    const data = attendanceData?.map(record => ({
      ...record,
      overtimeRequest: overtimeMap.get(record.id) || null
    }));

    return res.status(200).json({ data });

  } catch (error: any) {
    console.error('Export attendance error:', error);
    return res.status(500).json({
      error: 'Failed to fetch attendance records'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
