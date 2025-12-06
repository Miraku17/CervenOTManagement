import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    res.setHeader('Allow', ['PUT', 'PATCH']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id, store_name, store_code, contact_no, address, managers } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Store ID is required.' });
  }

  try {


     if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    
    const { data, error } = await supabaseAdmin
      .from('stores')
      .update({
        store_name,
        store_code,
        contact_no,
        address,
        managers,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json({ store: data });
  } catch (error: any) {
    console.error('Error updating store:', error);
    return res.status(500).json({ error: error.message || 'Failed to update store' });
  }
}
