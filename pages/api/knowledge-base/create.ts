import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

// Function to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const {
    title,
    content,
    category,
    description,
    tags,
    published = false,
    kb_code,
  } = req.body;

  // Validation
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  if (!kb_code) {
    return res.status(400).json({ error: 'KB code is required' });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Get author_id from authenticated user
    const author_id = req.user.id;

    // Generate slug from title
    let slug = generateSlug(title);

    // Check if slug exists and make it unique if necessary
    const { data: existingSlugs } = await supabaseAdmin
      .from('knowledge_base')
      .select('slug')
      .like('slug', `${slug}%`);

    if (existingSlugs && existingSlugs.length > 0) {
      const slugSet = new Set(existingSlugs.map(item => item.slug));
      let counter = 1;
      let uniqueSlug = slug;

      while (slugSet.has(uniqueSlug)) {
        uniqueSlug = `${slug}-${counter}`;
        counter++;
      }

      slug = uniqueSlug;
    }

    // Get category_id from category name if category is provided
    let category_id = null;
    if (category) {
      const { data: categoryData, error: categoryError } = await supabaseAdmin
        .from('kb_categories')
        .select('id')
        .eq('name', category)
        .single();

      if (categoryError) {
        console.error('Error fetching category:', categoryError);
      } else if (categoryData) {
        category_id = categoryData.id;
      }
    }

    // Prepare tags array
    const tagsArray = Array.isArray(tags) ? tags : [];

    // Create the knowledge base article
    const { data: article, error: articleError } = await supabaseAdmin
      .from('knowledge_base')
      .insert([
        {
          title,
          slug,
          content,
          category_id,
          author_id,
          published,
          tags: tagsArray,
          kb_code,
        },
      ])
      .select()
      .single();

    if (articleError) {
      throw articleError;
    }

    return res.status(201).json({ article });
  } catch (error: any) {
    console.error('Error creating knowledge base article:', error);
    return res.status(500).json({ error: error.message || 'Failed to create article' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
