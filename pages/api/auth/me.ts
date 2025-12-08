import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Get user ID from query or headers
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError);
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      user: {
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
      }
    });
  } catch (error: any) {
    console.error('Error fetching current user:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch user' });
  }
}
