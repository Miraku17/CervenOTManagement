import type { NextApiResponse } from 'next';
import { supabase } from '@/services/supabase';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Fetch all autocomplete data in parallel - now with IDs
    const [categoriesRes, brandsRes, modelsRes, stationsRes] = await Promise.all([
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('brands').select('id, name').order('name'),
      supabase.from('models').select('id, name').order('name'),
      supabase.from('stations').select('id, name').order('name'),
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

export default withAuth(handler);
