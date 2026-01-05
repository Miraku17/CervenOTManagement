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
    video_urls = [],
    images = [],
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
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
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

    // Insert video URLs if provided
    if (video_urls && Array.isArray(video_urls) && video_urls.length > 0) {
      const videoRecords = video_urls
        .filter((url: string) => url && url.trim())
        .map((url: string) => ({
          kb_id: article.id,
          video_url: url.trim(),
        }));

      if (videoRecords.length > 0) {
        const { error: videoError } = await supabaseAdmin
          .from('kb_videos')
          .insert(videoRecords);

        if (videoError) {
          console.error('Error inserting video URLs:', videoError);
          // Don't fail the whole request if video insertion fails
        }
      }
    }

    // Upload images to Supabase Storage if provided
    if (images && Array.isArray(images) && images.length > 0) {
      const imageRecords: any[] = [];

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        if (!image.fileData || !image.fileName) continue;

        try {
          // Generate filename with order prefix
          const fileExtension = image.fileName.split('.').pop() || 'png';
          const orderPrefix = String(i + 1).padStart(3, '0');
          const sanitizedName = image.fileName
            .toLowerCase()
            .replace(/[^a-z0-9.-]/g, '-')
            .replace(/^\.+/, '')
            .replace(/\.+/g, '.');
          const fileName = `${orderPrefix}-${sanitizedName}`;

          // Storage path: kb-media/kb/<kb_id>/images/<filename>
          const storagePath = `kb-media/kb/${article.id}/images/${fileName}`;

          // Convert base64 to buffer
          const buffer = Buffer.from(image.fileData, 'base64');

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('kb-media')
            .upload(storagePath.replace('kb-media/', ''), buffer, {
              contentType: image.fileType || 'image/png',
              upsert: false,
            });

          if (uploadError) {
            console.error('Error uploading image:', uploadError);
            continue;
          }

          // Get public URL
          const { data: urlData } = supabaseAdmin.storage
            .from('kb-media')
            .getPublicUrl(storagePath.replace('kb-media/', ''));

          imageRecords.push({
            kb_id: article.id,
            image_url: urlData.publicUrl,
            display_order: i,
          });
        } catch (error) {
          console.error('Error processing image:', error);
        }
      }

      // Insert image records into database
      if (imageRecords.length > 0) {
        const { error: imageError } = await supabaseAdmin
          .from('kb_images')
          .insert(imageRecords);

        if (imageError) {
          console.error('Error inserting image records:', imageError);
        }
      }
    }

    return res.status(201).json({ article });
  } catch (error: any) {
    console.error('Error creating knowledge base article:', error);
    return res.status(500).json({ error: error.message || 'Failed to create article' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
