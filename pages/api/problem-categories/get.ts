import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Fetch active problem categories (exclude soft-deleted and inactive)
    const { data: problemCategories, error } = await supabaseAdmin
      .from('problem_categories')
      .select('id, name')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return res.status(200).json({ problemCategories: problemCategories || [] });
  } catch (error: any) {
    console.error('Error fetching problem categories:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch problem categories' });
  }
}

export default withAuth(handler);
