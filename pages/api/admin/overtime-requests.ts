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
    const attendanceIds = [...new Set(overtimeData.map(ot => ot.attendance_id))];

    // Fetch all related data in parallel
    const [requestersResult, reviewersResult, attendanceResult] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, email').in('id', requesterIds),
      reviewerIds.length > 0
        ? supabase.from('profiles').select('id, first_name, last_name, email').in('id', reviewerIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('attendance').select('id, date, total_minutes').in('id', attendanceIds),
    ]);

    // Create lookup maps
    const requestersMap = new Map(requestersResult.data?.map(p => [p.id, p]) || []);
    const reviewersMap = new Map(reviewersResult.data?.map(p => [p.id, p]) || []);
    const attendanceMap = new Map(attendanceResult.data?.map(a => [a.id, a]) || []);

    // Combine the data
    const transformedData = overtimeData.map(ot => ({
      ...ot,
      requested_by: requestersMap.get(ot.requested_by),
      reviewer: ot.reviewer ? reviewersMap.get(ot.reviewer) : null,
      attendance: attendanceMap.get(ot.attendance_id),
    }));

    console.log('Overtime requests fetched:', transformedData.length);
    console.log('Sample request with reviewer:', transformedData.find(r => r.reviewer));

    return res.status(200).json({ data: transformedData });

  } catch (error: any) {
    console.error('API Error fetching overtime requests:', error.message);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
