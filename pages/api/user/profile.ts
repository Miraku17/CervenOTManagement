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

    if (error) throw error;

    return res.status(200).json(data);

  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}

export default withAuth(handler);
