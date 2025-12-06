import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { store_name, store_code, contact_no, address, managers } = req.body;

  if (!store_name || !store_code) {
    return res.status(400).json({ error: 'Store name and store code are required.' });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const { data, error } = await supabaseAdmin
      .from('stores')
      .insert([
        {
          store_name,
          store_code,
          contact_no,
          address,
          managers,
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({ store: data });
  } catch (error: any) {
    console.error('Error creating store:', error);
    return res.status(500).json({ error: error.message || 'Failed to create store' });
  }
}
