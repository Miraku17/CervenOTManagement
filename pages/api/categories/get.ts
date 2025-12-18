import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const { data: categories, error } = await supabaseAdmin
      .from('categories')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;

    return res.status(200).json({ categories: categories || [] });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch categories' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
