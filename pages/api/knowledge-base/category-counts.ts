import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Get all categories with their article counts
    const { data: categories, error: categoriesError } = await supabaseAdmin
      .from('kb_categories')
      .select('id, name')
      .order('name', { ascending: true });

    if (categoriesError) throw categoriesError;

    // Get counts for each category
    const categoriesWithCounts = await Promise.all(
      (categories || []).map(async (category) => {
        const { count, error: countError } = await supabaseAdmin!
          .from('knowledge_base')
          .select('id', { count: 'exact', head: true })
          .eq('category_id', category.id)
          .eq('published', true)
          .is('deleted_at', null);

        if (countError) {
          console.error(`Error counting articles for category ${category.name}:`, countError);
          return { ...category, articleCount: 0 };
        }

        return { ...category, articleCount: count || 0 };
      })
    );

    return res.status(200).json({ categories: categoriesWithCounts });
  } catch (error: any) {
    console.error('Error fetching category counts:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch category counts' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
