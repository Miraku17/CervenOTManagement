import { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // Check if user has view_overtime permission
    const hasPermission = await userHasPermission(req.user?.id || '', 'view_overtime');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to view overtime requests'
      });
    }
    // Fetch all overtime requests from overtime_v2
    const { data: overtimeData, error: overtimeError } = await supabase
      .from('overtime_v2')
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
    const level1ReviewerIds = [...new Set(overtimeData.map(ot => ot.level1_reviewer).filter(Boolean))];
    const level2ReviewerIds = [...new Set(overtimeData.map(ot => ot.level2_reviewer).filter(Boolean))];

    // Combine all user IDs for a single fetch
    const allUserIds = [...new Set([...requesterIds, ...level1ReviewerIds, ...level2ReviewerIds])];

    // Fetch all profiles in one query
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, positions(name)')
      .in('id', allUserIds);

    if (profilesError) {
      console.error('Profiles query error:', profilesError);
    }

    // Create lookup map
    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

    // Transform the data
    const transformedData = overtimeData.map(ot => {
      return {
        ...ot,
        requested_by: profilesMap.get(ot.requested_by) || null,
        level1_reviewer_profile: ot.level1_reviewer ? profilesMap.get(ot.level1_reviewer) : null,
        level2_reviewer_profile: ot.level2_reviewer ? profilesMap.get(ot.level2_reviewer) : null,
      };
    });

    console.log('Overtime requests fetched from overtime_v2:', transformedData.length);

    return res.status(200).json({ data: transformedData });

  } catch (error: any) {
    console.error('API Error fetching overtime requests:', error.message);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
