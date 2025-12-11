import { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Use authenticated user's ID instead of query parameter
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'User not authenticated' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, positions(name)')
      .eq('id', userId)
      .single();
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Use authenticated user's ID
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
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

export default withAuth(handler);
