import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  try {
    const { data: positions, error } = await supabaseAdmin
      .from('positions')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;

    return res.status(200).json({ positions: positions || [] });
  } catch (error: any) {
    console.error('Error fetching positions:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch positions' });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
