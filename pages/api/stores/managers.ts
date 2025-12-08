import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { store_id } = req.query;

  if (!store_id || typeof store_id !== 'string') {
    return res.status(400).json({ error: 'Store ID is required' });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Fetch managers for the specified store
    const { data: managers, error: managersError } = await supabaseAdmin
      .from('store_managers')
      .select('id, manager_name')
      .eq('store_id', store_id);

    if (managersError) {
      throw managersError;
    }

    return res.status(200).json({ managers: managers || [] });
  } catch (error: any) {
    console.error('Error fetching managers:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch managers' });
  }
}
