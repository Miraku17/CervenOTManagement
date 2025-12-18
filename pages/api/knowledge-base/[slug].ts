import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug is required' });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const { data: article, error } = await supabaseAdmin
      .from('knowledge_base')
      .select(`
        id,
        title,
        slug,
        content,
        category_id,
        author_id,
        kb_code,
        created_at,
        updated_at,
        published,
        kb_categories (
          id,
          name
        )
      `)
      .eq('slug', slug)
      .eq('published', true)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Article not found' });
      }
      throw error;
    }

    // Fetch author information separately
    let authorName = 'Unknown';
    if (article.author_id) {
      const { data: authorData } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', article.author_id)
        .single();

      if (authorData) {
        authorName = `${authorData.first_name} ${authorData.last_name}`;
      }
    }

    // Transform the data
    const categoryData = article.kb_categories as any;
    const transformedArticle = {
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      category_id: article.category_id,
      category: categoryData?.name || 'Uncategorized',
      kb_code: article.kb_code,
      author: authorName,
      created_at: article.created_at,
      updated_at: article.updated_at,
      published: article.published
    };

    return res.status(200).json({ article: transformedArticle });
  } catch (error: any) {
    console.error('Error fetching article:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch article' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
