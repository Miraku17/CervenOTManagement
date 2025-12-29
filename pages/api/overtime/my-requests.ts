import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!supabase) {
    console.error('Supabase admin client not available');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Fetch overtime requests for the user
    const { data, error: fetchError } = await supabase
      .from('overtime_v2')
      .select('*')
      .eq('requested_by', userId)
      .order('overtime_date', { ascending: false });

    if (fetchError) {
      console.error('Supabase error:', fetchError);
      throw fetchError;
    }

    // Fetch reviewer profiles for requests that have reviewers
    const requestsWithProfiles = await Promise.all(
      (data || []).map(async (request) => {
        let level1Profile = null;
        let level2Profile = null;

        if (request.level1_reviewer && supabase) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', request.level1_reviewer)
            .single();
          level1Profile = profile;
        }

        if (request.level2_reviewer && supabase) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', request.level2_reviewer)
            .single();
          level2Profile = profile;
        }

        return {
          ...request,
          level1_reviewer_profile: level1Profile,
          level2_reviewer_profile: level2Profile,
        };
      })
    );

    return res.status(200).json({
      requests: requestsWithProfiles
    });

  } catch (error: any) {
    console.error('Fetch overtime requests error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch overtime requests'
    });
  }
}

export default withAuth(handler);
