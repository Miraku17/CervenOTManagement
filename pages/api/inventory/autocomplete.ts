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

    // Fetch all autocomplete data in parallel - now with IDs
    const [categoriesRes, brandsRes, modelsRes, stationsRes] = await Promise.all([
      supabaseAdmin.from('categories').select('id, name').is('deleted_at', null).order('name'),
      supabaseAdmin.from('brands').select('id, name').is('deleted_at', null).order('name'),
      supabaseAdmin.from('models').select('id, name').is('deleted_at', null).order('name'),
      supabaseAdmin.from('stations').select('id, name').order('name'),
    ]);

    if (categoriesRes.error) throw categoriesRes.error;
    if (brandsRes.error) throw brandsRes.error;
    if (modelsRes.error) throw modelsRes.error;
    if (stationsRes.error) throw stationsRes.error;

    return res.status(200).json({
      categories: categoriesRes.data || [],
      brands: brandsRes.data || [],
      models: modelsRes.data || [],
      stations: stationsRes.data || [],
    });
  } catch (error: any) {
    console.error('Error fetching autocomplete data:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch autocomplete data' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
