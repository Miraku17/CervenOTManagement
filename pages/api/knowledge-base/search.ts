import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const searchQuery = q.trim().toLowerCase();

    // Search across multiple fields: title, kb_code, content, tags
    // Using OR conditions to search in different fields
    const { data: articles, error } = await supabaseAdmin
      .from('knowledge_base')
      .select(`
        id,
        title,
        slug,
        content,
        category_id,
        kb_code,
        tags,
        created_at,
        updated_at,
        kb_categories (
          id,
          name
        )
      `)
      .eq('published', true)
      .is('deleted_at', null)
      .or(`title.ilike.%${searchQuery}%,kb_code.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    // Also filter by tags (array contains)
    let results = articles || [];

    // Additional client-side filtering for tags (since PostgreSQL array search is limited)
    results = results.filter(article => {
      // Check if already matched by title, kb_code, or content
      const matchesBasicSearch =
        article.title.toLowerCase().includes(searchQuery) ||
        article.kb_code.toLowerCase().includes(searchQuery) ||
        article.content.toLowerCase().includes(searchQuery);

      // Check tags
      const matchesTags = article.tags && Array.isArray(article.tags)
        ? article.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery))
        : false;

      return matchesBasicSearch || matchesTags;
    });

    // Transform the data to include category name
    const transformedArticles = results.map(article => {
      const categoryData = article.kb_categories as any;
      return {
        id: article.id,
        title: article.title,
        slug: article.slug,
        content: article.content,
        category_id: article.category_id,
        category: categoryData?.name || 'Uncategorized',
        kb_code: article.kb_code,
        tags: article.tags || [],
        created_at: article.created_at,
        updated_at: article.updated_at,
      };
    });

    return res.status(200).json({
      articles: transformedArticles,
      count: transformedArticles.length,
      query: q
    });
  } catch (error: any) {
    console.error('Error searching knowledge base:', error);
    return res.status(500).json({ error: error.message || 'Failed to search articles' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
