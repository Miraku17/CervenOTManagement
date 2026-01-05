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

  const {
    id,
    title,
    content,
    category_id,
    tags,
    published,
    video_urls = [],
    keep_image_ids = [],
    new_images = []
  } = req.body;

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

    // Handle video URLs update
    if (Array.isArray(video_urls)) {
      // Delete existing video URLs for this article
      await supabaseAdmin
        .from('kb_videos')
        .delete()
        .eq('kb_id', id);

      // Insert new video URLs if provided
      if (video_urls.length > 0) {
        const videoRecords = video_urls
          .filter((url: string) => url && url.trim())
          .map((url: string) => ({
            kb_id: id,
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
    }

    // Handle images update
    if (Array.isArray(keep_image_ids) || Array.isArray(new_images)) {
      // Get all existing images for this article
      const { data: existingImages } = await supabaseAdmin
        .from('kb_images')
        .select('id, image_url')
        .eq('kb_id', id);

      // Delete images that are not in keep_image_ids
      if (existingImages && existingImages.length > 0) {
        const imagesToDelete = existingImages.filter(
          (img: any) => !keep_image_ids.includes(img.id)
        );

        for (const image of imagesToDelete) {
          // Delete from storage
          try {
            const urlParts = image.image_url.split('/kb-media/');
            if (urlParts.length > 1) {
              const storagePath = urlParts[1];
              await supabaseAdmin.storage
                .from('kb-media')
                .remove([storagePath]);
            }
          } catch (error) {
            console.error('Error deleting image from storage:', error);
          }

          // Delete from database
          await supabaseAdmin
            .from('kb_images')
            .delete()
            .eq('id', image.id);
        }
      }

      // Upload new images if provided
      if (new_images && Array.isArray(new_images) && new_images.length > 0) {
        // Get current max display_order
        const { data: currentImages } = await supabaseAdmin
          .from('kb_images')
          .select('display_order')
          .eq('kb_id', id)
          .order('display_order', { ascending: false })
          .limit(1);

        let startOrder = currentImages && currentImages.length > 0
          ? (currentImages[0].display_order + 1)
          : 0;

        const imageRecords: any[] = [];

        for (let i = 0; i < new_images.length; i++) {
          const image = new_images[i];
          if (!image.fileData || !image.fileName) continue;

          try {
            // Generate filename with order prefix
            const fileExtension = image.fileName.split('.').pop() || 'png';
            const orderPrefix = String(startOrder + i + 1).padStart(3, '0');
            const sanitizedName = image.fileName
              .toLowerCase()
              .replace(/[^a-z0-9.-]/g, '-')
              .replace(/^\.+/, '')
              .replace(/\.+/g, '.');
            const fileName = `${orderPrefix}-${sanitizedName}`;

            // Storage path: kb-media/kb/<kb_id>/images/<filename>
            const storagePath = `kb-media/kb/${id}/images/${fileName}`;

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
              kb_id: id,
              image_url: urlData.publicUrl,
              display_order: startOrder + i,
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
