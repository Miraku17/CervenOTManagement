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

    const { category_id, limit = 10, recent = false } = req.query;

    let query = supabaseAdmin
      .from('knowledge_base')
      .select(`
        id,
        title,
        slug,
        content,
        category_id,
        created_at,
        updated_at,
        published,
        kb_categories (
          id,
          name
        )
      `)
      .eq('published', true)
      .is('deleted_at', null);

    // Filter by category if provided
    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    // Order by created_at for recent articles
    if (recent) {
      query = query.order('created_at', { ascending: false });
    }

    // Apply limit
    query = query.limit(Number(limit));

    const { data: articles, error } = await query;

    if (error) throw error;

    // Transform the data to include category name
    const transformedArticles = articles?.map(article => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      category_id: article.category_id,
      category: article.kb_categories?.name || 'Uncategorized',
      created_at: article.created_at,
      updated_at: article.updated_at,
      published: article.published
    }));

    return res.status(200).json({ articles: transformedArticles || [] });
  } catch (error: any) {
    console.error('Error fetching knowledge base articles:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch articles' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
