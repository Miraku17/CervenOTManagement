import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Note: Viewing holidays is allowed for all authenticated users
    // Only creating/updating/deleting holidays requires import_schedule permission

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Get query parameters for filtering
    const { year } = req.query;

    let query = supabaseAdmin
      .from('holidays')
      .select('*')
      .is('deleted_at', null)
      .order('date', { ascending: true });

    // Filter by year if provided
    if (year && typeof year === 'string') {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data: holidays, error } = await query;

    if (error) {
      throw error;
    }

    return res.status(200).json({ holidays: holidays || [] });
  } catch (error: any) {
    console.error('Error fetching holidays:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch holidays' });
  }
}

export default withAuth(handler);
