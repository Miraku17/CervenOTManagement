import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
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

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const search = (req.query.q as string) || '';
    const ticketId = req.query.id as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 50); // Max 50 results

    // If fetching by ID, return that specific ticket
    if (ticketId) {
      const { data: ticket, error } = await supabaseAdmin
        .from('tickets')
        .select(`
          id,
          rcc_reference_number,
          stores:store_id (
            store_name,
            store_code
          )
        `)
        .eq('id', ticketId)
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json({ tickets: ticket ? [ticket] : [] });
    }

    // Build the query
    let query = supabaseAdmin
      .from('tickets')
      .select(`
        id,
        rcc_reference_number,
        stores:store_id (
          store_name,
          store_code
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply search filter if provided
    if (search.trim()) {
      query = query.or(`rcc_reference_number.ilike.%${search}%`);
    }

    const { data: tickets, error } = await query;

    if (error) {
      throw error;
    }

    return res.status(200).json({ tickets: tickets || [] });
  } catch (error: any) {
    console.error('Error searching tickets:', error);
    return res.status(500).json({ error: error.message || 'Failed to search tickets' });
  }
}

export default withAuth(handler);
