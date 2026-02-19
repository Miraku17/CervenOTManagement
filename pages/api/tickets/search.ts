import type { NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  // Create a fresh client per request to avoid stale TLS connections
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const search = (req.query.q as string) || '';
    const ticketId = req.query.id as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 50);

    const selectFields = `
      id,
      rcc_reference_number,
      stores:store_id (
        store_name,
        store_code
      )
    `;

    // If fetching by ID, return that specific ticket
    if (ticketId) {
      const { data: ticket, error } = await client
        .from('tickets')
        .select(selectFields)
        .eq('id', ticketId)
        .single();

      if (error) throw error;

      return res.status(200).json({ tickets: ticket ? [ticket] : [] });
    }

    // Build the search query
    let query = client
      .from('tickets')
      .select(selectFields)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (search.trim()) {
      query = query.or(`rcc_reference_number.ilike.%${search}%`);
    }

    const { data: tickets, error } = await query;

    if (error) throw error;

    return res.status(200).json({ tickets: tickets || [] });
  } catch (error: any) {
    console.error('Error searching tickets:', error);
    return res.status(500).json({ error: error.message || 'Failed to search tickets' });
  }
}

export default withAuth(handler);
