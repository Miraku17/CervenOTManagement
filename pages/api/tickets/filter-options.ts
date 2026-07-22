import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

// Returns the option lists for the tickets page filter panel in one round trip:
// stores, problem categories, request types, and engineers who have serviced tickets.
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const [storesRes, categoriesRes, requestTypesRes, servicedByRes] = await Promise.all([
      supabaseAdmin
        .from('stores')
        .select('id, store_name, store_code')
        .is('deleted_at', null)
        .order('store_name'),
      supabaseAdmin
        .from('problem_categories')
        .select('id, name')
        .order('name'),
      supabaseAdmin
        .from('request_types')
        .select('id, name')
        .order('name'),
      supabaseAdmin
        .from('tickets')
        .select('serviced_by, serviced_by_user:serviced_by (first_name, last_name)')
        .not('serviced_by', 'is', null),
    ]);

    if (storesRes.error) throw storesRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (requestTypesRes.error) throw requestTypesRes.error;
    if (servicedByRes.error) throw servicedByRes.error;

    // Dedupe engineers by id
    const engineerMap = new Map<string, { id: string; first_name: string; last_name: string }>();
    for (const row of servicedByRes.data || []) {
      const u = row.serviced_by_user as unknown as { first_name: string; last_name: string } | null;
      if (row.serviced_by && u && !engineerMap.has(row.serviced_by)) {
        engineerMap.set(row.serviced_by, {
          id: row.serviced_by,
          first_name: u.first_name,
          last_name: u.last_name,
        });
      }
    }
    const engineers = Array.from(engineerMap.values()).sort((a, b) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
    );

    return res.status(200).json({
      stores: storesRes.data || [],
      categories: categoriesRes.data || [],
      requestTypes: requestTypesRes.data || [],
      engineers,
    });
  } catch (error: any) {
    console.error('Error fetching ticket filter options:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch filter options' });
  }
}

export default withAuth(handler);
