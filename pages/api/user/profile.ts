import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, positions(name)')
      .eq('id', userId)
      .single();

    if (error) throw error;

    return res.status(200).json(data);

  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
