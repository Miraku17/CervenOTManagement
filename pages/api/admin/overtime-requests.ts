import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // Check user authorization
    const userId = req.query.userId || req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ message: 'User ID required for authorization' });
    }

    // Fetch user position to verify access
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('positions(name)')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile) {
      return res.status(403).json({ message: 'Unable to verify user permissions' });
    }

    // Check if user has authorized position
    const authorizedPositions = [
      'Admin Tech',
      'Technical Support Engineer',
      'Operations Technical Lead',
      'Operations Manager'
    ];

    const userPosition = (userProfile.positions as any)?.name;

    if (!userPosition || !authorizedPositions.includes(userPosition)) {
      return res.status(403).json({
        message: 'Access denied. You do not have permission to view overtime requests.',
        position: userPosition
      });
    }

    // First, fetch all overtime requests
    const { data: overtimeData, error: overtimeError } = await supabase
      .from('overtime')
      .select('*')
      .order('requested_at', { ascending: false });

    if (overtimeError) {
      console.error('Overtime query error:', overtimeError);
      return res.status(500).json({ message: 'Database query failed', error: overtimeError.message });
    }

    if (!overtimeData || overtimeData.length === 0) {
      return res.status(200).json({ data: [] });
    }

    // Get unique user IDs for batch fetching
    const requesterIds = [...new Set(overtimeData.map(ot => ot.requested_by))];
    const reviewerIds = [...new Set(overtimeData.map(ot => ot.reviewer).filter(Boolean))];
    const level1ReviewerIds = [...new Set(overtimeData.map(ot => ot.level1_reviewer).filter(Boolean))];
    const level2ReviewerIds = [...new Set(overtimeData.map(ot => ot.level2_reviewer).filter(Boolean))];
    const attendanceIds = [...new Set(overtimeData.map(ot => ot.attendance_id))];

    // Combine all reviewer IDs for a single fetch
    const allReviewerIds = [...new Set([...reviewerIds, ...level1ReviewerIds, ...level2ReviewerIds])];

    // Fetch all related data in parallel
    const [requestersResult, reviewersResult, attendanceResult, dailySummaryResult] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, email, positions(name)').in('id', requesterIds),
      allReviewerIds.length > 0
        ? supabase.from('profiles').select('id, first_name, last_name, email, positions(name)').in('id', allReviewerIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('attendance').select('id, date, total_minutes, user_id').in('id', attendanceIds),
      supabase.from('attendance_daily_summary').select('user_id, date, overtime_minutes').in('user_id', requesterIds),
    ]);

    // Create lookup maps
    const requestersMap = new Map(requestersResult.data?.map(p => [p.id, p]) || []);
    const reviewersMap = new Map(reviewersResult.data?.map(p => [p.id, p]) || []);
    const attendanceMap = new Map(attendanceResult.data?.map(a => [a.id, a]) || []);

    // Create daily summary lookup map by user_id and date
    const dailySummaryMap = new Map(
      dailySummaryResult.data?.map(ds => [`${ds.user_id}_${ds.date}`, ds]) || []
    );

    // Combine the data
    const transformedData = overtimeData.map(ot => {
      const attendance = attendanceMap.get(ot.attendance_id);
      const dailySummary = attendance
        ? dailySummaryMap.get(`${attendance.user_id}_${attendance.date}`)
        : null;

      return {
        ...ot,
        requested_by: requestersMap.get(ot.requested_by),
        reviewer: ot.reviewer ? reviewersMap.get(ot.reviewer) : null,
        level1_reviewer_profile: ot.level1_reviewer ? reviewersMap.get(ot.level1_reviewer) : null,
        level2_reviewer_profile: ot.level2_reviewer ? reviewersMap.get(ot.level2_reviewer) : null,
        attendance: attendance,
        overtime_minutes: dailySummary?.overtime_minutes || null,
      };
    });

    console.log('Overtime requests fetched:', transformedData.length);
    console.log('Sample request with two-level approval:', transformedData.find(r => r.level1_reviewer || r.level2_reviewer));

    return res.status(200).json({ data: transformedData });

  } catch (error: any) {
    console.error('API Error fetching overtime requests:', error.message);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
