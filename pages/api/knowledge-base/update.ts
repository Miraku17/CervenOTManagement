import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

// Function to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id, title, content, category_id, tags, published } = req.body;

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!id) {
      return res.status(400).json({ error: 'Article ID is required' });
    }

    if (!title || !content || !category_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get the author_id from authenticated user
    const author_id = req.user.id;

    // Check if article exists and get current data
    const { data: existingArticle, error: fetchError } = await supabaseAdmin
      .from('knowledge_base')
      .select('slug, author_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingArticle) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Verify the user is the author (RLS will also enforce this)
    if (existingArticle.author_id !== author_id) {
      return res.status(403).json({ error: 'Forbidden: You can only edit your own articles' });
    }

    // Generate slug from title
    let slug = generateSlug(title);
    let finalSlug = slug;

    // Only check for slug uniqueness if the title/slug has changed
    if (existingArticle.slug !== slug) {
      const { data: existingSlugs } = await supabaseAdmin
        .from('knowledge_base')
        .select('slug')
        .like('slug', `${slug}%`)
        .neq('id', id);

      if (existingSlugs && existingSlugs.length > 0) {
        const slugSet = new Set(existingSlugs.map(item => item.slug));
        let counter = 1;
        let uniqueSlug = slug;

        while (slugSet.has(uniqueSlug)) {
          uniqueSlug = `${slug}-${counter}`;
          counter++;
        }

        finalSlug = uniqueSlug;
      }
    } else {
      // Keep the existing slug
      finalSlug = existingArticle.slug;
    }

    // Prepare tags array
    const tagsArray = tags !== undefined ? (Array.isArray(tags) ? tags : []) : undefined;

    // Prepare update data
    const updateData: any = {
      title,
      slug: finalSlug,
      content,
      category_id,
      updated_at: new Date().toISOString(),
    };

    if (tagsArray !== undefined) {
      updateData.tags = tagsArray;
    }

    if (published !== undefined) {
      updateData.published = published;
    }

    // Update the article
    const { data: article, error: updateError } = await supabaseAdmin
      .from('knowledge_base')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      success: true,
      article,
      message: 'Article updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating knowledge base article:', error);
    return res.status(500).json({ error: error.message || 'Failed to update article' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
